# PDF 속도 + A4 위치 수정

- PDF 생성용 전용 A4 clone을 만들어 preview zoom/인쇄 위치설정/`mx-auto`의 영향을 차단했습니다.
- 캡처 영역을 210mm × 297mm로 고정했습니다.
- 렌더링 배율을 1.5로 낮춰 속도를 개선했습니다.
- PNG Data URL 대신 JPEG 95% 품질로 PDF에 삽입해 PDF 생성량을 줄였습니다.
- 저장 위치 선택(`showSaveFilePicker`)은 유지합니다.
