import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Article, ArticleBrandOffer } from '../../types';
import { useStock } from '../../context/StockContext';
import { fuzzyMatch } from '../../utils/fuzzySearch';
import {
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getBrandLocation,
} from '../../utils/articleHelpers';
import { Search, X, Check, Package, Boxes, ChevronDown, MapPin, Building2 } from 'lucide-react';

interface ArticleSearchSelectProps {
  articles: Article[];
  selectedArticleId: string;
  onSelectArticle: (article: Article) => void;
  selectedBrand?: string;
  expandByBrandAndWarehouse?: boolean;
  onSelectBrandAndWarehouse?: (article: Article, brand: string, warehouseId: string) => void;
  warehouseId?: string;
  getStockForWarehouse?: (articleId: string, warehouseId: string) => number;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  hideBrandInSelector?: boolean;
}

// Helpers for multi-token and alphanumeric search
const normalizeSearchText = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const toAlphanumeric = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const ArticleSearchSelect: React.FC<ArticleSearchSelectProps> = ({
  articles,
  selectedArticleId,
  onSelectArticle,
  selectedBrand,
  expandByBrandAndWarehouse = false,
  onSelectBrandAndWarehouse,
  warehouseId,
  getStockForWarehouse,
  label = 'Article / Pièce Détachée',
  required = true,
  disabled = false,
  placeholder = 'Tapez une référence (ex: 1R-0716, 1R0716), une désignation, une marque...',
  helperText,
  hideBrandInSelector = false,
}) => {
  const { stocks, warehouses, getTotalStockForArticle } = useStock();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId),
    [articles, selectedArticleId]
  );

  const stocksByArticleId = useMemo(() => {
    const map = new Map<string, typeof stocks>();
    for (const s of stocks) {
      const list = map.get(s.articleId);
      if (list) list.push(s);
      else map.set(s.articleId, [s]);
    }
    return map;
  }, [stocks]);

  // Helper to get all distinct brands for an article (from brandOffers + stocks brandBreakdown)
  const getAllBrandsForArticle = (art: Article): ArticleBrandOffer[] => {
    const baseOffers = getArticleBrandOffers(art);
    const offers: ArticleBrandOffer[] = [...baseOffers];
    const artStocks = stocksByArticleId.get(art.id) || [];

    artStocks.forEach((s) => {
      if (s.brandBreakdown) {
        Object.keys(s.brandBreakdown).forEach((bName) => {
          const cleanB = bName.trim();
          if (
            cleanB &&
            !offers.some((o) => o.brand.toLowerCase().trim() === cleanB.toLowerCase())
          ) {
            offers.push({
              id: `bo_dyn_${art.id}_${cleanB}`,
              brand: cleanB,
              brandReference: art.mainReference,
              purchasePrice: art.purchasePrice,
              salePrice: art.salePrice,
              location: s.shelfLocation || art.defaultLocation || 'Non renseigné',
            });
          }
        });
      }
    });

    return offers;
  };

  // Helper to build all (Brand x Warehouse) stock rows for an article
  const getBrandWarehouseRows = (art: Article) => {
    const offers = getAllBrandsForArticle(art);
    const artStocks = stocksByArticleId.get(art.id) || [];
    const rows: Array<{
      key: string;
      brand: string;
      warehouseId: string;
      warehouseName: string;
      warehouseCode: string;
      location: string;
      qty: number;
    }> = [];

    offers.forEach((offer, offerIdx) => {
      let addedWithPositiveStock = false;

      // Check every warehouse stock record for this article
      artStocks.forEach((s) => {
        const qtyInWh = getBrandStockAcrossWarehouses([s], art, offer.brand, s.warehouseId);
        if (qtyInWh > 0) {
          const wh = warehouses.find((w) => w.id === s.warehouseId);
          const whName = wh?.name || s.warehouseId;
          const whCode = wh?.code || s.warehouseId;
          const loc = getBrandLocation(artStocks, art, offer.brand, s.warehouseId, warehouses);
          rows.push({
            key: `${art.id}_${offer.brand}_${s.warehouseId}_${offerIdx}`,
            brand: offer.brand,
            warehouseId: s.warehouseId,
            warehouseName: whName,
            warehouseCode: whCode,
            location: loc,
            qty: qtyInWh,
          });
          addedWithPositiveStock = true;
        }
      });

      // If this brand has 0 stock in all warehouse records, still display it so the user sees all brands of the reference
      if (!addedWithPositiveStock) {
        const fallbackWhId = warehouseId || artStocks[0]?.warehouseId || warehouses[0]?.id || '';
        const wh = warehouses.find((w) => w.id === fallbackWhId);
        const whName = wh?.name || 'Dépôt';
        const whCode = wh?.code || '';
        const loc = getBrandLocation(artStocks, art, offer.brand, fallbackWhId || null, warehouses);
        const totalBrandQty = getBrandStockAcrossWarehouses(artStocks, art, offer.brand, null);
        rows.push({
          key: `${art.id}_${offer.brand}_${fallbackWhId}_fallback_${offerIdx}`,
          brand: offer.brand,
          warehouseId: fallbackWhId,
          warehouseName: whName,
          warehouseCode: whCode,
          location: loc,
          qty: totalBrandQty,
        });
      }
    });

    // Sort rows with positive stock first, and current warehouseId first
    return rows.sort((a, b) => {
      if (a.qty > 0 && b.qty <= 0) return -1;
      if (a.qty <= 0 && b.qty > 0) return 1;
      if (warehouseId) {
        if (a.warehouseId === warehouseId && b.warehouseId !== warehouseId) return -1;
        if (a.warehouseId !== warehouseId && b.warehouseId === warehouseId) return 1;
      }
      return b.qty - a.qty;
    });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter articles with multi-token, accent-tolerant, alphanumeric, and fuzzy search
  const filteredArticles = useMemo(() => {
    const activeArticles = articles.filter((a) => a.status !== 'archived');

    // Helper to sort articles that have stock first
    const sortByStock = (list: Article[]) => {
      return [...list].sort((a, b) => {
        const totalA = getTotalStockForArticle(a.id);
        const totalB = getTotalStockForArticle(b.id);
        const whStockA =
          warehouseId && getStockForWarehouse ? getStockForWarehouse(a.id, warehouseId) : totalA;
        const whStockB =
          warehouseId && getStockForWarehouse ? getStockForWarehouse(b.id, warehouseId) : totalB;

        if (expandByBrandAndWarehouse) {
          if (totalA > 0 && totalB <= 0) return -1;
          if (totalA <= 0 && totalB > 0) return 1;
        }
        if (whStockA > 0 && whStockB <= 0) return -1;
        if (whStockA <= 0 && whStockB > 0) return 1;
        return 0;
      });
    };

    if (!searchQuery.trim()) {
      return sortByStock(activeArticles).slice(0, 60);
    }

    const rawTerms = searchQuery.trim().split(/\s+/).filter(Boolean);
    const terms = rawTerms.map((t) => ({
      norm: normalizeSearchText(t),
      alnum: toAlphanumeric(t),
    }));

    const matched = activeArticles.filter((art) => {
      const parts: string[] = [
        art.id,
        art.mainReference,
        art.designation,
        art.description || '',
        art.notes || '',
        art.brand || '',
        art.category || '',
        art.barcode || '',
        art.unit || '',
        art.defaultLocation || '',
        art.rack || '',
        art.shelf || '',
        art.bin || '',
        ...(art.equivalentReferences || []),
        ...(art.compatibleMachines || []),
        ...(art.machineApplications || []).flatMap((m) => [
          m.model,
          m.serialPrefix || '',
          m.productFamily || '',
          m.subFamily || '',
          m.system || '',
          m.notes || '',
        ]),
      ];

      if (art.brandOffers && art.brandOffers.length > 0) {
        art.brandOffers.forEach((bo) => {
          parts.push(
            bo.brand,
            bo.brandReference || '',
            bo.preferredSupplier || '',
            bo.barcode || '',
            bo.location || ''
          );
        });
      }

      const artStocks = stocksByArticleId.get(art.id) || [];
      artStocks.forEach((s) => {
        if (s.shelfLocation) parts.push(s.shelfLocation);
        if (s.invoiceNumber) parts.push(s.invoiceNumber);
        if (s.brandBreakdown) parts.push(...Object.keys(s.brandBreakdown));
        if (s.brandLocations) parts.push(...Object.values(s.brandLocations));
      });

      const combined = parts.join(' ');
      const normCorpus = normalizeSearchText(combined);
      const alnumCorpus = toAlphanumeric(combined);

      const exactOrSub = terms.every((term) => {
        if (!term.norm && !term.alnum) return true;
        const matchNorm = term.norm ? normCorpus.includes(term.norm) : false;
        const matchAlnum = term.alnum ? alnumCorpus.includes(term.alnum) : false;
        return matchNorm || matchAlnum;
      });

      if (exactOrSub) return true;
      return fuzzyMatch(searchQuery, parts);
    });

    return sortByStock(matched);
  }, [
    articles,
    searchQuery,
    warehouseId,
    getStockForWarehouse,
    getTotalStockForArticle,
    stocksByArticleId,
    expandByBrandAndWarehouse,
  ]);

  const handleSelect = (art: Article) => {
    onSelectArticle(art);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectRow = (art: Article, brand: string, targetWhId: string) => {
    if (onSelectBrandAndWarehouse) {
      onSelectBrandAndWarehouse(art, brand, targetWhId);
    } else {
      onSelectArticle(art);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const currentAvailableStock = useMemo(() => {
    if (!selectedArticle) return undefined;
    if (selectedBrand && warehouseId) {
      const artStocks = stocksByArticleId.get(selectedArticle.id) || [];
      return getBrandStockAcrossWarehouses(artStocks, selectedArticle, selectedBrand, warehouseId);
    }
    if (warehouseId && getStockForWarehouse) {
      return getStockForWarehouse(selectedArticle.id, warehouseId);
    }
    return undefined;
  }, [selectedArticle, selectedBrand, warehouseId, getStockForWarehouse, stocksByArticleId]);

  const selectedArticleAllBrands = useMemo(
    () => (selectedArticle ? getAllBrandsForArticle(selectedArticle) : []),
    [selectedArticle, stocksByArticleId]
  );

  const activeWhObj = useMemo(
    () => (warehouseId ? warehouses.find((w) => w.id === warehouseId) : undefined),
    [warehouseId, warehouses]
  );

  return (
    <div ref={containerRef} className="relative space-y-1">
      {label && (
        <label className="flex items-center justify-between text-xs font-semibold text-slate-700 uppercase">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {helperText && <span className="text-[11px] text-slate-400 font-normal lowercase">{helperText}</span>}
        </label>
      )}

      {/* Main trigger / display button */}
      {!isOpen && selectedArticle ? (
        <div
          onClick={handleOpenDropdown}
          className={`flex items-center justify-between p-2.5 rounded-lg border bg-white transition-all cursor-pointer hover:border-amber-500 hover:shadow-xs group ${
            disabled ? 'opacity-60 pointer-events-none bg-slate-50' : 'border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold text-xs">
              <Package className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {selectedArticle.mainReference}
                </span>
                {!hideBrandInSelector && (selectedBrand || selectedArticle.brand) && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                    {selectedBrand || selectedArticle.brand}
                  </span>
                )}
                {!hideBrandInSelector && selectedArticleAllBrands.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                    {selectedArticleAllBrands.length} marques dispo
                  </span>
                )}
                {activeWhObj && expandByBrandAndWarehouse && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 shrink-0">
                    {activeWhObj.name}
                  </span>
                )}
                {currentAvailableStock !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                      currentAvailableStock > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Stock : {currentAvailableStock} {selectedArticle.unit}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {selectedArticle.designation}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              className="text-xs text-amber-700 font-semibold group-hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
            >
              Changer
            </button>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      ) : (
        /* Search Input when open or no selection */
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm border border-amber-500 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
      )}

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {filteredArticles.length} référence(s) trouvée(s)
              {searchQuery && ` pour « ${searchQuery} »`}
            </span>
            <span className="text-slate-400">
              {expandByBrandAndWarehouse
                ? 'Cliquez sur une marque / dépôt pour sélectionner'
                : 'Cliquez pour sélectionner'}
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredArticles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-700">Aucune pièce correspondante</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Vérifiez l'orthographe ou saisissez une partie du code (ex: 6i2499, 0716, CAT)
                </p>
              </div>
            ) : (
              filteredArticles.map((art) => {
                const isSelected = art.id === selectedArticleId;
                const allOffers = getAllBrandsForArticle(art);

                if (expandByBrandAndWarehouse) {
                  const brandWhRows = getBrandWarehouseRows(art);
                  const totalStockAll = getTotalStockForArticle(art.id);

                  return (
                    <div
                      key={art.id}
                      className={`p-2.5 sm:p-3 transition-colors ${
                        isSelected ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Reference Header */}
                      <div
                        onClick={() => {
                          const firstPositive = brandWhRows.find((r) => r.qty > 0) || brandWhRows[0];
                          if (firstPositive && onSelectBrandAndWarehouse) {
                            handleSelectRow(art, firstPositive.brand, firstPositive.warehouseId);
                          } else {
                            handleSelect(art);
                          }
                        }}
                        className="flex items-center justify-between gap-2 cursor-pointer pb-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                              {art.mainReference}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 truncate">
                              — {art.designation}
                            </span>
                            {art.category && (
                              <span className="text-[10px] text-slate-400 hidden sm:inline">
                                • {art.category}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded shrink-0 ${
                            totalStockAll > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Total : {totalStockAll} {art.unit}
                        </span>
                      </div>

                      {/* Sub-rows for every Brand & Warehouse */}
                      <div className="mt-1 space-y-1 pl-1">
                        {brandWhRows.map((row) => {
                          const isRowSelected =
                            isSelected &&
                            (!selectedBrand ||
                              selectedBrand.toLowerCase().trim() === row.brand.toLowerCase().trim()) &&
                            (!warehouseId || warehouseId === row.warehouseId);

                          return (
                            <button
                              key={row.key}
                              type="button"
                              onClick={() => handleSelectRow(art, row.brand, row.warehouseId)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                isRowSelected
                                  ? 'bg-amber-100/90 border-amber-400 text-slate-950 font-semibold shadow-2xs'
                                  : row.qty > 0
                                  ? 'bg-white hover:bg-amber-50 border-slate-200 hover:border-amber-300 text-slate-800'
                                  : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/70 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-amber-400 shrink-0">
                                  {row.brand}
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] shrink-0">
                                  <Building2 className="w-3 h-3 text-amber-600" />
                                  {row.warehouseName}
                                </span>
                                {row.location && row.location !== 'Non renseigné' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 truncate">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{row.location}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded ${
                                    row.qty > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {row.qty} {art.unit}
                                </span>
                                {isRowSelected && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const stockInWh =
                  warehouseId && getStockForWarehouse
                    ? getStockForWarehouse(art.id, warehouseId)
                    : undefined;

                return (
                  <div
                    key={art.id}
                    onClick={() => handleSelect(art)}
                    className={`p-2.5 sm:p-3 hover:bg-amber-50/60 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-amber-50/80 font-medium' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {art.mainReference}
                        </span>
                        {!hideBrandInSelector &&
                          allOffers
                            .filter((offer) => offer.brand && offer.brand.trim() && offer.brand !== 'Générique')
                            .map((offer, idx) => (
                              <span
                                key={`${art.id}-b-${idx}`}
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700"
                              >
                                {offer.brand}
                              </span>
                            ))}
                        {art.category && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            • {art.category}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {art.designation}
                      </p>

                      {/* Equivalent references or offers preview */}
                      {art.equivalentReferences && art.equivalentReferences.length > 0 && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          Équivalences : {art.equivalentReferences.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {stockInWh !== undefined && (
                        <div
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            stockInWh > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {stockInWh} {art.unit}
                        </div>
                      )}
                      {art.defaultLocation && art.defaultLocation !== 'Non renseigné' && (
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[120px]">
                          {art.defaultLocation}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

