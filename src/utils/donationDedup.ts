import type { RawDonationRecord } from '../types/donation';

/**
 * 동일한 납부내역을 다시 업로드했을 때 중복 합산하지 않기 위한 식별값입니다.
 * 회원명 + 식별번호/주소 + 납부일 + 금액 + 납부방법 + 기부내용을 기준으로 합니다.
 * 기부금유형/기부금코드는 선택 항목이므로 중복 판별 기준에서 제외합니다.
 * 그래야 같은 납부내역을 한 번은 빈 유형/코드로, 다음에는 유형/코드를 채워 다시 올려도 중복 합산되지 않습니다.
 */
export function getDonationFingerprint(record: RawDonationRecord): string {
  const identity = record.idNumber?.trim()
    ? `id:${record.idNumber.trim()}`
    : `address:${record.address?.trim() || ''}`;

  return [
    record.donorName,
    identity,
    record.date,
    Math.round(record.amount || 0),
    record.paymentMethod || '',
    record.content || '',
  ]
    .map((value) => String(value).trim().replace(/\s+/g, ' '))
    .join('|')
    .toLowerCase();
}

/** Firestore 문서 ID로 사용할 수 있는 안정적인 해시값을 생성합니다. */
export function getStableDonationId(record: RawDonationRecord): string {
  const input = getDonationFingerprint(record);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `donation_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** 기존 데이터와 신규 업로드 데이터를 중복 없이 합칩니다. */
export function mergeDonationRecords(
  existing: RawDonationRecord[],
  incoming: RawDonationRecord[]
): { records: RawDonationRecord[]; added: RawDonationRecord[]; duplicates: number } {
  const seen = new Set<string>();
  const records: RawDonationRecord[] = [];
  let duplicates = 0;

  for (const record of existing) {
    const fingerprint = getDonationFingerprint(record);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    records.push(record);
  }

  const added: RawDonationRecord[] = [];
  for (const raw of incoming) {
    const normalized: RawDonationRecord = {
      ...raw,
      id: getStableDonationId(raw),
      amount: Math.round(raw.amount || 0),
    };
    const fingerprint = getDonationFingerprint(normalized);
    if (seen.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    seen.add(fingerprint);
    records.push(normalized);
    added.push(normalized);
  }

  return { records, added, duplicates };
}
