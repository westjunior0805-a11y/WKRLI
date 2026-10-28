import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Customer, PaymentMethod, Sale } from '../../types';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import {
  Users,
  Plus,
  Search,
  Download,
  Phone,
  MapPin,
  CreditCard,
  DollarSign,
  History,
  X,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { ReceiptModal } from '../sales/ReceiptModal';

export const CustomerListView: React.FC = () => {
  const {
    customers,
    sales,
    warehouses,
    createCustomer,
    updateCustomer,
    recordCustomerDebtPayment,
    currentUser,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // New / Edit Customer modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(1000000);
  const [customerNotes, setCustomerNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Settle Debt modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('WAVE');
  const [settleWarehouseId, setSettleWarehouseId] = useState(warehouses[0]?.id || '');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState('');

  // Customer sales history drawer
  const [inspectingCustomer, setInspectingCustomer] = useState<Customer | null>(null);
  const [viewingReceiptSale, setViewingReceiptSale] = useState<Sale | null>(null);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterDebtOnly && c.outstandingBalance <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [customers, filterDebtOnly, searchQuery]);

  // Total outstanding debt across all customers
  const totalReceivables = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setCustomerCode(`CLI-${String(customers.length + 1).padStart(3, '0')}`);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCreditLimit(1000000);
    setCustomerNotes('');
    setFormError('');
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerCode(c.code);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustomerEmail(c.email || '');
    setCreditLimit(c.creditLimit || 0);
    setCustomerNotes(c.notes || '');
    setFormError('');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerCode.trim()) {
      setFormError('Le code client est obligatoire.');
      return;
    }
    if (!customerName.trim()) {
      setFormError('Le nom ou raison sociale est obligatoire.');
      return;
    }

    if (editingCustomer) {
      const result = updateCustomer(editingCustomer.id, {
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
        email: customerEmail.trim() || undefined,
        creditLimit: Number(creditLimit) || 0,
        notes: customerNotes.trim() || undefined,
      });
      if (!result.success) {
        setFormError(result.error || 'Erreur lors de la modification.');
      } else {
        setIsCustomerModalOpen(false);
      }
    } else {
      const result = createCustomer({
        code: customerCode.trim().toUpperCase(),
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
        email: customerEmail.trim() || undefined,
        creditLimit: Number(creditLimit) || 0,
        notes: customerNotes.trim() || undefined,
      });
      if (!result.success) {
        setFormError(result.error || 'Erreur lors de la création.');
      } else {
        setIsCustomerModalOpen(false);
      }
    }
  };

  // Debt Settlement
  const handleOpenSettleModal = (c: Customer) => {
    setSettlingCustomer(c);
    setSettleAmount(c.outstandingBalance);
    setSettleMethod('WAVE');
    setSettleWarehouseId(warehouses[0]?.id || '');
    setSettleRef(`REG-${Date.now().toString().slice(-6)}`);
    setSettleNotes('');
    setSettleError('');
  };

  const handleExecuteSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer) return;
    setSettleError('');

    const result = recordCustomerDebtPayment({
      customerId: settlingCustomer.id,
      amount: Number(settleAmount),
      method: settleMethod,
      warehouseId: settleWarehouseId,
      reference: settleRef,
      notes: settleNotes,
    });

    if (!result.success) {
      setSettleError(result.error || 'Erreur lors de l’encaissement.');
    } else {
      setSettlingCustomer(null);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Code Client',
      'Nom ou Raison Sociale',
      'Téléphone',
      'Adresse',
      'Email',
      'Créance Restante (FCFA)',
      'Plafond Crédit (FCFA)',
      'Date Création',
    ];

    const rows = filteredCustomers.map((c) => [
      c.code,
      c.name,
      c.phone || '',
      c.address || '',
      c.email || '',
      c.outstandingBalance,
      c.creditLimit || 0,
      formatDate(c.createdAt),
    ]);

    exportToCSV(`repertoire_clients_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  // Sales of inspected customer
  const customerSales = useMemo(() => {
    if (!inspectingCustomer) return [];
    return sales.filter((s) => s.customerId === inspectingCustomer.id);
  }, [inspectingCustomer, sales]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Comptes Clients Enregistrés
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900">{customers.length}</span>
            <span className="text-xs text-slate-500">entreprises & particuliers</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Créances en Cours
          </span>
          <div className="mt-1">
            <span
              className={`text-xl font-bold font-mono ${
                totalReceivables > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatFCFA(totalReceivables)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Gestion Portefeuille
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Créer un nouveau compte</span>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau client
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full sm:w-96 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom d'entreprise, code client ou téléphone..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filterDebtOnly}
              onChange={(e) => setFilterDebtOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Afficher uniquement les clients débiteurs</span>
          </label>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 text-xs">
              Aucun compte client ne correspond à votre recherche.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Nom ou Raison Sociale</th>
                  <th className="py-3 px-3">Téléphone & Adresse</th>
                  <th className="py-3 px-3 text-right">Plafond Crédit</th>
                  <th className="py-3 px-3 text-right">Solde Dû (Créance)</th>
                  <th className="py-3 px-3 text-center">Statut Crédit</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c, idx) => {
                  const hasDebt = c.outstandingBalance > 0;
                  return (
                    <tr key={`${c.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {c.code}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-900 max-w-xs truncate">
                        {c.name}
                        {c.notes && (
                          <span className="block text-[10px] text-slate-400 font-normal truncate">
                            {c.notes}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {c.phone && <div className="font-mono">{c.phone}</div>}
                        {c.address && <div className="text-[11px] text-slate-400 truncate">{c.address}</div>}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                        {formatFCFA(c.creditLimit || 0)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        <span className={hasDebt ? 'text-rose-600 text-sm' : 'text-slate-400'}>
                          {formatFCFA(c.outstandingBalance)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {hasDebt ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            Créance en cours
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            À jour
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDebt && (
                            <button
                              onClick={() => handleOpenSettleModal(c)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded inline-flex items-center gap-1"
                              title="Encaisser un règlement de créance"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Régler créance
                            </button>
                          )}

                          <button
                            onClick={() => setInspectingCustomer(c)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Historique des achats"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Modifier les informations"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Customer Create / Edit Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingCustomer ? 'Modifier la fiche client' : 'Créer un compte client BTP / Minier'}
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-3.5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Code Client *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCustomer}
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    placeholder="Ex: CLI-EIFFAGE"
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Plafond Crédit (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nom ou Raison Sociale *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Eiffage Sénégal BTP, CSE..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ex: +221 33 800 00 00"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="achats@client.sn"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Adresse géographique / Chantier
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Ex: Route des Grands Moulins, Bel-Air..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observations / Conditions de paiement
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Ex: Facturation mensuelle, bon de commande requis..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg font-bold shadow-xs hover:bg-slate-800"
                >
                  {editingCustomer ? 'Enregistrer' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Règlement de créance client
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client : <strong>{settlingCustomer.name}</strong> ({settlingCustomer.code})
                </p>
              </div>
              <button
                onClick={() => setSettlingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs flex justify-between">
              <span className="text-amber-900 font-semibold">Total restant dû actuel :</span>
              <span className="font-mono font-bold text-rose-700">
                {formatFCFA(settlingCustomer.outstandingBalance)}
              </span>
            </div>

            {settleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {settleError}
              </div>
            )}

            <form onSubmit={handleExecuteSettleDebt} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Montant payé (FCFA) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={settlingCustomer.outstandingBalance}
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Mode d'encaissement *
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="WAVE">Wave</option>
                    <option value="ESPECES">Espèces</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="VIREMENT">Virement Bancaire</option>
                    <option value="CARTE">Carte Bancaire</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Magasin d'encaissement *
                  </label>
                  <select
                    value={settleWarehouseId}
                    onChange={(e) => setSettleWarehouseId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Référence de transaction / Chèque
                </label>
                <input
                  type="text"
                  value={settleRef}
                  onChange={(e) => setSettleRef(e.target.value)}
                  placeholder="Ex: WAVE-TX-12345, Chèque n°..."
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observations
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Règlement facture..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold shadow-xs hover:bg-emerald-800"
                >
                  Enregistrer l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Sales History Drawer */}
      {inspectingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white h-full max-w-lg w-full border-l border-slate-200 shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">
                  {inspectingCustomer.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {inspectingCustomer.name}
                </h3>
                <p className="text-xs text-slate-500">Historique des achats et réceptions</p>
              </div>
              <button
                onClick={() => setInspectingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {customerSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Aucune vente enregistrée pour ce client.
                </div>
              ) : (
                customerSales.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setViewingReceiptSale(s)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-amber-400 cursor-pointer text-xs space-y-1 transition-colors"
                  >
                    <div className="flex justify-between font-bold">
                      <span className="font-mono text-slate-900">{s.receiptNumber}</span>
                      <span className="font-mono text-slate-900">{formatFCFA(s.totalAmount)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>{formatDate(s.date)}</span>
                      <span>Magasin: {s.warehouseName}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {s.items.map((i) => `${i.quantity}x ${i.mainReference}`).join(', ')}
                    </div>
                    <div className="pt-1 flex justify-between text-[11px] border-t border-slate-200/60">
                      <span>Encaissé: {formatFCFA(s.totalPaid)}</span>
                      {s.remainingDue > 0 ? (
                        <span className="text-rose-600 font-bold">
                          Dû: {formatFCFA(s.remainingDue)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Payé intégralement</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal sale={viewingReceiptSale} onClose={() => setViewingReceiptSale(null)} />
    </div>
  );
};
