import type { AwardRecord } from '../types/donation';

type AnyRecord = Record<string, unknown>;

const text = (v: unknown): string => v == null ? '' : String(v).trim();

export function extractAwardYear(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const y = Math.trunc(value);
    if (y >= 1900 && y <= 2100) return y;
  }
  const s = text(value);
  const m = s.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}

export function getAwardYear(a: Partial<AwardRecord> | AnyRecord): number {
  const r = a as AnyRecord;
  const candidates = [
    r.year, r.awardYear, r.award_date, r.awardDate, r.date,
    r.awardedAt, r.receivedAt, r.eventDate, r.eventName, r.awardName, r.title
  ];
  for (const v of candidates) {
    const y = extractAwardYear(v);
    if (y) return y;
  }
  return 0;
}

export function getAwardRecipientName(a: Partial<AwardRecord> | AnyRecord): string {
  const r = a as AnyRecord;
  const candidates = [
    r.recipientName, r.memberName, r.name, r.recipient,
    r.personName, r.winnerName, r.donorName
  ];
  for (const v of candidates) {
    const s = text(v);
    if (s) return s;
  }
  return '';
}

export function getAwardName(a: Partial<AwardRecord> | AnyRecord): string {
  const r = a as AnyRecord;
  const candidates = [
    r.awardName, r.title, r.awardTitle, r.award,
    r.prizeName, r.citation, r.awardType
  ];
  for (const v of candidates) {
    const s = text(v);
    if (s) return s;
  }
  return '';
}

export function getAwardOrganization(a: Partial<AwardRecord> | AnyRecord): string {
  const r = a as AnyRecord;
  const candidates = [
    r.awardOrganization, r.organization, r.issuer,
    r.awardingBody, r.grantor, r.institution
  ];
  for (const v of candidates) {
    const s = text(v);
    if (s) return s;
  }
  return '';
}

export function normalizeAwardRecord(raw: Partial<AwardRecord> | AnyRecord, fallbackId = ''): AwardRecord {
  const r = raw as AnyRecord;
  const year = getAwardYear(r);
  const recipientName = getAwardRecipientName(r);
  const awardName = getAwardName(r);
  const awardOrganization = getAwardOrganization(r);
  return {
    id: text(r.id) || fallbackId,
    memberId: text(r.memberId) || undefined,
    memberNo: text(r.memberNo || r.memberNumber) || undefined,
    recipientName,
    year,
    awardName,
    awardOrganization: awardOrganization || undefined,
    awardDate: text(r.awardDate || r.date || r.awardedAt || r.receivedAt) || undefined,
    awardCategory: text(r.awardCategory || r.category) || undefined,
    eventName: text(r.eventName || r.event || r.programName) || undefined,
    sourceLabel: text(r.sourceLabel || r.source) || undefined,
    sourceRow: typeof r.sourceRow === 'number' ? r.sourceRow : undefined,
    createdAt: text(r.createdAt) || undefined,
    updatedAt: text(r.updatedAt) || undefined,
  };
}
