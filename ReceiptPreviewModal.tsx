import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Loader2,
  FolderDown,
  ExternalLink,
  HelpCircle,
  FolderOpen,
} from 'lucide-react';
import { IssuedReceiptRecord, PrintSettings } from '../types/donation';
import { OfficialReceiptA4 } from './OfficialReceiptA4';
import { exportReceiptToPdf } from '../utils/pdfExport';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: IssuedReceiptRecord | null;
  printSettings: PrintSettings;
  onOpenPrintSettings: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  receipt,
  printSettings,
  onOpenPrintSettings,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [generatedBlobUrl, setGeneratedBlobUrl] = useState<string | null>(null);
  const [showFolderGuide, setShowFolderGuide] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
    showLocationTips?: boolean;
  } | null>(null);

  const receiptContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !receipt) return null;

  // Handle Physical / Driver Printing (and OS Native Save as PDF dialog)
  const handlePrint = () => {
    setFeedbackMessage({
      type: 'info',
      text: '인쇄 창이 실행됩니다. 인쇄 대상을 [PDF로 저장]으로 선택하시면 컴퓨터 폴더를 직접 선택하실 수 있습니다.',
    });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Handle PDF Export
  const handleSavePdf = async (openInNewTab: boolean = false) => {
    if (!receiptContainerRef.current) return;
    setIsExportingPdf(true);
    setFeedbackMessage({
      type: 'info',
      text: '고화질 PDF 전자문서를 생성하고 있습니다...',
    });

    try {
      const result = await exportReceiptToPdf(receiptContainerRef.current, receipt, openInNewTab);

      if (result.blobUrl) {
        setGeneratedBlobUrl(result.blobUrl);
      }

      if (result.success) {
        if (openInNewTab) {
          setFeedbackMessage({
            type: 'success',
            text: '새 창에서 PDF가 열렸습니다. 우측 상단 다운로드 아이콘이나 Ctrl+S로 원하는 폴더에 저장하세요.',
          });
        } else {
          setFeedbackMessage({
            type: 'success',
            text: `[${result.fileName}] 파일이 저장되었습니다. (원하는 폴더를 직접 지정하시려면 아래 안내를 확인하세요)`,
            showLocationTips: true,
          });
        }
      } else if (result.canceled) {
        setFeedbackMessage({
          type: 'info',
          text: 'PDF 저장이 취소되었습니다.',
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: result.error || 'PDF 저장 중 문제가 발생했습니다.',
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: 'PDF 생성 중 오류가 발생했습니다.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      {/* On-screen modal overlay (hidden during print) */}
      <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4">
        {/* Top Control Bar */}
        <div className="sticky top-2 z-20 w-full max-w-5xl bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3 border border-slate-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="뒤로 가기"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  발급번호: {receipt.receiptNo}
                </span>
                <span className="text-xs text-slate-200 font-semibold">
                  {receipt.donorName} ({receipt.taxYear}년도분)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                A4 규격 (210mm × 297mm) 법정 공식 서식 미리보기
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
                title="축소"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 text-slate-300 w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
                title="확대"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print Settings Offset Button */}
            <button
              onClick={onOpenPrintSettings}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors cursor-pointer text-slate-200"
              title="프린터 인쇄 위치 및 배율 미세조정"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>인쇄 위치설정</span>
            </button>

            {/* Folder Guide Toggle */}
            <button
              onClick={() => setShowFolderGuide(!showFolderGuide)}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-amber-300 cursor-pointer"
              title="저장 위치(폴더) 지정 안내"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline">폴더지정 방법</span>
            </button>

            {/* Button 1: PDF 다운로드 */}
            <button
              onClick={() => handleSavePdf(false)}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-700 text-white rounded-lg shadow-md transition-all cursor-pointer ring-1 ring-emerald-400/30"
              title="PDF 전자문서 즉시 파일 저장"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>PDF 다운로드</span>
                </>
              )}
            </button>

            {/* Button 2: 인쇄 / PDF 저장 (폴더 지정 창 실행) */}
            <button
              onClick={handlePrint}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg shadow-md transition-all cursor-pointer ring-1 ring-blue-400/30"
              title="인쇄 미리보기 및 종이 출력 / PDF 저장(폴더 선택)"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span>인쇄 / PDF 저장 (폴더지정)</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast / Banner */}
        {feedbackMessage && (
          <div
            className={`w-full max-w-5xl mb-2 px-4 py-2.5 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-100 border border-emerald-500'
                : feedbackMessage.type === 'error'
                ? 'bg-red-950/95 text-red-100 border border-red-500'
                : 'bg-blue-950/95 text-blue-100 border border-blue-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {feedbackMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              {feedbackMessage.type === 'info' && <FolderDown className="w-4 h-4 text-blue-400 shrink-0" />}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {generatedBlobUrl && (
                <button
                  onClick={() => window.open(generatedBlobUrl, '_blank')}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>새 창에서 PDF 열기</span>
                </button>
              )}
              <button
                onClick={() => setFeedbackMessage(null)}
                className="text-slate-300 hover:text-white px-1.5 py-0.5 text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Folder Location Guide Card (Collapsible) */}
        {(showFolderGuide || feedbackMessage?.showLocationTips) && (
          <div className="w-full max-w-5xl bg-amber-950/90 border border-amber-500/60 text-amber-100 p-3.5 rounded-lg text-xs space-y-2 mb-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between font-bold text-amber-300">
              <span className="flex items-center gap-1.5 text-sm">
                <FolderOpen className="w-4 h-4" />
                <span>내 컴퓨터의 원하는 폴더에 PDF를 저장하는 3가지 방법</span>
              </span>
              <button
                onClick={() => setShowFolderGuide(false)}
                className="text-amber-400 hover:text-amber-200 text-xs cursor-pointer"
              >
                닫기 ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11.5px] leading-relaxed text-amber-200">
              <div className="bg-black/40 p-2.5 rounded border border-amber-500/30">
                <strong className="text-white block mb-1">방법 1. [인쇄 / PDF 저장] 버튼 (가장 확실)</strong>
                상단의 파란색 <strong>[인쇄 / PDF 저장]</strong> 버튼을 누른 후, 인쇄 대상을 <strong>[PDF로 저장]</strong>으로 선택하고 [저장]을 누르면 윈도우 탐색기 폴더 위치 지정창이 100% 뜹니다.
              </div>

              <div className="bg-black/40 p-2.5 rounded border border-amber-500/30">
                <strong className="text-white block mb-1">방법 2. PDF 새 창에서 열기 (Ctrl+S)</strong>
                PDF를 생성한 후 <button onClick={() => handleSavePdf(true)} className="text-amber-300 underline font-bold cursor-pointer">[새 창에서 열기]</button>를 누르면 브라우저 뷰어에서 <strong>Ctrl + S</strong> 키로 원하는 폴더를 선택할 수 있습니다.
              </div>

              <div className="bg-black/40 p-2.5 rounded border border-amber-500/30">
                <strong className="text-white block mb-1">방법 3. 브라우저 다운로드 설정</strong>
                크롬 우측 상단 [점 3개 ⋮] → [설정] → [다운로드] 메뉴에서 <strong>'다운로드 전에 각 파일의 저장 위치 확인'</strong>을 켜두시면 모든 다운로드 시 항상 폴더창이 뜹니다.
              </div>
            </div>
          </div>
        )}

        {/* Guidance Notice Bar */}
        <div className="w-full max-w-5xl bg-slate-800/80 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-emerald-800 text-emerald-200 rounded text-[10px] font-bold">PDF 다운로드</span>
            <span className="text-[11.5px] text-slate-300">
              <strong>기부금영수증_{receipt.donorName}_{receipt.receiptNo}.pdf</strong> 파일 다운로드
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-blue-800 text-blue-200 rounded text-[10px] font-bold">인쇄/폴더지정</span>
            <span className="text-[11.5px] text-slate-300">
              인쇄창에서 <strong>[PDF로 저장]</strong> 선택 시 컴퓨터 폴더 위치 지정 가능
            </span>
          </div>
        </div>

        {/* A4 Document Viewport */}
        <div
          className="pb-16 transition-transform origin-top flex justify-center w-full"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          <OfficialReceiptA4
            ref={receiptContainerRef}
            receipt={receipt}
            printSettings={printSettings}
            isPreviewMode={true}
          />
        </div>
      </div>

      {/* Dedicated Print Target (Only visible to printer driver via @media print) */}
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
