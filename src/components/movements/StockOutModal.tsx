import React, { useState, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { Article } from '../../types';
import { formatFCFA } from '../../utils/formatters';
import { X, ArrowUpRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ArticleSearchSelect } from '../common/ArticleSearchSelect';

interface StockOutModalProps {
  isOpen: boolean;
  preselectedArticleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockOutModal: React.FC<StockOutModalProps> = ({
  isOpen,
  preselectedArticleId,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    warehouses,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    recordStockOut,
    currentUser,
  } = useStock();

  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [client, setClient] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [reason, setReason] = useState('Sortie pour chantier BTP');
  const [notes, setNotes] = useState('');
  const [allowNegativeOverride, setAllowNegativeOverride] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const defaultWh =
        selectedWarehouseId ||
        (currentUser.role === 'MAGASINIER' && currentUser.assignedWarehouseId
          ? currentUser.assignedWarehouseId
          : warehouses[0]?.id || '');
      setWarehouseId(defaultWh);

      const defaultArt = preselectedArticleId || (articles[0]?.id || '');
      setArticleId(defaultArt);

      setQuantity(1);
      setClient('Eiffage Sénégal BTP');
      setDocumentRef(`BS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setReason('Sortie pour chantier BTP');
      setNotes('');
      setAllowNegativeOverride(false);
      setErrorMessage('');
    }
  }, [isOpen, preselectedArticleId, selectedWarehouseId, currentUser, warehouses, articles]);

  if (!isOpen) return null;

  const selectedArticle = articles.find((a) => a.id === articleId);
  const currentStock =
    warehouseId && articleId ? getStockForArticleAndWarehouse(articleId, warehouseId) : 0;
  const isNegativeRisk = quantity > currentStock;
  const newStockPreview = currentStock - (Number(quantity) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!documentRef.trim()) {
      setErrorMessage('Le numéro de document (Bon de sortie / Ordre) est obligatoire.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setErrorMessage('La quantité doit être un nombre entier positif.');
      return;
    }

    // Safety check on negative stock
    if (isNegativeRisk && (!allowNegativeOverride || currentUser.role !== 'ADMIN')) {
      setErrorMessage(
        `Opération rejetée : le stock disponible (${currentStock}) est inférieur à la quantité demandée (${quantity}). Le système interdit le passage en stock négatif.`
      );
      return;
    }

    const result = recordStockOut({
      articleId,
      warehouseId,
      quantity: Number(quantity),
      client: client.trim(),
      documentRef: documentRef.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      allowNegativeOverride,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de la sortie de stock.');
    } else {
      onSuccess(`Sortie de ${quantity} ${selectedArticle?.unit || 'pièce(s)'} validée.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-rose-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-900/60 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sortie de Stock</h2>
              <p className="text-xs text-rose-200">
                Livraison client, dotation atelier ou maintenance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-300 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Warehouse Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Magasin de départ (Source) *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 font-medium"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name} ({wh.location})
                </option>
              ))}
            </select>
          </div>

          {/* Article Selection with searchable combobox */}
          <ArticleSearchSelect
            articles={articles}
            selectedArticleId={articleId}
            onSelectArticle={(art) => setArticleId(art.id)}
            warehouseId={warehouseId}
            getStockForWarehouse={getStockForArticleAndWarehouse}
            label="Article / Pièce Détachée"
            helperText="Recherche instantanée par texte"
            placeholder="Tapez réf (ex: 1R-0716), désignation, marque..."
          />

          {/* Stock Simulation & Warning */}
          {selectedArticle && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                isNegativeRisk
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Stock actuel disponible :</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currentStock} {selectedArticle.unit}
                  </span>
                </div>
                <div className="font-bold text-lg text-slate-400">➔</div>
                <div className="text-right">
                  <span className="text-slate-500 block">Stock résultant :</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      isNegativeRisk ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {newStockPreview} {selectedArticle.unit}
                  </span>
                </div>
              </div>

              {isNegativeRisk && (
                <div className="mt-2 pt-2 border-t border-rose-200 text-rose-700 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Attention : la quantité demandée ({quantity}) dépasse le stock disponible ({currentStock}).
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Quantité à sortir *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
            />
          </div>

          {/* Document Reference & Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                N° Document (Bon de sortie / OT) *
              </label>
              <input
                type="text"
                required
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                placeholder="Ex: BS-2026-901"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Bénéficiaire / Client
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ex: Eiffage Sénégal, CSE, Sabodala"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Motif de sortie
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Sortie pour chantier BTP">Sortie pour chantier BTP</option>
              <option value="Vente directe au comptoir">Vente directe au comptoir</option>
              <option value="Dotation atelier maintenance">Dotation atelier maintenance</option>
              <option value="Dépannage d'urgence sur mine">Dépannage d'urgence sur mine</option>
              <option value="Retour pièce défectueuse fournisseur">Retour pièce défectueuse fournisseur</option>
              <option value="Avarie ou casse magasin">Avarie ou casse magasin</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Observations / N° de machine cible
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Destiné à la pelle CAT 336D n° parc PE-04..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          {/* Negative stock override (Strictly Admin only) */}
          {isNegativeRisk && currentUser.role === 'ADMIN' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNegativeOverride}
                  onChange={(e) => setAllowNegativeOverride(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold block">Dérogation exceptionnelle Administrateur</span>
                  <span>
                    J'autorise expressément le forçage de cette sortie bien qu'elle dépasse le stock physique théorique. Cette opération sera spécifiquement tracée.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Submit */}
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
              disabled={isNegativeRisk && (!allowNegativeOverride || currentUser.role !== 'ADMIN')}
              className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-4 h-4" />
              Valider la sortie
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
