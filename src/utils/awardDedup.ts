import type { AwardRecord } from '../types/donation';

/**
 * 수상내역 병합 규칙.
 *
 * 후원내역(donationDedup.ts)과 달리 수상내역은 "고유번호"가 없는 명단(성명 + 연도 + 수상내역 문구)이고,
 * [표창명단 불러오기] 버튼을 여러 번 누르거나 같은 엑셀을 실수로 다시 올려도 매번 새 id가 발급됩니다.
 * 따라서 id가 아니라 "성명+연도+수상내역 문구"가 완전히 같은 항목을 같은 수상 기록으로 보고
 * 중복 저장을 막습니다. (문구가 조금이라도 다르면 실제로 다른 수상 기록일 수 있으므로 별도 건으로 저장합니다.)
 */
function fingerprint(record: AwardRecord): string {
  const norm = (v: string) => (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${norm(record.recipientName)}__${record.year}__${norm(record.awardName)}`;
}

export function mergeAwardRecords(
  existing: AwardRecord[],
  incoming: AwardRecord[]
): {
  records: AwardRecord[];
  added: AwardRecord[];
  duplicates: number;
} {
  const seen = new Set(existing.map(fingerprint));
  const added: AwardRecord[] = [];
  let duplicates = 0;

  for (const raw of incoming) {
    const fp = fingerprint(raw);
    if (seen.has(fp)) {
      duplicates += 1;
      continue;
    }
    seen.add(fp);
    added.push(raw);
  }

  return {
    records: [...existing, ...added],
    added,
    duplicates,
  };
}
