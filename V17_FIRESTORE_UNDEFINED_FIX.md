# V17 Firestore undefined 저장 오류 수정

## 수정 내용
- Firestore는 문서 필드에 `undefined` 값을 저장할 수 없어서 Excel 업로드 시 `period: undefined`가 포함된 문서를 `WriteBatch.set()`에 전달하면 `Unsupported field value: undefined` 오류가 발생하던 문제를 수정했습니다.
- `saveCloudDonation()`과 `batchSaveCloudDonations()` 저장 직전에 객체/배열을 재귀적으로 검사하여 `undefined` 필드만 제거합니다.
- `null`, `0`, `false`, 빈 문자열은 삭제하지 않습니다.
- 기존 Firebase 누적 데이터와 Excel 병합 로직은 유지합니다.

## 사용 방법
1. 기존 프로젝트 파일 전체를 이 압축본으로 교체합니다.
2. GitHub에 commit/push 합니다.
3. Vercel이 재배포되면 관리자 로그인 후 원본 Excel을 다시 업로드합니다.
4. `회원 명단 초기화`를 먼저 할 필요는 없습니다. 이미 Firebase에 저장된 자료는 유지됩니다.

## 기대 결과
`period`가 없는 Excel도 Firebase 저장 오류 없이 정상 업로드됩니다.
