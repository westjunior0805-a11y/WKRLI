import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react';
import { useStock } from '../../context/StockContext';
import { Warehouse, Article, WarehouseStock } from '../../types';
import { formatFCFA, exportToCSV } from '../../utils/formatters';
import {
  Building2,
  Plus,
  Edit2,
  Phone,
  MapPin,
  User,
  Boxes,
  CheckCircle,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  FileSpreadsheet,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  LayoutGrid,
  LayoutList,
  Image as ImageIcon,
  ImageOff,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { WarehouseFormModal } from './WarehouseFormModal';
import { ArticleDetailModal } from '../catalog/ArticleDetailModal';
import { ArticleFormModal } from '../catalog/ArticleFormModal';
import { QuickStockEditModal } from '../catalog/QuickStockEditModal';
import { QuickPricingModal } from '../catalog/QuickPricingModal';
import { ImportCatalogModal } from '../catalog/ImportCatalogModal';
import { RowActionsMenu } from '../common/RowActionsMenu';
import { SearchField } from '../common/SearchField';
import { scoreArticleByScope } from '../../utils/fuzzySearch';
import {
  cleanBrandName,
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getBrandLocation,
  getBrandInvoiceNumber,
} from '../../utils/articleHelpers';
import { extractMissingPriceRows, hasMissingSalePrice } from '../../utils/pricingHelpers';

interface WarehouseListViewProps {
  viewMode?: 'stock' | 'warehouses';
  onOpenStockIn: (articleId?: string) => void;
  onOpenStockOut: (articleId?: string) => void;
  onNavigateToWarehouses?: () => void;
  onNavigateToStock?: () => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
  openImportTrigger?: number;
  exportStockTrigger?: number;
}

export const WarehouseListView: React.FC<WarehouseListViewProps> = ({
  viewMode = 'stock',
  onOpenStockIn,
  onOpenStockOut,
  onNavigateToStock,
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
  openImportTrigger = 0,
  exportStockTrigger = 0,
}) => {
  const {
    warehouses,
    articles,
    stocks,
    selectedWarehouseId,
    setSelectedWarehouseId,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    updateArticle,
    deleteArticle,
    currentUser,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
    getActiveOrderForArticle,
    getArticleById,
    showProductImages,
    toggleProductImages,
  } = useStock();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [selectedArticleDetail, setSelectedArticleDetail] = useState<Article | null>(null);
  const [editingArticleFromStock, setEditingArticleFromStock] = useState<Article | null>(null);
  const [quickEditTarget, setQuickEditTarget] = useState<{
    article: Article;
    brand?: string;
  } | null>(null);
  const [isStockImportOpen, setIsStockImportOpen] = useState(false);

  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const deferredStockSearchQuery = useDeferredValue(stockSearchQuery);
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT' | 'NO_PRICE'>('ALL');
  const [isQuickPricingOpen, setIsQuickPricingOpen] = useState(false);
  const [sortField, setSortField] = useState<
    | 'reference'
    | 'designation'
    | 'brand'
    | 'quantity'
    | 'location'
    | 'invoiceNumber'
    | 'purchasePrice'
    | 'salePrice'
    | 'minStockThreshold'
    | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Layout Mode (Ligne vs Grille) & Pagination / Continuous List state for Stock Table
  const [layoutMode, setLayoutMode] = useState<'LINE' | 'GRID'>(() => {
    return (localStorage.getItem('equipstock_stock_layout_mode') as 'LINE' | 'GRID') || 'LINE';
  });
  const [displayMode, setDisplayMode] = useState<'PAGINATION' | 'INFINITE'>(() => {
    return (localStorage.getItem('equipstock_stock_display_mode') as 'PAGINATION' | 'INFINITE') || 'PAGINATION';
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem('equipstock_stock_page_size'));
    return saved && [25, 50, 100, 200].includes(saved) ? saved : 50;
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState<number>(50);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('equipstock_stock_layout_mode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem('equipstock_stock_display_mode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('equipstock_stock_page_size', String(pageSize));
    setCurrentPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [pageSize]);

  // Active warehouse to inspect details ('ALL' by default — no warehouse preselected)
  const [inspectedWarehouseId, setInspectedWarehouseId] = useState<string>(
    selectedWarehouseId || 'ALL'
  );

  useEffect(() => {
    setInspectedWarehouseId(selectedWarehouseId || 'ALL');
  }, [selectedWarehouseId]);

  useEffect(() => {
    setCurrentPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [deferredStockSearchQuery, inspectedWarehouseId, selectedBrand, stockStatusFilter, sortField, sortDirection, pageSize]);

  const inspectedWarehouse =
    inspectedWarehouseId === 'ALL'
      ? null
      : warehouses.find((w) => w.id === inspectedWarehouseId) || null;

  // O(1) stocks map by articleId
  const stocksByArticleId = useMemo(() => {
    const map = new Map<string, WarehouseStock[]>();
    for (let i = 0; i < stocks.length; i++) {
      const s = stocks[i];
      const existing = map.get(s.articleId);
      if (existing) {
        existing.push(s);
      } else {
        map.set(s.articleId, [s]);
      }
    }
    return map;
  }, [stocks]);

  // Unique brands across all articles and stock records
  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      const primary = cleanBrandName(a.brand);
      if (primary) set.add(primary);
      a.brandOffers?.forEach((bo) => {
        const b = cleanBrandName(bo.brand);
        if (b) set.add(b);
      });
    });
    return Array.from(set).sort();
  }, [articles]);

  // Precomputed warehouse card statistics
  const warehouseStatsMap = useMemo(() => {
    const map = new Map<string, { totalPieces: number; totalValue: number; refWithStockCount: number }>();
    for (let i = 0; i < stocks.length; i++) {
      const s = stocks[i];
      if (!s.quantity || s.quantity <= 0) continue;
      const cur = map.get(s.warehouseId) || { totalPieces: 0, totalValue: 0, refWithStockCount: 0 };
      const art = getArticleById(s.articleId);
      cur.totalPieces += s.quantity;
      cur.totalValue += art ? s.quantity * art.purchasePrice : 0;
      cur.refWithStockCount += 1;
      map.set(s.warehouseId, cur);
    }
    return map;
  }, [stocks, getArticleById]);

  const handleToggleSort = (
    field:
      | 'reference'
      | 'designation'
      | 'brand'
      | 'quantity'
      | 'location'
      | 'invoiceNumber'
      | 'purchasePrice'
      | 'salePrice'
      | 'minStockThreshold'
  ) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (
    field:
      | 'reference'
      | 'designation'
      | 'brand'
      | 'quantity'
      | 'location'
      | 'invoiceNumber'
      | 'purchasePrice'
      | 'salePrice'
      | 'minStockThreshold'
  ) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0 opacity-70" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 shrink-0" />
    );
  };

  const filteredStockArticles = useMemo(() => {
    const baseFiltered = articles.filter((art) => {
      if (selectedBrand !== 'ALL') {
        const hasBrand =
          art.brand === selectedBrand ||
          (art.brandOffers && art.brandOffers.some((bo) => bo.brand === selectedBrand));
        if (!hasBrand) return false;
      }

      const qty =
        inspectedWarehouseId === 'ALL'
          ? getTotalStockForArticle(art.id)
          : getStockForArticleAndWarehouse(art.id, inspectedWarehouseId);

      if (stockStatusFilter === 'IN_STOCK' && qty <= 0) return false;
      if (stockStatusFilter === 'OUT' && qty > 0) return false;
      if (stockStatusFilter === 'LOW' && (qty === 0 || qty > art.minStockThreshold)) return false;
      if (stockStatusFilter === 'NO_PRICE' && !hasMissingSalePrice(art)) return false;

      return true;
    });

    const trimmedQuery = deferredStockSearchQuery.trim();
    let resultList: Article[];

    if (!trimmedQuery) {
      resultList = [...baseFiltered];
    } else {
      const scored: Array<{ art: Article; score: number }> = [];
      for (const art of baseFiltered) {
        const artStocks = stocksByArticleId.get(art.id) || [];
        const score = scoreArticleByScope(art, trimmedQuery, 'ALL', artStocks);
        if (score > 0) {
          scored.push({ art, score });
        }
      }

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.art.mainReference.localeCompare(b.art.mainReference);
      });

      resultList = scored.map((s) => s.art);
    }

    if (sortField) {
      const whFilter = inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId;
      const getPrimaryOffer = (art: Article) => {
        const allOffers = getArticleBrandOffers(art);
        const matching =
          selectedBrand !== 'ALL'
            ? allOffers.filter((o) => o.brand === selectedBrand)
            : allOffers;
        return (matching.length > 0 ? matching : allOffers)[0];
      };

      const compareStrings = (aStr: string, bStr: string) => {
        const aEmpty = !aStr || aStr === '-' || aStr === 'Non renseigné';
        const bEmpty = !bStr || bStr === '-' || bStr === 'Non renseigné';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        return aStr.localeCompare(bStr, 'fr', { numeric: true, sensitivity: 'base' });
      };

      resultList.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'reference') {
          cmp = compareStrings(a.mainReference || '', b.mainReference || '');
        } else if (sortField === 'designation') {
          cmp = compareStrings(a.designation || '', b.designation || '');
        } else if (sortField === 'brand') {
          const offerA = getPrimaryOffer(a);
          const offerB = getPrimaryOffer(b);
          cmp = compareStrings(
            cleanBrandName(offerA?.brand || a.brand),
            cleanBrandName(offerB?.brand || b.brand)
          );
        } else if (sortField === 'quantity') {
          const qtyA =
            inspectedWarehouseId === 'ALL'
              ? getTotalStockForArticle(a.id)
              : getStockForArticleAndWarehouse(a.id, inspectedWarehouseId);
          const qtyB =
            inspectedWarehouseId === 'ALL'
              ? getTotalStockForArticle(b.id)
              : getStockForArticleAndWarehouse(b.id, inspectedWarehouseId);
          cmp = qtyA - qtyB;
        } else if (sortField === 'location') {
          const offerA = getPrimaryOffer(a);
          const offerB = getPrimaryOffer(b);
          const locA = getBrandLocation(
            stocksByArticleId.get(a.id) || [],
            a,
            offerA?.brand || a.brand,
            whFilter,
            warehouses
          );
          const locB = getBrandLocation(
            stocksByArticleId.get(b.id) || [],
            b,
            offerB?.brand || b.brand,
            whFilter,
            warehouses
          );
          cmp = compareStrings(locA, locB);
        } else if (sortField === 'invoiceNumber') {
          const offerA = getPrimaryOffer(a);
          const offerB = getPrimaryOffer(b);
          const invA = getBrandInvoiceNumber(
            stocksByArticleId.get(a.id) || [],
            a,
            offerA?.brand || a.brand,
            whFilter
          );
          const invB = getBrandInvoiceNumber(
            stocksByArticleId.get(b.id) || [],
            b,
            offerB?.brand || b.brand,
            whFilter
          );
          cmp = compareStrings(invA, invB);
        } else if (sortField === 'purchasePrice') {
          const paA = getPrimaryOffer(a)?.purchasePrice ?? a.purchasePrice ?? 0;
          const paB = getPrimaryOffer(b)?.purchasePrice ?? b.purchasePrice ?? 0;
          cmp = paA - paB;
        } else if (sortField === 'salePrice') {
          const pvA = getPrimaryOffer(a)?.salePrice ?? a.salePrice ?? 0;
          const pvB = getPrimaryOffer(b)?.salePrice ?? b.salePrice ?? 0;
          cmp = pvA - pvB;
        } else if (sortField === 'minStockThreshold') {
          cmp = (a.minStockThreshold || 0) - (b.minStockThreshold || 0);
        }

        if (cmp !== 0) {
          return sortDirection === 'asc' ? cmp : -cmp;
        }
        return a.mainReference.localeCompare(b.mainReference, 'fr', {
          numeric: true,
          sensitivity: 'base',
        });
      });
    }

    return resultList;
  }, [
    articles,
    stocksByArticleId,
    warehouses,
    selectedBrand,
    stockStatusFilter,
    inspectedWarehouseId,
    getTotalStockForArticle,
    getStockForArticleAndWarehouse,
    deferredStockSearchQuery,
    sortField,
    sortDirection,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredStockArticles.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedStockArticles = useMemo(() => {
    if (displayMode === 'PAGINATION') {
      const start = (safeCurrentPage - 1) * pageSize;
      return filteredStockArticles.slice(start, start + pageSize);
    } else {
      return filteredStockArticles.slice(0, infiniteVisibleCount);
    }
  }, [filteredStockArticles, displayMode, safeCurrentPage, pageSize, infiniteVisibleCount]);

  useEffect(() => {
    if (displayMode !== 'INFINITE') return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    if (infiniteVisibleCount >= filteredStockArticles.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInfiniteVisibleCount((prev) => Math.min(filteredStockArticles.length, prev + pageSize));
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [displayMode, infiniteVisibleCount, filteredStockArticles.length, pageSize]);

  const handleCreateOrUpdate = (warehouseData: Omit<Warehouse, 'id'>) => {
    if (editingWarehouse) {
      return updateWarehouse(editingWarehouse.id, warehouseData);
    } else {
      return createWarehouse(warehouseData);
    }
  };

  const handleConfirmDelete = () => {
    if (!warehouseToDelete) return;
    const res = deleteWarehouse(warehouseToDelete.id);
    if (!res.success) {
      setDeleteFeedback({ type: 'error', message: res.error || 'Erreur lors de la suppression.' });
    } else {
      setDeleteFeedback({ type: 'success', message: res.message });
      setWarehouseToDelete(null);
      if (inspectedWarehouseId === warehouseToDelete.id) {
        const remaining = warehouses.filter((w) => w.id !== warehouseToDelete.id);
        setInspectedWarehouseId(remaining[0]?.id || 'ALL');
      }
    }
  };

  const handleExportStockCSV = () => {
    const whFilter = inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId;
    const headers = [
      'Référence',
      'Désignation',
      'Marque',
      'Quantité disponible',
      'Emplacement',
      'Numéro de facture',
      'Prix achat unitaire (FCFA)',
      'Prix vente unitaire (FCFA)',
      'Seuil minimum',
      'Dépôt',
    ];
    const rows: (string | number)[][] = [];
    filteredStockArticles.forEach((a) => {
      const aStocks = stocksByArticleId.get(a.id) || [];
      const offers = getArticleBrandOffers(a);
      offers.forEach((offer) => {
        const qty = getBrandStockAcrossWarehouses(aStocks, a, offer.brand, whFilter);
        const loc = getBrandLocation(aStocks, a, offer.brand, whFilter, warehouses);
        const inv = getBrandInvoiceNumber(aStocks, a, offer.brand, whFilter);
        rows.push([
          a.mainReference,
          a.designation,
          offer.brand,
          qty,
          loc,
          inv,
          offer.purchasePrice,
          offer.salePrice,
          a.minStockThreshold,
          inspectedWarehouse ? inspectedWarehouse.name : 'Tous les dépôts',
        ]);
      });
    });
    exportToCSV('consultation_stock_equipstock', headers, rows);
  };

  useEffect(() => {
    if (openImportTrigger > 0) {
      setIsStockImportOpen(true);
    }
  }, [openImportTrigger]);

  useEffect(() => {
    if (exportStockTrigger > 0) {
      handleExportStockCSV();
    }
  }, [exportStockTrigger]);

  return (
    <div className="space-y-6">
      {/* Action feedback banner if any */}
      {deleteFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs sm:text-sm animate-in fade-in ${
            deleteFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {deleteFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="font-medium leading-relaxed">{deleteFeedback.message}</p>
          </div>
          <button
            onClick={() => setDeleteFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner based on viewMode */}
      {viewMode === 'warehouses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">
                Gestion du Réseau des Magasins & Dépôts ({warehouses.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Créez, modifiez ou archivez vos points de stockage physiques et consultez leurs indicateurs globaux.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setEditingWarehouse(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau magasin</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Warehouses Cards Grid (affiché uniquement dans le volet Gestion des Magasins) */}
      {viewMode === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const whStats = warehouseStatsMap.get(wh.id) || {
            totalPieces: 0,
            totalValue: 0,
            refWithStockCount: 0,
          };
          const { totalPieces, totalValue, refWithStockCount } = whStats;

          const isInspected = inspectedWarehouseId === wh.id;

          return (
            <div
              key={wh.id}
              onClick={() => setInspectedWarehouseId(wh.id)}
              className={`p-5 rounded-xl border bg-white shadow-xs transition-all cursor-pointer relative ${
                isInspected
                  ? 'border-amber-500 ring-2 ring-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {wh.code}
                    </span>
                    {wh.isDefault && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Principal
                      </span>
                    )}
                    {!wh.isActive && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                        Archivé
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{wh.name}</h3>
                </div>

                {currentUser.role === 'ADMIN' && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingWarehouse(wh);
                        setIsFormOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
                      title="Modifier les coordonnées du magasin"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {!wh.isDefault && (
                      <button
                        onClick={() => {
                          setDeleteFeedback(null);
                          setWarehouseToDelete(wh);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Supprimer ou archiver ce magasin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{wh.location || 'Localisation non définie'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Responsable : {wh.manager || 'Non assigné'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{wh.phone || '-'}</span>
                </div>
              </div>

              {/* Quantities & Value */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Stock physique</span>
                  <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                    {totalPieces.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {refWithStockCount} réf. en stock
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Valeur d'achat</span>
                  <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    {formatFCFA(totalValue)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWarehouseId(wh.id);
                      setInspectedWarehouseId(wh.id);
                      if (onNavigateToStock) onNavigateToStock();
                    }}
                    className="mt-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Consulter le stock →</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Stock Multi-Marques (Premier Plan) */}
      {viewMode === 'stock' && (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
          {/* Full-width Prominent Neutral Search Bar */}
          <SearchField
            value={stockSearchQuery}
            onChange={setStockSearchQuery}
            placeholder="Référence, pièce ou dépôt..."
          />

          {/* Filters & View options row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
                >
                  <option value="ALL">Toutes marques</option>
                  {uniqueBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={stockStatusFilter}
                onChange={(e) =>
                  setStockStatusFilter(
                    e.target.value as 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT' | 'NO_PRICE'
                  )
                }
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tous états de stock</option>
                <option value="IN_STOCK">En stock (&gt; 0)</option>
                <option value="LOW">Sous seuil minimum</option>
                <option value="OUT">En rupture (0)</option>
                <option value="NO_PRICE">Prix de vente manquant (0 FCFA)</option>
              </select>

              {(() => {
                const whId = inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId;
                const missingCount = extractMissingPriceRows(articles, stocks, whId).filter(
                  (r) => r.missingSale
                ).length;
                if (missingCount === 0 || currentUser.role === 'MAGASINIER') return null;
                return (
                  <button
                    type="button"
                    onClick={() => setIsQuickPricingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] font-bold text-xs transition-colors cursor-pointer"
                    title="Définir rapidement les prix de vente manquants"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Sans prix ({missingCount})</span>
                  </button>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bouton activation / désactivation des photos produits */}
              <button
                type="button"
                onClick={toggleProductImages}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                  showProductImages
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
                title={
                  showProductImages
                    ? 'Désactiver les images des pièces pour alléger l’affichage'
                    : 'Activer l’affichage des images des pièces'
                }
              >
                {showProductImages ? (
                  <>
                    <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>Photos : <span className="text-emerald-700 font-bold">Oui</span></span>
                  </>
                ) : (
                  <>
                    <ImageOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>Photos : <span className="text-slate-500 font-bold">Non</span></span>
                  </>
                )}
              </button>

              {/* Layout Mode Toggle: Ligne vs Grille */}
              <div className="inline-flex items-center p-0.5 bg-slate-200/70 border border-slate-200 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setLayoutMode('LINE')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    layoutMode === 'LINE'
                      ? 'bg-slate-900 text-amber-400 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Affichage en ligne (tableau)"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Ligne</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('GRID')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    layoutMode === 'GRID'
                      ? 'bg-slate-900 text-amber-400 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Affichage en grille (cartes)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grille</span>
                </button>
              </div>

              {/* Display Mode Toggle: Pagination vs Liste continue */}
              <div className="inline-flex items-center p-0.5 bg-slate-200/70 border border-slate-200 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setDisplayMode('PAGINATION')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    displayMode === 'PAGINATION'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Pagination</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('INFINITE')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    displayMode === 'INFINITE'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3 h-3" />
                  <span>Liste continue</span>
                </button>
              </div>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px] focus:outline-none"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
              </select>
            </div>
          </div>
        </div>

        {layoutMode === 'GRID' ? (
          <div className="p-4">
            {displayedStockArticles.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Aucune référence trouvée pour ces critères de stock.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedStockArticles.map((art) => {
                  const whFilter = inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId;
                  const totalQty =
                    inspectedWarehouseId === 'ALL'
                      ? getTotalStockForArticle(art.id)
                      : getStockForArticleAndWarehouse(art.id, inspectedWarehouseId);
                  const isOut = totalQty === 0;
                  const isLow = !isOut && totalQty <= art.minStockThreshold;

                  const articleStocks = stocksByArticleId.get(art.id) || [];
                  const allOffers = getArticleBrandOffers(art);
                  const displayedOffers =
                    selectedBrand !== 'ALL'
                      ? allOffers.filter((o) => o.brand === selectedBrand)
                      : allOffers;
                  const offersToRender = displayedOffers.length > 0 ? displayedOffers : allOffers;

                  return (
                    <div
                      key={`grid-stock-${art.id}`}
                      onClick={() => setSelectedArticleDetail(art)}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Référence en évidence + Stock Total */}
                        <div className="flex items-start justify-between gap-2 pb-1.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {showProductImages && (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {art.imageUrl ? (
                                  <img
                                    src={art.imageUrl}
                                    alt={art.mainReference}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                            )}

                            <div className="min-w-0">
                              <span className="font-mono font-extrabold text-sm text-slate-950 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md inline-block">
                                {art.mainReference}
                              </span>
                              <h4
                                className="text-xs font-bold text-slate-900 line-clamp-1 mt-1"
                                title={art.designation}
                              >
                                {art.designation}
                              </h4>
                              <span className="text-[10px] text-slate-500">{art.category}</span>
                            </div>
                          </div>

                          <div
                            className={`shrink-0 text-right px-2.5 py-1 rounded-lg border ${
                              isOut
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : isLow
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}
                          >
                            <span className="block text-[9px] font-bold uppercase tracking-wider opacity-80">
                              Stock
                            </span>
                            <span className="font-mono font-extrabold text-sm tabular-nums">
                              {totalQty}{' '}
                              <span className="text-[10px] font-semibold">{art.unit}</span>
                            </span>
                          </div>
                        </div>

                        {/* Détail par marque */}
                        <div className="mt-2.5 space-y-1.5">
                          {offersToRender.map((offer, idx) => {
                            const bQty = getBrandStockAcrossWarehouses(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter
                            );
                            const loc = getBrandLocation(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter,
                              warehouses
                            );
                            const inv = getBrandInvoiceNumber(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter
                            );

                            return (
                              <div
                                key={`${art.id}-grid-offer-${idx}`}
                                className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900 truncate">
                                    {offer.brand}
                                  </span>
                                  <span
                                    className={`font-mono font-bold tabular-nums ${
                                      bQty === 0
                                        ? 'text-rose-600'
                                        : bQty <= art.minStockThreshold
                                        ? 'text-amber-600'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {bQty} {art.unit}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700 truncate">
                                  <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate" title={loc}>
                                    {loc}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] font-mono text-slate-500">
                                  <span>PA: {formatFCFA(offer.purchasePrice)}</span>
                                  <span className="font-bold text-emerald-700">
                                    PV: {formatFCFA(offer.salePrice)}
                                  </span>
                                  {inv && inv !== '-' && (
                                    <span className="truncate max-w-[90px]" title={inv}>
                                      Fact: {inv}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer: Seuil min + Actions */}
                      <div
                        className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] font-mono font-semibold text-slate-500">
                          Seuil min : {art.minStockThreshold}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setQuickEditTarget({
                                article: art,
                                brand: offersToRender[0]?.brand || art.brand,
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Modifier le stock, l'emplacement et les prix"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenStockIn(art.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            title="Entrée de stock"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenStockOut(art.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Sortie de stock"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedArticleDetail(art)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Voir la fiche complète"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {(currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
                            <button
                              type="button"
                              onClick={() => setArticleToDelete(art)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Supprimer cette référence"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-2 w-[12%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('reference')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Réf.</span>
                    {renderSortIcon('reference')}
                  </button>
                </th>
                <th className="py-2.5 px-2 w-[17%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('designation')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Désignation</span>
                    {renderSortIcon('designation')}
                  </button>
                </th>
                <th className="py-2.5 px-2 w-[10%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('brand')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Marque</span>
                    {renderSortIcon('brand')}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-right w-[8%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('quantity')}
                    className="inline-flex items-center justify-end gap-1 ml-auto hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Qté</span>
                    {renderSortIcon('quantity')}
                  </button>
                </th>
                <th className="hidden lg:table-cell py-2.5 px-2 w-[11%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('location')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Empl.</span>
                    {renderSortIcon('location')}
                  </button>
                </th>
                <th className="hidden xl:table-cell py-2.5 px-2 w-[9%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('invoiceNumber')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Facture</span>
                    {renderSortIcon('invoiceNumber')}
                  </button>
                </th>
                <th className="hidden md:table-cell py-2.5 px-2 text-right w-[10%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('purchasePrice')}
                    className="inline-flex items-center justify-end gap-1 ml-auto hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>P. Achat</span>
                    {renderSortIcon('purchasePrice')}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-right w-[10%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('salePrice')}
                    className="inline-flex items-center justify-end gap-1 ml-auto hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>P. Vente</span>
                    {renderSortIcon('salePrice')}
                  </button>
                </th>
                <th className="hidden sm:table-cell py-2.5 px-2 text-center w-[7%]">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('minStockThreshold')}
                    className="inline-flex items-center justify-center gap-1 mx-auto hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider font-semibold"
                  >
                    <span>Seuil</span>
                    {renderSortIcon('minStockThreshold')}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-right w-14">Opt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStockArticles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Aucune référence trouvée pour ces critères de stock.
                  </td>
                </tr>
              ) : (
                displayedStockArticles.map((art) => {
                  const whFilter = inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId;
                  const totalQty =
                    inspectedWarehouseId === 'ALL'
                      ? getTotalStockForArticle(art.id)
                      : getStockForArticleAndWarehouse(art.id, inspectedWarehouseId);
                  const isOut = totalQty === 0;
                  const isLow = !isOut && totalQty <= art.minStockThreshold;

                  const articleStocks = stocksByArticleId.get(art.id) || [];
                  const allOffers = getArticleBrandOffers(art);
                  const displayedOffers =
                    selectedBrand !== 'ALL'
                      ? allOffers.filter((o) => o.brand === selectedBrand)
                      : allOffers;
                  const offersToRender = displayedOffers.length > 0 ? displayedOffers : allOffers;

                  return (
                    <tr
                      key={art.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedArticleDetail(art)}
                    >
                      {/* 1. Référence */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {showProductImages && (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {art.imageUrl ? (
                                <img
                                  src={art.imageUrl}
                                  alt={art.mainReference}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </div>
                          )}
                          <div>
                            <div className="font-mono font-bold text-slate-900">{art.mainReference}</div>
                            {art.equivalentReferences.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Éq: {art.equivalentReferences.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Désignation */}
                      <td className="py-2.5 px-3 align-top max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1">{art.designation}</div>
                        <div className="text-[11px] text-slate-500">{art.category}</div>
                      </td>

                      {/* 3. Marque */}
                      <td
                        className="py-2.5 px-3 align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => (
                            <div
                              key={`${art.id}-brand-${idx}`}
                              className="h-6 flex items-center gap-1"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickEditTarget({
                                    article: art,
                                    brand: offer.brand,
                                  })
                                }
                                title="Modifier le stock, la marque, l'emplacement ou les prix de cette ligne"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-slate-950 rounded font-semibold text-[11px] truncate max-w-[140px] transition-colors cursor-pointer"
                              >
                                <span className="truncate">{offer.brand || '—'}</span>
                              </button>
                              {offersToRender.length > 1 && onOpenPurchaseOrder && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPurchaseOrder(art.id, offer.brand)}
                                  className="p-0.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                  title={`Commander la marque ${offer.brand || 'principale'}`}
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 4. Quantité disponible */}
                      <td className="py-2.5 px-3 align-top text-right font-mono tabular-nums">
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => {
                            const bQty = getBrandStockAcrossWarehouses(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter
                            );
                            return (
                              <div
                                key={`${art.id}-qty-${idx}`}
                                className="h-6 flex items-center justify-end gap-1"
                              >
                                <span
                                  className={`font-bold text-xs ${
                                    bQty === 0
                                      ? 'text-rose-600'
                                      : bQty <= art.minStockThreshold
                                      ? 'text-amber-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {bQty}
                                </span>
                                <span className="text-[10px] text-slate-400">{art.unit}</span>
                              </div>
                            );
                          })}
                          {offersToRender.length > 1 && (
                            <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-0.5 font-bold">
                              Total: {totalQty} {art.unit}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Emplacement */}
                      <td className="hidden lg:table-cell py-2.5 px-2 align-top font-mono text-[11px] text-slate-700">
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => {
                            const loc = getBrandLocation(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter,
                              warehouses
                            );
                            return (
                              <div
                                key={`${art.id}-loc-${idx}`}
                                className="h-6 flex items-center"
                              >
                                <span
                                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-700 truncate max-w-full"
                                  title={loc}
                                >
                                  {loc}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* 6. Numéro de facture */}
                      <td className="hidden xl:table-cell py-2.5 px-2 align-top font-mono text-[11px] text-slate-600">
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => {
                            const inv = getBrandInvoiceNumber(
                              articleStocks,
                              art,
                              offer.brand,
                              whFilter
                            );
                            return (
                              <div
                                key={`${art.id}-inv-${idx}`}
                                className="h-6 flex items-center"
                              >
                                <span className="truncate max-w-full" title={inv}>{inv}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* 7. Prix d'achat unitaire */}
                      <td className="hidden md:table-cell py-2.5 px-2 align-top text-right font-mono tabular-nums text-[11px] text-slate-700">
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => (
                            <div
                              key={`${art.id}-pa-${idx}`}
                              className="h-6 flex items-center justify-end truncate"
                            >
                              {formatFCFA(offer.purchasePrice)}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 8. Prix de vente unitaire */}
                      <td className="py-2.5 px-2 align-top text-right font-mono font-bold tabular-nums text-[11px] text-slate-900">
                        <div className="space-y-1">
                          {offersToRender.map((offer, idx) => (
                            <div
                              key={`${art.id}-pv-${idx}`}
                              className="h-6 flex items-center justify-end text-emerald-700 truncate"
                            >
                              {formatFCFA(offer.salePrice)}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 9. Seuil minimum */}
                      <td className="hidden sm:table-cell py-2.5 px-2 align-top text-center font-mono">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {art.minStockThreshold}
                        </span>
                      </td>

                      {/* 10. Actions Stock / Prix */}
                      <td
                        className="py-2.5 px-2 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const activeOrder = getActiveOrderForArticle(art.id);
                          return (
                            <RowActionsMenu
                              actions={[
                                {
                                  label: 'Modifier stock / prix / empl.',
                                  icon: <Edit2 className="w-3.5 h-3.5" />,
                                  tone: 'primary',
                                  onClick: () =>
                                    setQuickEditTarget({
                                      article: art,
                                      brand: offersToRender[0]?.brand || art.brand,
                                    }),
                                },
                                {
                                  label: 'Entrée de stock',
                                  icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
                                  tone: 'success',
                                  onClick: () => onOpenStockIn(art.id),
                                },
                                {
                                  label: 'Sortie de stock',
                                  icon: <ArrowUpRight className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  onClick: () => onOpenStockOut(art.id),
                                },
                                {
                                  label: 'Voir la fiche complète',
                                  icon: <Eye className="w-3.5 h-3.5" />,
                                  onClick: () => setSelectedArticleDetail(art),
                                },
                                {
                                  label: activeOrder
                                    ? `Commande ${activeOrder.orderNumber}`
                                    : 'Ouvrir commande',
                                  icon: <ExternalLink className="w-3.5 h-3.5" />,
                                  tone: 'success',
                                  hidden: !activeOrder || !onNavigateToPurchaseOrder,
                                  onClick: () => activeOrder && onNavigateToPurchaseOrder?.(activeOrder.id),
                                },
                                {
                                  label: 'Commander cette pièce',
                                  icon: <ShoppingBag className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  hidden: !onOpenPurchaseOrder,
                                  onClick: () =>
                                    onOpenPurchaseOrder?.(art.id, offersToRender[0]?.brand || art.brand),
                                },
                                {
                                  label: 'Supprimer cette référence',
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  tone: 'danger',
                                  dividerBefore: true,
                                  hidden: !(currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE'),
                                  onClick: () => setArticleToDelete(art),
                                },
                              ]}
                            />
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Continuous List Auto-Scroll Sentinel & Controls */}
        {displayMode === 'INFINITE' && filteredStockArticles.length > 0 && (
          <div
            ref={loadMoreSentinelRef}
            className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          >
            <span className="text-slate-600">
              Mode <strong>Liste continue</strong> : affichage de{' '}
              <strong className="font-mono text-slate-900">{displayedStockArticles.length}</strong> sur{' '}
              <strong className="font-mono text-slate-900">{filteredStockArticles.length}</strong> référence(s)
            </span>
            {displayedStockArticles.length < filteredStockArticles.length ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setInfiniteVisibleCount((prev) =>
                      Math.min(filteredStockArticles.length, prev + pageSize)
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  Afficher +{Math.min(pageSize, filteredStockArticles.length - displayedStockArticles.length)} références
                </button>
                <button
                  type="button"
                  onClick={() => setInfiniteVisibleCount(filteredStockArticles.length)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer"
                >
                  Tout afficher ({filteredStockArticles.length})
                </button>
              </div>
            ) : (
              <span className="text-emerald-700 font-semibold">
                Toutes les références ({filteredStockArticles.length}) sont affichées
              </span>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {displayMode === 'PAGINATION' && filteredStockArticles.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600">
              Affichage de{' '}
              <strong className="font-mono text-slate-900">
                {(safeCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              à{' '}
              <strong className="font-mono text-slate-900">
                {Math.min(safeCurrentPage * pageSize, filteredStockArticles.length)}
              </strong>{' '}
              sur <strong className="font-mono text-slate-900">{filteredStockArticles.length}</strong> référence(s)
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Précédent</span>
                </button>

                <div className="hidden sm:flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safeCurrentPage) <= 1
                    )
                    .reduce<Array<number | string>>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-mono">
                          …
                        </span>
                      ) : (
                        <button
                          key={`page-${item}`}
                          type="button"
                          onClick={() => setCurrentPage(Number(item))}
                          className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-xs font-bold transition-colors cursor-pointer ${
                            safeCurrentPage === item
                              ? 'bg-slate-900 text-amber-400 shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                </div>

                <span className="sm:hidden px-2 font-mono font-bold text-slate-700">
                  Page {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Modals */}
      <ImportCatalogModal
        isOpen={isStockImportOpen}
        onClose={() => setIsStockImportOpen(false)}
        fixedMode="STOCK_IMPORT"
        initialWarehouseId={inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId}
      />

      <QuickStockEditModal
        article={quickEditTarget?.article || null}
        initialBrand={quickEditTarget?.brand}
        warehouseId={inspectedWarehouse?.id}
        onClose={() => setQuickEditTarget(null)}
        onSaved={(msg) => setDeleteFeedback({ type: 'success', message: msg })}
      />

      <WarehouseFormModal
        isOpen={isFormOpen}
        warehouseToEdit={editingWarehouse}
        onClose={() => {
          setIsFormOpen(false);
          setEditingWarehouse(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <ArticleDetailModal
        article={selectedArticleDetail}
        onClose={() => setSelectedArticleDetail(null)}
        onOpenStockIn={(id) => onOpenStockIn(id)}
        onOpenStockOut={(id) => onOpenStockOut(id)}
        onEditArticle={(art) => {
          setSelectedArticleDetail(null);
          setEditingArticleFromStock(art);
        }}
        onDeleteArticle={(art) => {
          setSelectedArticleDetail(null);
          setArticleToDelete(art);
        }}
        onQuickEditStock={(art, brand) => {
          setSelectedArticleDetail(null);
          setQuickEditTarget({ article: art, brand });
        }}
        onOpenPurchaseOrder={onOpenPurchaseOrder}
        onNavigateToPurchaseOrder={onNavigateToPurchaseOrder}
      />

      <ArticleFormModal
        isOpen={!!editingArticleFromStock}
        articleToEdit={editingArticleFromStock}
        catalogOnlyMode={true}
        onClose={() => setEditingArticleFromStock(null)}
        onSubmit={(payload) => {
          if (editingArticleFromStock) {
            const res = updateArticle(editingArticleFromStock.id, payload);
            if (!res.success) {
              return res;
            }
            setDeleteFeedback({
              type: 'success',
              message: `La fiche produit "${payload.mainReference}" a été mise à jour.`,
            });
          }
          setEditingArticleFromStock(null);
          return { success: true };
        }}
      />

      {/* Article Deletion Confirmation Modal */}
      {articleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirmer la suppression
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {articleToDelete.mainReference} — {articleToDelete.designation}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setArticleToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1.5">
              <p>
                Voulez-vous vraiment supprimer définitivement la référence{' '}
                <strong>{articleToDelete.mainReference}</strong> ({articleToDelete.designation}) ?
              </p>
              <p className="font-medium text-rose-950">
                Cette action supprimera la fiche ainsi que ses lignes de stock et mouvements associés.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setArticleToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteArticle(articleToDelete.id);
                  setDeleteFeedback({
                    type: res.success ? 'success' : 'error',
                    message: res.error || res.message,
                  });
                  setArticleToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Deletion Confirmation Modal */}
      {warehouseToDelete && (() => {
        const whStockCount = stocks
          .filter((s) => s.warehouseId === warehouseToDelete.id)
          .reduce((sum, s) => sum + s.quantity, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Confirmation de suppression du magasin
                    </h3>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {warehouseToDelete.code} — {warehouseToDelete.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setWarehouseToDelete(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  Êtes-vous sûr de vouloir supprimer définitivement le magasin{' '}
                  <strong>{warehouseToDelete.name}</strong> ?
                </p>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                  <p className="font-semibold">Suppression définitive :</p>
                  <p className="text-[11px] leading-relaxed">
                    {whStockCount > 0
                      ? `Ce magasin contient actuellement ${whStockCount.toLocaleString('fr-FR')} pièce(s) enregistrée(s). En confirmant, le magasin et ses lignes de stock rattachées seront définitivement supprimés.`
                      : `En confirmant, ce magasin et ses traces associées seront définitivement supprimés.`}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setWarehouseToDelete(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmer la suppression</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <QuickPricingModal
        isOpen={isQuickPricingOpen}
        onClose={() => setIsQuickPricingOpen(false)}
        warehouseId={inspectedWarehouseId === 'ALL' ? undefined : inspectedWarehouseId}
        onSuccess={(message) => setDeleteFeedback({ type: 'success', message })}
      />
    </div>
  );
};
