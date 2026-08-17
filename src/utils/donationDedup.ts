import type { RawDonationRecord } from '../types/donation';

/**
 * v19 후원내역 병합 규칙
 *
 * 핵심 원칙
 * 1. Excel의 유효한 각 행은 1개의 후원건으로 취급합니다.
 * 2. 동일 Excel의 서로 다른 행은 절대로 같은 Firestore 문서 ID를 공유하지 않습니다.
 * 3. 같은 파일을 다시 업로드하면 sourceKey(파일+시트+행번호 기반)로 기존 행을 찾습니다.
 * 4. sourceKey가 없는 구버전 자료는 내용 fingerprint의 '개수'로 보조 중복처리합니다.
 * 5. incoming 안에서는 중복 제거를 하지 않습니다. 같은 내용의 행 3개도 3건입니다.
 * 6. 새 행의 ID는 sourceKey가 있으면 sourceKey 기반으로, 없으면 고유 랜덤 ID로 만듭니다.
 *    기존 버전처럼 fingerprint 해시만으로 ID를 만들면 완전히 동일한 두 행이 같은 문서를
 *    덮어쓰는 문제가 생길 수 있으므로 절대 fingerprint만으로 새 문서 ID를 만들지 않습니다.
 */

function norm(value?: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normId(value?: string): string {
  return norm(value).replace(/[-\s]/g, '');
}

function getIdentity(record: RawDonationRecord): string {
  const id = normId(record.idNumber);
  if (id) return `id:${id}`;

  const address = norm(record.address);
  if (address) return `address:${address}`;

  return `name:${norm(record.donorName)}`;
}

function getPaymentFingerprint(record: RawDonationRecord): string {
  const dateKey = record.date?.trim()
    ? `date:${record.date.trim()}`
    : `period:${record.period?.trim() || ''}`;

  return [
    norm(record.donorName),
    getIdentity(record),
    dateKey,
    Math.round(Number(record.amount || 0)),
    norm(record.paymentMethod),
    norm(record.content),
  ].join('|');
}

function sanitizeRecord(raw: RawDonationRecord): RawDonationRecord {
  const cleaned: RawDonationRecord = {
    ...raw,
    id: raw.id ? String(raw.id) : undefined,
    donorName: String(raw.donorName || '').trim(),
    idNumber: String(raw.idNumber || '').trim(),
    address: String(raw.address || '').trim(),
    date: String(raw.date || '').trim(),
    period: raw.period ? String(raw.period).trim() : undefined,
    amount: Math.round(Number(raw.amount || 0)),
    paymentMethod: String(raw.paymentMethod || '').trim(),
    content: String(raw.content || '').trim(),
  };
  return cleaned;
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 새 Firestore 문서에 사용할 ID.
 * sourceKey가 있으면 같은 Excel의 같은 행을 재업로드할 때 같은 ID를 사용하고,
 * sourceKey가 없으면 매번 고유 ID를 생성합니다.
 */
export function getStableDonationId(record: RawDonationRecord): string {
  if (record.id) return record.id;
  if (record.sourceKey) return `donation_${hashText(`source:${record.sourceKey}`)}`;
  return `donation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getDonationFingerprint(record: RawDonationRecord): string {
  return getPaymentFingerprint(record);
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
  const added: RawDonationRecord[] = [];
  const updated: RawDonationRecord[] = [];
  let duplicates = 0;

  const existingSourceKeys = new Set<string>();
  const availableByFingerprint = new Map<string, number>();

  for (const raw of existing) {
    const record = sanitizeRecord(raw);
    if (record.sourceKey) existingSourceKeys.add(record.sourceKey);

    const fp = getPaymentFingerprint(record);
    availableByFingerprint.set(fp, (availableByFingerprint.get(fp) || 0) + 1);

    records.push({
      ...record,
      id: record.id || getStableDonationId(record),
    });
  }

  for (const raw of incoming) {
    const normalized = sanitizeRecord(raw);

    // 같은 Excel 파일의 같은 행을 다시 업로드한 경우.
    if (normalized.sourceKey && existingSourceKeys.has(normalized.sourceKey)) {
      duplicates += 1;
      continue;
    }

    // 구버전/파일명 변경 자료에 대한 보조 중복 처리.
    const fp = getPaymentFingerprint(normalized);
    const available = availableByFingerprint.get(fp) || 0;
    if (available > 0) {
      availableByFingerprint.set(fp, available - 1);
      duplicates += 1;
      continue;
    }

    // 중요: incoming 내부에서는 dedup하지 않습니다.
    // 각 행은 반드시 고유 Firestore ID를 가집니다.
    const withId: RawDonationRecord = {
      ...normalized,
      id: getStableDonationId(normalized),
    };

    records.push(withId);
    added.push(withId);
  }

  return { records, added, updated, duplicates };
}
