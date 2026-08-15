import { OrganizationInfo, IssuedReceiptRecord, PrintSettings, RawDonationRecord } from '../types/donation';
import { INITIAL_SAMPLE_DONATIONS } from './sampleData';

const ORG_STORAGE_KEY = 'neobne_org_info_v1';
const RECEIPTS_STORAGE_KEY = 'neobne_issued_receipts_v1';
const PRINT_STORAGE_KEY = 'neobne_print_settings_v1';
const DONATIONS_STORAGE_KEY = 'neobne_active_donations_v1';

export const DEFAULT_ORG_INFO: OrganizationInfo = {
  name: '사단법인 너브내행복나눔재단',
  representative: '윤성일',
  address: '강원특별자치도 홍천군 홍천읍 송학로3길 26 2층',
  tel: '033-436-1925',
  businessContent: '사회복지사업',
  // CRITICAL REQUIREMENT: Never invent/guess statutory IDs. Blank by default!
  registrationNo: '',
  bizNo: '',
  designationInfo: '',
  donationType: '',
  donationCode: '',
  defaultContent: '후원금',
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  offsetX: 0,
  offsetY: 0,
  scale: 100,
};

// Organization Info
export function getOrganizationInfo(): OrganizationInfo {
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_INFO;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ORG_INFO, ...parsed };
  } catch {
    return DEFAULT_ORG_INFO;
  }
}

export function saveOrganizationInfo(info: OrganizationInfo): void {
  localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(info));
}

// Active Donations (Current loaded Excel / Sample data)
export function getActiveDonations(): RawDonationRecord[] {
  try {
    const raw = localStorage.getItem(DONATIONS_STORAGE_KEY);
    if (!raw) {
      // Default to initial sample data on first run
      saveActiveDonations(INITIAL_SAMPLE_DONATIONS);
      return INITIAL_SAMPLE_DONATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SAMPLE_DONATIONS;
  } catch {
    return INITIAL_SAMPLE_DONATIONS;
  }
}

export function saveActiveDonations(records: RawDonationRecord[]): void {
  localStorage.setItem(DONATIONS_STORAGE_KEY, JSON.stringify(records));
}

export function clearActiveDonations(): void {
  localStorage.removeItem(DONATIONS_STORAGE_KEY);
}

// Issued Receipts
export function getIssuedReceipts(): IssuedReceiptRecord[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveIssuedReceipt(receipt: IssuedReceiptRecord): void {
  const list = getIssuedReceipts();
  // Filter out any existing item with same receiptNo to prevent duplicates
  const updated = [receipt, ...list.filter((r) => r.receiptNo !== receipt.receiptNo)];
  localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
}

export function cancelIssuedReceipt(receiptNo: string): void {
  const list = getIssuedReceipts();
  const updated = list.map((r) => (r.receiptNo === receiptNo ? { ...r, status: 'cancelled' as const } : r));
  localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Generate next sequential receipt number for the given tax year.
 * Format: YYYY-00001, YYYY-00002 ...
 */
export function getNextReceiptNumber(taxYear: number): string {
  const receipts = getIssuedReceipts();
  const yearPrefix = `${taxYear}-`;
  
  const yearReceipts = receipts.filter((r) => r.receiptNo.startsWith(yearPrefix));
  let maxSeq = 0;

  for (const r of yearReceipts) {
    const seqPart = r.receiptNo.replace(yearPrefix, '');
    const num = parseInt(seqPart, 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(5, '0');
  return `${taxYear}-${seqStr}`;
}

/**
 * Check if receipt has already been issued for this donor in this tax year
 */
export function findExistingReceipt(donorName: string, idNumber: string, address: string, taxYear: number): IssuedReceiptRecord | null {
  const receipts = getIssuedReceipts().filter((r) => r.status === 'issued' && r.taxYear === taxYear);
  
  // Strict match by name + ID number or name + address
  const match = receipts.find((r) => {
    if (r.donorName !== donorName) return false;
    if (idNumber && r.donorIdNumber && r.donorIdNumber === idNumber) return true;
    if (address && r.donorAddress && r.donorAddress === address) return true;
    return false;
  });

  return match || null;
}

// Print Settings
export function getPrintSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(PRINT_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_SETTINGS;
    return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

export function savePrintSettings(settings: PrintSettings): void {
  localStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify(settings));
}
