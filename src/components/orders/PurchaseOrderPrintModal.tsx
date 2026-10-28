import React from 'react';
import { SupplierOrder } from '../../types';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { Printer, X, Download, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface PurchaseOrderPrintModalProps {
  order: SupplierOrder | null;
  onClose: () => void;
}

export const PurchaseOrderPrintModal: React.FC<PurchaseOrderPrintModalProps> = ({
  order,
  onClose,
}) => {
  if (!order) return null;

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
              <span className="text-sm font-bold block">Bon de Commande Fournisseur</span>
              <span className="text-xs text-slate-300 font-mono">{order.orderNumber}</span>
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
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
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
                    Pièces Détachées Engins Lourds & Filtration
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 space-y-0.5">
                <p>Zone Industrielle Bel-Air, Km 3.5 Boulevard du Centenaire</p>
                <p>Dakar, République du Sénégal · NINEA: 004829102-2B3</p>
                <p>Tél : +221 33 849 20 10 / +221 77 450 88 00 · contact@equipstock.sn</p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-900 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                BON DE COMMANDE
              </span>
              <h2 className="text-lg font-black font-mono text-slate-900">{order.orderNumber}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Date d'émission : <span className="font-semibold text-slate-800">{formatDate(order.date)}</span>
              </p>
              {order.expectedDeliveryDate && (
                <p className="text-xs text-slate-500">
                  Livraison souhaitée : <span className="font-semibold text-slate-800">{order.expectedDeliveryDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Supplier & Destination Warehouses Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2">
                Fournisseur
              </span>
              <p className="font-bold text-sm text-slate-900">{order.supplierName}</p>
              {order.supplierContact && <p className="text-slate-600 mt-1">Contact : {order.supplierContact}</p>}
              {order.supplierEmail && <p className="text-slate-600">Email : {order.supplierEmail}</p>}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2">
                Lieu de Livraison / Réception
              </span>
              <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-600" />
                {order.targetWarehouseName}
              </p>
              <p className="text-slate-600 mt-1">Émis par : {order.createdByName}</p>
              <p className="text-slate-600">Statut : <strong className="font-mono">{order.status}</strong></p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Réf. Constructeur</th>
                  <th className="py-2.5 px-3">Désignation & Marque</th>
                  <th className="py-2.5 px-3 text-right">Qté Commandée</th>
                  <th className="py-2.5 px-3 text-right">Prix Unitaire Achat</th>
                  <th className="py-2.5 px-3 text-right">Montant Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.mainReference}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{item.designation}</div>
                      <div className="text-[11px] text-slate-500">{item.brand}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {item.quantityOrdered} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatFCFA(item.purchasePrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatFCFA(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="flex-1 text-xs text-slate-600 space-y-2">
              {order.notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg text-amber-950">
                  <span className="font-bold block mb-0.5">Instructions logistiques :</span>
                  {order.notes}
                </div>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ce bon de commande engage notre société sous réserve de conformité des références et des spécifications techniques à la livraison. Tout colis endommagé ou non conforme sera refusé.
              </p>
            </div>

            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total articles :</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatFCFA(order.items.reduce((s, it) => s + it.lineTotal, 0))}
                </span>
              </div>
              {order.additionalFees > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Frais transport / Douane :</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatFCFA(order.additionalFees)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Commande :</span>
                <span className="font-mono text-emerald-700 text-base">
                  {formatFCFA(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center">
            <div className="p-4 border border-slate-200 rounded-lg h-28 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Visa / Signature Fournisseur (Accusé de réception)</span>
              <span className="text-[10px] text-slate-400">Date et cachet</span>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg h-28 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Direction des Approvisionnements EquipStock Pro</span>
              <span className="text-[10px] text-slate-400">Amadou Ndiaye · Directeur Logistique</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
