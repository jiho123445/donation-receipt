import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Download,
  Send,
  Share2,
  Sparkles,
  Paperclip,
  UserCheck,
  Phone,
  Smartphone,
  ChevronRight,
  Info,
  CheckCircle2,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { IssuedReceiptRecord } from '../types/donation';
import { formatKRW } from '../utils/hangulCurrency';
import { generateReceiptPdfBlob } from '../utils/pdfExport';
import { OfficialReceiptA4 } from './OfficialReceiptA4';

interface ShareReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: IssuedReceiptRecord | null;
  receiptElementRef?: React.RefObject<HTMLDivElement | null>;
  initialTab?: 'kakao' | 'email';
}

export const ShareReceiptModal: React.FC<ShareReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  receiptElementRef,
  initialTab = 'kakao',
}) => {
  const [activeTab, setActiveTab] = useState<'kakao' | 'email'>(initialTab);

  // Recipient (Step 2) state
  const [targetName, setTargetName] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  // Messages (Step 1) state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [kakaoMessage, setKakaoMessage] = useState('');

  // UI status
  const [copiedKakao, setCopiedKakao] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const internalReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!receipt) return;

    const orgName = receipt.orgSnapshot?.name || '사단법인 너브내행복나눔재단';
    const repName = receipt.orgSnapshot?.representative || '대표';
    const regNo = receipt.orgSnapshot?.registrationNo || receipt.orgSnapshot?.bizNo || '등록번호';
    const phone = receipt.orgSnapshot?.phone || '033-435-0999';
    const donorName = receipt.donorName || '후원자';
    const amountStr = formatKRW(receipt.totalAmount);
    const year = receipt.taxYear;
    const receiptNo = receipt.receiptNo;
    const issueDate = receipt.issueDate;
    const fileName = `기부금영수증_${donorName.replace(/[\\/:*?"<>|]/g, '_')}_${receiptNo.replace(/[\\/:*?"<>|]/g, '_')}.pdf`;

    setTargetName(donorName);

    // KakaoTalk optimized message format with PDF notice
    const kakaoText =
`[${orgName} 기부금영수증 발급 안내]

안녕하세요, ${donorName}님.
따뜻한 나눔으로 함께해주신 ${donorName}님께 깊은 감사를 드립니다.

요청하신 ${year}년도 소득공제용 기부금영수증이 발급되었습니다.
첨부된 법정 기부금영수증(PDF) 파일을 확인해 주시기 바랍니다.

■ 발급 정보
• 기부자명: ${donorName}
• 과세연도: ${year}년도
• 발급번호: ${receiptNo}
• 발급일자: ${issueDate}
• 총 기부금액: ${amountStr}원 (${receipt.donations?.length || 1}건)
• 기부유형: 지정기부금 (코드 40)
• 발급기관: ${orgName} (고유번호: ${regNo})
• 첨부파일: 📄 ${fileName}

■ 안내사항
국세청 연말정산 간소화 서비스 및 세무신고 시 첨부된 기부금영수증(PDF)을 제출 또는 조회하여 소득/세액공제 혜택을 받으실 수 있습니다.

문의처: ${orgName} (${phone})
감사합니다.`;

    setKakaoMessage(kakaoText);

    // Email default subject & body
    const emailSubj = `[기부금영수증 첨부] ${orgName} ${year}년도 법정 기부금영수증 발급 안내 (${donorName}님)`;
    const emailTxt =
`안녕하세요, ${donorName} 후원자님.

따뜻한 마음으로 ${orgName}에 후원해주셔서 진심으로 감사드립니다.
귀하께서 후원해주신 내역에 대한 ${year}년도 소득세법/법인세법 시행규칙에 따른 공식 법정 기부금영수증(PDF)을 발급하여 첨부파일과 함께 보내드립니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[기부금영수증 발급 내역]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 기부자(성명/상호): ${donorName}
• 주민(사업자)등록번호: ${receipt.donorIdNumber ? receipt.donorIdNumber.slice(0, 8) + '******' : '기재완료'}
• 과세연도: ${year}년도
• 발급번호: ${receiptNo}
• 발급일자: ${issueDate}
• 총 기부금액: 금 ${amountStr}원 (${receipt.donations?.length || 1}건)
• 기부금 구분: 지정기부금 (코드 40)
• 첨부파일: ${fileName}

[기부금 영수증 발급 단체]
• 단체명: ${orgName}
• 대표자: ${repName}
• 고유번호/사업자번호: ${regNo}
• 소재지: ${receipt.orgSnapshot?.address || '강원특별자치도 홍천군'}
• 문의전화: ${phone}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※ 본 영수증은 소득세법 제34조 및 법인세법 제24조에 의거하여 발행된 법정 공식 서식입니다.
※ 첨부된 기부금영수증 PDF 파일을 확인하시고, 연말정산 및 종합소득세 신고 시 활용하시기 바랍니다.

소중한 나눔에 다시 한번 머리 숙여 감사드립니다.

${orgName} 배상`;

    setEmailSubject(emailSubj);
    setEmailBody(emailTxt);
  }, [receipt]);

  if (!isOpen || !receipt) return null;

  const getReceiptTargetElement = (): HTMLElement | null => {
    if (receiptElementRef?.current) return receiptElementRef.current;
    if (internalReceiptRef.current) return internalReceiptRef.current;
    return null;
  };

  const getOrGeneratePdfData = async (): Promise<{ file: File; blob: Blob; fileName: string } | null> => {
    const el = getReceiptTargetElement();
    if (!el || !receipt) return null;
    const blob = await generateReceiptPdfBlob(el);
    const sanitizedDonor = (targetName || receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_');
    const sanitizedReceiptNo = (receipt.receiptNo || '').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `기부금영수증_${sanitizedDonor}_${sanitizedReceiptNo}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    return { file, blob, fileName };
  };

  // Direct PDF Download handler
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setShareFeedback(null);
    try {
      const pdfData = await getOrGeneratePdfData();
      if (!pdfData) throw new Error('PDF 요소를 찾을 수 없습니다.');

      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      setShareFeedback(`📄 PDF 파일 [${pdfData.fileName}]이(가) 다운로드되었습니다.`);
    } catch (err) {
      console.error('PDF download error:', err);
      setShareFeedback('PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 1. Copy KakaoTalk text
  const handleCopyKakao = async () => {
    try {
      await navigator.clipboard.writeText(kakaoMessage);
      setCopiedKakao(true);
      setShareFeedback('카카오톡 안내 문구가 복사되었습니다. 카카오톡 대화방에 [붙여넣기(Ctrl+V)] 하세요!');
      setTimeout(() => setCopiedKakao(false), 3000);
    } catch {
      setShareFeedback('클립보드 복사에 실패했습니다.');
    }
  };

  // 2-A. KakaoTalk Direct Send (Auto PDF Download + Text Copy + Open Kakao)
  const handleKakaoQuickLaunch = async () => {
    setIsSharing(true);
    setShareFeedback(null);

    try {
      // 1. Download PDF file
      const pdfData = await getOrGeneratePdfData();
      if (pdfData) {
        const url = URL.createObjectURL(pdfData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }

      // 2. Copy text to clipboard
      await navigator.clipboard.writeText(kakaoMessage).catch(() => {});
      setCopiedKakao(true);

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `kakaolink://send?text=${encodeURIComponent(kakaoMessage)}`;
      } else {
        // PC Kakao launch
        window.open('kakaotalk://', '_self');
        setTimeout(() => {
          window.open('https://web.kakao.com/', '_blank', 'noopener,noreferrer');
        }, 800);
      }

      setShareFeedback(`💬 [${targetName}] 후원자님께 보낼 문구가 복사되고 PDF가 다운로드되었습니다! 카카오톡에서 [${targetName}] 검색 후 대화방에 붙여넣기(Ctrl+V)하세요.`);
    } catch (err) {
      console.error('Kakao launch error:', err);
      setShareFeedback('카카오톡 실행 중 오류가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  // 2-B. Send SMS / MMS Directly to Target Phone
  const handleSendSmsDirect = async () => {
    const phoneNum = targetPhone.replace(/[^0-9]/g, '');
    const cleanSmsBody = kakaoMessage;

    // Copy to clipboard as fallback
    await navigator.clipboard.writeText(cleanSmsBody).catch(() => {});
    setCopiedKakao(true);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const smsUrl = phoneNum
      ? isMobile
        ? `sms:${phoneNum}?body=${encodeURIComponent(cleanSmsBody)}`
        : `sms:${phoneNum}`
      : `sms:?body=${encodeURIComponent(cleanSmsBody)}`;

    window.location.href = smsUrl;
    setShareFeedback(phoneNum ? `📱 [${targetName}] (${targetPhone}) 수신자로 문자 앱이 실행되었습니다!` : '📱 문자 메시지 앱이 실행되었습니다.');
  };

  // 2-C. Share to specific contact / name via OS Share
  const handleShareContactPicker = async () => {
    setIsSharing(true);
    setShareFeedback(null);

    try {
      const pdfData = await getOrGeneratePdfData();

      // Always copy text to clipboard
      await navigator.clipboard.writeText(kakaoMessage).catch(() => {});
      setCopiedKakao(true);

      if (navigator.share && pdfData) {
        const shareData: ShareData = {
          title: `[기부금영수증] ${targetName}님 (${receipt.taxYear}년도)`,
          text: kakaoMessage,
        };

        if (navigator.canShare && navigator.canShare({ files: [pdfData.file] })) {
          shareData.files = [pdfData.file];
        }

        await navigator.share(shareData);
        setShareFeedback(`선택하신 대화상대(${targetName}님)에게 기부금영수증 PDF와 문구가 전송되었습니다.`);
        return;
      }

      // Fallback
      if (pdfData) {
        const url = URL.createObjectURL(pdfData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      setShareFeedback('문구가 복사되고 PDF 파일이 다운로드되었습니다.');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Contact share error:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 3. Copy Email text
  const handleCopyEmail = async () => {
    try {
      const fullText = `제목: ${emailSubject}\n\n${emailBody}`;
      await navigator.clipboard.writeText(fullText);
      setCopiedEmail(true);
      setShareFeedback('이메일 제목과 본문이 복사되었습니다.');
      setTimeout(() => setCopiedEmail(false), 3000);
    } catch {
      setShareFeedback('클립보드 복사에 실패했습니다.');
    }
  };

  // 4. Send Email Directly (No OS Share popup!)
  const handleSendEmailDirect = async () => {
    setIsSharing(true);
    setShareFeedback(null);

    try {
      // 1. Auto download PDF so it is ready on user's computer
      const pdfData = await getOrGeneratePdfData();
      if (pdfData) {
        const url = URL.createObjectURL(pdfData.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }

      // 2. Copy body text to clipboard as safety
      const fullText = `제목: ${emailSubject}\n\n${emailBody}`;
      await navigator.clipboard.writeText(fullText).catch(() => {});
      setCopiedEmail(true);

      // 3. Directly trigger mailto without OS share dialog
      const to = recipientEmail.trim();
      const subj = encodeURIComponent(emailSubject);
      const body = encodeURIComponent(emailBody);
      const mailtoUrl = `mailto:${to}?subject=${subj}&body=${body}`;

      window.location.href = mailtoUrl;

      setShareFeedback(`✉️ [${to || targetName + '님'}] 수신자로 메일 작성 창이 바로 열렸습니다. 다운로드된 PDF 파일을 첨부하여 발송해주세요!`);
    } catch (err) {
      console.error('Email send error:', err);
      setShareFeedback('이메일 실행 중 오류가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  // 5. Open Gmail directly in Web Browser
  const handleOpenGmailWeb = async () => {
    const pdfData = await getOrGeneratePdfData();
    if (pdfData) {
      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    const to = recipientEmail.trim();
    const subj = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subj}&body=${body}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    setShareFeedback(`웹용 Gmail 새 편지창이 열렸습니다 (${to ? '받는사람: ' + to : '본문 자동입력'}). 다운로드된 PDF 파일을 첨부해주세요!`);
  };

  // 6. Open Naver Mail directly in Web Browser
  const handleOpenNaverMail = async () => {
    const pdfData = await getOrGeneratePdfData();
    if (pdfData) {
      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    await navigator.clipboard.writeText(`제목: ${emailSubject}\n\n${emailBody}`).catch(() => {});
    setCopiedEmail(true);

    window.open('https://mail.naver.com/write/popup', '_blank', 'noopener,noreferrer');
    setShareFeedback('네이버 메일 작성창이 열렸습니다! (본문 복사됨 + PDF 파일 다운로드됨)');
  };

  const pdfFileName = `기부금영수증_${(targetName || receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_')}_${(receipt.receiptNo || '').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;

  return (
    <>
      <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
          {/* Modal Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">기부금영수증 발송 & 공유 마법사</h3>
                <p className="text-[11px] text-slate-300">
                  {receipt.donorName} 후원자님 | 발급번호 {receipt.receiptNo} ({receipt.taxYear}년도 / {formatKRW(receipt.totalAmount)}원)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="grid grid-cols-2 p-2 bg-slate-100 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('kakao')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'kakao'
                  ? 'bg-[#FEE500] text-[#191919] shadow-sm ring-2 ring-yellow-400/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>💬 카카오톡 / 문자 (SMS) 전송</span>
            </button>

            <button
              onClick={() => setActiveTab('email')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'email'
                  ? 'bg-blue-900 text-white shadow-sm ring-2 ring-blue-700/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>✉️ 이메일 (E-mail) 발송</span>
            </button>
          </div>

          {/* Step Progress Breadcrumb */}
          <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-600 overflow-x-auto">
            <div className="flex items-center gap-1 text-blue-900 font-bold whitespace-nowrap">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center">1</span>
              <span>발급안내 & PDF첨부</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1 text-blue-900 font-bold whitespace-nowrap">
              <span className="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center">2</span>
              <span>상대방(수신자) 선택</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1 text-emerald-700 font-bold whitespace-nowrap">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">3</span>
              <span>원클릭 전송 & 공유</span>
            </div>
          </div>

          {/* Feedback Alert */}
          {shareFeedback && (
            <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="leading-snug">{shareFeedback}</span>
              </div>
              <button
                onClick={() => setShareFeedback(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs px-1 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* STEP 1: 발급안내 + PDF 첨부파일 확인 */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">발급 안내 문구 및 첨부파일 확인</h4>
                </div>
                <button
                  type="button"
                  onClick={activeTab === 'kakao' ? handleCopyKakao : handleCopyEmail}
                  className="text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {(activeTab === 'kakao' ? copiedKakao : copiedEmail) ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>문구 복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>문구 복사</span>
                    </>
                  )}
                </button>
              </div>

              {/* PDF File Attachment Badge */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-bold text-[10px]">
                    PDF
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                      <Paperclip className="w-3.5 h-3.5 text-blue-900" />
                      <span className="truncate">{pdfFileName}</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500">법정 서식 A4 기부금영수증 (직인 날인 완료)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
                  title="PDF 파일 저장"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-900" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>PDF 다운로드</span>
                </button>
              </div>

              {/* Message text area */}
              {activeTab === 'kakao' ? (
                <textarea
                  rows={4}
                  value={kakaoMessage}
                  onChange={(e) => setKakaoMessage(e.target.value)}
                  className="w-full text-[11.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  placeholder="카카오톡/문자 발송 안내 문구"
                />
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-medium focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    placeholder="메일 제목"
                  />
                  <textarea
                    rows={4}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full text-[11.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    placeholder="이메일 본문 내용"
                  />
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* STEP 2: 전송할 상대방(수신자) 선택 및 확인 */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <div className="border border-blue-200 rounded-xl p-3.5 bg-blue-50/40 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">전송할 상대방(수신자) 정보 선택 및 확인</h4>
                </div>
                <span className="text-[11px] font-medium text-blue-900 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>기부자 자동 연동</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <span>수신 후원자 성명</span>
                  </label>
                  <input
                    type="text"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="후원자 성명"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50/50"
                  />
                </div>

                {activeTab === 'kakao' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-blue-900" />
                      <span>수신자 휴대폰 번호 (문자/연락처)</span>
                    </label>
                    <input
                      type="tel"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="예: 010-1234-5678 (문자 발송 시 필수)"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-900" />
                      <span>수신자 이메일 주소</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="예: donor@example.com (메일 발송 대상)"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-mono font-medium"
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-blue-800">
                💡 상대방 정보를 확인하거나 수정하신 후 아래 3단계 버튼을 누르면 해당 상대방에게 바로 전달됩니다.
              </p>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* STEP 3: 원클릭 공유 및 전송 실행 */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/30 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-xs font-bold text-emerald-950">공유 및 전송 방법 선택</h4>
                </div>
                <span className="text-[11px] text-emerald-800 font-medium">원클릭 바로 전송</span>
              </div>

              {activeTab === 'kakao' ? (
                /* KakaoTalk / SMS Action Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Action 1: Kakao Direct Launch */}
                  <button
                    type="button"
                    onClick={handleKakaoQuickLaunch}
                    disabled={isSharing}
                    className="p-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] shadow-sm hover:shadow-md transition-all text-left border border-yellow-400/50 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 fill-current" />
                        <span>카카오톡 바로 열기 & 전송</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-800 leading-snug">
                      PDF 자동 다운로드 + 문구 복사 후 카카오톡 실행 (<strong>[{targetName}]</strong> 검색 후 붙여넣기)
                    </p>
                  </button>

                  {/* Action 2: Phone SMS Direct */}
                  <button
                    type="button"
                    onClick={handleSendSmsDirect}
                    className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 shadow-sm border border-slate-300 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-blue-900">
                        <Smartphone className="w-4 h-4" />
                        <span>휴대폰 문자(SMS)로 보내기</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {targetPhone ? `[${targetPhone}] 수신자로 문자 앱 자동 실행` : '휴대폰 문자 앱으로 안내 문구 바로 작성'}
                    </p>
                  </button>

                  {/* Action 3: OS Contact / Share Picker */}
                  <button
                    type="button"
                    onClick={handleShareContactPicker}
                    disabled={isSharing}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all text-left cursor-pointer group sm:col-span-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Share2 className="w-4 h-4 text-blue-300" />
                        <span>Windows / 기기 대화상대(성명) 목록에서 선택 전송</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      시스템 연락처 목록(대화상대 성명)을 열어 영수증 PDF 파일과 안내 문구를 함께 전송합니다.
                    </p>
                  </button>
                </div>
              ) : (
                /* Email Action Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Action 1: Native Mail Client (mailto) */}
                  <button
                    type="button"
                    onClick={handleSendEmailDirect}
                    disabled={isSharing}
                    className="p-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white shadow-sm hover:shadow-md transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold flex items-center gap-1.5">
                        <Send className="w-4 h-4" />
                        <span>기본 메일(Outlook/Mail)로 바로 발송</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-blue-100 leading-snug">
                      {recipientEmail ? `[${recipientEmail}] 수신자/제목/본문 자동 채움` : '메일 작성창 즉시 실행 (PDF 다운로드 포함)'}
                    </p>
                  </button>

                  {/* Action 2: Gmail Web Direct */}
                  <button
                    type="button"
                    onClick={handleOpenGmailWeb}
                    className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 shadow-sm border border-slate-300 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-red-600">
                        <ExternalLink className="w-4 h-4" />
                        <span>웹용 Gmail로 바로 작성</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      브라우저 Gmail 새 편지창에 받는사람/제목/본문 자동 완성
                    </p>
                  </button>

                  {/* Action 3: Naver Mail Web */}
                  <button
                    type="button"
                    onClick={handleOpenNaverMail}
                    className="p-3 rounded-xl bg-white hover:bg-emerald-50/50 text-slate-900 shadow-sm border border-emerald-200 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-700">
                        <ExternalLink className="w-4 h-4" />
                        <span>네이버 메일 작성창 열기</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      네이버 메일 쓰기 화면 열림 + 본문 자동 복사 + PDF 준비
                    </p>
                  </button>

                  {/* Action 4: Copy Full text */}
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 shadow-sm border border-slate-200 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Copy className="w-4 h-4" />
                        <span>웹메일용 전체 복사</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      다음 메일, 회사 웹메일 등에 바로 붙여넣기(Ctrl+V)
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-900 shrink-0" />
              <span>법정 서식 기부금영수증은 직인이 날인된 공식 PDF 원본으로 첨부됩니다.</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Offscreen Official Receipt for High-Resolution PDF Generation */}
      <div
        style={{
          position: 'fixed',
          left: '-99999px',
          top: '-99999px',
          width: '210mm',
          height: '297mm',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999,
        }}
        aria-hidden="true"
      >
        <div ref={internalReceiptRef}>
          <OfficialReceiptA4
            receipt={receipt}
            isPreviewMode={false}
          />
        </div>
      </div>
    </>
  );
};
