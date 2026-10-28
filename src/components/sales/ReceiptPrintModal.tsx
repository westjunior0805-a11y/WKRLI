import React from 'react';
import { Sale } from '../../types';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { Printer, X, Receipt, CheckCircle2 } from 'lucide-react';

interface ReceiptPrintModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-[80mm] print:m-0">
        {/* Top Action Bar (Hidden on print) */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold">Ticket de Caisse Comptoir (80mm)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded transition-colors inline-flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 80mm Thermal Receipt Layout */}
        <div className="p-6 overflow-y-auto font-mono text-[11px] leading-tight text-slate-950 print:p-2 bg-white space-y-4">
          {/* Header */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-sm font-black tracking-wider uppercase">EQUIPSTOCK PRO</h2>
            <p className="text-[10px] text-slate-600">Pièces Engins & Filtration Lourde</p>
            <p className="text-[10px] text-slate-600">Zone Industrielle Bel-Air, Dakar</p>
            <p className="text-[10px] text-slate-600">Tél : +221 33 849 20 10</p>
            <p className="text-[10px] text-slate-500">NINEA : 004829102-2B3</p>
          </div>

          {/* Sale details */}
          <div className="border-b border-dashed border-slate-300 pb-2 text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span>Ticket N° :</span>
              <strong className="font-bold">{sale.receiptNumber || sale.id}</strong>
            </div>
            <div className="flex justify-between">
              <span>Date :</span>
              <span>{formatDate(sale.date)}</span>
            </div>
            <div className="flex justify-between">
              <span>Magasin :</span>
              <span>{sale.warehouseName}</span>
            </div>
            <div className="flex justify-between">
              <span>Vendeur :</span>
              <span>{sale.userName}</span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between">
                <span>Client :</span>
                <strong>{sale.customerName}</strong>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-b border-dashed border-slate-300 pb-2 space-y-2">
            {sale.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span className="truncate max-w-[180px]">{item.mainReference}</span>
                  <span>{formatFCFA(item.totalLine)}</span>
                </div>
                <div className="text-[10px] text-slate-600 truncate">{item.designation}</div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{item.quantity} x {formatFCFA(item.unitPrice)}</span>
                  {item.discountAmount > 0 && <span>(Rem. -{formatFCFA(item.discountAmount)})</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between">
              <span>Sous-total :</span>
              <span>{formatFCFA(sale.subtotal)}</span>
            </div>
            {sale.totalDiscount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Remise :</span>
                <span>-{formatFCFA(sale.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-900">
              <span>TOTAL TTC :</span>
              <span>{formatFCFA(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[11px] pt-1">
              <span>Montant Payé :</span>
              <span>{formatFCFA(sale.totalPaid)}</span>
            </div>
            {sale.remainingDue > 0 ? (
              <div className="flex justify-between text-[11px] font-bold text-rose-700">
                <span>Reste Dû (Créance) :</span>
                <span>{formatFCFA(sale.remainingDue)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Statut :</span>
                <span className="font-bold uppercase text-emerald-800">SOLDÉ / PAYÉ</span>
              </div>
            )}
          </div>

          {/* Footer & Barcode mock */}
          <div className="text-center space-y-1 pt-1 text-[10px]">
            <p className="font-bold">Merci pour votre confiance !</p>
            <p className="text-slate-500">Conservez ce ticket pour toute réclamation ou garantie (30 jours).</p>
            <div className="pt-2 font-mono tracking-widest text-[9px] text-slate-400">
              *|||| ||||| ||||||| |||||| ||||*
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
