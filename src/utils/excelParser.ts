import * as XLSX from 'xlsx';
import { RawDonationRecord, IssuedReceiptRecord } from '../types/donation';

// Flexible column matcher
const COLUMN_SYNONYMS = {
  donorName: ['성명', '성명후원자명', '이름', '후원자명', '기부자명', '기부자', '후원자', '회원명', '이름상호', '상호'],
  idNumber: ['주민등록번호', '주민번호', '주민등록번호/사업자번호', '주민번호/사업자번호', '주민/사업자번호', '주민사업자번호', '사업자번호', '사업자등록번호', '식별번호', '고유식별번호'],
  address: ['주소', '주소(소재지)', '주소 / 소재지', '소재지', '거주지', '기부자주소', '기부자 주소', '도로명주소', '본점소재지', '사업장소재지'],
  date: [
    '납부연월일', '납부 연월일', '납부년월일', '납부 년월일', '납부일자', '납부일', '납부연월', '납부년월', '납부일시', '납부날짜', '납부 날짜',
    '후원연월일', '후원 연월일', '후원년월일', '후원 년월일', '후원일자', '후원일', '후원연월', '후원년월', '후원일시', '후원날짜', '후원 날짜',
    '기부연월일', '기부 연월일', '기부년월일', '기부 년월일', '기부일자', '기부일', '기부연월', '기부년월', '기부일시', '기부날짜', '기부 날짜',
    '입금연월일', '입금 연월일', '입금년월일', '입금일자', '입금일', '입금연월', '입금년월', '입금일시', '입금날짜', '입금 날짜',
    '거래연월일', '거래년월일', '거래일자', '거래일', '거래일시', '거래날짜',
    '이체연월일', '이체년월일', '이체일자', '이체일', '이체일시',
    '결제연월일', '결제일자', '결제일', '결제일시',
    '수납연월일', '수납일자', '수납일', '수납일시',
    '처리연월일', '처리일자', '처리일', '처리일시',
    '발생연월일', '발생일자', '발생일', '발생일시',
    '승인연월일', '승인일자', '승인일', '승인일시',
    '출금연월일', '출금일자', '출금일', '출금일시',
    '연월일', '년월일', '일자', '날짜', '일시',
    'date', 'donationdate', 'paymentdate'
  ],
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
  return inferPeriodFromLabel(fileName);
}

/**
 * 파일명 또는 시트 이름(예: "1월", "2026-03", "8월")에서 기간(YYYY-MM)을 추정합니다.
 * 연도 정보가 없는 라벨(예: 시트명 "1월")은 fallbackYearPeriod(보통 파일명에서 추정한 연도)를
 * 우선 사용하고, 그마저 없으면 현재 연도를 사용합니다.
 */
function inferPeriodFromLabel(label: string, fallbackYearPeriod?: string): string {
  const name = String(label || '').replace(/\s+/g, '');
  let match = name.match(/(20\d{2})[-_.]?(0?[1-9]|1[0-2])월?/i);
  if (!match) match = name.match(/(20\d{2})년(0?[1-9]|1[0-2])월?/i);
  if (match) {
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }

  // 라벨에 '8월', '7월'처럼 월만 있는 경우, 다른 곳(파일명 등)에서 이미 알아낸 연도가 있으면
  // 그 연도를 사용하고, 없으면 현재 연도를 사용합니다.
  // 날짜가 없는 월별 회원자료를 관리하기 위한 보조값이며, 실제 후원일자가 있으면 그 날짜를 우선합니다.
  const monthOnly = name.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])월(?:[^0-9]|$)/i);
  if (monthOnly) {
    const fallbackYear = fallbackYearPeriod?.match(/^(20\d{2})/)?.[1] || String(new Date().getFullYear());
    return `${fallbackYear}-${String(Number(monthOnly[1])).padStart(2, '0')}`;
  }

  const compact = name.match(/(20\d{2})(0[1-9]|1[0-2])/);
  if (compact) return `${compact[1]}-${compact[2]}`;
  return '';
}

function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  // 1. JS Date instance
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Cell object wrapper (e.g. from SheetJS or formula evaluation)
  if (typeof val === 'object' && val !== null) {
    const candidate = (val as any).w ?? (val as any).v ?? (val as any).value ?? (val as any).text;
    if (candidate !== undefined && candidate !== null && candidate !== val) {
      const res = parseExcelDate(candidate);
      if (res) return res;
    }
  }

  // 3. Excel serial date number (e.g. 45300 or string "45300" / "45300.5")
  const numVal =
    typeof val === 'number'
      ? val
      : typeof val === 'string' && /^\d{4,5}(?:\.\d+)?$/.test(val.trim())
      ? Number(val.trim())
      : NaN;

  if (!Number.isNaN(numVal) && Number.isFinite(numVal) && numVal >= 1000 && numVal <= 90000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(numVal);
      if (dateObj?.y && dateObj?.m && dateObj?.d) {
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      }
    } catch {
      // fallback to string parsing
    }
  }

  let str = String(val).trim();
  if (!str) return '';

  // Remove ISO timestamp or time parts if present (e.g. "2026-03-15T00:00:00.000Z", "2026.03.15 14:30:00")
  str = str.replace(/T\d{2}:\d{2}:\d{2}.*$/, '').trim();

  // 4. 4-digit year: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / YYYY년 M월 D일
  const matched = str.match(/(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*(?:일|\.)?/);
  if (matched) {
    return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
  }

  // 5. 8-digit YYYYMMDD (e.g. "20260315")
  const eightDigit = str.match(/^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (eightDigit) {
    return `${eightDigit[1]}-${eightDigit[2]}-${eightDigit[3]}`;
  }

  // 6. 2-digit year: YY-MM-DD / YY.MM.DD / YY/MM/DD / YY년 M월 D일 (e.g. "26.03.15", "26-3-5")
  const twoDigit = str.match(/^(\d{2})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*(?:일|\.)?/);
  if (twoDigit) {
    return `20${twoDigit[1]}-${twoDigit[2].padStart(2, '0')}-${twoDigit[3].padStart(2, '0')}`;
  }

  // 7. 6-digit YYMMDD (e.g. "260315")
  const sixDigit = str.match(/^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (sixDigit) {
    return `20${sixDigit[1]}-${sixDigit[2]}-${sixDigit[3]}`;
  }

  // 8. Embedded date inside text (e.g. "[입금] 2026-03-15 처리")
  const embedded = str.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (embedded) {
    return `${embedded[1]}-${embedded[2].padStart(2, '0')}-${embedded[3].padStart(2, '0')}`;
  }

  // 9. Year-Month only (e.g. "2026-03", "2026.03", "2026년 3월")
  const yearMonth = str.match(/(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*월?/);
  if (yearMonth) {
    return `${yearMonth[1]}-${yearMonth[2].padStart(2, '0')}`;
  }

  // 10. M/D/YY 또는 M/D/YYYY (월/일/연도 순서, 예: "1/21/26")
  // 엑셀 셀 서식이 내장 서식 코드(예: 짧은 날짜)로 되어 있으면, SheetJS는 실제 파일의
  // 지역(한국) 표시와 무관하게 항상 "m/d/yy"(월/일/연도) 순서의 문자열로 변환합니다.
  // 그래서 셀에는 "2026-01-21"로 보이는 날짜라도, 이 앱이 읽어들이는 값은 "1/21/26"처럼
  // 나오는 경우가 있어 이 형식을 별도로 처리합니다.
  const usSlashDate = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (usSlashDate) {
    const month = String(Number(usSlashDate[1])).padStart(2, '0');
    const day = String(Number(usSlashDate[2])).padStart(2, '0');
    const yearPart = usSlashDate[3];
    const fullYear = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${fullYear}-${month}-${day}`;
    }
  }

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

/**
 * 파일 전체 내용을 기준으로 한 SHA-256 해시.
 * "같은 엑셀 파일을 실수로 두 번 올렸는지" 판단에만 사용합니다.
 * (행 단위 추측 중복판정에는 사용하지 않습니다 — donationDedup.ts 상단 설명 참고)
 */
async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface ParseResult {
  records: RawDonationRecord[];
  columnMapping: Record<string, string>;
  missingRequired: string[];
  totalRows: number;
  fileHash: string; // 파일 전체 내용 SHA-256 — 동일 파일 재업로드 확인용
  fileName: string;
}

interface SheetParseOutcome {
  records: RawDonationRecord[];
  columnMapping: Record<string, string>;
}

/**
 * 시트 하나(rawJson, header:1 형식)를 파싱해 후원 레코드 목록을 반환합니다.
 * 이 시트에서 열 이름(성명/후원금액)을 전혀 인식하지 못하면 null을 반환합니다.
 * (여러 시트가 있는 파일에서, 인식 실패한 시트 하나 때문에 전체 파일이 실패하지 않도록
 *  호출하는 쪽에서 null인 시트는 건너뛰고 나머지 시트는 계속 처리합니다.)
 */
function parseSheetRows(rawJson: any[][], periodForSheet: string): SheetParseOutcome | null {
  if (rawJson.length === 0) return null;

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
    return null;
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
  {
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
  const mappedFields = Object.values(bestHeaderMap);
  if (!mappedFields.includes('donorName') || !mappedFields.includes('amount')) {
    return null;
  }

  const records: RawDonationRecord[] = [];

  for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || row.length === 0) continue;

    const recordObj: Partial<RawDonationRecord> = {
      id: `rec-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      paymentMethod: '',
      content: '',
      period: periodForSheet || '',
      sourceRow: r + 1,
      // donationType / donationCode는 선택 항목입니다.
      // 값이 비어 있으면 undefined로 유지하여 영수증 발급 시 단체 기본값을 사용할 수 있게 합니다.
    };

    Object.entries(bestHeaderMap).forEach(([colIdxStr, fieldKey]) => {
      const colIdx = parseInt(colIdxStr, 10);
      const val = row[colIdx];

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
    // 월별 파일명/시트명(예: "2026년 8월.xlsx", 시트 "8월")에서 기간을 찾았다면 period에 저장합니다.
    // 실제 후원일자가 입력된 경우에는 기존 날짜를 그대로 보존합니다.
    const validDate = !recordObj.date || /^\d{4}-\d{2}(-\d{2})?$/.test(recordObj.date);
    // 업로드 필수값은 성명 + 0보다 큰 후원금액뿐입니다.
    // 주민/사업자번호, 주소, 후원일자, 기부금유형/코드가 비어 있어도 저장합니다.
    if (recordObj.donorName && validDate && Number(recordObj.amount) > 0) {
      records.push(recordObj as RawDonationRecord);
    }
  }

  // 일부 Excel 파일은 금액 셀이 수식/서식 문자열이거나 헤더에 특수문자가 섞여 있어
  // 첫 번째 매핑만으로 행을 잡지 못할 수 있습니다. 이 경우 성명/금액/날짜 열을 다시 찾아
  // '성명 + 양수 금액'만으로 한 번 더 안전하게 판별합니다.
  if (records.length === 0) {
    let donorCol = -1;
    let amountCol = -1;
    let dateCol = -1;
    let idCol = -1;
    let addrCol = -1;
    const header = rawJson[headerRowIndex] || [];
    header.forEach((cell: any, idx: number) => {
      const field = findMatchingField(String(cell ?? ''));
      if (field === 'donorName' && donorCol < 0) donorCol = idx;
      if (field === 'amount' && amountCol < 0) amountCol = idx;
      if (field === 'date' && dateCol < 0) dateCol = idx;
      if (field === 'idNumber' && idCol < 0) idCol = idx;
      if (field === 'address' && addrCol < 0) addrCol = idx;
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
          idNumber: idCol >= 0 ? String(row[idCol] ?? '').trim() : '',
          address: addrCol >= 0 ? String(row[addrCol] ?? '').trim() : '',
          date: dateCol >= 0 ? parseExcelDate(row[dateCol]) : '',
          period: periodForSheet || '',
          sourceRow: r + 1,
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
        period: periodForSheet || '',
        sourceRow: r + 1,
        amount,
        paymentMethod: String(row[5] ?? '').trim() || '계좌이체',
        donationType: String(row[6] ?? '').trim() || undefined,
        donationCode: String(row[7] ?? '').trim() || undefined,
        content: String(row[8] ?? '').trim() || '후원금',
      });
    }
  }

  const columnMapping: Record<string, string> = {};
  Object.entries(bestHeaderMap).forEach(([colIdx, field]) => {
    columnMapping[String(rawJson[headerRowIndex][parseInt(colIdx, 10)])] = field;
  });

  return { records, columnMapping };
}

/** 시트 이름이나 표 제목 등에서 "2025년"처럼 4자리 연도를 뽑아냅니다. 못 찾으면 null입니다. */
function inferYearFromLabel(label: string): number | null {
  const text = String(label ?? '');
  const withSuffix = text.match(/(20\d{2})\s*년/);
  if (withSuffix) return parseInt(withSuffix[1], 10);
  const leading = text.match(/^(20\d{2})(?!\d)/);
  if (leading) return parseInt(leading[1], 10);
  return null;
}

/**
 * "회비납입현황" 같은 회비 관리 대장(월별 컬럼) 서식을 인식해 후원(회비) 레코드로 변환합니다.
 *
 * 재단에서 실제로 쓰는 회비 대장은 일반 후원내역 서식(한 행 = 한 건의 후원)과 달리,
 * 회원 1명이 한 행을 차지하고 그 오른쪽으로 "1월, 2월, ... 12월"이 반복되며 각 달마다
 * (납입금액, 납입일자) 두 칸씩 있는 표입니다. 즉 한 행 안에 그 회원의 열두 달치 납부내역이
 * 전부 들어있습니다. 기존 parseSheetRows()는 "성명 + 금액" 열이 하나씩만 있다고 가정하기 때문에,
 * 이런 표를 만나면 (안전장치 때문에) 맨 왼쪽 달 하나만 인식하고 나머지 11개월은 조용히
 * 누락시키는 문제가 있었습니다. 이 함수는 그 달-반복 구조를 직접 인식해서, 실제로 금액이
 * 채워진 달마다 각각 별도의 후원(회비) 레코드를 만듭니다.
 *
 * 연도는 시트 이름(예: "2025년 회원현황-260407")이나 표 상단 제목(예: "▣ 2025년 회비납입 현황 ▣")에서
 * 추정합니다. 연도를 전혀 찾지 못하면 null을 반환해 일반 서식으로 다시 시도하게 합니다
 * (연도를 추측해서 잘못 배정하는 것을 방지).
 */
function parseMonthlyDuesLedgerSheet(rawJson: any[][], sheetLabel: string): SheetParseOutcome | null {
  let monthHeaderRowIndex = -1;
  let monthCols: { month: number; amountCol: number; dateCol: number }[] = [];
  let nameCol = -1;
  let addressCol = -1;
  let idCol = -1;

  for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    const monthMatches: { month: number; col: number }[] = [];
    row.forEach((cellVal, colIdx) => {
      const text = String(cellVal ?? '').trim();
      const match = text.match(/^(\d{1,2})월$/);
      if (match) {
        const month = parseInt(match[1], 10);
        if (month >= 1 && month <= 12) monthMatches.push({ month, col: colIdx });
      }
    });

    // "N월"이 최소 3개 이상 반복돼야 진짜 월별 대장 서식으로 봅니다 (우연히 1~2개 매칭되는 것은 제외).
    if (monthMatches.length >= 3) {
      monthHeaderRowIndex = r;
      monthCols = monthMatches.map((mm) => ({ month: mm.month, amountCol: mm.col, dateCol: mm.col + 1 }));
      row.forEach((cellVal, colIdx) => {
        const field = findMatchingField(String(cellVal ?? ''));
        if (field === 'donorName' && nameCol < 0) nameCol = colIdx;
        if (field === 'address' && addressCol < 0) addressCol = colIdx;
        if (field === 'idNumber' && idCol < 0) idCol = colIdx;
      });
      break;
    }
  }

  if (monthHeaderRowIndex === -1 || monthCols.length === 0 || nameCol < 0) return null;

  let year = inferYearFromLabel(sheetLabel);
  if (!year) {
    for (let r = 0; r < monthHeaderRowIndex && !year; r++) {
      const row = rawJson[r];
      if (!Array.isArray(row)) continue;
      for (const cellVal of row) {
        const y = inferYearFromLabel(String(cellVal ?? ''));
        if (y) {
          year = y;
          break;
        }
      }
    }
  }
  if (!year) return null; // 연도를 추측하지 않고, 다른 서식으로 다시 시도하도록 넘깁니다.

  // 월 헤더 바로 다음 줄이 "납입금액/납입일자" 같은 하위 헤더 줄이면 그 줄까지 건너뜁니다.
  const possibleSubHeaderRow = rawJson[monthHeaderRowIndex + 1];
  const hasSubHeaderRow =
    Array.isArray(possibleSubHeaderRow) &&
    monthCols.some(({ amountCol }) => {
      const text = String(possibleSubHeaderRow[amountCol] ?? '').trim();
      return text.includes('금액') || text.includes('납입') || text.includes('납부');
    });
  const dataStartRow = monthHeaderRowIndex + (hasSubHeaderRow ? 2 : 1);

  const records: RawDonationRecord[] = [];

  for (let r = dataStartRow; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || row.length === 0) continue;
    const donorName = String(row[nameCol] ?? '').trim();
    if (!donorName) continue;
    const address = addressCol >= 0 ? String(row[addressCol] ?? '').trim() : '';
    const idNumber = idCol >= 0 ? String(row[idCol] ?? '').trim() : '';

    for (const { month, amountCol, dateCol } of monthCols) {
      const amount = parseExcelAmount(row[amountCol]);
      if (!amount || amount <= 0) continue; // 그 달에 납부 기록이 없는 칸은 건너뜁니다.

      const parsedDate = parseExcelDate(row[dateCol]);
      // 납입일자가 비어있거나 해당 연도와 다르면(오탈자 등), 최소한 "그 달 1일"로 기록해서
      // 연도/월 조회에서는 정상적으로 잡히도록 합니다. 실제 납입일자가 있으면 그것을 그대로 씁니다.
      const date = parsedDate && parsedDate.startsWith(String(year)) ? parsedDate : `${year}-${String(month).padStart(2, '0')}-01`;

      records.push({
        id: `rec-${Date.now()}-${r}-${amountCol}-${Math.random().toString(36).substring(2, 6)}`,
        donorName,
        idNumber,
        address,
        date,
        period: `${year}-${String(month).padStart(2, '0')}`,
        sourceRow: r + 1,
        amount,
        paymentMethod: '회비',
        content: '회비',
      });
    }
  }

  if (records.length === 0) return null;

  const columnMapping: Record<string, string> = {
    [`${sheetLabel} 성명열`]: 'donorName',
    [`${sheetLabel} ${year}년 월별(1~12월) 납입금액/납입일자열`]: 'amount+date',
  };

  return { records, columnMapping };
}

export async function parseDonationExcel(file: File): Promise<ParseResult> {
  const inferredPeriodFromFile = inferPeriodFromFileName(file.name);
  const buffer = await file.arrayBuffer();
  const fileHash = await computeFileHash(buffer);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellFormula: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  // 여러 시트(예: "1월"~"8월" 탭)가 있는 파일은, 시트마다 각각 후원자료를 담고 있는
  // 월별 관리 파일일 수 있습니다. 이 경우 시트를 하나씩 모두 읽어서 결과를 누적합니다.
  // (파일을 여러 개로 쪼개 올리지 않아도, 파일 하나 안의 모든 탭이 자동으로 합쳐집니다.)
  const isMultiSheet = workbook.SheetNames.length > 1;
  const allRecords: RawDonationRecord[] = [];
  const columnMappingSummary: Record<string, string> = {};
  let anySheetRecognized = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (rawJson.length === 0) continue; // 완전히 빈 시트는 조용히 건너뜁니다.

    // 시트별 기간 추정: 파일명에서 기간을 찾았다면 그것을 기본으로 쓰되, 시트 이름 자체에
    // 더 구체적인 월 정보(예: "3월")가 있으면 그 시트에는 시트별 기간을 우선 적용합니다.
    const periodForSheet = isMultiSheet
      ? inferPeriodFromLabel(sheetName, inferredPeriodFromFile) || inferredPeriodFromFile
      : inferredPeriodFromFile;

    // 먼저 "월별 컬럼이 반복되는 회비 대장" 서식인지 확인하고, 아니면 일반 후원내역 서식으로 처리합니다.
    const sheetOutcome = parseMonthlyDuesLedgerSheet(rawJson, sheetName) || parseSheetRows(rawJson, periodForSheet);
    if (!sheetOutcome) continue; // 이 시트는 열 이름을 인식하지 못했습니다 — 건너뛰고 나머지 시트는 계속 처리합니다.

    anySheetRecognized = true;
    allRecords.push(...sheetOutcome.records);
    Object.entries(sheetOutcome.columnMapping).forEach(([k, v]) => {
      // 시트가 여러 개면 어느 시트에서 인식된 열인지 알 수 있도록 시트명을 붙입니다.
      columnMappingSummary[isMultiSheet ? `[${sheetName}] ${k}` : k] = v;
    });
  }

  if (!anySheetRecognized) {
    throw new Error('엑셀 열 이름을 인식할 수 없습니다. 최소한 성명과 후원금액 열이 포함되어 있는지 확인해주세요.');
  }

  return {
    records: allRecords,
    columnMapping: columnMappingSummary,
    missingRequired: [],
    totalRows: allRecords.length,
    fileHash,
    fileName: file.name,
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
