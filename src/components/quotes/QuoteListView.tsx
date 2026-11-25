import React, { useState, useMemo } from 'react';
import { Quote, QuoteStatus, PaymentMethod } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { fuzzyFilter } from '../../utils/fuzzySearch';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  XCircle,
  ShoppingCart,
  Trash2,
  ExternalLink,
  Edit2,
} from 'lucide-react';
import { CreateQuoteModal } from './CreateQuoteModal';
import { QuotePrintModal } from './QuotePrintModal';
import { TablePagination, SortableTh, usePagination } from '../common/TablePagination';
import { RowActionsMenu } from '../common/RowActionsMenu';
import { SearchField } from '../common/SearchField';

interface QuoteListViewProps {
  onNavigateToSales?: () => void;
}

type QuoteSortField =
  | 'quoteNumber'
  | 'date'
  | 'customerName'
  | 'warehouseName'
  | 'itemsCount'
  | 'totalAmount'
  | 'status';

export const QuoteListView: React.FC<QuoteListViewProps> = ({ onNavigateToSales }) => {
  const { quotes, updateQuoteStatus, deleteQuote, convertQuoteToSale } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuoteStatus>('ALL');
  const [sortField, setSortField] = useState<QuoteSortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<Quote | null>(null);
  const [quoteToPrint, setQuoteToPrint] = useState<Quote | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

  // Convert modal
  const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('ESPECES');
  const [conversionFeedback, setConversionFeedback] = useState<string | null>(null);

  const toggleSort = (field: QuoteSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' || field === 'totalAmount' || field === 'itemsCount' ? 'desc' : 'asc');
    }
  };

  const filteredQuotes = useMemo(() => {
    const base = quotes.filter((q) => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      return true;
    });
    const searched = fuzzyFilter(base, searchQuery, (q) => [
      q.quoteNumber,
      q.customerName,
      q.warehouseName,
      ...q.items.map((it) => `${it.mainReference} ${it.designation}`),
    ]);

    return [...searched].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'quoteNumber':
          cmp = (a.quoteNumber || '').localeCompare(b.quoteNumber || '', 'fr', { numeric: true });
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'customerName':
          cmp = (a.customerName || '').localeCompare(b.customerName || '', 'fr', { sensitivity: 'base' });
          break;
        case 'warehouseName':
          cmp = (a.warehouseName || '').localeCompare(b.warehouseName || '', 'fr', { sensitivity: 'base' });
          break;
        case 'itemsCount':
          cmp = a.items.length - b.items.length;
          break;
        case 'totalAmount':
          cmp = (a.totalAmount || 0) - (b.totalAmount || 0);
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '', 'fr');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [quotes, statusFilter, searchQuery, sortField, sortDir]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedItems: paginatedQuotes,
  } = usePagination(filteredQuotes, 15);

  const handleConfirmConvert = () => {
    if (!quoteToConvert) return;
    const res = convertQuoteToSale(quoteToConvert.id, selectedPaymentMethod);
    if (res.success) {
      setConversionFeedback(
        `Devis ${quoteToConvert.quoteNumber} converti en vente validée avec succès (${res.saleId}) ! Le stock a été décrémenté et l'encaissement enregistré.`
      );
      setQuoteToConvert(null);
    } else {
      setConversionFeedback(`Erreur de conversion : ${res.error}`);
      setQuoteToConvert(null);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
            <Clock className="w-3 h-3 shrink-0" />
            Brouillon
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 shrink-0" />
            Envoyé
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Accepté
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
            <ShoppingCart className="w-3 h-3 shrink-0" />
            Converti
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3 shrink-0" />
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
            Établissement, modification avant validation, impression proforma et conversion immédiate en vente
          </p>
        </div>

        <button
          onClick={() => {
            setQuoteToEdit(null);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
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
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          className="flex-1"
          placeholder="N° devis ou client..."
        />

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Statut :</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="DRAFT">Brouillons</option>
            <option value="SENT">Envoyés</option>
            <option value="ACCEPTED">Acceptés</option>
            <option value="CONVERTED">Convertis en vente</option>
            <option value="REJECTED">Refusés</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">Aucun devis trouvé</h3>
              <p className="text-xs text-slate-500 mt-1">
                Créez une première proforma pour vos clients de chantiers ou mines.
              </p>
            </div>
          ) : (
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <SortableTh
                    label="N° Devis"
                    active={sortField === 'quoteNumber'}
                    direction={sortDir}
                    onClick={() => toggleSort('quoteNumber')}
                    className="w-[15%]"
                  />
                  <SortableTh
                    label="Date"
                    active={sortField === 'date'}
                    direction={sortDir}
                    onClick={() => toggleSort('date')}
                    className="w-[11%]"
                  />
                  <SortableTh
                    label="Client"
                    active={sortField === 'customerName'}
                    direction={sortDir}
                    onClick={() => toggleSort('customerName')}
                    className="w-[22%]"
                  />
                  <SortableTh
                    label="Magasin"
                    active={sortField === 'warehouseName'}
                    direction={sortDir}
                    onClick={() => toggleSort('warehouseName')}
                    className="w-[15%] hidden sm:table-cell"
                  />
                  <SortableTh
                    label="Pièces"
                    active={sortField === 'itemsCount'}
                    direction={sortDir}
                    onClick={() => toggleSort('itemsCount')}
                    align="center"
                    className="w-[7%] hidden md:table-cell"
                  />
                  <SortableTh
                    label="Montant Net"
                    active={sortField === 'totalAmount'}
                    direction={sortDir}
                    onClick={() => toggleSort('totalAmount')}
                    align="right"
                    className="w-[14%]"
                  />
                  <SortableTh
                    label="Statut"
                    active={sortField === 'status'}
                    direction={sortDir}
                    onClick={() => toggleSort('status')}
                    align="center"
                    className="w-[10%]"
                  />
                  <th className="py-2.5 px-2.5 text-right w-[6%]">Opt.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedQuotes.map((quote) => {
                  const canEdit = quote.status !== 'CONVERTED';
                  const canConvert = quote.status !== 'CONVERTED' && quote.status !== 'REJECTED';

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900 truncate">
                        {quote.quoteNumber}
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-600 text-[11px] truncate">
                        {formatDate(quote.date)}
                      </td>
                      <td className="py-2.5 px-2.5 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{quote.customerName}</div>
                        {quote.customerPhone && (
                          <div className="text-[10px] text-slate-400 truncate">{quote.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-600 truncate hidden sm:table-cell">
                        {quote.warehouseName}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-800 hidden md:table-cell">
                        {quote.items.length}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatFCFA(quote.totalAmount)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        {getStatusBadge(quote.status)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <RowActionsMenu
                          actions={[
                            {
                              label: 'Modifier le devis',
                              icon: <Edit2 className="w-3.5 h-3.5" />,
                              tone: 'warning',
                              hidden: !canEdit,
                              onClick: () => {
                                setQuoteToEdit(quote);
                                setIsCreateOpen(true);
                              },
                            },
                            {
                              label: 'Imprimer / Proforma',
                              icon: <Printer className="w-3.5 h-3.5" />,
                              onClick: () => setQuoteToPrint(quote),
                            },
                            {
                              label: 'Marquer comme accepté',
                              icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                              tone: 'success',
                              hidden: quote.status !== 'SENT' && quote.status !== 'DRAFT',
                              onClick: () => updateQuoteStatus(quote.id, 'ACCEPTED'),
                            },
                            {
                              label: 'Convertir en Vente',
                              icon: <ShoppingCart className="w-3.5 h-3.5" />,
                              tone: 'primary',
                              hidden: !canConvert,
                              onClick: () => setQuoteToConvert(quote),
                            },
                            {
                              label: 'Voir dans Factures & Ventes',
                              icon: <ExternalLink className="w-3.5 h-3.5" />,
                              tone: 'primary',
                              hidden: !(quote.status === 'CONVERTED' && onNavigateToSales),
                              onClick: () => onNavigateToSales && onNavigateToSales(),
                            },
                            {
                              label: 'Supprimer ce devis',
                              icon: <Trash2 className="w-3.5 h-3.5" />,
                              tone: 'danger',
                              dividerBefore: true,
                              onClick: () => setQuoteToDelete(quote),
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
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredQuotes.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="devis"
        />
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
        isOpen={isCreateOpen || !!quoteToEdit}
        quoteToEdit={quoteToEdit}
        onClose={() => {
          setIsCreateOpen(false);
          setQuoteToEdit(null);
        }}
        onSuccess={(msg) => setConversionFeedback(msg)}
      />

      <QuotePrintModal
        quote={quoteToPrint}
        onClose={() => setQuoteToPrint(null)}
      />

      {/* Delete Quote Confirmation Modal */}
      {quoteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirmer la suppression du devis
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {quoteToDelete.quoteNumber} — {quoteToDelete.customerName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setQuoteToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
              <p>
                Voulez-vous vraiment supprimer définitivement le devis proforma{' '}
                <strong>{quoteToDelete.quoteNumber}</strong> ({quoteToDelete.customerName} —{' '}
                {formatFCFA(quoteToDelete.totalAmount)}) ?
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuoteToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteQuote(quoteToDelete.id);
                  if (res.message) setConversionFeedback(res.message);
                  setQuoteToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
