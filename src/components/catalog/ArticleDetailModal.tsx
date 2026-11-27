import React, { useState } from 'react';
import { Article, Warehouse } from '../../types';
import { formatAED, formatFCFA, formatDate } from '../../utils/formatters';
import {
  getEffectiveArticleBrandOffers,
  formatSalePriceRange,
  formatPurchasePriceRange,
  getBrandStockAcrossWarehouses,
  getBrandLocation,
  getBrandInvoiceNumber,
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
  ImageOff,
  Camera,
  Edit2,
  Boxes,
  CheckCircle2,
  ShoppingBag,
  ExternalLink,
  Tractor,
} from 'lucide-react';
import { useStock } from '../../context/StockContext';
import { MachineWhereUsedModal } from './MachineWhereUsedModal';

interface ArticleDetailModalProps {
  article: Article | null;
  onClose: () => void;
  onOpenStockIn: (articleId: string) => void;
  onOpenStockOut: (articleId: string) => void;
  onEditArticle: (article: Article) => void;
  onQuickEditStock?: (article: Article, brand?: string) => void;
  onDeleteArticle?: (article: Article) => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article: propArticle,
  onClose,
  onOpenStockIn,
  onOpenStockOut,
  onEditArticle,
  onQuickEditStock,
  onDeleteArticle,
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
}) => {
  const {
    articles,
    warehouses,
    getStockForArticleAndWarehouse,
    getTotalStockForArticle,
    getActiveOrderForArticle,
    stocks,
    showProductImages,
    toggleProductImages,
  } = useStock();

  const article = propArticle
    ? articles.find((a) => a.id === propArticle.id) || propArticle
    : null;

  const [isWhereUsedOpen, setIsWhereUsedOpen] = useState(false);

  if (!article) return null;

  const activeWhIds = new Set(warehouses.map((w) => w.id));
  const articleStocks = stocks.filter(
    (s) => s.articleId === article.id && (activeWhIds.size === 0 || activeWhIds.has(s.warehouseId))
  );
  const totalStock = getTotalStockForArticle(article.id);
  const totalPurchaseVal = totalStock * article.purchasePrice;
  const brandOffers = getEffectiveArticleBrandOffers(article, articleStocks);
  const activeOrder = getActiveOrderForArticle(article.id);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                {article.id}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {brandOffers.length} {brandOffers.length > 1 ? 'marques disponibles' : 'marque'}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">{article.category}</span>
              {activeOrder && (
                <div className="inline-flex items-center gap-1 ml-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Commandé
                  </span>
                  {onNavigateToPurchaseOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToPurchaseOrder(activeOrder.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFCD11]/20 hover:bg-[#FFCD11]/30 text-[#FFCD11] border border-[#FFCD11]/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      title={`Ouvrir la liste de commande ${activeOrder.orderNumber}`}
                    >
                      <span>{activeOrder.orderNumber}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{article.mainReference}</h2>
            <p className="text-sm text-slate-300 font-medium">{article.designation}</p>
            {(article.description || article.notes) && (
              <p className="text-xs text-slate-400 mt-1">{article.description || article.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Bouton activation / désactivation des photos */}
            <button
              type="button"
              onClick={toggleProductImages}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 border cursor-pointer ${
                showProductImages
                  ? 'text-amber-300 bg-slate-800 hover:bg-slate-700 border-amber-400/40'
                  : 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
              title={
                showProductImages
                  ? "Désactiver l'affichage des photos produit"
                  : "Activer l'affichage des photos produit"
              }
            >
              {showProductImages ? (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Photo : <strong className="text-emerald-400">Activée</strong></span>
                </>
              ) : (
                <>
                  <ImageOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Photo : <strong className="text-slate-400">Désactivée</strong></span>
                </>
              )}
            </button>

            {onQuickEditStock && (
              <button
                type="button"
                onClick={() => onQuickEditStock(article, brandOffers[0]?.brand)}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                title="Modifier Emplacement, Quantité et Prix"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Modifier Stock / Prix</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Article Image Banner (si activé) ou bandeau compact (si désactivé) */}
          {showProductImages ? (
            article.imageUrl ? (
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
            )
          ) : (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <ImageOff className="w-4 h-4 text-slate-400" />
                <span>Affichage photo désactivé (mode compact).</span>
              </div>
              <button
                type="button"
                onClick={toggleProductImages}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ImageIcon className="w-3 h-3 text-amber-500" />
                <span>Afficher la photo</span>
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
                Prix d'Achat (AED)
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
                {formatAED(totalPurchaseVal)}
              </span>
              <div className="mt-1 text-[11px] text-slate-500">Au coût d'achat (AED)</div>
            </div>
          </div>

          {/* Dedicated Table: Marques, Constructeurs & Grille Tarifaire */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                Marques disponibles, Stocks, Emplacements & Tarifs ({brandOffers.length})
              </span>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-2.5 w-[20%]">Marque</th>
                    <th className="py-2.5 px-2.5 text-right w-[14%]">Qté dispo</th>
                    <th className="py-2.5 px-2.5 w-[16%]">Emplacement</th>
                    <th className="py-2.5 px-2.5 w-[15%]">N° Facture</th>
                    <th className="py-2.5 px-2.5 text-right w-[13%]">P. Achat (AED)</th>
                    <th className="py-2.5 px-2.5 text-right w-[13%]">P. Vente (FCFA)</th>
                    {(onQuickEditStock || onOpenPurchaseOrder) && (
                      <th className="py-2.5 px-2.5 text-right w-[9%]">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brandOffers.map((bo, idx) => {
                    const brandQty = getBrandStockAcrossWarehouses(articleStocks, article, bo.brand);
                    const brandLoc = getBrandLocation(articleStocks, article, bo.brand, null, warehouses);
                    const brandInv = getBrandInvoiceNumber(articleStocks, article, bo.brand);
                    const isBrandOrdered = activeOrder?.items.some(
                      (it) =>
                        it.articleId === article.id &&
                        (!it.brand || it.brand.trim().toLowerCase() === bo.brand.trim().toLowerCase())
                    );

                    return (
                      <tr key={bo.id || idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{bo.brand}</span>
                            {isBrandOrdered && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Commandé
                              </span>
                            )}
                          </div>
                          {bo.preferredSupplier && (
                            <div className="text-[10px] text-slate-400">Fourn : {bo.preferredSupplier}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {brandQty} <span className="text-[10px] font-normal text-slate-400">{article.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {brandLoc}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {brandInv}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatAED(bo.purchasePrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatFCFA(bo.salePrice)}
                        </td>
                        {(onQuickEditStock || onOpenPurchaseOrder) && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              {onOpenPurchaseOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenPurchaseOrder(article.id, bo.brand);
                                  }}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                  title={`Commander ${article.mainReference} (${bo.brand})`}
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onQuickEditStock && (
                                <button
                                  type="button"
                                  onClick={() => onQuickEditStock(article, bo.brand)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title={`Modifier l'emplacement, la quantité et le prix pour ${bo.brand}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
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

            {/* Compatible machines & Where Used (SIS 2.0) */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Tractor className="w-4 h-4 text-amber-500" />
                  <span>Where Used (Caterpillar SIS 2.0)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsWhereUsedOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Gérer ({article.machineApplications?.length || article.compatibleMachines.length})</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {article.machineApplications && article.machineApplications.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="divide-y divide-slate-200/60 max-h-32 overflow-y-auto pr-1">
                    {article.machineApplications.slice(0, 4).map((app) => (
                      <div key={app.id} className="py-1 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                          <span>{app.model}</span>
                          {app.serialPrefix && (
                            <span className="px-1 py-0.2 bg-amber-100 text-amber-900 border border-amber-200 rounded text-[10px]">
                              {app.serialPrefix}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px] truncate max-w-[160px]">
                          {app.productFamily ? `${app.productFamily} · ` : ''}{app.subFamily || app.system || 'SIS 2.0'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {article.machineApplications.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setIsWhereUsedOpen(true)}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline block text-center pt-0.5"
                    >
                      + {article.machineApplications.length - 4} autre(s) machine(s) répertoriée(s)...
                    </button>
                  )}
                </div>
              ) : article.compatibleMachines.length > 0 ? (
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
                <div className="text-xs text-slate-400 flex items-center justify-between py-1">
                  <span>Aucun engin affecté.</span>
                  <button
                    type="button"
                    onClick={() => setIsWhereUsedOpen(true)}
                    className="text-amber-600 hover:underline font-semibold"
                  >
                    + Affecter une machine
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Additional details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Emplacement principal</span>
              <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                {getBrandLocation(stocks, article, article.brand, null, warehouses)}
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditArticle(article);
              }}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                title="Supprimer ou archiver cet article"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenPurchaseOrder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPurchaseOrder(article.id, article.brand);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                title="Ajouter à une liste de commande fournisseur ou créer une nouvelle commande"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                <span>{activeOrder ? '+ Commander' : 'Commander'}</span>
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                onOpenStockIn(article.id);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Entrée
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenStockOut(article.id);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Sortie
            </button>
          </div>
        </div>
      </div>
    </div>

    <MachineWhereUsedModal
      article={article}
      isOpen={isWhereUsedOpen}
      onClose={() => setIsWhereUsedOpen(false)}
    />
  </>
  );
};
