import React, { useState, useMemo, useRef } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleBrandOffer } from '../../types';
import { formatAED, roundAED, exportToCSV } from '../../utils/formatters';
import { cleanBrandName, getArticleBrandOffers } from '../../utils/articleHelpers';
import {
  X,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Check,
  Loader2,
  ArrowRight,
  Link2,
} from 'lucide-react';

interface InvoicePdfPriceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

interface QueuedFile {
  id: string;
  file: File;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR';
  extractedCount?: number;
  invoiceNumber?: string;
  supplierName?: string;
  currency?: string;
  error?: string;
}

interface ExtractedRow {
  rowId: string;
  sourceFileName: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  originalCurrency: string;
  originalUnitPrice: number;
  unitPriceAed: number;
  partReference: string;
  description: string;
  brand: string;
  quantity: number;
  matchedArticleId: string | null;
  matchType: 'EXACT' | 'COMPATIBLE' | 'MANUAL' | 'UNMATCHED';
  targetBrand: string;
  selected: boolean;
}

const DEFAULT_RATES_TO_AED: Record<string, number> = {
  AED: 1,
  USD: 3.6725,
  EUR: 4.0,
  GBP: 4.65,
  SAR: 0.98,
};

function normalizeRef(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error(`Impossible de lire le fichier ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export const InvoicePdfPriceImportModal: React.FC<InvoicePdfPriceImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { articles, updateArticle } = useStock();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>(DEFAULT_RATES_TO_AED);
  const [linkingRowId, setLinkingRowId] = useState<string | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [appliedSummary, setAppliedSummary] = useState<{ updatedCount: number; skippedCount: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Build fast lookup maps for catalog references
  const catalogIndex = useMemo(() => {
    const byMainRef = new Map<string, Article>();
    const byCompatRef = new Map<string, Article>();
    const byId = new Map<string, Article>();

    for (const art of articles) {
      if (art.status === 'archived') continue;
      byId.set(art.id, art);
      const normMain = normalizeRef(art.mainReference);
      if (normMain && !byMainRef.has(normMain)) {
        byMainRef.set(normMain, art);
      }
      if (Array.isArray(art.equivalentReferences)) {
        for (const cref of art.equivalentReferences) {
          const normC = normalizeRef(cref);
          if (normC && !byCompatRef.has(normC)) {
            byCompatRef.set(normC, art);
          }
          // Also index individual reference codes inside entries like "Donaldson P551313"
          const tokens = String(cref || '').split(/[\s,;:/]+/);
          for (const tok of tokens) {
            const normTok = normalizeRef(tok);
            if (normTok.length >= 4 && !byCompatRef.has(normTok)) {
              byCompatRef.set(normTok, art);
            }
          }
        }
      }
      const offers = getArticleBrandOffers(art);
      for (const offer of offers) {
        if (offer.brandReference) {
          const normB = normalizeRef(offer.brandReference);
          if (normB && !byCompatRef.has(normB)) {
            byCompatRef.set(normB, art);
          }
        }
      }
    }

    return { byMainRef, byCompatRef, byId };
  }, [articles]);

  const matchArticleForReference = (
    rawRef: string,
    extractedBrand: string
  ): { article: Article | null; matchType: ExtractedRow['matchType']; targetBrand: string } => {
    const norm = normalizeRef(rawRef);
    if (!norm) return { article: null, matchType: 'UNMATCHED', targetBrand: '' };

    let matched = catalogIndex.byMainRef.get(norm) || null;
    let matchType: ExtractedRow['matchType'] = matched ? 'EXACT' : 'UNMATCHED';

    if (!matched) {
      matched = catalogIndex.byCompatRef.get(norm) || null;
      if (matched) matchType = 'COMPATIBLE';
    }

    if (!matched) {
      return { article: null, matchType: 'UNMATCHED', targetBrand: cleanBrandName(extractedBrand) };
    }

    const offers = getArticleBrandOffers(matched);
    const normExtractedBrand = cleanBrandName(extractedBrand).toLowerCase();
    const matchingOffer = normExtractedBrand
      ? offers.find((o) => cleanBrandName(o.brand).toLowerCase() === normExtractedBrand)
      : undefined;

    const targetBrand = matchingOffer
      ? cleanBrandName(matchingOffer.brand)
      : cleanBrandName(offers[0]?.brand || matched.brand);

    return { article: matched, matchType, targetBrand };
  };

  // Non-AED currencies detected across extracted rows
  const foreignCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const r of extractedRows) {
      if (r.originalCurrency && r.originalCurrency !== 'AED') {
        set.add(r.originalCurrency);
      }
    }
    return Array.from(set);
  }, [extractedRows]);

  const counts = useMemo(() => {
    const matched = extractedRows.filter((r) => !!r.matchedArticleId).length;
    const unmatched = extractedRows.length - matched;
    const selected = extractedRows.filter((r) => r.selected && !!r.matchedArticleId && r.unitPriceAed > 0).length;
    return { total: extractedRows.length, matched, unmatched, selected };
  }, [extractedRows]);

  const displayedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return extractedRows.filter((row) => {
      if (filterTab === 'MATCHED' && !row.matchedArticleId) return false;
      if (filterTab === 'UNMATCHED' && !!row.matchedArticleId) return false;
      if (q) {
        const art = row.matchedArticleId ? catalogIndex.byId.get(row.matchedArticleId) : null;
        const hay = `${row.partReference} ${row.description} ${row.brand} ${row.invoiceNumber} ${row.supplierName} ${art?.mainReference || ''} ${art?.designation || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [extractedRows, filterTab, searchQuery, catalogIndex]);

  const linkCandidates = useMemo(() => {
    const q = linkSearchQuery.trim().toLowerCase();
    const normQ = normalizeRef(linkSearchQuery);
    const active = articles.filter((a) => a.status !== 'archived');
    if (!q) return active.slice(0, 12);
    return active
      .filter((a) => {
        if (normalizeRef(a.mainReference).includes(normQ)) return true;
        if (a.designation.toLowerCase().includes(q)) return true;
        if (a.brand?.toLowerCase().includes(q)) return true;
        if (a.equivalentReferences?.some((c) => normalizeRef(c).includes(normQ))) return true;
        return false;
      })
      .slice(0, 15);
  }, [articles, linkSearchQuery]);

  if (!isOpen) return null;

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setGlobalError(null);
    setAppliedSummary(null);

    const newFiles: QueuedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const lower = f.name.toLowerCase();
      const isValid =
        f.type === 'application/pdf' ||
        f.type.startsWith('image/') ||
        lower.endsWith('.pdf') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp');
      if (!isValid) continue;
      if (f.size > 18 * 1024 * 1024) {
        setGlobalError(`Le fichier "${f.name}" dépasse 18 Mo. Essayez de le scinder ou de le compresser.`);
        continue;
      }
      newFiles.push({
        id: `inv-file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        status: 'PENDING',
      });
    }

    if (newFiles.length > 0) {
      setQueuedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRunExtraction = async () => {
    const pending = queuedFiles.filter((f) => f.status === 'PENDING' || f.status === 'ERROR');
    if (pending.length === 0) return;

    setIsExtracting(true);
    setGlobalError(null);
    setAppliedSummary(null);

    const newlyExtracted: ExtractedRow[] = [];

    for (let idx = 0; idx < pending.length; idx++) {
      const qf = pending[idx];
      setExtractProgress({ current: idx + 1, total: pending.length, fileName: qf.file.name });
      setQueuedFiles((prev) =>
        prev.map((item) =>
          item.id === qf.id ? { ...item, status: 'PROCESSING', error: undefined } : item
        )
      );

      try {
        const dataBase64 = await readFileAsBase64(qf.file);
        const mimeType =
          qf.file.type ||
          (qf.file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

        const resp = await fetch('/api/extract-invoice-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: qf.file.name,
            mimeType,
            dataBase64,
          }),
        });

        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(payload?.error || `Erreur serveur (${resp.status})`);
        }

        const currency = String(payload.currency || 'AED').toUpperCase();
        const rate = currencyRates[currency] ?? (currency === 'AED' ? 1 : 1);
        const items: any[] = Array.isArray(payload.items) ? payload.items : [];

        for (let lineIdx = 0; lineIdx < items.length; lineIdx++) {
          const it = items[lineIdx];
          const origPrice = roundAED(Number(it.unitPrice) || 0);
          const priceAed = roundAED(origPrice * rate);
          const { article, matchType, targetBrand } = matchArticleForReference(
            it.partReference,
            it.brand || ''
          );

          newlyExtracted.push({
            rowId: `${qf.id}-line-${lineIdx}`,
            sourceFileName: qf.file.name,
            supplierName: payload.supplierName || '',
            invoiceNumber: payload.invoiceNumber || '',
            invoiceDate: payload.invoiceDate || '',
            originalCurrency: currency,
            originalUnitPrice: origPrice,
            unitPriceAed: priceAed,
            partReference: it.partReference || '',
            description: it.description || '',
            brand: cleanBrandName(it.brand || ''),
            quantity: Math.max(1, Number(it.quantity) || 1),
            matchedArticleId: article ? article.id : null,
            matchType,
            targetBrand,
            selected: Boolean(article && priceAed > 0),
          });
        }

        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.id === qf.id
              ? {
                  ...item,
                  status: 'DONE',
                  extractedCount: items.length,
                  invoiceNumber: payload.invoiceNumber || '',
                  supplierName: payload.supplierName || '',
                  currency,
                }
              : item
          )
        );
      } catch (err: any) {
        const errMsg = err?.message || 'Erreur lors de la lecture de la facture.';
        setQueuedFiles((prev) =>
          prev.map((item) =>
            item.id === qf.id ? { ...item, status: 'ERROR', error: errMsg } : item
          )
        );
        setGlobalError(errMsg);
      }
    }

    if (newlyExtracted.length > 0) {
      setExtractedRows((prev) => [...prev, ...newlyExtracted]);
    }

    setExtractProgress(null);
    setIsExtracting(false);
  };

  const handleUpdateCurrencyRate = (currency: string, newRateRaw: string) => {
    const parsed = parseFloat(newRateRaw.replace(',', '.'));
    const safeRate = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setCurrencyRates((prev) => ({ ...prev, [currency]: safeRate }));
    if (safeRate > 0) {
      setExtractedRows((prev) =>
        prev.map((row) =>
          row.originalCurrency === currency
            ? { ...row, unitPriceAed: roundAED(row.originalUnitPrice * safeRate) }
            : row
        )
      );
    }
  };

  const handleUpdateRowPrice = (rowId: string, rawVal: string) => {
    const parsed = parseFloat(rawVal.replace(',', '.'));
    setExtractedRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId ? { ...r, unitPriceAed: isNaN(parsed) ? 0 : Math.max(0, parsed) } : r
      )
    );
  };

  const handleToggleRow = (rowId: string) => {
    setExtractedRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleToggleAllDisplayed = (checked: boolean) => {
    const visibleIds = new Set(displayedRows.filter((r) => !!r.matchedArticleId).map((r) => r.rowId));
    setExtractedRows((prev) =>
      prev.map((r) => (visibleIds.has(r.rowId) ? { ...r, selected: checked } : r))
    );
  };

  const handleManualLinkArticle = (rowId: string, article: Article) => {
    const offers = getArticleBrandOffers(article);
    setExtractedRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const normBrand = cleanBrandName(r.brand).toLowerCase();
        const matchedOffer = normBrand
          ? offers.find((o) => cleanBrandName(o.brand).toLowerCase() === normBrand)
          : undefined;
        return {
          ...r,
          matchedArticleId: article.id,
          matchType: 'MANUAL',
          targetBrand: matchedOffer
            ? cleanBrandName(matchedOffer.brand)
            : cleanBrandName(offers[0]?.brand || article.brand),
          selected: r.unitPriceAed > 0,
        };
      })
    );
    setLinkingRowId(null);
    setLinkSearchQuery('');
  };

  const handleChangeTargetBrand = (rowId: string, nextBrand: string) => {
    setExtractedRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, targetBrand: nextBrand } : r))
    );
  };

  const getCurrentPurchasePriceForRow = (row: ExtractedRow): number => {
    if (!row.matchedArticleId) return 0;
    const art = catalogIndex.byId.get(row.matchedArticleId);
    if (!art) return 0;
    const offers = getArticleBrandOffers(art);
    const normTarget = cleanBrandName(row.targetBrand).toLowerCase();
    const offer = offers.find((o) => cleanBrandName(o.brand).toLowerCase() === normTarget);
    return offer ? offer.purchasePrice : art.purchasePrice || 0;
  };

  const handleApplyPurchasePrices = () => {
    const rowsToApply = extractedRows.filter(
      (r) => r.selected && !!r.matchedArticleId && r.unitPriceAed > 0
    );
    if (rowsToApply.length === 0) return;

    // Group updates by articleId so multiple brands of the same article are merged cleanly
    const byArticle = new Map<string, ExtractedRow[]>();
    for (const row of rowsToApply) {
      const id = row.matchedArticleId!;
      const list = byArticle.get(id) || [];
      list.push(row);
      byArticle.set(id, list);
    }

    let updatedCount = 0;

    for (const [articleId, rows] of byArticle.entries()) {
      const art = catalogIndex.byId.get(articleId);
      if (!art) continue;

      const existingOffers: ArticleBrandOffer[] = getArticleBrandOffers(art).map((o) => ({
        ...o,
        brand: cleanBrandName(o.brand),
      }));

      let rootPurchasePrice = art.purchasePrice || 0;
      let nextPreferredSupplier = art.preferredSupplier;
      let nextInvoiceNumber = art.invoiceNumber;

      for (const row of rows) {
        const cleanPrice = roundAED(row.unitPriceAed);
        const normTarget = cleanBrandName(row.targetBrand).toLowerCase();

        const offerIdx = existingOffers.findIndex(
          (o) => cleanBrandName(o.brand).toLowerCase() === normTarget
        );

        if (offerIdx >= 0) {
          existingOffers[offerIdx] = {
            ...existingOffers[offerIdx],
            purchasePrice: cleanPrice,
            invoiceNumber: row.invoiceNumber || existingOffers[offerIdx].invoiceNumber,
            preferredSupplier: row.supplierName || existingOffers[offerIdx].preferredSupplier,
          };
          if (offerIdx === 0 || existingOffers[offerIdx].isDefault || existingOffers.length === 1) {
            rootPurchasePrice = cleanPrice;
          }
        } else {
          // If no brand offer matched, update primary offer and root price
          if (existingOffers.length > 0) {
            existingOffers[0] = {
              ...existingOffers[0],
              purchasePrice: cleanPrice,
              invoiceNumber: row.invoiceNumber || existingOffers[0].invoiceNumber,
              preferredSupplier: row.supplierName || existingOffers[0].preferredSupplier,
            };
          }
          rootPurchasePrice = cleanPrice;
        }

        if (!nextPreferredSupplier && row.supplierName) {
          nextPreferredSupplier = row.supplierName;
        }
        if (row.invoiceNumber) {
          nextInvoiceNumber = row.invoiceNumber;
        }
      }

      const res = updateArticle(articleId, {
        purchasePrice: rootPurchasePrice,
        brandOffers: existingOffers,
        preferredSupplier: nextPreferredSupplier,
        invoiceNumber: nextInvoiceNumber,
      });

      if (res.success) {
        updatedCount += rows.length;
      }
    }

    const skippedCount = extractedRows.length - updatedCount;
    setAppliedSummary({ updatedCount, skippedCount });

    if (updatedCount > 0 && onSuccess) {
      onSuccess(
        `${updatedCount} prix d'achat (AED) mis à jour automatiquement depuis vos factures PDF.`
      );
    }
  };

  const handleExportExtractedCSV = () => {
    if (extractedRows.length === 0) return;
    const headers = [
      'Fichier Facture',
      'N° Facture',
      'Fournisseur',
      'Date Facture',
      'Référence Facture',
      'Désignation Facture',
      'Marque Facture',
      'Quantité',
      'Devise Origine',
      'Prix Origine',
      'Prix Achat Unitaire (AED)',
      'Pièce Catalogue Associée',
      'Prix Actuel (AED)',
      'Statut',
    ];
    const rows = extractedRows.map((r) => {
      const art = r.matchedArticleId ? catalogIndex.byId.get(r.matchedArticleId) : null;
      return [
        r.sourceFileName,
        r.invoiceNumber,
        r.supplierName,
        r.invoiceDate,
        r.partReference,
        r.description,
        r.brand,
        r.quantity,
        r.originalCurrency,
        r.originalUnitPrice,
        r.unitPriceAed,
        art ? `${art.mainReference} — ${art.designation}` : 'Non trouvée',
        getCurrentPurchasePriceForRow(r),
        r.matchedArticleId ? 'Trouvée' : 'Non trouvée',
      ];
    });
    exportToCSV(`extraction_prix_achat_AED_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleResetAll = () => {
    setQueuedFiles([]);
    setExtractedRows([]);
    setAppliedSummary(null);
    setGlobalError(null);
    setLinkingRowId(null);
  };

  const pendingCount = queuedFiles.filter((f) => f.status === 'PENDING' || f.status === 'ERROR').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="bg-white border border-[#111111] shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Industrial Header */}
        <div className="px-5 py-4 bg-[#111111] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-7 bg-[#FFCD11] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FFCD11] shrink-0" />
                <span>Extraction rapide des Prix d&apos;Achat (AED) depuis Factures PDF</span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                Déposez une ou plusieurs factures fournisseurs (PDF ou photo) — correspondance automatique par référence pièce
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-[#F4F4F4]">
          {/* Success Confirmation Banner */}
          {appliedSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold">
                    {appliedSummary.updatedCount} prix d&apos;achat en AED enregistré
                    {appliedSummary.updatedCount > 1 ? 's' : ''} dans le catalogue !
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    Les fiches pièces et offres constructeurs sont immédiatement synchronisées.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                >
                  Importer d&apos;autres factures
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-bold bg-[#111111] text-white hover:bg-[#2A2A2A] cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {globalError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{globalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="text-rose-500 hover:text-rose-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Dropzone & File Queue */}
          <div className="bg-white border border-[#E0E0E0] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="label text-[#7A5C00]">Étape 1</span>
                <h4 className="text-sm font-bold text-[#111111] mt-0.5">
                  Sélectionnez vos factures d&apos;achat (PDF ou photos)
                </h4>
              </div>
              {queuedFiles.length > 0 && !isExtracting && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="text-xs font-semibold text-[#595959] hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Réinitialiser
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => !isExtracting && fileInputRef.current?.click()}
              className={`border-2 border-dashed p-5 sm:p-6 text-center transition-colors ${
                isExtracting
                  ? 'border-[#E0E0E0] bg-[#F8F8F8] cursor-wait opacity-70'
                  : 'border-[#CCCCCC] hover:border-[#FFCD11] hover:bg-[#FFF9DF]/40 cursor-pointer bg-[#FAFAFA]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf"
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
              <Upload className="w-7 h-7 text-[#7A5C00] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#111111]">
                Glissez vos factures PDF ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-[#595959] mt-1">
                Prend en charge les factures PDF multi-pages (Dubaï / EAU) ainsi que les photos JPG/PNG — plusieurs fichiers possibles à la fois
              </p>
            </div>

            {/* Queued Files List */}
            {queuedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="divide-y divide-[#EBEBEB] border border-[#E0E0E0] bg-white">
                  {queuedFiles.map((qf) => (
                    <div
                      key={qf.id}
                      className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileText className="w-4 h-4 text-[#7A5C00] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-semibold text-[#111111] block truncate">
                            {qf.file.name}
                          </span>
                          <span className="text-[11px] font-mono text-[#595959]">
                            {(qf.file.size / 1024).toFixed(0)} Ko
                            {qf.invoiceNumber ? ` • Fact. ${qf.invoiceNumber}` : ''}
                            {qf.supplierName ? ` • ${qf.supplierName}` : ''}
                            {qf.currency ? ` • ${qf.currency}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {qf.status === 'PENDING' && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#F4F4F4] text-[#595959] border border-[#E0E0E0]">
                            Prêt
                          </span>
                        )}
                        {qf.status === 'PROCESSING' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#FFF9DF] text-[#7A5C00] border border-[#E5C130]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Lecture en cours...
                          </span>
                        )}
                        {qf.status === 'DONE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {qf.extractedCount ?? 0} ligne{(qf.extractedCount ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                        {qf.status === 'ERROR' && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 max-w-[240px] truncate"
                            title={qf.error}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {qf.error || 'Erreur'}
                          </span>
                        )}
                        {!isExtracting && qf.status !== 'DONE' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQueuedFile(qf.id)}
                            className="p-1 text-[#595959] hover:text-rose-600 cursor-pointer"
                            title="Retirer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extract CTA */}
                {pendingCount > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {extractProgress ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#7A5C00]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          Analyse facture {extractProgress.current}/{extractProgress.total} :{' '}
                          <strong className="font-mono">{extractProgress.fileName}</strong>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#595959]">
                        {pendingCount} fichier{pendingCount > 1 ? 's' : ''} prêt
                        {pendingCount > 1 ? 's' : ''} à analyser
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={handleRunExtraction}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFCD11] hover:bg-[#E5B700] disabled:opacity-60 text-[#111111] font-bold text-xs uppercase tracking-[0.04em] border border-[#111111] transition-colors cursor-pointer"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Extraction en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Extraire les références &amp; prix ({pendingCount} facture
                            {pendingCount > 1 ? 's' : ''})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Verification & Matching Table */}
          {extractedRows.length > 0 && (
            <div className="bg-white border border-[#E0E0E0] p-4 sm:p-5 space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F8F8F8] border border-[#E0E0E0]">
                  <span className="label block">Lignes extraites</span>
                  <span className="font-mono text-xl font-bold text-[#111111] tabular-nums">
                    {counts.total}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200">
                  <span className="label block text-emerald-800">Trouvées (Catalogue)</span>
                  <span className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                    {counts.matched}
                  </span>
                </div>
                <div className="p-3 bg-[#FFF9DF] border border-[#E5C130]">
                  <span className="label block text-[#7A5C00]">Non trouvées</span>
                  <span className="font-mono text-xl font-bold text-[#7A5C00] tabular-nums">
                    {counts.unmatched}
                  </span>
                </div>
                <div className="p-3 bg-[#111111] text-white border border-[#111111]">
                  <span className="label block text-[#FFCD11]">Sélectionnées à appliquer</span>
                  <span className="font-mono text-xl font-bold text-white tabular-nums">
                    {counts.selected}
                  </span>
                </div>
              </div>

              {/* Optional Currency Conversion Bar (if any invoice is USD/EUR instead of AED) */}
              {foreignCurrencies.length > 0 && (
                <div className="p-3 bg-[#FFF9DF] border border-[#E5C130] flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#7A5C00]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Devise étrangère détectée — conversion automatique vers AED :</span>
                  </div>
                  {foreignCurrencies.map((curr) => (
                    <div key={curr} className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 border border-[#E5C130]">
                      <span className="font-mono font-bold text-[#111111]">1 {curr} =</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={currencyRates[curr] ?? 1}
                        onChange={(e) => handleUpdateCurrencyRate(curr, e.target.value)}
                        className="w-16 px-1.5 py-0.5 font-mono font-bold text-right border border-[#CCCCCC] text-[#111111]"
                      />
                      <span className="font-mono font-bold text-[#7A5C00]">AED</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Filter & Search Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#595959] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par référence, pièce, facture..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#CCCCCC] focus:outline-none focus:border-[#111111]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'Toutes', count: counts.total },
                      { id: 'MATCHED', label: 'Trouvées', count: counts.matched },
                      { id: 'UNMATCHED', label: 'Non trouvées', count: counts.unmatched },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFilterTab(t.id)}
                      className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                        filterTab === t.id
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#595959] border-[#CCCCCC] hover:border-[#111111]'
                      }`}
                    >
                      {t.label} <span className="ml-1 font-mono opacity-80">{t.count}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleExportExtractedCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-[#CCCCCC] hover:border-[#111111] text-[#111111] cursor-pointer"
                    title="Exporter les résultats extraits au format Excel / CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Editable Table */}
              <div className="border border-[#E0E0E0] overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F4F4F4] border-b border-[#E0E0E0] text-[10px] font-mono uppercase tracking-wider text-[#595959]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            displayedRows.some((r) => !!r.matchedArticleId) &&
                            displayedRows
                              .filter((r) => !!r.matchedArticleId)
                              .every((r) => r.selected)
                          }
                          onChange={(e) => handleToggleAllDisplayed(e.target.checked)}
                          className="accent-[#111111] cursor-pointer"
                          title="Tout sélectionner / désélectionner"
                        />
                      </th>
                      <th className="py-2.5 px-3">Réf. Facture &amp; Désignation</th>
                      <th className="py-2.5 px-3">Pièce Catalogue Associée</th>
                      <th className="py-2.5 px-3 text-right w-32">Prix Actuel</th>
                      <th className="py-2.5 px-3 text-right w-40">Nouveau Prix (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBEBEB]">
                    {displayedRows.map((row) => {
                      const matchedArt = row.matchedArticleId
                        ? catalogIndex.byId.get(row.matchedArticleId) || null
                        : null;
                      const offers = matchedArt ? getArticleBrandOffers(matchedArt) : [];
                      const currentPrice = getCurrentPurchasePriceForRow(row);
                      const isLinkingThis = linkingRowId === row.rowId;

                      return (
                        <tr
                          key={row.rowId}
                          className={
                            row.selected && matchedArt
                              ? 'bg-[#FFF9DF]/35'
                              : !matchedArt
                              ? 'bg-[#FAFAFA]'
                              : ''
                          }
                        >
                          <td className="py-2.5 px-3 text-center align-top">
                            <input
                              type="checkbox"
                              disabled={!matchedArt}
                              checked={row.selected && !!matchedArt}
                              onChange={() => handleToggleRow(row.rowId)}
                              className="accent-[#111111] mt-1 cursor-pointer disabled:opacity-30"
                            />
                          </td>

                          <td className="py-2.5 px-3 align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-[#111111]">
                                {row.partReference}
                              </span>
                              {row.brand && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#F4F4F4] border border-[#E0E0E0] text-[#333333]">
                                  {row.brand}
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-[#595959]">
                                ×{row.quantity}
                              </span>
                            </div>
                            {row.description && (
                              <div className="text-[11px] text-[#595959] mt-0.5 line-clamp-1">
                                {row.description}
                              </div>
                            )}
                            <div className="text-[10px] font-mono text-[#7A5C00] mt-0.5">
                              {row.invoiceNumber ? `Fact. ${row.invoiceNumber}` : row.sourceFileName}
                              {row.originalCurrency !== 'AED'
                                ? ` • Origine : ${row.originalUnitPrice} ${row.originalCurrency}`
                                : ''}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-top">
                            {matchedArt ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-emerald-800">
                                    {matchedArt.mainReference}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                                      row.matchType === 'EXACT'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : row.matchType === 'COMPATIBLE'
                                        ? 'bg-[#FFF9DF] text-[#7A5C00] border-[#E5C130]'
                                        : 'bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    {row.matchType === 'EXACT'
                                      ? 'Exact'
                                      : row.matchType === 'COMPATIBLE'
                                      ? 'Équivalence'
                                      : 'Manuel'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLinkingRowId(isLinkingThis ? null : row.rowId);
                                      setLinkSearchQuery(row.partReference);
                                    }}
                                    className="text-[10px] text-[#595959] hover:text-[#111111] underline cursor-pointer ml-auto"
                                  >
                                    Changer
                                  </button>
                                </div>
                                <div className="text-[11px] text-[#111111] line-clamp-1">
                                  {matchedArt.designation}
                                </div>
                                {offers.length > 1 && (
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    <span className="text-[10px] text-[#595959]">Marque cible :</span>
                                    <select
                                      value={row.targetBrand}
                                      onChange={(e) =>
                                        handleChangeTargetBrand(row.rowId, e.target.value)
                                      }
                                      className="text-[11px] font-semibold px-1.5 py-0.5 border border-[#CCCCCC] bg-white text-[#111111]"
                                    >
                                      {offers.map((o, idx) => (
                                        <option key={o.id || idx} value={cleanBrandName(o.brand)}>
                                          {cleanBrandName(o.brand) || 'Standard'}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A5C00]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Non trouvée dans le catalogue
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLinkingRowId(isLinkingThis ? null : row.rowId);
                                      setLinkSearchQuery(row.partReference);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold bg-white hover:bg-[#FFF9DF] text-[#111111] border border-[#CCCCCC] cursor-pointer"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    Associer manuellement
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Inline Manual Article Linker */}
                            {isLinkingThis && (
                              <div className="mt-2 p-2 bg-white border border-[#111111] shadow-md space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={linkSearchQuery}
                                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                                    placeholder="Chercher réf. ou nom..."
                                    className="flex-1 px-2 py-1 text-xs border border-[#CCCCCC] focus:outline-none focus:border-[#111111]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setLinkingRowId(null)}
                                    className="p-1 text-[#595959] hover:text-[#111111] cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="max-h-36 overflow-y-auto divide-y divide-[#F0F0F0]">
                                  {linkCandidates.length === 0 ? (
                                    <div className="py-2 text-center text-[11px] text-[#595959]">
                                      Aucune pièce trouvée
                                    </div>
                                  ) : (
                                    linkCandidates.map((cand) => (
                                      <button
                                        key={cand.id}
                                        type="button"
                                        onClick={() => handleManualLinkArticle(row.rowId, cand)}
                                        className="w-full text-left px-2 py-1.5 hover:bg-[#FFF9DF] flex items-center justify-between gap-2 cursor-pointer"
                                      >
                                        <span className="font-mono font-bold text-[#111111] shrink-0">
                                          {cand.mainReference}
                                        </span>
                                        <span className="text-[11px] text-[#595959] truncate flex-1">
                                          {cand.designation}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right align-top font-mono text-[#595959] tabular-nums whitespace-nowrap">
                            {matchedArt ? formatAED(currentPrice) : '—'}
                          </td>

                          <td className="py-2.5 px-3 text-right align-top">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {matchedArt && currentPrice !== row.unitPriceAed && (
                                <ArrowRight className="w-3 h-3 text-[#7A5C00] shrink-0" />
                              )}
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.unitPriceAed}
                                onChange={(e) => handleUpdateRowPrice(row.rowId, e.target.value)}
                                className="w-24 px-2 py-1 text-right font-mono font-bold text-xs bg-white border border-[#CCCCCC] focus:border-[#111111] focus:outline-none tabular-nums"
                              />
                              <span className="font-mono text-[10px] font-bold text-[#7A5C00]">
                                AED
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="px-5 py-3.5 bg-white border-t border-[#E0E0E0] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-[#595959]">
            Les prix de vente en <strong>FCFA</strong> ne sont pas modifiés — seuls les prix d&apos;achat en <strong>AED</strong> sont mis à jour.
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#595959] bg-white border border-[#CCCCCC] hover:border-[#111111] cursor-pointer"
            >
              Fermer
            </button>
            {extractedRows.length > 0 && (
              <button
                type="button"
                disabled={counts.selected === 0}
                onClick={handleApplyPurchasePrices}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-[0.04em] bg-[#FFCD11] hover:bg-[#E5B700] disabled:opacity-40 text-[#111111] border border-[#111111] transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  Appliquer les prix d&apos;achat ({counts.selected} pièce
                  {counts.selected > 1 ? 's' : ''})
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
