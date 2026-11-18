import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

export type PdfPaperFormat = 'A4' | 'TICKET' | 'TICKET_80MM';

export interface PdfExportOptions {
  elementId: string;
  filename: string;
  format?: PdfPaperFormat;
}

/**
 * Downloads a jsPDF document safely across desktop browsers, mobile devices, and iframe environments.
 */
function savePdfSafely(pdf: jsPDF, filename: string): void {
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    pdf.save(cleanFilename);
  } catch {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

/**
 * Generates and downloads a complete, unclipped PDF file directly from a printable DOM element.
 *
 * KEY ENGINEERING FIXES:
 * 1. Clones the source element into an isolated offscreen staging sandbox with a fixed standard width
 *    (380px for Ticket/Smartphone reports, 800px for A4 documents). This ensures that even on a narrow
 *    smartphone screen (360-400px), documents render at full desktop/standard fidelity with zero responsive squishing.
 * 2. Completely removes `max-height`, `overflow-y`, `overflow-x`, and browser scrollbars from the clone
 *    and all its descendants, guaranteeing that:
 *    - 100% of the document content is captured from top to bottom (no truncation/cut-off).
 *    - NO browser scrollbars or scroll-lines appear baked into the generated PDF.
 * 3. Slices multi-page A4 documents by exact page height into separate canvas slices to prevent overlapping or bleed.
 * 4. Generates continuous roll PDFs with dynamic height for 80mm tickets and smartphone reports.
 */
export async function downloadElementAsPdf(
  optionsOrElementId: PdfExportOptions | string,
  maybeFilename?: string,
  maybeFormat: PdfPaperFormat = 'A4'
): Promise<void> {
  const elementId =
    typeof optionsOrElementId === 'string' ? optionsOrElementId : optionsOrElementId.elementId;
  const filename =
    typeof optionsOrElementId === 'string'
      ? maybeFilename || 'document'
      : optionsOrElementId.filename;
  const format =
    typeof optionsOrElementId === 'string'
      ? maybeFormat
      : optionsOrElementId.format || 'A4';

  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    console.error(`[pdfExporter] Élément introuvable pour l'ID: ${elementId}`);
    return;
  }

  const isTicket = format === 'TICKET' || format === 'TICKET_80MM';
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Standard target rendering width in pixels
  // 380px corresponds to 80mm ticket roll at crisp readable resolution
  // 800px corresponds to standard A4 (210mm at 96 DPI is ~794px)
  const targetRenderWidth = isTicket ? 380 : 800;

  // Create dedicated offscreen staging sandbox in document.body
  let sandbox: HTMLElement | null = null;

  try {
    sandbox = document.createElement('div');
    sandbox.id = 'equipstock-pdf-render-sandbox';
    sandbox.setAttribute('aria-hidden', 'true');
    sandbox.style.cssText = `
      position: fixed !important;
      left: -10000px !important;
      top: 0 !important;
      width: ${targetRenderWidth}px !important;
      min-width: ${targetRenderWidth}px !important;
      max-width: ${targetRenderWidth}px !important;
      z-index: -99999 !important;
      pointer-events: none !important;
      background-color: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      box-sizing: border-box !important;
      display: block !important;
    `;

    // Deep clone the printable element
    const clone = sourceElement.cloneNode(true) as HTMLElement;
    clone.id = `${elementId}-pdf-staging-clone`;

    // Force full natural height and remove all overflow clipping & scrollbars on the clone root
    clone.style.width = '100%';
    clone.style.minWidth = '100%';
    clone.style.maxWidth = '100%';
    clone.style.height = 'auto';
    clone.style.minHeight = '0';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.overflowX = 'visible';
    clone.style.overflowY = 'visible';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.transform = 'none';
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';
    clone.style.scrollbarWidth = 'none';
    (clone.style as any).msOverflowStyle = 'none';

    // Remove any elements marked with print:hidden inside the clone
    clone.querySelectorAll('[class*="print:hidden"]').forEach((el) => el.remove());

    // Recursively expand all scrollable and constrained descendants
    const allDescendants = clone.querySelectorAll<HTMLElement>('*');
    allDescendants.forEach((el) => {
      // Eliminate any max-height restrictions
      el.style.maxHeight = 'none';
      el.style.scrollbarWidth = 'none';
      (el.style as any).msOverflowStyle = 'none';

      // Expand any overflow containers so content is 100% visible and scrollbars disappear
      if (
        el.classList.contains('overflow-y-auto') ||
        el.classList.contains('overflow-x-auto') ||
        el.classList.contains('overflow-auto') ||
        el.classList.contains('overflow-hidden')
      ) {
        el.classList.remove(
          'overflow-y-auto',
          'overflow-x-auto',
          'overflow-auto',
          'overflow-hidden'
        );
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
      }

      const style = el.style;
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'hidden') {
        style.overflowY = 'visible';
      }
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'hidden') {
        style.overflowX = 'visible';
      }
      if (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflow === 'hidden') {
        style.overflow = 'visible';
      }
    });

    // Inject strict scrollbar-suppression stylesheet into the staging sandbox
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      #equipstock-pdf-render-sandbox,
      #equipstock-pdf-render-sandbox * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        max-height: none !important;
      }
      #equipstock-pdf-render-sandbox *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
    `;
    sandbox.appendChild(styleTag);
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    // Allow browser reflow to compute complete layout and font dimensions
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Calculate actual dimensions of the unconstrained clone
    const finalWidth = targetRenderWidth;
    const finalHeight = Math.max(clone.scrollHeight, clone.offsetHeight, 120);

    // Extract all visible text nodes & their exact coordinates so the generated PDF
    // has a 100% native searchable text layer (works in WhatsApp Search, iOS/Android PDF readers, Ctrl+F)
    interface ExtractedPdfTextItem {
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    const extractedTextItems: ExtractedPdfTextItem[] = [];
    const cloneRect = clone.getBoundingClientRect();

    const sanitizePdfText = (raw: string): string => {
      return raw
        .replace(/[\u202F\u00A0]/g, ' ')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/•/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let currentNode: Node | null = walker.nextNode();
    while (currentNode) {
      const rawVal = currentNode.nodeValue || '';
      const cleanVal = sanitizePdfText(rawVal);
      if (cleanVal.length > 0 && currentNode.parentElement) {
        const parentEl = currentNode.parentElement;
        const computed = window.getComputedStyle(parentEl);
        if (
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          computed.opacity !== '0'
        ) {
          try {
            const range = document.createRange();
            range.selectNodeContents(currentNode);
            const rects = range.getClientRects();
            if (rects.length > 0) {
              const r = range.getBoundingClientRect();
              const relX = Math.max(0, r.left - cloneRect.left);
              const relY = Math.max(0, r.top - cloneRect.top);
              if (r.width > 0 && r.height > 0 && relY <= finalHeight) {
                extractedTextItems.push({
                  text: cleanVal,
                  x: relX,
                  y: relY,
                  width: r.width,
                  height: r.height,
                });
              }
            }
          } catch {
            // Ignore range measurement errors on detached nodes
          }
        }
      }
      currentNode = walker.nextNode();
    }

    // Build searchable keywords summary for PDF metadata dictionary (indexed by WhatsApp & OS search)
    const allSearchableKeywords = Array.from(
      new Set(
        extractedTextItems
          .map((it) => it.text)
          .join(' ')
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      )
    )
      .slice(0, 500)
      .join(' ');

    // Generate high-resolution canvas using html-to-image
    const canvas = await toCanvas(clone, {
      width: finalWidth,
      height: finalHeight,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: false,
      skipFonts: true,
      fontEmbedCSS: '',
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList && node.classList.contains('print:hidden')) {
          return false;
        }
        return true;
      },
    });

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    if (canvasWidth === 0 || canvasHeight === 0) {
      throw new Error('Canvas vide ou dimensions nulles.');
    }

    if (isTicket) {
      // 80mm roll ticket format: continuous single-page roll containing 100% of the content
      const pdfWidth = 80; // 80mm
      const scaledHeight = (canvasHeight * pdfWidth) / canvasWidth;
      const pdfHeight = Math.max(80, Math.ceil(scaledHeight) + 6);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.setProperties({
        title: cleanFilename.replace(/\.pdf$/i, ''),
        subject: 'Rapport & Bilan EquipStock Pro Dakar (PDF Recherchable)',
        author: 'EquipStock Pro Dakar',
        keywords: allSearchableKeywords,
        creator: 'EquipStock Pro Dakar',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(
        imgData,
        'JPEG',
        0,
        3,
        pdfWidth,
        scaledHeight,
        undefined,
        'FAST'
      );

      // Embed native searchable text layer at exact coordinates
      pdf.setFont('helvetica', 'normal');
      for (const item of extractedTextItems) {
        const xMm = Math.max(1, Math.min(pdfWidth - 2, (item.x / finalWidth) * pdfWidth));
        const yMm = 3 + (item.y / finalHeight) * scaledHeight;
        const heightMm = Math.max(1.8, (item.height / finalHeight) * scaledHeight);
        const fontSizePt = Math.max(5, Math.min(14, heightMm * 2.4));
        pdf.setFontSize(fontSizePt);
        pdf.text(item.text, xMm, yMm, {
          baseline: 'top',
          renderingMode: 'invisible',
        });
      }

      savePdfSafely(pdf, cleanFilename);
    } else {
      // Standard A4 format: 210mm x 297mm
      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 8;
      const marginY = 8;
      const printableWidth = pageWidth - marginX * 2; // 194mm
      const availableHeightPerPage = pageHeight - marginY * 2; // 281mm
      const scaledHeight = (canvasHeight * printableWidth) / canvasWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.setProperties({
        title: cleanFilename.replace(/\.pdf$/i, ''),
        subject: 'Document Commercial EquipStock Pro Dakar (PDF Recherchable)',
        author: 'EquipStock Pro Dakar',
        keywords: allSearchableKeywords,
        creator: 'EquipStock Pro Dakar',
      });

      pdf.setFont('helvetica', 'normal');

      if (scaledHeight <= availableHeightPerPage) {
        // Fits cleanly on 1 page
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(
          imgData,
          'JPEG',
          marginX,
          marginY,
          printableWidth,
          scaledHeight,
          undefined,
          'FAST'
        );

        // Embed native searchable text layer on page 1
        for (const item of extractedTextItems) {
          const xMm = marginX + Math.max(0, Math.min(printableWidth - 2, (item.x / finalWidth) * printableWidth));
          const yMm = marginY + (item.y / finalHeight) * scaledHeight;
          const heightMm = Math.max(2, (item.height / finalHeight) * scaledHeight);
          const fontSizePt = Math.max(6, Math.min(16, heightMm * 2.4));
          pdf.setFontSize(fontSizePt);
          pdf.text(item.text, xMm, yMm, {
            baseline: 'top',
            renderingMode: 'invisible',
          });
        }
      } else {
        // Multi-page document: slice the canvas into page-sized chunks cleanly
        const pxPerPage = (availableHeightPerPage * canvasWidth) / printableWidth;
        const domPxPerPage = (availableHeightPerPage * finalWidth) / printableWidth;
        const totalPages = Math.ceil(canvasHeight / pxPerPage);

        for (let p = 0; p < totalPages; p++) {
          if (p > 0) {
            pdf.addPage();
          }

          const sourceY = p * pxPerPage;
          const sourceHeight = Math.min(pxPerPage, canvasHeight - sourceY);
          const pageScaledHeight = (sourceHeight * printableWidth) / canvasWidth;

          // Create a clean canvas slice for this page
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              sourceY,
              canvasWidth,
              sourceHeight,
              0,
              0,
              canvasWidth,
              sourceHeight
            );
            const pageData = pageCanvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(
              pageData,
              'JPEG',
              marginX,
              marginY,
              printableWidth,
              pageScaledHeight,
              undefined,
              'FAST'
            );

            // Embed native searchable text items belonging to this page slice
            const sliceDomTop = p * domPxPerPage;
            const sliceDomBottom = sliceDomTop + domPxPerPage;
            for (const item of extractedTextItems) {
              if (item.y >= sliceDomTop && item.y < sliceDomBottom) {
                const xMm = marginX + Math.max(0, Math.min(printableWidth - 2, (item.x / finalWidth) * printableWidth));
                const yMm = marginY + ((item.y - sliceDomTop) / domPxPerPage) * availableHeightPerPage;
                const heightMm = Math.max(2, (item.height / domPxPerPage) * availableHeightPerPage);
                const fontSizePt = Math.max(6, Math.min(16, heightMm * 2.4));
                pdf.setFontSize(fontSizePt);
                pdf.text(item.text, xMm, yMm, {
                  baseline: 'top',
                  renderingMode: 'invisible',
                });
              }
            }
          }
        }
      }

      savePdfSafely(pdf, cleanFilename);
    }
  } catch (err) {
    console.error('[pdfExporter] Erreur lors de la génération PDF, recours à l’impression navigateur:', err);
    // Fallback: trigger print dialog for this element so user can choose "Save as PDF"
    printElementById(elementId, format);
  } finally {
    // Clean up staging sandbox from the DOM
    if (sandbox && sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  }
}

/**
 * Prints ONLY the specified DOM element (#printable-*) instead of the whole application page.
 * Clones the document into a dedicated top-level #equipstock-print-portal and hides #root during print.
 */
export function printElementById(
  elementId: string,
  format: PdfPaperFormat = 'A4'
): void {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    window.print();
    return;
  }

  const isTicket = format === 'TICKET' || format === 'TICKET_80MM';

  // Remove any previous portal
  const existingPortal = document.getElementById('equipstock-print-portal');
  if (existingPortal) {
    existingPortal.remove();
  }

  // Create fresh top-level print portal
  const portal = document.createElement('div');
  portal.id = 'equipstock-print-portal';
  portal.setAttribute('data-print-format', isTicket ? 'ticket' : 'a4');

  // Clone the target document node
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.id = `${elementId}-print-clone`;
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.overflowX = 'visible';
  clone.style.overflowY = 'visible';
  clone.style.boxShadow = 'none';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.style.margin = isTicket ? '0 auto' : '0';
  clone.style.scrollbarWidth = 'none';

  if (isTicket) {
    clone.style.width = '76mm';
    clone.style.maxWidth = '76mm';
    clone.style.padding = '2mm';
    clone.style.border = 'none';
  } else {
    clone.style.width = '100%';
    clone.style.maxWidth = '210mm';
  }

  // Strip elements marked with print:hidden inside the clone
  const hiddenInPrint = clone.querySelectorAll('[class*="print:hidden"]');
  hiddenInPrint.forEach((el) => el.remove());

  // Expand all inner scrollbars
  clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.maxHeight = 'none';
    el.style.scrollbarWidth = 'none';
    if (el.classList.contains('overflow-y-auto') || el.classList.contains('overflow-x-auto') || el.classList.contains('overflow-auto')) {
      el.classList.remove('overflow-y-auto', 'overflow-x-auto', 'overflow-auto');
      el.style.overflow = 'visible';
    }
  });

  portal.appendChild(clone);
  document.body.appendChild(portal);

  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const hadDark = htmlEl.classList.contains('dark');
  const hadSoft = htmlEl.classList.contains('soft');

  htmlEl.classList.remove('dark', 'soft');
  htmlEl.classList.add('printing-active-portal');
  bodyEl.classList.add('printing-active-portal');
  if (isTicket) {
    htmlEl.classList.add('printing-ticket-mode');
    bodyEl.classList.add('printing-ticket-mode');
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    htmlEl.classList.remove('printing-active-portal', 'printing-ticket-mode');
    bodyEl.classList.remove('printing-active-portal', 'printing-ticket-mode');
    if (hadDark) htmlEl.classList.add('dark');
    if (hadSoft) htmlEl.classList.add('soft');
    const p = document.getElementById('equipstock-print-portal');
    if (p) p.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  // Trigger print synchronously after DOM update
  setTimeout(() => {
    window.print();
    // Fallback cleanup in case afterprint does not fire in some embedded webviews
    setTimeout(cleanup, 1500);
  }, 50);
}
