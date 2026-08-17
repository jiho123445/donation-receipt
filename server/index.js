// 기부금영수증 발급시스템 - 이메일 실제 발송 백엔드
//
// 프런트엔드(Vite)는 브라우저에서 직접 SMTP 서버로 접속할 수 없기 때문에,
// PDF 첨부 이메일을 "진짜로" 발송하려면 이 Node.js 서버가 필요합니다.
// 프런트엔드는 PDF를 생성한 뒤 /api/send-email 로 base64 데이터를 전달하고,
// 이 서버가 nodemailer를 이용해 실제 메일함으로 발송합니다.
//
// 환경변수 설정 방법은 .env.example 을 참고하세요.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/**
 * 환경변수로부터 nodemailer transporter를 생성합니다.
 * - EMAIL_SERVICE=gmail 처럼 서비스명을 지정하면 간단하게 Gmail 등을 사용할 수 있습니다.
 *   (Gmail은 일반 비밀번호가 아닌 "앱 비밀번호"를 EMAIL_PASS에 넣어야 합니다.)
 * - 그 외에는 SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS 로
 *   범용 SMTP(네이버, 회사 메일 서버, SendGrid SMTP 등)를 사용할 수 있습니다.
 */
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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mailConfigured: isMailConfigured(),
  });
});

app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text, pdfBase64, fileName } = req.body || {};

    if (!to || !subject || !pdfBase64) {
      return res.status(400).json({
        ok: false,
        error: '필수 값이 누락되었습니다 (받는사람, 제목, PDF 데이터).',
      });
    }

    if (!isMailConfigured()) {
      return res.status(503).json({
        ok: false,
        error:
          '메일 발송 환경변수가 설정되지 않았습니다. .env 파일에 EMAIL_SERVICE/EMAIL_USER/EMAIL_PASS ' +
          '(또는 SMTP_HOST 등)를 설정한 뒤 서버를 재시작해주세요.',
      });
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

    return res.json({ ok: true });
  } catch (err) {
    console.error('[send-email] 발송 실패:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : '이메일 발송 중 알 수 없는 오류가 발생했습니다.',
    });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`[mail-server] listening on http://localhost:${port}`);
  console.log(`[mail-server] mail configured: ${isMailConfigured()}`);
});
