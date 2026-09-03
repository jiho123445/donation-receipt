export interface RawDonationRecord {
  id: string;
  donorName: string;
  idNumber: string; // 주민등록번호 or 사업자등록번호 (e.g. 700101-1234567)
  address: string;
  date: string; // YYYY-MM-DD; 날짜가 없는 월별 자료는 빈 문자열일 수 있습니다.
  period?: string; // YYYY-MM; Excel 파일명에서 추정한 월별 관리 기간
  sourceRow?: number; // 원본 엑셀의 행 번호(참고/디버깅용) — 중복 판정에는 사용하지 않음
  amount: number;
  paymentMethod: string; // 계좌이체, CMS, 현금 등
  donationType?: string; // 일반기부금, 지정기부금 등
  donationCode?: string; // e.g. 40
  content?: string; // 후원금, 장학후원 등
  sourceFileHash?: string; // 이 레코드가 만들어진 원본 엑셀 파일의 SHA-256 해시(재업로드 시 이전 자료 교체용)
}

export interface DonorRecord {
  id: string; // unique donorKey
  donorName: string;
  idNumber: string;
  address: string;
  isBusiness?: boolean;
  phone?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface DonorGroup {
  donorKey: string; // unique key (e.g., name + idNumber or name + address)
  donorName: string;
  idNumber: string;
  address: string;
  isBusiness?: boolean;
  donations: RawDonationRecord[];
  years: number[];
  totalAllTime: number;
}

export interface OrganizationInfo {
  name: string; // 사단법인 너브내행복나눔재단
  representative: string; // 윤성일
  address: string; // 강원특별자치도 홍천군 홍천읍 송학로3길 26 2층
  tel: string; // 033-436-1925
  businessContent: string; // 사회복지사업
  // Statutory fields that MUST NOT be guessed - entered by admin
  registrationNo: string; // 고유번호 (e.g., 221-82-xxxxx)
  bizNo: string; // 사업자등록번호
  designationInfo: string; // 기부금단체 지정 관련 정보 / 근거법령
  donationType: string; // 기부금 유형 (예: 지정기부금 / 특례기부금 / 공익법인기부금)
  donationCode: string; // 기부금 코드 (예: 40)
  defaultContent: string; // 기본 기부내용 (기본값: 후원금)
  sealImage?: string; // Base64 data URL for uploaded seal or empty for vector seal
}

export type ReceiptFormType = 'individual' | 'corporate';

export type DocumentType = 'receipt' | 'membership';

export interface IssuedReceiptRecord {
  receiptNo: string; // e.g., 2026-00001
  issueDate: string; // YYYY-MM-DD
  taxYear: number;
  formType: ReceiptFormType;
  documentType?: DocumentType; // 'receipt'(기부금영수증, 기본값) | 'membership'(회비납부확인서)

  // Donor info
  donorName: string;
  donorIdNumber: string; // unmasked for printing, masked for log display
  donorAddress: string;
  isBusiness: boolean;

  // Donation info
  donations: RawDonationRecord[];
  totalAmount: number;
  amountInKorean: string; // e.g., 금 사십만원정
  
  // Snapshot of organization info at issuance time
  orgSnapshot: OrganizationInfo;

  // Status
  status: 'issued' | 'cancelled';
  createdAt: string;
  notes?: string;
}

export interface PrintSettings {
  offsetX: number; // in mm, -10 to +10
  offsetY: number; // in mm, -10 to +10
  scale: number; // in %, 95 to 105
}

/**
 * 회원 표창(수상) 내역 1건.
 * "OO년 사단법인 너브내행복나눔재단 표창명단"처럼 연번/성명 + 연도별 수상내역이
 * 가로로 나열된 명단(엑셀/PDF)을 세로 레코드 하나(연도 1개 + 수상내역 1건)로 정규화한 형태입니다.
 * 주민번호 등 식별번호가 없는 명단이므로 원칙적으로 "성명" 기준으로 조회합니다.
 */
export type MemberStatus = 'active' | 'inactive' | 'withdrawn' | 'exempt';
export type MemberType = 'regular' | 'executive' | 'sponsor' | 'honorary';

/** 상업용 회원관리 확장을 위한 회원 마스터. 기존 DonorRecord와 호환되도록 별도 컬렉션 members에 저장합니다. */
export interface MemberRecord {
  id: string;
  memberNo: string;
  name: string;
  donorId?: string;
  status: MemberStatus;
  memberType: MemberType;
  joinDate?: string;
  leaveDate?: string;
  feePolicy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 회원 표창(수상) 내역 1건.
 * memberId를 우선 연결하고, 기존 성명 기반 자료는 recipientName으로 하위 호환합니다.
 */
export interface AwardRecord {
  id: string;
  memberId?: string; // members 컬렉션의 고유 ID (신규/정정 자료는 반드시 연결 권장)
  recipientName: string;
  memberNo?: string;
  year: number;
  awardName: string;
  awardOrganization?: string;
  awardDate?: string;
  awardCategory?: string;
  eventName?: string;
  sourceLabel?: string;
  sourceRow?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogRecord {
  id?: string;
  actorUid: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT';
  collectionName: string;
  documentId?: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}
