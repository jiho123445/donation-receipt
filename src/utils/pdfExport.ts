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

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface SaveFilePickerFileHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerFileHandle>;
};

function buildFileName(receipt: IssuedReceiptRecord): string {
  const sanitizedDonorName = (receipt.donorName || '기부자').replace(/[\\/:*?"<>|]/g, '_').trim();
  const sanitizedReceiptNo = (receipt.receiptNo || '영수증').replace(/[\\/:*?"<>|]/g, '_').trim();
  return `기부금영수증_${sanitizedDonorName}_${sanitizedReceiptNo}.pdf`;
}

/**
 * Generate a real A4 PDF from the receipt DOM element.
 * The caller can then save the Blob using the browser's native Save As dialog.
 */
export async function generateReceiptPdfBlob(receiptElement: HTMLElement): Promise<Blob> {
  const imgData = await toPng(receiptElement, {
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: {
      transform: 'none',
      transformOrigin: 'top left',
    },
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  return pdf.output('blob');
}

/**
 * Opens the native Windows/Chrome Save As dialog when File System Access API is available.
 * Falls back to the normal browser download when the current environment (e.g. an iframe)
 * does not permit showSaveFilePicker.
 */
export async function exportReceiptToPdf(
  receiptElement: HTMLElement,
  receipt: IssuedReceiptRecord,
): Promise<PdfExportResult> {
  const fileName = buildFileName(receipt);
  const win = window as WindowWithSavePicker;

  try {
    // Request the native Save As dialog FIRST, while the click still has a user activation.
    // This is important because some Chromium environments reject the picker after awaits.
    if (typeof win.showSaveFilePicker === 'function') {
      let handle: SaveFilePickerFileHandle;
      try {
        handle = await win.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PDF 문서 (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return { success: false, canceled: true, fileName, method: 'picker' };
        }
        throw error;
      }

      const pdfBlob = await generateReceiptPdfBlob(receiptElement);
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      return { success: true, fileName, method: 'picker' };
    }

    // Fallback for environments that do not expose the File System Access API.
    const pdfBlob = await generateReceiptPdfBlob(receiptElement);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

    return { success: true, fileName, blobUrl, method: 'download' };
  } catch (error: any) {
    console.error('PDF 저장 실패:', error);
    return {
      success: false,
      fileName,
      method: typeof win.showSaveFilePicker === 'function' ? 'picker' : 'download',
      error: error?.message || 'PDF 저장 중 오류가 발생했습니다.',
    };
  }
}
