import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Customer, PaymentMethod, PaymentRecord, Sale } from '../../types';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import { getCustomerCreditSummary, getNetSaleAmount } from '../../utils/customerAccount';
import { fuzzyFilter } from '../../utils/fuzzySearch';
import {
  Plus,
  Search,
  Download,
  DollarSign,
  History,
  X,
  Edit2,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Trash2,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react';
import { ReceiptModal } from '../sales/ReceiptModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { ImportCustomersModal } from './ImportCustomersModal';
import { NumericInput } from '../common/NumericInput';

function getTodayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateInputString(isoOrDate?: string): string {
  if (!isoOrDate) return getTodayDateInput();
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return getTodayDateInput();
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CustomerListView: React.FC = () => {
  const {
    customers,
    sales,
    payments,
    warehouses,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    recordCustomerPayment,
    updateCustomerPayment,
    deleteCustomerPayment,
    adjustCustomerDebt,
    deleteCustomerDebtAdjustment,
    currentUser,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // New / Edit Customer modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(1000000);
  const [initialDebtInput, setInitialDebtInput] = useState<number>(0);
  const [customerNotes, setCustomerNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Settlement & Advance (Acompte) Modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleDate, setSettleDate] = useState<string>(() => getTodayDateInput());
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('WAVE');
  const [settleWarehouseId, setSettleWarehouseId] = useState(warehouses[0]?.id || '');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState('');

  // Edit Existing Acompte Modal
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPayDate, setEditPayDate] = useState<string>('');
  const [editPayAmount, setEditPayAmount] = useState<number>(0);
  const [editPayMethod, setEditPayMethod] = useState<PaymentMethod>('WAVE');
  const [editPayRef, setEditPayRef] = useState<string>('');
  const [editPayNotes, setEditPayNotes] = useState<string>('');
  const [editPayError, setEditPayError] = useState<string>('');

  // Debt Adjustment (Ajustement des créances) Modal
  const [adjustingCustomerState, setAdjustingCustomer] = useState<Customer | null>(null);
  const adjustingCustomer = adjustingCustomerState
    ? customers.find((c) => c.id === adjustingCustomerState.id) || adjustingCustomerState
    : null;
  const [adjustMode, setAdjustMode] = useState<'SET_TARGET' | 'DELTA_ADD' | 'DELTA_SUB'>('SET_TARGET');
  const [adjustValue, setAdjustValue] = useState<number>(0);
  const [adjustDate, setAdjustDate] = useState<string>(() => getTodayDateInput());
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  // Voucher / Receipt Modal after settlement or acompte
  const [issuedReceiptPayment, setIssuedReceiptPayment] = useState<PaymentRecord | null>(null);
  const [issuedReceiptCustomerState, setIssuedReceiptCustomer] = useState<Customer | null>(null);
  const issuedReceiptCustomer = issuedReceiptCustomerState
    ? customers.find((c) => c.id === issuedReceiptCustomerState.id) || issuedReceiptCustomerState
    : null;

  // Customer drawer (credit purchases & acomptes history)
  const [inspectingCustomerState, setInspectingCustomer] = useState<Customer | null>(null);
  const inspectingCustomer = inspectingCustomerState
    ? customers.find((c) => c.id === inspectingCustomerState.id) || inspectingCustomerState
    : null;
  const [activeHistoryTab, setActiveHistoryTab] = useState<'SALES' | 'PAYMENTS'>('SALES');
  const [viewingReceiptSale, setViewingReceiptSale] = useState<Sale | null>(null);

  // Precompute credit summary for every customer:
  // Montant de la créance = Somme des achats (à crédit, hors achats payés directement) - Somme des acomptes
  const customerSummaryMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCustomerCreditSummary>>();
    customers.forEach((c) => {
      map.set(c.id, getCustomerCreditSummary(c, sales, payments));
    });
    return map;
  }, [customers, sales, payments]);

  // Filtered customer list with Fuzzy Search
  const filteredCustomers = useMemo(() => {
    const base = customers.filter((c) => {
      const summary = customerSummaryMap.get(c.id);
      const creance = summary ? summary.creance : 0;
      if (filterDebtOnly && creance <= 0) return false;
      return true;
    });
    return fuzzyFilter(base, searchQuery, (c) => [
      c.code,
      c.name,
      c.phone,
      c.address,
      c.email,
      c.notes,
    ]);
  }, [customers, customerSummaryMap, filterDebtOnly, searchQuery]);

  // Global totals across all customers
  const globalTotals = useMemo(() => {
    let totalPurchases = 0;
    let totalAcomptes = 0;
    let totalCreances = 0;
    customers.forEach((c) => {
      const s = customerSummaryMap.get(c.id);
      if (s) {
        totalPurchases += s.totalPurchases;
        totalAcomptes += s.totalAcomptes;
        totalCreances += s.creance;
      }
    });
    return { totalPurchases, totalAcomptes, totalCreances };
  }, [customers, customerSummaryMap]);

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setCustomerCode(`CLI-${String(customers.length + 1).padStart(3, '0')}`);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCreditLimit(1000000);
    setInitialDebtInput(0);
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
    setInitialDebtInput(0);
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
      const summary = customerSummaryMap.get(editingCustomer.id);
      const result = updateCustomer(editingCustomer.id, {
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
        email: customerEmail.trim() || undefined,
        creditLimit: Number(creditLimit) || 0,
        outstandingBalance: summary ? summary.creance : 0,
        depositBalance: summary ? summary.avanceDisponible : 0,
        notes: customerNotes.trim() || undefined,
      });
      if (!result.success) {
        setFormError(result.error || 'Erreur lors de la modification.');
      } else {
        setIsCustomerModalOpen(false);
      }
    } else {
      const initDebt = Math.max(0, Math.round(Number(initialDebtInput) || 0));
      const nowIso = new Date().toISOString();
      const result = createCustomer({
        code: customerCode.trim().toUpperCase(),
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
        email: customerEmail.trim() || undefined,
        creditLimit: Number(creditLimit) || 0,
        outstandingBalance: initDebt,
        depositBalance: 0,
        debtAdjustments:
          initDebt > 0
            ? [
                {
                  id: `ADJ-INIT-${Date.now().toString().slice(-6)}`,
                  date: nowIso,
                  amount: initDebt,
                  previousDebt: 0,
                  newDebt: initDebt,
                  reason: 'Solde initial / Créance antérieure à l’ouverture du compte',
                  userId: currentUser.id,
                  userName: currentUser.name,
                },
              ]
            : [],
        notes: customerNotes.trim() || undefined,
      });
      if (!result.success) {
        setFormError(result.error || 'Erreur lors de la création.');
      } else {
        setIsCustomerModalOpen(false);
      }
    }
  };

  // Open Acompte / Règlement Modal
  const handleOpenSettleModal = (c: Customer) => {
    const summary = customerSummaryMap.get(c.id);
    const currentCreance = summary ? summary.creance : 0;
    setSettlingCustomer(c);
    setSettleAmount(currentCreance > 0 ? currentCreance : 50000);
    setSettleDate(getTodayDateInput());
    setSettleMethod('WAVE');
    setSettleWarehouseId(warehouses[0]?.id || '');
    setSettleRef(`ACP-${Date.now().toString().slice(-6)}`);
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
      type: 'ACOMPTE_AVANCE',
      amount: Number(settleAmount),
      method: settleMethod,
      warehouseId: settleWarehouseId,
      reference: settleRef,
      notes: settleNotes || `Acompte / règlement client (${settlingCustomer.name})`,
      customDate: settleDate,
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

  // Open Edit Acompte Modal
  const handleOpenEditPayment = (p: PaymentRecord) => {
    setEditingPayment(p);
    setEditPayDate(toDateInputString(p.date));
    setEditPayAmount(p.amount);
    setEditPayMethod(p.method);
    setEditPayRef(p.reference || '');
    setEditPayNotes(p.notes || '');
    setEditPayError('');
  };

  const handleExecuteEditPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditPayError('');
    const res = updateCustomerPayment(editingPayment.id, {
      date: editPayDate,
      amount: Number(editPayAmount),
      method: editPayMethod,
      reference: editPayRef,
      notes: editPayNotes,
    });
    if (!res.success) {
      setEditPayError(res.error || 'Erreur lors de la modification de l’acompte.');
    } else {
      setEditingPayment(null);
    }
  };

  // Open Debt Adjustment Modal
  const handleOpenAdjustDebtModal = (c: Customer) => {
    const summary = customerSummaryMap.get(c.id);
    const currentCreance = summary ? summary.creance : 0;
    setAdjustingCustomer(c);
    setAdjustMode('SET_TARGET');
    setAdjustValue(currentCreance);
    setAdjustDate(getTodayDateInput());
    setAdjustReason('');
    setAdjustError('');
  };

  const handleExecuteAdjustDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingCustomer) return;
    setAdjustError('');

    const modeParam = adjustMode === 'SET_TARGET' ? 'SET_TARGET' : 'DELTA';
    const signedValue =
      adjustMode === 'DELTA_SUB' ? -Math.abs(Number(adjustValue) || 0) : Number(adjustValue) || 0;

    if (adjustMode !== 'SET_TARGET' && signedValue === 0) {
      setAdjustError('Veuillez saisir un montant d’ajustement supérieur à 0.');
      return;
    }

    const res = adjustCustomerDebt({
      customerId: adjustingCustomer.id,
      mode: modeParam,
      value: signedValue,
      date: adjustDate,
      reason:
        adjustReason.trim() ||
        (adjustMode === 'SET_TARGET'
          ? 'Ajustement / Régularisation du solde de créance'
          : adjustMode === 'DELTA_ADD'
          ? 'Report de créance / Solde antérieur (+)'
          : 'Remise / Réduction sur créance (-)'),
    });

    if (!res.success) {
      setAdjustError(res.error || 'Erreur lors de l’ajustement de la créance.');
    } else {
      setAdjustingCustomer(null);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Code Client',
      'Nom ou Raison Sociale',
      'Téléphone',
      'Adresse',
      'Email',
      'Somme des Achats à Crédit (FCFA)',
      'Somme des Acomptes (FCFA)',
      'Montant de la Créance (FCFA)',
      'Plafond Crédit (FCFA)',
      'Date Création',
    ];

    const rows = filteredCustomers.map((c) => {
      const s = customerSummaryMap.get(c.id);
      return [
        c.code,
        c.name,
        c.phone || '',
        c.address || '',
        c.email || '',
        s ? s.totalPurchases : 0,
        s ? s.totalAcomptes : 0,
        s ? s.creance : 0,
        c.creditLimit || 0,
        formatDate(c.createdAt),
      ];
    });

    exportToCSV(`repertoire_clients_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const inspectedSummary = useMemo(() => {
    if (!inspectingCustomer) return null;
    return (
      customerSummaryMap.get(inspectingCustomer.id) ||
      getCustomerCreditSummary(inspectingCustomer, sales, payments)
    );
  }, [inspectingCustomer, customerSummaryMap, sales, payments]);

  const settlingSummary = useMemo(() => {
    if (!settlingCustomer) return null;
    return (
      customerSummaryMap.get(settlingCustomer.id) ||
      getCustomerCreditSummary(settlingCustomer, sales, payments)
    );
  }, [settlingCustomer, customerSummaryMap, sales, payments]);

  const adjustingSummary = useMemo(() => {
    if (!adjustingCustomer) return null;
    return (
      customerSummaryMap.get(adjustingCustomer.id) ||
      getCustomerCreditSummary(adjustingCustomer, sales, payments)
    );
  }, [adjustingCustomer, customerSummaryMap, sales, payments]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-[#E5E5E5] rounded-lg">
          <span className="text-[11px] font-semibold text-[#1B1B1B]/60 uppercase tracking-wider block">
            Comptes Clients
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-[#1B1B1B]">{customers.length}</span>
            <span className="text-xs text-[#1B1B1B]/50">enregistrés</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E5E5E5] rounded-lg">
          <span className="text-[11px] font-semibold text-[#1B1B1B]/60 uppercase tracking-wider block" title="Somme des achats à crédit (hors achats payés directement au comptoir)">
            Somme des Achats (Crédit)
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-[#1B1B1B]">
              {formatFCFA(globalTotals.totalPurchases)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E5E5E5] rounded-lg">
          <span className="text-[11px] font-semibold text-[#1B1B1B]/60 uppercase tracking-wider block" title="Somme des acomptes et règlements versés sur les achats à crédit">
            Somme des Acomptes
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {formatFCFA(globalTotals.totalAcomptes)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E5E5E5] rounded-lg">
          <span className="text-[11px] font-semibold text-[#1B1B1B]/60 uppercase tracking-wider block" title="Montant de la créance = Somme des achats − Somme des acomptes">
            Total Créances (Achats − Acomptes)
          </span>
          <div className="mt-1">
            <span
              className={`text-xl font-bold font-mono ${
                globalTotals.totalCreances > 0 ? 'text-[#E35E2D]' : 'text-emerald-700'
              }`}
            >
              {formatFCFA(globalTotals.totalCreances)}
            </span>
          </div>
        </div>
      </div>

      {/* Search, Filter & Actions Bar */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full sm:w-96 relative">
          <Search className="w-4 h-4 text-[#1B1B1B]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, code client ou téléphone..."
            className="w-full pl-9 pr-3 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#1B1B1B]/80 mr-1">
            <input
              type="checkbox"
              checked={filterDebtOnly}
              onChange={(e) => setFilterDebtOnly(e.target.checked)}
              className="rounded accent-[#E35E2D]"
            />
            <span>Avec créance uniquement</span>
          </label>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-white bg-[#E35E2D] hover:bg-[#1B1B1B] rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau client
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-[#1B1B1B] bg-white hover:bg-[#F8F7F4] border border-[#E5E5E5] rounded transition-colors cursor-pointer"
            title="Importer une liste de clients depuis Excel ou CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#E35E2D]" />
            Importer
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-[#1B1B1B] bg-white hover:bg-[#F8F7F4] border border-[#E5E5E5] rounded transition-colors cursor-pointer"
            title="Exporter le répertoire en CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 px-4 text-[#1B1B1B]/40 text-xs">
              Aucun compte client ne correspond à votre recherche.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F7F4] border-b border-[#E5E5E5] text-[#1B1B1B]/60 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 text-right" title="Somme des achats non payés directement">
                    Somme des Achats
                  </th>
                  <th className="py-3 px-3 text-right" title="Somme des acomptes et règlements versés">
                    Somme des Acomptes
                  </th>
                  <th className="py-3 px-3 text-right" title="Différence : Somme des Achats − Somme des Acomptes">
                    Montant Créance
                  </th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredCustomers.map((c, idx) => {
                  const summary = customerSummaryMap.get(c.id);
                  const totalPurchases = summary ? summary.totalPurchases : 0;
                  const totalAcomptes = summary ? summary.totalAcomptes : 0;
                  const creance = summary ? summary.creance : 0;
                  const avance = summary ? summary.avanceDisponible : 0;
                  const hasDebt = creance > 0;
                  const hasAvance = avance > 0;

                  return (
                    <tr
                      key={`${c.id}-${idx}`}
                      className="hover:bg-[#F8F7F4]/60 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-[#1B1B1B] whitespace-nowrap">
                        {c.code}
                      </td>

                      <td className="py-3 px-3 font-semibold text-[#1B1B1B] max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingCustomer(c);
                            setActiveHistoryTab('SALES');
                          }}
                          className="text-left hover:text-[#E35E2D] transition-colors cursor-pointer"
                          title="Voir le détail des achats à crédit et des acomptes"
                        >
                          {c.name}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-[#1B1B1B]/70">
                        {c.phone && <div className="font-mono">{c.phone}</div>}
                        {c.address && (
                          <div className="text-[11px] text-[#1B1B1B]/50 truncate">{c.address}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#1B1B1B] whitespace-nowrap tabular-nums">
                        <div>{formatFCFA(totalPurchases)}</div>
                        {summary && summary.totalAdjustments !== 0 && (
                          <span className="block text-[10px] font-medium text-[#1B1B1B]/55">
                            dont ajust. {summary.totalAdjustments > 0 ? '+' : ''}
                            {formatFCFA(summary.totalAdjustments)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                        <div>{formatFCFA(totalAcomptes)}</div>
                        {summary && summary.acomptePayments.length > 0 && (
                          <span className="block text-[10px] font-normal text-[#1B1B1B]/55">
                            Dernier : {formatDate(summary.acomptePayments[0].date)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        <span className={hasDebt ? 'text-[#E35E2D] text-sm' : 'text-[#1B1B1B]/40'}>
                          {formatFCFA(creance)}
                        </span>
                        {hasAvance && (
                          <span className="block text-[10px] font-semibold text-emerald-700">
                            Avance : +{formatFCFA(avance)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {hasDebt ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E35E2D]/10 text-[#E35E2D]">
                            Créance en cours
                          </span>
                        ) : hasAvance ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Avance disponible
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F8F7F4] text-[#1B1B1B]/60 border border-[#E5E5E5]">
                            À jour
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenSettleModal(c)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              hasDebt
                                ? 'bg-[#E35E2D] text-white hover:bg-[#1B1B1B]'
                                : 'bg-[#F8F7F4] text-[#1B1B1B] hover:bg-[#E5E5E5] border border-[#E5E5E5]'
                            }`}
                            title="Enregistrer un acompte ou un règlement client (avec date)"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{hasDebt ? 'Verser acompte' : 'Acompte'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenAdjustDebtModal(c)}
                            className="px-2 py-1 text-xs font-semibold text-[#1B1B1B]/80 hover:text-[#E35E2D] bg-white hover:bg-[#F8F7F4] border border-[#E5E5E5] rounded inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ajuster la créance du client (solde antérieur, régularisation ou remise)"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#E35E2D]" />
                            <span className="hidden xl:inline">Ajuster</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setInspectingCustomer(c);
                              setActiveHistoryTab('SALES');
                            }}
                            className="p-1.5 text-[#1B1B1B]/60 hover:text-[#1B1B1B] hover:bg-[#F8F7F4] border border-transparent hover:border-[#E5E5E5] rounded cursor-pointer"
                            title="Voir le détail des achats à crédit et des acomptes"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-[#1B1B1B]/60 hover:text-[#1B1B1B] hover:bg-[#F8F7F4] border border-transparent hover:border-[#E5E5E5] rounded cursor-pointer"
                            title="Modifier les coordonnées du client"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {(currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
                            <button
                              type="button"
                              onClick={() => setCustomerToDelete(c)}
                              className="p-1.5 text-[#1B1B1B]/40 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Supprimer ce client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-[#E5E5E5] overflow-hidden">
            <div className="px-6 py-4 bg-[#1B1B1B] text-white flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingCustomer ? 'Modifier la fiche client' : 'Nouveau compte client'}
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-white/60 hover:text-white p-1 cursor-pointer"
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
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Code Client *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCustomer}
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    placeholder="Ex: CLI-001"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Plafond Crédit (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    step={50000}
                    value={creditLimit}
                    onChange={(val) => setCreditLimit(val)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Nom ou Raison Sociale *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nom de l'entreprise ou du client..."
                  className="w-full px-3 py-2 text-sm bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ex: +221 77 000 00 00"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="client@entreprise.com"
                    className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Adresse géographique / Chantier
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Adresse ou localisation..."
                  className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Créance initiale / Solde antérieur (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    step={5000}
                    value={initialDebtInput}
                    onChange={(val) => setInitialDebtInput(val)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                  <span className="text-[10px] text-[#1B1B1B]/50 mt-0.5 block">
                    Optionnel : si ce client vous doit déjà un solde antérieur à l’ouverture du compte.
                  </span>
                </div>
              )}

              {editingCustomer && (() => {
                const summary = customerSummaryMap.get(editingCustomer.id);
                if (!summary) return null;
                return (
                  <div className="p-3 bg-[#F8F7F4] border border-[#E5E5E5] rounded space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1B1B1B] uppercase text-[10px] tracking-wider">
                        Situation actuelle (Achats − Acomptes)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const target = editingCustomer;
                          setIsCustomerModalOpen(false);
                          handleOpenAdjustDebtModal(target);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-[#E35E2D] bg-white hover:bg-[#FFF5F1] border border-[#E5E5E5] rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Ajuster la créance</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-[#1B1B1B]/60 block">Somme Achats</span>
                        <span className="font-mono font-bold text-[#1B1B1B]">
                          {formatFCFA(summary.totalPurchases)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#1B1B1B]/60 block">Somme Acomptes</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatFCFA(summary.totalAcomptes)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#1B1B1B]/60 block">Créance</span>
                        <span className="font-mono font-bold text-[#E35E2D]">
                          {formatFCFA(summary.creance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Observations
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Notes sur le compte client..."
                  className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded text-[#1B1B1B] hover:bg-[#F8F7F4] font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white rounded font-bold transition-colors cursor-pointer"
                >
                  {editingCustomer ? 'Enregistrer' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acompte / Règlement Modal */}
      {settlingCustomer && settlingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-[#E5E5E5] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B1B1B]">
                  Enregistrer un Acompte / Règlement
                </h3>
                <p className="text-xs text-[#1B1B1B]/60 mt-0.5">
                  Client : <strong>{settlingCustomer.name}</strong> ({settlingCustomer.code})
                </p>
              </div>
              <button
                onClick={() => setSettlingCustomer(null)}
                className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account Situation Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F7F4] rounded border border-[#E5E5E5] text-xs">
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Somme Achats</span>
                <span className="font-mono font-bold text-[#1B1B1B]">
                  {formatFCFA(settlingSummary.totalPurchases)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Somme Acomptes</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatFCFA(settlingSummary.totalAcomptes)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Créance actuelle</span>
                <span className="font-mono font-bold text-[#E35E2D]">
                  {formatFCFA(settlingSummary.creance)}
                </span>
              </div>
            </div>

            {settleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {settleError}
              </div>
            )}

            <form onSubmit={handleExecuteSettleDebt} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Montant de l’acompte versé (FCFA) *
                </label>
                <NumericInput
                  min={1}
                  step={100}
                  value={settleAmount}
                  onChange={(val) => setSettleAmount(val)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-base font-mono font-bold bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
                {settleAmount > 0 && (
                  <div className="mt-1.5 flex justify-between text-[11px] text-[#1B1B1B]/70">
                    <span>Créance restante après ce versement :</span>
                    <span className="font-mono font-bold text-[#1B1B1B]">
                      {formatFCFA(Math.max(0, settlingSummary.creance - settleAmount))}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Date de l’acompte *
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-[#E35E2D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={settleDate}
                      onChange={(e) => setSettleDate(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-2 font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Mode d'encaissement *
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded font-medium focus:outline-none focus:border-[#E35E2D]"
                  >
                    <option value="WAVE">Wave</option>
                    <option value="ESPECES">Espèces</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="VIREMENT">Virement Bancaire</option>
                    <option value="CARTE">Carte Bancaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  N° de Reçu / Référence
                </label>
                <input
                  type="text"
                  value={settleRef}
                  onChange={(e) => setSettleRef(e.target.value)}
                  placeholder="Ex: ACP-12345"
                  className="w-full px-3 py-2 font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Observations / Motif
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Acompte / règlement sur achats à crédit..."
                  className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded text-[#1B1B1B] hover:bg-[#F8F7F4] font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white rounded font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider l’acompte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Credit Purchases & Acomptes History Drawer */}
      {inspectingCustomer && inspectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-white h-full max-w-lg w-full border-l border-[#E5E5E5] shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-[#E35E2D]">
                  {inspectingCustomer.code}
                </span>
                <h3 className="text-base font-bold text-[#1B1B1B] mt-0.5">
                  {inspectingCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setInspectingCustomer(null)}
                className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clear Formula Banner: Somme des Achats - Somme des Acomptes = Montant de la Créance */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F7F4] border border-[#E5E5E5] rounded-lg text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/60 block">
                  Somme des Achats
                </span>
                <span className="font-mono font-bold text-[#1B1B1B] text-sm">
                  {formatFCFA(inspectedSummary.totalPurchases)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/60 block">
                  Somme des Acomptes
                </span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatFCFA(inspectedSummary.totalAcomptes)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/60 block">
                  Montant Créance
                </span>
                <span
                  className={`font-mono font-bold text-sm ${
                    inspectedSummary.creance > 0 ? 'text-[#E35E2D]' : 'text-[#1B1B1B]/60'
                  }`}
                >
                  {formatFCFA(inspectedSummary.creance)}
                </span>
              </div>
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-[#E5E5E5] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveHistoryTab('SALES')}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeHistoryTab === 'SALES'
                    ? 'border-[#E35E2D] text-[#E35E2D]'
                    : 'border-transparent text-[#1B1B1B]/60 hover:text-[#1B1B1B]'
                }`}
                title="Uniquement les achats à crédit (les achats payés directement ne sont pas listés)"
              >
                Achats à crédit ({inspectedSummary.creditSales.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab('PAYMENTS')}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeHistoryTab === 'PAYMENTS'
                    ? 'border-[#E35E2D] text-[#E35E2D]'
                    : 'border-transparent text-[#1B1B1B]/60 hover:text-[#1B1B1B]'
                }`}
              >
                Acomptes versés ({inspectedSummary.acomptePayments.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {activeHistoryTab === 'SALES' ? (
                inspectedSummary.creditSales.length === 0 &&
                inspectedSummary.debtAdjustments.length === 0 ? (
                  <div className="text-center py-12 text-[#1B1B1B]/40 text-xs">
                    Aucun achat à crédit ni ajustement pour ce client.
                  </div>
                ) : (
                  <>
                    {/* Debt adjustments list if any */}
                    {inspectedSummary.debtAdjustments.map((adj) => {
                      const isPositive = adj.amount >= 0;
                      return (
                        <div
                          key={adj.id}
                          className="p-3 bg-[#FFF5F1] border border-[#F5B79D] rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="inline-flex items-center gap-1.5 text-[#9A3412]">
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Ajustement de créance ({adj.id})</span>
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                isPositive ? 'text-[#E35E2D]' : 'text-emerald-700'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {formatFCFA(adj.amount)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#1B1B1B]/70 flex justify-between">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#E35E2D]" />
                              {formatDate(adj.date)}
                            </span>
                            {adj.userName && <span>Par : {adj.userName}</span>}
                          </div>
                          <div className="text-[11px] text-[#1B1B1B] font-medium">
                            Motif : {adj.reason}
                          </div>
                          {(currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
                            <div className="pt-1 flex justify-end border-t border-[#F5B79D]/50">
                              <button
                                type="button"
                                onClick={() =>
                                  deleteCustomerDebtAdjustment(inspectingCustomer.id, adj.id)
                                }
                                className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                title="Supprimer cet ajustement de créance"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Annuler l'ajustement</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Credit sales list */}
                    {inspectedSummary.creditSales.map((s) => {
                      const netAmt = getNetSaleAmount(s);
                      return (
                        <div
                          key={s.id}
                          onClick={() => setViewingReceiptSale(s)}
                          className="p-3 bg-[#F9FAFB] border border-[#E5E5E5] rounded-lg hover:border-[#E35E2D] cursor-pointer text-xs space-y-1 transition-colors"
                        >
                          <div className="flex justify-between font-bold">
                            <span className="font-mono text-[#1B1B1B]">{s.receiptNumber}</span>
                            <span className="font-mono text-[#1B1B1B]">{formatFCFA(netAmt)}</span>
                          </div>
                          <div className="text-[11px] text-[#1B1B1B]/60 flex justify-between">
                            <span>{formatDate(s.date)}</span>
                            <span>Magasin : {s.warehouseName}</span>
                          </div>
                          <div className="text-[11px] text-[#1B1B1B]/80 truncate">
                            {s.items.map((i) => `${i.quantity}x ${i.mainReference}`).join(', ')}
                          </div>
                          {s.totalPaid > 0 && (
                            <div className="pt-1 flex justify-between text-[11px] border-t border-[#E5E5E5]">
                              <span className="text-emerald-700 font-medium">
                                Acompte initial versé : {formatFCFA(s.totalPaid)}
                              </span>
                              <span className="font-mono font-semibold text-[#1B1B1B]/70">
                                Solde facture : {formatFCFA(Math.max(0, netAmt - s.totalPaid))}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )
              ) : inspectedSummary.acomptePayments.length === 0 ? (
                <div className="text-center py-12 text-[#1B1B1B]/40 text-xs">
                  Aucun acompte enregistré pour ce client.
                </div>
              ) : (
                inspectedSummary.acomptePayments.map((p) => {
                  const isInitialCheckoutAcompte = Boolean(p.saleId);
                  const isEditableRecord = payments.some((raw) => raw.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-[#F9FAFB] border border-[#E5E5E5] rounded-lg text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="font-mono text-[#1B1B1B]">{p.reference || p.id}</span>
                        <span className="font-mono text-emerald-700 text-sm font-bold">
                          +{formatFCFA(p.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {isInitialCheckoutAcompte ? 'Acompte initial sur achat' : 'Acompte / Versement'}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1B1B1B]/80">
                          <Calendar className="w-3 h-3 text-[#E35E2D]" />
                          {formatDate(p.date)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#1B1B1B]/70 flex justify-between">
                        <span>
                          Mode : <strong>{p.method}</strong>
                        </span>
                        <span>Opérateur : {p.userName}</span>
                      </div>
                      {p.notes && (
                        <p className="text-[11px] text-[#1B1B1B]/60 italic truncate">{p.notes}</p>
                      )}
                      <div className="pt-1 flex justify-end items-center gap-2 border-t border-[#E5E5E5]">
                        {isEditableRecord && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(p)}
                            className="px-2 py-1 text-[11px] font-semibold text-[#1B1B1B]/70 hover:text-[#E35E2D] bg-white hover:bg-[#F8F7F4] border border-[#E5E5E5] rounded inline-flex items-center gap-1 cursor-pointer"
                            title="Modifier la date, le montant ou le mode de cet acompte"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Date / Modifier</span>
                          </button>
                        )}
                        {!isInitialCheckoutAcompte &&
                          (currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
                            <button
                              type="button"
                              onClick={() => deleteCustomerPayment(p.id)}
                              className="p-1 text-[#1B1B1B]/40 hover:text-rose-600 rounded cursor-pointer"
                              title="Supprimer cet acompte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => {
                            setIssuedReceiptPayment(p);
                            setIssuedReceiptCustomer(inspectingCustomer);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#1B1B1B] bg-white hover:bg-[#F8F7F4] border border-[#E5E5E5] rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-[#E35E2D]" />
                          Voir le reçu
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick actions inside drawer */}
            <div className="pt-3 border-t border-[#E5E5E5] flex flex-wrap justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenAdjustDebtModal(inspectingCustomer)}
                className="px-3 py-2 text-xs font-semibold text-[#1B1B1B] bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#E35E2D]" />
                <span>Ajuster créance</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSettleModal(inspectingCustomer)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#E35E2D] hover:bg-[#1B1B1B] rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Enregistrer un acompte</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Acompte (Date / Amount / Method) */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-[#E5E5E5] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B1B1B]">
                  Modifier l’acompte ({editingPayment.reference || editingPayment.id})
                </h3>
                <p className="text-xs text-[#1B1B1B]/60 mt-0.5">
                  Modifier la date, le montant ou le mode d’encaissement
                </p>
              </div>
              <button
                onClick={() => setEditingPayment(null)}
                className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editPayError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {editPayError}
              </div>
            )}

            <form onSubmit={handleExecuteEditPayment} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Date de l’acompte *
                  </label>
                  <input
                    type="date"
                    required
                    value={editPayDate}
                    onChange={(e) => setEditPayDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Mode d’encaissement *
                  </label>
                  <select
                    value={editPayMethod}
                    onChange={(e) => setEditPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded font-medium focus:outline-none focus:border-[#E35E2D]"
                  >
                    <option value="WAVE">Wave</option>
                    <option value="ESPECES">Espèces</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="VIREMENT">Virement Bancaire</option>
                    <option value="CARTE">Carte Bancaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Montant de l’acompte (FCFA) *
                </label>
                <NumericInput
                  min={1}
                  step={100}
                  value={editPayAmount}
                  onChange={(val) => setEditPayAmount(val)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Référence / N° Reçu
                </label>
                <input
                  type="text"
                  value={editPayRef}
                  onChange={(e) => setEditPayRef(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Observations / Motif
                </label>
                <input
                  type="text"
                  value={editPayNotes}
                  onChange={(e) => setEditPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded text-[#1B1B1B] hover:bg-[#F8F7F4] font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white rounded font-bold transition-colors cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Debt Adjustment (Ajustement des créances) */}
      {adjustingCustomer && adjustingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-[#E5E5E5] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B1B1B] flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#E35E2D]" />
                  <span>Ajustement de la créance client</span>
                </h3>
                <p className="text-xs text-[#1B1B1B]/60 mt-0.5">
                  Client : <strong>{adjustingCustomer.name}</strong> ({adjustingCustomer.code})
                </p>
              </div>
              <button
                onClick={() => setAdjustingCustomer(null)}
                className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Account Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F7F4] rounded border border-[#E5E5E5] text-xs">
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Somme Achats</span>
                <span className="font-mono font-bold text-[#1B1B1B]">
                  {formatFCFA(adjustingSummary.totalPurchases)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Somme Acomptes</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatFCFA(adjustingSummary.totalAcomptes)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#1B1B1B]/60 block uppercase">Créance actuelle</span>
                <span className="font-mono font-bold text-[#E35E2D]">
                  {formatFCFA(adjustingSummary.creance)}
                </span>
              </div>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleExecuteAdjustDebt} className="space-y-3.5 text-xs">
              {/* Adjustment Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1.5">
                  Type d’ajustement *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('SET_TARGET');
                      setAdjustValue(adjustingSummary.creance);
                    }}
                    className={`py-2 px-2 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                      adjustMode === 'SET_TARGET'
                        ? 'bg-[#E35E2D] text-white border-[#E35E2D]'
                        : 'bg-[#F9FAFB] text-[#1B1B1B] border-[#E5E5E5]'
                    }`}
                  >
                    Fixer le solde
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('DELTA_ADD');
                      setAdjustValue(0);
                    }}
                    className={`py-2 px-2 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                      adjustMode === 'DELTA_ADD'
                        ? 'bg-[#E35E2D] text-white border-[#E35E2D]'
                        : 'bg-[#F9FAFB] text-[#1B1B1B] border-[#E5E5E5]'
                    }`}
                  >
                    + Augmenter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('DELTA_SUB');
                      setAdjustValue(0);
                    }}
                    className={`py-2 px-2 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                      adjustMode === 'DELTA_SUB'
                        ? 'bg-[#E35E2D] text-white border-[#E35E2D]'
                        : 'bg-[#F9FAFB] text-[#1B1B1B] border-[#E5E5E5]'
                    }`}
                  >
                    - Diminuer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    {adjustMode === 'SET_TARGET'
                      ? 'Nouvelle créance (FCFA) *'
                      : adjustMode === 'DELTA_ADD'
                      ? 'Montant à ajouter (FCFA) *'
                      : 'Montant à déduire (FCFA) *'}
                  </label>
                  <NumericInput
                    min={0}
                    step={1000}
                    value={adjustValue}
                    onChange={(val) => setAdjustValue(val)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                    Date de l’ajustement *
                  </label>
                  <input
                    type="date"
                    required
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>
              </div>

              {/* Preview of resulting créance */}
              <div className="p-2.5 bg-[#FFF5F1] border border-[#F5B79D] rounded flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#9A3412]">
                  Créance après ajustement :
                </span>
                <span className="font-mono font-bold text-sm text-[#E35E2D]">
                  {formatFCFA(
                    adjustMode === 'SET_TARGET'
                      ? Math.max(0, Number(adjustValue) || 0)
                      : adjustMode === 'DELTA_ADD'
                      ? adjustingSummary.creance + Math.max(0, Number(adjustValue) || 0)
                      : Math.max(0, adjustingSummary.creance - Math.max(0, Number(adjustValue) || 0))
                  )}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B1B1B]/70 uppercase mb-1">
                  Motif de l’ajustement *
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Solde antérieur, remise commerciale, régularisation..."
                  className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#E35E2D]"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'Solde initial / Dette antérieure',
                    'Régularisation de compte',
                    'Remise commerciale sur créance',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustReason(preset)}
                      className="px-2 py-0.5 text-[10px] bg-[#F8F7F4] hover:bg-[#E5E5E5] text-[#1B1B1B]/75 rounded border border-[#E5E5E5] cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingCustomer(null)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded text-[#1B1B1B] hover:bg-[#F8F7F4] font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white rounded font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider l’ajustement</span>
                </button>
              </div>
            </form>
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

      {/* Import Customers Modal */}
      <ImportCustomersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-[#E5E5E5] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 rounded bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B1B1B]">
                    Confirmer la suppression du client
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#1B1B1B]/60">
                    {customerToDelete.code} — {customerToDelete.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCustomerToDelete(null)}
                className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
              <p>
                Voulez-vous vraiment supprimer définitivement la fiche client{' '}
                <strong>{customerToDelete.name}</strong> ({customerToDelete.code}) ?
              </p>
              {(customerSummaryMap.get(customerToDelete.id)?.creance || 0) > 0 && (
                <p className="font-semibold text-rose-800">
                  Attention : ce client présente une créance de{' '}
                  {formatFCFA(customerSummaryMap.get(customerToDelete.id)?.creance || 0)}.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 border border-[#E5E5E5] rounded text-[#1B1B1B] hover:bg-[#F8F7F4] font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCustomer(customerToDelete.id);
                  if (inspectingCustomer?.id === customerToDelete.id) {
                    setInspectingCustomer(null);
                  }
                  setCustomerToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
