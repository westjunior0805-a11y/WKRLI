import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Sale, CashMovement, PaymentRecord, Customer } from '../../types';
import { formatFCFA, formatDate, formatDateTime } from '../../utils/formatters';
import { getCustomerCreditSummary } from '../../utils/customerAccount';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import { ReceiptModal } from '../sales/ReceiptModal';
import { PaymentReceiptModal } from '../customers/PaymentReceiptModal';
import { TablePagination, SortableTh, usePagination } from '../common/TablePagination';
import {
  TrendingUp,
  Calendar,
  Download,
  Building2,
  CreditCard,
  QrCode,
  Smartphone,
  Banknote,
  Receipt,
  Check,
  Copy,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Coins,
  X,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react';

// Helpers to get local date strings YYYY-MM-DD
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function formatFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}

type PeriodMode = 'YESTERDAY' | 'TODAY' | 'SINGLE_DATE' | 'DATE_RANGE' | 'WEEK' | 'MONTH' | 'ALL';
type ActiveTab = 'DAILY_BOSS_REPORT' | 'FINANCIAL_ANALYTICS';

export const SalesAndCashReportsView: React.FC = () => {
  const { sales, payments, cashMovements, customers, warehouses, companyInfo } = useStock();

  // Active top-level subtab
  const [activeTab, setActiveTab] = useState<ActiveTab>('DAILY_BOSS_REPORT');

  // Filter mode for transactions & boss report
  const [periodMode, setPeriodMode] = useState<PeriodMode>('YESTERDAY');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(getYesterdayDateString());
  const [startDate, setStartDate] = useState<string>(getYesterdayDateString());
  const [endDate, setEndDate] = useState<string>(getYesterdayDateString());
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL');

  // Smartphone Modal & Export state
  const [isSmartphoneModalOpen, setIsSmartphoneModalOpen] = useState<boolean>(false);

  // Receipt Modal preview
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [activeCustomerPaymentReceipt, setActiveCustomerPaymentReceipt] = useState<{
    payment: PaymentRecord;
    customer: Customer | null;
  } | null>(null);

  // Table sort states (all 4 report tables)
  const [dailySaleSort, setDailySaleSort] = useState<{
    field: 'date' | 'receiptNumber' | 'customerName' | 'items' | 'totalAmount' | 'status';
    dir: 'asc' | 'desc';
  }>({ field: 'date', dir: 'desc' });
  const [custPaySort, setCustPaySort] = useState<{
    field: 'date' | 'reference' | 'customerName' | 'type' | 'method' | 'amount';
    dir: 'asc' | 'desc';
  }>({ field: 'date', dir: 'desc' });
  const [whPerfSort, setWhPerfSort] = useState<{
    field: 'name' | 'count' | 'revenue' | 'collected';
    dir: 'asc' | 'desc';
  }>({ field: 'revenue', dir: 'desc' });
  const [topPartSort, setTopPartSort] = useState<{
    field: 'ref' | 'desig' | 'qty' | 'totalRev';
    dir: 'asc' | 'desc';
  }>({ field: 'qty', dir: 'desc' });

  const toggleDailySaleSort = (field: typeof dailySaleSort.field) =>
    setDailySaleSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'date' || field === 'totalAmount' ? 'desc' : 'asc' }
    );
  const toggleCustPaySort = (field: typeof custPaySort.field) =>
    setCustPaySort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'date' || field === 'amount' ? 'desc' : 'asc' }
    );
  const toggleWhPerfSort = (field: typeof whPerfSort.field) =>
    setWhPerfSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'name' ? 'asc' : 'desc' }
    );
  const toggleTopPartSort = (field: typeof topPartSort.field) =>
    setTopPartSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'ref' || field === 'desig' ? 'asc' : 'desc' }
    );

  // Quick navigation day by day
  const handleShiftSingleDate = (days: number) => {
    try {
      const [y, m, d] = selectedSingleDate.split('-').map(Number);
      const curr = new Date(y, m - 1, d);
      curr.setDate(curr.getDate() + days);
      setSelectedSingleDate(getLocalDateString(curr));
      setPeriodMode('SINGLE_DATE');
    } catch {
      // ignore
    }
  };

  // Determine current effective date range [effectiveStart, effectiveEnd]
  const { effectiveStart, effectiveEnd, periodLabel } = useMemo(() => {
    const todayStr = getLocalDateString();
    const yesterdayStr = getYesterdayDateString();

    if (periodMode === 'YESTERDAY') {
      return {
        effectiveStart: yesterdayStr,
        effectiveEnd: yesterdayStr,
        periodLabel: `Hier (${formatFrenchDate(yesterdayStr)})`,
      };
    } else if (periodMode === 'TODAY') {
      return {
        effectiveStart: todayStr,
        effectiveEnd: todayStr,
        periodLabel: `Aujourd'hui (${formatFrenchDate(todayStr)})`,
      };
    } else if (periodMode === 'SINGLE_DATE') {
      return {
        effectiveStart: selectedSingleDate,
        effectiveEnd: selectedSingleDate,
        periodLabel: formatFrenchDate(selectedSingleDate),
      };
    } else if (periodMode === 'DATE_RANGE') {
      const start = startDate || todayStr;
      const end = endDate || todayStr;
      return {
        effectiveStart: start <= end ? start : end,
        effectiveEnd: start <= end ? end : start,
        periodLabel: `Du ${formatDate(start)} au ${formatDate(end)}`,
      };
    } else if (periodMode === 'WEEK') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      const past7Str = getLocalDateString(past7);
      return {
        effectiveStart: past7Str,
        effectiveEnd: todayStr,
        periodLabel: `7 derniers jours (Du ${formatDate(past7Str)} au ${formatDate(todayStr)})`,
      };
    } else if (periodMode === 'MONTH') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      const past30Str = getLocalDateString(past30);
      return {
        effectiveStart: past30Str,
        effectiveEnd: todayStr,
        periodLabel: `30 derniers jours (Du ${formatDate(past30Str)} au ${formatDate(todayStr)})`,
      };
    } else {
      return {
        effectiveStart: '2000-01-01',
        effectiveEnd: '2099-12-31',
        periodLabel: 'Historique complet des transactions',
      };
    }
  }, [periodMode, selectedSingleDate, startDate, endDate]);

  // Set of active, non-cancelled, non-refunded sale IDs
  const activeSaleIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) {
      if (s.status !== 'CANCELLED' && s.status !== 'REFUNDED') {
        set.add(s.id);
      }
    }
    return set;
  }, [sales]);

  // Filter sales matching the date interval & warehouse (strictly excluding cancelled/refunded/deleted sales)
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status === 'CANCELLED' || s.status === 'REFUNDED') return false;
      if (selectedWarehouseFilter !== 'ALL' && s.warehouseId !== selectedWarehouseFilter) return false;

      // Extract local date of sale
      const sDateStr = getLocalDateString(new Date(s.date));
      if (sDateStr < effectiveStart || sDateStr > effectiveEnd) return false;

      return true;
    });
  }, [sales, selectedWarehouseFilter, effectiveStart, effectiveEnd]);

  // Sort filtered sales by date ascending (chronological for day report)
  const sortedSales = useMemo(() => {
    return [...filteredSales].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredSales]);

  // Filter payments matching the date interval & warehouse (excluding payments from cancelled/deleted sales)
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.saleId && !activeSaleIdSet.has(p.saleId)) return false;
      if (selectedWarehouseFilter !== 'ALL' && p.warehouseId !== selectedWarehouseFilter) return false;
      const pDateStr = getLocalDateString(new Date(p.date));
      return pDateStr >= effectiveStart && pDateStr <= effectiveEnd;
    });
  }, [payments, activeSaleIdSet, selectedWarehouseFilter, effectiveStart, effectiveEnd]);

  // Filter all cash drawer movements in the period (excluding movements from cancelled/deleted sales)
  const filteredAllCashMovements = useMemo(() => {
    return cashMovements
      .filter((m) => {
        if (m.saleId && !activeSaleIdSet.has(m.saleId)) return false;
        if (selectedWarehouseFilter !== 'ALL' && m.warehouseId !== selectedWarehouseFilter) return false;
        const mDateStr = getLocalDateString(new Date(m.date));
        return mDateStr >= effectiveStart && mDateStr <= effectiveEnd;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [cashMovements, activeSaleIdSet, selectedWarehouseFilter, effectiveStart, effectiveEnd]);

  // Standalone customer payments (Acomptes clients & Règlements de créances) in the period
  // Includes both PaymentRecord entries (!p.saleId) and any orphan CashMovement entries of type ACOMPTE_CLIENT / REGLEMENT_CREANCE
  const { standaloneCustomerPayments, orphanCashCustomerPayments } = useMemo(() => {
    const directPayments = filteredPayments.filter((p) => !p.saleId && (Number(p.amount) || 0) > 0);
    const recordedIds = new Set(directPayments.map((p) => p.id));
    const orphans: PaymentRecord[] = [];

    filteredAllCashMovements.forEach((m) => {
      if (m.type !== 'ACOMPTE_CLIENT' && m.type !== 'REGLEMENT_CREANCE') return;
      if (m.direction !== 'IN' || (Number(m.amount) || 0) <= 0) return;
      if (m.documentRef && recordedIds.has(m.documentRef)) return;

      const cust = m.customerId ? customers.find((c) => c.id === m.customerId) : undefined;
      orphans.push({
        id: m.documentRef || m.id,
        date: m.date,
        customerId: m.customerId,
        customerName: cust?.name || m.reason,
        paymentType: m.type === 'ACOMPTE_CLIENT' ? 'ACOMPTE_CLIENT' : 'REGLEMENT_CREANCE',
        cashSessionId: m.cashSessionId,
        warehouseId: m.warehouseId,
        method: m.method,
        amount: m.amount,
        userId: m.userId,
        userName: m.userName,
        reference: m.documentRef || m.id,
        notes: m.notes || m.reason,
      });
    });

    const combined = [...directPayments, ...orphans].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      standaloneCustomerPayments: combined,
      orphanCashCustomerPayments: orphans,
    };
  }, [filteredPayments, filteredAllCashMovements, customers]);

  // Filter cash expenses in the period
  const filteredCashExpenses = useMemo(() => {
    return filteredAllCashMovements.filter((m) => m.type === 'DEPENSE');
  }, [filteredAllCashMovements]);

  // Key Aggregates (accounting for any partial returns)
  const totalRevenue = useMemo(() => {
    return sortedSales.reduce((sum, s) => sum + Math.max(0, s.totalAmount - (s.refundedAmount || 0)), 0);
  }, [sortedSales]);

  // Encaissements directs issus des ventes de la période
  const totalSalesCollected = useMemo(() => {
    return sortedSales.reduce((sum, s) => {
      const netSaleAmount = Math.max(0, s.totalAmount - (s.refundedAmount || 0));
      return sum + Math.min(s.totalPaid, netSaleAmount);
    }, 0);
  }, [sortedSales]);

  // Encaissements d'acomptes & règlements de créances clients sur la période
  const totalCustomerPaymentsCollected = useMemo(() => {
    return standaloneCustomerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [standaloneCustomerPayments]);

  // Total Encaissé Réel = Encaissements sur ventes + Acomptes & Règlements clients
  const totalCollected = totalSalesCollected + totalCustomerPaymentsCollected;

  const totalUnpaid = useMemo(() => {
    return sortedSales.reduce((sum, s) => sum + s.remainingDue, 0);
  }, [sortedSales]);

  const totalCostOfGoods = useMemo(() => {
    return sortedSales.reduce((sum, s) => sum + s.totalCost, 0);
  }, [sortedSales]);

  const grossMargin = totalRevenue - totalCostOfGoods;
  const marginPercent = totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100).toFixed(1) : '0';

  const totalItemsSold = useMemo(() => {
    return sortedSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
  }, [sortedSales]);

  const totalExpenses = useMemo(() => {
    return filteredCashExpenses.reduce((sum, m) => sum + m.amount, 0);
  }, [filteredCashExpenses]);

  const totalCashDrawerExpenses = useMemo(() => {
    return filteredCashExpenses
      .filter((m) => m.isCashInDrawer !== false)
      .reduce((sum, m) => sum + m.amount, 0);
  }, [filteredCashExpenses]);

  // Payment Breakdown (Ventes + Acomptes & Règlements clients)
  const paymentBreakdown = useMemo(() => {
    const stats: Record<string, number> = {
      ESPECES: 0,
      WAVE: 0,
      ORANGE_MONEY: 0,
      VIREMENT: 0,
      CARTE: 0,
    };
    filteredPayments.forEach((p) => {
      if (stats[p.method] !== undefined) {
        stats[p.method] += Number(p.amount) || 0;
      }
    });
    orphanCashCustomerPayments.forEach((p) => {
      if (stats[p.method] !== undefined) {
        stats[p.method] += Number(p.amount) || 0;
      }
    });
    return stats;
  }, [filteredPayments, orphanCashCustomerPayments]);

  const netDrawerCash = (paymentBreakdown.ESPECES || 0) - totalCashDrawerExpenses;

  // Selected warehouse object
  const activeWarehouseObj = warehouses.find((w) => w.id === selectedWarehouseFilter);
  const warehouseLabel = activeWarehouseObj ? activeWarehouseObj.name : 'Tous les dépôts (Consolidé)';

  // Export complete Excel spreadsheet (.csv with UTF-8 BOM) tracing synthesis, cash operations line by line, and sale details line by line
  const handleExportFullExcelReport = () => {
    const BOM = '\uFEFF';
    const sep = ';';
    const lines: string[] = [];

    // 1. Header
    lines.push(`"${(companyInfo.name || 'WKRLI').toUpperCase()} - BILAN COMMERCIAL & REGISTRE DE CAISSE"`);
    lines.push(`"Période :"${sep}"${periodLabel}"`);
    lines.push(`"Magasin / Dépôt :"${sep}"${warehouseLabel}"`);
    lines.push(`"Date d'exportation :"${sep}"${new Date().toLocaleString('fr-FR')}"`);
    lines.push('');

    // 2. Financial Summary
    lines.push(`"=== 1. SYNTHÈSE FINANCIÈRE GLOBALE ==="`);
    lines.push(`"Indicateur"${sep}"Montant (FCFA)"`);
    lines.push(`"Chiffre d'Affaires Total (Ventes)"${sep}"${totalRevenue}"`);
    lines.push(`"Total Encaissé Réel (Ventes + Acomptes/Règlements)"${sep}"${totalCollected}"`);
    lines.push(`"  dont Encaissements sur Ventes"${sep}"${totalSalesCollected}"`);
    lines.push(`"  dont Acomptes & Règlements Clients"${sep}"${totalCustomerPaymentsCollected}"`);
    lines.push(`"Crédits Accordés (Reste Dû)"${sep}"${totalUnpaid}"`);
    lines.push(`"Dépenses Décaissées"${sep}"${totalExpenses}"`);
    lines.push(`"Solde Net Espèces en Tiroir"${sep}"${netDrawerCash}"`);
    lines.push(`"Nombre de Ventes Réalisées"${sep}"${sortedSales.length}"`);
    lines.push(`"Nombre d'Acomptes / Règlements Clients"${sep}"${standaloneCustomerPayments.length}"`);
    lines.push(`"Total Pièces Vendues"${sep}"${totalItemsSold}"`);
    lines.push(`"--- Ventilation des Encaissements ---"`);
    lines.push(`"Espèces"${sep}"${paymentBreakdown.ESPECES || 0}"`);
    lines.push(`"Wave"${sep}"${paymentBreakdown.WAVE || 0}"`);
    lines.push(`"Orange Money"${sep}"${paymentBreakdown.ORANGE_MONEY || 0}"`);
    lines.push(`"Virement"${sep}"${paymentBreakdown.VIREMENT || 0}"`);
    lines.push(`"Carte Bancaire"${sep}"${paymentBreakdown.CARTE || 0}"`);
    lines.push('');

    // 3. Cash Drawer Movements (Line by line)
    lines.push(`"=== 2. OPÉRATIONS & FLUX DE CAISSE (LIGNE PAR LIGNE) ==="`);
    lines.push([
      '"Date"',
      '"Heure"',
      '"N° Opération"',
      '"Magasin"',
      '"Type Opération"',
      '"Motif / Description"',
      '"Mode Règlement"',
      '"Entrée / Encaissement (FCFA)"',
      '"Sortie / Décaissement (FCFA)"',
      '"Opérateur"',
    ].join(sep));

    if (filteredAllCashMovements.length === 0) {
      lines.push(`"Aucun mouvement de caisse enregistré sur cette période"${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}"0"${sep}"0"${sep}""`);
    } else {
      filteredAllCashMovements.forEach((m) => {
        const isOut = m.direction === 'OUT';
        const inAmount = !isOut ? m.amount : 0;
        const outAmount = isOut ? m.amount : 0;
        const whName = warehouses.find((w) => w.id === m.warehouseId)?.name || warehouseLabel;
        lines.push([
          `"${formatDate(m.date)}"`,
          `"${new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}"`,
          `"${m.id}"`,
          `"${whName}"`,
          `"${m.type}"`,
          `"${(m.reason || m.notes || '').replace(/"/g, '""')}"`,
          `"${m.method || 'ESPECES'}"`,
          `"${inAmount}"`,
          `"${outAmount}"`,
          `"${m.userName || 'Admin'}"`,
        ].join(sep));
      });
    }
    lines.push('');

    // 4. Customer Deposits & Debt Settlements (Line by line)
    lines.push(`"=== 3. ACOMPTES & RÈGLEMENTS CLIENTS (LIGNE PAR LIGNE) ==="`);
    lines.push([
      '"Date"',
      '"Heure"',
      '"N° Pièce"',
      '"Référence"',
      '"Magasin"',
      '"Client"',
      '"Nature"',
      '"Mode Règlement"',
      '"Montant Encaissé (FCFA)"',
      '"Motif / Observations"',
      '"Opérateur"',
    ].join(sep));

    if (standaloneCustomerPayments.length === 0) {
      lines.push(`"Aucun acompte ou règlement client enregistré sur cette période"${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}"0"${sep}""${sep}""`);
    } else {
      standaloneCustomerPayments.forEach((p) => {
        const custObj = p.customerId ? customers.find((c) => c.id === p.customerId) : undefined;
        const custName = custObj?.name || p.customerName || 'Client';
        const whName = warehouses.find((w) => w.id === p.warehouseId)?.name || warehouseLabel;
        const natureLabel =
          p.paymentType === 'ACOMPTE_CLIENT' ? 'Acompte / Avance Client' : 'Règlement de Créance';
        lines.push([
          `"${formatDate(p.date)}"`,
          `"${new Date(p.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}"`,
          `"${p.id}"`,
          `"${(p.reference || p.id).replace(/"/g, '""')}"`,
          `"${whName}"`,
          `"${custName.replace(/"/g, '""')}"`,
          `"${natureLabel}"`,
          `"${p.method}"`,
          `"${p.amount}"`,
          `"${(p.notes || '').replace(/"/g, '""')}"`,
          `"${p.userName || 'Admin'}"`,
        ].join(sep));
      });
    }
    lines.push('');

    // 5. Detailed Sales & Parts Sold (Line by line)
    lines.push(`"=== 4. DÉTAIL DES VENTES ET PIÈCES VENDUES (LIGNE PAR LIGNE) ==="`);
    lines.push([
      '"Date Vente"',
      '"Heure"',
      '"N° Reçu"',
      '"Magasin"',
      '"Client"',
      '"Téléphone Client"',
      '"Réf. Constructeur"',
      '"Désignation Pièce"',
      '"Marque"',
      '"Quantité"',
      '"Prix Unitaire (FCFA)"',
      '"Total Ligne (FCFA)"',
      '"Total Facture (FCFA)"',
      '"Montant Payé (FCFA)"',
      '"Reste Dû (FCFA)"',
      '"Mode(s) Règlement"',
      '"Statut Règlement"',
      '"Vendeur / Opérateur"',
    ].join(sep));

    if (sortedSales.length === 0) {
      lines.push(`"Aucune vente enregistrée sur cette période"${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}""${sep}"0"${sep}"0"${sep}"0"${sep}"0"${sep}"0"${sep}"0"${sep}""${sep}""${sep}""`);
    } else {
      sortedSales.forEach((s) => {
        const saleMethods = payments.filter((p) => p.saleId === s.id).map((p) => p.method);
        const methodsStr = saleMethods.length > 0 ? Array.from(new Set(saleMethods)).join(', ') : 'ESPECES';
        s.items.forEach((item) => {
          lines.push([
            `"${formatDate(s.date)}"`,
            `"${new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}"`,
            `"${s.receiptNumber}"`,
            `"${s.warehouseName}"`,
            `"${s.customerName}"`,
            `"${s.customerPhone || ''}"`,
            `"${item.mainReference}"`,
            `"${(item.designation || '').replace(/"/g, '""')}"`,
            `"${item.brand}"`,
            `"${item.quantity}"`,
            `"${item.unitPrice}"`,
            `"${item.totalLine}"`,
            `"${s.totalAmount}"`,
            `"${s.totalPaid}"`,
            `"${s.remainingDue}"`,
            `"${methodsStr}"`,
            `"${s.paymentStatus === 'PAID' ? 'Soldé' : s.paymentStatus === 'PARTIALLY_PAID' ? 'Partiel' : 'Crédit'}"`,
            `"${s.userName || 'Admin'}"`,
          ].join(sep));
        });
      });
    }

    const csvContent = BOM + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bilan_complet_ventes_caisse_${effectiveStart}_au_${effectiveEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Daily Report
  const handlePrintDailyReport = () => {
    printElementById('printable-daily-report', 'A4');
  };

  // Analytics Tab helpers
  const totalGlobalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + getCustomerCreditSummary(c, sales, payments).creance, 0);
  }, [customers, sales, payments]);

  const salesByWarehouse = useMemo(() => {
    return warehouses.map((wh) => {
      const whSales = filteredSales.filter((s) => s.warehouseId === wh.id);
      const whStandalonePayments = standaloneCustomerPayments.filter((p) => p.warehouseId === wh.id);
      const count = whSales.length;
      const revenue = whSales.reduce(
        (sum, s) => sum + Math.max(0, s.totalAmount - (s.refundedAmount || 0)),
        0
      );
      const salesCollected = whSales.reduce((sum, s) => {
        const netAmt = Math.max(0, s.totalAmount - (s.refundedAmount || 0));
        return sum + Math.min(s.totalPaid, netAmt);
      }, 0);
      const customerPaymentsCollected = whStandalonePayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      return {
        warehouse: wh,
        count,
        revenue,
        salesCollected,
        customerPaymentsCollected,
        customerPaymentsCount: whStandalonePayments.length,
        collected: salesCollected + customerPaymentsCollected,
      };
    });
  }, [warehouses, filteredSales, standaloneCustomerPayments]);

  const topSellingArticles = useMemo(() => {
    const map = new Map<string, { ref: string; desig: string; brand: string; qty: number; totalRev: number }>();
    filteredSales.forEach((s) => {
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

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filteredSales]);

  // Sorted & paginated collections for the 4 report tables
  const displaySortedSales = useMemo(() => {
    return [...sortedSales].sort((a, b) => {
      let cmp = 0;
      switch (dailySaleSort.field) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'receiptNumber':
          cmp = (a.receiptNumber || '').localeCompare(b.receiptNumber || '', 'fr');
          break;
        case 'customerName':
          cmp = (a.customerName || '').localeCompare(b.customerName || '', 'fr');
          break;
        case 'items':
          cmp =
            a.items.reduce((s, i) => s + i.quantity, 0) -
            b.items.reduce((s, i) => s + i.quantity, 0);
          break;
        case 'totalAmount':
          cmp = (a.totalAmount || 0) - (b.totalAmount || 0);
          break;
        case 'status':
          cmp = (a.remainingDue || 0) - (b.remainingDue || 0);
          break;
      }
      return dailySaleSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [sortedSales, dailySaleSort]);

  const {
    currentPage: salesPage,
    setCurrentPage: setSalesPage,
    pageSize: salesPageSize,
    setPageSize: setSalesPageSize,
    paginatedItems: paginatedDailySales,
  } = usePagination(displaySortedSales, 15);

  const displaySortedCustPayments = useMemo(() => {
    return [...standaloneCustomerPayments].sort((a, b) => {
      let cmp = 0;
      switch (custPaySort.field) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'reference':
          cmp = (a.reference || a.id).localeCompare(b.reference || b.id, 'fr');
          break;
        case 'customerName':
          cmp = (a.customerName || '').localeCompare(b.customerName || '', 'fr');
          break;
        case 'type':
          cmp = (a.paymentType || '').localeCompare(b.paymentType || '', 'fr');
          break;
        case 'method':
          cmp = (a.method || '').localeCompare(b.method || '', 'fr');
          break;
        case 'amount':
          cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
          break;
      }
      return custPaySort.dir === 'asc' ? cmp : -cmp;
    });
  }, [standaloneCustomerPayments, custPaySort]);

  const {
    currentPage: custPayPage,
    setCurrentPage: setCustPayPage,
    pageSize: custPayPageSize,
    setPageSize: setCustPayPageSize,
    paginatedItems: paginatedCustPayments,
  } = usePagination(displaySortedCustPayments, 15);

  const displaySortedWhPerf = useMemo(() => {
    return [...salesByWarehouse].sort((a, b) => {
      let cmp = 0;
      switch (whPerfSort.field) {
        case 'name':
          cmp = a.warehouse.name.localeCompare(b.warehouse.name, 'fr');
          break;
        case 'count':
          cmp = a.count - b.count;
          break;
        case 'revenue':
          cmp = a.revenue - b.revenue;
          break;
        case 'collected':
          cmp = a.collected - b.collected;
          break;
      }
      return whPerfSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [salesByWarehouse, whPerfSort]);

  const {
    currentPage: whPerfPage,
    setCurrentPage: setWhPerfPage,
    pageSize: whPerfPageSize,
    setPageSize: setWhPerfPageSize,
    paginatedItems: paginatedWhPerf,
  } = usePagination(displaySortedWhPerf, 10);

  const displaySortedTopParts = useMemo(() => {
    return [...topSellingArticles].sort((a, b) => {
      let cmp = 0;
      switch (topPartSort.field) {
        case 'ref':
          cmp = a.ref.localeCompare(b.ref, 'fr');
          break;
        case 'desig':
          cmp = a.desig.localeCompare(b.desig, 'fr');
          break;
        case 'qty':
          cmp = a.qty - b.qty;
          break;
        case 'totalRev':
          cmp = a.totalRev - b.totalRev;
          break;
      }
      return topPartSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [topSellingArticles, topPartSort]);

  const {
    currentPage: topPartsPage,
    setCurrentPage: setTopPartsPage,
    pageSize: topPartsPageSize,
    setPageSize: setTopPartsPageSize,
    paginatedItems: paginatedTopParts,
  } = usePagination(displaySortedTopParts, 10);

  return (
    <div className="space-y-5">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Rapports de Vente & Bilan Journalier
              </h2>
              <p className="text-xs text-slate-500">
                Génération instantanée de bilans clairs par date ou intervalle : Format Smartphone (PDF), Export Excel (.csv) et fiches A4
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('DAILY_BOSS_REPORT')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'DAILY_BOSS_REPORT'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bilan & Transactions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FINANCIAL_ANALYTICS')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'FINANCIAL_ANALYTICS'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Analyse Globale & Rentabilité</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Controls Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Date & Période du Bilan :
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPeriodMode('YESTERDAY');
                setSelectedSingleDate(getYesterdayDateString());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                periodMode === 'YESTERDAY'
                  ? 'bg-slate-900 text-amber-400 shadow-2xs ring-2 ring-amber-400/20'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
              title="Le choix quotidien recommandé pour le bilan du matin du patron"
            >
              <span>⭐ Hier</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPeriodMode('TODAY');
                setSelectedSingleDate(getLocalDateString());
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'TODAY'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Aujourd'hui
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('SINGLE_DATE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'SINGLE_DATE'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Date précise
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('DATE_RANGE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'DATE_RANGE'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Intervalle
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('WEEK')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'WEEK'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 jours
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('MONTH')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'MONTH'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              30 jours
            </button>
          </div>
        </div>

        {/* Detailed inputs: Date picker or Range picker + Warehouse picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left: Dynamic Date selector directly accessible */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Always visible direct day selector */}
            {periodMode !== 'DATE_RANGE' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => handleShiftSingleDate(-1)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer"
                  title="Jour précédent (-1 jour)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedSingleDate}
                  onChange={(e) => {
                    setSelectedSingleDate(e.target.value);
                    setPeriodMode('SINGLE_DATE');
                  }}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  title="Choisir directement une date pour le rapport"
                />
                <button
                  type="button"
                  onClick={() => handleShiftSingleDate(1)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer"
                  title="Jour suivant (+1 jour)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {periodMode === 'DATE_RANGE' && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold">
                <span className="text-slate-500 text-[11px]">Du :</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-slate-500 text-[11px]">Au :</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            {/* Current Active Period Banner */}
            <div className="text-xs text-slate-700 font-medium">
              Période active :{' '}
              <strong className="text-slate-950 font-bold underline decoration-amber-400 decoration-2">
                {periodLabel}
              </strong>
            </div>
          </div>

          {/* Right: Warehouse filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Magasin :
            </span>
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Tous les magasins consolidés</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'DAILY_BOSS_REPORT' && (
        <>
          {/* Main Printable & Visual Report Card */}
          <div
            id="printable-daily-report"
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5"
          >
            {/* Header of the Balance Sheet */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-start gap-3">
                {companyInfo.logoUrl && (
                  <img
                    src={companyInfo.logoUrl}
                    alt={companyInfo.name}
                    className="w-10 h-10 object-contain rounded border border-slate-200 p-1 bg-white shrink-0"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      {companyInfo.name || 'WKRLI'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Bilan Certifié
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {warehouseLabel}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 tracking-tight mt-1">
                    Bilan Journalier des Transactions
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Situation commerciale arrêtée pour : <strong>{periodLabel}</strong>
                  </p>
                </div>
              </div>

              {/* Action Buttons: Smartphone PDF, Excel export, Print A4 */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setIsSmartphoneModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-amber-400 hover:bg-slate-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Afficher et imprimer le rapport au format Smartphone lisible (PDF / Fiche Mobile)"
                >
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Bilan Smartphone (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFullExcelReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Exporter le fichier Excel (.csv) complet avec synthèse, flux de caisse ligne par ligne et détail des ventes"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exporter Excel (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintDailyReport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  title="Imprimer une fiche A4 épurée"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimer A4</span>
                </button>
              </div>
            </div>

            {/* 4 Big Simple Numbers (Conçu pour une compréhension immédiate par le patron) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Box 1: Chiffre d'Affaires Total */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    1. Ventes Totales (Chiffre d'Affaires)
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-950 mt-1.5 tabular-nums">
                    {formatFCFA(totalRevenue)}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
                  <span>Volume d'activité :</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {sortedSales.length} vente{sortedSales.length > 1 ? 's' : ''} ({totalItemsSold} pièces)
                  </span>
                </div>
              </div>

              {/* Box 2: Total Encaissé Réel */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    2. Total Encaissé en Réel
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 mt-1.5 tabular-nums">
                    {formatFCFA(totalCollected)}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-emerald-200/80 text-[11px] text-emerald-800 space-y-0.5">
                  {totalCustomerPaymentsCollected > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <span>Sur ventes :</span>
                        <span className="font-bold font-mono">{formatFCFA(totalSalesCollected)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-800">
                        <span>Acomptes / Règl. ({standaloneCustomerPayments.length}) :</span>
                        <span className="font-bold font-mono">+{formatFCFA(totalCustomerPaymentsCollected)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>Argent effectivement reçu :</span>
                      <span className="font-bold font-mono">
                        {totalRevenue > 0 ? `${Math.round((totalSalesCollected / totalRevenue) * 100)}% encaissé` : '0%'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 3: Crédit / Reste à Recouvrer */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                    3. Crédits Accordés (Reste Dû)
                  </span>
                  <div className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1.5 tabular-nums ${
                    totalUnpaid > 0 ? 'text-rose-600' : 'text-slate-700'
                  }`}>
                    {formatFCFA(totalUnpaid)}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200/80 text-[11px] text-amber-900 flex justify-between">
                  <span>Non soldé à recouvrer :</span>
                  <span className="font-bold font-mono">
                    {totalUnpaid > 0 ? 'À suivre' : 'Tout est payé'}
                  </span>
                </div>
              </div>

              {/* Box 4: Espèces en Tiroir Net */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    4. Espèces Net en Tiroir
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-950 mt-1.5 tabular-nums">
                    {formatFCFA(netDrawerCash)}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
                  <span>Après dépenses espèces (-{formatFCFA(totalCashDrawerExpenses)})</span>
                  <span className="font-bold text-emerald-700 font-mono">En caisse</span>
                </div>
              </div>
            </div>

            {/* Clear Payment Method Breakdown Pills */}
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Répartition des encaissements par mode de paiement (Où est allé l'argent ?) :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Espèces</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-950 mt-1 tabular-nums">
                    {formatFCFA(paymentBreakdown.ESPECES || 0)}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900">
                    <QrCode className="w-3.5 h-3.5 text-sky-600" />
                    <span>Wave</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-sky-950 mt-1 tabular-nums">
                    {formatFCFA(paymentBreakdown.WAVE || 0)}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-orange-950">
                    <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                    <span>Orange Money</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-orange-950 mt-1 tabular-nums">
                    {formatFCFA(paymentBreakdown.ORANGE_MONEY || 0)}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Virements</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-950 mt-1 tabular-nums">
                    {formatFCFA(paymentBreakdown.VIREMENT || 0)}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                    <span>Cartes</span>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-950 mt-1 tabular-nums">
                    {formatFCFA(paymentBreakdown.CARTE || 0)}
                  </div>
                </div>
              </div>
            </div>


            {/* Complete, Simple & Clear Transactions Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                  <span>Tableau détaillé des ventes ({sortedSales.length})</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  Affichage par ordre chronologique
                </span>
              </div>

              {sortedSales.length === 0 && standaloneCustomerPayments.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Aucune vente ni encaissement client enregistré pour cette période ({periodLabel})
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Si votre magasin était fermé ce jour-là (dimanche ou jour férié), vous pouvez utiliser les boutons ci-dessus pour naviguer d'un jour ou sélectionner une autre date.
                  </p>
                </div>
              ) : sortedSales.length === 0 ? (
                <div className="py-4 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Aucune vente sur cette période — les acomptes et règlements clients encaissés figurent ci-dessous.
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <SortableTh label="Date" active={dailySaleSort.field === 'date'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('date')} className="w-[12%]" />
                        <SortableTh label="N° Reçu" active={dailySaleSort.field === 'receiptNumber'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('receiptNumber')} className="w-[13%]" />
                        <SortableTh label="Client" active={dailySaleSort.field === 'customerName'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('customerName')} className="w-[17%]" />
                        <SortableTh label="Pièces" active={dailySaleSort.field === 'items'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('items')} className="hidden lg:table-cell w-[23%]" />
                        <SortableTh label="Montant" active={dailySaleSort.field === 'totalAmount'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('totalAmount')} align="right" className="w-[13%]" />
                        <SortableTh label="Règlement" active={dailySaleSort.field === 'status'} direction={dailySaleSort.dir} onClick={() => toggleDailySaleSort('status')} align="center" className="w-[14%]" />
                        <th className="py-2.5 px-2 text-right print:hidden w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {paginatedDailySales.map((s) => {
                        const saleDate = new Date(s.date);
                        const dateStr = saleDate.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        });
                        const timeStr = saleDate.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const isFullyPaid = s.remainingDue <= 0;

                        return (
                          <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                            {/* Date & Heure */}
                            <td className="py-2.5 px-2.5 font-mono text-slate-900 whitespace-nowrap text-[11px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1 font-bold text-slate-900">
                                  <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
                                  {dateStr}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 pl-4">
                                  <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  {timeStr}
                                </span>
                              </div>
                            </td>

                            {/* Receipt Number */}
                            <td className="py-2.5 px-2.5 font-mono text-slate-600 truncate text-[11px]" title={s.receiptNumber}>
                              {s.receiptNumber}
                            </td>

                            {/* Customer */}
                            <td className="py-2.5 px-2.5">
                              <div className="font-bold text-slate-900 truncate" title={s.customerName}>{s.customerName}</div>
                              {s.customerPhone && (
                                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                  <Phone className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{s.customerPhone}</span>
                                </div>
                              )}
                            </td>

                            {/* Items */}
                            <td className="hidden lg:table-cell py-2.5 px-2.5">
                              <div className="line-clamp-2 text-slate-700 text-[11px]">
                                {s.items.map((i, idx) => (
                                  <span key={idx} className="mr-1.5 inline-block">
                                    <strong className="font-mono text-slate-950 font-bold">
                                      {i.quantity}x
                                    </strong>{' '}
                                    <span className="font-mono text-amber-800 font-semibold">
                                      {i.mainReference}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-xs text-slate-950 whitespace-nowrap">
                              {formatFCFA(s.totalAmount)}
                            </td>

                            {/* Settlement Status */}
                            <td className="py-2.5 px-2 text-center">
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 max-w-full truncate">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">Payé</span>
                                </span>
                              ) : (
                                <div className="inline-flex flex-col items-center max-w-full">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                    <span>Crédit</span>
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-rose-600 mt-0.5 truncate">
                                    {formatFCFA(s.remainingDue)}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* View Action */}
                            <td className="py-2.5 px-2 text-right print:hidden whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setActiveReceiptSale(s)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Voir le reçu ou imprimer la facture de cette vente"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="print:hidden">
                    <TablePagination
                      currentPage={salesPage}
                      totalItems={displaySortedSales.length}
                      pageSize={salesPageSize}
                      onPageChange={setSalesPage}
                      onPageSizeChange={setSalesPageSize}
                      itemLabel="ventes"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Standalone Customer Payments Section (Acomptes & Règlements de Créances) */}
            {standaloneCustomerPayments.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    <span>
                      Acomptes & Règlements Clients encaissés ({standaloneCustomerPayments.length})
                    </span>
                  </h4>
                  <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg tabular-nums">
                    Total : +{formatFCFA(totalCustomerPaymentsCollected)}
                  </span>
                </div>

                <div className="border border-indigo-200/80 rounded-xl overflow-hidden">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="bg-indigo-50/70 border-b border-indigo-200/80 text-indigo-950 uppercase text-[10px] font-bold">
                      <tr>
                        <SortableTh label="Date" active={custPaySort.field === 'date'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('date')} className="w-[12%]" />
                        <SortableTh label="Réf." active={custPaySort.field === 'reference'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('reference')} className="hidden md:table-cell w-[14%]" />
                        <SortableTh label="Client" active={custPaySort.field === 'customerName'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('customerName')} className="w-[19%]" />
                        <SortableTh label="Nature" active={custPaySort.field === 'type'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('type')} className="hidden lg:table-cell w-[21%]" />
                        <SortableTh label="Mode" active={custPaySort.field === 'method'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('method')} align="center" className="w-[12%]" />
                        <SortableTh label="Encaissé" active={custPaySort.field === 'amount'} direction={custPaySort.dir} onClick={() => toggleCustPaySort('amount')} align="right" className="w-[14%]" />
                        <th className="py-2.5 px-2 text-right print:hidden w-14">Reçu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {paginatedCustPayments.map((p) => {
                        const pDate = new Date(p.date);
                        const dateStr = pDate.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        });
                        const timeStr = pDate.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const customerObj = p.customerId
                          ? customers.find((c) => c.id === p.customerId) || null
                          : null;
                        const displayCustomerName = customerObj?.name || p.customerName || 'Client';
                        const isAcompte = p.paymentType === 'ACOMPTE_CLIENT';
                        const whName = warehouses.find((w) => w.id === p.warehouseId)?.name;

                        return (
                          <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2.5 px-2.5 font-mono text-slate-900 whitespace-nowrap text-[11px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1 font-bold text-slate-900">
                                  <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                  {dateStr}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 pl-4">
                                  <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  {timeStr}
                                </span>
                              </div>
                            </td>

                            <td className="hidden md:table-cell py-2.5 px-2.5 font-mono text-slate-700 text-[11px]">
                              <div className="font-semibold truncate" title={p.reference || p.id}>{p.reference || p.id}</div>
                            </td>

                            <td className="py-2.5 px-2.5">
                              <div className="font-bold text-slate-900 truncate" title={displayCustomerName}>{displayCustomerName}</div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                {whName || customerObj?.phone || ''}
                              </div>
                            </td>

                            <td className="hidden lg:table-cell py-2.5 px-2.5">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isAcompte
                                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                }`}
                              >
                                {isAcompte ? 'Acompte' : 'Règlement'}
                              </span>
                              {p.notes && (
                                <div className="text-[10px] text-slate-600 truncate mt-0.5" title={p.notes}>
                                  {p.notes}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-2 text-center">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[10px] uppercase truncate max-w-full">
                                {p.method === 'ORANGE_MONEY'
                                  ? 'OM'
                                  : p.method === 'ESPECES'
                                  ? 'Espèces'
                                  : p.method === 'VIREMENT'
                                  ? 'Virement'
                                  : p.method === 'CARTE'
                                  ? 'Carte'
                                  : p.method}
                              </span>
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-xs text-emerald-700 whitespace-nowrap tabular-nums">
                              +{formatFCFA(p.amount)}
                            </td>

                            <td className="py-2.5 px-2 text-right print:hidden whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveCustomerPaymentReceipt({
                                    payment: p,
                                    customer: customerObj,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Voir ou imprimer le reçu de cet acompte / règlement"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-emerald-50/60 border-t border-indigo-200/80 text-xs font-bold">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-right text-slate-700 uppercase text-[11px]">
                          Total Acomptes & Règlements :
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-emerald-800 tabular-nums whitespace-nowrap">
                          +{formatFCFA(totalCustomerPaymentsCollected)}
                        </td>
                        <td className="print:hidden" />
                      </tr>
                    </tfoot>
                  </table>
                  <div className="print:hidden">
                    <TablePagination
                      currentPage={custPayPage}
                      totalItems={displaySortedCustPayments.length}
                      pageSize={custPayPageSize}
                      onPageChange={setCustPayPage}
                      onPageSizeChange={setCustPayPageSize}
                      itemLabel="encaissements"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Signature & Date Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
              <span>{companyInfo.name || 'WKRLI'} — {companyInfo.slogan || 'Système certifié de gestion pièces & filtration'}</span>
              <span className="font-mono">
                Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
              </span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'FINANCIAL_ANALYTICS' && (
        <div className="space-y-6">
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
                <span>Marge brute estimée</span>
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
                <span>
                  {totalCustomerPaymentsCollected > 0
                    ? `Ventes : ${formatFCFA(totalSalesCollected)}`
                    : 'Règlements effectifs'}
                </span>
                <span className="font-medium text-slate-700 font-mono">
                  {totalCustomerPaymentsCollected > 0
                    ? `+${formatFCFA(totalCustomerPaymentsCollected)} acomptes`
                    : 'Comptant & Digital'}
                </span>
              </div>
            </div>

            {/* KPI 3: Créances Clients Globales */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                3. Total Créances Clients
              </span>
              <div className="mt-2">
                <span className="text-2xl font-bold font-mono text-rose-600 tabular-nums block">
                  {formatFCFA(totalGlobalReceivables)}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                <span>Tout l'argent dehors</span>
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
                  {formatFCFA(totalExpenses)}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                <span>Petite caisse & frais</span>
                <span className="font-medium text-slate-600">Sur la période</span>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Sales by Warehouse & Top Selling Articles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Performance by warehouse */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs overflow-hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Performance commerciale par magasin
              </h3>
              <div className="w-full">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <SortableTh label="Magasin" active={whPerfSort.field === 'name'} direction={whPerfSort.dir} onClick={() => toggleWhPerfSort('name')} className="w-[34%]" />
                      <SortableTh label="Ventes" active={whPerfSort.field === 'count'} direction={whPerfSort.dir} onClick={() => toggleWhPerfSort('count')} align="center" className="w-[14%]" />
                      <SortableTh label="CA" active={whPerfSort.field === 'revenue'} direction={whPerfSort.dir} onClick={() => toggleWhPerfSort('revenue')} align="right" className="w-[26%]" />
                      <SortableTh label="Encaissé" active={whPerfSort.field === 'collected'} direction={whPerfSort.dir} onClick={() => toggleWhPerfSort('collected')} align="right" className="w-[26%]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedWhPerf.map((w) => (
                      <tr key={w.warehouse.id}>
                        <td className="py-2.5 px-2 font-semibold text-slate-800">
                          <span className="block truncate" title={w.warehouse.name}>{w.warehouse.name}</span>
                          <span className="block text-[10px] font-mono text-slate-400">
                            {w.warehouse.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                          {w.count}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 truncate">
                          {formatFCFA(w.revenue)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-700 font-bold">
                          <span className="block truncate">{formatFCFA(w.collected)}</span>
                          {w.customerPaymentsCollected > 0 && (
                            <span className="block text-[10px] font-normal text-indigo-700 truncate">
                              +{formatFCFA(w.customerPaymentsCollected)} règ.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="-mx-4 -mb-4 mt-2">
                <TablePagination
                  currentPage={whPerfPage}
                  totalItems={displaySortedWhPerf.length}
                  pageSize={whPerfPageSize}
                  onPageChange={setWhPerfPage}
                  onPageSizeChange={setWhPerfPageSize}
                  itemLabel="magasins"
                />
              </div>
            </div>

            {/* Right: Top Selling Parts */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs overflow-hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Pièces détachées les plus vendues
              </h3>
              <div className="w-full">
                {displaySortedTopParts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Aucune vente enregistrée sur cette période.
                  </div>
                ) : (
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <SortableTh label="Référence" active={topPartSort.field === 'ref'} direction={topPartSort.dir} onClick={() => toggleTopPartSort('ref')} className="w-[26%]" />
                        <SortableTh label="Désignation" active={topPartSort.field === 'desig'} direction={topPartSort.dir} onClick={() => toggleTopPartSort('desig')} className="w-[34%]" />
                        <SortableTh label="Qté" active={topPartSort.field === 'qty'} direction={topPartSort.dir} onClick={() => toggleTopPartSort('qty')} align="right" className="w-[14%]" />
                        <SortableTh label="Total CA" active={topPartSort.field === 'totalRev'} direction={topPartSort.dir} onClick={() => toggleTopPartSort('totalRev')} align="right" className="w-[26%]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTopParts.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                            <span className="block truncate" title={it.ref}>{it.ref}</span>
                            <span className="block text-[10px] font-sans text-slate-400 font-normal truncate">
                              {it.brand}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-700 truncate" title={it.desig}>
                            {it.desig}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                            {it.qty}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 truncate">
                            {formatFCFA(it.totalRev)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="-mx-4 -mb-4 mt-2">
                <TablePagination
                  currentPage={topPartsPage}
                  totalItems={displaySortedTopParts.length}
                  pageSize={topPartsPageSize}
                  onPageChange={setTopPartsPage}
                  onPageSizeChange={setTopPartsPageSize}
                  itemLabel="pièces"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Receipt Modal */}
      {activeReceiptSale && (
        <ReceiptModal
          sale={activeReceiptSale}
          onClose={() => setActiveReceiptSale(null)}
          initialFormat="A4"
        />
      )}

      {/* Customer Payment / Deposit Receipt Modal */}
      {activeCustomerPaymentReceipt && (
        <PaymentReceiptModal
          payment={activeCustomerPaymentReceipt.payment}
          customer={activeCustomerPaymentReceipt.customer}
          onClose={() => setActiveCustomerPaymentReceipt(null)}
        />
      )}

      {/* Smartphone-formatted PDF / Mobile Slip Modal */}
      {isSmartphoneModalOpen && (
        <SmartphoneReportModal
          isOpen={isSmartphoneModalOpen}
          onClose={() => setIsSmartphoneModalOpen(false)}
          companyName={companyInfo.name || 'WKRLI'}
          companyAddress={companyInfo.address}
          companyPhone={companyInfo.phone}
          companyLogoUrl={companyInfo.logoUrl}
          periodLabel={periodLabel}
          warehouseLabel={warehouseLabel}
          totalRevenue={totalRevenue}
          totalSalesCollected={totalSalesCollected}
          totalCustomerPaymentsCollected={totalCustomerPaymentsCollected}
          totalCollected={totalCollected}
          totalUnpaid={totalUnpaid}
          paymentBreakdown={paymentBreakdown}
          sortedSales={sortedSales}
          standaloneCustomerPayments={standaloneCustomerPayments}
          customers={customers}
        />
      )}
    </div>
  );
};

interface SmartphoneReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
  periodLabel: string;
  warehouseLabel: string;
  totalRevenue: number;
  totalSalesCollected: number;
  totalCustomerPaymentsCollected: number;
  totalCollected: number;
  totalUnpaid: number;
  paymentBreakdown: Record<string, number>;
  sortedSales: Sale[];
  standaloneCustomerPayments: PaymentRecord[];
  customers: Customer[];
}

const SmartphoneReportModal: React.FC<SmartphoneReportModalProps> = ({
  onClose,
  companyName,
  companyAddress,
  companyPhone,
  companyLogoUrl,
  periodLabel,
  warehouseLabel,
  totalRevenue,
  totalSalesCollected,
  totalCustomerPaymentsCollected,
  totalCollected,
  totalUnpaid,
  paymentBreakdown,
  sortedSales,
  standaloneCustomerPayments,
  customers,
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    printElementById('printable-smartphone-report', 'TICKET_80MM');
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf(
        'printable-smartphone-report',
        `Rapport_Caisse_${new Date().toISOString().slice(0, 10)}`,
        'TICKET_80MM'
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Format Smartphone & PDF</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              title="Télécharger directement le fichier PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'PDF...' : 'Télécharger PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Viewport on Screen */}
        <div className="max-h-[82vh] overflow-y-auto print:max-h-none">
          {/* Smartphone-width Printable Ticket Container */}
          <div
            id="printable-smartphone-report"
            className="p-4 sm:p-5 space-y-4 print:p-0 print:space-y-3 bg-white text-slate-900"
          >
          {/* Header Slip */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt={companyName}
                className="w-8 h-8 object-contain mx-auto mb-1"
              />
            )}
            <div className="inline-block px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black tracking-widest uppercase rounded mb-1">
              {companyName}
            </div>
            {(companyAddress || companyPhone) && (
              <p className="text-[9px] text-slate-500 mb-0.5">
                {companyAddress}
                {companyAddress && companyPhone ? ' · ' : ''}
                {companyPhone ? `Tél : ${companyPhone}` : ''}
              </p>
            )}
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              BILAN JOURNALIER SMARTPHONE
            </h3>
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {periodLabel}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Magasin : <strong className="text-slate-800 dark:text-slate-200">{warehouseLabel}</strong>
            </p>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Flash Synthesis Card (Without Net Espèces Tiroir or Cash Expenses) */}
          <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Synthèse Financière Flash
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Ventes Totales (CA)</span>
                <span className="font-mono font-black text-sm text-amber-400 tabular-nums">
                  {formatFCFA(totalRevenue)}
                </span>
              </div>
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Encaissé Réel</span>
                <span className="font-mono font-black text-sm text-emerald-400 tabular-nums">
                  {formatFCFA(totalCollected)}
                </span>
              </div>
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Crédits Accordés</span>
                <span className={`font-mono font-black text-sm tabular-nums ${totalUnpaid > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {formatFCFA(totalUnpaid)}
                </span>
              </div>
            </div>
            {totalCustomerPaymentsCollected > 0 && (
              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-300">
                <span>Dont ventes : <strong className="font-mono text-white">{formatFCFA(totalSalesCollected)}</strong></span>
                <span>Acomptes / Règl. : <strong className="font-mono text-emerald-400">+{formatFCFA(totalCustomerPaymentsCollected)}</strong></span>
              </div>
            )}
          </div>

          {/* Payment Methods Breakdown */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 text-[11px] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Modes d'Encaissement :
            </span>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-600 dark:text-slate-400">💵 Espèces :</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100">{formatFCFA(paymentBreakdown.ESPECES || 0)}</strong>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-600 dark:text-slate-400">🌊 Wave :</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100">{formatFCFA(paymentBreakdown.WAVE || 0)}</strong>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-600 dark:text-slate-400">🟠 Orange Money :</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100">{formatFCFA(paymentBreakdown.ORANGE_MONEY || 0)}</strong>
            </div>
            {(paymentBreakdown.VIREMENT > 0 || paymentBreakdown.CARTE > 0) && (
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600 dark:text-slate-400">💳 Cartes & Virements :</span>
                <strong className="font-mono text-slate-900 dark:text-slate-100">
                  {formatFCFA((paymentBreakdown.VIREMENT || 0) + (paymentBreakdown.CARTE || 0))}
                </strong>
              </div>
            )}
          </div>

          {/* Line-by-Line Sales Details (Untruncated for Full WhatsApp & PDF Text Search) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                Détail des Ventes ({sortedSales.length})
              </span>
              <span className="text-[9px] text-slate-400 font-mono">Indexé Réf. & Date</span>
            </div>

            {sortedSales.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic text-center py-2">
                Aucune vente enregistrée sur cette période.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sortedSales.map((s, idx) => {
                  const saleDateFormatted = new Date(s.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const saleTimeFormatted = new Date(s.date).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const netSaleTotal = Math.max(0, s.totalAmount - (s.refundedAmount || 0));

                  return (
                    <div
                      key={s.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white flex-wrap">
                          <span className="text-amber-600 dark:text-amber-400 font-mono">#{idx + 1}</span>
                          <span>{s.receiptNumber}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({saleDateFormatted} à {saleTimeFormatted})
                          </span>
                        </div>
                        <span className="font-mono font-black text-slate-900 dark:text-white tabular-nums shrink-0">
                          {formatFCFA(netSaleTotal)}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>Client : <strong>{s.customerName || 'Client Comptoir'}</strong> {s.customerPhone ? `(${s.customerPhone})` : ''}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          s.remainingDue > 0
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {s.remainingDue > 0 ? `Reste ${formatFCFA(s.remainingDue)}` : 'Payé'}
                        </span>
                      </div>

                      {/* Items inside sale - full reference & date visible for PDF/WhatsApp search */}
                      <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/40 space-y-1 text-[10px]">
                        {s.items.map((it, itemIdx) => (
                          <div key={itemIdx} className="flex items-start justify-between gap-2 text-slate-700 dark:text-slate-300">
                            <span className="break-words pr-1 leading-snug">
                              <strong className="font-mono text-slate-950 dark:text-slate-100">{it.quantity}x {it.mainReference}</strong> — {it.designation} ({it.brand}) <span className="text-[9px] text-slate-400 font-mono">[{saleDateFormatted}]</span>
                            </span>
                            <span className="font-mono font-semibold shrink-0 text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatFCFA(it.totalLine)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Standalone Customer Deposits & Debt Settlements in Smartphone PDF */}
          {standaloneCustomerPayments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-indigo-200 dark:border-indigo-900/60">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-indigo-600" />
                  Acomptes & Règlements ({standaloneCustomerPayments.length})
                </span>
                <span className="text-[10px] font-mono font-extrabold text-emerald-700">
                  +{formatFCFA(totalCustomerPaymentsCollected)}
                </span>
              </div>

              <div className="space-y-2">
                {standaloneCustomerPayments.map((p, idx) => {
                  const pDate = new Date(p.date);
                  const dateFormatted = pDate.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const timeFormatted = pDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const custName =
                    (p.customerId ? customers.find((c) => c.id === p.customerId)?.name : undefined) ||
                    p.customerName ||
                    'Client';
                  const isAcompte = p.paymentType === 'ACOMPTE_CLIENT';

                  return (
                    <div
                      key={p.id}
                      className="p-2.5 bg-indigo-50/50 border border-indigo-200/70 rounded-xl space-y-1 text-[10px]"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 flex-wrap">
                          <span className="text-indigo-600 font-mono">#{idx + 1}</span>
                          <span>{p.reference || p.id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({dateFormatted} à {timeFormatted})
                          </span>
                        </div>
                        <span className="font-mono font-black text-emerald-700 tabular-nums shrink-0">
                          +{formatFCFA(p.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span>
                          Client : <strong>{custName}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-900 font-bold text-[9px] uppercase">
                          {isAcompte ? 'Acompte' : 'Règlement'} · {p.method}
                        </span>
                      </div>
                      {p.notes && (
                        <div className="text-slate-500 italic">{p.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Signature */}
          <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-center text-[9px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              CERTIFICATION & CLÔTURE DE CAISSE
            </p>
            <p>Rapport smartphone lisible — {companyName}</p>
            <div className="grid grid-cols-2 gap-4 pt-3 text-[10px] text-slate-500">
              <div className="border-t border-slate-300 dark:border-slate-700 pt-1 text-center">
                Visa Caissier
              </div>
              <div className="border-t border-slate-300 dark:border-slate-700 pt-1 text-center">
                Visa Gérant / Direction
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
