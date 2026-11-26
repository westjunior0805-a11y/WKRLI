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
  detectImportModeFromColumns,
  parseAndValidateImportRows,
  TEMPLATE_HEADERS,
  SAMPLE_ROWS,
  CATALOG_TEMPLATE_HEADERS,
  CATALOG_SAMPLE_ROWS,
  STOCK_TEMPLATE_HEADERS,
  STOCK_SAMPLE_ROWS,
  CATERPILLAR_SIS2_CATALOG_ROWS,
  parseRawSis2Text,
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
  Users,
  Tractor,
} from 'lucide-react';
import { ImportCustomersModal } from '../customers/ImportCustomersModal';

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
  const [mode, setMode] = useState<ImportMode>('CATALOG_IMPORT');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(() => {
    if (selectedWarehouseId) return selectedWarehouseId;
    return '';
  });
  const [overwriteStockConfirmed, setOverwriteStockConfirmed] = useState(false);

  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  const [mapping, setMapping] = useState<ImportFieldMapping>({
    mainReference: '',
    designation: '',
    description: '',
    brand: '',
    category: '',
    initialQuantity: '',
    purchasePrice: '',
    salePrice: '',
    invoiceNumber: '',
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

      const detectedMode = detectImportModeFromColumns(columns);
      if (detectedMode) {
        setMode(detectedMode);
      }

      const detected = autoDetectMapping(columns);
      setMapping(detected);

      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de lire le fichier. Assurez-vous d’un format Excel ou CSV valide.');
    }
  };

  const handleDownloadCatalogExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [CATALOG_TEMPLATE_HEADERS, ...CATALOG_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 42 },
      { wch: 52 },
      { wch: 42 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Catalogue');
    XLSX.writeFile(wb, 'modele_import_catalogue.xlsx');
  };

  const handleDownloadCatalogCsvTemplate = () => {
    exportToCSV('modele_import_catalogue', CATALOG_TEMPLATE_HEADERS, CATALOG_SAMPLE_ROWS);
  };

  const handleDownloadStockExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [STOCK_TEMPLATE_HEADERS, ...STOCK_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 34 },
      { wch: 28 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Stock');
    XLSX.writeFile(wb, 'modele_import_stock.xlsx');
  };

  const handleDownloadStockCsvTemplate = () => {
    exportToCSV('modele_import_stock', STOCK_TEMPLATE_HEADERS, STOCK_SAMPLE_ROWS);
  };

  const isCatalogMode = mode === 'CATALOG_IMPORT' || mode === 'CATALOG_UPDATE';

  const handleDownloadCaterpillarSis2Excel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [TEMPLATE_HEADERS, ...CATERPILLAR_SIS2_CATALOG_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 48 },
      { wch: 45 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 25 },
      { wch: 30 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'SIS2_Caterpillar');
    XLSX.writeFile(wb, 'catalogue_caterpillar_sis2_pack.xlsx');
  };

  const handleLoadCaterpillarSIS2Pack = () => {
    setErrorMessage(null);
    const headers = TEMPLATE_HEADERS;
    const rowsAsObjects = CATERPILLAR_SIS2_CATALOG_ROWS.map((rowArr) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = rowArr[idx] !== undefined ? rowArr[idx] : '';
      });
      return obj;
    });

    setFileName('Catalogue_Caterpillar_SIS_2.0_Pack.xlsx');
    setFileSizeStr('38 Références CAT Authentiques');
    setAvailableColumns(headers);
    setRawRows(rowsAsObjects);

    const detected = autoDetectMapping(headers);
    setMapping(detected);
    setStep(2);
  };

  const [isSis2ModalOpen, setIsSis2ModalOpen] = useState(false);
  const [isCustomersImportOpen, setIsCustomersImportOpen] = useState(false);
  const [sis2PastedText, setSis2PastedText] = useState('');

  const handleParsePastedSis2Text = () => {
    if (!sis2PastedText.trim()) return;
    setErrorMessage(null);
    const parsedRows = parseRawSis2Text(sis2PastedText);
    if (parsedRows.length === 0) {
      setErrorMessage(
        "Aucune référence Caterpillar reconnue dans le texte collé. Assurez-vous d'inclure des références au format Caterpillar (ex: 1R-0716, 320-0680, 1U3352)."
      );
      return;
    }

    const headers = TEMPLATE_HEADERS;
    setFileName(`Extraction_SIS2_CopierColler_${parsedRows.length}_Refs.xlsx`);
    setFileSizeStr(`${parsedRows.length} Références Extraites`);
    setAvailableColumns(headers);
    setRawRows(parsedRows);

    const detected = autoDetectMapping(headers);
    setMapping(detected);
    setIsSis2ModalOpen(false);
    setSis2PastedText('');
    setStep(2);
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustomersImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Importer le répertoire Clients (Nom, Téléphone, Adresse, Solde créance, Plafond)"
          >
            <Users className="w-4 h-4 text-amber-400" />
            Importer des Clients
          </button>
          <button
            onClick={handleDownloadCatalogExcelTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Colonnes : Référence, Désignation, Description, Équivalences, Seuil minimum"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Modèle Catalogue (.xlsx)
          </button>
          <button
            onClick={handleDownloadStockExcelTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-950 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Colonnes : Référence, Marque, Quantité, Emplacement, Numéro de facture de commande, Prix d'achat unitaire, Prix de vente unitaire"
          >
            <Download className="w-4 h-4 text-amber-700" />
            Modèle Stock (.xlsx)
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
          Sélection du mode & du fichier
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
                Choisissez le type d'importation :
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. IMPORTATION DU CATALOGUE */}
                <div
                  onClick={() => setMode('CATALOG_IMPORT')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isCatalogMode
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                        1. Importation du Catalogue
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCatalogMode
                            ? 'bg-amber-500 text-slate-950 font-mono'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isCatalogMode ? 'Sélectionné' : 'Choisir'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      Catalogue des Références & Fiches Techniques
                    </h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5">
                      Importe ou met à jour les pièces du catalogue sans écraser les données existantes ni les stocks.
                    </p>
                    <div className="p-2.5 bg-white/90 border border-slate-200 rounded-lg text-[11px] text-slate-700 space-y-1">
                      <span className="font-bold text-slate-900 block">Colonnes prises en charge :</span>
                      <div className="flex flex-wrap gap-1">
                        {CATALOG_TEMPLATE_HEADERS.map((col) => (
                          <span
                            key={col}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-semibold"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadCatalogExcelTemplate();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[11px] font-semibold shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      Télécharger Modèle Excel Catalogue (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadCatalogCsvTemplate();
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-medium"
                    >
                      CSV
                    </button>
                  </div>
                </div>

                {/* 2. IMPORTATION DU STOCK */}
                <div
                  onClick={() => setMode('STOCK_IMPORT')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    !isCatalogMode
                      ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                        2. Importation du Stock (Multi-Marques & Emplacements)
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          !isCatalogMode
                            ? 'bg-amber-500 text-slate-950 font-mono'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {!isCatalogMode ? 'Sélectionné' : 'Choisir'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      Stocks, Marques (Caterpillar, CTP, ITR...), Emplacements & Factures
                    </h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5">
                      Une même référence peut exister sous plusieurs marques et emplacements. Chaque marque conserve son propre stock, son prix d'achat et son prix de vente.
                    </p>
                    <div className="p-2.5 bg-white/90 border border-slate-200 rounded-lg text-[11px] text-slate-700 space-y-1">
                      <span className="font-bold text-slate-900 block">Colonnes prises en charge :</span>
                      <div className="flex flex-wrap gap-1">
                        {STOCK_TEMPLATE_HEADERS.map((col) => (
                          <span
                            key={col}
                            className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-950 font-mono text-[10px] font-semibold"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadStockExcelTemplate();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-950 text-[11px] font-semibold shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      Télécharger Modèle Excel Stock (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadStockCsvTemplate();
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-medium"
                    >
                      CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Note d'information Where Used SIS 2.0 (Pièce par pièce) */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                  <Tractor className="w-4 h-4" />
                </div>
                <div className="text-slate-700">
                  <span className="font-bold text-slate-900 block">
                    Affectations Machines Where Used SIS 2.0 (Pièce par pièce) :
                  </span>
                  <span className="text-[11px] text-slate-600">
                    Les exports Caterpillar SIS 2.0 s'effectuant pièce par pièce, l'importation se réalise directement depuis la fiche de chaque pièce dans le Catalogue (colonne <em>Where Used</em>).
                  </span>
                </div>
              </div>
              {onNavigateToCatalog && (
                <button
                  type="button"
                  onClick={onNavigateToCatalog}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 inline-flex items-center gap-1.5"
                >
                  <span>Voir le Catalogue</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>

            {!isCatalogMode && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
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
                        name="warehouse_view"
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
                {isCatalogMode ? (
                  <span className="text-slate-600 font-semibold">
                    Catalogue global des références (sans sélection de dépôt requise)
                  </span>
                ) : (
                  <>
                    <span className="text-slate-500">Dépôt :</span>
                    <span className="font-bold text-slate-900">
                      {selectedWh?.name || 'Magasin (Boutique)'}
                    </span>
                  </>
                )}
                <button
                  onClick={() => setStep(1)}
                  className="ml-3 text-amber-600 hover:text-amber-700 font-bold"
                >
                  Modifier le fichier
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Correspondance des colonnes ({isCatalogMode ? 'Modèle Catalogue — 5 colonnes' : 'Modèle Stock — 7 colonnes'})
                </h4>
                <span className="text-[11px] text-slate-500">
                  Les champs avec un astérisque (*) sont obligatoires • Les valeurs vides n'écrasent jamais les données existantes
                </span>
              </div>

              {isCatalogMode ? (
                /* === 1. MODÈLE CATALOGUE (5 COLONNES) === */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-800 block">
                      1. Référence * :
                    </label>
                    <select
                      value={mapping.mainReference}
                      onChange={(e) => setMapping((m) => ({ ...m, mainReference: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500 font-semibold"
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
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-slate-700 block">
                      4. Équivalences :
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

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      5. Seuil minimum :
                    </label>
                    <select
                      value={mapping.minStockThreshold || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, minStockThreshold: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500"
                    >
                      <option value="">-- Par défaut (2) --</option>
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
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-amber-900 block">
                      2. Marque (Caterpillar, CTP, ITR...) :
                    </label>
                    <select
                      value={mapping.brand || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, brand: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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
                      value={mapping.initialQuantity || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, initialQuantity: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-amber-900 block">
                      4. Emplacement :
                    </label>
                    <select
                      value={mapping.physicalLocation || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, physicalLocation: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-amber-900 block">
                      5. Numéro de facture de commande :
                    </label>
                    <select
                      value={mapping.invoiceNumber || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, invoiceNumber: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-amber-900 block">
                      6. Prix d'achat unitaire :
                    </label>
                    <select
                      value={mapping.purchasePrice || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, purchasePrice: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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
                    <label className="text-[11px] font-bold text-amber-900 block">
                      7. Prix de vente unitaire :
                    </label>
                    <select
                      value={mapping.salePrice || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, salePrice: e.target.value }))}
                      className="w-full text-xs rounded-lg border border-amber-300 p-2 bg-amber-50/40 focus:border-amber-500 font-semibold"
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

            {isCatalogMode ? (
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

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Aperçu des données ({isCatalogMode ? 'Modèle Catalogue' : 'Modèle Stock'})
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
                {isCatalogMode ? (
                  /* === TABLEAU APERÇU CATALOGUE (5 COLONNES) === */
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
                        <th className="py-2.5 px-3">Observations</th>
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
                            key={`view-cat-row-${row.rowIndex}`}
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
                            <td className="py-2 px-3 font-medium text-slate-900 max-w-xs truncate" title={row.designation}>
                              {row.designation || <span className="text-rose-500 italic">Vide</span>}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={row.description}>
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
                  /* === TABLEAU APERÇU STOCK (7 COLONNES) === */
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
                        <th className="py-2.5 px-3">Observations</th>
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
                            key={`view-stock-row-${row.rowIndex}`}
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
                            <td className="py-2 px-3 text-slate-700 font-mono text-[11px] truncate max-w-[180px]" title={row.physicalLocation}>
                              {row.physicalLocation}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                              {row.invoiceNumber || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {formatFCFA(row.purchasePrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
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
                    Traitement anti-saturation en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    Confirmer l'importation ({uniqueReferencesCount} réf. uniques, {validRowsCount} offres)
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
                <span className="text-[11px] text-[#7A5C00] font-medium block">Stock physique</span>
                <span className="text-xl font-bold text-[#111111] font-mono">
                  {resultReport.totalQuantityImported ?? 0}
                </span>
                <span className="text-[10px] text-[#7A5C00] block">
                  {resultReport.positiveStockEntriesCount ?? resultReport.createdMovements} entrée(s)
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

      {/* Modal Extraction Copier-Coller Caterpillar SIS 2.0 */}
      {isSis2ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-lg font-bold">
                  <Sparkles className="w-5 h-5 fill-slate-950" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Extracteur Rapide Caterpillar SIS 2.0
                  </h3>
                  <p className="text-xs text-slate-500">
                    Collez ici n'importe quelle liste ou texte extrait du logiciel SIS 2.0
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSis2ModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Texte brut / Liste copiée depuis Caterpillar SIS 2.0 :
              </label>
              <textarea
                value={sis2PastedText}
                onChange={(e) => setSis2PastedText(e.target.value)}
                placeholder={`Collez votre texte ici, par exemple :\n1R-0716 FILTER 2 UN\n320-0680 INJECTOR GP 6\n1U3352 TOOTH J350\n235-9620 TURBOCHARGER C9\n326-1644 WATER SEPARATOR`}
                rows={8}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Notre algorithme va automatiquement isoler les références Caterpillar (`1R-0716`, `320-0680`, `1U3352`, etc.), catégoriser les pièces et estimer leurs tarifs.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSis2ModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleParsePastedSis2Text}
                disabled={!sis2PastedText.trim()}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                Extraire les références & Importer
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportCustomersModal
        isOpen={isCustomersImportOpen}
        onClose={() => setIsCustomersImportOpen(false)}
      />
    </div>
  );
};
