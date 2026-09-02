# V8 Firebase 기존 데이터 로딩 수정

## 수정 내용
- App.tsx의 초기 Firebase 로딩을 Promise.all에서 Promise.allSettled로 변경했습니다.
- receipts, organizations, members 중 하나가 읽기 실패해도 donations와 awards까지 함께 0건이 되는 문제를 차단했습니다.
- 기존 Firebase의 donations 컬렉션은 독립적으로 정상 로드합니다.
- 기존 Firebase의 awards 컬렉션은 독립적으로 정상 로드합니다.
- loadCloudMembers() 결과를 실제 members 상태에 반영하도록 수정했습니다.
- 일부 컬렉션 실패 시 실패 컬렉션을 상태 메시지에 표시하도록 변경했습니다.

## Firebase 작업
기존 데이터는 삭제하지 마세요. Firebase에서 컬렉션 구조를 변경할 필요도 없습니다.

현재 유지할 컬렉션:
- admins
- awards
- counters
- donations
- donors
- importedFiles
- issuedReceipts
- organizations
- receipts
- members (없어도 앱은 동작)

## 배포
이 ZIP의 내용을 기존 GitHub 프로젝트에 덮어쓴 뒤 커밋/푸시하고 Vercel 재배포 후 확인하세요.
