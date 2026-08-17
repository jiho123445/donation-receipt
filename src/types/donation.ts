export interface RawDonationRecord {
  id: string;
  donorName: string;
  idNumber: string; // 주민등록번호 or 사업자등록번호 (e.g. 700101-1234567)
  address: string;
  date: string; // YYYY-MM-DD; 날짜가 없는 월별 자료는 빈 문자열일 수 있습니다.
  period?: string; // YYYY-MM; Excel 파일명에서 추정한 월별 관리 기간
  sourceKey?: string; // 동일 Excel의 동일 행을 재업로드할 때만 중복으로 인식하기 위한 안정적 행 키
  amount: number;
  paymentMethod: string; // 계좌이체, CMS, 현금 등
  donationType?: string; // 일반기부금, 지정기부금 등
  donationCode?: string; // e.g. 40
  content?: string; // 후원금, 장학후원 등
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

export interface IssuedReceiptRecord {
  receiptNo: string; // e.g., 2026-00001
  issueDate: string; // YYYY-MM-DD
  taxYear: number;
  formType: ReceiptFormType;
  
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
