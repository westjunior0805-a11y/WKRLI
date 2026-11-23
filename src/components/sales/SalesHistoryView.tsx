import React, { useState, useMemo, useDeferredValue } from 'react';
import { useStock } from '../../context/StockContext';
import { Sale } from '../../types';
import { formatFCFA, formatDateTime, exportToCSV } from '../../utils/formatters';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import { fuzzyMatch } from '../../utils/fuzzySearch';
import {
  Search,
  Download,
  Printer,
  Ban,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Building2,
  Calendar,
  X,
  FileCheck,
  Edit2,
  Undo2,
  Snowflake,
  Check,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { NumericInput } from '../common/NumericInput';
import { SaleReturn } from '../../types';
import {
  getSaleReturnBreakdown,
  getNetSaleAmount,
  getSaleItemReturnRefund,
} from '../../utils/customerAccount';
import { ReceiptModal } from './ReceiptModal';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';

type SaleSortField =
  | 'receiptNumber'
  | 'date'
  | 'warehouseName'
  | 'customerName'
  | 'itemsCount'
  | 'totalAmount'
  | 'totalPaid'
  | 'remainingDue'
  | 'paymentStatus';

export const SalesHistoryView: React.FC = () => {
  const {
    sales,
    warehouses,
    customers,
    companyInfo,
    cancelOrRefundSale,
    deleteSale,
    updateSale,
    processSaleReturn,
    currentUser,
  } = useStock();
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SaleSortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [activeDeliveryNoteSale, setActiveDeliveryNoteSale] = useState<Sale | null>(null);

  // Edit Sale modal state (Admin)
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editTotalPaid, setEditTotalPaid] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');

  // Sale Return modal state
  const [saleForReturn, setSaleForReturn] = useState<Sale | null>(null);
  const [returnItemSelections, setReturnItemSelections] = useState<
    Record<
      string,
      {
        selected: boolean;
        quantity: number;
        reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_RETRACTION' | 'OTHER';
        detail: string;
      }
    >
  >({});
  const [returnMethod, setReturnMethod] = useState<
    'ESPECES' | 'WAVE' | 'ORANGE_MONEY' | 'AVOIR_CLIENT' | 'RETOUR_STOCK_SEUL'
  >('ESPECES');
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnError, setReturnError] = useState('');
  const [completedReturnRecord, setCompletedReturnRecord] = useState<SaleReturn | null>(null);

  // Cancellation modal state
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundCash, setRefundCash] = useState(true);
  const [cancelError, setCancelError] = useState('');

  const toggleSort = (field: SaleSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' || field === 'totalAmount' || field === 'totalPaid' || field === 'remainingDue' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SaleSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 inline ml-1" />
    );
  };

  // Filter & Sort logic with Deferred Fuzzy Search
  const filteredSales = useMemo(() => {
    const filtered = sales.filter((s) => {
      if (selectedWarehouseFilter !== 'ALL' && s.warehouseId !== selectedWarehouseFilter) return false;
      if (selectedPaymentStatus !== 'ALL' && s.paymentStatus !== selectedPaymentStatus) return false;
      if (selectedCustomerFilter !== 'ALL' && s.customerId !== selectedCustomerFilter) return false;

      if (deferredSearchQuery.trim()) {
        const fields = [
          s.id,
          s.receiptNumber,
          s.customerName,
          s.customerPhone,
          s.userName,
          s.notes,
          ...s.items.map((it) => `${it.mainReference} ${it.designation} ${it.brand}`),
        ];
        if (!fuzzyMatch(deferredSearchQuery, fields)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'receiptNumber':
          cmp = (a.receiptNumber || a.id).localeCompare(b.receiptNumber || b.id, 'fr', { numeric: true });
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'warehouseName':
          cmp = (a.warehouseName || '').localeCompare(b.warehouseName || '', 'fr');
          break;
        case 'customerName':
          cmp = (a.customerName || '').localeCompare(b.customerName || '', 'fr');
          break;
        case 'itemsCount': {
          const qtyA = a.items.reduce((sum, i) => sum + i.quantity, 0);
          const qtyB = b.items.reduce((sum, i) => sum + i.quantity, 0);
          cmp = qtyA - qtyB;
          break;
        }
        case 'totalAmount':
          cmp = (a.totalAmount || 0) - (b.totalAmount || 0);
          break;
        case 'totalPaid':
          cmp = (a.totalPaid || 0) - (b.totalPaid || 0);
          break;
        case 'remainingDue':
          cmp = (a.remainingDue || 0) - (b.remainingDue || 0);
          break;
        case 'paymentStatus':
          cmp = (a.paymentStatus || '').localeCompare(b.paymentStatus || '', 'fr');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sales, selectedWarehouseFilter, selectedPaymentStatus, selectedCustomerFilter, deferredSearchQuery, sortField, sortDir]);

  const handleExportCSV = () => {
    const headers = [
      'N° Vente',
      'N° Reçu',
      'Date & Heure',
      'Magasin',
      'Client',
      'Vendeur',
      'Sous-Total (FCFA)',
      'Remise (FCFA)',
      'Montant Net (FCFA)',
      'Montant Encaissé (FCFA)',
      'Solde Restant Dû (FCFA)',
      'Statut Paiement',
      'Statut Vente',
      'Articles (Qté x Réf)',
      'Observations',
    ];

    const rows = filteredSales.map((s) => [
      s.id,
      s.receiptNumber,
      formatDateTime(s.date),
      s.warehouseName,
      s.customerName,
      s.userName,
      s.subtotal,
      s.totalDiscount,
      s.totalAmount,
      s.totalPaid,
      s.remainingDue,
      s.paymentStatus,
      s.status,
      s.items.map((i) => `${i.quantity}x ${i.mainReference}`).join(' | '),
      s.notes || '',
    ]);

    exportToCSV(`historique_ventes_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const handleExecuteCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToCancel) return;
    setCancelError('');

    if (!cancelReason.trim()) {
      setCancelError('Le motif de l’annulation est obligatoire pour la traçabilité.');
      return;
    }

    const result = cancelOrRefundSale({
      saleId: saleToCancel.id,
      reason: cancelReason.trim(),
      refundCash,
    });

    if (!result.success) {
      setCancelError(result.error || 'Erreur lors de l’annulation.');
    } else {
      setSaleToCancel(null);
      setCancelReason('');
    }
  };

  const handleOpenEditModal = (sale: Sale) => {
    setSaleToEdit(sale);
    setEditDate(sale.date ? sale.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditCustomerId(sale.customerId || '');
    setEditCustomerName(sale.customerName || '');
    setEditCustomerPhone(sale.customerPhone || '');
    setEditTotalPaid(sale.totalPaid);
    setEditNotes(sale.notes || '');
    setEditError('');
  };

  const handleSaveEditSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToEdit) return;
    setEditError('');

    const res = updateSale({
      saleId: saleToEdit.id,
      date: editDate,
      customerId: editCustomerId || undefined,
      customerName: editCustomerName.trim() || undefined,
      customerPhone: editCustomerPhone.trim() || undefined,
      notes: editNotes.trim(),
      totalPaid: editTotalPaid,
    });

    if (!res.success) {
      setEditError(res.error || 'Erreur lors de la modification de la vente.');
    } else {
      setSaleToEdit(null);
    }
  };

  const handleOpenReturnModal = (sale: Sale) => {
    setSaleForReturn(sale);
    const initialSelections: Record<
      string,
      {
        selected: boolean;
        quantity: number;
        reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_RETRACTION' | 'OTHER';
        detail: string;
      }
    > = {};

    sale.items.forEach((it) => {
      const alreadyReturned = (sale.returns || []).reduce((sum, ret) => {
        const matching = ret.items.find((ri) => ri.articleId === it.articleId);
        return sum + (matching ? matching.quantity : 0);
      }, 0);
      const remainingQty = Math.max(0, it.quantity - alreadyReturned);

      initialSelections[it.articleId] = {
        selected: remainingQty > 0,
        quantity: remainingQty > 0 ? 1 : 0,
        reason: 'CUSTOMER_RETRACTION',
        detail: '',
      };
    });

    setReturnItemSelections(initialSelections);
    setReturnMethod('ESPECES');
    setReturnWarehouseId(sale.warehouseId);
    setReturnNotes('');
    setReturnError('');
  };

  const handleExecuteReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForReturn) return;
    setReturnError('');

    const itemsToReturn: {
      articleId: string;
      quantity: number;
      reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_RETRACTION' | 'OTHER';
      reasonDetail?: string;
      warehouseId?: string;
    }[] = [];

    Object.entries(returnItemSelections).forEach(([artId, val]) => {
      if (val.selected && val.quantity > 0) {
        itemsToReturn.push({
          articleId: artId,
          quantity: val.quantity,
          reason: val.reason,
          reasonDetail: val.detail || undefined,
          warehouseId: returnWarehouseId || saleForReturn.warehouseId,
        });
      }
    });

    if (itemsToReturn.length === 0) {
      setReturnError('Veuillez cocher au moins un article avec une quantité supérieure à 0.');
      return;
    }

    const res = processSaleReturn({
      saleId: saleForReturn.id,
      items: itemsToReturn,
      refundMethod: returnMethod,
      notes: returnNotes.trim() || undefined,
    });

    if (!res.success) {
      setReturnError(res.error || 'Erreur lors du traitement du retour.');
    } else {
      setSaleForReturn(null);
      if (res.returnRecord) {
        setCompletedReturnRecord(res.returnRecord);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Recherche par n° vente (VTE-2026-0001), reçu, client (Eiffage), vendeur..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter les ventes CSV
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* Payment status filter */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setSelectedPaymentStatus('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedPaymentStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toutes ({sales.length})
            </button>
            <button
              onClick={() => setSelectedPaymentStatus('PAID')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedPaymentStatus === 'PAID'
                  ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payées
            </button>
            <button
              onClick={() => setSelectedPaymentStatus('PARTIALLY_PAID')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedPaymentStatus === 'PARTIALLY_PAID'
                  ? 'bg-white text-amber-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partielles
            </button>
            <button
              onClick={() => setSelectedPaymentStatus('UNPAID')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedPaymentStatus === 'UNPAID'
                  ? 'bg-white text-rose-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Créances (Non payées)
            </button>
          </div>

          {/* Warehouse filter */}
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Tous les magasins</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>

          {/* Customer filter */}
          <select
            value={selectedCustomerFilter}
            onChange={(e) => setSelectedCustomerFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Tous les clients</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filteredSales.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 text-xs">
              Aucune vente ne correspond aux critères de recherche actuels.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th
                    onClick={() => toggleSort('receiptNumber')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    N° Vente & Reçu {renderSortIcon('receiptNumber')}
                  </th>
                  <th
                    onClick={() => toggleSort('date')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Date {renderSortIcon('date')}
                  </th>
                  <th
                    onClick={() => toggleSort('warehouseName')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Magasin {renderSortIcon('warehouseName')}
                  </th>
                  <th
                    onClick={() => toggleSort('customerName')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Client {renderSortIcon('customerName')}
                  </th>
                  <th
                    onClick={() => toggleSort('itemsCount')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Articles {renderSortIcon('itemsCount')}
                  </th>
                  <th
                    onClick={() => toggleSort('totalAmount')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Net à Payer {renderSortIcon('totalAmount')}
                  </th>
                  <th
                    onClick={() => toggleSort('totalPaid')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Encaissé {renderSortIcon('totalPaid')}
                  </th>
                  <th
                    onClick={() => toggleSort('remainingDue')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Reste Dû {renderSortIcon('remainingDue')}
                  </th>
                  <th
                    onClick={() => toggleSort('paymentStatus')}
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    Paiement {renderSortIcon('paymentStatus')}
                  </th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale, idx) => {
                  const isCancelled = sale.status === 'CANCELLED';
                  const isPaid = sale.paymentStatus === 'PAID';
                  const isPartial = sale.paymentStatus === 'PARTIALLY_PAID';
                  const returnBreakdown = getSaleReturnBreakdown(sale);
                  const netSaleTotal = getNetSaleAmount(sale);

                  return (
                    <tr
                      key={`${sale.id}-${idx}`}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCancelled ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      {/* VTE & Receipt */}
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900">{sale.receiptNumber}</span>
                          {sale.isHistoricalFrozen && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-800" title="Vente enregistrée avec le stock gelé (saisie historique sans déduction)">
                              <Snowflake className="w-2.5 h-2.5" />
                              <span>Gelé</span>
                            </span>
                          )}
                          {returnBreakdown.reimbursedAmount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800"
                              title="Montant remboursé directement au client suite à un retour de pièce (non comptabilisé en avoir)"
                            >
                              <Undo2 className="w-2.5 h-2.5" />
                              <span>Remboursé: -{formatFCFA(returnBreakdown.reimbursedAmount)}</span>
                            </span>
                          )}
                          {returnBreakdown.avoirAmount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800"
                              title="Montant comptabilisé en avoir sur le compte du client"
                            >
                              <Undo2 className="w-2.5 h-2.5" />
                              <span>Avoir: -{formatFCFA(returnBreakdown.avoirAmount)}</span>
                            </span>
                          )}
                          {returnBreakdown.debtDeductedAmount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800"
                              title="Montant déduit de la créance sur cette vente suite à un retour de pièce"
                            >
                              <Undo2 className="w-2.5 h-2.5" />
                              <span>Déduit créance: -{formatFCFA(returnBreakdown.debtDeductedAmount)}</span>
                            </span>
                          )}
                          {returnBreakdown.totalReturned > 0 &&
                            returnBreakdown.reimbursedAmount === 0 &&
                            returnBreakdown.avoirAmount === 0 &&
                            returnBreakdown.debtDeductedAmount === 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700"
                                title="Retour stock seul sans remboursement ni avoir"
                              >
                                <Undo2 className="w-2.5 h-2.5" />
                                <span>Retour: -{formatFCFA(returnBreakdown.totalReturned)}</span>
                              </span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block">
                          {sale.id}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                        {formatDateTime(sale.date)}
                        <span className="block text-[10px] text-slate-400">{sale.userName}</span>
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-medium">
                        {sale.warehouseName}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 font-medium text-slate-800 max-w-[140px] truncate">
                        {sale.customerName}
                        {sale.customerPhone && (
                          <span className="block text-[10px] text-slate-400">
                            {sale.customerPhone}
                          </span>
                        )}
                      </td>

                      {/* Items summary */}
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {sale.items.map((i) => `${i.quantity}x ${i.mainReference}`).join(', ')}
                      </td>

                      {/* Net Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatFCFA(netSaleTotal)}
                        {returnBreakdown.totalReturned > 0 && (
                          <span className="block text-[10px] text-slate-400 font-normal line-through">
                            {formatFCFA(sale.totalAmount)}
                          </span>
                        )}
                      </td>

                      {/* Paid */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        {formatFCFA(sale.totalPaid)}
                      </td>

                      {/* Remaining due */}
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {sale.remainingDue > 0 ? (
                          <span className="text-rose-600">{formatFCFA(sale.remainingDue)}</span>
                        ) : (
                          <span className="text-slate-400">0 FCFA</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                            Annulée
                          </span>
                        ) : sale.status === 'REFUNDED' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            {returnBreakdown.avoirAmount > 0 && returnBreakdown.reimbursedAmount === 0
                              ? 'Retourné (Avoir)'
                              : 'Remboursé'}
                          </span>
                        ) : isPaid ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Payé
                          </span>
                        ) : isPartial ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Partiel
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            À crédit
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Bouton Modifier Vente (Admin uniquement) */}
                          {currentUser.role === 'ADMIN' && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(sale)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                              title="Modifier cette vente (Admin : date, client, règlement)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Bouton Retour de Pièce / Remboursement ou Avoir */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(sale)}
                              className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded"
                              title="Retour de pièce (Remboursement ou Avoir client)"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setActiveReceiptSale(sale)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Imprimer Facture / Ticket (80mm & A4)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setActiveDeliveryNoteSale(sale)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded"
                            title="Imprimer le Bon de Livraison (BL) avec emplacements de préparation"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>

                          {!isCancelled && currentUser.role !== 'MAGASINIER' && (
                            <button
                              onClick={() => {
                                setSaleToCancel(sale);
                                setCancelReason('');
                                setCancelError('');
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              title="Annuler la vente et remettre en stock"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {currentUser.role !== 'MAGASINIER' && (
                            <button
                              type="button"
                              onClick={() => setSaleToDelete(sale)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Supprimer définitivement cette vente"
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
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total des ventes affichées : <strong>{filteredSales.length}</strong>
          </span>
          <span className="font-mono">
            Règle : Toute annulation remet physiquement les pièces en stock et conserve la trace complète.
          </span>
        </div>
      </div>

      {/* Sale Cancellation Modal */}
      {saleToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-rose-600">
                  {saleToCancel.receiptNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Procédure d'annulation de la vente
                </h3>
              </div>
              <button
                onClick={() => setSaleToCancel(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cette opération va <strong>remettre en stock</strong> les {saleToCancel.items.reduce((s, i) => s + i.quantity, 0)} pièce(s) dans le magasin <strong>{saleToCancel.warehouseName}</strong> et consigner un mouvement de régularisation d'entrée.
            </p>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleExecuteCancel} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif d'annulation obligatoire *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie référence, client a rapporté la pièce intacte..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {saleToCancel.totalPaid > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={refundCash}
                      onChange={(e) => setRefundCash(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      Rembourser les espèces ({formatFCFA(saleToCancel.totalPaid)}) depuis la caisse
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSaleToCancel(null)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Annuler l'action
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg shadow-xs"
                >
                  Confirmer l'annulation de la vente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Sale Deletion Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-rose-600">
                  {saleToDelete.receiptNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Supprimer définitivement la vente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Voulez-vous vraiment supprimer définitivement la vente <strong>{saleToDelete.receiptNumber}</strong> ({formatFCFA(saleToDelete.totalAmount)}) ?
              {saleToDelete.status !== 'CANCELLED' && saleToDelete.status !== 'REFUNDED' && (
                <span> Les pièces non retournées seront réintégrées au stock, l'éventuelle créance client sera annulée et cette transaction disparaîtra de tous les tableaux et rapports.</span>
              )}
            </p>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSale(saleToDelete.id);
                  setSaleToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer définitivement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      <ReceiptModal sale={activeReceiptSale} onClose={() => setActiveReceiptSale(null)} />

      {/* Delivery Note Preview */}
      <DeliveryNotePrintModal
        sale={activeDeliveryNoteSale}
        onClose={() => setActiveDeliveryNoteSale(null)}
      />

      {/* MODAL MODIFICATION DE VENTE (RÉSERVÉ ADMINISTRATEUR) */}
      {saleToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Modifier la vente {saleToEdit.receiptNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Action réservée à l'Administrateur ({currentUser.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaleToEdit(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditSale} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Date de la vente *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Client rattaché
                  </label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setEditCustomerId(cid);
                      const c = customers.find((cust) => cust.id === cid);
                      if (c) {
                        setEditCustomerName(c.name);
                        setEditCustomerPhone(c.phone || '');
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="">Client Comptoir Occasionnel</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Nom du client
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="Nom du client"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Téléphone client
                  </label>
                  <input
                    type="tel"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    placeholder="77 000 00 00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium font-mono"
                  />
                </div>
              </div>

              {/* Règlement financier */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-500">Montant Net Total :</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatFCFA(saleToEdit.totalAmount)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Montant Encaissé (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    max={saleToEdit.totalAmount}
                    step={500}
                    value={editTotalPaid}
                    onChange={(val) => setEditTotalPaid(val)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 font-medium">Reste dû (Créance) :</span>
                  <span className={`font-mono font-bold ${saleToEdit.totalAmount - editTotalPaid > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatFCFA(Math.max(0, saleToEdit.totalAmount - editTotalPaid))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Motif de la modification / Observations
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Rectification de la date de vente d'origine, mise à jour du client..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSaleToEdit(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RETOUR DE PIÈCES & AVOIR CLIENT */}
      {saleForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                  <Undo2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Retour de pièce(s) — Remboursement ou Avoir
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vente {saleForReturn.receiptNumber} · Client : {saleForReturn.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaleForReturn(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {returnError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {returnError}
              </div>
            )}

            {saleForReturn.remainingDue > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Vente à crédit / Solde restant dû : {formatFCFA(saleForReturn.remainingDue)}</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Cette vente comporte une créance en cours. La valeur des pièces retournées sera <strong>d&apos;abord déduite de la créance due par le client</strong>. Seul l&apos;éventuel surplus pourra faire l&apos;objet d&apos;un remboursement ou d&apos;un avoir.
                </p>
              </div>
            )}

            <form onSubmit={handleExecuteReturn} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  1. Sélection des articles à retourner et quantités
                </label>

                <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/40">
                  {saleForReturn.items.map((it) => {
                    const sel = returnItemSelections[it.articleId] || {
                      selected: false,
                      quantity: 0,
                      reason: 'CUSTOMER_RETRACTION',
                      detail: '',
                    };

                    const alreadyReturned = (saleForReturn.returns || []).reduce((sum, ret) => {
                      const match = ret.items.find((ri) => ri.articleId === it.articleId);
                      return sum + (match ? match.quantity : 0);
                    }, 0);
                    const maxReturnable = Math.max(0, it.quantity - alreadyReturned);

                    return (
                      <div
                        key={it.articleId}
                        className={`p-3 rounded-lg border transition-all ${
                          sel.selected
                            ? 'bg-white dark:bg-slate-800 border-sky-300 dark:border-sky-700 shadow-2xs'
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={sel.selected}
                              disabled={maxReturnable <= 0}
                              onChange={(e) => {
                                setReturnItemSelections((prev) => ({
                                  ...prev,
                                  [it.articleId]: {
                                    ...sel,
                                    selected: e.target.checked,
                                    quantity: e.target.checked ? (sel.quantity > 0 ? sel.quantity : 1) : 0,
                                  },
                                }));
                              }}
                              className="mt-1 rounded text-sky-600 focus:ring-sky-500"
                            />
                            <div>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {it.mainReference}
                              </span>
                              <span className="block text-[11px] text-slate-500">{it.designation}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(() => {
                                  const { netUnitPrice } = getSaleItemReturnRefund(
                                    saleForReturn,
                                    it,
                                    it.quantity
                                  );
                                  return (
                                    <>
                                      Vendu : {it.quantity} {it.unit} à {formatFCFA(netUnitPrice)}
                                      {netUnitPrice < it.unitPrice && (
                                        <span className="text-amber-600 ml-1">
                                          (net après remise · brut : {formatFCFA(it.unitPrice)})
                                        </span>
                                      )}
                                      {alreadyReturned > 0
                                        ? ` (Déjà retourné : ${alreadyReturned})`
                                        : ''}
                                    </>
                                  );
                                })()}
                              </span>
                            </div>
                          </label>

                          {maxReturnable > 0 ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-slate-400 font-semibold">Qte retour :</span>
                              <NumericInput
                                min={1}
                                max={maxReturnable}
                                disabled={!sel.selected}
                                value={sel.quantity}
                                onChange={(val) => {
                                  const clamped = Math.max(1, Math.min(maxReturnable, Math.floor(val)));
                                  setReturnItemSelections((prev) => ({
                                    ...prev,
                                    [it.articleId]: { ...sel, quantity: clamped },
                                  }));
                                }}
                                placeholder="1"
                                className="w-16 px-2 py-1 text-center font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                              />
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Totalement retourné</span>
                          )}
                        </div>

                        {sel.selected && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-500 font-medium block mb-0.5">Motif du retour :</span>
                                <select
                                  value={sel.reason}
                                  onChange={(e) => {
                                    setReturnItemSelections((prev) => ({
                                      ...prev,
                                      [it.articleId]: { ...sel, reason: e.target.value as any },
                                    }));
                                  }}
                                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                >
                                  <option value="CUSTOMER_RETRACTION">Rétractation / Non utilisé (Réintégré au stock)</option>
                                  <option value="WRONG_ITEM">Erreur de référence / Incompatible (Réintégré au stock)</option>
                                  <option value="DEFECTIVE">Pièce défectueuse / Problème usine (NON réintégrée au stock)</option>
                                  <option value="OTHER">Autre motif (Réintégré au stock)</option>
                                </select>
                              </div>

                              <div>
                                <span className="text-slate-500 font-medium block mb-0.5">Précision (optionnelle) :</span>
                                <input
                                  type="text"
                                  value={sel.detail}
                                  placeholder="Détail du problème..."
                                  onChange={(e) => {
                                    setReturnItemSelections((prev) => ({
                                      ...prev,
                                      [it.articleId]: { ...sel, detail: e.target.value },
                                    }));
                                  }}
                                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                />
                              </div>
                            </div>

                            {sel.reason === 'DEFECTIVE' ? (
                              <div className="px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-[10px] flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  Pièce défectueuse : le stock physique disponible ne sera PAS augmenté (le remboursement ou avoir client reste pris en compte).
                                </span>
                              </div>
                            ) : (
                              <div className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[10px] flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Cette pièce sera réintégrée au stock physique disponible.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Magasin de retour et mode de remboursement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Magasin de retour *
                  </label>
                  <select
                    value={returnWarehouseId}
                    onChange={(e) => setReturnWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Mode de remboursement ou Avoir *
                  </label>
                  <select
                    value={returnMethod}
                    onChange={(e) => setReturnMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="ESPECES">Remboursement Espèces immédiat (Sortie de caisse)</option>
                    <option value="WAVE">Remboursement Wave (Sortie Wave)</option>
                    <option value="ORANGE_MONEY">Remboursement Orange Money (Sortie OM)</option>
                    <option value="AVOIR_CLIENT">Avoir / Crédit sur compte client</option>
                    <option value="RETOUR_STOCK_SEUL">Retour stock seul (sans remboursement ni avoir)</option>
                  </select>
                </div>
              </div>

              {/* Calcul du montant du remboursement ou de l'avoir et déduction créance */}
              {(() => {
                const rawRefundEst = Object.entries(returnItemSelections).reduce(
                  (sum, [artId, val]) => {
                    if (!val.selected || val.quantity <= 0) return sum;
                    const item = saleForReturn.items.find((i) => i.articleId === artId);
                    if (!item) return sum;
                    return sum + getSaleItemReturnRefund(saleForReturn, item, val.quantity).lineRefund;
                  },
                  0
                );
                const previousReturnedTotal = (saleForReturn.returns || []).reduce(
                  (s, r) => s + (Number(r.totalRefundAmount) || 0),
                  0
                );
                const maxRemainingRefundable = Math.max(
                  0,
                  (Number(saleForReturn.totalAmount) || 0) - previousReturnedTotal
                );
                const totalRefundEst = Math.min(rawRefundEst, maxRemainingRefundable);

                const currentDebt = Math.max(0, saleForReturn.remainingDue || 0);
                const debtDeductionEst = Math.min(currentDebt, totalRefundEst);
                const surplusRefundEst = Math.max(0, totalRefundEst - debtDeductionEst);
                const remainingDebtAfterEst = Math.max(0, currentDebt - debtDeductionEst);
                const isDirectRefund =
                  returnMethod === 'ESPECES' ||
                  returnMethod === 'WAVE' ||
                  returnMethod === 'ORANGE_MONEY';

                return (
                  <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-sky-900 dark:text-sky-200 font-bold">
                        Valeur totale des pièces retournées :
                      </span>
                      <span className="text-base font-mono font-black text-sky-950 dark:text-white">
                        {formatFCFA(totalRefundEst)}
                      </span>
                    </div>

                    {currentDebt > 0 && (
                      <div className="pt-2 border-t border-sky-200/80 dark:border-sky-800/80 space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center text-amber-900 dark:text-amber-300 font-semibold">
                          <span>Déduction directe sur la créance de cette facture :</span>
                          <span className="font-mono font-bold">- {formatFCFA(debtDeductionEst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Reste dû sur la vente après retour :</span>
                          <span className="font-mono font-bold">{formatFCFA(remainingDebtAfterEst)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center font-bold pt-1.5 border-t border-dashed border-sky-200 dark:border-sky-800 text-[11px]">
                      <span className="text-slate-800 dark:text-slate-200">
                        {returnMethod === 'AVOIR_CLIENT'
                          ? 'Montant comptabilisé en Avoir client :'
                          : isDirectRefund
                          ? `Montant à rembourser au client (${returnMethod}) :`
                          : 'Montant financier :'}
                      </span>
                      <span
                        className={`font-mono text-xs ${
                          returnMethod === 'AVOIR_CLIENT'
                            ? 'text-indigo-700 font-black'
                            : isDirectRefund && surplusRefundEst > 0
                            ? 'text-rose-700 font-black'
                            : 'text-slate-600'
                        }`}
                      >
                        {returnMethod === 'RETOUR_STOCK_SEUL'
                          ? '0 FCFA'
                          : surplusRefundEst > 0
                          ? formatFCFA(surplusRefundEst)
                          : '0 FCFA (Imputé sur la créance)'}
                      </span>
                    </div>

                    <div className="text-[10px] text-sky-700 dark:text-sky-300">
                      {returnMethod === 'RETOUR_STOCK_SEUL'
                        ? 'Retour stock seul sans remboursement ni avoir.'
                        : isDirectRefund
                        ? '✓ Remboursement direct au client : ce montant est déduit de l’encaissement et n’est PAS comptabilisé dans les avoirs.'
                        : '✓ Avoir client : ce montant est crédité en avoir sur le compte du client.'}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Observations générales du retour
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Ex: Pièce retournée propre dans son carton d'origine..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSaleForReturn(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Valider le retour</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BON DE RETOUR — REMBOURSEMENT OU AVOIR CLIENT (PRINTABLE) */}
      {completedReturnRecord && (() => {
        const isAvoirSlip = completedReturnRecord.refundMethod === 'AVOIR_CLIENT';
        const isRefundSlip =
          completedReturnRecord.refundMethod === 'ESPECES' ||
          completedReturnRecord.refundMethod === 'WAVE' ||
          completedReturnRecord.refundMethod === 'ORANGE_MONEY';
        const slipTitle = isAvoirSlip
          ? 'BON DE RETOUR & AVOIR CLIENT'
          : isRefundSlip
          ? 'BON DE RETOUR & REMBOURSEMENT CLIENT'
          : 'BON DE RETOUR STOCK';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 print:hidden">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAvoirSlip
                      ? 'Retour & Avoir client enregistrés'
                      : isRefundSlip
                      ? 'Retour & Remboursement client enregistrés'
                      : 'Retour enregistré avec succès'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedReturnRecord(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Printable Slip */}
              <div
                id="printable-return-slip"
                className="p-4 bg-white text-black rounded-xl border border-slate-300 text-[13px] leading-snug space-y-3 font-sans font-semibold"
              >
                <div className="text-center pb-2.5 border-b-2 border-dashed border-black">
                  <h4 className="font-black text-base uppercase text-black">{companyInfo?.name || 'WKRLI'}</h4>
                  <p className="text-xs font-extrabold text-black uppercase mt-0.5">{slipTitle}</p>
                  <p className="text-xs font-black font-mono text-black mt-1">N° : {completedReturnRecord.returnNumber}</p>
                  <p className="text-xs font-bold text-black">Vente liée : {completedReturnRecord.saleReceiptNumber}</p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs text-black">
                  <div><span className="font-bold">Date :</span> <strong className="font-extrabold">{formatDateTime(completedReturnRecord.date)}</strong></div>
                  <div><span className="font-bold">Client :</span> <strong className="font-black">{completedReturnRecord.customerName}</strong></div>
                  <div><span className="font-bold">Dépôt :</span> <strong className="font-extrabold">{completedReturnRecord.warehouseName}</strong></div>
                  <div><span className="font-bold">Opérateur :</span> <strong className="font-extrabold">{completedReturnRecord.userName}</strong></div>
                </div>

                <div className="pt-2 border-t-2 border-dashed border-black space-y-2">
                  <div className="font-black text-xs text-black uppercase">Articles retournés :</div>
                  {completedReturnRecord.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2 text-xs py-1 border-b border-dotted border-black last:border-b-0">
                      <div className="min-w-0">
                        <strong className="font-black">{it.quantity}x</strong> <span className="font-black font-mono">{it.mainReference}</span> {it.brand ? `(${it.brand})` : ''}
                        <span className="block text-[11px] font-bold text-black">
                          Motif : {it.reason === 'DEFECTIVE' ? 'Défectueux — Non réintégré' : `${it.reason} — Réintégré`}
                        </span>
                      </div>
                      <span className="font-black font-mono whitespace-nowrap">{formatFCFA(it.totalRefund)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t-2 border-black space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-black">
                    <span>Valeur totale pièces retournées :</span>
                    <span className="font-mono font-black">{formatFCFA(completedReturnRecord.totalRefundAmount)}</span>
                  </div>
                  {completedReturnRecord.debtDeducted !== undefined && completedReturnRecord.debtDeducted > 0 && (
                    <div className="flex justify-between items-center text-xs text-black font-extrabold">
                      <span>Déduction sur créance client :</span>
                      <span className="font-mono font-black">- {formatFCFA(completedReturnRecord.debtDeducted)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-black text-black pt-1.5 border-t-2 border-dashed border-black">
                    <span>
                      {isAvoirSlip
                        ? 'AVOIR CLIENT CRÉDITÉ :'
                        : isRefundSlip && completedReturnRecord.cashRefunded && completedReturnRecord.cashRefunded > 0
                        ? `REMBOURSÉ (${completedReturnRecord.refundMethod}) :`
                        : 'IMPUTATION SUR CRÉANCE :'}
                    </span>
                    <span className="font-mono font-black text-black">
                      {completedReturnRecord.cashRefunded && completedReturnRecord.cashRefunded > 0
                        ? formatFCFA(completedReturnRecord.cashRefunded)
                        : '0 FCFA (Dette allégée)'}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-black pt-1">
                  Modalité :{' '}
                  <strong className="font-black">
                    {isAvoirSlip
                      ? 'Avoir sur compte client'
                      : isRefundSlip
                      ? `Remboursement ${completedReturnRecord.refundMethod}`
                      : 'Retour stock seul'}
                  </strong>
                  {completedReturnRecord.notes ? ` · Note : ${completedReturnRecord.notes}` : ''}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap justify-end gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => printElementById('printable-return-slip', 'TICKET_80MM')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAvoirSlip ? "Imprimer l'Avoir" : 'Imprimer le Bon de Retour'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadElementAsPdf(
                      'printable-return-slip',
                      `${isAvoirSlip ? 'Avoir' : 'Remboursement'}_${completedReturnRecord.returnNumber}`,
                      'TICKET_80MM'
                    )
                  }
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedReturnRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
