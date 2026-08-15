import React, { useState, useRef } from 'react';
import { X, Printer, Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { IssuedReceiptRecord, PrintSettings } from '../types/donation';
import { OfficialReceiptA4 } from './OfficialReceiptA4';
import { exportReceiptToPdf } from '../utils/pdfExport';
import { printReceiptInIsolatedWindow } from '../utils/printHelper';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: IssuedReceiptRecord | null;
  printSettings?: PrintSettings;
  onOpenPrintSettings?: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  receipt,
  printSettings = { offsetX: 0, offsetY: 0, scale: 100 },
}) => {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const receiptContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !receipt) return null;

  // Handle PDF Export with File System Access API (showSaveFilePicker)
  const handleSavePdf = async () => {
    if (!receiptContainerRef.current) return;
    setIsSavingPdf(true);
    setStatusMessage(null);

    try {
      const result = await exportReceiptToPdf(receiptContainerRef.current, receipt);

      if (result.success) {
        if (result.isSecurityRestricted) {
          setStatusMessage({
            type: 'info',
            text: '현재 미리보기 환경에서는 파일 저장 위치 선택 기능이 제한될 수 있습니다. 실제 웹사이트에서 다시 시도해주세요. (PDF 파일은 다운로드 폴더에 저장되었습니다)',
          });
          setTimeout(() => setStatusMessage(null), 7000);
        } else {
          setStatusMessage({
            type: 'success',
            text: `[${result.fileName}] 파일이 성공적으로 저장되었습니다.`,
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }
      } else if (result.canceled) {
        // User canceled file picker dialog - quiet exit
        setStatusMessage(null);
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'PDF 저장 중 문제가 발생했습니다.',
        });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'PDF 생성 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingPdf(false);
    }
  };

  // Handle Printing (Isolated Window with standard window.print fallback)
  const handlePrint = () => {
    if (receiptContainerRef.current) {
      printReceiptInIsolatedWindow(receiptContainerRef.current, receipt);
    } else {
      window.print();
    }
  };

  return (
    <>
      {/* On-screen modal overlay (hidden during print via .no-print) */}
      <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4">
        {/* Top Control Bar */}
        <div className="sticky top-2 z-20 w-full max-w-4xl bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3 border border-slate-700">
          {/* Left: Back button & Document info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="뒤로 가기"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>뒤로가기</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  발급번호 {receipt.receiptNo}
                </span>
                <span className="text-sm text-slate-100 font-bold">
                  {receipt.donorName}
                </span>
                <span className="text-xs text-slate-300">
                  ({receipt.taxYear}년도)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2026. 1. 2.&gt;
              </p>
            </div>
          </div>

          {/* Right: Action Buttons [PDF 저장], [인쇄], [닫기] */}
          <div className="flex items-center gap-2.5">
            {/* [PDF 저장] Button */}
            <button
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-700 text-white rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer ring-2 ring-emerald-400/40"
              title="기부금영수증을 PDF 파일로 저장"
            >
              {isSavingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>PDF 생성 중...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-100" />
                  <span>PDF 저장</span>
                </>
              )}
            </button>

            {/* [인쇄] Button */}
            <button
              onClick={handlePrint}
              disabled={isSavingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer ring-2 ring-blue-400/40"
              title="기부금영수증 인쇄 (프린터 출력)"
            >
              <Printer className="w-4 h-4 text-blue-100" />
              <span>인쇄</span>
            </button>

            {/* [닫기] Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMessage && (
          <div
            className={`w-full max-w-4xl mb-3 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between gap-2 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-100 border border-emerald-500'
                : statusMessage.type === 'error'
                ? 'bg-red-950/95 text-red-100 border border-red-500'
                : 'bg-blue-950/95 text-blue-100 border border-blue-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-300 hover:text-white text-xs px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* A4 Document Viewport */}
        <div className="pb-16 flex justify-center w-full">
          <OfficialReceiptA4
            ref={receiptContainerRef}
            receipt={receipt}
            printSettings={printSettings}
            isPreviewMode={true}
          />
        </div>
      </div>

      {/* Dedicated Print Container for window.print() */}
      <div className="print-only-container hidden">
        <OfficialReceiptA4
          receipt={receipt}
          printSettings={printSettings}
          isPreviewMode={false}
        />
      </div>
    </>
  );
};

