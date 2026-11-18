import React from 'react';
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

  // Recent 6 movements
  const recentMovements = movements.slice(0, 6);

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
        <div className="card p-6 bg-white border border-[#E5E5E5] rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="label text-[#E35E2D] opacity-100">
              SYSTÈME OPÉRATIONNEL · EXPLOITATION
            </div>
            <h3 className="font-display text-2xl font-bold text-[#1B1B1B] tracking-[-0.04em]">
              Bienvenue dans votre espace {companyInfo?.name || 'WKRLI'}
            </h3>
            <p className="text-xs text-[#1B1B1B]/70 leading-relaxed">
              Votre base de données est vierge et prête à recevoir votre inventaire réel. Créez vos premières références manuellement ou importez votre catalogue Excel / CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onNavigateToCatalog}
              className="cta-btn px-4 py-2.5 bg-[#1B1B1B] hover:bg-[#E35E2D] text-white text-xs font-semibold rounded transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Boxes className="w-4 h-4 text-white" />
              <span>Ajouter une pièce</span>
            </button>
            {onNavigateToImport && (
              <button
                onClick={onNavigateToImport}
                className="px-3.5 py-2.5 bg-white hover:border-[#E35E2D] text-[#1B1B1B] text-xs font-semibold border border-[#E5E5E5] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#E35E2D]" />
                <span>Importer Excel / CSV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner if warehouse is filtered */}
      {selectedWhObj && (
        <div className="flex items-center justify-between p-3.5 bg-white border border-[#E5E5E5] border-l-4 border-l-[#E35E2D] rounded-lg text-[#1B1B1B] text-sm">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-[#E35E2D] shrink-0" />
            <span>
              FILTRE MAGASIN ACTIF : <strong className="text-[#E35E2D]">{selectedWhObj.name}</strong> ({selectedWhObj.code})
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-[#1B1B1B]/60">
            {selectedWhObj.location}
          </span>
        </div>
      )}

      {/* KPI Cards Strip — Variation 19 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Total Stock */}
        <div className="stat-card">
          <div className="label">Total Stock</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val tabular-nums">
              {totalPiecesInStock.toLocaleString('fr-FR')}
            </div>
            <span className="meta uppercase">PIÈCES</span>
          </div>
          <div className="mt-4 pt-2.5 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
            <span className="text-[#1B1B1B]/60">Références actives</span>
            <span className="font-mono font-semibold text-[#E35E2D]">
              {totalReferencesCount}
            </span>
          </div>
        </div>

        {/* KPI 2: Valeur (Achat) */}
        <div className="stat-card">
          <div className="label">Valeur (Achat)</div>
          <div className="mt-3">
            <div className="stat-val text-2xl sm:text-3xl tabular-nums">
              {stockPurchaseValue.toLocaleString('fr-FR')}
            </div>
            <div className="meta font-bold uppercase mt-1">
              FCFA
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
            <span className="text-[#1B1B1B]/60">Valeur vente estimée</span>
            <span className="font-mono font-semibold text-emerald-600">
              {formatFCFA(stockSaleValue)}
            </span>
          </div>
        </div>

        {/* KPI 3: Ruptures */}
        <div
          onClick={onNavigateToReports}
          className="stat-card cursor-pointer hover:border-[#E35E2D] transition-colors"
        >
          <div className="label text-rose-600 opacity-100">Ruptures</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val text-rose-600 tabular-nums">
              {outOfStockAlerts.length}
            </div>
            <span className="meta text-rose-600/80">RÉF.</span>
          </div>
          <div className="mt-4 pt-2.5 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
            <span className="text-[#1B1B1B]/60">Niveau critique</span>
            <span className="text-[#E35E2D] font-semibold text-[11px]">
              Urgent à commander
            </span>
          </div>
        </div>

        {/* KPI 4: Sous seuil */}
        <div
          onClick={onNavigateToReports}
          className="stat-card cursor-pointer hover:border-[#E35E2D] transition-colors"
        >
          <div className="label">Sous seuil</div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="stat-val tabular-nums">
              {lowStockAlerts.length}
            </div>
            <span className="meta">RÉF.</span>
          </div>
          <div className="mt-4 pt-2.5 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
            <span className="text-[#1B1B1B]/60">Total des alertes</span>
            <span className="font-mono font-semibold text-[#E35E2D]">
              {alerts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Warehouses Summary Grid */}
      <div className="card bg-white border border-[#E5E5E5] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">Logistique Multi-Sites</div>
            <h3 className="font-display text-xl font-bold text-[#1B1B1B] tracking-[-0.04em] mt-0.5">
              Répartition du stock par magasin
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouseStats.map((item) => (
            <div
              key={item.warehouse.id}
              className={`p-4 border rounded-lg transition-colors ${
                selectedWarehouseId === item.warehouse.id
                  ? 'border-[#E35E2D] bg-[#F9FAFB]'
                  : 'border-[#E5E5E5] bg-[#F9FAFB]/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-[#E35E2D]">
                    {item.warehouse.code}
                  </span>
                  <h4 className="text-sm font-semibold text-[#1B1B1B] mt-0.5">
                    {item.warehouse.name}
                  </h4>
                  <p className="meta mt-0.5">
                    {item.warehouse.location}
                  </p>
                </div>
                <div className="p-2 bg-white border border-[#E5E5E5] rounded text-[#E35E2D]">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
                <div>
                  <span className="label block">Pièces en stock</span>
                  <span className="text-lg font-bold font-mono text-[#1B1B1B] tabular-nums">
                    {item.pieceCount.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="label block">Valeur d'achat</span>
                  <span className="text-sm font-semibold font-mono text-[#E35E2D] tabular-nums">
                    {formatFCFA(item.value)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column Split: Urgent Replenishment & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: RÉAPPROVISIONNEMENT URGENT */}
        <div className="card bg-white border border-[#E5E5E5] rounded-lg p-6 flex flex-col">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="label text-[#E35E2D] opacity-100">Priorité critique</div>
              <h2 className="font-display text-xl font-bold text-[#1B1B1B] tracking-[-0.04em] mt-0.5">
                Réapprovisionnement urgent
              </h2>
            </div>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-semibold text-[#E35E2D] hover:underline border-0! bg-transparent! p-0! cursor-pointer"
            >
              Voir tout ({alerts.length})
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-10 text-[#1B1B1B]/40 text-sm">
                Tous les niveaux de stock sont conformes aux seuils minimaux.
              </div>
            ) : (
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="text-right">Disponibilité</th>
                    <th className="text-center">Statut</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 6).map((alert) => (
                    <tr key={alert.articleId} className="hover:bg-[#F9FAFB]">
                      <td className="ref">
                        {alert.mainReference}
                        <span className="block meta font-normal">
                          {alert.brand}
                        </span>
                      </td>
                      <td className="text-[#1B1B1B] font-medium truncate max-w-[180px]">
                        {alert.designation}
                      </td>
                      <td className="text-right mono font-semibold text-[#1B1B1B] tabular-nums">
                        {alert.currentStock}{' '}
                        <span className="meta font-normal">
                          / {alert.minThreshold}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`font-mono font-semibold text-[10px] uppercase tracking-wider ${
                            alert.alertType === 'RUPTURE'
                              ? 'text-rose-600'
                              : 'text-[#E35E2D]'
                          }`}
                        >
                          {alert.alertType === 'RUPTURE' ? 'RUPTURE' : 'SOUS SEUIL'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {(() => {
                          const linkedOrder = getActiveOrderForArticle(alert.articleId);
                          if (linkedOrder) {
                            return (
                              <div className="inline-flex items-center justify-end gap-1">
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Commandé
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateToPurchaseOrder
                                      ? onNavigateToPurchaseOrder(linkedOrder.id)
                                      : onOpenPurchaseOrder?.(alert.articleId)
                                  }
                                  className="px-2 py-0.5 bg-white hover:border-[#E35E2D] text-[#1B1B1B] border border-[#E5E5E5] rounded font-mono font-semibold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                  title={`Voir la liste de commande ${linkedOrder.orderNumber}`}
                                >
                                  <span>{linkedOrder.orderNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPurchaseOrder
                                      ? onOpenPurchaseOrder(alert.articleId)
                                      : onOpenStockIn(alert.articleId)
                                  }
                                  className="p-0.5 bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded text-[#1B1B1B] cursor-pointer"
                                  title="Ajouter sur une autre liste"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() =>
                                onOpenPurchaseOrder
                                  ? onOpenPurchaseOrder(alert.articleId)
                                  : onOpenStockIn(alert.articleId)
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#1B1B1B] bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Commander cette pièce"
                            >
                              <Truck className="w-3 h-3 text-[#E35E2D]" />
                              <span>Commander</span>
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
            <button
              onClick={() => (onOpenPurchaseOrder ? onOpenPurchaseOrder() : onOpenStockIn())}
              className="cta-btn px-4 py-2 text-xs font-semibold text-white bg-[#1B1B1B] hover:bg-[#E35E2D] rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-white" />
              <span>Nouvelle Commande Fournisseur</span>
            </button>
          </div>
        </div>

        {/* Right: DERNIERS MOUVEMENTS ENREGISTRÉS */}
        <div className="card bg-white border border-[#E5E5E5] rounded-lg p-6 flex flex-col">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="label">Journal temps réel</div>
              <h2 className="font-display text-xl font-bold text-[#1B1B1B] tracking-[-0.04em] mt-0.5">
                Derniers mouvements
              </h2>
            </div>
            <button
              onClick={onNavigateToMovements}
              className="text-xs font-semibold text-[#E35E2D] hover:underline border-0! bg-transparent! p-0! cursor-pointer"
            >
              Historique complet
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentMovements.length === 0 ? (
              <div className="text-center py-10 text-[#1B1B1B]/40 text-sm">
                Aucun mouvement enregistré pour le moment.
              </div>
            ) : (
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Réf. & Pièce</th>
                    <th className="text-right">Quantité</th>
                    <th>Document</th>
                    <th className="text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((mvt, idx) => {
                    const art = getArticleById(mvt.articleId);
                    let statusColor = 'text-[#1B1B1B]';
                    let label: string = mvt.type;
                    let sign = '+';

                    if (mvt.type === 'ENTREE') {
                      statusColor = 'text-emerald-600';
                      label = 'ENTRÉE';
                      sign = '+';
                    } else if (mvt.type === 'SORTIE') {
                      statusColor = 'text-rose-600';
                      label = 'SORTIE';
                      sign = '-';
                    } else if (mvt.type === 'TRANSFERT') {
                      statusColor = 'text-[#E35E2D]';
                      label = 'TRANSFERT';
                      sign = '↔';
                    } else if (mvt.type === 'AJUSTEMENT') {
                      statusColor = 'text-[#E35E2D]';
                      label = 'AJUSTEMENT';
                      sign = '±';
                    }

                    return (
                      <tr key={`${mvt.id}-${idx}`} className="hover:bg-[#F9FAFB]">
                        <td>
                          <span className={`font-mono font-semibold text-[10px] uppercase tracking-wider ${statusColor}`}>
                            {label}
                          </span>
                        </td>
                        <td>
                          <span className="ref block">
                            {art?.mainReference || 'Réf inconnue'}
                          </span>
                          <span className="meta truncate block max-w-[140px]">
                            {art?.designation || ''}
                          </span>
                        </td>
                        <td className="text-right mono font-semibold text-[#1B1B1B] tabular-nums">
                          {sign} {mvt.quantity}
                        </td>
                        <td className="meta truncate max-w-[110px]">
                          {mvt.documentRef}
                        </td>
                        <td className="text-right meta whitespace-nowrap">
                          {formatDateTime(mvt.date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-between text-xs text-[#1B1B1B]/50">
            <span>Traçabilité atomique des flux physiques</span>
            <button
              onClick={() => onOpenTransfer()}
              className="text-xs font-semibold text-[#E35E2D] hover:underline border-0! bg-transparent! p-0! cursor-pointer"
            >
              Effectuer un transfert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
