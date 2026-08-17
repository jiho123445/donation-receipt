// 이메일 발송 환경변수가 Vercel에 잘 등록됐는지 확인용 (GET /api/health)
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    mailConfigured: Boolean(process.env.EMAIL_SERVICE || process.env.SMTP_HOST),
  });
}
