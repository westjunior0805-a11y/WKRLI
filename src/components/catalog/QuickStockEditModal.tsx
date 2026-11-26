import React, { useState, useEffect, useMemo } from 'react';
import { Article } from '../../types';
import { useStock } from '../../context/StockContext';
import {
  getEffectiveArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getSingleWarehouseBrandLocation,
  stripWarehousePrefix,
  getBrandInvoiceNumber,
  cleanBrandName,
} from '../../utils/articleHelpers';
import { formatFCFA } from '../../utils/formatters';
import {
  X,
  MapPin,
  Boxes,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Building2,
  Trash2,
} from 'lucide-react';
import { NumericInput } from '../common/NumericInput';

interface QuickStockEditModalProps {
  article: Article | null;
  initialBrand?: string;
  warehouseId?: string | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

interface BrandSlotDraft {
  slotId: string;
  originalBrandKey: string;
  brandName: string;
  originalPurchasePrice: number;
  purchasePrice: number;
  originalSalePrice: number;
  salePrice: number;
  isNew?: boolean;
}

interface CellDraft {
  quantity: number;
  originalQty: number;
  location: string;
  originalLocation: string;
  invoiceNumber: string;
  originalInvoice: string;
}

const makeCellKey = (whId: string, slotId: string) => `${whId}__${slotId}`;

export const QuickStockEditModal: React.FC<QuickStockEditModalProps> = ({
  article: propArticle,
  initialBrand,
  warehouseId,
  onClose,
  onSaved,
}) => {
  const { articles, stocks, warehouses, quickUpdateArticleStocks } = useStock();

  const article = propArticle
    ? articles.find((a) => a.id === propArticle.id) || propArticle
    : null;

  const [activeWarehouseId, setActiveWarehouseId] = useState<string>('');
  const [activeSlotId, setActiveSlotId] = useState<string>('');
  const [brandSlots, setBrandSlots] = useState<BrandSlotDraft[]>([]);
  const [cellDrafts, setCellDrafts] = useState<Record<string, CellDraft>>({});
  const [newBrandCounter, setNewBrandCounter] = useState<number>(1);
  const [error, setError] = useState<string>('');

  const allCatalogBrands = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      const b = cleanBrandName(a.brand);
      if (b) set.add(b);
      a.brandOffers?.forEach((bo) => {
        const ob = cleanBrandName(bo.brand);
        if (ob) set.add(ob);
      });
    });
    stocks.forEach((s) => {
      if (s.brandBreakdown) {
        Object.keys(s.brandBreakdown).forEach((k) => {
          const kb = cleanBrandName(k);
          if (kb) set.add(kb);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articles, stocks]);

  // Initialize complete multi-warehouse & multi-brand draft buffers ONCE when the modal opens for an article
  useEffect(() => {
    if (!article) return;

    const artStocks = stocks.filter((s) => s.articleId === article.id);
    const offers = getEffectiveArticleBrandOffers(article, artStocks);

    const initialSlots: BrandSlotDraft[] = offers.map((o, idx) => {
      const cleanName = cleanBrandName(o.brand);
      return {
        slotId: `existing_${idx}_${cleanName.toLowerCase() || 'default'}`,
        originalBrandKey: cleanName,
        brandName: cleanName,
        originalPurchasePrice: o.purchasePrice ?? article.purchasePrice ?? 0,
        purchasePrice: o.purchasePrice ?? article.purchasePrice ?? 0,
        originalSalePrice: o.salePrice ?? article.salePrice ?? 0,
        salePrice: o.salePrice ?? article.salePrice ?? 0,
        isNew: false,
      };
    });

    if (initialSlots.length === 0) {
      const fallbackBrand = cleanBrandName(article.brand);
      initialSlots.push({
        slotId: 'existing_0_default',
        originalBrandKey: fallbackBrand,
        brandName: fallbackBrand,
        originalPurchasePrice: article.purchasePrice ?? 0,
        purchasePrice: article.purchasePrice ?? 0,
        originalSalePrice: article.salePrice ?? 0,
        salePrice: article.salePrice ?? 0,
        isNew: false,
      });
    }

    const initialCells: Record<string, CellDraft> = {};
    for (const wh of warehouses) {
      const stForWh = artStocks.find((s) => s.warehouseId === wh.id);
      for (const slot of initialSlots) {
        const qty = getBrandStockAcrossWarehouses(
          artStocks,
          article,
          slot.originalBrandKey,
          wh.id
        );
        const singleLoc = getSingleWarehouseBrandLocation(
          stForWh,
          article,
          slot.originalBrandKey,
          wh.id,
          warehouses,
          artStocks
        );
        const pureShelf = stripWarehousePrefix(singleLoc, warehouses, wh.name);
        const rawInv = getBrandInvoiceNumber(
          artStocks,
          article,
          slot.originalBrandKey,
          wh.id
        );
        const cleanInv = rawInv === '-' ? '' : rawInv;

        initialCells[makeCellKey(wh.id, slot.slotId)] = {
          quantity: qty,
          originalQty: qty,
          location: pureShelf,
          originalLocation: pureShelf,
          invoiceNumber: cleanInv,
          originalInvoice: cleanInv,
        };
      }
    }

    setBrandSlots(initialSlots);
    setCellDrafts(initialCells);
    setNewBrandCounter(1);
    setError('');

    // Pick initial active brand slot
    const cleanInitBrand = cleanBrandName(initialBrand).toLowerCase();
    const matchedSlot =
      (cleanInitBrand
        ? initialSlots.find((s) => s.brandName.toLowerCase() === cleanInitBrand)
        : undefined) || initialSlots[0];
    setActiveSlotId(matchedSlot?.slotId || '');

    // Pick initial active warehouse
    if (warehouseId && warehouseId !== 'ALL') {
      setActiveWarehouseId(warehouseId);
    } else {
      const stockWithQty = artStocks.find((s) => s.quantity > 0);
      const anyStockForArt = artStocks[0];
      const defaultWh =
        stockWithQty?.warehouseId ||
        anyStockForArt?.warehouseId ||
        warehouses.find((w) => w.isDefault)?.id ||
        warehouses[0]?.id ||
        '';
      setActiveWarehouseId(defaultWh);
    }
  }, [article?.id, initialBrand, warehouseId]);

  if (!article) return null;

  const activeWarehouse =
    warehouses.find((w) => w.id === activeWarehouseId) ||
    warehouses.find((w) => w.isDefault) ||
    warehouses[0];

  const activeSlot =
    brandSlots.find((s) => s.slotId === activeSlotId) || brandSlots[0];

  const activeCellKey =
    activeWarehouse && activeSlot
      ? makeCellKey(activeWarehouse.id, activeSlot.slotId)
      : '';

  const activeCell: CellDraft = (activeCellKey && cellDrafts[activeCellKey]) || {
    quantity: 0,
    originalQty: 0,
    location: '',
    originalLocation: '',
    invoiceNumber: '',
    originalInvoice: '',
  };

  const updateActiveSlot = (updates: Partial<BrandSlotDraft>) => {
    if (!activeSlot) return;
    setBrandSlots((prev) =>
      prev.map((s) => (s.slotId === activeSlot.slotId ? { ...s, ...updates } : s))
    );
  };

  const updateActiveCell = (updates: Partial<CellDraft>) => {
    if (!activeCellKey) return;
    setCellDrafts((prev) => {
      const current = prev[activeCellKey] || {
        quantity: 0,
        originalQty: 0,
        location: '',
        originalLocation: '',
        invoiceNumber: '',
        originalInvoice: '',
      };
      return {
        ...prev,
        [activeCellKey]: { ...current, ...updates },
      };
    });
  };

  const handleAddNewBrandSlot = () => {
    const newId = `__NEW__${newBrandCounter}`;
    setNewBrandCounter((c) => c + 1);

    const newSlot: BrandSlotDraft = {
      slotId: newId,
      originalBrandKey: newId,
      brandName: '',
      originalPurchasePrice: article.purchasePrice ?? 0,
      purchasePrice: article.purchasePrice ?? 0,
      originalSalePrice: article.salePrice ?? 0,
      salePrice: article.salePrice ?? 0,
      isNew: true,
    };

    setBrandSlots((prev) => [...prev, newSlot]);
    setCellDrafts((prev) => {
      const next = { ...prev };
      for (const wh of warehouses) {
        next[makeCellKey(wh.id, newId)] = {
          quantity: 0,
          originalQty: 0,
          location: '',
          originalLocation: '',
          invoiceNumber: '',
          originalInvoice: '',
        };
      }
      return next;
    });
    setActiveSlotId(newId);
    setError('');
  };

  const handleRemoveNewBrandSlot = (slotId: string) => {
    setBrandSlots((prev) => {
      const remaining = prev.filter((s) => s.slotId !== slotId);
      if (activeSlotId === slotId && remaining.length > 0) {
        setActiveSlotId(remaining[0].slotId);
      }
      return remaining;
    });
    setCellDrafts((prev) => {
      const next = { ...prev };
      for (const wh of warehouses) {
        delete next[makeCellKey(wh.id, slotId)];
      }
      return next;
    });
  };

  const isCellModified = (cell?: CellDraft): boolean => {
    if (!cell) return false;
    return (
      cell.quantity !== cell.originalQty ||
      cell.location.trim() !== cell.originalLocation.trim() ||
      cell.invoiceNumber.trim() !== cell.originalInvoice.trim()
    );
  };

  const isBrandModified = (slot: BrandSlotDraft): boolean => {
    if (slot.isNew) return true;
    if (
      cleanBrandName(slot.brandName).toLowerCase() !==
        cleanBrandName(slot.originalBrandKey).toLowerCase() ||
      slot.purchasePrice !== slot.originalPurchasePrice ||
      slot.salePrice !== slot.originalSalePrice
    ) {
      return true;
    }
    return warehouses.some((wh) =>
      isCellModified(cellDrafts[makeCellKey(wh.id, slot.slotId)])
    );
  };

  const isWarehouseModified = (whId: string): boolean => {
    return brandSlots.some((slot) =>
      isCellModified(cellDrafts[makeCellKey(whId, slot.slotId)])
    );
  };

  // Compute live global totals across ALL warehouses & ALL brand slots
  let liveGlobalTotal = 0;
  let originalGlobalTotal = 0;
  let pendingChangesCount = 0;

  for (const slot of brandSlots) {
    if (
      slot.isNew ||
      cleanBrandName(slot.brandName).toLowerCase() !==
        cleanBrandName(slot.originalBrandKey).toLowerCase() ||
      slot.purchasePrice !== slot.originalPurchasePrice ||
      slot.salePrice !== slot.originalSalePrice
    ) {
      pendingChangesCount++;
    }
    for (const wh of warehouses) {
      const c = cellDrafts[makeCellKey(wh.id, slot.slotId)];
      if (c) {
        liveGlobalTotal += Math.max(0, Number(c.quantity) || 0);
        originalGlobalTotal += Math.max(0, Number(c.originalQty) || 0);
        if (isCellModified(c)) pendingChangesCount++;
      }
    }
  }

  const globalDiff = liveGlobalTotal - originalGlobalTotal;
  const qtyDiff = activeCell.quantity - activeCell.originalQty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!activeWarehouse) {
      setError('Veuillez sélectionner un magasin / dépôt.');
      return;
    }

    // Validate all new brand slots have a name and no negative numbers exist
    const seenNames = new Set<string>();
    for (const slot of brandSlots) {
      const cleanName = cleanBrandName(slot.brandName);
      if (slot.isNew && !cleanName) {
        setActiveSlotId(slot.slotId);
        setError('Veuillez saisir le nom de la nouvelle marque ajoutée (ou la supprimer).');
        return;
      }
      if (slot.purchasePrice < 0 || slot.salePrice < 0) {
        setActiveSlotId(slot.slotId);
        setError('Les prix ne peuvent pas être négatifs.');
        return;
      }
      if (cleanName) {
        const lower = cleanName.toLowerCase();
        if (seenNames.has(lower)) {
          setActiveSlotId(slot.slotId);
          setError(`La marque "${cleanName}" apparaît en double. Veuillez utiliser un nom distinct.`);
          return;
        }
        seenNames.add(lower);
      }
      for (const wh of warehouses) {
        const c = cellDrafts[makeCellKey(wh.id, slot.slotId)];
        if (c && c.quantity < 0) {
          setActiveWarehouseId(wh.id);
          setActiveSlotId(slot.slotId);
          setError('La quantité ne peut pas être négative.');
          return;
        }
      }
    }

    // Build complete brandUpdates & cellUpdates payload for ALL slots & warehouses
    const brandUpdates = brandSlots.map((slot) => ({
      originalBrandKey: slot.originalBrandKey,
      brandName: cleanBrandName(slot.brandName),
      purchasePrice: slot.purchasePrice,
      salePrice: slot.salePrice,
      isNew: slot.isNew,
    }));

    const cellUpdates: Array<{
      warehouseId: string;
      originalBrandKey: string;
      brandName: string;
      newQuantity: number;
      newLocation: string;
      invoiceNumber?: string;
    }> = [];

    for (const wh of warehouses) {
      for (const slot of brandSlots) {
        const c = cellDrafts[makeCellKey(wh.id, slot.slotId)];
        if (!c) continue;
        // Include cell if it was modified, is a new brand with qty/location, or belongs to an active warehouse record
        const shouldSend =
          isCellModified(c) ||
          slot.isNew ||
          c.quantity > 0 ||
          c.originalQty > 0 ||
          (wh.id === activeWarehouse.id && slot.slotId === activeSlot?.slotId);
        if (shouldSend) {
          cellUpdates.push({
            warehouseId: wh.id,
            originalBrandKey: slot.originalBrandKey,
            brandName: cleanBrandName(slot.brandName),
            newQuantity: c.quantity,
            newLocation: c.location.trim() || 'Non renseigné',
            invoiceNumber: c.invoiceNumber.trim(),
          });
        }
      }
    }

    const res = quickUpdateArticleStocks({
      articleId: article.id,
      brandUpdates,
      cellUpdates,
    });

    if (!res.success) {
      setError(res.error || 'Erreur lors de la mise à jour du stock.');
      return;
    }

    if (onSaved && res.message) {
      onSaved(res.message);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-[#E0E0E0] overflow-hidden animate-in zoom-in-95 duration-150 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#111111] text-white flex items-start justify-between gap-3 border-b-2 border-[#FFCD11]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#FFCD11] text-[#111111] font-mono font-bold text-xs">
                {article.mainReference}
              </span>
              <span className="text-xs text-white/65 truncate">
                Modification Stock, Emplacement & Prix
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-1 truncate">
              {article.designation}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/65 hover:text-white p-1 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Total Banner across ALL warehouses & brands */}
        <div className="px-5 py-2.5 bg-[#FFF9DF] border-b border-[#E5C130] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#111111]">
            <Boxes className="w-4 h-4 text-[#7A5C00] shrink-0" />
            <span className="font-semibold">Total pièce (tous dépôts & marques) :</span>
            <strong className="font-mono font-extrabold text-sm tabular-nums">
              {liveGlobalTotal} {article.unit}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {globalDiff !== 0 && (
              <span
                className={`font-mono font-bold text-[11px] px-1.5 py-0.5 ${
                  globalDiff > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {globalDiff > 0 ? `+${globalDiff}` : globalDiff}
              </span>
            )}
            {pendingChangesCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#111111] text-[#FFCD11] font-mono font-bold text-[10px]">
                {pendingChangesCount} modif. en mémoire
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 0. Warehouse selector (Magasin concerné) */}
          {warehouses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#595959] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#7A5C00]" />
                  Magasin / Dépôt concerné
                </label>
                <span className="text-[10px] text-[#595959]">
                  Les saisies sont conservées en changeant de magasin
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {warehouses.map((wh) => {
                  const isActiveWh = wh.id === activeWarehouse?.id;
                  const cell = activeSlot
                    ? cellDrafts[makeCellKey(wh.id, activeSlot.slotId)]
                    : undefined;
                  const whBrandQty = cell ? cell.quantity : 0;
                  const whModified = isWarehouseModified(wh.id);

                  return (
                    <button
                      key={wh.id}
                      type="button"
                      onClick={() => setActiveWarehouseId(wh.id)}
                      className={`px-3 py-1.5 border font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActiveWh
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : whModified
                          ? 'bg-[#FFF9DF] text-[#111111] border-[#E5C130] hover:bg-[#FFCD11]/30'
                          : 'bg-[#F4F4F4] text-[#111111] border-[#E0E0E0] hover:bg-[#E0E0E0]/60'
                      }`}
                    >
                      {whModified && (
                        <span
                          className="w-2 h-2 bg-[#FFCD11] border border-[#111111] shrink-0"
                          title="Modifications en attente dans ce magasin"
                        />
                      )}
                      <span>{wh.name}</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 ${
                          isActiveWh
                            ? 'bg-[#FFCD11] text-[#111111] font-bold'
                            : whBrandQty > 0
                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        Qté: {whBrandQty}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brand selector & editable brand name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#595959] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#7A5C00]" />
                Marque concernée
              </label>
              <button
                type="button"
                onClick={handleAddNewBrandSlot}
                className="px-2 py-0.5 border text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 bg-[#FFF9DF] text-[#7A5C00] border-[#E5C130] hover:bg-[#FFCD11] hover:text-[#111111]"
              >
                <Plus className="w-3 h-3" />
                <span>Nouvelle marque</span>
              </button>
            </div>

            {brandSlots.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {brandSlots.map((slot) => {
                  const isActive = slot.slotId === activeSlot?.slotId;
                  const cell = activeWarehouse
                    ? cellDrafts[makeCellKey(activeWarehouse.id, slot.slotId)]
                    : undefined;
                  const bQtyInWh = cell ? cell.quantity : 0;
                  const slotModified = isBrandModified(slot);

                  return (
                    <div key={slot.slotId} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setActiveSlotId(slot.slotId)}
                        className={`px-2.5 py-1 border font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : slotModified
                            ? 'bg-[#FFF9DF] text-[#111111] border-[#E5C130] hover:bg-[#FFCD11]/30'
                            : 'bg-[#F4F4F4] text-[#111111] border-[#E0E0E0] hover:bg-[#E0E0E0]/60'
                        }`}
                      >
                        {slotModified && (
                          <span
                            className="w-2 h-2 bg-[#FFCD11] border border-[#111111] shrink-0"
                            title="Modifications en attente pour cette marque"
                          />
                        )}
                        <span>
                          {slot.brandName.trim() ||
                            (slot.isNew ? 'Nouvelle marque' : 'Sans marque')}
                        </span>
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 ${
                            isActive
                              ? 'bg-[#FFCD11] text-[#111111] font-bold'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          Qté: {bQtyInWh}
                        </span>
                      </button>
                      {slot.isNew && brandSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNewBrandSlot(slot.slotId)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Annuler cette nouvelle marque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeSlot && (
              <div>
                <input
                  type="text"
                  list="quick-edit-brands-datalist"
                  value={activeSlot.brandName}
                  onChange={(e) => updateActiveSlot({ brandName: e.target.value })}
                  placeholder={
                    activeSlot.isNew
                      ? 'Saisir le nom de la nouvelle marque (ex: Donaldson, CTP...)'
                      : 'Nom de la marque (ex: Caterpillar, CTP, ITR...)'
                  }
                  className="w-full px-3 py-2 bg-[#F4F4F4] border border-[#E0E0E0] font-semibold text-[#111111] focus:outline-none focus:border-[#FFCD11]"
                />
                <datalist id="quick-edit-brands-datalist">
                  {allCatalogBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {/* 1. Emplacement propre à ce magasin */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#595959] mb-1.5 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#7A5C00]" />
                Emplacement dans {activeWarehouse?.name || 'ce magasin'}
              </span>
              <span className="text-[10px] font-mono font-semibold text-[#7A5C00] bg-[#FFF9DF] px-1.5 py-0.5 border border-[#E5C130]">
                Propre au dépôt
              </span>
            </label>
            <div className="flex items-stretch border border-[#E0E0E0] overflow-hidden focus-within:border-[#FFCD11]">
              <span className="px-2.5 py-2 bg-[#F4F4F4] border-r border-[#E0E0E0] font-mono font-bold text-[#111111] text-xs flex items-center shrink-0">
                {activeWarehouse?.name || 'Magasin'} :
              </span>
              <input
                type="text"
                value={activeCell.location}
                onChange={(e) => updateActiveCell({ location: e.target.value })}
                placeholder="Ex: Rayon A - Étagère 2 - Case 4"
                className="w-full px-3 py-2 font-mono text-xs text-[#111111] focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Quantité disponible dans ce magasin */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#595959] flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[#7A5C00]" />
                Quantité dans {activeWarehouse?.name || 'ce magasin'} ({article.unit})
              </label>
              {qtyDiff !== 0 && (
                <span
                  className={`font-mono font-bold text-[11px] px-1.5 py-0.5 ${
                    qtyDiff > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} vs actuel ({activeCell.originalQty})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateActiveCell({ quantity: Math.max(0, activeCell.quantity - 1) })
                }
                className="p-2 border border-[#E0E0E0] bg-[#F4F4F4] hover:bg-[#E0E0E0] text-[#111111] transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <NumericInput
                min={0}
                value={activeCell.quantity}
                onChange={(val) =>
                  updateActiveCell({ quantity: Math.max(0, Math.floor(val)) })
                }
                placeholder="0"
                className="flex-1 px-3 py-2 text-center font-mono font-bold text-sm text-[#111111] border border-[#E0E0E0] focus:outline-none focus:border-[#FFCD11] tabular-nums"
              />
              <button
                type="button"
                onClick={() =>
                  updateActiveCell({ quantity: activeCell.quantity + 1 })
                }
                className="p-2 border border-[#E0E0E0] bg-[#F4F4F4] hover:bg-[#E0E0E0] text-[#111111] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3. Prix d'achat & Prix de vente */}
          {activeSlot && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#595959] mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-[#595959]" />
                  Prix d'achat unit. (FCFA)
                </label>
                <NumericInput
                  min={0}
                  step={100}
                  value={activeSlot.purchasePrice}
                  onChange={(val) =>
                    updateActiveSlot({ purchasePrice: Math.max(0, val) })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 font-mono font-bold text-xs text-[#111111] border border-[#E0E0E0] focus:outline-none focus:border-[#FFCD11] tabular-nums"
                />
                <span className="text-[10px] text-[#595959] font-mono mt-0.5 block">
                  {formatFCFA(activeSlot.purchasePrice)}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Prix de vente unit. (FCFA)
                </label>
                <NumericInput
                  min={0}
                  step={100}
                  value={activeSlot.salePrice}
                  onChange={(val) =>
                    updateActiveSlot({ salePrice: Math.max(0, val) })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 font-mono font-bold text-xs text-emerald-800 bg-emerald-50/40 border border-emerald-300 focus:outline-none focus:border-emerald-500 tabular-nums"
                />
                <span className="text-[10px] text-emerald-700 font-mono font-semibold mt-0.5 block">
                  {formatFCFA(activeSlot.salePrice)}
                </span>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E0E0E0] text-[#111111] hover:bg-[#F4F4F4] font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {pendingChangesCount > 1
                  ? `Enregistrer tout (${pendingChangesCount})`
                  : 'Enregistrer'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
