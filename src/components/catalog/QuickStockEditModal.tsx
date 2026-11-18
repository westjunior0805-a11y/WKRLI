import React, { useState, useEffect, useMemo } from 'react';
import { Article } from '../../types';
import { useStock } from '../../context/StockContext';
import {
  getArticleBrandOffers,
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
} from 'lucide-react';
import { NumericInput } from '../common/NumericInput';

interface QuickStockEditModalProps {
  article: Article | null;
  initialBrand?: string;
  warehouseId?: string | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export const QuickStockEditModal: React.FC<QuickStockEditModalProps> = ({
  article: propArticle,
  initialBrand,
  warehouseId,
  onClose,
  onSaved,
}) => {
  const { articles, stocks, warehouses, quickUpdateStockItem } = useStock();

  const article = propArticle
    ? articles.find((a) => a.id === propArticle.id) || propArticle
    : null;

  const [activeWarehouseId, setActiveWarehouseId] = useState<string>('');
  const [activeBrandSlot, setActiveBrandSlot] = useState<string>('');
  const [brandInput, setBrandInput] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [error, setError] = useState<string>('');

  const brandOffers = article ? getArticleBrandOffers(article) : [];

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

  // Initialize brand & warehouse when modal opens
  useEffect(() => {
    if (!article) return;
    const offers = getArticleBrandOffers(article);
    const defaultBrand =
      cleanBrandName(initialBrand) ||
      cleanBrandName(offers.find((o) => o.isDefault)?.brand) ||
      cleanBrandName(offers[0]?.brand) ||
      cleanBrandName(article.brand) ||
      '';
    setActiveBrandSlot(defaultBrand);
    setBrandInput(defaultBrand);

    if (warehouseId && warehouseId !== 'ALL') {
      setActiveWarehouseId(warehouseId);
    } else {
      const stockWithQty = stocks.find(
        (s) => s.articleId === article.id && s.quantity > 0
      );
      const anyStockForArt = stocks.find((s) => s.articleId === article.id);
      const defaultWh =
        stockWithQty?.warehouseId ||
        anyStockForArt?.warehouseId ||
        warehouses.find((w) => w.isDefault)?.id ||
        warehouses[0]?.id ||
        '';
      setActiveWarehouseId(defaultWh);
    }
  }, [article?.id, initialBrand, warehouseId]);

  // Populate fields whenever activeBrandSlot, activeWarehouseId, or article.id changes
  // Note: typing in brandInput does NOT trigger this effect, so quantity & location are never wiped
  useEffect(() => {
    if (!article || !activeWarehouseId) return;

    if (activeBrandSlot === '__NEW__') {
      setQuantity(0);
      setLocation('');
      setPurchasePrice(article.purchasePrice ?? 0);
      setSalePrice(article.salePrice ?? 0);
      setInvoiceNumber('');
      setError('');
      return;
    }

    const offers = getArticleBrandOffers(article);
    const matchingOffer =
      offers.find(
        (o) =>
          cleanBrandName(o.brand).toLowerCase() ===
          cleanBrandName(activeBrandSlot).toLowerCase()
      ) || offers[0];

    const artStocks = stocks.filter((s) => s.articleId === article.id);
    const stForWh = artStocks.find((s) => s.warehouseId === activeWarehouseId);
    const activeWhObj = warehouses.find((w) => w.id === activeWarehouseId);

    const currentQty = getBrandStockAcrossWarehouses(
      stocks,
      article,
      activeBrandSlot,
      activeWarehouseId
    );
    const currentSingleLoc = getSingleWarehouseBrandLocation(
      stForWh,
      article,
      activeBrandSlot,
      activeWarehouseId,
      warehouses,
      artStocks
    );
    const pureShelf = stripWarehousePrefix(
      currentSingleLoc,
      warehouses,
      activeWhObj?.name
    );

    const currentInv = getBrandInvoiceNumber(
      stocks,
      article,
      activeBrandSlot,
      activeWarehouseId
    );

    setQuantity(currentQty);
    setLocation(pureShelf);
    setPurchasePrice(matchingOffer?.purchasePrice ?? article.purchasePrice ?? 0);
    setSalePrice(matchingOffer?.salePrice ?? article.salePrice ?? 0);
    setInvoiceNumber(currentInv === '-' ? '' : currentInv);
    setError('');
  }, [article?.id, activeBrandSlot, activeWarehouseId]);

  if (!article) return null;

  const activeWarehouse =
    warehouses.find((w) => w.id === activeWarehouseId) ||
    warehouses.find((w) => w.isDefault) ||
    warehouses[0];

  const originalQty =
    activeBrandSlot === '__NEW__'
      ? 0
      : getBrandStockAcrossWarehouses(
          stocks,
          article,
          activeBrandSlot,
          activeWarehouseId
        );
  const qtyDiff = quantity - originalQty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!activeWarehouseId) {
      setError('Veuillez sélectionner le magasin / dépôt concerné.');
      return;
    }
    if (activeBrandSlot === '__NEW__' && !cleanBrandName(brandInput)) {
      setError('Veuillez saisir le nom de la nouvelle marque à ajouter.');
      return;
    }
    if (quantity < 0) {
      setError('La quantité ne peut pas être négative.');
      return;
    }
    if (purchasePrice < 0 || salePrice < 0) {
      setError('Les prix ne peuvent pas être négatifs.');
      return;
    }

    const res = quickUpdateStockItem({
      articleId: article.id,
      brandName: cleanBrandName(brandInput),
      previousBrandName:
        activeBrandSlot === '__NEW__' ? '__NEW__' : activeBrandSlot,
      warehouseId: activeWarehouseId || null,
      newQuantity: quantity,
      newLocation: location.trim() || 'Non renseigné',
      newPurchasePrice: purchasePrice,
      newSalePrice: salePrice,
      invoiceNumber: invoiceNumber.trim(),
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-bold text-xs">
                {article.mainReference}
              </span>
              <span className="text-xs text-slate-400 truncate">
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
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 0. Warehouse selector (Magasin concerné) */}
          {warehouses.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                Magasin / Dépôt concerné
              </label>
              <div className="flex flex-wrap gap-1.5">
                {warehouses.map((wh) => {
                  const isActiveWh = wh.id === activeWarehouseId;
                  const whBrandQty =
                    activeBrandSlot === '__NEW__'
                      ? 0
                      : getBrandStockAcrossWarehouses(
                          stocks,
                          article,
                          activeBrandSlot || cleanBrandName(article.brand),
                          wh.id
                        );
                  return (
                    <button
                      key={wh.id}
                      type="button"
                      onClick={() => setActiveWarehouseId(wh.id)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActiveWh
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{wh.name}</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                          isActiveWh
                            ? 'bg-amber-400 text-slate-950 font-bold'
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Marque concernée
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveBrandSlot('__NEW__');
                  setBrandInput('');
                }}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                  activeBrandSlot === '__NEW__'
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>Nouvelle marque</span>
              </button>
            </div>

            {brandOffers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {brandOffers.map((bo) => {
                  const boBrand = cleanBrandName(bo.brand);
                  const isActive =
                    activeBrandSlot !== '__NEW__' &&
                    boBrand.toLowerCase() === cleanBrandName(activeBrandSlot).toLowerCase();
                  const bQty = getBrandStockAcrossWarehouses(
                    stocks,
                    article,
                    boBrand,
                    activeWarehouseId
                  );
                  return (
                    <button
                      key={bo.id}
                      type="button"
                      onClick={() => {
                        setActiveBrandSlot(boBrand);
                        setBrandInput(boBrand);
                      }}
                      className={`px-2.5 py-1 rounded-lg border font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{boBrand || 'Sans marque'}</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Qté: {bQty}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <input
                type="text"
                list="quick-edit-brands-datalist"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                placeholder={
                  activeBrandSlot === '__NEW__'
                    ? 'Saisir le nom de la nouvelle marque (ex: Donaldson, CTP...)'
                    : 'Nom de la marque (ex: Caterpillar, CTP, ITR...)'
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <datalist id="quick-edit-brands-datalist">
                {allCatalogBrands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 1. Emplacement propre à ce magasin */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                Emplacement dans {activeWarehouse?.name || 'ce magasin'}
              </span>
              <span className="text-[10px] font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                Propre au dépôt
              </span>
            </label>
            <div className="flex items-stretch rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500">
              <span className="px-2.5 py-2 bg-slate-100 border-r border-slate-300 font-mono font-bold text-slate-700 text-xs flex items-center shrink-0">
                {activeWarehouse?.name || 'Magasin'} :
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Rayon A - Étagère 2 - Case 4"
                className="w-full px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Quantité disponible dans ce magasin */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                Quantité dans {activeWarehouse?.name || 'ce magasin'} ({article.unit})
              </label>
              {qtyDiff !== 0 && (
                <span
                  className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    qtyDiff > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} vs actuel ({originalQty})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <NumericInput
                min={0}
                value={quantity}
                onChange={(val) => setQuantity(Math.max(0, Math.floor(val)))}
                placeholder="0"
                className="flex-1 px-3 py-2 text-center font-mono font-bold text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 tabular-nums"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3. Prix d'achat & Prix de vente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                Prix d'achat unit. (FCFA)
              </label>
              <NumericInput
                min={0}
                step={100}
                value={purchasePrice}
                onChange={(val) => setPurchasePrice(Math.max(0, val))}
                placeholder="0"
                className="w-full px-3 py-2 font-mono font-bold text-xs text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 tabular-nums"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                {formatFCFA(purchasePrice)}
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
                value={salePrice}
                onChange={(val) => setSalePrice(Math.max(0, val))}
                placeholder="0"
                className="w-full px-3 py-2 font-mono font-bold text-xs text-emerald-800 bg-emerald-50/40 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 tabular-nums"
              />
              <span className="text-[10px] text-emerald-700 font-mono font-semibold mt-0.5 block">
                {formatFCFA(salePrice)}
              </span>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
