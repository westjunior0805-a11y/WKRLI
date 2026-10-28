import React, { useState, useEffect } from 'react';
import { Article, Supplier } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA } from '../../utils/formatters';
import { Truck, Plus, Trash2, X, AlertCircle, Calendar, Building2, Search } from 'lucide-react';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  initialItems?: Array<{
    articleId: string;
    quantityOrdered: number;
    purchasePrice: number;
  }>;
  initialSupplierName?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  initialItems,
  initialSupplierName,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    warehouses,
    suppliers,
    createSupplierOrder,
    createSupplier,
    getTotalStockForArticle,
  } = useStock();

  const [supplierName, setSupplierName] = useState(initialSupplierName || '');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState(warehouses[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [additionalFees, setAdditionalFees] = useState(0);
  const [notes, setNotes] = useState('');

  // Items to order
  const [orderLines, setOrderLines] = useState<
    Array<{
      articleId: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>
  >([]);

  // Search article dropdown
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [selectedArticleIdToAdd, setSelectedArticleIdToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(5);
  const [priceToAdd, setPriceToAdd] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setOrderLines(initialItems);
    } else {
      setOrderLines([]);
    }
    if (initialSupplierName) {
      setSupplierName(initialSupplierName);
      const foundSupp = suppliers.find(
        (s) => s.name.toLowerCase().includes(initialSupplierName.toLowerCase())
      );
      if (foundSupp) {
        setSupplierContact(`${foundSupp.contactPerson || ''} (${foundSupp.phone || ''})`.trim());
        setSupplierEmail(foundSupp.email || '');
      }
    }
  }, [initialItems, initialSupplierName, suppliers, isOpen]);

  if (!isOpen) return null;

  const handleSelectSupplier = (suppId: string) => {
    const supp = suppliers.find((s) => s.id === suppId);
    if (supp) {
      setSupplierName(supp.name);
      setSupplierContact(`${supp.contactPerson || ''} (${supp.phone || ''})`.trim());
      setSupplierEmail(supp.email || '');
    }
  };

  const handleSelectArticleToAdd = (artId: string) => {
    setSelectedArticleIdToAdd(artId);
    const art = articles.find((a) => a.id === artId);
    if (art) {
      setPriceToAdd(art.purchasePrice);
      const stock = getTotalStockForArticle(art.id);
      const suggested = Math.max(1, art.minStockThreshold * 2 - stock);
      setQtyToAdd(suggested);
    }
  };

  const handleAddLine = () => {
    if (!selectedArticleIdToAdd) return;
    const exists = orderLines.some((l) => l.articleId === selectedArticleIdToAdd);
    if (exists) {
      setOrderLines((prev) =>
        prev.map((l) =>
          l.articleId === selectedArticleIdToAdd
            ? { ...l, quantityOrdered: l.quantityOrdered + qtyToAdd }
            : l
        )
      );
    } else {
      setOrderLines((prev) => [
        ...prev,
        {
          articleId: selectedArticleIdToAdd,
          quantityOrdered: qtyToAdd,
          purchasePrice: priceToAdd,
        },
      ]);
    }
    setSelectedArticleIdToAdd('');
    setArticleSearchQuery('');
  };

  const handleRemoveLine = (articleId: string) => {
    setOrderLines((prev) => prev.filter((l) => l.articleId !== articleId));
  };

  const handleUpdateLineQty = (articleId: string, q: number) => {
    setOrderLines((prev) =>
      prev.map((l) => (l.articleId === articleId ? { ...l, quantityOrdered: Math.max(1, q || 1) } : l))
    );
  };

  const handleUpdateLinePrice = (articleId: string, p: number) => {
    setOrderLines((prev) =>
      prev.map((l) => (l.articleId === articleId ? { ...l, purchasePrice: Math.max(0, p || 0) } : l))
    );
  };

  const subtotal = orderLines.reduce((sum, l) => sum + l.quantityOrdered * l.purchasePrice, 0);
  const total = subtotal + (additionalFees || 0);

  const filteredArticles = articles
    .filter(
      (a) =>
        a.mainReference.toLowerCase().includes(articleSearchQuery.toLowerCase()) ||
        a.designation.toLowerCase().includes(articleSearchQuery.toLowerCase()) ||
        a.brand.toLowerCase().includes(articleSearchQuery.toLowerCase())
    )
    .slice(0, 8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierName.trim()) {
      setErrorMessage('Veuillez renseigner le nom du fournisseur.');
      return;
    }

    if (orderLines.length === 0) {
      setErrorMessage('Veuillez ajouter au moins un article à la commande.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = createSupplierOrder({
        supplierName,
        supplierContact,
        supplierEmail,
        targetWarehouseId,
        items: orderLines,
        additionalFees,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes,
      });

      if (res.success && res.order) {
        onSuccess(`Bon de commande ${res.order.orderNumber} créé avec succès (${orderLines.length} articles).`);
        onClose();
      } else {
        setErrorMessage(res.error || 'Erreur lors de la création de la commande.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Nouvelle Commande Fournisseur (PO)</h3>
              <p className="text-xs text-slate-300">
                Génération d'un bon de commande avec réapprovisionnement et valorisation
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto max-h-[72vh]">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Supplier & Warehouse settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fournisseur habituel ou raison sociale *
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ex: Tractafric, BIA, Techni-Filtres..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  {suppliers.length > 0 && (
                    <select
                      onChange={(e) => handleSelectSupplier(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px]"
                    >
                      <option value="">Sélectionner dans le carnet fournisseurs...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Fournisseur (Téléphone / Nom)
                </label>
                <input
                  type="text"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="+221 33 839 ... / Marc Delvaux"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Magasin de destination / Réception *
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date de livraison souhaitée (optionnel)
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Frais de port / douane (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  value={additionalFees}
                  onChange={(e) => setAdditionalFees(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email commande
                </label>
                <input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="commandes@fournisseur.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Quick Add Article Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Ajouter des articles à commander
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div className="sm:col-span-6 relative">
                  <input
                    type="text"
                    value={articleSearchQuery}
                    onChange={(e) => setArticleSearchQuery(e.target.value)}
                    placeholder="Chercher référence (1R-0716, P551313...), désignation..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white"
                  />
                  {articleSearchQuery && filteredArticles.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                      {filteredArticles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            handleSelectArticleToAdd(art.id);
                            setArticleSearchQuery(`${art.mainReference} - ${art.designation}`);
                          }}
                          className="p-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">
                              {art.mainReference}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
                              {art.brand}
                            </span>
                            <span className="text-slate-600 truncate">{art.designation}</span>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px]">
                            {formatFCFA(art.purchasePrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={1}
                    value={qtyToAdd}
                    onChange={(e) => setQtyToAdd(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    placeholder="Qté"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-center bg-white"
                    title="Quantité à commander"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={0}
                    value={priceToAdd}
                    onChange={(e) => setPriceToAdd(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Prix Achat"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-right bg-white"
                    title="Prix d'achat unitaire (FCFA)"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={!selectedArticleIdToAdd}
                    className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Order Lines Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Réf. Constructeur & Désignation</th>
                    <th className="py-2.5 px-3 text-right w-28">Quantité</th>
                    <th className="py-2.5 px-3 text-right w-36">Prix Achat (FCFA)</th>
                    <th className="py-2.5 px-3 text-right w-36">Total Ligne</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Aucun article sélectionné. Ajoutez des pièces ci-dessus.
                      </td>
                    </tr>
                  ) : (
                    orderLines.map((line) => {
                      const art = articles.find((a) => a.id === line.articleId);
                      const lineTotal = line.quantityOrdered * line.purchasePrice;

                      return (
                        <tr key={line.articleId} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-slate-900">{art?.mainReference}</div>
                            <div className="text-slate-600 font-medium">{art?.designation}</div>
                            <div className="text-[11px] text-slate-400">{art?.brand}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              value={line.quantityOrdered}
                              onChange={(e) =>
                                handleUpdateLineQty(line.articleId, parseInt(e.target.value, 10))
                              }
                              className="w-20 px-2 py-1 text-right font-mono font-bold border border-slate-200 rounded bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={line.purchasePrice}
                              onChange={(e) =>
                                handleUpdateLinePrice(line.articleId, parseInt(e.target.value, 10))
                              }
                              className="w-28 px-2 py-1 text-right font-mono border border-slate-200 rounded bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(lineTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.articleId)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instructions ou remarques sur la commande (facultatif)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Livraison par conteneur groupé, conditionnement étanche..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-500">Montant total commande : </span>
              <span className="font-mono font-bold text-base text-slate-900 ml-1">
                {formatFCFA(total)}
              </span>
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
                type="submit"
                disabled={isSubmitting || orderLines.length === 0}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 font-bold"
              >
                <Truck className="w-4 h-4" />
                {isSubmitting ? 'Création...' : 'Valider le Bon de Commande'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
