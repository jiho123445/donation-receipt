import * as pdfjsLib from 'pdfjs-dist';
// Vite의 `?url` 접미사는 이 워커 스크립트를 별도 정적 파일로 번들링하고, 그 최종 URL 문자열을 돌려줍니다.
// (pdf.js는 실제 PDF 파싱을 브라우저 메인 스레드가 아닌 이 워커에서 수행합니다)
// @ts-ignore - Vite 전용 쿼리 접미사 import라 타입 선언이 없습니다.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { AwardRecord } from '../types/donation';
import { parseAwardSheet, type AwardParseResult } from './awardParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * 수상내역(표창명단) PDF 파서.
 *
 * 재단에서 실제로 배포하는 표창명단 PDF(예: "2024년 사단법인 너브내행복나눔재단 표창명단")는
 * "연번 | 성명 | 2024 | 2023 | 2022 | ..."처럼 연도가 가로로 나열된 표이고, 좁은 연도 칸 안에서
 * 수상내역 문구가 여러 줄로 줄바꿈되어 있습니다. PDF에는 표/셀 구조가 따로 저장되어 있지 않고
 * 글자마다 페이지 상의 좌표(x, y)만 있기 때문에, 아래 순서로 표를 다시 복원합니다.
 *
 *  1. 페이지마다 "연번" 글자를 찾아 그 줄을 헤더 행으로 보고, 헤더 각 칸(연번/성명/연도별)의
 *     x좌표를 열(컬럼) 기준선으로 삼습니다.
 *  2. "연번" 칸과 같은 x 범위에 있는 숫자만 뽑아 각 회원 행의 y좌표(행 기준선)로 삼습니다.
 *     (표창내역이 여러 줄로 늘어나 그 행이 세로로 길어져도, 연번 숫자는 항상 한 번만 나오므로
 *      가장 안정적인 "행 경계" 기준이 됩니다)
 *  3. 나머지 모든 글자를, y좌표는 가장 가까운 행 기준선에, x좌표는 가장 가까운 열 기준선에 배정합니다.
 *  4. 같은 (행, 열)에 배정된 글자들을 줄바꿈 순서대로 이어 붙여 실제 셀 문자열로 복원합니다.
 *  5. 이렇게 복원한 표를 엑셀 파서와 동일한 parseAwardSheet()에 그대로 넘겨 AwardRecord[]로 만듭니다.
 *
 * 표 형태가 크게 다른 PDF(표가 아예 없거나 회전/스캔 이미지인 경우 등)는 인식하지 못할 수 있으며,
 * 이때는 표 형태의 엑셀로 변환해서 올려달라는 안내 메시지를 던집니다.
 */

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

interface ColumnAnchor {
  key: string; // 'memberNo' | 'name' | 실제 연도 숫자 문자열(예: '2024')
  x: number;
}

interface RowAnchor {
  no: string;
  y: number;
}

const MEMBER_NO_HEADER_LABELS = ['연번', '번호'];
const NAME_HEADER_LABELS = ['성', '성명', '이름'];

function parseYearToken(text: string): number | null {
  const clean = text.replace(/\s+/g, '');
  const match = clean.match(/^(19|20)\d{2}(?:년)?$/);
  if (!match) return null;
  return parseInt(clean.replace(/년$/, ''), 10);
}

/** 같은 행/열에 배정된 글자들을 줄바꿈 순서대로 이어 붙여 하나의 셀 문자열로 만듭니다. */
function buildCellText(items: RawTextItem[], joinLinesWithSpace: boolean): string {
  // 1) y좌표가 비슷한 것끼리 "한 줄"로 묶습니다.
  const lineBuckets: { y: number; items: RawTextItem[] }[] = [];
  for (const item of items) {
    const existing = lineBuckets.find((b) => Math.abs(b.y - item.y) < 3);
    if (existing) existing.items.push(item);
    else lineBuckets.push({ y: item.y, items: [item] });
  }
  // 2) 위에서 아래 순서(y 내림차순)로 줄을 정렬합니다.
  lineBuckets.sort((a, b) => b.y - a.y);

  const lineTexts = lineBuckets.map(({ items: lineItems }) => {
    // 같은 줄 안에서는 x좌표(왼쪽→오른쪽) 순서로 정렬하고, 글자 사이 간격이 벌어져 있으면
    // 실제 띄어쓰기였다고 보고 공백을 넣습니다.
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);
    let text = '';
    let prevEndX: number | null = null;
    for (const it of sorted) {
      if (prevEndX !== null && it.x - prevEndX > 2) text += ' ';
      text += it.str;
      prevEndX = it.x + it.w;
    }
    return text.trim();
  });

  return lineTexts
    .join(joinLinesWithSpace ? ' ' : '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdfAsGrid(file: File): Promise<{ grid: any[][]; matchedPages: number; totalPages: number }> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  // 성명 + 연도별 수상내역을 페이지 상관없이 한 번에 모읍니다. (연번을 키로 병합)
  const rowsByMemberNo = new Map<string, { memberNo: string; name: string; cells: Map<number, string> }>();
  const allYears = new Set<number>();
  let matchedPages = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: RawTextItem[] = content.items
      .map((raw: any) => ({ str: String(raw.str ?? ''), x: raw.transform[4], y: raw.transform[5], w: raw.width || 0 }))
      .filter((it: RawTextItem) => it.str.trim() !== '');

    const memberNoHeader = items.find((it) => MEMBER_NO_HEADER_LABELS.includes(it.str.trim()));
    if (!memberNoHeader) continue; // 이 페이지에는 표 헤더가 없음 (표지 등) — 건너뜁니다.

    const headerY = memberNoHeader.y;
    const headerBand = items.filter((it) => Math.abs(it.y - headerY) < 3);
    const nameHeader = headerBand.find((it) => NAME_HEADER_LABELS.includes(it.str.trim()));
    if (!nameHeader) continue;

    const yearHeaders = headerBand
      .map((it) => ({ item: it, year: parseYearToken(it.str) }))
      .filter((h): h is { item: RawTextItem; year: number } => h.year !== null);
    if (yearHeaders.length === 0) continue; // 연도 컬럼을 하나도 못 찾으면 이 페이지는 표가 아닌 것으로 봅니다.

    matchedPages++;
    const columns: ColumnAnchor[] = [
      { key: 'memberNo', x: memberNoHeader.x },
      { key: 'name', x: nameHeader.x },
      ...yearHeaders.map((h) => ({ key: String(h.year), x: h.item.x })),
    ];
    yearHeaders.forEach((h) => allYears.add(h.year));

    // 행 기준선: '연번' 칸과 같은 x 범위에 있는 숫자만 모읍니다.
    const rowAnchors: RowAnchor[] = items
      .filter((it) => it.y < headerY - 5 && Math.abs(it.x - memberNoHeader.x) < 15 && /^\d+$/.test(it.str.trim()))
      .map((it) => ({ no: it.str.trim(), y: it.y }));

    if (rowAnchors.length === 0) continue;

    const findNearestRow = (itemY: number): RowAnchor | null => {
      let best: RowAnchor | null = null;
      let bestDist = Infinity;
      for (const a of rowAnchors) {
        const d = Math.abs(a.y - itemY);
        if (d < bestDist) {
          bestDist = d;
          best = a;
        }
      }
      return best;
    };
    const findNearestCol = (itemX: number): ColumnAnchor => {
      let best = columns[0];
      let bestDist = Math.abs(itemX - columns[0].x);
      for (const c of columns) {
        const d = Math.abs(itemX - c.x);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best;
    };

    // 헤더 행 자체와 헤더보다 위쪽(제목 등)은 제외하고, 나머지 글자를 (행, 열)로 배정합니다.
    const buckets = new Map<string, RawTextItem[]>();
    for (const item of items) {
      if (item.y >= headerY - 2) continue;
      const row = findNearestRow(item.y);
      if (!row) continue;
      const col = findNearestCol(item.x);
      const key = `${row.no}__${row.y}__${col.key}`;
      const list = buckets.get(key) || [];
      list.push(item);
      buckets.set(key, list);
    }

    for (const anchor of rowAnchors) {
      const rowKey = `${anchor.no}`;
      const nameBucket = buckets.get(`${anchor.no}__${anchor.y}__name`) || [];
      const name = buildCellText(nameBucket, false); // 성명은 줄바꿈되어도 공백 없이 이어붙입니다 (예: "남궁"+"진영" → "남궁진영")

      let row = rowsByMemberNo.get(rowKey);
      if (!row) {
        row = { memberNo: anchor.no, name, cells: new Map() };
        rowsByMemberNo.set(rowKey, row);
      } else if (!row.name && name) {
        row.name = name;
      }

      for (const h of yearHeaders) {
        const bucket = buckets.get(`${anchor.no}__${anchor.y}__${h.year}`);
        if (!bucket || bucket.length === 0) continue;
        const text = buildCellText(bucket, true);
        if (text) row.cells.set(h.year, text);
      }
    }
  }

  if (matchedPages === 0 || rowsByMemberNo.size === 0) {
    return { grid: [], matchedPages, totalPages: doc.numPages };
  }

  const years = Array.from(allYears).sort((a, b) => b - a);
  const header = ['연번', '성명', ...years.map(String)];
  const dataRows = Array.from(rowsByMemberNo.values())
    .sort((a, b) => parseInt(a.memberNo, 10) - parseInt(b.memberNo, 10))
    .map((row) => [row.memberNo, row.name, ...years.map((y) => row.cells.get(y) || '')]);

  return { grid: [header, ...dataRows], matchedPages, totalPages: doc.numPages };
}

export async function parseAwardPdf(file: File): Promise<AwardParseResult> {
  const { grid, matchedPages, totalPages } = await extractPdfAsGrid(file);

  if (grid.length === 0) {
    throw new Error(
      `PDF에서 표창명단 표를 인식하지 못했습니다 (전체 ${totalPages}페이지 중 표 형식을 찾은 페이지: ${matchedPages}개). "연번 | 성명 | 2024 | 2023 ..." 형태의 표가 포함된 PDF인지 확인해주시거나, 같은 내용을 엑셀로 올려주세요.`
    );
  }

  const outcome = parseAwardSheet(grid, file.name);
  if (!outcome || outcome.records.length === 0) {
    throw new Error('PDF 표는 인식했지만 실제 수상 기록이 있는 칸을 찾지 못했습니다.');
  }

  const yearsDetected = Array.from(new Set(outcome.records.map((r) => r.year))).sort((a, b) => b - a);

  return {
    records: outcome.records,
    totalRows: outcome.records.length,
    yearsDetected,
    fileName: file.name,
    format: outcome.format,
  };
}
