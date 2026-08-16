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
  loadCloudDonations,
  batchSaveCloudDonations,
  saveCloudOrganization,
  saveCloudReceipt,
  cancelCloudReceipt,
  getNextCloudReceiptNumber,
  testFirestoreConnection,
  saveCloudDonor,
  type FirestoreConnectionStatus,
} from './utils/firebaseDb';


function donationFingerprint(d: RawDonationRecord): string {
  return [
    d.donorName,
    d.idNumber,
    d.address,
    d.date,
    d.amount,
    d.paymentMethod,
    d.donationType,
    d.donationCode,
    d.content,
  ].map((v) => String(v ?? '').trim().toLowerCase()).join('|');
}

function mergeDonationRecords(
  existing: RawDonationRecord[],
  incoming: RawDonationRecord[]
): RawDonationRecord[] {
  const merged = [...existing];
  const fingerprints = new Set(existing.map(donationFingerprint));

  for (const record of incoming) {
    const fingerprint = donationFingerprint(record);
    if (!fingerprints.has(fingerprint)) {
      merged.push(record);
      fingerprints.add(fingerprint);
    }
  }

  return merged;
}

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
        // 월별 업로드 자료는 Firestore에 누적 보관하고, 앱을 다시 열어도 전체 내역을 복원합니다.
        setDonations(mergeDonationRecords([], cloudDonations));
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
        setDonations([]);
      }
      setPrintSettings(getPrintSettings());
    });
  }, []);


  // 월별 Excel 업로드: 기존 자료는 유지하고 새 자료만 누적합니다.
  const handleUpdateDonations = async (records: RawDonationRecord[]) => {
    const merged = mergeDonationRecords(donations, records);
    const newRecords = merged.filter(
      (record) => !donations.some((existing) => donationFingerprint(existing) === donationFingerprint(record))
    );

    setDonations(merged);

    if (firebaseConfigured && auth?.currentUser && newRecords.length > 0) {
      await batchSaveCloudDonations(newRecords);
    }

    return {
      addedCount: newRecords.length,
      duplicateCount: records.length - newRecords.length,
      totalCount: merged.length,
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
            cloudEnabled={firebaseConfigured && !!auth?.currentUser}
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
