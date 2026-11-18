import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { ArticleCategory, InventoryScope } from '../../types';
import { formatDate, formatFCFA } from '../../utils/formatters';
import {
  getArticleBrandOffers,
  getBrandLocation,
  getBrandStockAcrossWarehouses,
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
} from 'lucide-react';
import { InventorySessionView } from './InventorySessionView';

interface InventoryListViewProps {
  onSuccess: (message: string) => void;
}

export const InventoryListView: React.FC<InventoryListViewProps> = ({ onSuccess }) => {
  const {
    inventories,
    warehouses,
    articles,
    stocks,
    selectedWarehouseId,
    getWarehouseById,
    createInventorySession,
    currentUser,
    currentPermissions,
  } = useStock();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedWarehouseForNew, setSelectedWarehouseForNew] = useState<string>(
    selectedWarehouseId || warehouses[0]?.id || ''
  );
  const [sessionNotes, setSessionNotes] = useState('');
  const [scope, setScope] = useState<InventoryScope>('FULL');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ArticleCategory[]>([]);
  const [onlyPositiveStock, setOnlyPositiveStock] = useState<boolean>(false);

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeSession = inventories.find((s) => s.id === activeSessionId);

  // Compute available locations, brands, and categories in the selected warehouse for targeted inventory creation
  const warehouseCatalogBreakdown = useMemo(() => {
    const wh = warehouses.find((w) => w.id === selectedWarehouseForNew);
    const locMap = new Map<string, number>();
    const brandMap = new Map<string, number>();
    const catMap = new Map<ArticleCategory, number>();
    let totalLinesCount = 0;

    if (!selectedWarehouseForNew) {
      return {
        locations: [] as Array<{ name: string; count: number }>,
        brands: [] as Array<{ name: string; count: number }>,
        categories: [] as Array<{ name: ArticleCategory; count: number }>,
        totalLinesCount: 0,
      };
    }

    for (const art of articles) {
      if (art.status === 'archived') continue;
      const whStock = stocks.find(
        (s) => s.articleId === art.id && s.warehouseId === selectedWarehouseForNew
      );
      const offers = getArticleBrandOffers(art);
      const distinctBrands = new Set<string>();

      offers.forEach((o) => {
        const b = (o.brand || art.brand || 'Origine').trim() || 'Origine';
        distinctBrands.add(b);
      });
      if (whStock?.brandBreakdown) {
        Object.keys(whStock.brandBreakdown).forEach((b) => {
          if (b.trim()) distinctBrands.add(b.trim());
        });
      }

      for (const bName of distinctBrands) {
        const theoQty = getBrandStockAcrossWarehouses(
          stocks,
          art,
          bName,
          selectedWarehouseForNew
        );
        if (onlyPositiveStock && theoQty <= 0) continue;

        const fullLoc = getBrandLocation(
          stocks,
          art,
          bName,
          selectedWarehouseForNew,
          warehouses
        );
        const pureLoc =
          stripWarehousePrefix(fullLoc, warehouses, wh?.name) || 'Non renseigné';

        totalLinesCount++;
        locMap.set(pureLoc, (locMap.get(pureLoc) || 0) + 1);
        brandMap.set(bName, (brandMap.get(bName) || 0) + 1);
        catMap.set(art.category, (catMap.get(art.category) || 0) + 1);
      }
    }

    const locations = Array.from(locMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === 'Non renseigné') return 1;
        if (b.name === 'Non renseigné') return -1;
        return a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
      });

    const brands = Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    const categories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { locations, brands, categories, totalLinesCount };
  }, [articles, stocks, warehouses, selectedWarehouseForNew, onlyPositiveStock]);

  const toggleItemInList = <T extends string>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    val: T
  ) => {
    setList((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const handleStartNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (scope === 'BY_LOCATION' && selectedLocations.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins un emplacement à inventorier.');
      return;
    }
    if (scope === 'BY_BRAND' && selectedBrands.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins une marque à inventorier.');
      return;
    }
    if (scope === 'BY_CATEGORY' && selectedCategories.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins une catégorie à inventorier.');
      return;
    }

    const result = createInventorySession(selectedWarehouseForNew, sessionNotes, {
      scope,
      targetLocations: scope === 'BY_LOCATION' ? selectedLocations : undefined,
      targetBrands: scope === 'BY_BRAND' ? selectedBrands : undefined,
      targetCategories: scope === 'BY_CATEGORY' ? selectedCategories : undefined,
      onlyPositiveStock,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de la création de la session.');
    } else if (result.session) {
      setIsCreatingNew(false);
      setSessionNotes('');
      setScope('FULL');
      setSelectedLocations([]);
      setSelectedBrands([]);
      setSelectedCategories([]);
      setOnlyPositiveStock(false);
      setActiveSessionId(result.session.id);
      onSuccess(
        `Session d'inventaire ${result.session.code} créée avec ${result.session.items.length} ligne(s) par marque.`
      );
    }
  };

  if (activeSession) {
    return (
      <InventorySessionView
        session={activeSession}
        onBack={() => setActiveSessionId(null)}
        onSuccess={onSuccess}
      />
    );
  }

  const canCreateSession =
    currentPermissions?.canManageInventory ?? currentUser.role !== 'MAGASINIER';

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-500" />
            Sessions d'Inventaire Physique (Par Marque & Emplacement)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Comptage précis dissocié par marque constructeur, filtrage par emplacement (rayon/étagère) et régularisation automatique des écarts.
          </p>
        </div>

        {canCreateSession && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setSelectedWarehouseForNew(selectedWarehouseId || warehouses[0]?.id || '');
              setIsCreatingNew(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ouvrir un nouvel inventaire</span>
          </button>
        )}
      </div>

      {/* New Session Creation Modal */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    Ouvrir une nouvelle session d'inventaire
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Chaque pièce est automatiquement séparée par marque avec son emplacement propre
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleStartNewSession}
              className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs"
            >
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    1. Magasin à inventorier *
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
                    className="w-full px-3 py-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Sélectionner un magasin --</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} — {wh.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Motif / Observation
                  </label>
                  <input
                    type="text"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Ex: Inventaire mensuel, Contrôle Rayon A, Audit..."
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 2. Choix du périmètre d'inventaire */}
              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  2. Périmètre du comptage
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('FULL')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'FULL'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Boxes
                      className={`w-4 h-4 mb-1 ${
                        scope === 'FULL' ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="font-bold text-xs">Complet</div>
                    <div
                      className={`text-[10px] ${
                        scope === 'FULL' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Tout le magasin ({warehouseCatalogBreakdown.totalLinesCount} lignes)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('BY_LOCATION')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'BY_LOCATION'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <MapPin
                      className={`w-4 h-4 mb-1 ${
                        scope === 'BY_LOCATION' ? 'text-amber-400' : 'text-amber-600'
                      }`}
                    />
                    <div className="font-bold text-xs">Par Emplacement</div>
                    <div
                      className={`text-[10px] ${
                        scope === 'BY_LOCATION' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Cibler 1 ou plusieurs rayons
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('BY_BRAND')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'BY_BRAND'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Tag
                      className={`w-4 h-4 mb-1 ${
                        scope === 'BY_BRAND' ? 'text-amber-400' : 'text-sky-600'
                      }`}
                    />
                    <div className="font-bold text-xs">Par Marque</div>
                    <div
                      className={`text-[10px] ${
                        scope === 'BY_BRAND' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Cibler certaines marques
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('BY_CATEGORY')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'BY_CATEGORY'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Layers
                      className={`w-4 h-4 mb-1 ${
                        scope === 'BY_CATEGORY' ? 'text-amber-400' : 'text-emerald-600'
                      }`}
                    />
                    <div className="font-bold text-xs">Par Catégorie</div>
                    <div
                      className={`text-[10px] ${
                        scope === 'BY_CATEGORY' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Filtration, Hydraulique...
                    </div>
                  </button>
                </div>
              </div>

              {/* Sélection des emplacements si scope === BY_LOCATION */}
              {scope === 'BY_LOCATION' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      Choisissez les emplacements à inventorier ({selectedLocations.length} sélectionné(s)) :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLocations(
                            warehouseCatalogBreakdown.locations.map((l) => l.name)
                          )
                        }
                        className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                      >
                        Tout cocher
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLocations([])}
                        className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {warehouseCatalogBreakdown.locations.map((loc) => {
                      const checked = selectedLocations.includes(loc.name);
                      return (
                        <label
                          key={loc.name}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-amber-50 border-amber-400 text-slate-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleItemInList(
                                  selectedLocations,
                                  setSelectedLocations,
                                  loc.name
                                )
                              }
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span className="font-mono text-xs truncate">{loc.name}</span>
                          </div>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {loc.count} réf.
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sélection des marques si scope === BY_BRAND */}
              {scope === 'BY_BRAND' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-sky-600" />
                      Choisissez les marques à inventorier ({selectedBrands.length} sélectionnée(s)) :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBrands(
                            warehouseCatalogBreakdown.brands.map((b) => b.name)
                          )
                        }
                        className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                      >
                        Tout cocher
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBrands([])}
                        className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                    {warehouseCatalogBreakdown.brands.map((b) => {
                      const checked = selectedBrands.includes(b.name);
                      return (
                        <label
                          key={b.name}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-sky-50 border-sky-400 text-slate-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleItemInList(selectedBrands, setSelectedBrands, b.name)
                              }
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span className="truncate">{b.name}</span>
                          </div>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {b.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sélection des catégories si scope === BY_CATEGORY */}
              {scope === 'BY_CATEGORY' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Choisissez les catégories à inventorier ({selectedCategories.length}) :
                    </span>
                  </div>

                  <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {warehouseCatalogBreakdown.categories.map((cat) => {
                      const checked = selectedCategories.includes(cat.name);
                      return (
                        <label
                          key={cat.name}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-50 border-emerald-400 text-slate-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleItemInList(
                                  selectedCategories,
                                  setSelectedCategories,
                                  cat.name
                                )
                              }
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span className="truncate">{cat.name}</span>
                          </div>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {cat.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Option filtre stock > 0 */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPositiveStock}
                  onChange={(e) => setOnlyPositiveStock(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Inclure uniquement les pièces ayant un stock théorique &gt; 0
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Décochez cette option si vous souhaitez également vérifier les pièces théoriquement en rupture (stock = 0).
                  </span>
                </div>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Démarrer la session de comptage</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Historique des sessions d'inventaire ({inventories.length})
          </h3>
        </div>

        {inventories.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ClipboardCheck className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Aucune session d'inventaire enregistrée
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cliquez sur « Ouvrir un nouvel inventaire » pour lancer un comptage complet ou ciblé par emplacement / marque.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {inventories.map((session) => {
              const wh = getWarehouseById(session.warehouseId);
              const isValidated = session.status === 'VALIDATED';
              const isCounting = session.status === 'COUNTING';

              const countedCount = session.items.filter((i) => i.countedQty !== null).length;
              const totalCount = session.items.length;
              const pct = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 100;
              const varianceCount = session.items.filter(
                (i) => i.countedQty !== null && i.variance !== 0
              ).length;
              const totalVarValue = session.items.reduce(
                (sum, i) => sum + (i.varianceValue || 0),
                0
              );

              return (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-amber-50/30 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded">
                        {session.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isValidated
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCounting
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isValidated
                          ? 'Validé & Verrouillé'
                          : isCounting
                          ? 'Comptage en cours'
                          : 'Annulé'}
                      </span>
                      {session.scopeSummary && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {session.scopeSummary}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-0.5">
                      {wh?.name} ({wh?.code})
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(session.date)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Superviseur : {session.supervisor}
                      </span>
                      {session.notes && (
                        <>
                          <span>·</span>
                          <span className="italic text-slate-600">{session.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs min-w-[160px]">
                      <div className="flex items-center justify-end gap-2 font-medium text-slate-700">
                        <span>Compté :</span>
                        <span className="font-mono font-bold text-slate-900">
                          {countedCount} / {totalCount}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">({pct}%)</span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full transition-all ${
                            isValidated ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {varianceCount > 0 ? (
                        <div className="text-[11px] text-amber-700 font-bold mt-1">
                          {varianceCount} écart(s) ·{' '}
                          <span
                            className={
                              totalVarValue < 0 ? 'text-rose-600' : 'text-emerald-700'
                            }
                          >
                            {totalVarValue > 0 ? '+' : ''}
                            {formatFCFA(totalVarValue)}
                          </span>
                        </div>
                      ) : (
                        countedCount > 0 && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                            Aucun écart détecté
                          </div>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                      className="p-2.5 bg-slate-100 hover:bg-amber-500 text-slate-800 hover:text-slate-950 rounded-xl transition-colors cursor-pointer"
                      title="Ouvrir la session d'inventaire"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
