import React, { useState, useMemo, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleCategory } from '../../types';
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
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import { ArticleDetailModal } from './ArticleDetailModal';
import { ArticleFormModal } from './ArticleFormModal';
import { ImportCatalogModal } from './ImportCatalogModal';
import {
  formatPurchasePriceRange,
  formatSalePriceRange,
  getArticleBrandOffers,
} from '../../utils/articleHelpers';

interface ArticleCatalogViewProps {
  onOpenStockIn: (articleId?: string) => void;
  onOpenStockOut: (articleId?: string) => void;
}

export const ArticleCatalogView: React.FC<ArticleCatalogViewProps> = ({
  onOpenStockIn,
  onOpenStockOut,
}) => {
  const {
    articles,
    getTotalStockForArticle,
    getStockForArticleAndWarehouse,
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
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'>('ALL');
  const [sortBy, setSortBy] = useState<'ref' | 'designation' | 'stock' | 'price'>('ref');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Multi-selection state
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);

  // Deletion modals state
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals state
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  // Filter & Search logic
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // Category filter
      if (selectedCategory !== 'ALL' && art.category !== selectedCategory) return false;

      // Brand filter (matches either article.brand or any brandOffer)
      if (selectedBrand !== 'ALL') {
        const matchesBrand =
          art.brand === selectedBrand ||
          art.brandOffers?.some((bo) => bo.brand === selectedBrand);
        if (!matchesBrand) return false;
      }

      // Stock status filter
      const stock = selectedWarehouseId
        ? getStockForArticleAndWarehouse(art.id, selectedWarehouseId)
        : getTotalStockForArticle(art.id);

      if (stockStatusFilter === 'OUT' && stock > 0) return false;
      if (stockStatusFilter === 'LOW' && (stock === 0 || stock > art.minStockThreshold)) return false;
      if (stockStatusFilter === 'IN_STOCK' && stock === 0) return false;

      // Search query filter (matches mainReference, designation, brand, brandOffers, equivalent references, compatible machines)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchMain = art.mainReference.toLowerCase().includes(query);
        const matchDesig = art.designation.toLowerCase().includes(query);
        const matchBrand = art.brand.toLowerCase().includes(query);
        const matchEq = art.equivalentReferences?.some((eq) => eq.toLowerCase().includes(query));
        const matchMach = art.compatibleMachines?.some((m) => m.toLowerCase().includes(query));
        const matchBrandOffers = art.brandOffers?.some(
          (bo) =>
            bo.brand.toLowerCase().includes(query) ||
            bo.brandReference?.toLowerCase().includes(query) ||
            bo.preferredSupplier?.toLowerCase().includes(query)
        );

        if (!matchMain && !matchDesig && !matchBrand && !matchEq && !matchMach && !matchBrandOffers) {
          return false;
        }
      }

      return true;
    });
  }, [
    articles,
    searchQuery,
    selectedCategory,
    selectedBrand,
    stockStatusFilter,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
  ]);

  // Sorting
  const sortedArticles = useMemo(() => {
    return [...filteredArticles].sort((a, b) => {
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
    sortBy,
    sortDirection,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
  ]);

  const handleExportCSV = () => {
    const headers = [
      'ID Interne',
      'Référence Pivot',
      'Marque Principale',
      'Toutes Marques & Tarifs',
      'Désignation',
      'Catégorie',
      'Références Équivalentes',
      'Machines Compatibles',
      'Prix Achat (FCFA)',
      'Prix Vente (FCFA)',
      'Seuil Minimal',
      'Stock Disponible',
      'Emplacement',
      'Unité',
      'Statut',
    ];

    const rows = sortedArticles.map((art) => {
      const stock = selectedWarehouseId
        ? getStockForArticleAndWarehouse(art.id, selectedWarehouseId)
        : getTotalStockForArticle(art.id);

      const allOffersStr = (art.brandOffers || [])
        .map((bo) => `${bo.brand}${bo.brandReference ? ` [${bo.brandReference}]` : ''}: Achat ${bo.purchasePrice}F / Vente ${bo.salePrice}F`)
        .join(' | ');

      return [
        art.id,
        art.mainReference,
        art.brand,
        allOffersStr || art.brand,
        art.designation,
        art.category,
        (art.equivalentReferences || []).join(', '),
        (art.compatibleMachines || []).join(', '),
        art.purchasePrice,
        art.salePrice,
        art.minStockThreshold,
        stock,
        art.defaultLocation,
        art.unit,
        art.status === 'active' ? 'Actif' : 'Archivé',
      ];
    });

    exportToCSV(`catalogue_pieces_engins_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const canDelete = currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE';

  // Analysis of article history to clearly inform the user
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
      willArchive: hasHistory || stock > 0,
    };
  };

  const renderSingleDeleteAnalysis = (art: Article) => {
    const analysis = getArticleHistoryAnalysis(art);
    if (analysis.willArchive) {
      return (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <Archive className="w-4 h-4 text-amber-600" />
            Préservation de l'historique (Archivage automatique sécurisé)
          </div>
          <p>
            Cet article possède un historique opérationnel
            {analysis.hasSales && ' (ventes existantes)'}
            {analysis.hasMvts && ' (mouvements de stock)'}
            {analysis.hasInv && ' (inventaires passés)'}
            {analysis.stock > 0 && ` ou un stock disponible résiduel (${analysis.stock} ${art.unit})`}.
          </p>
          <p className="font-medium text-amber-950">
            Pour garantir l'intégrité comptable et la traçabilité des opérations, le produit sera <strong>archivé et désactivé du catalogue actif</strong> sans altérer les transactions et mouvements passés.
          </p>
        </div>
      );
    }
    return (
      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1.5">
        <div className="font-bold flex items-center gap-1.5 text-rose-800">
          <Trash2 className="w-4 h-4 text-rose-600" />
          Suppression définitive autorisée
        </div>
        <p>
          Cet article n'a aucun mouvement, aucune vente ni inventaire associé, et son stock actuel est nul (0).
        </p>
        <p className="font-medium text-rose-950">
          Il sera <strong>définitivement supprimé</strong> du système.
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
      return updateArticle(editingArticle.id, articleData);
    } else {
      return createArticle(articleData);
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Recherche par réf principale (ex: 1R-0716), désignation, marque ou cross-ref..."
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
            {/* Grouped Secondary Data Actions */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
                title="Importer le catalogue et stock depuis Excel ou CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                <span>Importer</span>
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
                title="Exporter les pièces en fichier CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exporter</span>
              </button>
            </div>

            {/* Primary Action Button */}
            {currentUser.role !== 'MAGASINIER' && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle pièce</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          {/* Stock Level Segmented Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                stockStatusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toutes ({articles.length})
            </button>
            <button
              onClick={() => setStockStatusFilter('IN_STOCK')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                stockStatusFilter === 'IN_STOCK'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En stock
            </button>
            <button
              onClick={() => setStockStatusFilter('LOW')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                stockStatusFilter === 'LOW'
                  ? 'bg-white text-amber-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sous seuil
            </button>
            <button
              onClick={() => setStockStatusFilter('OUT')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                stockStatusFilter === 'OUT'
                  ? 'bg-white text-rose-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rupture
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Toutes les catégories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Toutes les marques</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Sort selector */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-400">Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium focus:outline-none"
            >
              <option value="ref">Réf. Constructeur</option>
              <option value="designation">Désignation</option>
              <option value="stock">Quantité en stock</option>
              <option value="price">Prix d'achat</option>
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
                    Aucune référence n'est actuellement enregistrée. Vous pouvez ajouter manuellement votre première pièce ou importer l'ensemble de votre catalogue via un fichier Excel ou CSV.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticle(null);
                        setIsFormOpen(true);
                      }}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter une pièce</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetToDemoData()}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-300 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Charger données d'essai</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-800">Aucune pièce trouvée</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Aucune pièce détachée ne correspond aux critères de recherche ou de filtre actuels.
                  </p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
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
                  <th className="py-3 px-3">Réf. Pivot & Marques</th>
                  <th className="py-3 px-3">Désignation & Catégorie</th>
                  <th className="py-3 px-3">Équivalences Cross-Ref</th>
                  <th className="py-3 px-3 text-right">Stock Dispo</th>
                  <th className="py-3 px-3 text-right">Seuil Min</th>
                  <th className="py-3 px-3 text-right">Prix Achat</th>
                  <th className="py-3 px-3 text-right">Prix Vente</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedArticles.map((article, idx) => {
                  const currentStock = selectedWarehouseId
                    ? getStockForArticleAndWarehouse(article.id, selectedWarehouseId)
                    : getTotalStockForArticle(article.id);

                  const isOutOfStock = currentStock === 0;
                  const isLowStock = currentStock > 0 && currentStock <= article.minStockThreshold;
                  const isSelected = selectedArticleIds.includes(article.id);

                  return (
                    <tr
                      key={`${article.id}-${idx}`}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                      onClick={() => setViewingArticle(article)}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3 text-center w-10"
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

                      {/* Main Reference & Brands */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
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
                          <div>
                            <div className="font-mono font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                              {article.mainReference}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-700 font-semibold">
                                {article.brand}
                              </span>
                              {article.brandOffers && article.brandOffers.length > 1 && (
                                <span
                                  className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-semibold rounded"
                                  title={article.brandOffers.map((b) => `${b.brand} (${b.salePrice.toLocaleString()} F)`).join(' • ')}
                                >
                                  +{article.brandOffers.length - 1} marque{article.brandOffers.length > 2 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Designation & Category */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-800 truncate" title={article.designation}>
                          {article.designation}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {article.category}
                        </div>
                      </td>

                      {/* Equivalences Cross-Ref */}
                      <td className="py-3 px-3 max-w-[200px]">
                        {article.equivalentReferences && article.equivalentReferences.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {article.equivalentReferences.slice(0, 2).map((eq, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded"
                              >
                                {eq}
                              </span>
                            ))}
                            {article.equivalentReferences.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                +{article.equivalentReferences.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            isOutOfStock
                              ? 'text-rose-600'
                              : isLowStock
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {currentStock}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">{article.unit}</span>
                      </td>

                      {/* Threshold */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {article.minStockThreshold}
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {formatPurchasePriceRange(article)}
                      </td>

                      {/* Sale Price */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                        {formatSalePriceRange(article)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">
                            <AlertCircle className="w-3 h-3" />
                            Rupture
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" />
                            Sous seuil
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingArticle(article);
                              setIsFormOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
                            title="Modifier l'article"
                          >
                            Modifier
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuArticleId(
                                activeActionMenuArticleId === article.id ? null : article.id
                              );
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Plus d'actions"
                            aria-label="Plus d'actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {/* Row Context Dropdown */}
                          {activeActionMenuArticleId === article.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuArticleId(null);
                                  setViewingArticle(article);
                                }}
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                <span>Voir la fiche</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuArticleId(null);
                                  onOpenStockIn(article.id);
                                }}
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-emerald-700 transition-colors"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Entrée de stock (+)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuArticleId(null);
                                  onOpenStockOut(article.id);
                                }}
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-rose-700 transition-colors"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                                <span>Sortie de stock (-)</span>
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuArticleId(null);
                                  setArticleToDelete(article);
                                }}
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Archiver / Supprimer</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Affichage de <strong>{sortedArticles.length}</strong> référence(s) sur {articles.length}
          </span>
          <span className="font-mono">
            Règle : La référence principale constructeur n'est jamais confondue avec une équivalence.
          </span>
        </div>
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
        onDeleteArticle={(art) => setArticleToDelete(art)}
      />

      <ArticleFormModal
        isOpen={isFormOpen}
        articleToEdit={editingArticle}
        onClose={() => {
          setIsFormOpen(false);
          setEditingArticle(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <ImportCatalogModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
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
                  const analysis = getArticleHistoryAnalysis(art);
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
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ml-2 ${
                          analysis.willArchive
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {analysis.willArchive ? 'Sera archivé' : 'Suppression nette'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  Règle d'intégrité et de traçabilité
                </div>
                <p>
                  Les produits comportant des mouvements de stock, des ventes, ou un stock non-nul seront <strong>archivés en toute sécurité</strong> pour préserver l'historique comptable.
                </p>
                <p>
                  Les produits sans aucun historique et sans stock seront <strong>définitivement supprimés</strong>.
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
    </div>
  );
};
