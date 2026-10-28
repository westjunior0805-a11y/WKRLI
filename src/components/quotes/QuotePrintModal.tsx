import React from 'react';
import { Quote } from '../../types';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { Printer, X, FileText, Building2, User, CheckCircle2 } from 'lucide-react';

interface QuotePrintModalProps {
  quote: Quote | null;
  onClose: () => void;
}

export const QuotePrintModal: React.FC<QuotePrintModalProps> = ({ quote, onClose }) => {
  if (!quote) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Top Action Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-sm font-bold block">Devis / Facture Proforma Client</span>
              <span className="text-xs text-slate-300 font-mono">{quote.quoteNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimer / Exporter PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 overflow-y-auto max-h-[80vh] print:max-h-none print:overflow-visible print:p-6 text-slate-900 space-y-8 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-xs">
                  ESP
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">EQUIPSTOCK PRO</h1>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                    Comptoir Pièces d'Engins & Filtration Industrielle
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 space-y-0.5">
                <p>Zone Industrielle Bel-Air, Dakar, Sénégal</p>
                <p>NINEA: 004829102-2B3 · RC: SN-DKR-2023-B-1402</p>
                <p>Tél : +221 33 849 20 10 / +221 77 450 88 00 · ventes@equipstock.sn</p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-900 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                FACTURE PROFORMA / DEVIS
              </span>
              <h2 className="text-lg font-black font-mono text-slate-900">{quote.quoteNumber}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Date : <span className="font-semibold text-slate-800">{formatDate(quote.date)}</span>
              </p>
              <p className="text-xs text-slate-500">
                Validité jusqu'au : <span className="font-semibold text-slate-800">{quote.validUntil}</span>
              </p>
            </div>
          </div>

          {/* Customer & Origin info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Destinataire / Client
              </span>
              <p className="font-bold text-sm text-slate-900">{quote.customerName}</p>
              {quote.customerPhone && <p className="text-slate-600 mt-1">Téléphone : {quote.customerPhone}</p>}
              {quote.customerEmail && <p className="text-slate-600">Email : {quote.customerEmail}</p>}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Magasin Émetteur
              </span>
              <p className="font-bold text-sm text-slate-900">{quote.warehouseName}</p>
              <p className="text-slate-600 mt-1">Conseiller Commercial : {quote.createdByName}</p>
              <p className="text-slate-600">Statut : <strong className="font-mono">{quote.status}</strong></p>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Réf. Constructeur</th>
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3 text-right">Qté</th>
                  <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                  <th className="py-2.5 px-3 text-right">Remise</th>
                  <th className="py-2.5 px-3 text-right">Total Net (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((item, idx) => (
                  <tr key={item.articleId} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.mainReference}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{item.designation}</div>
                      <div className="text-[11px] text-slate-400">{item.brand}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatFCFA(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatFCFA(item.totalLine)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Terms */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="flex-1 text-xs text-slate-600 space-y-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">Conditions de l'offre :</span>
                <p>{quote.terms || 'Offre valable 30 jours à compter de la date d’émission. Règlement par chèque, virement ou espèces au comptoir.'}</p>
              </div>
              {quote.notes && (
                <p className="text-[11px] text-slate-500 italic">
                  Observations : {quote.notes}
                </p>
              )}
            </div>

            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total brut :</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatFCFA(quote.subtotal)}
                </span>
              </div>
              {quote.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Remise accordée :</span>
                  <span className="font-mono font-semibold">
                    -{formatFCFA(quote.totalDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Net à Payer (TTC) :</span>
                <span className="font-mono text-emerald-700 text-base">
                  {formatFCFA(quote.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center">
            <div className="p-4 border border-slate-200 rounded-lg h-28 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Bon pour accord & Signature Client</span>
              <span className="text-[10px] text-slate-400">Mention « Bon pour commande » + Cachet</span>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg h-28 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Direction Commerciale EquipStock Pro</span>
              <span className="text-[10px] text-slate-400">{quote.createdByName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
