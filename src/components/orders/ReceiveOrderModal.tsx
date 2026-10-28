import React, { useState } from 'react';
import { SupplierOrder } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA } from '../../utils/formatters';
import { PackageCheck, X, AlertCircle, CheckCircle2, ShieldCheck, ArrowDownLeft } from 'lucide-react';

interface ReceiveOrderModalProps {
  order: SupplierOrder | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const ReceiveOrderModal: React.FC<ReceiveOrderModalProps> = ({
  order,
  onClose,
  onSuccess,
}) => {
  const { receiveSupplierOrder } = useStock();

  // Map each item to the quantity being received in this session
  const [receivedInputs, setReceivedInputs] = useState<Record<string, number>>(() => {
    if (!order) return {};
    const initial: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      initial[item.id] = remaining; // default propose remaining
    });
    return initial;
  });

  const [receptionNotes, setReceptionNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order) return null;

  const handleQtyChange = (itemId: string, val: number, maxRemaining: number) => {
    const cleanVal = Math.min(Math.max(0, val || 0), maxRemaining);
    setReceivedInputs((prev) => ({ ...prev, [itemId]: cleanVal }));
  };

  const handleReceiveAllRemaining = () => {
    const all: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      all[item.id] = remaining;
    });
    setReceivedInputs(all);
  };

  const totalItemsReceivingNow = Object.values(receivedInputs).reduce((sum, q) => sum + (q || 0), 0);

  const handleSubmit = () => {
    setErrorMessage(null);
    if (totalItemsReceivingNow <= 0) {
      setErrorMessage('Veuillez renseigner au moins une quantité à réceptionner supérieure à zéro.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = Object.entries(receivedInputs).map(([itemId, qty]) => ({
        itemId,
        quantityReceivedNow: qty,
      }));

      const res = receiveSupplierOrder({
        orderId: order.id,
        itemsReceived: itemsPayload,
        notes: receptionNotes,
      });

      if (res.success) {
        onSuccess(
          `Réception de ${totalItemsReceivingNow} pièce(s) validée avec succès dans "${order.targetWarehouseName}". Les entrées en stock et mouvements d'audit ont été enregistrés.`
        );
        onClose();
      } else {
        setErrorMessage(res.error || 'Erreur lors de la validation de la réception.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PackageCheck className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="font-bold text-base">Réception de Marchandise en Magasin</h3>
              <p className="text-xs text-emerald-100 font-mono">
                {order.orderNumber} · Fournisseur : {order.supplierName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Warehouse destination banner */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold block text-sm text-emerald-950">
                Magasin de réception : {order.targetWarehouseName}
              </span>
              <p className="mt-0.5 text-emerald-800">
                Chaque article réceptionné générera un mouvement d'audit automatique <strong>ENTREE</strong> et incrémentera le stock réel disponible dans ce magasin.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReceiveAllRemaining}
              className="px-2.5 py-1 bg-white border border-emerald-300 rounded text-emerald-800 font-semibold hover:bg-emerald-100 text-[11px] shrink-0"
            >
              Tout réceptionner
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Table of items */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Pièce détachée</th>
                  <th className="py-2.5 px-3 text-center">Commandé</th>
                  <th className="py-2.5 px-3 text-center">Déjà reçu</th>
                  <th className="py-2.5 px-3 text-center">Reste à livrer</th>
                  <th className="py-2.5 px-3 text-right w-36">Reçu ce jour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  const currentQtyNow = receivedInputs[item.id] || 0;
                  const isFullyReceived = remaining === 0;

                  return (
                    <tr key={item.id} className={isFullyReceived ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/50'}>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900">{item.mainReference}</div>
                        <div className="text-slate-600 font-medium">{item.designation}</div>
                        <div className="text-[11px] text-slate-400">{item.brand}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {item.quantityOrdered} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-700 font-semibold">
                        {item.quantityReceived}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {remaining}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isFullyReceived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complet
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={currentQtyNow}
                              onChange={(e) =>
                                handleQtyChange(item.id, parseInt(e.target.value, 10) || 0, remaining)
                              }
                              className="w-20 px-2.5 py-1 text-right font-mono font-bold border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-emerald-950"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">/ {remaining}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observations de réception / N° Bon de livraison transporteur (facultatif)
            </label>
            <input
              type="text"
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              placeholder="Ex: Reçu sans avarie par transporteur Bolloré, colis scellé conforme..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Total à enregistrer : <strong className="font-mono text-emerald-700 font-bold text-sm">{totalItemsReceivingNow}</strong> pièce(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalItemsReceivingNow <= 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-4 h-4" />
              {isSubmitting ? 'Enregistrement...' : 'Confirmer la Réception'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
