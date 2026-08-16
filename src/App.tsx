import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Cloud, RefreshCw, X } from 'lucide-react';
import { auth, firebaseConfigured, firebaseConfig } from './firebase';
import {
  RawDonationRecord,
  OrganizationInfo,
  IssuedReceiptRecord,
  PrintSettings,
  ReceiptFormType,
} from './types/donation';
import {
  getOrganizationInfo,
  saveOrganizationInfo,
  getActiveDonations,
  clearActiveDonations,
  getIssuedReceipts,
  saveIssuedReceipt,
  cancelIssuedReceipt,
  reissueIssuedReceipt,
  getNextReceiptNumber,
  getPrintSettings,
  savePrintSettings,
} from './utils/storage';
import { numberToHangulAmount } from './utils/hangulCurrency';
import { Header } from './components/Header';
import { DonorSearch } from './components/DonorSearch';
import { IssuanceHistory } from './components/IssuanceHistory';
import { ExcelManager } from './components/ExcelManager';
import { OrgSettingsModal } from './components/OrgSettingsModal';
import { PrintSettingsModal } from './components/PrintSettingsModal';
import { IssuanceConfirmModal } from './components/IssuanceConfirmModal';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { OfficialReceiptA4 } from './components/OfficialReceiptA4';
import { LoginScreen } from './components/LoginScreen';
import { INITIAL_SAMPLE_DONATIONS } from './utils/sampleData';
import { mergeDonationRecords } from './utils/donationDedup';
import {
  loadCloudOrganization,
  loadCloudReceipts,
  loadCloudDonations,
  batchSaveCloudDonations,
  saveCloudOrganization,
  saveCloudReceipt,
  cancelCloudReceipt,
  reissueCloudReceipt,
  getNextCloudReceiptNumber,
  testFirestoreConnection,
  saveCloudDonor,
  type FirestoreConnectionStatus,
} from './utils/firebaseDb';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus | null>(null);
  const [showStatusBanner, setShowStatusBanner] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'excel' | 'settings' | 'print'>('search');

  // Core Data
  const [donations, setDonations] = useState<RawDonationRecord[]>([]);
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

  // Initialize data on mount
  useEffect(() => {
    checkConnection();

    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      setDonations([]);
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
      try {
        const [cloudOrg, cloudReceipts, cloudDonations] = await Promise.all([
          loadCloudOrganization(),
          loadCloudReceipts(),
          loadCloudDonations(),
        ]);
        if (cloudOrg) {
          setOrgInfo(cloudOrg);
          saveOrganizationInfo(cloudOrg);
        } else {
          const localOrg = getOrganizationInfo();
          setOrgInfo(localOrg);
          await saveCloudOrganization(localOrg);
        }
        setIssuedReceipts(cloudReceipts);
        // 기존 Firestore 자료에 중복 행이 있더라도 검색/영수증 합계에서는 한 번만 계산합니다.
        const normalizedCloudDonations = mergeDonationRecords([], cloudDonations).records;
        setDonations(normalizedCloudDonations);
        setFirestoreStatus({
          connected: true,
          message: `Cloud Firestore (프로젝트: ${firebaseConfig.projectId})에 정상 연결되었습니다.`,
        });
      } catch (error: any) {
        console.error('Firestore 데이터 로드 실패:', error);
        setFirestoreStatus({
          connected: false,
          message: `Firestore 연결 오류: ${error?.message || '데이터를 불러올 수 없습니다. Firestore 권한 설정을 확인하세요.'}`,
          errorDetail: String(error),
        });
        setOrgInfo(getOrganizationInfo());
        setIssuedReceipts([]);
        setDonations([]);
      }
      setPrintSettings(getPrintSettings());
    });
  }, []);


  // Update Donations Handler
  // 월별 Excel 자료는 기존 자료를 지우지 않고 누적합니다.
  // 동일한 납부내역을 다시 올리면 fingerprint로 중복을 제외합니다.
  const handleUpdateDonations = async (records: RawDonationRecord[]) => {
    const { records: merged, added, updated, duplicates } = mergeDonationRecords(donations, records);

    if (firebaseConfigured && auth?.currentUser && (added.length > 0 || updated.length > 0)) {
      // 신규 납부내역뿐 아니라 기존 레코드의 주민번호/주소/후원일자가 보강된 경우도 Firebase에 반영합니다.
      await batchSaveCloudDonations([...added, ...updated]);
    }

    setDonations(merged);

    return {
      total: merged.length,
      added: added.length,
      duplicates,
    };
  };

  // Clear Donations Handler (Privacy reset)
  const handleClearDonations = () => {
    setDonations([]);
    clearActiveDonations();
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
    if (!firebaseConfigured || !auth?.currentUser) cancelIssuedReceipt(receiptNo);
    setIssuedReceipts((prev) => prev.map((r) => r.receiptNo === receiptNo ? { ...r, status: 'cancelled' as const } : r));
    if (firebaseConfigured && auth?.currentUser) {
      cancelCloudReceipt(receiptNo).catch(console.error);
    }
  };

  // Confirm and Generate a New Receipt
  const handleConfirmIssuance = async (
    formType: ReceiptFormType,
    issueDate: string,
    isReissue: boolean,
    reissueReason = ''
  ): Promise<{ success: boolean; error?: string }> => {
    if (!confirmModalData) {
      return { success: false, error: '발급 대상자 정보가 없습니다.' };
    }

    try {
      const { donorName, idNumber, address, taxYear, donations: donorItems } = confirmModalData;
      const totalAmount = donorItems.reduce((sum, d) => sum + d.amount, 0);
      const amountInKorean = numberToHangulAmount(totalAmount);
      const missingDateCount = donorItems.filter((d) => !d.date).length;
      if (missingDateCount > 0) return { success:false, error:`후원일자가 없는 납부내역이 ${missingDateCount}건 있습니다. 정확한 후원일자를 입력한 후 영수증을 발급하세요.` };
      if (donorItems.length > 12) return { success:false, error:'연간 후원내역이 12건을 초과합니다. 현재 A4 1면 양식에 안전하게 표시할 수 없으므로 상세내역을 정리한 후 발급하세요.' };

      if (!orgInfo.registrationNo && !orgInfo.bizNo) {
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

      const existingIssued = issuedReceipts.find((r) => { if (r.status !== 'issued' || r.taxYear !== taxYear || r.donorName !== donorName) return false; if (idNumber && r.donorIdNumber && r.donorIdNumber === idNumber) return true; return !!address && !!r.donorAddress && r.donorAddress === address; });
      if (isReissue && !existingIssued) return {success:false,error:'재발급할 기존 정상 영수증을 찾지 못했습니다.'};

      const receiptNo = firebaseConfigured && auth?.currentUser
        ? await getNextCloudReceiptNumber(taxYear)
        : getNextReceiptNumber(taxYear);

      const newReceipt: IssuedReceiptRecord = {
        receiptNo,
        issueDate,
        taxYear,
        formType,
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
        reissueOf: isReissue ? existingIssued?.receiptNo : undefined,
        reissueReason: isReissue ? reissueReason : undefined,
      };

      if (!firebaseConfigured || !auth?.currentUser) {
        if (isReissue && existingIssued) reissueIssuedReceipt(existingIssued.receiptNo, newReceipt, reissueReason); else saveIssuedReceipt(newReceipt);
      }
      if (firebaseConfigured && auth?.currentUser) {
        try {
          if (isReissue && existingIssued) await reissueCloudReceipt(existingIssued.receiptNo,newReceipt,reissueReason); else await saveCloudReceipt(newReceipt);
          await saveCloudDonor({id:`${donorName}_${idNumber || address}`.replace(/[\\/:*?"<>|]/g,'_'),donorName,idNumber,address,isBusiness:formType==='corporate',updatedAt:new Date().toISOString()});
        } catch(error) { console.error('Firebase 클라우드 동기화 실패:',error); return {success:false,error:'Firebase 저장에 실패했습니다. 영수증 발급을 완료하지 않았습니다.'}; }
      }
      setIssuedReceipts((prev)=>{const next=prev.filter(r=>r.receiptNo!==newReceipt.receiptNo);const withOriginal=isReissue&&existingIssued?next.map(r=>r.receiptNo===existingIssued.receiptNo?{...r,status:'reissued' as const,reissueReason,reissuedTo:newReceipt.receiptNo}:r):next;return [newReceipt,...withOriginal];});

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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Tab 1: Search & Issue Receipt */}
        {activeTab === 'search' && (
          <DonorSearch
            donations={donations}
            orgInfo={orgInfo}
            onStartIssuance={(donor) => setConfirmModalData(donor)}
            onOpenExcel={() => setActiveTab('excel')}
            onOpenHistory={() => setActiveTab('history')}
            onOpenOrgSettings={() => setIsOrgSettingsOpen(true)}
            onOpenPrintSettings={() => setIsPrintSettingsOpen(true)}
          />
        )}

        {/* Tab 2: Issuance Records History */}
        {activeTab === 'history' && (
          <IssuanceHistory
            receipts={issuedReceipts}
            onSelectReceipt={(receipt) => setPreviewReceipt(receipt)}
            onCancelReceipt={handleCancelReceipt}
          />
        )}

        {/* Tab 3: Excel Upload & Management */}
        {activeTab === 'excel' && (
          <ExcelManager
            donations={donations}
            onUpdateDonations={handleUpdateDonations}
            onClearDonations={handleClearDonations}
            onLoadSample={() => setDonations(INITIAL_SAMPLE_DONATIONS)}
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
