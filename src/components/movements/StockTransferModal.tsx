import React, { useState, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { Article } from '../../types';
import { X, ArrowLeftRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ArticleSearchSelect } from '../common/ArticleSearchSelect';

interface StockTransferModalProps {
  isOpen: boolean;
  preselectedArticleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  preselectedArticleId,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    warehouses,
    getStockForArticleAndWarehouse,
    recordTransfer,
  } = useStock();

  const [sourceWhId, setSourceWhId] = useState('');
  const [targetWhId, setTargetWhId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [documentRef, setDocumentRef] = useState('');
  const [reason, setReason] = useState('Réapprovisionnement de dépôt');
  const [notes, setNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const src = warehouses[0]?.id || '';
      const tgt = warehouses[1]?.id || '';
      setSourceWhId(src);
      setTargetWhId(tgt);

      setArticleId(preselectedArticleId || articles[0]?.id || '');
      setQuantity(1);
      setDocumentRef(`BT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setReason('Réapprovisionnement de dépôt régional');
      setNotes('');
      setIsConfirming(false);
      setErrorMessage('');
    }
  }, [isOpen, preselectedArticleId, warehouses, articles]);

  if (!isOpen) return null;

  const sourceWh = warehouses.find((w) => w.id === sourceWhId);
  const targetWh = warehouses.find((w) => w.id === targetWhId);
  const selectedArticle = articles.find((a) => a.id === articleId);

  const availableAtSource =
    sourceWhId && articleId ? getStockForArticleAndWarehouse(articleId, sourceWhId) : 0;
  const targetCurrentStock =
    targetWhId && articleId ? getStockForArticleAndWarehouse(articleId, targetWhId) : 0;

  const isQuantityValid = quantity > 0 && quantity <= availableAtSource;
  const isWarehousesValid = sourceWhId !== targetWhId && !!sourceWhId && !!targetWhId;

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isWarehousesValid) {
      setErrorMessage('Le magasin de départ et le magasin d’arrivée doivent être différents.');
      return;
    }
    if (quantity <= 0) {
      setErrorMessage('La quantité doit être supérieure à zéro.');
      return;
    }
    if (quantity > availableAtSource) {
      setErrorMessage(
        `Stock insuffisant au départ de ${sourceWh?.name}. Disponible : ${availableAtSource}, demandé : ${quantity}.`
      );
      return;
    }
    if (!documentRef.trim()) {
      setErrorMessage('Le numéro de bordereau de transfert est obligatoire.');
      return;
    }

    setIsConfirming(true);
  };

  const handleExecuteTransfer = () => {
    const result = recordTransfer({
      articleId,
      sourceWarehouseId: sourceWhId,
      targetWarehouseId: targetWhId,
      quantity: Number(quantity),
      documentRef: documentRef.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors du transfert.');
      setIsConfirming(false);
    } else {
      onSuccess(
        `Transfert de ${quantity} ${selectedArticle?.unit || 'pièce(s)'} de ${sourceWh?.code} vers ${targetWh?.code} exécuté avec succès.`
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-amber-600 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-700/30 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Transfert Inter-Magasins
              </h2>
              <p className="text-xs text-slate-900 font-medium">
                Déplacement physique et traçabilité bilatérale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-950/70 hover:text-slate-950 p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isConfirming ? (
          <form onSubmit={handleSubmitStep1} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Warehouse Source & Destination Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  1. Magasin de départ (Source) *
                </label>
                <select
                  value={sourceWhId}
                  onChange={(e) => setSourceWhId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  2. Magasin d'arrivée (Cible) *
                </label>
                <select
                  value={targetWhId}
                  onChange={(e) => setTargetWhId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sourceWhId === targetWhId && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                Le magasin de départ et le magasin d'arrivée ne peuvent pas être identiques.
              </div>
            )}

            {/* Article Selection with searchable combobox */}
            <ArticleSearchSelect
              articles={articles}
              selectedArticleId={articleId}
              onSelectArticle={(art) => setArticleId(art.id)}
              warehouseId={sourceWhId}
              getStockForWarehouse={getStockForArticleAndWarehouse}
              label="3. Pièce à transférer"
              helperText="Recherche instantanée par texte"
              placeholder="Tapez réf (ex: 1R-0716), désignation, marque..."
            />

            {/* Visual Transfer preview box */}
            {selectedArticle && sourceWh && targetWh && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-5/12 text-center p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{sourceWh.name}</span>
                    <span className="font-mono text-xs text-slate-500 block">
                      Dispo : <strong>{availableAtSource}</strong>
                    </span>
                    <span className="font-mono font-bold text-amber-700 block text-xs mt-0.5">
                      Après : {Math.max(0, availableAtSource - (Number(quantity) || 0))}
                    </span>
                  </div>

                  <div className="text-amber-600 font-bold text-base">➔</div>

                  <div className="w-5/12 text-center p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{targetWh.name}</span>
                    <span className="font-mono text-xs text-slate-500 block">
                      Actuel : <strong>{targetCurrentStock}</strong>
                    </span>
                    <span className="font-mono font-bold text-emerald-700 block text-xs mt-0.5">
                      Après : {targetCurrentStock + (Number(quantity) || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  4. Quantité à transférer *
                </label>
                <span className="text-xs text-slate-500">
                  Max disponible : <strong className="font-mono text-slate-800">{availableAtSource}</strong>
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={availableAtSource}
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Document Ref & Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  N° Bordereau de transfert *
                </label>
                <input
                  type="text"
                  required
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  placeholder="Ex: BT-2026-042"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif du transfert
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Réapprovisionnement chantier..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Transporteur / Véhicule de liaison
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Camionnette liaison Dakar-Thiès, Chauffeur Moussa..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            {/* Next Step */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!isQuantityValid || !isWarehousesValid}
                className="px-5 py-2 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                Vérifier & Confirmer
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation Step 2 */
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-sm space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Confirmation formelle du transfert
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Vous êtes sur le point d'effectuer un transfert officiel :
              </p>
              <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5 font-medium">
                <div>
                  Article : <strong>{selectedArticle?.mainReference}</strong> ({selectedArticle?.designation})
                </div>
                <div>
                  Quantité : <strong className="font-mono text-sm">{quantity} {selectedArticle?.unit}</strong>
                </div>
                <div>
                  Départ : <strong>{sourceWh?.name}</strong> ({sourceWh?.code})
                </div>
                <div>
                  Destination : <strong>{targetWh?.name}</strong> ({targetWh?.code})
                </div>
                <div>
                  Bordereau : <strong className="font-mono">{documentRef}</strong>
                </div>
              </div>
              <p className="text-[11px] text-amber-800">
                Règle ERP : Les stocks seront modifiés de manière atomique. Aucun élément ne sera créé ni supprimé artificiellement.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Valider définitivement le transfert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
