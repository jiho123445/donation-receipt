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
import {
  loadCloudOrganization,
  loadCloudReceipts,
  saveCloudOrganization,
  saveCloudReceipt,
  cancelCloudReceipt,
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
  const [donations, setDonations] = useState<RawDonationRecord[]>(INITIAL_SAMPLE_DONATIONS);
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
      setDonations(INITIAL_SAMPLE_DONATIONS);
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
        const [cloudOrg, cloudReceipts] = await Promise.all([
          loadCloudOrganization(),
          loadCloudReceipts(),
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
        setIssuedReceipts(getIssuedReceipts());
      }
      setDonations([]);
      setPrintSettings(getPrintSettings());
    });
  }, []);


  // Update Donations Handler
  const handleUpdateDonations = (records: RawDonationRecord[]) => {
    // 개인정보가 포함된 Excel 자료는 브라우저 메모리에만 보관합니다.
    setDonations(records);
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
    cancelIssuedReceipt(receiptNo);
    setIssuedReceipts((prev) => prev.map((r) => r.receiptNo === receiptNo ? { ...r, status: 'cancelled' as const } : r));
    if (firebaseConfigured && auth?.currentUser) {
      cancelCloudReceipt(receiptNo).catch(console.error);
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
      const { donorName, idNumber, address, taxYear, donations: donorItems } = confirmModalData;
      const totalAmount = donorItems.reduce((sum, d) => sum + d.amount, 0);
      const amountInKorean = numberToHangulAmount(totalAmount);

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
        donorCount={uniqueDonorCount}
        recordCount={totalRecordCount}
        issuedCount={activeIssuedCount}
        openSettingsModal={() => setIsOrgSettingsOpen(true)}
      />

      {/* Main Content Area */}
      {firebaseConfigured && user && (
        <div className="no-print bg-blue-50 border-b border-blue-100 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>프로젝트: <strong>{firebaseConfig.projectId}</strong></span>
            <span className="text-blue-300">|</span>
            <span>인증 계정: <strong>{user.email}</strong></span>
            <span className="text-blue-300">|</span>
            <span className="text-slate-600">UID: <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[11px] font-mono text-blue-950 font-bold">{user.uid}</code></span>
          </div>
          <button onClick={handleLogout} className="font-semibold underline text-blue-800 hover:text-blue-950 cursor-pointer">로그아웃</button>
        </div>
      )}

      {/* Firestore Status / Error Banner */}
      {firestoreStatus && showStatusBanner && (
        <div className={`no-print border-b px-4 py-2.5 text-xs flex items-center justify-between ${
          firestoreStatus.connected
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : firestoreStatus.code === 'permission-denied' || firestoreStatus.errorDetail
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}>
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              {firestoreStatus.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                <strong>Firestore 상태:</strong> {firestoreStatus.message}
                {firestoreStatus.errorDetail && (
                  <span className="ml-1 text-slate-500 font-mono text-[11px]">({firestoreStatus.code || 'error'})</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={checkConnection}
                className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                title="연결 재확인"
              >
                <RefreshCw className="w-3 h-3" />
                <span>재확인</span>
              </button>
              <button
                onClick={() => setShowStatusBanner(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="배너 닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
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
