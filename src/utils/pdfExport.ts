import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
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
 * Generate A4 PDF Blob (210mm x 297mm, optimized high-resolution rendering)
 */
export async function generateReceiptPdfBlob(receiptElement: HTMLElement): Promise<Blob> {
  const imgData = await toPng(receiptElement, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: {
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

  const pdfWidth = 210;
  const pdfHeight = 297;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  return pdf.output('blob');
}

/**
 * Export receipt to PDF.
 * Invokes showSaveFilePicker() FIRST during the user click event to preserve transient user activation,
 * then generates the PDF Blob and writes to the selected FileHandle.
 */
export async function exportReceiptToPdf(
  receiptElement: HTMLElement,
  receipt: IssuedReceiptRecord
): Promise<PdfExportResult> {
  const sanitizedDonorName = (receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_').trim();
  const sanitizedReceiptNo = (receipt.receiptNo || '영수증').replace(/[\\/:*?"<>|]/g, '_').trim();
  const fileName = `기부금영수증_${sanitizedDonorName}_${sanitizedReceiptNo}.pdf`;

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
          const pdfBlob = await generateReceiptPdfBlob(receiptElement);
          const blobUrl = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

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

    // User confirmed location; now generate PDF and write to file handle
    if (fileHandle) {
      try {
        const pdfBlob = await generateReceiptPdfBlob(receiptElement);
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
    const pdfBlob = await generateReceiptPdfBlob(receiptElement);
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


