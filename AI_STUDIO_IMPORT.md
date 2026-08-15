# Google AI Studio 적용 메모

이 ZIP은 기존 React/Vite 앱을 수정한 버전입니다.

핵심 변경:
- Excel 후원자료를 localStorage에 저장하지 않음
- 샘플 후원자료 자동 로드 제거
- 기부금 유형/코드 임의 기본값 제거
- 가상 직인 자동 생성 제거
- A4 인쇄 margin 0 기반으로 수정
- Firebase Authentication + Firestore 연동 코드 추가
- Firebase가 설정되면 로그인한 관리자만 발급대장/단체정보를 Firestore에 저장
- 실제 Excel 후원자료는 Firebase로 자동 업로드하지 않고 브라우저 메모리에만 유지

AI Studio에서 가져온 뒤 먼저:
1. `npm install`이 실행되는지 확인
2. `npm run build`로 빌드 오류를 수정
3. Firebase 연결 전에는 로컬 모드로 UI를 확인
4. Firebase 연결 후 로그인/Firestore 저장을 테스트

Firebase 환경변수:
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID

중요:
고유번호, 사업자등록번호, 기부금단체 근거법령/지정정보, 기부금 유형, 기부금 코드는 임의로 입력하지 말고 재단의 공식 서류를 확인한 뒤 입력하세요.
