# V20 — Firebase 후원내역 초기화 수정

- 기존 `화면 명단 초기화`가 React 화면 상태만 비우던 문제 수정
- 로그인된 Firebase 모드에서는 `donations` 컬렉션의 모든 문서를 실제로 삭제
- Firestore batch 500개 제한을 고려해 400개 단위 삭제
- `donors`, `receipts`, `issuedReceipts`, `organizations`, `counters`는 삭제하지 않음
- 클라우드 삭제 성공 후에만 화면 상태를 0건으로 초기화
- 삭제 실패 시 화면 상태를 유지하고 오류 표시
- 버튼/확인 문구를 실제 동작에 맞게 변경
