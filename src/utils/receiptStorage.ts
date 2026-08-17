import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/** 저장 경로/짧은 공유 링크용 ID로 안전하게 변환 (영문/숫자/하이픈/언더스코어만 허용) */
function sanitizeStorageId(id: string): string {
  const cleaned = (id || '').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'receipt';
}

export interface UploadReceiptPdfResult {
  /** Firebase Storage의 원본 다운로드 URL (토큰 포함, 매우 길어서 카카오톡 공유 링크로는 부적합) */
  downloadUrl: string;
  /** 저장 경로에 쓰인 짧은 ID (예: 발급번호). /api/r?id=... 형태의 짧은 공유 링크를 만들 때 사용합니다. */
  shortId: string;
}

/**
 * 생성된 영수증 PDF Blob을 Firebase Storage에 업로드하고
 * 다운로드 가능한 공개 URL(및 짧은 공유용 ID)을 반환합니다.
 *
 * 카카오톡 "공유하기"는 실제 파일을 첨부할 수 없고 링크만 전달할 수 있으므로,
 * 대화상대가 눌러서 PDF를 바로 확인/다운로드할 수 있도록 이 URL을 사용합니다.
 *
 * 저장 경로는 `receipts/<shortId>.pdf` (짧은 발급번호 기반, 한글/특수문자 없음)로
 * 고정되어 재전송 시 동일 파일을 덮어씁니다. 실제 다운로드 시 표시될 파일명은
 * Content-Disposition 헤더로 별도 지정합니다.
 *
 * shortId를 반환하는 이유: Firebase Storage 원본 다운로드 URL은 다운로드
 * 토큰 포함 + 한글 파일명 인코딩까지 겹치면 300~400자를 넘기는데, 카카오톡
 * 공유 링크는 이렇게 길면 무효 처리되어 눌러도 반응이 없습니다. shortId로
 * `/api/r?id=...` 형태의 짧은 리다이렉트 링크를 만들어 이 문제를 피합니다.
 */
export async function uploadReceiptPdfAndGetUrl(
  pdfBlob: Blob,
  fileName: string,
  storageId: string
): Promise<UploadReceiptPdfResult> {
  const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const shortId = sanitizeStorageId(storageId);
  const storageRef = ref(storage, `receipts/${shortId}.pdf`);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: 'application/pdf',
    contentDisposition: `inline; filename="${safeFileName}"`,
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, shortId };
}
