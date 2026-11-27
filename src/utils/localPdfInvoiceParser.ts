import * as pdfjsLib from 'pdfjs-dist';

// Bundle PDF.js worker via Vite asset URL (works offline & on static hosts)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface LocalExtractedItem {
  partReference: string;
  description: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LocalExtractedInvoice {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  items: LocalExtractedItem[];
}

const KNOWN_BRANDS = [
  'CATERPILLAR',
  'CAT',
  'PERKINS',
  'CTP',
  'ITR',
  'DONALDSON',
  'FLEETGUARD',
  'KOMATSU',
  'VOLVO',
  'BOSCH',
  'BALDWIN',
  'MANN',
  'CUMMINS',
  'JCB',
  'HITACHI',
  'DOOSAN',
  'ORIGINAL',
  'GENUINE',
  'OEM',
  'AFTERMARKET',
  'TIMKEN',
  'SKF',
  'FAG',
  'NTN',
  'KOYO',
  'FP DIESEL',
  'MAHLE',
  'PAI',
  'BERCO',
  'CARRARO',
  'DANA',
  'ZF',
];

const IGNORE_LINE_REGEX =
  /\b(sub[\s-]*total|grand[\s-]*total|total[\s-]*amount|net[\s-]*amount|vat|tva|tax|freight|shipping|transport|delivery|discount|remise|balance|amount\s+in\s+words|bank\s+details|iban|swift|trn|page\s+\d+|invoice\s+date|due\s+date|bill\s+to|ship\s+to|customer|telephone|tel:|fax:|email|www\.|p\.o\.\s*box)\b/i;

const HEADER_LINE_REGEX =
  /\b(part\s*no|item\s*code|description|unit\s*price|qty|quantity|amount|rate)\b.*\b(price|qty|amount|total|rate|description)\b/i;

function normalizeRef(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function parseNumericToken(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  // Reject dates like 2026-11-27 or 27.11.2026
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(cleaned)) return null;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(cleaned)) return null;
  // Reject values with multiple dots/commas in odd places
  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // e.g. 1,250.50 -> 1250.50 or 1.250,50 -> 1250.50
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0]}.${parts[1]}`;
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  }

  const val = parseFloat(normalized);
  if (!Number.isFinite(val) || val <= 0) return null;
  return Math.round(val * 100) / 100;
}

function looksLikePartReference(token: string): boolean {
  const clean = token.replace(/^[,;:()[\]]+|[,;:()[\]]+$/g, '');
  if (clean.length < 4 || clean.length > 22) return false;
  if (!/\d/.test(clean)) return false;
  // Exclude pure currency amounts with decimals like 125.50 or 1,250.00
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(clean) && (clean.includes('.') || clean.includes(','))) {
    return false;
  }
  if (/^\d+[.,]\d{1,2}$/.test(clean)) return false;
  // Exclude dates
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(clean)) return false;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(clean)) return false;
  // Exclude percentages or units
  if (/%$/.test(clean)) return false;
  // Must contain only uppercase letters, digits, hyphens, slashes or dots
  if (!/^[A-Z0-9][A-Z0-9\-/._]{2,20}[A-Z0-9]$/i.test(clean)) return false;

  // Classic heavy-equipment ref shapes:
  // - Alphanumeric mix like 1R-0750, 6I-2501, P551313, 326-1644, 7W2326, LF3349
  // - Or pure numeric 6-12 digits like 26560143, 130306380
  const hasLetter = /[A-Za-z]/.test(clean);
  const hasDash = clean.includes('-');
  const digitCount = (clean.match(/\d/g) || []).length;

  if (hasLetter && digitCount >= 2) return true;
  if (hasDash && digitCount >= 4) return true;
  if (!hasLetter && !hasDash && digitCount >= 6 && digitCount <= 12) return true;
  return false;
}

function detectBrandInText(text: string): string {
  const upper = text.toUpperCase();
  for (const b of KNOWN_BRANDS) {
    const regex = new RegExp(`\\b${b.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(upper)) {
      return b === 'CATERPILLAR' ? 'CAT' : b;
    }
  }
  return '';
}

export async function extractInvoiceFromPdfLocally(
  file: File,
  knownCatalogNormalizedRefs?: Set<string>
): Promise<LocalExtractedInvoice> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  interface TextAtom {
    str: string;
    x: number;
    y: number;
  }

  const allLines: { text: string; cells: string[] }[] = [];
  let totalTextLength = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const atoms: TextAtom[] = [];
    for (const item of content.items as any[]) {
      const str = String(item?.str || '').trim();
      if (!str) continue;
      totalTextLength += str.length;
      const x = Array.isArray(item.transform) ? Number(item.transform[4]) || 0 : 0;
      const y = Array.isArray(item.transform) ? Number(item.transform[5]) || 0 : 0;
      atoms.push({ str, x, y });
    }

    // Group atoms by horizontal row (tolerance ~4pt on Y axis)
    atoms.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: { y: number; items: TextAtom[] }[] = [];

    for (const atom of atoms) {
      const existingRow = rows.find((r) => Math.abs(r.y - atom.y) <= 4.5);
      if (existingRow) {
        existingRow.items.push(atom);
      } else {
        rows.push({ y: atom.y, items: [atom] });
      }
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const cells = row.items.map((i) => i.str).filter(Boolean);
      const lineText = cells.join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) {
        allLines.push({ text: lineText, cells });
      }
    }
  }

  if (totalTextLength < 20) {
    throw new Error(
      "Ce PDF semble être un scan / image sans texte sélectionnable. L'analyse des factures scannées nécessite le serveur API (/api/extract-invoice-prices avec GEMINI_API_KEY)."
    );
  }

  const fullText = allLines.map((l) => l.text).join('\n');

  // Detect currency
  let currency = 'AED';
  if (/\b(AED|DHS|DIRHAM|DIRHAMS|U\.A\.E\.?\s*DIRHAMS?)\b/i.test(fullText)) {
    currency = 'AED';
  } else if (/\b(USD|US\s*\$|\$)\b/i.test(fullText)) {
    currency = 'USD';
  } else if (/\b(EUR|EURO|€)\b/i.test(fullText)) {
    currency = 'EUR';
  }

  // Detect invoice number
  let invoiceNumber = '';
  const invMatch = fullText.match(
    /(?:invoice\s*(?:no|num|number|#)?|inv\.?\s*no\.?|facture\s*n[°o]?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/]{2,24})/i
  );
  if (invMatch?.[1]) {
    invoiceNumber = invMatch[1].trim();
  }

  // Detect invoice date
  let invoiceDate = '';
  const dateMatch = fullText.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{2}[/-]\d{2}[/-]\d{2})\b/
  );
  if (dateMatch?.[1]) {
    invoiceDate = dateMatch[1];
  }

  // Detect supplier name (first meaningful uppercase/header line)
  let supplierName = '';
  for (const line of allLines.slice(0, 8)) {
    const t = line.text.trim();
    if (
      t.length >= 4 &&
      t.length <= 70 &&
      !/^(tax\s+invoice|invoice|commercial\s+invoice|proforma|facture|page\s+\d)/i.test(t) &&
      !/^\d+$/.test(t)
    ) {
      supplierName = t;
      break;
    }
  }

  const items: LocalExtractedItem[] = [];

  for (const line of allLines) {
    const text = line.text;
    if (text.length < 6) continue;
    if (IGNORE_LINE_REGEX.test(text) || HEADER_LINE_REGEX.test(text)) continue;

    // Split into tokens for reference & numeric analysis
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;

    // 1. Find the best part reference on this line
    let partRef = '';
    let partRefIdx = -1;

    // Priority A: matches a known reference in user's catalog
    if (knownCatalogNormalizedRefs && knownCatalogNormalizedRefs.size > 0) {
      for (let i = 0; i < Math.min(tokens.length, 6); i++) {
        const cleanTok = tokens[i].replace(/^[,;:()[\]]+|[,;:()[\]]+$/g, '');
        const norm = normalizeRef(cleanTok);
        if (norm.length >= 3 && knownCatalogNormalizedRefs.has(norm)) {
          partRef = cleanTok.toUpperCase();
          partRefIdx = i;
          break;
        }
      }
    }

    // Priority B: matches OEM part reference shape (skipping leading row index like "1" or "01.")
    if (!partRef) {
      const startIdx = /^\d{1,3}\.?$/.test(tokens[0]) ? 1 : 0;
      for (let i = startIdx; i < Math.min(tokens.length, 5); i++) {
        const cleanTok = tokens[i].replace(/^[,;:()[\]]+|[,;:()[\]]+$/g, '');
        if (looksLikePartReference(cleanTok)) {
          partRef = cleanTok.toUpperCase();
          partRefIdx = i;
          break;
        }
      }
    }

    if (!partRef) continue;

    // 2. Collect numeric values AFTER the part reference (typically Qty, Unit Price, Line Total)
    const numericEntries: { idx: number; raw: string; val: number; hasDecimal: boolean }[] = [];
    for (let i = partRefIdx + 1; i < tokens.length; i++) {
      const tok = tokens[i];
      // Skip currency words or unit words
      if (/^(AED|DHS|USD|EUR|PCS|PC|EA|UNIT|SET|KIT|NOS|BOX)$/i.test(tok)) continue;
      // Skip tokens that clearly contain letters (except currency prefix/suffix stripped safely if pure price)
      if (/[A-Za-z]/.test(tok.replace(/^(AED|DHS|USD|EUR)/i, '').replace(/(AED|DHS|USD|EUR)$/i, ''))) {
        continue;
      }
      const val = parseNumericToken(tok);
      if (val !== null) {
        numericEntries.push({
          idx: i,
          raw: tok,
          val,
          hasDecimal: /[.,]\d{1,2}$/.test(tok.replace(/[^0-9.,]/g, '')),
        });
      }
    }

    if (numericEntries.length === 0) continue;

    let quantity = 1;
    let unitPrice = 0;
    let lineTotal = 0;

    if (numericEntries.length >= 3) {
      // Check trailing 3 numbers (commonly Qty, Unit Price, Total OR Unit Price, Qty, Total OR Qty, Unit Price, Disc, Total)
      const tail = numericEntries.slice(-3);
      const [a, b, c] = tail;
      const isClose = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.5, y * 0.03);

      if (Number.isInteger(a.val) && a.val <= 10000 && isClose(a.val * b.val, c.val)) {
        quantity = a.val;
        unitPrice = b.val;
        lineTotal = c.val;
      } else if (Number.isInteger(b.val) && b.val <= 10000 && isClose(a.val * b.val, c.val)) {
        unitPrice = a.val;
        quantity = b.val;
        lineTotal = c.val;
      } else {
        // Check any pair in numericEntries whose product matches the last number (handles VAT/discount columns)
        const last = numericEntries[numericEntries.length - 1];
        let matchedTriple = false;
        for (let i = 0; i < numericEntries.length - 2 && !matchedTriple; i++) {
          for (let j = i + 1; j < numericEntries.length - 1 && !matchedTriple; j++) {
            const qCand = numericEntries[i];
            const pCand = numericEntries[j];
            if (Number.isInteger(qCand.val) && qCand.val <= 10000 && isClose(qCand.val * pCand.val, last.val)) {
              quantity = qCand.val;
              unitPrice = pCand.val;
              lineTotal = last.val;
              matchedTriple = true;
            }
          }
        }
        if (!matchedTriple) {
          // Fallback: assume second-to-last is unitPrice and last is total
          quantity = Number.isInteger(a.val) && a.val <= 5000 ? a.val : 1;
          unitPrice = b.val;
          lineTotal = c.val;
        }
      }
    } else if (numericEntries.length === 2) {
      const [a, b] = numericEntries;
      if (Number.isInteger(a.val) && !a.hasDecimal && a.val <= 1000 && b.val > 0) {
        quantity = a.val;
        // Ambiguous whether b is unit price or total: treat b as unit price if qty=1, otherwise if b is clearly divisible or standard
        unitPrice = b.val;
        lineTotal = Math.round(quantity * unitPrice * 100) / 100;
      } else {
        unitPrice = a.val;
        lineTotal = b.val;
        quantity = unitPrice > 0 ? Math.max(1, Math.round(lineTotal / unitPrice)) : 1;
      }
    } else {
      unitPrice = numericEntries[0].val;
      lineTotal = unitPrice;
      quantity = 1;
    }

    if (unitPrice <= 0) continue;

    // Description is the text between partRef and the first numeric column
    const firstNumIdx = numericEntries[0].idx;
    const descTokens = tokens.slice(partRefIdx + 1, firstNumIdx);
    const description = descTokens.join(' ').trim();
    const brand = detectBrandInText(`${description} ${tokens.slice(0, partRefIdx).join(' ')}`);

    items.push({
      partReference: partRef,
      description,
      brand,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    });
  }

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    currency,
    items,
  };
}
