import React, { useState, useMemo, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, Warehouse } from '../../types';
import { SearchField } from '../common/SearchField';
import { NumericInput } from '../common/NumericInput';
import { OrderStatusBadge } from '../common/OrderStatusBadge';
import { TablePagination, usePagination } from '../common/TablePagination';
import {
  getSingleWarehouseBrandLocation,
  stripWarehousePrefix,
} from '../../utils/articleHelpers';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import {
  ArrowLeftRight,
  Building2,
  CheckSquare,
  Download,
  Printer,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  X,
  RotateCcw,
  Layers,
} from 'lucide-react';

interface BoutiqueReplenishmentViewProps {
  onOpenPurchaseOrder?: (articleId: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
  onSuccess?: (title: string, message?: string) => void;
  onError?: (title: string, message?: string) => void;
}

type FilterTab = 'under_norm' | 'transferable' | 'to_order' | 'rupture' | 'all';

interface DepotAvailability {
  warehouse: Warehouse;
  qty: number;
  location: string;
}

interface ReplenishmentRow {
  article: Article;
  boutiqueStock: number;
  boutiqueNorm: number;
  hasCustomNorm: boolean;
  missingQty: number;
  otherDepots: DepotAvailability[];
  totalOtherDepotStock: number;
  transferableQty: number;
  remainingShortage: number;
  boutiqueLocation: string;
  isUnderNorm: boolean;
  isRuptureBoutique: boolean;
}

function generateReplenishmentDocRef(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `BR-${y}${m}${d}-${rand}`;
}

export const BoutiqueReplenishmentView: React.FC<BoutiqueReplenishmentViewProps> = ({
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
  onSuccess,
  onError,
}) => {
  const {
    articles,
    warehouses,
    stocks,
    companyInfo,
    currentUser,
    boutiqueWarehouseId,
    setBoutiqueWarehouseId,
    getBoutiqueMinThreshold,
    getStockForArticleAndWarehouse,
    getActiveOrderForArticle,
    recordTransfer,
    recordBatchTransfer,
    bulkUpdateWarehouseMinThresholds,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('under_norm');
  const [sourceDepotFilter, setSourceDepotFilter] = useState<string>('ALL');

  // Row selection & per-row overrides (source warehouse & quantity to transfer)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [batchDocRef, setBatchDocRef] = useState<string>(() => generateReplenishmentDocRef());

  // Modals
  const [isPickingListOpen, setIsPickingListOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isBulkNormModalOpen, setIsBulkNormModalOpen] = useState(false);
  const [bulkNormValue, setBulkNormValue] = useState<number>(5);
  const [bulkNormScope, setBulkNormScope] = useState<'selected' | 'filtered' | 'all'>('filtered');

  const boutiqueWarehouse = useMemo(
    () => warehouses.find((w) => w.id === boutiqueWarehouseId) || warehouses[0],
    [warehouses, boutiqueWarehouseId]
  );

  const otherWarehouses = useMemo(
    () => warehouses.filter((w) => w.id !== boutiqueWarehouse?.id),
    [warehouses, boutiqueWarehouse]
  );

  // Reset overrides when changing the target boutique warehouse
  useEffect(() => {
    setSelectedIds(new Set());
    setSourceOverrides({});
    setQtyOverrides({});
    setSourceDepotFilter('ALL');
  }, [boutiqueWarehouseId]);

  const activeArticles = useMemo(
    () => articles.filter((a) => a.status === 'active'),
    [articles]
  );

  // Build stock index by articleId for O(1) lookup
  const stocksByArticleId = useMemo(() => {
    const map = new Map<string, typeof stocks>();
    for (const s of stocks) {
      const list = map.get(s.articleId);
      if (list) list.push(s);
      else map.set(s.articleId, [s]);
    }
    return map;
  }, [stocks]);

  // Compute full replenishment data for every active article
  const allRows: ReplenishmentRow[] = useMemo(() => {
    if (!boutiqueWarehouse) return [];
    const targetWhId = boutiqueWarehouse.id;

    return activeArticles
      .map((article) => {
        const artStocks = stocksByArticleId.get(article.id) || [];
        const boutiqueStockRecord = artStocks.find((s) => s.warehouseId === targetWhId);
        const boutiqueStock = Math.max(
          0,
          Number(boutiqueStockRecord?.quantity ?? getStockForArticleAndWarehouse(article.id, targetWhId)) || 0
        );
        const boutiqueNorm = getBoutiqueMinThreshold(article, targetWhId);
        const hasCustomNorm = Boolean(
          article.warehouseMinThresholds &&
            typeof article.warehouseMinThresholds[targetWhId] === 'number'
        );
        const missingQty = Math.max(0, boutiqueNorm - boutiqueStock);

        const otherDepots: DepotAvailability[] = [];
        for (const wh of otherWarehouses) {
          const st = artStocks.find((s) => s.warehouseId === wh.id);
          const qty = Math.max(0, Number(st?.quantity) || 0);
          if (qty > 0) {
            const rawLoc = getSingleWarehouseBrandLocation(
              st,
              article,
              article.brand || '',
              wh.id,
              warehouses,
              artStocks
            );
            otherDepots.push({
              warehouse: wh,
              qty,
              location: stripWarehousePrefix(rawLoc, warehouses, wh.name) || '—',
            });
          }
        }
        otherDepots.sort((a, b) => b.qty - a.qty);

        const totalOtherDepotStock = otherDepots.reduce((sum, d) => sum + d.qty, 0);
        const transferableQty = Math.min(missingQty, totalOtherDepotStock);
        const remainingShortage = Math.max(0, missingQty - totalOtherDepotStock);

        const rawBoutiqueLoc = getSingleWarehouseBrandLocation(
          boutiqueStockRecord,
          article,
          article.brand || '',
          targetWhId,
          warehouses,
          artStocks
        );
        const boutiqueLocation =
          stripWarehousePrefix(rawBoutiqueLoc, warehouses, boutiqueWarehouse.name) || '';

        return {
          article,
          boutiqueStock,
          boutiqueNorm,
          hasCustomNorm,
          missingQty,
          otherDepots,
          totalOtherDepotStock,
          transferableQty,
          remainingShortage,
          boutiqueLocation,
          isUnderNorm: boutiqueNorm > 0 && boutiqueStock < boutiqueNorm,
          isRuptureBoutique: boutiqueNorm > 0 && boutiqueStock === 0,
        };
      })
      .sort((a, b) => {
        // Priority: transferable under-norm first, then rupture, then highest missing qty
        if (a.isUnderNorm !== b.isUnderNorm) return a.isUnderNorm ? -1 : 1;
        if (a.transferableQty > 0 !== b.transferableQty > 0) {
          return a.transferableQty > 0 ? -1 : 1;
        }
        if (a.isRuptureBoutique !== b.isRuptureBoutique) {
          return a.isRuptureBoutique ? -1 : 1;
        }
        if (b.missingQty !== a.missingQty) return b.missingQty - a.missingQty;
        return a.article.mainReference.localeCompare(b.article.mainReference);
      });
  }, [
    activeArticles,
    boutiqueWarehouse,
    otherWarehouses,
    warehouses,
    stocksByArticleId,
    getStockForArticleAndWarehouse,
    getBoutiqueMinThreshold,
  ]);

  // Global KPI stats
  const stats = useMemo(() => {
    const underNorm = allRows.filter((r) => r.isUnderNorm);
    const transferable = underNorm.filter((r) => r.totalOtherDepotStock > 0);
    const toOrder = underNorm.filter((r) => r.remainingShortage > 0);
    const rupture = underNorm.filter((r) => r.isRuptureBoutique);
    const totalTransferableUnits = transferable.reduce((sum, r) => sum + r.transferableQty, 0);
    return {
      underNormCount: underNorm.length,
      transferableCount: transferable.length,
      toOrderCount: toOrder.length,
      ruptureCount: rupture.length,
      totalTransferableUnits,
    };
  }, [allRows]);

  // Filtered rows according to active tab, search query, and source depot filter
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((row) => {
      if (activeFilter === 'under_norm' && !row.isUnderNorm) return false;
      if (activeFilter === 'transferable' && !(row.isUnderNorm && row.totalOtherDepotStock > 0)) {
        return false;
      }
      if (activeFilter === 'to_order' && !(row.isUnderNorm && row.remainingShortage > 0)) {
        return false;
      }
      if (activeFilter === 'rupture' && !row.isRuptureBoutique) return false;

      if (sourceDepotFilter !== 'ALL') {
        const hasInSource = row.otherDepots.some((d) => d.warehouse.id === sourceDepotFilter);
        if (!hasInSource) return false;
      }

      if (q) {
        const art = row.article;
        const haystack = [
          art.mainReference,
          art.designation,
          art.brand,
          art.category,
          row.boutiqueLocation,
          ...(art.equivalentReferences || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allRows, activeFilter, sourceDepotFilter, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedItems: paginatedRows,
  } = usePagination(filteredRows, 25);

  // Resolve chosen source depot & transfer quantity for any row
  const getRowTransferPlan = (row: ReplenishmentRow) => {
    if (row.otherDepots.length === 0) {
      return { sourceDepot: null, qty: 0 };
    }
    const preferredWhId =
      sourceOverrides[row.article.id] ||
      (sourceDepotFilter !== 'ALL' ? sourceDepotFilter : row.otherDepots[0].warehouse.id);

    const sourceDepot =
      row.otherDepots.find((d) => d.warehouse.id === preferredWhId) || row.otherDepots[0];

    const defaultQty = Math.min(
      row.missingQty > 0 ? row.missingQty : 1,
      sourceDepot.qty
    );
    const rawOverride = qtyOverrides[row.article.id];
    const qty =
      rawOverride !== undefined
        ? Math.max(1, Math.min(Math.floor(rawOverride), sourceDepot.qty))
        : defaultQty;

    return { sourceDepot, qty };
  };

  // Transferable rows in current filtered list
  const filteredTransferableRows = useMemo(
    () => filteredRows.filter((r) => r.otherDepots.length > 0),
    [filteredRows]
  );

  // Selected rows that are still valid & transferable
  const selectedTransferPlans = useMemo(() => {
    const list: Array<{
      row: ReplenishmentRow;
      sourceDepot: DepotAvailability;
      qty: number;
    }> = [];
    for (const row of allRows) {
      if (!selectedIds.has(row.article.id)) continue;
      const { sourceDepot, qty } = getRowTransferPlan(row);
      if (sourceDepot && qty > 0) {
        list.push({ row, sourceDepot, qty });
      }
    }
    return list;
  }, [allRows, selectedIds, sourceOverrides, qtyOverrides, sourceDepotFilter]);

  const totalSelectedUnits = useMemo(
    () => selectedTransferPlans.reduce((sum, p) => sum + p.qty, 0),
    [selectedTransferPlans]
  );

  // Items to display inside the Picking List modal (selected items, or all filtered transferable items)
  const pickingListPlans = useMemo(() => {
    if (selectedTransferPlans.length > 0) {
      return selectedTransferPlans;
    }
    return filteredTransferableRows
      .map((row) => {
        const { sourceDepot, qty } = getRowTransferPlan(row);
        return sourceDepot && qty > 0 ? { row, sourceDepot, qty } : null;
      })
      .filter((x): x is { row: ReplenishmentRow; sourceDepot: DepotAvailability; qty: number } =>
        Boolean(x)
      );
  }, [selectedTransferPlans, filteredTransferableRows, sourceOverrides, qtyOverrides, sourceDepotFilter]);

  // Group picking list by source warehouse for storekeepers
  const pickingListByDepot = useMemo(() => {
    const groups = new Map<
      string,
      {
        warehouse: Warehouse;
        items: Array<{ row: ReplenishmentRow; sourceDepot: DepotAvailability; qty: number }>;
        totalUnits: number;
      }
    >();

    for (const plan of pickingListPlans) {
      const whId = plan.sourceDepot.warehouse.id;
      const existing = groups.get(whId);
      if (existing) {
        existing.items.push(plan);
        existing.totalUnits += plan.qty;
      } else {
        groups.set(whId, {
          warehouse: plan.sourceDepot.warehouse,
          items: [plan],
          totalUnits: plan.qty,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.warehouse.name.localeCompare(b.warehouse.name)
    );
  }, [pickingListPlans]);

  // Toggle selection helpers
  const toggleSelectRow = (articleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  const allFilteredTransferableSelected =
    filteredTransferableRows.length > 0 &&
    filteredTransferableRows.every((r) => selectedIds.has(r.article.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredTransferableSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTransferableRows.forEach((r) => next.delete(r.article.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTransferableRows.forEach((r) => next.add(r.article.id));
        return next;
      });
    }
  };

  // Inline update of an article's boutique norm
  const handleInlineNormChange = (articleId: string, nextNorm: number) => {
    if (!boutiqueWarehouse) return;
    const cleanVal = Math.max(0, Math.floor(Number(nextNorm) || 0));
    bulkUpdateWarehouseMinThresholds(boutiqueWarehouse.id, [
      { articleId, threshold: cleanVal },
    ]);
  };

  const handleResetArticleNorm = (articleId: string) => {
    if (!boutiqueWarehouse) return;
    bulkUpdateWarehouseMinThresholds(boutiqueWarehouse.id, [
      { articleId, threshold: null },
    ]);
    onSuccess?.(
      'Norme réinitialisée',
      'La pièce utilise à nouveau son seuil minimum global du catalogue.'
    );
  };

  // 1-click single article transfer into Boutique
  const handleQuickSingleTransfer = (row: ReplenishmentRow) => {
    if (!boutiqueWarehouse) return;
    const { sourceDepot, qty } = getRowTransferPlan(row);
    if (!sourceDepot || qty <= 0) {
      onError?.('Transfert impossible', 'Aucun stock disponible dans les autres dépôts.');
      return;
    }

    const docRef = generateReplenishmentDocRef();
    const res = recordTransfer({
      articleId: row.article.id,
      sourceWarehouseId: sourceDepot.warehouse.id,
      targetWarehouseId: boutiqueWarehouse.id,
      quantity: qty,
      documentRef: docRef,
      reason: `Réapprovisionnement boutique (${boutiqueWarehouse.code})`,
      notes: `Norme boutique : ${row.boutiqueNorm} · Prélevé au ${sourceDepot.warehouse.name}`,
    });

    if (!res.success) {
      onError?.('Erreur de transfert', res.error || 'Impossible de transférer cette pièce.');
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(row.article.id);
      return next;
    });
    setQtyOverrides((prev) => {
      const next = { ...prev };
      delete next[row.article.id];
      return next;
    });

    onSuccess?.(
      'Boutique réapprovisionnée',
      `+${qty} ${row.article.unit} de ${row.article.mainReference} transféré(s) depuis ${sourceDepot.warehouse.name} vers ${boutiqueWarehouse.name} (${docRef}).`
    );
  };

  // Execute bulk transfer for a set of plans
  const handleExecuteBatchTransfer = (
    plansToExecute: Array<{
      row: ReplenishmentRow;
      sourceDepot: DepotAvailability;
      qty: number;
    }>,
    closePickingModalAfter = false
  ) => {
    if (!boutiqueWarehouse || plansToExecute.length === 0) return;

    const docRef = batchDocRef.trim() || generateReplenishmentDocRef();
    const result = recordBatchTransfer({
      items: plansToExecute.map((p) => ({
        articleId: p.row.article.id,
        sourceWarehouseId: p.sourceDepot.warehouse.id,
        targetWarehouseId: boutiqueWarehouse.id,
        quantity: p.qty,
      })),
      documentRef: docRef,
      reason: `Réapprovisionnement groupé boutique (${boutiqueWarehouse.code})`,
      notes: `Transfert groupé de ${plansToExecute.length} référence(s) vers ${boutiqueWarehouse.name}`,
    });

    if (!result.success) {
      onError?.('Échec du transfert groupé', result.error || 'Aucun transfert effectué.');
      return;
    }

    const transferredIds = new Set(plansToExecute.map((p) => p.row.article.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      transferredIds.forEach((id) => next.delete(id));
      return next;
    });
    setQtyOverrides((prev) => {
      const next = { ...prev };
      transferredIds.forEach((id) => delete next[id]);
      return next;
    });
    setBatchDocRef(generateReplenishmentDocRef());
    if (closePickingModalAfter) {
      setIsPickingListOpen(false);
    }

    onSuccess?.(
      'Transfert groupé validé',
      `${result.transferredCount} référence(s) (${result.totalUnits} unité(s)) transférée(s) vers ${boutiqueWarehouse.name} — Bordereau ${docRef}.`
    );
  };

  // Apply bulk boutique norm
  const handleApplyBulkNorm = (resetToGlobal = false) => {
    if (!boutiqueWarehouse) return;
    let targetArticles: Article[] = [];
    if (bulkNormScope === 'selected') {
      targetArticles = activeArticles.filter((a) => selectedIds.has(a.id));
    } else if (bulkNormScope === 'filtered') {
      targetArticles = filteredRows.map((r) => r.article);
    } else {
      targetArticles = activeArticles;
    }

    if (targetArticles.length === 0) {
      onError?.('Aucune pièce ciblée', 'Sélectionnez ou filtrez au moins une pièce.');
      return;
    }

    const updates = targetArticles.map((art) => ({
      articleId: art.id,
      threshold: resetToGlobal ? null : Math.max(0, Math.floor(bulkNormValue)),
    }));

    const res = bulkUpdateWarehouseMinThresholds(boutiqueWarehouse.id, updates);
    if (!res.success) {
      onError?.('Erreur', res.error || 'Impossible de mettre à jour les normes.');
      return;
    }

    setIsBulkNormModalOpen(false);
    onSuccess?.(
      resetToGlobal ? 'Normes réinitialisées' : 'Normes boutique mises à jour',
      resetToGlobal
        ? `${res.updatedCount} pièce(s) rétablies sur leur seuil global du catalogue.`
        : `Norme minimum de ${Math.max(0, Math.floor(bulkNormValue))} unité(s) appliquée à ${res.updatedCount} pièce(s) pour ${boutiqueWarehouse.name}.`
    );
  };

  const handleDownloadPickingPdf = async () => {
    setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const whCode = (boutiqueWarehouse?.code || 'BOUTIQUE').replace(/[^A-Za-z0-9_-]/g, '');
      await downloadElementAsPdf(
        'printable-boutique-picking-list',
        `Bon_Reappro_${whCode}_${dateStr}.pdf`,
        'A4'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!boutiqueWarehouse) {
    return (
      <div className="bg-white border border-[#E0E0E0] p-8 text-center space-y-3">
        <Store className="w-8 h-8 text-[#7A5C00] mx-auto" />
        <p className="text-sm font-semibold text-[#111111]">
          Aucun magasin / dépôt configuré.
        </p>
        <p className="text-xs text-[#595959]">
          Créez au moins un dépôt principal dans « Mes Magasins » pour activer le réapprovisionnement boutique.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Configuration & Actions Header */}
      <div className="bg-white border border-[#E0E0E0] p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#111111] shrink-0" />
              <h1 className="font-display text-lg sm:text-xl font-bold text-[#111111] tracking-tight">
                Réapprovisionnement Boutique
              </h1>
            </div>
            <p className="text-xs text-[#595959] mt-1">
              Détecte les pièces sous votre norme minimum en boutique pour les ramener depuis vos autres dépôts ou lancer une commande fournisseur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Target Boutique Selector */}
            <div className="flex items-center border border-[#D4D4D4] bg-[#F4F4F4] px-2.5 py-1.5 gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#595959] font-bold shrink-0">
                Boutique :
              </span>
              <select
                value={boutiqueWarehouse.id}
                onChange={(e) => setBoutiqueWarehouseId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#111111] focus:outline-none cursor-pointer pr-1"
                aria-label="Choisir le dépôt boutique cible"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                    {w.isDefault ? ' (Principal)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setBulkNormScope(selectedIds.size > 0 ? 'selected' : 'filtered');
                setIsBulkNormModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#111111] bg-white hover:bg-[#FFF9DF] hover:border-[#FFCD11] border border-[#D4D4D4] transition-colors whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#7A5C00]" />
              <span>Normes en masse</span>
            </button>

            <button
              type="button"
              disabled={pickingListPlans.length === 0}
              onClick={() => setIsPickingListOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.04em] text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#111111]" />
              <span>
                Bon de prélèvement
                {selectedTransferPlans.length > 0
                  ? ` (${selectedTransferPlans.length})`
                  : pickingListPlans.length > 0
                  ? ` (${pickingListPlans.length})`
                  : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Warning if only 1 warehouse exists */}
      {otherWarehouses.length === 0 && (
        <div className="bg-[#FFF9DF] border border-[#E5C130] px-4 py-3 flex items-start gap-2.5 text-xs text-[#111111]">
          <AlertTriangle className="w-4 h-4 text-[#7A5C00] shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Un seul dépôt est enregistré.</strong> Vous pouvez suivre vos pièces sous norme boutique et lancer des commandes fournisseurs ici ; ajoutez vos autres dépôts dans « Mes Magasins » pour activer les transferts internes.
          </div>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveFilter('under_norm');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border p-3.5 sm:p-4 transition-colors cursor-pointer ${
            activeFilter === 'under_norm'
              ? 'border-[#111111] border-t-[3px] border-t-[#FFCD11]'
              : 'border-[#E0E0E0] hover:border-[#111111]'
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#595959] block">
            Sous norme boutique
          </span>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-[#111111]">
              {stats.underNormCount}
            </span>
            <span className="text-[11px] font-medium text-rose-600 font-mono tabular-nums">
              {stats.ruptureCount} rupture{stats.ruptureCount > 1 ? 's' : ''}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveFilter('transferable');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border p-3.5 sm:p-4 transition-colors cursor-pointer ${
            activeFilter === 'transferable'
              ? 'border-[#111111] border-t-[3px] border-t-emerald-600'
              : 'border-[#E0E0E0] hover:border-[#111111]'
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#595959] block">
            Dispo autres dépôts
          </span>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-emerald-700">
              {stats.transferableCount}
            </span>
            <span className="text-[11px] font-medium text-[#595959]">
              à transférer
            </span>
          </div>
        </button>

        <div className="bg-white border border-[#E0E0E0] p-3.5 sm:p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#595959] block">
            Unités à ramener
          </span>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-[#111111]">
              {stats.totalTransferableUnits}
            </span>
            <span className="text-[11px] font-medium text-[#595959]">
              depuis {otherWarehouses.length} dépôt{otherWarehouses.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveFilter('to_order');
            setCurrentPage(1);
          }}
          className={`text-left bg-white border p-3.5 sm:p-4 transition-colors cursor-pointer ${
            activeFilter === 'to_order'
              ? 'border-[#111111] border-t-[3px] border-t-rose-600'
              : 'border-[#E0E0E0] hover:border-[#111111]'
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#595959] block">
            Dépôts insuffisants
          </span>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-rose-600">
              {stats.toOrderCount}
            </span>
            <span className="text-[11px] font-medium text-[#7A5C00]">
              à commander
            </span>
          </div>
        </button>
      </div>

      {/* Filter Tabs + Search + Source Depot Filter */}
      <div className="bg-white border border-[#E0E0E0]">
        <div className="px-3 sm:px-4 pt-3 pb-0 border-b border-[#E0E0E0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'under_norm', label: 'Sous norme', count: stats.underNormCount },
                { id: 'transferable', label: 'Transférables', count: stats.transferableCount },
                { id: 'to_order', label: 'À commander', count: stats.toOrderCount },
                { id: 'rupture', label: 'Rupture boutique', count: stats.ruptureCount },
                { id: 'all', label: 'Toutes les pièces (Normes)', count: allRows.length },
              ] as Array<{ id: FilterTab; label: string; count: number }>
            ).map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 pb-2.5 text-xs whitespace-nowrap shrink-0 bg-transparent! border-0 border-b-[2.5px]! transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#FFCD11]! text-[#111111] font-bold'
                      : 'border-transparent! text-[#595959] font-medium hover:text-[#111111]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 ${
                      isActive
                        ? 'bg-[#FFCD11] text-[#111111] font-bold'
                        : 'bg-[#F4F4F4] text-[#595959]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchField
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                setCurrentPage(1);
              }}
              placeholder="Rechercher par référence, désignation, marque, emplacement..."
              ariaLabel="Rechercher une pièce à réapprovisionner"
            />
          </div>

          {otherWarehouses.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Building2 className="w-4 h-4 text-[#595959] shrink-0" />
              <select
                value={sourceDepotFilter}
                onChange={(e) => {
                  setSourceDepotFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-2 text-xs font-medium text-[#111111] bg-white border border-[#D4D4D4] focus:outline-none focus:border-[#111111] cursor-pointer"
                aria-label="Filtrer par dépôt source"
              >
                <option value="ALL">Tous les dépôts sources</option>
                {otherWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    Dispo au {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredTransferableRows.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#111111] bg-[#F4F4F4] hover:bg-[#FFF9DF] border border-[#D4D4D4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#7A5C00]" />
              <span>
                {allFilteredTransferableSelected
                  ? 'Tout désélectionner'
                  : `Sélectionner transférables (${filteredTransferableRows.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar when >= 1 item is selected */}
      {selectedTransferPlans.length > 0 && (
        <div className="bg-[#111111] text-white border-l-4 border-[#FFCD11] px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#FFCD11] shrink-0" />
              <span className="text-xs sm:text-sm font-bold">
                <span className="font-mono tabular-nums text-[#FFCD11]">
                  {selectedTransferPlans.length}
                </span>{' '}
                pièce{selectedTransferPlans.length > 1 ? 's' : ''} sélectionnée
                {selectedTransferPlans.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-xs text-white/75 font-mono tabular-nums">
              Total : <strong className="text-white">{totalSelectedUnits}</strong> unité
              {totalSelectedUnits > 1 ? 's' : ''} ➔ {boutiqueWarehouse.name}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#1F1F1F] border border-[#3A3A3A] px-2 py-1">
              <span className="text-[10px] font-mono uppercase text-white/60 mr-1.5">
                N° Bon :
              </span>
              <input
                type="text"
                value={batchDocRef}
                onChange={(e) => setBatchDocRef(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-[#FFCD11] w-32 focus:outline-none"
                aria-label="Numéro de bordereau de transfert groupé"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPickingListOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#262626] hover:bg-[#333333] border border-[#444444] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#FFCD11]" />
              <span>Bon de prélèvement</span>
            </button>

            <button
              type="button"
              onClick={() => handleExecuteBatchTransfer(selectedTransferPlans)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.04em] text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#111111]" />
              <span>Valider le transfert groupé</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-2 text-white/70 hover:text-white bg-transparent! border-0 cursor-pointer"
              title="Annuler la sélection"
              aria-label="Annuler la sélection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white border border-[#E0E0E0] overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-[#111111]">
              {activeFilter === 'under_norm'
                ? `Votre boutique (${boutiqueWarehouse.name}) est au niveau de ses normes !`
                : 'Aucune pièce ne correspond à ce filtre.'}
            </p>
            <p className="text-xs text-[#595959] max-w-md mx-auto">
              {activeFilter === 'under_norm'
                ? 'Toutes vos pièces atteignent leur norme minimum configurée. Vous pouvez ajuster les normes pièce par pièce dans l’onglet « Toutes les pièces (Normes) ».'
                : 'Modifiez votre recherche ou changez d’onglet pour consulter les autres articles.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                  setSourceDepotFilter('ALL');
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#111111] bg-[#F4F4F4] hover:bg-[#FFF9DF] border border-[#D4D4D4] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#7A5C00]" />
                <span>Afficher toutes les pièces pour régler les normes</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop High-Density Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F4] border-b border-[#E0E0E0] text-[10.5px] font-mono uppercase tracking-[0.08em] text-[#595959]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredTransferableSelected}
                        disabled={filteredTransferableRows.length === 0}
                        onChange={toggleSelectAllFiltered}
                        className="w-4 h-4 accent-[#111111] cursor-pointer disabled:opacity-40"
                        aria-label="Tout sélectionner les pièces transférables"
                      />
                    </th>
                    <th className="py-2.5 px-3">Pièce & Emplacement Boutique</th>
                    <th className="py-2.5 px-3 text-right">Stock Boutique</th>
                    <th className="py-2.5 px-3 text-center">Norme Boutique</th>
                    <th className="py-2.5 px-3 text-right">Manquant</th>
                    <th className="py-2.5 px-3">Dépôt Source & Dispo</th>
                    <th className="py-2.5 px-3 text-center w-24">Qté</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBEB] text-xs">
                  {paginatedRows.map((row) => {
                    const { sourceDepot, qty } = getRowTransferPlan(row);
                    const isSelected = selectedIds.has(row.article.id);
                    const canTransfer = Boolean(sourceDepot && qty > 0);
                    const activeOrder = getActiveOrderForArticle(row.article.id);

                    return (
                      <tr
                        key={row.article.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-[#FFF9DF]/70'
                            : 'hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canTransfer}
                            onChange={() => toggleSelectRow(row.article.id)}
                            className="w-4 h-4 accent-[#111111] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Sélectionner ${row.article.mainReference}`}
                          />
                        </td>

                        <td className="py-2.5 px-3 align-middle max-w-[300px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[#111111] text-[12.5px]">
                              {row.article.mainReference}
                            </span>
                            {row.article.brand && (
                              <span className="text-[10.5px] font-semibold text-[#595959]">
                                · {row.article.brand}
                              </span>
                            )}
                            {activeOrder && (
                              <OrderStatusBadge
                                order={activeOrder}
                                onNavigate={onNavigateToPurchaseOrder}
                                compact
                              />
                            )}
                          </div>
                          <div className="text-[#333333] font-medium truncate mt-0.5">
                            {row.article.designation}
                          </div>
                          {row.boutiqueLocation && row.boutiqueLocation !== 'Non renseigné' && (
                            <div className="text-[10.5px] font-mono text-[#595959] mt-0.5">
                              Rayon boutique : {row.boutiqueLocation}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right align-middle">
                          <span
                            className={`font-mono tabular-nums font-bold text-sm ${
                              row.isRuptureBoutique
                                ? 'text-rose-600'
                                : row.isUnderNorm
                                ? 'text-[#7A5C00]'
                                : 'text-emerald-700'
                            }`}
                          >
                            {row.boutiqueStock}
                          </span>
                          <span className="text-[10px] text-[#595959] ml-1">
                            {row.article.unit}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center align-middle">
                          <div className="inline-flex items-center gap-1">
                            <NumericInput
                              min={0}
                              max={99999}
                              value={row.boutiqueNorm}
                              onChange={(val) => handleInlineNormChange(row.article.id, val)}
                              className={`w-16 px-2 py-1 text-center font-mono tabular-nums text-xs font-bold border focus:outline-none focus:border-[#111111] ${
                                row.hasCustomNorm
                                  ? 'bg-[#FFF9DF] border-[#E5C130] text-[#111111]'
                                  : 'bg-white border-[#D4D4D4] text-[#111111]'
                              }`}
                            />
                            {row.hasCustomNorm && (
                              <button
                                type="button"
                                onClick={() => handleResetArticleNorm(row.article.id)}
                                title={`Norme personnalisée (seuil global : ${row.article.minStockThreshold}). Cliquer pour rétablir le seuil global.`}
                                className="p-1 text-[#7A5C00] hover:text-[#111111] bg-transparent! border-0 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right align-middle">
                          {row.missingQty > 0 ? (
                            <span className="font-mono tabular-nums font-bold text-sm text-rose-600">
                              -{row.missingQty}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-emerald-700 font-semibold">
                              OK
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 align-middle min-w-[210px]">
                          {row.otherDepots.length === 0 ? (
                            <span className="text-[11px] font-medium text-rose-600">
                              Aucun stock dans les autres dépôts
                            </span>
                          ) : row.otherDepots.length === 1 ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#111111]">
                                  {row.otherDepots[0].warehouse.name}
                                </span>
                                <span className="font-mono tabular-nums font-bold text-emerald-700">
                                  ({row.otherDepots[0].qty} dispo)
                                </span>
                              </div>
                              {row.otherDepots[0].location &&
                                row.otherDepots[0].location !== '—' &&
                                row.otherDepots[0].location !== 'Non renseigné' && (
                                  <div className="text-[10.5px] font-mono text-[#595959]">
                                    Empl : {row.otherDepots[0].location}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <select
                                value={sourceDepot?.warehouse.id || ''}
                                onChange={(e) => {
                                  const nextWhId = e.target.value;
                                  setSourceOverrides((prev) => ({
                                    ...prev,
                                    [row.article.id]: nextWhId,
                                  }));
                                  const chosen = row.otherDepots.find(
                                    (d) => d.warehouse.id === nextWhId
                                  );
                                  if (chosen) {
                                    setQtyOverrides((prev) => ({
                                      ...prev,
                                      [row.article.id]: Math.min(
                                        row.missingQty > 0 ? row.missingQty : 1,
                                        chosen.qty
                                      ),
                                    }));
                                  }
                                }}
                                className="w-full max-w-[230px] px-2 py-1 text-xs font-medium bg-white border border-[#D4D4D4] text-[#111111] focus:outline-none focus:border-[#111111] cursor-pointer"
                              >
                                {row.otherDepots.map((d) => (
                                  <option key={d.warehouse.id} value={d.warehouse.id}>
                                    {d.warehouse.name} — {d.qty} dispo
                                  </option>
                                ))}
                              </select>
                              <div className="text-[10px] font-mono text-[#595959]">
                                Total autres dépôts : {row.totalOtherDepotStock}
                                {sourceDepot?.location &&
                                sourceDepot.location !== '—' &&
                                sourceDepot.location !== 'Non renseigné'
                                  ? ` · Empl : ${sourceDepot.location}`
                                  : ''}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center align-middle">
                          {canTransfer && sourceDepot ? (
                            <NumericInput
                              min={1}
                              max={sourceDepot.qty}
                              value={qty}
                              onChange={(val) =>
                                setQtyOverrides((prev) => ({
                                  ...prev,
                                  [row.article.id]: Math.max(
                                    1,
                                    Math.min(Math.floor(val || 1), sourceDepot.qty)
                                  ),
                                }))
                              }
                              className="w-16 px-2 py-1 text-center font-mono tabular-nums text-xs font-bold border border-[#D4D4D4] bg-white text-[#111111] focus:outline-none focus:border-[#111111]"
                            />
                          ) : (
                            <span className="text-[#999999] font-mono">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canTransfer && (
                              <button
                                type="button"
                                onClick={() => handleQuickSingleTransfer(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-[#111111] hover:bg-[#2A2A2A] text-[#FFCD11] transition-colors cursor-pointer"
                                title={`Transférer ${qty} unité(s) de ${sourceDepot?.warehouse.name} vers ${boutiqueWarehouse.name}`}
                              >
                                <ArrowLeftRight className="w-3 h-3 shrink-0" />
                                <span>Transférer</span>
                              </button>
                            )}
                            {row.remainingShortage > 0 && !activeOrder && onOpenPurchaseOrder && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPurchaseOrder(row.article.id, row.article.brand)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-[#FFF9DF] hover:bg-[#FFCD11] text-[#111111] border border-[#E5C130] transition-colors cursor-pointer"
                                title={`Stock dépôts insuffisant (manque encore ${row.remainingShortage}) — Créer une commande fournisseur`}
                              >
                                <ShoppingBag className="w-3 h-3 shrink-0 text-[#7A5C00]" />
                                <span>Commander</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Card List */}
            <div className="lg:hidden divide-y divide-[#E0E0E0]">
              {paginatedRows.map((row) => {
                const { sourceDepot, qty } = getRowTransferPlan(row);
                const isSelected = selectedIds.has(row.article.id);
                const canTransfer = Boolean(sourceDepot && qty > 0);
                const activeOrder = getActiveOrderForArticle(row.article.id);

                return (
                  <div
                    key={row.article.id}
                    className={`p-3.5 space-y-2.5 ${isSelected ? 'bg-[#FFF9DF]/70' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canTransfer}
                        onChange={() => toggleSelectRow(row.article.id)}
                        className="mt-1 w-4 h-4 accent-[#111111] cursor-pointer disabled:opacity-30 shrink-0"
                        aria-label={`Sélectionner ${row.article.mainReference}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#111111]">
                            {row.article.mainReference}
                          </span>
                          {row.missingQty > 0 ? (
                            <span className="font-mono tabular-nums text-xs font-bold text-rose-600">
                              Manque {row.missingQty}
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-emerald-700">
                              OK
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-[#333333] mt-0.5">
                          {row.article.designation}
                        </p>
                        {activeOrder && (
                          <div className="mt-1.5">
                            <OrderStatusBadge
                              order={activeOrder}
                              onNavigate={onNavigateToPurchaseOrder}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-[#F4F4F4] p-2.5 border border-[#E0E0E0] text-xs">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#595959] block">
                          Boutique
                        </span>
                        <span
                          className={`font-mono tabular-nums font-bold text-sm ${
                            row.isRuptureBoutique
                              ? 'text-rose-600'
                              : row.isUnderNorm
                              ? 'text-[#7A5C00]'
                              : 'text-emerald-700'
                          }`}
                        >
                          {row.boutiqueStock}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#595959] block">
                          Norme
                        </span>
                        <NumericInput
                          min={0}
                          max={99999}
                          value={row.boutiqueNorm}
                          onChange={(val) => handleInlineNormChange(row.article.id, val)}
                          className="w-16 mt-0.5 px-1.5 py-0.5 text-center font-mono tabular-nums text-xs font-bold border border-[#D4D4D4] bg-white text-[#111111]"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#595959] block">
                          Autres dépôts
                        </span>
                        <span
                          className={`font-mono tabular-nums font-bold text-sm ${
                            row.totalOtherDepotStock > 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {row.totalOtherDepotStock}
                        </span>
                      </div>
                    </div>

                    {canTransfer && sourceDepot && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={sourceDepot.warehouse.id}
                          onChange={(e) => {
                            const nextWhId = e.target.value;
                            setSourceOverrides((prev) => ({
                              ...prev,
                              [row.article.id]: nextWhId,
                            }));
                            const chosen = row.otherDepots.find(
                              (d) => d.warehouse.id === nextWhId
                            );
                            if (chosen) {
                              setQtyOverrides((prev) => ({
                                ...prev,
                                [row.article.id]: Math.min(
                                  row.missingQty > 0 ? row.missingQty : 1,
                                  chosen.qty
                                ),
                              }));
                            }
                          }}
                          className="flex-1 min-w-[140px] px-2 py-1.5 text-xs font-medium bg-white border border-[#D4D4D4] text-[#111111]"
                        >
                          {row.otherDepots.map((d) => (
                            <option key={d.warehouse.id} value={d.warehouse.id}>
                              {d.warehouse.name} ({d.qty} dispo)
                            </option>
                          ))}
                        </select>

                        <NumericInput
                          min={1}
                          max={sourceDepot.qty}
                          value={qty}
                          onChange={(val) =>
                            setQtyOverrides((prev) => ({
                              ...prev,
                              [row.article.id]: Math.max(
                                1,
                                Math.min(Math.floor(val || 1), sourceDepot.qty)
                              ),
                            }))
                          }
                          className="w-16 px-2 py-1.5 text-center font-mono tabular-nums text-xs font-bold border border-[#D4D4D4] bg-white text-[#111111]"
                        />

                        <button
                          type="button"
                          onClick={() => handleQuickSingleTransfer(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#111111] text-[#FFCD11] cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Transférer</span>
                        </button>
                      </div>
                    )}

                    {row.remainingShortage > 0 && !activeOrder && onOpenPurchaseOrder && (
                      <button
                        type="button"
                        onClick={() => onOpenPurchaseOrder(row.article.id, row.article.brand)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#FFF9DF] hover:bg-[#FFCD11] text-[#111111] border border-[#E5C130] cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-[#7A5C00]" />
                        <span>
                          Commander fournisseur (manque encore {row.remainingShortage})
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalItems={filteredRows.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="pièces"
            />
          </>
        )}
      </div>

      {/* Bulk Norm Modal */}
      {isBulkNormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55">
          <div className="bg-white border border-[#D4D4D4] max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#111111] text-white border-b-[3px] border-[#FFCD11] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FFCD11]" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Normes Boutique en masse
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkNormModalOpen(false)}
                className="text-white/70 hover:text-white bg-transparent! border-0 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#595959] leading-relaxed">
                Définissez rapidement la quantité minimale souhaitée en boutique (
                <strong className="text-[#111111]">{boutiqueWarehouse.name}</strong>). Vous pourrez toujours affiner pièce par pièce directement dans le tableau.
              </p>

              <div className="space-y-1.5">
                <label className="block font-mono uppercase tracking-wider text-[10.5px] font-bold text-[#595959]">
                  Pièces concernées
                </label>
                <div className="space-y-1.5">
                  {selectedIds.size > 0 && (
                    <label className="flex items-center gap-2 p-2.5 border border-[#E0E0E0] cursor-pointer hover:bg-[#FAFAFA]">
                      <input
                        type="radio"
                        name="bulkScope"
                        checked={bulkNormScope === 'selected'}
                        onChange={() => setBulkNormScope('selected')}
                        className="accent-[#111111]"
                      />
                      <span className="font-semibold text-[#111111]">
                        Pièces cochées ({selectedIds.size})
                      </span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 p-2.5 border border-[#E0E0E0] cursor-pointer hover:bg-[#FAFAFA]">
                    <input
                      type="radio"
                      name="bulkScope"
                      checked={bulkNormScope === 'filtered'}
                      onChange={() => setBulkNormScope('filtered')}
                      className="accent-[#111111]"
                    />
                    <span className="font-semibold text-[#111111]">
                      Pièces filtrées affichées ({filteredRows.length})
                    </span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 border border-[#E0E0E0] cursor-pointer hover:bg-[#FAFAFA]">
                    <input
                      type="radio"
                      name="bulkScope"
                      checked={bulkNormScope === 'all'}
                      onChange={() => setBulkNormScope('all')}
                      className="accent-[#111111]"
                    />
                    <span className="font-semibold text-[#111111]">
                      Tout le catalogue actif ({activeArticles.length})
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-mono uppercase tracking-wider text-[10.5px] font-bold text-[#595959] mb-1.5">
                  Norme minimum boutique (unités par pièce)
                </label>
                <NumericInput
                  min={0}
                  max={9999}
                  value={bulkNormValue}
                  onChange={(val) => setBulkNormValue(Math.max(0, Math.floor(val || 0)))}
                  className="w-full px-3 py-2 font-mono text-sm font-bold border border-[#D4D4D4] text-[#111111] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="pt-3 border-t border-[#E0E0E0] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyBulkNorm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#595959] hover:text-[#111111] bg-[#F4F4F4] border border-[#D4D4D4] cursor-pointer"
                  title="Supprimer les normes spécifiques boutique et revenir au seuil global de chaque fiche article"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rétablir seuil global</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkNormModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#595959] bg-white border border-[#D4D4D4] hover:text-[#111111] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBulkNorm(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-[0.04em] text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] cursor-pointer"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable / PDF Picking List Modal */}
      {isPickingListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 overflow-y-auto">
          <div className="bg-white border border-[#D4D4D4] max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl my-auto">
            {/* Modal Action Bar (Hidden in print) */}
            <div className="px-4 sm:px-5 py-3 bg-[#111111] text-white border-b-[3px] border-[#FFCD11] flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FFCD11]" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                  Bon de prélèvement — Réapprovisionnement Boutique
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => printElementById('printable-boutique-picking-list', 'A4')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#262626] hover:bg-[#3A3A3A] border border-[#444444] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FFCD11]" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={handleDownloadPickingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#111111]" />
                  <span>{isExportingPdf ? 'Export...' : 'Télécharger PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPickingListOpen(false)}
                  className="p-1.5 text-white/75 hover:text-white bg-transparent! border-0 cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable A4 Sheet */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F4F4F4]">
              <div
                id="printable-boutique-picking-list"
                className="bg-white border border-[#D4D4D4] p-6 sm:p-8 text-[#111111] space-y-6"
              >
                {/* Sheet Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b-2 border-[#111111]">
                  <div>
                    <div className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                      {companyInfo?.name || 'WKRLI'}
                    </div>
                    {companyInfo?.address && (
                      <div className="text-xs text-[#595959] mt-0.5">{companyInfo.address}</div>
                    )}
                    {companyInfo?.phone && (
                      <div className="text-xs text-[#595959] font-mono">{companyInfo.phone}</div>
                    )}
                  </div>

                  <div className="sm:text-right">
                    <div className="inline-block px-2.5 py-1 bg-[#111111] text-[#FFCD11] font-mono text-xs font-bold uppercase tracking-wider">
                      Bon de Réapprovisionnement
                    </div>
                    <div className="text-xs font-mono font-bold text-[#111111] mt-1.5">
                      Réf : {batchDocRef}
                    </div>
                    <div className="text-[11px] text-[#595959] font-mono">
                      Date : {new Date().toLocaleDateString('fr-FR')} ·{' '}
                      {new Date().toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

                {/* Destination Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F4F4F4] border border-[#E0E0E0] p-3.5 text-xs">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#595959] block">
                      Boutique destinataire
                    </span>
                    <strong className="text-[#111111] font-bold">
                      {boutiqueWarehouse.code} — {boutiqueWarehouse.name}
                    </strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#595959] block">
                      Émis par
                    </span>
                    <strong className="text-[#111111] font-bold">{currentUser.name}</strong>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#595959] block">
                      Volume total à prélever
                    </span>
                    <strong className="font-mono tabular-nums text-[#111111] font-bold">
                      {pickingListPlans.length} réf. ·{' '}
                      {pickingListPlans.reduce((s, p) => s + p.qty, 0)} unité(s)
                    </strong>
                  </div>
                </div>

                {/* Grouped Tables by Source Depot */}
                <div className="space-y-6">
                  {pickingListByDepot.map((group) => (
                    <div key={group.warehouse.id} className="space-y-2">
                      <div className="flex items-center justify-between bg-[#111111] text-white px-3 py-2 text-xs">
                        <span className="font-bold uppercase tracking-wider">
                          Dépôt source : {group.warehouse.code} — {group.warehouse.name}
                        </span>
                        <span className="font-mono tabular-nums text-[#FFCD11] font-bold">
                          {group.items.length} réf. · {group.totalUnits} unité(s)
                        </span>
                      </div>

                      <table className="w-full text-left border-collapse border border-[#D4D4D4] text-xs">
                        <thead>
                          <tr className="bg-[#F4F4F4] border-b border-[#D4D4D4] font-mono text-[10px] uppercase text-[#595959]">
                            <th className="py-2 px-2 w-8 text-center border-r border-[#E0E0E0]">
                              Fait
                            </th>
                            <th className="py-2 px-2.5 border-r border-[#E0E0E0]">Référence</th>
                            <th className="py-2 px-2.5 border-r border-[#E0E0E0]">Désignation</th>
                            <th className="py-2 px-2.5 border-r border-[#E0E0E0]">Empl. Dépôt</th>
                            <th className="py-2 px-2 text-right border-r border-[#E0E0E0]">
                              Boutique
                            </th>
                            <th className="py-2 px-2 text-right border-r border-[#E0E0E0]">
                              Norme
                            </th>
                            <th className="py-2 px-2.5 text-right font-bold text-[#111111]">
                              À prélever
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                          {group.items.map(({ row, sourceDepot, qty }) => (
                            <tr key={row.article.id}>
                              <td className="py-2 px-2 text-center border-r border-[#E0E0E0]">
                                <span className="inline-block w-3.5 h-3.5 border border-[#111111]" />
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-[#111111] border-r border-[#E0E0E0] whitespace-nowrap">
                                {row.article.mainReference}
                              </td>
                              <td className="py-2 px-2.5 text-[#111111] border-r border-[#E0E0E0]">
                                {row.article.designation}
                                {row.article.brand ? (
                                  <span className="text-[10.5px] text-[#595959] ml-1">
                                    ({row.article.brand})
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] text-[#595959] border-r border-[#E0E0E0]">
                                {sourceDepot.location || '—'}
                              </td>
                              <td className="py-2 px-2 text-right font-mono tabular-nums text-[#595959] border-r border-[#E0E0E0]">
                                {row.boutiqueStock}
                              </td>
                              <td className="py-2 px-2 text-right font-mono tabular-nums text-[#595959] border-r border-[#E0E0E0]">
                                {row.boutiqueNorm}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono tabular-nums font-extrabold text-sm text-[#111111]">
                                {qty} {row.article.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Signatures Footer */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[#E0E0E0] text-xs">
                  <div className="border border-[#D4D4D4] p-3 h-24">
                    <span className="font-mono text-[10px] uppercase text-[#595959] block">
                      Préparé & remis au dépôt par :
                    </span>
                  </div>
                  <div className="border border-[#D4D4D4] p-3 h-24">
                    <span className="font-mono text-[10px] uppercase text-[#595959] block">
                      Reçu & contrôlé en boutique par :
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Modal Bar: optional direct stock validation */}
            <div className="px-4 sm:px-5 py-3 bg-white border-t border-[#E0E0E0] flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
              <span className="text-xs text-[#595959]">
                Vous pouvez imprimer ce bon maintenant et valider le transfert dès réception en boutique, ou valider immédiatement.
              </span>
              <button
                type="button"
                onClick={() => handleExecuteBatchTransfer(pickingListPlans, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-[0.04em] bg-[#111111] hover:bg-[#2A2A2A] text-[#FFCD11] cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Valider ces transferts en stock ({pickingListPlans.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
