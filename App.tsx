import React, { useState, useEffect } from 'react';
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
  saveActiveDonations,
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

export default function App() {
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

  // Initialize data on mount
  useEffect(() => {
    setDonations(getActiveDonations());
    setOrgInfo(getOrganizationInfo());
    setIssuedReceipts(getIssuedReceipts());
    setPrintSettings(getPrintSettings());
  }, []);

  // Update Donations Handler
  const handleUpdateDonations = (records: RawDonationRecord[]) => {
    setDonations(records);
    saveActiveDonations(records);
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
  };

  // Save Print Settings
  const handleSavePrintSettings = (updated: PrintSettings) => {
    setPrintSettings(updated);
    savePrintSettings(updated);
  };

  // Cancel an Issued Receipt
  const handleCancelReceipt = (receiptNo: string) => {
    cancelIssuedReceipt(receiptNo);
    setIssuedReceipts(getIssuedReceipts());
  };

  // Confirm and Generate a New Receipt
  const handleConfirmIssuance = (
    formType: ReceiptFormType,
    issueDate: string,
    isReissue: boolean
  ) => {
    if (!confirmModalData) return;

    const { donorName, idNumber, address, taxYear, donations: donorItems } = confirmModalData;
    const totalAmount = donorItems.reduce((sum, d) => sum + d.amount, 0);
    const amountInKorean = numberToHangulAmount(totalAmount);
    const receiptNo = getNextReceiptNumber(taxYear);

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
      orgSnapshot: { ...orgInfo },
      status: 'issued',
      createdAt: new Date().toISOString(),
    };

    // Save and reload list
    saveIssuedReceipt(newReceipt);
    setIssuedReceipts(getIssuedReceipts());

    // Close confirm modal and immediately open preview
    setConfirmModalData(null);
    setPreviewReceipt(newReceipt);
  };

  // Stats
  const uniqueDonorCount = new Set(
    donations.map((d) => `${d.donorName}-${d.address || d.idNumber}`)
  ).size;
  const totalRecordCount = donations.length;
  const activeIssuedCount = issuedReceipts.filter((r) => r.status === 'issued').length;

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
            setConfirmModalData(null);
            setIsOrgSettingsOpen(true);
          }}
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

      {/* Dedicated Print container if window.print() called directly */}
      {previewReceipt && (
        <div className="print-only-container hidden">
          <OfficialReceiptA4
            receipt={previewReceipt}
            printSettings={printSettings}
            isPreviewMode={false}
          />
        </div>
      )}
    </div>
  );
}
