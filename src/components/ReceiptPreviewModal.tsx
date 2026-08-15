import React, { useState } from 'react';
import { ArrowLeft, Printer, X, ZoomIn, ZoomOut, FileDown, Loader2 } from 'lucide-react';
import { IssuedReceiptRecord, PrintSettings } from '../types/donation';
import { OfficialReceiptA4 } from './OfficialReceiptA4';
import { exportReceiptToPdf } from '../utils/pdfExport';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: IssuedReceiptRecord | null;
  printSettings: PrintSettings;
  onOpenPrintSettings?: () => void;
}

function copyStylesToPrintWindow(printWindow: Window) {
  const head = printWindow.document.head;
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    head.appendChild(node.cloneNode(true));
  });
}

async function printReceiptInNewWindow(): Promise<boolean> {
  const source = document.querySelector('.print-only-container .receipt-page') as HTMLElement | null;
  if (!source) return false;

  const printWindow = window.open('', '_blank', 'width=1000,height=900');
  if (!printWindow) return false;

  const cloned = source.cloneNode(true) as HTMLElement;
  cloned.removeAttribute('id');
  cloned.style.transform = 'none';
  cloned.style.margin = '0';
  cloned.style.boxShadow = 'none';
  cloned.style.border = 'none';

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>기부금영수증 인쇄</title></head><body></body></html>`);
  printWindow.document.close();

  copyStylesToPrintWindow(printWindow);

  const style = printWindow.document.createElement('style');
  style.textContent = `
    @page { size: A4 portrait; margin: 0; }
    html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: #fff; }
    body { overflow: hidden; }
    .receipt-page { width: 210mm !important; height: 297mm !important; min-height: 297mm !important; margin: 0 !important; box-shadow: none !important; border: none !important; transform: none !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  `;
  printWindow.document.head.appendChild(style);
  printWindow.document.body.appendChild(cloned);

  await new Promise<void>((resolve) => {
    if (printWindow.document.readyState === 'complete') resolve();
    else printWindow.addEventListener('load', () => resolve(), { once: true });
    window.setTimeout(resolve, 500);
  });

  printWindow.focus();
  printWindow.print();
  return true;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  receipt,
  printSettings,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen || !receipt) return null;

  const handlePrint = async () => {
    setMessage(null);

    // A new top-level window is more reliable than calling print() inside
    // the Google AI Studio Preview iframe.
    const opened = await printReceiptInNewWindow();
    if (!opened) {
      // Fallback for environments that block popups.
      window.print();
    }
  };

  const handleSavePdf = async () => {
    setMessage(null);
    const receiptElement = document.querySelector('.print-only-container .receipt-page') as HTMLElement | null;

    if (!receiptElement) {
      setMessage('PDF로 저장할 영수증을 찾을 수 없습니다.');
      return;
    }

    setIsSavingPdf(true);
    try {
      const result = await exportReceiptToPdf(receiptElement, receipt);

      if (result.canceled) {
        setMessage('PDF 저장이 취소되었습니다.');
      } else if (result.success) {
        if (result.method === 'picker') {
          setMessage(`PDF가 저장되었습니다: ${result.fileName}`);
        } else {
          setMessage(`PDF가 다운로드되었습니다: ${result.fileName}`);
        }
      } else {
        setMessage(result.error || 'PDF 저장에 실패했습니다.');
      }
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <>
      <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4">
        <div className="sticky top-2 z-20 w-full max-w-5xl bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 mb-3 flex items-center justify-between gap-3 border border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white" title="뒤로 가기">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">발급번호: {receipt.receiptNo}</span>
                <span className="text-xs text-slate-200 font-semibold">{receipt.donorName} ({receipt.taxYear}년도분)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">A4 규격 (210mm × 297mm) 현행 법정 서식 미리보기</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
              <button onClick={() => setZoomLevel((z) => Math.max(70, z - 10))} className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700" title="축소"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="font-mono text-[11px] px-1 text-slate-300 w-10 text-center">{zoomLevel}%</span>
              <button onClick={() => setZoomLevel((z) => Math.min(130, z + 10))} className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700" title="확대"><ZoomIn className="w-3.5 h-3.5" /></button>
            </div>

            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg shadow-md"
              title="PDF 저장 - 저장 위치와 파일명을 선택합니다"
            >
              {isSavingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>{isSavingPdf ? '저장 중...' : 'PDF 저장'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md ring-1 ring-blue-400/30"
              title="Windows/Chrome 인쇄 설정창 열기"
            >
              <Printer className="w-4 h-4" />
              <span>인쇄</span>
            </button>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" title="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {message && (
          <div className="no-print w-full max-w-5xl mb-3 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs text-center">
            {message}
          </div>
        )}

        <div className="w-full max-w-5xl mb-3 px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 text-xs text-center">
          <strong>PDF 저장</strong>은 저장 위치와 파일명을 직접 선택합니다. <strong>인쇄</strong>는 Windows/Chrome의 실제 인쇄 설정창을 엽니다.
        </div>

        <div className="pb-16 flex justify-center w-full" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
          <OfficialReceiptA4 receipt={receipt} printSettings={printSettings} isPreviewMode={true} />
        </div>
      </div>

      <div className="print-only-container">
        <OfficialReceiptA4 receipt={receipt} printSettings={printSettings} isPreviewMode={false} />
      </div>
    </>
  );
};
