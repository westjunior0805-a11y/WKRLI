import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Article } from '../../types';
import { Search, X, Check, Package, AlertTriangle, Boxes, ChevronDown } from 'lucide-react';

interface ArticleSearchSelectProps {
  articles: Article[];
  selectedArticleId: string;
  onSelectArticle: (article: Article) => void;
  warehouseId?: string;
  getStockForWarehouse?: (articleId: string, warehouseId: string) => number;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
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
  warehouseId,
  getStockForWarehouse,
  label = 'Article / Pièce Détachée',
  required = true,
  disabled = false,
  placeholder = 'Tapez une référence (ex: 1R-0716, 1R0716), une désignation, une marque...',
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId),
    [articles, selectedArticleId]
  );

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

  // Filter articles with multi-token, accent-tolerant, and alphanumeric search
  const filteredArticles = useMemo(() => {
    const activeArticles = articles.filter((a) => a.status === 'active');
    if (!searchQuery.trim()) {
      return activeArticles.slice(0, 15); // Show first 15 by default
    }

    const rawTerms = searchQuery.trim().split(/\s+/).filter(Boolean);
    const terms = rawTerms.map((t) => ({
      norm: normalizeSearchText(t),
      alnum: toAlphanumeric(t),
    }));

    return activeArticles.filter((art) => {
      const parts: string[] = [
        art.id,
        art.mainReference,
        art.designation,
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
      ];

      if (art.brandOffers && art.brandOffers.length > 0) {
        art.brandOffers.forEach((bo) => {
          parts.push(bo.brand, bo.brandReference || '', bo.preferredSupplier || '', bo.barcode || '');
        });
      }

      const combined = parts.join(' ');
      const normCorpus = normalizeSearchText(combined);
      const alnumCorpus = toAlphanumeric(combined);

      return terms.every((term) => {
        if (!term.norm && !term.alnum) return true;
        const matchNorm = term.norm ? normCorpus.includes(term.norm) : false;
        const matchAlnum = term.alnum ? alnumCorpus.includes(term.alnum) : false;
        return matchNorm || matchAlnum;
      });
    });
  }, [articles, searchQuery]);

  const handleSelect = (art: Article) => {
    onSelectArticle(art);
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

  const currentAvailableStock =
    selectedArticle && warehouseId && getStockForWarehouse
      ? getStockForWarehouse(selectedArticle.id, warehouseId)
      : undefined;

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
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {selectedArticle.mainReference}
                </span>
                {selectedArticle.brand && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 shrink-0">
                    {selectedArticle.brand}
                  </span>
                )}
                {currentAvailableStock !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold shrink-0 ${
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
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {filteredArticles.length} pièce(s) trouvée(s)
              {searchQuery && ` pour « ${searchQuery} »`}
            </span>
            <span className="text-slate-400">Cliquez pour sélectionner</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredArticles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-700">Aucune pièce correspondante</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Vérifiez l'orthographe ou saisissez une partie du code (ex: 0716, 1R0716, CAT)
                </p>
              </div>
            ) : (
              filteredArticles.map((art) => {
                const isSelected = art.id === selectedArticleId;
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {art.mainReference}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {art.brand || 'Générique'}
                        </span>
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
                      {(art.equivalentReferences && art.equivalentReferences.length > 0) && (
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
