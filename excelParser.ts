import * as XLSX from 'xlsx';
import { RawDonationRecord, IssuedReceiptRecord } from '../types/donation';

// Flexible column matcher
const COLUMN_SYNONYMS = {
  donorName: ['성명', '이름', '후원자명', '기부자명', '기부자', '후원자', '회원명', '이름(상호)', '상호'],
  idNumber: ['주민등록번호', '주민번호', '주민번호/사업자번호', '사업자번호', '사업자등록번호', '식별번호', '고유식별번호', '주민/사업자번호'],
  address: ['주소', '소재지', '거주지', '기부자주소', '도로명주소', '본점소재지', '사업장소재지'],
  date: ['후원일', '후원일자', '납부일', '납부일자', '기부일', '기부일자', '일자', '날짜', '입금일', '입금일자'],
  amount: ['후원금', '후원금액', '납부금액', '금액', '기부금액', '기부금', '입금액', '수납액'],
  paymentMethod: ['후원방법', '납부방법', '결제방법', '이체방법', '수단', '결제수단', '구분방법'],
  donationType: ['기부금유형', '기부유형', '유형', '기부구분', '구분'],
  donationCode: ['기부금코드', '코드', '기부코드'],
  content: ['기부내용', '내용', '적요', '사업명', '후원내용', '품목'],
};

function normalizeHeaderName(header: string): string {
  return header.replace(/\s+/g, '').replace(/[()\[\]_-]/g, '').toLowerCase();
}

function findMatchingField(header: string): keyof typeof COLUMN_SYNONYMS | null {
  const clean = normalizeHeaderName(header);
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      if (clean === normalizeHeaderName(syn) || clean.includes(normalizeHeaderName(syn))) {
        return field as keyof typeof COLUMN_SYNONYMS;
      }
    }
  }
  return null;
}

function parseExcelDate(val: any): string {
  if (!val) {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // If val is a number (Excel serial date number)
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const y = dateObj.y;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  // Match YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const matched = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (matched) {
    const y = matched[1];
    const m = matched[2].padStart(2, '0');
    const d = matched[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match 8-digit YYYYMMDD
  const eightDigit = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (eightDigit) {
    return `${eightDigit[1]}-${eightDigit[2]}-${eightDigit[3]}`;
  }

  return str;
}

function parseExcelAmount(val: any): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const str = String(val).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

export interface ParseResult {
  records: RawDonationRecord[];
  columnMapping: Record<string, string>;
  missingRequired: string[];
  totalRows: number;
}

export async function parseDonationExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  
  if (workbook.SheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawJson: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

  if (rawJson.length === 0) {
    throw new Error('엑셀 파일이 비어있습니다.');
  }

  // Find header row (usually row 0 or row with most matched keywords)
  let headerRowIndex = -1;
  let maxMatchedCount = 0;
  let bestHeaderMap: Record<number, keyof typeof COLUMN_SYNONYMS> = {};

  for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    const currentMap: Record<number, keyof typeof COLUMN_SYNONYMS> = {};
    let matched = 0;

    row.forEach((cellVal, colIdx) => {
      const match = findMatchingField(String(cellVal));
      if (match) {
        currentMap[colIdx] = match;
        matched++;
      }
    });

    if (matched > maxMatchedCount) {
      maxMatchedCount = matched;
      headerRowIndex = r;
      bestHeaderMap = currentMap;
    }
  }

  if (headerRowIndex === -1 || maxMatchedCount === 0) {
    throw new Error('엑셀 열 이름을 인식할 수 없습니다. 성명, 후원일자, 후원금액 열이 포함되어 있는지 확인해주세요.');
  }

  // Verify required fields (donorName, date, amount)
  const mappedFields = Object.values(bestHeaderMap);
  const missingRequired: string[] = [];
  if (!mappedFields.includes('donorName')) missingRequired.push('성명 (이름/후원자명)');
  if (!mappedFields.includes('amount')) missingRequired.push('후원금액 (금액)');

  const records: RawDonationRecord[] = [];

  for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || row.length === 0) continue;

    const recordObj: Partial<RawDonationRecord> = {
      id: `rec-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      paymentMethod: '계좌이체',
      donationType: '일반기부금',
      donationCode: '40',
      content: '후원금',
    };

    let hasData = false;

    Object.entries(bestHeaderMap).forEach(([colIdxStr, fieldKey]) => {
      const colIdx = parseInt(colIdxStr, 10);
      const val = row[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        hasData = true;
      }

      if (fieldKey === 'donorName') {
        recordObj.donorName = String(val || '').trim();
      } else if (fieldKey === 'idNumber') {
        recordObj.idNumber = String(val || '').trim();
      } else if (fieldKey === 'address') {
        recordObj.address = String(val || '').trim();
      } else if (fieldKey === 'date') {
        recordObj.date = parseExcelDate(val);
      } else if (fieldKey === 'amount') {
        recordObj.amount = parseExcelAmount(val);
      } else if (fieldKey === 'paymentMethod') {
        recordObj.paymentMethod = String(val || '계좌이체').trim();
      } else if (fieldKey === 'donationType') {
        recordObj.donationType = String(val || '').trim();
      } else if (fieldKey === 'donationCode') {
        recordObj.donationCode = String(val || '').trim();
      } else if (fieldKey === 'content') {
        recordObj.content = String(val || '').trim();
      }
    });

    if (hasData && recordObj.donorName && (recordObj.amount !== undefined && recordObj.amount > 0)) {
      records.push(recordObj as RawDonationRecord);
    }
  }

  const columnMappingSummary: Record<string, string> = {};
  Object.entries(bestHeaderMap).forEach(([colIdx, field]) => {
    columnMappingSummary[String(rawJson[headerRowIndex][parseInt(colIdx, 10)])] = field;
  });

  return {
    records,
    columnMapping: columnMappingSummary,
    missingRequired,
    totalRows: records.length,
  };
}

/**
 * Generate standard Excel sample template for the user
 */
export function downloadSampleExcelTemplate() {
  const headers = [
    '성명',
    '주민등록번호/사업자번호',
    '주소',
    '후원일자',
    '후원금액',
    '후원방법',
    '기부금유형',
    '기부금코드',
    '기부내용'
  ];

  const sampleRows = [
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-01-15', 100000, '계좌이체', '일반기부금', '40', '후원금'],
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-03-15', 100000, '계좌이체', '일반기부금', '40', '후원금'],
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-05-15', 200000, '계좌이체', '일반기부금', '40', '후원금'],
    ['김철수', '820315-1098765', '강원특별자치도 홍천군 화촌면 가리산길 45', '2026-02-10', 200000, 'CMS', '지정기부금', '40', '정기후원금'],
    ['이영희', '881120-2345678', '강원특별자치도 홍천군 북방면 영서로 78', '2026-03-20', 50000, '계좌이체', '지정기부금', '40', '취약계층복지후원'],
    ['홍길동', '750612-1456789', '강원특별자치도 홍천군 서면 팔봉산로 102', '2026-05-15', 100000, '계좌이체', '지정기부금', '40', '노인복지후원(동명이인)'],
    ['(주)홍천희망기업', '221-81-98765', '강원특별자치도 홍천군 홍천읍 연봉리 123-4', '2026-04-10', 1000000, '계좌이체', '지정기부금', '40', '법인후원금'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 16 }, // 성명
    { wch: 22 }, // 주민등록번호
    { wch: 40 }, // 주소
    { wch: 14 }, // 후원일자
    { wch: 14 }, // 후원금액
    { wch: 12 }, // 후원방법
    { wch: 14 }, // 기부금유형
    { wch: 12 }, // 기부금코드
    { wch: 25 }, // 기부내용
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '후원금자료양식');
  XLSX.writeFile(wb, '너브내행복나눔재단_후원금자료_표준서식.xlsx');
}

/**
 * Export issued receipt history to Excel
 */
export function exportIssuedReceiptsToExcel(receipts: IssuedReceiptRecord[]) {
  const headers = [
    '발급번호',
    '발급일자',
    '과세연도',
    '서식구분',
    '기부자성명(상호)',
    '주민등록번호/사업자번호(마스킹)',
    '주소',
    '총기부금액(원)',
    '한글금액',
    '기부건수',
    '상태',
    '기부금단체',
    '대표자',
    '고유번호/사업자번호',
    '기부코드'
  ];

  const rows = receipts.map((r) => [
    r.receiptNo,
    r.issueDate,
    r.taxYear,
    r.formType === 'individual' ? '개인(소득세법)' : '법인(법인세법)',
    r.donorName,
    r.donorIdNumber,
    r.donorAddress,
    r.totalAmount,
    r.amountInKorean,
    r.donations.length,
    r.status === 'issued' ? '정상발급' : '발급취소',
    r.orgSnapshot.name,
    r.orgSnapshot.representative,
    r.orgSnapshot.registrationNo || r.orgSnapshot.bizNo || '-',
    r.orgSnapshot.donationCode || '-'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 35 },
    { wch: 15 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 25 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '기부금영수증발급대장');
  XLSX.writeFile(wb, `너브내행복나눔재단_기부금영수증_발급대장_${new Date().toISOString().split('T')[0]}.xlsx`);
}
