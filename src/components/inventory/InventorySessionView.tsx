import React, { useState, useMemo, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import {
  ALL_ARTICLE_CATEGORIES,
  ArticleCategory,
  InventoryItemCount,
  InventorySession,
} from '../../types';
import { formatDate, formatDateTime, formatFCFA, exportToCSV } from '../../utils/formatters';
import { cleanBrandName, stripWarehousePrefix } from '../../utils/articleHelpers';
import { downloadElementAsPdf, printElementById } from '../../utils/pdfExporter';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  CheckCheck,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  Pencil,
  Check,
  X,
  Ban,
  Minus,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';
import { NumericInput } from '../common/NumericInput';
import { TablePagination, usePagination } from '../common/TablePagination';
import { SearchField } from '../common/SearchField';

interface InventorySessionViewProps {
  session: InventorySession;
  onBack: () => void;
  onSuccess: (message: string) => void;
}

type StatusFilter = 'ALL' | 'UNCOUNTED' | 'VARIANCES' | 'EXACT';
type SortKey = 'LOCATION' | 'REFERENCE' | 'VARIANCE' | 'THEORETICAL';

interface CountInputProps {
  value: number | null;
  disabled: boolean;
  onCommit: (next: number | null) => void;
  ariaLabel: string;
}

/**
 * Champ dédié au comptage physique :
 * distingue clairement `null` (champ vide = non compté) et `0` (zéro compté).
 */
const CountQtyInput: React.FC<CountInputProps> = ({ value, disabled, onCommit, ariaLabel }) => {
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value));

  useEffect(() => {
    setDraft(value === null ? '' : String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setDraft('');
      onCommit(null);
      return;
    }
    if (!/^\d+$/.test(raw)) return;
    setDraft(raw);
    onCommit(Math.max(0, parseInt(raw, 10)));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      disabled={disabled}
      onChange={handleChange}
      placeholder="—"
      aria-label={ariaLabel}
      className="w-16 h-8 px-1.5 text-center font-mono text-sm font-bold bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFCD11] disabled:bg-[#F4F4F4] dark:disabled:bg-[#262626] disabled:text-[#777777]"
    />
  );
};

export const InventorySessionView: React.FC<InventorySessionViewProps> = ({
  session,
  onBack,
  onSuccess,
}) => {
  const {
    articles,
    warehouses,
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
    currentPermissions,
  } = useStock();

  const warehouse = getWarehouseById(session.warehouseId);
  const isValidated = session.status === 'VALIDATED';
  const isCancelled = session.status === 'CANCELLED';
  const isLocked = isValidated || isCancelled;
  const canEdit = !isLocked && currentPermissions.canManageInventory;

  // Filtres & options d'affichage
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('LOCATION');
  const [blindMode, setBlindMode] = useState(false);

  // Édition rapide d'emplacement en ligne
  const [editingLocKey, setEditingLocKey] = useState<string | null>(null);
  const [editingLocValue, setEditingLocValue] = useState('');

  // Modals
  const [confirmAction, setConfirmAction] = useState<'VALIDATE' | 'CANCEL' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState<'BLIND' | 'PV'>(isValidated ? 'PV' : 'BLIND');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Formulaire ajout de pièce trouvée en rayon
  const [newRef, setNewRef] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState<ArticleCategory>('Filtration');
  const [newLocation, setNewLocation] = useState('');
  const [newCountedQty, setNewCountedQty] = useState<number>(1);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(0);
  const [newSalePrice, setNewSalePrice] = useState<number>(0);
  const [addError, setAddError] = useState<string | null>(null);

  const rowKey = (item: InventoryItemCount) =>
    `${item.articleId}__${cleanBrandName(item.brand).toLowerCase()}`;

  // Enrichir les lignes avec les infos article et emplacement normalisé
  const enrichedItems = useMemo(() => {
    return session.items.map((item) => {
      const article = getArticleById(item.articleId);
      const brand = cleanBrandName(item.brand);
      const rawLoc = item.location || article?.defaultLocation || '';
      const location = stripWarehousePrefix(rawLoc, warehouses, warehouse?.name) || 'Non renseigné';
      const variance =
        item.countedQty !== null && item.countedQty !== undefined
          ? item.countedQty - item.theoreticalQty
          : 0;
      const varianceValue = variance * (item.unitCost || 0);

      return {
        ...item,
        brand,
        location,
        variance,
        varianceValue,
        mainReference: article?.mainReference || item.articleId,
        designation: article?.designation || 'Article supprimé',
        category: article?.category || ('Cabine, Carrosserie & Divers' as ArticleCategory),
        unit: article?.unit || 'Unité',
        key: `${item.articleId}__${brand.toLowerCase()}`,
      };
    });
  }, [session.items, getArticleById, warehouses, warehouse?.name]);

  // Liste des emplacements disponibles dans la session
  const locationOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of enrichedItems) {
      map.set(it.location, (map.get(it.location) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  }, [enrichedItems]);

  // Statistiques globales de la session
  const stats = useMemo(() => {
    const total = enrichedItems.length;
    let counted = 0;
    let varianceCount = 0;
    let exactCount = 0;
    let netQtyVariance = 0;
    let totalVarianceValue = 0;
    let totalCountedUnits = 0;

    for (const it of enrichedItems) {
      if (it.countedQty !== null && it.countedQty !== undefined) {
        counted++;
        totalCountedUnits += it.countedQty;
        if (it.variance !== 0) {
          varianceCount++;
          netQtyVariance += it.variance;
          totalVarianceValue += it.varianceValue;
        } else {
          exactCount++;
        }
      }
    }

    const uncounted = total - counted;
    const progressPct = total > 0 ? Math.round((counted / total) * 100) : 0;

    return {
      total,
      counted,
      uncounted,
      varianceCount,
      exactCount,
      netQtyVariance,
      totalVarianceValue,
      totalCountedUnits,
      progressPct,
    };
  }, [enrichedItems]);

  // Filtrage et tri
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const result = enrichedItems.filter((it) => {
      if (statusFilter === 'UNCOUNTED' && it.countedQty !== null) return false;
      if (statusFilter === 'VARIANCES' && (it.countedQty === null || it.variance === 0)) {
        return false;
      }
      if (statusFilter === 'EXACT' && (it.countedQty === null || it.variance !== 0)) {
        return false;
      }
      if (locationFilter !== 'ALL' && it.location !== locationFilter) return false;

      if (q) {
        const hay = [
          it.mainReference,
          it.designation,
          it.brand,
          it.brandReference || '',
          it.location,
          it.notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'REFERENCE') {
        return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
      }
      if (sortBy === 'VARIANCE') {
        const absDiff = Math.abs(b.variance) - Math.abs(a.variance);
        if (absDiff !== 0) return absDiff;
        return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
      }
      if (sortBy === 'THEORETICAL') {
        const diff = b.theoreticalQty - a.theoreticalQty;
        if (diff !== 0) return diff;
        return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
      }
      // LOCATION par défaut
      const locCmp = a.location.localeCompare(b.location, 'fr', { numeric: true });
      if (locCmp !== 0) return locCmp;
      return a.mainReference.localeCompare(b.mainReference, 'fr', { numeric: true });
    });

    return result;
  }, [enrichedItems, statusFilter, locationFilter, searchTerm, sortBy]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedItems,
  } = usePagination(filteredItems, 25);

  const uncountedInFiltered = useMemo(
    () => filteredItems.filter((it) => it.countedQty === null),
    [filteredItems]
  );

  // Marquer toutes les lignes non comptées du filtre actif comme conformes au stock théorique
  const handleMarkFilteredConform = () => {
    if (!canEdit || uncountedInFiltered.length === 0) return;
    batchUpdateInventoryCounts(
      session.id,
      uncountedInFiltered.map((it) => ({
        articleId: it.articleId,
        brand: it.brand || undefined,
        countedQty: it.theoreticalQty,
      }))
    );
    onSuccess(
      `${uncountedInFiltered.length} ligne${uncountedInFiltered.length > 1 ? 's' : ''} marquée${uncountedInFiltered.length > 1 ? 's' : ''} conforme${uncountedInFiltered.length > 1 ? 's' : ''}.`
    );
  };

  // Synchronisation manuelle sur demande explicite (jamais automatique en boucle)
  const handleManualSync = () => {
    if (!canEdit) return;
    const res = syncInventorySessionBrands(session.id);
    if (res.success) {
      onSuccess(
        res.addedLines > 0
          ? `${res.addedLines} nouvelle(s) ligne(s) ajoutée(s) depuis le catalogue.`
          : 'La liste d’inventaire est déjà à jour avec le catalogue.'
      );
    } else if (res.error) {
      setFeedbackError(res.error);
    }
  };

  // Sauvegarde d'un nouvel emplacement en ligne
  const handleSaveLocation = (item: (typeof enrichedItems)[number]) => {
    const trimmed = editingLocValue.trim();
    if (trimmed && trimmed !== item.location) {
      const res = updateStockLocationInWarehouse(
        item.articleId,
        session.warehouseId,
        trimmed,
        item.brand || undefined
      );
      if (res.success) {
        onSuccess(`Emplacement mis à jour : ${trimmed}`);
      } else if (res.error) {
        setFeedbackError(res.error);
      }
    }
    setEditingLocKey(null);
    setEditingLocValue('');
  };

  // Export CSV propre
  const handleExportCSV = () => {
    const headers = [
      'Référence',
      'Désignation',
      'Marque',
      'Emplacement',
      'Stock théorique',
      'Quantité comptée',
      'Écart',
      ...(currentPermissions.canViewPurchasePrices
        ? ['Coût unitaire (FCFA)', 'Impact financier (FCFA)']
        : []),
      'Observation',
    ];

    const rows = filteredItems.map((it) => [
      it.mainReference,
      it.designation,
      it.brand || '-',
      it.location,
      it.theoreticalQty,
      it.countedQty === null ? '' : it.countedQty,
      it.countedQty === null ? '' : it.variance,
      ...(currentPermissions.canViewPurchasePrices
        ? [it.unitCost, it.countedQty === null ? '' : it.varianceValue]
        : []),
      it.notes || '',
    ]);

    exportToCSV(`${session.code}_${warehouse?.code || 'INV'}`, headers, rows);
    onSuccess('Export CSV téléchargé.');
  };

  // Validation ou Annulation
  const handleConfirmAction = () => {
    setFeedbackError(null);
    if (confirmAction === 'VALIDATE') {
      const res = validateInventorySession(session.id);
      if (res.success) {
        onSuccess(`Inventaire ${session.code} validé et stock ajusté.`);
      } else {
        setFeedbackError(res.error || 'Erreur lors de la validation.');
      }
    } else if (confirmAction === 'CANCEL') {
      const res = cancelInventorySession(session.id);
      if (res.success) {
        onSuccess(`Inventaire ${session.code} annulé.`);
      } else {
        setFeedbackError(res.error || 'Erreur lors de l’annulation.');
      }
    }
    setConfirmAction(null);
  };

  // Pré-remplissage intelligent si la référence tapée existe déjà au catalogue
  const matchedExistingArticle = useMemo(() => {
    const clean = newRef.trim().toLowerCase();
    if (!clean) return undefined;
    return articles.find((a) => a.mainReference.trim().toLowerCase() === clean);
  }, [newRef, articles]);

  useEffect(() => {
    if (matchedExistingArticle) {
      setNewDesignation(matchedExistingArticle.designation);
      setNewCategory(matchedExistingArticle.category);
      if (!newPurchasePrice) setNewPurchasePrice(matchedExistingArticle.purchasePrice || 0);
      if (!newSalePrice) setNewSalePrice(matchedExistingArticle.salePrice || 0);
      if (!newLocation && matchedExistingArticle.defaultLocation) {
        setNewLocation(matchedExistingArticle.defaultLocation);
      }
    }
  }, [matchedExistingArticle]);

  const openAddModal = () => {
    setNewRef('');
    setNewDesignation('');
    setNewBrand('');
    setNewCategory('Filtration');
    setNewLocation(locationFilter !== 'ALL' ? locationFilter : '');
    setNewCountedQty(1);
    setNewPurchasePrice(0);
    setNewSalePrice(0);
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddArticle = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newRef.trim()) {
      setAddError('La référence est obligatoire.');
      return;
    }
    if (!newDesignation.trim()) {
      setAddError('La désignation est obligatoire.');
      return;
    }

    const res = addArticleToInventorySession(
      session.id,
      {
        mainReference: newRef.trim().toUpperCase(),
        designation: newDesignation.trim(),
        brand: cleanBrandName(newBrand),
        category: newCategory,
        compatibleMachines: [],
        equivalentReferences: [],
        purchasePrice: Math.max(0, Number(newPurchasePrice) || 0),
        salePrice: Math.max(0, Number(newSalePrice) || 0),
        minStockThreshold: 2,
        defaultLocation: newLocation.trim() || 'Non renseigné',
        unit: 'Unité',
        status: 'active',
      },
      Math.max(0, Math.floor(Number(newCountedQty) || 0)),
      newLocation.trim() || undefined
    );

    if (res.success) {
      setShowAddModal(false);
      onSuccess(`Pièce ${newRef.trim().toUpperCase()} ajoutée à l’inventaire.`);
    } else {
      setAddError(res.error || 'Impossible d’ajouter cette pièce.');
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadElementAsPdf(
        'printable-inventory-sheet',
        `${session.code}_${printMode === 'BLIND' ? 'fiche_comptage' : 'proces_verbal'}.pdf`,
        'A4'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Erreur éventuelle */}
      {feedbackError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {feedbackError}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackError(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* En-tête session */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-[#F4F4F4] dark:bg-[#262626] hover:bg-[#E8E8E8] dark:hover:bg-[#333333] text-[#111111] dark:text-white border border-[#E0E0E0] dark:border-[#333333] cursor-pointer shrink-0"
              title="Retour à la liste"
              aria-label="Retour à la liste"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-lg sm:text-xl font-bold text-[#111111] dark:text-white">
                  {session.code}
                </h2>
                {isValidated ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validé &amp; Verrouillé
                  </span>
                ) : isCancelled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-[#F0F0F0] text-[#595959] dark:bg-[#2B2B2B] dark:text-slate-400 border border-[#D4D4D4] dark:border-[#444444]">
                    <Ban className="w-3.5 h-3.5" />
                    Annulé — Lecture seule
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-[#FFF9DF] text-[#7A5C00] dark:bg-[#FFCD11]/20 dark:text-[#FFCD11] border border-[#FFCD11]">
                    Comptage en cours
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#595959] dark:text-slate-400 mt-1">
                <span className="font-semibold text-[#111111] dark:text-slate-200">
                  {warehouse?.name || 'Magasin'}
                </span>
                <span>• {formatDate(session.date)}</span>
                {session.scopeSummary && <span>• {session.scopeSummary}</span>}
                {isValidated && session.validatedAt && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    • Validé le {formatDateTime(session.validatedAt)}
                    {session.validatedBy ? ` par ${session.validatedBy}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'action essentiels */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une pièce
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPrintMode(isValidated ? 'PV' : 'BLIND');
                setShowPrintModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white dark:bg-[#262626] hover:bg-[#F4F4F4] dark:hover:bg-[#333333] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white dark:bg-[#262626] hover:bg-[#F4F4F4] dark:hover:bg-[#333333] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmAction('CANCEL')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white dark:bg-[#262626] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('VALIDATE')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valider l’inventaire
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPI synthétiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
            <span>Progression</span>
            <span className="font-mono text-[#111111] dark:text-white">{stats.progressPct}%</span>
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-bold text-[#111111] dark:text-white">
            {stats.counted}{' '}
            <span className="text-xs font-normal text-[#595959] dark:text-slate-400">
              / {stats.total} lignes
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-[#F0F0F0] dark:bg-[#2B2B2B] overflow-hidden">
            <div
              className={`h-full transition-all ${
                isValidated ? 'bg-emerald-600' : isCancelled ? 'bg-slate-400' : 'bg-[#FFCD11]'
              }`}
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
            À compter
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-mono font-bold text-[#111111] dark:text-white">
            {stats.uncounted}
          </div>
          <div className="mt-1 text-[11px] text-[#595959] dark:text-slate-400">
            {stats.uncounted === 0 ? 'Toutes les lignes saisies' : 'Lignes en attente'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
            Écarts détectés
          </div>
          <div
            className={`mt-1.5 text-lg sm:text-xl font-mono font-bold ${
              blindMode
                ? 'text-[#595959] dark:text-slate-400'
                : stats.varianceCount > 0
                ? 'text-[#7A5C00] dark:text-[#FFCD11]'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {blindMode ? 'Masqué' : stats.varianceCount}
          </div>
          <div className="mt-1 text-[11px] text-[#595959] dark:text-slate-400">
            {blindMode
              ? 'Mode aveugle actif'
              : `Solde net : ${stats.netQtyVariance > 0 ? '+' : ''}${stats.netQtyVariance} u.`}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
            {currentPermissions.canViewPurchasePrices && !blindMode
              ? 'Impact financier'
              : 'Quantité comptée'}
          </div>
          {currentPermissions.canViewPurchasePrices && !blindMode ? (
            <>
              <div
                className={`mt-1.5 text-lg sm:text-xl font-mono font-bold ${
                  stats.totalVarianceValue < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : stats.totalVarianceValue > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-[#111111] dark:text-white'
                }`}
              >
                {stats.totalVarianceValue > 0 ? '+' : ''}
                {formatFCFA(stats.totalVarianceValue)}
              </div>
              <div className="mt-1 text-[11px] text-[#595959] dark:text-slate-400">
                Valorisation au prix d’achat
              </div>
            </>
          ) : (
            <>
              <div className="mt-1.5 text-lg sm:text-xl font-mono font-bold text-[#111111] dark:text-white">
                {stats.totalCountedUnits} u.
              </div>
              <div className="mt-1 text-[11px] text-[#595959] dark:text-slate-400">
                Total physique saisi
              </div>
            </>
          )}
        </div>
      </div>

      {/* Barre de filtres unifiée et épurée */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] p-4 space-y-3">
        {/* Ligne 1 : Recherche Variation 8 + Onglets de statut */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="w-full lg:max-w-md">
            <SearchField
              value={searchTerm}
              onChange={(v) => {
                setSearchTerm(v);
                setCurrentPage(1);
              }}
              placeholder="Référence, pièce, marque, rayon..."
              ariaLabel="Rechercher dans l'inventaire"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Tout', count: stats.total },
                { id: 'UNCOUNTED', label: 'À compter', count: stats.uncounted },
                { id: 'VARIANCES', label: 'Écarts', count: blindMode ? undefined : stats.varianceCount },
                { id: 'EXACT', label: 'Conformes', count: blindMode ? undefined : stats.exactCount },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#111111] text-white border-[#111111] dark:bg-[#FFCD11] dark:text-[#111111] dark:border-[#FFCD11]'
                      : 'bg-white dark:bg-[#262626] text-[#595959] dark:text-slate-300 border-[#E0E0E0] dark:border-[#333333] hover:border-[#111111]'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1.5 font-mono opacity-75">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ligne 2 : Rayon, Tri, Mode aveugle, Actions rapides */}
        <div className="pt-2.5 border-t border-[#EFEFEF] dark:border-[#2C2C2C] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filtrer par emplacement"
              className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
            >
              <option value="ALL">Tous les emplacements ({locationOptions.length})</option>
              {locationOptions.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name} ({loc.count})
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Trier les lignes"
              className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
            >
              <option value="LOCATION">Tri : Emplacement</option>
              <option value="REFERENCE">Tri : Référence</option>
              <option value="VARIANCE">Tri : Écarts importants</option>
              <option value="THEORETICAL">Tri : Stock théorique</option>
            </select>

            <button
              type="button"
              onClick={() => setBlindMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                blindMode
                  ? 'bg-[#FFF9DF] dark:bg-[#FFCD11]/20 text-[#7A5C00] dark:text-[#FFCD11] border-[#FFCD11]'
                  : 'bg-white dark:bg-[#262626] text-[#595959] dark:text-slate-300 border-[#CCCCCC] dark:border-[#444444] hover:border-[#111111]'
              }`}
              title="Masquer le stock théorique pendant le comptage"
            >
              {blindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              Mode aveugle
            </button>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {!blindMode && uncountedInFiltered.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkFilteredConform}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marquer conformes ({uncountedInFiltered.length})
                </button>
              )}

              <button
                type="button"
                onClick={handleManualSync}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-[#262626] hover:bg-[#F4F4F4] dark:hover:bg-[#333333] text-[#595959] dark:text-slate-300 border border-[#CCCCCC] dark:border-[#444444] cursor-pointer"
                title="Ajouter les nouvelles pièces créées au catalogue depuis le début de la session"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Actualiser catalogue</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zone de comptage : Tableau Desktop + Cartes Mobile */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#595959] dark:text-slate-400">
            Aucune pièce ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <>
            {/* Vue Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F4F4F4] dark:bg-[#262626] border-b border-[#E0E0E0] dark:border-[#333333] text-[11px] font-bold uppercase tracking-wider text-[#595959] dark:text-slate-400">
                    <th className="py-3 px-4">Pièce &amp; Emplacement</th>
                    {!blindMode && <th className="py-3 px-3 text-center w-24">Théorique</th>}
                    <th className="py-3 px-3 text-center w-52">Quantité comptée</th>
                    {!blindMode && <th className="py-3 px-3 text-center w-36">Écart</th>}
                    <th className="py-3 px-4 w-56">Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEF] dark:divide-[#2C2C2C] text-sm">
                  {paginatedItems.map((item) => {
                    const key = rowKey(item);
                    const isCounted = item.countedQty !== null;
                    const hasVariance = isCounted && item.variance !== 0;
                    const isEditingLoc = editingLocKey === key;

                    return (
                      <tr
                        key={key}
                        className={`transition-colors ${
                          !blindMode && hasVariance
                            ? item.variance < 0
                              ? 'bg-rose-50/40 dark:bg-rose-950/15'
                              : 'bg-[#FFF9DF]/50 dark:bg-[#FFCD11]/5'
                            : 'hover:bg-[#FAFAFA] dark:hover:bg-[#242424]'
                        }`}
                      >
                        {/* Pièce & Emplacement */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#111111] dark:text-white tracking-tight">
                              {item.mainReference}
                            </span>
                            {item.brand && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#F0F0F0] dark:bg-[#2D2D2D] text-[#333333] dark:text-slate-200 border border-[#D9D9D9] dark:border-[#444444]">
                                {item.brand}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#333333] dark:text-slate-300 mt-0.5">
                            {item.designation}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#595959] dark:text-slate-400">
                            <MapPin className="w-3 h-3 text-[#7A5C00] dark:text-[#FFCD11] shrink-0" />
                            {isEditingLoc ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingLocValue}
                                  onChange={(e) => setEditingLocValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveLocation(item);
                                    if (e.key === 'Escape') setEditingLocKey(null);
                                  }}
                                  autoFocus
                                  className="px-1.5 py-0.5 text-xs bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-white border border-[#111111] dark:border-[#FFCD11] w-36 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveLocation(item)}
                                  className="p-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                                  title="Enregistrer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingLocKey(null)}
                                  className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  title="Annuler"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span>{item.location}</span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLocKey(key);
                                      setEditingLocValue(
                                        item.location === 'Non renseigné' ? '' : item.location
                                      );
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-[#111111] dark:hover:text-[#FFCD11] cursor-pointer"
                                    title="Modifier l’emplacement"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* Théorique */}
                        {!blindMode && (
                          <td className="py-3 px-3 text-center align-middle">
                            <span className="font-mono text-sm font-bold text-[#111111] dark:text-slate-200">
                              {item.theoreticalQty}
                            </span>
                          </td>
                        )}

                        {/* Quantité comptée */}
                        <td className="py-3 px-3 align-middle">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  const current = item.countedQty ?? item.theoreticalQty;
                                  updateInventoryCount(
                                    session.id,
                                    item.articleId,
                                    Math.max(0, current - 1),
                                    item.notes,
                                    item.brand || undefined
                                  );
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-[#F4F4F4] dark:bg-[#262626] hover:bg-[#E5E5E5] dark:hover:bg-[#333333] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] cursor-pointer"
                                title="Diminuer de 1"
                                aria-label="Diminuer de 1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <CountQtyInput
                              value={item.countedQty}
                              disabled={!canEdit}
                              ariaLabel={`Quantité comptée pour ${item.mainReference}`}
                              onCommit={(val) =>
                                updateInventoryCount(
                                  session.id,
                                  item.articleId,
                                  val,
                                  item.notes,
                                  item.brand || undefined
                                )
                              }
                            />

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  const current = item.countedQty ?? 0;
                                  updateInventoryCount(
                                    session.id,
                                    item.articleId,
                                    current + 1,
                                    item.notes,
                                    item.brand || undefined
                                  );
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-[#F4F4F4] dark:bg-[#262626] hover:bg-[#E5E5E5] dark:hover:bg-[#333333] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] cursor-pointer"
                                title="Augmenter de 1"
                                aria-label="Augmenter de 1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canEdit && !blindMode && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateInventoryCount(
                                    session.id,
                                    item.articleId,
                                    item.theoreticalQty,
                                    item.notes,
                                    item.brand || undefined
                                  )
                                }
                                className={`w-8 h-8 flex items-center justify-center border transition-colors cursor-pointer ${
                                  isCounted && item.variance === 0
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white dark:bg-[#262626] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                }`}
                                title={`Valider conforme (= ${item.theoreticalQty})`}
                                aria-label="Marquer conforme au théorique"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Écart */}
                        {!blindMode && (
                          <td className="py-3 px-3 text-center align-middle">
                            {!isCounted ? (
                              <span className="text-xs text-[#888888]">À compter</span>
                            ) : item.variance === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Conforme
                              </span>
                            ) : (
                              <div>
                                <span
                                  className={`inline-block px-2 py-0.5 font-mono text-xs font-bold ${
                                    item.variance < 0
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-[#FFF9DF] text-[#7A5C00] dark:bg-[#FFCD11]/20 dark:text-[#FFCD11] border border-[#FFCD11]'
                                  }`}
                                >
                                  {item.variance > 0 ? `+${item.variance}` : item.variance}
                                </span>
                                {currentPermissions.canViewPurchasePrices && item.unitCost > 0 && (
                                  <div className="text-[10px] font-mono text-[#595959] dark:text-slate-400 mt-0.5">
                                    {item.varianceValue > 0 ? '+' : ''}
                                    {formatFCFA(item.varianceValue)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}

                        {/* Observation */}
                        <td className="py-3 px-4 align-middle">
                          <input
                            type="text"
                            defaultValue={item.notes || ''}
                            key={`${key}-${item.notes || ''}`}
                            disabled={!canEdit}
                            onBlur={(e) => {
                              const nextNote = e.target.value.trim();
                              if (nextNote !== (item.notes || '')) {
                                updateInventoryCount(
                                  session.id,
                                  item.articleId,
                                  item.countedQty,
                                  nextNote,
                                  item.brand || undefined
                                );
                              }
                            }}
                            placeholder={canEdit ? 'Note (casse, perte...)' : '—'}
                            className="w-full px-2.5 py-1.5 text-xs bg-transparent text-[#111111] dark:text-slate-200 border border-transparent hover:border-[#D4D4D4] dark:hover:border-[#444444] focus:bg-white dark:focus:bg-[#1A1A1A] focus:border-[#111111] dark:focus:border-[#FFCD11] focus:outline-none disabled:hover:border-transparent"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vue Mobile (Cartes tactiles sans chevauchement) */}
            <div className="md:hidden divide-y divide-[#E0E0E0] dark:divide-[#333333]">
              {paginatedItems.map((item) => {
                const key = rowKey(item);
                const isCounted = item.countedQty !== null;
                const hasVariance = isCounted && item.variance !== 0;

                return (
                  <div
                    key={key}
                    className={`p-3.5 space-y-2.5 ${
                      !blindMode && hasVariance
                        ? item.variance < 0
                          ? 'bg-rose-50/40 dark:bg-rose-950/15'
                          : 'bg-[#FFF9DF]/50 dark:bg-[#FFCD11]/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-[#111111] dark:text-white">
                            {item.mainReference}
                          </span>
                          {item.brand && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#F0F0F0] dark:bg-[#2D2D2D] text-[#333333] dark:text-slate-200">
                              {item.brand}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#333333] dark:text-slate-300 mt-0.5 leading-snug">
                          {item.designation}
                        </p>
                        <div className="text-[11px] text-[#595959] dark:text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#7A5C00] dark:text-[#FFCD11]" />
                          <span>{item.location}</span>
                        </div>
                      </div>

                      {/* Badge écart mobile */}
                      {!blindMode && (
                        <div className="shrink-0 text-right">
                          {!isCounted ? (
                            <span className="text-[11px] font-medium text-[#888888]">À compter</span>
                          ) : item.variance === 0 ? (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Conforme
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 font-mono text-xs font-bold ${
                                item.variance < 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-[#FFF9DF] text-[#7A5C00] dark:bg-[#FFCD11]/20 dark:text-[#FFCD11]'
                              }`}
                            >
                              {item.variance > 0 ? `+${item.variance}` : item.variance}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contrôles quantité tactiles */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {!blindMode && (
                        <div className="text-xs text-[#595959] dark:text-slate-400">
                          Théo :{' '}
                          <strong className="font-mono text-[#111111] dark:text-white">
                            {item.theoreticalQty}
                          </strong>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = item.countedQty ?? item.theoreticalQty;
                              updateInventoryCount(
                                session.id,
                                item.articleId,
                                Math.max(0, current - 1),
                                item.notes,
                                item.brand || undefined
                              );
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-[#F4F4F4] dark:bg-[#262626] border border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white"
                            aria-label="Diminuer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}

                        <CountQtyInput
                          value={item.countedQty}
                          disabled={!canEdit}
                          ariaLabel={`Quantité comptée ${item.mainReference}`}
                          onCommit={(val) =>
                            updateInventoryCount(
                              session.id,
                              item.articleId,
                              val,
                              item.notes,
                              item.brand || undefined
                            )
                          }
                        />

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = item.countedQty ?? 0;
                              updateInventoryCount(
                                session.id,
                                item.articleId,
                                current + 1,
                                item.notes,
                                item.brand || undefined
                              );
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-[#F4F4F4] dark:bg-[#262626] border border-[#CCCCCC] dark:border-[#444444] text-[#111111] dark:text-white"
                            aria-label="Augmenter"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}

                        {canEdit && !blindMode && (
                          <button
                            type="button"
                            onClick={() =>
                              updateInventoryCount(
                                session.id,
                                item.articleId,
                                item.theoreticalQty,
                                item.notes,
                                item.brand || undefined
                              )
                            }
                            className={`px-2.5 h-9 text-xs font-bold border ${
                              isCounted && item.variance === 0
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white dark:bg-[#262626] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            = Théo
                          </button>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <input
                        type="text"
                        defaultValue={item.notes || ''}
                        key={`m-${key}-${item.notes || ''}`}
                        onBlur={(e) => {
                          const nextNote = e.target.value.trim();
                          if (nextNote !== (item.notes || '')) {
                            updateInventoryCount(
                              session.id,
                              item.articleId,
                              item.countedQty,
                              nextNote,
                              item.brand || undefined
                            );
                          }
                        }}
                        placeholder="Observation (optionnel)..."
                        className="w-full px-2.5 py-1.5 text-xs bg-[#F8F8F8] dark:bg-[#262626] text-[#111111] dark:text-slate-200 border border-[#E0E0E0] dark:border-[#333333] focus:outline-none focus:border-[#111111]"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[15, 25, 50, 100]}
              itemLabel="lignes"
            />
          </>
        )}
      </div>

      {/* Modal : Ajouter une pièce trouvée en rayon */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#111111] dark:border-[#444444] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#111111] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-5 bg-[#FFCD11]" />
                <h3 className="text-sm font-bold">Ajouter une pièce à l’inventaire</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddArticle} className="p-5 space-y-3.5">
              {addError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs font-medium">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                  Référence *
                </label>
                <input
                  type="text"
                  required
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  placeholder="Ex: 1R-0716"
                  className="w-full px-3 py-2 text-sm font-mono font-bold uppercase bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
                />
                {matchedExistingArticle && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                    Référence existante au catalogue : champs pré-remplis automatiquement.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                  Désignation *
                </label>
                <input
                  type="text"
                  required
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  placeholder="Ex: Filtre à huile moteur"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                    Marque (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Ex: CAT, CTP..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                    Emplacement
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: R-A1-04"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                    Quantité comptée *
                  </label>
                  <NumericInput
                    value={newCountedQty}
                    onChange={setNewCountedQty}
                    min={0}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444] focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ArticleCategory)}
                    className="w-full px-2.5 py-2 text-xs font-semibold bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444]"
                  >
                    {ALL_ARTICLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!matchedExistingArticle && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                      Prix achat (FCFA)
                    </label>
                    <NumericInput
                      value={newPurchasePrice}
                      onChange={setNewPurchasePrice}
                      min={0}
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#595959] dark:text-slate-300 mb-1">
                      Prix vente (FCFA)
                    </label>
                    <NumericInput
                      value={newSalePrice}
                      onChange={setNewSalePrice}
                      min={0}
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#262626] text-[#111111] dark:text-white border border-[#CCCCCC] dark:border-[#444444]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E0E0E0] dark:border-[#333333]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#595959] dark:text-slate-300 border border-[#CCCCCC] dark:border-[#444444] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] border border-[#111111] cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'impression A4 / PDF */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#111111] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Barre d'outils d'impression */}
            <div className="px-4 py-3 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintMode('BLIND')}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                    printMode === 'BLIND'
                      ? 'bg-[#FFCD11] text-[#111111] border-[#FFCD11]'
                      : 'bg-transparent text-slate-300 border-slate-600 hover:text-white'
                  }`}
                >
                  Fiche de comptage (Aveugle)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('PV')}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                    printMode === 'PV'
                      ? 'bg-[#FFCD11] text-[#111111] border-[#FFCD11]'
                      : 'bg-transparent text-slate-300 border-slate-600 hover:text-white'
                  }`}
                >
                  Procès-verbal complet
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {isExportingPdf ? 'Export...' : 'PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => printElementById('printable-inventory-sheet', 'A4')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#FFCD11] hover:bg-[#E5B700] text-[#111111] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer A4
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Aperçu A4 imprimable */}
            <div className="flex-1 overflow-y-auto bg-[#F0F0F0] p-4 sm:p-6">
              <div
                id="printable-inventory-sheet"
                className="bg-white text-black mx-auto max-w-[800px] p-6 sm:p-8 shadow-sm border border-neutral-300"
              >
                {/* En-tête document */}
                <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-4">
                  <div>
                    <div className="text-lg font-extrabold uppercase tracking-tight">
                      {companyInfo.name}
                    </div>
                    <div className="text-xs text-neutral-600 mt-0.5">{companyInfo.address}</div>
                    <div className="text-xs text-neutral-600">{companyInfo.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold uppercase">
                      {printMode === 'BLIND'
                        ? 'Fiche de comptage physique'
                        : 'Procès-verbal d’inventaire'}
                    </div>
                    <div className="font-mono text-sm font-bold mt-0.5">{session.code}</div>
                    <div className="text-xs text-neutral-600 mt-0.5">
                      Date : {formatDate(session.date)}
                    </div>
                  </div>
                </div>

                {/* Métadonnées */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-neutral-300 p-3 mb-4 bg-neutral-50">
                  <div>
                    <span className="block text-[10px] uppercase text-neutral-500 font-bold">
                      Magasin
                    </span>
                    <span className="font-bold">{warehouse?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-neutral-500 font-bold">
                      Responsable
                    </span>
                    <span className="font-bold">{session.supervisor}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-neutral-500 font-bold">
                      Statut
                    </span>
                    <span className="font-bold">
                      {isValidated ? 'Validé' : isCancelled ? 'Annulé' : 'En cours'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-neutral-500 font-bold">
                      Lignes imprimées
                    </span>
                    <span className="font-mono font-bold">{filteredItems.length}</span>
                  </div>
                </div>

                {/* Tableau A4 */}
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-y-2 border-black bg-neutral-100">
                      <th className="py-2 px-2 font-bold">Emplacement</th>
                      <th className="py-2 px-2 font-bold">Référence</th>
                      <th className="py-2 px-2 font-bold">Désignation</th>
                      <th className="py-2 px-2 font-bold">Marque</th>
                      {printMode === 'PV' && (
                        <th className="py-2 px-2 font-bold text-center">Théo.</th>
                      )}
                      <th className="py-2 px-2 font-bold text-center w-20">Compté</th>
                      {printMode === 'PV' && (
                        <th className="py-2 px-2 font-bold text-center">Écart</th>
                      )}
                      <th className="py-2 px-2 font-bold">Observation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300">
                    {filteredItems.map((it) => (
                      <tr key={`p-${rowKey(it)}`}>
                        <td className="py-1.5 px-2 whitespace-nowrap">{it.location}</td>
                        <td className="py-1.5 px-2 font-mono font-bold whitespace-nowrap">
                          {it.mainReference}
                        </td>
                        <td className="py-1.5 px-2">{it.designation}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">{it.brand || '-'}</td>
                        {printMode === 'PV' && (
                          <td className="py-1.5 px-2 text-center font-mono">{it.theoreticalQty}</td>
                        )}
                        <td className="py-1.5 px-2 text-center font-mono font-bold">
                          {printMode === 'BLIND' ? (
                            <span className="inline-block w-14 h-5 border border-neutral-400" />
                          ) : it.countedQty === null ? (
                            '—'
                          ) : (
                            it.countedQty
                          )}
                        </td>
                        {printMode === 'PV' && (
                          <td className="py-1.5 px-2 text-center font-mono font-bold">
                            {it.countedQty === null
                              ? '—'
                              : it.variance > 0
                              ? `+${it.variance}`
                              : it.variance}
                          </td>
                        )}
                        <td className="py-1.5 px-2 text-neutral-700">{it.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Synthèse & Signatures */}
                {printMode === 'PV' && (
                  <div className="mt-4 pt-3 border-t border-black flex flex-wrap justify-between gap-4 text-xs">
                    <div>
                      Lignes comptées :{' '}
                      <strong className="font-mono">
                        {stats.counted}/{stats.total}
                      </strong>{' '}
                      • Écarts : <strong className="font-mono">{stats.varianceCount}</strong>
                    </div>
                    {currentPermissions.canViewPurchasePrices && (
                      <div>
                        Impact valorisé :{' '}
                        <strong className="font-mono">
                          {stats.totalVarianceValue > 0 ? '+' : ''}
                          {formatFCFA(stats.totalVarianceValue)}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
                  <div className="border-t border-neutral-400 pt-2">
                    <div className="font-bold">Agent de comptage</div>
                    <div className="text-neutral-500 mt-6">Nom &amp; Signature :</div>
                  </div>
                  <div className="border-t border-neutral-400 pt-2">
                    <div className="font-bold">Responsable / Direction</div>
                    <div className="text-neutral-500 mt-6">Validation &amp; Cachet :</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ConfirmModal Validation / Annulation */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        title={
          confirmAction === 'VALIDATE'
            ? 'Valider cet inventaire ?'
            : 'Annuler cette session d’inventaire ?'
        }
        message={
          confirmAction === 'VALIDATE'
            ? `Les écarts constatés (${stats.varianceCount} ligne${stats.varianceCount > 1 ? 's' : ''}) vont ajuster définitivement le stock du magasin ${warehouse?.name || ''}.${
                stats.uncounted > 0
                  ? ` Les ${stats.uncounted} ligne(s) non comptée(s) conserveront leur quantité théorique actuelle.`
                  : ''
              } La session sera verrouillée après validation.`
            : 'Cette session passera en lecture seule et aucun ajustement ne sera appliqué au stock.'
        }
        confirmLabel={confirmAction === 'VALIDATE' ? 'Valider et ajuster le stock' : 'Annuler la session'}
        variant={confirmAction === 'VALIDATE' ? 'primary' : 'danger'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
