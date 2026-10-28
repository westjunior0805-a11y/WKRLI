import React, { useState, useMemo } from 'react';
import { SupplierOrder, SupplierOrderStatus } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA, formatDate } from '../../utils/formatters';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  PackageCheck,
  Ban,
  Printer,
  ArrowRight,
  AlertOctagon,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { ReceiveOrderModal } from './ReceiveOrderModal';
import { PurchaseOrderPrintModal } from './PurchaseOrderPrintModal';

export const PurchaseOrderListView: React.FC = () => {
  const {
    supplierOrders,
    articles,
    warehouses,
    getTotalStockForArticle,
    updateSupplierOrderStatus,
    cancelSupplierOrder,
    currentUser,
  } = useStock();

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'SUGGESTIONS'>('ORDERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SupplierOrderStatus>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [orderToReceive, setOrderToReceive] = useState<SupplierOrder | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<SupplierOrder | null>(null);

  // Suggestions state
  const [selectedReplenishArticleIds, setSelectedReplenishArticleIds] = useState<string[]>([]);
  const [prefilledItemsForPO, setPrefilledItemsForPO] = useState<
    Array<{
      articleId: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>
  >([]);
  const [prefilledSupplierName, setPrefilledSupplierName] = useState<string | undefined>(undefined);

  const [notification, setNotification] = useState<string | null>(null);

  // Articles in rupture or low stock for Replenishment Suggestions
  const replenishmentSuggestions = useMemo(() => {
    return articles
      .map((art) => {
        const stock = getTotalStockForArticle(art.id);
        const isRupture = stock === 0;
        const isLow = stock > 0 && stock <= art.minStockThreshold;
        if (!isRupture && !isLow) return null;

        const deficit = Math.max(0, art.minStockThreshold * 2 - stock);
        const suggestedQty = Math.max(1, deficit);

        return {
          article: art,
          currentStock: stock,
          minThreshold: art.minStockThreshold,
          suggestedQty,
          status: isRupture ? ('RUPTURE' as const) : ('SOUS_SEUIL' as const),
          preferredSupplier: art.preferredSupplier || `${art.brand} Distribution`,
          purchasePrice: art.purchasePrice,
          estimatedTotal: suggestedQty * art.purchasePrice,
        };
      })
      .filter(Boolean) as Array<{
      article: (typeof articles)[0];
      currentStock: number;
      minThreshold: number;
      suggestedQty: number;
      status: 'RUPTURE' | 'SOUS_SEUIL';
      preferredSupplier: string;
      purchasePrice: number;
      estimatedTotal: number;
    }>;
  }, [articles, getTotalStockForArticle]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return supplierOrders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = order.orderNumber.toLowerCase().includes(q);
        const matchSupp = order.supplierName.toLowerCase().includes(q);
        const matchWh = order.targetWarehouseName.toLowerCase().includes(q);
        const matchItem = order.items.some(
          (it) => it.mainReference.toLowerCase().includes(q) || it.designation.toLowerCase().includes(q)
        );
        if (!matchNum && !matchSupp && !matchWh && !matchItem) return false;
      }
      return true;
    });
  }, [supplierOrders, statusFilter, searchQuery]);

  // Handle generating PO from selected suggestions
  const handleGeneratePOFromSuggestions = (supplierGroup?: string) => {
    let itemsToInclude = replenishmentSuggestions;
    if (selectedReplenishArticleIds.length > 0) {
      itemsToInclude = replenishmentSuggestions.filter((s) =>
        selectedReplenishArticleIds.includes(s.article.id)
      );
    }
    if (supplierGroup) {
      itemsToInclude = itemsToInclude.filter((s) => s.preferredSupplier === supplierGroup);
    }

    if (itemsToInclude.length === 0) return;

    const payload = itemsToInclude.map((s) => ({
      articleId: s.article.id,
      quantityOrdered: s.suggestedQty,
      purchasePrice: s.purchasePrice,
    }));

    setPrefilledItemsForPO(payload);
    setPrefilledSupplierName(supplierGroup || itemsToInclude[0]?.preferredSupplier);
    setIsCreateModalOpen(true);
  };

  const getStatusBadge = (status: SupplierOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            <Clock className="w-3 h-3" />
            Brouillon
          </span>
        );
      case 'TO_ORDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            À commander
          </span>
        );
      case 'ORDERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Truck className="w-3 h-3" />
            Commandé (En cours)
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">
            <PackageCheck className="w-3 h-3" />
            Partiellement reçu
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Reçu (Complet)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <Ban className="w-3 h-3" />
            Annulé
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-4 h-4 text-slate-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Commandes Fournisseurs & Approvisionnements
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Génération des bons de commande, réapprovisionnement automatique sur seuils et réceptions en stock
          </p>
        </div>

        <button
          onClick={() => {
            setPrefilledItemsForPO([]);
            setPrefilledSupplierName(undefined);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Commande (PO)
        </button>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-emerald-600 hover:text-emerald-900">
            Fermer
          </button>
        </div>
      )}

      {/* Segmented Navigation (Commandes vs Suggestions) */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ORDERS'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Toutes les Commandes ({supplierOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('SUGGESTIONS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'SUGGESTIONS'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-rose-600" />
          Besoins de Réapprovisionnement ({replenishmentSuggestions.length})
          {replenishmentSuggestions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* TAB 1: LISTE DES COMMANDES */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par N° commande, fournisseur, magasin ou référence..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Statut :</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="DRAFT">Brouillons</option>
                <option value="TO_ORDER">À commander</option>
                <option value="ORDERED">Commandés</option>
                <option value="PARTIALLY_RECEIVED">Partiellement reçus</option>
                <option value="RECEIVED">Reçus (Complets)</option>
                <option value="CANCELLED">Annulés</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">Aucune commande trouvée</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Créez votre première commande fournisseur ou utilisez l'onglet des suggestions.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">N° Commande</th>
                      <th className="py-3 px-4">Date Émission</th>
                      <th className="py-3 px-4">Fournisseur</th>
                      <th className="py-3 px-4">Magasin Cible</th>
                      <th className="py-3 px-4 text-center">Lignes</th>
                      <th className="py-3 px-4 text-right">Montant Total</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const totalQtyOrdered = order.items.reduce((s, it) => s + it.quantityOrdered, 0);
                      const totalQtyReceived = order.items.reduce((s, it) => s + it.quantityReceived, 0);
                      const canReceive = order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(order.date)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {order.supplierName}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-medium text-slate-800">{order.targetWarehouseName}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="font-bold text-slate-800">{order.items.length}</span>
                            <span className="text-[11px] text-slate-400 ml-1">
                              ({totalQtyReceived}/{totalQtyOrdered})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(order.totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print PO */}
                              <button
                                onClick={() => setOrderToPrint(order)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                                title="Imprimer le bon de commande"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Mark as Ordered */}
                              {order.status === 'TO_ORDER' && (
                                <button
                                  onClick={() => updateSupplierOrderStatus(order.id, 'ORDERED')}
                                  className="px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded font-semibold text-[11px]"
                                  title="Marquer comme transmise au fournisseur"
                                >
                                  Commander
                                </button>
                              )}

                              {/* Receive */}
                              {canReceive && (
                                <button
                                  onClick={() => setOrderToReceive(order)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1 shadow-2xs"
                                  title="Réceptionner les marchandises en magasin"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  Réceptionner
                                </button>
                              )}

                              {/* Cancel */}
                              {order.status !== 'RECEIVED' && order.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Annuler définitivement la commande ${order.orderNumber} ?`)) {
                                      cancelSupplierOrder(order.id);
                                    }
                                  }}
                                  className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="Annuler la commande"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUGGESTIONS DE RÉAPPROVISIONNEMENT AUTOMATIQUE */}
      {activeTab === 'SUGGESTIONS' && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                Détection automatique des ruptures et pièces sous seuil
              </h3>
              <p className="text-slate-600 mt-0.5">
                L'algorithme analyse vos seuils minimaux de réapprovisionnement et calcule la quantité optimale à commander pour chaque référence.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleGeneratePOFromSuggestions()}
                disabled={replenishmentSuggestions.length === 0}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Truck className="w-3.5 h-3.5" />
                Commander les pièces sélectionnées ({selectedReplenishArticleIds.length || replenishmentSuggestions.length})
              </button>
            </div>
          </div>

          {/* Suggestions Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              {replenishmentSuggestions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">Aucune rupture ni sous-seuil</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tous vos articles disposent d'un niveau de stock supérieur à leurs seuils d'alerte respectifs.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedReplenishArticleIds.length === replenishmentSuggestions.length &&
                            replenishmentSuggestions.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReplenishArticleIds(replenishmentSuggestions.map((s) => s.article.id));
                            } else {
                              setSelectedReplenishArticleIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600"
                        />
                      </th>
                      <th className="py-3 px-3">Réf. Constructeur</th>
                      <th className="py-3 px-3">Désignation & Catégorie</th>
                      <th className="py-3 px-3 text-center">Alerte</th>
                      <th className="py-3 px-3 text-right">Stock Actuel</th>
                      <th className="py-3 px-3 text-right">Seuil Min</th>
                      <th className="py-3 px-3 text-right font-bold text-amber-700">Qté Conseillée</th>
                      <th className="py-3 px-3">Fournisseur Suggéré</th>
                      <th className="py-3 px-3 text-right">Prix Achat</th>
                      <th className="py-3 px-3 text-right">Estimation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {replenishmentSuggestions.map((s) => {
                      const isSelected = selectedReplenishArticleIds.includes(s.article.id);
                      return (
                        <tr
                          key={s.article.id}
                          className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-amber-50/50' : ''}`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReplenishArticleIds((prev) => [...prev, s.article.id]);
                                } else {
                                  setSelectedReplenishArticleIds((prev) =>
                                    prev.filter((id) => id !== s.article.id)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-amber-600"
                            />
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {s.article.mainReference}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">{s.article.designation}</div>
                            <div className="text-[11px] text-slate-400">
                              {s.article.brand} · {s.article.category}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {s.status === 'RUPTURE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                <AlertOctagon className="w-3 h-3" />
                                Rupture (0)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                Sous seuil
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span className={s.currentStock === 0 ? 'text-rose-600' : 'text-amber-600'}>
                              {s.currentStock}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500">
                            {s.minThreshold}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            +{s.suggestedQty} <span className="text-[10px] font-normal text-slate-400">{s.article.unit}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-700 truncate max-w-[160px] block">
                              {s.preferredSupplier}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">
                            {formatFCFA(s.purchasePrice)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(s.estimatedTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        initialItems={prefilledItemsForPO}
        initialSupplierName={prefilledSupplierName}
        onClose={() => {
          setIsCreateModalOpen(false);
          setPrefilledItemsForPO([]);
          setPrefilledSupplierName(undefined);
        }}
        onSuccess={(msg) => setNotification(msg)}
      />

      <ReceiveOrderModal
        order={orderToReceive}
        onClose={() => setOrderToReceive(null)}
        onSuccess={(msg) => setNotification(msg)}
      />

      <PurchaseOrderPrintModal
        order={orderToPrint}
        onClose={() => setOrderToPrint(null)}
      />
    </div>
  );
};
