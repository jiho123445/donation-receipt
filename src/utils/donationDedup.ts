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
  // 주민/사업자번호가 있으면 동일인을 우선 식별하고, 없으면 이름을 사용합니다.
  const identity = record.idNumber?.trim() ? `id:${record.idNumber.trim()}` : `name:${record.donorName.trim()}`;
  return [
    identity,
    month,
    Math.round(record.amount || 0),
    record.paymentMethod || '',
    record.content || '',
  ].map((value) => String(value).trim().replace(/\s+/g, ' ')).join('|').toLowerCase();
}

function isMonthOnly(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

function samePersonAndPayment(existing: RawDonationRecord, incoming: RawDonationRecord): boolean {
  const sameId = !!existing.idNumber?.trim() && !!incoming.idNumber?.trim() &&
    existing.idNumber.trim() === incoming.idNumber.trim();
  const sameName = existing.donorName.trim().toLowerCase() === incoming.donorName.trim().toLowerCase();
  if (!sameId && !sameName) return false;

  if (Math.round(existing.amount || 0) !== Math.round(incoming.amount || 0)) return false;

  const existingPayment = (existing.paymentMethod || '').trim();
  const incomingPayment = (incoming.paymentMethod || '').trim();
  if (existingPayment && incomingPayment && existingPayment !== incomingPayment) return false;

  const existingContent = (existing.content || '').trim();
  const incomingContent = (incoming.content || '').trim();
  if (existingContent && incomingContent && existingContent !== incomingContent) return false;

  // 기존 자료가 월 단위(period 또는 YYYY-MM)로만 저장되어 있고
  // 새 Excel에는 정확한 일자가 들어온 경우, 월이 달라도 기존 자료의 잘못된
  // '파일명 월'을 신뢰하지 않고 동일 납부건 보강 후보로 허용합니다.
  const existingDateIsPartial = !existing.date || isMonthOnly(existing.date);
  return existingDateIsPartial;
}

function enrich(existing: RawDonationRecord, incoming: RawDonationRecord): RawDonationRecord {
  return {
    ...existing,
    // 새 Excel에 값이 있으면 기존 빈 값을 반드시 보강합니다.
    donorName: incoming.donorName || existing.donorName,
    idNumber: incoming.idNumber || existing.idNumber || '',
    address: incoming.address || existing.address || '',
    date: incoming.date || existing.date || '',
    period: incoming.period || existing.period,
    paymentMethod: incoming.paymentMethod || existing.paymentMethod || '계좌이체',
    donationType: incoming.donationType || existing.donationType,
    donationCode: incoming.donationCode || existing.donationCode,
    content: incoming.content || existing.content || '후원금',
    amount: Math.round(incoming.amount || existing.amount || 0),
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
  const profileIndex = new Map<string, number>();
  let duplicates = 0;

  for (const raw of existing) {
    const record = { ...raw, amount: Math.round(raw.amount || 0) };
    const exact = getDonationFingerprint(record);
    if (exactSeen.has(exact)) continue;
    exactSeen.add(exact);
    paymentIndex.set(getPaymentFingerprint(record), records.length);
    const profileKey = `${record.donorName.trim().toLowerCase()}|${(record.date || record.period || '').slice(0, 7)}|${Math.round(record.amount || 0)}`;
    if (!profileIndex.has(profileKey)) profileIndex.set(profileKey, records.length);
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
    let existingIndex = paymentIndex.get(paymentKey);

    // 기존 레코드의 주민번호/주소가 비어 있고 새 Excel에 값이 들어온 경우
    // 납부방법/내용이 달라도 '같은 이름 + 같은 월 + 같은 금액'을 보조키로 찾아 프로필을 보강합니다.
    if (existingIndex === undefined) {
      // 기존 자료가 파일명 월(예: 2026-08)만 저장되어 있었던 경우,
      // 새 Excel의 실제 후원일자(예: 2026-01-15)와 월이 달라 profileKey가 달라집니다.
      // 이 경우 이름/주민번호 + 금액 + 방법 + 내용으로 기존 건을 찾아
      // 주민번호·주소·정확한 후원일자를 보강합니다.
      const candidates = records.map((current, idx) => ({ current, idx }))
        .filter(({ current }) => samePersonAndPayment(current, normalized));
      if (candidates.length === 1) {
        existingIndex = candidates[0].idx;
      } else if (candidates.length > 1) {
        // 후보가 여러 개이면 동일 월 후보를 우선하고, 그래도 여러 개면 보강하지 않습니다.
        const incomingMonth = (normalized.date || normalized.period || '').slice(0, 7);
        const sameMonth = candidates.filter(({ current }) =>
          (current.date || current.period || '').slice(0, 7) === incomingMonth
        );
        if (sameMonth.length === 1) existingIndex = sameMonth[0].idx;
      }
    }

    if (existingIndex !== undefined) {
      const merged = enrich(records[existingIndex], normalized);
      records[existingIndex] = merged;
      updated.push(merged);
      exactSeen.add(getDonationFingerprint(merged));
      paymentIndex.set(getPaymentFingerprint(merged), existingIndex);
      const mergedProfileKey = `${merged.donorName.trim().toLowerCase()}|${(merged.date || merged.period || '').slice(0, 7)}|${Math.round(merged.amount || 0)}`;
      profileIndex.set(mergedProfileKey, existingIndex);
      duplicates += 1;
      continue;
    }

    exactSeen.add(exact);
    paymentIndex.set(paymentKey, records.length);
    const profileKey = `${normalized.donorName.trim().toLowerCase()}|${(normalized.date || normalized.period || '').slice(0, 7)}|${Math.round(normalized.amount || 0)}`;
    if (!profileIndex.has(profileKey)) profileIndex.set(profileKey, records.length);
    records.push(normalized);
    added.push(normalized);
  }

  return { records, added, updated, duplicates };
}
