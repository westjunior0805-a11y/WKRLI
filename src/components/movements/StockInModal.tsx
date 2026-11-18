import React, { useState, useEffect, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { formatFCFA } from '../../utils/formatters';
import {
  getBrandLocation,
  stripWarehousePrefix,
  getArticleBrandOffers,
  cleanBrandName,
} from '../../utils/articleHelpers';
import { X, ArrowDownLeft, MapPin, Tag } from 'lucide-react';
import { ArticleSearchSelect } from '../common/ArticleSearchSelect';
import { NumericInput } from '../common/NumericInput';

interface StockInModalProps {
  isOpen: boolean;
  preselectedArticleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  preselectedArticleId,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    stocks,
    warehouses,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    recordStockIn,
    currentUser,
  } = useStock();

  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [reason, setReason] = useState('Réception commande fournisseur');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Collect all distinct brands across the entire catalog for suggestions
  const allCatalogBrands = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      const b = cleanBrandName(a.brand);
      if (b) set.add(b);
      if (a.brandOffers) {
        a.brandOffers.forEach((bo) => {
          const ob = cleanBrandName(bo.brand);
          if (ob) set.add(ob);
        });
      }
    });
    stocks.forEach((s) => {
      if (s.brandBreakdown) {
        Object.keys(s.brandBreakdown).forEach((b) => {
          const kb = cleanBrandName(b);
          if (kb) set.add(kb);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articles, stocks]);

  useEffect(() => {
    if (isOpen) {
      const defaultWh =
        selectedWarehouseId ||
        (currentUser.role === 'MAGASINIER' && currentUser.assignedWarehouseId
          ? currentUser.assignedWarehouseId
          : warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '');
      setWarehouseId(defaultWh);

      const defaultArt = preselectedArticleId || '';
      setArticleId(defaultArt);

      const art = articles.find((a) => a.id === defaultArt);
      if (art) {
        setUnitPrice(art.purchasePrice);
        setBrand(cleanBrandName(art.brand));
      } else {
        setUnitPrice(0);
        setBrand('');
      }

      setQuantity(1);
      setSupplier('');
      setDocumentRef(`BL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setReason('Réception commande fournisseur');
      setNotes('');
      setErrorMessage('');
    }
  }, [isOpen, preselectedArticleId, selectedWarehouseId, currentUser, warehouses, articles]);

  // Pre-fill existing location in the selected warehouse
  useEffect(() => {
    if (!isOpen || !articleId || !warehouseId) return;
    const art = articles.find((a) => a.id === articleId);
    if (!art) return;
    const targetWh = warehouses.find((w) => w.id === warehouseId);
    const articleStocks = stocks.filter((s) => s.articleId === articleId);
    const targetBrand = cleanBrandName(brand) || cleanBrandName(art.brand);
    const existingLoc = getBrandLocation(articleStocks, art, targetBrand, warehouseId, warehouses);
    const rawLoc = stripWarehousePrefix(existingLoc, warehouses, targetWh?.name);
    setLocation(rawLoc);
  }, [isOpen, articleId, warehouseId, brand, articles, stocks, warehouses]);

  if (!isOpen) return null;

  const selectedArticle = articles.find((a) => a.id === articleId);
  const selectedWh = warehouses.find((w) => w.id === warehouseId);
  const currentStock =
    warehouseId && articleId ? getStockForArticleAndWarehouse(articleId, warehouseId) : 0;
  const newStockPreview = currentStock + (Number(quantity) || 0);

  const articleKnownBrands = selectedArticle
    ? Array.from(
        new Set([
          ...(cleanBrandName(selectedArticle.brand) ? [cleanBrandName(selectedArticle.brand)] : []),
          ...getArticleBrandOffers(selectedArticle)
            .map((bo) => cleanBrandName(bo.brand))
            .filter(Boolean),
        ])
      )
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!warehouseId) {
      setErrorMessage('Veuillez sélectionner un magasin destinataire.');
      return;
    }
    if (!articleId) {
      setErrorMessage('Veuillez sélectionner une référence produit.');
      return;
    }
    if (!documentRef.trim()) {
      setErrorMessage('Le numéro de document (BL ou Facture) est obligatoire pour la traçabilité.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setErrorMessage('La quantité doit être un nombre entier positif.');
      return;
    }

    const effectiveBrand = cleanBrandName(brand) || cleanBrandName(selectedArticle?.brand);

    const result = recordStockIn({
      articleId,
      warehouseId,
      brand: effectiveBrand,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      supplier: supplier.trim(),
      documentRef: documentRef.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de l’enregistrement de l’entrée.');
    } else {
      onSuccess(
        `Entrée de ${quantity} ${selectedArticle?.unit || 'pièce(s)'}${
          effectiveBrand ? ` (${effectiveBrand})` : ''
        } enregistrée avec succès.`
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-900/60 rounded-lg">
              <ArrowDownLeft className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Entrée de Stock (Réception)</h2>
              <p className="text-xs text-emerald-200">
                Augmentation du stock physique et traçabilité comptable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Warehouse Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Magasin Destinataire *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
            >
              <option value="">-- Sélectionner un magasin --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name} ({wh.location})
                </option>
              ))}
            </select>
          </div>

          {/* 1. Reference Selection ONLY (without locking brand) */}
          <ArticleSearchSelect
            articles={articles}
            selectedArticleId={articleId}
            hideBrandInSelector={true}
            onSelectArticle={(art) => {
              setArticleId(art.id);
              setBrand(art.brand || '');
              setUnitPrice(art.purchasePrice);
              if (art.preferredSupplier) {
                setSupplier(art.preferredSupplier);
              }
            }}
            warehouseId={warehouseId}
            getStockForWarehouse={getStockForArticleAndWarehouse}
            label="Référence Produit *"
            helperText="Convoque uniquement la référence & désignation"
            placeholder="Tapez la référence produit (ex: 1R-0716, P551313) ou désignation..."
          />

          {/* 2. Separate Brand Field (Existing or Brand-New Brand) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                Marque / Constructeur (facultative)
              </span>
              <span className="text-[10px] font-normal text-slate-400 normal-case">
                Optionnel : choisissez une marque ou tapez une nouvelle marque
              </span>
            </label>
            <input
              type="text"
              list="stockin-brands-datalist"
              value={brand}
              onChange={(e) => {
                const val = e.target.value;
                setBrand(val);
                if (selectedArticle) {
                  const matchingOffer = getArticleBrandOffers(selectedArticle).find(
                    (bo) => bo.brand.toLowerCase().trim() === val.toLowerCase().trim()
                  );
                  if (matchingOffer && matchingOffer.purchasePrice > 0) {
                    setUnitPrice(matchingOffer.purchasePrice);
                  }
                }
              }}
              placeholder="Optionnel (ex: Caterpillar, Donaldson, Fleetguard, Perkins...)"
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <datalist id="stockin-brands-datalist">
              {allCatalogBrands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            {/* Quick selection chips for brands already known on this reference */}
            {articleKnownBrands.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[10px] text-slate-400">Marques connues sur cette réf :</span>
                {articleKnownBrands.map((kb) => (
                  <button
                    key={kb}
                    type="button"
                    onClick={() => {
                      setBrand(kb);
                      if (selectedArticle) {
                        const matchingOffer = getArticleBrandOffers(selectedArticle).find(
                          (bo) => bo.brand.toLowerCase().trim() === kb.toLowerCase().trim()
                        );
                        if (matchingOffer && matchingOffer.purchasePrice > 0) {
                          setUnitPrice(matchingOffer.purchasePrice);
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      brand.toLowerCase().trim() === kb.toLowerCase().trim()
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    {kb}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stock Simulation Preview */}
          {selectedArticle && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Stock actuel sur ce site :</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {currentStock} {selectedArticle.unit}
                </span>
              </div>
              <div className="text-emerald-700 font-bold text-lg">➔</div>
              <div className="text-right">
                <span className="text-slate-500 block">Nouveau stock après entrée :</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {newStockPreview} {selectedArticle.unit}
                </span>
              </div>
            </div>
          )}

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Quantité reçue *
              </label>
              <NumericInput
                min={1}
                value={quantity}
                onChange={(val) => setQuantity(Math.max(1, Math.floor(val)))}
                placeholder="1"
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Prix unitaire d'achat (FCFA)
              </label>
              <NumericInput
                min={0}
                step={100}
                value={unitPrice}
                onChange={(val) => setUnitPrice(val)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Total Cost Display */}
          <div className="text-right text-xs text-slate-600 font-medium">
            Valeur totale de l'entrée :{' '}
            <span className="font-mono font-bold text-slate-900">
              {formatFCFA((Number(quantity) || 0) * (Number(unitPrice) || 0))}
            </span>
          </div>

          {/* Warehouse Location (Emplacement) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Emplacement en rayon ({selectedWh?.name || 'Magasin'})
            </label>
            <div className="flex items-stretch">
              {selectedWh && (
                <span className="inline-flex items-center px-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-xs font-bold text-slate-600 whitespace-nowrap">
                  {selectedWh.name} :
                </span>
              )}
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Rayon A - Étagère 2"
                className={`w-full px-3 py-2 text-sm border border-slate-300 ${
                  selectedWh ? 'rounded-r-lg' : 'rounded-lg'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600`}
              />
            </div>
          </div>

          {/* Document Reference & Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                N° Document (BL / Facture) *
              </label>
              <input
                type="text"
                required
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                placeholder="Ex: BL-CFAO-2026-441"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Fournisseur
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Tractafric, CFAO, Donaldson"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Reason & Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Motif de l'opération
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Réception commande fournisseur n°..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Observations / N° de conteneur
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques éventuelles sur l'état des colis..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Valider l'entrée
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
