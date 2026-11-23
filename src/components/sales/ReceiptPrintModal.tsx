import React from 'react';
import { Sale } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { printElementById, downloadElementAsPdf } from '../../utils/pdfExporter';
import { Printer, X, Receipt, Download } from 'lucide-react';

interface ReceiptPrintModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({ sale, onClose }) => {
  const { companyInfo } = useStock();
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  if (!sale) return null;

  const handlePrint = () => {
    printElementById('printable-thermal-receipt', 'TICKET_80MM');
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf('printable-thermal-receipt', `Ticket_${sale.receiptNumber || sale.id}`, 'TICKET_80MM');
    } finally {
      setIsDownloadingPdf(false);
    }
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
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Télécharger directement le ticket en PDF"
            >
              <Download className="w-3.5 h-3.5" />
              {isDownloadingPdf ? '...' : 'PDF'}
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="max-h-[85vh] overflow-y-auto print:max-h-none">
          {/* 80mm Thermal Receipt Layout */}
          <div
            id="printable-thermal-receipt"
            className="p-5 font-sans text-[13px] leading-snug font-semibold text-black print:p-1 bg-white space-y-3"
          >
          {/* Header */}
          <div className="text-center space-y-1 border-b-2 border-dashed border-black pb-3">
            {companyInfo.logoUrl && (
              <img
                src={companyInfo.logoUrl}
                alt={companyInfo.name}
                className="w-9 h-9 object-contain mx-auto mb-1"
              />
            )}
            <h2 className="text-lg font-black tracking-tight uppercase text-black">{companyInfo.name || 'WKRLI'}</h2>
            {companyInfo.slogan && <p className="text-xs font-bold text-black">{companyInfo.slogan}</p>}
            {companyInfo.address && <p className="text-xs font-bold text-black">{companyInfo.address}</p>}
            {companyInfo.phone && <p className="text-xs font-extrabold text-black">Tél : {companyInfo.phone}</p>}
            {(companyInfo.ninea || companyInfo.rc) && (
              <p className="text-[11px] font-bold text-black">
                {companyInfo.ninea ? `NINEA : ${companyInfo.ninea}` : ''}
                {companyInfo.ninea && companyInfo.rc ? ' · ' : ''}
                {companyInfo.rc ? `RC : ${companyInfo.rc}` : ''}
              </p>
            )}
          </div>

          {/* Sale details */}
          <div className="border-b-2 border-dashed border-black pb-2.5 text-xs space-y-1">
            <div className="flex justify-between gap-2">
              <span className="font-bold text-black">Ticket N° :</span>
              <strong className="font-black font-mono text-black">{sale.receiptNumber || sale.id}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-bold text-black">Date :</span>
              <span className="font-extrabold text-black">{formatDate(sale.date)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-bold text-black">Magasin :</span>
              <span className="font-extrabold text-black">{sale.warehouseName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-bold text-black">Vendeur :</span>
              <span className="font-extrabold text-black">{sale.userName}</span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between gap-2">
                <span className="font-bold text-black">Client :</span>
                <strong className="font-black text-black">{sale.customerName}</strong>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-b-2 border-dashed border-black pb-2.5 space-y-2.5">
            {sale.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5 pb-1.5 border-b border-dotted border-black last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start gap-2 font-black text-[13px] text-black">
                  <span className="font-mono break-words">{item.mainReference}</span>
                  <span className="font-mono whitespace-nowrap">{formatFCFA(item.totalLine)}</span>
                </div>
                <div className="text-xs font-bold text-black leading-snug">{item.designation}</div>
                <div className="flex justify-between text-xs font-bold text-black">
                  <span>{item.quantity} x {formatFCFA(item.unitPrice)}</span>
                  {item.discountAmount > 0 && <span className="font-extrabold">(Rem. -{formatFCFA(item.discountAmount)})</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-xs border-b-2 border-dashed border-black pb-3">
            <div className="flex justify-between font-bold text-black">
              <span>Sous-total :</span>
              <span className="font-mono font-extrabold">{formatFCFA(sale.subtotal)}</span>
            </div>
            {sale.totalDiscount > 0 && (
              <div className="flex justify-between font-extrabold text-black">
                <span>Remise :</span>
                <span className="font-mono font-black">-{formatFCFA(sale.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-black pt-1.5 border-t-2 border-black">
              <span>TOTAL TTC :</span>
              <span className="font-mono font-black">{formatFCFA(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs font-extrabold text-black pt-1">
              <span>Montant Payé :</span>
              <span className="font-mono font-black">{formatFCFA(sale.totalPaid)}</span>
            </div>
            {sale.remainingDue > 0 ? (
              <div className="flex justify-between text-[13px] font-black text-black">
                <span>Reste Dû (Créance) :</span>
                <span className="font-mono font-black">{formatFCFA(sale.remainingDue)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-xs font-bold text-black">
                <span>Statut :</span>
                <span className="font-black uppercase text-black">SOLDÉ / PAYÉ</span>
              </div>
            )}
          </div>

          {/* Footer & Barcode mock */}
          <div className="text-center space-y-1 pt-1 text-xs text-black">
            <p className="font-black text-[13px]">Merci pour votre confiance !</p>
            <p className="font-bold text-[11px] text-black">Conservez ce ticket pour toute réclamation ou garantie (30 jours).</p>
            <div className="pt-1.5 font-mono font-black tracking-widest text-xs text-black">
              *|||| ||||| ||||||| |||||| ||||*
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
