import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleCategory, WarehouseStock } from '../../types';
import { formatFCFA, exportToCSV } from '../../utils/formatters';
import {
  Search,
  Plus,
  Filter,
  Download,
  Eye,
  Edit2,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  Tag,
  CheckCircle2,
  Boxes,
  FileSpreadsheet,
  Trash2,
  ShieldAlert,
  Archive,
  Check,
  X,
  Image as ImageIcon,
  ImageOff,
  RotateCcw,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  List,
  BookOpen,
  LayoutGrid,
  LayoutList,
  ShoppingBag,
  ExternalLink,
  Tractor,
} from 'lucide-react';
import { ArticleDetailModal } from './ArticleDetailModal';
import { ArticleFormModal } from './ArticleFormModal';
import { ImportCatalogModal } from './ImportCatalogModal';
import { QuickStockEditModal } from './QuickStockEditModal';
import { MachineWhereUsedModal } from './MachineWhereUsedModal';
import {
  scoreArticleByScope,
  SearchTargetScope,
  SEARCH_SCOPE_OPTIONS,
} from '../../utils/fuzzySearch';
import {
  formatPurchasePriceRange,
  formatSalePriceRange,
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getBrandLocation,
  getBrandInvoiceNumber,
} from '../../utils/articleHelpers';

interface ArticleCatalogViewProps {
  onOpenStockIn: (articleId?: string) => void;
  onOpenStockOut: (articleId?: string) => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
}

export const ArticleCatalogView: React.FC<ArticleCatalogViewProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
}) => {
  const {
    articles,
    stocks,
    getTotalStockForArticle,
    getStockForArticleAndWarehouse,
    getActiveOrderForArticle,
    selectedWarehouseId,
    createArticle,
    updateArticle,
    deleteArticle,
    deleteMultipleArticles,
    currentUser,
    sales,
    movements,
    inventories,
    resetToDemoData,
    purgeCollection,
    showProductImages,
    toggleProductImages,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchTargetScope>('ALL');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'>('ALL');
  const [sortBy, setSortBy] = useState<'ref' | 'designation' | 'stock' | 'price'>('ref');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Layout Mode (Ligne vs Grille) & Pagination / Continuous List state
  const [layoutMode, setLayoutMode] = useState<'LINE' | 'GRID'>(() => {
    return (localStorage.getItem('equipstock_catalog_layout_mode') as 'LINE' | 'GRID') || 'LINE';
  });
  const [displayMode, setDisplayMode] = useState<'PAGINATION' | 'INFINITE'>(() => {
    return (localStorage.getItem('equipstock_catalog_display_mode') as 'PAGINATION' | 'INFINITE') || 'PAGINATION';
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem('equipstock_catalog_page_size'));
    return saved && [25, 50, 100, 200].includes(saved) ? saved : 50;
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState<number>(50);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('equipstock_catalog_layout_mode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem('equipstock_catalog_display_mode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('equipstock_catalog_page_size', String(pageSize));
    setCurrentPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [pageSize]);

  // Reset pagination / infinite scroll position when filters or search change
  useEffect(() => {
    setCurrentPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [deferredSearchQuery, searchScope, selectedCategory, selectedBrand, stockStatusFilter, selectedWarehouseId, sortBy, sortDirection, pageSize]);

  // Pre-group stocks by articleId for O(1) lookup per row
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

  // Multi-selection state
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);

  // Deletion modals state
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isPurgeCatalogModalOpen, setIsPurgeCatalogModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals state
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [quickEditTarget, setQuickEditTarget] = useState<{
    article: Article;
    brand?: string;
    warehouseId?: string | null;
  } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [whereUsedArticle, setWhereUsedArticle] = useState<Article | null>(null);
  const [activeActionMenuArticleId, setActiveActionMenuArticleId] = useState<string | null>(null);

  // Close row action menus on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveActionMenuArticleId(null);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);


  // Collect unique brands and categories for dropdown filters (including brandOffers)
  const uniqueBrands = useMemo(() => {
    const brandSet = new Set<string>();
    articles.forEach((a) => {
      if (a.brand) brandSet.add(a.brand);
      if (a.brandOffers) {
        a.brandOffers.forEach((bo) => {
          if (bo.brand) brandSet.add(bo.brand);
        });
      }
    });
    return Array.from(brandSet).sort();
  }, [articles]);

  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(articles.map((a) => a.category))).filter(Boolean);
    return cats.sort();
  }, [articles]);

  // Filter & Fuzzy Search logic
  const filteredArticlesWithScore = useMemo(() => {
    const results: Array<{ article: Article; score: number }> = [];

    for (const art of articles) {
      // Category filter
      if (selectedCategory !== 'ALL' && art.category !== selectedCategory) continue;

      // Brand filter (matches either article.brand or any brandOffer)
      if (selectedBrand !== 'ALL') {
        const matchesBrand =
          art.brand === selectedBrand ||
          art.brandOffers?.some((bo) => bo.brand === selectedBrand);
        if (!matchesBrand) continue;
      }

      // Stock status filter
      const stock = selectedWarehouseId
        ? getStockForArticleAndWarehouse(art.id, selectedWarehouseId)
        : getTotalStockForArticle(art.id);

      if (stockStatusFilter === 'OUT' && stock > 0) continue;
      if (stockStatusFilter === 'LOW' && (stock === 0 || stock > art.minStockThreshold)) continue;
      if (stockStatusFilter === 'IN_STOCK' && stock === 0) continue;

      // Strict Technical Search + Target Scope (Option 1 + Option 2)
      if (deferredSearchQuery.trim()) {
        const artStocks = stocksByArticleId.get(art.id) || [];
        const score = scoreArticleByScope(art, deferredSearchQuery, searchScope, artStocks);
        if (score <= 0) continue;
        results.push({ article: art, score });
      } else {
        results.push({ article: art, score: 1 });
      }
    }

    return results;
  }, [
    articles,
    stocksByArticleId,
    deferredSearchQuery,
    searchScope,
    selectedCategory,
    selectedBrand,
    stockStatusFilter,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
  ]);

  const filteredArticles = useMemo(
    () => filteredArticlesWithScore.map((r) => r.article),
    [filteredArticlesWithScore]
  );

  // Sorting (prioritizes Fuzzy Search relevance score when a search query is active)
  const sortedArticles = useMemo(() => {
    const scoreMap = new Map<string, number>();
    filteredArticlesWithScore.forEach((r) => scoreMap.set(r.article.id, r.score));
    const hasActiveQuery = deferredSearchQuery.trim().length > 0;

    return [...filteredArticles].sort((a, b) => {
      if (hasActiveQuery) {
        const scoreDiff = (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
        if (Math.abs(scoreDiff) > 5) return scoreDiff;
      }

      let comparison = 0;
      const stockA = selectedWarehouseId
        ? getStockForArticleAndWarehouse(a.id, selectedWarehouseId)
        : getTotalStockForArticle(a.id);
      const stockB = selectedWarehouseId
        ? getStockForArticleAndWarehouse(b.id, selectedWarehouseId)
        : getTotalStockForArticle(b.id);

      if (sortBy === 'ref') {
        comparison = a.mainReference.localeCompare(b.mainReference);
      } else if (sortBy === 'designation') {
        comparison = a.designation.localeCompare(b.designation);
      } else if (sortBy === 'stock') {
        comparison = stockA - stockB;
      } else if (sortBy === 'price') {
        comparison = a.purchasePrice - b.purchasePrice;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    filteredArticles,
    filteredArticlesWithScore,
    deferredSearchQuery,
    sortBy,
    sortDirection,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Sliced articles for current display mode (Pagination vs Continuous List)
  const displayedArticles = useMemo(() => {
    if (displayMode === 'PAGINATION') {
      const start = (safeCurrentPage - 1) * pageSize;
      return sortedArticles.slice(start, start + pageSize);
    } else {
      return sortedArticles.slice(0, infiniteVisibleCount);
    }
  }, [sortedArticles, displayMode, safeCurrentPage, pageSize, infiniteVisibleCount]);

  // IntersectionObserver for automatic loading in Continuous List ('INFINITE') mode
  useEffect(() => {
    if (displayMode !== 'INFINITE') return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    if (infiniteVisibleCount >= sortedArticles.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInfiniteVisibleCount((prev) => Math.min(sortedArticles.length, prev + pageSize));
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [displayMode, infiniteVisibleCount, sortedArticles.length, pageSize]);

  const totalBrandOffersCount = useMemo(() => {
    return articles.reduce((sum, art) => {
      const offers = getArticleBrandOffers(art);
      return sum + Math.max(1, offers.length);
    }, 0);
  }, [articles]);

  const handleExportCSV = () => {
    const headers = [
      'Référence',
      'Désignation',
      'Description',
      'Équivalences',
      'Seuil minimum',
      'Catégorie',
    ];

    const rows: (string | number)[][] = sortedArticles.map((art) => [
      art.mainReference,
      art.designation,
      art.description || art.notes || '',
      (art.equivalentReferences || []).join(', '),
      art.minStockThreshold,
      art.category,
    ]);

    exportToCSV(`catalogue_pieces_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const canDelete = currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE';

  // Analysis of article history to clearly inform the user before permanent deletion
  const getArticleHistoryAnalysis = (art: Article) => {
    const hasSales = sales.some((s) => s.items.some((item) => item.articleId === art.id));
    const hasMvts = movements.some((m) => m.articleId === art.id);
    const hasInv = inventories.some((inv) => inv.items?.some((l) => l.articleId === art.id));
    const stock = getTotalStockForArticle(art.id);
    const hasHistory = hasSales || hasMvts || hasInv;
    return {
      hasSales,
      hasMvts,
      hasInv,
      stock,
      hasHistory,
    };
  };

  const renderSingleDeleteAnalysis = (art: Article) => {
    const analysis = getArticleHistoryAnalysis(art);
    return (
      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1.5">
        <div className="font-bold flex items-center gap-1.5 text-rose-800">
          <Trash2 className="w-4 h-4 text-rose-600" />
          Confirmation de suppression définitive
        </div>
        {(analysis.hasHistory || analysis.stock > 0) ? (
          <p>
            Cette référence comporte actuellement{' '}
            {analysis.stock > 0 ? <strong>{analysis.stock} {art.unit} en stock</strong> : 'des traces enregistrées'}
            {analysis.hasMvts && ' (mouvements de stock)'}
            {analysis.hasInv && ' (lignes d’inventaire)'}.
          </p>
        ) : (
          <p>
            Cet article n'a aucun mouvement ni stock actif associé.
          </p>
        )}
        <p className="font-medium text-rose-950">
          En confirmant, cette référence ainsi que ses traces de stock et mouvements associés seront <strong>définitivement supprimés</strong> du catalogue (sans blocage ni archivage forcé).
        </p>
      </div>
    );
  };

  // Selection helpers
  const isAllSelected =
    sortedArticles.length > 0 &&
    sortedArticles.every((a) => selectedArticleIds.includes(a.id));
  const isSomeSelected =
    sortedArticles.some((a) => selectedArticleIds.includes(a.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedArticleIds([]);
    } else {
      setSelectedArticleIds(sortedArticles.map((a) => a.id));
    }
  };

  const toggleSelectArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedArticleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single deletion confirmation handler
  const handleConfirmSingleDelete = async () => {
    if (!articleToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteArticle(articleToDelete.id);
      if (result.success) {
        setActionFeedback({
          type: 'success',
          message: result.message,
        });
        setSelectedArticleIds((prev) => prev.filter((id) => id !== articleToDelete.id));
      } else {
        setActionFeedback({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Erreur lors de la suppression de la pièce.',
      });
    } finally {
      setIsDeleting(false);
      setArticleToDelete(null);
    }
  };

  // Bulk deletion confirmation handler
  const handleConfirmBulkDelete = async () => {
    if (selectedArticleIds.length === 0) return;
    setIsDeleting(true);
    try {
      const result = await deleteMultipleArticles(selectedArticleIds);
      if (result.success) {
        setActionFeedback({
          type: 'success',
          message: result.message,
        });
        setSelectedArticleIds([]);
      } else {
        setActionFeedback({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Erreur lors de la suppression groupée.',
      });
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  const handleCreateOrUpdate = (
    articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingArticle) {
      const res = updateArticle(editingArticle.id, articleData);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `La fiche catalogue de la référence ${articleData.mainReference} a été mise à jour.`,
        });
      }
      return res;
    } else {
      const res = createArticle(articleData);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `La référence ${articleData.mainReference} a été ajoutée au catalogue.`,
        });
      }
      return res;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : actionFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {actionFeedback.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            {actionFeedback.type === 'info' && (
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <p className="text-xs sm:text-sm font-medium leading-relaxed">
              {actionFeedback.message}
            </p>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1" title="Recherche technique exacte SIS 2.0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Cibler :
            </span>
            {SEARCH_SCOPE_OPTIONS.map((opt) => {
              const isActive = searchScope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSearchScope(opt.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[#E35E2D]! text-white! border-[#E35E2D]!'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={opt.label}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                SEARCH_SCOPE_OPTIONS.find((o) => o.id === searchScope)?.placeholder ||
                'Rechercher une référence (ex: 1R-0716), désignation, description ou équivalence...'
              }
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Catalogue Import & Export Actions */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-amber-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                title="Importer le Catalogue depuis Excel ou CSV (Référence, Désignation, Description, Équivalences, Seuil minimum)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#E35E2D]" />
                <span>Importer</span>
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                title="Exporter le catalogue en fichier CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exporter</span>
              </button>
              {canDelete && articles.length > 0 && (
                <>
                  <div className="w-px h-4 bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => setIsPurgeCatalogModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    title="Purger intégralement le catalogue articles (Local & Cloud Firestore)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Purger</span>
                  </button>
                </>
              )}
            </div>

            {/* Primary Action Button */}
            {currentUser.role !== 'MAGASINIER' && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle référence</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Toutes les catégories ({articles.length})</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Sort selector, Display mode (Pagination / Liste continue) & stats */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-lg font-mono text-[11px]">
              <span className="font-bold">{articles.length}</span> réf. catalogue
            </span>

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
            <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
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
            <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setDisplayMode('PAGINATION')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  displayMode === 'PAGINATION'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Affichage page par page"
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
                title="Affichage en liste continue avec chargement progressif au défilement"
              >
                <List className="w-3 h-3" />
                <span>Liste continue</span>
              </button>
            </div>

            {/* Page size selector */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-mono text-[11px] focus:outline-none"
              title="Nombre de références par bloc / page"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Trier :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium focus:outline-none"
              >
                <option value="ref">Référence</option>
                <option value="designation">Désignation</option>
              </select>
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 border border-slate-200 rounded bg-white font-mono hover:bg-slate-50"
                title="Inverser l'ordre de tri"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Selection Floating Action Bar */}
      {selectedArticleIds.length > 0 && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center font-bold text-xs">
              {selectedArticleIds.length}
            </span>
            <span className="text-xs sm:text-sm font-semibold">
              {selectedArticleIds.length} produit{selectedArticleIds.length > 1 ? 's' : ''} sélectionné{selectedArticleIds.length > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-amber-950/70 hidden sm:inline">
              (sur {sortedArticles.length} affichés)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedArticleIds([])}
              className="px-3 py-1.5 text-xs font-semibold bg-white/80 hover:bg-white text-slate-800 rounded-lg transition-colors"
            >
              Tout désélectionner
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer la sélection ({selectedArticleIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {sortedArticles.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              {articles.length === 0 ? (
                <div className="max-w-md mx-auto space-y-3">
                  <h3 className="text-base font-bold text-slate-800">
                    Catalogue vierge (Table Rase active)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Aucune référence n'est actuellement enregistrée. Vous pouvez ajouter manuellement votre première référence ou importer l'ensemble de votre catalogue via un fichier Excel ou CSV.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticle(null);
                        setIsFormOpen(true);
                      }}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nouvelle référence</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200 inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Importer Catalogue (Excel / CSV)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-800">Aucune référence trouvée</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Aucune pièce du catalogue ne correspond aux critères de recherche ou de filtre actuels.
                  </p>
                </>
              )}
            </div>
          ) : layoutMode === 'GRID' ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedArticles.map((article, idx) => {
                const isSelected = selectedArticleIds.includes(article.id);
                return (
                  <div
                    key={`grid-${article.id}-${idx}`}
                    onClick={() => setViewingArticle(article)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 pb-1.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleSelectArticle(article.id, e as any)}
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                            aria-label={`Sélectionner ${article.mainReference}`}
                          />
                          {showProductImages && (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {article.imageUrl ? (
                                <img
                                  src={article.imageUrl}
                                  alt={article.mainReference}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-mono font-extrabold text-sm text-slate-950 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md inline-block">
                              {article.mainReference}
                            </span>
                            <h4
                              className="text-xs font-bold text-slate-900 line-clamp-1 mt-1"
                              title={article.designation}
                            >
                              {article.designation}
                            </h4>
                          </div>
                        </div>

                        <span className="shrink-0 font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          Seuil : {article.minStockThreshold}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-2 text-xs">
                        {(article.description || article.notes) && (
                          <p
                            className="text-[11px] text-slate-600 line-clamp-2"
                            title={article.description || article.notes}
                          >
                            {article.description || article.notes}
                          </p>
                        )}

                        {article.equivalentReferences && article.equivalentReferences.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {article.equivalentReferences.slice(0, 4).map((eq, eqIdx) => (
                              <span
                                key={`grid-eq-${eqIdx}`}
                                className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-semibold text-slate-700"
                              >
                                {eq}
                              </span>
                            ))}
                            {article.equivalentReferences.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono text-[10px] font-semibold">
                                +{article.equivalentReferences.length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Where Used SIS 2.0 Badge */}
                        <div className="pt-1">
                          {article.machineApplications && article.machineApplications.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                              title="Voir les affectations Where Used (SIS 2.0)"
                            >
                              <Tractor className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{article.machineApplications[0].model}</span>
                              {article.machineApplications[0].serialPrefix && (
                                <span className="bg-amber-200/80 px-1 rounded text-[9px]">
                                  {article.machineApplications[0].serialPrefix}
                                </span>
                              )}
                              {article.machineApplications.length > 1 && (
                                <span className="text-amber-700">
                                  +{article.machineApplications.length - 1}
                                </span>
                              )}
                            </button>
                          ) : article.compatibleMachines && article.compatibleMachines.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition-colors cursor-pointer"
                              title="Voir les affectations Where Used"
                            >
                              <Tractor className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate max-w-[120px]">{article.compatibleMachines[0]}</span>
                              {article.compatibleMachines.length > 1 && (
                                <span className="font-bold">+{article.compatibleMachines.length - 1}</span>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-700 transition-colors cursor-pointer"
                              title="Affecter des machines compatibles"
                            >
                              <Tractor className="w-3 h-3 opacity-40" />
                              <span className="italic">+ Affecter engin</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {article.category}
                      </span>

                      <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingArticle(article);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Modifier cette référence"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingArticle(article)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Voir la fiche complète"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setArticleToDelete(article)}
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
          ) : (
            <>
              {/* Desktop & Tablet Catalogue Table */}
              <table className="hidden md:table w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = isSomeSelected;
                          }
                        }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        title="Sélectionner ou désélectionner tous les produits affichés"
                      />
                    </th>
                    <th className="py-2.5 px-3">Référence</th>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Where Used (SIS 2.0)</th>
                    <th className="py-2.5 px-3">Équivalences</th>
                    <th className="py-2.5 px-3">Catégorie</th>
                    <th className="py-2.5 px-3 text-right">Seuil minimum</th>
                    <th className="py-2.5 px-3 text-right">Actions Catalogue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedArticles.map((article, idx) => {
                    const isSelected = selectedArticleIds.includes(article.id);

                    return (
                      <tr
                        key={`${article.id}-${idx}`}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer group align-middle ${
                          isSelected ? 'bg-amber-50/40' : ''
                        }`}
                        onClick={() => setViewingArticle(article)}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-2.5 px-3 text-center w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectArticle(article.id, e as any)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            aria-label={`Sélectionner ${article.mainReference}`}
                          />
                        </td>

                        {/* 1. Référence */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {showProductImages && (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {article.imageUrl ? (
                                  <img
                                    src={article.imageUrl}
                                    alt={article.mainReference}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </div>
                            )}
                            <span className="font-mono font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                              {article.mainReference}
                            </span>
                          </div>
                        </td>

                        {/* 2. Désignation */}
                        <td className="py-2.5 px-3 max-w-[240px]">
                          <div className="text-xs text-slate-900 font-semibold truncate" title={article.designation}>
                            {article.designation}
                          </div>
                        </td>

                        {/* 3. Description */}
                        <td className="py-2.5 px-3 max-w-[260px]">
                          {article.description || article.notes ? (
                            <div
                              className="text-xs text-slate-600 truncate"
                              title={article.description || article.notes}
                            >
                              {article.description || article.notes}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* Where Used (SIS 2.0) */}
                        <td
                          className="py-2.5 px-3 max-w-[210px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWhereUsedArticle(article);
                          }}
                        >
                          {article.machineApplications && article.machineApplications.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md font-mono text-[11px] font-bold transition-colors cursor-pointer"
                              title="Cliquer pour ouvrir le tableau d'affectation Where Used complet"
                            >
                              <Tractor className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{article.machineApplications[0].model}</span>
                              {article.machineApplications[0].serialPrefix && (
                                <span className="text-[10px] bg-amber-200/70 px-1 rounded font-bold">
                                  {article.machineApplications[0].serialPrefix}
                                </span>
                              )}
                              {article.machineApplications.length > 1 && (
                                <span className="text-[10px] text-amber-700 font-semibold">
                                  +{article.machineApplications.length - 1}
                                </span>
                              )}
                            </button>
                          ) : article.compatibleMachines && article.compatibleMachines.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                              title="Cliquer pour gérer les affectations Where Used"
                            >
                              <Tractor className="w-3 h-3 text-slate-500" />
                              <span className="truncate max-w-[120px]">{article.compatibleMachines[0]}</span>
                              {article.compatibleMachines.length > 1 && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                  +{article.compatibleMachines.length - 1}
                                </span>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhereUsedArticle(article);
                              }}
                              className="text-slate-400 hover:text-amber-700 text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Ajouter des machines compatibles"
                            >
                              <Tractor className="w-3 h-3 opacity-40" />
                              <span className="italic">+ Affecter</span>
                            </button>
                          )}
                        </td>

                        {/* 4. Équivalences */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          {article.equivalentReferences && article.equivalentReferences.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {article.equivalentReferences.slice(0, 3).map((eq, eqIdx) => (
                                <span
                                  key={`${eq}-${eqIdx}`}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-semibold text-slate-700"
                                >
                                  {eq}
                                </span>
                              ))}
                              {article.equivalentReferences.length > 3 && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono text-[10px] font-semibold"
                                  title={article.equivalentReferences.join(', ')}
                                >
                                  +{article.equivalentReferences.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* 5. Catégorie */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {article.category}
                          </span>
                        </td>

                        {/* 6. Seuil minimum */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {article.minStockThreshold}
                          </span>
                        </td>

                        {/* 7. Actions Catalogue */}
                        <td
                          className="py-2.5 px-3 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1">
                            {(() => {
                              const activeOrder = getActiveOrderForArticle(article.id);
                              if (activeOrder) {
                                return (
                                  <div className="inline-flex items-center gap-1 mr-1">
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Commandé
                                    </span>
                                    {onNavigateToPurchaseOrder && (
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToPurchaseOrder(activeOrder.id)}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition-colors cursor-pointer"
                                        title={`Ouvrir la liste de commande ${activeOrder.orderNumber}`}
                                      >
                                        <span>{activeOrder.orderNumber}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            {onOpenPurchaseOrder && (
                              <button
                                type="button"
                                onClick={() => onOpenPurchaseOrder(article.id, article.brand)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                title="Commander cette pièce (ajouter à une commande existante ou créer une nouvelle liste)"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingArticle(article);
                                setIsFormOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Modifier cette référence"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setViewingArticle(article)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Voir la fiche complète"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setArticleToDelete(article)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Archiver ou supprimer cette référence"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Card List View (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {displayedArticles.map((article, idx) => {
                  const isSelected = selectedArticleIds.includes(article.id);

                  return (
                    <div
                      key={`mob-${article.id}-${idx}`}
                      className={`p-3.5 space-y-2 transition-colors cursor-pointer ${
                        isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setViewingArticle(article)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleSelectArticle(article.id, e as any)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                            aria-label={`Sélectionner ${article.mainReference}`}
                          />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-sm text-slate-900 block truncate">
                              {article.mainReference}
                            </span>
                            <span className="text-xs text-slate-700 font-semibold truncate block">
                              {article.designation}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            Seuil min : {article.minStockThreshold}
                          </span>
                        </div>
                      </div>

                      {(article.description || article.notes) && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {article.description || article.notes}
                        </p>
                      )}

                      {article.equivalentReferences && article.equivalentReferences.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.equivalentReferences.map((eq, eqIdx) => (
                            <span
                              key={`mob-eq-${eqIdx}`}
                              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700"
                            >
                              {eq}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                        <span className="text-[11px] text-slate-500">{article.category}</span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setWhereUsedArticle(article)}
                            className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                            title="Gérer les affectations Where Used (SIS 2.0)"
                          >
                            <Tractor className="w-3.5 h-3.5" />
                          </button>
                          {onOpenPurchaseOrder && (
                            <button
                              type="button"
                              onClick={() => onOpenPurchaseOrder(article.id, article.brand)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                              title="Commander cette pièce"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingArticle(article);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Modifier cette référence"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingArticle(article)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Voir la fiche complète"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setArticleToDelete(article)}
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
            </>
          )}
        </div>

        {/* Continuous List Auto-Scroll Sentinel & Controls */}
        {displayMode === 'INFINITE' && sortedArticles.length > 0 && (
          <div
            ref={loadMoreSentinelRef}
            className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          >
            <span className="text-slate-600">
              Mode <strong>Liste continue</strong> : affichage de{' '}
              <strong className="font-mono text-slate-900">{displayedArticles.length}</strong> sur{' '}
              <strong className="font-mono text-slate-900">{sortedArticles.length}</strong> référence(s)
            </span>
            {displayedArticles.length < sortedArticles.length ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setInfiniteVisibleCount((prev) =>
                      Math.min(sortedArticles.length, prev + pageSize)
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  Afficher +{Math.min(pageSize, sortedArticles.length - displayedArticles.length)} références
                </button>
                <button
                  type="button"
                  onClick={() => setInfiniteVisibleCount(sortedArticles.length)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer"
                >
                  Tout afficher ({sortedArticles.length})
                </button>
              </div>
            ) : (
              <span className="text-emerald-700 font-semibold">
                Toutes les références ({sortedArticles.length}) sont affichées
              </span>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {displayMode === 'PAGINATION' && sortedArticles.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-600">
              Affichage de{' '}
              <strong className="font-mono text-slate-900">
                {(safeCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              à{' '}
              <strong className="font-mono text-slate-900">
                {Math.min(safeCurrentPage * pageSize, sortedArticles.length)}
              </strong>{' '}
              sur <strong className="font-mono text-slate-900">{sortedArticles.length}</strong> référence(s)
              {sortedArticles.length !== articles.length && ` (filtrées sur ${articles.length})`}
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

      {/* Modals */}
      <ArticleDetailModal
        article={viewingArticle}
        onClose={() => setViewingArticle(null)}
        onOpenStockIn={(id) => onOpenStockIn(id)}
        onOpenStockOut={(id) => onOpenStockOut(id)}
        onEditArticle={(art) => {
          setEditingArticle(art);
          setIsFormOpen(true);
        }}
        onQuickEditStock={(art, brand) =>
          setQuickEditTarget({
            article: art,
            brand,
            warehouseId: selectedWarehouseId,
          })
        }
        onDeleteArticle={(art) => setArticleToDelete(art)}
        onOpenPurchaseOrder={onOpenPurchaseOrder}
        onNavigateToPurchaseOrder={onNavigateToPurchaseOrder}
      />

      <QuickStockEditModal
        article={quickEditTarget?.article || null}
        initialBrand={quickEditTarget?.brand}
        warehouseId={quickEditTarget?.warehouseId}
        onClose={() => setQuickEditTarget(null)}
        onSaved={(message) => {
          setActionFeedback({ type: 'success', message });
        }}
      />

      <ArticleFormModal
        isOpen={isFormOpen}
        articleToEdit={editingArticle}
        catalogOnlyMode={true}
        onClose={() => {
          setIsFormOpen(false);
          setEditingArticle(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <ImportCatalogModal
        isOpen={isImportModalOpen}
        fixedMode="CATALOG_IMPORT"
        onClose={() => setIsImportModalOpen(false)}
      />

      <MachineWhereUsedModal
        article={whereUsedArticle}
        isOpen={!!whereUsedArticle}
        onClose={() => setWhereUsedArticle(null)}
      />

      {/* Single Article Delete Confirmation Modal */}
      {articleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Confirmation de suppression</h3>
              </div>
              <button
                onClick={() => setArticleToDelete(null)}
                className="text-rose-100 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500 uppercase font-semibold">Produit concerné</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-1">
                  {articleToDelete.mainReference}
                </div>
                <div className="text-sm font-medium text-slate-700 mt-0.5">
                  {articleToDelete.designation}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Marque : <span className="font-semibold">{articleToDelete.brand}</span> · Catégorie :{' '}
                  <span className="font-semibold">{articleToDelete.category}</span>
                </div>
              </div>

              {/* Analysis of history / stock */}
              {renderSingleDeleteAnalysis(articleToDelete)}

              {/* Role validation */}
              {!canDelete && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Droits insuffisants :</strong> Votre rôle actuel ({currentUser.role}) ne permet pas de supprimer des articles. Seuls les <strong>Responsables</strong> et <strong>Administrateurs</strong> sont habilités.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setArticleToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={!canDelete || isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isDeleting ? (
                  'Traitement en cours...'
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirmer la suppression
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">
                  Supprimer {selectedArticleIds.length} produit{selectedArticleIds.length > 1 ? 's' : ''}
                </h3>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-rose-100 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Vous avez sélectionné <strong>{selectedArticleIds.length}</strong> produit{selectedArticleIds.length > 1 ? 's' : ''} à supprimer.
              </p>

              {/* Summary of items */}
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-1.5 text-xs">
                {selectedArticleIds.map((id) => {
                  const art = articles.find((a) => a.id === id);
                  if (!art) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between py-1 px-1.5 rounded bg-white border border-slate-100"
                    >
                      <div className="truncate">
                        <span className="font-mono font-bold text-slate-900 mr-2">
                          {art.mainReference}
                        </span>
                        <span className="text-slate-600">{art.designation}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ml-2 bg-rose-100 text-rose-800">
                        Suppression définitive
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                <div className="font-bold text-rose-950 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Suppression définitive et nettoyage des traces
                </div>
                <p>
                  Les produits sélectionnés ainsi que leurs lignes de stock et mouvements associés seront <strong>définitivement supprimés</strong> du catalogue après votre confirmation.
                </p>
              </div>

              {!canDelete && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Droits insuffisants :</strong> Seuls les <strong>Responsables</strong> et <strong>Administrateurs</strong> sont autorisés à supprimer des produits.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={!canDelete || isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isDeleting ? (
                  'Traitement en cours...'
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirmer la suppression collective
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Entire Catalog Confirmation Modal */}
      {isPurgeCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Confirmation de purge du Catalogue</h3>
                  <p className="text-[11px] text-slate-400">
                    {articles.length.toLocaleString('fr-FR')} référence(s) concernée(s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPurgeCatalogModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Êtes-vous sûr de vouloir purger intégralement le catalogue ({articles.length.toLocaleString('fr-FR')} références) ?
              </p>
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <div className="font-bold text-rose-950 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Purge définitive (Local & Cloud Firestore)
                </div>
                <p>
                  Toutes les références du catalogue ainsi que les lignes de stock associées seront définitivement supprimées.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPurgeCatalogModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = purgeCollection('articles');
                  setIsPurgeCatalogModalOpen(false);
                  setSelectedArticleIds([]);
                  setActionFeedback({
                    type: res.success ? 'success' : 'error',
                    message: res.message,
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la purge du catalogue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
