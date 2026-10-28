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
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToCatalog: () => void;
  onNavigateToMovements: () => void;
  onNavigateToReports: () => void;
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenTransfer: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToCatalog,
  onNavigateToMovements,
  onNavigateToReports,
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
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
    resetToDemoData,
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
      {/* Table Rase Welcome Banner when database is clean/empty */}
      {articles.length === 0 && (
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Table Rase active — Base de données 100% vierge
            </div>
            <h3 className="text-lg font-bold text-white">
              Prêt pour démarrer votre gestion de stock en production
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Toutes les anciennes données ont été réinitialisées. Vous pouvez dès à présent ajouter vos pièces réelles, importer votre fichier Excel / CSV ou configurer vos magasins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onNavigateToCatalog}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4" />
              <span>Ajouter une pièce</span>
            </button>
            <button
              onClick={() => resetToDemoData()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Charger un jeu d'essai (CAT, Komatsu, Donaldson...)"
            >
              <span>Charger démo d'essai</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Banner if warehouse is filtered */}
      {selectedWhObj && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Filtre actif : données affichées pour l'entrepôt <strong>{selectedWhObj.name}</strong> ({selectedWhObj.code}).
            </span>
          </div>
          <span className="text-xs text-amber-800 font-medium">{selectedWhObj.location}</span>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: References & Pieces */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Stock Physique Total
            </span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {totalPiecesInStock.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs text-slate-500">pièces</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Références actives</span>
            <span className="font-semibold font-mono text-slate-900">{totalReferencesCount}</span>
          </div>
        </div>

        {/* KPI 2: Stock Value (Purchase & Sale) */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Valeur du Stock (Achat)
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {formatFCFA(stockPurchaseValue)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Valeur de vente estimée</span>
            <span className="font-semibold font-mono text-emerald-700">{formatFCFA(stockSaleValue)}</span>
          </div>
        </div>

        {/* KPI 3: Out of stock */}
        <div
          onClick={onNavigateToReports}
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs cursor-pointer hover:border-rose-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ruptures de Stock
            </span>
            <div
              className={`p-2 rounded-lg ${
                outOfStockAlerts.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                outOfStockAlerts.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {outOfStockAlerts.length}
            </span>
            <span className="text-xs text-slate-500">référence(s)</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Niveau critique</span>
            <span className="text-rose-600 font-semibold">Urgent à commander</span>
          </div>
        </div>

        {/* KPI 4: Under minimum threshold */}
        <div
          onClick={onNavigateToReports}
          className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sous le Seuil d'Alerte
            </span>
            <div
              className={`p-2 rounded-lg ${
                lowStockAlerts.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                lowStockAlerts.length > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {lowStockAlerts.length}
            </span>
            <span className="text-xs text-slate-500">référence(s)</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Total des alertes</span>
            <span className="font-semibold font-mono text-slate-900">{alerts.length}</span>
          </div>
        </div>
      </div>

      {/* Warehouses Summary Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Répartition du stock par magasin
            </h3>
            <p className="text-xs text-slate-500">
              État quantitatif et valorisation par site de stockage au Sénégal
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouseStats.map((item) => (
            <div
              key={item.warehouse.id}
              className={`p-4 rounded-lg border transition-colors ${
                selectedWarehouseId === item.warehouse.id
                  ? 'border-amber-500 bg-amber-50/30'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {item.warehouse.code}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                    {item.warehouse.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">{item.warehouse.location}</p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Pièces en stock</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {item.pieceCount.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Valeur d'achat</span>
                  <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                    {formatFCFA(item.value)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column Split: Stock Alerts & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Stock Alerts list */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Pièces nécessitant un réapprovisionnement
              </h3>
              <p className="text-xs text-slate-500">
                Articles en rupture ou inférieurs au seuil de sécurité
              </p>
            </div>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Voir tout ({alerts.length})
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Tous les niveaux de stock sont conformes aux seuils minimaux.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Réf. Constructeur</th>
                    <th className="py-2.5 px-2">Désignation</th>
                    <th className="py-2.5 px-2 text-right">Dispo</th>
                    <th className="py-2.5 px-2 text-right">Seuil</th>
                    <th className="py-2.5 px-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.slice(0, 5).map((alert) => (
                    <tr key={alert.articleId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-2 font-mono font-semibold text-slate-900">
                        {alert.mainReference}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {alert.brand}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-800 font-medium truncate max-w-[180px]">
                        {alert.designation}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {alert.currentStock}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500 tabular-nums">
                        {alert.minThreshold}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            alert.alertType === 'RUPTURE'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {alert.alertType === 'RUPTURE' ? 'Rupture' : 'Sous Seuil'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onOpenStockIn}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Saisir une entrée de stock
            </button>
          </div>
        </div>

        {/* Right: Latest Stock Movements */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Derniers mouvements enregistrés
              </h3>
              <p className="text-xs text-slate-500">
                Traçabilité en temps réel des opérations de stock
              </p>
            </div>
            <button
              onClick={onNavigateToMovements}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Historique complet
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentMovements.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Aucun mouvement enregistré pour le moment.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2">Réf. & Pièce</th>
                    <th className="py-2.5 px-2 text-right">Quantité</th>
                    <th className="py-2.5 px-2">Document</th>
                    <th className="py-2.5 px-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentMovements.map((mvt, idx) => {
                    const art = getArticleById(mvt.articleId);
                    let badgeClass = 'bg-slate-100 text-slate-700';
                    let label: string = mvt.type;
                    let sign = '+';

                    if (mvt.type === 'ENTREE') {
                      badgeClass = 'bg-emerald-100 text-emerald-800';
                      label = 'Entrée';
                      sign = '+';
                    } else if (mvt.type === 'SORTIE') {
                      badgeClass = 'bg-rose-100 text-rose-800';
                      label = 'Sortie';
                      sign = '-';
                    } else if (mvt.type === 'TRANSFERT') {
                      badgeClass = 'bg-blue-100 text-blue-800';
                      label = 'Transfert';
                      sign = '↔';
                    } else if (mvt.type === 'AJUSTEMENT') {
                      badgeClass = 'bg-amber-100 text-amber-800';
                      label = 'Ajustement';
                      sign = '±';
                    }

                    return (
                      <tr key={`${mvt.id}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-mono font-semibold text-slate-900 block">
                            {art?.mainReference || 'Réf inconnue'}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate block max-w-[140px]">
                            {art?.designation || ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {sign} {mvt.quantity}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600 truncate max-w-[110px]">
                          {mvt.documentRef}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDateTime(mvt.date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Règle : Tout mouvement impacte le stock de façon atomique</span>
            <button
              onClick={onOpenTransfer}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Effectuer un transfert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
