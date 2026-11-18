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
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  X,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Clock,
  ArrowUpDown,
  RotateCcw,
  Trash2,
  Pencil,
} from 'lucide-react';
import { NumericInput } from '../common/NumericInput';

export const CashRegisterView: React.FC = () => {
  const {
    sales,
    cashSessions,
    cashMovements,
    openCashSession,
    closeCashSession,
    reopenCashSession,
    updateCashSessionInitialFloat,
    deleteCashMovement,
    recordCashExpense,
    transferElectronicToCashDrawer,
    currentUser,
  } = useStock();

  const isAdmin = currentUser.role === 'ADMIN';

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

  // Reopen Closed Session Modal (Admin only)
  const [sessionToReopen, setSessionToReopen] = useState<CashSession | null>(null);
  const [reopenReason, setReopenReason] = useState('Correction administrative d’écritures de caisse');
  const [reopenError, setReopenError] = useState('');

  // Edit Initial Float Modal (Admin only)
  const [isEditFloatModalActive, setIsEditFloatModalActive] = useState(false);
  const [editFloatInput, setEditFloatInput] = useState<number>(0);
  const [editFloatReason, setEditFloatReason] = useState('Ajustement du fond de caisse initial');
  const [editFloatError, setEditFloatError] = useState('');

  // Admin Feedback Banner
  const [adminBanner, setAdminBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expense / Withdrawal Modal
  const [isExpenseModalActive, setIsExpenseModalActive] = useState(false);
  const [expenseType, setExpenseType] = useState<'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES'>('DEPENSE');
  const [expenseAmount, setExpenseAmount] = useState<number>(10000);
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseError, setExpenseError] = useState('');

  // Electronic to Cash Drawer Transfer Modal
  const [isTransferModalActive, setIsTransferModalActive] = useState(false);
  const [transferSource, setTransferSource] = useState<'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CARTE'>('WAVE');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferReference, setTransferReference] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  // Chronological sort order for session ledger ('ASC' = chronological by transaction date, 'DESC' = reverse chronological)
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Selected session ID for historical inspection (kept in sync with cashSessions updates)
  const [selectedSessionIdForDetail, setSelectedSessionIdForDetail] = useState<string | null>(null);

  // Active open session globally (independent of warehouses)
  const currentOpenSession = useMemo(() => {
    return cashSessions.find((s) => s.status === 'OPEN');
  }, [cashSessions]);

  const selectedSessionForDetail = useMemo(() => {
    if (!selectedSessionIdForDetail) return null;
    return cashSessions.find((s) => s.id === selectedSessionIdForDetail) || null;
  }, [cashSessions, selectedSessionIdForDetail]);

  // Movements of active session or selected session, synchronized with backdated sale dates and ordered by transaction date
  const targetSession = selectedSessionForDetail || currentOpenSession;
  const sessionMovements = useMemo(() => {
    if (!targetSession) return [];

    const saleById = new Map<string, (typeof sales)[number]>();
    const saleByReceipt = new Map<string, (typeof sales)[number]>();
    for (const s of sales) {
      saleById.set(s.id, s);
      if (s.receiptNumber) saleByReceipt.set(s.receiptNumber, s);
    }

    return cashMovements
      .filter((m) => {
        if (m.cashSessionId !== targetSession.id) return false;
        // Exclude movements belonging to cancelled, refunded, or deleted sales
        if (m.saleId) {
          const linked = saleById.get(m.saleId);
          if (!linked || linked.status === 'CANCELLED' || linked.status === 'REFUNDED') return false;
        } else if (m.documentRef && m.documentRef.startsWith('REC-')) {
          const linked = saleByReceipt.get(m.documentRef);
          if (linked && (linked.status === 'CANCELLED' || linked.status === 'REFUNDED')) return false;
        }
        return true;
      })
      .map((m) => {
        // Ensure backdated sales reflect their exact transaction date in the cash ledger
        const linkedSale =
          (m.saleId ? saleById.get(m.saleId) : undefined) ||
          (m.documentRef ? saleByReceipt.get(m.documentRef) : undefined);
        if (linkedSale && linkedSale.date && linkedSale.date !== m.date) {
          return { ...m, date: linkedSale.date };
        }
        return m;
      })
      .sort((a, b) => {
        const tA = new Date(a.date).getTime();
        const tB = new Date(b.date).getTime();
        return ledgerSortOrder === 'ASC' ? tA - tB : tB - tA;
      });
  }, [cashMovements, targetSession, sales, ledgerSortOrder]);

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
        totalTransferredToCash: 0,
        netTotalDigital: 0,
      };
    }

    let cashIn = 0;
    let cashOut = 0;
    let totalWave = 0;
    let totalOrangeMoney = 0;
    let totalBank = 0;
    let totalCard = 0;
    let totalTransferredToCash = 0;

    sessionMovements.forEach((m) => {
      // Physical Cash Drawer calculations
      if (m.isCashInDrawer) {
        if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') {
          cashIn += m.amount;
        } else if (m.direction === 'OUT') {
          cashOut += m.amount;
        }
      }

      // Digital / Bank totals (net balance available after electronic-to-cash transfers)
      if (m.method === 'WAVE') {
        if (m.direction === 'IN') totalWave += m.amount;
        else if (m.direction === 'OUT') totalWave -= m.amount;
      }
      if (m.method === 'ORANGE_MONEY') {
        if (m.direction === 'IN') totalOrangeMoney += m.amount;
        else if (m.direction === 'OUT') totalOrangeMoney -= m.amount;
      }
      if (m.method === 'VIREMENT') {
        if (m.direction === 'IN') totalBank += m.amount;
        else if (m.direction === 'OUT') totalBank -= m.amount;
      }
      if (m.method === 'CARTE') {
        if (m.direction === 'IN') totalCard += m.amount;
        else if (m.direction === 'OUT') totalCard -= m.amount;
      }

      if (m.type === 'TRANSFERT_ELECTRONIQUE_TIROIR' && m.isCashInDrawer) {
        totalTransferredToCash += m.amount;
      }
    });

    const theoreticalCash = targetSession.initialCashFloat + cashIn - cashOut;
    const netTotalDigital = Math.max(0, totalWave) + Math.max(0, totalOrangeMoney) + Math.max(0, totalBank) + Math.max(0, totalCard);

    return {
      initialFloat: targetSession.initialCashFloat,
      cashIn,
      cashOut,
      theoreticalCash,
      totalWave: Math.max(0, totalWave),
      totalOrangeMoney: Math.max(0, totalOrangeMoney),
      totalBank: Math.max(0, totalBank),
      totalCard: Math.max(0, totalCard),
      totalTransferredToCash,
      netTotalDigital,
    };
  }, [targetSession, sessionMovements]);

  // Quick Open Transfer Modal for specific source
  const handleOpenTransferFor = (source: 'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CARTE', maxAvail: number) => {
    setTransferSource(source);
    setTransferAmount(maxAvail > 0 ? maxAvail : 0);
    setTransferReference('');
    setTransferNotes('');
    setTransferError('');
    setTransferSuccess('');
    setIsTransferModalActive(true);
  };

  // Handle Execute Electronic to Cash Transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess('');

    if (!transferAmount || transferAmount <= 0) {
      setTransferError('Veuillez saisir un montant supérieur à zéro.');
      return;
    }

    const res = transferElectronicToCashDrawer({
      sourceMethod: transferSource,
      amount: Number(transferAmount),
      reference: transferReference.trim(),
      notes: transferNotes.trim(),
      customDate: transferDate || undefined,
    });

    if (!res.success) {
      setTransferError(res.error || 'Erreur lors du transfert.');
    } else {
      setTransferSuccess(`Transfert de ${formatFCFA(transferAmount)} effectué avec succès vers les espèces du tiroir !`);
      setTimeout(() => {
        setIsTransferModalActive(false);
        setTransferSuccess('');
        setTransferAmount(0);
        setTransferReference('');
        setTransferNotes('');
      }, 1400);
    }
  };

  // Handle Open Session (Centralized Counter Cash Register — Independent of Warehouses)
  const handleExecuteOpen = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError('');

    const result = openCashSession({
      initialCashFloat: Number(initialFloatInput) || 0,
      notes: openSessionNotes.trim(),
    });

    if (!result.success) {
      setOpenError(result.error || 'Erreur lors de l’ouverture de caisse.');
    } else {
      setSelectedSessionIdForDetail(null);
      setIsOpenModalActive(false);
    }
  };

  // Handle Close Session
  const handlePrepareClose = () => {
    if (!currentOpenSession) return;
    setCountedCashInput(sessionStats.theoreticalCash);
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

  // Handle Reopen Closed Session (Admin)
  const handleExecuteReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToReopen) return;
    setReopenError('');

    const res = reopenCashSession(sessionToReopen.id, reopenReason);
    if (!res.success) {
      setReopenError(res.error || 'Impossible de rouvrir cette session.');
    } else {
      setSessionToReopen(null);
      setSelectedSessionIdForDetail(null);
      setAdminBanner({
        type: 'success',
        message:
          res.message ||
          `Session ${sessionToReopen.id} réouverte avec succès. Vous pouvez maintenant corriger les opérations puis la clôturer à nouveau.`,
      });
    }
  };

  // Handle Edit Initial Float (Admin)
  const handleExecuteEditFloat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSession) return;
    setEditFloatError('');

    const res = updateCashSessionInitialFloat(
      targetSession.id,
      Number(editFloatInput) || 0,
      editFloatReason
    );
    if (!res.success) {
      setEditFloatError(res.error || 'Erreur lors de la modification du fond initial.');
    } else {
      setIsEditFloatModalActive(false);
      setAdminBanner({
        type: 'success',
        message: res.message || 'Fond de caisse initial corrigé avec succès.',
      });
    }
  };

  // Handle Delete Cash Movement (Admin)
  const handleDeleteMovement = (mvt: CashMovement) => {
    const res = deleteCashMovement(mvt.id);
    setAdminBanner({
      type: res.success ? 'success' : 'error',
      message: res.message || res.error || 'Opération effectuée.',
    });
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
      type: expenseType,
      amount: Number(expenseAmount),
      reason: expenseReason.trim(),
      notes: expenseNotes.trim() || undefined,
      customDate: expenseDate || undefined,
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
      {/* Top Banner — Caisse Centrale Guichet */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          className="flex items-center gap-3"
          title="Caisse centralisée de l’entreprise : encaisse toutes les ventes et tous les règlements clients sans distinction de magasin"
        >
          <div
            className={`p-2.5 rounded text-white ${
              currentOpenSession ? 'bg-emerald-600' : 'bg-[#1B1B1B]'
            }`}
          >
            {currentOpenSession ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-base font-bold text-[#1B1B1B]">
              Caisse Principale
            </h2>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                currentOpenSession
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-[#F9FAFB] text-[#1B1B1B]/60 border border-[#E5E5E5]'
              }`}
            >
              {currentOpenSession
                ? `Ouverte (${currentOpenSession.id})`
                : 'Fermée'}
            </span>
          </div>
        </div>

        {/* Cash Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!currentOpenSession ? (
            <button
              onClick={() => {
                setInitialFloatInput(100000);
                setOpenError('');
                setIsOpenModalActive(true);
              }}
              title="Ouvrir une nouvelle session de caisse"
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Ouvrir la caisse</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTransferSource('WAVE');
                  setTransferAmount(sessionStats.totalWave > 0 ? sessionStats.totalWave : 0);
                  setTransferReference('');
                  setTransferNotes('');
                  setTransferError('');
                  setTransferSuccess('');
                  setIsTransferModalActive(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-[#1B1B1B] bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                title="Transférer une écriture électronique (Wave, Orange Money, Banque) vers les espèces du tiroir"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#E35E2D]" />
                <span>Transfert vers Espèces</span>
              </button>

              <button
                onClick={() => {
                  setExpenseAmount(10000);
                  setExpenseReason('');
                  setExpenseError('');
                  setIsExpenseModalActive(true);
                }}
                title="Enregistrer une dépense, un retrait banque ou un apport d'espèces"
                className="px-3 py-2 text-xs font-semibold text-[#1B1B1B] bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 text-rose-600" />
                <span>Dépense / Retrait</span>
              </button>

              <button
                onClick={handlePrepareClose}
                title="Compter les espèces du tiroir et clôturer la session de caisse"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1B1B1B] hover:bg-[#E35E2D] rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-white" />
                <span>Clôturer la caisse</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Feedback Banner */}
      {adminBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            adminBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {adminBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{adminBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminBanner(null)}
            className="text-xs font-bold underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Historical Inspection Banner (When viewing a closed or past session) */}
      {selectedSessionForDetail && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold">
                Consultation de la session {selectedSessionForDetail.id} (
                {selectedSessionForDetail.status === 'OPEN' ? 'Ouverte' : 'Clôturée'})
              </span>
              <span className="text-amber-800 ml-2">
                · Ouverte le {formatDateTime(selectedSessionForDetail.openedAt)} par{' '}
                {selectedSessionForDetail.openedByUserName}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && selectedSessionForDetail.status === 'CLOSED' && (
              <button
                type="button"
                onClick={() => {
                  setSessionToReopen(selectedSessionForDetail);
                  setReopenReason('Correction administrative d’écritures de caisse');
                  setReopenError('');
                }}
                title="Rouvrir cette session clôturée pour effectuer des corrections (Administrateur)"
                className="px-3 py-1.5 rounded bg-[#E35E2D] hover:bg-[#C94D1E] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rouvrir la caisse</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedSessionIdForDetail(null)}
              title="Quitter la consultation de cette session passée et revenir à la caisse actuelle"
              className="px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-800 border border-amber-300 font-semibold cursor-pointer"
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE SESSION DASHBOARD (If active session exists or one is inspected) */}
      {targetSession ? (
        <div className="space-y-4">
          {/* Main Cash Drawer Calculation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Box 1: Fond Initial */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Fond de Caisse Initial
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditFloatInput(targetSession.initialCashFloat);
                      setEditFloatReason('Correction du fond de caisse initial');
                      setEditFloatError('');
                      setIsEditFloatModalActive(true);
                    }}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer"
                    title="Corriger le montant du fond de caisse initial (Administrateur)"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>Corriger</span>
                  </button>
                )}
              </div>
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
              <div className="text-[11px] text-slate-400 mt-1">
                {sessionStats.totalTransferredToCash > 0
                  ? `Inclut ${formatFCFA(sessionStats.totalTransferredToCash)} transféré depuis digital`
                  : 'Ventes et règlements espèces'}
              </div>
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

          {/* DIGITAL & BANK BALANCES (With Transfer Option into Drawer) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Écritures Numériques & Bancaires (Hors Tiroir-Caisse)
                  </h3>
                  {sessionStats.totalTransferredToCash > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Déjà transféré vers tiroir : {formatFCFA(sessionStats.totalTransferredToCash)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Solde net disponible par canal. Utilisez le bouton « Transfert vers Espèces » en haut ou « Vers tiroir » sur un canal pour basculer les écritures dans le tiroir physique.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Wave */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-900 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-sky-600" />
                    Wave Sénégal
                  </span>
                  {currentOpenSession && sessionStats.totalWave > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTransferFor('WAVE', sessionStats.totalWave)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-200/80 hover:bg-sky-300 text-sky-950 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Transférer le solde Wave vers les espèces du tiroir"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>Vers tiroir</span>
                    </button>
                  )}
                </div>
                <div>
                  <div className="font-mono font-bold text-base text-sky-900 tabular-nums">
                    {formatFCFA(sessionStats.totalWave)}
                  </div>
                  <span className="text-[10px] text-sky-700">Solde disponible</span>
                </div>
              </div>

              {/* Orange Money */}
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-orange-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                    Orange Money
                  </span>
                  {currentOpenSession && sessionStats.totalOrangeMoney > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTransferFor('ORANGE_MONEY', sessionStats.totalOrangeMoney)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-200/80 hover:bg-orange-300 text-orange-950 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Transférer le solde Orange Money vers les espèces du tiroir"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>Vers tiroir</span>
                    </button>
                  )}
                </div>
                <div>
                  <div className="font-mono font-bold text-base text-orange-900 tabular-nums">
                    {formatFCFA(sessionStats.totalOrangeMoney)}
                  </div>
                  <span className="text-[10px] text-orange-700">Solde disponible</span>
                </div>
              </div>

              {/* Virements */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-600" />
                    Virements
                  </span>
                  {currentOpenSession && sessionStats.totalBank > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTransferFor('VIREMENT', sessionStats.totalBank)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Transférer un virement retiré vers les espèces du tiroir"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>Vers tiroir</span>
                    </button>
                  )}
                </div>
                <div>
                  <div className="font-mono font-bold text-base text-slate-900 tabular-nums">
                    {formatFCFA(sessionStats.totalBank)}
                  </div>
                  <span className="text-[10px] text-slate-500">Solde disponible</span>
                </div>
              </div>

              {/* Cartes */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                    Cartes TPE
                  </span>
                  {currentOpenSession && sessionStats.totalCard > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTransferFor('CARTE', sessionStats.totalCard)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Transférer le solde carte TPE vers les espèces du tiroir"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>Vers tiroir</span>
                    </button>
                  )}
                </div>
                <div>
                  <div className="font-mono font-bold text-base text-slate-900 tabular-nums">
                    {formatFCFA(sessionStats.totalCard)}
                  </div>
                  <span className="text-[10px] text-slate-500">Solde disponible</span>
                </div>
              </div>
            </div>
          </div>

          {/* Session Movements Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                  Journal des flux de caisse de la session ({sessionMovements.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Session : <strong className="font-mono">{targetSession.id}</strong> · {targetSession.warehouseName} · Trié par date de transaction ({ledgerSortOrder === 'ASC' ? 'Chronologique' : 'Plus récent en premier'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  title="Inverser l'ordre de tri par date de transaction"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                  <span>{ledgerSortOrder === 'ASC' ? 'Ancien ➔ Récent' : 'Récent ➔ Ancien'}</span>
                </button>
                <button
                  onClick={handleExportMovementsCSV}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Journal
                </button>
              </div>
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
                      <th className="py-2.5 px-3">Date & Heure</th>
                      <th className="py-2.5 px-3">Type d'opération</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Motif & Justification</th>
                      <th className="py-2.5 px-3 text-right">Montant</th>
                      <th className="py-2.5 px-3 text-center">Tiroir Espèces</th>
                      <th className="py-2.5 px-3">Caissier</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Correction</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessionMovements.map((m, idx) => {
                      const mDateObj = new Date(m.date);
                      const datePart = mDateObj.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });
                      const timePart = mDateObj.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isInitMvt =
                        m.id.startsWith('CSM-INIT') ||
                        m.reason === 'Fond de caisse initial à l’ouverture';
                      const canDeleteManualMvt = isAdmin && !isInitMvt && !m.saleId;

                      return (
                        <tr key={`${m.id}-${idx}`} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{datePart}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 pl-5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{timePart}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.type === 'TRANSFERT_ELECTRONIQUE_TIROIR'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                  : m.type === 'VENTE_ESPECES' || m.type === 'APPORT_ESPECES'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.type === 'DEPENSE' || m.type === 'REMBOURSEMENT' || m.type === 'RETRAIT_BANQUE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {m.type === 'TRANSFERT_ELECTRONIQUE_TIROIR'
                                ? m.isCashInDrawer
                                  ? 'TRANSFERT ➔ TIROIR (+)'
                                  : 'TRANSFERT ➔ TIROIR (-)'
                                : m.type}
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

                          {isAdmin && (
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {canDeleteManualMvt ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMovement(m)}
                                  className="px-2 py-1 rounded text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1 cursor-pointer"
                                  title="Supprimer cette écriture erronée et recalculer le solde de caisse"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Supprimer</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
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
            Caisse Principale (Guichet) fermée
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            La caisse est unique et centralisée pour toute l’entreprise (indépendante des magasins de stockage). Ouvrez une session avec un fond de caisse initial pour démarrer les encaissements, ou rouvrez une session clôturée ci-dessous si vous devez y apporter une correction.
          </p>
          <button
            onClick={() => {
              setInitialFloatInput(100000);
              setOpenError('');
              setIsOpenModalActive(true);
            }}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            Ouvrir la session de caisse
          </button>
        </div>
      )}

      {/* Historical Sessions Accordion / Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider">
            Historique des sessions de caisse ({cashSessions.length})
          </h3>
          {isAdmin && (
            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
              Astuce Admin : Cliquez sur « Rouvrir pour correction » sur une caisse clôturée pour ajuster ses écritures.
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {cashSessions.map((session, idx) => (
            <div
              key={`${session.id}-${idx}`}
              onClick={() => setSelectedSessionIdForDetail(session.id)}
              className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer px-2.5 rounded-lg transition-colors ${
                targetSession?.id === session.id ? 'bg-slate-50 ring-1 ring-slate-200' : ''
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-slate-500">· Caisse Principale (Guichet)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Ouverte le {formatDateTime(session.openedAt)} par {session.openedByUserName}
                  {session.closedAt && ` · Clôturée le ${formatDateTime(session.closedAt)}`}
                </div>
                {session.notes && (
                  <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xl">
                    Note : {session.notes}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-right">
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
                {isAdmin && session.status === 'CLOSED' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToReopen(session);
                      setReopenReason('Correction administrative d’écritures de caisse');
                      setReopenError('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Rouvrir cette session de caisse pour faire des corrections (Administrateur)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Rouvrir pour correction</span>
                  </button>
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
                  Initialisation du tiroir-caisse physique
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
                <NumericInput
                  min={0}
                  step={1000}
                  value={initialFloatInput}
                  onChange={(val) => setInitialFloatInput(val)}
                  placeholder="0"
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
                <NumericInput
                  min={0}
                  step={500}
                  value={countedCashInput}
                  onChange={(val) => setCountedCashInput(val)}
                  placeholder="0"
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
                <NumericInput
                  min={1}
                  step={500}
                  value={expenseAmount}
                  onChange={(val) => setExpenseAmount(val)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Date de l'opération *
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none"
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

      {/* Modal: Transfer Electronic Entry to Cash Drawer */}
      {isTransferModalActive && currentOpenSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                  <span>Transfert Écriture Électronique ➔ Espèces</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Convertir une écriture digitale perçue (Wave, OM, Banque) en monnaie physique dans le tiroir
                </p>
              </div>
              <button
                onClick={() => setIsTransferModalActive(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{transferSuccess}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              {/* Canal Source */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Canal d'origine de l'écriture électronique *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferSource('WAVE');
                      if (sessionStats.totalWave > 0) setTransferAmount(sessionStats.totalWave);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      transferSource === 'WAVE'
                        ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-sky-950 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-sky-600" />
                      Wave
                    </span>
                    <span className="font-mono font-extrabold text-xs text-sky-900 mt-1">
                      {formatFCFA(sessionStats.totalWave)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferSource('ORANGE_MONEY');
                      if (sessionStats.totalOrangeMoney > 0) setTransferAmount(sessionStats.totalOrangeMoney);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      transferSource === 'ORANGE_MONEY'
                        ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-orange-950 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                      Orange Money
                    </span>
                    <span className="font-mono font-extrabold text-xs text-orange-900 mt-1">
                      {formatFCFA(sessionStats.totalOrangeMoney)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferSource('VIREMENT');
                      if (sessionStats.totalBank > 0) setTransferAmount(sessionStats.totalBank);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      transferSource === 'VIREMENT'
                        ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-600" />
                      Virement
                    </span>
                    <span className="font-mono font-extrabold text-xs text-slate-900 mt-1">
                      {formatFCFA(sessionStats.totalBank)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferSource('CARTE');
                      if (sessionStats.totalCard > 0) setTransferAmount(sessionStats.totalCard);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      transferSource === 'CARTE'
                        ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                      Carte TPE
                    </span>
                    <span className="font-mono font-extrabold text-xs text-slate-900 mt-1">
                      {formatFCFA(sessionStats.totalCard)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Montant à transférer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Montant transféré en espèces physiques (FCFA) *
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Max disponible :{' '}
                    <strong className="font-mono text-slate-800">
                      {formatFCFA(
                        transferSource === 'WAVE'
                          ? sessionStats.totalWave
                          : transferSource === 'ORANGE_MONEY'
                          ? sessionStats.totalOrangeMoney
                          : transferSource === 'VIREMENT'
                          ? sessionStats.totalBank
                          : sessionStats.totalCard
                      )}
                    </strong>
                  </span>
                </div>
                <NumericInput
                  min={1}
                  step={500}
                  value={transferAmount}
                  onChange={(val) => setTransferAmount(val)}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 text-base font-mono font-black text-slate-950 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Raccourcis :</span>
                  <button
                    type="button"
                    onClick={() => {
                      const maxB =
                        transferSource === 'WAVE'
                          ? sessionStats.totalWave
                          : transferSource === 'ORANGE_MONEY'
                          ? sessionStats.totalOrangeMoney
                          : transferSource === 'VIREMENT'
                          ? sessionStats.totalBank
                          : sessionStats.totalCard;
                      setTransferAmount(maxB);
                    }}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] cursor-pointer"
                  >
                    Tout transférer (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxB =
                        transferSource === 'WAVE'
                          ? sessionStats.totalWave
                          : transferSource === 'ORANGE_MONEY'
                          ? sessionStats.totalOrangeMoney
                          : transferSource === 'VIREMENT'
                          ? sessionStats.totalBank
                          : sessionStats.totalCard;
                      setTransferAmount(Math.round(maxB / 2));
                    }}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] cursor-pointer"
                  >
                    50%
                  </button>
                  {[50000, 25000, 10000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTransferAmount(v)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[10px] cursor-pointer"
                    >
                      {formatFCFA(v)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Référence de retrait */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date du transfert *
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Référence (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="Ex: ID Wave, reçu kiosque..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Justification / Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Motif / Observations
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Ex: Espèces retirées auprès du kiosque Wave pour alimentation caisse"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none text-xs"
                />
              </div>

              {/* Résumé de l'opération */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                <div className="flex justify-between font-bold text-amber-950">
                  <span>Impact sur le tiroir-caisse physique :</span>
                  <span className="font-mono text-emerald-700 font-extrabold text-sm">
                    +{formatFCFA(transferAmount || 0)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-tight">
                  Ce montant sera débité du solde électronique {transferSource} et viendra augmenter le solde théorique d'espèces à compter lors de la clôture.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalActive(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!transferAmount || transferAmount <= 0}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Confirmer le transfert vers le tiroir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reopen Closed Cash Session (Admin Only) */}
      {sessionToReopen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Réouverture de Caisse (Administrateur)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Session : <strong>{sessionToReopen.id}</strong> · Ouverte le{' '}
                  {formatDateTime(sessionToReopen.openedAt)}
                </p>
              </div>
              <button
                onClick={() => setSessionToReopen(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-bold">Que permet la réouverture ?</div>
              <p className="text-[11px] leading-relaxed">
                En rouvrant cette session, elle redevient active : vous pourrez corriger son fond de caisse initial, supprimer une écriture erronée, ajouter une dépense ou un transfert oublié, puis la clôturer à nouveau.
              </p>
            </div>

            {reopenError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
                {reopenError}
              </div>
            )}

            <form onSubmit={handleExecuteReopen} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif de la réouverture *
                </label>
                <input
                  type="text"
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Ex: Oubli d'une dépense, erreur de comptage..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSessionToReopen(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirmer la réouverture</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Initial Cash Float (Admin Only) */}
      {isEditFloatModalActive && targetSession && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Corriger le fond de caisse initial
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Session : <strong>{targetSession.id}</strong> (Actuel :{' '}
                  {formatFCFA(targetSession.initialCashFloat)})
                </p>
              </div>
              <button
                onClick={() => setIsEditFloatModalActive(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editFloatError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {editFloatError}
              </div>
            )}

            <form onSubmit={handleExecuteEditFloat} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nouveau montant du fond initial (FCFA) *
                </label>
                <NumericInput
                  min={0}
                  step={1000}
                  value={editFloatInput}
                  onChange={(val) => setEditFloatInput(val)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif de la correction
                </label>
                <input
                  type="text"
                  value={editFloatReason}
                  onChange={(e) => setEditFloatReason(e.target.value)}
                  placeholder="Ex: Correction erreur de saisie à l'ouverture"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditFloatModalActive(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Enregistrer la correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
