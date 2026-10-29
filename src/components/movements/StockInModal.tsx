import React, { useState, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { Article } from '../../types';
import { formatFCFA } from '../../utils/formatters';
import { X, ArrowDownLeft, Building2, Package } from 'lucide-react';
import { ArticleSearchSelect } from '../common/ArticleSearchSelect';

interface StockInModalProps {
  isOpen: boolean;
  preselectedArticleId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({
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
    recordStockIn,
    currentUser,
  } = useStock();

  const [warehouseId, setWarehouseId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [reason, setReason] = useState('Réception commande fournisseur');
  const [notes, setNotes] = useState('');
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

      const art = articles.find((a) => a.id === defaultArt);
      if (art) {
        setUnitPrice(art.purchasePrice);
      }

      setQuantity(1);
      setSupplier('CFAO Équipement Sénégal');
      setDocumentRef(`BL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setReason('Réception commande fournisseur');
      setNotes('');
      setErrorMessage('');
    }
  }, [isOpen, preselectedArticleId, selectedWarehouseId, currentUser, warehouses, articles]);

  if (!isOpen) return null;

  const selectedArticle = articles.find((a) => a.id === articleId);
  const currentStock =
    warehouseId && articleId ? getStockForArticleAndWarehouse(articleId, warehouseId) : 0;
  const newStockPreview = currentStock + (Number(quantity) || 0);

  const handleArticleChange = (newArtId: string) => {
    setArticleId(newArtId);
    const art = articles.find((a) => a.id === newArtId);
    if (art) {
      setUnitPrice(art.purchasePrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!documentRef.trim()) {
      setErrorMessage('Le numéro de document (BL ou Facture) est obligatoire pour la traçabilité.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setErrorMessage('La quantité doit être un nombre entier positif.');
      return;
    }

    const result = recordStockIn({
      articleId,
      warehouseId,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      supplier: supplier.trim(),
      documentRef: documentRef.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de l’enregistrement de l’entrée.');
    } else {
      onSuccess(`Entrée de ${quantity} ${selectedArticle?.unit || 'pièce(s)'} enregistrée avec succès.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-900/60 rounded-lg">
              <ArrowDownLeft className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Entrée de Stock (Réception)</h2>
              <p className="text-xs text-emerald-200">
                Augmentation du stock physique et traçabilité comptable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Warehouse Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Magasin Destinataire *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
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
            onSelectArticle={(art) => {
              setArticleId(art.id);
              setUnitPrice(art.purchasePrice);
              if (art.preferredSupplier) {
                setSupplier(art.preferredSupplier);
              }
            }}
            warehouseId={warehouseId}
            getStockForWarehouse={getStockForArticleAndWarehouse}
            label="Article / Pièce Détachée"
            helperText="Recherche instantanée par texte"
            placeholder="Tapez réf (ex: 1R-0716), désignation, marque..."
          />

          {/* Stock Simulation Preview */}
          {selectedArticle && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Stock actuel sur ce site :</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {currentStock} {selectedArticle.unit}
                </span>
              </div>
              <div className="text-emerald-700 font-bold text-lg">➔</div>
              <div className="text-right">
                <span className="text-slate-500 block">Nouveau stock après entrée :</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {newStockPreview} {selectedArticle.unit}
                </span>
              </div>
            </div>
          )}

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Quantité reçue *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Prix unitaire d'achat (FCFA)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Total Cost Display */}
          <div className="text-right text-xs text-slate-600 font-medium">
            Valeur totale de l'entrée :{' '}
            <span className="font-mono font-bold text-slate-900">
              {formatFCFA((Number(quantity) || 0) * (Number(unitPrice) || 0))}
            </span>
          </div>

          {/* Document Reference & Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                N° Document (BL / Facture) *
              </label>
              <input
                type="text"
                required
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
                placeholder="Ex: BL-CFAO-2026-441"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Fournisseur
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Tractafric, CFAO, Donaldson"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Reason & Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Motif de l'opération
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Réception commande fournisseur n°..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Observations / N° de conteneur
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques éventuelles sur l'état des colis..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

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
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Valider l'entrée
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
