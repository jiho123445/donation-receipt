import * as XLSX from 'xlsx';
import { AwardRecord } from '../types/donation';

/**
 * 수상내역(표창명단) 엑셀 파서.
 *
 * 재단에서 실제로 쓰는 표창명단은 "연번 | 성명 | 2024 | 2023 | 2022 | 2021 | 2020 | 2019 ..."처럼
 * 연도가 가로로 나열되고, 그 해에 수상한 회원의 칸에만 수상내역 문구가 적혀있는 형식입니다.
 * (첨부된 "2024년 사단법인 너브내행복나눔재단 표창명단"과 동일한 서식 — src/utils/awardSeedData.ts 참고)
 *
 * 이 파서는 그 "가로형(연도별 컬럼)" 서식과, 이미 정리된 "세로형(성명/연도/수상내역 3열)" 서식을
 * 모두 인식해 AwardRecord[]로 정규화합니다.
 */

const NAME_COLUMN_SYNONYMS = ['성명', '성 명', '이름', '수상자', '수상자명', '수상자성명', '회원명', '수상회원'];
const MEMBER_NO_SYNONYMS = ['연번', '번호', 'no', 'no.'];
const AWARD_TEXT_SYNONYMS = ['수상내역', '수상내용', '포상내역', '표창내역', '상훈내역', '수상명', '표창명', '상훈'];
const YEAR_COLUMN_SYNONYMS = ['수상연도', '연도', '수상년도', '년도'];

function normalizeHeaderName(header: string): string {
  return String(header ?? '')
    .replace(/\s+/g, '')
    .replace(/[()\[\]{}<>_\-/\\:·.,]/g, '')
    .toLowerCase();
}

function cellToText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const candidate = (val as any).w ?? (val as any).v ?? (val as any).value ?? (val as any).text;
    if (candidate === undefined || candidate === null) return '';
    return String(candidate).trim();
  }
  // 표 안에서 줄바꿈으로 나뉘어 있는 수상내역 문구(예: "2024년\n한마음축제\n군수상")를 한 줄로 정리합니다.
  return String(val).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 헤더 셀 문자열이 "2019"~"2099년" 같은 연도 표기인지 판별하고, 맞다면 4자리 연도 숫자를 반환합니다. */
function parseYearHeader(header: string): number | null {
  const clean = String(header ?? '').replace(/\s+/g, '');
  const match = clean.match(/^(19|20)\d{2}(?:년)?$/);
  if (!match) return null;
  const year = parseInt(clean.replace(/년$/, ''), 10);
  return Number.isFinite(year) ? year : null;
}

function findColumnByFieldSynonyms(header: string, synonyms: string[]): boolean {
  const clean = normalizeHeaderName(header);
  if (!clean) return false;
  return synonyms.some((syn) => clean === normalizeHeaderName(syn));
}

export interface AwardParseResult {
  records: AwardRecord[];
  totalRows: number;
  yearsDetected: number[];
  fileName: string;
  format: 'wide' | 'tidy';
}

/**
 * 시트/표 하나(header:1 형식의 2차원 배열)를 파싱합니다.
 * 연도 컬럼이 하나라도 인식되면 "가로형", 성명+수상내역(+연도) 컬럼이 인식되면 "세로형"으로 처리합니다.
 * 어느 쪽도 인식하지 못하면 null을 반환합니다(다른 시트를 계속 시도할 수 있도록).
 *
 * 엑셀(parseAwardExcel)뿐 아니라 PDF 표창명단(awardPdfParser.ts에서 좌표 기반으로 복원한
 * 표)도 결국 같은 2차원 배열 형태로 만들어 이 함수를 그대로 재사용합니다.
 */
export function parseAwardSheet(rawJson: any[][], sheetLabel: string): { records: AwardRecord[]; format: 'wide' | 'tidy' } | null {
  if (rawJson.length === 0) return null;

  // 헤더 행 탐색: 성명 컬럼 + (연도 컬럼 1개 이상 또는 수상내역 컬럼)을 가장 많이 인식하는 행을 사용합니다.
  let headerRowIndex = -1;
  let bestScore = 0;
  let bestNameCol = -1;
  let bestMemberNoCol = -1;
  let bestYearCols: Record<number, number> = {}; // colIdx -> year
  let bestAwardTextCol = -1;
  let bestYearFieldCol = -1;

  for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    let nameCol = -1;
    let memberNoCol = -1;
    const yearCols: Record<number, number> = {};
    let awardTextCol = -1;
    let yearFieldCol = -1;

    row.forEach((cellVal, colIdx) => {
      const text = String(cellVal ?? '').trim();
      if (!text) return;
      if (nameCol < 0 && findColumnByFieldSynonyms(text, NAME_COLUMN_SYNONYMS)) {
        nameCol = colIdx;
        return;
      }
      if (memberNoCol < 0 && findColumnByFieldSynonyms(text, MEMBER_NO_SYNONYMS)) {
        memberNoCol = colIdx;
        return;
      }
      if (awardTextCol < 0 && findColumnByFieldSynonyms(text, AWARD_TEXT_SYNONYMS)) {
        awardTextCol = colIdx;
        return;
      }
      if (yearFieldCol < 0 && findColumnByFieldSynonyms(text, YEAR_COLUMN_SYNONYMS)) {
        yearFieldCol = colIdx;
        return;
      }
      const year = parseYearHeader(text);
      if (year !== null) {
        yearCols[colIdx] = year;
      }
    });

    const yearColCount = Object.keys(yearCols).length;
    // 점수: 성명 인식이 필수이며, 연도 컬럼 개수 또는 (수상내역+연도 필드) 조합이 클수록 우선합니다.
    const score = nameCol >= 0 ? 1 + yearColCount + (awardTextCol >= 0 ? 1 : 0) + (yearFieldCol >= 0 ? 1 : 0) : 0;

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = r;
      bestNameCol = nameCol;
      bestMemberNoCol = memberNoCol;
      bestYearCols = yearCols;
      bestAwardTextCol = awardTextCol;
      bestYearFieldCol = yearFieldCol;
    }
  }

  if (headerRowIndex === -1 || bestNameCol < 0) return null;

  const records: AwardRecord[] = [];
  const wideMode = Object.keys(bestYearCols).length > 0;

  if (wideMode) {
    // 가로형: 각 행 × 각 연도 컬럼을 확인해, 값이 채워진 칸만 수상 레코드로 만듭니다.
    for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
      const row = rawJson[r];
      if (!row || row.length === 0) continue;
      const recipientName = cellToText(row[bestNameCol]);
      if (!recipientName) continue;
      const memberNo = bestMemberNoCol >= 0 ? cellToText(row[bestMemberNoCol]) : undefined;

      Object.entries(bestYearCols).forEach(([colIdxStr, year]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const awardName = cellToText(row[colIdx]);
        if (!awardName) return; // 빈 칸(수상 없음)은 건너뜁니다.
        records.push({
          id: `award-${Date.now()}-${r}-${colIdx}-${Math.random().toString(36).substring(2, 6)}`,
          recipientName,
          memberNo: memberNo || undefined,
          year,
          awardName,
          sourceLabel: sheetLabel,
          sourceRow: r + 1,
        });
      });
    }
    return { records, format: 'wide' };
  }

  // 세로형: 성명 + 수상내역 컬럼(+ 선택적으로 연도 컬럼)이 있는 경우.
  if (bestAwardTextCol >= 0) {
    for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
      const row = rawJson[r];
      if (!row || row.length === 0) continue;
      const recipientName = cellToText(row[bestNameCol]);
      const awardName = cellToText(row[bestAwardTextCol]);
      if (!recipientName || !awardName) continue;
      const memberNo = bestMemberNoCol >= 0 ? cellToText(row[bestMemberNoCol]) : undefined;
      const yearText = bestYearFieldCol >= 0 ? cellToText(row[bestYearFieldCol]) : '';
      const yearMatch = yearText.match(/(19|20)\d{2}/) || awardName.match(/(19|20)\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

      records.push({
        id: `award-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        recipientName,
        memberNo: memberNo || undefined,
        year,
        awardName,
        sourceLabel: sheetLabel,
        sourceRow: r + 1,
      });
    }
    return { records, format: 'tidy' };
  }

  return null;
}

export async function parseAwardExcel(file: File): Promise<AwardParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellFormula: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  const allRecords: AwardRecord[] = [];
  let detectedFormat: 'wide' | 'tidy' = 'wide';
  let anySheetRecognized = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (rawJson.length === 0) continue;

    const outcome = parseAwardSheet(rawJson, file.name);
    if (!outcome) continue;

    anySheetRecognized = true;
    detectedFormat = outcome.format;
    allRecords.push(...outcome.records);
  }

  if (!anySheetRecognized) {
    throw new Error(
      '수상내역 엑셀 형식을 인식할 수 없습니다. "연번/성명 + 연도별 컬럼(예: 2024, 2023...)" 또는 "성명/연도/수상내역" 열이 포함되어 있는지 확인해주세요.'
    );
  }

  const yearsDetected = Array.from(new Set(allRecords.map((r) => r.year))).sort((a, b) => b - a);

  return {
    records: allRecords,
    totalRows: allRecords.length,
    yearsDetected,
    fileName: file.name,
    format: detectedFormat,
  };
}

/**
 * 표창명단 표준 서식(가로형: 연번/성명 + 연도별 컬럼) 샘플 다운로드.
 * 첨부된 "2024년 표창명단"과 동일한 구조이며, 새 연도가 생기면 오른쪽에 연도 열을 추가해 사용할 수 있습니다.
 */
export function downloadSampleAwardExcelTemplate() {
  const currentYear = new Date().getFullYear();
  const headers = ['연번', '성명', ...Array.from({ length: 6 }, (_, i) => String(currentYear - i))];

  const sampleRows = [
    ['1', '홍길동', `${currentYear}년 정기총회 군수상`, '', '', '', '', ''],
    ['2', '김철수', '', `${currentYear - 1}년 송년회 국회의원상`, '', '', '', ''],
    ['3', '이영희', '', '', '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [{ wch: 8 }, { wch: 14 }, ...Array(6).fill({ wch: 22 })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '표창명단양식');
  XLSX.writeFile(wb, '너브내행복나눔재단_표창명단_표준서식.xlsx');
}
