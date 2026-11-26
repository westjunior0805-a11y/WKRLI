import React, { useMemo } from 'react';
import {
  X,
  Phone,
  Receipt,
  Coins,
  Banknote,
  QrCode,
  Smartphone,
  Building2,
  CreditCard,
  TrendingDown,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Sale, PaymentRecord, CashMovement, Customer } from '../../types';
import { formatFCFA } from '../../utils/formatters';

export type SummaryDetailType =
  | 'REVENUE'
  | 'COLLECTED'
  | 'CREDITS'
  | 'DRAWER_CASH'
  | 'PAYMENT_ESPECES'
  | 'PAYMENT_WAVE'
  | 'PAYMENT_ORANGE_MONEY'
  | 'PAYMENT_VIREMENT'
  | 'PAYMENT_CARTE';

interface SummaryDetailModalProps {
  activeType: SummaryDetailType;
  onClose: () => void;
  periodLabel: string;
  sales: Sale[];
  allPeriodPayments: PaymentRecord[];
  standaloneCustomerPayments: PaymentRecord[];
  cashDrawerExpenses: CashMovement[];
  customers: Customer[];
  totalRevenue: number;
  totalSalesCollected: number;
  totalCustomerPaymentsCollected: number;
  totalCollected: number;
  totalUnpaid: number;
  totalItemsSold: number;
  netDrawerCash: number;
  totalCashDrawerExpenses: number;
  paymentBreakdown: Record<string, number>;
  onOpenSaleReceipt: (sale: Sale) => void;
  onOpenCustomerPaymentReceipt: (payment: PaymentRecord, customer: Customer | null) => void;
}

const METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  VIREMENT: 'Virements',
  CARTE: 'Cartes',
};

const formatSaleDateTime = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const SummaryDetailModal: React.FC<SummaryDetailModalProps> = ({
  activeType,
  onClose,
  periodLabel,
  sales,
  allPeriodPayments,
  standaloneCustomerPayments,
  cashDrawerExpenses,
  customers,
  totalRevenue,
  totalSalesCollected,
  totalCustomerPaymentsCollected,
  totalCollected,
  totalUnpaid,
  totalItemsSold,
  netDrawerCash,
  totalCashDrawerExpenses,
  paymentBreakdown,
  onOpenSaleReceipt,
  onOpenCustomerPaymentReceipt,
}) => {
  const salesById = useMemo(() => {
    const map = new Map<string, Sale>();
    sales.forEach((s) => map.set(s.id, s));
    return map;
  }, [sales]);

  const sortedNewestSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [sales]
  );

  const creditSales = useMemo(
    () =>
      sales
        .filter((s) => s.remainingDue > 0)
        .sort((a, b) => b.remainingDue - a.remainingDue),
    [sales]
  );

  const paidSalesCount = useMemo(
    () => sales.filter((s) => s.remainingDue <= 0).length,
    [sales]
  );

  const averageTicket = useMemo(
    () => (sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0),
    [sales.length, totalRevenue]
  );

  const totalDiscounts = useMemo(
    () => sales.reduce((sum, s) => sum + (Number(s.totalDiscount) || 0), 0),
    [sales]
  );

  const sortedAllPayments = useMemo(
    () =>
      [...allPeriodPayments].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [allPeriodPayments]
  );

  const sortedCashExpenses = useMemo(
    () =>
      [...cashDrawerExpenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [cashDrawerExpenses]
  );

  const paymentMethodKey = activeType.startsWith('PAYMENT_')
    ? activeType.replace('PAYMENT_', '')
    : null;

  const filteredMethodPayments = useMemo(() => {
    if (!paymentMethodKey) return [];
    return sortedAllPayments.filter((p) => p.method === paymentMethodKey);
  }, [sortedAllPayments, paymentMethodKey]);

  const cashInPayments = useMemo(
    () => sortedAllPayments.filter((p) => p.method === 'ESPECES'),
    [sortedAllPayments]
  );

  // Unified list of collected entries (sales with totalPaid > 0 + standalone customer payments)
  const collectedEntries = useMemo(() => {
    type Entry =
      | { kind: 'SALE'; id: string; date: string; amount: number; sale: Sale; methods: string[] }
      | { kind: 'CUSTOMER_PAYMENT'; id: string; date: string; amount: number; payment: PaymentRecord };

    const entries: Entry[] = [];

    sales.forEach((s) => {
      const netSaleAmount = Math.max(0, s.totalAmount - (s.refundedAmount || 0));
      const collected = Math.min(s.totalPaid, netSaleAmount);
      if (collected > 0) {
        const linkedMethods = Array.from(
          new Set(
            allPeriodPayments
              .filter((p) => p.saleId === s.id)
              .map((p) => METHOD_LABELS[p.method] || p.method)
          )
        );
        entries.push({
          kind: 'SALE',
          id: `sale-${s.id}`,
          date: s.date,
          amount: collected,
          sale: s,
          methods: linkedMethods,
        });
      }
    });

    standaloneCustomerPayments.forEach((p) => {
      if ((Number(p.amount) || 0) > 0) {
        entries.push({
          kind: 'CUSTOMER_PAYMENT',
          id: `pay-${p.id}`,
          date: p.date,
          amount: Number(p.amount) || 0,
          payment: p,
        });
      }
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, allPeriodPayments, standaloneCustomerPayments]);

  const getHeaderMeta = () => {
    switch (activeType) {
      case 'REVENUE':
        return {
          title: 'Détail des ventes totales',
          heroLabel: 'Chiffre d’affaires total',
          heroAmount: formatFCFA(totalRevenue),
          heroAccent: 'text-[#111111]',
          heroBg: 'bg-[#F4F4F4] border-[#E0E0E0]',
        };
      case 'COLLECTED':
        return {
          title: 'Détail du total encaissé',
          heroLabel: 'Argent réellement reçu',
          heroAmount: formatFCFA(totalCollected),
          heroAccent: 'text-emerald-700',
          heroBg: 'bg-emerald-50 border-emerald-300',
        };
      case 'CREDITS':
        return {
          title: 'Détail des crédits accordés',
          heroLabel: 'Montant restant à recouvrer',
          heroAmount: formatFCFA(totalUnpaid),
          heroAccent: totalUnpaid > 0 ? 'text-rose-700' : 'text-[#595959]',
          heroBg: 'bg-[#FFF9DF] border-[#E5C130]',
        };
      case 'DRAWER_CASH':
        return {
          title: 'Détail des espèces net en tiroir',
          heroLabel: 'Solde espèces en caisse',
          heroAmount: formatFCFA(netDrawerCash),
          heroAccent: 'text-[#111111]',
          heroBg: 'bg-[#F4F4F4] border-[#E0E0E0]',
        };
      default: {
        const label = paymentMethodKey ? METHOD_LABELS[paymentMethodKey] || paymentMethodKey : '';
        const amount = paymentMethodKey ? paymentBreakdown[paymentMethodKey] || 0 : 0;
        return {
          title: `Encaissements — ${label}`,
          heroLabel: `Total reçu en ${label}`,
          heroAmount: formatFCFA(amount),
          heroAccent: 'text-[#111111]',
          heroBg: 'bg-[#F4F4F4] border-[#E0E0E0]',
        };
      }
    }
  };

  const headerMeta = getHeaderMeta();

  const renderPaymentRow = (p: PaymentRecord) => {
    const dt = formatSaleDateTime(p.date);
    const linkedSale = p.saleId ? salesById.get(p.saleId) : undefined;
    const customerObj = p.customerId
      ? customers.find((c) => c.id === p.customerId) || null
      : null;
    const clientName =
      linkedSale?.customerName || customerObj?.name || p.customerName || 'Client Comptoir';
    const isStandalone = !p.saleId;
    const isAcompte = p.paymentType === 'ACOMPTE_CLIENT';

    return (
      <button
        key={p.id}
        type="button"
        onClick={() => {
          if (linkedSale) {
            onOpenSaleReceipt(linkedSale);
          } else {
            onOpenCustomerPaymentReceipt(p, customerObj);
          }
        }}
        className="w-full text-left p-4 bg-[#F4F4F4] hover:bg-[#FFF9DF] border border-[#E0E0E0] rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-extrabold text-[#111111] truncate">
            {clientName}
          </div>
          <div className="text-xs text-[#595959] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono tabular-nums">
              {dt.date} · {dt.time}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#111111]">
              {linkedSale
                ? `Vente ${linkedSale.receiptNumber}`
                : isAcompte
                ? 'Acompte client'
                : 'Règlement créance'}
            </span>
          </div>
          {p.notes && (
            <div className="text-xs text-[#595959] italic mt-1 truncate">{p.notes}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-base sm:text-lg font-black font-mono text-emerald-700 tabular-nums">
              +{formatFCFA(p.amount)}
            </div>
            <div className="text-[11px] font-semibold text-[#595959]">
              {METHOD_LABELS[p.method] || p.method}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#595959] shrink-0" />
        </div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111111]/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-[#E0E0E0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#111111] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate">
              {headerMeta.title}
            </h3>
            <p className="text-xs text-white/75 mt-0.5 truncate">{periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Hero Total Banner */}
          <div className={`p-5 rounded-xl border ${headerMeta.heroBg}`}>
            <span className="text-sm font-bold text-[#595959] block">
              {headerMeta.heroLabel}
            </span>
            <div
              className={`text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight mt-1.5 leading-none ${headerMeta.heroAccent}`}
            >
              {headerMeta.heroAmount}
            </div>
          </div>

          {/* 1. REVENUE DETAIL */}
          {activeType === 'REVENUE' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#F4F4F4] border border-[#E0E0E0] rounded-xl">
                  <span className="text-xs font-semibold text-[#595959] block">Nombre de ventes</span>
                  <span className="text-lg font-black font-mono text-[#111111] tabular-nums mt-1 block">
                    {sales.length} ({totalItemsSold} pcs)
                  </span>
                </div>
                <div className="p-3.5 bg-[#F4F4F4] border border-[#E0E0E0] rounded-xl">
                  <span className="text-xs font-semibold text-[#595959] block">Panier moyen</span>
                  <span className="text-lg font-black font-mono text-[#111111] tabular-nums mt-1 block">
                    {formatFCFA(averageTicket)}
                  </span>
                </div>
                <div className="p-3.5 bg-[#F4F4F4] border border-[#E0E0E0] rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-[#595959] block">Répartition</span>
                  <span className="text-sm font-bold text-[#111111] mt-1.5 block">
                    {paidSalesCount} payée{paidSalesCount > 1 ? 's' : ''} · {creditSales.length} crédit{creditSales.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {totalDiscounts > 0 && (
                <div className="px-4 py-3 bg-[#FFF9DF] border border-[#E5C130] rounded-xl flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#7A5C00]">Total remises accordées</span>
                  <span className="font-mono font-black text-[#111111] tabular-nums">
                    -{formatFCFA(totalDiscounts)}
                  </span>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#595959]">
                  <span className="flex items-center gap-1.5 text-sm text-[#111111]">
                    <Receipt className="w-4 h-4 text-[#7A5C00]" />
                    Liste des ventes ({sortedNewestSales.length})
                  </span>
                  <span>Appuyer pour voir le reçu</span>
                </div>

                {sortedNewestSales.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#595959] bg-[#F4F4F4] rounded-xl border border-dashed border-[#E0E0E0]">
                    Aucune vente enregistrée sur cette période.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {sortedNewestSales.map((s) => {
                      const dt = formatSaleDateTime(s.date);
                      const netTotal = Math.max(0, s.totalAmount - (s.refundedAmount || 0));
                      const isPaid = s.remainingDue <= 0;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onOpenSaleReceipt(s)}
                          className="w-full text-left p-4 bg-[#F4F4F4] hover:bg-[#FFF9DF] border border-[#E0E0E0] rounded-xl transition-colors cursor-pointer space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-extrabold text-[#111111] truncate">
                                {s.customerName || 'Client Comptoir'}
                              </div>
                              <div className="text-xs font-mono text-[#595959] mt-0.5 tabular-nums">
                                {dt.date} à {dt.time} · {s.receiptNumber}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="text-base sm:text-lg font-black font-mono text-[#111111] tabular-nums">
                                  {formatFCFA(netTotal)}
                                </div>
                                <div className={`text-xs font-bold ${isPaid ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isPaid ? 'Payé' : `Reste ${formatFCFA(s.remainingDue)}`}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#595959]" />
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E0E0E0] text-xs text-[#595959] leading-relaxed">
                            {s.items.map((it, i) => (
                              <span key={i} className="mr-2.5 inline-block">
                                <strong className="font-mono text-[#111111]">{it.quantity}x</strong>{' '}
                                <span className="font-mono font-semibold text-[#7A5C00]">{it.mainReference}</span>
                                {' — '}
                                <span>{it.designation}</span>
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 2. COLLECTED DETAIL */}
          {activeType === 'COLLECTED' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-[#F4F4F4] border border-[#E0E0E0] rounded-xl">
                  <span className="text-xs font-semibold text-[#595959] block">
                    Encaissé sur ventes
                  </span>
                  <span className="text-xl font-black font-mono text-[#111111] tabular-nums mt-1 block">
                    {formatFCFA(totalSalesCollected)}
                  </span>
                </div>
                <div className="p-4 bg-[#FFF9DF] border border-[#E5C130] rounded-xl">
                  <span className="text-xs font-semibold text-[#7A5C00] block">
                    Acomptes &amp; règlements clients ({standaloneCustomerPayments.length})
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700 tabular-nums mt-1 block">
                    +{formatFCFA(totalCustomerPaymentsCollected)}
                  </span>
                </div>
              </div>

              {/* Quick breakdown by payment method */}
              <div className="p-4 bg-[#F4F4F4] border border-[#E0E0E0] rounded-xl space-y-2">
                <span className="text-xs font-bold text-[#111111] block">
                  Ventilation par mode de paiement
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
                  {[
                    { key: 'ESPECES', label: 'Espèces', icon: Banknote },
                    { key: 'WAVE', label: 'Wave', icon: QrCode },
                    { key: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone },
                    { key: 'VIREMENT', label: 'Virements', icon: Building2 },
                    { key: 'CARTE', label: 'Cartes', icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.key} className="p-2.5 bg-white border border-[#E0E0E0] rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#595959]">
                          <Icon className="w-3.5 h-3.5 text-[#7A5C00] shrink-0" />
                          <span className="truncate">{m.label}</span>
                        </div>
                        <div className="font-mono font-black text-base text-[#111111] tabular-nums mt-1">
                          {formatFCFA(paymentBreakdown[m.key] || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#595959]">
                  <span className="flex items-center gap-1.5 text-sm text-[#111111]">
                    <Coins className="w-4 h-4 text-emerald-700" />
                    Tous les encaissements ({collectedEntries.length})
                  </span>
                  <span>Appuyer pour voir le reçu</span>
                </div>

                {collectedEntries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#595959] bg-[#F4F4F4] rounded-xl border border-dashed border-[#E0E0E0]">
                    Aucun encaissement enregistré sur cette période.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {collectedEntries.map((entry) => {
                      const dt = formatSaleDateTime(entry.date);
                      if (entry.kind === 'SALE') {
                        const s = entry.sale;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onOpenSaleReceipt(s)}
                            className="w-full text-left p-4 bg-[#F4F4F4] hover:bg-[#FFF9DF] border border-[#E0E0E0] rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-extrabold text-[#111111] truncate">
                                {s.customerName || 'Client Comptoir'}
                              </div>
                              <div className="text-xs text-[#595959] mt-0.5 font-mono tabular-nums">
                                {dt.date} à {dt.time} · Vente {s.receiptNumber}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="text-base sm:text-lg font-black font-mono text-emerald-700 tabular-nums">
                                  +{formatFCFA(entry.amount)}
                                </div>
                                {entry.methods.length > 0 && (
                                  <div className="text-[11px] font-semibold text-[#595959]">
                                    {entry.methods.join(' / ')}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#595959]" />
                            </div>
                          </button>
                        );
                      }

                      const p = entry.payment;
                      const customerObj = p.customerId
                        ? customers.find((c) => c.id === p.customerId) || null
                        : null;
                      const clientName = customerObj?.name || p.customerName || 'Client';
                      const isAcompte = p.paymentType === 'ACOMPTE_CLIENT';
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onOpenCustomerPaymentReceipt(p, customerObj)}
                          className="w-full text-left p-4 bg-[#FFF9DF] hover:bg-[#FFCD11]/25 border border-[#E5C130] rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-extrabold text-[#111111] truncate">
                              {clientName}
                            </div>
                            <div className="text-xs text-[#7A5C00] mt-0.5 font-semibold">
                              {dt.date} à {dt.time} · {isAcompte ? 'Acompte client' : 'Règlement créance'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="text-base sm:text-lg font-black font-mono text-emerald-700 tabular-nums">
                                +{formatFCFA(entry.amount)}
                              </div>
                              <div className="text-[11px] font-semibold text-[#595959]">
                                {METHOD_LABELS[p.method] || p.method}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#7A5C00]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. CREDITS DETAIL */}
          {activeType === 'CREDITS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#595959]">
                <span className="text-sm text-[#111111]">
                  Ventes non soldées ({creditSales.length})
                </span>
                {creditSales.length > 0 && <span>Classées par plus gros reste dû</span>}
              </div>

              {creditSales.length === 0 ? (
                <div className="py-10 px-4 text-center bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-base font-bold text-emerald-900">
                    Tout est intégralement payé
                  </p>
                  <p className="text-xs text-emerald-800">
                    Aucun crédit ni reste dû sur cette période.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {creditSales.map((s) => {
                    const dt = formatSaleDateTime(s.date);
                    const netSale = Math.max(0, s.totalAmount - (s.refundedAmount || 0));
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onOpenSaleReceipt(s)}
                        className="w-full text-left p-4 bg-[#FFF9DF] hover:bg-[#FFCD11]/25 border border-[#E5C130] rounded-xl transition-colors cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-extrabold text-[#111111] truncate">
                              {s.customerName || 'Client Comptoir'}
                            </div>
                            <div className="text-xs text-[#595959] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-mono tabular-nums">
                                {dt.date} à {dt.time} · {s.receiptNumber}
                              </span>
                              {s.customerPhone && (
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-[#111111]">
                                  <Phone className="w-3 h-3 text-[#7A5C00]" />
                                  {s.customerPhone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-[11px] font-bold text-rose-700 block">Reste dû</span>
                              <span className="text-lg font-black font-mono text-rose-700 tabular-nums">
                                {formatFCFA(s.remainingDue)}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#7A5C00]" />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#E5C130]/70 flex items-center justify-between text-xs text-[#595959]">
                          <span>
                            Montant vente : <strong className="font-mono text-[#111111] tabular-nums">{formatFCFA(netSale)}</strong>
                          </span>
                          <span>
                            Déjà versé : <strong className="font-mono text-emerald-700 tabular-nums">{formatFCFA(s.totalPaid)}</strong>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. DRAWER CASH DETAIL */}
          {activeType === 'DRAWER_CASH' && (
            <>
              {/* Simple balance calculation */}
              <div className="p-4 bg-white border border-[#E0E0E0] rounded-xl space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#595959]">(+) Espèces encaissées</span>
                  <span className="font-mono font-black text-emerald-700 tabular-nums text-base">
                    +{formatFCFA(paymentBreakdown.ESPECES || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#595959]">
                    (-) Dépenses payées en espèces ({sortedCashExpenses.length})
                  </span>
                  <span className="font-mono font-black text-rose-700 tabular-nums text-base">
                    -{formatFCFA(totalCashDrawerExpenses)}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-[#E0E0E0] flex items-center justify-between">
                  <span className="font-extrabold text-[#111111]">(=) Solde net en tiroir</span>
                  <span className="font-mono font-black text-[#111111] tabular-nums text-lg">
                    {formatFCFA(netDrawerCash)}
                  </span>
                </div>
              </div>

              {/* Cash Expenses List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    Dépenses espèces déduites ({sortedCashExpenses.length})
                  </span>
                </div>

                {sortedCashExpenses.length === 0 ? (
                  <p className="py-4 px-4 text-sm text-[#595959] bg-[#F4F4F4] rounded-xl border border-[#E0E0E0]">
                    Aucune dépense en espèces sur cette période.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortedCashExpenses.map((m) => {
                      const dt = formatSaleDateTime(m.date);
                      return (
                        <div
                          key={m.id}
                          className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#111111] truncate">
                              {m.reason || m.notes || 'Dépense de caisse'}
                            </div>
                            <div className="text-xs text-[#595959] font-mono tabular-nums mt-0.5">
                              {dt.date} à {dt.time} · {m.userName || 'Opérateur'}
                            </div>
                          </div>
                          <span className="font-mono text-base font-black text-rose-700 tabular-nums shrink-0">
                            -{formatFCFA(m.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cash Inflows List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Encaissements en espèces ({cashInPayments.length})
                  </span>
                </div>

                {cashInPayments.length === 0 ? (
                  <p className="py-4 px-4 text-sm text-[#595959] bg-[#F4F4F4] rounded-xl border border-[#E0E0E0]">
                    Aucun encaissement en espèces sur cette période.
                  </p>
                ) : (
                  <div className="space-y-2">{cashInPayments.map(renderPaymentRow)}</div>
                )}
              </div>
            </>
          )}

          {/* 5. SPECIFIC PAYMENT METHOD DETAIL */}
          {paymentMethodKey && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#595959]">
                <span className="text-sm text-[#111111]">
                  Opérations reçues ({filteredMethodPayments.length})
                </span>
                {filteredMethodPayments.length > 0 && <span>Appuyer pour voir le reçu</span>}
              </div>

              {filteredMethodPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#595959] bg-[#F4F4F4] rounded-xl border border-dashed border-[#E0E0E0]">
                  Aucun encaissement en {METHOD_LABELS[paymentMethodKey] || paymentMethodKey} sur cette période.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredMethodPayments.map(renderPaymentRow)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Close Button */}
        <div className="px-5 py-3.5 bg-[#F4F4F4] border-t border-[#E0E0E0] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-[#FFCD11] font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
