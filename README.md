<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1e8c7cf7-d577-4188-9024-65c53308287e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## 월별 납부내역 누적 기능

- 월별 Excel 업로드 시 기존 납부내역을 유지하고 새로운 납부내역만 Firestore의 `donations` 컬렉션에 누적합니다.
- 앱을 다시 열거나 다른 PC에서 로그인해도 Firebase에 저장된 누적 자료를 불러옵니다.
- 동일한 납부내역(성명/식별번호/주소/일자/금액/납부방법/기부유형/코드/내용이 모두 같은 자료)을 다시 업로드하면 중복 합산하지 않습니다.
- 영수증 발급 화면은 선택한 연도의 누적 납부내역을 자동 합산합니다.
- Firebase가 연결되지 않은 경우에는 기존과 같이 브라우저 메모리 방식으로 동작하며, 새로고침 후 누적자료가 유지되지 않습니다.
