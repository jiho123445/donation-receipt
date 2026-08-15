# Firebase 설정

1. Firebase Console에서 프로젝트를 만듭니다.
2. 웹 앱을 등록하고 Firebase 설정값을 `.env`에 넣습니다.
3. Authentication > Sign-in method > Email/Password를 활성화합니다.
4. Authentication > Users에서 관리자 계정을 생성합니다.
5. Firestore Database를 생성합니다.
6. `firestore.rules`의 규칙을 적용합니다.
7. 앱을 다시 빌드합니다.

보안 원칙:
- Firestore의 조직정보와 발급대장은 로그인한 사용자만 읽고 쓸 수 있습니다.
- Excel 후원자료는 Firestore에 자동 업로드하지 않습니다. 현재 업로드한 Excel 자료는 브라우저 메모리에만 존재합니다.
- 실제 배포 전에는 Firebase App Check, 백업 정책, 관리자 계정 관리, 개인정보 보관기간을 별도로 검토하세요.
