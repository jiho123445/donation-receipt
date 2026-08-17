# V19 Clean Import Test Fix

## 목적
Firebase `donations` 컬렉션을 비운 상태에서 실제 Excel을 다시 업로드할 때 Excel의 모든 유효 행이 1:1로 Firestore 문서가 되는지 검증하기 위한 버전입니다.

## 핵심 수정
- fingerprint 해시만으로 새 문서 ID를 만들지 않습니다.
- `sourceKey`가 있는 Excel 행은 `sourceKey` 기반의 고유 ID를 사용합니다.
- `sourceKey`가 없는 새 행은 랜덤 고유 ID를 사용합니다.
- 같은 내용의 Excel 행이 여러 개 있어도 incoming 내부에서 제거하지 않습니다.
- 기존 자료와 동일한 행을 다시 올릴 때만 중복으로 제외합니다.
- Firestore 저장 직전 undefined 필드는 제거합니다.

## 테스트 순서
1. Firebase Firestore의 `donations` 컬렉션을 비운다.
2. 앱을 새로 배포한다.
3. 실제 Excel 1개를 업로드한다.
4. 화면의 `엑셀에서 읽음`, `신규 저장`, `처리 후 누적` 숫자를 비교한다.
5. 세 숫자가 예상한 행 수와 일치하는지 확인한다.
6. 같은 Excel을 다시 올렸을 때 신규 저장이 0건이고 누적 건수가 변하지 않는지 확인한다.
