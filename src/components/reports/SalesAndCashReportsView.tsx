import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import {
  TrendingUp,
  Coins,
  Download,
  Building2,
  User,
  CreditCard,
  QrCode,
  Smartphone,
  Banknote,
  AlertTriangle,
  Receipt,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const SalesAndCashReportsView: React.FC = () => {
  const { sales, payments, cashSessions, cashMovements, customers, warehouses } = useStock();

  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Filter sales and payments by period
  const filteredSales = useMemo(() => {
    if (periodFilter === 'ALL') return sales;
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(s.date);
      if (periodFilter === 'TODAY') {
        return d.toDateString() === now.toDateString();
      } else if (periodFilter === 'WEEK') {
        return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (periodFilter === 'MONTH') {
        return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      return true;
    });
  }, [sales, periodFilter]);

  // Overall KPIs
  const totalRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredSales]);

  const totalCostOfGoods = useMemo(() => {
    return filteredSales
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((sum, s) => sum + s.totalCost, 0);
  }, [filteredSales]);

  const grossMargin = totalRevenue - totalCostOfGoods;
  const marginPercent = totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100).toFixed(1) : '0';

  const totalCollected = useMemo(() => {
    return filteredSales
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((sum, s) => sum + s.totalPaid, 0);
  }, [filteredSales]);

  const totalUnpaidReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  }, [customers]);

  const totalCashExpenses = useMemo(() => {
    return cashMovements
      .filter((m) => m.type === 'DEPENSE')
      .reduce((sum, m) => sum + m.amount, 0);
  }, [cashMovements]);

  // Breakdown by payment tender method
  const collectionByMethod = useMemo(() => {
    const stats: Record<string, number> = {
      ESPECES: 0,
      WAVE: 0,
      ORANGE_MONEY: 0,
      VIREMENT: 0,
      CARTE: 0,
    };
    payments.forEach((p) => {
      if (stats[p.method] !== undefined) {
        stats[p.method] += p.amount;
      }
    });
    return stats;
  }, [payments]);

  // Breakdown by warehouse
  const salesByWarehouse = useMemo(() => {
    return warehouses.map((wh) => {
      const whSales = filteredSales.filter(
        (s) => s.warehouseId === wh.id && s.status !== 'CANCELLED'
      );
      const count = whSales.length;
      const revenue = whSales.reduce((sum, s) => sum + s.totalAmount, 0);
      const collected = whSales.reduce((sum, s) => sum + s.totalPaid, 0);
      return {
        warehouse: wh,
        count,
        revenue,
        collected,
      };
    });
  }, [warehouses, filteredSales]);

  // Top selling articles
  const topSellingArticles = useMemo(() => {
    const map = new Map<string, { ref: string; desig: string; brand: string; qty: number; totalRev: number }>();

    filteredSales
      .filter((s) => s.status !== 'CANCELLED')
      .forEach((s) => {
        s.items.forEach((it) => {
          const prev = map.get(it.articleId) || {
            ref: it.mainReference,
            desig: it.designation,
            brand: it.brand,
            qty: 0,
            totalRev: 0,
          };
          map.set(it.articleId, {
            ...prev,
            qty: prev.qty + it.quantity,
            totalRev: prev.totalRev + it.totalLine,
          });
        });
      });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [filteredSales]);

  const handleExportSalesPerformanceCSV = () => {
    const headers = [
      'Magasin',
      'Nombre de Ventes',
      'Chiffre d’Affaires (FCFA)',
      'Total Encaissé (FCFA)',
      'Taux d’Encaissement',
    ];

    const rows = salesByWarehouse.map((w) => [
      w.warehouse.name,
      w.count,
      w.revenue,
      w.collected,
      w.revenue > 0 ? `${Math.round((w.collected / w.revenue) * 100)}%` : 'N/A',
    ]);

    exportToCSV(`rapport_ventes_magasins_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Period Filter & Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            Rapports d'Activité Commerciale & Caisse
          </h2>
          <p className="text-xs text-slate-500">
            Distingue rigoureusement Chiffre d'Affaires, Encaissements Réels, Créances et Espèces
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setPeriodFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium ${
                periodFilter === 'ALL' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600'
              }`}
            >
              Tout
            </button>
            <button
              onClick={() => setPeriodFilter('TODAY')}
              className={`px-2.5 py-1 rounded font-medium ${
                periodFilter === 'TODAY' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setPeriodFilter('WEEK')}
              className={`px-2.5 py-1 rounded font-medium ${
                periodFilter === 'WEEK' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600'
              }`}
            >
              7 jours
            </button>
            <button
              onClick={() => setPeriodFilter('MONTH')}
              className={`px-2.5 py-1 rounded font-medium ${
                periodFilter === 'MONTH' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600'
              }`}
            >
              30 jours
            </button>
          </div>

          <button
            onClick={handleExportSalesPerformanceCSV}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Rapport
          </button>
        </div>
      </div>

      {/* 4 Essential Distinct Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Chiffre d'Affaires */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            1. Chiffre d'Affaires (CA Ventes)
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums block">
              {formatFCFA(totalRevenue)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
            <span>Marge commerciale brute</span>
            <span className="font-mono font-bold text-emerald-700">
              {formatFCFA(grossMargin)} ({marginPercent}%)
            </span>
          </div>
        </div>

        {/* KPI 2: Encaissements Réels */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            2. Encaissements Réels Reçus
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums block">
              {formatFCFA(totalCollected)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
            <span>Règlements effectifs</span>
            <span className="font-medium text-slate-700">Comptant & Digital</span>
          </div>
        </div>

        {/* KPI 3: Créances Clients Restantes */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            3. Créances Clients en Cours
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-rose-600 tabular-nums block">
              {formatFCFA(totalUnpaidReceivables)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
            <span>Ventes à crédit non soldées</span>
            <span className="font-medium text-rose-600">À recouvrer</span>
          </div>
        </div>

        {/* KPI 4: Dépenses & Sorties de Caisse */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            4. Dépenses de Caisse Enregistrées
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-amber-700 tabular-nums block">
              {formatFCFA(totalCashExpenses)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
            <span>Frais & Petite caisse</span>
            <span className="font-medium text-slate-600">Tracabilité</span>
          </div>
        </div>
      </div>

      {/* Collection by Payment Tender Method Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          Répartition des encaissements par canal de paiement
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Espèces (Tiroir)
            </div>
            <div className="mt-2 font-mono font-bold text-sm text-slate-900">
              {formatFCFA(collectionByMethod.ESPECES)}
            </div>
          </div>

          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-semibold text-sky-900">
              <QrCode className="w-3.5 h-3.5 text-sky-600" />
              Wave
            </div>
            <div className="mt-2 font-mono font-bold text-sm text-sky-900">
              {formatFCFA(collectionByMethod.WAVE)}
            </div>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-semibold text-orange-900">
              <Smartphone className="w-3.5 h-3.5 text-orange-600" />
              Orange Money
            </div>
            <div className="mt-2 font-mono font-bold text-sm text-orange-900">
              {formatFCFA(collectionByMethod.ORANGE_MONEY)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              Virements
            </div>
            <div className="mt-2 font-mono font-bold text-sm text-slate-900">
              {formatFCFA(collectionByMethod.VIREMENT)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <CreditCard className="w-3.5 h-3.5 text-slate-600" />
              Cartes
            </div>
            <div className="mt-2 font-mono font-bold text-sm text-slate-900">
              {formatFCFA(collectionByMethod.CARTE)}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Split: Sales by Warehouse & Top Selling Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Performance by warehouse */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Performance commerciale par entrepôt
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-400 uppercase">
                <tr>
                  <th className="py-2">Magasin</th>
                  <th className="py-2 text-center">Ventes</th>
                  <th className="py-2 text-right">CA (FCFA)</th>
                  <th className="py-2 text-right">Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesByWarehouse.map((w) => (
                  <tr key={w.warehouse.id}>
                    <td className="py-2.5 font-semibold text-slate-800">
                      {w.warehouse.name}
                      <span className="block text-[10px] font-mono text-slate-400">
                        {w.warehouse.code}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold text-slate-700">
                      {w.count}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                      {formatFCFA(w.revenue)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-700 font-bold">
                      {formatFCFA(w.collected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Selling Parts */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Pièces détachées les plus vendues
          </h3>
          <div className="overflow-x-auto">
            {topSellingArticles.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Aucune vente enregistrée sur cette période.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-400 uppercase">
                  <tr>
                    <th className="py-2">Réf. Constructeur</th>
                    <th className="py-2">Désignation</th>
                    <th className="py-2 text-right">Qté Vendue</th>
                    <th className="py-2 text-right">Total CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topSellingArticles.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 font-mono font-bold text-slate-900">
                        {it.ref}
                        <span className="block text-[10px] font-sans text-slate-400 font-normal">
                          {it.brand}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-700 max-w-[160px] truncate">
                        {it.desig}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {it.qty}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatFCFA(it.totalRev)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
