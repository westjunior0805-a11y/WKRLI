import { Customer, CustomerDebtAdjustment, PaymentRecord, Sale } from '../types';

export interface CustomerCreditSummary {
  /** Achats à crédit (non payés directement au comptoir) */
  creditSales: Sale[];
  /** Acomptes et règlements (acomptes initiaux sur achats à crédit + versements ultérieurs, hors achats payés directement) */
  acomptePayments: PaymentRecord[];
  /** Ajustements manuels de créance (solde initial, report de dette, remise ou régularisation) */
  debtAdjustments: CustomerDebtAdjustment[];
  /** Somme des achats issus des factures à crédit seules */
  salesPurchasesTotal: number;
  /** Somme nette des ajustements de créance (+/-) */
  totalAdjustments: number;
  /** Somme totale des achats à crédit et ajustements (nette des retours éventuels) */
  totalPurchases: number;
  /** Somme totale des acomptes et règlements versés */
  totalAcomptes: number;
  /** Montant de la créance = max(0, Somme des achats - Somme des acomptes) */
  creance: number;
  /** Avance / Avoir disponible si la somme des acomptes et avoirs dépasse la somme des achats */
  avanceDisponible: number;
}

export interface SaleReturnBreakdown {
  /** Valeur totale des pièces retournées sur cette vente */
  totalReturned: number;
  /** Montant effectivement remboursé au client (Espèces, Wave, Orange Money) */
  reimbursedAmount: number;
  /** Montant conservé en Avoir / Crédit sur le compte client (AVOIR_CLIENT) */
  avoirAmount: number;
  /** Montant imputé en réduction directe de la dette sur cette facture */
  debtDeductedAmount: number;
}

/**
 * Ventile les retours d'une vente entre :
 * - Remboursement effectif au client (ESPECES, WAVE, ORANGE_MONEY)
 * - Avoir client (AVOIR_CLIENT)
 * - Déduction directe sur le reste à payer de la facture (debtDeducted)
 */
export function getSaleReturnBreakdown(sale: Sale): SaleReturnBreakdown {
  const returnsList = sale.returns || [];
  if (returnsList.length === 0) {
    const fallbackRefund = Number(sale.refundedAmount) || 0;
    return {
      totalReturned: fallbackRefund,
      reimbursedAmount: fallbackRefund,
      avoirAmount: 0,
      debtDeductedAmount: 0,
    };
  }

  let totalReturned = 0;
  let reimbursedAmount = 0;
  let avoirAmount = 0;
  let debtDeductedAmount = 0;

  for (const ret of returnsList) {
    const retTotal = Number(ret.totalRefundAmount) || 0;
    const debtDed = Number(ret.debtDeducted) || 0;
    const surplus =
      ret.cashRefunded !== undefined
        ? Number(ret.cashRefunded) || 0
        : Math.max(0, retTotal - debtDed);

    totalReturned += retTotal;
    debtDeductedAmount += debtDed;

    if (ret.refundMethod === 'AVOIR_CLIENT') {
      avoirAmount += surplus;
    } else if (
      ret.refundMethod === 'ESPECES' ||
      ret.refundMethod === 'WAVE' ||
      ret.refundMethod === 'ORANGE_MONEY'
    ) {
      reimbursedAmount += surplus;
    }
  }

  return {
    totalReturned,
    reimbursedAmount,
    avoirAmount,
    debtDeductedAmount,
  };
}

/**
 * Calcule le montant net d'une vente après déduction des pièces retournées.
 */
export function getNetSaleAmount(sale: Sale): number {
  const { totalReturned } = getSaleReturnBreakdown(sale);
  return Math.max(0, (Number(sale.totalAmount) || 0) - totalReturned);
}

/**
 * Calcule le montant net total et le prix unitaire net effectif d'une ligne de vente
 * en tenant compte des remises ligne et éventuelle remise globale de la vente.
 */
export function getSaleItemNetTotals(
  sale: Sale,
  saleItem: Sale['items'][number]
): { netLineTotal: number; netUnitPrice: number } {
  const qty = Math.max(0, Number(saleItem.quantity) || 0);
  if (qty <= 0) {
    return { netLineTotal: 0, netUnitPrice: 0 };
  }

  const rawLine = qty * (Number(saleItem.unitPrice) || 0);
  const itemLineNet =
    saleItem.totalLine !== undefined
      ? Math.max(0, Number(saleItem.totalLine) || 0)
      : Math.max(0, rawLine - (Number(saleItem.discountAmount) || 0));

  const sumItemsLineNet = (sale.items || []).reduce((sum, si) => {
    const q = Math.max(0, Number(si.quantity) || 0);
    const raw = q * (Number(si.unitPrice) || 0);
    const net =
      si.totalLine !== undefined
        ? Math.max(0, Number(si.totalLine) || 0)
        : Math.max(0, raw - (Number(si.discountAmount) || 0));
    return sum + net;
  }, 0);

  const saleNetTotal = Math.max(0, Number(sale.totalAmount) || 0);
  let effectiveLineNet = itemLineNet;

  if (sumItemsLineNet > saleNetTotal && sumItemsLineNet > 0) {
    effectiveLineNet = (itemLineNet / sumItemsLineNet) * saleNetTotal;
  }

  return {
    netLineTotal: Math.round(effectiveLineNet),
    netUnitPrice: Math.round(effectiveLineNet / qty),
  };
}

/**
 * Calcule la valeur exacte de remboursement / avoir pour une quantité retournée d'une ligne de vente
 * (calculée sur le montant net après remise, et non sur le prix brut avant réduction).
 */
export function getSaleItemReturnRefund(
  sale: Sale,
  saleItem: Sale['items'][number],
  returnQty: number
): { lineRefund: number; netUnitPrice: number } {
  const qty = Math.max(0, Number(saleItem.quantity) || 0);
  const clampedReturnQty = Math.min(Math.max(0, returnQty), qty);
  if (qty <= 0 || clampedReturnQty <= 0) {
    return { lineRefund: 0, netUnitPrice: 0 };
  }

  const { netLineTotal, netUnitPrice } = getSaleItemNetTotals(sale, saleItem);
  const lineRefund =
    clampedReturnQty === qty
      ? netLineTotal
      : Math.round((netLineTotal / qty) * clampedReturnQty);

  return {
    lineRefund,
    netUnitPrice,
  };
}

/**
 * Détermine si une vente est un achat à crédit (non payé directement au comptoir).
 * Les achats payés intégralement lors de la vente (paymentStatus === 'PAID' et remainingDue <= 0)
 * sont des achats payés directement et ne doivent pas être listés dans les créances.
 */
export function isCreditPurchase(sale: Sale): boolean {
  if (!sale || sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
    return false;
  }
  const netAmount = getNetSaleAmount(sale);
  if (netAmount <= 0) {
    return false;
  }
  const paidAtSale = Number(sale.totalPaid) || 0;
  const remaining = Number(sale.remainingDue) || 0;
  // Un achat est à crédit s'il n'a pas été payé intégralement directement au comptoir
  return remaining > 0 || paidAtSale < netAmount || sale.paymentStatus !== 'PAID';
}

/**
 * Calcule de manière stricte la situation crédit d'un client :
 * - Exclut tous les achats payés directement au comptoir
 * - Les remboursements (Espèces, Wave, Orange Money) sur retour de pièce ne sont JAMAIS comptabilisés en avoir
 * - Seuls les retours avec modalité AVOIR_CLIENT créent un avoir sur le compte client
 */
export function getCustomerCreditSummary(
  customer: Customer,
  sales: Sale[],
  payments: PaymentRecord[]
): CustomerCreditSummary {
  const customerSales = (sales || []).filter(
    (s) => s && s.customerId === customer.id && s.status !== 'CANCELLED'
  );

  // 1. Filtrer uniquement les achats non payés directement (achats à crédit)
  const creditSales = customerSales
    .filter((s) => isCreditPurchase(s))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const creditSaleIds = new Set(creditSales.map((s) => s.id));
  const creditSaleMap = new Map(creditSales.map((s) => [s.id, s]));

  // 2. Calculer la somme des achats à crédit (nette des pièces retournées) + ajustements de créances
  const salesPurchasesTotal = creditSales.reduce((sum, s) => sum + getNetSaleAmount(s), 0);
  const debtAdjustments = [...(customer.debtAdjustments || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const totalAdjustments = debtAdjustments.reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0);
  const totalPurchases = Math.max(0, salesPurchasesTotal + totalAdjustments);

  // 3. Collecter les acomptes :
  //    a) Versements / acomptes autonomes (!p.saleId) enregistrés pour ce client
  //    b) Acomptes initiaux versés lors d'un achat à crédit (p.saleId dans creditSaleIds),
  //       diminués de tout remboursement effectif (Espèces/Wave/OM) effectué sur cette vente
  const rawPayments = (payments || []).filter((p) => {
    if (!p || (Number(p.amount) || 0) <= 0) return false;
    if (!p.saleId) {
      return p.customerId === customer.id;
    }
    return creditSaleIds.has(p.saleId);
  });

  // Calculer par vente à crédit le montant éventuellement remboursé au client (hors avoir)
  // au cas où d'anciennes écritures de paiement n'auraient pas encore été réduites du remboursement
  const reimbursedToDeductBySaleId = new Map<string, number>();
  creditSales.forEach((s) => {
    const { reimbursedAmount } = getSaleReturnBreakdown(s);
    const recordedForSale = rawPayments
      .filter((p) => p.saleId === s.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    // Si la somme des PaymentRecords de la vente dépasse le totalPaid net (ou n'a pas déduit le remboursement),
    // on déduit la part remboursée pour qu'elle ne devienne jamais un avoir
    const maxRetainedPaid = Math.max(0, recordedForSale - reimbursedAmount);
    const currentPaidProp = Number(s.totalPaid) || 0;
    const targetNetPaid = Math.min(currentPaidProp, maxRetainedPaid);
    const excessInPayments = Math.max(0, recordedForSale - targetNetPaid);
    if (excessInPayments > 0) {
      reimbursedToDeductBySaleId.set(s.id, excessInPayments);
    }
  });

  const acomptePayments: PaymentRecord[] = [];
  for (const p of rawPayments) {
    if (p.saleId && creditSaleMap.has(p.saleId)) {
      const linkedSale = creditSaleMap.get(p.saleId)!;
      const toDeduct = reimbursedToDeductBySaleId.get(p.saleId) || 0;
      const rawAmt = Number(p.amount) || 0;
      const deductedHere = Math.min(rawAmt, toDeduct);
      if (deductedHere > 0) {
        reimbursedToDeductBySaleId.set(p.saleId, toDeduct - deductedHere);
      }
      const netAmt = rawAmt - deductedHere;
      if (netAmt <= 0) continue;

      acomptePayments.push({
        ...p,
        amount: netAmt,
        customerId: customer.id,
        customerName: customer.name,
        paymentType: 'ACOMPTE_CLIENT',
        reference: p.reference || linkedSale.receiptNumber,
        notes: p.notes || `Acompte initial sur facture ${linkedSale.receiptNumber}`,
      });
    } else {
      acomptePayments.push(p);
    }
  }

  // Vérifier que si un achat à crédit a un totalPaid > 0 sans PaymentRecord correspondant,
  // l'acompte initial (net de tout remboursement) est bien inclus
  creditSales.forEach((s) => {
    const initialPaid = Math.max(0, Number(s.totalPaid) || 0);
    if (initialPaid > 0) {
      const recordedForSale = acomptePayments
        .filter((p) => p.saleId === s.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const missingInitialAcompte = Math.max(0, initialPaid - recordedForSale);
      if (missingInitialAcompte > 0) {
        acomptePayments.push({
          id: `ACP-INIT-${s.id}`,
          date: s.date,
          saleId: s.id,
          customerId: customer.id,
          customerName: customer.name,
          paymentType: 'ACOMPTE_CLIENT',
          warehouseId: s.warehouseId,
          method: 'ESPECES',
          amount: missingInitialAcompte,
          userId: s.userId,
          userName: s.userName,
          reference: s.receiptNumber,
          notes: `Acompte initial sur facture ${s.receiptNumber}`,
        });
      }
    }
  });

  // 4. Ajouter uniquement les vrais AVOIRS CLIENTS (refundMethod === 'AVOIR_CLIENT')
  //    provenant de ventes qui ne sont plus dans creditSales (ex: vente comptant ou entièrement retournée en avoir).
  //    Les remboursements (ESPECES, WAVE, ORANGE_MONEY) sont strictement exclus.
  customerSales.forEach((s) => {
    if (creditSaleIds.has(s.id)) return;
    (s.returns || []).forEach((ret) => {
      if (ret.refundMethod !== 'AVOIR_CLIENT') return;
      const avoirSurplus =
        ret.cashRefunded !== undefined
          ? Number(ret.cashRefunded) || 0
          : Math.max(0, (Number(ret.totalRefundAmount) || 0) - (Number(ret.debtDeducted) || 0));
      if (avoirSurplus > 0) {
        acomptePayments.push({
          id: `AVOIR-${ret.id}`,
          date: ret.date,
          customerId: customer.id,
          customerName: customer.name,
          paymentType: 'ACOMPTE_CLIENT',
          warehouseId: ret.warehouseId,
          method: 'ESPECES',
          amount: avoirSurplus,
          userId: ret.userId,
          userName: ret.userName,
          reference: ret.returnNumber,
          notes: `Avoir client sur retour facture ${s.receiptNumber}`,
        });
      }
    });
  });

  acomptePayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 5. Somme des acomptes et différence (Montant de la créance = Somme des achats - Somme des acomptes)
  const totalAcomptes = acomptePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const creance = Math.max(0, totalPurchases - totalAcomptes);
  const avanceDisponible = Math.max(0, totalAcomptes - totalPurchases);

  return {
    creditSales,
    acomptePayments,
    debtAdjustments,
    salesPurchasesTotal,
    totalAdjustments,
    totalPurchases,
    totalAcomptes,
    creance,
    avanceDisponible,
  };
}

