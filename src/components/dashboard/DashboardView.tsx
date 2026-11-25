import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDateTime } from '../../utils/formatters';
import {
  Boxes,
  Package,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Coins,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  TrendingUp,
  FileSpreadsheet,
  Truck,
  CheckCircle2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { TablePagination, SortableTh, usePagination } from '../common/TablePagination';
import { RowActionsMenu } from '../common/RowActionsMenu';

interface DashboardViewProps {
  onNavigateToCatalog: () => void;
  onNavigateToImport?: () => void;
  onNavigateToMovements: () => void;
  onNavigateToReports: () => void;
  onOpenStockIn: (articleId?: string) => void;
  onOpenStockOut: (articleId?: string) => void;
  onOpenTransfer: (articleId?: string) => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToCatalog,
  onNavigateToImport,
  onNavigateToMovements,
  onNavigateToReports,
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
}) => {
  const {
    articles,
    warehouses,
    stocks,
    movements,
    selectedWarehouseId,
    getStockValueTotal,
    getSaleValueTotal,
    getAlerts,
    getArticleById,
    getWarehouseById,
    getActiveOrderForArticle,
    companyInfo,
  } = useStock();

  // Filter based on selected warehouse if set
  const filteredStocks = selectedWarehouseId
    ? stocks.filter((s) => s.warehouseId === selectedWarehouseId)
    : stocks;

  const totalPiecesInStock = filteredStocks.reduce((sum, s) => sum + s.quantity, 0);
  const totalReferencesCount = articles.filter((a) => a.status === 'active').length;

  const stockPurchaseValue = getStockValueTotal(selectedWarehouseId);
  const stockSaleValue = getSaleValueTotal(selectedWarehouseId);
  const potentialMargin = stockSaleValue - stockPurchaseValue;

  const alerts = getAlerts();
  const outOfStockAlerts = alerts.filter((a) => a.alertType === 'RUPTURE');
  const lowStockAlerts = alerts.filter((a) => a.alertType === 'SOUS_SEUIL');

  const [alertSort, setAlertSort] = useState<{
    field: 'ref' | 'designation' | 'stock' | 'status';
    dir: 'asc' | 'desc';
  }>({ field: 'stock', dir: 'asc' });

  const [mvtSort, setMvtSort] = useState<{
    field: 'type' | 'ref' | 'quantity' | 'documentRef' | 'date';
    dir: 'asc' | 'desc';
  }>({ field: 'date', dir: 'desc' });

  const toggleAlertSort = (field: typeof alertSort.field) =>
    setAlertSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
    );
  const toggleMvtSort = (field: typeof mvtSort.field) =>
    setMvtSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'date' || field === 'quantity' ? 'desc' : 'asc' }
    );

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      let cmp = 0;
      switch (alertSort.field) {
        case 'ref':
          cmp = (a.mainReference || '').localeCompare(b.mainReference || '', 'fr');
          break;
        case 'designation':
          cmp = (a.designation || '').localeCompare(b.designation || '', 'fr');
          break;
        case 'stock':
          cmp = a.currentStock - b.currentStock;
          break;
        case 'status':
          cmp = (a.alertType || '').localeCompare(b.alertType || '', 'fr');
          break;
      }
      return alertSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [alerts, alertSort]);

  const {
    currentPage: alertPage,
    setCurrentPage: setAlertPage,
    pageSize: alertPageSize,
    setPageSize: setAlertPageSize,
    paginatedItems: paginatedAlerts,
  } = usePagination(sortedAlerts, 6);

  const sortedDashboardMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      let cmp = 0;
      switch (mvtSort.field) {
        case 'type':
          cmp = (a.type || '').localeCompare(b.type || '', 'fr');
          break;
        case 'ref': {
          const rA = getArticleById(a.articleId)?.mainReference || '';
          const rB = getArticleById(b.articleId)?.mainReference || '';
          cmp = rA.localeCompare(rB, 'fr');
          break;
        }
        case 'quantity':
          cmp = (a.quantity || 0) - (b.quantity || 0);
          break;
        case 'documentRef':
          cmp = (a.documentRef || '').localeCompare(b.documentRef || '', 'fr');
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
      }
      return mvtSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [movements, mvtSort, getArticleById]);

  const {
    currentPage: mvtPage,
    setCurrentPage: setMvtPage,
    pageSize: mvtPageSize,
    setPageSize: setMvtPageSize,
    paginatedItems: paginatedDashboardMovements,
  } = usePagination(sortedDashboardMovements, 6);

  // Per warehouse breakdown
  const warehouseStats = warehouses.map((wh) => {
    const whStocks = stocks.filter((s) => s.warehouseId === wh.id);
    const pieceCount = whStocks.reduce((sum, s) => sum + s.quantity, 0);
    const value = whStocks.reduce((sum, s) => {
      const art = articles.find((a) => a.id === s.articleId);
      return sum + (art ? s.quantity * art.purchasePrice : 0);
    }, 0);
    return {
      warehouse: wh,
      pieceCount,
      value,
    };
  });

  const selectedWhObj = selectedWarehouseId ? getWarehouseById(selectedWarehouseId) : null;

  return (
    <div className="space-y-6">
      {/* Clean Production Welcome Banner when database is empty */}
      {articles.length === 0 && (
        <div className="card p-6 sm:p-7 bg-white border border-[#E0E0E0] flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="label text-[#7A5C00]">
              Exploitation · Base prête
            </div>
            <h3 className="font-display text-3xl font-semibold text-[#111111] tracking-[-0.02em] leading-tight">
              Bienvenue dans votre espace {companyInfo?.name || 'WKRLI'}
            </h3>
            <p className="text-xs text-[#595959] leading-relaxed">
              Votre base de données est vierge et prête à recevoir votre inventaire réel. Créez vos premières références manuellement ou importez votre catalogue Excel / CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onNavigateToCatalog}
              className="cta-btn px-5 py-2.5 bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] text-xs font-bold uppercase tracking-[0.05em] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Boxes className="w-4 h-4 text-[#111111]" />
              <span>Ajouter une pièce</span>
            </button>
            {onNavigateToImport && (
              <button
                onClick={onNavigateToImport}
                className="px-4 py-2.5 bg-white hover:border-[#FFCD11] hover:bg-[#FFF9DF] text-[#111111] text-xs font-semibold border border-[#E0E0E0] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#7A5C00]" />
                <span>Importer Excel / CSV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner if warehouse is filtered */}
      {selectedWhObj && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-4 sm:px-5 py-3 sm:py-3.5 bg-white border border-[#E5C130] border-l-[4px] border-l-[#FFCD11] text-[#111111] text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <Building2 className="w-4 h-4 text-[#111111] shrink-0" />
            <span className="font-mono text-xs uppercase tracking-[0.08em] truncate">
              Magasin actif : <strong className="text-[#7A5C00]">{selectedWhObj.name}</strong> ({selectedWhObj.code})
            </span>
          </div>
          <span className="text-xs font-mono text-[#595959] shrink-0">
            {selectedWhObj.location}
          </span>
        </div>
      )}

      {/* KPI Cards Strip — SIS 2.0 Industrial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {/* KPI 1: Total Stock */}
        <div className="stat-card">
          <div className="label">Total Stock</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val tabular-nums">
              {totalPiecesInStock.toLocaleString('fr-FR')}
            </div>
            <span className="meta uppercase">PIÈCES</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
            <span className="text-[#595959]">Références actives</span>
            <span className="font-mono font-bold text-[#7A5C00]">
              {totalReferencesCount}
            </span>
          </div>
        </div>

        {/* KPI 2: Valeur (Achat) */}
        <div className="stat-card">
          <div className="label">Valeur (Achat)</div>
          <div className="mt-3">
            <div className="stat-val text-3xl sm:text-[2.15rem] tabular-nums">
              {stockPurchaseValue.toLocaleString('fr-FR')}
            </div>
            <div className="meta font-bold uppercase mt-1">
              FCFA
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
            <span className="text-[#595959]">Valeur vente estimée</span>
            <span className="font-mono font-bold text-emerald-700">
              {formatFCFA(stockSaleValue)}
            </span>
          </div>
        </div>

        {/* KPI 3: Ruptures */}
        <div
          onClick={onNavigateToReports}
          className="stat-card cursor-pointer hover:border-[#FFCD11] transition-colors"
        >
          <div className="label text-rose-600">Ruptures</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val text-rose-600 tabular-nums">
              {outOfStockAlerts.length}
            </div>
            <span className="meta text-rose-600/80">RÉF.</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
            <span className="text-[#595959]">Niveau critique</span>
            <span className="text-[#7A5C00] font-mono font-bold text-[11px]">
              À commander
            </span>
          </div>
        </div>

        {/* KPI 4: Sous seuil */}
        <div
          onClick={onNavigateToReports}
          className="stat-card cursor-pointer hover:border-[#FFCD11] transition-colors"
        >
          <div className="label">Sous seuil</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val tabular-nums">
              {lowStockAlerts.length}
            </div>
            <span className="meta">RÉF.</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
            <span className="text-[#595959]">Total des alertes</span>
            <span className="font-mono font-bold text-[#7A5C00]">
              {alerts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Warehouses Summary Grid */}
      <div className="card bg-white border border-[#E0E0E0] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="label">Logistique Multi-Sites</div>
            <h3 className="font-display text-2xl sm:text-[1.75rem] font-semibold text-[#111111] tracking-[-0.02em] leading-tight mt-0.5">
              Répartition du stock par magasin
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {warehouseStats.map((item) => (
            <div
              key={item.warehouse.id}
              className={`p-4 sm:p-5 border transition-colors ${
                selectedWarehouseId === item.warehouse.id
                  ? 'border-[#FFCD11] bg-[#FFF9DF]'
                  : 'border-[#E0E0E0] bg-[#F4F4F4]/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-mono font-bold text-[#7A5C00]">
                    {item.warehouse.code}
                  </span>
                  <h4 className="text-sm font-semibold text-[#111111] mt-0.5">
                    {item.warehouse.name}
                  </h4>
                  <p className="meta mt-0.5">
                    {item.warehouse.location}
                  </p>
                </div>
                <div className="p-2 bg-white border border-[#E0E0E0] text-[#111111]">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E0E0E0] flex items-center justify-between">
                <div>
                  <span className="label block">Pièces en stock</span>
                  <span className="text-lg font-bold font-mono text-[#111111] tabular-nums">
                    {item.pieceCount.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="label block">Valeur d'achat</span>
                  <span className="text-sm font-bold font-mono text-[#7A5C00] tabular-nums">
                    {formatFCFA(item.value)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column Split: Urgent Replenishment & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: RÉAPPROVISIONNEMENT URGENT */}
        <div className="card bg-white border border-[#E0E0E0] p-4 sm:p-6 flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="min-w-0">
              <div className="label text-[#7A5C00]">Priorité critique</div>
              <h2 className="font-display text-xl sm:text-[1.75rem] font-semibold text-[#111111] tracking-[-0.02em] leading-tight mt-0.5">
                Réapprovisionnement urgent
              </h2>
            </div>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-mono font-bold text-[#7A5C00] hover:underline border-0! bg-transparent! p-0! cursor-pointer shrink-0"
            >
              Voir tout ({alerts.length})
            </button>
          </div>

          <div className="flex-1 w-full min-w-0">
            {sortedAlerts.length === 0 ? (
              <div className="text-center py-10 text-[#595959] text-sm">
                Tous les niveaux de stock sont conformes aux seuils minimaux.
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <table className="data-table w-full table-fixed text-xs">
                  <thead>
                    <tr>
                      <SortableTh label="Réf." active={alertSort.field === 'ref'} direction={alertSort.dir} onClick={() => toggleAlertSort('ref')} className="w-[23%]" />
                      <SortableTh label="Désignation" active={alertSort.field === 'designation'} direction={alertSort.dir} onClick={() => toggleAlertSort('designation')} className="w-[31%]" />
                      <SortableTh label="Dispo." active={alertSort.field === 'stock'} direction={alertSort.dir} onClick={() => toggleAlertSort('stock')} align="right" className="w-[16%]" />
                      <SortableTh label="Statut" active={alertSort.field === 'status'} direction={alertSort.dir} onClick={() => toggleAlertSort('status')} align="center" className="w-[18%]" />
                      <th className="text-right py-2.5 px-2 w-12">Opt.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAlerts.map((alert) => {
                      const linkedOrder = getActiveOrderForArticle(alert.articleId);
                      return (
                        <tr key={alert.articleId} className="hover:bg-[#FFFDF2]">
                          <td className="ref truncate" title={alert.mainReference}>
                            <span className="block truncate">{alert.mainReference}</span>
                            <span className="block meta font-normal truncate">
                              {alert.brand}
                            </span>
                          </td>
                          <td className="text-[#111111] font-medium truncate" title={alert.designation}>
                            {alert.designation}
                          </td>
                          <td className="text-right mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                            {alert.currentStock}{' '}
                            <span className="meta font-normal">
                              /{alert.minThreshold}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`font-mono font-bold text-[10px] uppercase tracking-wider ${
                                alert.alertType === 'RUPTURE'
                                  ? 'text-rose-600'
                                  : 'text-[#7A5C00]'
                              }`}
                            >
                              {alert.alertType === 'RUPTURE' ? 'RUPTURE' : 'BAS'}
                            </span>
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <RowActionsMenu
                              actions={[
                                {
                                  label: linkedOrder
                                    ? `Commande ${linkedOrder.orderNumber}`
                                    : 'Ouvrir commande',
                                  icon: <ExternalLink className="w-3.5 h-3.5" />,
                                  tone: 'success',
                                  hidden: !linkedOrder,
                                  onClick: () =>
                                    linkedOrder &&
                                    (onNavigateToPurchaseOrder
                                      ? onNavigateToPurchaseOrder(linkedOrder.id)
                                      : onOpenPurchaseOrder?.(alert.articleId)),
                                },
                                {
                                  label: linkedOrder ? 'Commander à nouveau' : 'Commander cette pièce',
                                  icon: <Truck className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  onClick: () =>
                                    onOpenPurchaseOrder
                                      ? onOpenPurchaseOrder(alert.articleId)
                                      : onOpenStockIn(alert.articleId),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
                <div className="-mx-4 sm:-mx-6 mt-3">
                  <TablePagination
                    currentPage={alertPage}
                    totalItems={sortedAlerts.length}
                    pageSize={alertPageSize}
                    onPageChange={setAlertPage}
                    onPageSizeChange={setAlertPageSize}
                    pageSizeOptions={[6, 10, 20]}
                    itemLabel="alertes"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
            <button
              onClick={() => (onOpenPurchaseOrder ? onOpenPurchaseOrder() : onOpenStockIn())}
              className="cta-btn px-4 py-2 text-xs font-bold text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-[#111111]" />
              <span>Nouvelle Commande Fournisseur</span>
            </button>
          </div>
        </div>

        {/* Right: DERNIERS MOUVEMENTS ENREGISTRÉS */}
        <div className="card bg-white border border-[#E0E0E0] p-4 sm:p-6 flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="min-w-0">
              <div className="label">Journal des flux</div>
              <h2 className="font-display text-xl sm:text-[1.75rem] font-semibold text-[#111111] tracking-[-0.02em] leading-tight mt-0.5">
                Derniers mouvements
              </h2>
            </div>
            <button
              onClick={onNavigateToMovements}
              className="text-xs font-mono font-bold text-[#7A5C00] hover:underline border-0! bg-transparent! p-0! cursor-pointer shrink-0"
            >
              Historique complet
            </button>
          </div>

          <div className="flex-1 w-full min-w-0">
            {sortedDashboardMovements.length === 0 ? (
              <div className="text-center py-10 text-[#595959] text-sm">
                Aucun mouvement enregistré pour le moment.
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <table className="data-table w-full table-fixed text-xs">
                  <thead>
                    <tr>
                      <SortableTh label="Type" active={mvtSort.field === 'type'} direction={mvtSort.dir} onClick={() => toggleMvtSort('type')} className="w-[17%]" />
                      <SortableTh label="Réf. & Pièce" active={mvtSort.field === 'ref'} direction={mvtSort.dir} onClick={() => toggleMvtSort('ref')} className="w-[31%]" />
                      <SortableTh label="Qté" active={mvtSort.field === 'quantity'} direction={mvtSort.dir} onClick={() => toggleMvtSort('quantity')} align="right" className="w-[12%]" />
                      <SortableTh label="Doc." active={mvtSort.field === 'documentRef'} direction={mvtSort.dir} onClick={() => toggleMvtSort('documentRef')} className="hidden sm:table-cell w-[18%]" />
                      <SortableTh label="Date" active={mvtSort.field === 'date'} direction={mvtSort.dir} onClick={() => toggleMvtSort('date')} align="right" className="w-[22%]" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDashboardMovements.map((mvt, idx) => {
                      const art = getArticleById(mvt.articleId);
                      let statusColor = 'text-[#111111]';
                      let label: string = mvt.type;
                      let sign = '+';

                      if (mvt.type === 'ENTREE') {
                        statusColor = 'text-emerald-700';
                        label = 'ENTRÉE';
                        sign = '+';
                      } else if (mvt.type === 'SORTIE') {
                        statusColor = 'text-rose-600';
                        label = 'SORTIE';
                        sign = '-';
                      } else if (mvt.type === 'TRANSFERT') {
                        statusColor = 'text-[#7A5C00]';
                        label = 'TRANSF.';
                        sign = '↔';
                      } else if (mvt.type === 'AJUSTEMENT') {
                        statusColor = 'text-[#7A5C00]';
                        label = 'AJUST.';
                        sign = '±';
                      }

                      return (
                        <tr key={`${mvt.id}-${idx}`} className="hover:bg-[#FFFDF2]">
                          <td>
                            <span className={`font-mono font-bold text-[10px] uppercase tracking-wider ${statusColor}`}>
                              {label}
                            </span>
                          </td>
                          <td>
                            <span className="ref block truncate" title={art?.mainReference || ''}>
                              {art?.mainReference || 'Réf inconnue'}
                            </span>
                            <span className="meta truncate block" title={art?.designation || ''}>
                              {art?.designation || ''}
                            </span>
                          </td>
                          <td className="text-right mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                            {sign}{mvt.quantity}
                          </td>
                          <td className="hidden sm:table-cell meta truncate" title={mvt.documentRef}>
                            {mvt.documentRef}
                          </td>
                          <td className="text-right meta truncate text-[10px]" title={formatDateTime(mvt.date)}>
                            {formatDateTime(mvt.date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
                <div className="-mx-4 sm:-mx-6 mt-3">
                  <TablePagination
                    currentPage={mvtPage}
                    totalItems={sortedDashboardMovements.length}
                    pageSize={mvtPageSize}
                    onPageChange={setMvtPage}
                    onPageSizeChange={setMvtPageSize}
                    pageSizeOptions={[6, 10, 20]}
                    itemLabel="mouvements"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#E0E0E0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#595959]">
            <span>Traçabilité atomique des flux physiques</span>
            <button
              onClick={() => onOpenTransfer()}
              className="text-xs font-mono font-bold text-[#7A5C00] hover:underline border-0! bg-transparent! p-0! cursor-pointer"
            >
              Effectuer un transfert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
