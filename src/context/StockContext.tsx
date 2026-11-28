import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Article,
  ArticleBrandOffer,
  MachineApplication,
  Warehouse,
  WarehouseStock,
  StockMovement,
  UserProfile,
  UserRole,
  UserPermissions,
  CompanyInfo,
  InventorySession,
  InventoryItemCount,
  StockAlert,
  MovementType,
  Customer,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  ProcessSaleReturnParams,
  UpdateSaleParams,
  PaymentRecord,
  PaymentMethod,
  CashSession,
  CashMovement,
  CashMovementType,
  ImportMode,
  ParsedImportRow,
  ImportResultReport,
  ArticleCategory,
  Supplier,
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderStatus,
  Quote,
  QuoteItem,
  QuoteStatus,
  CreateInventoryOptions,
} from '../types';
import {
  getCustomerCreditSummary,
  getNetSaleAmount,
  getSaleItemReturnRefund,
} from '../utils/customerAccount';
import {
  INITIAL_ARTICLES,
  INITIAL_WAREHOUSES,
  INITIAL_WAREHOUSE_STOCKS,
  INITIAL_MOVEMENTS,
  INITIAL_USERS,
  INITIAL_INVENTORIES,
  INITIAL_CUSTOMERS,
  INITIAL_SALES,
  INITIAL_PAYMENTS,
  INITIAL_CASH_SESSIONS,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_ORDERS,
  INITIAL_QUOTES,
} from '../data/seedData';
import { compressBase64Image } from '../utils/imageCompressor';
import {
  prefixLocationWithWarehouse,
  stripWarehousePrefix,
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getBrandLocation,
  cleanBrandName,
  isPlaceholderBrand,
} from '../utils/articleHelpers';
import {
  uploadAllToFirebase,
  downloadAllFromFirebase,
  wipeAllFromFirebase,
  wipeCollectionFromFirebase,
  saveUserToFirebase,
  deleteUserFromFirebase,
  downloadUsersFromFirebase,
  subscribeToCollection,
  saveArticleToFirebase,
  saveMultipleArticlesToFirebase,
  deleteArticleFromFirebase,
  deleteStocksForArticleFromFirebase,
  deleteMovementsFromFirebase,
  saveStockToFirebase,
  saveMultipleStocksToFirebase,
  saveMovementToFirebase,
  saveMultipleMovementsToFirebase,
  saveWarehouseToFirebase,
  deleteWarehouseFromFirebase,
  saveCustomerToFirebase,
  saveMultipleCustomersToFirebase,
  deleteCustomerFromFirebase,
  saveSaleToFirebase,
  deleteSaleFromFirebase,
  savePaymentToFirebase,
  deletePaymentsFromFirebase,
  saveCashSessionToFirebase,
  saveCashMovementToFirebase,
  deleteCashMovementsFromFirebase,
  saveSupplierToFirebase,
  deleteSupplierFromFirebase,
  saveSupplierOrderToFirebase,
  deleteSupplierOrderFromFirebase,
  saveQuoteToFirebase,
  deleteQuoteFromFirebase,
  saveInventoryToFirebase,
  deleteInventoryFromFirebase,
  saveReturnToFirebase,
  saveCompanyInfoToFirebase,
} from '../services/firebaseSync';
import { idbSetItem, idbGetAllItems } from '../utils/indexedDbStorage';
import {
  onAuthChanged,
  FirebaseUser,
  signInWithGoogle,
  logoutUser,
  signInWithEmail,
  signUpWithEmail,
  isAiStudioPreviewEnvironment,
} from '../firebase';

interface RecordSaleParams {
  warehouseId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    articleId: string;
    quantity: number;
    unitPrice?: number;
    discountPercent?: number;
    discountAmount?: number;
    isPriceOverridden?: boolean;
    overriddenReason?: string;
    selectedBrandOfferId?: string;
    brand?: string;
    sourceWarehouseId?: string;
    sourceWarehouseName?: string;
    sourceLocation?: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }>;
  saleDate?: string;
  freezeStock?: boolean; // Permet de rétro-saisir une vente sans impacter ni décrémenter le stock physique actuel
  notes?: string;
}

interface StockContextType {
  // Current user, directory & Firebase Auth
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  authenticateOperator: (userId: string, pinCode: string) => { success: boolean; error?: string };
  lockSession: () => void;
  addUser: (userData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (allowedRolesOrPerm: UserRole[] | keyof UserPermissions) => boolean;
  currentPermissions: UserPermissions;
  checkPermission: (perm: keyof UserPermissions) => boolean;
  getUserPermissions: (user: UserProfile) => UserPermissions;
  companyInfo: CompanyInfo;
  updateCompanyInfo: (updates: Partial<CompanyInfo>) => void;
  resetCompanyInfo: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;

  // Selected warehouse filter in UI (null = all warehouses)
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string | null) => void;

  // Target Boutique / Dépôt Magasin for internal replenishment
  boutiqueWarehouseId: string;
  setBoutiqueWarehouseId: (id: string) => void;
  getBoutiqueMinThreshold: (article: Article, warehouseId?: string) => number;

  // Global preference for product images display
  showProductImages: boolean;
  setShowProductImages: (show: boolean | ((prev: boolean) => boolean)) => void;
  toggleProductImages: () => void;

  // Data
  articles: Article[];
  warehouses: Warehouse[];
  stocks: WarehouseStock[];
  movements: StockMovement[];
  inventories: InventorySession[];
  customers: Customer[];
  sales: Sale[];
  payments: PaymentRecord[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  suppliers: Supplier[];
  supplierOrders: SupplierOrder[];
  quotes: Quote[];

  // Stock getters
  getStockForArticleAndWarehouse: (articleId: string, warehouseId: string) => number;
  getTotalStockForArticle: (articleId: string) => number;
  getStockValueTotal: (warehouseId?: string | null) => number;
  getSaleValueTotal: (warehouseId?: string | null) => number;
  getArticleById: (id: string) => Article | undefined;
  getWarehouseById: (id: string) => Warehouse | undefined;
  getAlerts: () => StockAlert[];

  // Customer getters & actions
  getCustomerById: (id: string) => Customer | undefined;
  createCustomer: (customerData: Omit<Customer, 'id' | 'createdAt' | 'outstandingBalance'> & { outstandingBalance?: number }) => {
    success: boolean;
    error?: string;
    customer?: Customer;
  };
  updateCustomer: (id: string, updates: Partial<Customer>) => { success: boolean; error?: string };
  deleteCustomer: (id: string) => { success: boolean; error?: string; message?: string };
  importCustomers: (
    rows: Array<{
      code?: string;
      name: string;
      phone?: string;
      address?: string;
      email?: string;
      creditLimit?: number;
      outstandingBalance?: number;
      depositBalance?: number;
      notes?: string;
    }>
  ) => {
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
  };
  recordCustomerPayment: (params: {
    customerId: string;
    type: 'REGLEMENT_CREANCE' | 'ACOMPTE_AVANCE';
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
    customDate?: string;
  }) => { success: boolean; error?: string; payment?: PaymentRecord };
  recordCustomerDebtPayment: (params: {
    customerId: string;
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
    customDate?: string;
  }) => { success: boolean; error?: string; payment?: PaymentRecord };
  updateCustomerPayment: (
    paymentId: string,
    updates: {
      date?: string;
      amount?: number;
      method?: PaymentMethod;
      reference?: string;
      notes?: string;
    }
  ) => { success: boolean; error?: string };
  deleteCustomerPayment: (paymentId: string) => { success: boolean; error?: string };
  adjustCustomerDebt: (params: {
    customerId: string;
    mode: 'SET_TARGET' | 'DELTA';
    value: number;
    date?: string;
    reason: string;
  }) => { success: boolean; error?: string };
  deleteCustomerDebtAdjustment: (
    customerId: string,
    adjustmentId: string
  ) => { success: boolean; error?: string };

  // Sales actions & getters
  getSaleById: (id: string) => Sale | undefined;
  recordSale: (params: RecordSaleParams) => { success: boolean; error?: string; sale?: Sale };
  updateSale: (params: UpdateSaleParams) => { success: boolean; error?: string };
  syncSaleToCashJournal: (
    saleId: string,
    cashSessionId: string,
    method: PaymentMethod
  ) => { success: boolean; error?: string; message?: string };
  cancelOrRefundSale: (params: {
    saleId: string;
    reason: string;
    refundCash?: boolean;
  }) => { success: boolean; error?: string };
  deleteSale: (saleId: string) => { success: boolean; error?: string; message?: string };
  returns: SaleReturn[];
  processSaleReturn: (params: ProcessSaleReturnParams) => { success: boolean; error?: string; returnRecord?: SaleReturn };

  // Stock freeze mode (historique / rétro-saisie)
  isStockFrozen: boolean;
  setIsStockFrozen: (frozen: boolean) => void;
  toggleStockFreeze: () => void;

  // Cash Session actions & getters (Caisse Centrale / Guichet — indépendante des magasins)
  getActiveCashSession: (warehouseId?: string) => CashSession | undefined;
  getCashMovementsForSession: (sessionId: string) => CashMovement[];
  openCashSession: (params: {
    warehouseId?: string;
    initialCashFloat: number;
    notes?: string;
  }) => { success: boolean; error?: string; session?: CashSession };
  closeCashSession: (params: {
    sessionId: string;
    countedCash: number;
    varianceJustification?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  reopenCashSession: (
    sessionId: string,
    reason?: string
  ) => { success: boolean; error?: string; message?: string; session?: CashSession };
  updateCashSessionInitialFloat: (
    sessionId: string,
    newInitialFloat: number,
    reason?: string
  ) => { success: boolean; error?: string; message?: string };
  deleteCashMovement: (
    movementId: string
  ) => { success: boolean; error?: string; message?: string };
  recordCashExpense: (params: {
    warehouseId?: string;
    type: 'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES';
    amount: number;
    reason: string;
    notes?: string;
    customDate?: string;
  }) => { success: boolean; error?: string };
  transferElectronicToCashDrawer: (params: {
    warehouseId?: string;
    sourceMethod: 'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CARTE';
    amount: number;
    reference?: string;
    notes?: string;
    customDate?: string;
  }) => { success: boolean; error?: string };

  // Stock Operations (with strict business validation)
  recordStockIn: (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
    brand?: string;
    location?: string;
    unitPrice?: number;
    supplier?: string;
    documentRef: string;
    reason: string;
    notes?: string;
  }) => { success: boolean; error?: string };

  recordStockOut: (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
    brand?: string;
    client?: string;
    documentRef: string;
    reason: string;
    notes?: string;
    allowNegativeOverride?: boolean;
  }) => { success: boolean; error?: string };

  recordTransfer: (params: {
    articleId: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    quantity: number;
    brand?: string;
    targetLocation?: string;
    documentRef: string;
    reason: string;
    notes?: string;
  }) => { success: boolean; error?: string };

  recordBatchTransfer: (params: {
    items: Array<{
      articleId: string;
      sourceWarehouseId: string;
      targetWarehouseId: string;
      quantity: number;
      brand?: string;
      targetLocation?: string;
    }>;
    documentRef: string;
    reason: string;
    notes?: string;
  }) => {
    success: boolean;
    error?: string;
    transferredCount: number;
    totalUnits: number;
    failedItems?: Array<{ articleId: string; reason: string }>;
  };

  // Article Management
  createArticle: (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => {
    success: boolean;
    error?: string;
    article?: Article;
  };
  updateArticle: (id: string, updates: Partial<Article>) => { success: boolean; error?: string };
  bulkUpdateWarehouseMinThresholds: (
    warehouseId: string,
    updates: Array<{ articleId: string; threshold: number | null }>
  ) => { success: boolean; updatedCount: number; error?: string };
  addMachineApplication: (
    articleId: string,
    app: Omit<MachineApplication, 'id'>
  ) => { success: boolean; error?: string };
  updateMachineApplication: (
    articleId: string,
    appId: string,
    updates: Partial<MachineApplication>
  ) => { success: boolean; error?: string };
  removeMachineApplication: (
    articleId: string,
    appId: string
  ) => { success: boolean; error?: string };
  importMachineApplicationsForArticle: (
    articleId: string,
    applications: Array<{
      productFamily?: string;
      subFamily?: string;
      model: string;
      serialPrefix?: string;
      system?: string;
      quantityRequired?: number;
      notes?: string;
    }>
  ) => {
    success: boolean;
    addedCount: number;
    duplicateCount: number;
    error?: string;
  };
  importMachineApplications: (
    applications: Array<{
      articleReference: string;
      productFamily?: string;
      subFamily?: string;
      model: string;
      serialPrefix?: string;
      system?: string;
      quantityRequired?: number;
      notes?: string;
    }>
  ) => {
    success: boolean;
    updatedArticlesCount: number;
    totalApplicationsAdded: number;
    notFoundReferences: string[];
  };
  quickUpdateStockItem: (params: {
    articleId: string;
    brandName?: string;
    previousBrandName?: string;
    warehouseId?: string | null;
    newQuantity: number;
    newLocation: string;
    newPurchasePrice: number;
    newSalePrice: number;
    invoiceNumber?: string;
  }) => { success: boolean; error?: string; message?: string };
  quickUpdateArticleStocks: (params: {
    articleId: string;
    brandUpdates: Array<{
      originalBrandKey: string;
      brandName: string;
      purchasePrice: number;
      salePrice: number;
      invoiceNumber?: string;
      isNew?: boolean;
    }>;
    cellUpdates: Array<{
      warehouseId: string;
      originalBrandKey: string;
      brandName: string;
      newQuantity: number;
      newLocation: string;
      invoiceNumber?: string;
    }>;
  }) => { success: boolean; error?: string; message?: string };
  deleteArticle: (articleId: string) => {
    success: boolean;
    error?: string;
    actionType: 'DELETED' | 'ARCHIVED';
    message: string;
  };
  deleteMultipleArticles: (articleIds: string[]) => {
    success: boolean;
    error?: string;
    deletedCount: number;
    archivedCount: number;
    message: string;
  };
  executeImport: (params: {
    mode: ImportMode;
    fileName: string;
    rows: ParsedImportRow[];
    targetWarehouseId?: string;
    overwriteExistingStock?: boolean;
  }) => { success: boolean; report: ImportResultReport; error?: string };

  // Warehouse Management
  createWarehouse: (warehouseData: Omit<Warehouse, 'id'>) => {
    success: boolean;
    error?: string;
    warehouse?: Warehouse;
  };
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => { success: boolean; error?: string };
  deleteWarehouse: (warehouseId: string) => {
    success: boolean;
    error?: string;
    actionType: 'DELETED' | 'ARCHIVED';
    message: string;
  };

  // Inventory Management
  createInventorySession: (
    warehouseId: string,
    notes?: string,
    options?: CreateInventoryOptions
  ) => {
    success: boolean;
    session?: InventorySession;
    error?: string;
  };
  updateInventoryCount: (
    sessionId: string,
    articleId: string,
    countedQty: number | null,
    notes?: string,
    brand?: string,
    unitCostOverride?: number
  ) => void;
  batchUpdateInventoryCounts: (
    sessionId: string,
    updates: Array<{
      articleId: string;
      brand?: string;
      countedQty: number | null;
      notes?: string;
    }>
  ) => void;
  syncInventorySessionBrands: (
    sessionId: string
  ) => { success: boolean; addedLines: number; totalLines: number; error?: string };
  validateInventorySession: (sessionId: string) => { success: boolean; error?: string };
  cancelInventorySession: (sessionId: string) => { success: boolean; error?: string };
  deleteInventorySession: (sessionId: string) => { success: boolean; error?: string };
  updateStockLocationInWarehouse: (
    articleId: string,
    warehouseId: string,
    newLocation: string,
    brand?: string
  ) => { success: boolean; error?: string };
  addArticleToInventorySession: (
    sessionId: string,
    articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>,
    initialCountedQty: number,
    location?: string
  ) => { success: boolean; error?: string; article?: Article };

  // Supplier & PO Management
  createSupplierOrder: (params: {
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>;
    additionalFees?: number;
    expectedDeliveryDate?: string;
    notes?: string;
  }) => { success: boolean; error?: string; order?: SupplierOrder };
  updateSupplierOrder: (params: {
    orderId: string;
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      id?: string;
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>;
    additionalFees?: number;
    expectedDeliveryDate?: string;
    notes?: string;
  }) => { success: boolean; error?: string; order?: SupplierOrder };
  updateSupplierOrderStatus: (orderId: string, status: SupplierOrderStatus) => { success: boolean; error?: string };
  receiveSupplierOrder: (params: {
    orderId: string;
    itemsReceived: Array<{
      itemId: string;
      quantityReceivedNow: number;
      brand?: string;
    }>;
    notes?: string;
  }) => { success: boolean; error?: string };
  cancelSupplierOrder: (orderId: string, reason?: string) => { success: boolean; error?: string };
  deleteSupplierOrder: (orderId: string) => { success: boolean; error?: string; message?: string };
  createSupplier: (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => { success: boolean; error?: string; supplier?: Supplier };
  updateSupplier: (id: string, updates: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => { success: boolean; error?: string; supplier?: Supplier };
  deleteSupplier: (id: string) => { success: boolean; error?: string; message?: string };
  getActiveOrderForArticle: (articleId: string) => SupplierOrder | undefined;

  // Quotes / Proforma Management
  createQuote: (params: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    warehouseId: string;
    validUntil?: string;
    items: Array<{
      articleId: string;
      quantity: number;
      unitPrice?: number;
      discountPercent?: number;
    }>;
    notes?: string;
    terms?: string;
  }) => { success: boolean; error?: string; quote?: Quote };
  updateQuote: (
    quoteId: string,
    params: {
      customerId?: string;
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      warehouseId: string;
      validUntil?: string;
      items: Array<{
        articleId: string;
        quantity: number;
        unitPrice?: number;
        discountPercent?: number;
      }>;
      notes?: string;
      terms?: string;
    }
  ) => { success: boolean; error?: string; quote?: Quote };
  updateQuoteStatus: (quoteId: string, status: QuoteStatus) => { success: boolean; error?: string };
  convertQuoteToSale: (quoteId: string, paymentMethod: PaymentMethod) => { success: boolean; error?: string; saleId?: string };
  deleteQuote: (quoteId: string) => { success: boolean; error?: string; message?: string };

  // System actions (Demo backup / reset / table rase / Cloud / Database administration)
  resetToDemoData: () => void;
  clearAllData: (options?: { keepWarehouses?: boolean }) => Promise<{ success: boolean; error?: string }>;
  exportDatabaseJson: () => void;
  restoreDatabaseJson: (
    backupData: any,
    mode: 'MERGE' | 'REPLACE',
    options?: { syncToCloud?: boolean; excludeDemoRecords?: boolean }
  ) => {
    success: boolean;
    message: string;
    counts: Record<string, number>;
    verification?: {
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
    };
  };
  purgeCollection: (collectionKey: string) => { success: boolean; message: string };
  optimizeDatabaseStorage: () => {
    success: boolean;
    message: string;
    freedBytes: number;
    removedOrphanStocks: number;
    trimmedMovements: number;
  };
  loadDataFromCloud: (cloudData: any) => void;
  refreshFromCloud: () => Promise<{ success: boolean; message: string }>;
  isSyncing: boolean;
  lastCloudSync: Date | null;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

const IS_AI_STUDIO_DEMO = isAiStudioPreviewEnvironment();
const STORAGE_KEY_PREFIX = IS_AI_STUDIO_DEMO ? 'equipstock_aistudio_demo_v1_' : 'equipstock_v4_local_';
const MAX_LOCAL_MOVEMENTS = 400;

// Helper sécurisé contre le dépassement de quota (QuotaExceededError) du localStorage (~5 Mo max navigateur)
// Double persistance : écrit 100 % des données intégrales (sans troncature) dans IndexedDB (app déployée) + écrit dans localStorage
const safeSetLocalStorage = (keySuffix: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  const fullKey = STORAGE_KEY_PREFIX + keySuffix;

  // 1. Persistance intégrale haute capacité dans IndexedDB uniquement pour l'application déployée (données réelles)
  if (!IS_AI_STUDIO_DEMO) {
    idbSetItem(keySuffix, value).catch(() => {});
  }

  // 2. Persistance synchrone dans localStorage (avec repli anti-QuotaExceededError)
  try {
    if (keySuffix === 'movements' && Array.isArray(value)) {
      const compactMovements = (value as StockMovement[])
        .slice(0, MAX_LOCAL_MOVEMENTS)
        .map(({ notes, ...rest }) => (notes && notes.length > 80 ? { ...rest, notes: notes.slice(0, 80) } : { ...rest, ...(notes ? { notes } : {}) }));
      localStorage.setItem(fullKey, JSON.stringify(compactMovements));
      return;
    }

    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // En cas de dépassement de quota (QuotaExceededError) :
    try {
      if (keySuffix === 'movements' && Array.isArray(value)) {
        // Réduire drastiquement l'historique des mouvements en cache localStorage (IndexedDB conserve 100 %)
        const minimalMovements = (value as StockMovement[])
          .slice(0, 100)
          .map(({ notes: _n, reason, ...rest }) => ({
            ...rest,
            reason: reason ? reason.slice(0, 50) : '',
          }));
        localStorage.setItem(fullKey, JSON.stringify(minimalMovements));
        return;
      }

      // Pour les données prioritaires (articles, stocks, ventes, clients...), libérer l'espace occupé par l'historique des mouvements
      localStorage.removeItem(STORAGE_KEY_PREFIX + 'movements');
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // Ultime repli si le catalogue lui-même est très volumineux : alléger les images base64 lourdes dans localStorage (IndexedDB conserve les images)
      if (keySuffix === 'articles' && Array.isArray(value)) {
        try {
          const lightArticles = (value as Article[]).map((a) =>
            a.imageUrl && a.imageUrl.startsWith('data:') ? { ...a, imageUrl: undefined } : a
          );
          localStorage.setItem(fullKey, JSON.stringify(lightArticles));
        } catch {
          // Ne jamais bloquer l'exécution de l'application (IndexedDB assure la persistance complète)
        }
      }
    }
  }
};

const PURGE_TIMESTAMPS_KEY = STORAGE_KEY_PREFIX + 'purged_timestamps';
const DELETED_IDS_KEY = STORAGE_KEY_PREFIX + 'deleted_ids';

const getPurgedTimestamps = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PURGE_TIMESTAMPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const markCollectionsPurged = (collections: string[], ts: number = Date.now()): void => {
  if (typeof window === 'undefined') return;
  try {
    const current = getPurgedTimestamps();
    collections.forEach((col) => {
      current[col] = ts;
    });
    localStorage.setItem(PURGE_TIMESTAMPS_KEY, JSON.stringify(current));
    idbSetItem('purged_timestamps', current).catch(() => {});
  } catch {
    // ignore
  }
};

const clearPurgedTimestamps = (collections?: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!collections) {
      localStorage.removeItem(PURGE_TIMESTAMPS_KEY);
      idbSetItem('purged_timestamps', {}).catch(() => {});
      return;
    }
    const current = getPurgedTimestamps();
    collections.forEach((col) => {
      delete current[col];
    });
    localStorage.setItem(PURGE_TIMESTAMPS_KEY, JSON.stringify(current));
    idbSetItem('purged_timestamps', current).catch(() => {});
  } catch {
    // ignore
  }
};

// Registre persistant des suppressions unitaires (Tombstones) pour empêcher qu'un élément supprimé
// hors-ligne ou en cours de suppression ne réapparaisse lors d'un rechargement de page (F5)
const getDeletedIdsMap = (): Record<string, string[]> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const markIdsDeleted = (collectionName: string, ids: string[]): void => {
  if (typeof window === 'undefined' || !ids || ids.length === 0) return;
  try {
    const current = getDeletedIdsMap();
    const set = new Set<string>(current[collectionName] || []);
    ids.forEach((id) => {
      if (id) set.add(id);
    });
    // Garder au maximum les 2000 dernières suppressions par collection
    current[collectionName] = Array.from(set).slice(-2000);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(current));
    idbSetItem('deleted_ids', current).catch(() => {});
  } catch {
    // ignore
  }
};

const clearDeletedIds = (collectionName?: string, ids?: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!collectionName) {
      localStorage.removeItem(DELETED_IDS_KEY);
      idbSetItem('deleted_ids', {}).catch(() => {});
      return;
    }
    const current = getDeletedIdsMap();
    if (!ids) {
      delete current[collectionName];
    } else if (current[collectionName]) {
      const toClear = new Set(ids);
      current[collectionName] = current[collectionName].filter((id) => !toClear.has(id));
    }
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(current));
    idbSetItem('deleted_ids', current).catch(() => {});
  } catch {
    // ignore
  }
};

const triggerCloudWipeForCollections = (collections: string[]): void => {
  const nowTs = Date.now();
  markCollectionsPurged(collections, nowTs);
  collections.forEach((colName) => {
    wipeCollectionFromFirebase(colName)
      .then((res) => {
        if (res.success) {
          const current = getPurgedTimestamps();
          if (current[colName] === nowTs) {
            clearPurgedTimestamps([colName]);
          }
        }
      })
      .catch(() => {});
  });
};

const LEGACY_DEMO_IDS = new Set<string>([
  'art_1', 'art_2', 'art_3', 'art_4', 'art_5', 'art_6', 'art_7', 'art_8', 'art_9', 'art_10',
  'art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6', 'art-7', 'art-8', 'art-9', 'art-10',
  'cust_1', 'cust_2', 'cust_3', 'cust_4', 'cust_5', 'cust-1', 'cust-2', 'cust-3', 'cust-4', 'cust-5',
  'sale_1', 'sale_2', 'sale_3', 'sale_4', 'sale_5', 'sale-1', 'sale-2', 'sale-3', 'sale-4', 'sale-5',
  'mvt_1', 'mvt_2', 'mvt_3', 'mvt_4', 'mvt_5', 'mvt_6', 'mvt-1', 'mvt-2', 'mvt-3', 'mvt-4', 'mvt-5',
  'sup_1', 'sup_2', 'sup_3', 'po_1', 'po_2', 'po_3', 'qt_1', 'qt_2', 'qt_3',
  'inv_1', 'inv_2', 'cs_1', 'cs_2', 'cm_1', 'cm_2', 'cm_3', 'pay_1', 'pay_2', 'pay_3',
]);

export const isLegacyDemoRecord = (item: any, colName?: string): boolean => {
  if (!item) return false;
  // Dans Google AI Studio (mode Démo isolé), on autorise l'affichage des données de démo
  if (IS_AI_STUDIO_DEMO) return false;
  // Dans l'application déployée et dans Cloud Firestore, on exclut strictement toute donnée de démo
  if (colName === 'stocks') {
    const artId = String(item.articleId || '');
    return Boolean(artId && (LEGACY_DEMO_IDS.has(artId) || artId.startsWith('demo_')));
  }
  const id = String(item.id || '');
  return Boolean(id && (LEGACY_DEMO_IDS.has(id) || id.startsWith('demo_')));
};

const filterCloudItemsAfterPurge = <T extends Record<string, any>>(
  items: T[] | undefined,
  colName: string,
  purgedAtMap: Record<string, number>,
  deletedIdsMap?: Record<string, string[]>
): T[] => {
  if (!items || items.length === 0) return [];
  const purgedAt = purgedAtMap[colName];
  const deletedSet = new Set<string>((deletedIdsMap && deletedIdsMap[colName]) || []);
  const deletedArticlesSet = new Set<string>((deletedIdsMap && deletedIdsMap.articles) || []);

  // Filtrer d'abord les éléments supprimés unitairement (Tombstones) et toute ancienne donnée fictive de démo
  const withoutDeleted = items.filter((item) => {
    if (!item) return false;
    if (isLegacyDemoRecord(item, colName)) {
      if (colName === 'articles' && item.id) {
        deleteArticleFromFirebase(String(item.id)).catch(() => {});
      }
      return false;
    }
    if (colName === 'stocks') {
      const stockKey = `${item.articleId}_${item.warehouseId}`;
      if (deletedSet.has(stockKey) || deletedArticlesSet.has(item.articleId)) {
        return false;
      }
      return true;
    }
    if (item.id && deletedSet.has(item.id)) {
      return false;
    }
    return true;
  });

  if (!purgedAt) return withoutDeleted;

  // Un horodatage de purge ne sert que pendant les 2 minutes suivant une purge manuelle ;
  // au-delà, on le nettoie pour ne jamais bloquer la synchronisation temps réel entre machines.
  if (Date.now() - purgedAt > 120000) {
    clearPurgedTimestamps([colName]);
    return withoutDeleted;
  }

  const kept = withoutDeleted.filter((item) => {
    const rawTs =
      item.updatedAt ||
      item.lastInventoryDate ||
      item.date ||
      item.openedAt ||
      item.createdAt ||
      0;
    const itemTs = rawTs ? new Date(rawTs).getTime() : 0;
    return itemTs > purgedAt;
  });

  return kept;
};

// Purge intégrale des anciennes clés localStorage (v1, v2, v3) pour garantir une base 100% vierge
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith('equipstock_v1_') ||
        key.startsWith('equipstock_v2_') ||
        key.startsWith('equipstock_v3_')
      ) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.removeItem('equipstock_auth_bypassed');
  } catch (e) {
    // Ignore in non-browser context
  }
}

export const CLEAN_DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'mag_principal',
    code: 'MAG-01',
    name: 'Magasin',
    location: 'Boutique Principale (Point de Vente)',
    phone: '',
    manager: 'Direction Générale',
    isActive: true,
    isDefault: true,
    notes: 'Boutique principale où les ventes s’opèrent (dépôt magasin par défaut).',
  },
];

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'WKRLI',
  shortName: 'WKRLI',
  slogan: "Pièces d'Engins, Filtration Industrielle & Matériel TP",
  address: 'Zone Industrielle Bel-Air, Dakar, Sénégal',
  phone: '+221 33 849 20 10 / +221 77 450 88 00',
  email: 'commercial@wkrli.com',
  website: 'www.wkrli.com',
  ninea: '004829102-2B3',
  rc: 'SN-DKR-2023-B-1402',
  capital: '10 000 000 FCFA',
  bankInfo: 'Banque CBAO Dakar · Code: SN012 · Compte: 010023489102-45',
  invoiceFooter: 'Merci pour votre confiance ! Les marchandises livrées demeurent la propriété de la société jusqu’au paiement intégral.',
  logoUrl: '',
  currency: 'FCFA',
};

const normalizeCompanyInfo = (raw?: Partial<CompanyInfo> | null): CompanyInfo => {
  const merged: CompanyInfo = { ...DEFAULT_COMPANY_INFO, ...(raw || {}) };
  if (!merged.name || merged.name.toUpperCase().includes('EQUIPSTOCK')) {
    merged.name = 'WKRLI';
  }
  if (
    !merged.shortName ||
    merged.shortName.toUpperCase() === 'ESP' ||
    merged.shortName.toUpperCase() === 'E-STOCK' ||
    merged.shortName.toUpperCase().includes('EQUIPSTOCK')
  ) {
    merged.shortName = 'WKRLI';
  }
  return merged;
};

export const getDefaultPermissionsForRole = (role: UserRole): UserPermissions => {
  if (role === 'ADMIN') {
    return {
      canSell: true,
      canOverridePrice: true,
      canBackdateTransactions: true,
      canDeleteSales: true,
      canManageCash: true,
      canManageQuotes: true,
      canManageCustomers: true,
      canManageCatalog: true,
      canDeleteArticles: true,
      canViewPurchasePrices: true,
      canManageStockMovements: true,
      canManageInventory: true,
      canManagePurchases: true,
      canManageWarehouses: true,
      canViewReports: true,
      canManageUsers: true,
      canManageDatabase: true,
    };
  }
  if (role === 'RESPONSABLE') {
    return {
      canSell: true,
      canOverridePrice: true,
      canBackdateTransactions: false,
      canDeleteSales: true,
      canManageCash: true,
      canManageQuotes: true,
      canManageCustomers: true,
      canManageCatalog: true,
      canDeleteArticles: false,
      canViewPurchasePrices: true,
      canManageStockMovements: true,
      canManageInventory: true,
      canManagePurchases: true,
      canManageWarehouses: false,
      canViewReports: true,
      canManageUsers: false,
      canManageDatabase: false,
    };
  }
  // MAGASINIER
  return {
    canSell: true,
    canOverridePrice: false,
    canBackdateTransactions: false,
    canDeleteSales: false,
    canManageCash: false,
    canManageQuotes: true,
    canManageCustomers: true,
    canManageCatalog: false,
    canDeleteArticles: false,
    canViewPurchasePrices: false,
    canManageStockMovements: true,
    canManageInventory: true,
    canManagePurchases: false,
    canManageWarehouses: false,
    canViewReports: false,
    canManageUsers: false,
    canManageDatabase: false,
  };
};

export const resolveUserPermissions = (user: UserProfile): UserPermissions => {
  if (user.email?.toLowerCase() === 'westjunior0805@gmail.com') {
    return getDefaultPermissionsForRole('ADMIN');
  }
  const base = getDefaultPermissionsForRole(user.role);
  if (!user.permissions) return base;
  return {
    ...base,
    ...user.permissions,
  };
};

// Monotonic sequence counters ensuring absolute uniqueness even in high-frequency loops & same-millisecond calls
let seqMvt = Date.now() % 100000;
let seqCsm = Date.now() % 100000;
let seqSale = Date.now() % 10000;
let seqPay = Date.now() % 10000;
let seqCs = Date.now() % 1000;
let seqArt = Date.now() % 1000;
let seqCust = Date.now() % 1000;

export const generateMovementId = (): string => {
  seqMvt += 1;
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MVT-${year}-${String(seqMvt).padStart(5, '0')}-${rand}`;
};

export const generateCashMovementId = (prefix = 'CSM'): string => {
  seqCsm += 1;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${Date.now()}-${String(seqCsm).padStart(4, '0')}-${rand}`;
};

export const generateSaleId = (): string => {
  seqSale += 1;
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `VTE-${year}-${String(seqSale).padStart(4, '0')}-${rand}`;
};

export const generateReceiptNumber = (): string => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `REC-${year}-${String(seqSale).padStart(4, '0')}-${rand}`;
};

export const generatePaymentId = (): string => {
  seqPay += 1;
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PAY-${year}-${String(seqPay).padStart(4, '0')}-${rand}`;
};

export const generateCashSessionId = (): string => {
  seqCs += 1;
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CS-${year}-${String(seqCs).padStart(4, '0')}-${rand}`;
};

export const generateCustomerId = (existingCount: number): string => {
  seqCust += 1;
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CLI-${String(existingCount + 1).padStart(3, '0')}-${rand}`;
};

export const getNextCustomerCode = (existingCustomers: Customer[]): string => {
  const existingCodes = new Set(
    existingCustomers.map((c) => (c.code || '').trim().toUpperCase()).filter(Boolean)
  );
  let maxNum = 0;
  for (const c of existingCustomers) {
    const match = (c.code || '').trim().match(/^CLI-(\d+)$/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  let nextNum = Math.max(maxNum, existingCustomers.length) + 1;
  let candidate = `CLI-${String(nextNum).padStart(3, '0')}`;
  while (existingCodes.has(candidate)) {
    nextNum += 1;
    candidate = `CLI-${String(nextNum).padStart(3, '0')}`;
  }
  return candidate;
};

export const generateArticleId = (existingCount: number): string => {
  seqArt += 1;
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ART-${String(existingCount + 1).padStart(4, '0')}-${rand}`;
};

let seqPo = Date.now() % 100000;
let seqQuote = Date.now() % 100000;
let seqSupp = Date.now() % 100000;

export const generatePurchaseOrderId = (existingCount: number): string => {
  seqPo += 1;
  const year = new Date().getFullYear();
  return `CMD-${year}-${String(existingCount + 1).padStart(4, '0')}`;
};

export const generateQuoteId = (existingCount: number): string => {
  seqQuote += 1;
  const year = new Date().getFullYear();
  return `DEV-${year}-${String(existingCount + 1).padStart(4, '0')}`;
};

export const generateSupplierId = (existingCount: number): string => {
  seqSupp += 1;
  return `FOURN-${String(existingCount + 1).padStart(3, '0')}`;
};

// Helper to ensure loaded arrays have 100% unique IDs (deduplicating any legacy duplicate keys)
// and automatically exclude any legacy fictional demo records so only real user data is kept.
const sanitizeUniqueList = <T extends { id: string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  return (list || [])
    .filter((item) => item && !isLegacyDemoRecord(item))
    .map((item, idx) => {
      if (seen.has(item.id)) {
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        const cleanId = `${item.id}-DEDUP-${idx}-${rand}`;
        return { ...item, id: cleanId };
      }
      seen.add(item.id);
      return item;
    });
};

// Fusion intelligente : garantit qu'aucune donnée locale créée ou modifiée n'est écrasée lors du rechargement Cloud
// et empêche la création de doublons d'articles ayant la même référence principale (mainReference)
const mergeEntities = <T extends { id: string; updatedAt?: string; date?: string; createdAt?: string }>(
  localList: T[],
  remoteList: T[]
): T[] => {
  if (!remoteList || remoteList.length === 0) return localList || [];
  if (!localList || localList.length === 0) return remoteList;

  const map = new Map<string, T>();
  const refToIdMap = new Map<string, string>();
  const localById = new Map<string, T>();

  const normalizeRef = (val: unknown): string =>
    typeof val === 'string' ? val.trim().toUpperCase().replace(/\s+/g, ' ') : '';

  // 1. Indexer d'abord les références principales locales pour préserver les identifiants locaux liés aux stocks
  localList.forEach((localItem) => {
    if (!localItem || !localItem.id) return;
    localById.set(localItem.id, localItem);
    const mainRef = normalizeRef((localItem as any).mainReference);
    if (mainRef) {
      refToIdMap.set(mainRef, localItem.id);
    }
  });

  // 2. Ajouter les enregistrements du Cloud (en évitant les doublons de mainReference)
  remoteList.forEach((r) => {
    if (!r || !r.id) return;
    const remoteRef = normalizeRef((r as any).mainReference);
    if (remoteRef && refToIdMap.has(remoteRef)) {
      const canonicalId = refToIdMap.get(remoteRef)!;
      map.set(canonicalId, r.id === canonicalId ? r : { ...r, id: canonicalId });
    } else {
      map.set(r.id, r);
      if (remoteRef) refToIdMap.set(remoteRef, r.id);
    }
  });

  // 3. Fusionner les enregistrements locaux : conserver la référence mémoire locale si identique ou plus récente
  localList.forEach((localItem) => {
    if (!localItem || !localItem.id) return;
    const remoteItem = map.get(localItem.id);
    if (!remoteItem) {
      map.set(localItem.id, localItem);
    } else {
      const localTime = new Date(
        localItem.updatedAt || (localItem as any).openedAt || localItem.date || localItem.createdAt || 0
      ).getTime();
      const remoteTime = new Date(
        remoteItem.updatedAt || (remoteItem as any).openedAt || remoteItem.date || remoteItem.createdAt || 0
      ).getTime();
      if (localTime > remoteTime) {
        map.set(localItem.id, localItem);
      } else if (
        localTime === remoteTime &&
        JSON.stringify(localItem) === JSON.stringify(remoteItem)
      ) {
        map.set(localItem.id, localItem);
      }
    }
  });

  // Si aucune entité n'a changé et le nombre d'éléments est identique, retourner `localList` tel quel pour éviter tout re-render React
  if (map.size === localList.length) {
    let anyChanged = false;
    for (const item of localList) {
      if (map.get(item.id) !== item) {
        anyChanged = true;
        break;
      }
    }
    if (!anyChanged) {
      return localList;
    }
  }

  return Array.from(map.values());
};

const reconcileWarehouseStock = (st: WarehouseStock): WarehouseStock => {
  const cleanQty = Math.max(0, Math.round(Number(st.quantity) || 0));
  if (!st.brandBreakdown || typeof st.brandBreakdown !== 'object') {
    return st.quantity === cleanQty ? st : { ...st, quantity: cleanQty };
  }

  const rawKeys = Object.keys(st.brandBreakdown);
  if (rawKeys.length === 0) {
    return st.quantity === cleanQty ? st : { ...st, quantity: cleanQty };
  }

  // 1. Canonicalize & merge duplicate keys (e.g., "CAT" + "cat ", "" + "Générique")
  const namedMap = new Map<string, { label: string; qty: number }>();
  let placeholderQty = 0;
  let hadPlaceholderKey = false;
  let hadDuplicateOrDirtyKey = false;

  for (const rawKey of rawKeys) {
    const val = cleanQty === 0 ? 0 : Math.max(0, Math.round(Number(st.brandBreakdown[rawKey]) || 0));
    const cleanKey = cleanBrandName(rawKey);
    if (!cleanKey) {
      hadPlaceholderKey = true;
      placeholderQty += val;
      if (rawKey !== '') hadDuplicateOrDirtyKey = true;
    } else {
      const norm = cleanKey.toLowerCase();
      const existing = namedMap.get(norm);
      if (existing) {
        hadDuplicateOrDirtyKey = true;
        existing.qty += val;
      } else {
        if (rawKey !== cleanKey) hadDuplicateOrDirtyKey = true;
        namedMap.set(norm, { label: cleanKey, qty: val });
      }
    }
  }

  const nextBd: Record<string, number> = {};
  let namedSum = 0;
  for (const entry of namedMap.values()) {
    nextBd[entry.label] = entry.qty;
    namedSum += entry.qty;
  }

  let droppedGhostPlaceholder = false;
  if (namedMap.size > 0) {
    if (hadPlaceholderKey) {
      if (namedSum > 0) {
        // Real named brands already hold stock -> drop ghost placeholder key left by legacy edits
        droppedGhostPlaceholder = true;
      } else if (placeholderQty > 0) {
        // All named brands are 0 -> preserve stock by migrating placeholder qty to primary named brand
        const firstLabel = Array.from(namedMap.values())[0].label;
        nextBd[firstLabel] = placeholderQty;
        namedSum = placeholderQty;
      }
    }
  } else if (hadPlaceholderKey) {
    nextBd[''] = placeholderQty;
  }

  const finalKeys = Object.keys(nextBd);
  const bdSum = finalKeys.reduce((acc, k) => acc + nextBd[k], 0);
  let finalQty = cleanQty;

  if (cleanQty === 0) {
    for (const k of finalKeys) nextBd[k] = 0;
    finalQty = 0;
  } else if (droppedGhostPlaceholder || hadDuplicateOrDirtyKey) {
    // Breakdown was canonicalized/cleaned -> exact sum of real brands is authoritative
    finalQty = bdSum;
  } else if (bdSum > 0 && bdSum !== cleanQty) {
    // Strictly align quantity with the exact sum of its brand breakdown so Total === Sum(brands)
    finalQty = bdSum;
  } else if (bdSum === 0 && cleanQty > 0 && finalKeys.length === 1) {
    // Single-brand record with uninitialized 0 breakdown -> restore cleanQty to that brand
    nextBd[finalKeys[0]] = cleanQty;
  }

  const unchanged =
    st.quantity === finalQty &&
    rawKeys.length === finalKeys.length &&
    finalKeys.every((k) => Object.prototype.hasOwnProperty.call(st.brandBreakdown, k) && st.brandBreakdown![k] === nextBd[k]);

  return unchanged ? st : { ...st, quantity: finalQty, brandBreakdown: nextBd };
};

const deduplicateStocksList = (list: WarehouseStock[]): WarehouseStock[] => {
  const map = new Map<string, WarehouseStock>();
  for (const raw of list) {
    if (!raw || !raw.articleId || !raw.warehouseId) continue;
    const st = reconcileWarehouseStock(raw);
    const key = `${st.articleId}__${st.warehouseId}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, st);
    } else {
      const prevTime = new Date(prev.updatedAt || prev.lastInventoryDate || 0).getTime();
      const curTime = new Date(st.updatedAt || st.lastInventoryDate || 0).getTime();
      if (curTime >= prevTime) {
        map.set(key, st);
      }
    }
  }
  return Array.from(map.values());
};

const mergeStocks = (localStocks: WarehouseStock[], remoteStocks: WarehouseStock[]): WarehouseStock[] => {
  const cleanLocal = (localStocks || []).filter((s) => !isLegacyDemoRecord(s, 'stocks'));
  const cleanRemote = (remoteStocks || []).filter((s) => !isLegacyDemoRecord(s, 'stocks'));

  if (cleanRemote.length === 0) {
    return localStocks;
  }
  if (cleanLocal.length === 0) {
    return cleanRemote.map(reconcileWarehouseStock);
  }

  const map = new Map<string, WarehouseStock>();
  cleanRemote.forEach((raw) => {
    if (raw && raw.articleId && raw.warehouseId) {
      const st = reconcileWarehouseStock(raw);
      const key = `${st.articleId}_${st.warehouseId}`;
      map.set(key, st);
    }
  });

  cleanLocal.forEach((raw) => {
    if (raw && raw.articleId && raw.warehouseId) {
      const st = reconcileWarehouseStock(raw);
      const key = `${st.articleId}_${st.warehouseId}`;
      const remote = map.get(key);
      if (!remote) {
        map.set(key, st);
      } else {
        const localTime = new Date(st.updatedAt || st.lastInventoryDate || 0).getTime();
        const remoteTime = new Date(remote.updatedAt || remote.lastInventoryDate || 0).getTime();
        if (localTime > remoteTime) {
          map.set(key, st);
        } else if (
          localTime === remoteTime &&
          st.quantity === remote.quantity &&
          st.shelfLocation === remote.shelfLocation &&
          JSON.stringify(st.brandBreakdown || {}) === JSON.stringify(remote.brandBreakdown || {}) &&
          JSON.stringify(st.brandLocations || {}) === JSON.stringify(remote.brandLocations || {})
        ) {
          map.set(key, raw);
        }
      }
    }
  });

  if (map.size === localStocks.length) {
    let anyChanged = false;
    for (const s of localStocks) {
      const key = `${s.articleId}_${s.warehouseId}`;
      if (map.get(key) !== s) {
        anyChanged = true;
        break;
      }
    }
    if (!anyChanged) {
      return localStocks;
    }
  }

  return Array.from(map.values());
};

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Real Firebase Auth user state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // Explicit authenticated session flag (requires Google Auth, Email Auth, or valid Operator PIN)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('equipstock_v3_session_active') === 'true';
  });

  // Users directory state (synced with Firestore and localStorage)
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'users');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : INITIAL_USERS;
  });

  // Current active operator / user profile
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'user');
    return saved ? JSON.parse(saved) : INITIAL_USERS[0];
  });

  // Company Information state (persisted in localStorage, IndexedDB, and Firestore)
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'company_info');
      if (saved) {
        return normalizeCompanyInfo(JSON.parse(saved));
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_COMPANY_INFO;
  });

  const updateCompanyInfo = useCallback((updates: Partial<CompanyInfo>) => {
    setCompanyInfo((prev) => {
      const next: CompanyInfo = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      safeSetLocalStorage('company_info', next);
      saveCompanyInfoToFirebase(next).catch(console.warn);
      return next;
    });
  }, []);

  const resetCompanyInfo = useCallback(() => {
    const resetVal: CompanyInfo = {
      ...DEFAULT_COMPANY_INFO,
      updatedAt: new Date().toISOString(),
    };
    setCompanyInfo(resetVal);
    safeSetLocalStorage('company_info', resetVal);
    saveCompanyInfoToFirebase(resetVal).catch(console.warn);
  }, []);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // Global preference for product images display (persisted in localStorage)
  const [showProductImages, setShowProductImagesState] = useState<boolean>(() => {
    const saved = localStorage.getItem('equipstock_show_product_images');
    return saved !== null ? saved === 'true' : true;
  });

  const setShowProductImages = useCallback((action: boolean | ((prev: boolean) => boolean)) => {
    setShowProductImagesState((prev) => {
      const nextVal = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('equipstock_show_product_images', String(nextVal));
      } catch (err) {
        console.warn('Could not persist showProductImages preference:', err);
      }
      return nextVal;
    });
  }, []);

  const toggleProductImages = useCallback(() => {
    setShowProductImages((prev) => !prev);
  }, [setShowProductImages]);

  const [articles, setArticles] = useState<Article[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'articles');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as Article[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_ARTICLES : [];
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'warehouses');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as Warehouse[]);
        if (parsed.length > 0) return parsed;
      } catch {
        // Fallback to default store warehouse
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_WAREHOUSES : CLEAN_DEFAULT_WAREHOUSES;
  });

  // Target Boutique / Dépôt Magasin for internal replenishment (persisted in localStorage)
  const [boutiqueWarehouseIdRaw, setBoutiqueWarehouseIdRaw] = useState<string>(() => {
    try {
      return localStorage.getItem('equipstock_boutique_warehouse_id') || '';
    } catch {
      return '';
    }
  });

  const boutiqueWarehouseId = useMemo(() => {
    if (boutiqueWarehouseIdRaw && warehouses.some((w) => w.id === boutiqueWarehouseIdRaw)) {
      return boutiqueWarehouseIdRaw;
    }
    return warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '';
  }, [boutiqueWarehouseIdRaw, warehouses]);

  const setBoutiqueWarehouseId = useCallback((id: string) => {
    setBoutiqueWarehouseIdRaw(id);
    try {
      localStorage.setItem('equipstock_boutique_warehouse_id', id);
    } catch (err) {
      console.warn('Could not persist boutiqueWarehouseId preference:', err);
    }
  }, []);

  const getBoutiqueMinThreshold = useCallback(
    (article: Article, warehouseId?: string): number => {
      const targetWhId = warehouseId || boutiqueWarehouseId;
      if (
        targetWhId &&
        article.warehouseMinThresholds &&
        typeof article.warehouseMinThresholds[targetWhId] === 'number' &&
        !Number.isNaN(article.warehouseMinThresholds[targetWhId])
      ) {
        return Math.max(0, Math.floor(article.warehouseMinThresholds[targetWhId]));
      }
      return Math.max(0, Math.floor(Number(article.minStockThreshold) || 0));
    },
    [boutiqueWarehouseId]
  );

  const [stocks, setStocks] = useState<WarehouseStock[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'stocks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WarehouseStock[];
        if (Array.isArray(parsed) && (parsed.length > 0 || !IS_AI_STUDIO_DEMO)) {
          return deduplicateStocksList(
            parsed.filter((s) => !isLegacyDemoRecord(s, 'stocks'))
          );
        }
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? deduplicateStocksList(INITIAL_WAREHOUSE_STOCKS) : [];
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'movements');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as StockMovement[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_MOVEMENTS : [];
  });

  const [inventories, setInventories] = useState<InventorySession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'inventories');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : IS_AI_STUDIO_DEMO ? INITIAL_INVENTORIES : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'customers');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as Customer[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_CUSTOMERS : [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'sales');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as Sale[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_SALES : [];
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'payments');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as PaymentRecord[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_PAYMENTS : [];
  });

  const [cashSessions, setCashSessions] = useState<CashSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cash_sessions');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as CashSession[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_CASH_SESSIONS : [];
  });

  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cash_movements');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as CashMovement[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_CASH_MOVEMENTS : [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'suppliers');
    if (saved) {
      try {
        const parsed = sanitizeUniqueList(JSON.parse(saved) as Supplier[]);
        if (parsed.length > 0 || !IS_AI_STUDIO_DEMO) return parsed;
      } catch {
        // ignore
      }
    }
    return IS_AI_STUDIO_DEMO ? INITIAL_SUPPLIERS : [];
  });

  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'supplier_orders');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : IS_AI_STUDIO_DEMO ? INITIAL_SUPPLIER_ORDERS : [];
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'quotes');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : IS_AI_STUDIO_DEMO ? INITIAL_QUOTES : [];
  });

  const [returns, setReturns] = useState<SaleReturn[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'returns');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [isStockFrozen, setIsStockFrozen] = useState<boolean>(() => {
    return localStorage.getItem('equipstock_stock_frozen') === 'true';
  });

  const toggleStockFreeze = () => {
    setIsStockFrozen((prev) => {
      const next = !prev;
      localStorage.setItem('equipstock_stock_frozen', String(next));
      return next;
    });
  };

  // Debounced persistence to localStorage to prevent main-thread JSON.stringify freezes on large datasets
  useEffect(() => {
    safeSetLocalStorage('user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('articles', articles);
    }, 450);
    return () => clearTimeout(t);
  }, [articles]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('warehouses', warehouses);
    }, 450);
    return () => clearTimeout(t);
  }, [warehouses]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('stocks', stocks);
    }, 450);
    return () => clearTimeout(t);
  }, [stocks]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('movements', movements);
    }, 450);
    return () => clearTimeout(t);
  }, [movements]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('inventories', inventories);
    }, 450);
    return () => clearTimeout(t);
  }, [inventories]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('customers', customers);
    }, 450);
    return () => clearTimeout(t);
  }, [customers]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('sales', sales);
    }, 450);
    return () => clearTimeout(t);
  }, [sales]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('payments', payments);
    }, 450);
    return () => clearTimeout(t);
  }, [payments]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('cash_sessions', cashSessions);
    }, 450);
    return () => clearTimeout(t);
  }, [cashSessions]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('cash_movements', cashMovements);
    }, 450);
    return () => clearTimeout(t);
  }, [cashMovements]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('suppliers', suppliers);
    }, 450);
    return () => clearTimeout(t);
  }, [suppliers]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('supplier_orders', supplierOrders);
    }, 450);
    return () => clearTimeout(t);
  }, [supplierOrders]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('quotes', quotes);
    }, 450);
    return () => clearTimeout(t);
  }, [quotes]);

  useEffect(() => {
    const t = setTimeout(() => {
      safeSetLocalStorage('returns', returns);
    }, 450);
    return () => clearTimeout(t);
  }, [returns]);

  useEffect(() => {
    safeSetLocalStorage('users', users);
  }, [users]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);
  const purgeGenerationRef = React.useRef<number>(0);

  // Sanitize any existing oversized images in articles (e.g. legacy large photos)
  useEffect(() => {
    let isCancelled = false;
    const startGen = purgeGenerationRef.current;
    const shrinkOversized = async () => {
      let changed = false;
      const updated = await Promise.all(
        articles.map(async (art) => {
          if (art.imageUrl && art.imageUrl.startsWith('data:image/') && art.imageUrl.length > 150000) {
            changed = true;
            const compressed = await compressBase64Image(art.imageUrl, 480, 480, 0.7);
            return { ...art, imageUrl: compressed };
          }
          return art;
        })
      );
      if (changed && !isCancelled && purgeGenerationRef.current === startGen) {
        setArticles(updated);
      }
    };
    shrinkOversized();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Self-heal any WarehouseStock whose shelfLocation was polluted by a legacy transfer from another warehouse
  useEffect(() => {
    if (stocks.length === 0 || warehouses.length === 0) return;
    let changed = false;
    const touchedStocks: WarehouseStock[] = [];

    const stocksByArt = new Map<string, WarehouseStock[]>();
    for (const s of stocks) {
      const list = stocksByArt.get(s.articleId);
      if (list) list.push(s);
      else stocksByArt.set(s.articleId, [s]);
    }

    const nextStocks = stocks.map((st) => {
      const wh = warehouses.find((w) => w.id === st.warehouseId);
      if (!wh) return st;
      const normWhName = wh.name.toLowerCase().trim();
      const normWhCode = wh.code.toLowerCase().trim();

      const hasOtherWhPrefix = (raw: string | undefined): boolean => {
        if (!raw || raw === 'Non renseigné') return false;
        const m = raw.trim().match(/^([^:]{2,45}?)\s*:\s*(.+)$/);
        if (!m) return false;
        const p = m[1].trim().toLowerCase();
        if (p === normWhName || p === normWhCode) return false;
        return warehouses.some(
          (w) =>
            w.id !== st.warehouseId &&
            (w.name.toLowerCase().trim() === p || w.code.toLowerCase().trim() === p)
        );
      };

      const artStocks = stocksByArt.get(st.articleId) || [];
      const hasOwnBrandLocations =
        st.brandLocations && Object.keys(st.brandLocations).length > 0;
      const pureStShelf = stripWarehousePrefix(st.shelfLocation, warehouses, wh.name);

      // Check if st.shelfLocation was copied from another warehouse by legacy applyStockDelta during transfer
      const isCopiedFromOtherWh =
        !hasOwnBrandLocations &&
        Boolean(st.shelfLocation && st.shelfLocation !== 'Non renseigné') &&
        artStocks.some((other) => {
          if (other.warehouseId === st.warehouseId) return false;
          const otherHasBrandLocs =
            other.brandLocations && Object.keys(other.brandLocations).length > 0;
          if (!otherHasBrandLocs) return false;
          const otherPureShelves = [
            other.shelfLocation ? stripWarehousePrefix(other.shelfLocation, warehouses) : '',
            ...Object.values(other.brandLocations || {}).map((v) =>
              stripWarehousePrefix(v, warehouses)
            ),
          ].filter(Boolean);
          return (
            pureStShelf.length > 0 &&
            otherPureShelves.some(
              (os) => os.toLowerCase().trim() === pureStShelf.toLowerCase().trim()
            )
          );
        });

      let nextShelf = st.shelfLocation;
      let stModified = false;

      if (hasOtherWhPrefix(nextShelf) || isCopiedFromOtherWh) {
        nextShelf = 'Non renseigné';
        stModified = true;
      }

      let nextBrandLocs = st.brandLocations;
      if (st.brandLocations) {
        const cleanedMap: Record<string, string> = {};
        let mapChanged = false;
        for (const [bKey, bVal] of Object.entries(st.brandLocations)) {
          if (hasOtherWhPrefix(bVal)) {
            cleanedMap[bKey] = 'Non renseigné';
            mapChanged = true;
          } else {
            cleanedMap[bKey] = bVal;
          }
        }
        if (mapChanged) {
          nextBrandLocs = cleanedMap;
          stModified = true;
        }
      }

      if (stModified) {
        changed = true;
        const cleanedRecord: WarehouseStock = {
          ...st,
          shelfLocation: nextShelf,
          brandLocations: nextBrandLocs,
        };
        touchedStocks.push(cleanedRecord);
        return cleanedRecord;
      }
      return st;
    });

    if (changed) {
      setStocks(nextStocks);
      safeSetLocalStorage('stocks', nextStocks);
      if (touchedStocks.length > 0) {
        saveMultipleStocksToFirebase(touchedStocks).catch(console.warn);
      }
    }
  }, [warehouses.length]);

  // Synchronisation bidirectionnelle non-destructive avec Firebase / Firestore + cache IndexedDB & localStorage
  const refreshFromCloud = async (): Promise<{ success: boolean; message: string }> => {
    if (IS_AI_STUDIO_DEMO) {
      return {
        success: true,
        message: 'Aperçu Google AI Studio : données de démo isolées (aucune écriture sur Cloud Firestore).',
      };
    }
    const startGen = purgeGenerationRef.current;
    setIsSyncing(true);
    try {
      const cloudData = await downloadAllFromFirebase();
      // Si une purge a été déclenchée pendant le téléchargement Cloud, ne pas réinjecter les anciennes données
      if (purgeGenerationRef.current !== startGen) {
        setIsSyncing(false);
        return {
          success: true,
          message: 'Purge prioritaire appliquée.',
        };
      }

      const purgedMap = getPurgedTimestamps();
      const deletedMap = getDeletedIdsMap();

      const cloudArticles = filterCloudItemsAfterPurge(cloudData.articles, 'articles', purgedMap, deletedMap);
      const cloudWarehouses = filterCloudItemsAfterPurge(cloudData.warehouses, 'warehouses', purgedMap, deletedMap);
      const cloudStocks = filterCloudItemsAfterPurge(cloudData.stocks, 'stocks', purgedMap, deletedMap);
      const cloudMovements = filterCloudItemsAfterPurge(cloudData.movements, 'movements', purgedMap, deletedMap);
      const cloudCustomers = filterCloudItemsAfterPurge(cloudData.customers, 'customers', purgedMap, deletedMap);
      const cloudSales = filterCloudItemsAfterPurge(cloudData.sales, 'sales', purgedMap, deletedMap);
      const cloudPayments = filterCloudItemsAfterPurge(cloudData.payments, 'payments', purgedMap, deletedMap);
      const cloudCashSessions = filterCloudItemsAfterPurge(cloudData.cashSessions, 'cashSessions', purgedMap, deletedMap);
      const cloudCashMovements = filterCloudItemsAfterPurge(cloudData.cashMovements, 'cashMovements', purgedMap, deletedMap);
      const cloudInventories = filterCloudItemsAfterPurge(cloudData.inventories, 'inventories', purgedMap, deletedMap);
      const cloudSuppliers = filterCloudItemsAfterPurge(cloudData.suppliers, 'suppliers', purgedMap, deletedMap);
      const cloudSupplierOrders = filterCloudItemsAfterPurge(cloudData.supplierOrders, 'supplierOrders', purgedMap, deletedMap);
      const cloudQuotes = filterCloudItemsAfterPurge(cloudData.quotes, 'quotes', purgedMap, deletedMap);
      const cloudReturns = filterCloudItemsAfterPurge(cloudData.returns, 'returns', purgedMap, deletedMap);
      const cloudUsers = filterCloudItemsAfterPurge(cloudData.users, 'users', purgedMap, deletedMap);

      if (cloudArticles.length > 0) {
        setArticles((prev) => mergeEntities(prev, cloudArticles));
      }
      if (cloudWarehouses.length > 0) {
        setWarehouses((prev) => mergeEntities(prev, cloudWarehouses));
      }
      if (cloudStocks.length > 0) {
        setStocks((prev) => mergeStocks(prev, cloudStocks));
      }
      if (cloudMovements.length > 0) {
        setMovements((prev) => mergeEntities(prev, cloudMovements));
      }
      if (cloudCustomers.length > 0) {
        setCustomers((prev) => mergeEntities(prev, cloudCustomers));
      }
      if (cloudSales.length > 0) {
        setSales((prev) => mergeEntities(prev, cloudSales));
      }
      if (cloudPayments.length > 0) {
        setPayments((prev) => mergeEntities(prev, cloudPayments));
      }
      if (cloudCashSessions.length > 0) {
        setCashSessions((prev) => mergeEntities(prev, cloudCashSessions));
      }
      if (cloudCashMovements.length > 0) {
        setCashMovements((prev) => mergeEntities(prev, cloudCashMovements));
      }
      if (cloudInventories.length > 0) {
        setInventories((prev) => mergeEntities(prev, cloudInventories));
      }
      if (cloudSuppliers.length > 0) {
        setSuppliers((prev) => mergeEntities(prev, cloudSuppliers));
      }
      if (cloudSupplierOrders.length > 0) {
        setSupplierOrders((prev) => mergeEntities(prev, cloudSupplierOrders));
      }
      if (cloudQuotes.length > 0) {
        setQuotes((prev) => mergeEntities(prev, cloudQuotes));
      }
      if (cloudReturns.length > 0) {
        setReturns((prev) => mergeEntities(prev, cloudReturns));
      }
      if (cloudUsers.length > 0) {
        setUsers((prev) => mergeEntities(prev, cloudUsers));
      }
      if (cloudData.companyInfoList && cloudData.companyInfoList.length > 0) {
        const remoteInfo = cloudData.companyInfoList[0];
        if (remoteInfo && remoteInfo.name) {
          setCompanyInfo((prev) => {
            const localTime = new Date(prev.updatedAt || 0).getTime();
            const remoteTime = new Date(remoteInfo.updatedAt || 0).getTime();
            if (remoteTime >= localTime || prev.name === DEFAULT_COMPANY_INFO.name) {
              const next = normalizeCompanyInfo({ ...prev, ...remoteInfo });
              safeSetLocalStorage('company_info', next);
              return next;
            }
            return normalizeCompanyInfo(prev);
          });
        }
      }

      setLastCloudSync(new Date());
      setIsSyncing(false);
      return {
        success: true,
        message: 'Données synchronisées avec Cloud Firestore.',
      };
    } catch (err) {
      setIsSyncing(false);
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('quota')) {
        return {
          success: false,
          message,
        };
      }
      setLastCloudSync(new Date());
      return {
        success: true,
        message: 'Stockage local actif.',
      };
    }
  };

  // Hydratation initiale haute capacité depuis IndexedDB (récupère 100 % des données si localStorage a dépassé 5 Mo)
  // suivie de la synchronisation Cloud uniquement dans l'application déployée (jamais dans l'aperçu Démo AI Studio)
  useEffect(() => {
    if (IS_AI_STUDIO_DEMO) {
      return;
    }

    let isMounted = true;
    let lastSyncUpdateTs = 0;
    const markCloudSyncedThrottled = () => {
      const now = Date.now();
      if (now - lastSyncUpdateTs > 10000) {
        lastSyncUpdateTs = now;
        setLastCloudSync(new Date(now));
      }
    };

    const bootHydrateAndSync = async () => {
      try {
        const idbMap = await idbGetAllItems();
        if (isMounted && idbMap && Object.keys(idbMap).length > 0) {
          if (Array.isArray(idbMap.articles?.value) && idbMap.articles.value.length > 0) {
            setArticles((prev) => mergeEntities(prev, sanitizeUniqueList<Article>(idbMap.articles.value)));
          }
          if (Array.isArray(idbMap.warehouses?.value) && idbMap.warehouses.value.length > 0) {
            setWarehouses((prev) => mergeEntities(prev, sanitizeUniqueList<Warehouse>(idbMap.warehouses.value)));
          }
          if (Array.isArray(idbMap.stocks?.value) && idbMap.stocks.value.length > 0) {
            setStocks((prev) => mergeStocks(prev, idbMap.stocks.value));
          }
          if (Array.isArray(idbMap.movements?.value) && idbMap.movements.value.length > 0) {
            setMovements((prev) => mergeEntities(prev, sanitizeUniqueList<StockMovement>(idbMap.movements.value)));
          }
          if (Array.isArray(idbMap.inventories?.value) && idbMap.inventories.value.length > 0) {
            setInventories((prev) => mergeEntities(prev, sanitizeUniqueList<InventorySession>(idbMap.inventories.value)));
          }
          if (Array.isArray(idbMap.customers?.value) && idbMap.customers.value.length > 0) {
            setCustomers((prev) => mergeEntities(prev, sanitizeUniqueList<Customer>(idbMap.customers.value)));
          }
          if (Array.isArray(idbMap.sales?.value) && idbMap.sales.value.length > 0) {
            setSales((prev) => mergeEntities(prev, sanitizeUniqueList<Sale>(idbMap.sales.value)));
          }
          if (Array.isArray(idbMap.payments?.value) && idbMap.payments.value.length > 0) {
            setPayments((prev) => mergeEntities(prev, sanitizeUniqueList<PaymentRecord>(idbMap.payments.value)));
          }
          if (Array.isArray(idbMap.cash_sessions?.value) && idbMap.cash_sessions.value.length > 0) {
            setCashSessions((prev) => mergeEntities(prev, sanitizeUniqueList<CashSession>(idbMap.cash_sessions.value)));
          }
          if (Array.isArray(idbMap.cash_movements?.value) && idbMap.cash_movements.value.length > 0) {
            setCashMovements((prev) => mergeEntities(prev, sanitizeUniqueList<CashMovement>(idbMap.cash_movements.value)));
          }
          if (Array.isArray(idbMap.suppliers?.value) && idbMap.suppliers.value.length > 0) {
            setSuppliers((prev) => mergeEntities(prev, sanitizeUniqueList<Supplier>(idbMap.suppliers.value)));
          }
          if (Array.isArray(idbMap.supplier_orders?.value) && idbMap.supplier_orders.value.length > 0) {
            setSupplierOrders((prev) => mergeEntities(prev, sanitizeUniqueList<SupplierOrder>(idbMap.supplier_orders.value)));
          }
          if (Array.isArray(idbMap.quotes?.value) && idbMap.quotes.value.length > 0) {
            setQuotes((prev) => mergeEntities(prev, sanitizeUniqueList<Quote>(idbMap.quotes.value)));
          }
          if (Array.isArray(idbMap.returns?.value) && idbMap.returns.value.length > 0) {
            setReturns((prev) => mergeEntities(prev, sanitizeUniqueList<SaleReturn>(idbMap.returns.value)));
          }
          if (Array.isArray(idbMap.users?.value) && idbMap.users.value.length > 0) {
            setUsers((prev) => mergeEntities(prev, sanitizeUniqueList<UserProfile>(idbMap.users.value)));
          }
          if (idbMap.company_info?.value && typeof idbMap.company_info.value === 'object') {
            setCompanyInfo((prev) => {
              const idbInfo = idbMap.company_info.value as CompanyInfo;
              const localTime = new Date(prev.updatedAt || 0).getTime();
              const idbTime = new Date(idbInfo.updatedAt || 0).getTime();
              return idbTime >= localTime ? normalizeCompanyInfo({ ...prev, ...idbInfo }) : normalizeCompanyInfo(prev);
            });
          }
        }
      } catch {
        // Ignore IndexedDB hydration error
      }
    };

    bootHydrateAndSync();

    // Écouteurs temps réel Cloud Firestore (onSnapshot) :
    // Toute opération enregistrée sur une machine apparaît instantanément sur toutes les autres machines connectées sans bloquer l'interface.
    const unsubs: Array<() => void> = [
      subscribeToCollection<Article>('articles', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'articles', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setArticles((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<Warehouse>('warehouses', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'warehouses', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setWarehouses((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<WarehouseStock>('stocks', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'stocks', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setStocks((prev) => mergeStocks(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<StockMovement>('movements', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'movements', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setMovements((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<Customer>('customers', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'customers', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setCustomers((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<Sale>('sales', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'sales', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setSales((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<PaymentRecord>('payments', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'payments', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setPayments((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<CashSession>('cashSessions', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'cashSessions', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setCashSessions((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<CashMovement>('cashMovements', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'cashMovements', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setCashMovements((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<InventorySession>('inventories', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'inventories', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setInventories((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<Supplier>('suppliers', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'suppliers', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setSuppliers((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<SupplierOrder>('supplierOrders', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'supplierOrders', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setSupplierOrders((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<Quote>('quotes', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'quotes', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setQuotes((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<SaleReturn>('returns', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'returns', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setReturns((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<UserProfile>('users', (remoteItems) => {
        if (!isMounted) return;
        const clean = filterCloudItemsAfterPurge(remoteItems, 'users', getPurgedTimestamps(), getDeletedIdsMap());
        if (clean.length > 0) {
          setUsers((prev) => mergeEntities(prev, clean));
          markCloudSyncedThrottled();
        }
      }),
      subscribeToCollection<CompanyInfo>('companyInfo', (remoteItems) => {
        if (!isMounted || !remoteItems || remoteItems.length === 0) return;
        const remoteInfo = remoteItems[0];
        if (remoteInfo && remoteInfo.name) {
          setCompanyInfo((prev) => {
            const localTime = new Date(prev.updatedAt || 0).getTime();
            const remoteTime = new Date(remoteInfo.updatedAt || 0).getTime();
            if (remoteTime >= localTime || prev.name === DEFAULT_COMPANY_INFO.name) {
              const next = normalizeCompanyInfo({ ...prev, ...remoteInfo });
              safeSetLocalStorage('company_info', next);
              return next;
            }
            return prev;
          });
        }
      }),
    ];

    return () => {
      isMounted = false;
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
    };
  }, []);

  // Precomputed O(1) lookup maps for instantaneous UI responsiveness
  const articleByIdMap = useMemo(() => {
    const map = new Map<string, Article>();
    for (let i = 0; i < articles.length; i++) {
      map.set(articles[i].id, articles[i]);
    }
    return map;
  }, [articles]);

  const warehouseByIdMap = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (let i = 0; i < warehouses.length; i++) {
      map.set(warehouses[i].id, warehouses[i]);
    }
    return map;
  }, [warehouses]);

  const customerByIdMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (let i = 0; i < customers.length; i++) {
      map.set(customers[i].id, customers[i]);
    }
    return map;
  }, [customers]);

  const saleByIdMap = useMemo(() => {
    const map = new Map<string, Sale>();
    for (let i = 0; i < sales.length; i++) {
      map.set(sales[i].id, sales[i]);
    }
    return map;
  }, [sales]);

  const { stockByArticleAndWarehouseMap, totalStockByArticleMap } = useMemo(() => {
    const activeWhIds = new Set(warehouses.map((w) => w.id));
    const latestRecordByPair = new Map<string, WarehouseStock>();
    for (let i = 0; i < stocks.length; i++) {
      const s = stocks[i];
      if (!s || !s.articleId || !s.warehouseId) continue;
      if (activeWhIds.size > 0 && !activeWhIds.has(s.warehouseId)) continue;
      const pairKey = `${s.articleId}__${s.warehouseId}`;
      const prev = latestRecordByPair.get(pairKey);
      if (!prev) {
        latestRecordByPair.set(pairKey, s);
      } else {
        const prevTime = new Date(prev.updatedAt || prev.lastInventoryDate || 0).getTime();
        const curTime = new Date(s.updatedAt || s.lastInventoryDate || 0).getTime();
        if (curTime >= prevTime) {
          latestRecordByPair.set(pairKey, s);
        }
      }
    }

    const pairMap = new Map<string, number>();
    const totalMap = new Map<string, number>();
    for (const [pairKey, rec] of latestRecordByPair.entries()) {
      const reconciled = reconcileWarehouseStock(rec);
      const qty = Math.max(0, Number(reconciled.quantity) || 0);
      pairMap.set(pairKey, qty);
      totalMap.set(rec.articleId, (totalMap.get(rec.articleId) || 0) + qty);
    }

    return {
      stockByArticleAndWarehouseMap: pairMap,
      totalStockByArticleMap: totalMap,
    };
  }, [stocks, warehouses]);

  // Automatic one-time self-healing for any legacy stocks with duplicate entries or quantity/brandBreakdown mismatch
  const lastHealedStockSigRef = useRef<string>('');
  useEffect(() => {
    if (stocks.length === 0) return;
    const deduped = deduplicateStocksList(stocks);
    let needsHeal = deduped.length !== stocks.length;
    if (!needsHeal) {
      for (let i = 0; i < stocks.length; i++) {
        if (deduped[i] !== stocks[i]) {
          needsHeal = true;
          break;
        }
      }
    }
    if (!needsHeal) return;

    const sig = deduped.map((s) => `${s.articleId}_${s.warehouseId}:${s.quantity}`).join('|');
    if (lastHealedStockSigRef.current === sig) return;
    lastHealedStockSigRef.current = sig;

    const nowIso = new Date().toISOString();
    const prevMap = new Map(stocks.map((s) => [`${s.articleId}__${s.warehouseId}`, s]));
    const changedRecords: WarehouseStock[] = [];
    const healedStocks = deduped.map((s) => {
      const prev = prevMap.get(`${s.articleId}__${s.warehouseId}`);
      if (prev !== s) {
        const stamped = { ...s, updatedAt: nowIso };
        changedRecords.push(stamped);
        return stamped;
      }
      return s;
    });

    setStocks(healedStocks);
    safeSetLocalStorage('stocks', healedStocks);
    if (changedRecords.length > 0) {
      saveMultipleStocksToFirebase(changedRecords).catch(console.warn);
    }
  }, [stocks]);

  // Stock Getters (O(1) lookups)
  const getStockForArticleAndWarehouse = useCallback(
    (articleId: string, warehouseId: string): number => {
      return stockByArticleAndWarehouseMap.get(`${articleId}__${warehouseId}`) || 0;
    },
    [stockByArticleAndWarehouseMap]
  );

  const getTotalStockForArticle = useCallback(
    (articleId: string): number => {
      return totalStockByArticleMap.get(articleId) || 0;
    },
    [totalStockByArticleMap]
  );

  const getStockValueTotal = useCallback(
    (warehouseId?: string | null): number => {
      let total = 0;
      for (let i = 0; i < stocks.length; i++) {
        const s = stocks[i];
        if (warehouseId && s.warehouseId !== warehouseId) continue;
        if (s.quantity <= 0) continue;
        const art = articleByIdMap.get(s.articleId);
        if (!art) continue;
        total += s.quantity * art.purchasePrice;
      }
      return total;
    },
    [stocks, articleByIdMap]
  );

  const getSaleValueTotal = useCallback(
    (warehouseId?: string | null): number => {
      let total = 0;
      for (let i = 0; i < stocks.length; i++) {
        const s = stocks[i];
        if (warehouseId && s.warehouseId !== warehouseId) continue;
        if (s.quantity <= 0) continue;
        const art = articleByIdMap.get(s.articleId);
        if (!art) continue;
        total += s.quantity * art.salePrice;
      }
      return total;
    },
    [stocks, articleByIdMap]
  );

  const getArticleById = useCallback(
    (id: string): Article | undefined => {
      return articleByIdMap.get(id);
    },
    [articleByIdMap]
  );

  const getWarehouseById = useCallback(
    (id: string): Warehouse | undefined => {
      return warehouseByIdMap.get(id);
    },
    [warehouseByIdMap]
  );

  const getCustomerById = useCallback(
    (id: string): Customer | undefined => {
      return customerByIdMap.get(id);
    },
    [customerByIdMap]
  );

  const getSaleById = useCallback(
    (id: string): Sale | undefined => {
      return saleByIdMap.get(id);
    },
    [saleByIdMap]
  );

  // La caisse est globale / centralisée au guichet (indépendante des dépôts de stockage)
  const getActiveCashSession = (_warehouseId?: string): CashSession | undefined => {
    return cashSessions.find((s) => s.status === 'OPEN');
  };

  const getCashMovementsForSession = (sessionId: string): CashMovement[] => {
    return cashMovements
      .filter((m) => m.cashSessionId === sessionId)
      .map((m) => {
        if (m.saleId) {
          const linkedSale = saleByIdMap.get(m.saleId);
          if (linkedSale && linkedSale.date && linkedSale.date !== m.date) {
            return { ...m, date: linkedSale.date };
          }
        }
        return m;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Memoized alerts calculation so calling getAlerts() across multiple components costs 0ms
  const memoizedAlerts = useMemo<StockAlert[]>(() => {
    const alerts: StockAlert[] = [];
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      if (art.status !== 'active') continue;
      const currentStock = totalStockByArticleMap.get(art.id) || 0;
      const isOutOfStock = currentStock === 0;
      const isUnderThreshold = currentStock > 0 && currentStock <= art.minStockThreshold;

      if (isOutOfStock || isUnderThreshold) {
        const warehousesWithStock: Array<{ warehouseName: string; qty: number }> = [];
        for (let wIdx = 0; wIdx < warehouses.length; wIdx++) {
          const w = warehouses[wIdx];
          const qty = stockByArticleAndWarehouseMap.get(`${art.id}__${w.id}`) || 0;
          if (qty > 0) {
            warehousesWithStock.push({ warehouseName: w.name, qty });
          }
        }

        alerts.push({
          articleId: art.id,
          mainReference: art.mainReference,
          designation: art.designation,
          brand: art.brand,
          category: art.category,
          currentStock,
          minThreshold: art.minStockThreshold,
          deficit: Math.max(0, art.minStockThreshold - currentStock),
          alertType: isOutOfStock ? 'RUPTURE' : 'SOUS_SEUIL',
          warehousesWithStock,
        });
      }
    }

    return alerts.sort((a, b) => {
      if (a.alertType === 'RUPTURE' && b.alertType !== 'RUPTURE') return -1;
      if (b.alertType === 'RUPTURE' && a.alertType !== 'RUPTURE') return 1;
      return b.deficit - a.deficit;
    });
  }, [articles, warehouses, totalStockByArticleMap, stockByArticleAndWarehouseMap]);

  const getAlerts = useCallback((): StockAlert[] => {
    return memoizedAlerts;
  }, [memoizedAlerts]);

  // Helper to adjust stock in a specific warehouse (keeps brandBreakdown strictly synchronized with quantity)
  const applyStockDelta = (
    currentStocks: WarehouseStock[],
    articleId: string,
    warehouseId: string,
    delta: number,
    brand?: string
  ): WarehouseStock[] => {
    const nowIso = new Date().toISOString();
    const art = articleByIdMap.get(articleId) || articles.find((a) => a.id === articleId);
    const fallbackBrand = (
      brand ||
      art?.brand ||
      art?.brandOffers?.[0]?.brand ||
      ''
    ).trim();

    const existingIndex = currentStocks.findIndex(
      (s) => s.articleId === articleId && s.warehouseId === warehouseId
    );

    if (existingIndex >= 0) {
      const updated = [...currentStocks];
      const prev = reconcileWarehouseStock(updated[existingIndex]);
      const prevQty = Math.max(0, Number(prev.quantity) || 0);
      const newQty = Math.max(0, prevQty + delta);
      const nextBreakdown: Record<string, number> = { ...(prev.brandBreakdown || {}) };

      // Ensure breakdown sum matches prevQty before applying delta
      const existingKeys = Object.keys(nextBreakdown);
      const currentBdSum = existingKeys.reduce(
        (acc, k) => acc + Math.max(0, Number(nextBreakdown[k]) || 0),
        0
      );
      if (currentBdSum < prevQty) {
        const matchKey =
          existingKeys.find(
            (k) => k.toLowerCase().trim() === fallbackBrand.toLowerCase().trim()
          ) || fallbackBrand;
        nextBreakdown[matchKey] =
          (Math.max(0, Number(nextBreakdown[matchKey]) || 0)) + (prevQty - currentBdSum);
      }

      if (delta > 0) {
        const bKey =
          Object.keys(nextBreakdown).find(
            (k) => k.toLowerCase().trim() === fallbackBrand.toLowerCase().trim()
          ) || fallbackBrand;
        nextBreakdown[bKey] = (Math.max(0, Number(nextBreakdown[bKey]) || 0)) + delta;
      } else if (delta < 0) {
        let toDeduct = Math.min(prevQty, Math.abs(delta));
        const targetKey = Object.keys(nextBreakdown).find(
          (k) => k.toLowerCase().trim() === fallbackBrand.toLowerCase().trim()
        );
        if (targetKey !== undefined) {
          const avail = Math.max(0, Number(nextBreakdown[targetKey]) || 0);
          const take = Math.min(avail, toDeduct);
          nextBreakdown[targetKey] = avail - take;
          toDeduct -= take;
        }
        if (toDeduct > 0) {
          for (const k of Object.keys(nextBreakdown)) {
            if (toDeduct <= 0) break;
            const avail = Math.max(0, Number(nextBreakdown[k]) || 0);
            if (avail > 0) {
              const take = Math.min(avail, toDeduct);
              nextBreakdown[k] = avail - take;
              toDeduct -= take;
            }
          }
        }
        if (newQty === 0) {
          for (const k of Object.keys(nextBreakdown)) {
            nextBreakdown[k] = 0;
          }
        }
      }

      updated[existingIndex] = {
        ...prev,
        quantity: newQty,
        brandBreakdown: nextBreakdown,
        lastInventoryDate: nowIso,
        updatedAt: nowIso,
      };
      return updated;
    } else {
      const initialQty = Math.max(0, delta);
      return [
        ...currentStocks,
        {
          articleId,
          warehouseId,
          quantity: initialQty,
          brandBreakdown: { [fallbackBrand]: initialQty },
          shelfLocation: 'Non renseigné',
          lastInventoryDate: nowIso,
          updatedAt: nowIso,
        },
      ];
    }
  };

  // Customer Management
  const createCustomer = (
    customerData: Omit<Customer, 'id' | 'createdAt' | 'outstandingBalance'> & {
      outstandingBalance?: number;
    }
  ) => {
    const rawCode = (customerData.code || '').trim().toUpperCase();
    const code = rawCode || getNextCustomerCode(customers);
    const exists = customers.some((c) => (c.code || '').trim().toUpperCase() === code);
    if (exists) {
      return { success: false, error: `Le code client "${code}" existe déjà.` };
    }

    const newId = generateCustomerId(customers.length);
    const newCustomer: Customer = {
      ...customerData,
      id: newId,
      code,
      name: customerData.name.trim(),
      outstandingBalance: Math.max(0, Number(customerData.outstandingBalance) || 0),
      depositBalance: Math.max(0, Number(customerData.depositBalance) || 0),
      createdAt: new Date().toISOString(),
    };

    const next = [newCustomer, ...customers];
    setCustomers(next);
    safeSetLocalStorage('customers', next);
    saveCustomerToFirebase(newCustomer).catch(console.warn);
    return { success: true, customer: newCustomer };
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const existing = customers.find((c) => c.id === id);
    if (!existing) return { success: false, error: 'Client introuvable.' };

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const next = customers.map((c) => (c.id === id ? updated : c));
    setCustomers(next);
    safeSetLocalStorage('customers', next);
    saveCustomerToFirebase(updated).catch(console.warn);
    return { success: true };
  };

  const deleteCustomer = (id: string) => {
    const existing = customers.find((c) => c.id === id);
    if (!existing) return { success: false, error: 'Client introuvable.' };

    markIdsDeleted('customers', [id]);
    const next = customers.filter((c) => c.id !== id);
    setCustomers(next);
    safeSetLocalStorage('customers', next);
    deleteCustomerFromFirebase(id).catch(console.warn);
    return {
      success: true,
      message: `Le client "${existing.code} — ${existing.name}" a été définitivement supprimé.`,
    };
  };

  const importCustomers = (
    rows: Array<{
      code?: string;
      name: string;
      phone?: string;
      address?: string;
      email?: string;
      creditLimit?: number;
      outstandingBalance?: number;
      depositBalance?: number;
      notes?: string;
    }>
  ) => {
    const nowIso = new Date().toISOString();
    const nextCustomers = [...customers];
    const touchedCustomers: Customer[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const cleanName = (row.name || '').trim();
      if (!cleanName) {
        skippedCount += 1;
        continue;
      }

      const rawCode = (row.code || '').trim().toUpperCase();
      const cleanPhone = (row.phone || '').trim();
      const cleanEmail = (row.email || '').trim();
      const cleanAddress = (row.address || '').trim();
      const cleanNotes = (row.notes || '').trim();

      // Match existing customer by code or exact name
      const existingIdx = nextCustomers.findIndex(
        (c) =>
          (rawCode && c.code.toUpperCase() === rawCode) ||
          c.name.trim().toLowerCase() === cleanName.toLowerCase()
      );

      if (existingIdx >= 0) {
        const prev = nextCustomers[existingIdx];
        const updated: Customer = {
          ...prev,
          name: cleanName || prev.name,
          phone: cleanPhone || prev.phone,
          address: cleanAddress || prev.address,
          email: cleanEmail || prev.email,
          notes: cleanNotes || prev.notes,
          creditLimit:
            row.creditLimit !== undefined && Number.isFinite(row.creditLimit) && row.creditLimit >= 0
              ? row.creditLimit
              : prev.creditLimit,
          outstandingBalance:
            row.outstandingBalance !== undefined &&
            Number.isFinite(row.outstandingBalance) &&
            row.outstandingBalance >= 0
              ? row.outstandingBalance
              : prev.outstandingBalance,
          depositBalance:
            row.depositBalance !== undefined &&
            Number.isFinite(row.depositBalance) &&
            row.depositBalance >= 0
              ? row.depositBalance
              : prev.depositBalance,
          updatedAt: nowIso,
        };
        nextCustomers[existingIdx] = updated;
        touchedCustomers.push(updated);
        updatedCount += 1;
      } else {
        let codeToUse = rawCode;
        if (
          !codeToUse ||
          nextCustomers.some((c) => (c.code || '').trim().toUpperCase() === codeToUse)
        ) {
          codeToUse = getNextCustomerCode(nextCustomers);
        }

        const newCust: Customer = {
          id: generateCustomerId(nextCustomers.length),
          code: codeToUse,
          name: cleanName,
          phone: cleanPhone || undefined,
          address: cleanAddress || undefined,
          email: cleanEmail || undefined,
          creditLimit:
            row.creditLimit !== undefined && Number.isFinite(row.creditLimit) && row.creditLimit >= 0
              ? row.creditLimit
              : 1000000,
          outstandingBalance:
            row.outstandingBalance !== undefined &&
            Number.isFinite(row.outstandingBalance) &&
            row.outstandingBalance >= 0
              ? row.outstandingBalance
              : 0,
          depositBalance:
            row.depositBalance !== undefined &&
            Number.isFinite(row.depositBalance) &&
            row.depositBalance >= 0
              ? row.depositBalance
              : 0,
          notes: cleanNotes || undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextCustomers.unshift(newCust);
        touchedCustomers.push(newCust);
        createdCount += 1;
      }
    }

    setCustomers(nextCustomers);
    safeSetLocalStorage('customers', nextCustomers);
    if (touchedCustomers.length > 0) {
      saveMultipleCustomersToFirebase(touchedCustomers).catch(console.warn);
    }

    return {
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      totalProcessed: createdCount + updatedCount,
    };
  };

  // Helper: recalcule le solde théorique espèces (et écart si clôturée) des sessions de caisse impactées
  const syncCashSessionsTheoreticalBalance = (
    affectedSessionIds: Set<string>,
    movementsSnapshot: CashMovement[]
  ) => {
    if (affectedSessionIds.size === 0) return;
    setCashSessions((prevSessions) => {
      let anyChanged = false;
      const updatedSessionsToSave: CashSession[] = [];
      const nextSessions = prevSessions.map((session) => {
        if (!affectedSessionIds.has(session.id)) return session;
        const sessionMvts = movementsSnapshot.filter((m) => m.cashSessionId === session.id);
        let cashIn = 0;
        let cashOut = 0;
        for (const m of sessionMvts) {
          if (!m.isCashInDrawer) continue;
          const isInitMvt =
            m.id.startsWith('CSM-INIT') ||
            m.reason === 'Fond de caisse initial à l’ouverture';
          if (m.direction === 'IN' && !isInitMvt) {
            cashIn += m.amount;
          } else if (m.direction === 'OUT') {
            cashOut += m.amount;
          }
        }
        const newTheoretical = Math.max(0, session.initialCashFloat + cashIn - cashOut);
        const newVariance =
          session.status === 'CLOSED' && session.countedCash !== null
            ? session.countedCash - newTheoretical
            : 0;
        if (
          session.theoreticalCash !== newTheoretical ||
          session.cashVariance !== newVariance
        ) {
          anyChanged = true;
          const updatedSession: CashSession = {
            ...session,
            theoreticalCash: newTheoretical,
            cashVariance: newVariance,
          };
          updatedSessionsToSave.push(updatedSession);
          return updatedSession;
        }
        return session;
      });
      if (anyChanged) {
        safeSetLocalStorage('cash_sessions', nextSessions);
        updatedSessionsToSave.forEach((s) => saveCashSessionToFirebase(s).catch(console.warn));
      }
      return nextSessions;
    });
  };

  // Customer payment & advance management (Règlements de créances & Acomptes clients)
  const recordCustomerPayment = (params: {
    customerId: string;
    type: 'REGLEMENT_CREANCE' | 'ACOMPTE_AVANCE';
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
    customDate?: string;
  }): { success: boolean; error?: string; payment?: PaymentRecord } => {
    const customer = customers.find((c) => c.id === params.customerId);
    if (!customer) return { success: false, error: 'Compte client introuvable.' };

    if (!params.amount || params.amount <= 0 || !Number.isFinite(params.amount)) {
      return { success: false, error: 'Le montant payé doit être un nombre strictement supérieur à zéro.' };
    }

    const wh = warehouses.find((w) => w.id === params.warehouseId);
    if (!wh) return { success: false, error: 'Magasin d\'encaissement introuvable.' };

    const activeSession = getActiveCashSession(params.warehouseId);
    const nowIso = new Date().toISOString();
    let paymentDateIso = nowIso;
    if (params.customDate && params.customDate.trim()) {
      const rawDate = params.customDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const timePart = new Date().toTimeString().split(' ')[0] || '12:00:00';
        const parsed = new Date(`${rawDate}T${timePart}`);
        if (!Number.isNaN(parsed.getTime())) {
          paymentDateIso = parsed.toISOString();
        }
      } else {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
          paymentDateIso = parsed.toISOString();
        }
      }
    }

    const paymentId = generatePaymentId();

    const isAcompte = params.type === 'ACOMPTE_AVANCE';
    const paymentTypeLabel = isAcompte ? 'ACOMPTE_CLIENT' : 'REGLEMENT_CREANCE';
    const defaultReason = isAcompte
      ? `Acompte / Avance sur commande (${customer.name})`
      : `Règlement créance (${customer.name})`;

    const newPayment: PaymentRecord = {
      id: paymentId,
      date: paymentDateIso,
      customerId: params.customerId,
      customerName: customer.name,
      paymentType: paymentTypeLabel,
      cashSessionId: activeSession?.id,
      warehouseId: params.warehouseId,
      method: params.method,
      amount: params.amount,
      userId: currentUser.id,
      userName: currentUser.name,
      reference: params.reference?.trim() || `${paymentId}`,
      notes: params.notes?.trim() || defaultReason,
    };

    const nextPayments = [newPayment, ...payments];
    setPayments(nextPayments);
    safeSetLocalStorage('payments', nextPayments);
    savePaymentToFirebase(newPayment).catch(console.warn);

    // Recalculer strictement le montant de la créance = Somme des achats (à crédit) - Somme des acomptes
    const creditSummary = getCustomerCreditSummary(customer, sales, nextPayments);
    const updatedCustomerRecord: Customer = {
      ...customer,
      outstandingBalance: creditSummary.creance,
      depositBalance: creditSummary.avanceDisponible,
      updatedAt: nowIso,
    };
    const nextCustomers = customers.map((c) =>
      c.id === params.customerId ? updatedCustomerRecord : c
    );
    setCustomers(nextCustomers);
    safeSetLocalStorage('customers', nextCustomers);
    saveCustomerToFirebase(updatedCustomerRecord).catch(console.warn);

    // Record cash movement if cash session is active
    if (activeSession) {
      const isDrawerCash = params.method === 'ESPECES';
      const csmId = generateCashMovementId();
      const newCashMvt: CashMovement = {
        id: csmId,
        cashSessionId: activeSession.id,
        warehouseId: params.warehouseId,
        date: paymentDateIso,
        type: isAcompte ? 'ACOMPTE_CLIENT' : 'REGLEMENT_CREANCE',
        method: params.method,
        amount: params.amount,
        isCashInDrawer: isDrawerCash,
        direction: 'IN',
        reason: `${defaultReason} - ${params.method}`,
        customerId: customer.id,
        documentRef: paymentId,
        userId: currentUser.id,
        userName: currentUser.name,
        notes: params.notes?.trim(),
      };

      const nextCashMovements = [newCashMvt, ...cashMovements];
      setCashMovements(nextCashMovements);
      safeSetLocalStorage('cash_movements', nextCashMovements);
      saveCashMovementToFirebase(newCashMvt).catch(console.warn);

      if (isDrawerCash) {
        syncCashSessionsTheoreticalBalance(new Set([activeSession.id]), nextCashMovements);
      }
    }

    return { success: true, payment: newPayment };
  };

  const recordCustomerDebtPayment = (params: {
    customerId: string;
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
    customDate?: string;
  }) => {
    return recordCustomerPayment({ ...params, type: 'REGLEMENT_CREANCE' });
  };

  const updateCustomerPayment = (
    paymentId: string,
    updates: {
      date?: string;
      amount?: number;
      method?: PaymentMethod;
      reference?: string;
      notes?: string;
    }
  ): { success: boolean; error?: string } => {
    const targetPay = payments.find((p) => p.id === paymentId);
    if (!targetPay) {
      return { success: false, error: 'Acompte / règlement introuvable.' };
    }
    if (updates.amount !== undefined && (updates.amount <= 0 || !Number.isFinite(updates.amount))) {
      return { success: false, error: 'Le montant doit être supérieur à zéro.' };
    }

    let nextDateIso = targetPay.date;
    if (updates.date && updates.date.trim()) {
      const rawDate = updates.date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const existingTime = new Date(targetPay.date).toTimeString().split(' ')[0] || '12:00:00';
        const parsed = new Date(`${rawDate}T${existingTime}`);
        if (!Number.isNaN(parsed.getTime())) {
          nextDateIso = parsed.toISOString();
        }
      } else {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
          nextDateIso = parsed.toISOString();
        }
      }
    }

    const updatedPayment: PaymentRecord = {
      ...targetPay,
      date: nextDateIso,
      amount: updates.amount !== undefined ? Number(updates.amount) : targetPay.amount,
      method: updates.method || targetPay.method,
      reference: updates.reference !== undefined ? updates.reference.trim() : targetPay.reference,
      notes: updates.notes !== undefined ? updates.notes.trim() : targetPay.notes,
    };

    const nowIso = new Date().toISOString();
    const nextPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));
    setPayments(nextPayments);
    safeSetLocalStorage('payments', nextPayments);
    savePaymentToFirebase(updatedPayment).catch(console.warn);

    // Synchroniser l'écriture correspondante dans le journal des flux de caisse (pour les acomptes / règlements autonomes)
    if (!targetPay.saleId) {
      const affectedSessionIds = new Set<string>();
      const updatedCashMvtsToSave: CashMovement[] = [];
      const customerName =
        targetPay.customerName ||
        customers.find((c) => c.id === targetPay.customerId)?.name ||
        'Client';
      const isAcompte = updatedPayment.paymentType === 'ACOMPTE_CLIENT';
      const baseReason = isAcompte
        ? `Acompte / Avance sur commande (${customerName})`
        : `Règlement créance (${customerName})`;

      const nextCashMovements = cashMovements.map((cm) => {
        if (cm.documentRef !== paymentId) return cm;
        affectedSessionIds.add(cm.cashSessionId);
        const updatedMvt: CashMovement = {
          ...cm,
          date: updatedPayment.date,
          amount: updatedPayment.amount,
          method: updatedPayment.method,
          isCashInDrawer: updatedPayment.method === 'ESPECES',
          reason: `${baseReason} - ${updatedPayment.method}`,
          notes: updatedPayment.notes,
        };
        updatedCashMvtsToSave.push(updatedMvt);
        return updatedMvt;
      });

      if (updatedCashMvtsToSave.length > 0) {
        setCashMovements(nextCashMovements);
        safeSetLocalStorage('cash_movements', nextCashMovements);
        updatedCashMvtsToSave.forEach((m) => saveCashMovementToFirebase(m).catch(console.warn));
        syncCashSessionsTheoreticalBalance(affectedSessionIds, nextCashMovements);
      }
    }

    // If linked to a sale (initial acompte), update the sale's date/totalPaid if amount changed
    let nextSales = sales;
    if (targetPay.saleId) {
      nextSales = sales.map((s) => {
        if (s.id !== targetPay.saleId) return s;
        const salePaymentsSum = nextPayments
          .filter((p) => p.saleId === s.id)
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const netSaleAmt = getNetSaleAmount(s);
        const newRemaining = Math.max(0, netSaleAmt - salePaymentsSum);
        const updatedSale: Sale = {
          ...s,
          totalPaid: salePaymentsSum,
          remainingDue: newRemaining,
          paymentStatus:
            newRemaining <= 0 ? 'PAID' : salePaymentsSum > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        };
        saveSaleToFirebase(updatedSale).catch(console.warn);
        return updatedSale;
      });
      setSales(nextSales);
      safeSetLocalStorage('sales', nextSales);
    }

    if (targetPay.customerId) {
      setCustomers((prev) => {
        const nextCusts = prev.map((c) => {
          if (c.id !== targetPay.customerId) return c;
          const summary = getCustomerCreditSummary(c, nextSales, nextPayments);
          const updated: Customer = {
            ...c,
            outstandingBalance: summary.creance,
            depositBalance: summary.avanceDisponible,
            updatedAt: nowIso,
          };
          saveCustomerToFirebase(updated).catch(console.warn);
          return updated;
        });
        safeSetLocalStorage('customers', nextCusts);
        return nextCusts;
      });
    }

    return { success: true };
  };

  const deleteCustomerPayment = (paymentId: string): { success: boolean; error?: string } => {
    const targetPay = payments.find((p) => p.id === paymentId);
    if (!targetPay) {
      return { success: false, error: 'Acompte / règlement introuvable.' };
    }
    if (targetPay.saleId) {
      return {
        success: false,
        error: 'Cet acompte a été encaissé lors de la création de la facture. Modifiez ou annulez la facture directement.',
      };
    }

    const nowIso = new Date().toISOString();
    const nextPayments = payments.filter((p) => p.id !== paymentId);
    markIdsDeleted('payments', [paymentId]);
    setPayments(nextPayments);
    safeSetLocalStorage('payments', nextPayments);
    deletePaymentsFromFirebase([paymentId]).catch(console.warn);

    const linkedCashMvtObjs = cashMovements.filter((cm) => cm.documentRef === paymentId);
    const linkedCashMvts = linkedCashMvtObjs.map((cm) => cm.id);
    if (linkedCashMvts.length > 0) {
      const affectedSessionIds = new Set(linkedCashMvtObjs.map((cm) => cm.cashSessionId));
      markIdsDeleted('cashMovements', linkedCashMvts);
      const nextCashMovements = cashMovements.filter((cm) => cm.documentRef !== paymentId);
      setCashMovements(nextCashMovements);
      safeSetLocalStorage('cash_movements', nextCashMovements);
      deleteCashMovementsFromFirebase(linkedCashMvts).catch(console.warn);
      syncCashSessionsTheoreticalBalance(affectedSessionIds, nextCashMovements);
    }

    if (targetPay.customerId) {
      setCustomers((prev) => {
        const nextCusts = prev.map((c) => {
          if (c.id !== targetPay.customerId) return c;
          const summary = getCustomerCreditSummary(c, sales, nextPayments);
          const updated: Customer = {
            ...c,
            outstandingBalance: summary.creance,
            depositBalance: summary.avanceDisponible,
            updatedAt: nowIso,
          };
          saveCustomerToFirebase(updated).catch(console.warn);
          return updated;
        });
        safeSetLocalStorage('customers', nextCusts);
        return nextCusts;
      });
    }

    return { success: true };
  };

  const adjustCustomerDebt = (params: {
    customerId: string;
    mode: 'SET_TARGET' | 'DELTA';
    value: number;
    date?: string;
    reason: string;
  }): { success: boolean; error?: string } => {
    const customer = customers.find((c) => c.id === params.customerId);
    if (!customer) {
      return { success: false, error: 'Compte client introuvable.' };
    }
    if (!Number.isFinite(params.value)) {
      return { success: false, error: 'Montant invalide.' };
    }

    const currentSummary = getCustomerCreditSummary(customer, sales, payments);
    const currentCreance = currentSummary.creance;

    // En mode SET_TARGET, on calcule la variation nécessaire pour que (Somme Achats + Ajustements) - Somme Acomptes = targetCreance
    let deltaAmount = 0;
    let targetDebt = currentCreance;
    if (params.mode === 'SET_TARGET') {
      if (params.value < 0) {
        return { success: false, error: 'Le montant de la créance ne peut pas être négatif.' };
      }
      targetDebt = Math.round(params.value);
      // Pour que totalPurchases - totalAcomptes = targetDebt, il faut que newTotalPurchases = totalAcomptes + targetDebt
      const desiredTotalPurchases = currentSummary.totalAcomptes + targetDebt;
      const currentRawPurchases = currentSummary.salesPurchasesTotal + currentSummary.totalAdjustments;
      deltaAmount = desiredTotalPurchases - currentRawPurchases;
    } else {
      deltaAmount = Math.round(params.value);
      targetDebt = Math.max(0, currentCreance + deltaAmount);
    }

    if (deltaAmount === 0) {
      return { success: false, error: 'Aucun changement de créance détecté (écart de 0 FCFA).' };
    }

    const nowIso = new Date().toISOString();
    let adjDateIso = nowIso;
    if (params.date && params.date.trim()) {
      const rawDate = params.date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const timePart = new Date().toTimeString().split(' ')[0] || '12:00:00';
        const parsed = new Date(`${rawDate}T${timePart}`);
        if (!Number.isNaN(parsed.getTime())) {
          adjDateIso = parsed.toISOString();
        }
      } else {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
          adjDateIso = parsed.toISOString();
        }
      }
    }

    const newAdjustment = {
      id: `ADJ-${Date.now().toString().slice(-6)}`,
      date: adjDateIso,
      amount: deltaAmount,
      previousDebt: currentCreance,
      newDebt: targetDebt,
      reason: params.reason.trim() || (deltaAmount > 0 ? 'Ajustement créance (+)' : 'Réduction / Remise sur créance (-)'),
      userId: currentUser.id,
      userName: currentUser.name,
    };

    const nextAdjustments = [newAdjustment, ...(customer.debtAdjustments || [])];
    const tempCustomer: Customer = {
      ...customer,
      debtAdjustments: nextAdjustments,
    };
    const nextSummary = getCustomerCreditSummary(tempCustomer, sales, payments);
    const updatedCustomer: Customer = {
      ...tempCustomer,
      outstandingBalance: nextSummary.creance,
      depositBalance: nextSummary.avanceDisponible,
      updatedAt: nowIso,
    };

    const nextCustomers = customers.map((c) => (c.id === customer.id ? updatedCustomer : c));
    setCustomers(nextCustomers);
    safeSetLocalStorage('customers', nextCustomers);
    saveCustomerToFirebase(updatedCustomer).catch(console.warn);

    return { success: true };
  };

  const deleteCustomerDebtAdjustment = (
    customerId: string,
    adjustmentId: string
  ): { success: boolean; error?: string } => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      return { success: false, error: 'Compte client introuvable.' };
    }
    const nowIso = new Date().toISOString();
    const nextAdjustments = (customer.debtAdjustments || []).filter((a) => a.id !== adjustmentId);
    const tempCustomer: Customer = {
      ...customer,
      debtAdjustments: nextAdjustments,
    };
    const nextSummary = getCustomerCreditSummary(tempCustomer, sales, payments);
    const updatedCustomer: Customer = {
      ...tempCustomer,
      outstandingBalance: nextSummary.creance,
      depositBalance: nextSummary.avanceDisponible,
      updatedAt: nowIso,
    };

    const nextCustomers = customers.map((c) => (c.id === customer.id ? updatedCustomer : c));
    setCustomers(nextCustomers);
    safeSetLocalStorage('customers', nextCustomers);
    saveCustomerToFirebase(updatedCustomer).catch(console.warn);

    return { success: true };
  };

  // Réconciliation automatique stricte :
  // Montant de la créance = Somme des achats (à crédit, hors achats payés directement) - Somme des acomptes
  useEffect(() => {
    setCustomers((prev) => {
      let hasChanged = false;
      const updatedList: Customer[] = [];
      const toSaveInCloud: Customer[] = [];

      for (const c of prev) {
        const summary = getCustomerCreditSummary(c, sales, payments);
        const curDebt = Number(c.outstandingBalance) || 0;
        const curDeposit = Number(c.depositBalance) || 0;
        if (curDebt !== summary.creance || curDeposit !== summary.avanceDisponible) {
          hasChanged = true;
          const updatedCustomer: Customer = {
            ...c,
            outstandingBalance: summary.creance,
            depositBalance: summary.avanceDisponible,
          };
          updatedList.push(updatedCustomer);
          toSaveInCloud.push(updatedCustomer);
        } else {
          updatedList.push(c);
        }
      }

      if (!hasChanged) return prev;
      safeSetLocalStorage('customers', updatedList);
      toSaveInCloud.forEach((u) => saveCustomerToFirebase(u).catch(() => {}));
      return updatedList;
    });
  }, [sales, payments]);

  // Cash Register Management (Centralized Counter Cash Register — Independent of Warehouses)
  const openCashSession = (params: {
    warehouseId?: string;
    initialCashFloat: number;
    notes?: string;
  }) => {
    // Prevent multiple active sessions globally
    const alreadyOpen = cashSessions.find((s) => s.status === 'OPEN');
    if (alreadyOpen) {
      return {
        success: false,
        error: `Une session de caisse (${alreadyOpen.id}) est déjà ouverte. Veuillez la clôturer d’abord.`,
      };
    }

    if (params.initialCashFloat < 0) {
      return { success: false, error: 'Le fond de caisse initial ne peut pas être négatif.' };
    }

    const sessionId = generateCashSessionId();
    const nowIso = new Date().toISOString();
    const centralId = 'caisse_principale';
    const centralName = 'Caisse Principale (Guichet)';

    const newSession: CashSession = {
      id: sessionId,
      warehouseId: centralId,
      warehouseName: centralName,
      openedAt: nowIso,
      openedByUserId: currentUser.id,
      openedByUserName: currentUser.name,
      initialCashFloat: params.initialCashFloat,
      status: 'OPEN',
      countedCash: null,
      theoreticalCash: params.initialCashFloat,
      cashVariance: 0,
      notes: params.notes?.trim(),
    };

    const initialMvt: CashMovement = {
      id: generateCashMovementId('CSM-INIT'),
      cashSessionId: sessionId,
      warehouseId: centralId,
      date: nowIso,
      type: 'APPORT_ESPECES',
      method: 'ESPECES',
      amount: params.initialCashFloat,
      isCashInDrawer: true,
      direction: 'IN',
      reason: 'Fond de caisse initial à l’ouverture',
      userId: currentUser.id,
      userName: currentUser.name,
    };

    const nextSessions = [newSession, ...cashSessions];
    setCashSessions(nextSessions);
    safeSetLocalStorage('cash_sessions', nextSessions);
    saveCashSessionToFirebase(newSession).catch(console.warn);

    if (params.initialCashFloat > 0) {
      const nextMvts = [initialMvt, ...cashMovements];
      setCashMovements(nextMvts);
      safeSetLocalStorage('cash_movements', nextMvts);
      saveCashMovementToFirebase(initialMvt).catch(console.warn);
    }

    return { success: true, session: newSession };
  };

  const closeCashSession = (params: {
    sessionId: string;
    countedCash: number;
    varianceJustification?: string;
    notes?: string;
  }) => {
    const session = cashSessions.find((s) => s.id === params.sessionId);
    if (!session) return { success: false, error: 'Session de caisse introuvable.' };
    if (session.status === 'CLOSED') {
      return { success: false, error: 'Cette session de caisse est déjà clôturée.' };
    }

    if (params.countedCash < 0 || !Number.isFinite(params.countedCash)) {
      return { success: false, error: 'Le montant physique compté doit être supérieur ou égal à zéro.' };
    }

    // Recalculate exact theoretical cash from session movements before closing
    const sessionMvts = cashMovements.filter((m) => m.cashSessionId === session.id);
    let cashIn = 0;
    let cashOut = 0;
    for (const m of sessionMvts) {
      if (!m.isCashInDrawer) continue;
      if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') cashIn += m.amount;
      else if (m.direction === 'IN' && m.type === 'APPORT_ESPECES' && !m.id.startsWith('CSM-INIT')) {
        cashIn += m.amount;
      } else if (m.direction === 'OUT') {
        cashOut += m.amount;
      }
    }
    const theoretical = Math.max(0, session.initialCashFloat + cashIn - cashOut);
    const variance = params.countedCash - theoretical;

    if (variance !== 0 && !params.varianceJustification?.trim()) {
      return {
        success: false,
        error: `Un écart de caisse de ${variance > 0 ? '+' : ''}${variance.toLocaleString()} FCFA a été constaté. Une justification explicite est obligatoire.`,
      };
    }

    const nowIso = new Date().toISOString();
    const updatedSession: CashSession = {
      ...session,
      status: 'CLOSED' as const,
      closedAt: nowIso,
      closedByUserId: currentUser.id,
      closedByUserName: currentUser.name,
      theoreticalCash: theoretical,
      countedCash: params.countedCash,
      cashVariance: variance,
      varianceJustification: params.varianceJustification?.trim(),
      notes: params.notes?.trim() || session.notes,
    };

    const nextSessions = cashSessions.map((s) => (s.id === params.sessionId ? updatedSession : s));
    setCashSessions(nextSessions);
    safeSetLocalStorage('cash_sessions', nextSessions);
    saveCashSessionToFirebase(updatedSession).catch(console.warn);

    return { success: true };
  };

  // Réouverture d'une session de caisse clôturée (Réservé à l'Administrateur pour corrections)
  const reopenCashSession = (
    sessionId: string,
    reason?: string
  ): { success: boolean; error?: string; message?: string; session?: CashSession } => {
    if (currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Droits insuffisants : seul l’Administrateur peut rouvrir une session de caisse clôturée.',
      };
    }

    const session = cashSessions.find((s) => s.id === sessionId);
    if (!session) {
      return { success: false, error: 'Session de caisse introuvable.' };
    }
    if (session.status === 'OPEN') {
      return { success: false, error: 'Cette session de caisse est déjà ouverte.' };
    }

    const alreadyOpen = cashSessions.find((s) => s.status === 'OPEN' && s.id !== sessionId);
    if (alreadyOpen) {
      return {
        success: false,
        error: `Une autre session (${alreadyOpen.id}) est actuellement ouverte. Veuillez d'abord clôturer la session ${alreadyOpen.id} avant de rouvrir ${sessionId} pour correction.`,
      };
    }

    // Recalculate theoretical cash from active movements
    const sessionMvts = cashMovements.filter((m) => m.cashSessionId === sessionId);
    let cashIn = 0;
    let cashOut = 0;
    for (const m of sessionMvts) {
      if (!m.isCashInDrawer) continue;
      if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') cashIn += m.amount;
      else if (m.direction === 'IN' && m.type === 'APPORT_ESPECES' && !m.id.startsWith('CSM-INIT')) {
        cashIn += m.amount;
      } else if (m.direction === 'OUT') {
        cashOut += m.amount;
      }
    }
    const recalculatedTheoretical = Math.max(0, session.initialCashFloat + cashIn - cashOut);
    const nowFormatted = new Date().toLocaleString('fr-FR');
    const auditNote = `[Réouverte par ${currentUser.name} le ${nowFormatted}${
      reason?.trim() ? ` : ${reason.trim()}` : ' pour correction'
    }]`;

    const reopenedSession: CashSession = {
      ...session,
      status: 'OPEN',
      closedAt: undefined,
      closedByUserId: undefined,
      closedByUserName: undefined,
      countedCash: null,
      cashVariance: 0,
      theoreticalCash: recalculatedTheoretical,
      notes: session.notes ? `${session.notes} | ${auditNote}` : auditNote,
    };

    const nextSessions = cashSessions.map((s) => (s.id === sessionId ? reopenedSession : s));
    setCashSessions(nextSessions);
    safeSetLocalStorage('cash_sessions', nextSessions);
    saveCashSessionToFirebase(reopenedSession).catch(console.warn);

    return {
      success: true,
      session: reopenedSession,
      message: `La session ${sessionId} a été réouverte avec succès. Vous pouvez effectuer vos corrections puis la clôturer à nouveau.`,
    };
  };

  // Correction du fond de caisse initial par l'Administrateur
  const updateCashSessionInitialFloat = (
    sessionId: string,
    newInitialFloat: number,
    reason?: string
  ): { success: boolean; error?: string; message?: string } => {
    if (currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Droits insuffisants : seul l’Administrateur peut corriger le fond de caisse initial.',
      };
    }
    if (!Number.isFinite(newInitialFloat) || newInitialFloat < 0) {
      return { success: false, error: 'Le fond de caisse initial doit être un montant supérieur ou égal à 0.' };
    }

    const session = cashSessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session de caisse introuvable.' };

    // Update the initial CSM-INIT movement if it exists
    let updatedInitMvt: CashMovement | null = null;
    const nextMovements = cashMovements.map((m) => {
      if (
        m.cashSessionId === sessionId &&
        (m.id.startsWith('CSM-INIT') || m.reason === 'Fond de caisse initial à l’ouverture')
      ) {
        updatedInitMvt = {
          ...m,
          amount: newInitialFloat,
          notes: reason?.trim() ? `Corrigé par ${currentUser.name} : ${reason.trim()}` : m.notes,
        };
        return updatedInitMvt;
      }
      return m;
    });

    if (updatedInitMvt) {
      setCashMovements(nextMovements);
      safeSetLocalStorage('cash_movements', nextMovements);
      saveCashMovementToFirebase(updatedInitMvt).catch(console.warn);
    }

    // Recalculate theoretical cash
    const sessionMvts = nextMovements.filter((m) => m.cashSessionId === sessionId);
    let cashIn = 0;
    let cashOut = 0;
    for (const m of sessionMvts) {
      if (!m.isCashInDrawer) continue;
      if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') cashIn += m.amount;
      else if (m.direction === 'IN' && m.type === 'APPORT_ESPECES' && !m.id.startsWith('CSM-INIT') && m.reason !== 'Fond de caisse initial à l’ouverture') {
        cashIn += m.amount;
      } else if (m.direction === 'OUT') {
        cashOut += m.amount;
      }
    }
    const newTheoretical = Math.max(0, newInitialFloat + cashIn - cashOut);
    const updatedSession: CashSession = {
      ...session,
      initialCashFloat: newInitialFloat,
      theoreticalCash: newTheoretical,
      cashVariance:
        session.status === 'CLOSED' && session.countedCash !== null
          ? session.countedCash - newTheoretical
          : 0,
    };

    const nextSessions = cashSessions.map((s) => (s.id === sessionId ? updatedSession : s));
    setCashSessions(nextSessions);
    safeSetLocalStorage('cash_sessions', nextSessions);
    saveCashSessionToFirebase(updatedSession).catch(console.warn);

    return {
      success: true,
      message: `Fond de caisse initial de la session ${sessionId} mis à jour à ${newInitialFloat.toLocaleString('fr-FR')} FCFA.`,
    };
  };

  // Suppression d'une écriture de caisse erronée par l'Administrateur
  const deleteCashMovement = (
    movementId: string
  ): { success: boolean; error?: string; message?: string } => {
    if (currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Droits insuffisants : seul l’Administrateur peut supprimer une écriture de caisse.',
      };
    }

    const mvt = cashMovements.find((m) => m.id === movementId);
    if (!mvt) return { success: false, error: 'Écriture de caisse introuvable.' };

    markIdsDeleted('cashMovements', [movementId]);
    const nextMovements = cashMovements.filter((m) => m.id !== movementId);
    setCashMovements(nextMovements);
    safeSetLocalStorage('cash_movements', nextMovements);
    deleteCashMovementsFromFirebase([movementId]).catch(console.warn);

    // Recalculate session theoreticalCash
    const session = cashSessions.find((s) => s.id === mvt.cashSessionId);
    if (session) {
      const sessionMvts = nextMovements.filter((m) => m.cashSessionId === session.id);
      let cashIn = 0;
      let cashOut = 0;
      for (const m of sessionMvts) {
        if (!m.isCashInDrawer) continue;
        if (m.direction === 'IN' && m.type !== 'APPORT_ESPECES') cashIn += m.amount;
        else if (
          m.direction === 'IN' &&
          m.type === 'APPORT_ESPECES' &&
          !m.id.startsWith('CSM-INIT') &&
          m.reason !== 'Fond de caisse initial à l’ouverture'
        ) {
          cashIn += m.amount;
        } else if (m.direction === 'OUT') {
          cashOut += m.amount;
        }
      }
      const newTheoretical = Math.max(0, session.initialCashFloat + cashIn - cashOut);
      const updatedSession: CashSession = {
        ...session,
        theoreticalCash: newTheoretical,
        cashVariance:
          session.status === 'CLOSED' && session.countedCash !== null
            ? session.countedCash - newTheoretical
            : 0,
      };
      const nextSessions = cashSessions.map((s) => (s.id === session.id ? updatedSession : s));
      setCashSessions(nextSessions);
      safeSetLocalStorage('cash_sessions', nextSessions);
      saveCashSessionToFirebase(updatedSession).catch(console.warn);
    }

    return {
      success: true,
      message: `L'écriture de caisse "${mvt.reason}" (${mvt.amount.toLocaleString('fr-FR')} FCFA) a été supprimée et le solde théorique a été recalculé.`,
    };
  };

  const recordCashExpense = (params: {
    warehouseId?: string;
    type: 'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES';
    amount: number;
    reason: string;
    notes?: string;
    customDate?: string;
  }) => {
    const activeSession = getActiveCashSession();
    if (!activeSession) {
      return {
        success: false,
        error: 'Aucune caisse ouverte actuellement. Veuillez ouvrir ou rouvrir une session de caisse avant de saisir une opération.',
      };
    }

    if (params.amount <= 0) {
      return { success: false, error: 'Le montant doit être supérieur à zéro.' };
    }

    const isOut = params.type === 'DEPENSE' || params.type === 'RETRAIT_BANQUE';
    if (isOut && activeSession.theoreticalCash < params.amount) {
      return {
        success: false,
        error: `Montant en caisse insuffisant (${activeSession.theoreticalCash.toLocaleString()} FCFA) pour effectuer cette sortie de ${params.amount.toLocaleString()} FCFA.`,
      };
    }

    let opDateObj = new Date();
    if (params.customDate) {
      const parsed = new Date(params.customDate);
      if (!isNaN(parsed.getTime())) {
        if (params.customDate.length === 10) {
          const now = new Date();
          parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
        opDateObj = parsed;
      }
    }
    const nowIso = opDateObj.toISOString();
    const csmId = generateCashMovementId('CSM-EXP');
    const newMvt: CashMovement = {
      id: csmId,
      cashSessionId: activeSession.id,
      warehouseId: activeSession.warehouseId || 'caisse_principale',
      date: nowIso,
      type: params.type,
      method: 'ESPECES',
      amount: params.amount,
      isCashInDrawer: true,
      direction: isOut ? 'OUT' : 'IN',
      reason: params.reason.trim(),
      userId: currentUser.id,
      userName: currentUser.name,
      notes: params.notes?.trim(),
    };

    const nextMovements = [newMvt, ...cashMovements];
    setCashMovements(nextMovements);
    safeSetLocalStorage('cash_movements', nextMovements);
    saveCashMovementToFirebase(newMvt).catch(console.warn);

    const updatedSession = {
      ...activeSession,
      theoreticalCash: isOut
        ? activeSession.theoreticalCash - params.amount
        : activeSession.theoreticalCash + params.amount,
    };
    const nextSessions = cashSessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
    setCashSessions(nextSessions);
    safeSetLocalStorage('cash_sessions', nextSessions);
    saveCashSessionToFirebase(updatedSession).catch(console.warn);

    return { success: true };
  };

  // Operation: TRANSFER ELECTRONIC / DIGITAL ENTRY TO PHYSICAL CASH IN DRAWER
  const transferElectronicToCashDrawer = (params: {
    warehouseId?: string;
    sourceMethod: 'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CARTE';
    amount: number;
    reference?: string;
    notes?: string;
    customDate?: string;
  }): { success: boolean; error?: string } => {
    const activeSession = getActiveCashSession();
    if (!activeSession) {
      return {
        success: false,
        error: 'Aucune caisse ouverte actuellement. Veuillez ouvrir une session de caisse avant de transférer.',
      };
    }

    if (params.amount <= 0 || !Number.isFinite(params.amount)) {
      return { success: false, error: 'Le montant du transfert doit être supérieur à zéro.' };
    }

    // Calculate available net digital balance for this session
    const movementsOfSession = cashMovements.filter((m) => m.cashSessionId === activeSession.id);
    let digitalIn = 0;
    let digitalOut = 0;
    movementsOfSession.forEach((m) => {
      if (m.method === params.sourceMethod) {
        if (m.direction === 'IN') digitalIn += m.amount;
        else if (m.direction === 'OUT') digitalOut += m.amount;
      }
    });

    const netAvailableDigital = digitalIn - digitalOut;
    if (params.amount > netAvailableDigital) {
      return {
        success: false,
        error: `Solde électronique insuffisant sur ${params.sourceMethod} (${netAvailableDigital.toLocaleString()} FCFA disponible, demandé : ${params.amount.toLocaleString()} FCFA).`,
      };
    }

    let opDateObj = new Date();
    if (params.customDate) {
      const parsed = new Date(params.customDate);
      if (!isNaN(parsed.getTime())) {
        if (params.customDate.length === 10) {
          const now = new Date();
          parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
        opDateObj = parsed;
      }
    }
    const nowIso = opDateObj.toISOString();
    const sourceLabel =
      params.sourceMethod === 'WAVE'
        ? 'Wave'
        : params.sourceMethod === 'ORANGE_MONEY'
        ? 'Orange Money'
        : params.sourceMethod === 'VIREMENT'
        ? 'Virement Bancaire'
        : 'Carte Bancaire';

    // 1. Movement OUT: Debit the electronic account entry
    const outMvtId = generateCashMovementId('CSM-TRF-OUT');
    const targetWarehouseId = params.warehouseId || activeSession.warehouseId || 'caisse_principale';
    const digitalOutMvt: CashMovement = {
      id: outMvtId,
      cashSessionId: activeSession.id,
      warehouseId: targetWarehouseId,
      date: nowIso,
      type: 'TRANSFERT_ELECTRONIQUE_TIROIR',
      method: params.sourceMethod,
      amount: params.amount,
      isCashInDrawer: false,
      direction: 'OUT',
      reason: `Transfert ${sourceLabel} vers espèces en tiroir`,
      documentRef: params.reference?.trim() || `TRF-${params.sourceMethod}`,
      userId: currentUser.id,
      userName: currentUser.name,
      notes: params.notes?.trim(),
    };

    // 2. Movement IN: Credit physical cash drawer
    const inMvtId = generateCashMovementId('CSM-TRF-IN');
    const cashInMvt: CashMovement = {
      id: inMvtId,
      cashSessionId: activeSession.id,
      warehouseId: targetWarehouseId,
      date: nowIso,
      type: 'TRANSFERT_ELECTRONIQUE_TIROIR',
      method: 'ESPECES',
      amount: params.amount,
      isCashInDrawer: true,
      direction: 'IN',
      reason: `Alimentation espèces tiroir depuis ${sourceLabel}`,
      documentRef: params.reference?.trim() || `TRF-${params.sourceMethod}`,
      userId: currentUser.id,
      userName: currentUser.name,
      notes: params.notes?.trim(),
    };

    setCashMovements((prev) => [cashInMvt, digitalOutMvt, ...prev]);
    saveCashMovementToFirebase(digitalOutMvt).catch(console.warn);
    saveCashMovementToFirebase(cashInMvt).catch(console.warn);

    // 3. Update session's theoreticalCash (increased by the transferred physical cash)
    const updatedSession = {
      ...activeSession,
      theoreticalCash: activeSession.theoreticalCash + params.amount,
    };
    setCashSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
    );
    saveCashSessionToFirebase(updatedSession).catch(console.warn);

    return { success: true };
  };

  // Operation: RECORD A COMPLETE SALE (ATOMIC & STRICT)
  const recordSale = (params: RecordSaleParams): { success: boolean; error?: string; sale?: Sale } => {
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Le panier de vente est vide.' };
    }

    const wh =
      warehouses.find((w) => w.id === params.warehouseId) ||
      warehouses.find((w) => w.isDefault) ||
      warehouses[0] ||
      CLEAN_DEFAULT_WAREHOUSES[0];
    const effectiveWarehouseId = wh.id;
    const shouldFreezeStock = Boolean(params.freezeStock || isStockFrozen);

    // 1. Verify items and available stock across all warehouses
    for (const item of params.items) {
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return { success: false, error: `Quantité invalide pour l'article ${item.articleId}.` };
      }

      const article = articles.find((a) => a.id === item.articleId);
      if (!article) {
        return { success: false, error: `Article ${item.articleId} introuvable.` };
      }

      if (!shouldFreezeStock) {
        const availableStock = getTotalStockForArticle(item.articleId);
        if (availableStock < item.quantity) {
          return {
            success: false,
            error: `Stock insuffisant pour ${article.mainReference} (${article.designation}). Disponible total : ${availableStock} ${article.unit}, demandé : ${item.quantity}. Vente bloquée.`,
          };
        }
      }
    }

    // 2. Build verified items and amounts
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    const validatedItems: SaleItem[] = params.items.map((it) => {
      const art = articles.find((a) => a.id === it.articleId)!;
      let chosenBrandOffer = art.brandOffers?.find((bo) => bo.id === it.selectedBrandOfferId);
      if (!chosenBrandOffer && it.brand && art.brandOffers && art.brandOffers.length > 0) {
        const normTargetBrand = it.brand.toLowerCase().trim();
        chosenBrandOffer = art.brandOffers.find(
          (bo) => bo.brand.toLowerCase().trim() === normTargetBrand
        );
      }
      if (!chosenBrandOffer && !it.brand && art.brandOffers && art.brandOffers.length > 0) {
        chosenBrandOffer = art.brandOffers.find((bo) => bo.isDefault) || art.brandOffers[0];
      }

      const brandName = chosenBrandOffer ? chosenBrandOffer.brand : it.brand || art.brand;
      const unitCost = chosenBrandOffer ? chosenBrandOffer.purchasePrice : art.purchasePrice;
      const catalogPrice = chosenBrandOffer ? chosenBrandOffer.salePrice : art.salePrice;
      const appliedPrice = it.unitPrice !== undefined && it.unitPrice >= 0 ? it.unitPrice : catalogPrice;
      const isPriceOverridden = appliedPrice !== catalogPrice;

      const rawLine = it.quantity * appliedPrice;
      let discountAmount = it.discountAmount ?? 0;
      if (it.discountAmount === undefined && it.discountPercent && it.discountPercent > 0) {
        discountAmount = Math.round((rawLine * it.discountPercent) / 100);
      }
      discountAmount = Math.min(rawLine, Math.max(0, Math.round(discountAmount)));
      const totalLine = Math.max(0, rawLine - discountAmount);

      subtotal += rawLine;
      totalDiscount += discountAmount;
      totalCost += it.quantity * unitCost;

      return {
        articleId: art.id,
        mainReference: art.mainReference,
        designation: art.designation,
        brand: brandName,
        unit: art.unit,
        quantity: it.quantity,
        unitCost,
        catalogUnitPrice: catalogPrice,
        unitPrice: appliedPrice,
        discountPercent: it.discountPercent || 0,
        discountAmount,
        totalLine,
        isPriceOverridden,
        overriddenReason: it.overriddenReason,
        selectedBrandOfferId: chosenBrandOffer?.id,
        brandReference: chosenBrandOffer?.brandReference,
        ...(it.sourceWarehouseId ? { sourceWarehouseId: it.sourceWarehouseId } : {}),
        ...(it.sourceWarehouseName ? { sourceWarehouseName: it.sourceWarehouseName } : {}),
        ...(it.sourceLocation ? { sourceLocation: it.sourceLocation } : {}),
      };
    });

    const totalAmount = Math.max(0, subtotal - totalDiscount);

    // 3. Compute payments
    const totalPaid = params.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingDue = Math.max(0, totalAmount - totalPaid);

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (totalPaid >= totalAmount) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    // Check credit authorization if unpaid remainder
    if (remainingDue > 0 && !params.customerId) {
      return {
        success: false,
        error: `Une vente à crédit ou partiellement payée (reste dû : ${remainingDue.toLocaleString()} FCFA) requiert obligatoirement de sélectionner un client identifié.`,
      };
    }

    const saleId = generateSaleId();
    const receiptNumber = generateReceiptNumber();
    let saleDateObj = new Date();
    if (params.saleDate) {
      const parsed = new Date(params.saleDate);
      if (!isNaN(parsed.getTime())) {
        // If only YYYY-MM-DD was passed, set time to current time on that day
        if (params.saleDate.length === 10) {
          const now = new Date();
          parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
        saleDateObj = parsed;
      }
    }
    const nowIso = saleDateObj.toISOString();

    const activeSession =
      getActiveCashSession(effectiveWarehouseId) ||
      cashSessions.find((s) => s.status === 'OPEN');

    const newSale: Sale = {
      id: saleId,
      receiptNumber,
      date: nowIso,
      warehouseId: effectiveWarehouseId,
      warehouseName: wh.name,
      userId: currentUser.id,
      userName: currentUser.name,
      customerId: params.customerId,
      customerName: params.customerName.trim() || 'Client Comptoir Occasionnel',
      customerPhone: params.customerPhone?.trim(),
      items: validatedItems,
      subtotal,
      totalDiscount,
      totalAmount,
      totalCost,
      totalPaid,
      remainingDue,
      paymentStatus,
      status: 'VALIDATED',
      notes: shouldFreezeStock
        ? `[❄️ Gel de Stock / Saisie Historique] ${params.notes?.trim() || ''}`.trim()
        : params.notes?.trim(),
      cashSessionId: activeSession?.id,
      isHistoricalFrozen: shouldFreezeStock,
    };

    // 4. ATOMIC DATA UPDATES:
    // A. Decrement stocks across warehouses (starting with effectiveWarehouseId) and record Stock Movements of type SORTIE
    let nextStocks = [...stocks];
    const newStockMovements: StockMovement[] = [];

    if (!shouldFreezeStock) {
      validatedItems.forEach((it, itemIdx) => {
        const rawInputItem = params.items[itemIdx];
        const preferredWhId = rawInputItem?.sourceWarehouseId || effectiveWarehouseId;
        const totalBefore = getTotalStockForArticle(it.articleId);
        const totalAfter = Math.max(0, totalBefore - it.quantity);

        // Order warehouses: preferred/clicked warehouse first, then effectiveWarehouseId, then others with positive stock
        const orderedWarehouseIds = Array.from(
          new Set([
            preferredWhId,
            effectiveWarehouseId,
            ...warehouses.map((w) => w.id),
          ])
        );

        let remainingToDeduct = it.quantity;
        for (const candidateWhId of orderedWarehouseIds) {
          if (remainingToDeduct <= 0) break;
          const candidateStockRecord = nextStocks.find(
            (s) => s.articleId === it.articleId && s.warehouseId === candidateWhId
          );
          const whAvail = candidateStockRecord ? candidateStockRecord.quantity : 0;
          if (whAvail > 0) {
            const deductHere = Math.min(whAvail, remainingToDeduct);
            nextStocks = applyStockDelta(
              nextStocks,
              it.articleId,
              candidateWhId,
              -deductHere,
              it.brand
            );
            remainingToDeduct -= deductHere;
          }
        }

        // Fallback if stock was stored only on brandOffers
        if (remainingToDeduct > 0) {
          nextStocks = applyStockDelta(
            nextStocks,
            it.articleId,
            effectiveWarehouseId,
            -remainingToDeduct,
            it.brand
          );
        }

        const mvtId = generateMovementId();
        newStockMovements.push({
          id: mvtId,
          date: nowIso,
          type: 'SORTIE',
          articleId: it.articleId,
          quantity: it.quantity,
          sourceWarehouseId: preferredWhId,
          userId: currentUser.id,
          userName: currentUser.name,
          documentRef: saleId,
          reason: `Vente pièces - Reçu ${receiptNumber}`,
          thirdParty: newSale.customerName,
          unitPrice: it.unitPrice,
          totalPrice: it.totalLine,
          stockBefore: totalBefore,
          stockAfter: totalAfter,
          notes: `Réf commande / vente ${saleId}`,
        });
      });
    }

    // B. Record Payments
    const newPaymentRecords: PaymentRecord[] = [];
    const newCashMovements: CashMovement[] = [];
    let cashAddedToDrawer = 0;

    params.payments.forEach((p) => {
      if (p.amount > 0) {
        const payId = generatePaymentId();
        newPaymentRecords.push({
          id: payId,
          date: nowIso,
          saleId,
          customerId: params.customerId,
          cashSessionId: activeSession?.id,
          warehouseId: params.warehouseId,
          method: p.method,
          amount: p.amount,
          userId: currentUser.id,
          userName: currentUser.name,
          reference: p.reference?.trim(),
          notes: p.notes?.trim(),
        });

        if (activeSession) {
          const isCash = p.method === 'ESPECES';
          if (isCash) {
            cashAddedToDrawer += p.amount;
          }

          newCashMovements.push({
            id: generateCashMovementId('CSM-SALE'),
            cashSessionId: activeSession.id,
            warehouseId: params.warehouseId,
            date: nowIso,
            type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
            method: p.method,
            amount: p.amount,
            isCashInDrawer: isCash,
            direction: 'IN',
            reason: `Vente ${receiptNumber} (${p.method})`,
            saleId,
            customerId: params.customerId,
            documentRef: receiptNumber,
            userId: currentUser.id,
            userName: currentUser.name,
          });
        }
      }
    });

    // Commit all states synchronously
    if (!shouldFreezeStock) {
      setStocks(nextStocks);
      setMovements((prev) => [...newStockMovements, ...prev]);
      saveMultipleStocksToFirebase(nextStocks).catch(console.warn);
      newStockMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));
    }
    setSales((prev) => [newSale, ...prev]);
    if (newPaymentRecords.length > 0) {
      setPayments((prev) => [...newPaymentRecords, ...prev]);
    }
    if (newCashMovements.length > 0) {
      setCashMovements((prev) => [...newCashMovements, ...prev]);
    }

    // Persist sale & payments & cash to Firestore in background
    saveSaleToFirebase(newSale).catch(console.warn);
    newPaymentRecords.forEach((p) => savePaymentToFirebase(p).catch(console.warn));
    newCashMovements.forEach((cm) => saveCashMovementToFirebase(cm).catch(console.warn));

    // Update customer debt balance strictly as (Somme des achats à crédit - Somme des acomptes)
    if (params.customerId) {
      const nextSalesForCustomer = [newSale, ...sales];
      const nextPaymentsForCustomer = [...newPaymentRecords, ...payments];
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === params.customerId) {
            const summary = getCustomerCreditSummary(c, nextSalesForCustomer, nextPaymentsForCustomer);
            const updated = {
              ...c,
              outstandingBalance: summary.creance,
              depositBalance: summary.avanceDisponible,
              updatedAt: nowIso,
            };
            saveCustomerToFirebase(updated).catch(console.warn);
            return updated;
          }
          return c;
        })
      );
    }

    // Update active cash session theoretical cash if cash received
    if (activeSession && cashAddedToDrawer > 0) {
      const updatedSession = { ...activeSession, theoreticalCash: activeSession.theoreticalCash + cashAddedToDrawer };
      setCashSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );
      saveCashSessionToFirebase(updatedSession).catch(console.warn);
    }

    return { success: true, sale: newSale };
  };

  // Operation: CANCEL OR REFUND A SALE (AUDITED PROCEDURE)
  const cancelOrRefundSale = (params: {
    saleId: string;
    reason: string;
    refundCash?: boolean;
  }) => {
    const sale = sales.find((s) => s.id === params.saleId);
    if (!sale) return { success: false, error: 'Vente introuvable.' };
    if (sale.status === 'CANCELLED') {
      return { success: false, error: 'Cette vente est déjà annulée.' };
    }

    const nowIso = new Date().toISOString();

    // 1. Return stock back to warehouse
    let nextStocks = [...stocks];
    const returnMovements: StockMovement[] = [];

    sale.items.forEach((item) => {
      const currentQty = getStockForArticleAndWarehouse(item.articleId, sale.warehouseId);
      nextStocks = applyStockDelta(nextStocks, item.articleId, sale.warehouseId, item.quantity);

      const mvtId = generateMovementId();
      returnMovements.push({
        id: mvtId,
        date: nowIso,
        type: 'ENTREE',
        articleId: item.articleId,
        quantity: item.quantity,
        targetWarehouseId: sale.warehouseId,
        userId: currentUser.id,
        userName: currentUser.name,
        documentRef: `ANNUL-${sale.id}`,
        reason: `Annulation vente ${sale.receiptNumber} - ${params.reason}`,
        thirdParty: sale.customerName,
        unitPrice: item.unitPrice,
        totalPrice: item.totalLine,
        stockBefore: currentQty,
        stockAfter: currentQty + item.quantity,
        notes: `Régularisation annulation par ${currentUser.name}`,
      });
    });

    setStocks(nextStocks);
    setMovements((prev) => [...returnMovements, ...prev]);
    saveMultipleStocksToFirebase(nextStocks).catch(console.warn);
    returnMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));

    // 2. Adjust customer balance if this sale had an outstanding debt
    if (sale.remainingDue > 0 && sale.customerId) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === sale.customerId) {
            const updated = {
              ...c,
              outstandingBalance: Math.max(0, c.outstandingBalance - sale.remainingDue),
              updatedAt: nowIso,
            };
            saveCustomerToFirebase(updated).catch(console.warn);
            return updated;
          }
          return c;
        })
      );
    }

    // 3. Remove associated payments & sale cash movements so cancelled sales never pollute reports
    const paymentsToDelete = payments.filter((p) => p.saleId === sale.id).map((p) => p.id);
    if (paymentsToDelete.length > 0) {
      setPayments((prev) => {
        const next = prev.filter((p) => p.saleId !== sale.id);
        safeSetLocalStorage('payments', next);
        return next;
      });
      deletePaymentsFromFirebase(paymentsToDelete).catch(console.warn);
    }

    const cashMvtsToDelete = cashMovements
      .filter((cm) => cm.saleId === sale.id || cm.documentRef === sale.receiptNumber)
      .map((cm) => cm.id);
    if (cashMvtsToDelete.length > 0) {
      setCashMovements((prev) => {
        const next = prev.filter((cm) => cm.saleId !== sale.id && cm.documentRef !== sale.receiptNumber);
        safeSetLocalStorage('cash_movements', next);
        return next;
      });
      deleteCashMovementsFromFirebase(cashMvtsToDelete).catch(console.warn);
    }

    // Adjust active cash session if cash was paid
    const activeSession = getActiveCashSession(sale.warehouseId);
    if (params.refundCash && sale.totalPaid > 0 && activeSession) {
      const updatedSession = {
        ...activeSession,
        theoreticalCash: Math.max(0, activeSession.theoreticalCash - sale.totalPaid),
      };
      setCashSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );
      saveCashSessionToFirebase(updatedSession).catch(console.warn);
    }

    // 4. Update sale record
    const updatedSale: Sale = {
      ...sale,
      status: 'CANCELLED' as const,
      remainingDue: 0,
      cancelledAt: nowIso,
      cancelledBy: currentUser.name,
      cancelledReason: params.reason.trim(),
      refundedAmount: params.refundCash ? sale.totalPaid : 0,
    };
    setSales((prev) => {
      const next = prev.map((s) => (s.id === params.saleId ? updatedSale : s));
      safeSetLocalStorage('sales', next);
      return next;
    });
    saveSaleToFirebase(updatedSale).catch(console.warn);

    return { success: true };
  };

  // Operation: SUPPRESSION DÉFINITIVE D'UNE VENTE
  const deleteSale = (saleId: string): { success: boolean; error?: string; message?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable.' };

    const nowIso = new Date().toISOString();

    // If the sale was not already cancelled or fully refunded, restore unreturned stock and adjust customer debt
    if (sale.status !== 'CANCELLED' && sale.status !== 'REFUNDED') {
      if (!sale.isHistoricalFrozen) {
        let nextStocks = [...stocks];
        sale.items.forEach((item) => {
          const alreadyReturned = (sale.returns || []).reduce((sum, ret) => {
            const match = ret.items.find((ri) => ri.articleId === item.articleId);
            return sum + (match ? match.quantity : 0);
          }, 0);
          const unreturnedQty = Math.max(0, item.quantity - alreadyReturned);
          if (unreturnedQty > 0) {
            nextStocks = applyStockDelta(nextStocks, item.articleId, sale.warehouseId, unreturnedQty, item.brand);
          }
        });
        setStocks(nextStocks);
        safeSetLocalStorage('stocks', nextStocks);
        saveMultipleStocksToFirebase(nextStocks).catch(console.warn);
      }

      if (sale.remainingDue > 0 && sale.customerId) {
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id === sale.customerId) {
              const updated = {
                ...c,
                outstandingBalance: Math.max(0, c.outstandingBalance - sale.remainingDue),
                updatedAt: nowIso,
              };
              saveCustomerToFirebase(updated).catch(console.warn);
              return updated;
            }
            return c;
          })
        );
      }

      const activeSession = getActiveCashSession(sale.warehouseId);
      const netPaidCash = Math.max(0, sale.totalPaid - (sale.refundedAmount || 0));
      if (activeSession && netPaidCash > 0) {
        const updatedSession = {
          ...activeSession,
          theoreticalCash: Math.max(0, activeSession.theoreticalCash - netPaidCash),
        };
        setCashSessions((prev) =>
          prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
        );
        saveCashSessionToFirebase(updatedSession).catch(console.warn);
      }
    }

    // Delete associated payments
    const paymentsToDelete = payments.filter((p) => p.saleId === saleId).map((p) => p.id);
    if (paymentsToDelete.length > 0) {
      setPayments((prev) => {
        const next = prev.filter((p) => p.saleId !== saleId);
        safeSetLocalStorage('payments', next);
        return next;
      });
      deletePaymentsFromFirebase(paymentsToDelete).catch(console.warn);
    }

    // Delete associated cash movements
    const cashMvtsToDelete = cashMovements
      .filter((cm) => cm.saleId === saleId || cm.documentRef === sale.receiptNumber || cm.documentRef === `REFUND-${sale.receiptNumber}`)
      .map((cm) => cm.id);
    if (cashMvtsToDelete.length > 0) {
      markIdsDeleted('cashMovements', cashMvtsToDelete);
      setCashMovements((prev) => {
        const next = prev.filter(
          (cm) => cm.saleId !== saleId && cm.documentRef !== sale.receiptNumber && cm.documentRef !== `REFUND-${sale.receiptNumber}`
        );
        safeSetLocalStorage('cash_movements', next);
        return next;
      });
      deleteCashMovementsFromFirebase(cashMvtsToDelete).catch(console.warn);
    }

    // Delete sale from state, localStorage, IndexedDB, and Firestore
    markIdsDeleted('sales', [saleId]);
    setSales((prev) => {
      const next = prev.filter((s) => s.id !== saleId);
      safeSetLocalStorage('sales', next);
      return next;
    });
    deleteSaleFromFirebase(saleId).catch(console.warn);

    return {
      success: true,
      message: `La vente ${sale.receiptNumber} a été définitivement supprimée des transactions et des rapports.`,
    };
  };

  // Helper: Find the cash session matching a sale date (for retroactive edits or synchronization)
  const findBestCashSessionForDate = (
    targetDateIso: string,
    preferredSessionId?: string
  ): CashSession | undefined => {
    if (preferredSessionId) {
      const exact = cashSessions.find((s) => s.id === preferredSessionId);
      if (exact) return exact;
    }

    const toLocalDay = (iso: string): string => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const targetMs = new Date(targetDateIso).getTime();
    if (!Number.isNaN(targetMs)) {
      // 1. Exact time-window match (openedAt <= saleDate <= closedAt or still OPEN)
      const spanning = cashSessions
        .filter((s) => {
          const openMs = new Date(s.openedAt).getTime();
          if (Number.isNaN(openMs) || targetMs < openMs) return false;
          if (s.status === 'OPEN') return true;
          if (s.closedAt) {
            const closeMs = new Date(s.closedAt).getTime();
            return !Number.isNaN(closeMs) && targetMs <= closeMs;
          }
          return false;
        })
        .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      if (spanning.length > 0) return spanning[0];

      // 2. Same local calendar day match
      const targetDay = toLocalDay(targetDateIso);
      const sameDay = cashSessions
        .filter((s) => toLocalDay(s.openedAt) === targetDay)
        .sort((a, b) => {
          const diffA = Math.abs(new Date(a.openedAt).getTime() - targetMs);
          const diffB = Math.abs(new Date(b.openedAt).getTime() - targetMs);
          return diffA - diffB;
        });
      if (sameDay.length > 0) return sameDay[0];
    }

    // 3. Fallback: currently active open session
    return cashSessions.find((s) => s.status === 'OPEN');
  };

  // Operation: MODIFICATION D'UNE VENTE EXISTANTE (RÉSERVÉ ADMINISTRATEUR)
  // Synchronise intégralement : vente, encaissements (payments), journal de caisse (cashMovements),
  // solde théorique de la session de caisse, solde client et mouvements de stock.
  const updateSale = (params: UpdateSaleParams): { success: boolean; error?: string } => {
    const saleIndex = sales.findIndex((s) => s.id === params.saleId);
    if (saleIndex === -1) return { success: false, error: 'Vente introuvable.' };
    const existingSale = sales[saleIndex];
    const nowIso = new Date().toISOString();

    let newDate = existingSale.date;
    if (params.date) {
      const parsed = new Date(params.date);
      if (!isNaN(parsed.getTime())) {
        if (params.date.length === 10) {
          const oldD = new Date(existingSale.date);
          parsed.setHours(oldD.getHours(), oldD.getMinutes(), oldD.getSeconds(), oldD.getMilliseconds());
        }
        newDate = parsed.toISOString();
      }
    }

    const newWarehouseId = params.warehouseId || existingSale.warehouseId;
    const newWarehouseObj = warehouses.find((w) => w.id === newWarehouseId);
    const newWarehouseName = newWarehouseObj?.name || existingSale.warehouseName;

    const newCustomerId = params.customerId !== undefined ? params.customerId : existingSale.customerId;
    const newCustomerName = params.customerName !== undefined ? params.customerName.trim() : existingSale.customerName;
    const newCustomerPhone = params.customerPhone !== undefined ? params.customerPhone?.trim() : existingSale.customerPhone;
    const newNotes = params.notes !== undefined ? params.notes.trim() : existingSale.notes;

    // 0. Recalcul complet des lignes de vente (articles, prix, quantités, remises, marques, dépôts)
    let finalItems: SaleItem[] = existingSale.items;
    let newSubtotal = existingSale.subtotal;
    let newTotalDiscount = existingSale.totalDiscount;
    let newTotalAmount = existingSale.totalAmount;
    let newTotalCost = existingSale.totalCost;

    if (params.updatedItems !== undefined) {
      if (params.updatedItems.length === 0) {
        return { success: false, error: 'Une vente doit comporter au moins une pièce.' };
      }

      finalItems = params.updatedItems.map((it) => {
        const art = articleByIdMap.get(it.articleId);
        const prevMatch =
          existingSale.items.find(
            (old) =>
              old.articleId === it.articleId &&
              cleanBrandName(old.brand).toLowerCase() === cleanBrandName(it.brand).toLowerCase()
          ) || existingSale.items.find((old) => old.articleId === it.articleId);

        const cleanB = cleanBrandName(it.brand || prevMatch?.brand || art?.brand || '');
        const matchingOffer = art
          ? getArticleBrandOffers(art).find(
              (o) => cleanBrandName(o.brand).toLowerCase() === cleanB.toLowerCase()
            )
          : undefined;

        const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
        const unitPrice = Math.max(0, Math.round(Number(it.unitPrice) || 0));
        const gross = qty * unitPrice;

        let discountPercent = 0;
        let discountAmount = 0;
        if (it.discountAmount !== undefined) {
          discountAmount = Math.max(0, Math.min(gross, Math.round(Number(it.discountAmount) || 0)));
          discountPercent = gross > 0 ? Math.round((discountAmount / gross) * 1000) / 10 : 0;
        } else if (it.discountPercent !== undefined) {
          discountPercent = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
          discountAmount = Math.round((gross * discountPercent) / 100);
        }

        const totalLine = Math.max(0, gross - discountAmount);
        const unitCost =
          it.unitCost !== undefined
            ? Math.max(0, Math.round(Number(it.unitCost) || 0))
            : prevMatch?.unitCost ?? matchingOffer?.purchasePrice ?? art?.purchasePrice ?? 0;
        const catalogUnitPrice =
          it.catalogUnitPrice !== undefined
            ? Math.max(0, Math.round(Number(it.catalogUnitPrice) || 0))
            : prevMatch?.catalogUnitPrice ?? matchingOffer?.salePrice ?? art?.salePrice ?? unitPrice;

        const srcWhId = it.sourceWarehouseId || prevMatch?.sourceWarehouseId || newWarehouseId;
        const srcWhName =
          warehouses.find((w) => w.id === srcWhId)?.name ||
          it.sourceWarehouseName ||
          prevMatch?.sourceWarehouseName ||
          newWarehouseName;

        return {
          articleId: it.articleId,
          mainReference: it.mainReference || prevMatch?.mainReference || art?.mainReference || '',
          designation: it.designation || prevMatch?.designation || art?.designation || 'Pièce',
          brand: cleanB || prevMatch?.brand || art?.brand || '',
          unit: it.unit || prevMatch?.unit || art?.unit || 'Unité',
          quantity: qty,
          unitCost,
          catalogUnitPrice,
          unitPrice,
          discountPercent,
          discountAmount,
          totalLine,
          isPriceOverridden: unitPrice !== catalogUnitPrice,
          overriddenReason:
            unitPrice !== catalogUnitPrice ? 'Modification Admin de la vente' : undefined,
          selectedBrandOfferId:
            it.selectedBrandOfferId || prevMatch?.selectedBrandOfferId || matchingOffer?.id,
          brandReference:
            it.brandReference || prevMatch?.brandReference || matchingOffer?.brandReference,
          sourceWarehouseId: srcWhId,
          sourceWarehouseName: srcWhName,
          sourceLocation: it.sourceLocation || prevMatch?.sourceLocation,
        };
      });

      const itemsDiscountSum = finalItems.reduce((sum, i) => sum + i.discountAmount, 0);
      const extraDiscount = Math.max(0, Math.round(Number(params.extraDiscount) || 0));
      newSubtotal = finalItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      newTotalDiscount = Math.min(newSubtotal, itemsDiscountSum + extraDiscount);
      newTotalAmount = Math.max(0, Math.round(newSubtotal - newTotalDiscount));
      newTotalCost = finalItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    } else if (params.extraDiscount !== undefined) {
      const itemsDiscountSum = finalItems.reduce((sum, i) => sum + (i.discountAmount || 0), 0);
      const extraDiscount = Math.max(0, Math.round(Number(params.extraDiscount) || 0));
      newTotalDiscount = Math.min(newSubtotal, itemsDiscountSum + extraDiscount);
      newTotalAmount = Math.max(0, Math.round(newSubtotal - newTotalDiscount));
    }

    const netSaleAmount = Math.max(0, newTotalAmount - (existingSale.refundedAmount || 0));
    const requestedPaid =
      params.totalPaid !== undefined ? Number(params.totalPaid) || 0 : existingSale.totalPaid;
    const newTotalPaid = Math.max(0, Math.min(newTotalAmount, Math.round(requestedPaid)));
    const newRemainingDue = Math.max(0, netSaleAmount - newTotalPaid);
    const newPaymentStatus: Sale['paymentStatus'] =
      newRemainingDue <= 0 ? 'PAID' : newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const updatedSale: Sale = {
      ...existingSale,
      date: newDate,
      warehouseId: newWarehouseId,
      warehouseName: newWarehouseName,
      customerId: newCustomerId,
      customerName: newCustomerName || 'Client Comptoir',
      customerPhone: newCustomerPhone,
      items: finalItems,
      subtotal: newSubtotal,
      totalDiscount: newTotalDiscount,
      totalAmount: newTotalAmount,
      totalCost: newTotalCost,
      notes: newNotes,
      totalPaid: newTotalPaid,
      remainingDue: newRemainingDue,
      paymentStatus: newPaymentStatus,
    };

    const nextSales = sales.map((s) => (s.id === params.saleId ? updatedSale : s));
    setSales(nextSales);
    safeSetLocalStorage('sales', nextSales);
    saveSaleToFirebase(updatedSale).catch(console.warn);

    // -----------------------------------------------------------------------
    // 0b. Réconciliation automatique des stocks & mouvements si lignes ou dépôt modifiés
    // -----------------------------------------------------------------------
    const itemsOrWarehouseChanged =
      params.updatedItems !== undefined || newWarehouseId !== existingSale.warehouseId;
    const stockAdjMovements: StockMovement[] = [];

    if (
      itemsOrWarehouseChanged &&
      !existingSale.isHistoricalFrozen &&
      existingSale.status !== 'CANCELLED' &&
      existingSale.status !== 'REFUNDED'
    ) {
      const deltaMap = new Map<
        string,
        { articleId: string; warehouseId: string; brand: string; delta: number; unitCost: number }
      >();

      const addDelta = (
        articleId: string,
        whId: string,
        brand: string,
        delta: number,
        unitCost: number
      ) => {
        const cleanB = cleanBrandName(brand);
        const key = `${articleId}__${whId}__${cleanB.toLowerCase()}`;
        const prev = deltaMap.get(key);
        if (prev) {
          prev.delta += delta;
        } else {
          deltaMap.set(key, {
            articleId,
            warehouseId: whId,
            brand: cleanB,
            delta,
            unitCost,
          });
        }
      };

      // Restituer les anciennes quantités vendues
      for (const oldItem of existingSale.items) {
        addDelta(
          oldItem.articleId,
          oldItem.sourceWarehouseId || existingSale.warehouseId,
          oldItem.brand,
          oldItem.quantity,
          oldItem.unitCost
        );
      }
      // Déduire les nouvelles quantités vendues
      for (const newItem of finalItems) {
        addDelta(
          newItem.articleId,
          newItem.sourceWarehouseId || newWarehouseId,
          newItem.brand,
          -newItem.quantity,
          newItem.unitCost
        );
      }

      const nonZeroDeltas = Array.from(deltaMap.values()).filter((d) => d.delta !== 0);
      if (nonZeroDeltas.length > 0) {
        let nextStocks = deduplicateStocksList(stocks);
        const touchedPairs = new Set<string>();

        for (const entry of nonZeroDeltas) {
          const beforeRec = nextStocks.find(
            (s) => s.articleId === entry.articleId && s.warehouseId === entry.warehouseId
          );
          const beforeQty = beforeRec ? Math.max(0, Number(beforeRec.quantity) || 0) : 0;

          nextStocks = applyStockDelta(
            nextStocks,
            entry.articleId,
            entry.warehouseId,
            entry.delta,
            entry.brand
          );
          touchedPairs.add(`${entry.articleId}__${entry.warehouseId}`);

          const afterRec = nextStocks.find(
            (s) => s.articleId === entry.articleId && s.warehouseId === entry.warehouseId
          );
          const afterQty = afterRec ? Math.max(0, Number(afterRec.quantity) || 0) : 0;

          stockAdjMovements.push({
            id: generateMovementId(),
            date: nowIso,
            type: 'AJUSTEMENT',
            articleId: entry.articleId,
            quantity: Math.abs(entry.delta),
            ...(entry.delta > 0
              ? { targetWarehouseId: entry.warehouseId }
              : { sourceWarehouseId: entry.warehouseId }),
            userId: currentUser.id,
            userName: currentUser.name,
            documentRef: existingSale.receiptNumber,
            reason: `Modification vente ${existingSale.receiptNumber} (${
              entry.delta > 0 ? 'restitution' : 'sortie compl.'
            } ${entry.brand || 'standard'} — Admin)`,
            thirdParty: updatedSale.customerName,
            unitPrice: entry.unitCost,
            totalPrice: Math.abs(entry.delta) * entry.unitCost,
            stockBefore: beforeQty,
            stockAfter: afterQty,
          });
        }

        nextStocks = deduplicateStocksList(nextStocks);
        setStocks(nextStocks);
        safeSetLocalStorage('stocks', nextStocks);
        const modifiedStocks = nextStocks.filter((s) =>
          touchedPairs.has(`${s.articleId}__${s.warehouseId}`)
        );
        if (modifiedStocks.length > 0) {
          saveMultipleStocksToFirebase(modifiedStocks).catch(console.warn);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 1. Synchronisation des paiements (PaymentRecord) & Journal de Caisse (CashMovement)
    // -----------------------------------------------------------------------
    const existingSalePayments = payments.filter((p) => p.saleId === existingSale.id);
    const existingPaymentsTotal = existingSalePayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    const isSaleCashInMvt = (m: CashMovement) =>
      (m.saleId === existingSale.id || m.documentRef === existingSale.receiptNumber) &&
      (m.type === 'VENTE_ESPECES' || m.type === 'VENTE_DIGITAL') &&
      m.direction === 'IN';

    const existingSaleCashInMvts = cashMovements.filter(isSaleCashInMvt);
    const existingSaleCashInTotal = existingSaleCashInMvts.reduce(
      (sum, m) => sum + (Number(m.amount) || 0),
      0
    );
    const existingSaleCashOutRefundTotal = cashMovements
      .filter(
        (m) =>
          (m.saleId === existingSale.id || m.documentRef === existingSale.receiptNumber) &&
          m.type === 'REMBOURSEMENT' &&
          m.direction === 'OUT'
      )
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const effectiveMethod: PaymentMethod =
      params.paymentMethod ||
      existingSalePayments[0]?.method ||
      existingSaleCashInMvts[0]?.method ||
      'ESPECES';

    const preferredSessionId =
      existingSaleCashInMvts[0]?.cashSessionId || existingSalePayments[0]?.cashSessionId;
    const targetSession = findBestCashSessionForDate(newDate, preferredSessionId);

    const needsPaymentSync =
      existingPaymentsTotal !== newTotalPaid ||
      params.paymentMethod !== undefined ||
      newDate !== existingSale.date ||
      newWarehouseId !== existingSale.warehouseId ||
      newCustomerId !== existingSale.customerId ||
      newCustomerName !== existingSale.customerName;

    let nextPayments = payments;
    if (needsPaymentSync && existingSale.status !== 'CANCELLED' && existingSale.status !== 'REFUNDED') {
      const paymentsToSave: PaymentRecord[] = [];
      const paymentIdsToDelete: string[] = [];

      if (newTotalPaid <= 0) {
        existingSalePayments.forEach((p) => paymentIdsToDelete.push(p.id));
        nextPayments = payments.filter((p) => p.saleId !== existingSale.id);
      } else if (existingSalePayments.length === 0) {
        const createdPayment: PaymentRecord = {
          id: generatePaymentId(),
          date: newDate,
          saleId: existingSale.id,
          customerId: newCustomerId,
          customerName: updatedSale.customerName,
          cashSessionId: targetSession?.id,
          warehouseId: newWarehouseId,
          method: effectiveMethod,
          amount: newTotalPaid,
          userId: currentUser.id,
          userName: currentUser.name,
          reference: existingSale.receiptNumber,
          notes: `Encaissement vente ${existingSale.receiptNumber}`,
        };
        paymentsToSave.push(createdPayment);
        nextPayments = [createdPayment, ...payments];
      } else if (existingSalePayments.length === 1) {
        const targetId = existingSalePayments[0].id;
        nextPayments = payments.map((p) => {
          if (p.id !== targetId) return p;
          const updatedP: PaymentRecord = {
            ...p,
            date: newDate,
            amount: newTotalPaid,
            method: params.paymentMethod || p.method,
            warehouseId: newWarehouseId,
            customerId: newCustomerId,
            customerName: updatedSale.customerName,
            cashSessionId: p.cashSessionId || targetSession?.id,
          };
          paymentsToSave.push(updatedP);
          return updatedP;
        });
      } else {
        // Multi-payment sale: update metadata on existing entries, then add delta or trim excess
        let remainingToTrim = Math.max(0, existingPaymentsTotal - newTotalPaid);
        const deltaToAdd = Math.max(0, newTotalPaid - existingPaymentsTotal);
        const updatedList: PaymentRecord[] = [];

        for (const p of payments) {
          if (p.saleId !== existingSale.id) {
            updatedList.push(p);
            continue;
          }
          let amt = Number(p.amount) || 0;
          if (remainingToTrim > 0) {
            const cut = Math.min(amt, remainingToTrim);
            amt -= cut;
            remainingToTrim -= cut;
          }
          if (amt <= 0) {
            paymentIdsToDelete.push(p.id);
            continue;
          }
          const updatedP: PaymentRecord = {
            ...p,
            date: newDate,
            amount: amt,
            method: params.paymentMethod || p.method,
            warehouseId: newWarehouseId,
            customerId: newCustomerId,
            customerName: updatedSale.customerName,
          };
          paymentsToSave.push(updatedP);
          updatedList.push(updatedP);
        }

        if (deltaToAdd > 0) {
          const extraPay: PaymentRecord = {
            id: generatePaymentId(),
            date: newDate,
            saleId: existingSale.id,
            customerId: newCustomerId,
            customerName: updatedSale.customerName,
            cashSessionId: targetSession?.id,
            warehouseId: newWarehouseId,
            method: effectiveMethod,
            amount: deltaToAdd,
            userId: currentUser.id,
            userName: currentUser.name,
            reference: existingSale.receiptNumber,
            notes: `Complément encaissement vente ${existingSale.receiptNumber}`,
          };
          paymentsToSave.push(extraPay);
          updatedList.unshift(extraPay);
        }
        nextPayments = updatedList;
      }

      setPayments(nextPayments);
      safeSetLocalStorage('payments', nextPayments);
      if (paymentIdsToDelete.length > 0) {
        markIdsDeleted('payments', paymentIdsToDelete);
        deletePaymentsFromFirebase(paymentIdsToDelete).catch(console.warn);
      }
      paymentsToSave.forEach((p) => savePaymentToFirebase(p).catch(console.warn));
    }

    // Synchronisation du Journal des flux de caisse (CashMovement) & Session(s) de caisse
    const targetGrossCashIn = newTotalPaid + existingSaleCashOutRefundTotal;
    const needsCashSync =
      existingSaleCashInTotal !== targetGrossCashIn ||
      params.paymentMethod !== undefined ||
      newDate !== existingSale.date ||
      newWarehouseId !== existingSale.warehouseId ||
      newCustomerId !== existingSale.customerId;

    if (needsCashSync && existingSale.status !== 'CANCELLED' && existingSale.status !== 'REFUNDED') {
      const cashMvtsToSave: CashMovement[] = [];
      const cashMvtIdsToDelete: string[] = [];
      const affectedSessionIds = new Set<string>();
      let nextCashMovements = cashMovements;

      if (targetGrossCashIn <= 0) {
        existingSaleCashInMvts.forEach((m) => {
          cashMvtIdsToDelete.push(m.id);
          affectedSessionIds.add(m.cashSessionId);
        });
        nextCashMovements = cashMovements.filter((m) => !isSaleCashInMvt(m));
      } else if (existingSaleCashInMvts.length === 0) {
        if (targetSession) {
          const isCash = effectiveMethod === 'ESPECES';
          const createdCashMvt: CashMovement = {
            id: generateCashMovementId('CSM-SALE'),
            cashSessionId: targetSession.id,
            warehouseId: newWarehouseId,
            date: newDate,
            type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
            method: effectiveMethod,
            amount: targetGrossCashIn,
            isCashInDrawer: isCash,
            direction: 'IN',
            reason: `Vente ${existingSale.receiptNumber} (${effectiveMethod})`,
            saleId: existingSale.id,
            customerId: newCustomerId,
            documentRef: existingSale.receiptNumber,
            userId: currentUser.id,
            userName: currentUser.name,
          };
          cashMvtsToSave.push(createdCashMvt);
          affectedSessionIds.add(targetSession.id);
          nextCashMovements = [createdCashMvt, ...cashMovements];
        }
      } else if (existingSaleCashInMvts.length === 1) {
        const targetMvtId = existingSaleCashInMvts[0].id;
        nextCashMovements = cashMovements.map((m) => {
          if (m.id !== targetMvtId) {
            // Also keep any return refund date synced if date changed
            if (
              newDate !== existingSale.date &&
              (m.saleId === existingSale.id || m.documentRef === existingSale.receiptNumber)
            ) {
              const syncedM = { ...m, date: newDate };
              cashMvtsToSave.push(syncedM);
              return syncedM;
            }
            return m;
          }
          const nextMethod = params.paymentMethod || m.method;
          const isCash = nextMethod === 'ESPECES';
          affectedSessionIds.add(m.cashSessionId);
          const updatedM: CashMovement = {
            ...m,
            date: newDate,
            warehouseId: newWarehouseId,
            amount: targetGrossCashIn,
            method: nextMethod,
            type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
            isCashInDrawer: isCash,
            reason: `Vente ${existingSale.receiptNumber} (${nextMethod})`,
            customerId: newCustomerId,
          };
          cashMvtsToSave.push(updatedM);
          return updatedM;
        });
      } else {
        // Multi-movement sale
        let remainingToTrim = Math.max(0, existingSaleCashInTotal - targetGrossCashIn);
        const deltaToAdd = Math.max(0, targetGrossCashIn - existingSaleCashInTotal);
        const updatedList: CashMovement[] = [];

        for (const m of cashMovements) {
          if (!isSaleCashInMvt(m)) {
            if (
              newDate !== existingSale.date &&
              (m.saleId === existingSale.id || m.documentRef === existingSale.receiptNumber)
            ) {
              const syncedM = { ...m, date: newDate };
              cashMvtsToSave.push(syncedM);
              updatedList.push(syncedM);
            } else {
              updatedList.push(m);
            }
            continue;
          }
          let amt = Number(m.amount) || 0;
          affectedSessionIds.add(m.cashSessionId);
          if (remainingToTrim > 0) {
            const cut = Math.min(amt, remainingToTrim);
            amt -= cut;
            remainingToTrim -= cut;
          }
          if (amt <= 0) {
            cashMvtIdsToDelete.push(m.id);
            continue;
          }
          const nextMethod = params.paymentMethod || m.method;
          const isCash = nextMethod === 'ESPECES';
          const updatedM: CashMovement = {
            ...m,
            date: newDate,
            amount: amt,
            method: nextMethod,
            type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
            isCashInDrawer: isCash,
            warehouseId: newWarehouseId,
            customerId: newCustomerId,
          };
          cashMvtsToSave.push(updatedM);
          updatedList.push(updatedM);
        }

        if (deltaToAdd > 0 && targetSession) {
          const isCash = effectiveMethod === 'ESPECES';
          const extraMvt: CashMovement = {
            id: generateCashMovementId('CSM-SALE'),
            cashSessionId: targetSession.id,
            warehouseId: existingSale.warehouseId,
            date: newDate,
            type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
            method: effectiveMethod,
            amount: deltaToAdd,
            isCashInDrawer: isCash,
            direction: 'IN',
            reason: `Complément vente ${existingSale.receiptNumber} (${effectiveMethod})`,
            saleId: existingSale.id,
            customerId: newCustomerId,
            documentRef: existingSale.receiptNumber,
            userId: currentUser.id,
            userName: currentUser.name,
          };
          cashMvtsToSave.push(extraMvt);
          affectedSessionIds.add(targetSession.id);
          updatedList.unshift(extraMvt);
        }
        nextCashMovements = updatedList;
      }

      if (cashMvtsToSave.length > 0 || cashMvtIdsToDelete.length > 0) {
        setCashMovements(nextCashMovements);
        safeSetLocalStorage('cash_movements', nextCashMovements);
        if (cashMvtIdsToDelete.length > 0) {
          markIdsDeleted('cashMovements', cashMvtIdsToDelete);
          deleteCashMovementsFromFirebase(cashMvtIdsToDelete).catch(console.warn);
        }
        cashMvtsToSave.forEach((m) => saveCashMovementToFirebase(m).catch(console.warn));
        if (affectedSessionIds.size > 0) {
          syncCashSessionsTheoreticalBalance(affectedSessionIds, nextCashMovements);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. Recalcul strict du solde client (ancien et/ou nouveau client rattaché)
    // -----------------------------------------------------------------------
    const affectedCustomerIds = new Set<string>();
    if (existingSale.customerId) affectedCustomerIds.add(existingSale.customerId);
    if (newCustomerId) affectedCustomerIds.add(newCustomerId);

    if (affectedCustomerIds.size > 0) {
      const nowIso = new Date().toISOString();
      setCustomers((prev) => {
        const nextCusts = prev.map((c) => {
          if (!affectedCustomerIds.has(c.id)) return c;
          const summary = getCustomerCreditSummary(c, nextSales, nextPayments);
          const updated: Customer = {
            ...c,
            outstandingBalance: summary.creance,
            depositBalance: summary.avanceDisponible,
            updatedAt: nowIso,
          };
          saveCustomerToFirebase(updated).catch(console.warn);
          return updated;
        });
        safeSetLocalStorage('customers', nextCusts);
        return nextCusts;
      });
    }

    // -----------------------------------------------------------------------
    // 3. Synchronisation des mouvements de stock liés (date + ajustements quantités)
    // -----------------------------------------------------------------------
    if (newDate !== existingSale.date || stockAdjMovements.length > 0) {
      setMovements((prev) => {
        const dateSynced =
          newDate !== existingSale.date
            ? prev.map((m) => {
                if (m.documentRef === existingSale.id) {
                  const updatedMvt = { ...m, date: newDate };
                  saveMovementToFirebase(updatedMvt).catch(console.warn);
                  return updatedMvt;
                }
                return m;
              })
            : prev;
        const next = stockAdjMovements.length > 0 ? [...stockAdjMovements, ...dateSynced] : dateSynced;
        if (stockAdjMovements.length > 0) {
          stockAdjMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));
        }
        safeSetLocalStorage('movements', next);
        return next;
      });
    }

    return { success: true };
  };

  // Réconciliation manuelle 1-clic d'une vente encaissée absente du Journal Caisse
  // (ex: vente à crédit modifiée précédemment avant la mise à jour)
  const syncSaleToCashJournal = (
    saleId: string,
    cashSessionId: string,
    method: PaymentMethod
  ): { success: boolean; error?: string; message?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable.' };
    if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
      return { success: false, error: 'Impossible de synchroniser une vente annulée ou remboursée.' };
    }

    const session = cashSessions.find((s) => s.id === cashSessionId);
    if (!session) return { success: false, error: 'Session de caisse introuvable.' };

    const saleCashIn = cashMovements
      .filter(
        (m) =>
          (m.saleId === sale.id || m.documentRef === sale.receiptNumber) &&
          (m.type === 'VENTE_ESPECES' || m.type === 'VENTE_DIGITAL') &&
          m.direction === 'IN'
      )
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const saleCashOut = cashMovements
      .filter(
        (m) =>
          (m.saleId === sale.id || m.documentRef === sale.receiptNumber) &&
          m.type === 'REMBOURSEMENT' &&
          m.direction === 'OUT'
      )
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const netRecordedCash = Math.max(0, saleCashIn - saleCashOut);
    const missingCashAmount = Math.max(0, (Number(sale.totalPaid) || 0) - netRecordedCash);
    if (missingCashAmount <= 0) {
      return { success: false, error: 'Cette vente est déjà entièrement enregistrée dans le journal de caisse.' };
    }

    const isCash = method === 'ESPECES';
    const newCashMvt: CashMovement = {
      id: generateCashMovementId('CSM-SALE'),
      cashSessionId: session.id,
      warehouseId: sale.warehouseId,
      date: sale.date,
      type: isCash ? 'VENTE_ESPECES' : 'VENTE_DIGITAL',
      method,
      amount: missingCashAmount,
      isCashInDrawer: isCash,
      direction: 'IN',
      reason: `Vente ${sale.receiptNumber} (${method})`,
      saleId: sale.id,
      customerId: sale.customerId,
      documentRef: sale.receiptNumber,
      userId: currentUser.id,
      userName: currentUser.name,
    };

    const nextCashMovements = [newCashMvt, ...cashMovements];
    setCashMovements(nextCashMovements);
    safeSetLocalStorage('cash_movements', nextCashMovements);
    saveCashMovementToFirebase(newCashMvt).catch(console.warn);
    syncCashSessionsTheoreticalBalance(new Set([session.id]), nextCashMovements);

    // Créer également l'écriture PaymentRecord manquante si absente (pour la répartition par mode dans le Bilan Journalier)
    const existingPaySum = payments
      .filter((p) => p.saleId === sale.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const missingPayAmount = Math.max(0, (Number(sale.totalPaid) || 0) - existingPaySum);

    if (missingPayAmount > 0) {
      const newPayment: PaymentRecord = {
        id: generatePaymentId(),
        date: sale.date,
        saleId: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        cashSessionId: session.id,
        warehouseId: sale.warehouseId,
        method,
        amount: missingPayAmount,
        userId: currentUser.id,
        userName: currentUser.name,
        reference: sale.receiptNumber,
        notes: `Encaissement vente ${sale.receiptNumber}`,
      };
      const nextPayments = [newPayment, ...payments];
      setPayments(nextPayments);
      safeSetLocalStorage('payments', nextPayments);
      savePaymentToFirebase(newPayment).catch(console.warn);
    }

    return {
      success: true,
      message: `La vente ${sale.receiptNumber} (${missingCashAmount.toLocaleString('fr-FR')} FCFA en ${method}) a été intégrée au journal de la session ${session.id}.`,
    };
  };

  // Operation: RETOUR DE PIÈCES — REMBOURSEMENT CLIENT OU AVOIR CLIENT
  const processSaleReturn = (
    params: ProcessSaleReturnParams
  ): { success: boolean; error?: string; returnRecord?: SaleReturn } => {
    const sale = sales.find((s) => s.id === params.saleId);
    if (!sale) return { success: false, error: 'Vente introuvable.' };
    if (sale.status === 'CANCELLED') {
      return { success: false, error: 'Impossible de traiter un retour sur une vente déjà annulée.' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Veuillez sélectionner au moins un article à retourner.' };
    }

    const isRefundMethod =
      params.refundMethod === 'ESPECES' ||
      params.refundMethod === 'WAVE' ||
      params.refundMethod === 'ORANGE_MONEY';
    const isAvoirMethod = params.refundMethod === 'AVOIR_CLIENT';
    const docPrefix = isAvoirMethod ? 'AVOIR' : isRefundMethod ? 'REMB' : 'RET';
    const docLabel = isAvoirMethod
      ? 'Bon de retour / Avoir'
      : isRefundMethod
      ? `Bon de retour / Remboursement (${params.refundMethod})`
      : 'Bon de retour stock';

    const returnId = generateSaleId().replace('VTE-', 'RET-');
    const returnNumber = `${docPrefix}-${new Date().getFullYear()}-${String(returns.length + 1).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    let totalRefund = 0;
    const returnItems: SaleReturnItem[] = [];
    let nextStocks = [...stocks];
    const newMovements: StockMovement[] = [];

    for (const it of params.items) {
      const saleItem = sale.items.find((si) => si.articleId === it.articleId);
      if (!saleItem) continue;
      const alreadyReturnedQty = (sale.returns || []).reduce((sum, ret) => {
        const match = ret.items.find((ri) => ri.articleId === it.articleId);
        return sum + (match ? match.quantity : 0);
      }, 0);
      const maxReturnableQty = Math.max(0, saleItem.quantity - alreadyReturnedQty);
      const returnQty = Math.min(it.quantity, maxReturnableQty);
      if (returnQty <= 0) continue;

      const { lineRefund, netUnitPrice } = getSaleItemReturnRefund(sale, saleItem, returnQty);
      totalRefund += lineRefund;

      const targetWhId = it.warehouseId || sale.warehouseId;
      const currentQty = getStockForArticleAndWarehouse(it.articleId, targetWhId);
      const isDefective = it.reason === 'DEFECTIVE';

      // Re-increment stock physically ONLY if the returned piece is NOT defective
      if (!isDefective) {
        nextStocks = applyStockDelta(nextStocks, it.articleId, targetWhId, returnQty, saleItem.brand);
      }

      const mvtId = generateMovementId();
      newMovements.push({
        id: mvtId,
        date: nowIso,
        type: 'ENTREE',
        articleId: it.articleId,
        quantity: returnQty,
        targetWarehouseId: targetWhId,
        userId: currentUser.id,
        userName: currentUser.name,
        documentRef: returnNumber,
        reason: isDefective
          ? `Retour pièce DÉFECTUEUSE vente ${sale.receiptNumber} (Non réintégrée au stock)${it.reasonDetail ? `: ${it.reasonDetail}` : ''}`
          : `Retour pièce vente ${sale.receiptNumber} (${it.reason})${it.reasonDetail ? `: ${it.reasonDetail}` : ''}`,
        thirdParty: sale.customerName,
        unitPrice: netUnitPrice,
        totalPrice: lineRefund,
        stockBefore: currentQty,
        stockAfter: isDefective ? currentQty : currentQty + returnQty,
        notes: isDefective
          ? `${docLabel} ${returnNumber} — Pièce défectueuse exclue du stock disponible`
          : `${docLabel} ${returnNumber}`,
      });

      returnItems.push({
        articleId: it.articleId,
        mainReference: saleItem.mainReference,
        designation: saleItem.designation,
        brand: saleItem.brand,
        quantity: returnQty,
        unitPrice: netUnitPrice,
        totalRefund: lineRefund,
        warehouseId: targetWhId,
        reason: it.reason,
        reasonDetail: it.reasonDetail,
      });
    }

    if (returnItems.length === 0) {
      return { success: false, error: 'Aucun article valide à retourner.' };
    }

    // Cap cumulative return refunds at the net sale totalAmount (after all discounts)
    const previousReturnedTotal = (sale.returns || []).reduce(
      (sum, r) => sum + (Number(r.totalRefundAmount) || 0),
      0
    );
    const maxRemainingRefundable = Math.max(
      0,
      (Number(sale.totalAmount) || 0) - previousReturnedTotal
    );
    if (totalRefund > maxRemainingRefundable) {
      totalRefund = maxRemainingRefundable;
    }

    // Calculate debt deduction vs surplus refund
    const currentRemainingDue = Math.max(0, sale.remainingDue || 0);
    const effectiveDebtReduction = Math.min(currentRemainingDue, totalRefund);
    const surplusRefund = Math.max(0, totalRefund - effectiveDebtReduction);
    const newSaleRemainingDue = Math.max(0, currentRemainingDue - effectiveDebtReduction);

    const returnRecord: SaleReturn = {
      id: returnId,
      returnNumber,
      date: nowIso,
      saleId: sale.id,
      saleReceiptNumber: sale.receiptNumber,
      customerId: sale.customerId,
      customerName: sale.customerName,
      warehouseId: sale.warehouseId,
      warehouseName: sale.warehouseName,
      userId: currentUser.id,
      userName: currentUser.name,
      items: returnItems,
      totalRefundAmount: totalRefund,
      refundMethod: params.refundMethod,
      debtDeducted: effectiveDebtReduction,
      cashRefunded: surplusRefund,
      notes: params.notes,
    };

    // 1. Stock & Movement update
    setStocks(nextStocks);
    setMovements((prev) => [...newMovements, ...prev]);
    saveMultipleStocksToFirebase(nextStocks).catch(console.warn);
    newMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));

    // 2. Customer Debt & Account update
    // IMPORTANT: Only AVOIR_CLIENT adds surplus to customer deposit/avoir!
    // Reimbursements (ESPECES, WAVE, ORANGE_MONEY) are paid out to the customer and NEVER added to avoir.
    if (sale.customerId) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== sale.customerId) return c;
          let newDebt = Math.max(0, c.outstandingBalance || 0);
          let newDeposit = Math.max(0, c.depositBalance || 0);

          // Priority 1: Deduct the debt portion of this credit sale from customer's outstanding balance
          if (effectiveDebtReduction > 0) {
            newDebt = Math.max(0, newDebt - effectiveDebtReduction);
          }

          // Priority 2: ONLY if AVOIR_CLIENT and surplus exists, offset any other general debt or add to deposit
          if (isAvoirMethod && surplusRefund > 0) {
            if (newDebt > 0) {
              const extraDeduct = Math.min(newDebt, surplusRefund);
              newDebt -= extraDeduct;
              const surplusForDeposit = surplusRefund - extraDeduct;
              newDeposit += surplusForDeposit;
            } else {
              newDeposit += surplusRefund;
            }
          }

          const updated: Customer = {
            ...c,
            outstandingBalance: newDebt,
            depositBalance: newDeposit,
            updatedAt: nowIso,
          };
          saveCustomerToFirebase(updated).catch(console.warn);
          return updated;
        })
      );
    }

    // 3. Cash / Digital Register handling & PaymentRecord adjustment when refunded (ESPECES, WAVE, ORANGE_MONEY)
    if (isRefundMethod && surplusRefund > 0) {
      const activeSession =
        getActiveCashSession(sale.warehouseId) || cashSessions.find((s) => s.status === 'OPEN');
      if (activeSession) {
        const csmId = generateCashMovementId('CSM-RET');
        const reasonDesc =
          effectiveDebtReduction > 0
            ? `Remboursement retour ${returnNumber} (${params.refundMethod} — reliquat après déduction créance de ${effectiveDebtReduction.toLocaleString('fr-FR')} F)`
            : `Remboursement retour ${returnNumber} (Vente ${sale.receiptNumber})`;

        const cashMvt: CashMovement = {
          id: csmId,
          cashSessionId: activeSession.id,
          warehouseId: sale.warehouseId,
          date: nowIso,
          type: 'DEPENSE',
          method: params.refundMethod as PaymentMethod,
          amount: surplusRefund,
          isCashInDrawer: params.refundMethod === 'ESPECES',
          direction: 'OUT',
          reason: reasonDesc,
          documentRef: returnNumber,
          userId: currentUser.id,
          userName: currentUser.name,
          notes: `Remboursement ${params.refundMethod} client ${sale.customerName}`,
        };
        setCashMovements((prev) => [cashMvt, ...prev]);
        saveCashMovementToFirebase(cashMvt).catch(console.warn);

        if (params.refundMethod === 'ESPECES') {
          const updatedSession = {
            ...activeSession,
            theoreticalCash: Math.max(0, activeSession.theoreticalCash - surplusRefund),
          };
          setCashSessions((prev) =>
            prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
          );
          saveCashSessionToFirebase(updatedSession).catch(console.warn);
        }
      }

      // Reduce the PaymentRecord(s) linked to this sale by the refunded amount so it is not counted as encaissé or acompte/avoir
      let remainingToDeductFromPay = surplusRefund;
      const updatedPaymentRecords: PaymentRecord[] = [];
      const removedPaymentIds: string[] = [];

      setPayments((prev) => {
        const next: PaymentRecord[] = [];
        for (const p of prev) {
          if (p.saleId === sale.id && remainingToDeductFromPay > 0) {
            const pAmt = Number(p.amount) || 0;
            const deduct = Math.min(pAmt, remainingToDeductFromPay);
            remainingToDeductFromPay -= deduct;
            const newAmt = pAmt - deduct;
            if (newAmt > 0) {
              const updatedP: PaymentRecord = {
                ...p,
                amount: newAmt,
                notes: `${p.notes || ''} (Net après remboursement ${returnNumber} de ${deduct.toLocaleString('fr-FR')} F)`.trim(),
              };
              next.push(updatedP);
              updatedPaymentRecords.push(updatedP);
            } else {
              removedPaymentIds.push(p.id);
            }
          } else {
            next.push(p);
          }
        }
        safeSetLocalStorage('payments', next);
        return next;
      });

      updatedPaymentRecords.forEach((up) => savePaymentToFirebase(up).catch(console.warn));
      if (removedPaymentIds.length > 0) {
        markIdsDeleted('payments', removedPaymentIds);
        deletePaymentsFromFirebase(removedPaymentIds).catch(console.warn);
      }
    }

    // 4. Update Sale record with adjusted totalPaid (if reimbursed), remainingDue, paymentStatus, and REFUNDED status if 100% returned
    const allReturns = [...(sale.returns || []), returnRecord];
    const isFullyReturned = sale.items.every((si) => {
      const returnedQty = allReturns.reduce((sum, r) => {
        const match = r.items.find((ri) => ri.articleId === si.articleId);
        return sum + (match ? match.quantity : 0);
      }, 0);
      return returnedQty >= si.quantity;
    });

    const newSaleTotalPaid = isRefundMethod
      ? Math.max(0, (sale.totalPaid || 0) - surplusRefund)
      : sale.totalPaid;

    let newPaymentStatus = sale.paymentStatus;
    if (newSaleRemainingDue === 0) {
      newPaymentStatus = 'PAID';
    } else {
      newPaymentStatus = newSaleTotalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    }

    const updatedSale: Sale = {
      ...sale,
      status: isFullyReturned ? 'REFUNDED' : sale.status,
      totalPaid: newSaleTotalPaid,
      remainingDue: newSaleRemainingDue,
      paymentStatus: newPaymentStatus,
      refundedAmount: (sale.refundedAmount || 0) + totalRefund,
      returns: allReturns,
    };

    setSales((prev) => {
      const next = prev.map((s) => (s.id === sale.id ? updatedSale : s));
      safeSetLocalStorage('sales', next);
      return next;
    });
    setReturns((prev) => {
      const next = [returnRecord, ...prev];
      safeSetLocalStorage('returns', next);
      return next;
    });
    saveSaleToFirebase(updatedSale).catch(console.warn);
    saveReturnToFirebase(returnRecord).catch(console.warn);

    return { success: true, returnRecord };
  };

  // Operation: ENTRÉE DE STOCK
  const recordStockIn = (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
    brand?: string;
    location?: string;
    unitPrice?: number;
    supplier?: string;
    documentRef: string;
    reason: string;
    notes?: string;
  }): { success: boolean; error?: string } => {
    if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
      return { success: false, error: 'La quantité entrée doit être un nombre entier supérieur à zéro.' };
    }
    const article = articles.find((a) => a.id === params.articleId);
    if (!article) return { success: false, error: 'Article introuvable dans le catalogue.' };

    const warehouse = warehouses.find((w) => w.id === params.warehouseId);
    if (!warehouse) return { success: false, error: 'Magasin destinataire introuvable.' };

    if (!params.documentRef.trim()) {
      return { success: false, error: 'La référence du document (BL ou Facture) est obligatoire pour la traçabilité.' };
    }

    const currentQty = getStockForArticleAndWarehouse(params.articleId, params.warehouseId);
    const newQty = currentQty + params.quantity;
    const unitPrice = params.unitPrice !== undefined && params.unitPrice >= 0 ? params.unitPrice : article.purchasePrice;
    const targetBrand = (params.brand || article.brand || '').trim();
    const formattedInLoc =
      params.location && params.location.trim() && params.location.trim() !== 'Non renseigné'
        ? prefixLocationWithWarehouse(params.location, warehouse.name, warehouses)
        : undefined;

    const newMvtId = generateMovementId();
    const newMovement: StockMovement = {
      id: newMvtId,
      date: new Date().toISOString(),
      type: 'ENTREE',
      articleId: params.articleId,
      quantity: params.quantity,
      targetWarehouseId: params.warehouseId,
      userId: currentUser.id,
      userName: currentUser.name,
      documentRef: params.documentRef.trim(),
      reason: params.reason.trim() || 'Réception de marchandises',
      thirdParty: params.supplier?.trim() || 'Fournisseur direct',
      unitPrice,
      totalPrice: unitPrice * params.quantity,
      stockBefore: currentQty,
      stockAfter: newQty,
      notes: params.notes?.trim(),
    };

    setStocks((prev) => {
      let next = applyStockDelta(prev, params.articleId, params.warehouseId, params.quantity, targetBrand);
      if (formattedInLoc) {
        next = next.map((s) => {
          if (s.articleId === params.articleId && s.warehouseId === params.warehouseId) {
            const nextBrandLocs = { ...(s.brandLocations || {}) };
            const bKey =
              Object.keys(nextBrandLocs).find(
                (k) => k.toLowerCase().trim() === targetBrand.toLowerCase().trim()
              ) || targetBrand;
            nextBrandLocs[bKey] = formattedInLoc;
            return {
              ...s,
              shelfLocation: formattedInLoc,
              brandLocations: nextBrandLocs,
            };
          }
          return s;
        });
      }
      safeSetLocalStorage('stocks', next);
      const updatedStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.warehouseId);
      if (updatedStock) saveStockToFirebase(updatedStock).catch(console.warn);
      return next;
    });

    // Register new brand in article.brandOffers if it didn't exist yet on this reference
    setArticles((prevArticles) => {
      const nextArticles = prevArticles.map((art) => {
        if (art.id !== params.articleId) return art;
        const currentOffers: ArticleBrandOffer[] =
          art.brandOffers && art.brandOffers.length > 0
            ? [...art.brandOffers]
            : [
                {
                  id: `bo_${art.id}_init`,
                  brand: art.brand || '',
                  brandReference: art.mainReference,
                  purchasePrice: art.purchasePrice,
                  salePrice: art.salePrice,
                  location: art.defaultLocation,
                  isDefault: true,
                },
              ];

        const normTarget = targetBrand.toLowerCase().trim();
        const existingIdx = currentOffers.findIndex(
          (o) => o.brand.toLowerCase().trim() === normTarget
        );

        if (existingIdx === -1) {
          currentOffers.push({
            id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            brand: targetBrand,
            brandReference: art.mainReference,
            purchasePrice: unitPrice,
            salePrice: art.salePrice,
            location: formattedInLoc || art.defaultLocation || 'Non renseigné',
            preferredSupplier: params.supplier?.trim() || art.preferredSupplier,
            isDefault: currentOffers.length === 0,
          });
        } else {
          currentOffers[existingIdx] = {
            ...currentOffers[existingIdx],
            purchasePrice: unitPrice > 0 ? unitPrice : currentOffers[existingIdx].purchasePrice,
            ...(formattedInLoc ? { location: formattedInLoc } : {}),
          };
        }

        const updatedArt: Article = {
          ...art,
          brandOffers: currentOffers,
          updatedAt: new Date().toISOString(),
        };
        saveArticleToFirebase(updatedArt).catch(console.warn);
        return updatedArt;
      });
      safeSetLocalStorage('articles', nextArticles);
      return nextArticles;
    });

    setMovements((prev) => {
      const nextMvts = [newMovement, ...prev];
      safeSetLocalStorage('movements', nextMvts);
      return nextMvts;
    });
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
  };

  // Operation: SORTIE DE STOCK
  const recordStockOut = (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
    brand?: string;
    client?: string;
    documentRef: string;
    reason: string;
    notes?: string;
    allowNegativeOverride?: boolean;
  }): { success: boolean; error?: string } => {
    if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
      return { success: false, error: 'La quantité sortie doit être un nombre entier supérieur à zéro.' };
    }
    const article = articles.find((a) => a.id === params.articleId);
    if (!article) return { success: false, error: 'Article introuvable.' };

    const warehouse = warehouses.find((w) => w.id === params.warehouseId);
    if (!warehouse) return { success: false, error: 'Magasin source introuvable.' };

    const currentQty = getStockForArticleAndWarehouse(params.articleId, params.warehouseId);

    // CRITICAL BUSINESS RULE: Strictly refuse if stock would become negative
    if (currentQty < params.quantity) {
      if (!params.allowNegativeOverride || currentUser.role !== 'ADMIN') {
        return {
          success: false,
          error: `Stock insuffisant dans le magasin ${warehouse.name}. Disponible : ${currentQty} ${article.unit}(s), demandé : ${params.quantity}. Sortie bloquée.`,
        };
      }
    }

    if (!params.documentRef.trim()) {
      return { success: false, error: 'La référence du document (Bon de sortie / Ordre) est obligatoire.' };
    }

    const newQty = currentQty - params.quantity;
    const unitPrice = article.salePrice;

    const newMvtId = generateMovementId();
    const newMovement: StockMovement = {
      id: newMvtId,
      date: new Date().toISOString(),
      type: 'SORTIE',
      articleId: params.articleId,
      quantity: params.quantity,
      sourceWarehouseId: params.warehouseId,
      userId: currentUser.id,
      userName: currentUser.name,
      documentRef: params.documentRef.trim(),
      reason: params.reason.trim() || 'Sortie pour utilisation ou vente',
      thirdParty: params.client?.trim() || 'Client / Chantier BTP',
      unitPrice,
      totalPrice: unitPrice * params.quantity,
      stockBefore: currentQty,
      stockAfter: newQty,
      notes: params.notes?.trim(),
    };

    setStocks((prev) => {
      const next = applyStockDelta(prev, params.articleId, params.warehouseId, -params.quantity, params.brand);
      safeSetLocalStorage('stocks', next);
      const updatedStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.warehouseId);
      if (updatedStock) saveStockToFirebase(updatedStock).catch(console.warn);
      return next;
    });
    setMovements((prev) => {
      const nextMvts = [newMovement, ...prev];
      safeSetLocalStorage('movements', nextMvts);
      return nextMvts;
    });
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
  };

  // Operation: TRANSFERT ENTRE MAGASINS
  const recordTransfer = (params: {
    articleId: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    quantity: number;
    brand?: string;
    targetLocation?: string;
    documentRef: string;
    reason: string;
    notes?: string;
  }): { success: boolean; error?: string } => {
    if (params.sourceWarehouseId === params.targetWarehouseId) {
      return { success: false, error: 'Le magasin de départ et le magasin d’arrivée doivent être différents.' };
    }

    if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
      return { success: false, error: 'La quantité à transférer doit être un entier supérieur à zéro.' };
    }

    const article = articles.find((a) => a.id === params.articleId);
    if (!article) return { success: false, error: 'Article introuvable.' };

    const sourceWh = warehouses.find((w) => w.id === params.sourceWarehouseId);
    const targetWh = warehouses.find((w) => w.id === params.targetWarehouseId);
    if (!sourceWh || !targetWh) return { success: false, error: 'Magasin source ou destinataire introuvable.' };

    const sourceStockRecord = stocks.find(
      (s) => s.articleId === params.articleId && s.warehouseId === params.sourceWarehouseId
    );
    const sourceQty = Math.max(0, Number(sourceStockRecord?.quantity) || 0);
    if (sourceQty < params.quantity) {
      return {
        success: false,
        error: `Stock insuffisant au départ de ${sourceWh.name}. Disponible : ${sourceQty}, demandé : ${params.quantity}.`,
      };
    }

    const requestedBrand = params.brand?.trim();
    if (requestedBrand && sourceStockRecord?.brandBreakdown && Object.keys(sourceStockRecord.brandBreakdown).length > 0) {
      const normReq = requestedBrand.toLowerCase();
      const matchedKey = Object.keys(sourceStockRecord.brandBreakdown).find(
        (k) => k.toLowerCase().trim() === normReq
      );
      if (matchedKey !== undefined) {
        const brandAvail = Math.max(0, Number(sourceStockRecord.brandBreakdown[matchedKey]) || 0);
        if (brandAvail > 0 && brandAvail < params.quantity) {
          return {
            success: false,
            error: `Stock insuffisant pour la marque "${requestedBrand}" dans ${sourceWh.name}. Disponible : ${brandAvail}, demandé : ${params.quantity}.`,
          };
        }
      }
    }

    if (!params.documentRef.trim()) {
      return { success: false, error: 'Le numéro de bordereau de transfert est obligatoire.' };
    }

    const newSourceQty = Math.max(0, sourceQty - params.quantity);
    const nowIso = new Date().toISOString();
    const formattedTargetLocation =
      params.targetLocation &&
      params.targetLocation.trim() &&
      params.targetLocation.trim() !== 'Non renseigné'
        ? prefixLocationWithWarehouse(params.targetLocation, targetWh.name, warehouses)
        : undefined;

    const newMvtId = generateMovementId();
    const newMovement: StockMovement = {
      id: newMvtId,
      date: nowIso,
      type: 'TRANSFERT',
      articleId: params.articleId,
      quantity: params.quantity,
      sourceWarehouseId: params.sourceWarehouseId,
      targetWarehouseId: params.targetWarehouseId,
      userId: currentUser.id,
      userName: currentUser.name,
      documentRef: params.documentRef.trim(),
      reason:
        params.reason.trim() ||
        `Transfert de ${sourceWh.code} vers ${targetWh.code}${requestedBrand ? ` (${requestedBrand})` : ''}`,
      thirdParty: `${sourceWh.name} ➔ ${targetWh.name}`,
      unitPrice: article.purchasePrice,
      totalPrice: article.purchasePrice * params.quantity,
      stockBefore: sourceQty,
      stockAfter: newSourceQty,
      notes: params.notes?.trim(),
    };

    setStocks((prev) => {
      const prevSource = prev.find(
        (s) => s.articleId === params.articleId && s.warehouseId === params.sourceWarehouseId
      );

      // Compute exact per-brand quantities to deduct from source and add to target
      const transferredByBrand: Record<string, number> = {};
      const defaultBrandName = (requestedBrand || article.brand || article.brandOffers?.[0]?.brand || '').trim();

      if (prevSource?.brandBreakdown && Object.keys(prevSource.brandBreakdown).length > 0) {
        let remainingToDeduct = params.quantity;
        if (requestedBrand) {
          const normReq = requestedBrand.toLowerCase();
          const matchedKey = Object.keys(prevSource.brandBreakdown).find(
            (k) => k.toLowerCase().trim() === normReq
          );
          if (matchedKey !== undefined) {
            const avail = Math.max(0, Number(prevSource.brandBreakdown[matchedKey]) || 0);
            const take = Math.min(avail, remainingToDeduct);
            if (take > 0) {
              transferredByBrand[matchedKey] = take;
              remainingToDeduct -= take;
            }
          }
        }
        // Deduct any remaining quantity across available brands in source
        if (remainingToDeduct > 0) {
          for (const k of Object.keys(prevSource.brandBreakdown)) {
            if (remainingToDeduct <= 0) break;
            const alreadyTaken = transferredByBrand[k] || 0;
            const avail = Math.max(0, (Number(prevSource.brandBreakdown[k]) || 0) - alreadyTaken);
            if (avail > 0) {
              const take = Math.min(avail, remainingToDeduct);
              transferredByBrand[k] = alreadyTaken + take;
              remainingToDeduct -= take;
            }
          }
        }
        if (remainingToDeduct > 0) {
          transferredByBrand[defaultBrandName] = (transferredByBrand[defaultBrandName] || 0) + remainingToDeduct;
        }
      } else {
        transferredByBrand[defaultBrandName] = params.quantity;
      }

      let next = [...prev];
      // 1. Deduct each brand quantity from source warehouse
      for (const [bName, bQty] of Object.entries(transferredByBrand)) {
        if (bQty > 0) {
          next = applyStockDelta(next, params.articleId, params.sourceWarehouseId, -bQty, bName);
        }
      }
      // 2. Add each brand quantity to target warehouse
      for (const [bName, bQty] of Object.entries(transferredByBrand)) {
        if (bQty > 0) {
          next = applyStockDelta(next, params.articleId, params.targetWarehouseId, bQty, bName);
        }
      }

      // Ensure target warehouse has its own distinct location (never inheriting sourceWh's location)
      next = next.map((s) => {
        if (s.articleId === params.articleId && s.warehouseId === params.targetWarehouseId) {
          const nextBrandLocs: Record<string, string> = { ...(s.brandLocations || {}) };
          if (formattedTargetLocation) {
            for (const bName of Object.keys(transferredByBrand)) {
              const existingKey =
                Object.keys(nextBrandLocs).find(
                  (k) => k.toLowerCase().trim() === bName.toLowerCase().trim()
                ) || bName;
              nextBrandLocs[existingKey] = formattedTargetLocation;
            }
          }

          const targetShelfLoc = formattedTargetLocation
            ? formattedTargetLocation
            : s.shelfLocation &&
              s.shelfLocation !== 'Non renseigné' &&
              !s.shelfLocation.toLowerCase().startsWith(`${sourceWh.name.toLowerCase()} :`)
            ? prefixLocationWithWarehouse(s.shelfLocation, targetWh.name, warehouses)
            : 'Non renseigné';

          return reconcileWarehouseStock({
            ...s,
            shelfLocation: targetShelfLoc,
            brandLocations:
              Object.keys(nextBrandLocs).length > 0 ? nextBrandLocs : s.brandLocations,
            lastInventoryDate: nowIso,
          });
        }
        if (s.articleId === params.articleId && s.warehouseId === params.sourceWarehouseId) {
          return reconcileWarehouseStock({
            ...s,
            lastInventoryDate: nowIso,
          });
        }
        return s;
      });

      safeSetLocalStorage('stocks', next);
      const affected = next.filter(
        (s) =>
          s.articleId === params.articleId &&
          (s.warehouseId === params.sourceWarehouseId || s.warehouseId === params.targetWarehouseId)
      );
      if (affected.length > 0) {
        saveMultipleStocksToFirebase(affected).catch(console.warn);
      }
      return next;
    });

    setMovements((prev) => {
      const nextMvts = [newMovement, ...prev];
      safeSetLocalStorage('movements', nextMvts);
      return nextMvts;
    });
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
  };

  // Operation: TRANSFERT GROUPÉ ATOMIQUE (Réapprovisionnement Boutique / Multi-pièces)
  const recordBatchTransfer = (params: {
    items: Array<{
      articleId: string;
      sourceWarehouseId: string;
      targetWarehouseId: string;
      quantity: number;
      brand?: string;
      targetLocation?: string;
    }>;
    documentRef: string;
    reason: string;
    notes?: string;
  }): {
    success: boolean;
    error?: string;
    transferredCount: number;
    totalUnits: number;
    failedItems?: Array<{ articleId: string; reason: string }>;
  } => {
    if (!params.items || params.items.length === 0) {
      return {
        success: false,
        error: 'Aucune pièce sélectionnée pour le transfert groupé.',
        transferredCount: 0,
        totalUnits: 0,
      };
    }

    const cleanDocRef = params.documentRef.trim();
    if (!cleanDocRef) {
      return {
        success: false,
        error: 'Le numéro de bordereau de transfert est obligatoire.',
        transferredCount: 0,
        totalUnits: 0,
      };
    }

    let workingStocks = [...stocks];
    const createdMovements: StockMovement[] = [];
    const affectedPairs = new Set<string>();
    const failedItems: Array<{ articleId: string; reason: string }> = [];
    const nowIso = new Date().toISOString();
    let totalUnits = 0;

    params.items.forEach((item, idx) => {
      if (item.sourceWarehouseId === item.targetWarehouseId) {
        failedItems.push({
          articleId: item.articleId,
          reason: 'Le dépôt source et le dépôt cible sont identiques.',
        });
        return;
      }

      const qty = Math.floor(Number(item.quantity) || 0);
      if (qty <= 0) {
        failedItems.push({
          articleId: item.articleId,
          reason: 'Quantité invalide.',
        });
        return;
      }

      const article = articles.find((a) => a.id === item.articleId);
      if (!article) {
        failedItems.push({ articleId: item.articleId, reason: 'Article introuvable.' });
        return;
      }

      const sourceWh = warehouses.find((w) => w.id === item.sourceWarehouseId);
      const targetWh = warehouses.find((w) => w.id === item.targetWarehouseId);
      if (!sourceWh || !targetWh) {
        failedItems.push({
          articleId: item.articleId,
          reason: 'Dépôt source ou destinataire introuvable.',
        });
        return;
      }

      const sourceStockRecord = workingStocks.find(
        (s) => s.articleId === item.articleId && s.warehouseId === item.sourceWarehouseId
      );
      const sourceQty = Math.max(0, Number(sourceStockRecord?.quantity) || 0);
      if (sourceQty < qty) {
        failedItems.push({
          articleId: item.articleId,
          reason: `${article.mainReference} : stock insuffisant dans ${sourceWh.name} (${sourceQty} dispo, ${qty} demandé).`,
        });
        return;
      }

      const requestedBrand = item.brand?.trim();
      const transferredByBrand: Record<string, number> = {};
      const defaultBrandName = (
        requestedBrand ||
        article.brand ||
        article.brandOffers?.[0]?.brand ||
        ''
      ).trim();

      if (
        sourceStockRecord?.brandBreakdown &&
        Object.keys(sourceStockRecord.brandBreakdown).length > 0
      ) {
        let remainingToDeduct = qty;
        if (requestedBrand) {
          const normReq = requestedBrand.toLowerCase();
          const matchedKey = Object.keys(sourceStockRecord.brandBreakdown).find(
            (k) => k.toLowerCase().trim() === normReq
          );
          if (matchedKey !== undefined) {
            const avail = Math.max(0, Number(sourceStockRecord.brandBreakdown[matchedKey]) || 0);
            const take = Math.min(avail, remainingToDeduct);
            if (take > 0) {
              transferredByBrand[matchedKey] = take;
              remainingToDeduct -= take;
            }
          }
        }
        if (remainingToDeduct > 0) {
          for (const k of Object.keys(sourceStockRecord.brandBreakdown)) {
            if (remainingToDeduct <= 0) break;
            const alreadyTaken = transferredByBrand[k] || 0;
            const avail = Math.max(
              0,
              (Number(sourceStockRecord.brandBreakdown[k]) || 0) - alreadyTaken
            );
            if (avail > 0) {
              const take = Math.min(avail, remainingToDeduct);
              transferredByBrand[k] = alreadyTaken + take;
              remainingToDeduct -= take;
            }
          }
        }
        if (remainingToDeduct > 0) {
          transferredByBrand[defaultBrandName] =
            (transferredByBrand[defaultBrandName] || 0) + remainingToDeduct;
        }
      } else {
        transferredByBrand[defaultBrandName] = qty;
      }

      for (const [bName, bQty] of Object.entries(transferredByBrand)) {
        if (bQty > 0) {
          workingStocks = applyStockDelta(
            workingStocks,
            item.articleId,
            item.sourceWarehouseId,
            -bQty,
            bName
          );
        }
      }
      for (const [bName, bQty] of Object.entries(transferredByBrand)) {
        if (bQty > 0) {
          workingStocks = applyStockDelta(
            workingStocks,
            item.articleId,
            item.targetWarehouseId,
            bQty,
            bName
          );
        }
      }

      const formattedTargetLocation =
        item.targetLocation &&
        item.targetLocation.trim() &&
        item.targetLocation.trim() !== 'Non renseigné'
          ? prefixLocationWithWarehouse(item.targetLocation, targetWh.name, warehouses)
          : undefined;

      workingStocks = workingStocks.map((s) => {
        if (s.articleId === item.articleId && s.warehouseId === item.targetWarehouseId) {
          const nextBrandLocs: Record<string, string> = { ...(s.brandLocations || {}) };
          if (formattedTargetLocation) {
            for (const bName of Object.keys(transferredByBrand)) {
              const existingKey =
                Object.keys(nextBrandLocs).find(
                  (k) => k.toLowerCase().trim() === bName.toLowerCase().trim()
                ) || bName;
              nextBrandLocs[existingKey] = formattedTargetLocation;
            }
          }
          const targetShelfLoc = formattedTargetLocation
            ? formattedTargetLocation
            : s.shelfLocation &&
              s.shelfLocation !== 'Non renseigné' &&
              !s.shelfLocation.toLowerCase().startsWith(`${sourceWh.name.toLowerCase()} :`)
            ? prefixLocationWithWarehouse(s.shelfLocation, targetWh.name, warehouses)
            : 'Non renseigné';

          return reconcileWarehouseStock({
            ...s,
            shelfLocation: targetShelfLoc,
            brandLocations:
              Object.keys(nextBrandLocs).length > 0 ? nextBrandLocs : s.brandLocations,
            lastInventoryDate: nowIso,
          });
        }
        if (s.articleId === item.articleId && s.warehouseId === item.sourceWarehouseId) {
          return reconcileWarehouseStock({
            ...s,
            lastInventoryDate: nowIso,
          });
        }
        return s;
      });

      affectedPairs.add(`${item.articleId}__${item.sourceWarehouseId}`);
      affectedPairs.add(`${item.articleId}__${item.targetWarehouseId}`);

      const newSourceQty = Math.max(0, sourceQty - qty);
      createdMovements.push({
        id: `${generateMovementId()}-${idx + 1}`,
        date: nowIso,
        type: 'TRANSFERT',
        articleId: item.articleId,
        quantity: qty,
        sourceWarehouseId: item.sourceWarehouseId,
        targetWarehouseId: item.targetWarehouseId,
        userId: currentUser.id,
        userName: currentUser.name,
        documentRef: cleanDocRef,
        reason:
          params.reason.trim() ||
          `Réapprovisionnement boutique (${sourceWh.code} ➔ ${targetWh.code})`,
        thirdParty: `${sourceWh.name} ➔ ${targetWh.name}`,
        unitPrice: article.purchasePrice,
        totalPrice: article.purchasePrice * qty,
        stockBefore: sourceQty,
        stockAfter: newSourceQty,
        notes: params.notes?.trim(),
      });
      totalUnits += qty;
    });

    if (createdMovements.length === 0) {
      return {
        success: false,
        error: failedItems[0]?.reason || 'Aucun transfert valide n’a pu être effectué.',
        transferredCount: 0,
        totalUnits: 0,
        failedItems,
      };
    }

    setStocks(workingStocks);
    safeSetLocalStorage('stocks', workingStocks);

    const affectedRecords = workingStocks.filter((s) =>
      affectedPairs.has(`${s.articleId}__${s.warehouseId}`)
    );
    if (affectedRecords.length > 0) {
      saveMultipleStocksToFirebase(affectedRecords).catch(console.warn);
    }

    setMovements((prev) => {
      const nextMvts = [...createdMovements, ...prev];
      safeSetLocalStorage('movements', nextMvts);
      return nextMvts;
    });
    saveMultipleMovementsToFirebase(createdMovements).catch(console.warn);

    return {
      success: true,
      transferredCount: createdMovements.length,
      totalUnits,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
    };
  };

  // Article Management
  const createArticle = (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => {
    const targetRef = articleData.mainReference.toLowerCase().trim();

    // In the master catalog model, mainReference is the unique pivot reference
    const exists = articles.some(
      (a) => a.mainReference.toLowerCase().trim() === targetRef
    );
    if (exists) {
      return {
        success: false,
        error: `Une pièce avec la référence pivot "${articleData.mainReference}" existe déjà dans le catalogue. Vous pouvez modifier cette fiche pour y ajouter une marque ou constructeur supplémentaire avec son tarif.`,
      };
    }

    const defaultWh =
      warehouses.find((w) => w.isDefault) ||
      warehouses[0] ||
      CLEAN_DEFAULT_WAREHOUSES[0];
    const prefixedDefaultLoc = prefixLocationWithWarehouse(
      articleData.defaultLocation,
      defaultWh.name
    );

    const newId = generateArticleId(articles.length);
    const initialBrandOffers = articleData.brandOffers && articleData.brandOffers.length > 0
      ? articleData.brandOffers.map((bo) => ({
          ...bo,
          location: prefixLocationWithWarehouse(bo.location || prefixedDefaultLoc, defaultWh.name),
        }))
      : [
          {
            id: `bo_${Date.now()}_init`,
            brand: articleData.brand || '',
            brandReference: articleData.mainReference,
            purchasePrice: articleData.purchasePrice || 0,
            salePrice: articleData.salePrice || 0,
            location: prefixedDefaultLoc,
            isDefault: true,
            ...(articleData.preferredSupplier ? { preferredSupplier: articleData.preferredSupplier } : {}),
            ...(articleData.barcode ? { barcode: articleData.barcode } : {}),
          },
        ];

    const newArticle: Article = {
      ...articleData,
      id: newId,
      defaultLocation: prefixedDefaultLoc,
      warehouseLocation: defaultWh.name,
      brandOffers: initialBrandOffers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextArticles = [newArticle, ...articles];
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);

    const initialStocksForNewArticle: WarehouseStock[] = warehouses.map((w) => ({
      articleId: newId,
      warehouseId: w.id,
      quantity: 0,
      brandBreakdown: {},
      shelfLocation: w.id === defaultWh.id ? prefixedDefaultLoc : 'Non renseigné',
    }));
    const nextStocks = [...stocks, ...initialStocksForNewArticle];
    setStocks(nextStocks);
    safeSetLocalStorage('stocks', nextStocks);

    saveArticleToFirebase(newArticle).catch(console.warn);
    saveMultipleStocksToFirebase(initialStocksForNewArticle).catch(console.warn);

    return { success: true, article: newArticle };
  };

  const updateArticle = (id: string, updates: Partial<Article>) => {
    const existing = articles.find((a) => a.id === id);
    if (!existing) return { success: false, error: 'Article introuvable.' };

    if (updates.mainReference) {
      const targetRef = updates.mainReference.toLowerCase().trim();
      const duplicate = articles.some(
        (a) => a.id !== id && a.mainReference.toLowerCase().trim() === targetRef
      );
      if (duplicate) {
        return {
          success: false,
          error: `Une pièce avec la référence pivot "${updates.mainReference}" existe déjà dans le catalogue.`,
        };
      }
    }

    const defaultWh =
      warehouses.find((w) => w.isDefault) ||
      warehouses[0] ||
      CLEAN_DEFAULT_WAREHOUSES[0];

    const normalizedUpdates: Partial<Article> = { ...updates };
    if (normalizedUpdates.defaultLocation && normalizedUpdates.defaultLocation !== 'Non renseigné') {
      normalizedUpdates.defaultLocation = prefixLocationWithWarehouse(
        normalizedUpdates.defaultLocation,
        defaultWh.name
      );
    }

    const updatedArticle = { ...existing, ...normalizedUpdates, updatedAt: new Date().toISOString() };
    const nextArticles = articles.map((a) => (a.id === id ? updatedArticle : a));
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);

    saveArticleToFirebase(updatedArticle).catch(console.warn);

    return { success: true };
  };

  // Bulk update per-warehouse minimum stock norms (e.g. Boutique replenishment thresholds)
  const bulkUpdateWarehouseMinThresholds = (
    warehouseId: string,
    updates: Array<{ articleId: string; threshold: number | null }>
  ): { success: boolean; updatedCount: number; error?: string } => {
    if (!warehouseId) {
      return { success: false, updatedCount: 0, error: 'Aucun dépôt cible sélectionné.' };
    }
    if (!updates || updates.length === 0) {
      return { success: false, updatedCount: 0, error: 'Aucune pièce à mettre à jour.' };
    }

    const updateMap = new Map<string, number | null>();
    updates.forEach((u) => {
      updateMap.set(
        u.articleId,
        u.threshold === null ? null : Math.max(0, Math.floor(Number(u.threshold) || 0))
      );
    });

    const nowIso = new Date().toISOString();
    const changedArticles: Article[] = [];

    const nextArticles = articles.map((art) => {
      if (!updateMap.has(art.id)) return art;
      const nextThreshold = updateMap.get(art.id);
      const nextMap: Record<string, number> = { ...(art.warehouseMinThresholds || {}) };

      if (nextThreshold === null || nextThreshold === undefined) {
        delete nextMap[warehouseId];
      } else {
        nextMap[warehouseId] = nextThreshold;
      }

      const updated: Article = {
        ...art,
        warehouseMinThresholds: Object.keys(nextMap).length > 0 ? nextMap : undefined,
        updatedAt: nowIso,
      };
      changedArticles.push(updated);
      return updated;
    });

    if (changedArticles.length === 0) {
      return { success: false, updatedCount: 0, error: 'Aucune pièce correspondante trouvée.' };
    }

    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveMultipleArticlesToFirebase(changedArticles).catch(console.warn);

    return { success: true, updatedCount: changedArticles.length };
  };

  const addMachineApplication = (
    articleId: string,
    app: Omit<MachineApplication, 'id'>
  ): { success: boolean; error?: string } => {
    const existing = articles.find((a) => a.id === articleId);
    if (!existing) return { success: false, error: 'Article introuvable.' };

    const cleanModel = app.model.trim().toUpperCase();
    const cleanPrefix = app.serialPrefix?.trim().toUpperCase() || undefined;

    const newApp: MachineApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      productFamily: app.productFamily?.trim() || undefined,
      subFamily: app.subFamily?.trim() || undefined,
      model: cleanModel,
      serialPrefix: cleanPrefix,
      system: app.system?.trim() || undefined,
      quantityRequired: app.quantityRequired && app.quantityRequired > 0 ? Number(app.quantityRequired) : undefined,
      notes: app.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const currentApps = existing.machineApplications || [];
    const isDuplicate = currentApps.some(
      (a) =>
        a.model.toLowerCase() === newApp.model.toLowerCase() &&
        (a.serialPrefix || '').toLowerCase() === (newApp.serialPrefix || '').toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, error: 'Cette affectation machine existe déjà pour cette pièce.' };
    }

    const nextApps = [...currentApps, newApp];
    const modelSet = new Set(existing.compatibleMachines || []);
    modelSet.add(newApp.model);
    if (newApp.serialPrefix) {
      modelSet.add(`${newApp.model} (${newApp.serialPrefix})`);
    }

    const updatedArticle: Article = {
      ...existing,
      machineApplications: nextApps,
      compatibleMachines: Array.from(modelSet),
      updatedAt: new Date().toISOString(),
    };

    const nextArticles = articles.map((a) => (a.id === articleId ? updatedArticle : a));
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveArticleToFirebase(updatedArticle).catch(console.warn);

    return { success: true };
  };

  const updateMachineApplication = (
    articleId: string,
    appId: string,
    updates: Partial<MachineApplication>
  ): { success: boolean; error?: string } => {
    const existing = articles.find((a) => a.id === articleId);
    if (!existing) return { success: false, error: 'Article introuvable.' };

    const currentApps = existing.machineApplications || [];
    const appIndex = currentApps.findIndex((a) => a.id === appId);
    if (appIndex === -1) return { success: false, error: 'Affectation machine introuvable.' };

    const updatedApp: MachineApplication = {
      ...currentApps[appIndex],
      ...updates,
      productFamily: updates.productFamily !== undefined ? updates.productFamily.trim() || undefined : currentApps[appIndex].productFamily,
      subFamily: updates.subFamily !== undefined ? updates.subFamily.trim() || undefined : currentApps[appIndex].subFamily,
      model: updates.model !== undefined ? updates.model.trim().toUpperCase() : currentApps[appIndex].model,
      serialPrefix: updates.serialPrefix !== undefined ? updates.serialPrefix.trim().toUpperCase() || undefined : currentApps[appIndex].serialPrefix,
      system: updates.system !== undefined ? updates.system.trim() || undefined : currentApps[appIndex].system,
      quantityRequired: updates.quantityRequired !== undefined && updates.quantityRequired > 0 ? Number(updates.quantityRequired) : currentApps[appIndex].quantityRequired,
      notes: updates.notes !== undefined ? updates.notes.trim() || undefined : currentApps[appIndex].notes,
    };

    const nextApps = [...currentApps];
    nextApps[appIndex] = updatedApp;

    const modelSet = new Set<string>();
    nextApps.forEach((a) => {
      modelSet.add(a.model);
      if (a.serialPrefix) modelSet.add(`${a.model} (${a.serialPrefix})`);
    });

    const updatedArticle: Article = {
      ...existing,
      machineApplications: nextApps,
      compatibleMachines: Array.from(modelSet),
      updatedAt: new Date().toISOString(),
    };

    const nextArticles = articles.map((a) => (a.id === articleId ? updatedArticle : a));
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveArticleToFirebase(updatedArticle).catch(console.warn);

    return { success: true };
  };

  const removeMachineApplication = (
    articleId: string,
    appId: string
  ): { success: boolean; error?: string } => {
    const existing = articles.find((a) => a.id === articleId);
    if (!existing) return { success: false, error: 'Article introuvable.' };

    const currentApps = existing.machineApplications || [];
    const nextApps = currentApps.filter((a) => a.id !== appId);

    const modelSet = new Set<string>();
    nextApps.forEach((a) => {
      modelSet.add(a.model);
      if (a.serialPrefix) modelSet.add(`${a.model} (${a.serialPrefix})`);
    });

    const updatedArticle: Article = {
      ...existing,
      machineApplications: nextApps,
      compatibleMachines: Array.from(modelSet),
      updatedAt: new Date().toISOString(),
    };

    const nextArticles = articles.map((a) => (a.id === articleId ? updatedArticle : a));
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveArticleToFirebase(updatedArticle).catch(console.warn);

    return { success: true };
  };

  const importMachineApplicationsForArticle = (
    articleId: string,
    applications: Array<{
      productFamily?: string;
      subFamily?: string;
      model: string;
      serialPrefix?: string;
      system?: string;
      quantityRequired?: number;
      notes?: string;
    }>
  ): {
    success: boolean;
    addedCount: number;
    duplicateCount: number;
    error?: string;
  } => {
    const existing = articles.find((a) => a.id === articleId);
    if (!existing) return { success: false, addedCount: 0, duplicateCount: 0, error: 'Article introuvable.' };

    const currentApps = [...(existing.machineApplications || [])];
    let addedCount = 0;
    let duplicateCount = 0;

    for (const app of applications) {
      if (!app.model || !app.model.trim()) continue;
      const cleanModel = app.model.trim().toUpperCase();
      const cleanPrefix = app.serialPrefix?.trim().toUpperCase() || undefined;
      const cleanFam = app.productFamily?.trim() || undefined;
      const cleanSub = app.subFamily?.trim() || undefined;

      const isDup = currentApps.some(
        (a) =>
          a.model.toLowerCase() === cleanModel.toLowerCase() &&
          (a.serialPrefix || '').toLowerCase() === (cleanPrefix || '').toLowerCase()
      );

      if (isDup) {
        duplicateCount++;
      } else {
        const newApp: MachineApplication = {
          id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          productFamily: cleanFam,
          subFamily: cleanSub,
          model: cleanModel,
          serialPrefix: cleanPrefix,
          system: app.system?.trim() || undefined,
          quantityRequired: app.quantityRequired && app.quantityRequired > 0 ? Number(app.quantityRequired) : undefined,
          notes: app.notes?.trim() || undefined,
          createdAt: new Date().toISOString(),
        };
        currentApps.push(newApp);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      const modelSet = new Set(existing.compatibleMachines || []);
      currentApps.forEach((a) => {
        modelSet.add(a.model);
        if (a.serialPrefix) modelSet.add(`${a.model} (${a.serialPrefix})`);
      });

      const updatedArticle: Article = {
        ...existing,
        machineApplications: currentApps,
        compatibleMachines: Array.from(modelSet),
        updatedAt: new Date().toISOString(),
      };

      const nextArticles = articles.map((a) => (a.id === articleId ? updatedArticle : a));
      setArticles(nextArticles);
      safeSetLocalStorage('articles', nextArticles);
      saveArticleToFirebase(updatedArticle).catch(console.warn);
    }

    return {
      success: true,
      addedCount,
      duplicateCount,
    };
  };

  const importMachineApplications = (
    applications: Array<{
      articleReference: string;
      model: string;
      serialPrefix?: string;
      system?: string;
      quantityRequired?: number;
      notes?: string;
    }>
  ): {
    success: boolean;
    updatedArticlesCount: number;
    totalApplicationsAdded: number;
    notFoundReferences: string[];
  } => {
    if (!applications || applications.length === 0) {
      return {
        success: true,
        updatedArticlesCount: 0,
        totalApplicationsAdded: 0,
        notFoundReferences: [],
      };
    }

    const notFoundSet = new Set<string>();
    const modifiedArticleMap = new Map<string, Article>();
    let totalAdded = 0;

    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-_.]/g, '');
    const articleLookup = new Map<string, Article>();

    articles.forEach((art) => {
      articleLookup.set(norm(art.mainReference), art);
      (art.equivalentReferences || []).forEach((eq) => {
        articleLookup.set(norm(eq), art);
      });
      (art.brandOffers || []).forEach((bo) => {
        if (bo.brandReference) articleLookup.set(norm(bo.brandReference), art);
      });
    });

    for (const item of applications) {
      if (!item.articleReference || !item.model) continue;
      const cleanRef = item.articleReference.trim();
      const targetArticle = articleLookup.get(norm(cleanRef));

      if (!targetArticle) {
        notFoundSet.add(cleanRef);
        continue;
      }

      const currentArticle = modifiedArticleMap.get(targetArticle.id) || { ...targetArticle };
      const currentApps = [...(currentArticle.machineApplications || [])];

      const cleanModel = item.model.trim();
      const cleanPrefix = item.serialPrefix?.trim() || undefined;
      const cleanSystem = item.system?.trim() || undefined;

      const isDup = currentApps.some(
        (a) =>
          a.model.toLowerCase() === cleanModel.toLowerCase() &&
          (a.serialPrefix || '').toLowerCase() === (cleanPrefix || '').toLowerCase() &&
          (a.system || '').toLowerCase() === (cleanSystem || '').toLowerCase()
      );

      if (!isDup) {
        const newApp: MachineApplication = {
          id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          model: cleanModel,
          serialPrefix: cleanPrefix,
          system: cleanSystem,
          quantityRequired: item.quantityRequired && item.quantityRequired > 0 ? Number(item.quantityRequired) : undefined,
          notes: item.notes?.trim() || undefined,
        };
        currentApps.push(newApp);
        totalAdded++;

        const modelSet = new Set(currentArticle.compatibleMachines || []);
        modelSet.add(cleanModel);
        if (cleanPrefix) modelSet.add(`${cleanModel} (${cleanPrefix})`);

        currentArticle.machineApplications = currentApps;
        currentArticle.compatibleMachines = Array.from(modelSet);
        currentArticle.updatedAt = new Date().toISOString();
        modifiedArticleMap.set(currentArticle.id, currentArticle);
      }
    }

    if (modifiedArticleMap.size > 0) {
      const nextArticles = articles.map((a) => modifiedArticleMap.get(a.id) || a);
      setArticles(nextArticles);
      safeSetLocalStorage('articles', nextArticles);
      modifiedArticleMap.forEach((art) => {
        saveArticleToFirebase(art).catch(console.warn);
      });
    }

    return {
      success: true,
      updatedArticlesCount: modifiedArticleMap.size,
      totalApplicationsAdded: totalAdded,
      notFoundReferences: Array.from(notFoundSet),
    };
  };

  // Direct quick update for Stock Location, Quantity, and Prices (per product / brand)
  const quickUpdateStockItem = (params: {
    articleId: string;
    brandName?: string;
    previousBrandName?: string;
    warehouseId?: string | null;
    newQuantity: number;
    newLocation: string;
    newPurchasePrice: number;
    newSalePrice: number;
    invoiceNumber?: string;
  }): { success: boolean; error?: string; message?: string } => {
    const existing = articles.find((a) => a.id === params.articleId);
    if (!existing) {
      return { success: false, error: 'Article introuvable dans le catalogue.' };
    }

    const effectiveWarehouses =
      warehouses.length > 0 ? warehouses : CLEAN_DEFAULT_WAREHOUSES;
    const existingArticleStocks = stocks.filter((s) => s.articleId === existing.id);
    const firstWhWithStockId = existingArticleStocks.find((s) => s.quantity > 0)?.warehouseId;
    const targetWh =
      (params.warehouseId && params.warehouseId !== 'ALL'
        ? effectiveWarehouses.find((w) => w.id === params.warehouseId)
        : undefined) ||
      (firstWhWithStockId
        ? effectiveWarehouses.find((w) => w.id === firstWhWithStockId)
        : undefined) ||
      effectiveWarehouses.find((w) => w.isDefault) ||
      effectiveWarehouses[0] ||
      CLEAN_DEFAULT_WAREHOUSES[0];

    const cleanQty = Math.max(0, Math.round(Number(params.newQuantity) || 0));
    const cleanPurchasePrice = Math.max(0, Math.round(Number(params.newPurchasePrice) || 0));
    const cleanSalePrice = Math.max(0, Math.round(Number(params.newSalePrice) || 0));
    const cleanLocation = prefixLocationWithWarehouse(
      params.newLocation,
      targetWh.name,
      effectiveWarehouses
    );
    const cleanInvoice = params.invoiceNumber !== undefined ? params.invoiceNumber.trim() : undefined;
    const nowIso = new Date().toISOString();

    const targetBrand = cleanBrandName(
      params.brandName !== undefined ? params.brandName : existing.brand
    );
    const normBrand = targetBrand.toLowerCase();
    const prevBrandClean =
      params.previousBrandName !== undefined
        ? cleanBrandName(params.previousBrandName)
        : undefined;
    const normPrevBrand = prevBrandClean !== undefined ? prevBrandClean.toLowerCase() : undefined;

    const currentOffers: ArticleBrandOffer[] =
      existing.brandOffers && existing.brandOffers.length > 0
        ? existing.brandOffers.map((o) => ({
            ...o,
            brand: cleanBrandName(o.brand),
          }))
        : [
            {
              id: `bo_${existing.id}_init`,
              brand: cleanBrandName(existing.brand),
              brandReference: existing.mainReference,
              purchasePrice: existing.purchasePrice || 0,
              salePrice: existing.salePrice || 0,
              location: existing.defaultLocation,
              invoiceNumber: existing.invoiceNumber,
              isDefault: true,
            },
          ];

    // 1. Update WarehouseStock for targetWh (and propagate any brand rename across ALL warehouses of this article)
    const nextStocks = deduplicateStocksList(stocks);
    const isRenamingBrand =
      normPrevBrand !== undefined &&
      normPrevBrand !== '__new__' &&
      normPrevBrand !== normBrand;

    // If renaming an existing brand, propagate the rename across ALL other warehouses for this article so no stock becomes orphaned
    if (isRenamingBrand) {
      for (let i = 0; i < nextStocks.length; i++) {
        const st = nextStocks[i];
        if (st.articleId !== existing.id || st.warehouseId === targetWh.id) continue;
        let touched = false;
        const bd: Record<string, number> = { ...(st.brandBreakdown || {}) };
        let movedQty = 0;
        for (const k of Object.keys(bd)) {
          if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
            movedQty += Math.max(0, Number(bd[k]) || 0);
            delete bd[k];
            touched = true;
          }
        }
        if (touched) {
          const existingTargetKey =
            Object.keys(bd).find((k) => cleanBrandName(k).toLowerCase() === normBrand) || targetBrand;
          bd[existingTargetKey] = (Math.max(0, Number(bd[existingTargetKey]) || 0)) + movedQty;

          const bl: Record<string, string> = { ...(st.brandLocations || {}) };
          for (const k of Object.keys(bl)) {
            if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
              if (!bl[targetBrand]) bl[targetBrand] = bl[k];
              delete bl[k];
            }
          }
          const bi: Record<string, string> = { ...(st.brandInvoices || {}) };
          for (const k of Object.keys(bi)) {
            if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
              if (!bi[targetBrand]) bi[targetBrand] = bi[k];
              delete bi[k];
            }
          }
          nextStocks[i] = reconcileWarehouseStock({
            ...st,
            brandBreakdown: bd,
            brandLocations: bl,
            brandInvoices: bi,
            quantity: Object.values(bd).reduce((s, q) => s + Math.max(0, Number(q) || 0), 0),
            updatedAt: nowIso,
          });
        }
      }
    }

    const stockIdx = nextStocks.findIndex(
      (s) => s.articleId === existing.id && s.warehouseId === targetWh.id
    );

    const prevQtyInTargetWh = stockIdx !== -1 ? nextStocks[stockIdx].quantity : 0;
    let newTotalWhQty = cleanQty;

    if (stockIdx !== -1) {
      const prevStock = reconcileWarehouseStock(nextStocks[stockIdx]);
      const nextBreakdown: Record<string, number> = {};

      // Canonicalize existing breakdown entries (merging duplicate casing keys)
      if (prevStock.brandBreakdown) {
        for (const [k, v] of Object.entries(prevStock.brandBreakdown)) {
          const ck = cleanBrandName(k);
          const q = Math.max(0, Math.round(Number(v) || 0));
          const existingKey = Object.keys(nextBreakdown).find(
            (ek) => cleanBrandName(ek).toLowerCase() === ck.toLowerCase()
          );
          if (existingKey !== undefined) {
            nextBreakdown[existingKey] += q;
          } else {
            nextBreakdown[ck] = q;
          }
        }
      }

      // If this warehouse previously had positive quantity but no brandBreakdown, assign existing wh quantity to primary brand before updating targetBrand
      if (Object.keys(nextBreakdown).length === 0 && prevStock.quantity > 0) {
        const primaryBrand =
          (currentOffers.find((o) => o.isDefault) || currentOffers[0])?.brand || targetBrand;
        nextBreakdown[cleanBrandName(primaryBrand)] = prevStock.quantity;
      }

      // If renaming an existing brand (or replacing a placeholder brand), remove ALL matching old keys in breakdown
      if (isRenamingBrand) {
        for (const k of Object.keys(nextBreakdown)) {
          if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
            delete nextBreakdown[k];
          }
        }
      }

      // Remove any existing duplicate keys matching normBrand before writing targetBrand cleanly
      for (const k of Object.keys(nextBreakdown)) {
        if (cleanBrandName(k).toLowerCase() === normBrand) {
          delete nextBreakdown[k];
        }
      }
      nextBreakdown[targetBrand] = cleanQty;

      // Always strip stale placeholder keys ("", "Générique", "Non spécifié", "Sans marque") whenever any real named brand exists
      const hasRealNamedBrand =
        Boolean(targetBrand) || Object.keys(nextBreakdown).some((k) => Boolean(cleanBrandName(k)));
      if (hasRealNamedBrand) {
        for (const k of Object.keys(nextBreakdown)) {
          if (isPlaceholderBrand(k)) {
            delete nextBreakdown[k];
          }
        }
      }

      newTotalWhQty = Object.values(nextBreakdown).reduce(
        (sum, q) => sum + Math.max(0, Number(q) || 0),
        0
      );

      const nextBrandLocations: Record<string, string> = {
        ...(prevStock.brandLocations || {}),
      };
      if (isRenamingBrand) {
        for (const k of Object.keys(nextBrandLocations)) {
          if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
            delete nextBrandLocations[k];
          }
        }
      }
      for (const k of Object.keys(nextBrandLocations)) {
        if (cleanBrandName(k).toLowerCase() === normBrand && k !== targetBrand) {
          delete nextBrandLocations[k];
        }
      }
      nextBrandLocations[targetBrand] = cleanLocation;

      const nextBrandInvoices: Record<string, string> = {
        ...(prevStock.brandInvoices || {}),
      };
      if (cleanInvoice !== undefined) {
        if (isRenamingBrand) {
          for (const k of Object.keys(nextBrandInvoices)) {
            if (cleanBrandName(k).toLowerCase() === normPrevBrand) {
              delete nextBrandInvoices[k];
            }
          }
        }
        for (const k of Object.keys(nextBrandInvoices)) {
          if (cleanBrandName(k).toLowerCase() === normBrand && k !== targetBrand) {
            delete nextBrandInvoices[k];
          }
        }
        nextBrandInvoices[targetBrand] = cleanInvoice;
      }

      nextStocks[stockIdx] = {
        ...prevStock,
        quantity: newTotalWhQty,
        brandBreakdown: nextBreakdown,
        shelfLocation: cleanLocation,
        brandLocations: nextBrandLocations,
        ...(cleanInvoice !== undefined
          ? { invoiceNumber: cleanInvoice, brandInvoices: nextBrandInvoices }
          : {}),
        lastInventoryDate: nowIso,
        updatedAt: nowIso,
      };
    } else {
      const newStockRecord: WarehouseStock = {
        articleId: existing.id,
        warehouseId: targetWh.id,
        quantity: cleanQty,
        brandBreakdown: { [targetBrand]: cleanQty },
        shelfLocation: cleanLocation,
        brandLocations: { [targetBrand]: cleanLocation },
        ...(cleanInvoice
          ? { invoiceNumber: cleanInvoice, brandInvoices: { [targetBrand]: cleanInvoice } }
          : {}),
        lastInventoryDate: nowIso,
        updatedAt: nowIso,
      };
      nextStocks.push(newStockRecord);
    }

    setStocks(nextStocks);
    safeSetLocalStorage('stocks', nextStocks);
    const affectedStocks = nextStocks.filter((s) => s.articleId === existing.id);
    saveMultipleStocksToFirebase(affectedStocks).catch(console.warn);

    // 2. Update Article & BrandOffers with synchronized totals and warehouse-prefixed locations across all warehouses
    let offerIdx = currentOffers.findIndex(
      (o) => cleanBrandName(o.brand).toLowerCase() === normBrand
    );
    if (offerIdx === -1 && normPrevBrand !== undefined) {
      offerIdx = currentOffers.findIndex(
        (o) => cleanBrandName(o.brand).toLowerCase() === normPrevBrand
      );
    }
    if (offerIdx === -1 && currentOffers.length === 1 && !cleanBrandName(currentOffers[0].brand)) {
      offerIdx = 0;
    }

    // Compute total stock and all warehouse-prefixed locations for targetBrand across affectedStocks
    let totalBrandStockAllWh = 0;
    const brandLocsAllWh = new Set<string>();
    for (const st of affectedStocks) {
      const whObj = effectiveWarehouses.find((w) => w.id === st.warehouseId) || targetWh;
      if (st.brandBreakdown) {
        const bKey = Object.keys(st.brandBreakdown).find(
          (k) => cleanBrandName(k).toLowerCase() === normBrand
        );
        if (bKey !== undefined) {
          totalBrandStockAllWh += Math.max(0, Number(st.brandBreakdown[bKey]) || 0);
        }
      }
      if (st.brandLocations) {
        const lKey = Object.keys(st.brandLocations).find(
          (k) => cleanBrandName(k).toLowerCase() === normBrand
        );
        if (lKey && st.brandLocations[lKey] && st.brandLocations[lKey] !== 'Non renseigné') {
          const pref = prefixLocationWithWarehouse(st.brandLocations[lKey], whObj.name);
          if (pref !== 'Non renseigné') brandLocsAllWh.add(pref);
        }
      }
    }
    if (brandLocsAllWh.size === 0 && cleanLocation !== 'Non renseigné') {
      brandLocsAllWh.add(cleanLocation);
    }
    const consolidatedBrandLocs = Array.from(brandLocsAllWh);
    const consolidatedBrandLocStr =
      consolidatedBrandLocs.length > 0 ? consolidatedBrandLocs.join(' • ') : cleanLocation;

    if (offerIdx !== -1) {
      const prevOffer = currentOffers[offerIdx];
      currentOffers[offerIdx] = {
        ...prevOffer,
        brand: targetBrand,
        purchasePrice: cleanPurchasePrice,
        salePrice: cleanSalePrice,
        location: consolidatedBrandLocStr,
        locations: consolidatedBrandLocs.length > 0 ? consolidatedBrandLocs : prevOffer.locations,
        stockQuantity: totalBrandStockAllWh,
        ...(cleanInvoice !== undefined
          ? {
              invoiceNumber: cleanInvoice || undefined,
              invoiceNumbers: cleanInvoice ? [cleanInvoice] : undefined,
            }
          : {}),
      };
    } else {
      currentOffers.push({
        id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        brand: targetBrand,
        brandReference: existing.mainReference,
        purchasePrice: cleanPurchasePrice,
        salePrice: cleanSalePrice,
        location: consolidatedBrandLocStr,
        locations: consolidatedBrandLocs.length > 0 ? consolidatedBrandLocs : undefined,
        stockQuantity: totalBrandStockAllWh,
        ...(cleanInvoice ? { invoiceNumber: cleanInvoice, invoiceNumbers: [cleanInvoice] } : {}),
        isDefault: currentOffers.length === 0,
      });
    }

    // Strip any leftover empty/placeholder offers when at least one real brand offer exists
    const cleanedOffers =
      currentOffers.some((o) => Boolean(cleanBrandName(o.brand)))
        ? currentOffers.filter((o) => Boolean(cleanBrandName(o.brand)))
        : currentOffers;

    const primaryOffer = cleanedOffers.find((o) => o.isDefault) || cleanedOffers[0];
    const isEditingPrimary =
      cleanedOffers.length === 1 ||
      cleanBrandName(primaryOffer?.brand).toLowerCase() === normBrand;

    // Consolidate locations across all brand offers for defaultLocation
    const allOfferLocs = Array.from(
      new Set(
        cleanedOffers
          .map((o) => o.location?.trim())
          .filter((l): l is string => Boolean(l && l !== 'Non renseigné'))
      )
    );

    const updatedArticle: Article = {
      ...existing,
      brand: cleanBrandName(primaryOffer?.brand) || cleanBrandName(existing.brand),
      purchasePrice: isEditingPrimary ? cleanPurchasePrice : primaryOffer.purchasePrice,
      salePrice: isEditingPrimary ? cleanSalePrice : primaryOffer.salePrice,
      defaultLocation:
        allOfferLocs.length > 0 ? allOfferLocs.join(' • ') : cleanLocation,
      ...(cleanInvoice !== undefined && isEditingPrimary
        ? { invoiceNumber: cleanInvoice || undefined }
        : {}),
      brandOffers: cleanedOffers,
      updatedAt: nowIso,
    };

    const nextArticles = articles.map((a) =>
      a.id === existing.id ? updatedArticle : a
    );
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveArticleToFirebase(updatedArticle).catch(console.warn);

    // 3. Record adjustment movement if quantity changed
    const qtyDelta = newTotalWhQty - prevQtyInTargetWh;
    if (qtyDelta !== 0) {
      const mvt: StockMovement = {
        id: generateMovementId(),
        date: nowIso,
        type: 'AJUSTEMENT',
        articleId: existing.id,
        quantity: Math.abs(qtyDelta),
        ...(qtyDelta > 0
          ? { targetWarehouseId: targetWh.id }
          : { sourceWarehouseId: targetWh.id }),
        userId: currentUser.id,
        userName: currentUser.name,
        documentRef: `MOD-STOCK-${Date.now().toString().slice(-5)}`,
        reason: `Modification directe du stock (${targetBrand}) — Empl: ${cleanLocation}`,
        unitPrice: cleanPurchasePrice,
        totalPrice: Math.abs(qtyDelta) * cleanPurchasePrice,
        stockBefore: prevQtyInTargetWh,
        stockAfter: newTotalWhQty,
      };
      const nextMovements = [mvt, ...movements];
      setMovements(nextMovements);
      safeSetLocalStorage('movements', nextMovements);
      saveMovementToFirebase(mvt).catch(console.warn);
    }

    return {
      success: true,
      message: `Mise à jour enregistrée pour ${existing.mainReference} (${targetBrand}) : Qté ${cleanQty}, Empl. "${cleanLocation}", Achat ${cleanPurchasePrice.toLocaleString('fr-FR')} F, Vente ${cleanSalePrice.toLocaleString('fr-FR')} F.`,
    };
  };

  // Atomic batch update for ALL modified warehouses & brands of an article in one save
  const quickUpdateArticleStocks = (params: {
    articleId: string;
    brandUpdates: Array<{
      originalBrandKey: string;
      brandName: string;
      purchasePrice: number;
      salePrice: number;
      invoiceNumber?: string;
      isNew?: boolean;
    }>;
    cellUpdates: Array<{
      warehouseId: string;
      originalBrandKey: string;
      brandName: string;
      newQuantity: number;
      newLocation: string;
      invoiceNumber?: string;
    }>;
  }): { success: boolean; error?: string; message?: string } => {
    const existing = articles.find((a) => a.id === params.articleId);
    if (!existing) {
      return { success: false, error: 'Article introuvable dans le catalogue.' };
    }

    const effectiveWarehouses =
      warehouses.length > 0 ? warehouses : CLEAN_DEFAULT_WAREHOUSES;
    const activeWhIds = new Set(effectiveWarehouses.map((w) => w.id));
    const nowIso = new Date().toISOString();

    const nextStocks = deduplicateStocksList(stocks);
    const prevQtyByWh = new Map<string, number>();
    for (const st of nextStocks) {
      if (st.articleId === existing.id) {
        prevQtyByWh.set(st.warehouseId, Math.max(0, Number(st.quantity) || 0));
      }
    }

    // Build rename map (normOld -> cleanNew) for existing brands that were renamed
    const renameMap = new Map<string, string>();
    for (const bu of params.brandUpdates) {
      if (bu.isNew || bu.originalBrandKey.startsWith('__NEW__')) continue;
      const oldClean = cleanBrandName(bu.originalBrandKey);
      const newClean = cleanBrandName(bu.brandName);
      if (oldClean.toLowerCase() !== newClean.toLowerCase()) {
        renameMap.set(oldClean.toLowerCase(), newClean);
      }
    }

    // 1. Apply any brand renames across ALL existing warehouses of this article
    const touchedWhIds = new Set<string>();
    if (renameMap.size > 0) {
      for (let i = 0; i < nextStocks.length; i++) {
        const st = nextStocks[i];
        if (st.articleId !== existing.id) continue;
        const bd: Record<string, number> = {};
        let renamedHere = false;
        for (const [k, v] of Object.entries(st.brandBreakdown || {})) {
          const ck = cleanBrandName(k);
          const mapped = renameMap.has(ck.toLowerCase()) ? renameMap.get(ck.toLowerCase())! : ck;
          if (mapped !== ck) renamedHere = true;
          const existingKey = Object.keys(bd).find(
            (ek) => cleanBrandName(ek).toLowerCase() === mapped.toLowerCase()
          );
          const q = Math.max(0, Math.round(Number(v) || 0));
          if (existingKey !== undefined) {
            bd[existingKey] += q;
          } else {
            bd[mapped] = q;
          }
        }
        const bl: Record<string, string> = {};
        for (const [k, v] of Object.entries(st.brandLocations || {})) {
          const ck = cleanBrandName(k);
          const mapped = renameMap.has(ck.toLowerCase()) ? renameMap.get(ck.toLowerCase())! : ck;
          if (mapped !== ck) renamedHere = true;
          if (!bl[mapped] || (v && v !== 'Non renseigné')) {
            bl[mapped] = v;
          }
        }
        const bi: Record<string, string> = {};
        for (const [k, v] of Object.entries(st.brandInvoices || {})) {
          const ck = cleanBrandName(k);
          const mapped = renameMap.has(ck.toLowerCase()) ? renameMap.get(ck.toLowerCase())! : ck;
          if (mapped !== ck) renamedHere = true;
          if (!bi[mapped] || v) {
            bi[mapped] = v;
          }
        }
        if (renamedHere) {
          touchedWhIds.add(st.warehouseId);
          nextStocks[i] = reconcileWarehouseStock({
            ...st,
            brandBreakdown: bd,
            brandLocations: bl,
            brandInvoices: bi,
            quantity: Object.values(bd).reduce((s, q) => s + Math.max(0, Number(q) || 0), 0),
            lastInventoryDate: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    }

    // 2. Group cell updates by warehouseId and apply cleanly
    const cellsByWh = new Map<string, typeof params.cellUpdates>();
    for (const cell of params.cellUpdates) {
      if (!cell.warehouseId) continue;
      const list = cellsByWh.get(cell.warehouseId) || [];
      list.push(cell);
      cellsByWh.set(cell.warehouseId, list);
    }

    const baseOffers = getArticleBrandOffers(existing);
    const fallbackPrimaryBrand = cleanBrandName(
      (baseOffers.find((o) => o.isDefault) || baseOffers[0])?.brand || existing.brand
    );

    for (const [whId, whCells] of cellsByWh.entries()) {
      const targetWh =
        effectiveWarehouses.find((w) => w.id === whId) ||
        effectiveWarehouses.find((w) => w.isDefault) ||
        effectiveWarehouses[0] ||
        CLEAN_DEFAULT_WAREHOUSES[0];

      const stockIdx = nextStocks.findIndex(
        (s) => s.articleId === existing.id && s.warehouseId === targetWh.id
      );

      const prevStock =
        stockIdx !== -1 ? reconcileWarehouseStock(nextStocks[stockIdx]) : undefined;

      const nextBreakdown: Record<string, number> = {};
      if (prevStock?.brandBreakdown) {
        for (const [k, v] of Object.entries(prevStock.brandBreakdown)) {
          const ck = cleanBrandName(k);
          const q = Math.max(0, Math.round(Number(v) || 0));
          const ek = Object.keys(nextBreakdown).find(
            (key) => cleanBrandName(key).toLowerCase() === ck.toLowerCase()
          );
          if (ek !== undefined) nextBreakdown[ek] += q;
          else nextBreakdown[ck] = q;
        }
      } else if (prevStock && prevStock.quantity > 0) {
        nextBreakdown[fallbackPrimaryBrand] = prevStock.quantity;
      }

      const nextBrandLocations: Record<string, string> = {
        ...(prevStock?.brandLocations || {}),
      };
      const nextBrandInvoices: Record<string, string> = {
        ...(prevStock?.brandInvoices || {}),
      };

      let lastLoc = prevStock?.shelfLocation || 'Non renseigné';
      let lastInv = prevStock?.invoiceNumber;

      for (const cell of whCells) {
        const targetBrand = cleanBrandName(cell.brandName);
        const normBrand = targetBrand.toLowerCase();
        const cleanQty = Math.max(0, Math.round(Number(cell.newQuantity) || 0));
        const cleanLoc = prefixLocationWithWarehouse(
          cell.newLocation,
          targetWh.name,
          effectiveWarehouses
        );
        const cleanInv = cell.invoiceNumber !== undefined ? cell.invoiceNumber.trim() : undefined;

        for (const k of Object.keys(nextBreakdown)) {
          if (cleanBrandName(k).toLowerCase() === normBrand) {
            delete nextBreakdown[k];
          }
        }
        nextBreakdown[targetBrand] = cleanQty;

        for (const k of Object.keys(nextBrandLocations)) {
          if (cleanBrandName(k).toLowerCase() === normBrand && k !== targetBrand) {
            delete nextBrandLocations[k];
          }
        }
        nextBrandLocations[targetBrand] = cleanLoc;
        if (cleanLoc !== 'Non renseigné') lastLoc = cleanLoc;

        if (cleanInv !== undefined) {
          for (const k of Object.keys(nextBrandInvoices)) {
            if (cleanBrandName(k).toLowerCase() === normBrand && k !== targetBrand) {
              delete nextBrandInvoices[k];
            }
          }
          nextBrandInvoices[targetBrand] = cleanInv;
          lastInv = cleanInv;
        }
      }

      // Always strip placeholder keys whenever real named brands exist in breakdown or brandUpdates
      const hasAnyNamedBrand =
        Object.keys(nextBreakdown).some((k) => Boolean(cleanBrandName(k))) ||
        params.brandUpdates.some((b) => Boolean(cleanBrandName(b.brandName)));
      if (hasAnyNamedBrand) {
        for (const k of Object.keys(nextBreakdown)) {
          if (isPlaceholderBrand(k)) delete nextBreakdown[k];
        }
      }

      const newTotalWhQty = Object.values(nextBreakdown).reduce(
        (sum, q) => sum + Math.max(0, Number(q) || 0),
        0
      );

      const whLocVals = Object.values(nextBrandLocations).filter(
        (l) => l && l !== 'Non renseigné'
      );
      const consolidatedWhShelf =
        whLocVals.length > 0 ? Array.from(new Set(whLocVals)).join(' • ') : lastLoc;

      touchedWhIds.add(targetWh.id);

      if (stockIdx !== -1) {
        nextStocks[stockIdx] = {
          ...prevStock!,
          quantity: newTotalWhQty,
          brandBreakdown: nextBreakdown,
          shelfLocation: consolidatedWhShelf,
          brandLocations: nextBrandLocations,
          brandInvoices: nextBrandInvoices,
          ...(lastInv !== undefined ? { invoiceNumber: lastInv } : {}),
          lastInventoryDate: nowIso,
          updatedAt: nowIso,
        };
      } else {
        nextStocks.push({
          articleId: existing.id,
          warehouseId: targetWh.id,
          quantity: newTotalWhQty,
          brandBreakdown: nextBreakdown,
          shelfLocation: consolidatedWhShelf,
          brandLocations: nextBrandLocations,
          brandInvoices: nextBrandInvoices,
          ...(lastInv ? { invoiceNumber: lastInv } : {}),
          lastInventoryDate: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    // 3. Rebuild synchronized brandOffers on the Article
    const currentOffers: ArticleBrandOffer[] = baseOffers.map((o) => ({
      ...o,
      brand: cleanBrandName(o.brand),
    }));

    for (const bu of params.brandUpdates) {
      const targetBrand = cleanBrandName(bu.brandName);
      const normTarget = targetBrand.toLowerCase();
      const origClean = bu.originalBrandKey.startsWith('__NEW__')
        ? '__NEW__'
        : cleanBrandName(bu.originalBrandKey);
      const normOrig = origClean.toLowerCase();
      const cleanPurchase = Math.max(0, Math.round(Number(bu.purchasePrice) || 0));
      const cleanSale = Math.max(0, Math.round(Number(bu.salePrice) || 0));
      const cleanInv = bu.invoiceNumber !== undefined ? bu.invoiceNumber.trim() : undefined;

      let offerIdx = -1;
      if (!bu.isNew && origClean !== '__NEW__') {
        offerIdx = currentOffers.findIndex(
          (o) => cleanBrandName(o.brand).toLowerCase() === normOrig
        );
      }
      if (offerIdx === -1) {
        offerIdx = currentOffers.findIndex(
          (o) => cleanBrandName(o.brand).toLowerCase() === normTarget
        );
      }
      if (
        offerIdx === -1 &&
        !bu.isNew &&
        currentOffers.length === 1 &&
        !cleanBrandName(currentOffers[0].brand)
      ) {
        offerIdx = 0;
      }

      if (offerIdx !== -1) {
        currentOffers[offerIdx] = {
          ...currentOffers[offerIdx],
          brand: targetBrand,
          purchasePrice: cleanPurchase,
          salePrice: cleanSale,
          ...(cleanInv !== undefined
            ? {
                invoiceNumber: cleanInv || undefined,
                invoiceNumbers: cleanInv ? [cleanInv] : undefined,
              }
            : {}),
        };
      } else {
        currentOffers.push({
          id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          brand: targetBrand,
          brandReference: existing.mainReference,
          purchasePrice: cleanPurchase,
          salePrice: cleanSale,
          ...(cleanInv ? { invoiceNumber: cleanInv, invoiceNumbers: [cleanInv] } : {}),
          isDefault: currentOffers.length === 0,
        });
      }
    }

    const affectedStocks = nextStocks.filter(
      (s) => s.articleId === existing.id && (activeWhIds.size === 0 || activeWhIds.has(s.warehouseId))
    );

    // Ensure every named brand with positive stock in any active warehouse has a corresponding brandOffer
    for (const st of affectedStocks) {
      if (!st.brandBreakdown) continue;
      for (const [rawKey, rawQty] of Object.entries(st.brandBreakdown)) {
        const qty = Math.max(0, Number(rawQty) || 0);
        const ck = cleanBrandName(rawKey);
        if (qty > 0 && ck) {
          const existsInOffers = currentOffers.some(
            (o) => cleanBrandName(o.brand).toLowerCase() === ck.toLowerCase()
          );
          if (!existsInOffers) {
            currentOffers.push({
              id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              brand: ck,
              brandReference: existing.mainReference,
              purchasePrice: existing.purchasePrice || 0,
              salePrice: existing.salePrice || 0,
              isDefault: false,
            });
          }
        }
      }
    }

    // Deduplicate offers & strip empty placeholder offers when real brands exist
    const dedupOfferMap = new Map<string, ArticleBrandOffer>();
    const hasRealOffer = currentOffers.some((o) => Boolean(cleanBrandName(o.brand)));
    for (const o of currentOffers) {
      const cb = cleanBrandName(o.brand);
      if (!cb && hasRealOffer) continue;
      const key = cb.toLowerCase();
      const prev = dedupOfferMap.get(key);
      if (!prev) {
        dedupOfferMap.set(key, { ...o, brand: cb });
      } else {
        dedupOfferMap.set(key, {
          ...prev,
          ...o,
          brand: cb || prev.brand,
          isDefault: Boolean(prev.isDefault || o.isDefault),
        });
      }
    }

    const cleanedOffers = Array.from(dedupOfferMap.values()).map((offer) => {
      const normB = cleanBrandName(offer.brand).toLowerCase();
      let brandTotalQty = 0;
      const brandLocSet = new Set<string>();

      for (const st of affectedStocks) {
        const whObj =
          effectiveWarehouses.find((w) => w.id === st.warehouseId) || effectiveWarehouses[0];
        if (st.brandBreakdown) {
          for (const [k, v] of Object.entries(st.brandBreakdown)) {
            if (cleanBrandName(k).toLowerCase() === normB) {
              brandTotalQty += Math.max(0, Number(v) || 0);
            }
          }
        }
        if (st.brandLocations) {
          const lKey = Object.keys(st.brandLocations).find(
            (k) => cleanBrandName(k).toLowerCase() === normB
          );
          if (lKey && st.brandLocations[lKey] && st.brandLocations[lKey] !== 'Non renseigné') {
            const pref = prefixLocationWithWarehouse(st.brandLocations[lKey], whObj?.name);
            if (pref !== 'Non renseigné') brandLocSet.add(pref);
          }
        }
      }

      const locs = Array.from(brandLocSet);
      return {
        ...offer,
        stockQuantity: brandTotalQty,
        location: locs.length > 0 ? locs.join(' • ') : offer.location || 'Non renseigné',
        locations: locs.length > 0 ? locs : offer.locations,
      };
    });

    const primaryOffer = cleanedOffers.find((o) => o.isDefault) || cleanedOffers[0];
    const allOfferLocs = Array.from(
      new Set(
        cleanedOffers
          .map((o) => o.location?.trim())
          .filter((l): l is string => Boolean(l && l !== 'Non renseigné'))
      )
    );

    const updatedArticle: Article = {
      ...existing,
      brand: cleanBrandName(primaryOffer?.brand) || cleanBrandName(existing.brand),
      purchasePrice: primaryOffer ? primaryOffer.purchasePrice : existing.purchasePrice,
      salePrice: primaryOffer ? primaryOffer.salePrice : existing.salePrice,
      defaultLocation:
        allOfferLocs.length > 0 ? allOfferLocs.join(' • ') : existing.defaultLocation,
      brandOffers: cleanedOffers,
      updatedAt: nowIso,
    };

    // Persist stocks & article atomically
    setStocks(nextStocks);
    safeSetLocalStorage('stocks', nextStocks);
    saveMultipleStocksToFirebase(affectedStocks).catch(console.warn);

    const nextArticles = articles.map((a) => (a.id === existing.id ? updatedArticle : a));
    setArticles(nextArticles);
    safeSetLocalStorage('articles', nextArticles);
    saveArticleToFirebase(updatedArticle).catch(console.warn);

    // 4. Record adjustment movements for each warehouse whose total changed
    const newMovements: StockMovement[] = [];
    for (const whId of touchedWhIds) {
      const prevQty = prevQtyByWh.get(whId) || 0;
      const updatedRec = nextStocks.find(
        (s) => s.articleId === existing.id && s.warehouseId === whId
      );
      const nextQty = updatedRec ? updatedRec.quantity : 0;
      const qtyDelta = nextQty - prevQty;
      if (qtyDelta !== 0) {
        const whName = effectiveWarehouses.find((w) => w.id === whId)?.name || whId;
        newMovements.push({
          id: generateMovementId(),
          date: nowIso,
          type: 'AJUSTEMENT',
          articleId: existing.id,
          quantity: Math.abs(qtyDelta),
          ...(qtyDelta > 0
            ? { targetWarehouseId: whId }
            : { sourceWarehouseId: whId }),
          userId: currentUser.id,
          userName: currentUser.name,
          documentRef: `MOD-STOCK-${Date.now().toString().slice(-5)}`,
          reason: `Correction directe du stock (${whName})`,
          unitPrice: updatedArticle.purchasePrice,
          totalPrice: Math.abs(qtyDelta) * updatedArticle.purchasePrice,
          stockBefore: prevQty,
          stockAfter: nextQty,
        });
      }
    }

    if (newMovements.length > 0) {
      const nextMovements = [...newMovements, ...movements];
      setMovements(nextMovements);
      safeSetLocalStorage('movements', nextMovements);
      newMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));
    }

    const totalPieceQty = affectedStocks.reduce(
      (sum, st) => sum + Math.max(0, Number(st.quantity) || 0),
      0
    );

    return {
      success: true,
      message: `Modifications enregistrées pour ${existing.mainReference} — Stock total synchronisé : ${totalPieceQty} ${existing.unit}.`,
    };
  };

  // Delete single article permanently along with its stock and movement traces
  const deleteArticle = (articleId: string): {
    success: boolean;
    error?: string;
    actionType: 'DELETED' | 'ARCHIVED';
    message: string;
  } => {
    // Role verification: MAGASINIER cannot delete
    if (currentUser.role === 'MAGASINIER') {
      return {
        success: false,
        error: 'Droits insuffisants : les magasiniers ne sont pas autorisés à supprimer des pièces du catalogue. Seul un Responsable ou Administrateur peut effectuer cette opération.',
        actionType: 'DELETED',
        message: 'Action refusée',
      };
    }

    const article = articles.find((a) => a.id === articleId);
    if (!article) {
      return {
        success: false,
        error: 'Article introuvable dans le catalogue.',
        actionType: 'DELETED',
        message: 'Article introuvable',
      };
    }

    const warehouseIdsForStock = stocks
      .filter((s) => s.articleId === articleId)
      .map((s) => s.warehouseId);
    const movementIdsToRemove = movements
      .filter((m) => m.articleId === articleId)
      .map((m) => m.id);

    const updatedArticles = articles.filter((a) => a.id !== articleId);
    const updatedStocks = stocks.filter((s) => s.articleId !== articleId);
    const updatedMovements = movements.filter((m) => m.articleId !== articleId);
    const updatedInventories = inventories.map((inv) => ({
      ...inv,
      items: inv.items.filter((it) => it.articleId !== articleId),
    }));

    setArticles(updatedArticles);
    setStocks(updatedStocks);
    setMovements(updatedMovements);
    setInventories(updatedInventories);

    markIdsDeleted('articles', [articleId]);
    if (movementIdsToRemove.length > 0) {
      markIdsDeleted('movements', movementIdsToRemove);
    }

    safeSetLocalStorage('articles', updatedArticles);
    safeSetLocalStorage('stocks', updatedStocks);
    safeSetLocalStorage('movements', updatedMovements);
    safeSetLocalStorage('inventories', updatedInventories);

    deleteArticleFromFirebase(articleId).catch(console.warn);
    deleteStocksForArticleFromFirebase(
      articleId,
      Array.from(new Set([...warehouseIdsForStock, ...warehouses.map((w) => w.id)]))
    ).catch(console.warn);
    if (movementIdsToRemove.length > 0) {
      deleteMovementsFromFirebase(movementIdsToRemove).catch(console.warn);
    }

    return {
      success: true,
      actionType: 'DELETED',
      message: `La référence "${article.mainReference} - ${article.designation}" ainsi que ses traces de stock et mouvements associés ont été définitivement supprimées.`,
    };
  };

  // Multiple permanent deletion with full trace cleanup
  const deleteMultipleArticles = (articleIds: string[]): {
    success: boolean;
    error?: string;
    deletedCount: number;
    archivedCount: number;
    message: string;
  } => {
    if (currentUser.role === 'MAGASINIER') {
      return {
        success: false,
        error: 'Droits insuffisants : seuls les Responsables et Administrateurs peuvent supprimer des articles.',
        deletedCount: 0,
        archivedCount: 0,
        message: 'Action refusée',
      };
    }

    if (!articleIds || articleIds.length === 0) {
      return {
        success: false,
        error: 'Aucun article sélectionné pour la suppression.',
        deletedCount: 0,
        archivedCount: 0,
        message: 'Sélection vide',
      };
    }

    const idSet = new Set(articleIds);
    const existingToDelete = articles.filter((a) => idSet.has(a.id));
    const deletedCount = existingToDelete.length;

    const movementIdsToRemove = movements
      .filter((m) => idSet.has(m.articleId))
      .map((m) => m.id);
    const allWhIds = warehouses.map((w) => w.id);

    const nextArticles = articles.filter((a) => !idSet.has(a.id));
    const nextStocks = stocks.filter((s) => !idSet.has(s.articleId));
    const nextMovements = movements.filter((m) => !idSet.has(m.articleId));
    const nextInventories = inventories.map((inv) => ({
      ...inv,
      items: inv.items.filter((it) => !idSet.has(it.articleId)),
    }));

    setArticles(nextArticles);
    setStocks(nextStocks);
    setMovements(nextMovements);
    setInventories(nextInventories);

    markIdsDeleted(
      'articles',
      existingToDelete.map((art) => art.id)
    );
    if (movementIdsToRemove.length > 0) {
      markIdsDeleted('movements', movementIdsToRemove);
    }

    safeSetLocalStorage('articles', nextArticles);
    safeSetLocalStorage('stocks', nextStocks);
    safeSetLocalStorage('movements', nextMovements);
    safeSetLocalStorage('inventories', nextInventories);

    existingToDelete.forEach((art) => {
      deleteArticleFromFirebase(art.id).catch(console.warn);
      deleteStocksForArticleFromFirebase(art.id, allWhIds).catch(console.warn);
    });
    if (movementIdsToRemove.length > 0) {
      deleteMovementsFromFirebase(movementIdsToRemove).catch(console.warn);
    }

    return {
      success: true,
      deletedCount,
      archivedCount: 0,
      message: `${deletedCount} produit(s) et leurs traces associées ont été définitivement supprimés du catalogue.`,
    };
  };

  // Execute Catalog & Stock Import with full audit, strict single reference counting, and saturation protection
  const executeImport = (params: {
    mode: ImportMode;
    fileName: string;
    rows: ParsedImportRow[];
    targetWarehouseId?: string;
    overwriteExistingStock?: boolean;
  }): { success: boolean; report: ImportResultReport; error?: string } => {
    const effectiveWarehouses =
      warehouses.length > 0 ? warehouses : CLEAN_DEFAULT_WAREHOUSES;
    if (warehouses.length === 0) {
      setWarehouses(CLEAN_DEFAULT_WAREHOUSES);
      safeSetLocalStorage('warehouses', CLEAN_DEFAULT_WAREHOUSES);
    }

    const targetWh =
      (params.targetWarehouseId
        ? effectiveWarehouses.find((w) => w.id === params.targetWarehouseId)
        : undefined) ||
      effectiveWarehouses.find((w) => w.isDefault) ||
      effectiveWarehouses[0] ||
      CLEAN_DEFAULT_WAREHOUSES[0];

    const report: ImportResultReport = {
      timestamp: new Date().toISOString(),
      mode: params.mode,
      fileName: params.fileName,
      totalRows: params.rows.length,
      uniqueReferencesCount: 0,
      brandOffersCreatedCount: 0,
      createdArticles: 0,
      updatedArticles: 0,
      skippedArticles: 0,
      rejectedRows: 0,
      createdMovements: 0,
      positiveStockEntriesCount: 0,
      totalQuantityImported: 0,
      errors: [],
      rejectedDetails: [],
    };

    let nextArticles = [...articles];
    let nextStocks = [...stocks];
    let nextMovements = [...movements];
    const nowIso = new Date().toISOString();

    // 1. Separate rejected errors from valid/warning rows
    const validRows: ParsedImportRow[] = [];
    for (const row of params.rows) {
      if (row.status === 'ERROR') {
        report.rejectedRows += 1;
        const errDesc = `Ligne ${row.rowIndex} (${row.mainReference || 'sans réf'}) rejetée : ${row.errors.join(', ')}`;
        report.errors.push(errDesc);
        report.rejectedDetails?.push({
          row: row.rowIndex,
          reference: row.mainReference || 'Sans référence',
          reason: row.errors.join(', '),
        });
      } else {
        validRows.push(row);
      }
    }

    // 2. Normalize and pre-group rows by pivot reference
    const normalizeRef = (ref: string) => ref.trim().toLowerCase();
    const groupsByRef = new Map<string, ParsedImportRow[]>();

    for (const row of validRows) {
      const refKey = normalizeRef(row.mainReference);
      if (!refKey) continue;
      if (!groupsByRef.has(refKey)) {
        groupsByRef.set(refKey, []);
      }
      groupsByRef.get(refKey)!.push(row);
    }

    // Count strictly unique references
    report.uniqueReferencesCount = groupsByRef.size;

    // Helper: determine target warehouse for a given row
    const getRowWarehouseId = (row: ParsedImportRow): string => {
      if (row.warehouseId && effectiveWarehouses.some((w) => w.id === row.warehouseId)) {
        return row.warehouseId;
      }
      if (row.warehouseName) {
        const found = effectiveWarehouses.find(
          (w) =>
            w.name.toLowerCase().trim() === row.warehouseName!.toLowerCase().trim() ||
            w.code.toLowerCase().trim() === row.warehouseName!.toLowerCase().trim()
        );
        if (found) return found.id;
      }
      return targetWh.id;
    };

    const isCatalogOnlyMode = params.mode === 'CATALOG_IMPORT' || params.mode === 'CATALOG_UPDATE';
    const isStockImportMode = params.mode === 'STOCK_IMPORT' || params.mode === 'INITIAL_IMPORT';

    // 3. Process each unique reference strictly ONCE
    for (const [normRef, rowsForRef] of groupsByRef.entries()) {
      // Find if master article already exists in catalog (by mainReference or equivalent cross-references)
      const existingIndex = nextArticles.findIndex(
        (a) =>
          normalizeRef(a.mainReference) === normRef ||
          a.equivalentReferences?.some((eq) => normalizeRef(eq) === normRef)
      );
      const existing = existingIndex !== -1 ? nextArticles[existingIndex] : null;

      // Extract consolidated non-empty metadata for this reference from the group
      const masterRow = rowsForRef[0];
      const masterReference = existing ? existing.mainReference : masterRow.mainReference.trim();

      const explicitDesignation = rowsForRef
        .find((r) => r.hasDesignation && r.designation?.trim())
        ?.designation?.trim();
      const bestDesignation =
        explicitDesignation ||
        existing?.designation ||
        masterRow.designation?.trim() ||
        `Pièce Réf. ${masterReference}`;

      const explicitDescription = rowsForRef
        .find((r) => r.hasDescription && r.description?.trim())
        ?.description?.trim();
      const bestDescription = explicitDescription || existing?.description || existing?.notes;

      const bestCategory =
        rowsForRef.find((r) => r.category)?.category ||
        existing?.category ||
        masterRow.category ||
        'Filtration';

      // Collect all distinct non-empty locations across rows for this reference (prefixed with warehouse name)
      const refLocationsSet = new Set<string>();
      if (existing?.defaultLocation && existing.defaultLocation !== 'Non renseigné') {
        const prefExisting = prefixLocationWithWarehouse(existing.defaultLocation, targetWh.name);
        if (prefExisting !== 'Non renseigné') {
          prefExisting
            .split(/\s*•\s*/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => refLocationsSet.add(s));
        }
      }
      for (const r of rowsForRef) {
        const rowWhId = getRowWarehouseId(r);
        const rowWhObj = effectiveWarehouses.find((w) => w.id === rowWhId) || targetWh;
        if (r.hasLocation && r.physicalLocation && r.physicalLocation !== 'Non renseigné') {
          const prefRowLoc = prefixLocationWithWarehouse(r.physicalLocation, rowWhObj.name);
          if (prefRowLoc !== 'Non renseigné') {
            prefRowLoc
              .split(/\s*•\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((s) => refLocationsSet.add(s));
          }
        }
      }
      const bestLocation =
        refLocationsSet.size > 0 ? Array.from(refLocationsSet).join(' • ') : 'Non renseigné';

      // Collect all distinct non-empty invoice numbers across rows for this reference
      const refInvoicesSet = new Set<string>();
      if (existing?.invoiceNumber) {
        existing.invoiceNumber
          .split(/\s*,\s*|\s*;\s*|\s*\|\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => refInvoicesSet.add(s));
      }
      for (const r of rowsForRef) {
        if (r.hasInvoiceNumber && r.invoiceNumber?.trim()) {
          refInvoicesSet.add(r.invoiceNumber.trim());
        }
      }
      const bestInvoiceNumber =
        refInvoicesSet.size > 0 ? Array.from(refInvoicesSet).join(', ') : existing?.invoiceNumber;

      const explicitMinThresholdRow = rowsForRef.find((r) => r.hasMinThreshold);
      const bestMinThreshold = explicitMinThresholdRow
        ? explicitMinThresholdRow.minStockThreshold
        : existing?.minStockThreshold ?? 2;

      const bestRack = rowsForRef.find((r) => r.rack?.trim())?.rack?.trim() || existing?.rack;
      const bestShelf = rowsForRef.find((r) => r.shelf?.trim())?.shelf?.trim() || existing?.shelf;
      const bestBin = rowsForRef.find((r) => r.bin?.trim())?.bin?.trim() || existing?.bin;
      const bestSupplier =
        rowsForRef.find((r) => r.preferredSupplier?.trim())?.preferredSupplier?.trim() ||
        existing?.preferredSupplier;
      const bestBarcode =
        rowsForRef.find((r) => r.barcode?.trim())?.barcode?.trim() || existing?.barcode;
      const bestImageUrl =
        rowsForRef.find((r) => r.imageUrl?.trim())?.imageUrl?.trim() || existing?.imageUrl;

      // Collect all unique cross-references (non-destructive merge)
      const mergedEquivalentsSet = new Set<string>();
      if (existing?.equivalentReferences) {
        existing.equivalentReferences.forEach((eq) => {
          if (eq && eq.trim()) mergedEquivalentsSet.add(eq.trim());
        });
      }
      for (const r of rowsForRef) {
        if (r.equivalentReferences) {
          r.equivalentReferences.forEach((eq) => {
            if (eq && eq.trim()) mergedEquivalentsSet.add(eq.trim());
          });
        }
      }
      const allEquivalents = Array.from(mergedEquivalentsSet).filter(Boolean);

      // Consolidate brand variables, quantities, locations, and invoice numbers for this reference
      interface BrandAccumulator {
        brandName: string;
        purchasePrice: number;
        hasPurchasePrice: boolean;
        salePrice: number;
        hasSalePrice: boolean;
        preferredSupplier?: string;
        barcode?: string;
        locationsSet: Set<string>;
        invoicesSet: Set<string>;
        warehouseQtys: Record<string, number>;
        warehousesTouched: Set<string>;
        warehouseLocations: Record<string, Set<string>>;
        warehouseInvoices: Record<string, Set<string>>;
        hasExplicitQty: boolean;
      }

      const brandMap = new Map<string, BrandAccumulator>();

      for (const r of rowsForRef) {
        const brandName = (r.brand || '').trim();
        const brandKey = brandName.toLowerCase();
        const whId = getRowWarehouseId(r);
        const whObj = effectiveWarehouses.find((w) => w.id === whId) || targetWh;
        const qty = Math.max(0, Math.floor(r.initialQuantity ?? 0));
        const rowPrefixedLoc =
          r.hasLocation && r.physicalLocation && r.physicalLocation !== 'Non renseigné'
            ? prefixLocationWithWarehouse(r.physicalLocation, whObj.name)
            : '';

        if (!brandMap.has(brandKey)) {
          const locs = new Set<string>();
          const whLocs = new Set<string>();
          if (rowPrefixedLoc && rowPrefixedLoc !== 'Non renseigné') {
            locs.add(rowPrefixedLoc);
            whLocs.add(rowPrefixedLoc);
          }
          const invs = new Set<string>();
          const whInvs = new Set<string>();
          if (r.hasInvoiceNumber && r.invoiceNumber?.trim()) {
            const cleanInv = r.invoiceNumber.trim();
            invs.add(cleanInv);
            whInvs.add(cleanInv);
          }

          brandMap.set(brandKey, {
            brandName,
            purchasePrice: Math.max(0, r.purchasePrice || 0),
            hasPurchasePrice: !!r.hasPurchasePrice && (r.purchasePrice || 0) > 0,
            salePrice: Math.max(0, r.salePrice || 0),
            hasSalePrice: !!r.hasSalePrice && (r.salePrice || 0) > 0,
            preferredSupplier: r.preferredSupplier?.trim() || undefined,
            barcode: r.barcode?.trim() || undefined,
            locationsSet: locs,
            invoicesSet: invs,
            warehouseQtys: { [whId]: qty },
            warehousesTouched: new Set([whId]),
            warehouseLocations: { [whId]: whLocs },
            warehouseInvoices: { [whId]: whInvs },
            hasExplicitQty: !!r.hasQuantity,
          });
        } else {
          const acc = brandMap.get(brandKey)!;
          if (r.hasPurchasePrice && r.purchasePrice && r.purchasePrice > 0) {
            acc.purchasePrice = r.purchasePrice;
            acc.hasPurchasePrice = true;
          }
          if (r.hasSalePrice && r.salePrice && r.salePrice > 0) {
            acc.salePrice = r.salePrice;
            acc.hasSalePrice = true;
          }
          if (r.preferredSupplier?.trim()) acc.preferredSupplier = r.preferredSupplier.trim();
          if (r.barcode?.trim()) acc.barcode = r.barcode.trim();

          if (!acc.warehouseLocations[whId]) {
            acc.warehouseLocations[whId] = new Set<string>();
          }
          if (!acc.warehouseInvoices[whId]) {
            acc.warehouseInvoices[whId] = new Set<string>();
          }

          const isNewDistinctLocationInSameWh =
            Boolean(rowPrefixedLoc && rowPrefixedLoc !== 'Non renseigné') &&
            acc.warehouseLocations[whId].size > 0 &&
            !acc.warehouseLocations[whId].has(rowPrefixedLoc);

          if (rowPrefixedLoc && rowPrefixedLoc !== 'Non renseigné') {
            acc.locationsSet.add(rowPrefixedLoc);
            acc.warehouseLocations[whId].add(rowPrefixedLoc);
          }
          if (r.hasInvoiceNumber && r.invoiceNumber?.trim()) {
            const cleanInv = r.invoiceNumber.trim();
            acc.invoicesSet.add(cleanInv);
            acc.warehouseInvoices[whId].add(cleanInv);
          }
          if (r.hasQuantity) acc.hasExplicitQty = true;

          if (!acc.warehousesTouched.has(whId)) {
            acc.warehousesTouched.add(whId);
            acc.warehouseQtys[whId] = qty;
          } else if (isNewDistinctLocationInSameWh) {
            // Multiple distinct shelf locations for the same brand in the same warehouse within the same file
            acc.warehouseQtys[whId] = (acc.warehouseQtys[whId] || 0) + qty;
          } else {
            // Same brand & location in same warehouse: use the latest specified quantity
            acc.warehouseQtys[whId] = qty;
          }
        }
      }

      let activeArticle: Article;

      if (existing) {
        // --- CASE 1: EXISTING ARTICLE IN CATALOG (NON-DESTRUCTIVE UPDATE) ---
        let existingOffers: ArticleBrandOffer[] =
          existing.brandOffers && existing.brandOffers.length > 0
            ? [...existing.brandOffers]
            : [
                {
                  id: `bo_${existing.id}_init`,
                  brand: existing.brand || '',
                  brandReference: existing.mainReference,
                  purchasePrice: existing.purchasePrice,
                  salePrice: existing.salePrice,
                  location: prefixLocationWithWarehouse(existing.defaultLocation, targetWh.name),
                  invoiceNumber: existing.invoiceNumber,
                  preferredSupplier: existing.preferredSupplier,
                  barcode: existing.barcode,
                  isDefault: true,
                },
              ];

        // If we are importing real brands (e.g. Caterpillar, CTP, ITR) onto an article that only had a blank "Générique" placeholder from a catalog-only import, replace the placeholder cleanly
        const hasRealNonGenericBrandInImport = Array.from(brandMap.keys()).some(
          (k) => k !== 'générique' && k !== 'generique'
        );
        if (
          hasRealNonGenericBrandInImport &&
          existingOffers.length === 1 &&
          (existingOffers[0].brand.toLowerCase() === 'générique' ||
            existingOffers[0].brand.toLowerCase() === 'generique') &&
          (existingOffers[0].purchasePrice || 0) === 0 &&
          (existingOffers[0].salePrice || 0) === 0 &&
          !(existingOffers[0].stockQuantity && existingOffers[0].stockQuantity > 0)
        ) {
          existingOffers = [];
        }

        // Only update/create brand offers if not a pure catalog-only update without brands
        const shouldProcessBrands =
          !isCatalogOnlyMode || hasRealNonGenericBrandInImport || existingOffers.length === 0;

        if (shouldProcessBrands) {
          for (const [bKey, acc] of brandMap.entries()) {
            const offerIdx = existingOffers.findIndex(
              (o) => o.brand.toLowerCase().trim() === bKey
            );

            const newLocs = Array.from(acc.locationsSet);
            const newInvs = Array.from(acc.invoicesSet);

            if (offerIdx === -1) {
              // New brand offer to attach to this existing article
              existingOffers.push({
                id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                brand: acc.brandName,
                brandReference: existing.mainReference,
                purchasePrice: acc.hasPurchasePrice ? acc.purchasePrice : existing.purchasePrice || 0,
                salePrice: acc.hasSalePrice ? acc.salePrice : existing.salePrice || 0,
                location:
                  newLocs.length > 0
                    ? newLocs.join(' • ')
                    : prefixLocationWithWarehouse(existing.defaultLocation, targetWh.name),
                locations: newLocs.length > 0 ? newLocs : undefined,
                invoiceNumber: newInvs.length > 0 ? newInvs.join(', ') : undefined,
                invoiceNumbers: newInvs.length > 0 ? newInvs : undefined,
                isDefault: existingOffers.length === 0,
                ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
                ...(acc.barcode ? { barcode: acc.barcode } : {}),
              });
              report.brandOffersCreatedCount += 1;
            } else {
              // Update existing brand offer
              const prevOffer = existingOffers[offerIdx];
              const finalOfferLocs =
                newLocs.length > 0
                  ? newLocs
                  : prevOffer.locations && prevOffer.locations.length > 0
                  ? prevOffer.locations.map((l) => prefixLocationWithWarehouse(l, targetWh.name))
                  : prevOffer.location && prevOffer.location !== 'Non renseigné'
                  ? [prefixLocationWithWarehouse(prevOffer.location, targetWh.name)]
                  : [];

              const finalOfferInvs =
                newInvs.length > 0
                  ? newInvs
                  : prevOffer.invoiceNumbers && prevOffer.invoiceNumbers.length > 0
                  ? prevOffer.invoiceNumbers
                  : prevOffer.invoiceNumber
                  ? [prevOffer.invoiceNumber]
                  : [];

              existingOffers[offerIdx] = {
                ...prevOffer,
                purchasePrice:
                  acc.hasPurchasePrice && acc.purchasePrice > 0
                    ? acc.purchasePrice
                    : prevOffer.purchasePrice,
                salePrice:
                  acc.hasSalePrice && acc.salePrice > 0
                    ? acc.salePrice
                    : prevOffer.salePrice,
                ...(finalOfferLocs.length > 0
                  ? {
                      location: finalOfferLocs.join(' • '),
                      locations: finalOfferLocs,
                    }
                  : {}),
                ...(finalOfferInvs.length > 0
                  ? {
                      invoiceNumber: finalOfferInvs.join(', '),
                      invoiceNumbers: finalOfferInvs,
                    }
                  : {}),
                ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
                ...(acc.barcode ? { barcode: acc.barcode } : {}),
              };
            }
          }
        }

        const primaryOffer =
          existingOffers.find((o) => o.isDefault) || existingOffers[0];

        const updatedArt: Article = {
          ...existing,
          designation: explicitDesignation ? explicitDesignation : existing.designation,
          ...(bestDescription ? { description: bestDescription, notes: bestDescription } : {}),
          brand: primaryOffer?.brand || existing.brand,
          category: bestCategory || existing.category,
          minStockThreshold: explicitMinThresholdRow
            ? bestMinThreshold
            : existing.minStockThreshold,
          equivalentReferences: allEquivalents,
          brandOffers: existingOffers,
          defaultLocation:
            bestLocation !== 'Non renseigné'
              ? bestLocation
              : prefixLocationWithWarehouse(existing.defaultLocation, targetWh.name),
          ...(bestInvoiceNumber ? { invoiceNumber: bestInvoiceNumber } : {}),
          purchasePrice: primaryOffer?.purchasePrice ?? existing.purchasePrice,
          salePrice: primaryOffer?.salePrice ?? existing.salePrice,
          updatedAt: nowIso,
        };

        nextArticles[existingIndex] = updatedArt;
        activeArticle = updatedArt;
        report.updatedArticles += 1;
      } else {
        // --- CASE 2: BRAND NEW ARTICLE IN CATALOG ---
        const newArtId = generateArticleId(nextArticles.length);
        const builtOffers: ArticleBrandOffer[] = Array.from(brandMap.values()).map((acc, idx) => {
          const locs = Array.from(acc.locationsSet);
          const invs = Array.from(acc.invoicesSet);
          return {
            id: `bo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            brand: acc.brandName,
            brandReference: masterReference,
            purchasePrice: acc.purchasePrice,
            salePrice: acc.salePrice,
            location: locs.length > 0 ? locs.join(' • ') : bestLocation,
            ...(locs.length > 0 ? { locations: locs } : {}),
            ...(invs.length > 0
              ? { invoiceNumber: invs.join(', '), invoiceNumbers: invs }
              : {}),
            isDefault: idx === 0,
            ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
            ...(acc.barcode ? { barcode: acc.barcode } : {}),
          };
        });

        report.brandOffersCreatedCount += builtOffers.length;

        const primaryOffer = builtOffers[0] || {
          id: `bo_${newArtId}_init`,
          brand: '',
          brandReference: masterReference,
          purchasePrice: 0,
          salePrice: 0,
          location: bestLocation,
          isDefault: true,
        };

        const newArt: Article = {
          id: newArtId,
          mainReference: masterReference,
          designation: bestDesignation,
          ...(bestDescription ? { description: bestDescription, notes: bestDescription } : {}),
          brand: primaryOffer.brand,
          category: bestCategory,
          compatibleMachines: [],
          equivalentReferences: allEquivalents,
          purchasePrice: primaryOffer.purchasePrice,
          salePrice: primaryOffer.salePrice,
          minStockThreshold: bestMinThreshold,
          brandOffers: builtOffers,
          defaultLocation: bestLocation,
          ...(bestInvoiceNumber ? { invoiceNumber: bestInvoiceNumber } : {}),
          warehouseLocation: targetWh.name,
          unit: 'Unité',
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso,
          ...(bestRack ? { rack: bestRack } : {}),
          ...(bestShelf ? { shelf: bestShelf } : {}),
          ...(bestBin ? { bin: bestBin } : {}),
          ...(bestSupplier ? { preferredSupplier: bestSupplier } : {}),
          ...(bestBarcode ? { barcode: bestBarcode } : {}),
          ...(bestImageUrl ? { imageUrl: bestImageUrl, imageType: 'SUPPLIER_IMAGE' as const } : {}),
        };

        nextArticles = [newArt, ...nextArticles];
        activeArticle = newArt;
        report.createdArticles += 1;
      }

      // 4. Consolidate warehouse stocks & movements per warehouse for this article
      // IMPORTANT: Stock import (STOCK_IMPORT / INITIAL_IMPORT) UPDATES/REPLACES the stock for the imported brands in that warehouse instead of adding to previous imports!
      const allWarehouseIds = Array.from(new Set(effectiveWarehouses.map((w) => w.id)));

      for (const whId of allWarehouseIds) {
        const whObj = effectiveWarehouses.find((w) => w.id === whId) || targetWh;
        const brandQtysForWh: Record<string, number> = {};
        const brandLocsForWh: Record<string, string> = {};
        const brandInvsForWh: Record<string, string> = {};
        let totalQtyInThisWh = 0;
        let hasRowsForThisWh = false;

        for (const acc of brandMap.values()) {
          if (acc.warehousesTouched.has(whId)) {
            hasRowsForThisWh = true;
            const q = acc.warehouseQtys[whId] ?? 0;
            if (!isCatalogOnlyMode || params.overwriteExistingStock) {
              brandQtysForWh[acc.brandName] = q;
              totalQtyInThisWh += q;
            }
            const whLocSet = acc.warehouseLocations[whId];
            if (whLocSet && whLocSet.size > 0) {
              brandLocsForWh[acc.brandName] = Array.from(whLocSet)
                .map((l) => prefixLocationWithWarehouse(l, whObj.name))
                .join(' • ');
            }
            const whInvSet = acc.warehouseInvoices[whId];
            if (whInvSet && whInvSet.size > 0) {
              brandInvsForWh[acc.brandName] = Array.from(whInvSet).join(', ');
            }
          }
        }

        const existingStockIdx = nextStocks.findIndex(
          (s) => s.articleId === activeArticle.id && s.warehouseId === whId
        );
        const currentStockQty =
          existingStockIdx !== -1 ? nextStocks[existingStockIdx].quantity : 0;

        if (existing) {
          // For an existing article:
          // - In STOCK_IMPORT or INITIAL_IMPORT mode, any row targeting this warehouse sets/updates the stock for its brand(s) in this warehouse!
          // - In CATALOG_IMPORT mode, stock is untouched unless overwriteExistingStock is explicitly requested.
          const shouldApplyStock =
            hasRowsForThisWh && (!isCatalogOnlyMode || Boolean(params.overwriteExistingStock));

          if (shouldApplyStock || Object.keys(brandLocsForWh).length > 0 || Object.keys(brandInvsForWh).length > 0) {
            if (existingStockIdx !== -1) {
              const prevStock = nextStocks[existingStockIdx];
              const mergedBreakdown: Record<string, number> = { ...(prevStock.brandBreakdown || {}) };

              // Remove placeholder "Générique" key if real brands are being stocked
              const importingNonGeneric = Object.keys(brandQtysForWh).some(
                (b) => b.toLowerCase() !== 'générique' && b.toLowerCase() !== 'generique'
              );
              if (importingNonGeneric) {
                for (const k of Object.keys(mergedBreakdown)) {
                  if (k.toLowerCase() === 'générique' || k.toLowerCase() === 'generique') {
                    delete mergedBreakdown[k];
                  }
                }
              }

              if (shouldApplyStock) {
                for (const [b, q] of Object.entries(brandQtysForWh)) {
                  const existingKey =
                    Object.keys(mergedBreakdown).find(
                      (k) => k.toLowerCase().trim() === b.toLowerCase().trim()
                    ) || b;
                  // Replace the brand's quantity in this warehouse with the newly imported quantity
                  mergedBreakdown[existingKey] = q;
                }
              }

              const mergedLocations: Record<string, string> = { ...(prevStock.brandLocations || {}) };
              // Ensure all existing locations in this warehouse are prefixed with whObj.name
              for (const k of Object.keys(mergedLocations)) {
                mergedLocations[k] = prefixLocationWithWarehouse(mergedLocations[k], whObj.name);
              }
              for (const [b, locStr] of Object.entries(brandLocsForWh)) {
                const existingKey =
                  Object.keys(mergedLocations).find(
                    (k) => k.toLowerCase().trim() === b.toLowerCase().trim()
                  ) || b;
                mergedLocations[existingKey] = prefixLocationWithWarehouse(locStr, whObj.name);
              }

              const mergedInvoices: Record<string, string> = { ...(prevStock.brandInvoices || {}) };
              for (const [b, invStr] of Object.entries(brandInvsForWh)) {
                const existingKey =
                  Object.keys(mergedInvoices).find(
                    (k) => k.toLowerCase().trim() === b.toLowerCase().trim()
                  ) || b;
                mergedInvoices[existingKey] = invStr;
              }

              const breakdownTotal = Object.values(mergedBreakdown).reduce(
                (s, v) => s + Math.max(0, Number(v) || 0),
                0
              );
              const newTotalQty = shouldApplyStock ? breakdownTotal : currentStockQty;

              const whShelfLocValues = Object.values(mergedLocations).filter(
                (l) => l && l !== 'Non renseigné'
              );
              const updatedShelfLocation =
                whShelfLocValues.length > 0
                  ? Array.from(new Set(whShelfLocValues)).join(' • ')
                  : prevStock.shelfLocation && prevStock.shelfLocation !== 'Non renseigné'
                  ? prefixLocationWithWarehouse(prevStock.shelfLocation, whObj.name)
                  : 'Non renseigné';

              nextStocks[existingStockIdx] = {
                ...prevStock,
                quantity: newTotalQty,
                brandBreakdown: mergedBreakdown,
                brandLocations: mergedLocations,
                brandInvoices: mergedInvoices,
                shelfLocation: updatedShelfLocation,
                ...(bestInvoiceNumber
                  ? { invoiceNumber: bestInvoiceNumber }
                  : prevStock.invoiceNumber
                  ? { invoiceNumber: prevStock.invoiceNumber }
                  : {}),
                lastInventoryDate: nowIso,
                updatedAt: nowIso,
              };

              if (shouldApplyStock) {
                report.totalQuantityImported += totalQtyInThisWh;
                if (totalQtyInThisWh > 0) {
                  report.positiveStockEntriesCount += 1;
                }

                if (newTotalQty !== currentStockQty) {
                  const brandSummary = Object.entries(brandQtysForWh)
                    .map(([b, q]) => `${b} (${q})`)
                    .join(', ');

                  const docRef =
                    bestInvoiceNumber ||
                    `IMP-MAJ-${new Date().getFullYear()}-${activeArticle.id.slice(-4).toUpperCase()}`;

                  const newMvtId = generateMovementId();
                  const updateMovement: StockMovement = {
                    id: newMvtId,
                    date: nowIso,
                    type: currentStockQty === 0 ? 'ENTREE' : 'AJUSTEMENT',
                    articleId: activeArticle.id,
                    quantity: Math.abs(newTotalQty - currentStockQty),
                    targetWarehouseId: whId,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    documentRef: docRef,
                    reason: `Mise à jour stock par importation : ${brandSummary}`,
                    thirdParty: bestSupplier || 'Import Stock Excel/CSV',
                    unitPrice: activeArticle.purchasePrice,
                    totalPrice: activeArticle.purchasePrice * Math.abs(newTotalQty - currentStockQty),
                    stockBefore: currentStockQty,
                    stockAfter: newTotalQty,
                    notes: `Mise à jour du stock dans ${whObj.name} pour ${activeArticle.mainReference} (${brandSummary}) : ancien stock ${currentStockQty} ➔ nouveau stock ${newTotalQty}`,
                  };

                  nextMovements = [updateMovement, ...nextMovements];
                  report.createdMovements += 1;
                }
              }
            } else {
              const whShelfLocValues = Object.values(brandLocsForWh).filter(
                (l) => l && l !== 'Non renseigné'
              );
              const initialWhShelfLoc =
                whShelfLocValues.length > 0
                  ? Array.from(new Set(whShelfLocValues)).join(' • ')
                  : 'Non renseigné';

              nextStocks.push({
                articleId: activeArticle.id,
                warehouseId: whId,
                quantity: shouldApplyStock ? totalQtyInThisWh : 0,
                brandBreakdown: shouldApplyStock ? brandQtysForWh : {},
                brandLocations: brandLocsForWh,
                brandInvoices: brandInvsForWh,
                shelfLocation: initialWhShelfLoc,
                ...(bestInvoiceNumber ? { invoiceNumber: bestInvoiceNumber } : {}),
                lastInventoryDate: nowIso,
              });

              if (shouldApplyStock) {
                report.totalQuantityImported += totalQtyInThisWh;
                if (totalQtyInThisWh > 0) {
                  report.positiveStockEntriesCount += 1;
                  const brandSummary = Object.entries(brandQtysForWh)
                    .map(([b, q]) => `${b} (${q})`)
                    .join(', ');

                  const docRef =
                    bestInvoiceNumber ||
                    `IMP-STOCK-${new Date().getFullYear()}-${activeArticle.id.slice(-4).toUpperCase()}`;

                  const newMvtId = generateMovementId();
                  const initMovement: StockMovement = {
                    id: newMvtId,
                    date: nowIso,
                    type: 'ENTREE',
                    articleId: activeArticle.id,
                    quantity: totalQtyInThisWh,
                    targetWarehouseId: whId,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    documentRef: docRef,
                    reason: `Initialisation stock par importation : ${brandSummary}`,
                    thirdParty: bestSupplier || 'Import Stock Excel/CSV',
                    unitPrice: activeArticle.purchasePrice,
                    totalPrice: activeArticle.purchasePrice * totalQtyInThisWh,
                    stockBefore: 0,
                    stockAfter: totalQtyInThisWh,
                    notes: `Importation stock de ${totalQtyInThisWh} unité(s) pour la référence ${activeArticle.mainReference} (${brandSummary}) dans ${whObj.name}`,
                  };

                  nextMovements = [initMovement, ...nextMovements];
                  report.createdMovements += 1;
                }
              }
            }
          }
        } else {
          // Brand new article: initialize stock record for this warehouse
          const whShelfLocValues = Object.values(brandLocsForWh).filter(
            (l) => l && l !== 'Non renseigné'
          );
          const initialWhShelfLoc =
            whShelfLocValues.length > 0
              ? Array.from(new Set(whShelfLocValues)).join(' • ')
              : whId === targetWh.id && bestLocation !== 'Non renseigné'
              ? prefixLocationWithWarehouse(bestLocation, whObj.name)
              : 'Non renseigné';

          nextStocks.push({
            articleId: activeArticle.id,
            warehouseId: whId,
            quantity: totalQtyInThisWh,
            brandBreakdown: brandQtysForWh,
            brandLocations: brandLocsForWh,
            brandInvoices: brandInvsForWh,
            shelfLocation: initialWhShelfLoc,
            ...(bestInvoiceNumber ? { invoiceNumber: bestInvoiceNumber } : {}),
            lastInventoryDate: nowIso,
          });

          if (totalQtyInThisWh > 0) {
            report.positiveStockEntriesCount += 1;
            report.totalQuantityImported += totalQtyInThisWh;

            const brandSummary = Object.entries(brandQtysForWh)
              .map(([b, q]) => `${b} (${q})`)
              .join(', ');

            const docRef =
              bestInvoiceNumber ||
              `IMPORT-INIT-${new Date().getFullYear()}-${activeArticle.id.slice(-4).toUpperCase()}`;

            const newMvtId = generateMovementId();
            const initMovement: StockMovement = {
              id: newMvtId,
              date: nowIso,
              type: 'ENTREE',
              articleId: activeArticle.id,
              quantity: totalQtyInThisWh,
              targetWarehouseId: whId,
              userId: currentUser.id,
              userName: currentUser.name,
              documentRef: docRef,
              reason: `Stock initial importé : ${brandSummary}`,
              thirdParty: bestSupplier || 'Import Fichier Excel/CSV',
              unitPrice: activeArticle.purchasePrice,
              totalPrice: activeArticle.purchasePrice * totalQtyInThisWh,
              stockBefore: 0,
              stockAfter: totalQtyInThisWh,
              notes: `Création initiale de ${totalQtyInThisWh} unité(s) (${brandSummary})${bestInvoiceNumber ? ` — Facture: ${bestInvoiceNumber}` : ''} pour la référence ${activeArticle.mainReference} dans le magasin ${whObj.name}`,
            };

            nextMovements = [initMovement, ...nextMovements];
            report.createdMovements += 1;
          }
        }
      }

      // 5. Sync each brandOffer.stockQuantity and warehouse-prefixed locations with the total warehouse stock for that brand on this article
      const articleStocks = nextStocks.filter((s) => s.articleId === activeArticle.id);
      if (activeArticle.brandOffers && activeArticle.brandOffers.length > 0) {
        const allArticleLocsSet = new Set<string>();
        const syncedOffers = activeArticle.brandOffers.map((bo) => {
          const normB = bo.brand.toLowerCase().trim();
          let brandSum = 0;
          const boLocsSet = new Set<string>();

          for (const st of articleStocks) {
            const whObj = effectiveWarehouses.find((w) => w.id === st.warehouseId) || targetWh;
            if (st.brandBreakdown) {
              const matchKey = Object.keys(st.brandBreakdown).find(
                (k) => k.toLowerCase().trim() === normB
              );
              if (matchKey !== undefined) {
                brandSum += Math.max(0, Number(st.brandBreakdown[matchKey]) || 0);
              }
            }
            if (st.brandLocations) {
              const locKey = Object.keys(st.brandLocations).find(
                (k) => k.toLowerCase().trim() === normB
              );
              if (locKey && st.brandLocations[locKey] && st.brandLocations[locKey] !== 'Non renseigné') {
                const pref = prefixLocationWithWarehouse(st.brandLocations[locKey], whObj.name);
                if (pref !== 'Non renseigné') {
                  pref.split(/\s*•\s*/).forEach((seg) => {
                    if (seg.trim()) {
                      boLocsSet.add(seg.trim());
                      allArticleLocsSet.add(seg.trim());
                    }
                  });
                }
              }
            }
          }

          if (boLocsSet.size === 0 && bo.location && bo.location !== 'Non renseigné') {
            const pref = prefixLocationWithWarehouse(bo.location, targetWh.name);
            if (pref !== 'Non renseigné') {
              pref.split(/\s*•\s*/).forEach((seg) => {
                if (seg.trim()) {
                  boLocsSet.add(seg.trim());
                  allArticleLocsSet.add(seg.trim());
                }
              });
            }
          }

          const boLocsArr = Array.from(boLocsSet);
          return {
            ...bo,
            stockQuantity: brandSum,
            location: boLocsArr.length > 0 ? boLocsArr.join(' • ') : 'Non renseigné',
            ...(boLocsArr.length > 0 ? { locations: boLocsArr } : {}),
          };
        });

        activeArticle = {
          ...activeArticle,
          brandOffers: syncedOffers,
          defaultLocation:
            allArticleLocsSet.size > 0
              ? Array.from(allArticleLocsSet).join(' • ')
              : activeArticle.defaultLocation,
        };
        const artIdx = nextArticles.findIndex((a) => a.id === activeArticle.id);
        if (artIdx !== -1) {
          nextArticles[artIdx] = activeArticle;
        }
      }
    }

    setArticles(nextArticles);
    setStocks(nextStocks);
    setMovements(nextMovements);

    // Synchronously write to localStorage with quota protection
    safeSetLocalStorage('articles', nextArticles);
    safeSetLocalStorage('stocks', nextStocks);
    safeSetLocalStorage('movements', nextMovements);

    // Automatically persist ONLY modified/new articles, stocks & movements to Firebase (avoids rewriting all 13 collections)
    const prevArticlesSet = new Set(articles);
    const prevStocksSet = new Set(stocks);
    const prevMovementsSet = new Set(movements);
    const changedArticles = nextArticles.filter((a) => !prevArticlesSet.has(a));
    const changedStocks = nextStocks.filter((s) => !prevStocksSet.has(s));
    const changedMovements = nextMovements.filter((m) => !prevMovementsSet.has(m));

    Promise.all([
      changedArticles.length > 0 ? saveMultipleArticlesToFirebase(changedArticles) : Promise.resolve(),
      changedStocks.length > 0 ? saveMultipleStocksToFirebase(changedStocks) : Promise.resolve(),
      changedMovements.length > 0 ? saveMultipleMovementsToFirebase(changedMovements) : Promise.resolve(),
    ]).catch((err) => {
      console.warn('Auto-save to Firebase after import notice (local cache active):', err);
    });

    return { success: true, report };
  };

  // Warehouse Management
  const createWarehouse = (warehouseData: Omit<Warehouse, 'id'>) => {
    const existsCode = warehouses.some((w) => w.code.toLowerCase().trim() === warehouseData.code.toLowerCase().trim());
    if (existsCode) {
      return { success: false, error: `Le code magasin "${warehouseData.code}" existe déjà.` };
    }

    const newId = `mag_${warehouseData.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newWarehouse: Warehouse = {
      ...warehouseData,
      id: newId,
    };

    setWarehouses((prev) => [...prev, newWarehouse]);
    saveWarehouseToFirebase(newWarehouse).catch(console.warn);

    const newStocks: WarehouseStock[] = articles.map((a) => ({
      articleId: a.id,
      warehouseId: newId,
      quantity: 0,
      shelfLocation: a.defaultLocation,
    }));
    setStocks((prev) => [...prev, ...newStocks]);
    saveMultipleStocksToFirebase(newStocks).catch(console.warn);

    return { success: true, warehouse: newWarehouse };
  };

  const updateWarehouse = (id: string, updates: Partial<Warehouse>) => {
    const existing = warehouses.find((w) => w.id === id);
    if (!existing) return { success: false, error: 'Magasin introuvable.' };

    const updated = { ...existing, ...updates };
    setWarehouses((prev) => prev.map((w) => (w.id === id ? updated : w)));
    saveWarehouseToFirebase(updated).catch(console.warn);
    return { success: true };
  };

  const deleteWarehouse = (warehouseId: string): {
    success: boolean;
    error?: string;
    actionType: 'DELETED' | 'ARCHIVED';
    message: string;
  } => {
    if (currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Droits insuffisants : seul un Administrateur peut supprimer ou désactiver un magasin.',
        actionType: 'DELETED',
        message: 'Action refusée',
      };
    }

    const warehouse = warehouses.find((w) => w.id === warehouseId);
    if (!warehouse) {
      return {
        success: false,
        error: 'Magasin introuvable.',
        actionType: 'DELETED',
        message: 'Magasin introuvable',
      };
    }

    if (warehouses.length <= 1) {
      return {
        success: false,
        error: 'Impossible de supprimer le dernier magasin actif du système. Il doit subsister au moins un site de stockage.',
        actionType: 'DELETED',
        message: 'Action impossible',
      };
    }

    if (warehouse.isDefault) {
      return {
        success: false,
        error: `Impossible de supprimer "${warehouse.name}" car il est configuré comme magasin principal par défaut. Veuillez d'abord désigner un autre magasin principal.`,
        actionType: 'DELETED',
        message: 'Magasin principal protégé',
      };
    }

    const hasActiveCashSession = cashSessions.some(
      (cs) => cs.warehouseId === warehouseId && cs.status === 'OPEN'
    );
    if (hasActiveCashSession) {
      return {
        success: false,
        error: `Une session de caisse est actuellement ouverte sur ${warehouse.name}. Clôturez la session avant toute suppression.`,
        actionType: 'DELETED',
        message: 'Caisse ouverte',
      };
    }

    const movementIdsForWh = movements
      .filter((m) => m.sourceWarehouseId === warehouseId || m.targetWarehouseId === warehouseId)
      .map((m) => m.id);

    const nextWarehouses = warehouses.filter((w) => w.id !== warehouseId);
    const nextStocks = stocks.filter((s) => s.warehouseId !== warehouseId);
    const nextMovements = movements.filter(
      (m) => m.sourceWarehouseId !== warehouseId && m.targetWarehouseId !== warehouseId
    );

    setWarehouses(nextWarehouses);
    setStocks(nextStocks);
    setMovements(nextMovements);

    markIdsDeleted('warehouses', [warehouseId]);
    if (movementIdsForWh.length > 0) {
      markIdsDeleted('movements', movementIdsForWh);
    }

    safeSetLocalStorage('warehouses', nextWarehouses);
    safeSetLocalStorage('stocks', nextStocks);
    safeSetLocalStorage('movements', nextMovements);

    deleteWarehouseFromFirebase(warehouseId).catch(console.warn);
    if (movementIdsForWh.length > 0) {
      deleteMovementsFromFirebase(movementIdsForWh).catch(console.warn);
    }

    if (selectedWarehouseId === warehouseId) {
      setSelectedWarehouseId(null);
    }

    return {
      success: true,
      actionType: 'DELETED',
      message: `Le magasin "${warehouse.name}" a été définitivement supprimé.`,
    };
  };

  // Inventory Management — Brand-Aware & Location-Aware
  const buildBrandInventoryItemsForWarehouse = (
    warehouseId: string,
    options?: CreateInventoryOptions
  ): InventoryItemCount[] => {
    const wh = warehouses.find((w) => w.id === warehouseId);
    const result: InventoryItemCount[] = [];

    for (const art of articles) {
      if (art.status === 'archived') continue;
      if (
        options?.scope === 'BY_CATEGORY' &&
        options.targetCategories &&
        options.targetCategories.length > 0 &&
        !options.targetCategories.includes(art.category)
      ) {
        continue;
      }

      const whStock = stocks.find(
        (s) => s.articleId === art.id && s.warehouseId === warehouseId
      );

      // Gather all distinct brands for this article (from catalog brandOffers + warehouse brandBreakdown + brandLocations)
      const offers = getArticleBrandOffers(art);
      const brandMap = new Map<
        string,
        {
          brand: string;
          brandReference: string;
          purchasePrice: number;
          salePrice: number;
        }
      >();

      for (const o of offers) {
        const cleanB = cleanBrandName(o.brand) || cleanBrandName(art.brand);
        const normB = cleanB.toLowerCase();
        if (!brandMap.has(normB)) {
          brandMap.set(normB, {
            brand: cleanB,
            brandReference: o.brandReference || art.mainReference,
            purchasePrice: o.purchasePrice > 0 ? o.purchasePrice : art.purchasePrice,
            salePrice: o.salePrice > 0 ? o.salePrice : art.salePrice,
          });
        }
      }

      if (whStock?.brandBreakdown) {
        for (const bKey of Object.keys(whStock.brandBreakdown)) {
          const cleanB = bKey.trim();
          if (!cleanB) continue;
          const normB = cleanB.toLowerCase();
          if (!brandMap.has(normB)) {
            brandMap.set(normB, {
              brand: cleanB,
              brandReference: art.mainReference,
              purchasePrice: art.purchasePrice,
              salePrice: art.salePrice,
            });
          }
        }
      }

      if (whStock?.brandLocations) {
        for (const bKey of Object.keys(whStock.brandLocations)) {
          const cleanB = cleanBrandName(bKey);
          if (!cleanB) continue;
          const normB = cleanB.toLowerCase();
          if (!brandMap.has(normB)) {
            brandMap.set(normB, {
              brand: cleanB,
              brandReference: art.mainReference,
              purchasePrice: art.purchasePrice,
              salePrice: art.salePrice,
            });
          }
        }
      }

      // Drop ghost empty-brand placeholder if at least one real brand exists for this article
      if (brandMap.size > 1 && brandMap.has('')) {
        brandMap.delete('');
      }

      for (const bEntry of brandMap.values()) {
        const theoQty = getBrandStockAcrossWarehouses(
          stocks,
          art,
          bEntry.brand,
          warehouseId
        );

        if (options?.onlyPositiveStock && theoQty <= 0) {
          continue;
        }

        if (
          options?.scope === 'BY_BRAND' &&
          options.targetBrands &&
          options.targetBrands.length > 0 &&
          !options.targetBrands.some(
            (tb) => tb.toLowerCase().trim() === bEntry.brand.toLowerCase().trim()
          )
        ) {
          continue;
        }

        const fullLoc = getBrandLocation(
          stocks,
          art,
          bEntry.brand,
          warehouseId,
          warehouses
        );
        const pureLoc =
          stripWarehousePrefix(fullLoc, warehouses, wh?.name) || 'Non renseigné';

        if (
          options?.scope === 'BY_LOCATION' &&
          options.targetLocations &&
          options.targetLocations.length > 0
        ) {
          const matchedLoc = options.targetLocations.some((tl) => {
            const normTl = tl.toLowerCase().trim();
            return (
              pureLoc.toLowerCase().trim() === normTl ||
              fullLoc.toLowerCase().trim() === normTl ||
              pureLoc
                .split(/\s*•\s*|\s*\|\s*|\s*;\s*/)
                .some((seg) => seg.toLowerCase().trim() === normTl)
            );
          });
          if (!matchedLoc) continue;
        }

        result.push({
          articleId: art.id,
          brand: bEntry.brand,
          brandReference: bEntry.brandReference,
          location: pureLoc,
          theoreticalQty: theoQty,
          countedQty: null,
          variance: 0,
          unitCost: bEntry.purchasePrice,
          salePrice: bEntry.salePrice,
          varianceValue: 0,
        });
      }
    }

    return result;
  };

  const createInventorySession = (
    warehouseId: string,
    notes?: string,
    options?: CreateInventoryOptions
  ) => {
    const wh = warehouses.find((w) => w.id === warehouseId);
    if (!wh) return { success: false, error: 'Magasin sélectionné invalide.' };

    const activeDraft = inventories.find(
      (inv) =>
        inv.warehouseId === warehouseId &&
        (inv.status === 'DRAFT' || inv.status === 'COUNTING')
    );
    if (activeDraft) {
      return {
        success: false,
        error: `Une session d'inventaire est déjà en cours pour ce magasin (${activeDraft.code}). Veuillez la terminer ou l'annuler d'abord.`,
      };
    }

    const items = buildBrandInventoryItemsForWarehouse(warehouseId, options);
    if (items.length === 0) {
      return {
        success: false,
        error:
          'Aucun article/marque ne correspond aux critères sélectionnés pour cet inventaire.',
      };
    }

    let scopeSummary = 'Inventaire Complet (Toutes marques & emplacements)';
    if (options?.scope === 'BY_LOCATION' && options.targetLocations?.length) {
      scopeSummary = `Par Emplacement (${options.targetLocations.join(', ')})`;
    } else if (options?.scope === 'BY_BRAND' && options.targetBrands?.length) {
      scopeSummary = `Par Marque (${options.targetBrands.join(', ')})`;
    } else if (options?.scope === 'BY_CATEGORY' && options.targetCategories?.length) {
      scopeSummary = `Par Catégorie (${options.targetCategories.join(', ')})`;
    }
    if (options?.onlyPositiveStock) {
      scopeSummary += ' · Stock > 0';
    }

    const sessionCode = `INV-${wh.code}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(inventories.length + 1).padStart(2, '0')}`;

    const nowIso = new Date().toISOString();
    const newSession: InventorySession = {
      id: `INV-${Date.now()}`,
      warehouseId,
      code: sessionCode,
      date: nowIso.slice(0, 10),
      status: 'COUNTING',
      supervisor: currentUser.name,
      scope: options?.scope || 'FULL',
      scopeSummary,
      scopeOptions: options,
      createdAt: nowIso,
      updatedAt: nowIso,
      notes: notes?.trim() || undefined,
      items,
    };

    setInventories((prev) => [newSession, ...prev]);
    saveInventoryToFirebase(newSession).catch(console.warn);
    return { success: true, session: newSession };
  };

  const matchInventoryItemLine = (
    item: InventoryItemCount,
    articleId: string,
    brand?: string
  ): boolean => {
    if (item.articleId !== articleId) return false;
    if (brand === undefined) return true;
    const art = articles.find((a) => a.id === articleId);
    const resolvedItemBrand = cleanBrandName(item.brand || art?.brand).toLowerCase();
    const targetBrand = cleanBrandName(brand).toLowerCase();
    return resolvedItemBrand === targetBrand;
  };

  const updateInventoryCount = (
    sessionId: string,
    articleId: string,
    countedQty: number | null,
    notes?: string,
    brand?: string,
    unitCostOverride?: number
  ) => {
    const nowIso = new Date().toISOString();
    const safeQty =
      countedQty === null ? null : Math.max(0, Math.floor(Number(countedQty) || 0));

    setInventories((prev) =>
      prev.map((session) => {
        if (
          session.id !== sessionId ||
          session.status === 'VALIDATED' ||
          session.status === 'CANCELLED'
        ) {
          return session;
        }

        const updatedItems = session.items.map((item) => {
          if (!matchInventoryItemLine(item, articleId, brand)) return item;
          const nextCost =
            unitCostOverride !== undefined && unitCostOverride >= 0
              ? unitCostOverride
              : item.unitCost;
          const variance = safeQty !== null ? safeQty - item.theoreticalQty : 0;
          const varianceValue = variance * nextCost;
          return {
            ...item,
            unitCost: nextCost,
            countedQty: safeQty,
            variance,
            varianceValue,
            notes: notes !== undefined ? notes : item.notes,
            countedAt: safeQty !== null ? nowIso : undefined,
            countedBy: safeQty !== null ? currentUser.name : undefined,
          };
        });

        const updatedSession: InventorySession = {
          ...session,
          updatedAt: nowIso,
          items: updatedItems,
        };
        saveInventoryToFirebase(updatedSession).catch(console.warn);
        return updatedSession;
      })
    );
  };

  const batchUpdateInventoryCounts = (
    sessionId: string,
    updates: Array<{
      articleId: string;
      brand?: string;
      countedQty: number | null;
      notes?: string;
    }>
  ) => {
    if (!updates || updates.length === 0) return;
    const nowIso = new Date().toISOString();

    setInventories((prev) =>
      prev.map((session) => {
        if (
          session.id !== sessionId ||
          session.status === 'VALIDATED' ||
          session.status === 'CANCELLED'
        ) {
          return session;
        }

        const updatedItems = session.items.map((item) => {
          const matchingUpdate = updates.find((u) =>
            matchInventoryItemLine(item, u.articleId, u.brand)
          );
          if (!matchingUpdate) return item;

          const safeQty =
            matchingUpdate.countedQty === null
              ? null
              : Math.max(0, Math.floor(Number(matchingUpdate.countedQty) || 0));
          const variance = safeQty !== null ? safeQty - item.theoreticalQty : 0;
          const varianceValue = variance * item.unitCost;

          return {
            ...item,
            countedQty: safeQty,
            variance,
            varianceValue,
            notes: matchingUpdate.notes !== undefined ? matchingUpdate.notes : item.notes,
            countedAt: safeQty !== null ? nowIso : undefined,
            countedBy: safeQty !== null ? currentUser.name : undefined,
          };
        });

        const updatedSession: InventorySession = {
          ...session,
          updatedAt: nowIso,
          items: updatedItems,
        };
        saveInventoryToFirebase(updatedSession).catch(console.warn);
        return updatedSession;
      })
    );
  };

  const syncInventorySessionBrands = (
    sessionId: string
  ): { success: boolean; addedLines: number; totalLines: number; error?: string } => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) {
      return { success: false, addedLines: 0, totalLines: 0, error: 'Session introuvable.' };
    }
    if (session.status === 'VALIDATED' || session.status === 'CANCELLED') {
      return {
        success: false,
        addedLines: 0,
        totalLines: session.items.length,
        error: 'Cette session est verrouillée.',
      };
    }

    const freshItems = buildBrandInventoryItemsForWarehouse(
      session.warehouseId,
      session.scopeOptions
    );
    const mergedItems: InventoryItemCount[] = [];
    const matchedOldIndices = new Set<number>();
    let addedLines = 0;

    for (const fresh of freshItems) {
      const art = articles.find((a) => a.id === fresh.articleId);
      const freshBrandNorm = cleanBrandName(fresh.brand || art?.brand).toLowerCase();

      let oldIdx = session.items.findIndex(
        (old, idx) =>
          !matchedOldIndices.has(idx) &&
          old.articleId === fresh.articleId &&
          cleanBrandName(old.brand).toLowerCase() === freshBrandNorm
      );

      if (oldIdx === -1) {
        oldIdx = session.items.findIndex(
          (old, idx) =>
            !matchedOldIndices.has(idx) &&
            old.articleId === fresh.articleId &&
            !old.brand &&
            cleanBrandName(art?.brand).toLowerCase() === freshBrandNorm
        );
      }

      if (oldIdx >= 0) {
        matchedOldIndices.add(oldIdx);
        const oldItem = session.items[oldIdx];
        const countedQty = oldItem.countedQty;
        const unitCost = oldItem.unitCost > 0 ? oldItem.unitCost : fresh.unitCost;
        const variance = countedQty !== null ? countedQty - fresh.theoreticalQty : 0;
        mergedItems.push({
          ...fresh,
          countedQty,
          unitCost,
          variance,
          varianceValue: variance * unitCost,
          notes: oldItem.notes,
          countedAt: oldItem.countedAt,
          countedBy: oldItem.countedBy,
        });
      } else {
        addedLines++;
        mergedItems.push(fresh);
      }
    }

    session.items.forEach((old, idx) => {
      if (!matchedOldIndices.has(idx)) {
        const art = articles.find((a) => a.id === old.articleId);
        if (art) {
          mergedItems.push({
            ...old,
            brand: cleanBrandName(old.brand) || cleanBrandName(art.brand),
          });
        }
      }
    });

    const updatedSession: InventorySession = {
      ...session,
      updatedAt: new Date().toISOString(),
      items: mergedItems,
    };

    setInventories((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
    saveInventoryToFirebase(updatedSession).catch(console.warn);

    return {
      success: true,
      addedLines,
      totalLines: mergedItems.length,
    };
  };

  const validateInventorySession = (sessionId: string) => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session d’inventaire introuvable.' };
    if (session.status === 'VALIDATED') {
      return { success: false, error: 'Cette session est déjà validée et verrouillée.' };
    }
    if (session.status === 'CANCELLED') {
      return { success: false, error: 'Impossible de valider une session annulée.' };
    }

    const wh = warehouses.find((w) => w.id === session.warehouseId);
    if (!wh) return { success: false, error: 'Magasin associé introuvable.' };

    const nowIso = new Date().toISOString();

    // Recompute variances cleanly; uncounted lines keep their theoretical quantity (variance = 0)
    const normalizedItems: InventoryItemCount[] = session.items.map((it) => {
      const art = articles.find((a) => a.id === it.articleId);
      const resolvedBrand = cleanBrandName(it.brand) || cleanBrandName(art?.brand);
      const unitCost = Math.max(0, Number(it.unitCost) || art?.purchasePrice || 0);
      if (it.countedQty === null || it.countedQty === undefined) {
        return {
          ...it,
          brand: resolvedBrand,
          unitCost,
          countedQty: it.theoreticalQty,
          variance: 0,
          varianceValue: 0,
        };
      }
      const safeCounted = Math.max(0, Math.floor(Number(it.countedQty) || 0));
      const variance = safeCounted - it.theoreticalQty;
      return {
        ...it,
        brand: resolvedBrand,
        unitCost,
        countedQty: safeCounted,
        variance,
        varianceValue: variance * unitCost,
      };
    });

    const adjustmentMovements: StockMovement[] = [];
    const updatedStocks = [...stocks];

    // Group items by articleId so multi-brand counts reconcile cleanly
    const itemsByArticle = new Map<string, InventoryItemCount[]>();
    for (const item of normalizedItems) {
      const list = itemsByArticle.get(item.articleId) || [];
      list.push(item);
      itemsByArticle.set(item.articleId, list);
    }

    for (const [articleId, artItems] of itemsByArticle.entries()) {
      const art = articles.find((a) => a.id === articleId);
      if (!art) continue;

      const stockIdx = updatedStocks.findIndex(
        (s) => s.articleId === articleId && s.warehouseId === session.warehouseId
      );
      const existingStock = stockIdx >= 0 ? updatedStocks[stockIdx] : undefined;

      const nextBrandBreakdown: Record<string, number> = {};
      if (existingStock?.brandBreakdown) {
        for (const [k, v] of Object.entries(existingStock.brandBreakdown)) {
          const ck = cleanBrandName(k);
          if (ck) nextBrandBreakdown[ck] = Math.max(0, Number(v) || 0);
        }
      }

      const nextBrandLocations: Record<string, string> = {};
      if (existingStock?.brandLocations) {
        for (const [k, v] of Object.entries(existingStock.brandLocations)) {
          const ck = cleanBrandName(k);
          if (ck && v) nextBrandLocations[ck] = v;
        }
      }

      const hasNamedBrands =
        Object.keys(nextBrandBreakdown).length > 0 ||
        artItems.some((it) => Boolean(cleanBrandName(it.brand || art.brand)));

      // Seed default brand if existing stock had total qty without brand breakdown yet
      if (
        hasNamedBrands &&
        existingStock &&
        existingStock.quantity > 0 &&
        Object.keys(nextBrandBreakdown).length === 0
      ) {
        const defaultB = cleanBrandName(art.brand);
        if (defaultB) {
          nextBrandBreakdown[defaultB] = existingStock.quantity;
        }
      }

      let hasAnyChangeForArticle = false;
      let directUnbrandedQty: number | null = null;
      let updatedShelfLocation = existingStock?.shelfLocation;

      for (const item of artItems) {
        const itemBrand = cleanBrandName(item.brand) || cleanBrandName(art.brand);
        const countedVal = Math.max(0, item.countedQty ?? item.theoreticalQty);

        if (itemBrand) {
          const existingKey =
            Object.keys(nextBrandBreakdown).find(
              (k) => k.toLowerCase().trim() === itemBrand.toLowerCase().trim()
            ) || itemBrand;
          nextBrandBreakdown[existingKey] = countedVal;

          if (item.location && item.location !== 'Non renseigné') {
            const locKey =
              Object.keys(nextBrandLocations).find(
                (k) => k.toLowerCase().trim() === itemBrand.toLowerCase().trim()
              ) || itemBrand;
            nextBrandLocations[locKey] = item.location;
          }
        } else {
          directUnbrandedQty = countedVal;
          if (item.location && item.location !== 'Non renseigné') {
            updatedShelfLocation = item.location;
          }
        }

        if (item.variance !== 0 && item.countedQty !== null) {
          hasAnyChangeForArticle = true;
          const brandLabel = itemBrand ? ` [${itemBrand}]` : '';
          const adjustmentMvt: StockMovement = {
            id: generateMovementId(),
            date: nowIso,
            type: 'AJUSTEMENT',
            articleId: item.articleId,
            quantity: Math.abs(item.variance),
            targetWarehouseId: session.warehouseId,
            userId: currentUser.id,
            userName: currentUser.name,
            documentRef: `PV-${session.code}`,
            reason: `Ajustement d'inventaire${brandLabel} (${item.variance > 0 ? '+' : ''}${item.variance} ${art.unit})`,
            thirdParty: `Inventaire - ${wh.name}`,
            unitPrice: item.unitCost,
            totalPrice: Math.abs(item.varianceValue),
            stockBefore: item.theoreticalQty,
            stockAfter: item.countedQty,
            notes:
              (item.location && item.location !== 'Non renseigné'
                ? `[Empl: ${item.location}] `
                : '') + (item.notes || `Régularisation session ${session.code}`),
          };
          adjustmentMovements.push(adjustmentMvt);
        }
      }

      const namedKeys = Object.keys(nextBrandBreakdown);
      const newTotalWhQty =
        namedKeys.length > 0
          ? namedKeys.reduce((sum, k) => sum + Math.max(0, Number(nextBrandBreakdown[k]) || 0), 0)
          : directUnbrandedQty !== null
          ? directUnbrandedQty
          : existingStock?.quantity ?? 0;

      if (stockIdx >= 0) {
        updatedStocks[stockIdx] = {
          ...updatedStocks[stockIdx],
          quantity: newTotalWhQty,
          brandBreakdown: namedKeys.length > 0 ? nextBrandBreakdown : undefined,
          brandLocations:
            Object.keys(nextBrandLocations).length > 0
              ? nextBrandLocations
              : updatedStocks[stockIdx].brandLocations,
          shelfLocation: updatedShelfLocation || updatedStocks[stockIdx].shelfLocation,
          lastInventoryDate: nowIso,
          updatedAt: nowIso,
        };
      } else if (hasAnyChangeForArticle || newTotalWhQty > 0) {
        updatedStocks.push({
          articleId,
          warehouseId: session.warehouseId,
          quantity: newTotalWhQty,
          brandBreakdown: namedKeys.length > 0 ? nextBrandBreakdown : undefined,
          brandLocations:
            Object.keys(nextBrandLocations).length > 0 ? nextBrandLocations : undefined,
          shelfLocation:
            updatedShelfLocation ||
            artItems.find((i) => i.location && i.location !== 'Non renseigné')?.location ||
            'Non renseigné',
          lastInventoryDate: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    setStocks(updatedStocks);
    if (adjustmentMovements.length > 0) {
      setMovements((prev) => [...adjustmentMovements, ...prev]);
      adjustmentMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));
    }
    saveMultipleStocksToFirebase(updatedStocks).catch(console.warn);

    const validatedSession: InventorySession = {
      ...session,
      items: normalizedItems,
      status: 'VALIDATED',
      updatedAt: nowIso,
      validatedAt: nowIso,
      validatedBy: currentUser.name,
    };
    setInventories((prev) =>
      prev.map((s) => (s.id === sessionId ? validatedSession : s))
    );
    saveInventoryToFirebase(validatedSession).catch(console.warn);

    return { success: true };
  };

  const cancelInventorySession = (sessionId: string) => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session introuvable.' };
    if (session.status === 'VALIDATED') {
      return { success: false, error: 'Impossible d’annuler une session déjà validée.' };
    }
    if (session.status === 'CANCELLED') {
      return { success: false, error: 'Cette session est déjà annulée.' };
    }

    const cancelledSession: InventorySession = {
      ...session,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    };
    setInventories((prev) =>
      prev.map((s) => (s.id === sessionId ? cancelledSession : s))
    );
    saveInventoryToFirebase(cancelledSession).catch(console.warn);
    return { success: true };
  };

  const deleteInventorySession = (sessionId: string) => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session introuvable.' };
    if (session.status === 'VALIDATED') {
      return {
        success: false,
        error: 'Impossible de supprimer une session validée (archivée pour traçabilité).',
      };
    }

    setInventories((prev) => prev.filter((s) => s.id !== sessionId));
    deleteInventoryFromFirebase(sessionId).catch(console.warn);
    return { success: true };
  };

  const updateStockLocationInWarehouse = (
    articleId: string,
    warehouseId: string,
    newLocation: string,
    brand?: string
  ): { success: boolean; error?: string } => {
    const art = articles.find((a) => a.id === articleId);
    if (!art) return { success: false, error: 'Article introuvable.' };

    const wh = warehouses.find((w) => w.id === warehouseId);
    if (!wh) return { success: false, error: 'Magasin introuvable.' };

    const cleanLoc = newLocation.trim() || 'Non renseigné';
    const targetBrand = cleanBrandName(brand ?? art.brand);

    // 1. Update stocks
    const updatedStocks = [...stocks];
    const stockIdx = updatedStocks.findIndex(
      (s) => s.articleId === articleId && s.warehouseId === warehouseId
    );

    if (stockIdx >= 0) {
      const existingStock = updatedStocks[stockIdx];
      const nextBrandLocations = { ...(existingStock.brandLocations || {}) };
      if (targetBrand) {
        const matchKey =
          Object.keys(nextBrandLocations).find(
            (k) => k.toLowerCase().trim() === targetBrand.toLowerCase().trim()
          ) || targetBrand;
        nextBrandLocations[matchKey] = cleanLoc;
      }
      updatedStocks[stockIdx] = {
        ...existingStock,
        shelfLocation:
          !brand || targetBrand.toLowerCase() === (art.brand || '').toLowerCase().trim()
            ? cleanLoc
            : existingStock.shelfLocation || cleanLoc,
        brandLocations:
          Object.keys(nextBrandLocations).length > 0 ? nextBrandLocations : undefined,
      };
    } else {
      updatedStocks.push({
        articleId,
        warehouseId,
        quantity: 0,
        shelfLocation: cleanLoc,
        brandLocations: targetBrand ? { [targetBrand]: cleanLoc } : undefined,
      });
    }

    // 2. Also update Article defaultLocation / brandOffers location
    const updatedArticles = articles.map((a) => {
      if (a.id !== articleId) return a;
      let nextOffers = a.brandOffers;
      if (nextOffers && targetBrand) {
        nextOffers = nextOffers.map((bo) =>
          bo.brand.toLowerCase().trim() === targetBrand.toLowerCase().trim()
            ? { ...bo, location: cleanLoc }
            : bo
        );
      }
      return {
        ...a,
        defaultLocation:
          cleanLoc !== 'Non renseigné' &&
          targetBrand.toLowerCase() === (a.brand || '').toLowerCase().trim()
            ? cleanLoc
            : a.defaultLocation,
        brandOffers: nextOffers,
        updatedAt: new Date().toISOString(),
      };
    });

    // 3. Also update the location on any open inventory session item for (articleId, brand)
    setInventories((prevInvs) =>
      prevInvs.map((inv) => {
        if (inv.warehouseId !== warehouseId || inv.status === 'VALIDATED') return inv;
        let changed = false;
        const nextItems = inv.items.map((it) => {
          if (matchInventoryItemLine(it, articleId, targetBrand)) {
            changed = true;
            return { ...it, location: cleanLoc };
          }
          return it;
        });
        if (!changed) return inv;
        const nextSession = { ...inv, items: nextItems };
        saveInventoryToFirebase(nextSession).catch(console.warn);
        return nextSession;
      })
    );

    setStocks(updatedStocks);
    setArticles(updatedArticles);
    saveMultipleStocksToFirebase(updatedStocks).catch(console.warn);
    const updatedArt = updatedArticles.find((a) => a.id === articleId);
    if (updatedArt) {
      saveArticleToFirebase(updatedArt).catch(console.warn);
    }

    return { success: true };
  };

  const addArticleToInventorySession = (
    sessionId: string,
    articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>,
    initialCountedQty: number,
    location?: string
  ): { success: boolean; error?: string; article?: Article } => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session d’inventaire introuvable.' };
    if (session.status === 'VALIDATED' || session.status === 'CANCELLED') {
      return { success: false, error: 'Impossible d’ajouter un produit à une session verrouillée.' };
    }

    const nowIso = new Date().toISOString();
    const safeCounted = Math.max(0, Math.floor(Number(initialCountedQty) || 0));
    const refUpper = articleData.mainReference.trim().toUpperCase();
    const targetBrand = cleanBrandName(articleData.brand);
    const cleanLoc = location?.trim() || articleData.defaultLocation || 'Non renseigné';
    const existing = articles.find((a) => a.mainReference.trim().toUpperCase() === refUpper);

    if (existing) {
      const currentOffers = getArticleBrandOffers(existing);
      const hasBrandOffer = currentOffers.some(
        (o) => cleanBrandName(o.brand).toLowerCase() === targetBrand.toLowerCase()
      );

      if (targetBrand && !hasBrandOffer) {
        const nextOffers: ArticleBrandOffer[] = [
          ...currentOffers,
          {
            id: `bo_${existing.id}_${Date.now()}`,
            brand: targetBrand,
            brandReference: existing.mainReference,
            purchasePrice:
              articleData.purchasePrice > 0
                ? articleData.purchasePrice
                : existing.purchasePrice,
            salePrice:
              articleData.salePrice > 0 ? articleData.salePrice : existing.salePrice,
            location: cleanLoc,
            isDefault: false,
          },
        ];
        updateArticle(existing.id, { brandOffers: nextOffers });
      }

      if (cleanLoc && cleanLoc !== 'Non renseigné') {
        updateStockLocationInWarehouse(
          existing.id,
          session.warehouseId,
          cleanLoc,
          targetBrand
        );
      }

      const theoBrandQty = getBrandStockAcrossWarehouses(
        stocks,
        existing,
        targetBrand,
        session.warehouseId
      );
      const unitCost =
        articleData.purchasePrice > 0 ? articleData.purchasePrice : existing.purchasePrice;
      const variance = safeCounted - theoBrandQty;

      setInventories((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const alreadyIdx = s.items.findIndex((it) =>
            matchInventoryItemLine(it, existing.id, targetBrand)
          );
          let nextItems: InventoryItemCount[];
          if (alreadyIdx >= 0) {
            nextItems = s.items.map((it, idx) =>
              idx === alreadyIdx
                ? {
                    ...it,
                    location: cleanLoc !== 'Non renseigné' ? cleanLoc : it.location,
                    unitCost,
                    countedQty: safeCounted,
                    variance: safeCounted - it.theoreticalQty,
                    varianceValue: (safeCounted - it.theoreticalQty) * unitCost,
                    countedAt: nowIso,
                    countedBy: currentUser.name,
                  }
                : it
            );
          } else {
            const newItem: InventoryItemCount = {
              articleId: existing.id,
              brand: targetBrand,
              brandReference: existing.mainReference,
              location: cleanLoc,
              theoreticalQty: theoBrandQty,
              countedQty: safeCounted,
              variance,
              unitCost,
              salePrice: articleData.salePrice > 0 ? articleData.salePrice : existing.salePrice,
              varianceValue: variance * unitCost,
              notes: targetBrand
                ? `Marque ${targetBrand} ajoutée en cours d’inventaire`
                : 'Ligne ajoutée en cours d’inventaire',
              countedAt: nowIso,
              countedBy: currentUser.name,
            };
            nextItems = [newItem, ...s.items];
          }
          const nextSession: InventorySession = { ...s, updatedAt: nowIso, items: nextItems };
          saveInventoryToFirebase(nextSession).catch(console.warn);
          return nextSession;
        })
      );

      return { success: true, article: existing };
    }

    // Create brand-new article in catalog
    const artRes = createArticle({
      ...articleData,
      brand: targetBrand,
      defaultLocation: cleanLoc,
    });

    if (!artRes.success || !artRes.article) {
      return {
        success: false,
        error: artRes.error || 'Erreur lors de la création de la pièce.',
      };
    }

    const createdArticle = artRes.article;

    // Directly initialize warehouse stock location without relying on stale `articles` closure
    if (cleanLoc !== 'Non renseigné') {
      const nextStock: WarehouseStock = {
        articleId: createdArticle.id,
        warehouseId: session.warehouseId,
        quantity: 0,
        shelfLocation: cleanLoc,
        brandLocations: targetBrand ? { [targetBrand]: cleanLoc } : undefined,
        updatedAt: nowIso,
      };
      setStocks((prev) => {
        const exists = prev.some(
          (st) => st.articleId === createdArticle.id && st.warehouseId === session.warehouseId
        );
        const updated = exists
          ? prev.map((st) =>
              st.articleId === createdArticle.id && st.warehouseId === session.warehouseId
                ? { ...st, shelfLocation: cleanLoc, brandLocations: nextStock.brandLocations, updatedAt: nowIso }
                : st
            )
          : [...prev, nextStock];
        saveMultipleStocksToFirebase(updated).catch(console.warn);
        return updated;
      });
    }

    const newItem: InventoryItemCount = {
      articleId: createdArticle.id,
      brand: targetBrand,
      brandReference: createdArticle.mainReference,
      location: cleanLoc,
      theoreticalQty: 0,
      countedQty: safeCounted,
      variance: safeCounted,
      unitCost: createdArticle.purchasePrice,
      salePrice: createdArticle.salePrice,
      varianceValue: safeCounted * createdArticle.purchasePrice,
      notes: 'Nouvelle pièce créée durant l’inventaire physique',
      countedAt: nowIso,
      countedBy: currentUser.name,
    };

    setInventories((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const nextSession: InventorySession = {
          ...s,
          updatedAt: nowIso,
          items: [newItem, ...s.items],
        };
        saveInventoryToFirebase(nextSession).catch(console.warn);
        return nextSession;
      })
    );

    return { success: true, article: createdArticle };
  };

  // Supplier & PO Management
  const createSupplierOrder = (params: {
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>;
    additionalFees?: number;
    expectedDeliveryDate?: string;
    notes?: string;
  }) => {
    if (!params.supplierName.trim()) {
      return { success: false, error: 'Veuillez renseigner le nom du fournisseur.' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Veuillez ajouter au moins un article à la commande.' };
    }
    const targetWh = warehouses.find((w) => w.id === params.targetWarehouseId);
    if (!targetWh) {
      return { success: false, error: 'Magasin de destination introuvable.' };
    }

    const orderId = generatePurchaseOrderId(supplierOrders.length);
    const orderNumber = `BC-${new Date().getFullYear()}-${String(supplierOrders.length + 1).padStart(4, '0')}`;

    const orderItems: SupplierOrderItem[] = params.items.map((it, idx) => {
      const art = articles.find((a) => a.id === it.articleId);
      const stock = getTotalStockForArticle(it.articleId);
      const unit = art?.unit || 'Unité';
      const desig = art?.designation || 'Article';
      const ref = art?.mainReference || '';
      const brand = cleanBrandName(it.brand) || cleanBrandName(art?.brand);
      const minThresh = art?.minStockThreshold || 0;
      const lineTot = it.quantityOrdered * it.purchasePrice;

      return {
        id: `POI-${Date.now()}-${idx}`,
        articleId: it.articleId,
        mainReference: ref,
        designation: desig,
        brand,
        unit,
        stockAvailable: stock,
        minThreshold: minThresh,
        suggestedQty: Math.max(0, minThresh * 2 - stock),
        quantityOrdered: it.quantityOrdered,
        quantityReceived: 0,
        purchasePrice: it.purchasePrice,
        lineTotal: lineTot,
      };
    });

    // Ensure any newly entered real brand on an order line is also registered on the article's brandOffers
    setArticles((prevArticles) => {
      let modified = false;
      const nextArticles = prevArticles.map((art) => {
        const matchingLines = orderItems.filter(
          (oi) => oi.articleId === art.id && Boolean(cleanBrandName(oi.brand))
        );
        if (matchingLines.length === 0) return art;

        const currentOffers: ArticleBrandOffer[] =
          art.brandOffers && art.brandOffers.length > 0
            ? art.brandOffers.map((o) => ({ ...o, brand: cleanBrandName(o.brand) }))
            : [
                {
                  id: `bo_${art.id}_init`,
                  brand: cleanBrandName(art.brand),
                  brandReference: art.mainReference,
                  purchasePrice: art.purchasePrice,
                  salePrice: art.salePrice,
                  location: art.defaultLocation,
                  isDefault: true,
                },
              ];

        let artChanged = false;
        for (const line of matchingLines) {
          const cleanB = cleanBrandName(line.brand);
          if (!cleanB) continue;
          const normB = cleanB.toLowerCase();
          const existsIdx = currentOffers.findIndex(
            (o) => cleanBrandName(o.brand).toLowerCase() === normB
          );
          if (existsIdx === -1) {
            if (currentOffers.length === 1 && !cleanBrandName(currentOffers[0].brand)) {
              currentOffers[0] = {
                ...currentOffers[0],
                brand: cleanB,
                purchasePrice: line.purchasePrice > 0 ? line.purchasePrice : currentOffers[0].purchasePrice,
                preferredSupplier: params.supplierName.trim() || currentOffers[0].preferredSupplier,
              };
            } else {
              currentOffers.push({
                id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                brand: cleanB,
                brandReference: art.mainReference,
                purchasePrice: line.purchasePrice > 0 ? line.purchasePrice : art.purchasePrice,
                salePrice: art.salePrice,
                location: art.defaultLocation || 'Non renseigné',
                preferredSupplier: params.supplierName.trim() || art.preferredSupplier,
                isDefault: currentOffers.length === 0,
              });
            }
            artChanged = true;
            modified = true;
          }
        }

        if (!artChanged) return art;
        const primaryOffer = currentOffers.find((o) => o.isDefault) || currentOffers[0];
        const updatedArt: Article = {
          ...art,
          brand: cleanBrandName(primaryOffer?.brand) || cleanBrandName(art.brand),
          brandOffers: currentOffers,
          updatedAt: new Date().toISOString(),
        };
        saveArticleToFirebase(updatedArt).catch(console.warn);
        return updatedArt;
      });
      if (modified) {
        safeSetLocalStorage('articles', nextArticles);
      }
      return modified ? nextArticles : prevArticles;
    });

    const itemsTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const fees = params.additionalFees || 0;
    const totalAmount = itemsTotal + fees;

    const newOrder: SupplierOrder = {
      id: orderId,
      orderNumber,
      date: new Date().toISOString(),
      supplierName: params.supplierName.trim(),
      supplierContact: params.supplierContact?.trim(),
      supplierEmail: params.supplierEmail?.trim(),
      targetWarehouseId: targetWh.id,
      targetWarehouseName: targetWh.name,
      status: 'DRAFT',
      items: orderItems,
      additionalFees: fees,
      totalAmount,
      notes: params.notes?.trim(),
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.name,
      expectedDeliveryDate: params.expectedDeliveryDate,
    };

    setSupplierOrders((prev) => [newOrder, ...prev]);
    saveSupplierOrderToFirebase(newOrder).catch(console.warn);
    return { success: true, order: newOrder };
  };

  const updateSupplierOrder = (params: {
    orderId: string;
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      id?: string;
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>;
    additionalFees?: number;
    expectedDeliveryDate?: string;
    notes?: string;
  }) => {
    const existing = supplierOrders.find((o) => o.id === params.orderId);
    if (!existing) {
      return { success: false, error: 'Commande fournisseur introuvable.' };
    }
    if (!params.supplierName.trim()) {
      return { success: false, error: 'Veuillez renseigner le nom du fournisseur.' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Veuillez conserver au moins un article dans la commande.' };
    }
    const targetWh = warehouses.find((w) => w.id === params.targetWarehouseId) || warehouses[0];

    const orderItems: SupplierOrderItem[] = params.items.map((it, idx) => {
      const prevLine = existing.items.find(
        (pi) => pi.id === it.id || (pi.articleId === it.articleId && cleanBrandName(pi.brand) === cleanBrandName(it.brand))
      );
      const art = articles.find((a) => a.id === it.articleId);
      const stock = getTotalStockForArticle(it.articleId);
      const unit = art?.unit || prevLine?.unit || 'Unité';
      const desig = art?.designation || prevLine?.designation || 'Article';
      const ref = art?.mainReference || prevLine?.mainReference || '';
      const brand =
        cleanBrandName(it.brand) || cleanBrandName(prevLine?.brand) || cleanBrandName(art?.brand);
      const minThresh = art?.minStockThreshold || prevLine?.minThreshold || 0;
      const lineTot = it.quantityOrdered * it.purchasePrice;

      return {
        id: it.id || prevLine?.id || `POI-${Date.now()}-${idx}`,
        articleId: it.articleId,
        mainReference: ref,
        designation: desig,
        brand,
        unit,
        stockAvailable: stock,
        minThreshold: minThresh,
        suggestedQty: Math.max(0, minThresh * 2 - stock),
        quantityOrdered: it.quantityOrdered,
        quantityReceived: prevLine?.quantityReceived || 0,
        purchasePrice: it.purchasePrice,
        lineTotal: lineTot,
      };
    });

    // Ensure any newly entered real brand on an order line is also registered on the article's brandOffers
    setArticles((prevArticles) => {
      let modified = false;
      const nextArticles = prevArticles.map((art) => {
        const matchingLines = orderItems.filter(
          (oi) => oi.articleId === art.id && Boolean(cleanBrandName(oi.brand))
        );
        if (matchingLines.length === 0) return art;

        const currentOffers: ArticleBrandOffer[] =
          art.brandOffers && art.brandOffers.length > 0
            ? art.brandOffers.map((o) => ({ ...o, brand: cleanBrandName(o.brand) }))
            : [
                {
                  id: `bo_${art.id}_init`,
                  brand: cleanBrandName(art.brand),
                  brandReference: art.mainReference,
                  purchasePrice: art.purchasePrice,
                  salePrice: art.salePrice,
                  location: art.defaultLocation,
                  isDefault: true,
                },
              ];

        let artChanged = false;
        for (const line of matchingLines) {
          const cleanB = cleanBrandName(line.brand);
          if (!cleanB) continue;
          const normB = cleanB.toLowerCase();
          const existsIdx = currentOffers.findIndex(
            (o) => cleanBrandName(o.brand).toLowerCase() === normB
          );
          if (existsIdx === -1) {
            if (currentOffers.length === 1 && !cleanBrandName(currentOffers[0].brand)) {
              currentOffers[0] = {
                ...currentOffers[0],
                brand: cleanB,
                purchasePrice: line.purchasePrice > 0 ? line.purchasePrice : currentOffers[0].purchasePrice,
                preferredSupplier: params.supplierName.trim() || currentOffers[0].preferredSupplier,
              };
            } else {
              currentOffers.push({
                id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                brand: cleanB,
                brandReference: art.mainReference,
                purchasePrice: line.purchasePrice > 0 ? line.purchasePrice : art.purchasePrice,
                salePrice: art.salePrice,
                location: art.defaultLocation || 'Non renseigné',
                preferredSupplier: params.supplierName.trim() || art.preferredSupplier,
                isDefault: currentOffers.length === 0,
              });
            }
            artChanged = true;
            modified = true;
          }
        }

        if (!artChanged) return art;
        const primaryOffer = currentOffers.find((o) => o.isDefault) || currentOffers[0];
        const updatedArt: Article = {
          ...art,
          brand: cleanBrandName(primaryOffer?.brand) || cleanBrandName(art.brand),
          brandOffers: currentOffers,
          updatedAt: new Date().toISOString(),
        };
        saveArticleToFirebase(updatedArt).catch(console.warn);
        return updatedArt;
      });
      if (modified) {
        safeSetLocalStorage('articles', nextArticles);
      }
      return modified ? nextArticles : prevArticles;
    });

    const itemsTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const fees = params.additionalFees || 0;
    const totalAmount = itemsTotal + fees;

    const updatedOrder: SupplierOrder = {
      ...existing,
      supplierName: params.supplierName.trim(),
      supplierContact: params.supplierContact?.trim(),
      supplierEmail: params.supplierEmail?.trim(),
      targetWarehouseId: targetWh.id,
      targetWarehouseName: targetWh.name,
      items: orderItems,
      additionalFees: fees,
      totalAmount,
      notes: params.notes?.trim(),
      expectedDeliveryDate: params.expectedDeliveryDate,
    };

    setSupplierOrders((prev) => prev.map((o) => (o.id === params.orderId ? updatedOrder : o)));
    saveSupplierOrderToFirebase(updatedOrder).catch(console.warn);
    return { success: true, order: updatedOrder };
  };

  const updateSupplierOrderStatus = (orderId: string, status: SupplierOrderStatus) => {
    const existing = supplierOrders.find((o) => o.id === orderId);
    if (!existing) return { success: false, error: 'Commande introuvable.' };

    const updates: Partial<SupplierOrder> = { status };
    if (status === 'ORDERED' && !existing.orderedAt) {
      updates.orderedAt = new Date().toISOString();
    }

    const updated = { ...existing, ...updates };
    setSupplierOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    saveSupplierOrderToFirebase(updated).catch(console.warn);
    return { success: true };
  };

  const receiveSupplierOrder = (params: {
    orderId: string;
    itemsReceived: Array<{
      itemId: string;
      quantityReceivedNow: number;
      brand?: string;
    }>;
    notes?: string;
  }) => {
    const order = supplierOrders.find((o) => o.id === params.orderId);
    if (!order) return { success: false, error: 'Commande introuvable.' };

    if (order.status === 'CANCELLED') {
      return { success: false, error: 'Impossible de réceptionner une commande annulée.' };
    }

    const wh = warehouses.find((w) => w.id === order.targetWarehouseId) || warehouses[0];
    const nowIso = new Date().toISOString();
    const newMovements: StockMovement[] = [];
    let updatedStocks = [...stocks];

    const updatedItems = order.items.map((item) => {
      const rec = params.itemsReceived.find((r) => r.itemId === item.id);
      const qtyNow = rec ? Math.max(0, rec.quantityReceivedNow) : 0;
      const effectiveBrand = (rec?.brand && rec.brand.trim()) || item.brand || '';
      if (qtyNow > 0) {
        const currentQtyInWh = getStockForArticleAndWarehouse(item.articleId, wh.id);
        const newQtyInWh = currentQtyInWh + qtyNow;

        // Apply delta to stocks with the specific brand
        updatedStocks = applyStockDelta(updatedStocks, item.articleId, wh.id, qtyNow, effectiveBrand);

        // Generate ENTREE movement
        const mvtId = generateMovementId();
        const newMvt: StockMovement = {
          id: mvtId,
          date: nowIso,
          type: 'ENTREE',
          articleId: item.articleId,
          quantity: qtyNow,
          targetWarehouseId: wh.id,
          userId: currentUser.id,
          userName: currentUser.name,
          documentRef: order.orderNumber,
          reason: `Réception bon de commande ${order.orderNumber} (${order.supplierName}) — Marque: ${effectiveBrand}`,
          thirdParty: order.supplierName,
          unitPrice: item.purchasePrice,
          totalPrice: item.purchasePrice * qtyNow,
          stockBefore: currentQtyInWh,
          stockAfter: newQtyInWh,
          notes: params.notes?.trim(),
        };
        newMovements.push(newMvt);

        return {
          ...item,
          brand: effectiveBrand,
          quantityReceived: item.quantityReceived + qtyNow,
        };
      }
      return item;
    });

    if (newMovements.length === 0) {
      return { success: false, error: 'Aucune quantité reçue valide n\'a été saisie.' };
    }

    // Determine new status: RECEIVED if all items received in full, otherwise PARTIALLY_RECEIVED
    const allCompleted = updatedItems.every((it) => it.quantityReceived >= it.quantityOrdered);
    const newStatus: SupplierOrderStatus = allCompleted ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    setStocks(updatedStocks);
    setMovements((prev) => [...newMovements, ...prev]);

    const updatedOrder: SupplierOrder = {
      ...order,
      status: newStatus,
      items: updatedItems,
      lastReceivedAt: nowIso,
    };

    setSupplierOrders((prev) =>
      prev.map((o) => (o.id === params.orderId ? updatedOrder : o))
    );

    saveMultipleStocksToFirebase(updatedStocks).catch(console.warn);
    newMovements.forEach((m) => saveMovementToFirebase(m).catch(console.warn));
    saveSupplierOrderToFirebase(updatedOrder).catch(console.warn);

    return { success: true };
  };

  const cancelSupplierOrder = (orderId: string, reason?: string) => {
    const order = supplierOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Commande introuvable.' };
    if (order.status === 'RECEIVED') {
      return { success: false, error: 'Impossible d\'annuler une commande déjà intégralement réceptionnée.' };
    }

    const cancelledOrder: SupplierOrder = {
      ...order,
      status: 'CANCELLED' as const,
      cancelledAt: new Date().toISOString(),
      cancelledReason: reason || 'Annulation manuelle par l\'utilisateur',
    };

    setSupplierOrders((prev) =>
      prev.map((o) => (o.id === orderId ? cancelledOrder : o))
    );
    saveSupplierOrderToFirebase(cancelledOrder).catch(console.warn);
    return { success: true };
  };

  const deleteSupplierOrder = (orderId: string): { success: boolean; error?: string; message?: string } => {
    const existing = supplierOrders.find((o) => o.id === orderId);
    if (!existing) return { success: false, error: 'Commande fournisseur introuvable.' };

    markIdsDeleted('supplierOrders', [orderId]);
    const nextOrders = supplierOrders.filter((o) => o.id !== orderId);
    setSupplierOrders(nextOrders);
    safeSetLocalStorage('supplier_orders', nextOrders);
    deleteSupplierOrderFromFirebase(orderId).catch(console.warn);

    return {
      success: true,
      message: `Le bon de commande "${existing.orderNumber}" (${existing.supplierName}) a été définitivement supprimé.`,
    };
  };

  const createSupplier = (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    if (!supplierData.name?.trim()) {
      return { success: false, error: 'Le nom du fournisseur est obligatoire.' };
    }
    const id = generateSupplierId(suppliers.length);
    const code = supplierData.code?.trim() || `FOUR-${String(suppliers.length + 1).padStart(3, '0')}`;
    const newSupplier: Supplier = {
      ...supplierData,
      name: supplierData.name.trim(),
      code,
      brandsHandled: Array.isArray(supplierData.brandsHandled) ? supplierData.brandsHandled : [],
      id,
      createdAt: new Date().toISOString(),
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    saveSupplierToFirebase(newSupplier).catch(console.warn);
    return { success: true, supplier: newSupplier };
  };

  const updateSupplier = (
    id: string,
    updates: Partial<Omit<Supplier, 'id' | 'createdAt'>>
  ): { success: boolean; error?: string; supplier?: Supplier } => {
    const existing = suppliers.find((s) => s.id === id);
    if (!existing) {
      return { success: false, error: 'Fournisseur introuvable.' };
    }
    if (updates.name !== undefined && !updates.name.trim()) {
      return { success: false, error: 'Le nom du fournisseur ne peut pas être vide.' };
    }
    const updatedSupplier: Supplier = {
      ...existing,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      code: updates.code !== undefined && updates.code.trim() ? updates.code.trim() : existing.code,
    };
    setSuppliers((prev) => prev.map((s) => (s.id === id ? updatedSupplier : s)));
    saveSupplierToFirebase(updatedSupplier).catch(console.warn);
    return { success: true, supplier: updatedSupplier };
  };

  const deleteSupplier = (id: string): { success: boolean; error?: string; message?: string } => {
    const existing = suppliers.find((s) => s.id === id);
    if (!existing) {
      return { success: false, error: 'Fournisseur introuvable.' };
    }
    markIdsDeleted('suppliers', [id]);
    const nextSuppliers = suppliers.filter((s) => s.id !== id);
    setSuppliers(nextSuppliers);
    safeSetLocalStorage('suppliers', nextSuppliers);
    deleteSupplierFromFirebase(id).catch(console.warn);
    return {
      success: true,
      message: `Le fournisseur "${existing.name}" (${existing.code}) a été supprimé.`,
    };
  };

  const getActiveOrderForArticle = useCallback(
    (articleId: string): SupplierOrder | undefined => {
      if (!articleId) return undefined;
      return supplierOrders.find(
        (order) =>
          (order.status === 'DRAFT' ||
            order.status === 'TO_ORDER' ||
            order.status === 'ORDERED' ||
            order.status === 'PARTIALLY_RECEIVED') &&
          order.items.some((it) => it.articleId === articleId)
      );
    },
    [supplierOrders]
  );

  // Quotes / Proforma Management
  const createQuote = (params: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    warehouseId: string;
    validUntil?: string;
    items: Array<{
      articleId: string;
      quantity: number;
      unitPrice?: number;
      discountPercent?: number;
    }>;
    notes?: string;
    terms?: string;
  }) => {
    if (!params.customerName.trim()) {
      return { success: false, error: 'Veuillez indiquer le nom du client.' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Veuillez ajouter au moins une pièce au devis.' };
    }
    const wh = warehouses.find((w) => w.id === params.warehouseId) || warehouses[0];
    const quoteId = generateQuoteId(quotes.length);
    const quoteNumber = `PRO-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`;

    const quoteItems: QuoteItem[] = params.items.map((it) => {
      const art = articles.find((a) => a.id === it.articleId);
      const unitCost = art?.purchasePrice || 0;
      const catalogPrice = art?.salePrice || 0;
      const unitPrice = it.unitPrice !== undefined ? it.unitPrice : catalogPrice;
      const discPct = it.discountPercent || 0;
      const discAmt = (unitPrice * it.quantity * discPct) / 100;
      const totalLine = unitPrice * it.quantity - discAmt;

      return {
        articleId: it.articleId,
        mainReference: art?.mainReference || '',
        designation: art?.designation || '',
        brand: art?.brand || '',
        unit: art?.unit || 'Unité',
        quantity: it.quantity,
        unitCost,
        catalogUnitPrice: catalogPrice,
        unitPrice,
        discountPercent: discPct,
        discountAmount: discAmt,
        totalLine,
      };
    });

    const subtotal = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalDiscount = quoteItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalAmount = subtotal - totalDiscount;

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const validUntil = params.validUntil || in30Days.toISOString().slice(0, 10);

    const newQuote: Quote = {
      id: quoteId,
      quoteNumber,
      date: new Date().toISOString(),
      validUntil,
      customerId: params.customerId,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone?.trim(),
      customerEmail: params.customerEmail?.trim(),
      warehouseId: wh.id,
      warehouseName: wh.name,
      status: 'SENT',
      items: quoteItems,
      subtotal,
      totalDiscount,
      totalAmount,
      notes: params.notes?.trim(),
      terms: params.terms?.trim() || 'Offre valable 30 jours. Disponibilité selon stock au moment de la commande.',
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };

    setQuotes((prev) => [newQuote, ...prev]);
    saveQuoteToFirebase(newQuote).catch(console.warn);
    return { success: true, quote: newQuote };
  };

  const updateQuote = (
    quoteId: string,
    params: {
      customerId?: string;
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      warehouseId: string;
      validUntil?: string;
      items: Array<{
        articleId: string;
        quantity: number;
        unitPrice?: number;
        discountPercent?: number;
      }>;
      notes?: string;
      terms?: string;
    }
  ): { success: boolean; error?: string; quote?: Quote } => {
    const existing = quotes.find((q) => q.id === quoteId);
    if (!existing) {
      return { success: false, error: 'Devis introuvable.' };
    }
    if (existing.status === 'CONVERTED') {
      return {
        success: false,
        error: 'Ce devis a déjà été validé et converti en vente. Il ne peut plus être modifié.',
      };
    }
    if (!params.customerName.trim()) {
      return { success: false, error: 'Veuillez indiquer le nom du client.' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Veuillez conserver au moins une pièce dans le devis.' };
    }

    const wh = warehouses.find((w) => w.id === params.warehouseId) || warehouses[0];

    const quoteItems: QuoteItem[] = params.items.map((it) => {
      const art = articles.find((a) => a.id === it.articleId);
      const prevItem = existing.items.find((old) => old.articleId === it.articleId);
      const unitCost = art?.purchasePrice ?? prevItem?.unitCost ?? 0;
      const catalogPrice = art?.salePrice ?? prevItem?.catalogUnitPrice ?? 0;
      const unitPrice = it.unitPrice !== undefined ? it.unitPrice : catalogPrice;
      const discPct = it.discountPercent || 0;
      const discAmt = (unitPrice * it.quantity * discPct) / 100;
      const totalLine = unitPrice * it.quantity - discAmt;

      return {
        articleId: it.articleId,
        mainReference: art?.mainReference || prevItem?.mainReference || '',
        designation: art?.designation || prevItem?.designation || '',
        brand: art?.brand || prevItem?.brand || '',
        unit: art?.unit || prevItem?.unit || 'Unité',
        quantity: it.quantity,
        unitCost,
        catalogUnitPrice: catalogPrice,
        unitPrice,
        discountPercent: discPct,
        discountAmount: discAmt,
        totalLine,
      };
    });

    const subtotal = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalDiscount = quoteItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalAmount = subtotal - totalDiscount;

    const updatedQuote: Quote = {
      ...existing,
      validUntil: params.validUntil || existing.validUntil,
      customerId: params.customerId,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone?.trim(),
      customerEmail: params.customerEmail?.trim(),
      warehouseId: wh?.id || existing.warehouseId,
      warehouseName: wh?.name || existing.warehouseName,
      items: quoteItems,
      subtotal,
      totalDiscount,
      totalAmount,
      notes: params.notes?.trim(),
      terms: params.terms?.trim() || existing.terms,
    };

    const nextQuotes = quotes.map((q) => (q.id === quoteId ? updatedQuote : q));
    setQuotes(nextQuotes);
    safeSetLocalStorage('quotes', nextQuotes);
    saveQuoteToFirebase(updatedQuote).catch(console.warn);
    return { success: true, quote: updatedQuote };
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    setQuotes((prev) => {
      const next = prev.map((q) => {
        if (q.id === quoteId) {
          const updated = { ...q, status };
          saveQuoteToFirebase(updated).catch(console.warn);
          return updated;
        }
        return q;
      });
      safeSetLocalStorage('quotes', next);
      return next;
    });
    return { success: true };
  };

  const deleteQuote = (quoteId: string): { success: boolean; error?: string; message?: string } => {
    const existing = quotes.find((q) => q.id === quoteId);
    if (!existing) return { success: false, error: 'Devis introuvable.' };

    markIdsDeleted('quotes', [quoteId]);
    const nextQuotes = quotes.filter((q) => q.id !== quoteId);
    setQuotes(nextQuotes);
    safeSetLocalStorage('quotes', nextQuotes);
    deleteQuoteFromFirebase(quoteId).catch(console.warn);

    return {
      success: true,
      message: `Le devis proforma "${existing.quoteNumber}" (${existing.customerName}) a été définitivement supprimé.`,
    };
  };

  const convertQuoteToSale = (quoteId: string, paymentMethod: PaymentMethod) => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { success: false, error: 'Devis introuvable.' };
    if (quote.status === 'CONVERTED') {
      return { success: false, error: 'Ce devis a déjà été converti en vente.' };
    }

    // Call recordSale with quote items and total
    const saleRes = recordSale({
      warehouseId: quote.warehouseId,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      items: quote.items.map((it) => ({
        articleId: it.articleId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: quote.totalAmount,
          reference: `CONV-${quote.quoteNumber}`,
          notes: `Paiement issu de la conversion du devis ${quote.quoteNumber}`,
        },
      ],
      notes: `Vente générée automatiquement par conversion du devis ${quote.quoteNumber}. ${quote.notes || ''}`.trim(),
    });

    if (!saleRes.success) {
      return { success: false, error: saleRes.error };
    }

    // Mark quote as converted
    const updatedQuote: Quote = {
      ...quote,
      status: 'CONVERTED' as const,
      convertedSaleId: saleRes.sale?.id,
    };
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? updatedQuote : q))
    );
    saveQuoteToFirebase(updatedQuote).catch(console.warn);

    return { success: true, saleId: saleRes.sale?.id };
  };

  // Reset to initial demo data
  const resetToDemoData = () => {
    clearPurgedTimestamps();
    setArticles(INITIAL_ARTICLES);
    setWarehouses(INITIAL_WAREHOUSES);
    setStocks(INITIAL_WAREHOUSE_STOCKS);
    setMovements(INITIAL_MOVEMENTS);
    setInventories(INITIAL_INVENTORIES);
    setCustomers(INITIAL_CUSTOMERS);
    setSales(INITIAL_SALES);
    setPayments(INITIAL_PAYMENTS);
    setCashSessions(INITIAL_CASH_SESSIONS);
    setCashMovements(INITIAL_CASH_MOVEMENTS);
    setSuppliers(INITIAL_SUPPLIERS);
    setSupplierOrders(INITIAL_SUPPLIER_ORDERS);
    setQuotes(INITIAL_QUOTES);
    setCurrentUser(INITIAL_USERS[0]);
    setSelectedWarehouseId(null);

    safeSetLocalStorage('articles', INITIAL_ARTICLES);
    safeSetLocalStorage('warehouses', INITIAL_WAREHOUSES);
    safeSetLocalStorage('stocks', INITIAL_WAREHOUSE_STOCKS);
    safeSetLocalStorage('movements', INITIAL_MOVEMENTS);
    safeSetLocalStorage('inventories', INITIAL_INVENTORIES);
    safeSetLocalStorage('customers', INITIAL_CUSTOMERS);
    safeSetLocalStorage('sales', INITIAL_SALES);
    safeSetLocalStorage('payments', INITIAL_PAYMENTS);
    safeSetLocalStorage('cash_sessions', INITIAL_CASH_SESSIONS);
    safeSetLocalStorage('cash_movements', INITIAL_CASH_MOVEMENTS);
    safeSetLocalStorage('suppliers', INITIAL_SUPPLIERS);
    safeSetLocalStorage('supplier_orders', INITIAL_SUPPLIER_ORDERS);
    safeSetLocalStorage('quotes', INITIAL_QUOTES);
    safeSetLocalStorage('user', INITIAL_USERS[0]);
  };

  // Table Rase : remise à zéro complète de la base pour exploitation
  const clearAllData = async (options?: { keepWarehouses?: boolean }) => {
    purgeGenerationRef.current += 1;
    const colsToPurge = [
      'articles',
      'stocks',
      'movements',
      'inventories',
      'customers',
      'sales',
      'payments',
      'cashSessions',
      'cashMovements',
      'suppliers',
      'supplierOrders',
      'quotes',
      ...(!options?.keepWarehouses ? ['warehouses'] : []),
    ];
    markCollectionsPurged(colsToPurge, Date.now());

    setArticles([]);
    setStocks([]);
    setMovements([]);
    setInventories([]);
    setCustomers([]);
    setSales([]);
    setPayments([]);
    setCashSessions([]);
    setCashMovements([]);
    setSuppliers([]);
    setSupplierOrders([]);
    setQuotes([]);
    setSelectedWarehouseId(null);

    const nextWh = options?.keepWarehouses && warehouses.length > 0
      ? warehouses.map((w) => ({ ...w, isActive: true }))
      : CLEAN_DEFAULT_WAREHOUSES;

    setWarehouses(nextWh);

    safeSetLocalStorage('articles', []);
    safeSetLocalStorage('stocks', []);
    safeSetLocalStorage('movements', []);
    safeSetLocalStorage('inventories', []);
    safeSetLocalStorage('customers', []);
    safeSetLocalStorage('sales', []);
    safeSetLocalStorage('payments', []);
    safeSetLocalStorage('cash_sessions', []);
    safeSetLocalStorage('cash_movements', []);
    safeSetLocalStorage('suppliers', []);
    safeSetLocalStorage('supplier_orders', []);
    safeSetLocalStorage('quotes', []);
    safeSetLocalStorage('warehouses', nextWh);

    // Supprimer également toutes les données correspondantes dans Cloud Firestore
    let wipeRes: { success: boolean; error?: string } = { success: true };
    try {
      wipeRes = await wipeAllFromFirebase(options);
      if (wipeRes.success) {
        clearPurgedTimestamps(colsToPurge);
      }
    } catch (err) {
      console.warn('Avertissement lors de la purge Cloud Firestore pendant Table Rase:', err);
      wipeRes = {
        success: false,
        error: 'Erreur lors de la purge Cloud Firestore.',
      };
    }
    return wipeRes;
  };

  // Export full DB as JSON backup (100% integral dump from memory + localStorage drafts & preferences)
  const exportDatabaseJson = () => {
    let savedDrafts: any[] = [];
    let preferences: Record<string, any> = {
      selectedWarehouseId,
      showProductImages,
      isStockFrozen,
    };

    if (typeof window !== 'undefined') {
      try {
        const rawDrafts = localStorage.getItem('equipstock_pos_saved_lists_v1');
        if (rawDrafts) {
          const parsedDrafts = JSON.parse(rawDrafts);
          if (Array.isArray(parsedDrafts)) {
            savedDrafts = parsedDrafts;
          }
        }
      } catch (err) {
        console.warn('Could not read saved POS drafts during export:', err);
      }

      try {
        preferences = {
          ...preferences,
          theme: localStorage.getItem('equipstock_theme_v2') || 'light',
          catalogLayoutMode: localStorage.getItem('equipstock_catalog_layout_mode') || 'LINE',
          catalogDisplayMode: localStorage.getItem('equipstock_catalog_display_mode') || 'PAGINATION',
          catalogPageSize: Number(localStorage.getItem('equipstock_catalog_page_size')) || 50,
          stockLayoutMode: localStorage.getItem('equipstock_stock_layout_mode') || 'LINE',
          stockDisplayMode: localStorage.getItem('equipstock_stock_display_mode') || 'PAGINATION',
          stockPageSize: Number(localStorage.getItem('equipstock_stock_page_size')) || 50,
        };
      } catch {
        // Ignore preference read errors
      }
    }

    const exportDate = new Date().toISOString();
    const counts = {
      articles: articles.length,
      warehouses: warehouses.length,
      stocks: stocks.length,
      movements: movements.length,
      inventories: inventories.length,
      customers: customers.length,
      sales: sales.length,
      payments: payments.length,
      cashSessions: cashSessions.length,
      cashMovements: cashMovements.length,
      suppliers: suppliers.length,
      supplierOrders: supplierOrders.length,
      quotes: quotes.length,
      returns: returns.length,
      users: users.length,
      savedDrafts: savedDrafts.length,
      hasCompanyInfo: Boolean(companyInfo && companyInfo.name),
    };

    const dump = {
      exportDate,
      version: '3.0-full-integrity',
      metadata: {
        appName: 'EquipStock Pro',
        companyName: companyInfo?.name || 'WKRLI',
        exportedBy: currentUser?.name || 'Administrateur',
        exportDate,
        counts,
      },
      articles,
      warehouses,
      stocks,
      movements,
      inventories,
      customers,
      sales,
      payments,
      cashSessions,
      cashMovements,
      suppliers,
      supplierOrders,
      quotes,
      returns,
      users,
      companyInfo,
      savedDrafts,
      preferences,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipstock_full_backup_${exportDate.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // User management methods (RBAC & Firestore sync)
  const addUser = async (
    userData: Omit<UserProfile, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
    const existing = users.find(
      (u) => u.email.trim().toLowerCase() === userData.email.trim().toLowerCase()
    );
    if (existing) {
      return { success: false, error: 'Un utilisateur avec cette adresse email existe déjà.' };
    }

    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newUser: UserProfile = {
      ...userData,
      id: `usr_${Date.now()}_${rand}`,
      email: userData.email.trim().toLowerCase(),
      pinCode: userData.pinCode && userData.pinCode.trim() ? userData.pinCode.trim() : '0000',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date().toISOString(),
    };

    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    safeSetLocalStorage('users', nextUsers);

    try {
      await saveUserToFirebase(newUser);
    } catch (err) {
      console.warn('Erreur synchronisation nouvel utilisateur Firebase:', err);
    }

    return { success: true, user: newUser };
  };

  const updateUser = async (
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    const userToUpdate = users.find((u) => u.id === userId);
    if (!userToUpdate) {
      return { success: false, error: 'Utilisateur introuvable.' };
    }

    // Protection of Super Admin account
    if (userToUpdate.email.toLowerCase() === 'westjunior0805@gmail.com' && updates.role && updates.role !== 'ADMIN') {
      return { success: false, error: 'Le rôle Administrateur du compte principal ne peut pas être modifié.' };
    }

    const updated = { ...userToUpdate, ...updates };
    const nextUsers = users.map((u) => (u.id === userId ? updated : u));
    setUsers(nextUsers);
    safeSetLocalStorage('users', nextUsers);

    if (currentUser.id === userId) {
      setCurrentUser(updated);
      safeSetLocalStorage('user', updated);
    }

    try {
      await saveUserToFirebase(updated);
    } catch (err) {
      console.warn('Erreur synchronisation mise à jour utilisateur Firebase:', err);
    }

    return { success: true };
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) {
      return { success: false, error: 'Utilisateur introuvable.' };
    }

    if (userToDelete.email.toLowerCase() === 'westjunior0805@gmail.com') {
      return { success: false, error: 'Le compte Super-Administrateur principal ne peut pas être supprimé.' };
    }

    if (currentUser.id === userId) {
      return { success: false, error: 'Vous ne pouvez pas supprimer le profil actuellement actif.' };
    }

    markIdsDeleted('users', [userId]);
    const nextUsers = users.filter((u) => u.id !== userId);
    setUsers(nextUsers);
    safeSetLocalStorage('users', nextUsers);

    try {
      await deleteUserFromFirebase(userId);
    } catch (err) {
      console.warn('Erreur suppression utilisateur Firebase:', err);
    }

    return { success: true };
  };

  const currentPermissions = useMemo<UserPermissions>(() => {
    return resolveUserPermissions(currentUser);
  }, [currentUser]);

  const checkPermission = useCallback(
    (perm: keyof UserPermissions): boolean => {
      return Boolean(currentPermissions[perm]);
    },
    [currentPermissions]
  );

  const getUserPermissions = useCallback((user: UserProfile): UserPermissions => {
    return resolveUserPermissions(user);
  }, []);

  const hasPermission = (allowedRolesOrPerm: UserRole[] | keyof UserPermissions): boolean => {
    if (typeof allowedRolesOrPerm === 'string') {
      return Boolean(currentPermissions[allowedRolesOrPerm]);
    }
    if (currentUser.role === 'ADMIN') return true;
    return allowedRolesOrPerm.includes(currentUser.role);
  };

  const authenticateOperator = (userId: string, pinCode: string): { success: boolean; error?: string } => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return { success: false, error: 'Profil opérateur introuvable.' };
    }
    if (targetUser.isActive === false) {
      return { success: false, error: 'Ce compte utilisateur a été désactivé par l’administrateur.' };
    }
    const expectedPin = targetUser.pinCode || '0000';
    if (pinCode.trim() !== expectedPin) {
      return { success: false, error: 'Code PIN incorrect. Veuillez réessayer.' };
    }

    const updatedUser: UserProfile = {
      ...targetUser,
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(updatedUser);
    if (updatedUser.role === 'MAGASINIER' && updatedUser.assignedWarehouseId) {
      setSelectedWarehouseId(updatedUser.assignedWarehouseId);
    }
    setIsAuthenticated(true);
    sessionStorage.setItem('equipstock_v3_session_active', 'true');
    return { success: true };
  };

  const lockSession = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('equipstock_v3_session_active');
  };

  const loginWithGoogle = async () => {
    throw new Error('Connexion Cloud désactivée. Veuillez utiliser votre Code PIN Opérateur ou vos identifiants locaux.');
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const matched = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!matched) {
      throw new Error('Aucun collaborateur trouvé avec cette adresse email dans la base locale.');
    }
    if (matched.isActive === false) {
      throw new Error('Ce compte collaborateur est actuellement désactivé.');
    }
    const expectedPin = matched.pinCode || '0000';
    if (pass.trim() !== expectedPin) {
      throw new Error('Code PIN / Mot de passe incorrect.');
    }

    const updatedUser: UserProfile = {
      ...matched,
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(updatedUser);
    if (updatedUser.role === 'MAGASINIER' && updatedUser.assignedWarehouseId) {
      setSelectedWarehouseId(updatedUser.assignedWarehouseId);
    }
    setIsAuthenticated(true);
    sessionStorage.setItem('equipstock_v3_session_active', 'true');
  };

  const registerWithEmail = async (name: string, email: string, pass: string, role: UserRole = 'MAGASINIER') => {
    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = cleanEmail === 'westjunior0805@gmail.com';
    const res = await addUser({
      name: name.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: isSuperAdmin ? 'ADMIN' : role,
      pinCode: pass.trim() || '0000',
      isActive: true,
      lastLoginAt: new Date().toISOString(),
    });
    if (!res.success || !res.user) {
      throw new Error(res.error || 'Erreur lors de la création du profil local.');
    }
    setCurrentUser(res.user);
    setIsAuthenticated(true);
    sessionStorage.setItem('equipstock_v3_session_active', 'true');
  };

  const logout = async () => {
    setFirebaseUser(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('equipstock_v3_session_active');
  };

  const loadDataFromCloud = (cloudData: any) => {
    if (cloudData.articles && Array.isArray(cloudData.articles)) {
      const clean = sanitizeUniqueList<Article>(cloudData.articles);
      setArticles(clean);
      safeSetLocalStorage('articles', clean);
    }
    if (cloudData.warehouses && Array.isArray(cloudData.warehouses) && cloudData.warehouses.length > 0) {
      const clean = sanitizeUniqueList<Warehouse>(cloudData.warehouses);
      setWarehouses(clean);
      safeSetLocalStorage('warehouses', clean);
    }
    if (cloudData.stocks && Array.isArray(cloudData.stocks)) {
      setStocks(cloudData.stocks);
      safeSetLocalStorage('stocks', cloudData.stocks);
    }
    if (cloudData.movements && Array.isArray(cloudData.movements)) {
      const clean = sanitizeUniqueList<StockMovement>(cloudData.movements);
      setMovements(clean);
      safeSetLocalStorage('movements', clean);
    }
    if (cloudData.customers && Array.isArray(cloudData.customers)) {
      const clean = sanitizeUniqueList<Customer>(cloudData.customers);
      setCustomers(clean);
      safeSetLocalStorage('customers', clean);
    }
    if (cloudData.sales && Array.isArray(cloudData.sales)) {
      const clean = sanitizeUniqueList<Sale>(cloudData.sales);
      setSales(clean);
      safeSetLocalStorage('sales', clean);
    }
    if (cloudData.payments && Array.isArray(cloudData.payments)) {
      const clean = sanitizeUniqueList<PaymentRecord>(cloudData.payments);
      setPayments(clean);
      safeSetLocalStorage('payments', clean);
    }
    if (cloudData.cashSessions && Array.isArray(cloudData.cashSessions)) {
      const clean = sanitizeUniqueList<CashSession>(cloudData.cashSessions);
      setCashSessions(clean);
      safeSetLocalStorage('cash_sessions', clean);
    }
    if (cloudData.cashMovements && Array.isArray(cloudData.cashMovements)) {
      const clean = sanitizeUniqueList<CashMovement>(cloudData.cashMovements);
      setCashMovements(clean);
      safeSetLocalStorage('cash_movements', clean);
    }
    if (cloudData.inventories && Array.isArray(cloudData.inventories)) {
      const clean = sanitizeUniqueList<InventorySession>(cloudData.inventories);
      setInventories(clean);
      safeSetLocalStorage('inventories', clean);
    }
    if (cloudData.suppliers && Array.isArray(cloudData.suppliers)) {
      const clean = sanitizeUniqueList<Supplier>(cloudData.suppliers);
      setSuppliers(clean);
      safeSetLocalStorage('suppliers', clean);
    }
    if (cloudData.supplierOrders && Array.isArray(cloudData.supplierOrders)) {
      const clean = sanitizeUniqueList<SupplierOrder>(cloudData.supplierOrders);
      setSupplierOrders(clean);
      safeSetLocalStorage('supplier_orders', clean);
    }
    if (cloudData.quotes && Array.isArray(cloudData.quotes)) {
      const clean = sanitizeUniqueList<Quote>(cloudData.quotes);
      setQuotes(clean);
      safeSetLocalStorage('quotes', clean);
    }
  };

  const restoreDatabaseJson = (
    backupData: any,
    mode: 'MERGE' | 'REPLACE',
    options?: { syncToCloud?: boolean; excludeDemoRecords?: boolean }
  ): {
    success: boolean;
    message: string;
    counts: Record<string, number>;
    verification?: {
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
    };
  } => {
    if (!backupData || typeof backupData !== 'object') {
      return {
        success: false,
        message: 'Le fichier fourni ne contient pas un objet JSON valide.',
        counts: {},
      };
    }

    clearPurgedTimestamps();
    clearDeletedIds();
    const counts: Record<string, number> = {};
    const excludeDemo = Boolean(options?.excludeDemoRecords);

    // Ensembles d'IDs de démonstration initiaux au cas où l'utilisateur souhaite filtrer les données fictives
    const demoArticleIds = new Set(INITIAL_ARTICLES.map((a) => a.id));
    const demoCustomerIds = new Set(INITIAL_CUSTOMERS.map((c) => c.id));
    const demoSaleIds = new Set(INITIAL_SALES.map((s) => s.id));
    const demoMovementIds = new Set(INITIAL_MOVEMENTS.map((m) => m.id));
    const demoSupplierIds = new Set(INITIAL_SUPPLIERS.map((s) => s.id));
    const demoOrderIds = new Set(INITIAL_SUPPLIER_ORDERS.map((o) => o.id));
    const demoQuoteIds = new Set(INITIAL_QUOTES.map((q) => q.id));
    const demoInventoryIds = new Set(INITIAL_INVENTORIES.map((i) => i.id));
    const demoCashSessionIds = new Set(INITIAL_CASH_SESSIONS.map((cs) => cs.id));
    const demoCashMovementIds = new Set(INITIAL_CASH_MOVEMENTS.map((cm) => cm.id));
    const demoPaymentIds = new Set(INITIAL_PAYMENTS.map((p) => p.id));

    const filterDemo = <T extends { id: string }>(list: T[], demoSet: Set<string>): T[] => {
      if (!excludeDemo) return list;
      return list.filter((item) => !demoSet.has(item.id));
    };

    const rawArticles = Array.isArray(backupData.articles)
      ? filterDemo(sanitizeUniqueList<Article>(backupData.articles), demoArticleIds)
      : null;
    // Note: in MERGE mode, pass rawArticles as 1st arg so incoming backup records win on equal timestamps
    const nextArticles: Article[] =
      rawArticles !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawArticles, articles)
          : rawArticles
        : articles;
    counts.articles = nextArticles.length;

    const rawWarehouses =
      Array.isArray(backupData.warehouses) && backupData.warehouses.length > 0
        ? sanitizeUniqueList<Warehouse>(backupData.warehouses)
        : null;
    const nextWarehouses: Warehouse[] =
      rawWarehouses !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawWarehouses, warehouses)
          : rawWarehouses
        : warehouses;
    counts.warehouses = nextWarehouses.length;

    const rawStocks = Array.isArray(backupData.stocks)
      ? (backupData.stocks as WarehouseStock[])
          .filter((s) => !excludeDemo || !demoArticleIds.has(s.articleId))
          .map(reconcileWarehouseStock)
      : null;
    const nextStocks: WarehouseStock[] =
      rawStocks !== null
        ? mode === 'MERGE'
          ? mergeStocks(rawStocks, stocks)
          : rawStocks
        : stocks;
    counts.stocks = nextStocks.length;

    const rawMovements = Array.isArray(backupData.movements)
      ? filterDemo(sanitizeUniqueList<StockMovement>(backupData.movements), demoMovementIds)
      : null;
    const nextMovements: StockMovement[] =
      rawMovements !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawMovements, movements)
          : rawMovements
        : movements;
    counts.movements = nextMovements.length;

    const rawCustomers = Array.isArray(backupData.customers)
      ? filterDemo(sanitizeUniqueList<Customer>(backupData.customers), demoCustomerIds)
      : null;
    const nextCustomers: Customer[] =
      rawCustomers !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawCustomers, customers)
          : rawCustomers
        : customers;
    counts.customers = nextCustomers.length;

    const rawSales = Array.isArray(backupData.sales)
      ? filterDemo(sanitizeUniqueList<Sale>(backupData.sales), demoSaleIds)
      : null;
    const nextSales: Sale[] =
      rawSales !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawSales, sales)
          : rawSales
        : sales;
    counts.sales = nextSales.length;

    const rawPayments = Array.isArray(backupData.payments)
      ? filterDemo(sanitizeUniqueList<PaymentRecord>(backupData.payments), demoPaymentIds)
      : null;
    const nextPayments: PaymentRecord[] =
      rawPayments !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawPayments, payments)
          : rawPayments
        : payments;
    counts.payments = nextPayments.length;

    const rawCashSessions = Array.isArray(backupData.cashSessions)
      ? filterDemo(sanitizeUniqueList<CashSession>(backupData.cashSessions), demoCashSessionIds)
      : null;
    const nextCashSessions: CashSession[] =
      rawCashSessions !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawCashSessions, cashSessions)
          : rawCashSessions
        : cashSessions;
    counts.cashSessions = nextCashSessions.length;

    const rawCashMovements = Array.isArray(backupData.cashMovements)
      ? filterDemo(sanitizeUniqueList<CashMovement>(backupData.cashMovements), demoCashMovementIds)
      : null;
    const nextCashMovements: CashMovement[] =
      rawCashMovements !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawCashMovements, cashMovements)
          : rawCashMovements
        : cashMovements;
    counts.cashMovements = nextCashMovements.length;

    const rawInventories = Array.isArray(backupData.inventories)
      ? filterDemo(sanitizeUniqueList<InventorySession>(backupData.inventories), demoInventoryIds)
      : null;
    const nextInventories: InventorySession[] =
      rawInventories !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawInventories, inventories)
          : rawInventories
        : inventories;
    counts.inventories = nextInventories.length;

    const rawSuppliers = Array.isArray(backupData.suppliers)
      ? filterDemo(sanitizeUniqueList<Supplier>(backupData.suppliers), demoSupplierIds)
      : null;
    const nextSuppliers: Supplier[] =
      rawSuppliers !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawSuppliers, suppliers)
          : rawSuppliers
        : suppliers;
    counts.suppliers = nextSuppliers.length;

    const rawSupplierOrders = Array.isArray(backupData.supplierOrders)
      ? filterDemo(sanitizeUniqueList<SupplierOrder>(backupData.supplierOrders), demoOrderIds)
      : null;
    const nextSupplierOrders: SupplierOrder[] =
      rawSupplierOrders !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawSupplierOrders, supplierOrders)
          : rawSupplierOrders
        : supplierOrders;
    counts.supplierOrders = nextSupplierOrders.length;

    const rawQuotes = Array.isArray(backupData.quotes)
      ? filterDemo(sanitizeUniqueList<Quote>(backupData.quotes), demoQuoteIds)
      : null;
    const nextQuotes: Quote[] =
      rawQuotes !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawQuotes, quotes)
          : rawQuotes
        : quotes;
    counts.quotes = nextQuotes.length;

    // Restauration intégrale des Retours & Avoirs clients (returns)
    const rawReturns = Array.isArray(backupData.returns)
      ? sanitizeUniqueList<SaleReturn>(backupData.returns)
      : null;
    const nextReturns: SaleReturn[] =
      rawReturns !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawReturns, returns)
          : rawReturns
        : returns;
    counts.returns = nextReturns.length;

    // Restauration des Utilisateurs & Rôles RBAC (users) avec protection du Super-Admin
    const rawUsers =
      Array.isArray(backupData.users) && backupData.users.length > 0
        ? sanitizeUniqueList<UserProfile>(backupData.users)
        : null;
    let nextUsers: UserProfile[] =
      rawUsers !== null
        ? mode === 'MERGE'
          ? mergeEntities(rawUsers, users)
          : rawUsers
        : users;
    // Toujours garantir la présence du compte Super-Admin principal
    if (!nextUsers.some((u) => u.email?.toLowerCase() === 'westjunior0805@gmail.com')) {
      const superAdmin =
        users.find((u) => u.email?.toLowerCase() === 'westjunior0805@gmail.com') ||
        INITIAL_USERS[0];
      if (superAdmin) {
        nextUsers = [superAdmin, ...nextUsers];
      }
    }
    counts.users = nextUsers.length;

    // Restauration des Informations de l'Entreprise (companyInfo)
    let companyRestored = false;
    if (backupData.companyInfo && typeof backupData.companyInfo === 'object') {
      const nextCompanyInfo: CompanyInfo = {
        ...DEFAULT_COMPANY_INFO,
        ...(mode === 'MERGE' ? companyInfo : {}),
        ...backupData.companyInfo,
      };
      setCompanyInfo(nextCompanyInfo);
      safeSetLocalStorage('company_info', nextCompanyInfo);
      companyRestored = true;
    }

    // Restauration des Ventes mises en attente au guichet (savedDrafts)
    let draftsRestored = 0;
    if (Array.isArray(backupData.savedDrafts) && typeof window !== 'undefined') {
      try {
        let nextDrafts = backupData.savedDrafts;
        if (mode === 'MERGE') {
          const existingRaw = localStorage.getItem('equipstock_pos_saved_lists_v1');
          const existingDrafts = existingRaw ? JSON.parse(existingRaw) : [];
          if (Array.isArray(existingDrafts) && existingDrafts.length > 0) {
            const draftMap = new Map<string, any>();
            existingDrafts.forEach((d: any) => {
              if (d && d.id) draftMap.set(d.id, d);
            });
            backupData.savedDrafts.forEach((d: any) => {
              if (d && d.id) draftMap.set(d.id, d);
            });
            nextDrafts = Array.from(draftMap.values());
          }
        }
        localStorage.setItem('equipstock_pos_saved_lists_v1', JSON.stringify(nextDrafts));
        window.dispatchEvent(new CustomEvent('equipstock-saved-drafts-updated'));
        draftsRestored = nextDrafts.length;
      } catch (err) {
        console.warn('Could not restore saved POS drafts:', err);
      }
    }
    counts.savedDrafts = draftsRestored;

    // Restauration des préférences d'affichage et d'état système si présentes
    if (backupData.preferences && typeof backupData.preferences === 'object') {
      const prefs = backupData.preferences;
      if (typeof prefs.showProductImages === 'boolean') {
        setShowProductImages(prefs.showProductImages);
      }
      if (typeof prefs.isStockFrozen === 'boolean') {
        setIsStockFrozen(prefs.isStockFrozen);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('equipstock_stock_frozen', String(prefs.isStockFrozen));
          } catch {}
        }
      }
      if (
        typeof prefs.selectedWarehouseId === 'string' &&
        nextWarehouses.some((w) => w.id === prefs.selectedWarehouseId)
      ) {
        setSelectedWarehouseId(prefs.selectedWarehouseId);
      }
    }

    // Mise à jour de tous les états en mémoire vive (RAM React)
    setArticles(nextArticles);
    setWarehouses(nextWarehouses);
    setStocks(nextStocks);
    setMovements(nextMovements);
    setCustomers(nextCustomers);
    setSales(nextSales);
    setPayments(nextPayments);
    setCashSessions(nextCashSessions);
    setCashMovements(nextCashMovements);
    setInventories(nextInventories);
    setSuppliers(nextSuppliers);
    setSupplierOrders(nextSupplierOrders);
    setQuotes(nextQuotes);
    setReturns(nextReturns);
    setUsers(nextUsers);

    // Persistance immédiate dans localStorage
    safeSetLocalStorage('articles', nextArticles);
    safeSetLocalStorage('warehouses', nextWarehouses);
    safeSetLocalStorage('stocks', nextStocks);
    safeSetLocalStorage('movements', nextMovements);
    safeSetLocalStorage('customers', nextCustomers);
    safeSetLocalStorage('sales', nextSales);
    safeSetLocalStorage('payments', nextPayments);
    safeSetLocalStorage('cash_sessions', nextCashSessions);
    safeSetLocalStorage('cash_movements', nextCashMovements);
    safeSetLocalStorage('inventories', nextInventories);
    safeSetLocalStorage('suppliers', nextSuppliers);
    safeSetLocalStorage('supplier_orders', nextSupplierOrders);
    safeSetLocalStorage('quotes', nextQuotes);
    safeSetLocalStorage('returns', nextReturns);
    safeSetLocalStorage('users', nextUsers);

    // RÈGLE IMPÉRATIVE N°2 : Ne jamais envoyer automatiquement les données restaurées vers Firebase
    // sauf si l'administrateur a explicitement coché l'option syncToCloud.
    if (options?.syncToCloud === true) {
      const effectiveCompanyInfo =
        backupData.companyInfo && typeof backupData.companyInfo === 'object'
          ? {
              ...DEFAULT_COMPANY_INFO,
              ...(mode === 'MERGE' ? companyInfo : {}),
              ...backupData.companyInfo,
            }
          : companyInfo;
      uploadAllToFirebase({
        articles: nextArticles,
        warehouses: nextWarehouses,
        stocks: nextStocks,
        movements: nextMovements,
        customers: nextCustomers,
        sales: nextSales,
        payments: nextPayments,
        cashSessions: nextCashSessions,
        cashMovements: nextCashMovements,
        inventories: nextInventories,
        suppliers: nextSuppliers,
        supplierOrders: nextSupplierOrders,
        quotes: nextQuotes,
        returns: nextReturns,
        companyInfo: effectiveCompanyInfo,
      }).catch(console.warn);
    }

    // Construction du rapport de vérification d'intégrité post-restauration
    const verificationSpecs: Array<{
      key: string;
      label: string;
      rawList: any[] | null;
      restoredCount: number;
    }> = [
      { key: 'articles', label: 'Articles Catalogue', rawList: rawArticles, restoredCount: nextArticles.length },
      { key: 'warehouses', label: 'Magasins & Dépôts', rawList: rawWarehouses, restoredCount: nextWarehouses.length },
      { key: 'stocks', label: 'Stocks & Emplacements', rawList: rawStocks, restoredCount: nextStocks.length },
      { key: 'movements', label: 'Mouvements de Stock', rawList: rawMovements, restoredCount: nextMovements.length },
      { key: 'inventories', label: 'Sessions d’Inventaire', rawList: rawInventories, restoredCount: nextInventories.length },
      { key: 'customers', label: 'Clients & Créances', rawList: rawCustomers, restoredCount: nextCustomers.length },
      { key: 'sales', label: 'Ventes & Factures', rawList: rawSales, restoredCount: nextSales.length },
      { key: 'payments', label: 'Règlements & Acomptes', rawList: rawPayments, restoredCount: nextPayments.length },
      { key: 'returns', label: 'Retours & Avoirs Clients', rawList: rawReturns, restoredCount: nextReturns.length },
      { key: 'quotes', label: 'Devis & Proformas', rawList: rawQuotes, restoredCount: nextQuotes.length },
      { key: 'cashSessions', label: 'Sessions de Caisse', rawList: rawCashSessions, restoredCount: nextCashSessions.length },
      { key: 'cashMovements', label: 'Opérations de Caisse', rawList: rawCashMovements, restoredCount: nextCashMovements.length },
      { key: 'suppliers', label: 'Fournisseurs', rawList: rawSuppliers, restoredCount: nextSuppliers.length },
      { key: 'supplierOrders', label: 'Commandes Fournisseurs', rawList: rawSupplierOrders, restoredCount: nextSupplierOrders.length },
      { key: 'users', label: 'Opérateurs & Permissions', rawList: rawUsers, restoredCount: nextUsers.length },
    ];

    const details = verificationSpecs
      .filter((spec) => spec.rawList !== null)
      .map((spec) => {
        const inBackup = spec.rawList ? spec.rawList.length : 0;
        const ok = mode === 'REPLACE' ? spec.restoredCount >= inBackup : spec.restoredCount >= inBackup;
        return {
          key: spec.key,
          label: spec.label,
          inBackup,
          restored: spec.restoredCount,
          ok,
        };
      });

    const verified = details.every((d) => d.ok);

    return {
      success: true,
      message: `Restauration intégrale vérifiée (${mode === 'MERGE' ? 'Fusion intelligente' : 'Remplacement complet'}) : ${nextArticles.length} articles, ${nextStocks.length} lignes de stock, ${nextCustomers.length} clients, ${nextSales.length} ventes, ${nextReturns.length} avoirs${companyRestored ? ', infos entreprise' : ''}${draftsRestored > 0 ? `, ${draftsRestored} vente(s) en attente` : ''}.`,
      counts,
      verification: {
        verified,
        companyRestored,
        draftsRestored,
        details,
      },
    };
  };

  const purgeCollection = (collectionKey: string): { success: boolean; message: string } => {
    purgeGenerationRef.current += 1;

    switch (collectionKey) {
      case 'movements':
        setMovements([]);
        safeSetLocalStorage('movements', []);
        triggerCloudWipeForCollections(['movements']);
        return {
          success: true,
          message: 'Journal des mouvements de stock purgé avec succès (Local & Cloud Firestore).',
        };
      case 'inventories':
        setInventories([]);
        safeSetLocalStorage('inventories', []);
        triggerCloudWipeForCollections(['inventories']);
        return {
          success: true,
          message: 'Historique des sessions d’inventaire purgé avec succès (Local & Cloud Firestore).',
        };
      case 'quotes':
        setQuotes([]);
        safeSetLocalStorage('quotes', []);
        triggerCloudWipeForCollections(['quotes']);
        return {
          success: true,
          message: 'Table des devis & proformas purgée avec succès (Local & Cloud Firestore).',
        };
      case 'returns':
        setReturns([]);
        safeSetLocalStorage('returns', []);
        triggerCloudWipeForCollections(['returns']);
        return {
          success: true,
          message: 'Table des retours et avoirs clients purgée avec succès (Local & Cloud Firestore).',
        };
      case 'supplierOrders':
        setSupplierOrders([]);
        safeSetLocalStorage('supplier_orders', []);
        triggerCloudWipeForCollections(['supplierOrders']);
        return {
          success: true,
          message: 'Table des commandes fournisseurs purgée avec succès (Local & Cloud Firestore).',
        };
      case 'suppliers':
        setSuppliers([]);
        safeSetLocalStorage('suppliers', []);
        triggerCloudWipeForCollections(['suppliers']);
        return {
          success: true,
          message: 'Répertoire des fournisseurs purgé avec succès (Local & Cloud Firestore).',
        };
      case 'sales':
        setSales([]);
        safeSetLocalStorage('sales', []);
        triggerCloudWipeForCollections(['sales']);
        return {
          success: true,
          message: 'Journal des ventes purgé avec succès (Local & Cloud Firestore).',
        };
      case 'payments':
        setPayments([]);
        safeSetLocalStorage('payments', []);
        triggerCloudWipeForCollections(['payments']);
        return {
          success: true,
          message: 'Table des règlements clients purgée avec succès (Local & Cloud Firestore).',
        };
      case 'cashSessions':
        setCashSessions([]);
        setCashMovements([]);
        safeSetLocalStorage('cash_sessions', []);
        safeSetLocalStorage('cash_movements', []);
        triggerCloudWipeForCollections(['cashSessions', 'cashMovements']);
        return {
          success: true,
          message: 'Sessions et mouvements de caisse purgés avec succès (Local & Cloud Firestore).',
        };
      case 'cashMovements':
        setCashMovements([]);
        safeSetLocalStorage('cash_movements', []);
        triggerCloudWipeForCollections(['cashMovements']);
        return {
          success: true,
          message: 'Écritures et mouvements de caisse purgés avec succès (Local & Cloud Firestore).',
        };
      case 'customers':
        setCustomers([]);
        safeSetLocalStorage('customers', []);
        triggerCloudWipeForCollections(['customers']);
        return {
          success: true,
          message: 'Portefeuille clients purgé avec succès (Local & Cloud Firestore).',
        };
      case 'stocks': {
        setStocks([]);
        safeSetLocalStorage('stocks', []);
        const cleanedArticles = articles.map((art) =>
          art.brandOffers && art.brandOffers.length > 0
            ? {
                ...art,
                brandOffers: art.brandOffers.map((bo) => ({ ...bo, stockQuantity: 0 })),
              }
            : art
        );
        setArticles(cleanedArticles);
        safeSetLocalStorage('articles', cleanedArticles);
        triggerCloudWipeForCollections(['stocks']);
        return {
          success: true,
          message: 'Table des stocks par dépôt intégralement vidée et remise à zéro (Local & Cloud Firestore).',
        };
      }
      case 'articles':
        setArticles([]);
        setStocks([]);
        safeSetLocalStorage('articles', []);
        safeSetLocalStorage('stocks', []);
        triggerCloudWipeForCollections(['articles', 'stocks']);
        return {
          success: true,
          message: 'Catalogue articles et stocks associés intégralement purgés (Local & Cloud Firestore).',
        };
      case 'warehouses':
        setWarehouses(CLEAN_DEFAULT_WAREHOUSES);
        setStocks([]);
        safeSetLocalStorage('warehouses', CLEAN_DEFAULT_WAREHOUSES);
        safeSetLocalStorage('stocks', []);
        triggerCloudWipeForCollections(['warehouses', 'stocks']);
        return {
          success: true,
          message: 'Magasins secondaires et stocks associés purgés (Dépôt principal réinitialisé).',
        };
      default:
        return { success: false, message: 'Table non reconnue ou protégée.' };
    }
  };

  const optimizeDatabaseStorage = () => {
    let beforeBytes = 0;
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(STORAGE_KEY_PREFIX)) {
          beforeBytes += (localStorage.getItem(k) || '').length * 2;
        }
      });
    } catch {}

    const validArticleIds = new Set(articles.map((a) => a.id));
    const validWarehouseIds = new Set(warehouses.map((w) => w.id));

    const cleanStocks = stocks.filter(
      (s) => validArticleIds.has(s.articleId) && validWarehouseIds.has(s.warehouseId)
    );
    const removedOrphanStocks = Math.max(0, stocks.length - cleanStocks.length);

    const trimmedMovementsCount = Math.max(0, movements.length - MAX_LOCAL_MOVEMENTS);
    const cleanMovements = movements.slice(0, MAX_LOCAL_MOVEMENTS);

    if (removedOrphanStocks > 0) {
      setStocks(cleanStocks);
    }
    if (trimmedMovementsCount > 0) {
      setMovements(cleanMovements);
    }

    safeSetLocalStorage('articles', articles);
    safeSetLocalStorage('warehouses', warehouses);
    safeSetLocalStorage('stocks', cleanStocks);
    safeSetLocalStorage('movements', cleanMovements);
    safeSetLocalStorage('customers', customers);
    safeSetLocalStorage('sales', sales);

    let afterBytes = 0;
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(STORAGE_KEY_PREFIX)) {
          afterBytes += (localStorage.getItem(k) || '').length * 2;
        }
      });
    } catch {}

    const freedBytes = Math.max(0, beforeBytes - afterBytes);

    return {
      success: true,
      message: `Optimisation terminée : ${removedOrphanStocks} ligne(s) de stock orpheline(s) nettoyée(s), cache des mouvements compacté (${(freedBytes / 1024).toFixed(1)} Ko libérés).`,
      freedBytes,
      removedOrphanStocks,
      trimmedMovements: trimmedMovementsCount,
    };
  };

  return (
    <StockContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        firebaseUser,
        isAuthenticated,
        authenticateOperator,
        lockSession,
        addUser,
        updateUser,
        deleteUser,
        hasPermission,
        currentPermissions,
        checkPermission,
        getUserPermissions,
        companyInfo,
        updateCompanyInfo,
        resetCompanyInfo,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        selectedWarehouseId,
        setSelectedWarehouseId,
        boutiqueWarehouseId,
        setBoutiqueWarehouseId,
        getBoutiqueMinThreshold,
        showProductImages,
        setShowProductImages,
        toggleProductImages,
        articles,
        warehouses,
        stocks,
        movements,
        inventories,
        customers,
        sales,
        payments,
        cashSessions,
        cashMovements,
        suppliers,
        supplierOrders,
        quotes,
        getStockForArticleAndWarehouse,
        getTotalStockForArticle,
        getStockValueTotal,
        getSaleValueTotal,
        getArticleById,
        getWarehouseById,
        getCustomerById,
        getSaleById,
        getAlerts,
        getActiveCashSession,
        getCashMovementsForSession,
        recordStockIn,
        recordStockOut,
        recordTransfer,
        recordBatchTransfer,
        createArticle,
        updateArticle,
        bulkUpdateWarehouseMinThresholds,
        addMachineApplication,
        updateMachineApplication,
        removeMachineApplication,
        importMachineApplicationsForArticle,
        importMachineApplications,
        quickUpdateStockItem,
        quickUpdateArticleStocks,
        deleteArticle,
        deleteMultipleArticles,
        executeImport,
        createWarehouse,
        updateWarehouse,
        deleteWarehouse,
        createInventorySession,
        updateInventoryCount,
        batchUpdateInventoryCounts,
        syncInventorySessionBrands,
        validateInventorySession,
        cancelInventorySession,
        deleteInventorySession,
        updateStockLocationInWarehouse,
        addArticleToInventorySession,
        createCustomer,
        updateCustomer,
        deleteCustomer,
        importCustomers,
        recordCustomerPayment,
        recordCustomerDebtPayment,
        updateCustomerPayment,
        deleteCustomerPayment,
        adjustCustomerDebt,
        deleteCustomerDebtAdjustment,
        recordSale,
        updateSale,
        syncSaleToCashJournal,
        cancelOrRefundSale,
        deleteSale,
        returns,
        processSaleReturn,
        isStockFrozen,
        setIsStockFrozen,
        toggleStockFreeze,
        openCashSession,
        closeCashSession,
        reopenCashSession,
        updateCashSessionInitialFloat,
        deleteCashMovement,
        recordCashExpense,
        transferElectronicToCashDrawer,
        createSupplierOrder,
        updateSupplierOrder,
        updateSupplierOrderStatus,
        receiveSupplierOrder,
        cancelSupplierOrder,
        deleteSupplierOrder,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        getActiveOrderForArticle,
        createQuote,
        updateQuote,
        updateQuoteStatus,
        deleteQuote,
        convertQuoteToSale,
        resetToDemoData,
        clearAllData,
        exportDatabaseJson,
        restoreDatabaseJson,
        purgeCollection,
        optimizeDatabaseStorage,
        loadDataFromCloud,
        refreshFromCloud,
        isSyncing,
        lastCloudSync,
      }}
    >
      {children}
    </StockContext.Provider>
  );
};

export const useStock = () => {
  const context = useContext(StockContext);
  if (!context) {
    throw new Error('useStock must be used within a StockProvider');
  }
  return context;
};
