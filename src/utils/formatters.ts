/**
 * Formatting and helper utilities for EquipStock Pro
 */

export function formatFCFA(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 FCFA';
  }
  // Standard West African CFA franc formatting (no decimals, space thousand separator)
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

/**
 * Round a UAE Dirham (AED) amount to 2 decimal places (fils precision).
 */
export function roundAED(amount: number): number {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Standard UAE Dirham (AED) formatting for supplier purchase prices.
 * Preserves 2 decimals when fractional (e.g. 18,50 AED), clean integer when whole (e.g. 1 250 AED).
 */
export function formatAED(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 AED';
  }
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  const fixed = isWhole ? Math.round(rounded).toString() : rounded.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${formattedInt},${decPart} AED` : `${formattedInt} AED`;
}

export function formatDate(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  // Add BOM for proper UTF-8 Excel French characters display
  const BOM = '\uFEFF';
  const csvContent =
    BOM +
    [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';'),
      ...rows.map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '""';
            const str = String(cell).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(';')
      ),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format full physical location string from rack, shelf, bin or fallback
 */
export function formatPhysicalLocation(article: {
  warehouseLocation?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  defaultLocation?: string;
}): string {
  const parts: string[] = [];

  if (article.warehouseLocation?.trim()) {
    parts.push(article.warehouseLocation.trim());
  }
  if (article.rack?.trim()) {
    parts.push(`Rayonnage ${article.rack.trim()}`);
  }
  if (article.shelf?.trim()) {
    parts.push(`Étagère ${article.shelf.trim()}`);
  }
  if (article.bin?.trim()) {
    parts.push(`Case ${article.bin.trim()}`);
  }

  if (parts.length > 0) {
    return parts.join(' / ');
  }

  if (article.defaultLocation?.trim()) {
    return article.defaultLocation.trim();
  }

  return 'Non renseigné';
}

