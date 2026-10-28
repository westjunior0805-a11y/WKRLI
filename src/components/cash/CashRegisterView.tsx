import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { CashMovement, CashSession, PaymentMethod } from '../../types';
import { formatFCFA, formatDateTime, exportToCSV } from '../../utils/formatters';
import {
  Banknote,
  QrCode,
  Smartphone,
  CreditCard,
  Building2,
  Lock,
  Unlock,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  X,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const CashRegisterView: React.FC = () => {
  const {
    cashSessions,
    cashMovements,
    warehouses,
    selectedWarehouseId,
    openCashSession,
    closeCashSession,
    recordCashExpense,
    currentUser,
  } = useStock();

  const [activeWarehouseId, setActiveWarehouseId] = useState(
    selectedWarehouseId ||
      (currentUser.role === 'MAGASINIER' && currentUser.assignedWarehouseId
        ? currentUser.assignedWarehouseId
        : warehouses[0]?.id || '')
  );

  // Open Session Modal
  const [isOpenModalActive, setIsOpenModalActive] = useState(false);
  const [initialFloatInput, setInitialFloatInput] = useState<number>(100000);
  const [openSessionNotes, setOpenSessionNotes] = useState('Ouverture normale de caisse');
  const [openError, setOpenError] = useState('');

  // Close Session Modal
  const [isCloseModalActive, setIsCloseModalActive] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [varianceReason, setVarianceReason] = useState('');
  const [closeSessionNotes, setCloseSessionNotes] = useState('');
  const [closeError, setCloseError] = useState('');

  // Expense / Withdrawal Modal
  const [isExpenseModalActive, setIsExpenseModalActive] = useState(false);
  const [expenseType, setExpenseType] = useState<'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES'>('DEPENSE');
  const [expenseAmount, setExpenseAmount] = useState<number>(10000);
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseError, setExpenseError] = useState('');

  // Selected session for historical inspection
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<CashSession | null>(null);

  const activeWarehouse = warehouses.find((w) => w.id === activeWarehouseId);

  // Active open session for current warehouse (if any)
  const currentOpenSession = useMemo(() => {
    return cashSessions.find((s) => s.warehouseId === activeWarehouseId && s.status === 'OPEN');
  }, [cashSessions, activeWarehouseId]);

  // Movements of active session or selected session
  const targetSession = selectedSessionForDetail || currentOpenSession;
  const sessionMovements = useMemo(() => {
    if (!targetSession) return [];
    return cashMovements.filter((m) => m.cashSessionId === targetSession.id);
  }, [cashMovements, targetSession]);

  // Calculations for target session
  const sessionStats = useMemo(() => {
    if (!targetSession) {
      return {
        initialFloat: 0,
        cashIn: 0,
        cashOut: 0,
        theoreticalCash: 0,
        totalWave: 0,
        totalOrangeMoney: 0,
        totalBank: 0,
        totalCard: 0,
      };
    }

    let cashIn = 0;
    let cashOut = 0;
    let totalWave = 0;
    let totalOrangeMoney = 0;
    let totalBank = 0;
    let totalCard = 0;

    sessionMovements.forEach((m) => {
      // Physical Cash Drawer calculations
      if (m.isCashInDrawer) {
        if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') {
          cashIn += m.amount;
        } else if (m.direction === 'OUT') {
          cashOut += m.amount;
        }
      }

      // Digital / Bank totals (separated from drawer cash!)
      if (m.method === 'WAVE') totalWave += m.amount;
      if (m.method === 'ORANGE_MONEY') totalOrangeMoney += m.amount;
      if (m.method === 'VIREMENT') totalBank += m.amount;
      if (m.method === 'CARTE') totalCard += m.amount;
    });

    const theoreticalCash = targetSession.initialCashFloat + cashIn - cashOut;

    return {
      initialFloat: targetSession.initialCashFloat,
      cashIn,
      cashOut,
      theoreticalCash,
      totalWave,
      totalOrangeMoney,
      totalBank,
      totalCard,
    };
  }, [targetSession, sessionMovements]);

  // Handle Open Session
  const handleExecuteOpen = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError('');

    const result = openCashSession({
      warehouseId: activeWarehouseId,
      initialCashFloat: Number(initialFloatInput) || 0,
      notes: openSessionNotes.trim(),
    });

    if (!result.success) {
      setOpenError(result.error || 'Erreur lors de l’ouverture de caisse.');
    } else {
      setIsOpenModalActive(false);
    }
  };

  // Handle Close Session
  const handlePrepareClose = () => {
    if (!currentOpenSession) return;
    setCountedCashInput(currentOpenSession.theoreticalCash);
    setVarianceReason('');
    setCloseSessionNotes('');
    setCloseError('');
    setIsCloseModalActive(true);
  };

  const handleExecuteClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOpenSession) return;
    setCloseError('');

    const result = closeCashSession({
      sessionId: currentOpenSession.id,
      countedCash: Number(countedCashInput),
      varianceJustification: varianceReason,
      notes: closeSessionNotes,
    });

    if (!result.success) {
      setCloseError(result.error || 'Erreur lors de la clôture.');
    } else {
      setIsCloseModalActive(false);
    }
  };

  // Handle Cash Expense
  const handleExecuteExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    if (!expenseReason.trim()) {
      setExpenseError('Le motif de la dépense ou du retrait est obligatoire.');
      return;
    }

    const result = recordCashExpense({
      warehouseId: activeWarehouseId,
      type: expenseType,
      amount: Number(expenseAmount),
      reason: expenseReason.trim(),
      notes: expenseNotes.trim() || undefined,
    });

    if (!result.success) {
      setExpenseError(result.error || 'Erreur lors de la saisie.');
    } else {
      setIsExpenseModalActive(false);
      setExpenseReason('');
      setExpenseNotes('');
    }
  };

  const handleExportMovementsCSV = () => {
    const headers = [
      'ID Mouvement Caisse',
      'Session Caisse',
      'Date & Heure',
      'Type',
      'Sens',
      'Mode de Paiement',
      'Montant (FCFA)',
      'Espèces en Tiroir ?',
      'Motif',
      'N° Vente / Document',
      'Utilisateur',
    ];

    const rows = sessionMovements.map((m) => [
      m.id,
      m.cashSessionId,
      formatDateTime(m.date),
      m.type,
      m.direction,
      m.method,
      m.amount,
      m.isCashInDrawer ? 'OUI (Tiroir physique)' : 'NON (Digital/Banque)',
      m.reason,
      m.documentRef || '',
      m.userName,
    ]);

    exportToCSV(`mouvements_caisse_${targetSession?.id || 'session'}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Warehouse Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg text-white ${
              currentOpenSession ? 'bg-emerald-600' : 'bg-slate-700'
            }`}
          >
            {currentOpenSession ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Gestion de Caisse & Tiroir
              </h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  currentOpenSession
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {currentOpenSession ? 'Session Ouverte' : 'Caisse Fermée'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Contrôle du fond de caisse, encaissements, dépenses et clôtures avec calcul d'écart
            </p>
          </div>
        </div>

        {/* Warehouse Selector & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={activeWarehouseId}
              onChange={(e) => {
                setActiveWarehouseId(e.target.value);
                setSelectedSessionForDetail(null);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
          </div>

          {!currentOpenSession ? (
            <button
              onClick={() => {
                setInitialFloatInput(100000);
                setOpenError('');
                setIsOpenModalActive(true);
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Ouvrir la caisse
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setExpenseAmount(10000);
                  setExpenseReason('');
                  setExpenseError('');
                  setIsExpenseModalActive(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <Minus className="w-3.5 h-3.5 text-rose-600" />
                Dépense / Retrait
              </button>

              <button
                onClick={handlePrepareClose}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Clôturer la caisse
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE SESSION DASHBOARD (If active session exists or one is inspected) */}
      {targetSession ? (
        <div className="space-y-4">
          {/* Main Cash Drawer Calculation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Box 1: Fond Initial */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Fond de Caisse Initial
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-900">
                  {formatFCFA(sessionStats.initialFloat)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Espèces</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Ouvert par {targetSession.openedByUserName}
              </div>
            </div>

            {/* Box 2: Total Encaissements Espèces */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                + Encaissements Espèces
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  +{formatFCFA(sessionStats.cashIn)}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">Tiroir physique</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ventes et règlements espèces</div>
            </div>

            {/* Box 3: Dépenses et Sorties Espèces */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                - Sorties & Dépenses Espèces
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-rose-600">
                  -{formatFCFA(sessionStats.cashOut)}
                </span>
                <span className="text-[10px] text-rose-600 font-semibold">Retraits</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Frais, carburant ou dépôts</div>
            </div>

            {/* Box 4: Solde Théorique en Espèces (CRITICAL FORMULA) */}
            <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-xl shadow-sm">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                = Solde Théorique Espèces
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white tabular-nums">
                  {formatFCFA(sessionStats.theoreticalCash)}
                </span>
                <Banknote className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Espèces obligatoirement présentes au tiroir
              </div>
            </div>
          </div>

          {/* DIGITAL & BANK BALANCES (Strictly decoupled from cash drawer) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Encaissements Numériques & Bancaires (Hors Tiroir-Caisse)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Règle stricte : Wave, OM et virements sont des écritures électroniques séparées de la monnaie physique.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-900 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-sky-600" />
                    Wave Sénégal
                  </span>
                </div>
                <div className="mt-2 font-mono font-bold text-base text-sky-900">
                  {formatFCFA(sessionStats.totalWave)}
                </div>
              </div>

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-orange-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                    Orange Money
                  </span>
                </div>
                <div className="mt-2 font-mono font-bold text-base text-orange-900">
                  {formatFCFA(sessionStats.totalOrangeMoney)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-600" />
                    Virements Bancaires
                  </span>
                </div>
                <div className="mt-2 font-mono font-bold text-base text-slate-900">
                  {formatFCFA(sessionStats.totalBank)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                    Cartes Bancaires
                  </span>
                </div>
                <div className="mt-2 font-mono font-bold text-base text-slate-900">
                  {formatFCFA(sessionStats.totalCard)}
                </div>
              </div>
            </div>
          </div>

          {/* Session Movements Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                  Journal des flux de caisse de la session ({sessionMovements.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Session : <strong className="font-mono">{targetSession.id}</strong> · {targetSession.warehouseName}
                </span>
              </div>
              <button
                onClick={handleExportMovementsCSV}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export Journal
              </button>
            </div>

            <div className="overflow-x-auto">
              {sessionMovements.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Aucun mouvement enregistré pour cette session de caisse.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Heure</th>
                      <th className="py-2.5 px-3">Type d'opération</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Motif & Justification</th>
                      <th className="py-2.5 px-3 text-right">Montant</th>
                      <th className="py-2.5 px-3 text-center">Tiroir Espèces</th>
                      <th className="py-2.5 px-3">Caissier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessionMovements.map((m, idx) => (
                      <tr key={`${m.id}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateTime(m.date).split(' ')[1] || formatDateTime(m.date)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              m.type === 'VENTE_ESPECES' || m.type === 'APPORT_ESPECES'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.type === 'DEPENSE' || m.type === 'REMBOURSEMENT' || m.type === 'RETRAIT_BANQUE'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {m.method}
                        </td>

                        <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate">
                          {m.reason}
                          {m.documentRef && (
                            <span className="font-mono text-[10px] text-slate-400 ml-1.5">
                              ({m.documentRef})
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                          <span
                            className={
                              m.direction === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                            }
                          >
                            {m.direction === 'IN' ? '+' : '-'} {formatFCFA(m.amount)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {m.isCashInDrawer ? (
                            <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Oui (Tiroir)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Non (Électronique)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {m.userName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state: No active session */
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Caisse fermée pour {activeWarehouse?.name}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Pour commencer à enregistrer des encaissements en espèces au comptoir et gérer le tiroir-caisse, veuillez ouvrir une session avec un fond de caisse initial.
          </p>
          <button
            onClick={() => {
              setInitialFloatInput(100000);
              setOpenError('');
              setIsOpenModalActive(true);
            }}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            Ouvrir la session de caisse
          </button>
        </div>
      )}

      {/* Historical Sessions Accordion / Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-3">
          Historique des sessions de caisse ({cashSessions.length})
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          {cashSessions.map((session, idx) => (
            <div
              key={`${session.id}-${idx}`}
              onClick={() => setSelectedSessionForDetail(session)}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer px-2 rounded transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{session.id}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      session.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {session.status === 'OPEN' ? 'En cours' : 'Clôturée'}
                  </span>
                  <span className="text-slate-500">· {session.warehouseName}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Ouverte le {formatDateTime(session.openedAt)} par {session.openedByUserName}
                  {session.closedAt && ` · Clôturée le ${formatDateTime(session.closedAt)}`}
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[11px] text-slate-400 block">Solde Espèces</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatFCFA(session.theoreticalCash)}
                  </span>
                </div>
                {session.status === 'CLOSED' && session.cashVariance !== 0 && (
                  <div>
                    <span className="text-[11px] text-slate-400 block">Écart constaté</span>
                    <span
                      className={`font-mono font-bold ${
                        session.cashVariance > 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {session.cashVariance > 0 ? `+` : ''}
                      {formatFCFA(session.cashVariance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Open Cash Session */}
      {isOpenModalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ouverture de session de caisse
                </h3>
                <p className="text-xs text-slate-500">
                  Magasin : <strong>{activeWarehouse?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsOpenModalActive(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {openError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {openError}
              </div>
            )}

            <form onSubmit={handleExecuteOpen} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Fond de caisse initial en espèces (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={initialFloatInput}
                  onChange={(e) => setInitialFloatInput(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 100000"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Montant en monnaie liquide présent dans le tiroir au démarrage.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Notes d'ouverture
                </label>
                <input
                  type="text"
                  value={openSessionNotes}
                  onChange={(e) => setOpenSessionNotes(e.target.value)}
                  placeholder="Ex: Équipe matin, caissier titulaire..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenModalActive(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs"
                >
                  Valider l'ouverture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Cash Session */}
      {isCloseModalActive && currentOpenSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Clôture définitive de la caisse
                </h3>
                <p className="text-xs text-slate-500">
                  Session : <strong>{currentOpenSession.id}</strong> · {currentOpenSession.warehouseName}
                </p>
              </div>
              <button
                onClick={() => setIsCloseModalActive(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Theoretical Balance Reminder */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Fond initial :</span>
                <span className="font-mono">{formatFCFA(sessionStats.initialFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Encaissements espèces :</span>
                <span className="font-mono text-emerald-700">+{formatFCFA(sessionStats.cashIn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dépenses / Retraits :</span>
                <span className="font-mono text-rose-600">-{formatFCFA(sessionStats.cashOut)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                <span>SOLDE THÉORIQUE ATTENDU :</span>
                <span className="font-mono">{formatFCFA(sessionStats.theoreticalCash)}</span>
              </div>
            </div>

            {closeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {closeError}
              </div>
            )}

            <form onSubmit={handleExecuteClose} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Montant physique réellement compté en espèces (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              {/* Variance display */}
              {countedCashInput !== sessionStats.theoreticalCash && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    countedCashInput - sessionStats.theoreticalCash > 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>Écart de caisse :</span>
                    <span className="font-mono text-sm">
                      {countedCashInput - sessionStats.theoreticalCash > 0 ? '+' : ''}
                      {formatFCFA(countedCashInput - sessionStats.theoreticalCash)}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1">
                    {countedCashInput - sessionStats.theoreticalCash > 0
                      ? 'Excédent constaté dans le tiroir.'
                      : 'Déficit constaté dans le tiroir.'}
                  </p>
                </div>
              )}

              {/* Justification mandatory if variance != 0 */}
              {countedCashInput !== sessionStats.theoreticalCash && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Justification obligatoire de l'écart *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    placeholder="Expliquez la cause de la différence (erreur de monnaie, pourboire client...)"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalActive(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
                >
                  Clôturer et Verrouiller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cash Expense / Withdrawal */}
      {isExpenseModalActive && currentOpenSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Opération de caisse (Dépense / Retrait)
                </h3>
                <p className="text-xs text-slate-500">
                  Caisse : <strong>{currentOpenSession.id}</strong> (Disponible tiroir :{' '}
                  {formatFCFA(currentOpenSession.theoreticalCash)})
                </p>
              </div>
              <button
                onClick={() => setIsExpenseModalActive(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleExecuteExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Type d'opération *
                </label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="DEPENSE">Petite Dépense (Carburant, Fournitures...)</option>
                  <option value="RETRAIT_BANQUE">Retrait pour Versement Banque</option>
                  <option value="APPORT_ESPECES">Apport de Monnaie Supplémentaire (+)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Montant en espèces (FCFA) *
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif / Justificatif *
                </label>
                <input
                  type="text"
                  required
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder="Ex: Achat fournitures bureau, versement CBAO..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalActive(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
                >
                  Enregistrer l'opération
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
