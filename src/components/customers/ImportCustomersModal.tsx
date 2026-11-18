import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useStock } from '../../context/StockContext';
import { formatFCFA, exportToCSV } from '../../utils/formatters';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface ImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

interface CustomerFieldMapping {
  code: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  creditLimit: string;
  outstandingBalance: string;
  depositBalance: string;
  notes: string;
}

export const CUSTOMER_TEMPLATE_HEADERS = [
  'Code Client',
  'Nom / Raison Sociale',
  'Téléphone',
  'Adresse',
  'Email',
  'Plafond de crédit',
  'Solde créance initial',
  'Acompte disponible',
  'Notes',
];

export const CUSTOMER_SAMPLE_ROWS = [
  [
    'CLI-001',
    'SOGEA SATOM SÉNÉGAL',
    '+221 77 450 12 34',
    'Zone Industrielle, Dakar',
    'achats@sogeasatom.sn',
    5000000,
    0,
    0,
    'Client grand compte BTP',
  ],
  [
    'CLI-002',
    'ENTREPRISE CSE TP',
    '+221 77 812 90 00',
    'Rocade Fann Bel-Air, Dakar',
    'logistique@cse.sn',
    10000000,
    350000,
    0,
    'Flotte Caterpillar & Komatsu',
  ],
  [
    'CLI-003',
    'ATELIER MÉCANIQUE NDIAYE & FRÈRES',
    '+221 76 320 44 55',
    'Route de Rufisque, Pikine',
    '',
    1500000,
    0,
    100000,
    'Client régulier pièces moteurs',
  ],
];

function normalizeHeader(h: string): string {
  return (h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function autoDetectCustomerMapping(columns: string[]): CustomerFieldMapping {
  const mapping: CustomerFieldMapping = {
    code: '',
    name: '',
    phone: '',
    address: '',
    email: '',
    creditLimit: '',
    outstandingBalance: '',
    depositBalance: '',
    notes: '',
  };

  for (const col of columns) {
    const n = normalizeHeader(col);
    if (!mapping.code && (n.includes('code') || n === 'id' || n === 'matricule' || n === 'refclient')) {
      mapping.code = col;
    } else if (
      !mapping.name &&
      (n.includes('nom') ||
        n.includes('raisonsociale') ||
        n.includes('client') ||
        n.includes('societe') ||
        n.includes('entreprise') ||
        n === 'name')
    ) {
      mapping.name = col;
    } else if (
      !mapping.phone &&
      (n.includes('tel') || n.includes('phone') || n.includes('mobile') || n.includes('contact') || n.includes('portable'))
    ) {
      mapping.phone = col;
    } else if (
      !mapping.address &&
      (n.includes('adresse') || n.includes('ville') || n.includes('localisation') || n.includes('quartier') || n.includes('address'))
    ) {
      mapping.address = col;
    } else if (!mapping.email && (n.includes('mail') || n.includes('courriel'))) {
      mapping.email = col;
    } else if (!mapping.creditLimit && (n.includes('plafond') || n.includes('limite') || n.includes('creditlimit'))) {
      mapping.creditLimit = col;
    } else if (
      !mapping.outstandingBalance &&
      (n.includes('creance') || n.includes('dette') || n.includes('solde') || n.includes('impaye') || n.includes('reste'))
    ) {
      mapping.outstandingBalance = col;
    } else if (!mapping.depositBalance && (n.includes('acompte') || n.includes('avance') || n.includes('avoir'))) {
      mapping.depositBalance = col;
    } else if (!mapping.notes && (n.includes('note') || n.includes('observation') || n.includes('commentaire'))) {
      mapping.notes = col;
    }
  }

  // Fallback if name wasn't matched but there is a first or second column
  if (!mapping.name && columns.length > 0) {
    mapping.name = columns.find((c) => c !== mapping.code) || columns[0];
  }

  return mapping;
}

function parseAmount(val: any): number | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? Math.max(0, val) : undefined;
  const cleaned = String(val)
    .replace(/\s+/g, '')
    .replace(/fcfa|cfa|f/gi, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : undefined;
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { customers, importCustomers } = useStock();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<CustomerFieldMapping>({
    code: '',
    name: '',
    phone: '',
    address: '',
    email: '',
    creditLimit: '',
    outstandingBalance: '',
    depositBalance: '',
    notes: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
  } | null>(null);

  const resetModal = () => {
    setStep(1);
    setFileName('');
    setAvailableColumns([]);
    setRawRows([]);
    setErrorMessage(null);
    setImportResult(null);
  };

  const handleDownloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [CUSTOMER_TEMPLATE_HEADERS, ...CUSTOMER_SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 34 },
      { wch: 20 },
      { wch: 28 },
      { wch: 26 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Clients');
    XLSX.writeFile(wb, 'modele_import_clients.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
    exportToCSV('modele_import_clients', CUSTOMER_TEMPLATE_HEADERS, CUSTOMER_SAMPLE_ROWS);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error('Le classeur ne contient aucune feuille.');

      const worksheet = workbook.Sheets[firstSheet];
      const parsed: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (parsed.length === 0) throw new Error('Le fichier sélectionné est vide.');

      const cols = Object.keys(parsed[0] || {});
      setAvailableColumns(cols);
      setRawRows(parsed);
      setMapping(autoDetectCustomerMapping(cols));
      setStep(2);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Impossible de lire le fichier. Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV.'
      );
    }
  };

  const parsedRowsPreview = useMemo(() => {
    return rawRows.map((raw, idx) => {
      const code = mapping.code ? String(raw[mapping.code] ?? '').trim().toUpperCase() : '';
      const name = mapping.name ? String(raw[mapping.name] ?? '').trim() : '';
      const phone = mapping.phone ? String(raw[mapping.phone] ?? '').trim() : '';
      const address = mapping.address ? String(raw[mapping.address] ?? '').trim() : '';
      const email = mapping.email ? String(raw[mapping.email] ?? '').trim() : '';
      const creditLimit = mapping.creditLimit ? parseAmount(raw[mapping.creditLimit]) : undefined;
      const outstandingBalance = mapping.outstandingBalance
        ? parseAmount(raw[mapping.outstandingBalance])
        : undefined;
      const depositBalance = mapping.depositBalance ? parseAmount(raw[mapping.depositBalance]) : undefined;
      const notes = mapping.notes ? String(raw[mapping.notes] ?? '').trim() : '';

      const exists =
        Boolean(name) &&
        customers.some(
          (c) =>
            (code && c.code.toUpperCase() === code) ||
            c.name.trim().toLowerCase() === name.toLowerCase()
        );

      return {
        rowNumber: idx + 2,
        code,
        name,
        phone,
        address,
        email,
        creditLimit,
        outstandingBalance,
        depositBalance,
        notes,
        isValid: Boolean(name),
        exists,
      };
    });
  }, [rawRows, mapping, customers]);

  const validRows = useMemo(
    () => parsedRowsPreview.filter((r) => r.isValid),
    [parsedRowsPreview]
  );

  if (!isOpen) return null;

  const handleExecuteImport = () => {
    if (validRows.length === 0) {
      setErrorMessage('Aucune ligne client valide à importer. Vérifiez la colonne "Nom / Raison Sociale".');
      return;
    }

    const res = importCustomers(validRows);
    setImportResult(res);
    setStep(3);
    if (onSuccess) {
      onSuccess(
        `${res.totalProcessed} client(s) importé(s) (${res.createdCount} créé(s), ${res.updatedCount} mis à jour).`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Importation de Clients (Excel / CSV)</h3>
              <p className="text-xs text-slate-400">
                Ajoutez ou mettez à jour votre répertoire clients, plafonds et soldes de créances
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {/* Template Download Banner */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                    Modèle Excel d'importation des clients
                  </h4>
                  <p className="text-xs text-slate-600">
                    Colonnes prises en charge : <strong>Code Client, Nom / Raison Sociale, Téléphone, Adresse, Email, Plafond de crédit, Solde créance initial, Acompte disponible, Notes</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modèle Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/60 hover:bg-amber-50/20 rounded-2xl p-10 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-900">
                  Cliquez pour sélectionner votre fichier Clients (.xlsx, .xls ou .csv)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Les clients existants (même code ou même nom) seront mis à jour sans perte d'historique.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* File info & Column Mapping */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">{fileName}</span>
                  <span className="text-slate-500">({rawRows.length} lignes détectées)</span>
                </div>
                <button
                  type="button"
                  onClick={resetModal}
                  className="text-xs font-semibold text-amber-700 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Changer de fichier
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Correspondance des colonnes (Clients)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { key: 'name', label: 'Nom / Raison Sociale *', required: true },
                    { key: 'code', label: 'Code Client (auto si vide)' },
                    { key: 'phone', label: 'Téléphone' },
                    { key: 'address', label: 'Adresse / Ville' },
                    { key: 'email', label: 'Email' },
                    { key: 'outstandingBalance', label: 'Solde créance initial (FCFA)' },
                    { key: 'creditLimit', label: 'Plafond de crédit (FCFA)' },
                    { key: 'depositBalance', label: 'Acompte disponible (FCFA)' },
                    { key: 'notes', label: 'Notes / Observations' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {field.label}
                      </label>
                      <select
                        value={(mapping as any)[field.key] || ''}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white focus:outline-none ${
                          field.required && !(mapping as any)[field.key]
                            ? 'border-rose-400 bg-rose-50/30'
                            : 'border-slate-200'
                        }`}
                      >
                        <option value="">— Non assigné —</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Aperçu avant importation ({validRows.length} valide(s) sur {parsedRowsPreview.length})
                  </span>
                  <span className="text-slate-500">
                    Affichage des 25 premières lignes
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Statut</th>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Nom / Raison Sociale</th>
                        <th className="py-2 px-3">Téléphone</th>
                        <th className="py-2 px-3">Adresse</th>
                        <th className="py-2 px-3 text-right">Créance init.</th>
                        <th className="py-2 px-3 text-right">Plafond</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRowsPreview.slice(0, 25).map((r) => (
                        <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-rose-50/40'}>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {!r.isValid ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold text-[10px]">
                                Nom manquant
                              </span>
                            ) : r.exists ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                                Mise à jour
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                Nouveau
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.code || 'Auto'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {r.name || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{r.phone || '—'}</td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-[160px]">
                            {r.address || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {r.outstandingBalance !== undefined ? formatFCFA(r.outstandingBalance) : '0 FCFA'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {r.creditLimit !== undefined ? formatFCFA(r.creditLimit) : '1 000 000 FCFA'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && importResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Importation des clients terminée avec succès
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Vos clients ont été enregistrés dans la base locale et synchronisés avec Firestore.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-mono font-bold text-lg text-emerald-700">
                    {importResult.createdCount}
                  </div>
                  <div className="text-emerald-900 font-medium">Nouveaux clients</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-mono font-bold text-lg text-amber-700">
                    {importResult.updatedCount}
                  </div>
                  <div className="text-amber-900 font-medium">Clients mis à jour</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="font-mono font-bold text-lg text-slate-700">
                    {importResult.skippedCount}
                  </div>
                  <div className="text-slate-600 font-medium">Ignorés</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            {step === 3 ? 'Fermer' : 'Annuler'}
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={validRows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <span>Importer {validRows.length} client(s)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
