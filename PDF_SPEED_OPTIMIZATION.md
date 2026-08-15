# PDF 저장 속도 최적화 — 2차 수정

이번 버전은 실제 소스 구조를 다시 확인한 뒤 PDF 생성 경로에서 시간이 걸릴 가능성이 큰 두 부분을 수정했습니다.

## 1. html-to-image `cacheBust` 비활성화
기존에는 `cacheBust: true`였습니다. 이 옵션은 이미지/리소스 URL에 캐시 무효화용 값을 붙여 매번 새로 가져오게 만들 수 있습니다. 영수증의 직인 이미지 등이 이미 브라우저에 로드되어 있으므로 `false`로 변경했습니다.

## 2. `toPng()` → `toCanvas()`
기존에는 DOM → Canvas → PNG data URL 과정을 거쳤습니다. 이번에는 DOM → Canvas까지 만든 뒤 canvas를 jsPDF에 직접 전달합니다. 불필요한 PNG data URL 생성/변환 단계를 줄입니다.

## 유지되는 기능
- A4 PDF
- 영수증 디자인
- 저장 위치 선택(`showSaveFilePicker`)
- 파일명 지정
- 인쇄 기능
- Firebase/Firestore/Auth 기능

## 정확한 성능 판단
16~17초가 실제 PDF 생성 시간이라면 이번 수정으로 개선될 가능성이 있습니다. 다만 실제 개선 폭은 브라우저/PC/직인 이미지 크기/DOM 렌더링 상황에 따라 달라지므로 배포 전에는 개선 시간을 확정할 수 없습니다.
