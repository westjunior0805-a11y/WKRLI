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
  const { getWarehouseById, articles, companyInfo } = useStock();
  const [format, setFormat] = useState<'THERMAL' | 'A4' | 'BL'>(initialFormat);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!sale) return null;

  const warehouse: Warehouse | undefined = getWarehouseById(sale.warehouseId);

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
              <Printer className="w-4 h-4 text-amber-400" />
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
                        <div className="w-11 h-11 bg-black text-amber-500 border border-amber-500 font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
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
                        <th className="py-2.5 px-3 w-8 text-center text-amber-400">#</th>
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

                        {/* Net à Payer : Information Clé avec Orange Signature de l'application */}
                        <div className="p-3 bg-black text-white flex justify-between items-center border-b border-black">
                          <span className="font-black text-xs uppercase text-amber-400">
                            Net à Payer (TTC) :
                          </span>
                          <span className="font-mono font-black text-lg text-amber-400 tabular-nums">
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
              className={`bg-white text-slate-900 shadow-sm border border-slate-200 p-6 sm:p-8 transition-all ${
                format === 'THERMAL' ? 'max-w-[420px] w-full text-xs font-mono' : 'max-w-[500px] w-full text-xs font-sans'
              }`}
            >
              {/* Store Header */}
              <div className="text-center pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {companyInfo.logoUrl ? (
                    <img src={companyInfo.logoUrl} alt={companyInfo.name} className="w-7 h-7 object-contain" />
                  ) : (
                    <Truck className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-bold text-base tracking-tight uppercase">
                    {companyInfo.name}
                  </span>
                </div>
                <p className="font-semibold text-slate-800">
                  {warehouse?.name || sale.warehouseName}
                </p>
                <p className="text-slate-500 text-[11px]">{companyInfo.address || warehouse?.location}</p>
                <p className="text-slate-500 text-[11px]">Tél : {companyInfo.phone || warehouse?.phone}</p>
                <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-wider">
                  {companyInfo.slogan}
                </div>
              </div>

              {/* Receipt metadata */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Reçu :</span>
                  <span className="font-bold font-mono text-slate-900">{sale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Réf. Vente :</span>
                  <span className="font-mono text-slate-700">{sale.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & Heure :</span>
                  <span className="text-slate-800">{formatDateTime(sale.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendeur / Caissier :</span>
                  <span className="text-slate-800 font-medium">{sale.userName}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-bold text-slate-900 text-right">{sale.customerName}</span>
                </div>
                {sale.customerPhone && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Tél Client :</span>
                    <span className="text-slate-600">{sale.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-3 border-b border-dashed border-slate-300">
                <div className="font-bold uppercase text-[11px] text-slate-500 mb-2 flex justify-between">
                  <span>Désignation / Réf {format === 'BL' && '· Emplacement en Rayon'}</span>
                  <span>Total</span>
                </div>
                <div className="space-y-2">
                  {sale.items.map((it, idx) => {
                    const art = articles.find((a) => a.id === it.articleId);
                    const locText =
                      art?.defaultLocation ||
                      (art?.rack ? `${art.rack} ${art.shelf ? `· ${art.shelf}` : ''} ${art.bin ? `· ${art.bin}` : ''}` : null);
                    return (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-2">
                            <span className="font-bold text-slate-900 font-mono block">
                              {it.mainReference}
                            </span>
                            <span className="text-slate-600 text-[11px] block">{it.designation}</span>

                            {/* Shelf location for BL picker */}
                            {format === 'BL' && (
                              <div className="inline-flex items-center gap-1 my-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px] font-semibold">
                                <MapPin className="w-3 h-3 text-amber-600" />
                                <span>{locText || 'Emplacement standard'}</span>
                              </div>
                            )}

                            <span className="text-slate-400 text-[10px] block">
                              {it.quantity} {it.unit} × {formatFCFA(it.unitPrice)}
                              {it.discountAmount > 0 && (
                                <span className="text-emerald-700 ml-1">
                                  (Remise: -{formatFCFA(it.discountAmount)})
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="font-bold font-mono text-slate-900 whitespace-nowrap">
                            {formatFCFA(it.totalLine)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals & Payments */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sous-total articles :</span>
                  <span className="font-mono">{formatFCFA(sale.subtotal)}</span>
                </div>
                {sale.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Total remises accordées :</span>
                    <span className="font-mono">-{formatFCFA(sale.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>NET À PAYER :</span>
                  <span className="font-mono">{formatFCFA(sale.totalAmount)}</span>
                </div>

                {/* Payments breakdown */}
                <div className="pt-2 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>Montant encaissé :</span>
                    <span className="font-mono">{formatFCFA(sale.totalPaid)}</span>
                  </div>
                  {sale.remainingDue > 0 && (
                    <div className="flex justify-between font-bold text-rose-700">
                      <span>SOLDE RESTANT DÛ (CRÉANCE) :</span>
                      <span className="font-mono">{formatFCFA(sale.remainingDue)}</span>
                    </div>
                  )}
                  {sale.remainingDue <= 0 && (
                    <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px] pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Payé intégralement</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes if any */}
              {sale.notes && (
                <div className="py-2 text-[11px] text-slate-500 italic border-b border-dashed border-slate-300">
                  Note : {sale.notes}
                </div>
              )}

              {/* BL Signature Boxes */}
              {format === 'BL' && (
                <div className="pt-4 pb-2 border-b border-slate-300 grid grid-cols-2 gap-4 text-[10px]">
                  <div className="border border-slate-300 rounded p-2.5 h-20 flex flex-col justify-between">
                    <span className="font-bold text-slate-700 uppercase">Magasin / Sortie :</span>
                    <span className="text-slate-400 text-[9px] italic">Visa & Date</span>
                  </div>
                  <div className="border border-slate-300 rounded p-2.5 h-20 flex flex-col justify-between">
                    <span className="font-bold text-slate-700 uppercase">Décharge Réception Client :</span>
                    <span className="text-slate-400 text-[9px] italic">Nom, Date & Signature</span>
                  </div>
                </div>
              )}

              {/* Legal / Non-tax Disclaimer */}
              <div className="pt-4 text-center text-[10px] text-slate-400 space-y-1">
                <p className="font-medium text-slate-500">
                  {format === 'BL' ? 'Matériel reçu en bon état conforme à la commande' : 'Merci de votre confiance !'}
                </p>
                <p className="italic leading-tight">
                  * Justificatif commercial de délivrance de stock. Ce document interne ne constitue pas une facture fiscale certifiée.
                </p>
                <p className="font-mono text-[9px] text-slate-300">
                  {companyInfo.name || 'WKRLI'} - Imprimé le {formatDateTime(new Date().toISOString())}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
