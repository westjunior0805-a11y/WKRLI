import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  detectImportModeFromColumns,
  parseAndValidateImportRows,
  TEMPLATE_HEADERS,
  SAMPLE_ROWS,
  CATALOG_TEMPLATE_HEADERS,
  CATALOG_SAMPLE_ROWS,
  STOCK_TEMPLATE_HEADERS,
  STOCK_SAMPLE_ROWS,
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
  Boxes,
} from 'lucide-react';

interface ImportCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (report: ImportResultReport) => void;
  fixedMode?: 'CATALOG_IMPORT' | 'STOCK_IMPORT';
  initialWarehouseId?: string;
}

export const ImportCatalogModal: React.FC<ImportCatalogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  fixedMode,
  initialWarehouseId,
}) => {
  const {
    warehouses,
    selectedWarehouseId,
    articles,
    executeImport,
    currentUser,
  } = useStock();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow step: 1 = File & Mode, 2 = Mapping & Preview, 3 = Completed Report
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Configuration
  const [mode, setMode] = useState<ImportMode>(fixedMode || 'CATALOG_IMPORT');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(() => {
    if (initialWarehouseId) return initialWarehouseId;
    if (selectedWarehouseId) return selectedWarehouseId;
    return '';
  });
  const [overwriteStockConfirmed, setOverwriteStockConfirmed] = useState(false);

  // Sync mode and targetWarehouseId when modal opens or fixedMode changes
  useEffect(() => {
    if (isOpen) {
      if (fixedMode) {
        setMode(fixedMode);
      }
      if (initialWarehouseId) {
        setTargetWarehouseId(initialWarehouseId);
      } else if (selectedWarehouseId) {
        setTargetWarehouseId(selectedWarehouseId);
      } else {
        setTargetWarehouseId('');
      }
    }
  }, [isOpen, fixedMode, initialWarehouseId, selectedWarehouseId]);

  // File state
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Mapping state
  const [mapping, setMapping] = useState<ImportFieldMapping>({
    mainReference: '',
    designation: '',
    description: '',
    brand: '',
    category: '',
    initialQuantity: '',
    purchasePrice: '',
    salePrice: '',
    preferredSupplier: '',
    warehouse: '',
    physicalLocation: '',
    invoiceNumber: '',
    rack: '',
    shelf: '',
    bin: '',
    minStockThreshold: '',
    barcode: '',
    imageUrl: '',
    equivalentReferences: '',
  });

  // Preview filtering
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'ERROR'>('ALL');
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultReport, setResultReport] = useState<ImportResultReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle file upload (.xlsx, .xls, .csv)
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

      // Extract raw column headers trimmed
      const columns = Object.keys(parsed[0] || {});
      setAvailableColumns(columns);
      setRawRows(parsed);

      if (fixedMode) {
        setMode(fixedMode);
      } else {
        const detectedMode = detectImportModeFromColumns(columns);
        if (detectedMode) {
          setMode(detectedMode);
        }
      }

      // Auto detect mappings using the improved parser
      const detected = autoDetectMapping(columns);
      setMapping(detected);

      // Advance to Step 2
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de lire le fichier. Assurez-vous d’un format Excel ou CSV valide.');
    }
  };

  // Download Catalog Excel template (5 columns)
  const handleDownloadCatalogExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [CATALOG_TEMPLATE_HEADERS, ...CATALOG_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 36 },
      { wch: 42 },
      { wch: 28 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Catalogue');
    XLSX.writeFile(wb, 'modele_import_catalogue.xlsx');
  };

  const handleDownloadCatalogCsvTemplate = () => {
    exportToCSV('modele_import_catalogue', CATALOG_TEMPLATE_HEADERS, CATALOG_SAMPLE_ROWS);
  };

  // Download Stock Excel template (7 columns)
  const handleDownloadStockExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [STOCK_TEMPLATE_HEADERS, ...STOCK_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Stock');
    XLSX.writeFile(wb, 'modele_import_stock.xlsx');
  };

  const handleDownloadStockCsvTemplate = () => {
    exportToCSV('modele_import_stock', STOCK_TEMPLATE_HEADERS, STOCK_SAMPLE_ROWS);
  };

  // Parse and validate rows using the robust parser
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

  // Statistics with precise unique reference calculation
  const validRows = useMemo(
    () => parsedRows.filter((r) => r.status === 'VALID' || r.status === 'WARNING'),
    [parsedRows]
  );
  const validRowsCount = validRows.length;

  const uniqueReferencesCount = useMemo(() => {
    const set = new Set(validRows.map((r) => r.mainReference.toLowerCase().trim()).filter(Boolean));
    return set.size;
  }, [validRows]);

  const errorRowsCount = useMemo(
    () => parsedRows.filter((r) => r.status === 'ERROR').length,
    [parsedRows]
  );
  const duplicatesCount = useMemo(
    () => parsedRows.filter((r) => r.isDuplicateInCatalog).length,
    [parsedRows]
  );
  const positiveQtyRowsCount = useMemo(
    () => validRows.filter((r) => r.initialQuantity > 0).length,
    [validRows]
  );
  const totalQtySum = useMemo(
    () => validRows.reduce((sum, r) => sum + (r.initialQuantity || 0), 0),
    [validRows]
  );

  // Filtered rows for grid display
  const displayedRows = useMemo(() => {
    if (previewFilter === 'VALID') {
      return parsedRows.filter((r) => r.status === 'VALID' || r.status === 'WARNING');
    }
    if (previewFilter === 'ERROR') {
      return parsedRows.filter((r) => r.status === 'ERROR');
    }
    return parsedRows;
  }, [parsedRows, previewFilter]);

  // Execute import
  const handleExecuteImport = () => {
    if (validRowsCount === 0) {
      setErrorMessage('Aucune ligne valide à importer. Veuillez corriger les correspondances ou le fichier.');
      return;
    }

    const effectiveWarehouseId =
      targetWarehouseId ||
      warehouses.find((w) => w.isDefault)?.id ||
      warehouses[0]?.id ||
      'mag_principal';

    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = executeImport({
        mode,
        fileName,
        rows: parsedRows,
        targetWarehouseId: effectiveWarehouseId,
        overwriteExistingStock: overwriteStockConfirmed,
      });

      if (res.success && res.report) {
        setResultReport(res.report);
        setStep(3);
        if (onSuccess) onSuccess(res.report);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {fixedMode === 'CATALOG_IMPORT'
                    ? 'Importation du Catalogue (Excel / CSV)'
                    : fixedMode === 'STOCK_IMPORT'
                    ? 'Importation du Stock (Excel / CSV)'
                    : 'Importation du Catalogue & du Stock (Excel / CSV)'}
                </h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono">
                  {fixedMode === 'CATALOG_IMPORT'
                    ? 'Module Catalogue'
                    : fixedMode === 'STOCK_IMPORT'
                    ? 'Module Stock & Dépôts'
                    : 'Module Catalogue & Stock'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {fixedMode === 'CATALOG_IMPORT'
                  ? 'Colonnes : Référence, Désignation, Description, Équivalences, Seuil minimum'
                  : fixedMode === 'STOCK_IMPORT'
                  ? "Colonnes : Référence, Marque, Quantité, Emplacement, Numéro de facture de commande, Prix d'achat unitaire, Prix de vente unitaire"
                  : 'Importation dédiée du Catalogue et du Stock multi-marques / emplacements'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Breadcrumb */}
        <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex items-center gap-3 text-xs">
          <div
            className={`flex items-center gap-1.5 font-medium ${
              step >= 1 ? 'text-amber-600 font-bold' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                step >= 1 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-200 text-slate-500'
              }`}
            >
              1
            </span>
            {fixedMode === 'CATALOG_IMPORT'
              ? 'Modèle Excel Catalogue & Fichier'
              : fixedMode === 'STOCK_IMPORT'
              ? 'Dépôt, Modèle Excel Stock & Fichier'
              : "Type d'importation & Modèles Excel"}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <div
            className={`flex items-center gap-1.5 font-medium ${
              step >= 2 ? 'text-amber-600 font-bold' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                step >= 2 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-200 text-slate-500'
              }`}
            >
              2
            </span>
            Correspondance & Contrôle qualité
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <div
            className={`flex items-center gap-1.5 font-medium ${
              step === 3 ? 'text-emerald-700 font-bold' : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                step === 3 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-500'
              }`}
            >
              3
            </span>
            Bilan d'Importation
          </div>
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Erreur de traitement</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body content based on step */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= STEP 1: FICHIER & MODE ================= */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Operations Mode Selector + Dedicated Templates */}
              <div className={fixedMode ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                {/* 1. IMPORTATION DU CATALOGUE */}
                {(!fixedMode || fixedMode === 'CATALOG_IMPORT') && (
                  <div
                    onClick={() => !fixedMode && setMode('CATALOG_IMPORT')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                      !fixedMode ? 'cursor-pointer' : ''
                    } ${
                      mode === 'CATALOG_IMPORT'
                        ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Importation du Catalogue
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono">
                          Modèle 5 colonnes
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">
                        Fiches Références, Désignations, Descriptions, Équivalences & Seuils
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Colonnes prises en charge : <strong>Référence</strong>, <strong>Désignation</strong>, <strong>Description</strong>, <strong>Équivalences</strong>, <strong>Seuil minimum</strong>. Conserve les stocks et prix existants sans jamais écraser les données par des valeurs vides.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                        <Download className="w-3.5 h-3.5 text-amber-700" />
                        Télécharger le modèle Catalogue :
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={handleDownloadCatalogExcelTemplate}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          Modèle Excel Catalogue (.xlsx)
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadCatalogCsvTemplate}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. IMPORTATION DU STOCK */}
                {(!fixedMode || fixedMode === 'STOCK_IMPORT') && (
                  <div
                    onClick={() => !fixedMode && setMode('STOCK_IMPORT')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                      !fixedMode ? 'cursor-pointer' : ''
                    } ${
                      mode === 'STOCK_IMPORT'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          Importation du Stock
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono">
                          Modèle 7 colonnes
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">
                        Stocks par Marque, Emplacement, N° Facture & Prix d'achat / vente
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Colonnes prises en charge : <strong>Référence</strong>, <strong>Marque</strong>, <strong>Quantité</strong>, <strong>Emplacement</strong>, <strong>Numéro de facture de commande</strong>, <strong>Prix d'achat unitaire</strong>, <strong>Prix de vente unitaire</strong>. Gère plusieurs marques (Caterpillar, CTP, ITR...) et emplacements par référence.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1">
                        <Download className="w-3.5 h-3.5 text-emerald-700" />
                        Télécharger le modèle Stock :
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={handleDownloadStockExcelTemplate}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-950 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          Modèle Excel Stock (.xlsx)
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadStockCsvTemplate}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warehouse Selection: Only shown for Stock Import */}
              {mode === 'STOCK_IMPORT' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Dépôt de réception du stock :
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Sélectionnez un dépôt si votre fichier ne contient pas de colonne Magasin
                    </span>
                  </div>
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
                          name="warehouse"
                          checked={targetWarehouseId === wh.id}
                          onChange={() => setTargetWarehouseId(wh.id)}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-xs truncate">
                            {wh.name} {wh.isDefault ? '(Boutique / Point de Vente)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {wh.location} • Code: {wh.code}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/20 rounded-xl p-8 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  Cliquez ou déposez votre fichier Excel (.xlsx) ou CSV ici
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Mode actif : <strong>{mode === 'CATALOG_IMPORT' ? 'Importation du Catalogue' : 'Importation du Stock'}</strong>. Détection automatique des colonnes.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 2: CORRESPONDANCE & APERÇU ================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">{fileName}</span>
                  <span className="text-slate-500 font-mono">({fileSizeStr})</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] text-slate-700">
                    {rawRows.length} ligne(s) détectée(s)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {fixedMode ? (
                    <span className="px-2.5 py-1 rounded bg-slate-900 text-amber-400 font-bold text-[11px]">
                      {fixedMode === 'CATALOG_IMPORT' ? 'Importation du Catalogue' : `Importation Stock → ${selectedWh?.name || 'Magasin'}`}
                    </span>
                  ) : (
                    <>
                      <span className="text-slate-500">Mode :</span>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as ImportMode)}
                        className="font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="CATALOG_IMPORT">1. Importation du Catalogue</option>
                        <option value="STOCK_IMPORT">2. Importation du Stock</option>
                      </select>
                    </>
                  )}
                  <button
                    onClick={() => setStep(1)}
                    className="ml-2 text-amber-600 hover:text-amber-700 font-semibold"
                  >
                    Changer fichier
                  </button>
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Correspondance des colonnes ({mode === 'CATALOG_IMPORT' ? 'Modèle Catalogue — 5 colonnes' : 'Modèle Stock — 7 colonnes'})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Les valeurs vides ne remplacent jamais les données existantes
                  </span>
                </div>

                {mode === 'CATALOG_IMPORT' ? (
                  /* === 1. MODÈLE CATALOGUE (5 COLONNES) === */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        1. Référence * :
                      </label>
                      <select
                        value={mapping.mainReference}
                        onChange={(e) => setMapping((m) => ({ ...m, mainReference: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500 font-semibold"
                      >
                        <option value="">-- Non associé (obligatoire) --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        2. Désignation * :
                      </label>
                      <select
                        value={mapping.designation}
                        onChange={(e) => setMapping((m) => ({ ...m, designation: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500 font-semibold"
                      >
                        <option value="">-- Non associé (obligatoire) --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        3. Description :
                      </label>
                      <select
                        value={mapping.description || ''}
                        onChange={(e) => setMapping((m) => ({ ...m, description: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
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
                      <label className="text-[11px] font-bold text-slate-700 block">
                        4. Équivalences :
                      </label>
                      <select
                        value={mapping.equivalentReferences || ''}
                        onChange={(e) => setMapping((m) => ({ ...m, equivalentReferences: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
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
                      <label className="text-[11px] font-bold text-slate-700 block">
                        5. Seuil minimum :
                      </label>
                      <select
                        value={mapping.minStockThreshold}
                        onChange={(e) => setMapping((m) => ({ ...m, minStockThreshold: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
                      >
                        <option value="">-- Conserver ou 2 par défaut --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* === 2. MODÈLE STOCK (7 COLONNES) === */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        1. Référence * :
                      </label>
                      <select
                        value={mapping.mainReference}
                        onChange={(e) => setMapping((m) => ({ ...m, mainReference: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500 font-semibold"
                      >
                        <option value="">-- Non associé (obligatoire) --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-900 block">
                        2. Marque (Caterpillar, CTP, ITR...) :
                      </label>
                      <select
                        value={mapping.brand}
                        onChange={(e) => setMapping((m) => ({ ...m, brand: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-emerald-300 p-2 bg-emerald-50/30 focus:bg-white focus:border-emerald-500 font-semibold"
                      >
                        <option value="">-- Sans marque (par défaut) --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-amber-900 block">
                        3. Quantité :
                      </label>
                      <select
                        value={mapping.initialQuantity}
                        onChange={(e) => setMapping((m) => ({ ...m, initialQuantity: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:bg-white focus:border-amber-500 font-semibold"
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
                      <label className="text-[11px] font-bold text-slate-800 block">
                        4. Emplacement :
                      </label>
                      <select
                        value={mapping.physicalLocation}
                        onChange={(e) => setMapping((m) => ({ ...m, physicalLocation: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
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
                      <label className="text-[11px] font-bold text-slate-800 block">
                        5. Numéro de facture de commande :
                      </label>
                      <select
                        value={mapping.invoiceNumber || ''}
                        onChange={(e) => setMapping((m) => ({ ...m, invoiceNumber: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
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
                      <label className="text-[11px] font-bold text-slate-800 block">
                        6. Prix d'achat unitaire :
                      </label>
                      <select
                        value={mapping.purchasePrice}
                        onChange={(e) => setMapping((m) => ({ ...m, purchasePrice: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
                      >
                        <option value="">-- Conserver existant / 0 --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        7. Prix de vente unitaire :
                      </label>
                      <select
                        value={mapping.salePrice}
                        onChange={(e) => setMapping((m) => ({ ...m, salePrice: e.target.value }))}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-slate-50 focus:bg-white focus:border-amber-500"
                      >
                        <option value="">-- Conserver existant / 0 --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Validation Summary Cards */}
              {mode === 'CATALOG_IMPORT' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block">Total analysé</span>
                    <span className="text-xl font-bold text-slate-900 font-mono">{parsedRows.length}</span>
                    <span className="text-[10px] text-slate-500 block">lignes du fichier</span>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 shadow-2xs">
                    <span className="text-[11px] text-amber-800 font-bold block">Références uniques</span>
                    <span className="text-xl font-bold text-amber-950 font-mono">{uniqueReferencesCount}</span>
                    <span className="text-[10px] text-amber-700 font-medium block">fiches catalogue</span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[11px] text-emerald-700 font-medium block">Lignes valides</span>
                    <span className="text-xl font-bold text-emerald-800 font-mono">{validRowsCount}</span>
                    <span className="text-[10px] text-emerald-600 block">prêtes à enregistrer</span>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <span className="text-[11px] text-rose-700 font-medium block">Lignes rejetées</span>
                    <span className="text-xl font-bold text-rose-800 font-mono">{errorRowsCount}</span>
                    <span className="text-[10px] text-rose-600 block">erreurs bloquantes</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block">Total analysé</span>
                    <span className="text-xl font-bold text-slate-900 font-mono">{parsedRows.length}</span>
                    <span className="text-[10px] text-slate-500 block">lignes du fichier</span>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 shadow-2xs">
                    <span className="text-[11px] text-amber-800 font-bold block">Références uniques</span>
                    <span className="text-xl font-bold text-amber-950 font-mono">{uniqueReferencesCount}</span>
                    <span className="text-[10px] text-amber-700 font-medium block">comptées 1 seule fois</span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[11px] text-emerald-700 font-medium block">Déclinaisons marques</span>
                    <span className="text-xl font-bold text-emerald-800 font-mono">{validRowsCount}</span>
                    <span className="text-[10px] text-emerald-600 block">variables constructeurs</span>
                  </div>

                  <div className="p-3 bg-[#FFF9DF] rounded-lg border border-[#E5C130]">
                    <span className="text-[11px] text-[#7A5C00] font-medium block">Stock physique total</span>
                    <span className="text-xl font-bold text-[#111111] font-mono">{totalQtySum}</span>
                    <span className="text-[10px] text-[#7A5C00] block">sur {positiveQtyRowsCount} ligne(s)</span>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <span className="text-[11px] text-rose-700 font-medium block">Lignes rejetées</span>
                    <span className="text-xl font-bold text-rose-800 font-mono">{errorRowsCount}</span>
                    <span className="text-[10px] text-rose-600 block">erreurs bloquantes</span>
                  </div>
                </div>
              )}

              {/* Preview Table & Filter */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Aperçu des données ({mode === 'CATALOG_IMPORT' ? 'Modèle Catalogue' : 'Modèle Stock'})
                    </span>
                    <span className="text-xs text-slate-500">
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

                <div className="overflow-x-auto max-h-72">
                  {mode === 'CATALOG_IMPORT' ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Ligne</th>
                          <th className="py-2.5 px-3">Statut</th>
                          <th className="py-2.5 px-3">Référence</th>
                          <th className="py-2.5 px-3">Désignation</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3">Équivalences</th>
                          <th className="py-2.5 px-3 text-right">Seuil minimum</th>
                          <th className="py-2.5 px-3">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              Aucune ligne ne correspond à ce filtre
                            </td>
                          </tr>
                        ) : (
                          displayedRows.slice(0, 100).map((row) => (
                            <tr
                              key={`cat-row-${row.rowIndex}`}
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
                              <td className="py-2 px-3 max-w-xs truncate font-medium text-slate-900" title={row.designation}>
                                {row.designation || <span className="text-rose-500 italic">Vide</span>}
                              </td>
                              <td className="py-2 px-3 max-w-xs truncate text-slate-600" title={row.description}>
                                {row.description || '-'}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-amber-800 max-w-xs truncate">
                                {row.equivalentReferences && row.equivalentReferences.length > 0
                                  ? row.equivalentReferences.join(', ')
                                  : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                                {row.minStockThreshold}
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
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Ligne</th>
                          <th className="py-2.5 px-3">Statut</th>
                          <th className="py-2.5 px-3">Référence</th>
                          <th className="py-2.5 px-3">Marque</th>
                          <th className="py-2.5 px-3 text-right">Quantité</th>
                          <th className="py-2.5 px-3">Emplacement</th>
                          <th className="py-2.5 px-3">Numéro de facture de commande</th>
                          <th className="py-2.5 px-3 text-right">Prix d'achat unitaire</th>
                          <th className="py-2.5 px-3 text-right">Prix de vente unitaire</th>
                          <th className="py-2.5 px-3">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400">
                              Aucune ligne ne correspond à ce filtre
                            </td>
                          </tr>
                        ) : (
                          displayedRows.slice(0, 100).map((row) => (
                            <tr
                              key={`stock-row-${row.rowIndex}`}
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
                              <td className="py-2 px-3 font-semibold text-slate-800">{row.brand}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    row.initialQuantity > 0
                                      ? 'bg-[#FFF9DF] text-[#111111]'
                                      : 'text-slate-500 bg-slate-100'
                                  }`}
                                >
                                  {row.initialQuantity}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600 truncate max-w-xs" title={row.physicalLocation}>
                                {row.physicalLocation || '-'}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">
                                {row.invoiceNumber || '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {formatFCFA(row.purchasePrice)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatFCFA(row.salePrice)}
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
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: BILAN D'IMPORTATION EXÉCUTÉ ================= */}
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

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-center shadow-2xs">
                  <span className="text-[11px] text-amber-900 font-bold block">Références uniques</span>
                  <span className="text-xl font-bold text-amber-950 font-mono">
                    {resultReport.uniqueReferencesCount ?? (resultReport.createdArticles + resultReport.updatedArticles)}
                  </span>
                  <span className="text-[10px] text-amber-700 block font-medium">comptées 1 fois</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-700 font-medium block">Articles créés</span>
                  <span className="text-xl font-bold text-emerald-800 font-mono">
                    {resultReport.createdArticles}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">nouvelles fiches</span>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <span className="text-[11px] text-purple-700 font-medium block">Articles enrichis</span>
                  <span className="text-xl font-bold text-purple-800 font-mono">
                    {resultReport.updatedArticles}
                  </span>
                  <span className="text-[10px] text-purple-600 block">fiches complétées</span>
                </div>

                <div className="p-3 bg-[#FFF9DF] border border-[#E5C130] rounded-xl text-center">
                  <span className="text-[11px] text-[#7A5C00] font-medium block">Variables marques</span>
                  <span className="text-xl font-bold text-[#111111] font-mono">
                    {resultReport.brandOffersCreatedCount ?? resultReport.totalRows}
                  </span>
                  <span className="text-[10px] text-[#7A5C00] block">offres constructeurs</span>
                </div>

                <div className="p-3 bg-[#FFF9DF] border border-[#E5C130] rounded-xl text-center">
                  <span className="text-[11px] text-[#7A5C00] font-medium block">Stock mis à jour</span>
                  <span className="text-xl font-bold text-[#111111] font-mono">
                    {resultReport.totalQuantityImported ?? 0}
                  </span>
                  <span className="text-[10px] text-[#7A5C00] block">
                    {resultReport.positiveStockEntriesCount ?? resultReport.createdMovements} réf. actualisée(s)
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <span className="text-[11px] text-rose-700 font-medium block">Lignes rejetées</span>
                  <span className="text-xl font-bold text-rose-800 font-mono">
                    {resultReport.rejectedRows}
                  </span>
                  <span className="text-[10px] text-rose-600 block">anomalies</span>
                </div>
              </div>

              {/* Anti-Saturation confirmation badge */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-950">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <strong className="font-bold text-emerald-900 block">Catalogue optimisé sans saturation :</strong>
                  <span className="text-[11px] text-emerald-800">
                    Les {resultReport.totalRows} lignes importées ont été consolidées avec précision en{' '}
                    <strong className="font-mono">{resultReport.uniqueReferencesCount}</strong> fiche(s) article(s) maître(s). Les déclinaisons multi-marques ({resultReport.brandOffersCreatedCount} marques) sont accessibles directement au sein de chaque fiche sans alourdir le catalogue.
                  </span>
                </div>
              </div>

              {/* Stock update traceability notice */}
              {resultReport.createdMovements > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      {resultReport.createdMovements}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {resultReport.createdMovements} mise(s) à jour de stock enregistrée(s)
                      </span>
                      <span className="text-slate-500">
                        Les nouvelles quantités importées ont remplacé et mis à jour le stock du magasin cible (sans cumul avec l'ancien stock).
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full">
                    Stock physique actualisé
                  </span>
                </div>
              )}

              {/* Rejection Details with precise error reasons */}
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
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400" />
              Sélectionnez un fichier pour passer au contrôle des correspondances.
            </div>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Retour à l'étape 1
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => {
                setStep(1);
                setRawRows([]);
                setFileName('');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Importer un autre fichier
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              {step === 3 ? 'Fermer et voir le stock' : 'Annuler'}
            </button>

            {step === 2 && (
              <button
                onClick={handleExecuteImport}
                disabled={isExecuting || validRowsCount === 0}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs shadow-xs transition-colors ${
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
                    Confirmer l'importation ({validRowsCount} articles)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
