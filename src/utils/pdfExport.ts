import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import { IssuedReceiptRecord } from '../types/donation';

export interface PdfExportResult {
  success: boolean;
  canceled?: boolean;
  isSecurityRestricted?: boolean;
  fileName: string;
  blobUrl?: string;
  method: 'picker' | 'download';
  error?: string;
}

/**
 * Generate A4 PDF Blob (210mm x 297mm, high-speed optimized rendering)
 */
export async function generateReceiptPdfBlob(receiptElement: HTMLElement): Promise<Blob> {
  // Ensure fonts are ready before rasterizing
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue even if font ready check fails
    }
  }

  // PDF export must not inherit the preview's zoom, print offset, centering margin,
  // or transform. Capture a dedicated A4-sized clone instead.
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
  exportHost.style.background = '#ffffff';
  exportHost.style.pointerEvents = 'none';

  const clone = receiptElement.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.style.width = '210mm';
  clone.style.height = '297mm';
  clone.style.minHeight = '297mm';
  clone.style.maxHeight = '297mm';
  clone.style.margin = '0';
  clone.style.padding = '12mm 14mm';
  clone.style.boxSizing = 'border-box';
  clone.style.transform = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.position = 'relative';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';

  exportHost.appendChild(clone);
  document.body.appendChild(exportHost);

  try {
    // html-to-image with fontEmbedCSS: '' renders instantaneously (<200ms) by avoiding
    // network crawls of remote webfont chunks, while natively supporting Tailwind v4's modern oklch colors and SVG seals
    const canvas = await toCanvas(clone, {
      pixelRatio: 2,
      fontEmbedCSS: '',
      cacheBust: false,
      backgroundColor: '#ffffff',
      width: Math.ceil(210 * 96 / 25.4),
      height: Math.ceil(297 * 96 / 25.4),
      style: {
        width: '210mm',
        height: '297mm',
        margin: '0',
        transform: 'none',
        transformOrigin: 'top left',
        boxShadow: 'none',
        border: 'none',
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const jpegData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(jpegData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

    return pdf.output('blob');
  } finally {
    exportHost.remove();
  }
}

/**
 * Export receipt to PDF.
 * Starts generating the PDF blob in parallel with the user opening and confirming showSaveFilePicker().
 * This allows the file to be saved instantaneously (<0.2s) once the user selects the destination.
 */
export async function exportReceiptToPdf(
  receiptElement: HTMLElement,
  receipt: IssuedReceiptRecord
): Promise<PdfExportResult> {
  const sanitizedDonorName = (receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_').trim();
  const sanitizedReceiptNo = (receipt.receiptNo || '영수증').replace(/[\\/:*?"<>|]/g, '_').trim();
  const fileName = `기부금영수증_${sanitizedDonorName}_${sanitizedReceiptNo}.pdf`;

  // Start PDF Blob generation concurrently in the background so it's ready when user picks the path
  const blobPromise = generateReceiptPdfBlob(receiptElement);

  const hasSaveFilePicker =
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    typeof (window as any).showSaveFilePicker === 'function';

  // 1. Direct File System Access API (Chromium Chrome/Edge HTTPS)
  if (hasSaveFilePicker) {
    let fileHandle: any = null;

    try {
      // Direct call on user gesture: user chooses folder & filename
      fileHandle = await (window as any).showSaveFilePicker({
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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User canceled dialog - exit quietly
        return {
          success: false,
          canceled: true,
          fileName,
          method: 'picker',
        };
      }

      if (err.name === 'SecurityError') {
        console.warn('SecurityError on showSaveFilePicker (iframe sandbox restriction):', err);
        // Fallback to standard PDF download for restricted preview iframe
        try {
          const pdfBlob = await blobPromise;
          const blobUrl = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

          return {
            success: true,
            isSecurityRestricted: true,
            fileName,
            blobUrl,
            method: 'download',
          };
        } catch (genErr: any) {
          return {
            success: false,
            fileName,
            method: 'download',
            error: genErr?.message || 'PDF 생성 도중 오류가 발생했습니다.',
          };
        }
      }

      console.warn('File System Access API failed, falling back to download:', err);
    }

    // User confirmed location; write the PDF blob (which was already generated concurrently)
    if (fileHandle) {
      try {
        const pdfBlob = await blobPromise;
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(pdfBlob);
        await writableStream.close();

        return {
          success: true,
          fileName,
          method: 'picker',
        };
      } catch (err: any) {
        console.error('Failed to write PDF to chosen file handle:', err);
        return {
          success: false,
          fileName,
          method: 'picker',
          error: '선택한 위치에 파일을 저장하는 도중 오류가 발생했습니다.',
        };
      }
    }
  }

  // 2. Standard fallback for Safari / Firefox / non-supporting browsers
  try {
    const pdfBlob = await blobPromise;
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Release the Blob URL after handing it to the browser.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    return {
      success: true,
      fileName,
      blobUrl,
      method: 'download',
    };
  } catch (err: any) {
    console.error('PDF generation fallback failed:', err);
    return {
      success: false,
      fileName,
      method: 'download',
      error: err?.message || 'PDF 생성 도중 오류가 발생했습니다.',
    };
  }
}



