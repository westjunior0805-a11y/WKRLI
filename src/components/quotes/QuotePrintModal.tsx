import React, { useState } from 'react';
import { Quote } from '../../types';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import {
  Printer,
  X,
  FileText,
  Building2,
  User,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  ShieldCheck,
  Download,
} from 'lucide-react';

import { useStock } from '../../context/StockContext';

interface QuotePrintModalProps {
  quote: Quote | null;
  onClose: () => void;
}

export const QuotePrintModal: React.FC<QuotePrintModalProps> = ({ quote, onClose }) => {
  const { companyInfo } = useStock();
  const [printPaperSize, setPrintPaperSize] = useState<'A4' | 'TICKET'>('A4');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!quote) return null;

  const handlePrint = () => {
    const targetId = printPaperSize === 'TICKET' ? 'printable-ticket-quote' : 'printable-a4-quote';
    const format = printPaperSize === 'TICKET' ? 'TICKET_80MM' : 'A4';
    printElementById(targetId, format);
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const targetId = printPaperSize === 'TICKET' ? 'printable-ticket-quote' : 'printable-a4-quote';
      const format = printPaperSize === 'TICKET' ? 'TICKET_80MM' : 'A4';
      await downloadElementAsPdf(targetId, `Devis_${quote.quoteNumber}`, format);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Facture Devis / Proforma A4</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-400 text-slate-950">
                  {quote.quoteNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Format standard A4 commercial prêt pour impression, archivage ou export PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper format selector */}
            <div className="inline-flex items-center p-0.5 bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPrintPaperSize('A4')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  printPaperSize === 'A4'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Format A4
              </button>
              <button
                type="button"
                onClick={() => setPrintPaperSize('TICKET')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  printPaperSize === 'TICKET'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Format Ticket 80mm
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Télécharger directement le fichier PDF"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingPdf ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 print:p-0 print:bg-white print:overflow-visible">
          {printPaperSize === 'A4' ? (
            /* ============================================================== */
            /* FACTURE PROFORMA / DEVIS CLASSIQUE A4 (NOIR & BLANC + ORANGE)  */
            /* ============================================================== */
            <div
              id="printable-a4-quote"
              className="mx-auto bg-white text-black border border-black/80 shadow-md p-8 sm:p-12 w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between font-sans print:border-none print:shadow-none print:p-6 print:m-0 print:w-full print:max-w-none"
              style={{
                boxSizing: 'border-box',
              }}
            >
              <div className="space-y-5">
                {/* 1. Header Entreprise & Badge Document */}
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

                  {/* Bloc Titre FACTURE PROFORMA + Métadonnées */}
                  <div className="sm:text-right shrink-0">
                    {/* Clé 2 : Le mot FACTURE en grand avec la couleur orange de l'application */}
                    <div className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-amber-500 font-mono leading-none">
                      FACTURE
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-black mt-1">
                      PROFORMA / DEVIS CLIENT
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <p className="text-sm font-black font-mono text-black">
                        N° <span className="text-amber-500">{quote.quoteNumber}</span>
                      </p>
                      <p className="text-neutral-800">
                        Date d'émission : <strong className="text-black font-mono">{formatDate(quote.date)}</strong>
                      </p>
                      <p className="text-neutral-800">
                        Offre valide jusqu'au : <strong className="text-black font-mono">{quote.validUntil}</strong>
                      </p>
                      <p className="text-neutral-800">
                        Magasin : <strong className="text-black">{quote.warehouseName}</strong>
                      </p>
                      <p className="text-neutral-800">
                        Conseiller : <strong className="text-black">{quote.createdByName}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ligne de séparation classique noire avec accent orange */}
                <div className="h-0.5 bg-black w-full relative">
                  <div className="absolute left-0 top-0 h-1 bg-amber-500 w-28 -translate-y-[1px]" />
                </div>

                {/* 2. Bloc Destinataire / Client & Modalités */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 border border-black bg-white space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-black block pb-1 border-b border-black">
                      Destinataire / Client
                    </span>
                    <h3 className="font-black text-sm text-black pt-1">{quote.customerName}</h3>
                    {quote.customerPhone && (
                      <p className="text-neutral-800">Téléphone : {quote.customerPhone}</p>
                    )}
                    {quote.customerEmail && (
                      <p className="text-neutral-800">Email : {quote.customerEmail}</p>
                    )}
                    <p className="text-neutral-600 text-[11px] pt-0.5">
                      Compte Client : <strong className="text-black">{quote.customerId ? quote.customerId.slice(-6).toUpperCase() : 'COMPTOIR'}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 border border-black bg-white space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-black block pb-1 border-b border-black">
                      Conditions de délivrance & Règlement
                    </span>
                    <p className="text-neutral-900 pt-1">
                      Disponibilité : <strong className="text-black">En stock immédiat à {quote.warehouseName}</strong>
                    </p>
                    <p className="text-neutral-900">
                      Règlement : <strong className="text-black">Virement, Chèque, Espèces, Wave ou Orange Money</strong>
                    </p>
                    <p className="text-neutral-900">
                      Délai d'enlèvement : <strong className="text-black">Sous 48 heures ouvrées après validation</strong>
                    </p>
                    <p className="text-neutral-600 text-[11px] pt-0.5">
                      Statut de l'offre : <strong className="font-mono text-black font-bold">{quote.status}</strong>
                    </p>
                  </div>
                </div>

                {/* 3. Tableau Détaillé des Articles (Format A4 Noir & Blanc Structuré) */}
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
                      {quote.items.map((item, idx) => (
                        <tr key={item.articleId} className="bg-white">
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
                            {item.discountPercent > 0 ? (
                              <span className="font-bold">-{item.discountPercent}%</span>
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

                {/* 4. Totaux & Arrêté Financier */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-1">
                  {/* Gauche: Observations & Conditions */}
                  <div className="flex-1 space-y-2 text-xs text-neutral-800">
                    <div className="p-2.5 border border-black bg-white space-y-1">
                      <span className="font-black uppercase tracking-wider text-black text-[10px] block">
                        Conditions & Validité :
                      </span>
                      <p className="leading-relaxed">
                        {quote.terms ||
                          `Offre valable 30 jours à compter de la date d’émission. Les prix s’entendent départ magasin ${companyInfo.name || 'WKRLI'}. En cas d’acceptation, merci de retourner le présent document signé et revêtu du cachet de votre société.`}
                      </p>
                      {quote.notes && (
                        <p className="text-[11px] text-neutral-600 italic pt-1 border-t border-neutral-300 mt-1">
                          Observations : {quote.notes}
                        </p>
                      )}
                    </div>

                    {/* Mention légale d'arrêté */}
                    <div className="border border-black p-3 bg-white">
                      <span className="text-neutral-700">Arrêté le présent devis proforma à la somme de : </span>
                      <strong className="block text-xs uppercase font-black text-black mt-1">
                        {formatFCFA(quote.totalAmount)}
                      </strong>
                    </div>

                    {companyInfo.bankInfo && (
                      <div className="text-[11px] text-neutral-600 space-y-0.5">
                        <p>Règlement bancaire / Mobile Money :</p>
                        <p className="font-mono font-bold text-black">
                          {companyInfo.bankInfo}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Droite: Tableau Récapitulatif Financier */}
                  <div className="w-full sm:w-80 border-2 border-black text-xs shrink-0 bg-white">
                    <div className="p-2 flex justify-between border-b border-black text-neutral-800">
                      <span>Sous-total brut HT :</span>
                      <span className="font-mono font-bold text-black tabular-nums">
                        {formatFCFA(quote.subtotal)}
                      </span>
                    </div>

                    {quote.totalDiscount > 0 && (
                      <div className="p-2 flex justify-between border-b border-black text-black font-semibold">
                        <span>Remise commerciale :</span>
                        <span className="font-mono tabular-nums">
                          -{formatFCFA(quote.totalDiscount)}
                        </span>
                      </div>
                    )}

                    <div className="p-2 flex justify-between border-b border-black text-neutral-800">
                      <span>Total Net HT :</span>
                      <span className="font-mono font-bold text-black tabular-nums">
                        {formatFCFA(quote.totalAmount)}
                      </span>
                    </div>

                    <div className="p-2 flex justify-between border-b border-black text-neutral-600 text-[11px]">
                      <span>TVA (Régime franchise) :</span>
                      <span className="font-mono">Exonéré (0 FCFA)</span>
                    </div>

                    {/* Grand Total Net à Payer avec touche Orange Signature */}
                    <div className="p-3 bg-black text-white flex justify-between items-center">
                      <span className="font-black text-xs uppercase text-amber-400">
                        Net à Payer (TTC) :
                      </span>
                      <span className="font-mono font-black text-lg text-amber-400 tabular-nums">
                        {formatFCFA(quote.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Cadres Signatures & Cachets */}
                <div className="pt-4 grid grid-cols-2 gap-6 text-xs">
                  <div className="p-3.5 border border-black h-28 flex flex-col justify-between bg-white">
                    <span className="font-black text-black uppercase text-[11px]">
                      Bon pour Accord & Mention « Bon pour commande »
                    </span>
                    <span className="text-[10px] text-neutral-500 italic">
                      Date, Nom, Signature et Cachet du Client
                    </span>
                  </div>

                  <div className="p-3.5 border border-black h-28 flex flex-col justify-between bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-black uppercase text-[11px]">Pour {companyInfo.name}</span>
                      <span className="text-[10px] font-mono font-semibold text-neutral-700">
                        Direction Commerciale
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-700">
                      Conseiller : <span className="font-bold text-black">{quote.createdByName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Bas de Page Légal A4 */}
              <div className="pt-5 border-t border-black text-center text-[10px] text-neutral-600 space-y-0.5">
                <p className="font-semibold text-black">
                  {companyInfo.name}
                  {companyInfo.capital ? ` · Capital de ${companyInfo.capital}` : ''}
                  {companyInfo.ninea ? ` · NINEA : ${companyInfo.ninea}` : ''}
                  {companyInfo.rc ? ` · RC : ${companyInfo.rc}` : ''}
                </p>
                <p>
                  {companyInfo.invoiceFooter || 'Offre proforma valable 30 jours'} · Page 1/1
                </p>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* MODÈLE TICKET COMPACT (80mm)                                  */
            /* ============================================================== */
            <div
              id="printable-ticket-quote"
              className="mx-auto bg-white text-black border border-slate-300 shadow-sm p-5 max-w-[380px] w-full font-sans font-semibold text-[13px] leading-snug print:border-none print:shadow-none print:p-1"
            >
              <div className="text-center pb-3 border-b-2 border-dashed border-black">
                <h2 className="font-black text-lg uppercase text-black">{companyInfo.name}</h2>
                <p className="text-xs font-extrabold text-black">{quote.warehouseName}</p>
                {companyInfo.phone && <p className="text-xs font-bold text-black">Tél : {companyInfo.phone}</p>}
                <div className="mt-2 py-1 border-2 border-black text-black font-black text-xs uppercase tracking-wide">
                  FACTURE DEVIS / PROFORMA
                </div>
                <p className="font-black font-mono text-sm mt-1.5 text-black">N° {quote.quoteNumber}</p>
                <p className="text-xs font-bold text-black">Date : {formatDate(quote.date)}</p>
              </div>

              <div className="py-2.5 border-b-2 border-dashed border-black text-xs space-y-0.5 text-black">
                <p className="font-bold">Client : <strong className="font-black">{quote.customerName}</strong></p>
                {quote.customerPhone && <p className="font-bold">Tél : <strong className="font-extrabold">{quote.customerPhone}</strong></p>}
                <p className="font-bold">Conseiller : <strong className="font-extrabold">{quote.createdByName}</strong></p>
                <p className="font-bold">Validité : <strong className="font-extrabold">jusqu'au {quote.validUntil}</strong></p>
              </div>

              <div className="py-2.5 border-b-2 border-dashed border-black space-y-2.5">
                {quote.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2 pb-1.5 border-b border-dotted border-black last:border-b-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <span className="font-black font-mono text-[13px] text-black block">{it.mainReference}</span>
                      <span className="text-xs font-bold text-black block leading-snug">{it.designation}</span>
                      <span className="text-xs font-bold text-black block mt-0.5">
                        {it.quantity} {it.unit} × {formatFCFA(it.unitPrice)}
                        {it.discountPercent > 0 && ` (-${it.discountPercent}%)`}
                      </span>
                    </div>
                    <span className="font-black font-mono text-[13px] text-black shrink-0 whitespace-nowrap">
                      {formatFCFA(it.totalLine)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="py-2.5 space-y-1.5 text-xs text-black">
                <div className="flex justify-between font-bold">
                  <span>Sous-total :</span>
                  <span className="font-mono font-extrabold">{formatFCFA(quote.subtotal)}</span>
                </div>
                {quote.totalDiscount > 0 && (
                  <div className="flex justify-between font-extrabold text-black">
                    <span>Remise :</span>
                    <span className="font-mono font-black">-{formatFCFA(quote.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base pt-1.5 border-t-2 border-black">
                  <span>NET À PAYER :</span>
                  <span className="font-mono font-black">{formatFCFA(quote.totalAmount)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t-2 border-dashed border-black text-xs font-bold text-black space-y-0.5">
                <p>Devis valable 30 jours.</p>
                <p className="font-black text-[13px]">Merci pour votre confiance !</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
