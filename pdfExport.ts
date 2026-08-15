import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
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
 * Generate high-resolution PDF from the A4 receipt element and prompt user for local save location
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
    // Generate high-resolution image using native browser SVG/foreignObject rendering
    // This fully supports modern CSS including Tailwind v4's OKLCH color model
    const imgData = await toPng(receiptElement, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: {
        transform: 'none', // reset any preview zoom scale
        transformOrigin: 'top left',
      },
    });

    // Create jsPDF document with A4 dimensions (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // A4 dimensions
    const pdfWidth = 210;
    const pdfHeight = 297;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // If requested to open directly in a new window/tab for native preview and Save As (Ctrl+S)
    if (openInNewWindow) {
      window.open(blobUrl, '_blank');
      return {
        success: true,
        fileName,
        blobUrl,
        method: 'download',
      };
    }

    // 1. Try File System Access API (window.showSaveFilePicker)
    // This allows the user to choose their preferred folder / location on their local computer!
    if (
      typeof window !== 'undefined' &&
      'showSaveFilePicker' in window &&
      typeof (window as any).showSaveFilePicker === 'function'
    ) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PDF 문서 (*.pdf)',
              accept: {
                'application/pdf': ['.pdf'],
              },
            },
          ],
        });

        const writableStream = await handle.createWritable();
        await writableStream.write(pdfBlob);
        await writableStream.close();

        return {
          success: true,
          fileName,
          blobUrl,
          method: 'picker',
        };
      } catch (err: any) {
        // If user canceled the save location dialog
        if (err.name === 'AbortError') {
          return {
            success: false,
            canceled: true,
            fileName,
            blobUrl,
            method: 'picker',
          };
        }
        // If showSaveFilePicker failed due to iframe sandbox permissions, fallback to standard download
        console.warn('File System Access API not available in iframe sandbox, falling back to download:', err);
      }
    }

    // 2. Standard fallback: Blob URL Download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      fileName,
      blobUrl,
      method: 'download',
    };
  } catch (error: any) {
    console.error('PDF Generation failed:', error);
    return {
      success: false,
      fileName,
      method: 'download',
      error: error?.message || 'PDF 생성 도중 오류가 발생했습니다.',
    };
  }
}
