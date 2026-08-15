import { OrganizationInfo, IssuedReceiptRecord, PrintSettings } from '../types/donation';

const ORG_STORAGE_KEY = 'neobne_org_info_v2';
const RECEIPTS_STORAGE_KEY = 'neobne_issued_receipts_v2';
const PRINT_STORAGE_KEY = 'neobne_print_settings_v2';

export const DEFAULT_ORG_INFO: OrganizationInfo = {
  name: '사단법인 너브내행복나눔재단',
  representative: '윤성일',
  address: '강원특별자치도 홍천군 홍천읍 송학로3길 26 2층',
  tel: '033-436-1925',
  businessContent: '사회복지사업',
  registrationNo: '',
  bizNo: '',
  designationInfo: '소득세법 시행령 제80조제1항제5호, 법인세법 시행령 제39조제1항제1호바목 공익법인',
  donationType: '지정기부금 (공익법인)',
  donationCode: '40',
  defaultContent: '후원금',
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  offsetX: 0,
  offsetY: 0,
  scale: 100,
};

export function getOrganizationInfo(): OrganizationInfo {
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_INFO;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ORG_INFO,
      ...parsed,
      designationInfo: parsed.designationInfo || DEFAULT_ORG_INFO.designationInfo,
      donationType: parsed.donationType || DEFAULT_ORG_INFO.donationType,
      donationCode: parsed.donationCode || DEFAULT_ORG_INFO.donationCode,
    };
  } catch {
    return DEFAULT_ORG_INFO;
  }
}

export function saveOrganizationInfo(info: OrganizationInfo): void {
  localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(info));
}

/**
 * 개인정보가 포함된 Excel 후원자료는 절대로 localStorage에 저장하지 않습니다.
 * 현재 업로드된 자료는 App의 React state(메모리)에만 보관합니다.
 */
export function getActiveDonations(): never[] {
  return [];
}
export function saveActiveDonations(_records: unknown[]): void {
  // Intentionally empty: donation data must remain in memory only.
}
export function clearActiveDonations(): void {
  // Intentionally empty: React state is the source of truth for active Excel data.
}

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
  const updated = [receipt, ...list.filter((r) => r.receiptNo !== receipt.receiptNo)];
  localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
}

export function cancelIssuedReceipt(receiptNo: string): void {
  const list = getIssuedReceipts();
  const updated = list.map((r) =>
    r.receiptNo === receiptNo ? { ...r, status: 'cancelled' as const } : r
  );
  localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
}

export function getNextReceiptNumber(taxYear: number): string {
  const receipts = getIssuedReceipts();
  const yearPrefix = `${taxYear}-`;
  let maxSeq = 0;

  for (const r of receipts.filter((r) => r.receiptNo.startsWith(yearPrefix))) {
    const num = parseInt(r.receiptNo.replace(yearPrefix, ''), 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  return `${taxYear}-${String(maxSeq + 1).padStart(5, '0')}`;
}

export function findExistingReceipt(
  donorName: string,
  idNumber: string,
  address: string,
  taxYear: number
): IssuedReceiptRecord | null {
  const receipts = getIssuedReceipts().filter(
    (r) => r.status === 'issued' && r.taxYear === taxYear
  );
  const match = receipts.find((r) => {
    if (r.donorName !== donorName) return false;
    if (idNumber && r.donorIdNumber && r.donorIdNumber === idNumber) return true;
    if (address && r.donorAddress && r.donorAddress === address) return true;
    return false;
  });
  return match || null;
}

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
