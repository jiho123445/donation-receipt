import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Cloud, RefreshCw, X } from 'lucide-react';
import { auth, firebaseConfigured, firebaseConfig } from './firebase';
import {
  RawDonationRecord,
  MemberRecord,
  OrganizationInfo,
  IssuedReceiptRecord,
  PrintSettings,
  ReceiptFormType,
  DocumentType,
  AwardRecord,
} from './types/donation';
import {
  getOrganizationInfo,
  saveOrganizationInfo,
  getActiveDonations,
  clearActiveDonations,
  getIssuedReceipts,
  saveIssuedReceipt,
  cancelIssuedReceipt,
  deleteIssuedReceiptLocal,
  getNextReceiptNumber,
  getPrintSettings,
  savePrintSettings,
} from './utils/storage';
import { numberToHangulAmount } from './utils/hangulCurrency';
import { Header } from './components/Header';
import { DonorSearch } from './components/DonorSearch';
import { IssuanceHistory } from './components/IssuanceHistory';
import { ExcelManager } from './components/ExcelManager';
import { AwardManager } from './components/AwardManager';
import { ManagementDashboard } from './components/ManagementDashboard';
import { MembershipStatusManager } from './components/MembershipStatusManager';
import { MemberManager } from './components/MemberManager';
import { OrgSettingsModal } from './components/OrgSettingsModal';
import { PrintSettingsModal } from './components/PrintSettingsModal';
import { IssuanceConfirmModal } from './components/IssuanceConfirmModal';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { OfficialReceiptA4 } from './components/OfficialReceiptA4';
import { LoginScreen } from './components/LoginScreen';
import { INITIAL_SAMPLE_DONATIONS } from './utils/sampleData';
import { mergeDonationRecords } from './utils/donationDedup';
import { mergeAwardRecords } from './utils/awardDedup';
import { normalizeAwardRecord } from './utils/awardCompatibility';
import { INITIAL_SAMPLE_AWARDS } from './utils/awardSeedData';
import {
  loadCloudOrganization,
  loadCloudReceipts,
  loadCloudDonations,
  batchSaveCloudDonations,
  deleteAllCloudDonations,
  deleteAllImportedFileRecords,
  loadCloudAwards,
  loadCloudMembers,
  saveCloudMember,
  deleteCloudMember,
  batchSaveCloudAwards,
  deleteAllCloudAwards,
  saveCloudOrganization,
  saveCloudReceipt,
  cancelCloudReceipt,
  deleteCloudReceipt,
  getNextCloudReceiptNumber,
  testFirestoreConnection,
  saveCloudDonor,
  checkFileAlreadyImported,
  recordFileImport,
  type FirestoreConnectionStatus,
  type ImportedFileRecord,
} from './utils/firebaseDb';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus | null>(null);
  const [showStatusBanner, setShowStatusBanner] = useState(true);
  const [isReloadingCloudData, setIsReloadingCloudData] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'feeStatus' | 'search' | 'membership' | 'history' | 'awards' | 'members' | 'settings' | 'print'>('dashboard');
  const [searchResetKey, setSearchResetKey] = useState<number>(0);

  const handleResetSearch = () => {
    setSearchResetKey((prev) => prev + 1);
  };

  // Core Data
  // 실제 후원자료는 항상 Firebase(또는 명시적으로 업로드한 Excel)를 원본으로 사용합니다.
  // 샘플자료는 사용자가 '샘플 데이터 불러오기'를 눌렀을 때만 로드합니다.
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [donations, setDonations] = useState<RawDonationRecord[]>([]);
  // 회원 표창(수상) 내역 — 첨부된 표창명단(PDF/엑셀)을 성명+연도+수상내역 단위로 정규화해 보관합니다.
  // donations와 동일하게 로그인 시 Firebase(awards 컬렉션)를 원본으로 사용하며 localStorage에는 저장하지 않습니다.
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo>(getOrganizationInfo());
  const [issuedReceipts, setIssuedReceipts] = useState<IssuedReceiptRecord[]>([]);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings());

  // Modals & Active Flows
  const [isOrgSettingsOpen, setIsOrgSettingsOpen] = useState(false);
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    donorName: string;
    idNumber: string;
    address: string;
    taxYear: number;
    donations: RawDonationRecord[];
    documentType?: DocumentType;
  } | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<IssuedReceiptRecord | null>(null);

  // Check Firestore connection
  const checkConnection = async () => {
    if (!firebaseConfigured) {
      setFirestoreStatus({
        connected: false,
        message: '로컬 데이터 모드로 동작 중입니다. (Firebase API Key 환경변수 미설정 시 안전한 로컬 저장소를 사용합니다)',
      });
      return;
    }
    const status = await testFirestoreConnection();
    setFirestoreStatus(status);
  };

  // 중요: 기존 Firebase에는 donations / awards / members 등 여러 컬렉션이 존재합니다.
  // 한 컬렉션의 읽기 오류가 전체 로딩을 0건으로 만드는 Promise.all 방식은 사용하지 않습니다.
  // 각 컬렉션을 독립적으로 읽어, 예를 들어 receipts 권한 오류가 있어도 donations/awards는 정상 표시합니다.
  //
  // 로그인 시(onAuthStateChanged)뿐 아니라, 화면 상태 배너의 "다시 불러오기" 버튼에서도
  // 재사용할 수 있도록 별도 함수로 분리했습니다. 이전에는 firestoreStatus가 계산만 되고
  // 화면 어디에도 렌더링되지 않아, donations/awards 로딩이 실패해도(예: 보안규칙/권한 문제)
  // 사용자는 그냥 "0건"만 보고 원인을 알 수 없었습니다.
  const loadAllCloudCollections = async () => {
    setIsReloadingCloudData(true);
    try {
      const results = await Promise.allSettled([
        loadCloudOrganization(),
        loadCloudReceipts(),
        loadCloudDonations(),
        loadCloudAwards(),
        loadCloudMembers(),
      ]);

      const [orgResult, receiptsResult, donationsResult, awardsResult, membersResult] = results;
      const errors: string[] = [];

      if (orgResult.status === 'fulfilled' && orgResult.value) {
        setOrgInfo(orgResult.value);
        saveOrganizationInfo(orgResult.value);
      } else {
        setOrgInfo(getOrganizationInfo());
        if (orgResult.status === 'rejected') errors.push(`organizations: ${String(orgResult.reason?.message || orgResult.reason)}`);
      }

      if (receiptsResult.status === 'fulfilled') {
        setIssuedReceipts(receiptsResult.value);
      } else {
        setIssuedReceipts([]);
        errors.push(`receipts: ${String(receiptsResult.reason?.message || receiptsResult.reason)}`);
      }

      if (donationsResult.status === 'fulfilled') {
        const normalizedCloudDonations = donationsResult.value.map((d, index) => ({
          ...d,
          id: d.id || `cloud-${index}-${Date.now()}`,
          donorName: String(d.donorName || '').trim(),
          idNumber: String(d.idNumber || '').trim(),
          address: String(d.address || '').trim(),
          date: String(d.date || d.period || ''),
          period: String(d.period || ''),
          amount: Math.round(Number(d.amount || 0)),
          paymentMethod: String(d.paymentMethod || '').trim(),
          content: String(d.content || '').trim(),
        }));
        setDonations(normalizedCloudDonations);
        if (donationsResult.value.length === 0) {
          errors.push('donations: 컬렉션에 문서가 0건입니다 (권한 오류는 아니며, Firestore의 donations 컬렉션 자체가 비어 있습니다).');
        }
      } else {
        setDonations([]);
        errors.push(`donations: ${String(donationsResult.reason?.message || donationsResult.reason)}`);
      }

      if (awardsResult.status === 'fulfilled') {
        const normalizedCloudAwards = awardsResult.value.map((a, index) =>
          normalizeAwardRecord(a as unknown as Record<string, unknown>, a.id || `cloud-award-${index}-${Date.now()}`)
        );
        setAwards(normalizedCloudAwards);
      } else {
        setAwards([]);
        errors.push(`awards: ${String(awardsResult.reason?.message || awardsResult.reason)}`);
      }

      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value);
      } else {
        setMembers([]);
        errors.push(`members: ${String(membersResult.reason?.message || membersResult.reason)}`);
      }

      // donations: 0건 안내는 "오류"가 아니라 "확인 필요" 성격이라 connected는 true로 유지합니다.
      const hardErrors = errors.filter((e) => !e.startsWith('donations: 컬렉션에 문서가 0건'));
      if (errors.length === 0) {
        setFirestoreStatus({
          connected: true,
          message: `Cloud Firestore (프로젝트: ${firebaseConfig.projectId})의 기존 데이터를 정상적으로 불러왔습니다.`,
        });
      } else {
        setFirestoreStatus({
          connected: true,
          message: hardErrors.length > 0
            ? `Firebase에 연결되었으며 일부 컬렉션만 불러오지 못했습니다. (${hardErrors.length}개)`
            : `Firebase에 정상 연결되었지만 donations 컬렉션에 자료가 없습니다.`,
          errorDetail: errors.join('\n'),
        });
      }

      setPrintSettings(getPrintSettings());
    } finally {
      setIsReloadingCloudData(false);
    }
  };

  // 상태 배너의 "다시 불러오기" 버튼: 로그인된 상태에서 수동으로 재조회할 때 사용합니다.
  const handleManualCloudReload = async () => {
    if (!firebaseConfigured || !auth?.currentUser) {
      await checkConnection();
      return;
    }
    await loadAllCloudCollections();
  };

  // Initialize data on mount
  useEffect(() => {
    checkConnection();

    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      setDonations([]);
      setAwards([]);
      setOrgInfo(getOrganizationInfo());
      setIssuedReceipts(getIssuedReceipts());
      setPrintSettings(getPrintSettings());
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setIssuedReceipts([]);
        return;
      }
      await loadAllCloudCollections();
    });
  }, []);


  // Update Donations Handler
  //
  // 중요: 화면의 donations 상태는 '현재 화면에 표시할 자료'일 뿐 원본 DB가 아닙니다.
  // 특히 '회원 명단 초기화' 후에는 donations=[]가 되므로, Excel 업로드 시 화면 상태를
  // 기존자료로 사용하면 Firebase에 이미 있는 자료를 놓칠 수 있습니다.
  // 따라서 로그인된 Firebase 모드에서는 매 업로드 직전에 Cloud의 최신 donations를 다시 읽어
  // Excel과 병합합니다. 이 방식이면
  //   Firebase 2건 + Excel 3건 -> 최종 3건
  // 이 정확하게 유지됩니다.
  const handleUpdateDonations = async (records: RawDonationRecord[]) => {
    let baseRecords = donations;

    if (firebaseConfigured && auth?.currentUser) {
      // 회원 명단 초기화 여부와 관계없이 Firebase를 원본으로 다시 읽습니다.
      baseRecords = await loadCloudDonations();
    }

    const { records: merged, added, updated, duplicates } = mergeDonationRecords(baseRecords, records);

    if (firebaseConfigured && auth?.currentUser && (added.length > 0 || updated.length > 0)) {
      await batchSaveCloudDonations([...added, ...updated]);
    }

    setDonations(merged);

    return {
      total: merged.length,
      added: added.length,
      duplicates,
    };
  };

  // Update Awards Handler
  // donations와 동일한 이유로, 로그인된 Firebase 모드에서는 매 업로드/불러오기 직전에
  // Cloud의 최신 awards를 다시 읽어 병합합니다. (화면 상태만 기존자료로 쓰면 이미 저장된 수상내역을 놓칠 수 있음)
  const handleUpdateAwards = async (records: AwardRecord[]) => {
    let baseRecords = awards;

    if (firebaseConfigured && auth?.currentUser) {
      baseRecords = await loadCloudAwards();
    }

    const { records: merged, added, duplicates } = mergeAwardRecords(baseRecords, records);

    if (firebaseConfigured && auth?.currentUser && added.length > 0) {
      await batchSaveCloudAwards(added);
    }

    setAwards(merged);

    return {
      total: merged.length,
      added: added.length,
      duplicates,
    };
  };

  // 첨부된 표창명단(PDF)을 옮겨 담은 기본 수상내역을 한 번에 불러옵니다.
  const handleLoadSeedAwards = async () => {
    return handleUpdateAwards(INITIAL_SAMPLE_AWARDS);
  };

  // Clear Awards Handler — awards 컬렉션만 초기화하며 다른 자료는 건드리지 않습니다.
  const handleClearAwards = async (): Promise<{ deleted: number }> => {
    if (firebaseConfigured && auth?.currentUser) {
      const deleted = await deleteAllCloudAwards();
      setAwards([]);
      return { deleted };
    }

    setAwards([]);
    return { deleted: 0 };
  };

  // 파일 재업로드 확인 (파일 전체 해시 기준)
  const handleCheckFileImported = async (fileHash: string): Promise<ImportedFileRecord | null> => {
    if (!firebaseConfigured || !auth?.currentUser) return null;
    return checkFileAlreadyImported(fileHash);
  };

  const handleRecordFileImport = async (fileHash: string, fileName: string, rowCount: number): Promise<void> => {
    if (!firebaseConfigured || !auth?.currentUser) return;
    await recordFileImport(fileHash, fileName, rowCount);
  };

  // Clear Donations Handler
  // '회원 명단 초기화'는 화면만 비우는 것이 아니라, 로그인된 Firebase 환경에서는
  // donations 컬렉션 전체를 실제로 삭제합니다. 다른 컬렉션(donors, receipts,
  // issuedReceipts, organizations, counters)은 절대 삭제하지 않습니다.
  //
  // importedFiles(파일 재업로드 확인용 기록)는 donations와 별개 컬렉션이라 자동으로
  // 같이 지워지지 않습니다. 이걸 그대로 두면, donations는 실제로 0건이 됐는데도
  // 초기화 전에 올렸던 파일을 다시 올릴 때 "이미 가져온 파일입니다(OOO건 가져옴)"라는
  // 예전 안내가 그대로 다시 떠서 마치 초기화가 안 된 것처럼 보이므로, 함께 비웁니다.
  const handleClearDonations = async (): Promise<{ deleted: number }> => {
    if (firebaseConfigured && auth?.currentUser) {
      const deleted = await deleteAllCloudDonations();
      try {
        // importedFiles 삭제가 실패하더라도(예: 드물게 규칙/권한 문제), 이미 성공한
        // donations 삭제 자체는 화면에 정상 반영되어야 하므로 별도로 감쌉니다.
        await deleteAllImportedFileRecords();
      } catch (error) {
        console.error('deleteAllImportedFileRecords error (donations 삭제 자체는 성공):', error);
      }
      // 클라우드 삭제가 성공한 뒤에만 화면/로컬 상태를 비웁니다.
      setDonations([]);
      clearActiveDonations();
      return { deleted };
    }

    setDonations([]);
    clearActiveDonations();
    return { deleted: 0 };
  };

  // Save Org Info
  const handleSaveOrgInfo = (updated: OrganizationInfo) => {
    setOrgInfo(updated);
    saveOrganizationInfo(updated);
    if (firebaseConfigured && auth?.currentUser) {
      saveCloudOrganization(updated).catch(console.error);
    }
  };

  // Save Print Settings
  const handleSavePrintSettings = (updated: PrintSettings) => {
    setPrintSettings(updated);
    savePrintSettings(updated);
  };

  // Cancel an Issued Receipt
  const handleCancelReceipt = (receiptNo: string) => {
    cancelIssuedReceipt(receiptNo);
    setIssuedReceipts((prev) => prev.map((r) => r.receiptNo === receiptNo ? { ...r, status: 'cancelled' as const } : r));
    if (firebaseConfigured && auth?.currentUser) {
      cancelCloudReceipt(receiptNo).catch(console.error);
    }
  };

  // Permanently delete an Issued Receipt (테스트 발급내역 등을 완전히 삭제할 때 사용)
  // '발급취소'와 달리 이력을 남기지 않고 로컬/클라우드에서 완전히 제거합니다.
  const handleDeleteReceipt = (receiptNo: string) => {
    deleteIssuedReceiptLocal(receiptNo);
    setIssuedReceipts((prev) => prev.filter((r) => r.receiptNo !== receiptNo));
    if (firebaseConfigured && auth?.currentUser) {
      deleteCloudReceipt(receiptNo).catch(console.error);
    }
  };

  // Confirm and Generate a New Receipt
  const handleConfirmIssuance = async (
    formType: ReceiptFormType,
    issueDate: string,
    isReissue: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!confirmModalData) {
      return { success: false, error: '발급 대상자 정보가 없습니다.' };
    }

    try {
      const { donorName, idNumber, address, taxYear, donations: donorItems, documentType = 'receipt' } = confirmModalData;
      const isMembership = documentType === 'membership';
      const totalAmount = donorItems.reduce((sum, d) => sum + d.amount, 0);
      const amountInKorean = numberToHangulAmount(totalAmount);

      // 회비납부확인서는 세법상 공식 기부금영수증이 아니므로 고유번호/사업자등록번호 입력을 강제하지 않습니다.
      if (!isMembership && !orgInfo.registrationNo && !orgInfo.bizNo) {
        return {
          success: false,
          error: '기부금영수증 발급에 필요한 단체 고유번호 또는 사업자등록번호가 등록되지 않았습니다.',
        };
      }

      const finalOrgInfo: OrganizationInfo = {
        ...orgInfo,
        designationInfo: orgInfo.designationInfo || '소득세법 시행령 제80조제1항제5호, 법인세법 시행령 제39조제1항제1호바목 공익법인',
        donationType: orgInfo.donationType || (formType === 'corporate' ? '지정기부금' : '지정기부금 (공익법인)'),
        donationCode: orgInfo.donationCode || '40',
      };

      const receiptNo = firebaseConfigured && auth?.currentUser
        ? await getNextCloudReceiptNumber(taxYear, documentType)
        : getNextReceiptNumber(taxYear, documentType);

      const newReceipt: IssuedReceiptRecord = {
        receiptNo,
        issueDate,
        taxYear,
        formType,
        documentType,
        donorName,
        donorIdNumber: idNumber,
        donorAddress: address,
        isBusiness: formType === 'corporate',
        donations: donorItems,
        totalAmount,
        amountInKorean,
        orgSnapshot: { ...finalOrgInfo },
        status: 'issued',
        createdAt: new Date().toISOString(),
      };

      // Save and reload list
      saveIssuedReceipt(newReceipt);
      setIssuedReceipts((prev) => [newReceipt, ...prev.filter((r) => r.receiptNo !== newReceipt.receiptNo)]);

      if (firebaseConfigured && auth?.currentUser) {
        try {
          await saveCloudReceipt(newReceipt);
          // Also save donor record and donation records to donors & donations collections
          await saveCloudDonor({
            id: `${donorName}_${idNumber || address}`.replace(/[\\/:*?"<>|]/g, '_'),
            donorName,
            idNumber,
            address,
            isBusiness: formType === 'corporate',
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Firebase 클라우드 동기화 실패:', error);
        }
      }

      // Close confirm modal and immediately open preview
      setConfirmModalData(null);
      setPreviewReceipt(newReceipt);
      return { success: true };
    } catch (err) {
      console.error('영수증 생성 오류:', err);
      return {
        success: false,
        error: '영수증 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
      };
    }
  };

  // Stats
  const uniqueDonorCount = new Set(
    donations.map((d) => `${d.donorName}-${d.address || d.idNumber}`)
  ).size;
  const totalRecordCount = donations.length;
  const activeIssuedCount = issuedReceipts.filter((r) => r.status === 'issued').length;

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100">Firebase 로그인 상태를 확인하는 중입니다...</div>;
  }

  if (firebaseConfigured && !user) {
    return <LoginScreen />;
  }

  const handleLogout = () => {
    if (firebaseConfigured && auth) {
      signOut(auth).catch(console.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Administrative Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'settings') {
            setIsOrgSettingsOpen(true);
          } else if (tab === 'print') {
            setIsPrintSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        orgInfo={orgInfo}
        openSettingsModal={() => setIsOrgSettingsOpen(true)}
        onResetSearch={handleResetSearch}
        onLogout={handleLogout}
      />

      {/* Firestore Connection / Load Status Banner
          v24: firestoreStatus는 예전부터 계산되고 있었지만 화면에 그려지는 코드가
          없어서, donations/awards 로딩이 실패하거나(권한 오류 등) 컬렉션이 비어있어도
          사용자는 원인을 전혀 알 수 없이 "0건"만 보게 되는 문제가 있었습니다.
          이제 로그인 화면이 아닌 메인 화면에서도 연결 상태와 실제 오류 메시지를 보여줍니다. */}
      {firestoreStatus && showStatusBanner && (firestoreStatus.errorDetail || !firestoreStatus.connected || firestoreStatus.message) && (
        <div className="no-print max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
              firestoreStatus.errorDetail || !firestoreStatus.connected
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {firestoreStatus.errorDetail || !firestoreStatus.connected ? (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-semibold">
                <Cloud className="w-4 h-4" />
                <span>{firestoreStatus.message}</span>
              </div>
              {firestoreStatus.errorDetail && (
                <pre className="mt-1.5 whitespace-pre-wrap break-all text-xs font-mono bg-white/60 border border-amber-200 rounded-lg p-2">
                  {firestoreStatus.errorDetail}
                </pre>
              )}
            </div>
            <button
              type="button"
              onClick={handleManualCloudReload}
              disabled={isReloadingCloudData}
              title="Firestore에서 다시 불러오기"
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-current/20 bg-white/70 hover:bg-white text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloadingCloudData ? 'animate-spin' : ''}`} />
              <span>다시 불러오기</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStatusBanner(false)}
              title="닫기"
              className="shrink-0 p-1 rounded-lg hover:bg-white/70 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Tab 1: Search & Issue Receipt */}
        {activeTab === 'dashboard' && <ManagementDashboard donations={donations} awards={awards} />}
        {activeTab === 'feeStatus' && <MembershipStatusManager donations={donations} />}
        {activeTab === 'members' && <MemberManager members={members} donations={donations} awards={awards} onSave={async (m)=>{await saveCloudMember(m); setMembers(prev=>{const i=prev.findIndex(x=>x.id===m.id); return i>=0?prev.map(x=>x.id===m.id?m:x):[...prev,m];});}} onDelete={async (id)=>{await deleteCloudMember(id); setMembers(prev=>prev.filter(m=>m.id!==id));}} />}

        {activeTab === 'search' && (
          <DonorSearch
            key={searchResetKey}
            donations={donations}
            awards={awards}
            orgInfo={orgInfo}
            documentType="receipt"
            onStartIssuance={(donor) => setConfirmModalData({ ...donor, documentType: 'receipt' })}
            onOpenExcel={() => setActiveTab('membership')}
            onOpenHistory={() => setActiveTab('history')}
            onOpenOrgSettings={() => setIsOrgSettingsOpen(true)}
            onOpenPrintSettings={() => setIsPrintSettingsOpen(true)}
            onOpenAwards={() => setActiveTab('awards')}
            onResetSearch={handleResetSearch}
          />
        )}

        {/* Tab 1b: Search & Issue Membership-fee Confirmation
            (v23: 별도였던 "엑셀 회원 명단 관리" 탭을 없애고, 수상내역 관리 탭과 같은 방식으로
             이 화면 안에 검색과 엑셀 업로드/관리를 함께 둡니다. 후원내역(donations)은
             "영수증 발급" 탭과 완전히 같은 자료를 공유하므로, 영수증 발급 화면의
             "회원 자료 명단" 버튼을 누르면 이 탭으로 이동해 관리할 수 있습니다.) */}
        {activeTab === 'membership' && (
          <div className="space-y-6">
            <DonorSearch
              key={`membership-${searchResetKey}`}
              donations={donations}
              awards={awards}
              orgInfo={orgInfo}
              documentType="membership"
              onStartIssuance={(donor) => setConfirmModalData({ ...donor, documentType: 'membership' })}
              onOpenExcel={() =>
                document.getElementById('excel-manager-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              onOpenHistory={() => setActiveTab('history')}
              onOpenOrgSettings={() => setIsOrgSettingsOpen(true)}
              onOpenPrintSettings={() => setIsPrintSettingsOpen(true)}
              onOpenAwards={() => setActiveTab('awards')}
              onResetSearch={handleResetSearch}
            />

            <div id="excel-manager-section">
              <ExcelManager
                donations={donations}
                onUpdateDonations={handleUpdateDonations}
                onClearDonations={handleClearDonations}
                onLoadSample={() => setDonations(INITIAL_SAMPLE_DONATIONS)}
                onCheckFileImported={handleCheckFileImported}
                onRecordFileImport={handleRecordFileImport}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Issuance Records History */}
        {activeTab === 'history' && (
          <IssuanceHistory
            receipts={issuedReceipts}
            onSelectReceipt={(receipt) => setPreviewReceipt(receipt)}
            onCancelReceipt={handleCancelReceipt}
            onDeleteReceipt={handleDeleteReceipt}
          />
        )}

        {/* Tab 4: Award (수상내역) Upload & Management */}
        {activeTab === 'awards' && (
          <AwardManager
            awards={awards}
            onUpdateAwards={handleUpdateAwards}
            onClearAwards={handleClearAwards}
            onLoadSeedAwards={handleLoadSeedAwards}
          />
        )}
      </main>

      {/* Footer Notice */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>{orgInfo.name}</strong> | 대표자: {orgInfo.representative} | 대표전화: {orgInfo.tel} | 사업내용: {orgInfo.businessContent}
          </div>
          <div>
            주소: {orgInfo.address}
          </div>
        </div>
      </footer>

      {/* Modal 1: Organization Settings Modal */}
      <OrgSettingsModal
        isOpen={isOrgSettingsOpen}
        onClose={() => setIsOrgSettingsOpen(false)}
        orgInfo={orgInfo}
        onSave={handleSaveOrgInfo}
        user={user}
      />

      {/* Modal 2: Print Settings Modal */}
      <PrintSettingsModal
        isOpen={isPrintSettingsOpen}
        onClose={() => setIsPrintSettingsOpen(false)}
        settings={printSettings}
        onSave={handleSavePrintSettings}
      />

      {/* Modal 3: Issuance Confirmation Modal */}
      {confirmModalData && (
        <IssuanceConfirmModal
          isOpen={!!confirmModalData}
          onClose={() => setConfirmModalData(null)}
          donorName={confirmModalData.donorName}
          idNumber={confirmModalData.idNumber}
          address={confirmModalData.address}
          taxYear={confirmModalData.taxYear}
          donations={confirmModalData.donations}
          orgInfo={orgInfo}
          documentType={confirmModalData.documentType || 'receipt'}
          onConfirmIssuance={handleConfirmIssuance}
          onViewExistingReceipt={(existing) => {
            setConfirmModalData(null);
            setPreviewReceipt(existing);
          }}
          onOpenOrgSettings={() => {
            setIsOrgSettingsOpen(true);
          }}
          existingReceipts={issuedReceipts}
        />
      )}

      {/* Modal 4: A4 Receipt Preview & Print Modal */}
      {previewReceipt && (
        <ReceiptPreviewModal
          isOpen={!!previewReceipt}
          onClose={() => setPreviewReceipt(null)}
          receipt={previewReceipt}
          printSettings={printSettings}
          onOpenPrintSettings={() => setIsPrintSettingsOpen(true)}
        />
      )}
    </div>
  );
}
