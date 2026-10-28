import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import { Warehouse, Article } from '../../types';
import { formatFCFA } from '../../utils/formatters';
import {
  Building2,
  Plus,
  Edit2,
  Phone,
  MapPin,
  User,
  Boxes,
  CheckCircle,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
} from 'lucide-react';
import { WarehouseFormModal } from './WarehouseFormModal';
import { ArticleDetailModal } from '../catalog/ArticleDetailModal';

interface WarehouseListViewProps {
  onOpenStockIn: (articleId?: string) => void;
  onOpenStockOut: (articleId?: string) => void;
}

export const WarehouseListView: React.FC<WarehouseListViewProps> = ({
  onOpenStockIn,
  onOpenStockOut,
}) => {
  const {
    warehouses,
    articles,
    stocks,
    selectedWarehouseId,
    setSelectedWarehouseId,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    currentUser,
    getStockForArticleAndWarehouse,
  } = useStock();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [selectedArticleDetail, setSelectedArticleDetail] = useState<Article | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Active warehouse to inspect details
  const [inspectedWarehouseId, setInspectedWarehouseId] = useState<string>(
    selectedWarehouseId || warehouses[0]?.id || ''
  );

  const inspectedWarehouse = warehouses.find((w) => w.id === inspectedWarehouseId) || warehouses[0];

  const handleCreateOrUpdate = (warehouseData: Omit<Warehouse, 'id'>) => {
    if (editingWarehouse) {
      return updateWarehouse(editingWarehouse.id, warehouseData);
    } else {
      return createWarehouse(warehouseData);
    }
  };

  const handleConfirmDelete = () => {
    if (!warehouseToDelete) return;
    const res = deleteWarehouse(warehouseToDelete.id);
    if (!res.success) {
      setDeleteFeedback({ type: 'error', message: res.error || 'Erreur lors de la suppression.' });
    } else {
      setDeleteFeedback({ type: 'success', message: res.message });
      setWarehouseToDelete(null);
      // If inspected warehouse was deleted, switch to another
      if (inspectedWarehouseId === warehouseToDelete.id) {
        const remaining = warehouses.filter((w) => w.id !== warehouseToDelete.id);
        if (remaining.length > 0) {
          setInspectedWarehouseId(remaining[0].id);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Action feedback banner if any */}
      {deleteFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs sm:text-sm animate-in fade-in ${
            deleteFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {deleteFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="font-medium leading-relaxed">{deleteFeedback.message}</p>
          </div>
          <button
            onClick={() => setDeleteFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & New Warehouse Button */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Réseau des magasins de stockage ({warehouses.length})
          </h2>
          <p className="text-xs text-slate-500">
            Entrepôts centraux et dépôts avancés au Sénégal avec stocks indépendants
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => {
              setEditingWarehouse(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau magasin
          </button>
        )}
      </div>

      {/* Warehouses Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const whStocks = stocks.filter((s) => s.warehouseId === wh.id);
          const totalPieces = whStocks.reduce((sum, s) => sum + s.quantity, 0);
          const totalValue = whStocks.reduce((sum, s) => {
            const art = articles.find((a) => a.id === s.articleId);
            return sum + (art ? s.quantity * art.purchasePrice : 0);
          }, 0);
          const refWithStockCount = whStocks.filter((s) => s.quantity > 0).length;

          const isInspected = inspectedWarehouseId === wh.id;

          return (
            <div
              key={wh.id}
              onClick={() => setInspectedWarehouseId(wh.id)}
              className={`p-5 rounded-xl border bg-white shadow-xs transition-all cursor-pointer relative ${
                isInspected
                  ? 'border-amber-500 ring-2 ring-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {wh.code}
                    </span>
                    {wh.isDefault && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Principal
                      </span>
                    )}
                    {!wh.isActive && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                        Archivé
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{wh.name}</h3>
                </div>

                {currentUser.role === 'ADMIN' && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingWarehouse(wh);
                        setIsFormOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
                      title="Modifier les coordonnées du magasin"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {!wh.isDefault && (
                      <button
                        onClick={() => {
                          setDeleteFeedback(null);
                          setWarehouseToDelete(wh);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Supprimer ou archiver ce magasin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{wh.location || 'Localisation non définie'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Responsable : {wh.manager || 'Non assigné'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{wh.phone || '-'}</span>
                </div>
              </div>

              {/* Quantities & Value */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Stock physique</span>
                  <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                    {totalPieces.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {refWithStockCount} réf. en stock
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Valeur d'achat</span>
                  <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    {formatFCFA(totalValue)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWarehouseId(wh.id);
                    }}
                    className={`mt-1 text-[11px] font-semibold underline ${
                      selectedWarehouseId === wh.id ? 'text-amber-600' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {selectedWarehouseId === wh.id ? 'Filtre global actif' : 'Filtrer sur ce site'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warehouse Stock Inspector Table */}
      {inspectedWarehouse && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Inventaire détaillé : {inspectedWarehouse.name} ({inspectedWarehouse.code})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consultez les quantités physiques spécifiques présentes dans ce magasin.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Réf. Constructeur</th>
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3">Marque</th>
                  <th className="py-2.5 px-3">Emplacement</th>
                  <th className="py-2.5 px-3 text-right">Quantité sur ce site</th>
                  <th className="py-2.5 px-3 text-right">Valeur Stock</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articles.map((art) => {
                  const qty = getStockForArticleAndWarehouse(art.id, inspectedWarehouse.id);
                  const isOutOfStockInThisWh = qty === 0;

                  return (
                    <tr
                      key={art.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedArticleDetail(art)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {art.mainReference}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">
                        {art.designation}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{art.brand}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                        {art.defaultLocation}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        <span className={isOutOfStockInThisWh ? 'text-slate-300' : 'text-slate-900'}>
                          {qty} {art.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums">
                        {formatFCFA(qty * art.purchasePrice)}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedArticleDetail(art)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Voir la fiche complète"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <WarehouseFormModal
        isOpen={isFormOpen}
        warehouseToEdit={editingWarehouse}
        onClose={() => {
          setIsFormOpen(false);
          setEditingWarehouse(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <ArticleDetailModal
        article={selectedArticleDetail}
        onClose={() => setSelectedArticleDetail(null)}
        onOpenStockIn={(id) => onOpenStockIn(id)}
        onOpenStockOut={(id) => onOpenStockOut(id)}
        onEditArticle={() => {}}
      />

      {/* Warehouse Deletion Confirmation Modal */}
      {warehouseToDelete && (() => {
        const whStockCount = stocks
          .filter((s) => s.warehouseId === warehouseToDelete.id)
          .reduce((sum, s) => sum + s.quantity, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Suppression du magasin
                    </h3>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {warehouseToDelete.code} — {warehouseToDelete.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setWarehouseToDelete(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  Êtes-vous sûr de vouloir supprimer le magasin <strong>{warehouseToDelete.name}</strong> ?
                </p>

                {whStockCount > 0 ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Stock physique non nul ({whStockCount.toLocaleString('fr-FR')} pièces)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      La suppression directe est impossible tant que des pièces sont enregistrées dans ce magasin. Vous devez d'abord transférer ces pièces vers un autre dépôt ou enregistrer une sortie.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                    <p className="font-semibold">Règle de traçabilité :</p>
                    <p className="text-[11px] leading-relaxed">
                      Si ce magasin a déjà enregistré des ventes, transferts ou inventaires passés, il sera <strong>archivé et désactivé</strong> pour préserver l'historique comptable. S'il n'a jamais été utilisé, il sera définitivement supprimé.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setWarehouseToDelete(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={whStockCount > 0}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmer la suppression</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
