import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * 생성된 영수증 PDF Blob을 Firebase Storage에 업로드하고
 * 다운로드 가능한 공개 URL을 반환합니다.
 *
 * 카카오톡 "공유하기"는 실제 파일을 첨부할 수 없고 링크만 전달할 수 있으므로,
 * 대화상대가 눌러서 PDF를 바로 확인/다운로드할 수 있도록 이 URL을 사용합니다.
 *
 * 발급번호 기반 경로에 업로드되므로 재전송 시 동일 파일을 덮어씁니다.
 */
export async function uploadReceiptPdfAndGetUrl(pdfBlob: Blob, fileName: string): Promise<string> {
  const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const storageRef = ref(storage, `receipts/${safeFileName}`);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: 'application/pdf',
    contentDisposition: `inline; filename="${safeFileName}"`,
  });

  return getDownloadURL(storageRef);
}
