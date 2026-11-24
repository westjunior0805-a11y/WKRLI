import React, { useState, useEffect } from 'react';
import { Quote } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA } from '../../utils/formatters';
import { FileText, Plus, Trash2, X, AlertCircle, User } from 'lucide-react';
import { NumericInput } from '../common/NumericInput';

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  quoteToEdit?: Quote | null;
}

export const CreateQuoteModal: React.FC<CreateQuoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  quoteToEdit = null,
}) => {
  const { customers, articles, warehouses, createQuote, updateQuote } = useStock();
  const isEditMode = Boolean(quoteToEdit);

  const [customerMode, setCustomerMode] = useState<'EXISTING' | 'MANUAL'>('EXISTING');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    'Offre valable 30 jours. Règlement : 50% à la commande, solde à la livraison.'
  );

  const [quoteLines, setQuoteLines] = useState<
    Array<{
      articleId: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
    }>
  >([]);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtToAdd, setSelectedArtToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [priceToAdd, setPriceToAdd] = useState(0);
  const [discToAdd, setDiscToAdd] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (quoteToEdit) {
      const hasExistingCustomer =
        Boolean(quoteToEdit.customerId) &&
        customers.some((c) => c.id === quoteToEdit.customerId);
      setCustomerMode(hasExistingCustomer ? 'EXISTING' : 'MANUAL');
      setSelectedCustomerId(hasExistingCustomer ? quoteToEdit.customerId || '' : '');
      setCustomerName(quoteToEdit.customerName || '');
      setCustomerPhone(quoteToEdit.customerPhone || '');
      setCustomerEmail(quoteToEdit.customerEmail || '');
      setTargetWarehouseId(
        quoteToEdit.warehouseId ||
          warehouses.find((w) => w.isDefault)?.id ||
          warehouses[0]?.id ||
          ''
      );
      setValidUntil(quoteToEdit.validUntil || new Date().toISOString().slice(0, 10));
      setNotes(quoteToEdit.notes || '');
      setTerms(
        quoteToEdit.terms ||
          'Offre valable 30 jours. Règlement : 50% à la commande, solde à la livraison.'
      );
      setQuoteLines(
        quoteToEdit.items.map((it) => ({
          articleId: it.articleId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent || 0,
        }))
      );
    } else {
      setCustomerMode('EXISTING');
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '';
      setTargetWarehouseId(defaultWh);
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setValidUntil(d.toISOString().slice(0, 10));
      setNotes('');
      setTerms('Offre valable 30 jours. Règlement : 50% à la commande, solde à la livraison.');
      setQuoteLines([]);
    }
    setSearchQuery('');
    setSelectedArtToAdd('');
    setQtyToAdd(1);
    setPriceToAdd(0);
    setDiscToAdd(0);
    setErrorMessage(null);
  }, [isOpen, quoteToEdit]);

  if (!isOpen) return null;

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || '');
      setCustomerEmail(c.email || '');
    }
  };

  const handleSelectArticleToAdd = (artId: string) => {
    setSelectedArtToAdd(artId);
    const art = articles.find((a) => a.id === artId);
    if (art) {
      setPriceToAdd(art.salePrice);
      setQtyToAdd(1);
      setDiscToAdd(0);
    }
  };

  const handleAddLine = () => {
    if (!selectedArtToAdd) return;
    const exists = quoteLines.find((l) => l.articleId === selectedArtToAdd);
    if (exists) {
      setQuoteLines((prev) =>
        prev.map((l) =>
          l.articleId === selectedArtToAdd ? { ...l, quantity: l.quantity + qtyToAdd } : l
        )
      );
    } else {
      setQuoteLines((prev) => [
        ...prev,
        {
          articleId: selectedArtToAdd,
          quantity: qtyToAdd,
          unitPrice: priceToAdd,
          discountPercent: discToAdd,
        },
      ]);
    }
    setSelectedArtToAdd('');
    setSearchQuery('');
  };

  const handleRemoveLine = (artId: string) => {
    setQuoteLines((prev) => prev.filter((l) => l.articleId !== artId));
  };

  const handleUpdateLine = (
    artId: string,
    field: 'quantity' | 'unitPrice' | 'discountPercent',
    val: number
  ) => {
    setQuoteLines((prev) =>
      prev.map((l) => {
        if (l.articleId !== artId) return l;
        if (field === 'quantity') return { ...l, quantity: Math.max(1, Math.floor(val)) };
        if (field === 'discountPercent') return { ...l, discountPercent: Math.min(100, Math.max(0, val)) };
        return { ...l, unitPrice: Math.max(0, val) };
      })
    );
  };

  const filteredArticles = articles
    .filter(
      (a) =>
        a.mainReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.brand.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 8);

  const subtotal = quoteLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalDiscount = quoteLines.reduce(
    (s, l) => s + (l.quantity * l.unitPrice * l.discountPercent) / 100,
    0
  );
  const totalNet = subtotal - totalDiscount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const name = customerName.trim();
    if (!name) {
      setErrorMessage('Veuillez renseigner le nom du client.');
      return;
    }

    let finalLines = [...quoteLines];
    if (selectedArtToAdd) {
      const existsIdx = finalLines.findIndex((l) => l.articleId === selectedArtToAdd);
      if (existsIdx !== -1) {
        finalLines[existsIdx] = {
          ...finalLines[existsIdx],
          quantity: finalLines[existsIdx].quantity + qtyToAdd,
        };
      } else {
        finalLines.push({
          articleId: selectedArtToAdd,
          quantity: qtyToAdd,
          unitPrice: priceToAdd,
          discountPercent: discToAdd,
        });
      }
    }

    if (finalLines.length === 0) {
      setErrorMessage('Veuillez ajouter au moins une pièce au devis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: customerMode === 'EXISTING' ? selectedCustomerId : undefined,
        customerName: name,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        warehouseId:
          targetWarehouseId ||
          warehouses.find((w) => w.isDefault)?.id ||
          warehouses[0]?.id ||
          '',
        validUntil,
        items: finalLines,
        notes,
        terms,
      };

      const res = quoteToEdit
        ? updateQuote(quoteToEdit.id, payload)
        : createQuote(payload);

      if (res.success && res.quote) {
        onSuccess(
          quoteToEdit
            ? `Devis ${res.quote.quoteNumber} modifié avec succès pour ${res.quote.customerName}.`
            : `Devis ${res.quote.quoteNumber} généré avec succès pour ${res.quote.customerName}.`
        );
        onClose();
      } else {
        setErrorMessage(
          res.error ||
            (quoteToEdit
              ? 'Erreur lors de la modification du devis.'
              : 'Erreur lors de la création du devis.')
        );
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
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">
                {isEditMode
                  ? `Modifier le Devis ${quoteToEdit?.quoteNumber}`
                  : 'Nouveau Devis / Facture Proforma'}
              </h3>
              <p className="text-xs text-slate-300">
                {isEditMode
                  ? 'Ajustez les articles, quantités, prix, remises ou informations client avant validation'
                  : "Établissement d'une offre commerciale préalable convertible en vente directe"}
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

            {/* Customer Section */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Client destinataire
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('EXISTING')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      customerMode === 'EXISTING'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Client existant
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('MANUAL');
                      setSelectedCustomerId('');
                      setCustomerName('');
                      setCustomerPhone('');
                    }}
                    className={`px-2.5 py-1 rounded font-medium ${
                      customerMode === 'MANUAL'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Nouveau / Au comptoir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {customerMode === 'EXISTING' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sélectionner un client *</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      required
                    >
                      <option value="">Choisir parmi les clients enregistrés...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nom ou Entreprise *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Entreprise BTP Sénégal..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+221 ..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="contact@client.sn"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Warehouse & Validity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Magasin d'expédition prévu *</label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                >
                  <option value="">-- Sélectionner un magasin --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date limite de validité</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Add Item Quick Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Ajouter des articles au devis
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div className="sm:col-span-5 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Chercher référence ou désignation..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                  {searchQuery && filteredArticles.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                      {filteredArticles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            handleSelectArticleToAdd(art.id);
                            setSearchQuery(`${art.mainReference} - ${art.designation}`);
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
                          <span className="font-mono font-semibold text-emerald-700">
                            {formatFCFA(art.salePrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <NumericInput
                    min={1}
                    value={qtyToAdd}
                    onChange={(val) => setQtyToAdd(Math.max(1, Math.floor(val)))}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-center bg-white"
                    title="Quantité"
                  />
                </div>

                <div className="sm:col-span-2">
                  <NumericInput
                    min={0}
                    step={100}
                    value={priceToAdd}
                    onChange={(val) => setPriceToAdd(Math.max(0, val))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-right bg-white"
                    title="Prix de vente unitaire (FCFA)"
                  />
                </div>

                <div className="sm:col-span-1">
                  <NumericInput
                    min={0}
                    max={100}
                    value={discToAdd}
                    onChange={(val) => setDiscToAdd(Math.min(100, Math.max(0, Math.floor(val))))}
                    placeholder="0"
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg font-mono text-center bg-white"
                    title="Remise en %"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={!selectedArtToAdd}
                    className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Quote Lines Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Article</th>
                    <th className="py-2.5 px-3 text-right w-24">Quantité</th>
                    <th className="py-2.5 px-3 text-right w-32">Prix Unitaire</th>
                    <th className="py-2.5 px-3 text-right w-24">Remise %</th>
                    <th className="py-2.5 px-3 text-right w-36">Total Net</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun article sélectionné.
                      </td>
                    </tr>
                  ) : (
                    quoteLines.map((line) => {
                      const art = articles.find((a) => a.id === line.articleId);
                      const fallbackItem = quoteToEdit?.items.find((it) => it.articleId === line.articleId);
                      const discAmt = (line.quantity * line.unitPrice * line.discountPercent) / 100;
                      const lineNet = line.quantity * line.unitPrice - discAmt;

                      return (
                        <tr key={line.articleId} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-slate-900">
                              {art?.mainReference || fallbackItem?.mainReference}
                            </div>
                            <div className="text-slate-600 truncate max-w-[220px]">
                              {art?.designation || fallbackItem?.designation}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <NumericInput
                              min={1}
                              value={line.quantity}
                              onChange={(val) => handleUpdateLine(line.articleId, 'quantity', val)}
                              className="w-16 px-2 py-1 border border-slate-200 rounded font-mono font-bold text-right bg-white"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <NumericInput
                              min={0}
                              step={100}
                              value={line.unitPrice}
                              onChange={(val) => handleUpdateLine(line.articleId, 'unitPrice', val)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded font-mono text-right bg-white"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <NumericInput
                              min={0}
                              max={100}
                              value={line.discountPercent}
                              onChange={(val) => handleUpdateLine(line.articleId, 'discountPercent', val)}
                              className="w-16 px-2 py-1 border border-slate-200 rounded font-mono text-right bg-white"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatFCFA(lineNet)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.articleId)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
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

            {/* Terms & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Conditions de vente</label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Référence projet</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Projet carrière Thiès, devis pour engin CAT 336D..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-500">Total Net TTC : </span>
              <span className="font-mono font-bold text-base text-emerald-700 ml-1">
                {formatFCFA(totalNet)}
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
                disabled={isSubmitting || quoteLines.length === 0}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs disabled:opacity-50 font-bold cursor-pointer"
              >
                {isSubmitting
                  ? 'Enregistrement...'
                  : isEditMode
                  ? 'Enregistrer les modifications'
                  : 'Émettre le Devis / Proforma'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
