import React, { useState } from 'react';
import { Sale, Warehouse } from '../../types';
import { formatFCFA, formatDateTime } from '../../utils/formatters';
import { Printer, X, Download, Truck, CheckCircle2, AlertCircle, FileCheck, MapPin } from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  initialFormat?: 'THERMAL' | 'A4' | 'BL';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  initialFormat = 'THERMAL',
}) => {
  const { getWarehouseById, articles } = useStock();
  const [format, setFormat] = useState<'THERMAL' | 'A4' | 'BL'>(initialFormat);

  if (!sale) return null;

  const warehouse: Warehouse | undefined = getWarehouseById(sale.warehouseId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
        {/* Modal Controls Top Bar (Hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-amber-400" />
              <span>
                {format === 'BL'
                  ? `Bon de Livraison BL-${sale.receiptNumber}`
                  : `Reçu ${sale.receiptNumber}`}
              </span>
            </h3>
            {/* Format switch */}
            <div className="hidden sm:inline-flex p-0.5 bg-slate-800 rounded text-xs">
              <button
                type="button"
                onClick={() => setFormat('THERMAL')}
                className={`px-2 py-1 rounded transition-colors ${
                  format === 'THERMAL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Ticket Caisse (80mm)
              </button>
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`px-2 py-1 rounded transition-colors ${
                  format === 'A4' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Facture A4
              </button>
              <button
                type="button"
                onClick={() => setFormat('BL')}
                className={`px-2 py-1 rounded transition-colors ${
                  format === 'BL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Bon Livraison (BL)
              </button>
            </div>
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

        {/* Scrollable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 flex justify-center">
          {/* RECEIPT PAPER CONTAINER */}
          <div
            id="printable-receipt"
            className={`bg-white text-slate-900 shadow-sm border border-slate-200 p-6 sm:p-8 transition-all ${
              format === 'THERMAL' ? 'max-w-[420px] w-full text-xs font-mono' : 'w-full text-sm font-sans'
            }`}
          >
            {/* Store Header */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Truck className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-base tracking-tight uppercase">
                  EquipStock Pro Sénégal
                </span>
              </div>
              <p className="font-semibold text-slate-800">
                {warehouse?.name || sale.warehouseName}
              </p>
              <p className="text-slate-500 text-[11px]">{warehouse?.location || 'Dakar - Sénégal'}</p>
              <p className="text-slate-500 text-[11px]">Tél : {warehouse?.phone || '+221 33 800 00 00'}</p>
              <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-wider">
                Pièces détachées d'engins lourds & filtration
              </div>
            </div>

            {/* Receipt metadata */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">N° Reçu :</span>
                <span className="font-bold font-mono text-slate-900">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Réf. Vente :</span>
                <span className="font-mono text-slate-700">{sale.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Heure :</span>
                <span className="text-slate-800">{formatDateTime(sale.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vendeur / Caissier :</span>
                <span className="text-slate-800 font-medium">{sale.userName}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Client :</span>
                <span className="font-bold text-slate-900 text-right">{sale.customerName}</span>
              </div>
              {sale.customerPhone && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Tél Client :</span>
                  <span className="text-slate-600">{sale.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="py-3 border-b border-dashed border-slate-300">
              <div className="font-bold uppercase text-[11px] text-slate-500 mb-2 flex justify-between">
                <span>Désignation / Réf {format === 'BL' && '· Emplacement en Rayon'}</span>
                <span>Total</span>
              </div>
              <div className="space-y-2">
                {sale.items.map((it, idx) => {
                  const art = articles.find((a) => a.id === it.articleId);
                  const locText =
                    art?.defaultLocation ||
                    (art?.rack ? `${art.rack} ${art.shelf ? `· ${art.shelf}` : ''} ${art.bin ? `· ${art.bin}` : ''}` : null);
                  return (
                    <div key={idx} className="text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-slate-900 font-mono block">
                            {it.mainReference}
                          </span>
                          <span className="text-slate-600 text-[11px] block">{it.designation}</span>

                          {/* Shelf location for BL picker */}
                          {format === 'BL' && (
                            <div className="inline-flex items-center gap-1 my-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px] font-semibold">
                              <MapPin className="w-3 h-3 text-amber-600" />
                              <span>{locText || 'Emplacement standard'}</span>
                            </div>
                          )}

                          <span className="text-slate-400 text-[10px] block">
                            {it.quantity} {it.unit} × {formatFCFA(it.unitPrice)}
                            {it.discountAmount > 0 && (
                              <span className="text-emerald-700 ml-1">
                                (Remise: -{formatFCFA(it.discountAmount)})
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-slate-900 whitespace-nowrap">
                          {formatFCFA(it.totalLine)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals & Payments */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total articles :</span>
                <span className="font-mono">{formatFCFA(sale.subtotal)}</span>
              </div>
              {sale.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Total remises accordées :</span>
                  <span className="font-mono">-{formatFCFA(sale.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm sm:text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>NET À PAYER :</span>
                <span className="font-mono">{formatFCFA(sale.totalAmount)}</span>
              </div>

              {/* Payments breakdown */}
              <div className="pt-2 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Montant encaissé :</span>
                  <span className="font-mono">{formatFCFA(sale.totalPaid)}</span>
                </div>
                {sale.remainingDue > 0 && (
                  <div className="flex justify-between font-bold text-rose-700">
                    <span>SOLDE RESTANT DÛ (CRÉANCE) :</span>
                    <span className="font-mono">{formatFCFA(sale.remainingDue)}</span>
                  </div>
                )}
                {sale.remainingDue <= 0 && (
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px] pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Payé intégralement</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes if any */}
            {sale.notes && (
              <div className="py-2 text-[11px] text-slate-500 italic border-b border-dashed border-slate-300">
                Note : {sale.notes}
              </div>
            )}

            {/* BL Signature Boxes */}
            {format === 'BL' && (
              <div className="pt-4 pb-2 border-b border-slate-300 grid grid-cols-2 gap-4 text-[10px]">
                <div className="border border-slate-300 rounded p-2.5 h-20 flex flex-col justify-between">
                  <span className="font-bold text-slate-700 uppercase">Magasin / Sortie :</span>
                  <span className="text-slate-400 text-[9px] italic">Visa & Date</span>
                </div>
                <div className="border border-slate-300 rounded p-2.5 h-20 flex flex-col justify-between">
                  <span className="font-bold text-slate-700 uppercase">Décharge Réception Client :</span>
                  <span className="text-slate-400 text-[9px] italic">Nom, Date & Signature</span>
                </div>
              </div>
            )}

            {/* Legal / Non-tax Disclaimer */}
            <div className="pt-4 text-center text-[10px] text-slate-400 space-y-1">
              <p className="font-medium text-slate-500">
                {format === 'BL' ? 'Matériel reçu en bon état conforme à la commande' : 'Merci de votre confiance !'}
              </p>
              <p className="italic leading-tight">
                * Justificatif commercial de délivrance de stock. Ce document interne ne constitue pas une facture fiscale certifiée.
              </p>
              <p className="font-mono text-[9px] text-slate-300">
                EquipStock Pro v2.0 - Imprimé le {formatDateTime(new Date().toISOString())}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
