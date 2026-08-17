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

### V17 수정
Firestore의 `undefined` 필드 저장 오류를 방지하도록 donation 저장 직전에 undefined 필드를 제거했습니다. 특히 Excel에서 후원일자가 없거나 파일명에서 기간을 추정하지 못해 `period`가 undefined가 되는 경우에도 업로드가 실패하지 않습니다.

## V19 테스트 안내
- Firebase `donations` 컬렉션을 비운 후 실제 Excel을 첫 업로드하는 테스트용 수정본입니다.
- 같은 Excel을 다시 올리면 같은 행은 sourceKey로 중복 제외됩니다.
- 동일한 내용의 서로 다른 Excel 행은 서로 다른 문서 ID를 사용하여 모두 보존됩니다.
