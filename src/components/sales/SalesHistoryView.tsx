import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Sale } from '../../types';
import { formatFCFA, formatDateTime, exportToCSV } from '../../utils/formatters';
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
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';

export const SalesHistoryView: React.FC = () => {
  const { sales, warehouses, customers, cancelOrRefundSale, currentUser } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('ALL');
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [activeDeliveryNoteSale, setActiveDeliveryNoteSale] = useState<Sale | null>(null);

  // Cancellation modal state
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundCash, setRefundCash] = useState(true);
  const [cancelError, setCancelError] = useState('');

  // Filter logic
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (selectedWarehouseFilter !== 'ALL' && s.warehouseId !== selectedWarehouseFilter) return false;
      if (selectedPaymentStatus !== 'ALL' && s.paymentStatus !== selectedPaymentStatus) return false;
      if (selectedCustomerFilter !== 'ALL' && s.customerId !== selectedCustomerFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = s.id.toLowerCase().includes(q);
        const matchRec = s.receiptNumber.toLowerCase().includes(q);
        const matchCust = s.customerName.toLowerCase().includes(q);
        const matchUser = s.userName.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        if (!matchId && !matchRec && !matchCust && !matchUser && !matchNotes) return false;
      }

      return true;
    });
  }, [sales, selectedWarehouseFilter, selectedPaymentStatus, selectedCustomerFilter, searchQuery]);

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
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
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
                  <th className="py-3 px-3">N° Vente & Reçu</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Magasin</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Articles</th>
                  <th className="py-3 px-3 text-right">Net à Payer</th>
                  <th className="py-3 px-3 text-right">Encaissé</th>
                  <th className="py-3 px-3 text-right">Reste Dû</th>
                  <th className="py-3 px-3 text-center">Paiement</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale, idx) => {
                  const isCancelled = sale.status === 'CANCELLED';
                  const isPaid = sale.paymentStatus === 'PAID';
                  const isPartial = sale.paymentStatus === 'PARTIALLY_PAID';

                  return (
                    <tr
                      key={`${sale.id}-${idx}`}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCancelled ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      {/* VTE & Receipt */}
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                        <span className="text-slate-900 block">{sale.receiptNumber}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
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
                        {formatFCFA(sale.totalAmount)}
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

      {/* Receipt Preview */}
      <ReceiptModal sale={activeReceiptSale} onClose={() => setActiveReceiptSale(null)} />

      {/* Delivery Note Preview */}
      <DeliveryNotePrintModal
        sale={activeDeliveryNoteSale}
        onClose={() => setActiveDeliveryNoteSale(null)}
      />
    </div>
  );
};
