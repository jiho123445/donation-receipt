# PDF 저장 속도 최적화 안내

이번 수정은 기부금영수증의 PDF 저장 속도를 개선하기 위한 보수적인 변경입니다.

변경 사항
- `src/utils/pdfExport.ts`의 HTML → PNG 렌더링 배율을 `pixelRatio: 3`에서 `2`로 조정했습니다.
- 루트의 `pdfExport.ts`도 동일하게 맞췄습니다.
- PDF 형식은 기존 A4 / PNG / jsPDF 방식을 유지했습니다.
- `showSaveFilePicker()`의 저장 위치 선택 기능은 유지했습니다.
- 인쇄 기능은 변경하지 않았습니다.
- PDF Blob URL을 사용하는 다운로드 fallback에는 URL 정리(revoke)를 추가했습니다.

주의
- 실제 체감 속도 개선 정도는 브라우저, PC 성능, 영수증 DOM 크기에 따라 달라질 수 있습니다.
- 이번 버전은 품질 저하 위험을 줄이기 위해 JPEG 변환은 적용하지 않았습니다.
