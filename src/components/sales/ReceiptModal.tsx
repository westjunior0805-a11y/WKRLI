import React, { useState } from 'react';
import { Sale, Warehouse } from '../../types';
import { formatFCFA, formatDateTime, formatDate } from '../../utils/formatters';
import { getSaleReturnBreakdown, getNetSaleAmount } from '../../utils/customerAccount';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import {
  Printer,
  Download,
  X,
  Truck,
  CheckCircle2,
  FileCheck,
  MapPin,
  FileText,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  initialFormat?: 'THERMAL' | 'A4' | 'BL';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  initialFormat = 'A4',
}) => {
  const { getWarehouseById, articles, companyInfo, payments } = useStock();
  const [format, setFormat] = useState<'THERMAL' | 'A4' | 'BL'>(initialFormat);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!sale) return null;

  const warehouse: Warehouse | undefined = getWarehouseById(sale.warehouseId);
  const salePayments = payments.filter((p) => p.saleId === sale.id && p.amount > 0);
  const formatMethodLabel = (method: string) => {
    switch (method) {
      case 'ESPECES':
        return 'Espèces';
      case 'WAVE':
        return 'Wave';
      case 'ORANGE_MONEY':
        return 'Orange Money';
      case 'CARTE':
        return 'Carte / Virement';
      case 'VIREMENT':
        return 'Virement';
      case 'CHEQUE':
        return 'Chèque';
      case 'CREDIT':
        return 'Crédit';
      default:
        return method;
    }
  };

  const handlePrint = () => {
    const targetId = format === 'A4' ? 'printable-a4-invoice' : 'printable-receipt';
    printElementById(targetId, format === 'A4' ? 'A4' : 'TICKET_80MM');
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const targetId = format === 'A4' ? 'printable-a4-invoice' : 'printable-receipt';
      const prefix = format === 'BL' ? 'BL' : format === 'A4' ? 'Facture' : 'Ticket';
      await downloadElementAsPdf({
        elementId: targetId,
        filename: `${prefix}_${sale.receiptNumber}.pdf`,
        format: format === 'A4' ? 'A4' : 'TICKET',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div
        className={`bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh] w-full transition-all print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none ${
          format === 'A4' ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        {/* Modal Controls Top Bar (Hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-white" />
              <span>
                {format === 'BL'
                  ? `Bon de Livraison BL-${sale.receiptNumber}`
                  : format === 'A4'
                  ? `Facture Vente A4 — ${sale.receiptNumber}`
                  : `Ticket Caisse — ${sale.receiptNumber}`}
              </span>
            </h3>

            {/* Format switch */}
            <div className="inline-flex p-0.5 bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`px-2.5 py-1 rounded-md transition-colors font-semibold cursor-pointer ${
                  format === 'A4' ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Facture A4
              </button>
              <button
                type="button"
                onClick={() => setFormat('THERMAL')}
                className={`px-2.5 py-1 rounded-md transition-colors font-semibold cursor-pointer ${
                  format === 'THERMAL' ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ticket 80mm
              </button>
              <button
                type="button"
                onClick={() => setFormat('BL')}
                className={`px-2.5 py-1 rounded-md transition-colors font-semibold cursor-pointer ${
                  format === 'BL' ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bon Livraison (BL)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Télécharger directement le fichier PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Fermer la facture et préparer une nouvelle vente"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nouvelle vente</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {format === 'A4' ? (
            /* ============================================================== */
            /* ============================================================== */
            /* FACTURE COMMERCIALE CLASSIQUE FORMAT A4 (NOIR & BLANC + ORANGE) */
            /* ============================================================== */
            <div
              id="printable-a4-invoice"
              className="mx-auto bg-white text-black border border-black/80 shadow-md p-8 sm:p-12 w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between font-sans print:border-none print:shadow-none print:p-6 print:m-0 print:w-full print:max-w-none"
            >
              <div className="space-y-5">
                {/* 1. En-tête : Entreprise en orange + FACTURE en orange */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                  {/* Coordonnées Société */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      {companyInfo.logoUrl ? (
                        <img
                          src={companyInfo.logoUrl}
                          alt={companyInfo.name}
                          className="w-12 h-12 object-contain border border-neutral-300 bg-white p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 bg-black text-white border border-black font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {companyInfo.shortName || companyInfo.name?.slice(0, 4).toUpperCase() || 'WKRLI'}
                        </div>
                      )}
                      <div>
                        {/* Clé 1 : Nom de l'entreprise en Orange de l'application */}
                        <h1 className="text-2xl font-black tracking-tight text-amber-500 uppercase leading-none">
                          {companyInfo.name}
                        </h1>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 mt-1">
                          {companyInfo.slogan}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-neutral-800 space-y-0.5 pt-2">
                      <p>{companyInfo.address}</p>
                      <p>
                        Tél : {companyInfo.phone}
                        {companyInfo.email ? ` · ${companyInfo.email}` : ''}
                      </p>
                      {(companyInfo.ninea || companyInfo.rc) && (
                        <p className="font-mono text-[11px] text-neutral-700">
                          {companyInfo.ninea && (
                            <>
                              NINEA : <strong className="text-black">{companyInfo.ninea}</strong>
                            </>
                          )}
                          {companyInfo.ninea && companyInfo.rc && ' · '}
                          {companyInfo.rc && (
                            <>
                              RC : <strong className="text-black">{companyInfo.rc}</strong>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bloc Titre FACTURE + Métadonnées */}
                  <div className="sm:text-right shrink-0">
                    {/* Clé 2 : Le mot FACTURE en grand avec la couleur orange de l'application */}
                    <div className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-amber-500 font-mono leading-none">
                      FACTURE
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-black mt-1">
                      DE VENTE COMMERCIALE
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <p className="text-sm font-black font-mono text-black">
                        N° <span className="text-amber-500">{sale.receiptNumber}</span>
                      </p>
                      <p className="text-neutral-800">
                        Date : <strong className="text-black font-mono">{formatDateTime(sale.date)}</strong>
                      </p>
                      <p className="text-neutral-800">
                        Magasin : <strong className="text-black">{warehouse?.name || sale.warehouseName}</strong>
                      </p>
                      <p className="text-neutral-800">
                        Caissier / Vendeur : <strong className="text-black">{sale.userName}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ligne de séparation classique noire avec accent orange */}
                <div className="h-0.5 bg-black w-full relative">
                  <div className="absolute left-0 top-0 h-1 bg-amber-500 w-28 -translate-y-[1px]" />
                </div>

                {/* 2. Cadres Destinataire / Client & Règlement (Style classique sobre) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 border border-black bg-white space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-black block pb-1 border-b border-black">
                      Destinataire / Client
                    </span>
                    <h3 className="font-black text-sm text-black pt-1">{sale.customerName}</h3>
                    {sale.customerPhone && (
                      <p className="text-neutral-800">Téléphone : {sale.customerPhone}</p>
                    )}
                    <p className="text-neutral-600 text-[11px] pt-0.5">
                      Réf Vente Système : <span className="font-mono text-black font-bold">{sale.id}</span>
                    </p>
                  </div>

                  <div className="p-3.5 border border-black bg-white space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-black block pb-1 border-b border-black">
                      Modalités & État du Règlement
                    </span>
                    <p className="text-neutral-900 pt-1">
                      Statut :{' '}
                      <strong className="text-black font-mono font-bold">
                        {sale.paymentStatus === 'PAID' ? 'RÉGLÉ INTÉGRALEMENT' : 'PAIEMENT PARTIEL / CRÉANCE'}
                      </strong>
                    </p>
                    <p className="text-neutral-900">
                      Montant Encaissé : <strong className="font-mono text-black">{formatFCFA(sale.totalPaid)}</strong>
                    </p>
                    {salePayments.length > 0 && (
                      <div className="pt-1 mt-1 border-t border-neutral-200 space-y-0.5 text-[11px]">
                        <span className="font-bold text-neutral-700 block">
                          {salePayments.length > 1 ? 'Détail des règlements (mixte) :' : 'Mode de règlement :'}
                        </span>
                        {salePayments.map((p) => (
                          <div key={p.id} className="flex justify-between text-neutral-900">
                            <span>
                              {formatMethodLabel(p.method)}
                              {p.reference ? ` (${p.reference})` : ''}
                            </span>
                            <strong className="font-mono">{formatFCFA(p.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    {sale.remainingDue > 0 && (
                      <p className="text-black font-bold">
                        Solde restant dû : <span className="font-mono font-black underline">{formatFCFA(sale.remainingDue)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Grille Comptable Classique des Articles (Noir & Blanc structuré) */}
                <div className="border-2 border-black overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black text-white font-black uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center text-white">#</th>
                        <th className="py-2.5 px-3 w-36">Référence</th>
                        <th className="py-2.5 px-3">Désignation & Marque</th>
                        <th className="py-2.5 px-3 text-center w-20">Qté</th>
                        <th className="py-2.5 px-3 text-right w-28">P.U. (FCFA)</th>
                        <th className="py-2.5 px-3 text-right w-20">Remise</th>
                        <th className="py-2.5 px-3 text-right w-32">Total Net (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-300">
                      {sale.items.map((item, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="py-2 px-3 text-center font-mono text-neutral-500 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-black">
                            {item.mainReference}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-black">{item.designation}</div>
                            {item.brand && (
                              <div className="text-[11px] text-neutral-600 font-medium">
                                Marque : {item.brand}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-black">
                            {item.quantity}{' '}
                            <span className="text-[10px] font-normal text-neutral-600">{item.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-black tabular-nums">
                            {formatFCFA(item.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-black">
                            {item.discountAmount > 0 ? (
                              <span className="font-bold">-{formatFCFA(item.discountAmount)}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-black tabular-nums">
                            {formatFCFA(item.totalLine)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Totaux & Arrêté de Facture */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-1">
                  <div className="flex-1 space-y-2 text-xs">
                    {sale.notes && (
                      <div className="p-2.5 border border-black text-black italic">
                        Observations : {sale.notes}
                      </div>
                    )}
                    <div className="border border-black p-3 bg-white">
                      <span className="text-neutral-700">Arrêtée la présente facture à la somme de : </span>
                      <strong className="block text-xs uppercase font-black text-black mt-1">
                        {formatFCFA(sale.totalAmount)}
                      </strong>
                    </div>
                  </div>

                  {/* Tableau des Totaux avec Net à Payer en Orange */}
                  {(() => {
                    const rb = getSaleReturnBreakdown(sale);
                    const netTotal = getNetSaleAmount(sale);
                    return (
                      <div className="w-full sm:w-80 border-2 border-black text-xs shrink-0 bg-white">
                        <div className="p-2 flex justify-between border-b border-black text-neutral-800">
                          <span>Sous-total articles :</span>
                          <span className="font-mono font-bold text-black tabular-nums">
                            {formatFCFA(sale.subtotal)}
                          </span>
                        </div>

                        {sale.totalDiscount > 0 && (
                          <div className="p-2 flex justify-between border-b border-black text-black font-semibold">
                            <span>Total remise accordée :</span>
                            <span className="font-mono tabular-nums">
                              -{formatFCFA(sale.totalDiscount)}
                            </span>
                          </div>
                        )}

                        {rb.reimbursedAmount > 0 && (
                          <div className="p-2 flex justify-between border-b border-black text-rose-700 font-semibold">
                            <span>Retour (Remboursé client) :</span>
                            <span className="font-mono tabular-nums">
                              -{formatFCFA(rb.reimbursedAmount)}
                            </span>
                          </div>
                        )}

                        {rb.avoirAmount > 0 && (
                          <div className="p-2 flex justify-between border-b border-black text-indigo-800 font-semibold">
                            <span>Retour (Avoir client) :</span>
                            <span className="font-mono tabular-nums">
                              -{formatFCFA(rb.avoirAmount)}
                            </span>
                          </div>
                        )}

                        {rb.debtDeductedAmount > 0 && (
                          <div className="p-2 flex justify-between border-b border-black text-amber-800 font-semibold">
                            <span>Retour (Déduit créance) :</span>
                            <span className="font-mono tabular-nums">
                              -{formatFCFA(rb.debtDeductedAmount)}
                            </span>
                          </div>
                        )}

                        {/* Net à Payer : Contraste élevé Blanc sur Noir */}
                        <div className="p-3 bg-black text-white flex justify-between items-center border-b border-black">
                          <span className="font-black text-xs uppercase text-white">
                            Net à Payer (TTC) :
                          </span>
                          <span className="font-mono font-black text-lg text-white tabular-nums">
                            {formatFCFA(netTotal)}
                          </span>
                        </div>

                        <div className="p-2 flex justify-between border-b border-black text-neutral-800">
                          <span>Montant Payé (Net) :</span>
                          <span className="font-mono font-bold text-black">{formatFCFA(sale.totalPaid)}</span>
                        </div>

                        {sale.remainingDue > 0 && (
                          <div className="p-2 flex justify-between text-black font-bold bg-neutral-100">
                            <span>Solde restant dû :</span>
                            <span className="font-mono font-black underline">{formatFCFA(sale.remainingDue)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 5. Cadres de Signatures Classiques */}
                <div className="pt-4 grid grid-cols-2 gap-6 text-xs">
                  <div className="p-3.5 border border-black h-28 flex flex-col justify-between bg-white">
                    <span className="font-black text-black uppercase text-[11px]">Visa / Signature du Client</span>
                    <span className="text-[10px] text-neutral-500 italic">Mention manuscrite « Bon pour accord »</span>
                  </div>
                  <div className="p-3.5 border border-black h-28 flex flex-col justify-between bg-white">
                    <span className="font-black text-black uppercase text-[11px]">Pour {companyInfo.name}</span>
                    <span className="text-[10px] text-neutral-600">Cachet & Signature de la Direction</span>
                  </div>
                </div>
              </div>

              {/* 6. Pied de page sobre */}
              <div className="pt-5 border-t border-black text-center text-[10px] text-neutral-600 space-y-0.5">
                <p className="font-semibold text-black">
                  {companyInfo.name}
                  {companyInfo.ninea ? ` · NINEA : ${companyInfo.ninea}` : ''}
                  {companyInfo.rc ? ` · RC : ${companyInfo.rc}` : ''} · Page 1/1
                </p>
                {companyInfo.bankInfo && (
                  <p className="font-mono text-[10px] text-neutral-700">{companyInfo.bankInfo}</p>
                )}
                <p>
                  {companyInfo.address} · Tél : {companyInfo.phone}
                  {companyInfo.invoiceFooter ? ` · ${companyInfo.invoiceFooter}` : ' · Merci pour votre confiance !'}
                </p>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* TICKET CAISSE (80mm) & BON DE LIVRAISON (BL)                   */
            /* ============================================================== */
            <div
              id="printable-receipt"
              className={`bg-white text-black shadow-sm border border-slate-300 p-5 sm:p-6 transition-all font-sans font-semibold leading-snug ${
                format === 'THERMAL' ? 'max-w-[380px] w-full text-[13px]' : 'max-w-[500px] w-full text-[13px]'
              }`}
            >
              {/* Store Header */}
              <div className="text-center pb-3.5 border-b-2 border-dashed border-black">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {companyInfo.logoUrl ? (
                    <img src={companyInfo.logoUrl} alt={companyInfo.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <Truck className="w-5 h-5 text-black stroke-[2.4]" />
                  )}
                  <span className="font-black text-lg tracking-tight uppercase text-black">
                    {companyInfo.name}
                  </span>
                </div>
                <p className="font-extrabold text-sm text-black">
                  {warehouse?.name || sale.warehouseName}
                </p>
                {(companyInfo.address || warehouse?.location) && (
                  <p className="text-black font-bold text-xs">{companyInfo.address || warehouse?.location}</p>
                )}
                {(companyInfo.phone || warehouse?.phone) && (
                  <p className="text-black font-bold text-xs">Tél : {companyInfo.phone || warehouse?.phone}</p>
                )}
                {companyInfo.slogan && (
                  <div className="mt-1.5 text-[11px] font-bold text-black uppercase tracking-wide">
                    {companyInfo.slogan}
                  </div>
                )}
              </div>

              {/* Receipt metadata */}
              <div className="py-3 border-b-2 border-dashed border-black space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-black font-bold">N° Reçu :</span>
                  <span className="font-black font-mono text-black">{sale.receiptNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-black font-bold">Réf. Vente :</span>
                  <span className="font-extrabold font-mono text-black">{sale.id}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-black font-bold">Date & Heure :</span>
                  <span className="font-bold text-black">{formatDateTime(sale.date)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-black font-bold">Vendeur / Caissier :</span>
                  <span className="font-extrabold text-black">{sale.userName}</span>
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-black font-bold">Client :</span>
                  <span className="font-black text-black text-right">{sale.customerName}</span>
                </div>
                {sale.customerPhone && (
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-black font-bold">Tél Client :</span>
                    <span className="font-extrabold text-black">{sale.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-3 border-b-2 border-dashed border-black">
                <div className="font-black uppercase text-xs text-black mb-2 pb-1 border-b border-black flex justify-between">
                  <span>Désignation / Réf {format === 'BL' && '· Rayon'}</span>
                  <span>Total</span>
                </div>
                <div className="space-y-2.5">
                  {sale.items.map((it, idx) => {
                    const art = articles.find((a) => a.id === it.articleId);
                    const locText =
                      art?.defaultLocation ||
                      (art?.rack ? `${art.rack} ${art.shelf ? `· ${art.shelf}` : ''} ${art.bin ? `· ${art.bin}` : ''}` : null);
                    return (
                      <div key={idx} className="text-[13px] pb-1.5 border-b border-dotted border-black last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-black text-black font-mono block text-[13px]">
                              {it.mainReference}
                            </span>
                            <span className="text-black font-bold text-xs block leading-snug">{it.designation}</span>

                            {/* Shelf location for BL picker */}
                            {format === 'BL' && (
                              <div className="inline-flex items-center gap-1 my-0.5 px-1.5 py-0.5 rounded border border-black text-black font-mono text-[11px] font-extrabold">
                                <MapPin className="w-3 h-3 text-black stroke-[2.4]" />
                                <span>{locText || 'Emplacement standard'}</span>
                              </div>
                            )}

                            <span className="text-black font-bold text-xs block mt-0.5">
                              {it.quantity} {it.unit} × {formatFCFA(it.unitPrice)}
                              {it.discountAmount > 0 && (
                                <span className="font-extrabold ml-1">
                                  (Rem: -{formatFCFA(it.discountAmount)})
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="font-black font-mono text-black whitespace-nowrap text-[13px]">
                            {formatFCFA(it.totalLine)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals & Payments */}
              <div className="py-3 border-b-2 border-dashed border-black space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-black">
                  <span>Sous-total articles :</span>
                  <span className="font-mono font-extrabold">{formatFCFA(sale.subtotal)}</span>
                </div>
                {sale.totalDiscount > 0 && (
                  <div className="flex justify-between text-black font-extrabold">
                    <span>Total remises accordées :</span>
                    <span className="font-mono font-black">-{formatFCFA(sale.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-black pt-1.5 border-t-2 border-black">
                  <span>NET À PAYER :</span>
                  <span className="font-mono font-black">{formatFCFA(sale.totalAmount)}</span>
                </div>

                {/* Payments breakdown */}
                <div className="pt-2 text-xs text-black space-y-1">
                  {salePayments.length > 0 && (
                    <div className="space-y-0.5 pb-1 border-b border-dotted border-black">
                      {salePayments.map((p) => (
                        <div key={p.id} className="flex justify-between font-bold text-black">
                          <span>
                            Règlement ({formatMethodLabel(p.method)}):
                          </span>
                          <span className="font-mono font-extrabold">{formatFCFA(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-black">
                    <span>Montant encaissé :</span>
                    <span className="font-mono font-black">{formatFCFA(sale.totalPaid)}</span>
                  </div>
                  {sale.remainingDue > 0 && (
                    <div className="flex justify-between font-black text-[13px] text-black pt-0.5">
                      <span>SOLDE RESTANT DÛ :</span>
                      <span className="font-mono font-black">{formatFCFA(sale.remainingDue)}</span>
                    </div>
                  )}
                  {sale.remainingDue <= 0 && (
                    <div className="flex items-center gap-1.5 text-black font-black text-xs pt-1 uppercase">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Payé intégralement</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes if any */}
              {sale.notes && (
                <div className="py-2 text-xs font-bold text-black border-b-2 border-dashed border-black">
                  Note : {sale.notes}
                </div>
              )}

              {/* BL Signature Boxes */}
              {format === 'BL' && (
                <div className="pt-4 pb-2 border-b-2 border-black grid grid-cols-2 gap-3 text-[11px]">
                  <div className="border-2 border-black rounded p-2 h-20 flex flex-col justify-between">
                    <span className="font-black text-black uppercase">Magasin / Sortie :</span>
                    <span className="text-black font-bold text-[10px]">Visa & Date</span>
                  </div>
                  <div className="border-2 border-black rounded p-2 h-20 flex flex-col justify-between">
                    <span className="font-black text-black uppercase">Réception Client :</span>
                    <span className="text-black font-bold text-[10px]">Nom, Date & Signature</span>
                  </div>
                </div>
              )}

              {/* Legal / Non-tax Disclaimer */}
              <div className="pt-3.5 text-center text-xs text-black space-y-1">
                <p className="font-black text-black text-[13px]">
                  {format === 'BL' ? 'Matériel reçu en bon état conforme à la commande' : 'Merci de votre confiance !'}
                </p>
                <p className="font-bold leading-snug text-[11px] text-black">
                  * Justificatif commercial de délivrance de stock. Document interne non fiscal.
                </p>
                <p className="font-mono font-extrabold text-[11px] text-black pt-0.5">
                  {companyInfo.name || 'WKRLI'} - {formatDateTime(new Date().toISOString())}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
