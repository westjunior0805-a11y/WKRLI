import React, { useState, useMemo, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { InventorySession, InventoryItemCount, ArticleCategory } from '../../types';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Download,
  ShieldCheck,
  Plus,
  Minus,
  Edit2,
  Check,
  X,
  MapPin,
  PackagePlus,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Layers,
  Eye,
  EyeOff,
  Printer,
  Filter,
  RotateCcw,
  Sparkles,
  FolderKanban,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';
import { getBrandLocation, stripWarehousePrefix } from '../../utils/articleHelpers';
import { NumericInput } from '../common/NumericInput';

interface InventorySessionViewProps {
  session: InventorySession;
  onBack: () => void;
  onSuccess: (message: string) => void;
}

type SortField =
  | 'LOCATION'
  | 'REFERENCE'
  | 'BRAND'
  | 'DESIGNATION'
  | 'CATEGORY'
  | 'THEORETICAL'
  | 'COUNTED'
  | 'VARIANCE_QTY'
  | 'VARIANCE_VAL';

type SortDirection = 'ASC' | 'DESC';

type GroupByMode = 'NONE' | 'LOCATION' | 'BRAND' | 'CATEGORY';

type CountStatusFilter =
  | 'ALL'
  | 'UNCOUNTED'
  | 'COUNTED'
  | 'VARIANCE_ANY'
  | 'VARIANCE_NEGATIVE'
  | 'VARIANCE_POSITIVE'
  | 'CONFORM';

const CATEGORIES: ArticleCategory[] = [
  'Filtration',
  'Moteur & Refroidissement',
  'Système Injection & Carburant',
  'Train de Roulement & Chenilles',
  'Hydraulique & Vérins',
  'Freinage & Friction',
  'Électricité & Démarreurs',
  'Transmission & Ponts',
  'Outils d’Attaque au Sol (Dents/Lames)',
];

const DEFAULT_BRANDS = [
  'Caterpillar',
  'Komatsu',
  'CTP',
  'Donaldson',
  'Perkins',
  'Baldwin',
  'Fleetguard',
  'Bosch',
  'Cummins',
  'Volvo',
  'ITR',
  'JCB',
];

const QUICK_VARIANCE_REASONS = [
  'Erreur de marque vendue au comptoir',
  'Pièce retrouvée en rayon',
  'Oubli de saisie entrée / sortie',
  'Casse / Détérioration constatée',
  'Décalage inventaire précédent',
];

interface EnrichedInventoryRow {
  item: InventoryItemCount;
  lineKey: string;
  articleId: string;
  mainReference: string;
  brandReference: string;
  designation: string;
  brand: string;
  category: string;
  unit: string;
  pureLocation: string;
  fullLocation: string;
  theoreticalQty: number;
  countedQty: number | null;
  variance: number;
  unitCost: number;
  varianceValue: number;
  notes: string;
}

export const InventorySessionView: React.FC<InventorySessionViewProps> = ({
  session,
  onBack,
  onSuccess,
}) => {
  const {
    stocks,
    warehouses,
    articles,
    companyInfo,
    getWarehouseById,
    getArticleById,
    updateInventoryCount,
    batchUpdateInventoryCounts,
    syncInventorySessionBrands,
    validateInventorySession,
    cancelInventorySession,
    updateStockLocationInWarehouse,
    addArticleToInventorySession,
  } = useStock();

  // Search, Filters, Sorting & Grouping states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('ALL');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [showLocationExplorer, setShowLocationExplorer] = useState<boolean>(true);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [countStatusFilter, setCountStatusFilter] = useState<CountStatusFilter>('ALL');
  const [stockLevelFilter, setStockLevelFilter] = useState<'ALL' | 'POSITIVE' | 'ZERO'>('ALL');

  // Default sort by LOCATION ascending so the storekeeper walks the shelves in order
  const [sortField, setSortField] = useState<SortField>('LOCATION');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC');
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('NONE');
  const [blindCountMode, setBlindCountMode] = useState<boolean>(false);

  // Modals & Banners
  const [isConfirmValidateOpen, setIsConfirmValidateOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'BLIND_SHEET' | 'CONTROL_SHEET' | 'OFFICIAL_PV'>(
    'BLIND_SHEET'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Inline location editing state (keyed by lineKey = articleId::brand)
  const [editingLocationLineKey, setEditingLocationLineKey] = useState<string | null>(null);
  const [locationInputVal, setLocationInputVal] = useState<string>('');

  // Inline unit cost editing state (keyed by lineKey)
  const [editingCostLineKey, setEditingCostLineKey] = useState<string | null>(null);
  const [costInputVal, setCostInputVal] = useState<number>(0);

  // Add new product / brand variant modal state
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddingBrandForExistingRef, setIsAddingBrandForExistingRef] = useState(false);
  const [newRef, setNewRef] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newBrand, setNewBrand] = useState('Caterpillar');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [newCategory, setNewCategory] = useState<ArticleCategory>('Filtration');
  const [newCountedQty, setNewCountedQty] = useState<number>(1);
  const [newLocation, setNewLocation] = useState('');
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(15000);
  const [newSalePrice, setNewSalePrice] = useState<number>(25000);
  const [newMinThreshold, setNewMinThreshold] = useState<number>(3);
  const [newUnit, setNewUnit] = useState('Unité');
  const [addProductError, setAddProductError] = useState('');

  const warehouse = getWarehouseById(session.warehouseId);
  const isValidated = session.status === 'VALIDATED';

  // Auto-synchronize legacy sessions that had items without `brand` when opened in COUNTING mode
  useEffect(() => {
    if (session.status === 'COUNTING') {
      const hasLegacyUnbrandedItems = session.items.some((it) => !it.brand);
      if (hasLegacyUnbrandedItems) {
        syncInventorySessionBrands(session.id);
      }
    }
  }, [session.id, session.status]);

  // Build enriched rows with resolved Brand and Location for every line
  const enrichedRows: EnrichedInventoryRow[] = useMemo(() => {
    const rows: EnrichedInventoryRow[] = [];

    for (const item of session.items) {
      const art = getArticleById(item.articleId);
      if (!art) continue;

      const resolvedBrand = (item.brand || art.brand || 'Origine').trim() || 'Origine';
      const lineKey = `${item.articleId}::${resolvedBrand.toLowerCase()}`;

      const fullLoc = getBrandLocation(
        stocks,
        art,
        resolvedBrand,
        session.warehouseId,
        warehouses
      );
      const livePureLoc =
        stripWarehousePrefix(fullLoc, warehouses, warehouse?.name) ||
        stripWarehousePrefix(item.location, warehouses, warehouse?.name) ||
        'Non renseigné';

      rows.push({
        item,
        lineKey,
        articleId: item.articleId,
        mainReference: art.mainReference,
        brandReference: item.brandReference || art.mainReference,
        designation: art.designation,
        brand: resolvedBrand,
        category: art.category,
        unit: art.unit || 'Unité',
        pureLocation: livePureLoc,
        fullLocation: fullLoc,
        theoreticalQty: item.theoreticalQty,
        countedQty: item.countedQty,
        variance: item.variance || 0,
        unitCost: item.unitCost || art.purchasePrice || 0,
        varianceValue: item.varianceValue || 0,
        notes: item.notes || '',
      });
    }

    return rows;
  }, [session.items, session.warehouseId, stocks, warehouses, warehouse?.name, getArticleById]);

  // Extract distinct Locations with their stats (total items, counted items, variance count)
  const locationStats = useMemo(() => {
    const map = new Map<
      string,
      { location: string; total: number; counted: number; variances: number; totalTheo: number }
    >();

    for (const row of enrichedRows) {
      const loc = row.pureLocation || 'Non renseigné';
      const existing = map.get(loc) || {
        location: loc,
        total: 0,
        counted: 0,
        variances: 0,
        totalTheo: 0,
      };
      existing.total += 1;
      existing.totalTheo += row.theoreticalQty;
      if (row.countedQty !== null) {
        existing.counted += 1;
        if (row.variance !== 0) {
          existing.variances += 1;
        }
      }
      map.set(loc, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.location === 'Non renseigné') return 1;
      if (b.location === 'Non renseigné') return -1;
      return a.location.localeCompare(b.location, 'fr', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [enrichedRows]);

  const filteredLocationStats = useMemo(() => {
    if (!locationSearchQuery.trim()) return locationStats;
    const q = locationSearchQuery.toLowerCase().trim();
    return locationStats.filter((ls) => ls.location.toLowerCase().includes(q));
  }, [locationStats, locationSearchQuery]);

  // Distinct Brands in this session
  const brandStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of enrichedRows) {
      map.set(r.brand, (map.get(r.brand) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand, 'fr', { sensitivity: 'base' }));
  }, [enrichedRows]);

  // Distinct Categories in this session
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of enrichedRows) {
      map.set(r.category, (map.get(r.category) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category, 'fr', { sensitivity: 'base' }));
  }, [enrichedRows]);

  // All known brands for the Add Product/Brand modal
  const allAvailableBrands = useMemo(() => {
    const set = new Set<string>(DEFAULT_BRANDS);
    brandStats.forEach((b) => set.add(b.brand));
    articles.forEach((a) => {
      if (a.brand?.trim()) set.add(a.brand.trim());
      a.brandOffers?.forEach((bo) => {
        if (bo.brand?.trim()) set.add(bo.brand.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [brandStats, articles]);

  // Compute global session KPIs
  const totalCountedLines = enrichedRows.filter((r) => r.countedQty !== null).length;
  const totalLines = enrichedRows.length;
  const progressPercent =
    totalLines > 0 ? Math.round((totalCountedLines / totalLines) * 100) : 100;
  const uncountedCount = totalLines - totalCountedLines;

  const totalVarianceQty = enrichedRows.reduce((sum, r) => sum + (r.variance || 0), 0);
  const totalVarianceValue = enrichedRows.reduce((sum, r) => sum + (r.varianceValue || 0), 0);
  const varianceCount = enrichedRows.filter(
    (r) => r.countedQty !== null && r.variance !== 0
  ).length;

  // Apply multi-criteria filters + general sorting
  const filteredAndSortedRows = useMemo(() => {
    const filtered = enrichedRows.filter((row) => {
      // 1. Location filter
      if (selectedLocationFilter !== 'ALL') {
        if (selectedLocationFilter === '__WITH_LOCATION__') {
          if (row.pureLocation === 'Non renseigné') return false;
        } else if (selectedLocationFilter === '__WITHOUT_LOCATION__') {
          if (row.pureLocation !== 'Non renseigné') return false;
        } else {
          const normTarget = selectedLocationFilter.toLowerCase().trim();
          const exactMatch = row.pureLocation.toLowerCase().trim() === normTarget;
          const segmentMatch = row.pureLocation
            .split(/\s*•\s*|\s*\|\s*|\s*;\s*/)
            .some((seg) => seg.toLowerCase().trim() === normTarget);
          if (!exactMatch && !segmentMatch) return false;
        }
      }

      // 2. Brand filter
      if (selectedBrandFilter !== 'ALL') {
        if (row.brand.toLowerCase() !== selectedBrandFilter.toLowerCase()) return false;
      }

      // 3. Category filter
      if (selectedCategoryFilter !== 'ALL') {
        if (row.category !== selectedCategoryFilter) return false;
      }

      // 4. Count status filter
      if (countStatusFilter === 'UNCOUNTED' && row.countedQty !== null) return false;
      if (countStatusFilter === 'COUNTED' && row.countedQty === null) return false;
      if (
        countStatusFilter === 'VARIANCE_ANY' &&
        (row.countedQty === null || row.variance === 0)
      ) {
        return false;
      }
      if (
        countStatusFilter === 'VARIANCE_NEGATIVE' &&
        (row.countedQty === null || row.variance >= 0)
      ) {
        return false;
      }
      if (
        countStatusFilter === 'VARIANCE_POSITIVE' &&
        (row.countedQty === null || row.variance <= 0)
      ) {
        return false;
      }
      if (
        countStatusFilter === 'CONFORM' &&
        (row.countedQty === null || row.variance !== 0)
      ) {
        return false;
      }

      // 5. Theoretical stock level filter
      if (stockLevelFilter === 'POSITIVE' && row.theoreticalQty <= 0) return false;
      if (stockLevelFilter === 'ZERO' && row.theoreticalQty > 0) return false;

      // 6. Text search query (Ref, Brand, Designation, Location, Notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = row.mainReference.toLowerCase().includes(q);
        const matchDesig = row.designation.toLowerCase().includes(q);
        const matchBrand = row.brand.toLowerCase().includes(q);
        const matchLoc = row.pureLocation.toLowerCase().includes(q);
        const matchCat = row.category.toLowerCase().includes(q);
        const matchNotes = row.notes.toLowerCase().includes(q);
        if (
          !matchRef &&
          !matchDesig &&
          !matchBrand &&
          !matchLoc &&
          !matchCat &&
          !matchNotes
        ) {
          return false;
        }
      }

      return true;
    });

    // General Sorting
    const dirMultiplier = sortDirection === 'ASC' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case 'LOCATION': {
          const aUnset = a.pureLocation === 'Non renseigné';
          const bUnset = b.pureLocation === 'Non renseigné';
          if (aUnset && !bUnset) return 1; // Always push 'Non renseigné' to bottom
          if (!aUnset && bUnset) return -1;
          const cmpLoc = a.pureLocation.localeCompare(b.pureLocation, 'fr', {
            numeric: true,
            sensitivity: 'base',
          });
          if (cmpLoc !== 0) return cmpLoc * dirMultiplier;
          const cmpRef = a.mainReference.localeCompare(b.mainReference, 'fr', {
            numeric: true,
          });
          if (cmpRef !== 0) return cmpRef;
          return a.brand.localeCompare(b.brand, 'fr');
        }
        case 'REFERENCE': {
          const cmpRef = a.mainReference.localeCompare(b.mainReference, 'fr', {
            numeric: true,
            sensitivity: 'base',
          });
          if (cmpRef !== 0) return cmpRef * dirMultiplier;
          return a.brand.localeCompare(b.brand, 'fr') * dirMultiplier;
        }
        case 'BRAND': {
          const cmpB = a.brand.localeCompare(b.brand, 'fr', { sensitivity: 'base' });
          if (cmpB !== 0) return cmpB * dirMultiplier;
          return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
        }
        case 'DESIGNATION': {
          const cmpD = a.designation.localeCompare(b.designation, 'fr', {
            sensitivity: 'base',
          });
          if (cmpD !== 0) return cmpD * dirMultiplier;
          return a.brand.localeCompare(b.brand, 'fr');
        }
        case 'CATEGORY': {
          const cmpC = a.category.localeCompare(b.category, 'fr', {
            sensitivity: 'base',
          });
          if (cmpC !== 0) return cmpC * dirMultiplier;
          return a.pureLocation.localeCompare(b.pureLocation, 'fr', { numeric: true });
        }
        case 'THEORETICAL': {
          if (a.theoreticalQty !== b.theoreticalQty) {
            return (a.theoreticalQty - b.theoreticalQty) * dirMultiplier;
          }
          return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
        }
        case 'COUNTED': {
          const aVal = a.countedQty === null ? -1 : a.countedQty;
          const bVal = b.countedQty === null ? -1 : b.countedQty;
          if (aVal !== bVal) return (aVal - bVal) * dirMultiplier;
          return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
        }
        case 'VARIANCE_QTY': {
          const aVar = a.countedQty === null ? 0 : a.variance;
          const bVar = b.countedQty === null ? 0 : b.variance;
          if (aVar !== bVar) return (aVar - bVar) * dirMultiplier;
          return Math.abs(bVar) - Math.abs(aVar);
        }
        case 'VARIANCE_VAL': {
          const aVal = a.countedQty === null ? 0 : a.varianceValue;
          const bVal = b.countedQty === null ? 0 : b.varianceValue;
          if (aVal !== bVal) return (aVal - bVal) * dirMultiplier;
          return Math.abs(bVal) - Math.abs(aVal);
        }
        default:
          return 0;
      }
    });
  }, [
    enrichedRows,
    selectedLocationFilter,
    selectedBrandFilter,
    selectedCategoryFilter,
    countStatusFilter,
    stockLevelFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Group rows if groupByMode !== 'NONE'
  const groupedSections = useMemo(() => {
    if (groupByMode === 'NONE') {
      return [
        {
          groupKey: 'ALL',
          groupTitle: 'Toutes les lignes affichées',
          rows: filteredAndSortedRows,
        },
      ];
    }

    const groups = new Map<string, EnrichedInventoryRow[]>();
    for (const row of filteredAndSortedRows) {
      const key =
        groupByMode === 'LOCATION'
          ? row.pureLocation
          : groupByMode === 'BRAND'
          ? row.brand
          : row.category;
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    }

    return Array.from(groups.entries()).map(([groupKey, rows]) => ({
      groupKey,
      groupTitle: groupKey,
      rows,
    }));
  }, [filteredAndSortedRows, groupByMode]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDirection(
        field === 'THEORETICAL' || field === 'VARIANCE_QTY' || field === 'VARIANCE_VAL'
          ? 'DESC'
          : 'ASC'
      );
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1 opacity-60" />;
    }
    return sortDirection === 'ASC' ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-600 inline ml-1" />
    );
  };

  // Update count for a specific (articleId + brand)
  const handleSetCount = (
    articleId: string,
    brand: string,
    newQty: number | null,
    notes?: string
  ) => {
    if (isValidated) return;
    const cleanQty = newQty === null ? null : Math.max(0, Math.floor(newQty));
    updateInventoryCount(session.id, articleId, cleanQty, notes, brand);
  };

  const handleNotesChange = (articleId: string, brand: string, notes: string) => {
    if (isValidated) return;
    const row = enrichedRows.find(
      (r) => r.articleId === articleId && r.brand.toLowerCase() === brand.toLowerCase()
    );
    if (row) {
      updateInventoryCount(session.id, articleId, row.countedQty, notes, brand);
    }
  };

  // Batch action: Mark all uncounted items in the current filtered view (or a specific group) as Conform (= Theoretical)
  const handleMarkRowsAsConform = (
    targetRows: EnrichedInventoryRow[],
    onlyUncounted: boolean,
    contextLabel: string
  ) => {
    if (isValidated) return;
    const rowsToUpdate = onlyUncounted
      ? targetRows.filter((r) => r.countedQty === null)
      : targetRows;

    if (rowsToUpdate.length === 0) {
      setSuccessBanner(`Toutes les lignes de ${contextLabel} sont déjà comptées.`);
      setTimeout(() => setSuccessBanner(null), 3500);
      return;
    }

    batchUpdateInventoryCounts(
      session.id,
      rowsToUpdate.map((r) => ({
        articleId: r.articleId,
        brand: r.brand,
        countedQty: r.theoreticalQty,
      }))
    );

    setSuccessBanner(
      `${rowsToUpdate.length} ligne(s) (${contextLabel}) marquées conformes au stock théorique (écart = 0).`
    );
    setTimeout(() => setSuccessBanner(null), 4500);
  };

  // Synchronize brands & catalog into current session
  const handleSyncBrands = () => {
    if (isValidated) return;
    const res = syncInventorySessionBrands(session.id);
    if (res.success) {
      setSuccessBanner(
        `Synchronisation réussie : ${res.totalLines} ligne(s) (Référence × Marque) actives dans cet inventaire (${res.addedLines} nouvelle(s) déclinaison(s) ajoutée(s)).`
      );
      setTimeout(() => setSuccessBanner(null), 5000);
    }
  };

  // Save location inline for a specific (articleId + brand)
  const handleSaveLocation = (articleId: string, brandName: string) => {
    if (isValidated) return;
    const res = updateStockLocationInWarehouse(
      articleId,
      session.warehouseId,
      locationInputVal,
      brandName
    );
    if (res.success) {
      setSuccessBanner(
        `Emplacement de la marque « ${brandName} » mis à jour : « ${
          locationInputVal.trim() || 'Non renseigné'
        } »`
      );
      setTimeout(() => setSuccessBanner(null), 3500);
    }
    setEditingLocationLineKey(null);
  };

  // Save unit cost inline for a specific (articleId + brand)
  const handleSaveUnitCost = (row: EnrichedInventoryRow) => {
    if (isValidated) return;
    updateInventoryCount(
      session.id,
      row.articleId,
      row.countedQty,
      row.notes,
      row.brand,
      Math.max(0, costInputVal)
    );
    setEditingCostLineKey(null);
    setSuccessBanner(
      `Prix d'achat unitaire de ${row.mainReference} (${row.brand}) mis à jour à ${formatFCFA(
        costInputVal
      )}.`
    );
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Open modal pre-filled to add a second/new brand for an existing reference
  const handleOpenAddBrandForReference = (row: EnrichedInventoryRow) => {
    const art = getArticleById(row.articleId);
    setAddProductError('');
    setIsAddingBrandForExistingRef(true);
    setNewRef(row.mainReference);
    setNewDesignation(row.designation);
    const otherBrand =
      DEFAULT_BRANDS.find((b) => b.toLowerCase() !== row.brand.toLowerCase()) || 'Donaldson';
    setNewBrand(otherBrand);
    setCustomBrandInput('');
    setNewCategory((art?.category as ArticleCategory) || 'Filtration');
    setNewLocation(row.pureLocation !== 'Non renseigné' ? row.pureLocation : '');
    setNewCountedQty(1);
    setNewPurchasePrice(row.unitCost || art?.purchasePrice || 15000);
    setNewSalePrice(art?.salePrice || 25000);
    setNewUnit(row.unit || 'Unité');
    setIsAddProductModalOpen(true);
  };

  // Add new product / brand submit
  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddProductError('');

    if (!newRef.trim()) {
      setAddProductError('Veuillez renseigner la référence principale.');
      return;
    }
    if (!newDesignation.trim()) {
      setAddProductError('Veuillez renseigner la désignation de la pièce.');
      return;
    }
    const effectiveBrand =
      newBrand === '__CUSTOM__' ? customBrandInput.trim() : newBrand.trim();
    if (!effectiveBrand) {
      setAddProductError('Veuillez préciser le nom de la marque constructeur.');
      return;
    }
    if (newCountedQty < 0) {
      setAddProductError('La quantité comptée doit être supérieure ou égale à 0.');
      return;
    }

    const cleanRef = newRef.trim().toUpperCase();
    const locClean = newLocation.trim() || 'Non renseigné';

    const res = addArticleToInventorySession(
      session.id,
      {
        mainReference: cleanRef,
        designation: newDesignation.trim(),
        brand: effectiveBrand,
        category: newCategory,
        compatibleMachines: [],
        equivalentReferences: [],
        purchasePrice: Number(newPurchasePrice) || 0,
        salePrice: Number(newSalePrice) || 0,
        minStockThreshold: Number(newMinThreshold) || 3,
        defaultLocation: locClean,
        unit: newUnit.trim() || 'Unité',
        status: 'active',
      },
      Number(newCountedQty),
      locClean
    );

    if (!res.success) {
      setAddProductError(res.error || 'Erreur lors de l’ajout du produit / de la marque.');
    } else {
      setIsAddProductModalOpen(false);
      setIsAddingBrandForExistingRef(false);
      setNewRef('');
      setNewDesignation('');
      setNewLocation('');
      setCustomBrandInput('');
      setNewCountedQty(1);
      setSuccessBanner(
        `La pièce « ${cleanRef} » en marque « ${effectiveBrand} » (${newCountedQty} unité(s), emplacement : ${locClean}) a été intégrée à l'inventaire.`
      );
      setTimeout(() => setSuccessBanner(null), 5000);
    }
  };

  const handleValidateSession = () => {
    setErrorMessage('');
    const result = validateInventorySession(session.id);
    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de la validation.');
      setIsConfirmValidateOpen(false);
    } else {
      setIsConfirmValidateOpen(false);
      onSuccess(
        `Session d'inventaire ${session.code} validée avec succès. Les stocks par marque et emplacements ont été régularisés.`
      );
    }
  };

  const handleCancelSession = () => {
    cancelInventorySession(session.id);
    setIsConfirmCancelOpen(false);
    onBack();
  };

  const handleExportCSV = () => {
    const headers = [
      'Code Session',
      'Magasin',
      'Emplacement',
      'Référence Principale',
      'Marque Constructeur',
      'Désignation',
      'Catégorie',
      'Stock Théorique (Marque)',
      'Stock Compté (Marque)',
      'Écart (Compté - Théorique)',
      'Coût Unitaire Achat (FCFA)',
      'Valorisation Écart (FCFA)',
      'Justification / Observation',
    ];

    // Export in the exact order currently sorted/filtered by the user
    const rows = filteredAndSortedRows.map((r) => [
      session.code,
      warehouse?.name || '',
      r.pureLocation,
      r.mainReference,
      r.brand,
      r.designation,
      r.category,
      r.theoreticalQty,
      r.countedQty !== null ? r.countedQty : 'Non compté',
      r.countedQty !== null ? r.variance : 0,
      r.unitCost,
      r.countedQty !== null ? r.varianceValue : 0,
      r.notes || '',
    ]);

    exportToCSV(`inventaire_${session.code}_par_marque_emplacement`, headers, rows);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedLocationFilter('ALL');
    setSelectedBrandFilter('ALL');
    setSelectedCategoryFilter('ALL');
    setCountStatusFilter('ALL');
    setStockLevelFilter('ALL');
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedLocationFilter !== 'ALL' ||
    selectedBrandFilter !== 'ALL' ||
    selectedCategoryFilter !== 'ALL' ||
    countStatusFilter !== 'ALL' ||
    stockLevelFilter !== 'ALL';

  const getBrandBadgeClass = (brand: string) => {
    const norm = brand.toLowerCase();
    if (norm.includes('cat')) return 'bg-amber-100 text-amber-950 border-amber-300';
    if (norm.includes('donaldson') || norm.includes('fleetguard'))
      return 'bg-sky-100 text-sky-900 border-sky-300';
    if (norm.includes('ctp') || norm.includes('itr'))
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (norm.includes('komatsu') || norm.includes('volvo'))
      return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    if (norm.includes('baldwin') || norm.includes('perkins') || norm.includes('bosch'))
      return 'bg-rose-100 text-rose-900 border-rose-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="space-y-4">
      {/* Datalist of existing locations in this warehouse for fast inline autocomplete */}
      <datalist id="warehouse-locations-datalist">
        {locationStats
          .filter((ls) => ls.location !== 'Non renseigné')
          .map((ls) => (
            <option key={ls.location} value={ls.location} />
          ))}
      </datalist>

      {/* Top Banner Feedbacks */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* EN-TÊTE DE LA SESSION D'INVENTAIRE & ACTIONS PRINCIPALES           */}
      {/* ================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Retour à la liste des sessions d'inventaire"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-slate-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded">
                  {session.code}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${
                    isValidated
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {isValidated ? 'Validé & Verrouillé' : 'Comptage par Marque en cours'}
                </span>
                {session.scopeSummary && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {session.scopeSummary}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                {warehouse?.name} ({warehouse?.code}) — {totalLines} lignes (Réf × Marque)
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isValidated && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAddProductError('');
                    setIsAddingBrandForExistingRef(false);
                    setNewRef('');
                    setNewDesignation('');
                    setNewLocation(
                      selectedLocationFilter !== 'ALL' &&
                        !selectedLocationFilter.startsWith('__')
                        ? selectedLocationFilter
                        : ''
                    );
                    setIsAddProductModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-2xs transition-colors cursor-pointer"
                  title="Ajouter une nouvelle pièce ou une marque supplémentaire trouvée en rayon"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Produit / Marque</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncBrands}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="Séparer et synchroniser toutes les marques du catalogue dans cette session"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Synchroniser Marques</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Imprimer une Fiche de Comptage (par emplacement) ou le Procès-Verbal A4"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Fiche Comptage / PV A4</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel/CSV</span>
            </button>

            {!isValidated && (
              <>
                <button
                  type="button"
                  onClick={() => setIsConfirmCancelOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmValidateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Valider l'inventaire</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Progression Comptage
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums">
                {totalCountedLines} / {totalLines}
              </span>
              <span className="text-xs font-bold text-amber-600">({progressPercent}%)</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Emplacements & Marques
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                {locationStats.length} empl.
              </span>
              <span className="text-xs text-slate-500">· {brandStats.length} marques</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Séparation stricte par marque
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Lignes avec Écart
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-lg font-black font-mono tabular-nums ${
                  varianceCount > 0 ? 'text-amber-600' : 'text-emerald-700'
                }`}
              >
                {varianceCount}
              </span>
              <span className="text-xs text-slate-500">sur {totalCountedLines} comptées</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Écart Quantitatif Net
            </span>
            <div className="mt-1">
              <span
                className={`text-lg font-black font-mono tabular-nums ${
                  totalVarianceQty > 0
                    ? 'text-emerald-700'
                    : totalVarianceQty < 0
                    ? 'text-rose-600'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} u.
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Valorisation de l'Écart
            </span>
            <div className="mt-1">
              <span
                className={`text-base font-black font-mono tabular-nums ${
                  totalVarianceValue > 0
                    ? 'text-emerald-700'
                    : totalVarianceValue < 0
                    ? 'text-rose-600'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {totalVarianceValue > 0 ? '+' : ''}
                {formatFCFA(totalVarianceValue)}
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* EXPLORATEUR VISUEL D'EMPLACEMENTS (VOIR UN EMPLACEMENT PRÉCIS)     */}
      {/* ================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold">
              Explorateur par Emplacement Précis ({locationStats.length} emplacements dans ce magasin)
            </h3>
            {selectedLocationFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-[11px] font-black">
                Filtre actif :{' '}
                {selectedLocationFilter === '__WITH_LOCATION__'
                  ? 'Avec emplacement'
                  : selectedLocationFilter === '__WITHOUT_LOCATION__'
                  ? 'Non renseigné'
                  : selectedLocationFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedLocationFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedLocationFilter('ALL')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 cursor-pointer inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Afficher tous les emplacements</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLocationExplorer((prev) => !prev)}
              className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
            >
              {showLocationExplorer ? 'Réduire les emplacements' : 'Déplier les emplacements'}
            </button>
          </div>
        </div>

        {showLocationExplorer && (
          <div className="p-3.5 space-y-3 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Cliquez sur un emplacement ci-dessous pour <strong>voir uniquement les produits rangés à cet endroit précis</strong> :
              </p>
              {locationStats.length > 6 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="Filtrer un nom d'emplacement..."
                    className="w-full pl-8 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                  {locationSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLocationSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-0.5">
              {/* Bouton Tous les emplacements */}
              <button
                type="button"
                onClick={() => setSelectedLocationFilter('ALL')}
                className={`px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer flex items-center gap-2 ${
                  selectedLocationFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Tous les emplacements</span>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                    selectedLocationFilter === 'ALL'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {totalLines}
                </span>
              </button>

              {filteredLocationStats.map((ls) => {
                const isSelected = selectedLocationFilter === ls.location;
                const isDone = ls.counted === ls.total && ls.total > 0;
                return (
                  <button
                    key={ls.location}
                    type="button"
                    onClick={() =>
                      setSelectedLocationFilter(isSelected ? 'ALL' : ls.location)
                    }
                    className={`px-3 py-2 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs ring-2 ring-amber-400/50'
                        : isDone
                        ? 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
                        : 'bg-white hover:bg-amber-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <MapPin
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected
                          ? 'text-slate-950'
                          : isDone
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    />
                    <span className="font-mono truncate max-w-[180px]">{ls.location}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                        isSelected
                          ? 'bg-slate-950 text-amber-400'
                          : isDone
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ls.counted}/{ls.total}
                    </span>
                    {ls.variances > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold"
                        title={`${ls.variances} écart(s) dans cet emplacement`}
                      >
                        {ls.variances} éc.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Barre d'action dédiée quand un emplacement précis est sélectionné */}
            {selectedLocationFilter !== 'ALL' && !isValidated && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-950">
                  <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Emplacement ciblé :{' '}
                    <strong className="font-mono">{selectedLocationFilter}</strong> (
                    <strong>{filteredAndSortedRows.length}</strong> pièce(s)/marque(s) trouvées)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleMarkRowsAsConform(
                        filteredAndSortedRows,
                        true,
                        `l'emplacement « ${selectedLocationFilter} »`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Marquer les non-comptés de cet emplacement Conformes (= Stock Théo)
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* BARRE DE RECHERCHE, FILTRES MULTI-CRITÈRES, TRI GÉNÉRAL & GROUPES  */}
      {/* ================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3 text-xs">
        {/* Ligne 1 : Recherche + Filtres Emplacement / Marque / Catégorie / Statut */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Recherche texte */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher réf, marque, désignation, emplacement..."
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sélecteur d'Emplacement Précis */}
          <div>
            <select
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
              className={`w-full px-2.5 py-2 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 ${
                selectedLocationFilter !== 'ALL'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
              title="Filtrer par emplacement précis"
            >
              <option value="ALL">📍 Tous les emplacements ({locationStats.length})</option>
              <option value="__WITH_LOCATION__">✓ Avec emplacement renseigné</option>
              <option value="__WITHOUT_LOCATION__">⚠️ Sans emplacement (Non renseigné)</option>
              <optgroup label="Emplacements précis du magasin">
                {locationStats.map((ls) => (
                  <option key={ls.location} value={ls.location}>
                    {ls.location} ({ls.counted}/{ls.total} comptés)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Sélecteur de Marque */}
          <div>
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className={`w-full px-2.5 py-2 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 ${
                selectedBrandFilter !== 'ALL'
                  ? 'bg-sky-50 border-sky-400 text-sky-950 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
              title="Filtrer par marque constructeur"
            >
              <option value="ALL">🏷️ Toutes les marques ({brandStats.length})</option>
              {brandStats.map((b) => (
                <option key={b.brand} value={b.brand}>
                  {b.brand} ({b.count} réf.)
                </option>
              ))}
            </select>
          </div>

          {/* Sélecteur de Catégorie */}
          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className={`w-full px-2.5 py-2 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 ${
                selectedCategoryFilter !== 'ALL'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="ALL">📦 Toutes les catégories ({categoryStats.length})</option>
              {categoryStats.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sélecteur de Statut de comptage / Écart */}
          <div>
            <select
              value={countStatusFilter}
              onChange={(e) => setCountStatusFilter(e.target.value as CountStatusFilter)}
              className={`w-full px-2.5 py-2 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 ${
                countStatusFilter !== 'ALL'
                  ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="ALL">📋 Tous les statuts ({totalLines})</option>
              <option value="UNCOUNTED">⏳ À compter ({uncountedCount})</option>
              <option value="COUNTED">✓ Déjà comptés ({totalCountedLines})</option>
              <option value="VARIANCE_ANY">⚠️ Tous les écarts ≠ 0 ({varianceCount})</option>
              <option value="VARIANCE_NEGATIVE">🔻 Manquants (Écart &lt; 0)</option>
              <option value="VARIANCE_POSITIVE">🔺 Excédents (Écart &gt; 0)</option>
              <option value="CONFORM">✅ Conformes (Écart = 0)</option>
            </select>
          </div>
        </div>

        {/* Ligne 2 : Tri Général, Regroupement visuel, Mode Aveugle & Actions en lot */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tri général */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-bold text-slate-700">Trier par :</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 focus:outline-none"
              >
                <option value="LOCATION">Emplacement (Ordre des rayons)</option>
                <option value="REFERENCE">Référence Constructeur</option>
                <option value="BRAND">Marque Constructeur</option>
                <option value="DESIGNATION">Désignation (Nom pièce)</option>
                <option value="CATEGORY">Catégorie</option>
                <option value="THEORETICAL">Stock Théorique</option>
                <option value="COUNTED">Stock Compté</option>
                <option value="VARIANCE_QTY">Écart en Quantité</option>
                <option value="VARIANCE_VAL">Valeur Financière de l'Écart</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortDirection((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
                }
                className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 hover:bg-amber-50 cursor-pointer inline-flex items-center gap-1"
                title="Inverser l'ordre de tri (Croissant / Décroissant)"
              >
                {sortDirection === 'ASC' ? (
                  <>
                    <ArrowUp className="w-3 h-3 text-amber-600" />
                    <span>A→Z / Croissant</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3 h-3 text-amber-600" />
                    <span>Z→A / Décroissant</span>
                  </>
                )}
              </button>
            </div>

            {/* Regroupement visuel */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <FolderKanban className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="font-bold text-slate-700">Grouper par :</span>
              <select
                value={groupByMode}
                onChange={(e) => setGroupByMode(e.target.value as GroupByMode)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 focus:outline-none"
              >
                <option value="NONE">Aucun (Tableau continu)</option>
                <option value="LOCATION">Par Emplacement (Étagère / Rayon)</option>
                <option value="BRAND">Par Marque Constructeur</option>
                <option value="CATEGORY">Par Catégorie</option>
              </select>
            </div>

            {/* Filtre Stock Théorique > 0 */}
            <select
              value={stockLevelFilter}
              onChange={(e) =>
                setStockLevelFilter(e.target.value as 'ALL' | 'POSITIVE' | 'ZERO')
              }
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700"
            >
              <option value="ALL">Stock Théo : Tous</option>
              <option value="POSITIVE">Stock Théo &gt; 0 uniquement</option>
              <option value="ZERO">Stock Théo = 0 (Ruptures)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser filtres</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode comptage à l'aveugle */}
            <button
              type="button"
              onClick={() => setBlindCountMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                blindCountMode
                  ? 'bg-slate-900 text-amber-400 border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Masquer la colonne Stock Théorique pendant le comptage pour obliger à compter réellement"
            >
              {blindCountMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Mode Aveugle : Théo masqué</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mode Aveugle</span>
                </>
              )}
            </button>

            {/* Reconduire les non-comptés de la sélection affichée */}
            {!isValidated &&
              filteredAndSortedRows.some((r) => r.countedQty === null) && (
                <button
                  type="button"
                  onClick={() =>
                    handleMarkRowsAsConform(
                      filteredAndSortedRows,
                      true,
                      hasActiveFilters ? 'la sélection filtrée' : 'toute la session'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer"
                  title="Remplit automatiquement les lignes non comptées affichées avec leur quantité théorique (écart = 0)"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    Reconduire non-comptés affichés (
                    {filteredAndSortedRows.filter((r) => r.countedQty === null).length})
                  </span>
                </button>
              )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TABLEAU D'INVENTAIRE DÉTAILLÉ PAR MARQUE & EMPLACEMENT              */}
      {/* ================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Affichage de <strong>{filteredAndSortedRows.length}</strong> ligne(s) (Référence × Marque) sur{' '}
            <strong>{totalLines}</strong>
          </span>
          <span className="text-[11px] text-slate-500">
            Astuce : cliquez sur un en-tête de colonne pour trier, ou cliquez sur{' '}
            <strong className="text-emerald-700">« = Théo »</strong> pour valider une ligne conforme en 1 clic.
          </span>
        </div>

        {filteredAndSortedRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Filter className="w-8 h-8 mx-auto opacity-30 text-slate-500" />
            <p className="text-sm font-bold text-slate-700">
              Aucune pièce/marque ne correspond aux filtres sélectionnés
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Afficher toutes les lignes
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold select-none">
                <tr>
                  <th
                    onClick={() => handleToggleSort('LOCATION')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                  >
                    Emplacement {renderSortIcon('LOCATION')}
                  </th>
                  <th
                    onClick={() => handleToggleSort('REFERENCE')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                  >
                    Référence {renderSortIcon('REFERENCE')}
                  </th>
                  <th
                    onClick={() => handleToggleSort('BRAND')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                  >
                    Marque {renderSortIcon('BRAND')}
                  </th>
                  <th
                    onClick={() => handleToggleSort('DESIGNATION')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    Désignation & Catégorie {renderSortIcon('DESIGNATION')}
                  </th>
                  {!blindCountMode && (
                    <th
                      onClick={() => handleToggleSort('THEORETICAL')}
                      className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                    >
                      Stock Théo {renderSortIcon('THEORETICAL')}
                    </th>
                  )}
                  <th
                    onClick={() => handleToggleSort('COUNTED')}
                    className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap w-56"
                  >
                    Stock Compté (Marque) {renderSortIcon('COUNTED')}
                  </th>
                  {!blindCountMode && (
                    <>
                      <th
                        onClick={() => handleToggleSort('VARIANCE_QTY')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                      >
                        Écart {renderSortIcon('VARIANCE_QTY')}
                      </th>
                      <th
                        onClick={() => handleToggleSort('VARIANCE_VAL')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors whitespace-nowrap"
                      >
                        Valeur Écart {renderSortIcon('VARIANCE_VAL')}
                      </th>
                    </>
                  )}
                  <th className="py-3 px-3 min-w-[200px]">Motif / Observation</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groupedSections.map((section) => {
                  const secCounted = section.rows.filter((r) => r.countedQty !== null).length;
                  const secTotal = section.rows.length;
                  const secUnCounted = secTotal - secCounted;

                  return (
                    <React.Fragment key={section.groupKey}>
                      {groupByMode !== 'NONE' && (
                        <tr className="bg-slate-900 text-white">
                          <td
                            colSpan={blindCountMode ? 6 : 9}
                            className="py-2 px-4 font-bold text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {groupByMode === 'LOCATION' && (
                                  <MapPin className="w-4 h-4 text-amber-400" />
                                )}
                                {groupByMode === 'BRAND' && (
                                  <Tag className="w-4 h-4 text-amber-400" />
                                )}
                                {groupByMode === 'CATEGORY' && (
                                  <Layers className="w-4 h-4 text-amber-400" />
                                )}
                                <span className="font-mono text-amber-400">
                                  {section.groupTitle}
                                </span>
                                <span className="text-[11px] text-slate-300 font-normal">
                                  ({secCounted}/{secTotal} comptés)
                                </span>
                              </div>

                              {!isValidated && secUnCounted > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMarkRowsAsConform(
                                      section.rows,
                                      true,
                                      section.groupTitle
                                    )
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>
                                    Valider conforme les {secUnCounted} non-compté(s) de ce groupe
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {section.rows.map((row) => {
                        const hasCounted = row.countedQty !== null;
                        const variance = row.variance;
                        const isPositive = variance > 0;
                        const isNegative = variance < 0;

                        return (
                          <tr
                            key={row.lineKey}
                            className={`transition-colors ${
                              hasCounted
                                ? variance === 0
                                  ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                                  : isNegative
                                  ? 'bg-rose-50/35 hover:bg-rose-50/60'
                                  : 'bg-sky-50/35 hover:bg-sky-50/60'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            {/* 1. EMPLACEMENT (Par marque, filtrable et modifiable en 1 clic) */}
                            <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                              {editingLocationLineKey === row.lineKey && !isValidated ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    list="warehouse-locations-datalist"
                                    autoFocus
                                    value={locationInputVal}
                                    onChange={(e) => setLocationInputVal(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')
                                        handleSaveLocation(row.articleId, row.brand);
                                      if (e.key === 'Escape')
                                        setEditingLocationLineKey(null);
                                    }}
                                    placeholder="Ex: Rayon A1 - Étagère 2"
                                    className="w-40 px-2 py-1 text-xs font-mono border border-amber-500 rounded-lg bg-white focus:outline-none ring-2 ring-amber-400/30"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSaveLocation(row.articleId, row.brand)
                                    }
                                    className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded cursor-pointer"
                                    title="Enregistrer l'emplacement pour cette marque"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLocationLineKey(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Annuler"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedLocationFilter(
                                        selectedLocationFilter === row.pureLocation
                                          ? 'ALL'
                                          : row.pureLocation
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-left transition-colors cursor-pointer ${
                                      row.pureLocation === 'Non renseigné'
                                        ? 'bg-slate-50 text-slate-400 border-slate-200 italic'
                                        : selectedLocationFilter === row.pureLocation
                                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                                        : 'bg-amber-50/70 hover:bg-amber-100 text-slate-800 border-amber-200/80 font-semibold'
                                    }`}
                                    title="Cliquer pour voir tous les produits de cet emplacement"
                                  >
                                    <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span className="truncate max-w-[145px]">
                                      {row.pureLocation}
                                    </span>
                                  </button>

                                  {!isValidated && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingLocationLineKey(row.lineKey);
                                        setLocationInputVal(
                                          row.pureLocation !== 'Non renseigné'
                                            ? row.pureLocation
                                            : ''
                                        );
                                      }}
                                      className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                      title="Modifier l'emplacement de cette marque"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 2. RÉFÉRENCE CONSTRUCTEUR + AJOUT RAPIDE D'UNE AUTRE MARQUE */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                                  {row.mainReference}
                                </span>
                                {!isValidated && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddBrandForReference(row)}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 text-[10px] font-bold border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
                                    title="Ajouter une autre marque trouvée en rayon pour cette même référence"
                                  >
                                    + Marque
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 3. MARQUE DISTINCTE */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBrandFilter(
                                    selectedBrandFilter === row.brand ? 'ALL' : row.brand
                                  )
                                }
                                className={`px-2.5 py-0.5 rounded-md border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all ${getBrandBadgeClass(
                                  row.brand
                                )}`}
                                title="Cliquer pour filtrer sur cette marque"
                              >
                                <Tag className="w-2.5 h-2.5 opacity-70" />
                                <span>{row.brand}</span>
                              </button>
                            </td>

                            {/* 4. DÉSIGNATION & CATÉGORIE */}
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {row.designation}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {row.category}
                              </div>
                            </td>

                            {/* 5. STOCK THÉORIQUE (DE CETTE MARQUE) */}
                            {!blindCountMode && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap tabular-nums">
                                <span className="text-xs">{row.theoreticalQty}</span>{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {row.unit}
                                </span>
                              </td>
                            )}

                            {/* 6. STOCK COMPTÉ (SAISIE RAPIDE + BOUTON CONFORME + STEPPERS) */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isValidated ? (
                                <div className="text-center font-mono font-black text-slate-900 tabular-nums">
                                  {row.countedQty} {row.unit}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Bouton -1 */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetCount(
                                        row.articleId,
                                        row.brand,
                                        Math.max(
                                          0,
                                          (row.countedQty ?? row.theoreticalQty) - 1
                                        )
                                      )
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                    title="Diminuer de 1"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  {/* Champ numérique distinguant 'Non compté' (vide) de '0' */}
                                  <input
                                    type="number"
                                    min={0}
                                    value={row.countedQty === null ? '' : row.countedQty}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw.trim() === '') {
                                        handleSetCount(row.articleId, row.brand, null);
                                      } else {
                                        const parsed = parseInt(raw, 10);
                                        if (!isNaN(parsed) && parsed >= 0) {
                                          handleSetCount(row.articleId, row.brand, parsed);
                                        }
                                      }
                                    }}
                                    placeholder="À compter"
                                    className={`w-20 px-2 py-1 text-xs font-mono font-black text-center border rounded-lg focus:outline-none focus:ring-2 ${
                                      hasCounted
                                        ? variance === 0
                                          ? 'border-emerald-400 bg-emerald-50/50 text-emerald-950 focus:ring-emerald-500/20'
                                          : 'border-amber-500 bg-amber-50/50 text-slate-950 focus:ring-amber-500/20'
                                        : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 placeholder:font-normal focus:border-amber-500'
                                    }`}
                                  />

                                  {/* Bouton +1 */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetCount(
                                        row.articleId,
                                        row.brand,
                                        (row.countedQty ?? row.theoreticalQty) + 1
                                      )
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                    title="Augmenter de 1"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>

                                  {/* Bouton rapide '= Théo' (Conforme) ou '×' (Effacer) */}
                                  {!blindCountMode &&
                                    (row.countedQty === null ||
                                      row.countedQty !== row.theoreticalQty) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSetCount(
                                            row.articleId,
                                            row.brand,
                                            row.theoreticalQty
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold cursor-pointer shadow-2xs"
                                        title={`Marquer Conforme (= ${row.theoreticalQty})`}
                                      >
                                        = {row.theoreticalQty}
                                      </button>
                                    )}

                                  {hasCounted && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetCount(row.articleId, row.brand, null)
                                      }
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                      title="Effacer la saisie (remettre en Non compté)"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 7. ÉCART QUANTITATIF */}
                            {!blindCountMode && (
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold tabular-nums">
                                {!hasCounted ? (
                                  <span className="text-slate-400 text-[11px] italic">
                                    En attente
                                  </span>
                                ) : variance === 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">
                                    0 (Conforme)
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-black ${
                                      isPositive
                                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                                    }`}
                                  >
                                    {isPositive ? `+${variance}` : variance} {row.unit}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* 8. VALEUR FINANCIÈRE DE L'ÉCART & PRIX UNITAIRE */}
                            {!blindCountMode && (
                              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                                {editingCostLineKey === row.lineKey && !isValidated ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <NumericInput
                                      min={0}
                                      step={100}
                                      value={costInputVal}
                                      onChange={(val) => setCostInputVal(val)}
                                      placeholder="Coût"
                                      className="w-24 px-1.5 py-0.5 text-xs font-mono text-right border border-amber-500 rounded bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveUnitCost(row)}
                                      className="p-1 text-emerald-700 bg-emerald-50 rounded cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <div
                                      className={`font-bold text-xs ${
                                        !hasCounted || variance === 0
                                          ? 'text-slate-400'
                                          : isPositive
                                          ? 'text-emerald-700'
                                          : 'text-rose-600'
                                      }`}
                                    >
                                      {!hasCounted || variance === 0
                                        ? '0 FCFA'
                                        : `${isPositive ? '+' : ''}${formatFCFA(
                                            row.varianceValue
                                          )}`}
                                    </div>
                                    <div
                                      onClick={() => {
                                        if (!isValidated) {
                                          setEditingCostLineKey(row.lineKey);
                                          setCostInputVal(row.unitCost);
                                        }
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-amber-700 cursor-pointer"
                                      title="Cliquer pour ajuster le coût d'achat unitaire de cette marque"
                                    >
                                      PU: {formatFCFA(row.unitCost)}
                                    </div>
                                  </div>
                                )}
                              </td>
                            )}

                            {/* 9. MOTIF / OBSERVATION D'ÉCART */}
                            <td className="py-2.5 px-3">
                              {isValidated ? (
                                <span className="text-slate-600 text-[11px]">
                                  {row.notes || '-'}
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={row.notes}
                                    onChange={(e) =>
                                      handleNotesChange(
                                        row.articleId,
                                        row.brand,
                                        e.target.value
                                      )
                                    }
                                    placeholder={
                                      hasCounted && variance !== 0
                                        ? 'Justifier l’écart (ex: erreur marque)...'
                                        : 'Note / Observation...'
                                    }
                                    className={`w-full px-2 py-1 text-xs border rounded-lg focus:outline-none ${
                                      hasCounted && variance !== 0 && !row.notes
                                        ? 'border-amber-300 bg-amber-50/40'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  />
                                  {hasCounted && variance !== 0 && !row.notes && (
                                    <div className="flex flex-wrap gap-1">
                                      {QUICK_VARIANCE_REASONS.slice(0, 2).map((reason) => (
                                        <button
                                          key={reason}
                                          type="button"
                                          onClick={() =>
                                            handleNotesChange(
                                              row.articleId,
                                              row.brand,
                                              reason
                                            )
                                          }
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                                        >
                                          + {reason}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Superviseur : <strong>{session.supervisor}</strong> · Date :{' '}
            {formatDate(session.date)}
          </span>
          <span className="font-semibold text-emerald-800">
            ✓ Chaque marque est comptabilisée séparément dans la répartition du dépôt ({warehouse?.name}).
          </span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL : AJOUT D'UN NOUVEAU PRODUIT OU D'UNE MARQUE SUPPLÉMENTAIRE  */}
      {/* ================================================================== */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isAddingBrandForExistingRef
                      ? `Ajouter une marque pour la réf. ${newRef}`
                      : "Ajouter un produit ou une marque à l'inventaire"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Magasin : <strong>{warehouse?.name}</strong> ({session.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addProductError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {addProductError}
              </div>
            )}

            <form onSubmit={handleAddProductSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Réf. Principale *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRef}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRef(val);
                      const found = articles.find(
                        (a) =>
                          a.mainReference.toLowerCase().trim() === val.toLowerCase().trim()
                      );
                      if (found) {
                        setNewDesignation(found.designation);
                        setNewCategory(found.category);
                        setNewPurchasePrice(found.purchasePrice);
                        setNewSalePrice(found.salePrice);
                        setNewUnit(found.unit);
                      }
                    }}
                    placeholder="Ex: 1R-0716"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Marque Constructeur *
                  </label>
                  <select
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:outline-none focus:border-amber-500"
                  >
                    {allAvailableBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Autre marque (Saisir)...</option>
                  </select>
                </div>
              </div>

              {newBrand === '__CUSTOM__' && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">
                    Nom de la nouvelle marque *
                  </label>
                  <input
                    type="text"
                    required
                    value={customBrandInput}
                    onChange={(e) => setCustomBrandInput(e.target.value)}
                    placeholder="Ex: Parker, Mann-Filter, Hengst..."
                    className="w-full px-3 py-2 border border-amber-400 rounded-lg font-bold bg-amber-50/40 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Désignation de la pièce *
                </label>
                <input
                  type="text"
                  required
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  placeholder="Ex: Filtre à carburant haute efficacité"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ArticleCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-amber-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Emplacement de cette marque (Rayon/Case)
                  </label>
                  <input
                    type="text"
                    list="warehouse-locations-datalist"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: Travée B - Étagère 02"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Qté Comptée *
                  </label>
                  <NumericInput
                    min={0}
                    value={newCountedQty}
                    onChange={(val) => setNewCountedQty(Math.max(0, Math.floor(val)))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono font-bold text-amber-700 text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Prix Achat (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    step={100}
                    value={newPurchasePrice}
                    onChange={(val) => setNewPurchasePrice(Math.max(0, val))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Prix Vente (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    step={100}
                    value={newSalePrice}
                    onChange={(val) => setNewSalePrice(Math.max(0, val))}
                    placeholder="0"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enregistrer & Insérer dans l'inventaire</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL : FICHE DE COMPTAGE TERRAIN & PROCÈS-VERBAL D'INVENTAIRE A4  */}
      {/* ================================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Toolbar (No print) */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Impression Fiche d'Inventaire / Procès-Verbal ({filteredAndSortedRows.length} lignes)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Le document respecte vos filtres et votre tri actuels (ex: par Emplacement)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex bg-slate-800 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintMode('BLIND_SHEET')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      printMode === 'BLIND_SHEET'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1. Fiche Terrain (À l'aveugle)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('CONTROL_SHEET')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      printMode === 'CONTROL_SHEET'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    2. Fiche avec Stock Théo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('OFFICIAL_PV')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      printMode === 'OFFICIAL_PV'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3. PV Officiel Complet
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer / PDF A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Sheet */}
            <div className="p-8 overflow-y-auto bg-white text-slate-900 space-y-6 text-xs">
              {/* En-tête Entreprise */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  {companyInfo.logoUrl ? (
                    <img
                      src={companyInfo.logoUrl}
                      alt={companyInfo.name}
                      className="w-14 h-14 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 font-black text-sm flex items-center justify-center">
                      {companyInfo.shortName || companyInfo.name?.slice(0, 4).toUpperCase() || 'WKRLI'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-base font-black uppercase tracking-tight">
                      {companyInfo.name}
                    </h1>
                    <p className="text-[11px] text-slate-600">{companyInfo.slogan}</p>
                    <p className="text-[10px] text-slate-500">
                      {companyInfo.address} · Tél: {companyInfo.phone}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-xs uppercase rounded">
                    {printMode === 'BLIND_SHEET'
                      ? 'FICHE DE COMPTAGE PHYSIQUE (À L’AVEUGLE)'
                      : printMode === 'CONTROL_SHEET'
                      ? 'FICHE DE CONTRÔLE D’INVENTAIRE'
                      : 'PROCÈS-VERBAL D’INVENTAIRE PHYSIQUE'}
                  </div>
                  <div className="font-mono font-bold text-xs mt-1">
                    Session : {session.code} · Date : {formatDate(session.date)}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Dépôt : <strong>{warehouse?.name}</strong> · Superviseur :{' '}
                    <strong>{session.supervisor}</strong>
                  </div>
                  {selectedLocationFilter !== 'ALL' && (
                    <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                      Emplacement ciblé : {selectedLocationFilter}
                    </div>
                  )}
                </div>
              </div>

              {/* Tableau Imprimable */}
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 uppercase">
                    <th className="border border-slate-300 py-2 px-2 text-left">Emplacement</th>
                    <th className="border border-slate-300 py-2 px-2 text-left">Référence</th>
                    <th className="border border-slate-300 py-2 px-2 text-left">Marque</th>
                    <th className="border border-slate-300 py-2 px-2 text-left">Désignation</th>
                    {printMode !== 'BLIND_SHEET' && (
                      <th className="border border-slate-300 py-2 px-2 text-right">
                        Stock Théo
                      </th>
                    )}
                    <th className="border border-slate-300 py-2 px-2 text-center w-28">
                      Qté Comptée
                    </th>
                    {printMode === 'OFFICIAL_PV' && (
                      <>
                        <th className="border border-slate-300 py-2 px-2 text-right">Écart</th>
                        <th className="border border-slate-300 py-2 px-2 text-right">
                          Valeur Écart
                        </th>
                      </>
                    )}
                    <th className="border border-slate-300 py-2 px-2 text-left">
                      Observations / Émargement
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRows.map((r) => (
                    <tr key={r.lineKey}>
                      <td className="border border-slate-300 py-1.5 px-2 font-mono font-semibold">
                        {r.pureLocation}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 font-mono font-bold">
                        {r.mainReference}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 font-bold">
                        {r.brand}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2">{r.designation}</td>
                      {printMode !== 'BLIND_SHEET' && (
                        <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                          {r.theoreticalQty} {r.unit}
                        </td>
                      )}
                      <td className="border border-slate-300 py-1.5 px-2 text-center font-mono font-bold">
                        {printMode === 'BLIND_SHEET'
                          ? '..................'
                          : r.countedQty !== null
                          ? `${r.countedQty} ${r.unit}`
                          : 'Non compté'}
                      </td>
                      {printMode === 'OFFICIAL_PV' && (
                        <>
                          <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                            {r.countedQty !== null
                              ? r.variance > 0
                                ? `+${r.variance}`
                                : r.variance
                              : '0'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                            {r.countedQty !== null && r.variance !== 0
                              ? formatFCFA(r.varianceValue)
                              : '-'}
                          </td>
                        </>
                      )}
                      <td className="border border-slate-300 py-1.5 px-2">
                        {printMode === 'BLIND_SHEET' ? '' : r.notes || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pied de page & Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-center">
                <div className="p-4 border border-slate-300 rounded-lg h-24 flex flex-col justify-between">
                  <span className="font-bold uppercase text-[10px] text-slate-600">
                    Agent Compteur / Magasinier
                  </span>
                  <span className="text-[10px] text-slate-400">Date & Signature</span>
                </div>
                <div className="p-4 border border-slate-300 rounded-lg h-24 flex flex-col justify-between">
                  <span className="font-bold uppercase text-[10px] text-slate-600">
                    Superviseur ({session.supervisor})
                  </span>
                  <span className="text-[10px] text-slate-400">Contrôle & Signature</span>
                </div>
                <div className="p-4 border border-slate-300 rounded-lg h-24 flex flex-col justify-between">
                  <span className="font-bold uppercase text-[10px] text-slate-600">
                    Validation Direction
                  </span>
                  <span className="text-[10px] text-slate-400">Cachet & Approbation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isConfirmValidateOpen}
        title="Validation définitive de l'inventaire physique (Par Marque)"
        message={`Êtes-vous sûr de vouloir valider la session ${session.code} ? Les ${uncountedCount} ligne(s) non saisies conserveront automatiquement leur quantité théorique par marque (aucun écart généré). Cette action va enregistrer officiellement les ${varianceCount} ajustement(s) constaté(s) par marque dans le dépôt ${warehouse?.name} et verrouiller la session.`}
        confirmLabel="Valider et régulariser les stocks par marque"
        variant="primary"
        onConfirm={handleValidateSession}
        onCancel={() => setIsConfirmValidateOpen(false)}
      />

      <ConfirmModal
        isOpen={isConfirmCancelOpen}
        title="Annuler la session d'inventaire"
        message="Êtes-vous sûr de vouloir annuler cette session ? Les comptages non validés seront abandonnés."
        confirmLabel="Confirmer l'annulation"
        variant="danger"
        onConfirm={handleCancelSession}
        onCancel={() => setIsConfirmCancelOpen(false)}
      />
    </div>
  );
};
