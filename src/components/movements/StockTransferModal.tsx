import React, { useState, useEffect, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleBrandOffer } from '../../types';
import { X, ArrowLeftRight, AlertTriangle, ShieldCheck, MapPin, Building2, Tag } from 'lucide-react';
import { ArticleSearchSelect } from '../common/ArticleSearchSelect';
import {
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getSingleWarehouseBrandLocation,
  stripWarehousePrefix,
} from '../../utils/articleHelpers';
import { NumericInput } from '../common/NumericInput';

interface StockTransferModalProps {
  isOpen: boolean;
  preselectedArticleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  preselectedArticleId,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    warehouses,
    stocks,
    getStockForArticleAndWarehouse,
    recordTransfer,
  } = useStock();

  const [sourceWhId, setSourceWhId] = useState('');
  const [targetWhId, setTargetWhId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [targetLocation, setTargetLocation] = useState<string>('');
  const [documentRef, setDocumentRef] = useState('');
  const [reason, setReason] = useState('Réapprovisionnement de dépôt');
  const [notes, setNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initArtId = preselectedArticleId || '';
      setSourceWhId('');
      setTargetWhId('');
      setArticleId(initArtId);
      setSelectedBrand('');
      setQuantity(1);
      setTargetLocation('');
      setDocumentRef(`BT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setReason('Réapprovisionnement de dépôt régional');
      setNotes('');
      setIsConfirming(false);
      setErrorMessage('');
    }
  }, [isOpen, preselectedArticleId, warehouses, articles]);

  // Pre-fill targetLocation with any existing location in targetWhId for this article/brand
  useEffect(() => {
    if (!articleId || !targetWhId) {
      setTargetLocation('');
      return;
    }
    const art = articles.find((a) => a.id === articleId);
    if (!art) return;
    const artStocks = stocks.filter((s) => s.articleId === articleId);
    const tgtStock = artStocks.find((s) => s.warehouseId === targetWhId);
    const tgtWh = warehouses.find((w) => w.id === targetWhId);
    const bName = selectedBrand || art.brand || '';
    const existingLoc = getSingleWarehouseBrandLocation(
      tgtStock,
      art,
      bName,
      targetWhId,
      warehouses,
      artStocks
    );
    setTargetLocation(stripWarehousePrefix(existingLoc, warehouses, tgtWh?.name));
  }, [articleId, targetWhId, selectedBrand, articles, stocks, warehouses]);

  const sourceWh = warehouses.find((w) => w.id === sourceWhId);
  const targetWh = warehouses.find((w) => w.id === targetWhId);
  const selectedArticle = articles.find((a) => a.id === articleId);

  const articleStocksForSelected = useMemo(
    () => stocks.filter((s) => s.articleId === articleId),
    [stocks, articleId]
  );

  const sourceStockRecord = articleStocksForSelected.find(
    (s) => s.warehouseId === sourceWhId
  );
  const targetStockRecord = articleStocksForSelected.find(
    (s) => s.warehouseId === targetWhId
  );

  // Collect all distinct brands for the selected article (from brandOffers + any stock brandBreakdown)
  const allArticleBrands = useMemo(() => {
    if (!selectedArticle) return [];
    const baseOffers = getArticleBrandOffers(selectedArticle);
    const offers: ArticleBrandOffer[] = [...baseOffers];

    articleStocksForSelected.forEach((s) => {
      if (s.brandBreakdown) {
        Object.keys(s.brandBreakdown).forEach((bName) => {
          const cleanB = bName.trim();
          if (
            cleanB &&
            !offers.some((o) => o.brand.toLowerCase().trim() === cleanB.toLowerCase())
          ) {
            offers.push({
              id: `bo_dyn_${selectedArticle.id}_${cleanB}`,
              brand: cleanB,
              brandReference: selectedArticle.mainReference,
              purchasePrice: selectedArticle.purchasePrice,
              salePrice: selectedArticle.salePrice,
              location: s.shelfLocation || selectedArticle.defaultLocation || 'Non renseigné',
            });
          }
        });
      }
    });

    return offers;
  }, [selectedArticle, articleStocksForSelected]);

  // Compute all (Brand x Warehouse) stock lines across ALL warehouses for the selected article
  const allBrandWarehouseStockLines = useMemo(() => {
    if (!selectedArticle) return [];
    const lines: Array<{
      key: string;
      brand: string;
      warehouseId: string;
      warehouseName: string;
      warehouseCode: string;
      location: string;
      qty: number;
    }> = [];

    allArticleBrands.forEach((offer, offerIdx) => {
      let addedPositive = false;
      warehouses.forEach((wh) => {
        const st = articleStocksForSelected.find((s) => s.warehouseId === wh.id);
        const qtyInWh = st
          ? getBrandStockAcrossWarehouses([st], selectedArticle, offer.brand, wh.id)
          : 0;
        if (qtyInWh > 0) {
          const loc = getSingleWarehouseBrandLocation(
            st,
            selectedArticle,
            offer.brand,
            wh.id,
            warehouses,
            articleStocksForSelected
          );
          lines.push({
            key: `${offer.brand}_${wh.id}_${offerIdx}`,
            brand: offer.brand,
            warehouseId: wh.id,
            warehouseName: wh.name,
            warehouseCode: wh.code,
            location: loc,
            qty: qtyInWh,
          });
          addedPositive = true;
        }
      });

      if (!addedPositive) {
        const fallbackWh = sourceWh || warehouses[0];
        if (fallbackWh) {
          const st = articleStocksForSelected.find((s) => s.warehouseId === fallbackWh.id);
          const loc = getSingleWarehouseBrandLocation(
            st,
            selectedArticle,
            offer.brand,
            fallbackWh.id,
            warehouses,
            articleStocksForSelected
          );
          lines.push({
            key: `${offer.brand}_${fallbackWh.id}_zero_${offerIdx}`,
            brand: offer.brand,
            warehouseId: fallbackWh.id,
            warehouseName: fallbackWh.name,
            warehouseCode: fallbackWh.code,
            location: loc,
            qty: 0,
          });
        }
      }
    });

    return lines.sort((a, b) => {
      if (a.qty > 0 && b.qty <= 0) return -1;
      if (a.qty <= 0 && b.qty > 0) return 1;
      return b.qty - a.qty;
    });
  }, [selectedArticle, allArticleBrands, warehouses, articleStocksForSelected, sourceWh]);

  // Extract brands available at source warehouse (and across all offers)
  const sourceBrandsList = useMemo(() => {
    if (!selectedArticle) return [];
    const list: Array<{ brand: string; qty: number; totalAllWh: number }> = [];

    allArticleBrands.forEach((offer) => {
      const qtyInSrc = sourceStockRecord
        ? getBrandStockAcrossWarehouses([sourceStockRecord], selectedArticle, offer.brand, sourceWhId)
        : 0;
      const totalAllWh = getBrandStockAcrossWarehouses(
        articleStocksForSelected,
        selectedArticle,
        offer.brand,
        null
      );
      list.push({
        brand: offer.brand,
        qty: qtyInSrc,
        totalAllWh,
      });
    });

    return list;
  }, [selectedArticle, allArticleBrands, sourceStockRecord, sourceWhId, articleStocksForSelected]);

  if (!isOpen) return null;

  const totalAvailableAtSource =
    sourceWhId && articleId ? getStockForArticleAndWarehouse(articleId, sourceWhId) : 0;
  const selectedBrandEntry = selectedBrand
    ? sourceBrandsList.find(
        (b) => b.brand.toLowerCase().trim() === selectedBrand.toLowerCase().trim()
      )
    : undefined;
  const availableAtSource = selectedBrandEntry
    ? selectedBrandEntry.qty
    : totalAvailableAtSource;

  const targetCurrentStock =
    targetWhId && articleId ? getStockForArticleAndWarehouse(articleId, targetWhId) : 0;

  const isQuantityValid = quantity > 0 && quantity <= availableAtSource;
  const isWarehousesValid = sourceWhId !== targetWhId && !!sourceWhId && !!targetWhId;

  const handleSelectBrandAndWarehouseLine = (
    art: Article,
    brand: string,
    whId: string
  ) => {
    setArticleId(art.id);
    setSelectedBrand(brand);
    if (whId) {
      setSourceWhId(whId);
      if (targetWhId === whId) {
        const otherWh = warehouses.find((w) => w.id !== whId);
        if (otherWh) setTargetWhId(otherWh.id);
      }
    }
    setErrorMessage('');
  };

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isWarehousesValid) {
      setErrorMessage('Le magasin de départ et le magasin d’arrivée doivent être différents.');
      return;
    }
    if (quantity <= 0) {
      setErrorMessage('La quantité doit être supérieure à zéro.');
      return;
    }
    if (quantity > availableAtSource) {
      setErrorMessage(
        `Stock insuffisant au départ de ${sourceWh?.name}${selectedBrand ? ` pour la marque ${selectedBrand}` : ''}. Disponible : ${availableAtSource}, demandé : ${quantity}.`
      );
      return;
    }
    if (!documentRef.trim()) {
      setErrorMessage('Le numéro de bordereau de transfert est obligatoire.');
      return;
    }

    setIsConfirming(true);
  };

  const handleExecuteTransfer = () => {
    const effectiveBrand =
      selectedBrand ||
      (sourceBrandsList.length === 1 ? sourceBrandsList[0].brand : undefined);

    const result = recordTransfer({
      articleId,
      sourceWarehouseId: sourceWhId,
      targetWarehouseId: targetWhId,
      quantity: Number(quantity),
      brand: effectiveBrand,
      targetLocation: targetLocation.trim() || undefined,
      documentRef: documentRef.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors du transfert.');
      setIsConfirming(false);
    } else {
      onSuccess(
        `Transfert de ${quantity} ${selectedArticle?.unit || 'pièce(s)'}${effectiveBrand ? ` (${effectiveBrand})` : ''} de ${sourceWh?.code} vers ${targetWh?.code} exécuté avec succès.`
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-amber-600 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-700/30 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Transfert Inter-Magasins
              </h2>
              <p className="text-xs text-slate-900 font-medium">
                Déplacement physique et traçabilité bilatérale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-950/70 hover:text-slate-950 p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isConfirming ? (
          <form onSubmit={handleSubmitStep1} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Warehouse Source & Destination Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  1. Magasin de départ (Source) *
                </label>
                <select
                  value={sourceWhId}
                  onChange={(e) => {
                    const nextSrc = e.target.value;
                    setSourceWhId(nextSrc);
                    if (nextSrc && targetWhId === nextSrc) {
                      setTargetWhId('');
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  <option value="">-- Choisir le magasin de départ --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  2. Magasin d&apos;arrivée (Cible) *
                </label>
                <select
                  value={targetWhId}
                  onChange={(e) => setTargetWhId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  <option value="">-- Choisir le magasin d&apos;arrivée --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sourceWhId && targetWhId && sourceWhId === targetWhId && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                Le magasin de départ et le magasin d&apos;arrivée ne peuvent pas être identiques.
              </div>
            )}

            {/* Article Selection with multi-brand & multi-depot searchable combobox */}
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={articleId}
              selectedBrand={selectedBrand}
              expandByBrandAndWarehouse={true}
              onSelectBrandAndWarehouse={handleSelectBrandAndWarehouseLine}
              onSelectArticle={(art) => {
                setArticleId(art.id);
                setSelectedBrand('');
                const currentStockInSrc = getStockForArticleAndWarehouse(art.id, sourceWhId);
                if (currentStockInSrc <= 0) {
                  const whWithStock = warehouses.find(
                    (w) => getStockForArticleAndWarehouse(art.id, w.id) > 0
                  );
                  if (whWithStock) {
                    setSourceWhId(whWithStock.id);
                    if (targetWhId === whWithStock.id) {
                      const otherWh = warehouses.find((w) => w.id !== whWithStock.id);
                      if (otherWh) setTargetWhId(otherWh.id);
                    }
                  }
                }
              }}
              warehouseId={sourceWhId}
              getStockForWarehouse={getStockForArticleAndWarehouse}
              label="3. Pièce à transférer (Référence, Marque & Dépôt)"
              helperText="Affiche toutes les marques et dépôts"
              placeholder="Tapez réf (ex: 6i2499, 1R-0716), désignation, marque..."
            />

            {/* Interactive Multi-Brand & Multi-Depot availability table for the selected reference */}
            {selectedArticle && allBrandWarehouseStockLines.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Marques & Dépôts pour{' '}
                      <strong className="font-mono text-slate-900">
                        {selectedArticle.mainReference}
                      </strong>{' '}
                      ({allBrandWarehouseStockLines.length})
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Cliquez sur une ligne pour la transférer
                  </span>
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                  {allBrandWarehouseStockLines.map((line) => {
                    const isCurrentSelection =
                      sourceWhId === line.warehouseId &&
                      (selectedBrand
                        ? selectedBrand.toLowerCase().trim() === line.brand.toLowerCase().trim()
                        : allArticleBrands.length === 1);

                    return (
                      <button
                        key={line.key}
                        type="button"
                        onClick={() =>
                          handleSelectBrandAndWarehouseLine(
                            selectedArticle,
                            line.brand,
                            line.warehouseId
                          )
                        }
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isCurrentSelection
                            ? 'bg-amber-100/90 border-amber-400 text-slate-950 font-semibold shadow-2xs'
                            : line.qty > 0
                            ? 'bg-white hover:bg-amber-50/70 border-slate-200 text-slate-800'
                            : 'bg-slate-100/70 hover:bg-slate-100 border-slate-200/70 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-400 shrink-0">
                            {line.brand}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] shrink-0">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {line.warehouseName}
                          </span>
                          {line.location && line.location !== 'Non renseigné' && (
                            <span className="text-[10px] font-mono text-slate-500 truncate">
                              ({line.location})
                            </span>
                          )}
                        </div>

                        <span
                          className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded shrink-0 ${
                            line.qty > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          Dispo : {line.qty} {selectedArticle.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Brand selection dropdown */}
            {sourceBrandsList.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Marque à transférer ({sourceWh?.code || sourceWh?.name})
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    const nextBrand = e.target.value;
                    setSelectedBrand(nextBrand);
                    if (nextBrand && selectedArticle) {
                      const entryInCurrentWh = sourceBrandsList.find(
                        (b) => b.brand.toLowerCase().trim() === nextBrand.toLowerCase().trim()
                      );
                      // If the chosen brand has 0 stock in the current source warehouse, but has stock in another warehouse, auto-select that warehouse!
                      if (!entryInCurrentWh || entryInCurrentWh.qty <= 0) {
                        const lineWithStock = allBrandWarehouseStockLines.find(
                          (l) =>
                            l.brand.toLowerCase().trim() === nextBrand.toLowerCase().trim() &&
                            l.qty > 0
                        );
                        if (lineWithStock) {
                          setSourceWhId(lineWithStock.warehouseId);
                          if (targetWhId === lineWithStock.warehouseId) {
                            const otherWh = warehouses.find(
                              (w) => w.id !== lineWithStock.warehouseId
                            );
                            if (otherWh) setTargetWhId(otherWh.id);
                          }
                        }
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  <option value="">
                    Toutes marques disponibles dans {sourceWh?.name} ({totalAvailableAtSource} en stock)
                  </option>
                  {sourceBrandsList.map((b) => (
                    <option key={b.brand} value={b.brand}>
                      {b.brand} — Disponible dans {sourceWh?.name} : {b.qty}
                      {b.qty === 0 && b.totalAllWh > 0
                        ? ` (Dispo autre dépôt : ${b.totalAllWh})`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visual Transfer preview box */}
            {selectedArticle && sourceWh && targetWh && (() => {
              const bName =
                selectedBrand ||
                (sourceBrandsList.length === 1 ? sourceBrandsList[0].brand : selectedArticle.brand);
              const srcLoc = getSingleWarehouseBrandLocation(
                sourceStockRecord,
                selectedArticle,
                bName,
                sourceWh.id,
                warehouses,
                articleStocksForSelected
              );
              const tgtLoc = targetLocation.trim()
                ? `${targetWh.name} : ${targetLocation.trim()}`
                : getSingleWarehouseBrandLocation(
                    targetStockRecord,
                    selectedArticle,
                    bName,
                    targetWh.id,
                    warehouses,
                    articleStocksForSelected
                  );
              return (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-5/12 text-center p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block truncate font-bold">
                        {sourceWh.name} ({bName})
                      </span>
                      <span className="font-mono text-xs text-slate-500 block">
                        Dispo : <strong>{availableAtSource}</strong>
                      </span>
                      <span className="font-mono font-bold text-amber-700 block text-xs mt-0.5">
                        Après : {Math.max(0, availableAtSource - (Number(quantity) || 0))}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 block truncate mt-1">
                        Empl: {srcLoc}
                      </span>
                    </div>

                    <div className="text-amber-600 font-bold text-base">➔</div>

                    <div className="w-5/12 text-center p-2 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block truncate font-bold">
                        {targetWh.name} ({bName})
                      </span>
                      <span className="font-mono text-xs text-slate-500 block">
                        Actuel : <strong>{targetCurrentStock}</strong>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 block text-xs mt-0.5">
                        Après : {targetCurrentStock + (Number(quantity) || 0)}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-700 block truncate mt-1">
                        Empl: {tgtLoc}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Quantity & Target Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    4. Quantité à transférer *
                  </label>
                  <span className="text-xs text-slate-500">
                    Max : <strong className="font-mono text-slate-800">{availableAtSource}</strong>
                  </span>
                </div>
                <NumericInput
                  min={1}
                  max={availableAtSource}
                  value={quantity}
                  onChange={(val) => setQuantity(Math.max(1, Math.floor(val)))}
                  placeholder="1"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Empl. dans {targetWh?.name || 'arrivée'}</span>
                </label>
                <div className="flex items-stretch rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500">
                  <span className="px-2 py-2 bg-slate-100 border-r border-slate-300 font-mono font-bold text-slate-700 text-xs flex items-center shrink-0">
                    {targetWh?.name || 'Cible'} :
                  </span>
                  <input
                    type="text"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder="Ex: Rayon A1"
                    className="w-full px-2.5 py-2 text-xs font-mono text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Document Ref & Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  N° Bordereau de transfert *
                </label>
                <input
                  type="text"
                  required
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  placeholder="Ex: BT-2026-042"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif du transfert
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Réapprovisionnement chantier..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Transporteur / Véhicule de liaison
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Camionnette liaison Dakar-Thiès, Chauffeur Moussa..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            {/* Next Step */}
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
                disabled={!isQuantityValid || !isWarehousesValid}
                className="px-5 py-2 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                Vérifier & Confirmer
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation Step 2 */
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-sm space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Confirmation formelle du transfert
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Vous êtes sur le point d'effectuer un transfert officiel :
              </p>
              <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5 font-medium">
                <div>
                  Article : <strong>{selectedArticle?.mainReference}</strong> ({selectedArticle?.designation})
                </div>
                <div>
                  Quantité : <strong className="font-mono text-sm">{quantity} {selectedArticle?.unit}</strong>
                </div>
                <div>
                  Départ : <strong>{sourceWh?.name}</strong> ({sourceWh?.code})
                </div>
                <div>
                  Destination : <strong>{targetWh?.name}</strong> ({targetWh?.code})
                </div>
                <div>
                  Bordereau : <strong className="font-mono">{documentRef}</strong>
                </div>
              </div>
              <p className="text-[11px] text-amber-800">
                Règle ERP : Les stocks seront modifiés de manière atomique. Aucun élément ne sera créé ni supprimé artificiellement.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Valider définitivement le transfert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
