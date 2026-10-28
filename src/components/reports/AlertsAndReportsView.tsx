import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import {
  AlertTriangle,
  AlertCircle,
  Download,
  Building2,
  TrendingDown,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
} from 'lucide-react';

interface AlertsAndReportsViewProps {
  onOpenStockIn: (articleId?: string) => void;
}

export const AlertsAndReportsView: React.FC<AlertsAndReportsViewProps> = ({ onOpenStockIn }) => {
  const {
    articles,
    warehouses,
    stocks,
    movements,
    inventories,
    getAlerts,
    getStockValueTotal,
    getSaleValueTotal,
    getStockForArticleAndWarehouse,
  } = useStock();

  const [activeReportTab, setActiveReportTab] = useState<'ALERTS' | 'VALUATION' | 'MOVEMENTS_STATS' | 'INVENTORY_VARIANCES'>('ALERTS');

  const alerts = getAlerts();
  const outOfStock = alerts.filter((a) => a.alertType === 'RUPTURE');
  const lowStock = alerts.filter((a) => a.alertType === 'SOUS_SEUIL');

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

    // Inbound & Outbound count for this wh
    const inMovements = movements.filter((m) => m.type === 'ENTREE' && m.targetWarehouseId === wh.id);
    const outMovements = movements.filter((m) => m.type === 'SORTIE' && m.sourceWarehouseId === wh.id);
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

  // Export alerts
  const handleExportAlertsCSV = () => {
    const headers = [
      'Type Alerte',
      'Réf Constructeur',
      'Marque',
      'Désignation',
      'Catégorie',
      'Stock Total',
      'Seuil Minimal',
      'Déficit',
      'Disponibilités par Magasin',
    ];

    const rows = alerts.map((a) => [
      a.alertType === 'RUPTURE' ? 'Rupture' : 'Sous Seuil',
      a.mainReference,
      a.brand,
      a.designation,
      a.category,
      a.currentStock,
      a.minThreshold,
      a.deficit,
      a.warehousesWithStock.map((w) => `${w.warehouseName}: ${w.qty}`).join(' | '),
    ]);

    exportToCSV(`rapport_alertes_stock_${new Date().toISOString().slice(0, 10)}`, headers, rows);
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

    exportToCSV(`rapport_valorisation_magasins_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveReportTab('ALERTS')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeReportTab === 'ALERTS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertes de Stock ({alerts.length})
          </button>
          <button
            onClick={() => setActiveReportTab('VALUATION')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeReportTab === 'VALUATION'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Valorisation par Magasin
          </button>
          <button
            onClick={() => setActiveReportTab('MOVEMENTS_STATS')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeReportTab === 'MOVEMENTS_STATS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Flux Entrées / Sorties
          </button>
        </div>

        {activeReportTab === 'ALERTS' && (
          <button
            onClick={handleExportAlertsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter les alertes CSV
          </button>
        )}

        {activeReportTab === 'VALUATION' && (
          <button
            onClick={handleExportValuationCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter la valorisation CSV
          </button>
        )}
      </div>

      {/* TAB 1: ALERTS */}
      {activeReportTab === 'ALERTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-rose-900">
                  Ruptures totales ({outOfStock.length})
                </h3>
              </div>
              <p className="text-xs text-rose-700 mt-1">
                Articles pour lesquels aucun magasin ne dispose de stock physique.
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">
                  Sous le seuil minimal ({lowStock.length})
                </h3>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                Articles dont la quantité totale en stock est inférieure ou égale au seuil de sécurité.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Réf. Constructeur</th>
                    <th className="py-3 px-3">Désignation</th>
                    <th className="py-3 px-3">Marque</th>
                    <th className="py-3 px-3 text-right">Stock Global</th>
                    <th className="py-3 px-3 text-right">Seuil Minimal</th>
                    <th className="py-3 px-3 text-right">Quantité à commander</th>
                    <th className="py-3 px-3">Détail par Magasin</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.map((alert) => (
                    <tr key={alert.articleId} className="hover:bg-slate-50">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            alert.alertType === 'RUPTURE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {alert.alertType === 'RUPTURE' ? 'Rupture' : 'Sous Seuil'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {alert.mainReference}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-800 max-w-xs truncate">
                        {alert.designation}
                      </td>

                      <td className="py-3 px-3 text-slate-600">{alert.brand}</td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {alert.currentStock}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums">
                        {alert.minThreshold}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 tabular-nums">
                        +{alert.deficit}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {alert.warehousesWithStock.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {alert.warehousesWithStock.map((w, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded"
                              >
                                {w.warehouseName}: <strong>{w.qty}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-rose-500 font-semibold text-[11px]">
                            Aucun magasin approvisionné
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenStockIn(alert.articleId)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 inline-flex items-center gap-1"
                        >
                          <ArrowDownLeft className="w-3 h-3" />
                          Réapprovisionner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VALUATION */}
      {activeReportTab === 'VALUATION' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 font-semibold uppercase block">
                Valeur Totale d'Achat
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
              <p className="text-xs text-slate-500 mt-1">Chiffre d'affaires potentiel</p>
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
              <h3 className="text-sm font-bold text-slate-900">
                Synthèse valorisée par entrepôt
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-3">Code & Magasin</th>
                    <th className="py-3 px-3">Localisation</th>
                    <th className="py-3 px-3 text-right">Quantité Pièces</th>
                    <th className="py-3 px-3 text-right">Valeur Achat (FCFA)</th>
                    <th className="py-3 px-3 text-right">Valeur Vente (FCFA)</th>
                    <th className="py-3 px-3 text-right">Marge Brute</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warehouseStats.map((item) => (
                    <tr key={item.warehouse.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {item.warehouse.name}
                        <span className="block font-mono text-[10px] text-slate-400">
                          {item.warehouse.code}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{item.warehouse.location}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {item.pieceCount.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatFCFA(item.purchaseVal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatFCFA(item.saleVal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                        {formatFCFA(item.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MOVEMENTS STATS */}
      {activeReportTab === 'MOVEMENTS_STATS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">
              Flux quantitatifs d'entrées et de sorties par site
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Volume cumulé des réceptions et livraisons enregistrées
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3">Magasin</th>
                  <th className="py-3 px-3 text-right">Volume Reçu (Entrées)</th>
                  <th className="py-3 px-3 text-right">Volume Livré (Sorties)</th>
                  <th className="py-3 px-3 text-right">Ratio Flux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseStats.map((item) => (
                  <tr key={item.warehouse.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {item.warehouse.name} ({item.warehouse.code})
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      +{item.inQty} pièces
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                      -{item.outQty} pièces
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                      {item.outQty > 0 ? (item.inQty / item.outQty).toFixed(2) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
