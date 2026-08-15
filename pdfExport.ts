import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import { IssuedReceiptRecord } from '../types/donation';

export interface PdfExportResult {
  success: boolean;
  canceled?: boolean;
  fileName: string;
  blobUrl?: string;
  method: 'picker' | 'download';
  error?: string;
}

/**
 * Generate A4 PDF from the receipt element with optimized rendering and prompt user for local save location
 */
export async function exportReceiptToPdf(
  receiptElement: HTMLElement,
  receipt: IssuedReceiptRecord,
  openInNewWindow: boolean = false
): Promise<PdfExportResult> {
  const sanitizedDonorName = (receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_').trim();
  const sanitizedReceiptNo = (receipt.receiptNo || '영수증').replace(/[\\/:*?"<>|]/g, '_').trim();
  const fileName = `기부금영수증_${sanitizedDonorName}_${sanitizedReceiptNo}.pdf`;

  try {
    const exportHost = document.createElement('div');
    exportHost.style.position = 'fixed';
    exportHost.style.left = '0';
    exportHost.style.top = '0';
    exportHost.style.width = '210mm';
    exportHost.style.height = '297mm';
    exportHost.style.margin = '0';
    exportHost.style.padding = '0';
    exportHost.style.overflow = 'hidden';
    exportHost.style.zIndex = '-2147483647';
    exportHost.style.background = '#fff';
    exportHost.style.pointerEvents = 'none';
    const clone = receiptElement.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    Object.assign(clone.style, {
      width: '210mm', height: '297mm', minHeight: '297mm', maxHeight: '297mm',
      margin: '0', padding: '12mm 14mm', boxSizing: 'border-box',
      transform: 'none', transformOrigin: 'top left', left: '0', top: '0',
      position: 'relative', boxShadow: 'none', border: 'none'
    });
    exportHost.appendChild(clone);
    document.body.appendChild(exportHost);
    try {
      const canvas = await toCanvas(clone, {
        pixelRatio: 1.5,
        width: Math.ceil(210 * 96 / 25.4),
        height: Math.ceil(297 * 96 / 25.4),
        backgroundColor: '#fff',
        cacheBust: false,
        style: { width: '210mm', height: '297mm', margin: '0', transform: 'none', transformOrigin: 'top left' }
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const jpegData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(jpegData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      if (openInNewWindow) {
        window.open(blobUrl, '_blank');
        return { success: true, fileName, blobUrl, method: 'download' };
      }
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window && typeof (window as any).showSaveFilePicker === 'function') {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'PDF 문서 (*.pdf)', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(pdfBlob);
          await writable.close();
          return { success: true, fileName, blobUrl, method: 'picker' };
        } catch (err: any) {
          if (err?.name === 'AbortError') return { success: false, canceled: true, fileName, blobUrl, method: 'picker' };
        }
      }
      const link = document.createElement('a');
      link.href = blobUrl; link.download = fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return { success: true, fileName, blobUrl, method: 'download' };
    } finally {
      exportHost.remove();
    }
  } catch (error: any) {
    return { success: false, fileName, method: 'download', error: error?.message || 'PDF 생성 도중 오류가 발생했습니다.' };
  }
}
