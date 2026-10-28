import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useStock } from '../../context/StockContext';
import {
  ImportMode,
  ImportFieldMapping,
  ParsedImportRow,
  ImportResultReport,
} from '../../types';
import { formatFCFA, exportToCSV } from '../../utils/formatters';
import {
  autoDetectMapping,
  parseAndValidateImportRows,
  TEMPLATE_HEADERS,
  SAMPLE_ROWS,
} from '../../utils/importParser';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  FileText,
  Building2,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface ImportCatalogViewProps {
  onNavigateToCatalog?: () => void;
}

export const ImportCatalogView: React.FC<ImportCatalogViewProps> = ({
  onNavigateToCatalog,
}) => {
  const {
    warehouses,
    selectedWarehouseId,
    articles,
    executeImport,
    currentUser,
  } = useStock();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<ImportMode>('INITIAL_IMPORT');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(() => {
    if (selectedWarehouseId) return selectedWarehouseId;
    return warehouses[0]?.id || '';
  });
  const [overwriteStockConfirmed, setOverwriteStockConfirmed] = useState(false);

  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  const [mapping, setMapping] = useState<ImportFieldMapping>({
    mainReference: '',
    designation: '',
    brand: '',
    category: '',
    initialQuantity: '',
    purchasePrice: '',
    salePrice: '',
    preferredSupplier: '',
    warehouse: '',
    physicalLocation: '',
    rack: '',
    shelf: '',
    bin: '',
    minStockThreshold: '',
    barcode: '',
    imageUrl: '',
    equivalentReferences: '',
  });

  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'ERROR'>('ALL');
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultReport, setResultReport] = useState<ImportResultReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSizeStr(
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
        : `${Math.round(file.size / 1024)} Ko`
    );

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Le classeur ne contient aucune feuille.');
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const parsed: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (parsed.length === 0) {
        throw new Error('Le fichier sélectionné est vide.');
      }

      const columns = Object.keys(parsed[0] || {});
      setAvailableColumns(columns);
      setRawRows(parsed);

      const detected = autoDetectMapping(columns);
      setMapping(detected);

      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de lire le fichier. Assurez-vous d’un format Excel ou CSV valide.');
    }
  };

  const handleDownloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 38 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 25 },
      { wch: 32 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Catalogue_EquipStock');
    XLSX.writeFile(wb, 'modele_import_catalogue_equipstock.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
    exportToCSV('modele_import_catalogue_equipstock', TEMPLATE_HEADERS, SAMPLE_ROWS);
  };

  const parsedRows: ParsedImportRow[] = useMemo(() => {
    return parseAndValidateImportRows(
      rawRows,
      mapping,
      articles,
      warehouses,
      mode,
      targetWarehouseId
    );
  }, [rawRows, mapping, articles, warehouses, mode, targetWarehouseId]);

  const validRowsCount = useMemo(
    () => parsedRows.filter((r) => r.status === 'VALID' || r.status === 'WARNING').length,
    [parsedRows]
  );
  const errorRowsCount = useMemo(
    () => parsedRows.filter((r) => r.status === 'ERROR').length,
    [parsedRows]
  );
  const duplicatesCount = useMemo(
    () => parsedRows.filter((r) => r.isDuplicateInCatalog).length,
    [parsedRows]
  );
  const positiveQtyRowsCount = useMemo(
    () => parsedRows.filter((r) => (r.status === 'VALID' || r.status === 'WARNING') && r.initialQuantity > 0).length,
    [parsedRows]
  );
  const totalQtySum = useMemo(
    () =>
      parsedRows
        .filter((r) => r.status === 'VALID' || r.status === 'WARNING')
        .reduce((sum, r) => sum + (r.initialQuantity || 0), 0),
    [parsedRows]
  );

  const displayedRows = useMemo(() => {
    if (previewFilter === 'VALID') {
      return parsedRows.filter((r) => r.status === 'VALID' || r.status === 'WARNING');
    }
    if (previewFilter === 'ERROR') {
      return parsedRows.filter((r) => r.status === 'ERROR');
    }
    return parsedRows;
  }, [parsedRows, previewFilter]);

  const handleExecuteImport = () => {
    if (!targetWarehouseId) {
      setErrorMessage('Veuillez sélectionner un magasin de destination.');
      return;
    }

    if (validRowsCount === 0) {
      setErrorMessage('Aucune ligne valide à importer. Veuillez corriger les correspondances ou le fichier.');
      return;
    }

    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = executeImport({
        mode,
        fileName,
        rows: parsedRows,
        targetWarehouseId,
        overwriteExistingStock: overwriteStockConfirmed,
      });

      if (res.success && res.report) {
        setResultReport(res.report);
        setStep(3);
      } else {
        setErrorMessage(res.error || 'Une erreur est survenue lors de l\'importation.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur inattendue.');
    } finally {
      setIsExecuting(false);
    }
  };

  const selectedWh = warehouses.find((w) => w.id === targetWarehouseId);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
            <FileSpreadsheet className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Importation des Produits & Stocks
              </h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                Excel & CSV
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chargement automatisé du catalogue de pièces d'engins lourds et initialisation sécurisée des dépôts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadExcelTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Modèle Excel (.xlsx)
          </button>
          <button
            onClick={handleDownloadCsvTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-700" />
            Modèle CSV (.csv)
          </button>
        </div>
      </div>

      {/* Breadcrumb Steps */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-3 text-xs overflow-x-auto">
        <div
          className={`flex items-center gap-2 font-semibold ${
            step >= 1 ? 'text-amber-600' : 'text-slate-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'
            }`}
          >
            1
          </span>
          Sélection du fichier & Magasin
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        <div
          className={`flex items-center gap-2 font-semibold ${
            step >= 2 ? 'text-amber-600' : 'text-slate-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'
            }`}
          >
            2
          </span>
          Correspondance (Mapping) & Contrôle qualité
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        <div
          className={`flex items-center gap-2 font-semibold ${
            step === 3 ? 'text-emerald-700' : 'text-slate-400'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            3
          </span>
          Rapport & Traçabilité des stocks
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-sm block">Attention lors du traitement</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Type d'opération d'importation :
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  onClick={() => setMode('INITIAL_IMPORT')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === 'INITIAL_IMPORT'
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                      Opération A
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        mode === 'INITIAL_IMPORT'
                          ? 'bg-amber-500 text-slate-950 font-mono'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {mode === 'INITIAL_IMPORT' ? 'Activé' : 'Sélectionner'}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1">
                    Importation initiale (Catalogue & Stock)
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Crée ou met à jour les références pivots, enregistre les différentes marques associées avec leurs tarifs respectifs et initialise le stock physique audité dans le magasin.
                  </p>
                </div>

                <div
                  onClick={() => setMode('CATALOG_UPDATE')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === 'CATALOG_UPDATE'
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                      Opération B
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        mode === 'CATALOG_UPDATE'
                          ? 'bg-amber-500 text-slate-950 font-mono'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {mode === 'CATALOG_UPDATE' ? 'Activé' : 'Sélectionner'}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1">
                    Mise à jour Fiche Technique (Données)
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Actualise les désignations, catégories, seuils minimaux et équivalences cross-références des pièces existantes sans toucher aux quantités en stock.
                  </p>
                </div>

                <div
                  onClick={() => setMode('PRICING_UPDATE')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === 'PRICING_UPDATE'
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                      Opération C
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        mode === 'PRICING_UPDATE'
                          ? 'bg-amber-500 text-slate-950 font-mono'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {mode === 'PRICING_UPDATE' ? 'Activé' : 'Sélectionner'}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-1">
                    Tarifs & Marques / Constructeurs
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Ajoute ou met à jour les offres par constructeur/marque (prix d'achat, prix de vente, fournisseur) sur les références pivots existantes, sans altérer les stocks.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Magasin de destination par défaut :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {warehouses.map((wh) => (
                  <label
                    key={wh.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      targetWarehouseId === wh.id
                        ? 'border-amber-500 bg-amber-50/50 text-slate-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="warehouse_view"
                      checked={targetWarehouseId === wh.id}
                      onChange={() => setTargetWarehouseId(wh.id)}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs truncate">{wh.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {wh.location} • Code: {wh.code}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {mode === 'CATALOG_UPDATE' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteStockConfirmed}
                    onChange={(e) => setOverwriteStockConfirmed(e.target.checked)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-950 block">
                      Confirmation explicite : Forcer le remplacement des quantités de stock réelles
                    </span>
                    <span className="text-[11px] text-rose-800 leading-normal block mt-0.5">
                      Par défaut, la mise à jour préserve le stock existant. Si cette case est cochée, les quantités seront écrasées et des mouvements d'ajustement audités seront créés dans l'historique.
                    </span>
                  </div>
                </label>
              </div>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/20 rounded-xl p-10 text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-2xs">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Glissez votre fichier ici ou cliquez pour parcourir
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Prend en charge les fichiers Excel (.xlsx, .xls) et CSV avec détection automatique des encodages et des en-têtes.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900">{fileName}</span>
                <span className="text-slate-500 font-mono">({fileSizeStr})</span>
                <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] text-slate-700">
                  {rawRows.length} ligne(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Magasin cible :</span>
                <span className="font-bold text-slate-900">{selectedWh?.name}</span>
                <button
                  onClick={() => setStep(1)}
                  className="ml-3 text-amber-600 hover:text-amber-700 font-bold"
                >
                  Modifier fichier / magasin
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Correspondance des colonnes (Mapping intelligent)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Les champs principaux avec un astérisque (*) sont obligatoires
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Référence constructeur * :
                  </label>
                  <select
                    value={mapping.mainReference}
                    onChange={(e) => setMapping((m) => ({ ...m, mainReference: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Non associé --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Désignation de la pièce * :
                  </label>
                  <select
                    value={mapping.designation}
                    onChange={(e) => setMapping((m) => ({ ...m, designation: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Non associé --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-900 block">
                    Quantité initiale en stock :
                  </label>
                  <select
                    value={mapping.initialQuantity}
                    onChange={(e) => setMapping((m) => ({ ...m, initialQuantity: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/50 focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- 0 (par défaut) --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Marque / Fabricant :
                  </label>
                  <select
                    value={mapping.brand}
                    onChange={(e) => setMapping((m) => ({ ...m, brand: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Générique (par défaut) --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Catégorie technique :
                  </label>
                  <select
                    value={mapping.category}
                    onChange={(e) => setMapping((m) => ({ ...m, category: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Filtration (par défaut) --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Magasin spécifique :
                  </label>
                  <select
                    value={mapping.warehouse}
                    onChange={(e) => setMapping((m) => ({ ...m, warehouse: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Selon sélection globale ({selectedWh?.name}) --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Prix d'achat (FCFA) :
                  </label>
                  <select
                    value={mapping.purchasePrice}
                    onChange={(e) => setMapping((m) => ({ ...m, purchasePrice: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- 0 FCFA --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Prix de vente (FCFA) :
                  </label>
                  <select
                    value={mapping.salePrice}
                    onChange={(e) => setMapping((m) => ({ ...m, salePrice: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- 0 FCFA --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Emplacement physique :
                  </label>
                  <select
                    value={mapping.physicalLocation}
                    onChange={(e) => setMapping((m) => ({ ...m, physicalLocation: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Non renseigné --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700 block">
                    Équivalences (Cross-References) :
                  </label>
                  <select
                    value={mapping.equivalentReferences || ''}
                    onChange={(e) => setMapping((m) => ({ ...m, equivalentReferences: e.target.value }))}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                  >
                    <option value="">-- Non renseigné --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">Total analysé</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{parsedRows.length}</span>
                <span className="text-[10px] text-slate-500 block">lignes du fichier</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[11px] text-emerald-700 font-medium block">Lignes valides</span>
                <span className="text-xl font-bold text-emerald-800 font-mono">{validRowsCount}</span>
                <span className="text-[10px] text-emerald-600 block">prêtes à être importées</span>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-[11px] text-blue-700 font-medium block">Avec stock &gt; 0</span>
                <span className="text-xl font-bold text-blue-800 font-mono">{positiveQtyRowsCount}</span>
                <span className="text-[10px] text-blue-600 block">{totalQtySum} pièce(s) au total</span>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[11px] text-amber-800 font-medium block">Déjà au catalogue</span>
                <span className="text-xl font-bold text-amber-900 font-mono">{duplicatesCount}</span>
                <span className="text-[10px] text-amber-700 block">
                  {mode === 'INITIAL_IMPORT' ? 'ignorés (sécurité)' : 'seront mis à jour'}
                </span>
              </div>

              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-[11px] text-rose-700 font-medium block">Erreurs bloquantes</span>
                <span className="text-xl font-bold text-rose-800 font-mono">{errorRowsCount}</span>
                <span className="text-[10px] text-rose-600 block">lignes rejetées</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Aperçu des données et contrôle des quantités
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({displayedRows.length} / {parsedRows.length})
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setPreviewFilter('ALL')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      previewFilter === 'ALL'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toutes ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('VALID')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      previewFilter === 'VALID'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Valides ({validRowsCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('ERROR')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      previewFilter === 'ERROR'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Erreurs ({errorRowsCount})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Ligne</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3">Référence</th>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3">Marque</th>
                      <th className="py-2.5 px-3 text-right">Qté Initiale</th>
                      <th className="py-2.5 px-3">Magasin</th>
                      <th className="py-2.5 px-3 text-right">P. Achat</th>
                      <th className="py-2.5 px-3 text-right">P. Vente</th>
                      <th className="py-2.5 px-3">Emplacement</th>
                      <th className="py-2.5 px-3">Anomalies / Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          Aucune ligne ne correspond à ce filtre
                        </td>
                      </tr>
                    ) : (
                      displayedRows.slice(0, 100).map((row) => (
                        <tr
                          key={`view-row-${row.rowIndex}`}
                          className={`hover:bg-slate-50 transition-colors ${
                            row.status === 'ERROR'
                              ? 'bg-rose-50/40 text-rose-900'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            #{row.rowIndex}
                          </td>
                          <td className="py-2 px-3">
                            {row.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Valide
                              </span>
                            )}
                            {row.status === 'WARNING' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Attention
                              </span>
                            )}
                            {row.status === 'ERROR' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                Rejeté
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {row.mainReference || <span className="text-rose-500 italic">Vide</span>}
                          </td>
                          <td className="py-2 px-3 max-w-xs truncate" title={row.designation}>
                            {row.designation || <span className="text-rose-500 italic">Vide</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{row.brand}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                row.initialQuantity > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'text-slate-500 bg-slate-100'
                              }`}
                            >
                              {row.initialQuantity}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                            {row.warehouseName || selectedWh?.name}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {formatFCFA(row.purchasePrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(row.salePrice)}
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs" title={row.physicalLocation}>
                            {row.physicalLocation}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {row.errors.length > 0 && (
                              <div className="text-rose-600 font-medium">
                                {row.errors.join(' • ')}
                              </div>
                            )}
                            {row.warnings.length > 0 && (
                              <div className="text-amber-700 font-medium">
                                {row.warnings.join(' • ')}
                              </div>
                            )}
                            {row.errors.length === 0 && row.warnings.length === 0 && (
                              <span className="text-emerald-600">Conforme</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
              >
                Retour à l'étape 1
              </button>

              <button
                onClick={handleExecuteImport}
                disabled={isExecuting || validRowsCount === 0}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs shadow-xs transition-colors ${
                  isExecuting || validRowsCount === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    Confirmer l'importation définitive ({validRowsCount} articles)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && resultReport && (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-emerald-950">
                Importation terminée avec succès !
              </h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                Le fichier <strong className="font-mono">{resultReport.fileName}</strong> a été traité et enregistré durablement dans votre base de données locale.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] text-slate-500 font-medium block">Total analysé</span>
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {resultReport.totalRows}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[11px] text-emerald-700 font-medium block">Articles créés</span>
                <span className="text-xl font-bold text-emerald-800 font-mono">
                  {resultReport.createdArticles}
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[11px] text-blue-700 font-medium block">Quantités &gt; 0 enregistrées</span>
                <span className="text-xl font-bold text-blue-800 font-mono">
                  {resultReport.positiveStockEntriesCount ?? resultReport.createdMovements}
                </span>
                <span className="text-[10px] text-blue-600 block">
                  {resultReport.totalQuantityImported ?? 0} unités au total
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-[11px] text-amber-800 font-medium block">Lignes ignorées</span>
                <span className="text-xl font-bold text-amber-900 font-mono">
                  {resultReport.skippedArticles}
                </span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <span className="text-[11px] text-rose-700 font-medium block">Lignes rejetées</span>
                <span className="text-xl font-bold text-rose-800 font-mono">
                  {resultReport.rejectedRows}
                </span>
              </div>
            </div>

            {resultReport.createdMovements > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    {resultReport.createdMovements}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {resultReport.createdMovements} mouvement(s) d’entrée de stock généré(s)
                    </span>
                    <span className="text-slate-500">
                      Les stocks ont été enregistrés avec la référence IMPORT-INIT-...
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full">
                  Stock magasin {selectedWh?.name} actualisé
                </span>
              </div>
            )}

            {resultReport.rejectedDetails && resultReport.rejectedDetails.length > 0 && (
              <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/50 space-y-2">
                <h5 className="text-xs font-bold text-rose-950 uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Détail des lignes rejetées ({resultReport.rejectedDetails.length})
                </h5>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                  {resultReport.rejectedDetails.map((det, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-rose-900 bg-white p-2.5 rounded-lg border border-rose-200 flex items-start justify-between gap-3 font-mono leading-relaxed shadow-2xs"
                    >
                      <div>
                        <span className="font-bold">Ligne #{det.row}</span> [Réf: {det.reference}]
                      </div>
                      <div className="text-rose-700 font-semibold">{det.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setStep(1);
                  setRawRows([]);
                  setFileName('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Importer un nouveau fichier
              </button>

              {onNavigateToCatalog && (
                <button
                  onClick={onNavigateToCatalog}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                >
                  Voir les pièces dans le catalogue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
