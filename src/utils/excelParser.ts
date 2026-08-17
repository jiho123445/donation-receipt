import * as XLSX from 'xlsx';
import { RawDonationRecord, IssuedReceiptRecord } from '../types/donation';

// Flexible column matcher
const COLUMN_SYNONYMS = {
  donorName: ['성명', '성명후원자명', '이름', '후원자명', '기부자명', '기부자', '후원자', '회원명', '이름상호', '상호'],
  idNumber: ['주민등록번호', '주민번호', '주민등록번호/사업자번호', '주민번호/사업자번호', '주민/사업자번호', '주민사업자번호', '사업자번호', '사업자등록번호', '식별번호', '고유식별번호'],
  address: ['주소', '주소(소재지)', '주소 / 소재지', '소재지', '거주지', '기부자주소', '기부자 주소', '도로명주소', '본점소재지', '사업장소재지'],
  date: ['후원일', '후원일자', '후원연월일', '납부일', '납부일자', '납부연월일', '납부연월', '연월일', '기부일', '기부일자', '기부연월일', '일자', '날짜', '입금일', '입금일자', '입금연월일'],
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
  if (!clean) return null;

  // 1단계: 완전일치를 항상 최우선으로 검사합니다.
  // (v13 수정) 기존에는 완전일치와 부분일치를 같은 우선순위로 검사해서,
  // 예를 들어 '기부금유형' 헤더가 amount의 부분일치 동의어인 '기부금'과 먼저 매칭되어
  // '기부금유형'/'기부금코드' 열이 '후원금액' 열로 잘못 인식되고,
  // 실제 후원금액을 텍스트/코드값으로 덮어쓰는 심각한 데이터 훼손 버그가 있었습니다.
  // '기부금유형'과 '기부금코드'는 각 필드의 완전일치 동의어로 이미 등록되어 있으므로,
  // 완전일치를 먼저 검사하면 이 문제가 근본적으로 해결됩니다.
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      if (clean === normalizeHeaderName(syn)) {
        return field as keyof typeof COLUMN_SYNONYMS;
      }
    }
  }

  // 2단계: 완전일치가 없을 때만 부분일치를 검사하되,
  // 여러 필드가 동시에 부분일치할 경우 더 길고 구체적인 동의어를 우선합니다.
  // (예: '기부금유형(상세)'처럼 완전일치는 아니지만 '기부금유형'을 포함하는 헤더가 있다면,
  // 짧고 일반적인 amount의 '기부금'보다 donationType의 '기부금유형'을 우선 채택)
  let bestField: keyof typeof COLUMN_SYNONYMS | null = null;
  let bestLen = 0;
  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      const normSyn = normalizeHeaderName(syn);
      if (normSyn && clean.includes(normSyn) && normSyn.length > bestLen) {
        bestLen = normSyn.length;
        bestField = field as keyof typeof COLUMN_SYNONYMS;
      }
    }
  }
  return bestField;
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

function makeSourceKey(fileName: string, sheetName: string, rowIndex: number, row: any[]): string {
  const raw = [fileName, sheetName, String(rowIndex), ...row.map((v) => String(v ?? '').trim())].join('|');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `excelrow_${(hash >>> 0).toString(16).padStart(8, '0')}`;
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

  // 안전장치: 같은 필드(예: amount)가 실수로 두 개 이상의 열에 매칭되면
  // 나중 열이 앞선 열의 값을 조용히 덮어쓰는 것을 방지하기 위해,
  // 가장 먼저(왼쪽) 매칭된 열만 유지하고 이후 중복 매칭은 무시합니다.
  {
    const seenFields = new Set<keyof typeof COLUMN_SYNONYMS>();
    const dedupedMap: Record<number, keyof typeof COLUMN_SYNONYMS> = {};
    Object.keys(bestHeaderMap)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .forEach((colIdx) => {
        const field = bestHeaderMap[colIdx];
        if (seenFields.has(field)) return; // 중복 필드는 첫 매칭만 사용
        seenFields.add(field);
        dedupedMap[colIdx] = field;
      });
    bestHeaderMap = dedupedMap;
  }

  // 재단 표준 9열 서식은 헤더 인식이 일부 실패하더라도 위치로 안전하게 보완합니다.
  // A 성명 / B 주민(사업자)번호 / C 주소 / D 후원일자 / E 후원금액 / F 후원방법 / G 유형 / H 코드 / I 내용
  if (headerRowIndex >= 0) {
    const standardPositions: Array<[number, keyof typeof COLUMN_SYNONYMS]> = [
      [0, 'donorName'], [1, 'idNumber'], [2, 'address'], [3, 'date'], [4, 'amount'],
      [5, 'paymentMethod'], [6, 'donationType'], [7, 'donationCode'], [8, 'content'],
    ];
    for (const [col, field] of standardPositions) {
      if (rawJson[headerRowIndex]?.[col] !== undefined && bestHeaderMap[col] === undefined) {
        bestHeaderMap[col] = field;
      }
    }
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
      period: inferredPeriod || '',
      sourceKey: makeSourceKey(file.name, workbook.SheetNames[0], r, row),
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
          period: inferredPeriod || '',
          sourceKey: makeSourceKey(file.name, workbook.SheetNames[0], r, row),
          amount,
          paymentMethod: '계좌이체',
          content: '후원금',
        });
      }
    }
  }

  // 표준 서식의 헤더가 병합/서식 때문에 비정상적으로 읽힌 경우에도
  // A열 성명 + E열 금액이 있으면 데이터를 살립니다. 주소/번호/날짜도 같은 행에서 함께 보존합니다.
  if (records.length === 0 && rawJson[headerRowIndex + 1]) {
    for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
      const row = rawJson[r] || [];
      const donorName = String(row[0] ?? '').trim();
      const amount = parseExcelAmount(row[4]);
      if (!donorName || amount <= 0) continue;
      records.push({
        id: `rec-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        donorName,
        idNumber: String(row[1] ?? '').trim(),
        address: String(row[2] ?? '').trim(),
        date: parseExcelDate(row[3]),
        period: inferredPeriod || '',
        sourceKey: makeSourceKey(file.name, workbook.SheetNames[0], r, row),
        amount,
        paymentMethod: String(row[5] ?? '').trim() || '계좌이체',
        donationType: String(row[6] ?? '').trim() || undefined,
        donationCode: String(row[7] ?? '').trim() || undefined,
        content: String(row[8] ?? '').trim() || '후원금',
      });
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
