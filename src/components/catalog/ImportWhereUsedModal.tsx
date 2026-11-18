import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Article } from '../../types';
import { useStock } from '../../context/StockContext';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Tractor,
  Cpu,
  Search,
} from 'lucide-react';

interface ImportWhereUsedModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedApplicationRow {
  rowIndex: number;
  productFamily?: string;
  subFamily?: string;
  model: string;
  serialPrefix?: string;
  isValid: boolean;
  isDuplicate?: boolean;
  error?: string;
}

export const ImportWhereUsedModal: React.FC<ImportWhereUsedModalProps> = ({
  article: initialArticle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { articles, importMachineApplicationsForArticle } = useStock();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected article (can be passed via prop or selected in modal)
  const [selectedArticleId, setSelectedArticleId] = useState<string>(
    initialArticle ? initialArticle.id : ''
  );
  const [articleSearchQuery, setArticleSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && initialArticle) {
      setSelectedArticleId(initialArticle.id);
    }
  }, [isOpen, initialArticle]);

  const activeArticle =
    (selectedArticleId && articles.find((a) => a.id === selectedArticleId)) ||
    (initialArticle && articles.find((a) => a.id === initialArticle.id)) ||
    initialArticle ||
    null;

  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedApplicationRow[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'DUPLICATE'>('ALL');
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    addedCount: number;
    duplicateCount: number;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Existing applications on this article for duplicate checking
  const existingApps = activeArticle?.machineApplications || [];

  const handleDownloadExcelTemplate = () => {
    const headers = [
      'Famille de produits',
      'Sous-famille',
      'Modèle de vente',
      'Préfixe',
    ];

    const sampleRows = [
      ['EXCAVATOR', '320', '320D', 'FAL'],
      ['EXCAVATOR', '320', '320D L', 'WBN'],
      ['EXCAVATOR', '330', '330D', 'MWP'],
      ['TRACK-TYPE TRACTOR', 'D6', 'D6R', 'B4L'],
      ['TRACK-TYPE TRACTOR', 'D8', 'D8T', 'J8B'],
      ['WHEEL LOADER', '966', '966H', 'A6G'],
      ['MOTOR GRADER', '140', '140M', 'B9D'],
      ['ARTICULATED TRUCK', '730', '730C', 'TFF'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    ws['!cols'] = [
      { wch: 24 }, // Famille de produits
      { wch: 18 }, // Sous-famille
      { wch: 18 }, // Modèle de vente
      { wch: 14 }, // Préfixe
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Where_Used_SIS2');
    const safeRef = activeArticle ? `_${activeArticle.mainReference.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
    XLSX.writeFile(wb, `Modele_Where_Used_SIS2_Caterpillar${safeRef}.xlsx`);
  };

  const handleDownloadCsvTemplate = () => {
    const headers = 'Famille de produits;Sous-famille;Modèle de vente;Préfixe\n';
    const sampleRows = [
      'EXCAVATOR;320;320D;FAL',
      'EXCAVATOR;320;320D L;WBN',
      'EXCAVATOR;330;330D;MWP',
      'TRACK-TYPE TRACTOR;D6;D6R;B4L',
      'WHEEL LOADER;966;966H;A6G',
      'MOTOR GRADER;140;140M;B9D',
    ].join('\n');

    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Modele_Where_Used_SIS2_Caterpillar.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setResultSummary(null);
    setFileName(file.name);
    setFileSizeStr(`${(file.size / 1024).toFixed(1)} Ko`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setParseError('Le fichier est vide ou aucune ligne de données n’a été trouvée.');
          return;
        }

        // Helper to find column matching aliases
        const findCol = (row: any, aliases: string[]) => {
          const keys = Object.keys(row);
          for (const alias of aliases) {
            const found = keys.find(
              (k) => k.trim().toLowerCase() === alias.toLowerCase()
            );
            if (found) return found;
          }
          // Soft match contains
          for (const alias of aliases) {
            const found = keys.find((k) =>
              k.trim().toLowerCase().includes(alias.toLowerCase())
            );
            if (found) return found;
          }
          return null;
        };

        const first = rawJson[0];
        const famCol = findCol(first, [
          'famille de produits',
          'famille',
          'product family',
          'productfamily',
          'family',
          'famille de produit',
          'catégorie',
          'categorie',
        ]);
        const subFamCol = findCol(first, [
          'sous-famille',
          'sous famille',
          'subfamily',
          'sub family',
          'sub-family',
          'sous-gamme',
          'gamme',
        ]);
        const modelCol = findCol(first, [
          'modèle de vente',
          'modele de vente',
          'modèle',
          'modele',
          'sales model',
          'salesmodel',
          'model',
          'machine',
          'modèle engin',
          'modele engin',
          'equipement',
        ]);
        const prefixCol = findCol(first, [
          'préfixe',
          'prefixe',
          'prefix',
          's/n prefix',
          'sn prefix',
          'serial prefix',
          'préfixe n° série',
          'prefixe n serie',
          'série',
          'serie',
          's/n',
        ]);

        if (!modelCol) {
          setParseError(
            'Colonne "Modèle de vente" (ou "Modèle") introuvable dans le fichier. Téléchargez le modèle officiel SIS 2.0 pour vérifier les colonnes.'
          );
          return;
        }

        const rows: ParsedApplicationRow[] = rawJson.map((row, index) => {
          const rawFam = famCol ? String(row[famCol] || '').trim() : '';
          const rawSub = subFamCol ? String(row[subFamCol] || '').trim() : '';
          const rawModel = modelCol ? String(row[modelCol] || '').trim().toUpperCase() : '';
          const rawPrefix = prefixCol ? String(row[prefixCol] || '').trim().toUpperCase() : '';

          const hasModel = rawModel.length > 0;
          let isValid = hasModel;
          let error: string | undefined;

          if (!hasModel) {
            isValid = false;
            error = 'Modèle de vente manquant';
          }

          // Check if duplicate on this piece
          const isDuplicate = existingApps.some(
            (a) =>
              a.model.toLowerCase() === rawModel.toLowerCase() &&
              (a.serialPrefix || '').toLowerCase() === rawPrefix.toLowerCase()
          );

          return {
            rowIndex: index + 2,
            productFamily: rawFam || undefined,
            subFamily: rawSub || undefined,
            model: rawModel,
            serialPrefix: rawPrefix || undefined,
            isValid,
            isDuplicate,
            error,
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        setParseError(`Erreur lors de la lecture du fichier : ${err.message || 'Format non reconnu'}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = () => {
    if (!activeArticle) {
      setParseError('Veuillez sélectionner la pièce de destination.');
      return;
    }

    const validRows = parsedRows.filter((r) => r.isValid && r.model);
    if (validRows.length === 0) return;

    setIsExecuting(true);
    try {
      const res = importMachineApplicationsForArticle(
        activeArticle.id,
        validRows.map((r) => ({
          productFamily: r.productFamily,
          subFamily: r.subFamily,
          model: r.model,
          serialPrefix: r.serialPrefix,
        }))
      );

      setResultSummary(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setParseError(err.message || 'Erreur lors de l’importation.');
    } finally {
      setIsExecuting(false);
    }
  };

  const resetImport = () => {
    setFileName('');
    setFileSizeStr('');
    setParsedRows([]);
    setResultSummary(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredArticles = articles.filter(
    (a) =>
      a.mainReference.toLowerCase().includes(articleSearchQuery.toLowerCase()) ||
      a.designation.toLowerCase().includes(articleSearchQuery.toLowerCase())
  );

  const validRowsCount = parsedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateRowsCount = parsedRows.filter((r) => r.isDuplicate).length;
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length;

  const displayedRows = parsedRows.filter((r) => {
    if (filterMode === 'VALID') return r.isValid && !r.isDuplicate;
    if (filterMode === 'DUPLICATE') return r.isDuplicate;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Tractor className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Importation Where Used SIS 2.0 (Pièce par pièce)
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  Caterpillar SIS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Importez les affectations d'engins directement depuis votre export SIS 2.0 pour une référence précise.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Article Banner / Selector */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/80 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 font-mono block">
                  Pièce de destination :
                </span>
                {activeArticle ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold font-mono text-slate-950 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                      {activeArticle.mainReference}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {activeArticle.designation}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({activeArticle.machineApplications?.length || 0} engin(s) déjà affecté(s))
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-rose-700 font-semibold mt-0.5 block">
                    Veuillez sélectionner la pièce ci-dessous
                  </span>
                )}
              </div>

              {!initialArticle && (
                <div className="relative min-w-[260px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={articleSearchQuery}
                    onChange={(e) => setArticleSearchQuery(e.target.value)}
                    placeholder="Chercher une référence..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {articleSearchQuery && (
                    <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg text-xs divide-y divide-slate-100">
                      {filteredArticles.slice(0, 10).map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            setSelectedArticleId(art.id);
                            setArticleSearchQuery('');
                          }}
                          className="p-2 hover:bg-amber-50 cursor-pointer flex items-center justify-between"
                        >
                          <span className="font-mono font-bold text-slate-950">{art.mainReference}</span>
                          <span className="text-slate-600 truncate max-w-[150px]">{art.designation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Format Specification Banner & Download Templates */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Format du fichier SIS 2.0 (4 colonnes) :
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Aucun besoin d'indiquer la référence dans le fichier car l'import est effectué pour cette pièce.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modèle Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
                >
                  Modèle CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Colonne 1</span>
                <span className="font-bold text-slate-900 block">Famille de produits</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: EXCAVATOR</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Colonne 2</span>
                <span className="font-bold text-slate-900 block">Sous-famille</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: 320, D6</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-300 bg-amber-50/50 shadow-2xs">
                <span className="text-amber-700 block text-[10px] uppercase font-mono font-bold">Colonne 3 *</span>
                <span className="font-bold text-slate-950 block">Modèle de vente</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: 320D, 966H</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-300 bg-amber-50/50 shadow-2xs">
                <span className="text-amber-700 block text-[10px] uppercase font-mono font-bold">Colonne 4</span>
                <span className="font-bold text-slate-950 block">Préfixe</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: FAL, WBN</span>
              </div>
            </div>
          </div>

          {/* Success summary */}
          {resultSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Importation Where Used réussie !</span>
              </div>
              <p className="text-xs text-emerald-700">
                <strong className="text-emerald-950 font-bold">{resultSummary.addedCount}</strong> nouvel(s) engin(s) ajouté(s) à la pièce{' '}
                <span className="font-mono font-bold">{activeArticle?.mainReference}</span>.
                {resultSummary.duplicateCount > 0 && (
                  <span className="ml-1 text-slate-600">
                    ({resultSummary.duplicateCount} engin(s) déjà existant(s) ignoré(s))
                  </span>
                )}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Terminer et voir la fiche
                </button>
                <button
                  type="button"
                  onClick={resetImport}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-lg text-xs font-medium hover:bg-emerald-100 cursor-pointer"
                >
                  Importer un autre fichier
                </button>
              </div>
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Erreur de traitement :</span>
                <span>{parseError}</span>
              </div>
              <button onClick={() => setParseError(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* File Upload Zone */}
          {parsedRows.length === 0 && !resultSummary && (
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
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Glissez votre fichier Where Used SIS 2.0 ici ou cliquez pour parcourir
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Fichiers Excel (.xlsx, .xls) ou CSV exportés depuis Caterpillar SIS 2.0
              </p>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && !resultSummary && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">{fileName}</span>
                  <span className="text-slate-500 font-mono">({fileSizeStr})</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] text-slate-700 font-semibold">
                    {parsedRows.length} ligne(s)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFilterMode('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      filterMode === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Toutes ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('VALID')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      filterMode === 'VALID'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    À ajouter ({validRowsCount})
                  </button>
                  {duplicateRowsCount > 0 && (
                    <button
                      onClick={() => setFilterMode('DUPLICATE')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        filterMode === 'DUPLICATE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      Déjà affectés ({duplicateRowsCount})
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px] sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Ligne</th>
                      <th className="py-2 px-3">Famille de produits</th>
                      <th className="py-2 px-3">Sous-famille</th>
                      <th className="py-2 px-3">Modèle de vente</th>
                      <th className="py-2 px-3">Préfixe</th>
                      <th className="py-2 px-3 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRows.map((r) => (
                      <tr
                        key={r.rowIndex}
                        className={`hover:bg-slate-50 transition-colors ${
                          r.isDuplicate ? 'bg-amber-50/30' : !r.isValid ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                          #{r.rowIndex}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {r.productFamily || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {r.subFamily || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 font-mono">
                          {r.model}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {r.serialPrefix ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-bold border border-slate-200 text-[11px]">
                              {r.serialPrefix}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {r.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Déjà affecté
                            </span>
                          ) : r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Prêt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                              <AlertCircle className="w-3 h-3" />
                              {r.error || 'Erreur'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={resetImport}
            disabled={parsedRows.length === 0}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
            >
              Fermer
            </button>

            {parsedRows.length > 0 && !resultSummary && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isExecuting || validRowsCount === 0 || !activeArticle}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg inline-flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Affectation en cours...</span>
                  </>
                ) : (
                  <>
                    <Tractor className="w-4 h-4 text-slate-950" />
                    <span>
                      Affecter les {validRowsCount} engin(s) à {activeArticle?.mainReference || 'la pièce'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
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
