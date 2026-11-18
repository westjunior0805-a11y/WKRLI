import React from 'react';
import { Sale } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate } from '../../utils/formatters';
import { printElementById, downloadElementAsPdf } from '../../utils/pdfExporter';
import { Printer, X, FileCheck, Building2, User, MapPin, Download } from 'lucide-react';

interface DeliveryNotePrintModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const DeliveryNotePrintModal: React.FC<DeliveryNotePrintModalProps> = ({
  sale,
  onClose,
}) => {
  const { articles, companyInfo } = useStock();
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  if (!sale) return null;

  const handlePrint = () => {
    printElementById('printable-delivery-note', 'A4');
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf('printable-delivery-note', `BL_${sale.receiptNumber || sale.id}`, 'A4');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Top Action Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-sm font-bold block">Bon de Livraison Client (BL)</span>
              <span className="text-xs text-slate-300 font-mono">
                BL-{sale.receiptNumber || sale.id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingPdf ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport on Screen */}
        <div className="overflow-y-auto max-h-[82vh] print:max-h-none print:overflow-visible">
          {/* Printable Document Body */}
          <div
            id="printable-delivery-note"
            className="p-8 sm:p-12 print:p-6 text-slate-900 space-y-8 bg-white"
          >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                {companyInfo.logoUrl ? (
                  <img
                    src={companyInfo.logoUrl}
                    alt={companyInfo.name}
                    className="w-12 h-12 object-contain rounded-lg border border-slate-200 p-1 bg-white shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                    {companyInfo.shortName || companyInfo.name?.slice(0, 4).toUpperCase() || 'WKRLI'}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    {companyInfo.name || 'WKRLI'}
                  </h1>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                    {companyInfo.slogan || 'Bordereau de Livraison & Décharge Magasin'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 space-y-0.5">
                <p>{companyInfo.address}</p>
                <p>
                  Tél : {companyInfo.phone}
                  {companyInfo.email ? ` · ${companyInfo.email}` : ''}
                </p>
                {(companyInfo.ninea || companyInfo.rc) && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    {companyInfo.ninea ? `NINEA : ${companyInfo.ninea}` : ''}
                    {companyInfo.ninea && companyInfo.rc ? ' · ' : ''}
                    {companyInfo.rc ? `RC : ${companyInfo.rc}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-900 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider mb-2">
                BON DE LIVRAISON (BL)
              </span>
              <h2 className="text-lg font-black font-mono text-slate-900">
                BL-{sale.receiptNumber || sale.id}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Date sortie magasin : <span className="font-semibold text-slate-800">{formatDate(sale.date)}</span>
              </p>
              <p className="text-xs text-slate-500">
                Réf Vente : <span className="font-mono text-slate-700">{sale.id}</span>
              </p>
            </div>
          </div>

          {/* Customer & Warehouse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Client / Destinataire
              </span>
              <p className="font-bold text-sm text-slate-900">{sale.customerName || 'Client Comptoir'}</p>
              {sale.customerPhone && <p className="text-slate-600 mt-1">Tél : {sale.customerPhone}</p>}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="font-bold uppercase tracking-wider text-slate-500 block text-[11px] mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Dépôt d'enlèvement
              </span>
              <p className="font-bold text-sm text-slate-900">{sale.warehouseName}</p>
              <p className="text-slate-600 mt-1">Magasinier / Expéditeur : {sale.userName}</p>
            </div>
          </div>

          {/* Items with Physical Locations in Warehouse */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Réf. Constructeur</th>
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3">Emplacement Physique Rayon</th>
                  <th className="py-2.5 px-3 text-right">Quantité Livrée</th>
                  <th className="py-2.5 px-3 text-center w-24">Vérifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => {
                  const articleObj = articles.find((a) => a.id === item.articleId);
                  const location =
                    articleObj?.defaultLocation ||
                    (articleObj?.rack || articleObj?.shelf || articleObj?.bin
                      ? [
                          articleObj.rack ? `Rayon ${articleObj.rack}` : '',
                          articleObj.shelf ? `Étagère ${articleObj.shelf}` : '',
                          articleObj.bin ? `Case ${articleObj.bin}` : '',
                        ]
                          .filter(Boolean)
                          .join(' / ')
                      : 'Non renseigné');

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.mainReference}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.designation}</div>
                        <div className="text-[11px] text-slate-400">{item.brand}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3 text-amber-600" />
                          {location}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-slate-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-4 h-4 border border-slate-300 rounded mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total units count */}
          <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600">
              Total pièces à charger : <strong>{sale.items.reduce((s, it) => s + it.quantity, 0)} unité(s)</strong>
            </span>
            <span className="font-semibold text-slate-700">
              Contrôle qualité emballage : Conforme & Scellé
            </span>
          </div>

          {/* Signatures & Décharge */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center">
            <div className="p-4 border border-slate-200 rounded-lg h-32 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Décharge Réceptionnaire (Client / Chauffeur)</span>
              <span className="text-[10px] text-slate-400">Nom, Date, Heure et Signature</span>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg h-32 flex flex-col justify-between">
              <span className="font-bold text-slate-700">Visa Sortie Magasin {companyInfo.name || 'WKRLI'}</span>
              <span className="text-[10px] text-slate-400">{sale.userName} · Magasinier</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
