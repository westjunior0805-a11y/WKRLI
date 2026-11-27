import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useStock } from '../../context/StockContext';
import { formatFCFA, exportToCSV } from '../../utils/formatters';
import { cleanBrandName, getArticleBrandOffers } from '../../utils/articleHelpers';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Download,
  TrendingDown,
  Coins,
  Truck,
  CheckCircle2,
  ExternalLink,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { CreatePurchaseOrderModal } from '../orders/CreatePurchaseOrderModal';
import { TablePagination, SortableTh, usePagination } from '../common/TablePagination';
import { RowActionsMenu } from '../common/RowActionsMenu';
import { OrderStatusBadge } from '../common/OrderStatusBadge';
import { SearchField } from '../common/SearchField';

interface AlertsAndReportsViewProps {
  onOpenStockIn: (articleId?: string) => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
}

type PieceSortField =
  | 'mainReference'
  | 'designation'
  | 'brand'
  | 'status'
  | 'currentStock'
  | 'minThreshold'
  | 'suggestedQty'
  | 'preferredSupplier'
  | 'purchasePrice'
  | 'estimatedTotal'
  | 'orderStatus';

export const AlertsAndReportsView: React.FC<AlertsAndReportsViewProps> = ({
  onNavigateToPurchaseOrder,
}) => {
  const {
    articles,
    warehouses,
    stocks,
    movements,
    getAlerts,
    getTotalStockForArticle,
    getStockValueTotal,
    getSaleValueTotal,
    getActiveOrderForArticle,
  } = useStock();

  const [activeReportTab, setActiveReportTab] = useState<
    'ALERTS' | 'VALUATION' | 'MOVEMENTS_STATS'
  >('ALERTS');

  // Search, Filter, Sort & Pagination for Alertes de Stock (format Liste des pièces & fournisseur)
  const [pieceSearchQuery, setPieceSearchQuery] = useState('');
  const deferredPieceSearchQuery = useDeferredValue(pieceSearchQuery);
  const [pieceFilterMode, setPieceFilterMode] = useState<
    | 'ALERTS_ONLY'
    | 'RUPTURES_ONLY'
    | 'LOW_STOCK_ONLY'
    | 'UNORDERED_ALERTS'
    | 'ORDERED_ONLY'
    | 'ALL_CATALOG'
  >('ALERTS_ONLY');
  const [pieceSortField, setPieceSortField] = useState<PieceSortField>('currentStock');
  const [pieceSortDir, setPieceSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [valSort, setValSort] = useState<{
    field: 'name' | 'location' | 'pieceCount' | 'purchaseVal' | 'saleVal' | 'margin';
    dir: 'asc' | 'desc';
  }>({ field: 'purchaseVal', dir: 'desc' });
  const [flowSort, setFlowSort] = useState<{
    field: 'name' | 'inQty' | 'outQty' | 'ratio';
    dir: 'asc' | 'desc';
  }>({ field: 'inQty', dir: 'desc' });

  const toggleValSort = (field: typeof valSort.field) =>
    setValSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'name' || field === 'location' ? 'asc' : 'desc' }
    );
  const toggleFlowSort = (field: typeof flowSort.field) =>
    setFlowSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'name' ? 'asc' : 'desc' }
    );

  // Multi-selection for ordering multiple pieces at once
  const [selectedReplenishArticleIds, setSelectedReplenishArticleIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [prefilledItemsForPO, setPrefilledItemsForPO] = useState<
    Array<{
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>
  >([]);
  const [prefilledSupplierName, setPrefilledSupplierName] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);

  const alerts = getAlerts();
  const outOfStockCount = alerts.filter((a) => a.alertType === 'RUPTURE').length;
  const lowStockCount = alerts.filter((a) => a.alertType === 'SOUS_SEUIL').length;

  // All catalog pieces enriched with stock, alert status, supplier, and active order status
  const allPiecesData = useMemo(() => {
    return articles
      .filter((art) => art.status !== 'archived')
      .map((art) => {
        const stock = getTotalStockForArticle(art.id);
        const isRupture = stock === 0;
        const isLow = stock > 0 && stock <= art.minStockThreshold;
        const alertStatus: 'RUPTURE' | 'SOUS_SEUIL' | 'OK' = isRupture
          ? 'RUPTURE'
          : isLow
          ? 'SOUS_SEUIL'
          : 'OK';

        const deficit = Math.max(0, art.minStockThreshold * 2 - stock);
        const suggestedQty = Math.max(1, deficit || 5);
        const activeOrder = getActiveOrderForArticle(art.id);
        const orderedQtyInActiveOrder = activeOrder
          ? activeOrder.items
              .filter((it) => it.articleId === art.id)
              .reduce((s, it) => s + it.quantityOrdered, 0)
          : 0;

        const offers = getArticleBrandOffers(art);
        const primaryBrand =
          cleanBrandName(art.brand) ||
          cleanBrandName(offers.find((o) => o.isDefault)?.brand) ||
          cleanBrandName(offers[0]?.brand) ||
          '';

        return {
          article: art,
          primaryBrand,
          currentStock: stock,
          minThreshold: art.minStockThreshold,
          suggestedQty,
          status: alertStatus,
          preferredSupplier:
            art.preferredSupplier ||
            (primaryBrand ? `${primaryBrand} Distribution` : 'Fournisseur Standard'),
          purchasePrice: art.purchasePrice,
          estimatedTotal: suggestedQty * art.purchasePrice,
          activeOrder,
          orderedQtyInActiveOrder,
        };
      });
  }, [articles, getTotalStockForArticle, getActiveOrderForArticle]);

  const replenishmentSuggestionsCount = useMemo(
    () => allPiecesData.filter((p) => p.status !== 'OK').length,
    [allPiecesData]
  );

  // Filtered & sorted pieces
  const filteredAndSortedPieces = useMemo(() => {
    const filtered = allPiecesData.filter((item) => {
      if (pieceFilterMode === 'ALERTS_ONLY' && item.status === 'OK') return false;
      if (pieceFilterMode === 'RUPTURES_ONLY' && item.status !== 'RUPTURE') return false;
      if (pieceFilterMode === 'LOW_STOCK_ONLY' && item.status !== 'SOUS_SEUIL') return false;
      if (pieceFilterMode === 'ORDERED_ONLY' && !item.activeOrder) return false;
      if (
        pieceFilterMode === 'UNORDERED_ALERTS' &&
        (item.status === 'OK' || Boolean(item.activeOrder))
      ) {
        return false;
      }

      if (deferredPieceSearchQuery.trim()) {
        const q = deferredPieceSearchQuery.toLowerCase().trim();
        const matchRef = item.article.mainReference.toLowerCase().includes(q);
        const matchDes = item.article.designation.toLowerCase().includes(q);
        const matchBrand = item.primaryBrand.toLowerCase().includes(q);
        const matchCat = (item.article.category || '').toLowerCase().includes(q);
        const matchSupp = item.preferredSupplier.toLowerCase().includes(q);
        const matchOrder = item.activeOrder?.orderNumber.toLowerCase().includes(q) ?? false;
        if (!matchRef && !matchDes && !matchBrand && !matchCat && !matchSupp && !matchOrder) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (pieceSortField) {
        case 'mainReference':
          cmp = a.article.mainReference.localeCompare(b.article.mainReference);
          break;
        case 'designation':
          cmp = a.article.designation.localeCompare(b.article.designation);
          break;
        case 'brand':
          cmp = a.primaryBrand.localeCompare(b.primaryBrand);
          break;
        case 'status': {
          const rank = { RUPTURE: 0, SOUS_SEUIL: 1, OK: 2 };
          cmp = rank[a.status] - rank[b.status];
          break;
        }
        case 'currentStock':
          cmp = a.currentStock - b.currentStock;
          break;
        case 'minThreshold':
          cmp = a.minThreshold - b.minThreshold;
          break;
        case 'suggestedQty':
          cmp = a.suggestedQty - b.suggestedQty;
          break;
        case 'preferredSupplier':
          cmp = a.preferredSupplier.localeCompare(b.preferredSupplier);
          break;
        case 'purchasePrice':
          cmp = a.purchasePrice - b.purchasePrice;
          break;
        case 'estimatedTotal':
          cmp = a.estimatedTotal - b.estimatedTotal;
          break;
        case 'orderStatus':
          cmp = (a.activeOrder ? 1 : 0) - (b.activeOrder ? 1 : 0);
          break;
      }
      return pieceSortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [allPiecesData, pieceFilterMode, deferredPieceSearchQuery, pieceSortField, pieceSortDir]);

  // Reset to page 1 when filters/search/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredPieceSearchQuery, pieceFilterMode, pieceSortField, pieceSortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPieces.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPieces = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedPieces.slice(start, start + pageSize);
  }, [filteredAndSortedPieces, safeCurrentPage, pageSize]);

  const togglePieceSort = (field: PieceSortField) => {
    if (pieceSortField === field) {
      setPieceSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setPieceSortField(field);
      setPieceSortDir('asc');
    }
  };

  const renderPieceSortIcon = (field: PieceSortField) => {
    if (pieceSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    }
    return pieceSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 inline ml-1" />
    );
  };

  const handleOrderSinglePiece = (piece: (typeof allPiecesData)[0]) => {
    setPrefilledItemsForPO([
      {
        articleId: piece.article.id,
        brand: piece.primaryBrand,
        quantityOrdered: piece.suggestedQty,
        purchasePrice: piece.purchasePrice,
      },
    ]);
    setPrefilledSupplierName(piece.preferredSupplier);
    setIsCreateModalOpen(true);
  };

  const handleOrderSelectedPieces = () => {
    const itemsToInclude = allPiecesData.filter((s) =>
      selectedReplenishArticleIds.includes(s.article.id)
    );
    if (itemsToInclude.length === 0) return;

    const payload = itemsToInclude.map((s) => ({
      articleId: s.article.id,
      brand: s.primaryBrand,
      quantityOrdered: s.suggestedQty,
      purchasePrice: s.purchasePrice,
    }));

    setPrefilledItemsForPO(payload);
    setPrefilledSupplierName(itemsToInclude[0]?.preferredSupplier);
    setIsCreateModalOpen(true);
  };

  // Statistics per warehouse
  const warehouseStats = warehouses.map((wh) => {
    const whStocks = stocks.filter((s) => s.warehouseId === wh.id);
    const pieceCount = whStocks.reduce((sum, s) => sum + s.quantity, 0);
    const purchaseVal = whStocks.reduce((sum, s) => {
      const art = articles.find((a) => a.id === s.articleId);
      return sum + (art ? s.quantity * art.purchasePrice : 0);
    }, 0);
    const saleVal = whStocks.reduce((sum, s) => {
      const art = articles.find((a) => a.id === s.articleId);
      return sum + (art ? s.quantity * art.salePrice : 0);
    }, 0);

    const inMovements = movements.filter(
      (m) => m.type === 'ENTREE' && m.targetWarehouseId === wh.id
    );
    const outMovements = movements.filter(
      (m) => m.type === 'SORTIE' && m.sourceWarehouseId === wh.id
    );
    const inQty = inMovements.reduce((sum, m) => sum + m.quantity, 0);
    const outQty = outMovements.reduce((sum, m) => sum + m.quantity, 0);

    return {
      warehouse: wh,
      pieceCount,
      purchaseVal,
      saleVal,
      margin: saleVal - purchaseVal,
      inQty,
      outQty,
    };
  });

  const sortedValStats = useMemo(() => {
    return [...warehouseStats].sort((a, b) => {
      let cmp = 0;
      switch (valSort.field) {
        case 'name':
          cmp = a.warehouse.name.localeCompare(b.warehouse.name, 'fr');
          break;
        case 'location':
          cmp = (a.warehouse.location || '').localeCompare(b.warehouse.location || '', 'fr');
          break;
        case 'pieceCount':
          cmp = a.pieceCount - b.pieceCount;
          break;
        case 'purchaseVal':
          cmp = a.purchaseVal - b.purchaseVal;
          break;
        case 'saleVal':
          cmp = a.saleVal - b.saleVal;
          break;
        case 'margin':
          cmp = a.margin - b.margin;
          break;
      }
      return valSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [warehouseStats, valSort]);

  const {
    currentPage: valPage,
    setCurrentPage: setValPage,
    pageSize: valPageSize,
    setPageSize: setValPageSize,
    paginatedItems: paginatedValStats,
  } = usePagination(sortedValStats, 15);

  const sortedFlowStats = useMemo(() => {
    return [...warehouseStats].sort((a, b) => {
      let cmp = 0;
      switch (flowSort.field) {
        case 'name':
          cmp = a.warehouse.name.localeCompare(b.warehouse.name, 'fr');
          break;
        case 'inQty':
          cmp = a.inQty - b.inQty;
          break;
        case 'outQty':
          cmp = a.outQty - b.outQty;
          break;
        case 'ratio': {
          const rA = a.outQty > 0 ? a.inQty / a.outQty : -1;
          const rB = b.outQty > 0 ? b.inQty / b.outQty : -1;
          cmp = rA - rB;
          break;
        }
      }
      return flowSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [warehouseStats, flowSort]);

  const {
    currentPage: flowPage,
    setCurrentPage: setFlowPage,
    pageSize: flowPageSize,
    setPageSize: setFlowPageSize,
    paginatedItems: paginatedFlowStats,
  } = usePagination(sortedFlowStats, 15);

  // Export alerts / pieces
  const handleExportAlertsCSV = () => {
    const headers = [
      'État Stock',
      'Réf Constructeur',
      'Marque',
      'Désignation',
      'Catégorie',
      'Stock Actuel',
      'Seuil Minimal',
      'Qté Conseillée',
      'Fournisseur',
      'Prix Achat Unit. (FCFA)',
      'Statut Commande',
    ];

    const rows = filteredAndSortedPieces.map((s) => [
      s.status === 'RUPTURE' ? 'Rupture' : s.status === 'SOUS_SEUIL' ? 'Sous Seuil' : 'Disponible',
      s.article.mainReference,
      s.article.brand || '',
      s.article.designation,
      s.article.category,
      s.currentStock,
      s.minThreshold,
      s.suggestedQty,
      s.preferredSupplier,
      s.purchasePrice,
      s.activeOrder ? `Commandé (${s.activeOrder.orderNumber})` : 'Non commandé',
    ]);

    exportToCSV(`alertes_et_reappro_stock_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  // Export valuation
  const handleExportValuationCSV = () => {
    const headers = [
      'Magasin Code',
      'Magasin Nom',
      'Localisation',
      'Pièces en Stock',
      'Valeur Achat (FCFA)',
      'Valeur Vente (FCFA)',
      'Marge Potentielle (FCFA)',
      'Total Entrées (qté)',
      'Total Sorties (qté)',
    ];

    const rows = warehouseStats.map((w) => [
      w.warehouse.code,
      w.warehouse.name,
      w.warehouse.location,
      w.pieceCount,
      w.purchaseVal,
      w.saleVal,
      w.margin,
      w.inQty,
      w.outQty,
    ]);

    exportToCSV(
      `rapport_valorisation_magasins_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveReportTab('ALERTS')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeReportTab === 'ALERTS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertes de Stock & Réapprovisionnement ({replenishmentSuggestionsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveReportTab('VALUATION')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeReportTab === 'VALUATION'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Valorisation par Magasin
          </button>
          <button
            type="button"
            onClick={() => setActiveReportTab('MOVEMENTS_STATS')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeReportTab === 'MOVEMENTS_STATS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Flux Entrées / Sorties
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeReportTab === 'ALERTS' && selectedReplenishArticleIds.length > 0 && (
            <button
              type="button"
              onClick={handleOrderSelectedPieces}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Commander la sélection ({selectedReplenishArticleIds.length})</span>
            </button>
          )}

          {activeReportTab === 'ALERTS' && (
            <button
              type="button"
              onClick={handleExportAlertsCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter CSV
            </button>
          )}

          {activeReportTab === 'VALUATION' && (
            <button
              type="button"
              onClick={handleExportValuationCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter la valorisation CSV
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ALERTS (FORMAT LISTE DES PIÈCES & FOURNISSEUR AVEC PAGINATION) */}
      {activeReportTab === 'ALERTS' && (
        <div className="space-y-4">
          {/* Search & Filter Bar for Pieces — visible immediately at top */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
            <SearchField
              value={pieceSearchQuery}
              onChange={setPieceSearchQuery}
              className="flex-1"
              placeholder="Référence ou pièce..."
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  {
                    id: 'ALERTS_ONLY',
                    label: `Ruptures & Sous seuil (${replenishmentSuggestionsCount})`,
                  },
                  { id: 'UNORDERED_ALERTS', label: 'Alertes non commandées' },
                  { id: 'ORDERED_ONLY', label: 'Pièces déjà commandées' },
                  { id: 'ALL_CATALOG', label: `Tout le catalogue (${allPiecesData.length})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPieceFilterMode(f.id)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    pieceFilterMode === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clickable KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() =>
                setPieceFilterMode((prev) =>
                  prev === 'RUPTURES_ONLY' ? 'ALERTS_ONLY' : 'RUPTURES_ONLY'
                )
              }
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                pieceFilterMode === 'RUPTURES_ONLY'
                  ? 'bg-rose-100/90 border-2 border-rose-500 shadow-md ring-2 ring-rose-400/30'
                  : 'bg-rose-50 hover:bg-rose-100/60 border border-rose-200 hover:shadow-xs'
              }`}
              title="Cliquer pour filtrer uniquement les ruptures totales"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-sm font-bold text-rose-900">
                    Ruptures totales ({outOfStockCount})
                  </h3>
                </div>
                {pieceFilterMode === 'RUPTURES_ONLY' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                    Filtre actif ✓
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-rose-700 bg-rose-200/60 px-1.5 py-0.5 rounded">
                    Cliquer pour filtrer
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-700 mt-1.5">
                Articles pour lesquels aucun magasin ne dispose de stock physique.
              </p>
            </div>

            <div
              onClick={() =>
                setPieceFilterMode((prev) =>
                  prev === 'LOW_STOCK_ONLY' ? 'ALERTS_ONLY' : 'LOW_STOCK_ONLY'
                )
              }
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                pieceFilterMode === 'LOW_STOCK_ONLY'
                  ? 'bg-amber-100/90 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                  : 'bg-amber-50 hover:bg-amber-100/60 border border-amber-200 hover:shadow-xs'
              }`}
              title="Cliquer pour filtrer uniquement les articles sous le seuil minimal"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">
                    Sous le seuil minimal ({lowStockCount})
                  </h3>
                </div>
                {pieceFilterMode === 'LOW_STOCK_ONLY' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-xs">
                    Filtre actif ✓
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">
                    Cliquer pour filtrer
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-700 mt-1.5">
                Articles dont la quantité totale en stock est inférieure ou égale au seuil de sécurité.
              </p>
            </div>
          </div>

          {/* Pieces Table with Sortable Columns & Pagination */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="w-full">
              {filteredAndSortedPieces.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">Aucune pièce trouvée</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Modifiez votre recherche ou changez le filtre d&apos;affichage ci-dessus.
                  </p>
                </div>
              ) : (
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={
                            paginatedPieces.length > 0 &&
                            paginatedPieces.every((s) =>
                              selectedReplenishArticleIds.includes(s.article.id)
                            )
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pageIds = paginatedPieces.map((s) => s.article.id);
                              setSelectedReplenishArticleIds((prev) =>
                                Array.from(new Set([...prev, ...pageIds]))
                              );
                            } else {
                              const pageIds = new Set(paginatedPieces.map((s) => s.article.id));
                              setSelectedReplenishArticleIds((prev) =>
                                prev.filter((id) => !pageIds.has(id))
                              );
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600"
                        />
                      </th>
                      <th
                        onClick={() => togglePieceSort('mainReference')}
                        className="py-2.5 px-2 cursor-pointer hover:text-slate-900 select-none w-[12%]"
                      >
                        Réf. {renderPieceSortIcon('mainReference')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('designation')}
                        className="py-2.5 px-2 cursor-pointer hover:text-slate-900 select-none w-[18%]"
                      >
                        Désignation {renderPieceSortIcon('designation')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('brand')}
                        className="hidden md:table-cell py-2.5 px-2 cursor-pointer hover:text-slate-900 select-none w-[9%]"
                      >
                        Marque {renderPieceSortIcon('brand')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('status')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:text-slate-900 select-none w-[10%]"
                      >
                        État {renderPieceSortIcon('status')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('currentStock')}
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-900 select-none w-[7%]"
                      >
                        Stock {renderPieceSortIcon('currentStock')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('minThreshold')}
                        className="hidden lg:table-cell py-2.5 px-2 text-right cursor-pointer hover:text-slate-900 select-none w-[7%]"
                      >
                        Seuil {renderPieceSortIcon('minThreshold')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('suggestedQty')}
                        className="hidden sm:table-cell py-2.5 px-2 text-right cursor-pointer hover:text-slate-900 select-none w-[7%]"
                      >
                        Cons. {renderPieceSortIcon('suggestedQty')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('preferredSupplier')}
                        className="hidden xl:table-cell py-2.5 px-2 cursor-pointer hover:text-slate-900 select-none w-[11%]"
                      >
                        Fournisseur {renderPieceSortIcon('preferredSupplier')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('purchasePrice')}
                        className="hidden xl:table-cell py-2.5 px-2 text-right cursor-pointer hover:text-slate-900 select-none w-[10%]"
                      >
                        P. Achat {renderPieceSortIcon('purchasePrice')}
                      </th>
                      <th
                        onClick={() => togglePieceSort('orderStatus')}
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-900 select-none w-16"
                      >
                        Opt. {renderPieceSortIcon('orderStatus')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPieces.map((s) => {
                      const isSelected = selectedReplenishArticleIds.includes(s.article.id);
                      const linkedOrder = s.activeOrder;

                      return (
                        <tr
                          key={s.article.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReplenishArticleIds((prev) => [...prev, s.article.id]);
                                } else {
                                  setSelectedReplenishArticleIds((prev) =>
                                    prev.filter((id) => id !== s.article.id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-amber-600"
                            />
                          </td>
                          <td className="py-2.5 px-2 font-mono font-bold text-slate-900 truncate" title={s.article.mainReference}>
                            {s.article.mainReference}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="font-semibold text-slate-800 truncate" title={s.article.designation}>
                              {s.article.designation}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{s.article.category}</div>
                          </td>
                          <td className="hidden md:table-cell py-2.5 px-2 font-semibold text-slate-700 truncate">
                            {s.primaryBrand || '—'}
                          </td>
                          <td className="py-2.5 px-1.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {s.status === 'RUPTURE' ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                  <AlertOctagon className="w-3 h-3 shrink-0" />
                                  Rupture
                                </span>
                              ) : s.status === 'SOUS_SEUIL' ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  Bas
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  Dispo
                                </span>
                              )}
                              {linkedOrder && (
                                <OrderStatusBadge
                                  order={linkedOrder}
                                  onNavigate={onNavigateToPurchaseOrder}
                                  compact
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold">
                            <span
                              className={
                                s.currentStock === 0
                                  ? 'text-rose-600'
                                  : s.status === 'SOUS_SEUIL'
                                  ? 'text-amber-600'
                                  : 'text-slate-900'
                              }
                            >
                              {s.currentStock}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell py-2.5 px-2 text-right font-mono text-slate-500">
                            {s.minThreshold}
                          </td>
                          <td className="hidden sm:table-cell py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                            +{s.suggestedQty}
                          </td>
                          <td className="hidden xl:table-cell py-2.5 px-2">
                            <span className="font-medium text-slate-700 truncate block" title={s.preferredSupplier}>
                              {s.preferredSupplier}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell py-2.5 px-2 text-right font-mono text-slate-700 truncate">
                            {formatFCFA(s.purchasePrice)}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <RowActionsMenu
                              actions={[
                                {
                                  label: linkedOrder
                                    ? `Ouvrir commande ${linkedOrder.orderNumber} (${s.orderedQtyInActiveOrder})`
                                    : 'Ouvrir commande',
                                  icon: <ExternalLink className="w-3.5 h-3.5" />,
                                  tone: 'success',
                                  hidden: !linkedOrder || !onNavigateToPurchaseOrder,
                                  onClick: () => linkedOrder && onNavigateToPurchaseOrder?.(linkedOrder.id),
                                },
                                {
                                  label: linkedOrder ? 'Commander à nouveau' : 'Commander cette pièce',
                                  icon: <Truck className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  onClick: () => handleOrderSinglePiece(s),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer to prevent app overload */}
            {filteredAndSortedPieces.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>
                    Affichage{' '}
                    <strong className="font-mono text-slate-900">
                      {(safeCurrentPage - 1) * pageSize + 1}
                    </strong>{' '}
                    à{' '}
                    <strong className="font-mono text-slate-900">
                      {Math.min(safeCurrentPage * pageSize, filteredAndSortedPieces.length)}
                    </strong>{' '}
                    sur{' '}
                    <strong className="font-mono text-slate-900">
                      {filteredAndSortedPieces.length}
                    </strong>{' '}
                    pièces
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Précédent</span>
                    </button>
                    <span className="px-2.5 py-1 font-mono font-bold text-slate-800">
                      Page {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Suivant</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VALUATION */}
      {activeReportTab === 'VALUATION' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Valeur Totale d&apos;Achat
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {formatFCFA(getStockValueTotal())}
              </span>
              <p className="text-xs text-slate-500 mt-1">Investissement immobilisé</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Valeur Totale de Vente
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                {formatFCFA(getSaleValueTotal())}
              </span>
              <p className="text-xs text-slate-500 mt-1">Chiffre d&apos;affaires potentiel</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Marge Potentielle
              </span>
              <span className="text-2xl font-bold font-mono text-amber-700 mt-1 block">
                {formatFCFA(getSaleValueTotal() - getStockValueTotal())}
              </span>
              <p className="text-xs text-slate-500 mt-1">Bénéfice brut prévisionnel</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Synthèse valorisée par entrepôt</h3>
            </div>

            <div className="w-full">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <SortableTh label="Magasin" active={valSort.field === 'name'} direction={valSort.dir} onClick={() => toggleValSort('name')} className="w-[22%]" />
                    <SortableTh label="Localisation" active={valSort.field === 'location'} direction={valSort.dir} onClick={() => toggleValSort('location')} className="hidden md:table-cell w-[18%]" />
                    <SortableTh label="Pièces" active={valSort.field === 'pieceCount'} direction={valSort.dir} onClick={() => toggleValSort('pieceCount')} align="right" className="w-[12%]" />
                    <SortableTh label="Val. Achat" active={valSort.field === 'purchaseVal'} direction={valSort.dir} onClick={() => toggleValSort('purchaseVal')} align="right" className="w-[16%]" />
                    <SortableTh label="Val. Vente" active={valSort.field === 'saleVal'} direction={valSort.dir} onClick={() => toggleValSort('saleVal')} align="right" className="w-[16%]" />
                    <SortableTh label="Marge Brute" active={valSort.field === 'margin'} direction={valSort.dir} onClick={() => toggleValSort('margin')} align="right" className="w-[16%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedValStats.map((item) => (
                    <tr key={item.warehouse.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-2.5 font-semibold text-slate-900">
                        <span className="block truncate">{item.warehouse.name}</span>
                        <span className="block font-mono text-[10px] text-slate-400">
                          {item.warehouse.code}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-2.5 px-2.5 text-slate-600 truncate">{item.warehouse.location}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {item.pieceCount.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums truncate">
                        {formatFCFA(item.purchaseVal)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-700 tabular-nums truncate">
                        {formatFCFA(item.saleVal)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-amber-700 tabular-nums truncate">
                        {formatFCFA(item.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={valPage}
              totalItems={sortedValStats.length}
              pageSize={valPageSize}
              onPageChange={setValPage}
              onPageSizeChange={setValPageSize}
              itemLabel="magasins"
            />
          </div>
        </div>
      )}

      {/* TAB 3: MOVEMENTS STATS */}
      {activeReportTab === 'MOVEMENTS_STATS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">
              Flux quantitatifs d&apos;entrées et de sorties par site
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Volume cumulé des réceptions et livraisons enregistrées
            </p>
          </div>

          <div className="w-full">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <SortableTh label="Magasin" active={flowSort.field === 'name'} direction={flowSort.dir} onClick={() => toggleFlowSort('name')} className="w-[40%]" />
                  <SortableTh label="Volume Reçu" active={flowSort.field === 'inQty'} direction={flowSort.dir} onClick={() => toggleFlowSort('inQty')} align="right" className="w-[22%]" />
                  <SortableTh label="Volume Livré" active={flowSort.field === 'outQty'} direction={flowSort.dir} onClick={() => toggleFlowSort('outQty')} align="right" className="w-[22%]" />
                  <SortableTh label="Ratio" active={flowSort.field === 'ratio'} direction={flowSort.dir} onClick={() => toggleFlowSort('ratio')} align="right" className="w-[16%]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedFlowStats.map((item) => (
                  <tr key={item.warehouse.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-2.5 font-semibold text-slate-900 truncate">
                      {item.warehouse.name} ({item.warehouse.code})
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      +{item.inQty} pièces
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-rose-700 tabular-nums">
                      -{item.outQty} pièces
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {item.outQty > 0 ? (item.inQty / item.outQty).toFixed(2) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={flowPage}
            totalItems={sortedFlowStats.length}
            pageSize={flowPageSize}
            onPageChange={setFlowPage}
            onPageSizeChange={setFlowPageSize}
            itemLabel="magasins"
          />
        </div>
      )}

      {/* Modal to create or add to a Purchase Order directly from Alerts & Replenishment */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        initialItems={prefilledItemsForPO}
        initialSupplierName={prefilledSupplierName}
        onClose={() => {
          setIsCreateModalOpen(false);
          setPrefilledItemsForPO([]);
          setPrefilledSupplierName(undefined);
        }}
        onSuccess={(msg) => {
          setNotification(msg);
          setSelectedReplenishArticleIds([]);
        }}
      />
    </div>
  );
};
