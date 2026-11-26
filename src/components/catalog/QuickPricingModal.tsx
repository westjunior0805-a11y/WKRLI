import React, { useState, useMemo, useRef } from 'react';
import { useStock } from '../../context/StockContext';
import {
  buildArticlePriceUpdate,
  extractMissingPriceRows,
  MissingPriceRow,
} from '../../utils/pricingHelpers';
import { SearchField } from '../common/SearchField';
import { TablePagination, usePagination } from '../common/TablePagination';
import { X, Check, Save, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface QuickPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId?: string | null;
  onSuccess?: (message: string) => void;
}

type PriceFilterTab = 'MISSING_SALE' | 'MISSING_PURCHASE' | 'ALL_MISSING';

interface DraftPrices {
  salePrice: string;
  purchasePrice: string;
}

export const QuickPricingModal: React.FC<QuickPricingModalProps> = ({
  isOpen,
  onClose,
  warehouseId,
  onSuccess,
}) => {
  const { articles, stocks, updateArticle, currentPermissions } = useStock();

  const [tab, setTab] = useState<PriceFilterTab>('MISSING_SALE');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftPrices>>({});
  const [savedFeedbackKeys, setSavedFeedbackKeys] = useState<Record<string, boolean>>({});

  const saleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const allMissingRows = useMemo(
    () => extractMissingPriceRows(articles, stocks, warehouseId),
    [articles, stocks, warehouseId]
  );

  const counts = useMemo(() => {
    const base = onlyInStock ? allMissingRows.filter((r) => r.stockQty > 0) : allMissingRows;
    return {
      MISSING_SALE: base.filter((r) => r.missingSale).length,
      MISSING_PURCHASE: base.filter((r) => r.missingPurchase).length,
      ALL_MISSING: base.length,
    };
  }, [allMissingRows, onlyInStock]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allMissingRows.filter((row) => {
      if (onlyInStock && row.stockQty <= 0) return false;
      if (tab === 'MISSING_SALE' && !row.missingSale) return false;
      if (tab === 'MISSING_PURCHASE' && !row.missingPurchase) return false;
      if (q) {
        const hay = `${row.article.mainReference} ${row.article.designation} ${row.brand} ${row.article.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allMissingRows, onlyInStock, tab, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedItems,
  } = usePagination(filteredRows, 20);

  if (!isOpen) return null;

  const getDraft = (row: MissingPriceRow): DraftPrices => {
    const existing = drafts[row.key];
    if (existing) return existing;
    return {
      salePrice: row.salePrice > 0 ? String(row.salePrice) : '',
      purchasePrice: row.purchasePrice > 0 ? String(row.purchasePrice) : '',
    };
  };

  const setRowDraft = (row: MissingPriceRow, field: keyof DraftPrices, rawValue: string) => {
    if (rawValue !== '' && !/^\d+$/.test(rawValue)) return;
    setDrafts((prev) => {
      const current = prev[row.key] || {
        salePrice: row.salePrice > 0 ? String(row.salePrice) : '',
        purchasePrice: row.purchasePrice > 0 ? String(row.purchasePrice) : '',
      };
      return {
        ...prev,
        [row.key]: {
          ...current,
          [field]: rawValue,
        },
      };
    });
  };

  const isRowDirty = (row: MissingPriceRow): boolean => {
    const d = drafts[row.key];
    if (!d) return false;
    const nextSale = d.salePrice === '' ? 0 : parseInt(d.salePrice, 10);
    const nextPurchase = d.purchasePrice === '' ? 0 : parseInt(d.purchasePrice, 10);
    return nextSale !== row.salePrice || nextPurchase !== row.purchasePrice;
  };

  const dirtyRows = filteredRows.filter((r) => isRowDirty(r));

  const saveSingleRow = (row: MissingPriceRow, focusNextIndex?: number) => {
    const d = getDraft(row);
    const nextSale = d.salePrice === '' ? row.salePrice : Math.max(0, parseInt(d.salePrice, 10) || 0);
    const nextPurchase = currentPermissions.canViewPurchasePrices
      ? d.purchasePrice === ''
        ? row.purchasePrice
        : Math.max(0, parseInt(d.purchasePrice, 10) || 0)
      : undefined;

    if (nextSale === row.salePrice && (nextPurchase === undefined || nextPurchase === row.purchasePrice)) {
      return;
    }

    const updates = buildArticlePriceUpdate(row.article, row.brand, nextSale, nextPurchase);
    const res = updateArticle(row.article.id, updates);

    if (res.success) {
      setDrafts((prev) => {
        const clone = { ...prev };
        delete clone[row.key];
        return clone;
      });
      setSavedFeedbackKeys((prev) => ({ ...prev, [row.key]: true }));
      setTimeout(() => {
        setSavedFeedbackKeys((prev) => {
          const clone = { ...prev };
          delete clone[row.key];
          return clone;
        });
      }, 1600);

      if (focusNextIndex !== undefined) {
        const nextRow = paginatedItems[focusNextIndex];
        if (nextRow) {
          setTimeout(() => {
            saleInputRefs.current[nextRow.key]?.focus();
          }, 20);
        }
      }
    }
  };

  const handleSaveAllDirty = () => {
    if (dirtyRows.length === 0) return;
    let savedCount = 0;

    for (const row of dirtyRows) {
      const d = getDraft(row);
      const nextSale =
        d.salePrice === '' ? row.salePrice : Math.max(0, parseInt(d.salePrice, 10) || 0);
      const nextPurchase = currentPermissions.canViewPurchasePrices
        ? d.purchasePrice === ''
          ? row.purchasePrice
          : Math.max(0, parseInt(d.purchasePrice, 10) || 0)
        : undefined;

      const updates = buildArticlePriceUpdate(row.article, row.brand, nextSale, nextPurchase);
      const res = updateArticle(row.article.id, updates);
      if (res.success) savedCount++;
    }

    setDrafts({});
    if (savedCount > 0 && onSuccess) {
      onSuccess(
        `${savedCount} prix enregistré${savedCount > 1 ? 's' : ''} dans le catalogue.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#111111] dark:border-[#444444] shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="px-5 py-4 bg-[#111111] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-6 bg-[#FFCD11] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">Tarification rapide — Pièces sans prix</h3>
              <p className="text-[11px] text-slate-300 truncate">
                Saisissez directement les prix puis appuyez sur Entrée pour passer à la ligne suivante.
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

        {/* Barre de filtres */}
        <div className="p-4 bg-[#F8F8F8] dark:bg-[#252525] border-b border-[#E0E0E0] dark:border-[#333333] space-y-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="w-full md:max-w-sm">
              <SearchField
                value={searchQuery}
                onChange={(v) => {
                  setSearchQuery(v);
                  setCurrentPage(1);
                }}
                placeholder="Référence, pièce, marque..."
                ariaLabel="Filtrer les pièces sans prix"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'MISSING_SALE', label: 'Sans prix de vente', count: counts.MISSING_SALE },
                  ...(currentPermissions.canViewPurchasePrices
                    ? [
                        {
                          id: 'MISSING_PURCHASE' as const,
                          label: 'Sans prix d’achat',
                          count: counts.MISSING_PURCHASE,
                        },
                      ]
                    : []),
                  { id: 'ALL_MISSING', label: 'Tous manquants', count: counts.ALL_MISSING },
                ] as const
              ).map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#FFCD11] dark:text-[#111111] dark:border-[#FFCD11]'
                        : 'bg-white dark:bg-[#1E1E1E] text-[#595959] dark:text-slate-300 border-[#CCCCCC] dark:border-[#444444] hover:border-[#111111]'
                    }`}
                  >
                    {t.label}
                    <span className="ml-1.5 font-mono opacity-80">{t.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="inline-flex items-center gap-2 text-[#111111] dark:text-slate-200 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => {
                  setOnlyInStock(e.target.checked);
                  setCurrentPage(1);
                }}
                className="accent-[#111111]"
              />
              Priorité aux pièces en stock (&gt; 0)
            </label>

            {dirtyRows.length > 0 && (
              <span className="font-mono text-[11px] font-bold text-[#7A5C00] dark:text-[#FFCD11]">
                {dirtyRows.length} ligne{dirtyRows.length > 1 ? 's' : ''} modifiée
                {dirtyRows.length > 1 ? 's' : ''} non enregistrée{dirtyRows.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Contenu : Tableau desktop + cartes mobile */}
        <div className="flex-1 overflow-y-auto">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-[#111111] dark:text-white">
                {allMissingRows.length === 0
                  ? 'Toutes vos pièces actives ont un prix défini !'
                  : 'Aucune pièce sans prix pour ce filtre.'}
              </p>
              {onlyInStock && allMissingRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyInStock(false)}
                  className="mt-2 px-3 py-1.5 text-xs font-bold bg-[#FFF9DF] text-[#7A5C00] border border-[#FFCD11] cursor-pointer"
                >
                  Afficher aussi les pièces en rupture (stock = 0)
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#F4F4F4] dark:bg-[#262626] border-b border-[#E0E0E0] dark:border-[#333333] text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4">Pièce &amp; Marque</th>
                    <th className="py-2.5 px-3 text-center w-24">Stock</th>
                    {currentPermissions.canViewPurchasePrices && (
                      <th className="py-2.5 px-3 w-40">Prix d’achat (FCFA)</th>
                    )}
                    <th className="py-2.5 px-3 w-44">Prix de vente (FCFA)</th>
                    <th className="py-2.5 px-4 text-right w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEF] dark:divide-[#2C2C2C]">
                  {paginatedItems.map((row, idx) => {
                    const draft = getDraft(row);
                    const dirty = isRowDirty(row);
                    const justSaved = savedFeedbackKeys[row.key];

                    return (
                      <tr
                        key={row.key}
                        className={`transition-colors ${
                          dirty
                            ? 'bg-[#FFF9DF]/60 dark:bg-[#FFCD11]/10'
                            : 'hover:bg-[#FAFAFA] dark:hover:bg-[#242424]'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-[#111111] dark:text-white">
                              {row.article.mainReference}
                            </span>
                            {row.brand && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#F0F0F0] dark:bg-[#2D2D2D] text-[#333333] dark:text-slate-200 border border-[#D4D4D4] dark:border-[#444444]">
                                <Tag className="w-2.5 h-2.5" />
                                {row.brand}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#595959] dark:text-slate-400 truncate max-w-md mt-0.5">
                            {row.article.designation}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 ${
                              row.stockQty > 0
                                ? 'bg-[#F4F4F4] dark:bg-[#2B2B2B] text-[#111111] dark:text-white'
                                : 'text-rose-600'
                            }`}
                          >
                            {row.stockQty}
                          </span>
                        </td>

                        {currentPermissions.canViewPurchasePrices && (
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={draft.purchasePrice}
                              onChange={(e) => setRowDraft(row, 'purchasePrice', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  saleInputRefs.current[row.key]?.focus();
                                }
                              }}
                              placeholder={row.missingPurchase ? 'À définir' : '0'}
                              className={`w-full px-2.5 py-1.5 font-mono text-xs font-bold border focus:outline-none ${
                                row.missingPurchase && !draft.purchasePrice
                                  ? 'bg-[#FFF9DF] dark:bg-[#FFCD11]/10 border-[#E5C130] text-[#111111] dark:text-white'
                                  : 'bg-white dark:bg-[#1A1A1A] border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white focus:border-[#111111]'
                              }`}
                            />
                          </td>
                        )}

                        <td className="py-2.5 px-3">
                          <input
                            ref={(el) => {
                              saleInputRefs.current[row.key] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            value={draft.salePrice}
                            onChange={(e) => setRowDraft(row, 'salePrice', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveSingleRow(row, idx + 1);
                              }
                            }}
                            placeholder={row.missingSale ? 'Prix vente...' : '0'}
                            className={`w-full px-2.5 py-1.5 font-mono text-sm font-bold border focus:outline-none ${
                              row.missingSale && !draft.salePrice
                                ? 'bg-[#FFF9DF] dark:bg-[#FFCD11]/15 border-[#FFCD11] text-[#111111] dark:text-white focus:border-[#111111]'
                                : 'bg-white dark:bg-[#1A1A1A] border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white focus:border-[#111111]'
                            }`}
                          />
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          {justSaved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                              <Check className="w-3.5 h-3.5" />
                              OK
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={!dirty}
                              onClick={() => saveSingleRow(row, idx + 1)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Valider
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#E0E0E0] dark:divide-[#333333]">
                {paginatedItems.map((row, idx) => {
                  const draft = getDraft(row);
                  const dirty = isRowDirty(row);
                  const justSaved = savedFeedbackKeys[row.key];

                  return (
                    <div
                      key={`m-${row.key}`}
                      className={`p-3.5 space-y-2.5 ${
                        dirty ? 'bg-[#FFF9DF]/60 dark:bg-[#FFCD11]/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-bold text-[#111111] dark:text-white">
                              {row.article.mainReference}
                            </span>
                            {row.brand && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#F0F0F0] dark:bg-[#2D2D2D] text-[#333333] dark:text-slate-200">
                                {row.brand}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#595959] dark:text-slate-400 mt-0.5">
                            {row.article.designation}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#F4F4F4] dark:bg-[#2B2B2B] text-[#111111] dark:text-white shrink-0">
                          Stock : {row.stockQty}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {currentPermissions.canViewPurchasePrices && (
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-[#595959] dark:text-slate-400 mb-1">
                              Prix achat
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={draft.purchasePrice}
                              onChange={(e) => setRowDraft(row, 'purchasePrice', e.target.value)}
                              placeholder="0 FCFA"
                              className="w-full px-2.5 py-2 font-mono text-xs font-bold bg-white dark:bg-[#1A1A1A] border border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white"
                            />
                          </div>
                        )}
                        <div className={currentPermissions.canViewPurchasePrices ? '' : 'col-span-2'}>
                          <label className="block text-[10px] font-bold uppercase text-[#595959] dark:text-slate-400 mb-1">
                            Prix vente (FCFA)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draft.salePrice}
                            onChange={(e) => setRowDraft(row, 'salePrice', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveSingleRow(row, idx + 1);
                              }
                            }}
                            placeholder="Prix vente..."
                            className="w-full px-2.5 py-2 font-mono text-sm font-bold bg-[#FFF9DF] dark:bg-[#FFCD11]/15 border border-[#FFCD11] text-[#111111] dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {justSaved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                            <Check className="w-4 h-4" />
                            Enregistré
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!dirty}
                            onClick={() => saveSingleRow(row, idx + 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#FFCD11] text-[#111111] border border-[#111111] disabled:opacity-30"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Enregistrer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination + Pied de modal */}
        <div className="border-t border-[#E0E0E0] dark:border-[#333333] bg-white dark:bg-[#1E1E1E]">
          {filteredRows.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredRows.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[15, 20, 50]}
              itemLabel="pièces"
            />
          )}

          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#F8F8F8] dark:bg-[#252525]">
            <span className="text-xs text-[#595959] dark:text-slate-400 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#7A5C00] dark:text-[#FFCD11]" />
              Astuce : tapez un prix puis appuyez sur <strong>Entrée</strong> pour enregistrer et
              passer au suivant.
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-[#595959] dark:text-slate-300 bg-white dark:bg-[#1E1E1E] border border-[#CCCCCC] dark:border-[#444444] cursor-pointer"
              >
                Fermer
              </button>
              {dirtyRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveAllDirty}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Tout enregistrer ({dirtyRows.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
