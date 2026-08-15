import { IssuedReceiptRecord } from '../types/donation';

/**
 * Open an isolated print window and trigger native browser print
 * Ensures no UI buttons, menus, backdrops or preview chrome are present in the print output.
 */
export function printReceiptInIsolatedWindow(
  receiptElement: HTMLElement,
  receipt: IssuedReceiptRecord
): void {
  const title = `기부금영수증_${receipt.donorName || '기부자'}_${receipt.receiptNo || '영수증'}`;

  try {
    const printWindow = window.open('', '_blank', 'width=900,height=1000,menubar=no,toolbar=no,location=no,status=no');

    if (!printWindow) {
      // Fallback if popup is blocked by browser/iframe sandbox
      window.print();
      return;
    }

    // Collect all stylesheets and style blocks from current document
    let styleTags = '';
    const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleNodes.forEach((node) => {
      styleTags += node.outerHTML;
    });

    const printHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${styleTags}
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .print-wrapper {
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      padding: 0;
      background: #ffffff;
    }
    #official-receipt-a4-document {
      box-shadow: none !important;
      border: none !important;
      transform: none !important;
      margin: 0 auto !important;
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    ${receiptElement.outerHTML}
  </div>
  <script>
    window.addEventListener('load', function() {
      const doc = document.getElementById('official-receipt-a4-document');
      if (doc) {
        doc.style.boxShadow = 'none';
        doc.style.border = 'none';
        doc.style.transform = 'none';
      }
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    });
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  } catch (err) {
    console.warn('Popup print blocked or failed, falling back to window.print():', err);
    window.print();
  }
}
