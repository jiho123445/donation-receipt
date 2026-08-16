import * as XLSX from 'xlsx';
import { RawDonationRecord, IssuedReceiptRecord } from '../types/donation';

// Flexible column matcher
const COLUMN_SYNONYMS = {
  donorName: ['성명', '성명후원자명', '이름', '후원자명', '기부자명', '기부자', '후원자', '회원명', '이름상호', '상호'],
  idNumber: ['주민등록번호', '주민번호', '주민번호/사업자번호', '사업자번호', '사업자등록번호', '식별번호', '고유식별번호', '주민/사업자번호'],
  address: ['주소', '소재지', '거주지', '기부자주소', '도로명주소', '본점소재지', '사업장소재지'],
  date: ['후원일', '후원일자', '후원연월일', '납부일', '납부일자', '납부연월일', '연월일', '기부일', '기부일자', '기부연월일', '일자', '날짜', '입금일', '입금일자', '입금연월일'],
  amount: ['후원금', '후원금액', '후원금액원', '납부금액', '납부금액원', '금액', '금액원', '기부금액', '기부금', '입금액', '수납액', '납부액'],
  paymentMethod: ['후원방법', '납부방법', '결제방법', '이체방법', '수단', '결제수단', '구분방법'],
  donationType: ['기부금유형', '기부유형', '유형', '기부구분', '구분'],
  donationCode: ['기부금코드', '코드', '기부코드'],
  content: ['기부내용', '내용', '적요', '사업명', '후원내용', '품목'],
};

function normalizeHeaderName(header: string): string {
  return String(header ?? '')
    .replace(/\s+/g, '')
    .replace(/[()\[\]{}<>_\-\/\\:·.,]/g, '')
    .replace(/\(원\)|원$/gi, '')
    .toLowerCase();
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

function inferPeriodFromFileName(fileName: string): string {
  const name = String(fileName || '').replace(/\s+/g, '');
  let match = name.match(/(20\d{2})[-_.]?(0?[1-9]|1[0-2])월?/i);
  if (!match) match = name.match(/(20\d{2})년(0?[1-9]|1[0-2])월?/i);
  if (match) {
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }

  // 파일명에 '8월', '7월'처럼 월만 있는 경우 현재 연도를 사용합니다.
  // 날짜가 없는 월별 회원자료를 관리하기 위한 보조값이며, 실제 후원일자가 있으면 그 날짜를 우선합니다.
  const monthOnly = name.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])월(?:[^0-9]|$)/i);
  if (monthOnly) {
    return `${new Date().getFullYear()}-${String(Number(monthOnly[1])).padStart(2, '0')}`;
  }

  const compact = name.match(/(20\d{2})(0[1-9]|1[0-2])/);
  if (compact) return `${compact[1]}-${compact[2]}`;
  return '';
}

function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel serial date number
  if (typeof val === 'number' && Number.isFinite(val)) {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj?.y && dateObj?.m && dateObj?.d) {
      return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / YYYY년 M월 D일 / YYYY년 M월 D일
  const matched = str.match(/(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*일?/);
  if (matched) {
    return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
  }

  // 8-digit YYYYMMDD
  const eightDigit = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (eightDigit) return `${eightDigit[1]}-${eightDigit[2]}-${eightDigit[3]}`;

  // Sometimes Excel text is prefixed/suffixed with spaces or time.
  const embedded = str.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (embedded) return `${embedded[1]}-${embedded[2].padStart(2, '0')}-${embedded[3].padStart(2, '0')}`;

  return '';
}

function parseExcelAmount(val: any): number {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  if (val === null || val === undefined || val === '') return 0;

  // Handle Excel formula/cell objects defensively.
  if (typeof val === 'object') {
    const candidate = (val as any).v ?? (val as any).value ?? (val as any).w;
    if (candidate !== undefined && candidate !== val) return parseExcelAmount(candidate);
  }

  let str = String(val).trim();
  // Common accounting/Excel representations such as "30,000원", "\u20a9 30,000", "30000.00".
  str = str.replace(/[₩원\s,]/g, '');
  const parsed = Number(str);
  if (Number.isFinite(parsed)) return Math.round(parsed);

  // Last-resort extraction for strings such as "후원금액: 30,000원".
  const match = String(val).match(/-?\d+(?:[,.]\d+)*/);
  if (!match) return 0;
  const normalized = match[0].replace(/,/g, '');
  const fallback = Number(normalized);
  return Number.isFinite(fallback) ? Math.round(fallback) : 0;
}

export interface ParseResult {
  records: RawDonationRecord[];
  columnMapping: Record<string, string>;
  missingRequired: string[];
  totalRows: number;
}

export async function parseDonationExcel(file: File): Promise<ParseResult> {
  const inferredPeriod = inferPeriodFromFileName(file.name);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellFormula: true });
  
  if (workbook.SheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawJson: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });

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
    throw new Error('엑셀 열 이름을 인식할 수 없습니다. 최소한 성명과 후원금액 열이 포함되어 있는지 확인해주세요.');
  }

  // 필수 데이터는 성명/후원금액만 사용합니다.
  // 주민/사업자번호, 주소, 후원일자, 후원방법, 기부금유형, 기부금코드, 기부내용은 선택 항목입니다.
  // 후원일자가 없으면 파일명에서 YYYY년 M월 / YYYY-MM / YYYYMM 형식의 월을 추정해 period로 저장합니다.
  const mappedFields = Object.values(bestHeaderMap);
  const missingRequired: string[] = [];
  if (!mappedFields.includes('donorName')) missingRequired.push('성명 (이름/후원자명)');
  if (!mappedFields.includes('amount')) missingRequired.push('후원금액 (후원금액/금액)');
  if (missingRequired.length > 0) {
    throw new Error(`필수 열이 없습니다: ${missingRequired.join(', ')}`);
  }

  const records: RawDonationRecord[] = [];

  for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || row.length === 0) continue;

    const recordObj: Partial<RawDonationRecord> = {
      id: `rec-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      paymentMethod: '',
      content: '',
      period: inferredPeriod || undefined,
      // donationType / donationCode는 선택 항목입니다.
      // 값이 비어 있으면 undefined로 유지하여 영수증 발급 시 단체 기본값을 사용할 수 있게 합니다.
    };

    let hasData = false;

    Object.entries(bestHeaderMap).forEach(([colIdxStr, fieldKey]) => {
      const colIdx = parseInt(colIdxStr, 10);
      const val = row[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        hasData = true;
      }

      const cellText = (() => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
          const candidate = (val as any).w ?? (val as any).v ?? (val as any).value;
          return candidate === undefined || candidate === null ? '' : String(candidate).trim();
        }
        return String(val).trim();
      })();

      if (fieldKey === 'donorName') {
        recordObj.donorName = cellText;
      } else if (fieldKey === 'idNumber') {
        recordObj.idNumber = cellText;
      } else if (fieldKey === 'address') {
        recordObj.address = cellText;
      } else if (fieldKey === 'date') {
        recordObj.date = parseExcelDate(val);
      } else if (fieldKey === 'amount') {
        recordObj.amount = parseExcelAmount(val);
      } else if (fieldKey === 'paymentMethod') {
        recordObj.paymentMethod = String(val || '계좌이체').trim();
      } else if (fieldKey === 'donationType') {
        const value = String(val || '').trim();
        if (value) recordObj.donationType = value;
      } else if (fieldKey === 'donationCode') {
        const value = String(val || '').trim();
        if (value) recordObj.donationCode = value;
      } else if (fieldKey === 'content') {
        recordObj.content = String(val || '').trim();
      }
    });

    // 날짜가 비어 있어도 성명 + 금액이 있으면 업로드합니다.
    // 월별 파일명(예: 2026년 8월.xlsx)에서 기간을 찾았다면 period에 저장합니다.
    // 실제 후원일자가 입력된 경우에는 기존 날짜를 그대로 보존합니다.
    const validDate = !recordObj.date || /^\d{4}-\d{2}-\d{2}$/.test(recordObj.date);
    // 업로드 필수값은 성명 + 0보다 큰 후원금액뿐입니다.
    // 주민/사업자번호, 주소, 후원일자, 기부금유형/코드가 비어 있어도 저장합니다.
    if (recordObj.donorName && validDate && Number(recordObj.amount) > 0) {
      records.push(recordObj as RawDonationRecord);
    }
  }

  // 일부 Excel 파일은 금액 셀이 수식/서식 문자열이거나 헤더에 특수문자가 섞여 있어
  // 첫 번째 매핑만으로 행을 잡지 못할 수 있습니다. 이 경우 성명/금액 열을 다시 찾아
  // '성명 + 양수 금액'만으로 한 번 더 안전하게 판별합니다.
  if (records.length === 0) {
    let donorCol = -1;
    let amountCol = -1;
    const header = rawJson[headerRowIndex] || [];
    header.forEach((cell: any, idx: number) => {
      const field = findMatchingField(String(cell ?? ''));
      if (field === 'donorName' && donorCol < 0) donorCol = idx;
      if (field === 'amount' && amountCol < 0) amountCol = idx;
    });

    if (donorCol >= 0 && amountCol >= 0) {
      for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
        const row = rawJson[r] || [];
        const donorName = String(row[donorCol] ?? '').trim();
        const amount = parseExcelAmount(row[amountCol]);
        if (!donorName || amount <= 0) continue;

        records.push({
          id: `rec-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
          donorName,
          idNumber: '',
          address: '',
          date: '',
          period: inferredPeriod || undefined,
          amount,
          paymentMethod: '계좌이체',
          content: '후원금',
        });
      }
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
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-01-15', 100000, '계좌이체', '', '', '후원금'],
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-03-15', 100000, '계좌이체', '', '', '후원금'],
    ['홍길동', '700101-1234567', '강원특별자치도 홍천군 홍천읍 송학로 12', '2026-05-15', 200000, '계좌이체', '', '', '후원금'],
    ['김철수', '820315-1098765', '강원특별자치도 홍천군 화촌면 가리산길 45', '2026-02-10', 200000, 'CMS', '', '', '정기후원금'],
    ['이영희', '881120-2345678', '강원특별자치도 홍천군 북방면 영서로 78', '2026-03-20', 50000, '계좌이체', '', '', '취약계층복지후원'],
    ['홍길동', '750612-1456789', '강원특별자치도 홍천군 서면 팔봉산로 102', '2026-05-15', 100000, '계좌이체', '', '', '노인복지후원(동명이인)'],
    ['(주)홍천희망기업', '221-81-98765', '강원특별자치도 홍천군 홍천읍 연봉리 123-4', '2026-04-10', 1000000, '계좌이체', '', '', '법인후원금'],
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
