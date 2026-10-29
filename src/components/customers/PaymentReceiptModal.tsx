import React from 'react';
import { Customer, PaymentRecord, Warehouse } from '../../types';
import { formatFCFA, formatDateTime } from '../../utils/formatters';
import { Printer, X, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface PaymentReceiptModalProps {
  payment: PaymentRecord | null;
  customer: Customer | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  payment,
  customer,
  onClose,
}) => {
  const { getWarehouseById } = useStock();

  if (!payment) return null;

  const warehouse: Warehouse | undefined = getWarehouseById(payment.warehouseId);
  const isAcompte = payment.paymentType === 'ACOMPTE_CLIENT';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
        {/* Modal Controls (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {isAcompte ? 'Reçu d’Acompte Client' : 'Reçu de Règlement Client'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50 flex justify-center">
          <div
            id="printable-payment-receipt"
            className="bg-white text-slate-900 shadow-sm border border-slate-200 p-6 sm:p-8 w-full text-xs font-sans space-y-4 rounded-lg"
          >
            {/* Header / Brand */}
            <div className="text-center border-b border-slate-200 pb-4">
              <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                EQUIPSTOCK PRO
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Pièces de Rechange Engins Lourds & Filtration Industrielle
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {warehouse?.name || 'Magasin Central'} • {warehouse?.location || 'Dakar, Sénégal'}
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded text-slate-800 font-mono font-bold text-xs uppercase tracking-wider">
                {isAcompte ? "BON D'ENCAISSEMENT D'ACOMPTE" : 'QUITTANCE DE RÈGLEMENT DE CRÉANCE'}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 p-3 rounded border border-slate-200/80">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">N° Reçu / Pièce</span>
                <span className="font-mono font-bold text-slate-900">{payment.id}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Date & Heure</span>
                <span className="font-mono text-slate-800">{formatDateTime(payment.date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Client Bénéficiaire</span>
                <span className="font-bold text-slate-900">{customer?.name || payment.customerName || 'Client'}</span>
                {customer?.code && (
                  <span className="block font-mono text-[10px] text-slate-500">Code : {customer.code}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Mode de Paiement</span>
                <span className="font-semibold text-slate-800 uppercase">{payment.method}</span>
                {payment.reference && (
                  <span className="block font-mono text-[10px] text-slate-500">Réf : {payment.reference}</span>
                )}
              </div>
            </div>

            {/* Amount Box */}
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center space-y-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Montant Reçu & Encaissé
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-900">
                {formatFCFA(payment.amount)}
              </div>
              <p className="text-[11px] text-emerald-700 italic">
                {payment.notes || (isAcompte ? 'Acompte / avance sur commande' : 'Règlement de facture/créance')}
              </p>
            </div>

            {/* Account Situation */}
            {customer && (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-1.5">
                <div className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider mb-1 border-b border-slate-200 pb-1">
                  Situation du compte client à ce jour
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Solde créance restant dû :</span>
                  <span className={`font-mono font-bold ${customer.outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                    {formatFCFA(customer.outstandingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Acompte / Avoir disponible en compte :</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatFCFA(customer.depositBalance || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Signatures & Stamp */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
              <div className="border border-dashed border-slate-300 rounded p-4 h-24 flex flex-col justify-between">
                <span>Signature du Client</span>
                <span className="text-[9px] text-slate-400 italic">Pour accord et accusé de versement</span>
              </div>
              <div className="border border-dashed border-slate-300 rounded p-4 h-24 flex flex-col justify-between">
                <span>Cachet & Opérateur Caissier</span>
                <span className="font-semibold text-slate-800">{payment.userName}</span>
              </div>
            </div>

            <div className="text-center text-[9px] text-slate-400 pt-2">
              Document officiel à conserver précieusement • Émis par EquipStock Pro ERP
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer le reçu
          </button>
        </div>
      </div>
    </div>
  );
};
