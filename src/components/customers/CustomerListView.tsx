import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Customer, PaymentMethod, PaymentRecord, Sale } from '../../types';
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
  Receipt,
  PiggyBank,
} from 'lucide-react';
import { ReceiptModal } from '../sales/ReceiptModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';

export const CustomerListView: React.FC = () => {
  const {
    customers,
    sales,
    payments,
    warehouses,
    createCustomer,
    updateCustomer,
    recordCustomerPayment,
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

  // Settlement & Advance (Acompte) Modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleMode, setSettleMode] = useState<'REGLEMENT_CREANCE' | 'ACOMPTE_AVANCE'>('REGLEMENT_CREANCE');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('WAVE');
  const [settleWarehouseId, setSettleWarehouseId] = useState(warehouses[0]?.id || '');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState('');

  // Voucher / Receipt Modal after settlement or acompte
  const [issuedReceiptPayment, setIssuedReceiptPayment] = useState<PaymentRecord | null>(null);
  const [issuedReceiptCustomer, setIssuedReceiptCustomer] = useState<Customer | null>(null);

  // Customer drawer (sales & settlements history)
  const [inspectingCustomer, setInspectingCustomer] = useState<Customer | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'SALES' | 'PAYMENTS'>('SALES');
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
  // Total customer advances / deposits across all customers
  const totalDeposits = customers.reduce((sum, c) => sum + (c.depositBalance || 0), 0);

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

  // Open Settlement / Advance Modal
  const handleOpenSettleModal = (c: Customer, mode?: 'REGLEMENT_CREANCE' | 'ACOMPTE_AVANCE') => {
    const chosenMode = mode || (c.outstandingBalance > 0 ? 'REGLEMENT_CREANCE' : 'ACOMPTE_AVANCE');
    setSettlingCustomer(c);
    setSettleMode(chosenMode);
    setSettleAmount(chosenMode === 'REGLEMENT_CREANCE' ? c.outstandingBalance : 50000);
    setSettleMethod('WAVE');
    setSettleWarehouseId(warehouses[0]?.id || '');
    setSettleRef(`${chosenMode === 'ACOMPTE_AVANCE' ? 'ACP' : 'REG'}-${Date.now().toString().slice(-6)}`);
    setSettleNotes('');
    setSettleError('');
  };

  const handleExecuteSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer) return;
    setSettleError('');

    if (settleAmount <= 0) {
      setSettleError('Le montant doit être un nombre strictement supérieur à zéro.');
      return;
    }

    const result = recordCustomerPayment({
      customerId: settlingCustomer.id,
      type: settleMode,
      amount: Number(settleAmount),
      method: settleMethod,
      warehouseId: settleWarehouseId,
      reference: settleRef,
      notes: settleNotes,
    });

    if (!result.success) {
      setSettleError(result.error || 'Erreur lors de l’encaissement.');
    } else {
      const recordedPayment = result.payment || null;
      const targetCustomer = settlingCustomer;
      setSettlingCustomer(null);
      if (recordedPayment) {
        setIssuedReceiptPayment(recordedPayment);
        setIssuedReceiptCustomer(targetCustomer);
      }
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
      'Acompte / Avance Disponible (FCFA)',
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
      c.depositBalance || 0,
      c.creditLimit || 0,
      formatDate(c.createdAt),
    ]);

    exportToCSV(`repertoire_clients_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  // Sales & Payments of inspected customer
  const customerSales = useMemo(() => {
    if (!inspectingCustomer) return [];
    return sales.filter((s) => s.customerId === inspectingCustomer.id);
  }, [inspectingCustomer, sales]);

  const customerPayments = useMemo(() => {
    if (!inspectingCustomer) return [];
    return payments.filter((p) => p.customerId === inspectingCustomer.id);
  }, [inspectingCustomer, payments]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Comptes Clients Enregistrés
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900">{customers.length}</span>
            <span className="text-xs text-slate-500">comptes actifs</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Créances en Cours
          </span>
          <div className="mt-1">
            <span
              className={`text-xl font-bold font-mono ${
                totalReceivables > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatFCFA(totalReceivables)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Acomptes & Avances Clients
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {formatFCFA(totalDeposits)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Actions Clients
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="flex-1 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau client
            </button>
            {customers.length > 0 && (
              <button
                onClick={() => handleOpenSettleModal(customers[0], 'ACOMPTE_AVANCE')}
                className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs inline-flex items-center justify-center gap-1 transition-colors"
                title="Encaisser un acompte sur commande"
              >
                <DollarSign className="w-4 h-4" />
                Acompte
              </button>
            )}
          </div>
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
                  <th className="py-3 px-3 text-right">Solde Dû (Créance)</th>
                  <th className="py-3 px-3 text-right">Acompte / Avance</th>
                  <th className="py-3 px-3 text-center">Statut Compte</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c, idx) => {
                  const hasDebt = c.outstandingBalance > 0;
                  const hasDeposit = !!c.depositBalance && c.depositBalance > 0;
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

                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        <span className={hasDebt ? 'text-rose-600 text-sm' : 'text-slate-400'}>
                          {formatFCFA(c.outstandingBalance)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                        {hasDeposit ? (
                          <span className="text-emerald-700 text-sm font-bold">
                            {formatFCFA(c.depositBalance || 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 FCFA</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {hasDebt ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                            Créance en cours
                          </span>
                        ) : hasDeposit ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Acompte disponible
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            À jour
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDebt ? (
                            <button
                              onClick={() => handleOpenSettleModal(c, 'REGLEMENT_CREANCE')}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded inline-flex items-center gap-1 transition-colors"
                              title="Encaisser un règlement de créance"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Régler créance
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenSettleModal(c, 'ACOMPTE_AVANCE')}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded inline-flex items-center gap-1 transition-colors"
                              title="Encaisser un acompte / avance sur commande"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              Acompte
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setInspectingCustomer(c);
                              setActiveHistoryTab('SALES');
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Historique des ventes & règlements"
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

      {/* Settle Debt & Advance (Acompte) Modal */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {settleMode === 'ACOMPTE_AVANCE' ? 'Encaissement d’Acompte Client' : 'Règlement de Créance Client'}
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

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setSettleMode('REGLEMENT_CREANCE');
                  setSettleAmount(settlingCustomer.outstandingBalance);
                  setSettleRef(`REG-${Date.now().toString().slice(-6)}`);
                }}
                className={`py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  settleMode === 'REGLEMENT_CREANCE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Règlement créance
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettleMode('ACOMPTE_AVANCE');
                  setSettleAmount(settlingCustomer.outstandingBalance > 0 ? settlingCustomer.outstandingBalance : 50000);
                  setSettleRef(`ACP-${Date.now().toString().slice(-6)}`);
                }}
                className={`py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  settleMode === 'ACOMPTE_AVANCE'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                Acompte / Avance
              </button>
            </div>

            {/* Account Situation Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                <span className="text-[11px] text-rose-800 block">Créance restant due :</span>
                <span className="font-mono font-bold text-rose-900 text-sm">
                  {formatFCFA(settlingCustomer.outstandingBalance)}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-[11px] text-emerald-800 block">Acompte en compte :</span>
                <span className="font-mono font-bold text-emerald-900 text-sm">
                  {formatFCFA(settlingCustomer.depositBalance || 0)}
                </span>
              </div>
            </div>

            {settleMode === 'ACOMPTE_AVANCE' && (
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                💡 Cet acompte sera enregistré et crédité sur le compte du client. Il servira d'avance pour régler ses commandes actuelles ou futures. Un reçu officiel d'encaissement sera édité.
              </p>
            )}

            {settleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {settleError}
              </div>
            )}

            <form onSubmit={handleExecuteSettleDebt} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  {settleMode === 'ACOMPTE_AVANCE' ? 'Montant de l’acompte (FCFA) *' : 'Montant réglé (FCFA) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  N° de Reçu / Référence transaction
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
                  Observations / Motif
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder={settleMode === 'ACOMPTE_AVANCE' ? 'Avance sur commande client...' : 'Règlement facture créance...'}
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
                  className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold shadow-xs hover:bg-emerald-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {settleMode === 'ACOMPTE_AVANCE' ? 'Encaisser l’acompte' : 'Enregistrer le règlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Sales & Payments History Drawer */}
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
                <p className="text-xs text-slate-500">
                  Créance : <strong>{formatFCFA(inspectingCustomer.outstandingBalance)}</strong> • Acompte : <strong>{formatFCFA(inspectingCustomer.depositBalance || 0)}</strong>
                </p>
              </div>
              <button
                onClick={() => setInspectingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setActiveHistoryTab('SALES')}
                className={`py-2 px-3 border-b-2 transition-colors ${
                  activeHistoryTab === 'SALES'
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Factures & Ventes ({customerSales.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab('PAYMENTS')}
                className={`py-2 px-3 border-b-2 transition-colors ${
                  activeHistoryTab === 'PAYMENTS'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Règlements & Acomptes ({customerPayments.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {activeHistoryTab === 'SALES' ? (
                customerSales.length === 0 ? (
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
                )
              ) : (
                customerPayments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Aucun encaissement ou acompte enregistré pour ce client.
                  </div>
                ) : (
                  customerPayments.map((p) => {
                    const isAcp = p.paymentType === 'ACOMPTE_CLIENT';
                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className="font-mono text-slate-900">{p.id}</span>
                          <span className="font-mono text-emerald-800 text-sm font-bold">
                            +{formatFCFA(p.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isAcp ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isAcp ? 'Acompte Client' : 'Règlement Créance'}
                          </span>
                          <span className="text-slate-500">{formatDate(p.date)}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex justify-between">
                          <span>Mode : <strong>{p.method}</strong></span>
                          <span>Caissier : {p.userName}</span>
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-slate-500 italic truncate">{p.notes}</p>
                        )}
                        <div className="pt-1 flex justify-end border-t border-slate-200/60">
                          <button
                            onClick={() => {
                              setIssuedReceiptPayment(p);
                              setIssuedReceiptCustomer(inspectingCustomer);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Receipt className="w-3.5 h-3.5 text-amber-600" />
                            Voir le reçu
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Quick action inside drawer */}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => handleOpenSettleModal(inspectingCustomer, 'ACOMPTE_AVANCE')}
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <PiggyBank className="w-3.5 h-3.5" />
                Encaisser un acompte
              </button>
              {inspectingCustomer.outstandingBalance > 0 && (
                <button
                  onClick={() => handleOpenSettleModal(inspectingCustomer, 'REGLEMENT_CREANCE')}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Régler créance
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sale Receipt Modal */}
      <ReceiptModal sale={viewingReceiptSale} onClose={() => setViewingReceiptSale(null)} />

      {/* Payment / Advance Receipt Modal */}
      <PaymentReceiptModal
        payment={issuedReceiptPayment}
        customer={issuedReceiptCustomer}
        onClose={() => {
          setIssuedReceiptPayment(null);
          setIssuedReceiptCustomer(null);
        }}
      />
    </div>
  );
};
