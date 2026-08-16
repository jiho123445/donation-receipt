import type { RawDonationRecord } from '../types/donation';

/**
 * 후원내역 중복 제거/보강 유틸리티
 *
 * 핵심 원칙:
 * 1) 서로 다른 후원건을 절대로 '월 + 금액'만으로 병합하지 않습니다.
 * 2) 정확한 후원일자가 있으면 반드시 날짜까지 식별키에 포함합니다.
 * 3) 같은 날짜/금액의 후원도 별도 행으로 존재할 수 있으므로,
 *    기존 자료와 새 자료를 보강할 때는 후보가 정확히 1개일 때만 병합합니다.
 * 4) 후보가 여러 개이거나 식별이 불확실하면 새 레코드를 그대로 보존합니다.
 *
 * v14: 같은 달에 동일 금액을 여러 번 납부한 경우 한 건으로 합쳐지던
 * 데이터 손실 버그를 수정했습니다.
 */

function norm(value?: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normId(value?: string): string {
  return norm(value).replace(/[-\s]/g, '');
}

function normAddress(value?: string): string {
  return norm(value);
}

/** 후원자 식별 우선순위: 주민/사업자번호 → 주소 → 이름 */
function getIdentity(record: RawDonationRecord): string {
  const id = normId(record.idNumber);
  if (id) return `id:${id}`;

  const address = normAddress(record.address);
  if (address) return `address:${address}`;

  return `name:${norm(record.donorName)}`;
}

/**
 * 완전히 동일한 납부행인지 판단하는 키입니다.
 * 정확한 날짜가 있으면 YYYY-MM-DD를 사용하고,
 * 날짜가 없는 월별 자료만 YYYY-MM을 사용합니다.
 */
export function getDonationFingerprint(record: RawDonationRecord): string {
  const dateKey = record.date?.trim()
    ? `date:${record.date.trim()}`
    : `period:${record.period?.trim() || ''}`;

  return [
    norm(record.donorName),
    getIdentity(record),
    dateKey,
    Math.round(record.amount || 0),
    norm(record.paymentMethod),
    norm(record.content),
  ].join('|');
}

/**
 * 프로필 보강 후보를 찾기 위한 보조 키입니다.
 *
 * 중요: 기존 v13의 '월 + 금액 + 방법 + 내용' 키는 같은 달에 같은 금액을
 * 두 번 납부한 정상적인 후원건까지 하나로 합치는 원인이었습니다.
 * 따라서 정확한 날짜가 있으면 날짜를 반드시 포함합니다.
 */
function getPaymentFingerprint(record: RawDonationRecord): string {
  const dateKey = record.date?.trim()
    ? `date:${record.date.trim()}`
    : `period:${record.period?.trim() || ''}`;

  return [
    getIdentity(record),
    norm(record.donorName),
    dateKey,
    Math.round(record.amount || 0),
    norm(record.paymentMethod),
    norm(record.content),
  ].join('|');
}

/**
 * 기존 레코드와 incoming이 같은 납부건의 '정보 보강' 후보인지 판단합니다.
 * 날짜가 둘 다 정확히 있으면 반드시 같은 날짜여야 합니다.
 */
function samePersonAndPayment(existing: RawDonationRecord, incoming: RawDonationRecord): boolean {
  const existingId = normId(existing.idNumber);
  const incomingId = normId(incoming.idNumber);

  if (existingId && incomingId && existingId !== incomingId) return false;

  const sameName = norm(existing.donorName) === norm(incoming.donorName);
  if (!sameName) return false;

  // 식별번호가 없는 동명이인은 주소가 둘 다 있을 때 주소가 일치해야 합니다.
  if (!existingId && !incomingId) {
    const existingAddr = normAddress(existing.address);
    const incomingAddr = normAddress(incoming.address);
    if (existingAddr && incomingAddr && existingAddr !== incomingAddr) return false;
  }

  if (Math.round(existing.amount || 0) !== Math.round(incoming.amount || 0)) return false;

  const existingPayment = norm(existing.paymentMethod);
  const incomingPayment = norm(incoming.paymentMethod);
  if (existingPayment && incomingPayment && existingPayment !== incomingPayment) return false;

  const existingContent = norm(existing.content);
  const incomingContent = norm(incoming.content);
  if (existingContent && incomingContent && existingContent !== incomingContent) return false;

  // 정확한 날짜가 양쪽 모두 있으면 반드시 동일한 날짜여야 합니다.
  if (existing.date && incoming.date && existing.date !== incoming.date) return false;

  // 날짜가 한쪽만 정확한 경우에만 '기존 자료 보강'을 허용합니다.
  if (existing.date && !incoming.date) {
    if (incoming.period && existing.date.slice(0, 7) !== incoming.period) return false;
    return !!incoming.period;
  }

  if (!existing.date && incoming.date) {
    if (existing.period && incoming.date.slice(0, 7) !== existing.period) return false;
    return true;
  }

  if (!existing.date && !incoming.date) {
    return !!existing.period && !!incoming.period && existing.period === incoming.period;
  }

  return false;
}

function enrich(existing: RawDonationRecord, incoming: RawDonationRecord): RawDonationRecord {
  return {
    ...existing,
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

/**
 * Firestore 문서 ID.
 * 정확한 날짜가 있는 자료는 날짜까지 포함하므로 같은 달의 서로 다른 후원건이
 * 동일 문서 ID를 생성하지 않습니다.
 */
export function getStableDonationId(record: RawDonationRecord): string {
  const input = getDonationFingerprint(record);
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
): {
  records: RawDonationRecord[];
  added: RawDonationRecord[];
  updated: RawDonationRecord[];
  duplicates: number;
} {
  const records: RawDonationRecord[] = [];
  const exactSeen = new Set<string>();
  const paymentIndex = new Map<string, number[]>();
  let duplicates = 0;

  const addPaymentIndex = (record: RawDonationRecord, index: number) => {
    const key = getPaymentFingerprint(record);
    const list = paymentIndex.get(key) || [];
    if (!list.includes(index)) list.push(index);
    paymentIndex.set(key, list);
  };

  for (const raw of existing) {
    const record: RawDonationRecord = {
      ...raw,
      id: raw.id || getStableDonationId(raw),
      donorName: String(raw.donorName || '').trim(),
      idNumber: String(raw.idNumber || '').trim(),
      address: String(raw.address || '').trim(),
      date: raw.date || '',
      period: raw.period || undefined,
      amount: Math.round(raw.amount || 0),
      paymentMethod: raw.paymentMethod || '',
      content: raw.content || '',
    };

    const exact = getDonationFingerprint(record);

    // 기존 데이터 자체에 완전 중복이 있으면 하나만 유지합니다.
    if (exactSeen.has(exact)) continue;

    exactSeen.add(exact);
    addPaymentIndex(record, records.length);
    records.push(record);
  }

  const added: RawDonationRecord[] = [];
  const updated: RawDonationRecord[] = [];

  for (const raw of incoming) {
    const normalized: RawDonationRecord = {
      ...raw,
      idNumber: String(raw.idNumber || '').trim(),
      address: String(raw.address || '').trim(),
      date: raw.date || '',
      period: raw.period || undefined,
      amount: Math.round(raw.amount || 0),
      paymentMethod: String(raw.paymentMethod || '').trim(),
      content: String(raw.content || '').trim(),
    };

    const exact = getDonationFingerprint(normalized);

    // 완전히 같은 납부행만 중복으로 제외합니다.
    if (exactSeen.has(exact)) {
      duplicates += 1;
      continue;
    }

    const paymentKey = getPaymentFingerprint(normalized);
    const indexedCandidates = paymentIndex.get(paymentKey) || [];
    let existingIndex: number | undefined;

    // 동일 fingerprint가 기존에 정확히 1건일 때만 프로필 보강을 시도합니다.
    // 2건 이상이면 어느 행인지 확정할 수 없으므로 병합하지 않습니다.
    if (indexedCandidates.length === 1) {
      const candidateIndex = indexedCandidates[0];
      if (samePersonAndPayment(records[candidateIndex], normalized)) {
        existingIndex = candidateIndex;
      }
    }

    // 기존 자료가 월만 기록되어 있고 새 Excel에 정확한 날짜/프로필이 들어온
    // 경우에도 후보가 정확히 1개일 때만 보강합니다.
    if (existingIndex === undefined) {
      const candidates = records
        .map((current, idx) => ({ current, idx }))
        .filter(({ current }) => samePersonAndPayment(current, normalized));

      if (candidates.length === 1) {
        existingIndex = candidates[0].idx;
      }
    }

    if (existingIndex !== undefined) {
      const oldRecord = records[existingIndex];
      const oldExact = getDonationFingerprint(oldRecord);
      const merged = enrich(oldRecord, normalized);
      const mergedExact = getDonationFingerprint(merged);

      // 병합 결과가 다른 기존 레코드와 충돌하면 병합하지 않습니다.
      if (mergedExact !== oldExact && exactSeen.has(mergedExact)) {
        existingIndex = undefined;
      } else {
        records[existingIndex] = merged;
        exactSeen.delete(oldExact);
        exactSeen.add(mergedExact);
        addPaymentIndex(merged, existingIndex);
        updated.push(merged);
        duplicates += 1;
      }
    }

    if (existingIndex === undefined) {
      // 기존 레코드와 식별 가능한 중복이 아니므로 반드시 별도 후원건으로 보존합니다.
      const withId: RawDonationRecord = {
        ...normalized,
        id: normalized.id || getStableDonationId(normalized),
      };

      exactSeen.add(getDonationFingerprint(withId));
      addPaymentIndex(withId, records.length);
      records.push(withId);
      added.push(withId);
    }
  }

  return { records, added, updated, duplicates };
}
