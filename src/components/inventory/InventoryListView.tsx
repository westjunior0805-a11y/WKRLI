import React, { useState, useMemo, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { ArticleCategory, InventoryScope } from '../../types';
import { formatDate, formatFCFA } from '../../utils/formatters';
import {
  cleanBrandName,
  getArticleBrandOffers,
  getBrandLocation,
  stripWarehousePrefix,
} from '../../utils/articleHelpers';
import {
  ClipboardCheck,
  Plus,
  Calendar,
  User,
  ArrowRight,
  MapPin,
  Tag,
  Layers,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Ban,
  Clock,
} from 'lucide-react';
import { InventorySessionView } from './InventorySessionView';
import { SearchField } from '../common/SearchField';
import { ConfirmModal } from '../common/ConfirmModal';

interface InventoryListViewProps {
  onSuccess: (message: string) => void;
}

type StatusFilter = 'ALL' | 'COUNTING' | 'VALIDATED' | 'CANCELLED';

export const InventoryListView: React.FC<InventoryListViewProps> = ({ onSuccess }) => {
  const {
    inventories,
    warehouses,
    articles,
    stocks,
    selectedWarehouseId,
    getWarehouseById,
    createInventorySession,
    deleteInventorySession,
    currentPermissions,
  } = useStock();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de création simplifié
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedWarehouseForNew, setSelectedWarehouseForNew] = useState<string>(
    selectedWarehouseId || warehouses[0]?.id || ''
  );
  const [newNotes, setNewNotes] = useState('');
  const [onlyPositiveStock, setOnlyPositiveStock] = useState(true);
  const [showAdvancedScope, setShowAdvancedScope] = useState(false);
  const [inventoryScope, setInventoryScope] = useState<InventoryScope>('FULL');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ArticleCategory[]>([]);
  const [scopeSearch, setScopeSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmation suppression session annulée/brouillon
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; code: string } | null>(null);

  // Synchroniser le magasin par défaut dès que la liste des magasins est chargée
  useEffect(() => {
    if (!selectedWarehouseForNew && warehouses.length > 0) {
      setSelectedWarehouseForNew(selectedWarehouseId || warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId, selectedWarehouseForNew]);

  const activeSession = inventories.find((s) => s.id === activeSessionId);

  const openNewModal = () => {
    setSelectedWarehouseForNew(selectedWarehouseId || warehouses[0]?.id || '');
    setNewNotes('');
    setOnlyPositiveStock(true);
    setShowAdvancedScope(false);
    setInventoryScope('FULL');
    setSelectedLocations([]);
    setSelectedBrands([]);
    setSelectedCategories([]);
    setScopeSearch('');
    setErrorMsg(null);
    setShowNewModal(true);
  };

  // Extraction cohérente des lignes prévues (alignée sur StockContext.buildBrandInventoryItemsForWarehouse)
  const previewRowsForWarehouse = useMemo(() => {
    if (!selectedWarehouseForNew) return [];
    const targetWh = warehouses.find((w) => w.id === selectedWarehouseForNew);
    const activeArticles = articles.filter((a) => a.status === 'active');
    const rows: Array<{
      articleId: string;
      brand: string;
      location: string;
      category: ArticleCategory;
      qty: number;
    }> = [];

    for (const art of activeArticles) {
      const stockRecord = stocks.find(
        (s) => s.articleId === art.id && s.warehouseId === selectedWarehouseForNew
      );
      const offers = getArticleBrandOffers(art);
      const brandMap = new Map<string, { brand: string; qty: number; location: string }>();

      const normLoc = (rawLoc?: string) => {
        const cleaned = stripWarehousePrefix(rawLoc, warehouses, targetWh?.name);
        return cleaned || 'Non renseigné';
      };

      const upsertRow = (rawBrand: string, qty: number, loc?: string) => {
        const cleaned = cleanBrandName(rawBrand);
        const key = cleaned.toLowerCase();
        const existing = brandMap.get(key);
        const resolvedLoc = normLoc(loc || stockRecord?.shelfLocation || art.defaultLocation);
        if (existing) {
          existing.qty = Math.max(existing.qty, qty);
          if (existing.location === 'Non renseigné' && resolvedLoc !== 'Non renseigné') {
            existing.location = resolvedLoc;
          }
        } else {
          brandMap.set(key, { brand: cleaned, qty, location: resolvedLoc });
        }
      };

      // 1. Offres catalogue
      for (const offer of offers) {
        const offerBrand = cleanBrandName(offer.brand);
        let qty = 0;
        if (stockRecord?.brandBreakdown) {
          const bkKey = Object.keys(stockRecord.brandBreakdown).find(
            (k) => cleanBrandName(k).toLowerCase() === offerBrand.toLowerCase()
          );
          if (bkKey !== undefined) {
            qty = Math.max(0, Number(stockRecord.brandBreakdown[bkKey]) || 0);
          }
        }
        const loc =
          getBrandLocation(stocks, art, offerBrand, selectedWarehouseForNew, warehouses) ||
          offer.location ||
          stockRecord?.shelfLocation ||
          art.defaultLocation;
        upsertRow(offerBrand, qty, loc);
      }

      // 2. Marques présentes dans brandBreakdown
      if (stockRecord?.brandBreakdown) {
        for (const [rawBrand, rawQty] of Object.entries(stockRecord.brandBreakdown)) {
          const bName = cleanBrandName(rawBrand);
          const qty = Math.max(0, Number(rawQty) || 0);
          const loc =
            getBrandLocation(stocks, art, bName, selectedWarehouseForNew, warehouses) ||
            stockRecord.shelfLocation ||
            art.defaultLocation;
          upsertRow(bName, qty, loc);
        }
      }

      // 3. Marques présentes dans brandLocations
      if (stockRecord?.brandLocations) {
        for (const [rawBrand, rawLoc] of Object.entries(stockRecord.brandLocations)) {
          const bName = cleanBrandName(rawBrand);
          if (!bName) continue;
          upsertRow(bName, 0, rawLoc);
        }
      }

      // Supprimer l'entrée fantôme "" si au moins une vraie marque existe
      if (brandMap.size > 1 && brandMap.has('')) {
        brandMap.delete('');
      }

      // Fallback si aucune offre ni breakdown
      if (brandMap.size === 0) {
        const fallbackBrand = cleanBrandName(art.brand);
        const fallbackQty = Math.max(0, Number(stockRecord?.quantity) || 0);
        const fallbackLoc = normLoc(stockRecord?.shelfLocation || art.defaultLocation);
        brandMap.set(fallbackBrand.toLowerCase(), {
          brand: fallbackBrand,
          qty: fallbackQty,
          location: fallbackLoc,
        });
      } else if (
        brandMap.size === 1 &&
        stockRecord &&
        stockRecord.quantity > 0 &&
        (!stockRecord.brandBreakdown || Object.keys(stockRecord.brandBreakdown).length === 0)
      ) {
        const single = Array.from(brandMap.values())[0];
        if (single.qty === 0) single.qty = stockRecord.quantity;
      }

      for (const entry of brandMap.values()) {
        rows.push({
          articleId: art.id,
          brand: entry.brand,
          location: entry.location,
          category: art.category,
          qty: entry.qty,
        });
      }
    }

    return rows;
  }, [articles, stocks, warehouses, selectedWarehouseForNew]);

  // Options disponibles pour le ciblage avancé
  const availableLocations = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of previewRowsForWarehouse) {
      if (onlyPositiveStock && r.qty <= 0) continue;
      map.set(r.location, (map.get(r.location) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  }, [previewRowsForWarehouse, onlyPositiveStock]);

  const availableBrands = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of previewRowsForWarehouse) {
      if (onlyPositiveStock && r.qty <= 0) continue;
      const label = r.brand || 'Sans marque';
      map.set(label, (map.get(label) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [previewRowsForWarehouse, onlyPositiveStock]);

  const availableCategories = useMemo(() => {
    const map = new Map<ArticleCategory, number>();
    for (const r of previewRowsForWarehouse) {
      if (onlyPositiveStock && r.qty <= 0) continue;
      map.set(r.category, (map.get(r.category) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [previewRowsForWarehouse, onlyPositiveStock]);

  // Nombre exact de lignes que la session va contenir
  const previewCount = useMemo(() => {
    const effectiveScope: InventoryScope = showAdvancedScope ? inventoryScope : 'FULL';
    return previewRowsForWarehouse.filter((r) => {
      if (onlyPositiveStock && r.qty <= 0) return false;
      if (effectiveScope === 'BY_LOCATION' && selectedLocations.length > 0) {
        return selectedLocations.some((l) => l.toLowerCase() === r.location.toLowerCase());
      }
      if (effectiveScope === 'BY_BRAND' && selectedBrands.length > 0) {
        const label = r.brand || 'Sans marque';
        return selectedBrands.some(
          (b) => b.toLowerCase() === r.brand.toLowerCase() || b.toLowerCase() === label.toLowerCase()
        );
      }
      if (effectiveScope === 'BY_CATEGORY' && selectedCategories.length > 0) {
        return selectedCategories.includes(r.category);
      }
      return true;
    }).length;
  }, [
    previewRowsForWarehouse,
    onlyPositiveStock,
    showAdvancedScope,
    inventoryScope,
    selectedLocations,
    selectedBrands,
    selectedCategories,
  ]);

  const activeCountingSessions = useMemo(
    () => inventories.filter((s) => s.status === 'COUNTING'),
    [inventories]
  );

  const filteredInventories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventories.filter((inv) => {
      if (selectedWarehouseId && inv.warehouseId !== selectedWarehouseId) return false;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (q) {
        const whName = getWarehouseById(inv.warehouseId)?.name.toLowerCase() || '';
        const matchCode = inv.code.toLowerCase().includes(q);
        const matchWh = whName.includes(q);
        const matchNotes = (inv.notes || '').toLowerCase().includes(q);
        const matchSup = (inv.supervisor || '').toLowerCase().includes(q);
        if (!matchCode && !matchWh && !matchNotes && !matchSup) return false;
      }
      return true;
    });
  }, [inventories, selectedWarehouseId, statusFilter, searchQuery, getWarehouseById]);

  const countsByStatus = useMemo(() => {
    const scoped = selectedWarehouseId
      ? inventories.filter((s) => s.warehouseId === selectedWarehouseId)
      : inventories;
    return {
      ALL: scoped.length,
      COUNTING: scoped.filter((s) => s.status === 'COUNTING').length,
      VALIDATED: scoped.filter((s) => s.status === 'VALIDATED').length,
      CANCELLED: scoped.filter((s) => s.status === 'CANCELLED').length,
    };
  }, [inventories, selectedWarehouseId]);

  const toggleItem = <T extends string>(list: T[], val: T, setter: (v: T[]) => void) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedWarehouseForNew) {
      setErrorMsg('Veuillez sélectionner un magasin.');
      return;
    }

    const effectiveScope: InventoryScope = showAdvancedScope ? inventoryScope : 'FULL';

    if (effectiveScope === 'BY_LOCATION' && selectedLocations.length === 0) {
      setErrorMsg('Sélectionnez au moins un emplacement ou passez en inventaire complet.');
      return;
    }
    if (effectiveScope === 'BY_BRAND' && selectedBrands.length === 0) {
      setErrorMsg('Sélectionnez au moins une marque ou passez en inventaire complet.');
      return;
    }
    if (effectiveScope === 'BY_CATEGORY' && selectedCategories.length === 0) {
      setErrorMsg('Sélectionnez au moins une catégorie ou passez en inventaire complet.');
      return;
    }

    const res = createInventorySession(selectedWarehouseForNew, newNotes.trim() || undefined, {
      scope: effectiveScope,
      targetLocations: effectiveScope === 'BY_LOCATION' ? selectedLocations : undefined,
      targetBrands: effectiveScope === 'BY_BRAND' ? selectedBrands : undefined,
      targetCategories: effectiveScope === 'BY_CATEGORY' ? selectedCategories : undefined,
      onlyPositiveStock,
    });

    if (res.success && res.session) {
      setShowNewModal(false);
      onSuccess(`Inventaire ${res.session.code} démarré (${res.session.items.length} lignes).`);
      setActiveSessionId(res.session.id);
    } else {
      setErrorMsg(res.error || 'Impossible de créer cette session d’inventaire.');
    }
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    const res = deleteInventorySession(sessionToDelete.id);
    if (res.success) {
      onSuccess(`Session ${sessionToDelete.code} supprimée.`);
    }
    setSessionToDelete(null);
  };

  // Si une session est ouverte, basculer sur la vue de comptage
  if (activeSession) {
    return (
      <InventorySessionView
        session={activeSession}
        onBack={() => setActiveSessionId(null)}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
            Inventaire Physique
          </h2>
          <p className="text-xs sm:text-sm text-[#595959] dark:text-slate-400 mt-0.5">
            Comptez vos rayons, vérifiez les écarts et ajustez le stock en un clic.
          </p>
        </div>

        {currentPermissions.canManageInventory && (
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] font-bold text-sm border border-[#111111] transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvel inventaire
          </button>
        )}
      </div>

      {/* Bannière reprise rapide si une session est en cours */}
      {activeCountingSessions.length > 0 && (
        <div className="space-y-2.5">
          {activeCountingSessions.map((sess) => {
            const wh = getWarehouseById(sess.warehouseId);
            const total = sess.items.length;
            const counted = sess.items.filter((i) => i.countedQty !== null).length;
            const pct = total > 0 ? Math.round((counted / total) * 100) : 0;

            return (
              <div
                key={sess.id}
                className="bg-[#FFF9DF] dark:bg-[#FFCD11]/10 border-l-4 border-l-[#FFCD11] border border-[#E0E0E0] dark:border-[#333333] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-[#FFCD11] text-[#111111]">
                      <Clock className="w-3 h-3" />
                      Comptage en cours
                    </span>
                    <span className="font-mono text-xs font-bold text-[#111111] dark:text-white">
                      {sess.code}
                    </span>
                    <span className="text-xs font-semibold text-[#595959] dark:text-slate-300">
                      • {wh?.name || 'Magasin'}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3 max-w-md">
                    <div className="flex-1 h-2 bg-white dark:bg-[#262626] border border-[#E0E0E0] dark:border-[#444444] overflow-hidden">
                      <div
                        className="h-full bg-[#111111] dark:bg-[#FFCD11] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#111111] dark:text-white whitespace-nowrap">
                      {counted} / {total} ({pct}%)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSessionId(sess.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111111] hover:bg-[#2B2B2B] text-white dark:bg-[#FFCD11] dark:text-[#111111] dark:hover:bg-[#E5B700] text-sm font-bold transition-colors cursor-pointer shrink-0"
                >
                  Reprendre le comptage
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Barre filtres + recherche */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="w-full md:max-w-sm">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Code, magasin, observation..."
              ariaLabel="Rechercher une session d'inventaire"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Toutes', count: countsByStatus.ALL },
                { id: 'COUNTING', label: 'En cours', count: countsByStatus.COUNTING },
                { id: 'VALIDATED', label: 'Validées', count: countsByStatus.VALIDATED },
                { id: 'CANCELLED', label: 'Annulées', count: countsByStatus.CANCELLED },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#FFCD11] dark:text-[#111111] dark:border-[#FFCD11]'
                      : 'bg-white dark:bg-[#262626] text-[#595959] dark:text-slate-300 border-[#E0E0E0] dark:border-[#333333] hover:border-[#111111] dark:hover:border-slate-500'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 font-mono opacity-75">{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Liste des sessions */}
      {filteredInventories.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-10 text-center">
          <ClipboardCheck className="w-10 h-10 text-[#999999] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#111111] dark:text-white">
            Aucune session d’inventaire trouvée
          </p>
          <p className="text-xs text-[#595959] dark:text-slate-400 mt-1">
            {inventories.length === 0
              ? 'Lancez votre premier inventaire physique pour vérifier vos stocks.'
              : 'Modifiez les filtres ou la recherche pour afficher d’autres sessions.'}
          </p>
          {currentPermissions.canManageInventory && inventories.length === 0 && (
            <button
              type="button"
              onClick={openNewModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] font-bold text-xs border border-[#111111] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Démarrer un inventaire
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInventories.map((session) => {
            const wh = getWarehouseById(session.warehouseId);
            const totalItems = session.items.length;
            const countedItems = session.items.filter((i) => i.countedQty !== null).length;
            const progressPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
            const variances = session.items.filter(
              (i) => i.countedQty !== null && i.countedQty !== i.theoreticalQty
            );
            const totalVarianceValue = variances.reduce(
              (sum, i) => sum + (i.countedQty! - i.theoreticalQty) * i.unitCost,
              0
            );

            const isValidated = session.status === 'VALIDATED';
            const isCancelled = session.status === 'CANCELLED';
            const canDelete =
              currentPermissions.canManageInventory &&
              (session.status === 'CANCELLED' || session.status === 'DRAFT');

            return (
              <div
                key={session.id}
                className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] hover:border-[#111111] dark:hover:border-[#FFCD11] transition-colors p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Infos principales */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#111111] dark:text-white">
                        {session.code}
                      </span>

                      {isValidated ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Validé
                        </span>
                      ) : isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-[#F0F0F0] text-[#595959] dark:bg-[#2B2B2B] dark:text-slate-400 border border-[#D4D4D4] dark:border-[#404040]">
                          <Ban className="w-3 h-3" />
                          Annulé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-[#FFF9DF] text-[#7A5C00] dark:bg-[#FFCD11]/20 dark:text-[#FFCD11] border border-[#FFCD11]">
                          <Clock className="w-3 h-3" />
                          En cours
                        </span>
                      )}

                      {session.scope && session.scope !== 'FULL' && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#F4F4F4] dark:bg-[#262626] text-[#595959] dark:text-slate-300 border border-[#E0E0E0] dark:border-[#333333]">
                          {session.scopeSummary || 'Partiel'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#595959] dark:text-slate-400">
                      <span className="font-semibold text-[#111111] dark:text-slate-200 inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#7A5C00] dark:text-[#FFCD11]" />
                        {wh?.name || 'Magasin inconnu'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(session.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {session.supervisor}
                      </span>
                    </div>

                    {session.notes && (
                      <p className="text-xs text-[#595959] dark:text-slate-400 italic truncate">
                        « {session.notes} »
                      </p>
                    )}
                  </div>

                  {/* Progression & Écarts */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E0E0E0] dark:border-[#333333]">
                    <div className="min-w-[130px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#595959] dark:text-slate-400">Comptage</span>
                        <span className="font-mono font-bold text-[#111111] dark:text-white">
                          {countedItems}/{totalItems}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#F0F0F0] dark:bg-[#2B2B2B] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isValidated
                              ? 'bg-emerald-600'
                              : isCancelled
                              ? 'bg-slate-400'
                              : 'bg-[#FFCD11]'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="min-w-[120px] text-left sm:text-right">
                      <div className="text-[11px] text-[#595959] dark:text-slate-400">Écarts</div>
                      {variances.length === 0 ? (
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {countedItems === 0 ? 'Aucun comptage' : 'Aucun écart'}
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs font-bold text-[#7A5C00] dark:text-[#FFCD11]">
                            {variances.length} ligne{variances.length > 1 ? 's' : ''}
                          </div>
                          {currentPermissions.canViewPurchasePrices && (
                            <div
                              className={`text-[11px] font-mono font-semibold ${
                                totalVarianceValue < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : totalVarianceValue > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-[#595959]'
                              }`}
                            >
                              {totalVarianceValue > 0 ? '+' : ''}
                              {formatFCFA(totalVarianceValue)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setSessionToDelete({ id: session.id, code: session.code })}
                          className="p-2 text-[#595959] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-[#E0E0E0] dark:border-[#333333] transition-colors cursor-pointer"
                          title="Supprimer cette session annulée"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          session.status === 'COUNTING'
                            ? 'bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border-[#111111]'
                            : 'bg-white dark:bg-[#262626] hover:bg-[#F4F4F4] dark:hover:bg-[#333333] text-[#111111] dark:text-white border-[#CCCCCC] dark:border-[#444444]'
                        }`}
                      >
                        {session.status === 'COUNTING' ? 'Continuer' : 'Consulter'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal simplifié : Nouvel inventaire */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#111111] dark:border-[#444444] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header modal */}
            <div className="px-5 py-4 bg-[#111111] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 bg-[#FFCD11]" />
                <h3 className="text-base font-bold">Nouvel inventaire physique</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="flex-1 overflow-y-auto p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Magasin */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#595959] dark:text-slate-300 mb-1.5">
                  Magasin / Dépôt à inventorier *
                </label>
                <select
                  value={selectedWarehouseForNew}
                  onChange={(e) => {
                    setSelectedWarehouseForNew(e.target.value);
                    setSelectedLocations([]);
                    setSelectedBrands([]);
                    setSelectedCategories([]);
                  }}
                  required
                  className="w-full px-3 py-2.5 text-sm font-semibold bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFCD11]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Libellé optionnel */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#595959] dark:text-slate-300 mb-1.5">
                  Libellé / Observation (optionnel)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Inventaire mensuel, contrôle filtres..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFCD11]"
                />
              </div>

              {/* 3. Option simple : Uniquement en stock */}
              <label className="flex items-start gap-2.5 p-3 bg-[#F8F8F8] dark:bg-[#262626] border border-[#E0E0E0] dark:border-[#333333] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPositiveStock}
                  onChange={(e) => setOnlyPositiveStock(e.target.checked)}
                  className="mt-0.5 accent-[#111111]"
                />
                <span className="text-xs text-[#111111] dark:text-slate-200 leading-relaxed">
                  <strong>Uniquement les pièces en stock (&gt; 0)</strong>
                  <span className="block text-[#595959] dark:text-slate-400">
                    Décochez pour inclure aussi les articles à quantité théorique 0.
                  </span>
                </span>
              </label>

              {/* 4. Ciblage avancé (plié par défaut) */}
              <div className="border border-[#E0E0E0] dark:border-[#333333]">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showAdvancedScope;
                    setShowAdvancedScope(next);
                    if (!next) {
                      setInventoryScope('FULL');
                    } else if (inventoryScope === 'FULL') {
                      setInventoryScope('BY_LOCATION');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-[#111111] dark:text-slate-200 bg-[#F4F4F4] dark:bg-[#262626] hover:bg-[#EAEAEA] dark:hover:bg-[#303030] transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#7A5C00] dark:text-[#FFCD11]" />
                    Cibler par emplacement, marque ou catégorie (optionnel)
                  </span>
                  {showAdvancedScope ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showAdvancedScope && (
                  <div className="p-3.5 space-y-3 bg-white dark:bg-[#1E1E1E]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'FULL', label: 'Complet', icon: Boxes },
                          { id: 'BY_LOCATION', label: 'Rayon', icon: MapPin },
                          { id: 'BY_BRAND', label: 'Marque', icon: Tag },
                          { id: 'BY_CATEGORY', label: 'Catégorie', icon: Layers },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = inventoryScope === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setInventoryScope(opt.id);
                              setScopeSearch('');
                            }}
                            className={`px-2 py-2 text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#FFF9DF] dark:bg-[#FFCD11]/20 border-[#111111] dark:border-[#FFCD11] text-[#111111] dark:text-[#FFCD11]'
                                : 'bg-white dark:bg-[#262626] border-[#E0E0E0] dark:border-[#333333] text-[#595959] dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {inventoryScope !== 'FULL' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={scopeSearch}
                          onChange={(e) => setScopeSearch(e.target.value)}
                          placeholder="Filtrer la liste..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#262626] border border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white focus:outline-none focus:border-[#111111]"
                        />

                        <div className="max-h-40 overflow-y-auto border border-[#E0E0E0] dark:border-[#333333] divide-y divide-[#EFEFEF] dark:divide-[#2C2C2C]">
                          {inventoryScope === 'BY_LOCATION' &&
                            availableLocations
                              .filter((l) =>
                                l.name.toLowerCase().includes(scopeSearch.trim().toLowerCase())
                              )
                              .map((loc) => (
                                <label
                                  key={loc.name}
                                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#F8F8F8] dark:hover:bg-[#262626] cursor-pointer"
                                >
                                  <span className="flex items-center gap-2 text-[#111111] dark:text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={selectedLocations.includes(loc.name)}
                                      onChange={() =>
                                        toggleItem(selectedLocations, loc.name, setSelectedLocations)
                                      }
                                      className="accent-[#111111]"
                                    />
                                    <span className="font-medium">{loc.name}</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-[#595959] dark:text-slate-400">
                                    {loc.count}
                                  </span>
                                </label>
                              ))}

                          {inventoryScope === 'BY_BRAND' &&
                            availableBrands
                              .filter((b) =>
                                b.name.toLowerCase().includes(scopeSearch.trim().toLowerCase())
                              )
                              .map((brand) => (
                                <label
                                  key={brand.name}
                                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#F8F8F8] dark:hover:bg-[#262626] cursor-pointer"
                                >
                                  <span className="flex items-center gap-2 text-[#111111] dark:text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={selectedBrands.includes(brand.name)}
                                      onChange={() =>
                                        toggleItem(selectedBrands, brand.name, setSelectedBrands)
                                      }
                                      className="accent-[#111111]"
                                    />
                                    <span className="font-medium">{brand.name}</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-[#595959] dark:text-slate-400">
                                    {brand.count}
                                  </span>
                                </label>
                              ))}

                          {inventoryScope === 'BY_CATEGORY' &&
                            availableCategories
                              .filter((c) =>
                                c.name.toLowerCase().includes(scopeSearch.trim().toLowerCase())
                              )
                              .map((cat) => (
                                <label
                                  key={cat.name}
                                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#F8F8F8] dark:hover:bg-[#262626] cursor-pointer"
                                >
                                  <span className="flex items-center gap-2 text-[#111111] dark:text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={selectedCategories.includes(cat.name)}
                                      onChange={() =>
                                        toggleItem(
                                          selectedCategories,
                                          cat.name,
                                          setSelectedCategories
                                        )
                                      }
                                      className="accent-[#111111]"
                                    />
                                    <span className="font-medium">{cat.name}</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-[#595959] dark:text-slate-400">
                                    {cat.count}
                                  </span>
                                </label>
                              ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pied du modal */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 border-t border-[#E0E0E0] dark:border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#595959] dark:text-slate-300 bg-white dark:bg-[#262626] border border-[#CCCCCC] dark:border-[#444444] hover:bg-[#F4F4F4] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={previewCount === 0}
                  className="px-5 py-2 text-xs font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Démarrer ({previewCount} ligne{previewCount > 1 ? 's' : ''})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression d'une session annulée */}
      <ConfirmModal
        isOpen={Boolean(sessionToDelete)}
        title="Supprimer cette session ?"
        message={`Voulez-vous supprimer définitivement la session ${sessionToDelete?.code || ''} de l’historique ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  );
};
