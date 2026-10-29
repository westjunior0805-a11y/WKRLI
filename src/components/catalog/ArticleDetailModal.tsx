import React from 'react';
import { Article, Warehouse } from '../../types';
import { formatFCFA, formatDate } from '../../utils/formatters';
import {
  getArticleBrandOffers,
  formatSalePriceRange,
  formatPurchasePriceRange,
  getBrandStock,
} from '../../utils/articleHelpers';
import {
  X,
  Building2,
  Layers,
  Cpu,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Image as ImageIcon,
  Camera,
  Edit2,
  Boxes,
  CheckCircle2,
} from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface ArticleDetailModalProps {
  article: Article | null;
  onClose: () => void;
  onOpenStockIn: (articleId: string) => void;
  onOpenStockOut: (articleId: string) => void;
  onEditArticle: (article: Article) => void;
  onDeleteArticle?: (article: Article) => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  onClose,
  onOpenStockIn,
  onOpenStockOut,
  onEditArticle,
  onDeleteArticle,
}) => {
  const { warehouses, getStockForArticleAndWarehouse, getTotalStockForArticle, stocks } = useStock();

  if (!article) return null;

  const totalStock = getTotalStockForArticle(article.id);
  const totalPurchaseVal = totalStock * article.purchasePrice;
  const brandOffers = getArticleBrandOffers(article);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                {article.id}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {brandOffers.length} {brandOffers.length > 1 ? 'marques disponibles' : 'marque'}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">{article.category}</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{article.mainReference}</h2>
            <p className="text-sm text-slate-300 font-medium">{article.designation}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditArticle(article);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-slate-700"
              title="Modifier cette référence"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Modifier la fiche</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Article Image Banner */}
          {article.imageUrl ? (
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center max-h-56">
              <img
                src={article.imageUrl}
                alt={article.mainReference}
                className="max-h-56 w-auto object-contain p-2"
              />
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-xs">
                {article.imageType === 'REAL_PHOTO'
                  ? 'Photo réelle atelier'
                  : article.imageType === 'SUPPLIER_IMAGE'
                  ? 'Catalogue constructeur'
                  : 'Schéma technique'}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-200 rounded-lg text-slate-500">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>Aucune photo enregistrée pour cette référence.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditArticle(article);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                <span>Ajouter une photo</span>
              </button>
            </div>
          )}

          {/* Quick Stock & Price Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                Stock Total
              </span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {totalStock} <span className="text-xs font-normal text-slate-500">{article.unit}</span>
              </span>
              <div className="mt-1 text-[11px] text-slate-500">
                Seuil min : <span className="font-mono font-semibold">{article.minStockThreshold}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                Prix d'Achat
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 tabular-nums block truncate">
                {formatPurchasePriceRange(article)}
              </span>
              <div className="mt-1 text-[11px] text-slate-500">Unité : {article.unit}</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                Prix de Vente
              </span>
              <span className="text-sm font-bold font-mono text-emerald-700 tabular-nums block truncate">
                {formatSalePriceRange(article)}
              </span>
              <div className="mt-1 text-[11px] text-emerald-600 font-medium">
                {brandOffers.length > 1 ? 'Selon constructeur' : 'Prix catalogue'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                Valeur en Stock
              </span>
              <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                {formatFCFA(totalPurchaseVal)}
              </span>
              <div className="mt-1 text-[11px] text-slate-500">Au coût d'achat</div>
            </div>
          </div>

          {/* Dedicated Table: Marques, Constructeurs & Grille Tarifaire */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                Marques, Constructeurs & Tarifs Associés ({brandOffers.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditArticle(article);
                }}
                className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Modifier les tarifs</span>
              </button>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Marque / Fabricant</th>
                    <th className="py-2.5 px-3">Réf. Constructeur</th>
                    <th className="py-2.5 px-3 text-right">Prix d'Achat</th>
                    <th className="py-2.5 px-3 text-right">Prix de Vente</th>
                    <th className="py-2.5 px-3 text-right">Marge Brute</th>
                    <th className="py-2.5 px-3 text-right">Stock Dédié</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brandOffers.map((bo, idx) => {
                    const margin = (bo.salePrice || 0) - (bo.purchasePrice || 0);
                    const marginPct = bo.purchasePrice > 0 ? Math.round((margin / bo.purchasePrice) * 100) : 0;
                    const stockRecord = stocks.find((s) => s.articleId === article.id);
                    const brandQty = getBrandStock(stockRecord, bo.brand, totalStock);

                    return (
                      <tr key={bo.id || idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{bo.brand}</span>
                            {bo.isDefault && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                Par défaut
                              </span>
                            )}
                          </div>
                          {bo.preferredSupplier && (
                            <div className="text-[10px] text-slate-400">Fourn : {bo.preferredSupplier}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {bo.brandReference || article.mainReference}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatFCFA(bo.purchasePrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatFCFA(bo.salePrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          <span className={margin >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {formatFCFA(margin)} ({marginPct}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {brandQty} <span className="text-[10px] font-normal text-slate-400">{article.unit}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock distribution across warehouses */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Répartition dans les magasins
            </h3>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {warehouses.map((wh) => {
                const whQty = getStockForArticleAndWarehouse(article.id, wh.id);
                return (
                  <div
                    key={wh.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs sm:text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{wh.name}</span>
                        <span className="text-xs font-mono font-normal text-slate-500">
                          ({wh.code})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{wh.location}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                        {whQty}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">{article.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* References & Compatibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Equivalences */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Références équivalentes / Cross-ref
              </h3>
              {article.equivalentReferences.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {article.equivalentReferences.map((ref, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-semibold text-slate-800"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Aucune référence équivalente enregistrée.</p>
              )}
            </div>

            {/* Compatible machines */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Engins compatibles
              </h3>
              {article.compatibleMachines.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {article.compatibleMachines.map((m, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Non renseigné.</p>
              )}
            </div>
          </div>

          {/* Additional details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Emplacement par défaut</span>
              <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                {article.defaultLocation || 'Non spécifié'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Code-barres</span>
              <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                {article.barcode || '-'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Poids unitaire</span>
              <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                {article.weightKg ? `${article.weightKg} kg` : '-'}
              </span>
            </div>
          </div>

          {article.notes && (
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60 text-xs text-amber-900">
              <span className="font-semibold block mb-0.5">Observations techniques :</span>
              {article.notes}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditArticle(article);
              }}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-950" />
              <span>Modifier la fiche</span>
            </button>
            {onDeleteArticle && (
              <button
                onClick={() => {
                  onClose();
                  onDeleteArticle(article);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
                title="Supprimer ou archiver cet article"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenStockIn(article.id);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Entrée
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenStockOut(article.id);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Sortie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
