
// 카카오톡 공유 링크용 초단축 리다이렉트 (GET /api/r?id=발급번호)
//
// 카카오톡 "공유하기"는 링크(webUrl/mobileWebUrl)가 너무 길면(대략 250자 이상)
// 링크를 무효 처리하고 눌러도 반응이 없는 깨진 카드만 보여줍니다. Firebase
// Storage의 원본 다운로드 URL(다운로드 토큰 포함, 파일명에 한글까지 들어가면
// URL 인코딩 후 300~400자를 훌쩍 넘김)을 카카오톡 링크에 직접 쓰면 이 문제가
// 발생합니다.
//
// 이 함수는 짧은 발급번호(id)만 받아서, 실제 Firebase Storage 파일로 302
// 리다이렉트합니다. 저장 경로가 `receipts/<발급번호>.pdf` 로 고정되어 있고
// Storage 보안 규칙이 해당 경로를 공개 읽기(allow read: if true) 처리하므로
// 다운로드 토큰 없이도 `?alt=media` 만으로 파일을 받을 수 있습니다.
export default function handler(req, res) {
  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = (rawId || '').toString();

  // 저장 경로와 동일한 규칙: 영문/숫자/하이픈/언더스코어만 허용
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    res.status(400).send('잘못된 요청입니다 (id 누락 또는 형식 오류).');
    return;
  }

  const bucket = 'donation-receipt-5d4e7.firebasestorage.app';
  const objectPath = encodeURIComponent(`receipts/${id}.pdf`);
  const targetUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectPath}?alt=media`;

  res.writeHead(302, { Location: targetUrl });
  res.end();
}
