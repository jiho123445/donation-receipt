// Vercel 서버리스 함수 — 기부금영수증 PDF 첨부 이메일 실제 발송
//
// 로컬 개발 시에는 server/index.js(Express, /api/send-email)가 같은 역할을 하고,
// Vercel에 배포하면 이 파일이 자동으로 /api/send-email 엔드포인트가 됩니다.
// (Vercel이 /api 폴더 안의 파일들을 자동으로 서버리스 함수로 인식합니다.)
//
// 필요한 환경변수는 Vercel 프로젝트 설정 > Environment Variables 에서 등록하세요.
//   EMAIL_SERVICE / EMAIL_USER / EMAIL_PASS   (예: Gmail)
//   또는 SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS  (예: 네이버메일)
//   MAIL_FROM / MAIL_FROM_NAME (선택)

import nodemailer from 'nodemailer';

function buildTransporter() {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } =
    process.env;

  if (EMAIL_SERVICE) {
    return nodemailer.createTransport({
      service: EMAIL_SERVICE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
  }

  if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === 'true',
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  return null;
}

function isMailConfigured() {
  return Boolean(process.env.EMAIL_SERVICE || process.env.SMTP_HOST);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' });
    return;
  }

  try {
    const { to, subject, text, pdfBase64, fileName } = req.body || {};

    if (!to || !subject || !pdfBase64) {
      res.status(400).json({
        ok: false,
        error: '필수 값이 누락되었습니다 (받는사람, 제목, PDF 데이터).',
      });
      return;
    }

    if (!isMailConfigured()) {
      res.status(503).json({
        ok: false,
        error:
          '메일 발송 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정 > Environment Variables 에서 ' +
          'EMAIL_SERVICE/EMAIL_USER/EMAIL_PASS (또는 SMTP_HOST 등)를 등록한 뒤 다시 배포해주세요.',
      });
      return;
    }

    const transporter = buildTransporter();
    const fromAddress = process.env.MAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER;
    const fromName = process.env.MAIL_FROM_NAME || '기부금영수증 발급시스템';

    await transporter.sendMail({
      from: fromAddress ? `"${fromName}" <${fromAddress}>` : undefined,
      to,
      subject,
      text,
      attachments: [
        {
          filename: fileName || '기부금영수증.pdf',
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-email] 발송 실패:', err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : '이메일 발송 중 알 수 없는 오류가 발생했습니다.',
    });
  }
}
