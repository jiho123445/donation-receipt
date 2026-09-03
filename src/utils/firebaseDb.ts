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
  AwardRecord,
  AuditLogRecord,
} from '../types/donation';
import { db } from '../firebase';
import { normalizeAwardRecord } from './awardCompatibility';

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

/**
 * 컬렉션 하나를 통째로 비웁니다 (Firestore 500개 배치 제한을 고려해 400개 단위로 삭제).
 *
 * v22: "초기화를 눌렀는데도 다음 업로드 때 예전 자료가 같이 남아있다"는 문제가
 * 보고되어, 한 번의 조회+삭제로 끝내지 않고 삭제 후 실제로 컬렉션이 비었는지
 * 다시 조회해서 확인하고, 혹시 문서가 남아있으면(대량 삭제 도중의 일시적 오류나
 * 새로 추가된 문서 등으로) 다시 지우기를 반복합니다. "진짜 0건이 될 때까지" 확인하는
 * 방식이라 deleteAllCloudDonations/deleteAllImportedFileRecords/deleteAllCloudAwards가
 * 모두 이 함수를 공유합니다.
 */
async function deleteAllDocsInCollection(collectionPath: string): Promise<number> {
  const firestore = requireDb();
  let deleted = 0;
  const MAX_ATTEMPTS = 8;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const snap = await getDocs(collection(firestore, collectionPath));
    if (snap.empty) return deleted;

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = writeBatch(firestore);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += chunk.length;
    }
  }

  // 여기까지 왔다는 건 MAX_ATTEMPTS번을 반복해서 지워도 계속 문서가 남아있다는
  // 뜻입니다. 정상적인 상황이 아니므로("완료됐다"고 조용히 넘어가지 않고)
  // 실제로 몇 건이 남아있는지 마지막으로 다시 확인해서 명확한 오류로 알려줍니다.
  // (예: 다른 탭/기기에서 동시에 같은 파일을 업로드하고 있는 경우 등)
  const finalCheck = await getDocs(collection(firestore, collectionPath));
  if (!finalCheck.empty) {
    throw new Error(
      `"${collectionPath}" 컬렉션을 ${MAX_ATTEMPTS}번 반복해서 삭제를 시도했지만, 여전히 ${finalCheck.size.toLocaleString()}건이 남아있습니다. 다른 브라우저 탭이나 다른 사람이 동시에 같은 자료를 업로드하고 있지 않은지 확인 후 다시 시도해주세요.`
    );
  }

  return deleted;
}

/**
 * 관리자용 후원내역 전체 초기화.
 * donations 컬렉션의 모든 문서를 삭제하며 donors/receipts/issuedReceipts 등
 * 다른 컬렉션은 건드리지 않습니다.
 */
export async function deleteAllCloudDonations(): Promise<number> {
  return deleteAllDocsInCollection('donations');
}

/* ==========================================================================
   2-1. importedFiles 컬렉션: "같은 파일을 실수로 두 번 올렸는지" 확인용
   (행 단위 내용 추측 대신, 파일 전체 해시로 명확하게 확인 — donationDedup.ts 참고)
   ========================================================================== */

export interface ImportedFileRecord {
  fileName: string;
  rowCount: number;
  importedAt: string;
}

export async function checkFileAlreadyImported(fileHash: string): Promise<ImportedFileRecord | null> {
  try {
    const snap = await getDoc(doc(requireDb(), 'importedFiles', fileHash));
    return snap.exists() ? (snap.data() as ImportedFileRecord) : null;
  } catch (error) {
    // 조회 자체가 실패해도 업로드를 막지는 않습니다.
    // (중복 여부를 몰라서 정상 업로드를 막는 것보다, 안내 없이 통과시키는 편이 안전합니다)
    console.error('checkFileAlreadyImported error:', error);
    return null;
  }
}

export async function recordFileImport(fileHash: string, fileName: string, rowCount: number): Promise<void> {
  await setDoc(doc(requireDb(), 'importedFiles', fileHash), {
    fileName,
    rowCount,
    importedAt: new Date().toISOString(),
  });
}

/**
 * "회원 명단 초기화"(deleteAllCloudDonations) 시 함께 호출해야 하는 함수입니다.
 *
 * importedFiles 컬렉션은 donations를 지워도 같이 지워지지 않는 별도 컬렉션이라,
 * 이걸 비우지 않으면 "후원내역은 이미 0건으로 초기화됐는데, 초기화 전에 올렸던
 * 파일을 다시 올리면 '이미 가져온 파일입니다 (OOO건 가져옴)'라는 예전 안내가
 * 그대로 다시 뜨는" 문제가 생깁니다. 실제로는 donations가 비어 있어 다시 가져와도
 * 문제가 없는데도, 이 예전 기록 때문에 마치 초기화가 안 된 것처럼 보이는 것입니다.
 */
export async function deleteAllImportedFileRecords(): Promise<number> {
  return deleteAllDocsInCollection('importedFiles');
}

/* ==========================================================================
   2-2. awards 컬렉션: 회원 표창(수상) 내역
   (연번/성명 + 연도별 컬럼으로 된 표창명단을 성명+연도+수상내역 단위로 정규화해 저장합니다.
    donations와 마찬가지로 개인정보가 섞인 원본은 브라우저 localStorage에는 저장하지 않습니다.)
   ========================================================================== */

export async function loadCloudAwards(): Promise<AwardRecord[]> {
  try {
    const snap = await getDocs(collection(requireDb(), 'awards'));
    return snap.docs.map((d) =>
      normalizeAwardRecord(
        { id: d.id, ...(d.data() as Record<string, unknown>) },
        d.id
      )
    );
  } catch (error) {
    console.error('loadCloudAwards error:', error);
    throw error;
  }
}

export async function batchSaveCloudAwards(awards: AwardRecord[]): Promise<void> {
  const firestore = requireDb();
  const chunks: AwardRecord[][] = [];
  for (let i = 0; i < awards.length; i += 400) {
    chunks.push(awards.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(firestore);
    chunk.forEach((a) => {
      const docId = a.id || `award_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ref = doc(firestore, 'awards', docId);
      batch.set(ref, stripUndefined(a), { merge: true });
    });
    await batch.commit();
  }
}

/**
 * 관리자용 수상내역 전체 초기화. awards 컬렉션만 삭제하며 다른 컬렉션은 건드리지 않습니다.
 */
export async function deleteAllCloudAwards(): Promise<number> {
  return deleteAllDocsInCollection('awards');
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

// 발급취소(무효화)와 달리, 이 함수는 receipts / issuedReceipts 컬렉션에서 문서 자체를
// 완전히 삭제합니다. 테스트로 발급한 내역을 흔적 없이 지우고 싶을 때 사용합니다.
export async function deleteCloudReceipt(receiptNo: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const firestore = requireDb();
  // receipts는 주 컬렉션이므로 여기서 실패하면(예: 보안규칙 권한 거부) 에러를 그대로
  // 위로 던져서, 호출한 쪽(App.tsx)이 "삭제된 것처럼" 착각하지 않고 사용자에게
  // 실패를 알릴 수 있도록 합니다.
  await deleteDoc(doc(firestore, 'receipts', receiptNo));
  // issuedReceipts는 과거 호환용 보조 컬렉션이라, 여기서 실패해도(예: 애초에 문서가
  // 없던 경우) 전체 삭제를 실패로 처리하지 않습니다.
  try {
    await deleteDoc(doc(firestore, 'issuedReceipts', receiptNo));
  } catch (e) {
    console.warn('Delete on issuedReceipts failed:', e);
  }
}

export async function getNextCloudReceiptNumber(
  taxYear: number,
  kind: 'receipt' | 'membership' = 'receipt'
): Promise<string> {
  const firestore = requireDb();
  const prefix = kind === 'membership' ? 'MEM-' : '';
  const counterDocId = kind === 'membership' ? `${taxYear}_membership` : String(taxYear);
  const counterRef = doc(firestore, 'counters', counterDocId);
  return runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? Number(snap.data().lastSequence || 0) : 0;
    const next = current + 1;
    transaction.set(
      counterRef,
      { lastSequence: next, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return `${prefix}${taxYear}-${String(next).padStart(5, '0')}`;
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


/* ==========================================================================
   6. auditLogs 컬렉션: 변경 이력
   Firestore Rules에서 일반 사용자의 직접 접근을 막고 관리자 서버/관리자 UI만
   기록하도록 확장할 수 있는 호환용 함수입니다.
   ========================================================================== */
export async function saveAuditLog(log: Omit<AuditLogRecord, 'id' | 'createdAt'> & { createdAt?: string }): Promise<string> {
  const firestore = requireDb();
  const ref = doc(collection(firestore, 'auditLogs'));
  const payload: AuditLogRecord = {
    ...log,
    id: ref.id,
    createdAt: log.createdAt || new Date().toISOString(),
  };
  await setDoc(ref, stripUndefined(payload));
  return ref.id;
}

// ===== 회원 마스터 관리 =====
export async function loadCloudMembers(): Promise<import('../types/donation').MemberRecord[]> {
  const snapshot = await getDocs(collection(requireDb(), 'members'));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<import('../types/donation').MemberRecord,'id'>) }));
}
export async function saveCloudMember(member: import('../types/donation').MemberRecord): Promise<void> {
  const ref = doc(requireDb(), 'members', member.id);
  await setDoc(ref, stripUndefined(member));
}
export async function deleteCloudMember(id: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(requireDb(), 'members', id));
}
