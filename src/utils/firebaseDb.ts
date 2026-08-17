import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import type {
  OrganizationInfo,
  IssuedReceiptRecord,
  RawDonationRecord,
  DonorRecord,
} from '../types/donation';
import { db } from '../firebase';

export interface FirestoreConnectionStatus {
  connected: boolean;
  message: string;
  errorDetail?: string;
  code?: string;
}

/**
 * Firestore는 객체 안의 undefined 값을 허용하지 않습니다.
 * Excel에서 선택 열(period, donationType, donationCode 등)이 비어 있으면
 * 파서가 undefined를 만들 수 있으므로, 저장 직전에 undefined 속성을
 * 재귀적으로 제거합니다. null/0/false/빈 문자열은 그대로 보존합니다.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) return;
      result[key] = stripUndefined(item);
    });
    return result as T;
  }

  return value;
}

function requireDb(): Firestore {
  if (!db) {
    throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다. Firebase 환경변수 설정을 확인하세요.');
  }
  return db;
}

/**
 * 앱 구동 시 Firestore 연결 상태를 점검하고 명확한 상태/오류 정보를 반환합니다.
 */
export async function testFirestoreConnection(): Promise<FirestoreConnectionStatus> {
  if (!db) {
    return {
      connected: false,
      message: 'Firebase 환경설정이 비어있어 로컬 브라우저 모드로 동작합니다.',
    };
  }

  try {
    // getDocFromServer를 통해 실제 클라우드 Firestore 서버와의 통신을 테스트합니다.
    await getDocFromServer(doc(db, 'organizations', 'main'));
    return {
      connected: true,
      message: 'Cloud Firestore에 정상적으로 연결되었습니다.',
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || 'unknown';

    let userFriendlyMessage = 'Firestore 연결 중 문제가 발생했습니다.';
    if (errorMsg.includes('the client is offline') || errorCode === 'unavailable') {
      userFriendlyMessage = '인터넷 연결이 오프라인 상태이거나 Firestore 서버에 접속할 수 없습니다.';
    } else if (errorCode === 'permission-denied') {
      userFriendlyMessage = 'Firestore 보안 규칙에 의해 접근 권한이 제한되었습니다. (로그인이 필요하거나 firestore.rules 확인 필요)';
    } else if (errorCode === 'unauthenticated') {
      userFriendlyMessage = '로그인이 필요합니다. 관리자 계정으로 로그인 후 다시 시도해주세요.';
    }

    return {
      connected: false,
      message: userFriendlyMessage,
      errorDetail: errorMsg,
      code: errorCode,
    };
  }
}

/* ==========================================================================
   1. donors 컬렉션: 후원자 기본정보
   ========================================================================== */

export async function loadCloudDonors(): Promise<DonorRecord[]> {
  try {
    const snap = await getDocs(collection(requireDb(), 'donors'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<DonorRecord, 'id'>),
    }));
  } catch (error) {
    console.error('loadCloudDonors error:', error);
    throw error;
  }
}

export async function saveCloudDonor(donor: DonorRecord): Promise<void> {
  const donorId = donor.id || `${donor.donorName}_${donor.idNumber || donor.address}`.replace(/[\\/:*?"<>|]/g, '_');
  await setDoc(
    doc(requireDb(), 'donors', donorId),
    {
      ...donor,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function batchSaveCloudDonors(donors: DonorRecord[]): Promise<void> {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const now = new Date().toISOString();

  donors.forEach((donor) => {
    const donorId = donor.id || `${donor.donorName}_${donor.idNumber || donor.address}`.replace(/[\\/:*?"<>|]/g, '_');
    const ref = doc(firestore, 'donors', donorId);
    batch.set(ref, { ...donor, updatedAt: now }, { merge: true });
  });

  await batch.commit();
}

/* ==========================================================================
   2. donations 컬렉션: 후원금 납부내역
   ========================================================================== */

export async function loadCloudDonations(): Promise<RawDonationRecord[]> {
  try {
    const snap = await getDocs(collection(requireDb(), 'donations'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RawDonationRecord, 'id'>),
    }));
  } catch (error) {
    console.error('loadCloudDonations error:', error);
    throw error;
  }
}

export async function saveCloudDonation(donation: RawDonationRecord): Promise<void> {
  const docId = donation.id || `donation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await setDoc(doc(requireDb(), 'donations', docId), stripUndefined(donation), { merge: true });
}

export async function batchSaveCloudDonations(donations: RawDonationRecord[]): Promise<void> {
  const firestore = requireDb();
  // Firestore batch limit is 500 ops
  const chunks: RawDonationRecord[][] = [];
  for (let i = 0; i < donations.length; i += 400) {
    chunks.push(donations.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(firestore);
    chunk.forEach((d) => {
      const docId = d.id || `donation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ref = doc(firestore, 'donations', docId);
      batch.set(ref, stripUndefined(d), { merge: true });
    });
    await batch.commit();
  }
}

/* ==========================================================================
   3. receipts 컬렉션: 발급된 기부금영수증 기록
   ========================================================================== */

export async function loadCloudReceipts(): Promise<IssuedReceiptRecord[]> {
  try {
    const firestore = requireDb();
    // Primary: receipts collection
    let snap = await getDocs(collection(firestore, 'receipts'));
    
    // Fallback/Legacy: issuedReceipts collection if receipts is empty
    if (snap.empty) {
      snap = await getDocs(collection(firestore, 'issuedReceipts'));
    }

    return snap.docs
      .map((d) => d.data() as IssuedReceiptRecord)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch (error) {
    console.error('loadCloudReceipts error:', error);
    throw error;
  }
}

export async function saveCloudReceipt(receipt: IssuedReceiptRecord): Promise<void> {
  const firestore = requireDb();
  // Save to receipts collection
  await setDoc(doc(firestore, 'receipts', receipt.receiptNo), receipt);
  // Also sync to issuedReceipts for backwards compatibility
  try {
    await setDoc(doc(firestore, 'issuedReceipts', receipt.receiptNo), receipt);
  } catch (e) {
    console.warn('Sync to issuedReceipts failed:', e);
  }
}

export async function cancelCloudReceipt(receiptNo: string): Promise<void> {
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'receipts', receiptNo), { status: 'cancelled' });
  try {
    await updateDoc(doc(firestore, 'issuedReceipts', receiptNo), { status: 'cancelled' });
  } catch (e) {
    console.warn('Cancel on issuedReceipts failed:', e);
  }
}

export async function getNextCloudReceiptNumber(taxYear: number): Promise<string> {
  const firestore = requireDb();
  const counterRef = doc(firestore, 'counters', String(taxYear));
  return runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? Number(snap.data().lastSequence || 0) : 0;
    const next = current + 1;
    transaction.set(
      counterRef,
      { lastSequence: next, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return `${taxYear}-${String(next).padStart(5, '0')}`;
  });
}

/* ==========================================================================
   4. organizations 컬렉션: 단체 기본정보
   ========================================================================== */

export async function loadCloudOrganization(): Promise<OrganizationInfo | null> {
  try {
    const snap = await getDoc(doc(requireDb(), 'organizations', 'main'));
    return snap.exists() ? (snap.data() as OrganizationInfo) : null;
  } catch (error) {
    console.error('loadCloudOrganization error:', error);
    return null;
  }
}

export async function saveCloudOrganization(info: OrganizationInfo): Promise<void> {
  await setDoc(doc(requireDb(), 'organizations', 'main'), info, { merge: true });
}
