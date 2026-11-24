import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Database,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Copy,
  Check,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Server,
  Zap,
  Trash2,
  Search,
  Eye,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Sparkles,
  Table as TableIcon,
  Code2,
  RotateCcw,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  testFirestoreConnection,
  uploadAllToFirebase,
  downloadAllFromFirebase,
  FirebaseSyncStats,
} from '../../services/firebaseSync';
import {
  getFirebaseEnvironmentInfo,
  subscribeToQuotaExceeded,
} from '../../firebase';
import { exportToCSV } from '../../utils/formatters';
import { SortableTh, TablePagination, usePagination } from '../common/TablePagination';

type DatabaseTab = 'tables' | 'sync' | 'backup' | 'schemas';

interface TableDescriptor {
  key: string;
  label: string;
  collectionName: string;
  category: 'Catalogue & Stock' | 'Commercial & Caisse' | 'Logistique & Achats' | 'Système';
  description: string;
  data: any[];
  canPurge: boolean;
  columns: Array<{ key: string; label: string; render?: (row: any) => React.ReactNode }>;
}

export const DatabaseArchitectureView: React.FC = () => {
  const {
    exportDatabaseJson,
    restoreDatabaseJson,
    purgeCollection,
    optimizeDatabaseStorage,
    resetToDemoData,
    clearAllData,
    articles,
    warehouses,
    stocks,
    movements,
    customers,
    sales,
    payments,
    cashSessions,
    cashMovements,
    inventories,
    suppliers,
    supplierOrders,
    quotes,
    returns,
    companyInfo,
    users,
    currentUser,
  } = useStock();

  const [activeMainTab, setActiveMainTab] = useState<DatabaseTab>('tables');
  const [selectedTableKey, setSelectedTableKey] = useState<string>('articles');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [inspectorViewMode, setInspectorViewMode] = useState<'table' | 'json'>('table');
  const [inspectorSortBy, setInspectorSortBy] = useState<string>('');
  const [inspectorSortDir, setInspectorSortDir] = useState<'asc' | 'desc'>('asc');

  const handleInspectorSort = (colKey: string) => {
    if (inspectorSortBy === colKey) {
      setInspectorSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setInspectorSortBy(colKey);
      setInspectorSortDir('asc');
    }
  };

  // Confirmation states for destructive actions
  const [confirmPurgeKey, setConfirmPurgeKey] = useState<string | null>(null);
  const [confirmWipeOpen, setConfirmWipeOpen] = useState<boolean>(false);
  const [wipeKeepWarehouses, setWipeKeepWarehouses] = useState<boolean>(true);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [firebaseEnvInfo] = useState(() => getFirebaseEnvironmentInfo());

  // Status banner feedback
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Restore JSON file states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedBackupFile, setParsedBackupFile] = useState<{
    fileName: string;
    exportDate?: string;
    version?: string;
    companyName?: string;
    hasDemoArticles?: boolean;
    raw: any;
    summary: Array<{ label: string; count: number | string }>;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [excludeDemoOnRestore, setExcludeDemoOnRestore] = useState<boolean>(false);
  const [syncOnRestore, setSyncOnRestore] = useState<boolean>(false);
  const [lastRestoreVerification, setLastRestoreVerification] = useState<{
    verified: boolean;
    companyRestored: boolean;
    draftsRestored: number;
    details: Array<{
      key: string;
      label: string;
      inBackup: number;
      restored: number;
      ok: boolean;
    }>;
  } | null>(null);

  // Firebase testing and syncing states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<FirebaseSyncStats | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    return subscribeToQuotaExceeded(setQuotaExceeded);
  }, []);

  // Schema tab states
  const [activeSchemaTab, setActiveSchemaTab] = useState<'firebase' | 'postgres'>('firebase');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [storageRefreshTick, setStorageRefreshTick] = useState(0);

  // Build descriptors for all 14 database tables
  const tables: TableDescriptor[] = useMemo(
    () => [
      {
        key: 'articles',
        label: 'Catalogue Articles',
        collectionName: 'articles',
        category: 'Catalogue & Stock',
        description: 'Références pivots, désignations, marques associées, prix et seuils d’alerte.',
        data: articles,
        canPurge: true,
        columns: [
          { key: 'mainReference', label: 'Référence' },
          { key: 'designation', label: 'Désignation' },
          { key: 'brand', label: 'Marque' },
          { key: 'category', label: 'Catégorie' },
          {
            key: 'brandOffers',
            label: 'Marques (nb)',
            render: (r) => (r.brandOffers ? r.brandOffers.length : 1),
          },
          {
            key: 'purchasePrice',
            label: 'Prix Achat',
            render: (r) => `${Number(r.purchasePrice || 0).toLocaleString('fr-FR')} F`,
          },
          {
            key: 'salePrice',
            label: 'Prix Vente',
            render: (r) => `${Number(r.salePrice || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'defaultLocation', label: 'Emplacement' },
        ],
      },
      {
        key: 'stocks',
        label: 'Stocks par Dépôt',
        collectionName: 'stocks',
        category: 'Catalogue & Stock',
        description: 'Quantités physiques par article et par dépôt, répartition par marque et casiers.',
        data: stocks,
        canPurge: true,
        columns: [
          { key: 'articleId', label: 'ID Article' },
          { key: 'warehouseId', label: 'ID Dépôt' },
          {
            key: 'quantity',
            label: 'Quantité Totale',
            render: (r) => Number(r.quantity || 0).toLocaleString('fr-FR'),
          },
          { key: 'shelfLocation', label: 'Emplacement' },
          {
            key: 'brandBreakdown',
            label: 'Détail Marques',
            render: (r) =>
              r.brandBreakdown
                ? Object.entries(r.brandBreakdown)
                    .map(([b, q]) => `${b}: ${q}`)
                    .join(' · ')
                : '-',
          },
        ],
      },
      {
        key: 'warehouses',
        label: 'Magasins & Dépôts',
        collectionName: 'warehouses',
        category: 'Catalogue & Stock',
        description: 'Sites de stockage et boutiques de vente actifs dans l’entreprise.',
        data: warehouses,
        canPurge: true,
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Nom du Dépôt' },
          { key: 'location', label: 'Localisation' },
          { key: 'manager', label: 'Responsable' },
          {
            key: 'isDefault',
            label: 'Principal',
            render: (r) => (r.isDefault ? 'Oui' : 'Non'),
          },
        ],
      },
      {
        key: 'customers',
        label: 'Clients & Créances',
        collectionName: 'customers',
        category: 'Commercial & Caisse',
        description: 'Comptes clients, coordonnées, plafonds de crédit, créances et acomptes.',
        data: customers,
        canPurge: true,
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Nom Client' },
          { key: 'phone', label: 'Téléphone' },
          {
            key: 'outstandingBalance',
            label: 'Créance',
            render: (r) => `${Number(r.outstandingBalance || 0).toLocaleString('fr-FR')} F`,
          },
          {
            key: 'depositBalance',
            label: 'Acompte',
            render: (r) => `${Number(r.depositBalance || 0).toLocaleString('fr-FR')} F`,
          },
        ],
      },
      {
        key: 'sales',
        label: 'Journal des Ventes',
        collectionName: 'sales',
        category: 'Commercial & Caisse',
        description: 'Factures et reçus de vente validés ou annulés au guichet.',
        data: sales,
        canPurge: true,
        columns: [
          { key: 'receiptNumber', label: 'N° Reçu' },
          {
            key: 'date',
            label: 'Date',
            render: (r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'),
          },
          { key: 'customerName', label: 'Client' },
          {
            key: 'totalAmount',
            label: 'Total TTC',
            render: (r) => `${Number(r.totalAmount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'paymentStatus', label: 'Statut Paiement' },
          { key: 'status', label: 'État' },
        ],
      },
      {
        key: 'returns',
        label: 'Retours & Avoirs Clients',
        collectionName: 'returns',
        category: 'Commercial & Caisse',
        description: 'Retours de marchandises sur ventes, remboursements et avoirs clients.',
        data: returns,
        canPurge: true,
        columns: [
          { key: 'id', label: 'N° Retour' },
          {
            key: 'date',
            label: 'Date',
            render: (r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'),
          },
          { key: 'receiptNumber', label: 'Facture Origine' },
          {
            key: 'refundAmount',
            label: 'Montant Avoir',
            render: (r) => `${Number(r.refundAmount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'refundMethod', label: 'Mode' },
          { key: 'reason', label: 'Motif' },
        ],
      },
      {
        key: 'quotes',
        label: 'Devis & Proformas',
        collectionName: 'quotes',
        category: 'Commercial & Caisse',
        description: 'Offres commerciales et factures proforma émises pour les clients.',
        data: quotes,
        canPurge: true,
        columns: [
          { key: 'quoteNumber', label: 'N° Devis' },
          {
            key: 'date',
            label: 'Date',
            render: (r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'),
          },
          { key: 'customerName', label: 'Client' },
          {
            key: 'totalAmount',
            label: 'Montant',
            render: (r) => `${Number(r.totalAmount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'status', label: 'Statut' },
        ],
      },
      {
        key: 'payments',
        label: 'Règlements & Acomptes',
        collectionName: 'payments',
        category: 'Commercial & Caisse',
        description: 'Encaissements sur ventes, règlements de créances et avances clients.',
        data: payments,
        canPurge: true,
        columns: [
          { key: 'id', label: 'ID Paiement' },
          {
            key: 'date',
            label: 'Date',
            render: (r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'),
          },
          { key: 'method', label: 'Mode' },
          {
            key: 'amount',
            label: 'Montant',
            render: (r) => `${Number(r.amount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'userName', label: 'Opérateur' },
        ],
      },
      {
        key: 'cashSessions',
        label: 'Sessions de Caisse',
        collectionName: 'cashSessions',
        category: 'Commercial & Caisse',
        description: 'Ouvertures et clôtures de caisse avec pointage du tiroir espèces.',
        data: cashSessions,
        canPurge: true,
        columns: [
          { key: 'id', label: 'Session' },
          { key: 'warehouseName', label: 'Magasin' },
          { key: 'openedByUserName', label: 'Caissier' },
          {
            key: 'theoreticalCash',
            label: 'Solde Théorique',
            render: (r) => `${Number(r.theoreticalCash || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'status', label: 'Statut' },
        ],
      },
      {
        key: 'cashMovements',
        label: 'Mouvements de Caisse',
        collectionName: 'cashMovements',
        category: 'Commercial & Caisse',
        description: 'Écritures détaillées d’entrées et sorties de trésorerie par session.',
        data: cashMovements,
        canPurge: true,
        columns: [
          { key: 'id', label: 'ID Écriture' },
          { key: 'type', label: 'Type' },
          { key: 'direction', label: 'Sens' },
          {
            key: 'amount',
            label: 'Montant',
            render: (r) => `${Number(r.amount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'reason', label: 'Motif' },
        ],
      },
      {
        key: 'movements',
        label: 'Mouvements de Stock',
        collectionName: 'movements',
        category: 'Logistique & Achats',
        description: 'Journal d’audit des entrées, sorties, transferts et ajustements de stock.',
        data: movements,
        canPurge: true,
        columns: [
          { key: 'id', label: 'ID Mouvement' },
          {
            key: 'date',
            label: 'Date',
            render: (r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '-'),
          },
          { key: 'type', label: 'Type' },
          { key: 'articleId', label: 'Article' },
          { key: 'quantity', label: 'Qté' },
          { key: 'documentRef', label: 'Réf. Doc' },
          { key: 'reason', label: 'Motif' },
        ],
      },
      {
        key: 'inventories',
        label: 'Inventaires Physiques',
        collectionName: 'inventories',
        category: 'Logistique & Achats',
        description: 'Campagnes de comptage contradictoire et régularisations d’écarts.',
        data: inventories,
        canPurge: true,
        columns: [
          { key: 'code', label: 'Code Session' },
          { key: 'date', label: 'Date' },
          { key: 'supervisor', label: 'Superviseur' },
          { key: 'status', label: 'Statut' },
          {
            key: 'items',
            label: 'Lignes comptées',
            render: (r) => (Array.isArray(r.items) ? r.items.length : 0),
          },
        ],
      },
      {
        key: 'supplierOrders',
        label: 'Commandes Fournisseurs',
        collectionName: 'supplierOrders',
        category: 'Logistique & Achats',
        description: 'Bons de commande d’approvisionnement et réceptions de marchandises.',
        data: supplierOrders,
        canPurge: true,
        columns: [
          { key: 'orderNumber', label: 'N° BC' },
          { key: 'supplierName', label: 'Fournisseur' },
          { key: 'targetWarehouseName', label: 'Destination' },
          {
            key: 'totalAmount',
            label: 'Montant Total',
            render: (r) => `${Number(r.totalAmount || 0).toLocaleString('fr-FR')} F`,
          },
          { key: 'status', label: 'Statut' },
        ],
      },
      {
        key: 'suppliers',
        label: 'Répertoire Fournisseurs',
        collectionName: 'suppliers',
        category: 'Logistique & Achats',
        description: 'Fiches fournisseurs et partenaires d’approvisionnement.',
        data: suppliers,
        canPurge: true,
        columns: [
          { key: 'id', label: 'Code' },
          { key: 'name', label: 'Nom Fournisseur' },
          { key: 'contactName', label: 'Contact' },
          { key: 'phone', label: 'Téléphone' },
          { key: 'country', label: 'Pays / Ville' },
        ],
      },
      {
        key: 'users',
        label: 'Opérateurs & Accès',
        collectionName: 'users',
        category: 'Système',
        description: 'Comptes utilisateurs, rôles RBAC et affectations magasins.',
        data: users,
        canPurge: false,
        columns: [
          { key: 'name', label: 'Nom Opérateur' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Rôle' },
          {
            key: 'isActive',
            label: 'Actif',
            render: (r) => (r.isActive !== false ? 'Actif' : 'Désactivé'),
          },
        ],
      },
    ],
    [
      articles,
      stocks,
      warehouses,
      customers,
      sales,
      returns,
      quotes,
      payments,
      cashSessions,
      cashMovements,
      movements,
      inventories,
      supplierOrders,
      suppliers,
      users,
    ]
  );

  const selectedTable = useMemo(
    () => tables.find((t) => t.key === selectedTableKey) || tables[0],
    [tables, selectedTableKey]
  );

  // Compute localStorage diagnostics
  const storageMetrics = useMemo(() => {
    void storageRefreshTick;
    const prefix = firebaseEnvInfo.isAiStudioPreview
      ? 'equipstock_aistudio_demo_v1_'
      : 'equipstock_v4_local_';
    let totalBytes = 0;
    const breakdown: Array<{ key: string; bytes: number; kb: number }> = [];

    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach((k) => {
          const val = localStorage.getItem(k) || '';
          const bytes = (k.length + val.length) * 2;
          totalBytes += bytes;
          if (k.startsWith(prefix)) {
            breakdown.push({
              key: k.replace(prefix, ''),
              bytes,
              kb: Math.round((bytes / 1024) * 10) / 10,
            });
          }
        });
      } catch {}
    }

    breakdown.sort((a, b) => b.bytes - a.bytes);
    const maxQuotaBytes = 5 * 1024 * 1024; // ~5 MB standard browser quota
    const usagePercent = Math.min(100, Math.round((totalBytes / maxQuotaBytes) * 100));

    return {
      totalBytes,
      totalKb: (totalBytes / 1024).toFixed(1),
      totalMb: (totalBytes / (1024 * 1024)).toFixed(2),
      usagePercent,
      breakdown,
    };
  }, [
    articles,
    stocks,
    movements,
    customers,
    sales,
    quotes,
    payments,
    cashSessions,
    inventories,
    supplierOrders,
    storageRefreshTick,
  ]);

  const totalRecordsCount = useMemo(
    () => tables.reduce((sum, t) => sum + t.data.length, 0),
    [tables]
  );

  // Filter & sort rows in selected table inspector
  const filteredInspectorRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const list = !q
      ? [...selectedTable.data]
      : selectedTable.data.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(q)
        );
    if (inspectorSortBy) {
      list.sort((a, b) => {
        const va = a?.[inspectorSortBy];
        const vb = b?.[inspectorSortBy];
        let cmp = 0;
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb;
        } else {
          cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'fr', { numeric: true });
        }
        return inspectorSortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [selectedTable, tableSearch, inspectorSortBy, inspectorSortDir]);

  const {
    currentPage: currentInspectorPage,
    setCurrentPage: setInspectorPage,
    pageSize: inspectorPageSize,
    setPageSize: setInspectorPageSize,
    paginatedItems: paginatedInspectorRows,
  } = usePagination(filteredInspectorRows, 25);

  // Export single table as JSON
  const handleExportSingleTableJson = (table: TableDescriptor) => {
    const payload = {
      table: table.collectionName,
      label: table.label,
      exportedAt: new Date().toISOString(),
      count: table.data.length,
      records: table.data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipstock_table_${table.collectionName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export single table as CSV
  const handleExportSingleTableCsv = (table: TableDescriptor) => {
    if (!table.data || table.data.length === 0) return;
    const keys = Object.keys(table.data[0] || {});
    const rows: (string | number)[][] = table.data.map((row) =>
      keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        if (typeof v === 'number') return v;
        return String(v);
      })
    );
    exportToCSV(
      `equipstock_${table.collectionName}_${new Date().toISOString().slice(0, 10)}`,
      keys,
      rows
    );
  };

  // Handle JSON Backup File selection for Restore
  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(String(event.target?.result || '{}'));
        // Support both full database backup and single-table backup
        const normalizedRaw =
          json.table && Array.isArray(json.records)
            ? { [json.table]: json.records }
            : json;

        const demoIds = new Set(['art_1', 'art_2', 'art_3', 'art_4', 'art_5']);
        const hasDemoArticles =
          Array.isArray(normalizedRaw.articles) &&
          normalizedRaw.articles.some((a: any) => a && demoIds.has(a.id));

        const summary: Array<{ label: string; count: number | string }> = [
          { label: 'Articles Catalogue', count: Array.isArray(normalizedRaw.articles) ? normalizedRaw.articles.length : 0 },
          { label: 'Lignes de Stock', count: Array.isArray(normalizedRaw.stocks) ? normalizedRaw.stocks.length : 0 },
          { label: 'Magasins / Dépôts', count: Array.isArray(normalizedRaw.warehouses) ? normalizedRaw.warehouses.length : 0 },
          { label: 'Clients & Créances', count: Array.isArray(normalizedRaw.customers) ? normalizedRaw.customers.length : 0 },
          { label: 'Ventes & Factures', count: Array.isArray(normalizedRaw.sales) ? normalizedRaw.sales.length : 0 },
          { label: 'Retours / Avoirs Clients', count: Array.isArray(normalizedRaw.returns) ? normalizedRaw.returns.length : 0 },
          { label: 'Règlements & Acomptes', count: Array.isArray(normalizedRaw.payments) ? normalizedRaw.payments.length : 0 },
          { label: 'Devis & Proformas', count: Array.isArray(normalizedRaw.quotes) ? normalizedRaw.quotes.length : 0 },
          { label: 'Mouvements Stock', count: Array.isArray(normalizedRaw.movements) ? normalizedRaw.movements.length : 0 },
          { label: 'Sessions d’Inventaire', count: Array.isArray(normalizedRaw.inventories) ? normalizedRaw.inventories.length : 0 },
          { label: 'Sessions de Caisse', count: Array.isArray(normalizedRaw.cashSessions) ? normalizedRaw.cashSessions.length : 0 },
          { label: 'Opérations de Caisse', count: Array.isArray(normalizedRaw.cashMovements) ? normalizedRaw.cashMovements.length : 0 },
          { label: 'Fournisseurs', count: Array.isArray(normalizedRaw.suppliers) ? normalizedRaw.suppliers.length : 0 },
          { label: 'Commandes Fournisseurs', count: Array.isArray(normalizedRaw.supplierOrders) ? normalizedRaw.supplierOrders.length : 0 },
          { label: 'Opérateurs & Accès', count: Array.isArray(normalizedRaw.users) ? normalizedRaw.users.length : 0 },
          { label: 'Ventes en attente (POS)', count: Array.isArray(normalizedRaw.savedDrafts) ? normalizedRaw.savedDrafts.length : 0 },
          ...(normalizedRaw.companyInfo && typeof normalizedRaw.companyInfo === 'object'
            ? [{ label: 'Infos Entreprise & Logo', count: normalizedRaw.companyInfo.name || 'Inclus' }]
            : []),
        ].filter((item) => (typeof item.count === 'number' ? item.count > 0 : Boolean(item.count)));

        setParsedBackupFile({
          fileName: file.name,
          exportDate: json.exportDate || json.exportedAt,
          version: json.version,
          companyName: json.metadata?.companyName || json.companyInfo?.name,
          hasDemoArticles,
          raw: normalizedRaw,
          summary,
        });
        setExcludeDemoOnRestore(Boolean(hasDemoArticles));
        setLastRestoreVerification(null);
        setFeedbackBanner(null);
      } catch {
        setFeedbackBanner({
          type: 'error',
          message: 'Fichier JSON invalide. Veuillez sélectionner une sauvegarde JSON EquipStock valide.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!parsedBackupFile) return;
    const res = restoreDatabaseJson(parsedBackupFile.raw, restoreMode, {
      syncToCloud: syncOnRestore,
      excludeDemoRecords: excludeDemoOnRestore,
    });
    setFeedbackBanner({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });
    if (res.success) {
      if (res.verification) {
        setLastRestoreVerification(res.verification);
      }
      setParsedBackupFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStorageRefreshTick((t) => t + 1);
    }
  };

  const handleOptimizeStorage = () => {
    const res = optimizeDatabaseStorage();
    setStorageRefreshTick((t) => t + 1);
    setFeedbackBanner({
      type: 'success',
      message: res.message,
    });
  };

  const handleConfirmPurgeTable = (key: string) => {
    const res = purgeCollection(key);
    setConfirmPurgeKey(null);
    setStorageRefreshTick((t) => t + 1);
    setFeedbackBanner({
      type: res.success ? 'success' : 'error',
      message: res.message,
    });
  };

  const handleExecuteFullWipe = async () => {
    setIsWiping(true);
    try {
      await clearAllData({ keepWarehouses: wipeKeepWarehouses });
      setConfirmWipeOpen(false);
      setStorageRefreshTick((t) => t + 1);
      setFeedbackBanner({
        type: 'success',
        message: 'Table Rase exécutée avec succès : toutes les tables ont été remises à neuf.',
      });
    } finally {
      setIsWiping(false);
    }
  };

  const handleTestConnection = async () => {
    if (firebaseEnvInfo.isAiStudioPreview) {
      setTestResult({
        success: false,
        message:
          'Firebase est volontairement déconnecté dans Google AI Studio. La connexion Cloud Firestore est active uniquement sur l’application déployée.',
      });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await testFirestoreConnection();
      setTestResult({
        success: ok,
        message: ok
          ? 'Connectivité Cloud Firestore vérifiée avec succès. La base de données distante répond normalement.'
          : 'Serveur Cloud Firestore hors de portée actuellement. La base locale autonome assure 100 % des opérations.',
      });
    } catch (e) {
      setTestResult({
        success: false,
        message: 'Erreur lors du test : ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushToFirebase = async () => {
    if (firebaseEnvInfo.isAiStudioPreview) {
      setSyncError(
        'Envoi bloqué dans Google AI Studio : Firebase est réservé exclusivement à l’application déployée.'
      );
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    setSyncStats(null);
    try {
      const stats = await uploadAllToFirebase({
        articles,
        warehouses,
        stocks,
        movements,
        customers,
        sales,
        payments,
        cashSessions,
        cashMovements,
        inventories,
        suppliers,
        supplierOrders,
        quotes,
        returns,
        companyInfo,
      });
      setSyncStats(stats);
      setFeedbackBanner({
        type: 'success',
        message: 'Toutes les tables locales ont été synchronisées vers Google Cloud Firestore.',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncError('Échec de la sauvegarde Cloud : ' + msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromFirebase = async () => {
    if (firebaseEnvInfo.isAiStudioPreview) {
      setSyncError(
        'Import bloqué dans Google AI Studio : Firebase est réservé exclusivement à l’application déployée.'
      );
      return;
    }
    setIsPulling(true);
    setSyncError(null);
    try {
      const data = await downloadAllFromFirebase();
      const res = restoreDatabaseJson(data, 'MERGE');
      setFeedbackBanner({
        type: 'success',
        message: `Synchronisation depuis Cloud Firestore terminée : ${res.message}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncError('Erreur lors de la récupération Cloud : ' + msg);
    } finally {
      setIsPulling(false);
    }
  };

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isSignedIn() { return request.auth != null; }
    function isValidId(id) { return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$'); }
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        request.auth.token.email == 'westjunior0805@gmail.com'
      );
    }

    match /test/{testId} { allow read, write: if true; }
    match /admins/{adminId} { allow read: if isSignedIn() && isValidId(adminId); allow write: if isAdmin() && isValidId(adminId); }
    match /users/{userId} { allow read, write: if isValidId(userId); allow delete: if isAdmin() && isValidId(userId); }
    match /articles/{articleId} { allow read, list: if true; allow create, update: if isValidId(articleId); allow delete: if isAdmin() && isValidId(articleId); }
    match /warehouses/{warehouseId} { allow read, list: if true; allow create, update: if isValidId(warehouseId); allow delete: if isAdmin() && isValidId(warehouseId); }
    match /stocks/{stockId} { allow read, list: if true; allow create, update: if isValidId(stockId); allow delete: if isAdmin() && isValidId(stockId); }
    match /movements/{movementId} { allow read, list: if true; allow create: if isValidId(movementId); allow update, delete: if isAdmin() && isValidId(movementId); }
    match /customers/{customerId} { allow read, list: if true; allow create, update: if isValidId(customerId); allow delete: if isAdmin() && isValidId(customerId); }
    match /sales/{saleId} { allow read, list: if true; allow create, update: if isValidId(saleId); allow delete: if isAdmin() && isValidId(saleId); }
    match /payments/{paymentId} { allow read, list: if true; allow create: if isValidId(paymentId); allow update, delete: if isAdmin() && isValidId(paymentId); }
    match /cashSessions/{sessionId} { allow read, list: if true; allow create, update: if isValidId(sessionId); allow delete: if isAdmin() && isValidId(sessionId); }
    match /cashMovements/{cashMovementId} { allow read, list: if true; allow create: if isValidId(cashMovementId); allow update, delete: if isAdmin() && isValidId(cashMovementId); }
    match /inventories/{inventoryId} { allow read, list: if true; allow create, update: if isValidId(inventoryId); allow delete: if isAdmin() && isValidId(inventoryId); }
    match /suppliers/{supplierId} { allow read, list: if true; allow create, update: if isValidId(supplierId); allow delete: if isAdmin() && isValidId(supplierId); }
    match /supplierOrders/{orderId} { allow read, list: if true; allow create, update: if isValidId(orderId); allow delete: if isAdmin() && isValidId(orderId); }
    match /quotes/{quoteId} { allow read, list: if true; allow create, update: if isValidId(quoteId); allow delete: if isAdmin() && isValidId(quoteId); }
  }
}`;

  const supabaseSqlSchema = `-- ====================================================================
-- SCHEMA ERP EQUIPSTOCK PRO : GESTION DE PIÈCES D'ENGINS LOURDS
-- BASE DE DONNÉES RELATIONNELLE POSTGRESQL / SUPABASE
-- ====================================================================

CREATE TABLE public.warehouses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    manager TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.articles (
    id TEXT PRIMARY KEY,
    main_reference TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    designation TEXT NOT NULL,
    category TEXT NOT NULL,
    compatible_machines TEXT[],
    equivalent_references TEXT[],
    brand_offers JSONB DEFAULT '[]'::jsonb,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    min_stock_threshold INTEGER NOT NULL DEFAULT 5,
    default_location TEXT,
    unit TEXT NOT NULL DEFAULT 'Unité',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.warehouse_stocks (
    article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    brand_breakdown JSONB DEFAULT '{}'::jsonb,
    brand_locations JSONB DEFAULT '{}'::jsonb,
    shelf_location TEXT,
    last_inventory_date TIMESTAMPTZ,
    PRIMARY KEY (article_id, warehouse_id)
);

CREATE TABLE public.customers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    email TEXT,
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    outstanding_balance NUMERIC(15, 2) DEFAULT 0,
    deposit_balance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`;

  return (
    <div className="space-y-5">
      {/* Top Header & KPI Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Centre de Gestion des Bases de Données
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Administration des tables, stockage local, synchronisation Cloud Firestore et sauvegardes JSON/CSV
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOptimizeStorage}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Nettoyer les références orphelines et compacter le cache localStorage"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Optimiser la base</span>
            </button>
            <button
              type="button"
              onClick={exportDatabaseJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Exporter Sauvegarde (.JSON)</span>
            </button>
          </div>
        </div>

        {/* 4 Key Database Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="text-[11px] text-slate-500 font-medium">Tables & Collections</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {tables.length} tables
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {totalRecordsCount.toLocaleString('fr-FR')} enregistrements totaux
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="text-[11px] text-slate-500 font-medium">Catalogue & Lignes Stock</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {articles.length.toLocaleString('fr-FR')} réf.
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stocks.length.toLocaleString('fr-FR')} lignes sur {warehouses.length} dépôt(s)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="text-[11px] text-slate-500 font-medium">Occupation Cache Local</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {storageMetrics.totalKb} Ko
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full transition-all ${
                  storageMetrics.usagePercent > 80
                    ? 'bg-rose-500'
                    : storageMetrics.usagePercent > 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(3, storageMetrics.usagePercent)}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="text-[11px] text-slate-500 font-medium">
              Statut Cloud Firestore
            </div>
            <div className="text-xs font-bold font-mono text-slate-900 mt-1 truncate">
              {firebaseEnvInfo.isAiStudioPreview ? 'Aperçu Démo AI Studio' : firebaseEnvInfo.projectId}
            </div>
            <div
              className={`text-[11px] font-medium mt-1 ${
                firebaseEnvInfo.isAiStudioPreview ? 'text-[#E35E2D]' : 'text-emerald-700'
              }`}
            >
              {firebaseEnvInfo.isAiStudioPreview
                ? 'Données démo isolées (Cloud protégé)'
                : 'Sauvegarde Cloud Firestore active'}
            </div>
          </div>
        </div>
      </div>

      {/* Global Action Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedbackBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold underline opacity-75 hover:opacity-100"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Segmented Navigation Bar for Database Sub-Modules */}
      <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveMainTab('tables')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeMainTab === 'tables'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Explorateur des Tables ({tables.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('sync')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeMainTab === 'sync'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-amber-400" />
          <span>Cloud Firestore & Stockage Local</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('backup')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeMainTab === 'backup'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
          <span>Sauvegardes, Restauration & Purge</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('schemas')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeMainTab === 'schemas'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Schémas SQL & Règles Firestore</span>
        </button>
      </div>

      {/* TAB 1: EXPLORATEUR DES TABLES & COLLECTIONS */}
      {activeMainTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: List of all 14 Tables */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Tables de la Base ({tables.length})
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {totalRecordsCount.toLocaleString('fr-FR')} lignes
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {tables.map((t) => {
                const isSelected = t.key === selectedTable.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setSelectedTableKey(t.key);
                      setTableSearch('');
                      setInspectorPage(1);
                      setConfirmPurgeKey(null);
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{t.label}</div>
                      <div
                        className={`text-[11px] font-mono truncate mt-0.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {t.collectionName} · {t.category}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono tabular-nums font-bold shrink-0 ${
                        isSelected ? 'text-amber-400' : 'text-slate-600'
                      }`}
                    >
                      {t.data.length.toLocaleString('fr-FR')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Table Inspector */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            {/* Table Header */}
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {selectedTable.label}
                    </h3>
                    <span className="text-xs font-mono text-slate-500">
                      /{selectedTable.collectionName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedTable.description}</p>
                </div>

                {/* Export & Purge Controls for Selected Table */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportSingleTableCsv(selectedTable)}
                    disabled={selectedTable.data.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                    title="Exporter cette table en CSV (Excel)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportSingleTableJson(selectedTable)}
                    disabled={selectedTable.data.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                    title="Exporter cette table en JSON"
                  >
                    <FileJson className="w-3.5 h-3.5 text-amber-600" />
                    <span>JSON</span>
                  </button>

                  {selectedTable.canPurge &&
                    (currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
                      <button
                        type="button"
                        onClick={() => setConfirmPurgeKey(selectedTable.key)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        title="Vider définitivement cette table (Local & Cloud Firestore)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Vider la table</span>
                      </button>
                    )}
                </div>
              </div>

              {/* Inline Purge Confirmation */}
              {confirmPurgeKey === selectedTable.key && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
                  <span>
                    Confirmer la purge de la table <strong>{selectedTable.label}</strong> (
                    {selectedTable.data.length} enregistrements) ?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeKey(null)}
                      className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmPurgeTable(selectedTable.key)}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                    >
                      Confirmer la purge
                    </button>
                  </div>
                </div>
              )}

              {/* Search & View Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setInspectorPage(1);
                    }}
                    placeholder={`Rechercher dans ${selectedTable.label} (${selectedTable.data.length} lignes)...`}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setInspectorViewMode('table')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      inspectorViewMode === 'table'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vue Tableau
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorViewMode('json')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      inspectorViewMode === 'json'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    JSON Brut
                  </button>
                </div>
              </div>
            </div>

            {/* Table Data Body */}
            {filteredInspectorRows.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Aucun enregistrement trouvé dans la table <strong>{selectedTable.label}</strong>.
              </div>
            ) : inspectorViewMode === 'table' ? (
              <div className="flex-1 overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      {selectedTable.columns.map((col) => (
                        <SortableTh
                          key={col.key}
                          label={col.label}
                          active={inspectorSortBy === col.key}
                          direction={inspectorSortDir}
                          onClick={() => handleInspectorSort(col.key)}
                          className="py-2.5 px-2.5"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedInspectorRows.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50/80">
                        {selectedTable.columns.map((col) => (
                          <td
                            key={col.key}
                            className="py-2.5 px-2.5 text-slate-800 truncate font-mono text-[11px]"
                            title={row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : undefined}
                          >
                            {col.render
                              ? col.render(row)
                              : row[col.key] !== undefined && row[col.key] !== null
                              ? String(row[col.key])
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed overflow-auto max-h-[460px]">
                {JSON.stringify(paginatedInspectorRows, null, 2)}
              </pre>
            )}

            {/* Inspector Pagination Footer */}
            <TablePagination
              totalItems={filteredInspectorRows.length}
              currentPage={currentInspectorPage}
              pageSize={inspectorPageSize}
              onPageChange={setInspectorPage}
              onPageSizeChange={setInspectorPageSize}
              itemLabel="lignes"
            />
          </div>
        </div>
      )}

      {/* TAB 2: CLOUD FIRESTORE & STOCKAGE LOCAL */}
      {activeMainTab === 'sync' && (
        <div className="space-y-5">
          {/* Cloud Firestore Synchronization Panel */}
          <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Base de Données Cloud — Google Cloud Firestore
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronisation bidirectionnelle entre votre poste local et l’instance Cloud Firestore dédiée
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || firebaseEnvInfo.isAiStudioPreview}
                  title={
                    firebaseEnvInfo.isAiStudioPreview
                      ? 'Firebase est déconnecté dans Google AI Studio'
                      : 'Vérifier la connectivité Cloud Firestore'
                  }
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Vérification...' : 'Tester la connexion'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushToFirebase}
                  disabled={isSyncing || firebaseEnvInfo.isAiStudioPreview}
                  title={
                    firebaseEnvInfo.isAiStudioPreview
                      ? 'Envoi Cloud désactivé dans Google AI Studio'
                      : 'Envoyer les données locales vers Cloud Firestore'
                  }
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Envoi vers Cloud...' : 'Sauvegarder vers Cloud Firestore'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromFirebase}
                  disabled={isPulling || firebaseEnvInfo.isAiStudioPreview}
                  title={
                    firebaseEnvInfo.isAiStudioPreview
                      ? 'Import Cloud désactivé dans Google AI Studio'
                      : 'Importer les données depuis Cloud Firestore'
                  }
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 text-xs font-semibold rounded-lg border border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>{isPulling ? 'Récupération...' : 'Importer depuis Cloud Firestore'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`mb-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{testResult.message}</span>
              </div>
            )}

            {syncError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {!firebaseEnvInfo.isAiStudioPreview && quotaExceeded && (
              <div className="mb-4 p-3.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-100 text-xs space-y-2">
                <div className="flex items-start gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Quota gratuit quotidien Firebase atteint (Quota exceeded)</span>
                </div>
                <p className="text-amber-100/90 leading-relaxed">
                  Votre projet Firebase a atteint la limite gratuite quotidienne (plan <strong>Spark</strong>). Vos données continuent d’être sauvegardées en local (IndexedDB / navigateur). Le quota gratuit se réinitialise le lendemain.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseEnvInfo.projectId}/firestore/databases/${firebaseEnvInfo.firestoreDatabaseId}/data?openUpgradeDialog=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md transition-colors"
                  >
                    Ouvrir la console Firebase (Mise à niveau Blaze)
                  </a>
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-amber-300 hover:text-amber-200"
                  >
                    Voir les limites du plan Spark (Firestore Enterprise)
                  </a>
                </div>
              </div>
            )}

            {syncStats && (
              <div className="mb-4 p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs">
                <div className="font-bold mb-2">
                  Synchronisation Cloud Firestore terminée :
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div>Articles : {syncStats.articles}</div>
                  <div>Stocks : {syncStats.stocks}</div>
                  <div>Dépôts : {syncStats.warehouses}</div>
                  <div>Clients : {syncStats.customers}</div>
                  <div>Ventes : {syncStats.sales}</div>
                  <div>Devis : {syncStats.quotes}</div>
                  <div>Mouvements : {syncStats.movements}</div>
                  <div>Commandes : {syncStats.supplierOrders}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400 block">
                  Projet Cloud Firestore
                </span>
                <span className="font-mono text-xs text-amber-300 font-semibold block mt-0.5 truncate">
                  {firebaseEnvInfo.projectId}
                </span>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400 block">ID Base Firestore</span>
                <span className="font-mono text-xs text-emerald-300 font-semibold block mt-0.5 truncate">
                  {firebaseEnvInfo.firestoreDatabaseId}
                </span>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Mode Actuel</span>
                <span className="font-mono text-xs text-slate-200 font-semibold block mt-0.5">
                  {firebaseEnvInfo.isAiStudioPreview
                    ? 'Aperçu AI Studio (Données Démo Isolées)'
                    : 'Application Déployée (Cloud Firestore Actif)'}
                </span>
              </div>
            </div>
          </div>

          {/* Séparation Automatique : Démo AI Studio vs Application Déployée */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {firebaseEnvInfo.isAiStudioPreview
                    ? 'Aperçu Google AI Studio : Données Démo Isolées'
                    : 'Application Déployée : Sauvegarde Cloud Firestore Active'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {firebaseEnvInfo.isAiStudioPreview
                    ? 'Dans Google AI Studio, l’application utilise uniquement des données de démonstration locales isolées. Ces données de démo ne sont jamais envoyées vers Cloud Firestore et n’entrent jamais en collision avec les données réelles de votre application déployée.'
                    : 'Votre application déployée sauvegarde et synchronise automatiquement toutes vos données réelles dans Cloud Firestore (ainsi que dans le stockage local haute capacité IndexedDB).'}
                </p>
              </div>
            </div>
          </div>

          {/* LocalStorage Breakdown & Optimization Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-slate-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Répartition de la Base Locale (Cache Navigateur)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Espace utilisé : <strong>{storageMetrics.totalKb} Ko</strong> ({storageMetrics.totalMb} Mo) sur ~5,00 Mo disponibles ({storageMetrics.usagePercent} %)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOptimizeStorage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Compacter & Nettoyer les Orphelins</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {storageMetrics.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <span className="font-mono font-semibold text-slate-700 truncate">
                    {item.key}
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 font-bold">
                    {item.kb.toFixed(1)} Ko
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SAUVEGARDES, RESTAURATION & MAINTENANCE */}
      {activeMainTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Export & Restore JSON */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Sauvegarde & Restauration de Base de Données (.JSON)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exportez une copie intégrale de vos tables ou restaurez une archive JSON existante sur cet appareil.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Exporter toute la base de données (Intégrale v3.0)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Génère un fichier <code className="font-mono">.json</code> contenant les {tables.length} tables ({totalRecordsCount.toLocaleString('fr-FR')} lignes), les avoirs (<code className="font-mono">returns</code>), les ventes en attente (<code className="font-mono">savedDrafts</code>) et les informations de l’entreprise (<code className="font-mono">{companyInfo?.name || 'companyInfo'}</code>).
                </div>
              </div>
              <button
                type="button"
                onClick={exportDatabaseJson}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Télécharger (.JSON)</span>
              </button>
            </div>

            {/* Restore from JSON file */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Restaurer / Vérifier un fichier de sauvegarde (.JSON)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Chargez une sauvegarde complète pour inspecter son contenu et la restaurer avec contrôle d’intégrité.
                  </div>
                </div>
                <label className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Choisir un fichier .JSON</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleBackupFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {parsedBackupFile && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 truncate block">
                        Fichier : {parsedBackupFile.fileName}
                      </span>
                      {parsedBackupFile.companyName && (
                        <span className="text-[11px] text-slate-600">
                          Entreprise : <strong>{parsedBackupFile.companyName}</strong>
                          {parsedBackupFile.version ? ` · Format ${parsedBackupFile.version}` : ''}
                        </span>
                      )}
                    </div>
                    {parsedBackupFile.exportDate && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(parsedBackupFile.exportDate).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>

                  {parsedBackupFile.summary.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {parsedBackupFile.summary.map((s) => (
                        <div
                          key={s.label}
                          className="px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200/70 flex items-center justify-between gap-2"
                        >
                          <span className="text-slate-600 truncate">{s.label}</span>
                          <strong className="font-mono text-slate-900 shrink-0">{s.count}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700">
                      Aucune collection standard détectée dans ce fichier.
                    </div>
                  )}

                  {/* Options de protection et filtrage avant restauration */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
                    {parsedBackupFile.hasDemoArticles && (
                      <label className="flex items-start gap-2 cursor-pointer text-amber-900">
                        <input
                          type="checkbox"
                          checked={excludeDemoOnRestore}
                          onChange={(e) => setExcludeDemoOnRestore(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          <strong>Exclure les données de démonstration initiales</strong> (5 articles fictifs détectés dans l’archive).
                        </span>
                      </label>
                    )}
                    <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={syncOnRestore}
                        onChange={(e) => setSyncOnRestore(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Synchroniser également vers le projet Firebase actuellement connecté après la restauration locale
                        <span className="block text-[10px] text-slate-500">
                          Décoché par sécurité pour ne jamais envoyer des données de production vers un projet Firebase de test.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-3 text-xs">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'MERGE'}
                          onChange={() => setRestoreMode('MERGE')}
                        />
                        <span>Fusionner sans écraser</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'REPLACE'}
                          onChange={() => setRestoreMode('REPLACE')}
                        />
                        <span>Remplacer la base</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Appliquer la restauration
                    </button>
                  </div>
                </div>
              )}

              {lastRestoreVerification && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Rapport de Vérification d’Intégrité Post-Restauration</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastRestoreVerification(null)}
                      className="text-[11px] text-emerald-700 underline cursor-pointer"
                    >
                      Masquer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {lastRestoreVerification.details.map((d) => (
                      <div
                        key={d.key}
                        className="px-2.5 py-1.5 bg-white rounded border border-emerald-200/80 flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-700 truncate">{d.label}</span>
                        <span className="font-mono font-bold text-emerald-800 shrink-0">
                          {d.restored} / {d.inBackup} OK
                        </span>
                      </div>
                    ))}
                    {lastRestoreVerification.companyRestored && (
                      <div className="px-2.5 py-1.5 bg-white rounded border border-emerald-200/80 flex items-center justify-between gap-2">
                        <span className="text-slate-700 truncate">Infos Entreprise & Logo</span>
                        <span className="font-mono font-bold text-emerald-800 shrink-0">Restauré OK</span>
                      </div>
                    )}
                    {lastRestoreVerification.draftsRestored > 0 && (
                      <div className="px-2.5 py-1.5 bg-white rounded border border-emerald-200/80 flex items-center justify-between gap-2">
                        <span className="text-slate-700 truncate">Ventes en attente (POS)</span>
                        <span className="font-mono font-bold text-emerald-800 shrink-0">
                          {lastRestoreVerification.draftsRestored} OK
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Maintenance, Demo Seed & Table Rase */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Maintenance & Réinitialisation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Outils d’administration pour nettoyer, charger un jeu de test ou purger intégralement la base.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Charger les données de démonstration
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Restaure le catalogue d’exemple initial (pièces Caterpillar, Komatsu, filtres, dépôts).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetToDemoData();
                  setStorageRefreshTick((t) => t + 1);
                  setFeedbackBanner({
                    type: 'info',
                    message: 'Les données de démonstration ont été chargées dans la base.',
                  });
                }}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Données Démo</span>
              </button>
            </div>

            {(currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE') && (
              <>
                {/* Selective Table Purge Section */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Purge Sélective par Table (Local & Cloud Firestore)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Videz individuellement une table spécifique sans affecter le reste de la base.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {tables
                      .filter((t) => t.canPurge)
                      .map((t) => (
                        <div
                          key={t.key}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {t.label}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {t.data.length.toLocaleString('fr-FR')} enregistrement(s)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmPurgeKey(t.key)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Purger</span>
                          </button>
                        </div>
                      ))}
                  </div>

                  {confirmPurgeKey && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2.5 text-xs text-rose-900">
                      <div className="font-semibold">
                        Confirmer la purge définitive de la table{' '}
                        <strong className="underline">
                          {tables.find((t) => t.key === confirmPurgeKey)?.label || confirmPurgeKey}
                        </strong>{' '}
                        ({tables.find((t) => t.key === confirmPurgeKey)?.data.length || 0} lignes) ?
                      </div>
                      <p className="text-[11px] text-rose-800">
                        Cette opération supprime les enregistrements dans le cache local et sur Google Cloud Firestore.
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmPurgeKey(null)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmPurgeTable(confirmPurgeKey)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          Confirmer la purge de cette table
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Full Wipe (Table Rase) Section */}
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-rose-950">
                        Table Rase — Remise à zéro complète
                      </div>
                      <div className="text-[11px] text-rose-800 mt-0.5">
                        Supprime tous les articles, stocks, ventes, clients et mouvements (Local & Cloud Firestore) pour repartir d’une base 100 % vierge.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmWipeOpen((v) => !v)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Table Rase</span>
                    </button>
                  </div>

                  {confirmWipeOpen && (
                    <div className="p-3.5 bg-white border border-rose-200 rounded-lg space-y-3 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                        <input
                          type="checkbox"
                          checked={wipeKeepWarehouses}
                          onChange={(e) => setWipeKeepWarehouses(e.target.checked)}
                        />
                        <span>Conserver les magasins / dépôts configurés (stocks remis à 0)</span>
                      </label>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmWipeOpen(false)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={isWiping}
                          onClick={handleExecuteFullWipe}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          {isWiping ? 'Purge en cours...' : 'Confirmer la purge totale'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SCHÉMAS SQL & RÈGLES FIRESTORE */}
      {activeMainTab === 'schemas' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4">
            <button
              type="button"
              onClick={() => setActiveSchemaTab('firebase')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeSchemaTab === 'firebase'
                  ? 'border-amber-500 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Règles de sécurité Firestore (firestore.rules)
            </button>
            <button
              type="button"
              onClick={() => setActiveSchemaTab('postgres')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeSchemaTab === 'postgres'
                  ? 'border-amber-500 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Schéma Relationnel SQL (PostgreSQL / Supabase)
            </button>
          </div>

          {activeSchemaTab === 'firebase' ? (
            <div>
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono">
                  firestore.rules — Règles déployées sur fair-ability-gc70r
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(firestoreRulesText);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedRules ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedRules ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96">
                {firestoreRulesText}
              </pre>
            </div>
          ) : (
            <div>
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono">
                  schema.sql — Script DDL PostgreSQL / Supabase
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(supabaseSqlSchema);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSql ? 'Copié' : 'Copier le SQL'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96">
                {supabaseSqlSchema}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
