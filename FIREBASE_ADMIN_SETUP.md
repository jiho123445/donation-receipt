# Firebase 관리자 권한 설정
1. Firebase Authentication에서 실제 관리자 UID를 확인합니다.
2. Firestore `admins` 컬렉션에 문서 ID를 관리자 UID로 생성합니다.
3. 예: `role: "admin"`
4. `firestore.rules`를 배포합니다.
5. 관리자 계정으로 다시 로그인하여 연결을 확인합니다.

클라이언트에서는 admins 문서를 생성할 수 없습니다.
