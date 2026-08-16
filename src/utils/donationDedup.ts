import type { RawDonationRecord } from '../types/donation';

/**
 * 동일 납부내역의 중복 저장을 막습니다.
 * ID/주소가 새로 채워진 경우에도 기존의 같은 납부건을 찾아 기존 레코드를 보강합니다.
 */
export function getDonationFingerprint(record: RawDonationRecord): string {
  const identity = record.idNumber?.trim()
    ? `id:${record.idNumber.trim()}`
    : `address:${record.address?.trim() || ''}`;

  return [
    record.donorName,
    identity,
    record.date || record.period || '',
    Math.round(record.amount || 0),
    record.paymentMethod || '',
    record.content || '',
  ].map((value) => String(value).trim().replace(/\s+/g, ' ')).join('|').toLowerCase();
}

// ID/주소가 한쪽 레코드에만 있는 경우에도 같은 납부건인지 판단하기 위한 보조 키
function getPaymentFingerprint(record: RawDonationRecord): string {
  const month = (record.date || '').slice(0, 7) || record.period || '';
  return [
    record.donorName,
    month,
    Math.round(record.amount || 0),
    record.paymentMethod || '',
    record.content || '',
  ].map((value) => String(value).trim().replace(/\s+/g, ' ')).join('|').toLowerCase();
}

function enrich(existing: RawDonationRecord, incoming: RawDonationRecord): RawDonationRecord {
  return {
    ...existing,
    donorName: existing.donorName || incoming.donorName,
    idNumber: existing.idNumber || incoming.idNumber || '',
    address: existing.address || incoming.address || '',
    date: existing.date || incoming.date || '',
    period: existing.period || incoming.period,
    paymentMethod: existing.paymentMethod || incoming.paymentMethod || '계좌이체',
    donationType: existing.donationType || incoming.donationType,
    donationCode: existing.donationCode || incoming.donationCode,
    content: existing.content || incoming.content || '후원금',
    amount: Math.round(existing.amount || incoming.amount || 0),
  };
}

export function getStableDonationId(record: RawDonationRecord): string {
  const input = getPaymentFingerprint(record) + `|${record.idNumber || ''}|${record.address || ''}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `donation_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function mergeDonationRecords(
  existing: RawDonationRecord[],
  incoming: RawDonationRecord[]
): { records: RawDonationRecord[]; added: RawDonationRecord[]; updated: RawDonationRecord[]; duplicates: number } {
  const records: RawDonationRecord[] = [];
  const exactSeen = new Set<string>();
  const paymentIndex = new Map<string, number>();
  let duplicates = 0;

  for (const raw of existing) {
    const record = { ...raw, amount: Math.round(raw.amount || 0) };
    const exact = getDonationFingerprint(record);
    if (exactSeen.has(exact)) continue;
    exactSeen.add(exact);
    paymentIndex.set(getPaymentFingerprint(record), records.length);
    records.push(record);
  }

  const added: RawDonationRecord[] = [];
  const updated: RawDonationRecord[] = [];
  for (const raw of incoming) {
    const normalized: RawDonationRecord = {
      ...raw,
      id: getStableDonationId(raw),
      idNumber: raw.idNumber?.trim() || '',
      address: raw.address?.trim() || '',
      date: raw.date || '',
      amount: Math.round(raw.amount || 0),
    };

    const exact = getDonationFingerprint(normalized);
    if (exactSeen.has(exact)) {
      duplicates += 1;
      continue;
    }

    const paymentKey = getPaymentFingerprint(normalized);
    const existingIndex = paymentIndex.get(paymentKey);
    if (existingIndex !== undefined) {
      // 기존 자료에 주민번호/주소/날짜 등이 비어 있었다면 새 자료의 값을 반영합니다.
      const merged = enrich(records[existingIndex], normalized);
      records[existingIndex] = merged;
      updated.push(merged);
      exactSeen.add(getDonationFingerprint(merged));
      duplicates += 1;
      continue;
    }

    exactSeen.add(exact);
    paymentIndex.set(paymentKey, records.length);
    records.push(normalized);
    added.push(normalized);
  }

  return { records, added, updated, duplicates };
}
