import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import type { OrganizationInfo, IssuedReceiptRecord } from '../types/donation';
import { db } from '../firebase';

function requireDb(): Firestore {
  if (!db) throw new Error('Firebase가 설정되지 않았습니다.');
  return db;
}

export async function loadCloudOrganization(): Promise<OrganizationInfo | null> {
  const snap = await getDoc(doc(requireDb(), 'organizations', 'main'));
  return snap.exists() ? (snap.data() as OrganizationInfo) : null;
}

export async function saveCloudOrganization(info: OrganizationInfo): Promise<void> {
  await setDoc(doc(requireDb(), 'organizations', 'main'), info, { merge: true });
}

export async function loadCloudReceipts(): Promise<IssuedReceiptRecord[]> {
  const snap = await getDocs(collection(requireDb(), 'issuedReceipts'));
  return snap.docs
    .map((d) => d.data() as IssuedReceiptRecord)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveCloudReceipt(receipt: IssuedReceiptRecord): Promise<void> {
  await setDoc(doc(requireDb(), 'issuedReceipts', receipt.receiptNo), receipt);
}

export async function cancelCloudReceipt(receiptNo: string): Promise<void> {
  await updateDoc(doc(requireDb(), 'issuedReceipts', receiptNo), { status: 'cancelled' });
}

export async function getNextCloudReceiptNumber(taxYear: number): Promise<string> {
  const firestore = requireDb();
  const counterRef = doc(firestore, 'counters', String(taxYear));
  return runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? Number(snap.data().lastSequence || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { lastSequence: next, updatedAt: new Date().toISOString() }, { merge: true });
    return `${taxYear}-${String(next).padStart(5, '0')}`;
  });
}
