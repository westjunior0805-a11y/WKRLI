import React, { useState, useMemo } from 'react';
import { Quote, QuoteStatus, PaymentMethod } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate } from '../../utils/formatters';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  ArrowRight,
  User,
  Building2,
  Calendar,
  XCircle,
  TrendingUp,
  ShoppingCart,
  Banknote,
  DollarSign,
} from 'lucide-react';
import { CreateQuoteModal } from './CreateQuoteModal';
import { QuotePrintModal } from './QuotePrintModal';

export const QuoteListView: React.FC = () => {
  const { quotes, updateQuoteStatus, convertQuoteToSale } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuoteStatus>('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [quoteToPrint, setQuoteToPrint] = useState<Quote | null>(null);

  // Convert modal
  const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('ESPECES');
  const [conversionFeedback, setConversionFeedback] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNum = q.quoteNumber.toLowerCase().includes(query);
        const matchCust = q.customerName.toLowerCase().includes(query);
        const matchWh = q.warehouseName.toLowerCase().includes(query);
        const matchItem = q.items.some(
          (it) => it.mainReference.toLowerCase().includes(query) || it.designation.toLowerCase().includes(query)
        );
        if (!matchNum && !matchCust && !matchWh && !matchItem) return false;
      }
      return true;
    });
  }, [quotes, statusFilter, searchQuery]);

  const handleConfirmConvert = () => {
    if (!quoteToConvert) return;
    const res = convertQuoteToSale(quoteToConvert.id, selectedPaymentMethod);
    if (res.success) {
      setConversionFeedback(
        `Devis ${quoteToConvert.quoteNumber} converti en vente validée avec succès (${res.saleId}) ! Le stock a été décrémenté et l'encaissement enregistré.`
      );
      setQuoteToConvert(null);
    } else {
      alert(`Erreur de conversion : ${res.error}`);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            <Clock className="w-3 h-3" />
            Brouillon
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            Envoyé au client
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Accepté par le client
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 font-bold">
            <ShoppingCart className="w-3 h-3" />
            Converti en Vente
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3" />
            Refusé
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-4 h-4 text-slate-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Devis & Factures Proforma Clients
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Établissement des offres commerciales, impression au format proforma et conversion immédiate en vente
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nouveau Devis
        </button>
      </div>

      {conversionFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span>{conversionFeedback}</span>
          <button
            onClick={() => setConversionFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par N° devis, nom client, magasin ou référence..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Statut :</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="SENT">Envoyés</option>
            <option value="ACCEPTED">Acceptés</option>
            <option value="CONVERTED">Convertis en vente</option>
            <option value="REJECTED">Refusés</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">Aucun devis trouvé</h3>
              <p className="text-xs text-slate-500 mt-1">
                Créez une première proforma pour vos clients de chantiers ou mines.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Devis</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Magasin</th>
                  <th className="py-3 px-4 text-center">Pièces</th>
                  <th className="py-3 px-4 text-right">Montant Net TTC</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => {
                  const canConvert = quote.status !== 'CONVERTED' && quote.status !== 'REJECTED';

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {quote.quoteNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(quote.date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{quote.customerName}</div>
                        {quote.customerPhone && (
                          <div className="text-[11px] text-slate-400">{quote.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {quote.warehouseName}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {quote.items.length}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatFCFA(quote.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(quote.status)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print */}
                          <button
                            onClick={() => setQuoteToPrint(quote)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Imprimer le devis ou la proforma"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Status: mark accepted */}
                          {quote.status === 'SENT' && (
                            <button
                              onClick={() => updateQuoteStatus(quote.id, 'ACCEPTED')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded font-semibold text-[11px]"
                              title="Marquer comme accepté par le client"
                            >
                              Accepter
                            </button>
                          )}

                          {/* Convert to Sale */}
                          {canConvert && (
                            <button
                              onClick={() => setQuoteToConvert(quote)}
                              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded font-bold text-[11px] inline-flex items-center gap-1 shadow-2xs"
                              title="Convertir directement en vente et décrémenter le stock"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Convertir en Vente
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
      </div>

      {/* Convert to Sale confirmation modal */}
      {quoteToConvert && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Conversion de Devis en Vente</h3>
              </div>
              <button
                onClick={() => setQuoteToConvert(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700">
                Vous vous apprêtez à transformer le devis <strong>{quoteToConvert.quoteNumber}</strong> en vente ferme au comptoir :
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div>Client : <strong>{quoteToConvert.customerName}</strong></div>
                <div>Nombre d'articles : <strong>{quoteToConvert.items.length}</strong></div>
                <div>Montant total TTC : <strong className="font-mono text-emerald-700">{formatFCFA(quoteToConvert.totalAmount)}</strong></div>
              </div>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Mode de règlement initial :
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="ESPECES">Espèces (Tiroir de caisse)</option>
                  <option value="WAVE">Wave (Mobile Money)</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="VIREMENT">Virement bancaire</option>
                  <option value="CARTE">Carte bancaire</option>
                  <option value="CREDIT">À crédit (Porté au compte client)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Cette action va enregistrer la vente, décrémenter le stock dans le magasin <strong>{quoteToConvert.warehouseName}</strong>, et clôturer le devis.
              </p>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuoteToConvert(null)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                Valider la Vente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateQuoteModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => setConversionFeedback(msg)}
      />

      <QuotePrintModal
        quote={quoteToPrint}
        onClose={() => setQuoteToPrint(null)}
      />
    </div>
  );
};
