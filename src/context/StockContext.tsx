import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Article,
  ArticleBrandOffer,
  Warehouse,
  WarehouseStock,
  StockMovement,
  UserProfile,
  UserRole,
  InventorySession,
  StockAlert,
  MovementType,
  Customer,
  Sale,
  SaleItem,
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
} from '../types';
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
  uploadAllToFirebase,
  downloadAllFromFirebase,
  wipeAllFromFirebase,
  saveUserToFirebase,
  deleteUserFromFirebase,
  downloadUsersFromFirebase,
  subscribeToCollection,
  saveArticleToFirebase,
  deleteArticleFromFirebase,
  saveStockToFirebase,
  saveMultipleStocksToFirebase,
  saveMovementToFirebase,
  saveWarehouseToFirebase,
  deleteWarehouseFromFirebase,
  saveCustomerToFirebase,
  deleteCustomerFromFirebase,
  saveSaleToFirebase,
  savePaymentToFirebase,
  saveCashSessionToFirebase,
  saveCashMovementToFirebase,
  saveSupplierToFirebase,
  saveSupplierOrderToFirebase,
  saveQuoteToFirebase,
  saveInventoryToFirebase,
} from '../services/firebaseSync';
import {
  onAuthChanged,
  FirebaseUser,
  signInWithGoogle,
  logoutUser,
  signInWithEmail,
  signUpWithEmail,
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
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }>;
  notes?: string;
}

interface StockContextType {
  // Current user, directory & Firebase Auth
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  users: UserProfile[];
  firebaseUser: FirebaseUser | null;
  addUser: (userData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;

  // Selected warehouse filter in UI (null = all warehouses)
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string | null) => void;

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
  createCustomer: (customerData: Omit<Customer, 'id' | 'createdAt' | 'outstandingBalance'>) => {
    success: boolean;
    error?: string;
    customer?: Customer;
  };
  updateCustomer: (id: string, updates: Partial<Customer>) => { success: boolean; error?: string };
  recordCustomerPayment: (params: {
    customerId: string;
    type: 'REGLEMENT_CREANCE' | 'ACOMPTE_AVANCE';
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
  }) => { success: boolean; error?: string; payment?: PaymentRecord };
  recordCustomerDebtPayment: (params: {
    customerId: string;
    amount: number;
    method: PaymentMethod;
    warehouseId: string;
    reference?: string;
    notes?: string;
  }) => { success: boolean; error?: string; payment?: PaymentRecord };

  // Sales actions & getters
  getSaleById: (id: string) => Sale | undefined;
  recordSale: (params: RecordSaleParams) => { success: boolean; error?: string; sale?: Sale };
  cancelOrRefundSale: (params: {
    saleId: string;
    reason: string;
    refundCash?: boolean;
  }) => { success: boolean; error?: string };

  // Cash Session actions & getters
  getActiveCashSession: (warehouseId: string) => CashSession | undefined;
  getCashMovementsForSession: (sessionId: string) => CashMovement[];
  openCashSession: (params: {
    warehouseId: string;
    initialCashFloat: number;
    notes?: string;
  }) => { success: boolean; error?: string; session?: CashSession };
  closeCashSession: (params: {
    sessionId: string;
    countedCash: number;
    varianceJustification?: string;
    notes?: string;
  }) => { success: boolean; error?: string };
  recordCashExpense: (params: {
    warehouseId: string;
    type: 'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES';
    amount: number;
    reason: string;
    notes?: string;
  }) => { success: boolean; error?: string };

  // Stock Operations (with strict business validation)
  recordStockIn: (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
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
    documentRef: string;
    reason: string;
    notes?: string;
  }) => { success: boolean; error?: string };

  // Article Management
  createArticle: (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => {
    success: boolean;
    error?: string;
    article?: Article;
  };
  updateArticle: (id: string, updates: Partial<Article>) => { success: boolean; error?: string };
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
    targetWarehouseId: string;
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
  createInventorySession: (warehouseId: string, notes?: string) => {
    success: boolean;
    session?: InventorySession;
    error?: string;
  };
  updateInventoryCount: (sessionId: string, articleId: string, countedQty: number | null, notes?: string) => void;
  validateInventorySession: (sessionId: string) => { success: boolean; error?: string };
  cancelInventorySession: (sessionId: string) => { success: boolean; error?: string };

  // Supplier & PO Management
  createSupplierOrder: (params: {
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      articleId: string;
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
    }>;
    notes?: string;
  }) => { success: boolean; error?: string };
  cancelSupplierOrder: (orderId: string, reason?: string) => { success: boolean; error?: string };
  createSupplier: (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => { success: boolean; error?: string; supplier?: Supplier };

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
  updateQuoteStatus: (quoteId: string, status: QuoteStatus) => { success: boolean; error?: string };
  convertQuoteToSale: (quoteId: string, paymentMethod: PaymentMethod) => { success: boolean; error?: string; saleId?: string };

  // System actions (Demo backup / reset / table rase / Cloud)
  resetToDemoData: () => void;
  clearAllData: (options?: { keepWarehouses?: boolean }) => Promise<void>;
  exportDatabaseJson: () => void;
  loadDataFromCloud: (cloudData: any) => void;
  refreshFromCloud: () => Promise<{ success: boolean; message: string }>;
  isSyncing: boolean;
  lastCloudSync: Date | null;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'equipstock_v2_';

// Clean up legacy v1 demo data if present in browser localStorage
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('equipstock_v1_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // Ignore in non-browser context
  }
}

export const CLEAN_DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'mag_dkr_port',
    code: 'MAG-DKR-01',
    name: 'Entrepôt Central Dakar Port',
    location: 'Zone Industrielle Bel-Air, Dakar',
    phone: '+221 33 849 20 10',
    manager: 'Amadou Ndiaye',
    isActive: true,
    isDefault: true,
    notes: 'Magasin central principal (base vierge de démarrage).',
  },
];

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
const sanitizeUniqueList = <T extends { id: string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  return list.map((item, idx) => {
    if (seen.has(item.id)) {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      const cleanId = `${item.id}-DEDUP-${idx}-${rand}`;
      return { ...item, id: cleanId };
    }
    seen.add(item.id);
    return item;
  });
};

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Real Firebase Auth user state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

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

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const [articles, setArticles] = useState<Article[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'articles');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'warehouses');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : CLEAN_DEFAULT_WAREHOUSES;
  });

  const [stocks, setStocks] = useState<WarehouseStock[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'stocks');
    return saved ? JSON.parse(saved) : [];
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'movements');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [inventories, setInventories] = useState<InventorySession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'inventories');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'customers');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'sales');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'payments');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [cashSessions, setCashSessions] = useState<CashSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cash_sessions');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cash_movements');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'suppliers');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'supplier_orders');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'quotes');
    return saved ? sanitizeUniqueList(JSON.parse(saved)) : [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(articles));
  }, [articles]);

  // Sanitize any existing oversized images in articles (e.g. legacy large photos)
  useEffect(() => {
    let isCancelled = false;
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
      if (changed && !isCancelled) {
        setArticles(updated);
      }
    };
    shrinkOversized();
    return () => {
      isCancelled = true;
    };
  }, []);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);

  // Manual or on-demand full refresh from Google Cloud Firestore
  const refreshFromCloud = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const cloudData = await downloadAllFromFirebase();
      let importedCount = 0;

      if (cloudData.articles && cloudData.articles.length > 0) {
        setArticles(sanitizeUniqueList(cloudData.articles));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(cloudData.articles));
        importedCount += cloudData.articles.length;
      }
      if (cloudData.stocks && cloudData.stocks.length > 0) {
        setStocks(cloudData.stocks);
        localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(cloudData.stocks));
      }
      if (cloudData.movements && cloudData.movements.length > 0) {
        const sorted = [...cloudData.movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMovements(sanitizeUniqueList(sorted));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(sorted));
      }
      if (cloudData.warehouses && cloudData.warehouses.length > 0) {
        setWarehouses(sanitizeUniqueList(cloudData.warehouses));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(cloudData.warehouses));
      }
      if (cloudData.sales && cloudData.sales.length > 0) {
        const sorted = [...cloudData.sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSales(sanitizeUniqueList(sorted));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify(sorted));
      }
      if (cloudData.payments && cloudData.payments.length > 0) {
        setPayments(sanitizeUniqueList(cloudData.payments));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(cloudData.payments));
      }
      if (cloudData.customers && cloudData.customers.length > 0) {
        setCustomers(sanitizeUniqueList(cloudData.customers));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(cloudData.customers));
      }
      if (cloudData.cashSessions && cloudData.cashSessions.length > 0) {
        setCashSessions(sanitizeUniqueList(cloudData.cashSessions));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify(cloudData.cashSessions));
      }
      if (cloudData.cashMovements && cloudData.cashMovements.length > 0) {
        setCashMovements(sanitizeUniqueList(cloudData.cashMovements));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify(cloudData.cashMovements));
      }
      if (cloudData.suppliers && cloudData.suppliers.length > 0) {
        setSuppliers(sanitizeUniqueList(cloudData.suppliers));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(cloudData.suppliers));
      }
      if (cloudData.supplierOrders && cloudData.supplierOrders.length > 0) {
        setSupplierOrders(sanitizeUniqueList(cloudData.supplierOrders));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify(cloudData.supplierOrders));
      }
      if (cloudData.quotes && cloudData.quotes.length > 0) {
        setQuotes(sanitizeUniqueList(cloudData.quotes));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify(cloudData.quotes));
      }
      if (cloudData.inventories && cloudData.inventories.length > 0) {
        setInventories(sanitizeUniqueList(cloudData.inventories));
        localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify(cloudData.inventories));
      }

      setLastCloudSync(new Date());
      setIsSyncing(false);
      return {
        success: true,
        message: `Synchronisation Cloud terminée (${importedCount} pièce(s) au catalogue)`,
      };
    } catch (err: any) {
      setIsSyncing(false);
      return {
        success: false,
        message: `Échec de synchronisation Cloud : ${err?.message || 'Erreur réseau'}`,
      };
    }
  };

  // Real-time Firestore synchronization listeners (bi-directional sync between deployed app & AI Studio)
  useEffect(() => {
    let isCancelled = false;

    // 1. Initial startup hydration
    const hydrateFromFirebase = async () => {
      try {
        const cloudData = await downloadAllFromFirebase();
        if (isCancelled) return;

        if (cloudData.articles && cloudData.articles.length > 0) {
          setArticles(sanitizeUniqueList(cloudData.articles));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(cloudData.articles));
        }

        if (cloudData.warehouses && cloudData.warehouses.length > 0) {
          setWarehouses(sanitizeUniqueList(cloudData.warehouses));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(cloudData.warehouses));
        }

        if (cloudData.stocks && cloudData.stocks.length > 0) {
          setStocks(cloudData.stocks);
          localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(cloudData.stocks));
        }

        if (cloudData.movements && cloudData.movements.length > 0) {
          const sorted = [...cloudData.movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setMovements(sanitizeUniqueList(sorted));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(sorted));
        }

        if (cloudData.customers && cloudData.customers.length > 0) {
          setCustomers(sanitizeUniqueList(cloudData.customers));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(cloudData.customers));
        }

        if (cloudData.sales && cloudData.sales.length > 0) {
          const sorted = [...cloudData.sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setSales(sanitizeUniqueList(sorted));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify(sorted));
        }

        if (cloudData.payments && cloudData.payments.length > 0) {
          setPayments(sanitizeUniqueList(cloudData.payments));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(cloudData.payments));
        }

        if (cloudData.cashSessions && cloudData.cashSessions.length > 0) {
          setCashSessions(sanitizeUniqueList(cloudData.cashSessions));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify(cloudData.cashSessions));
        }

        if (cloudData.cashMovements && cloudData.cashMovements.length > 0) {
          setCashMovements(sanitizeUniqueList(cloudData.cashMovements));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify(cloudData.cashMovements));
        }

        if (cloudData.inventories && cloudData.inventories.length > 0) {
          setInventories(sanitizeUniqueList(cloudData.inventories));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify(cloudData.inventories));
        }

        if (cloudData.suppliers && cloudData.suppliers.length > 0) {
          setSuppliers(sanitizeUniqueList(cloudData.suppliers));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(cloudData.suppliers));
        }

        if (cloudData.supplierOrders && cloudData.supplierOrders.length > 0) {
          setSupplierOrders(sanitizeUniqueList(cloudData.supplierOrders));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify(cloudData.supplierOrders));
        }

        if (cloudData.quotes && cloudData.quotes.length > 0) {
          setQuotes(sanitizeUniqueList(cloudData.quotes));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify(cloudData.quotes));
        }

        // Hydrate users directory from Firestore
        try {
          const cloudUsers = await downloadUsersFromFirebase();
          if (cloudUsers && cloudUsers.length > 0) {
            setUsers((prev) => {
              const map = new Map<string, UserProfile>();
              prev.forEach((u) => map.set(u.id, u));
              cloudUsers.forEach((cu) => map.set(cu.id, cu));
              const merged = Array.from(map.values());
              localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(merged));
              return merged;
            });
          }
        } catch (uErr) {
          console.warn('Notice chargement utilisateurs cloud:', uErr);
        }

        setLastCloudSync(new Date());
      } catch (err) {
        console.warn('Firebase Cloud auto-hydration notice (offline or first boot):', err);
      }
    };

    hydrateFromFirebase();

    // 2. Continuous real-time Firestore listeners
    const unsubs: (() => void)[] = [];

    // Live Articles listener
    unsubs.push(
      subscribeToCollection<Article>('articles', (remoteArticles) => {
        if (!isCancelled && remoteArticles && remoteArticles.length > 0) {
          setArticles(sanitizeUniqueList(remoteArticles));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(remoteArticles));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Stocks listener
    unsubs.push(
      subscribeToCollection<WarehouseStock>('stocks', (remoteStocks) => {
        if (!isCancelled && remoteStocks && remoteStocks.length > 0) {
          setStocks(remoteStocks);
          localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(remoteStocks));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Movements listener
    unsubs.push(
      subscribeToCollection<StockMovement>('movements', (remoteMovements) => {
        if (!isCancelled && remoteMovements && remoteMovements.length > 0) {
          const sorted = [...remoteMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setMovements(sanitizeUniqueList(sorted));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(sorted));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Warehouses listener
    unsubs.push(
      subscribeToCollection<Warehouse>('warehouses', (remoteWh) => {
        if (!isCancelled && remoteWh && remoteWh.length > 0) {
          setWarehouses(sanitizeUniqueList(remoteWh));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(remoteWh));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Customers listener
    unsubs.push(
      subscribeToCollection<Customer>('customers', (remoteCustomers) => {
        if (!isCancelled && remoteCustomers && remoteCustomers.length > 0) {
          setCustomers(sanitizeUniqueList(remoteCustomers));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(remoteCustomers));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Sales listener
    unsubs.push(
      subscribeToCollection<Sale>('sales', (remoteSales) => {
        if (!isCancelled && remoteSales && remoteSales.length > 0) {
          const sorted = [...remoteSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setSales(sanitizeUniqueList(sorted));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify(sorted));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Payments listener
    unsubs.push(
      subscribeToCollection<PaymentRecord>('payments', (remotePayments) => {
        if (!isCancelled && remotePayments && remotePayments.length > 0) {
          setPayments(sanitizeUniqueList(remotePayments));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(remotePayments));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Cash Sessions listener
    unsubs.push(
      subscribeToCollection<CashSession>('cashSessions', (remoteSessions) => {
        if (!isCancelled && remoteSessions && remoteSessions.length > 0) {
          setCashSessions(sanitizeUniqueList(remoteSessions));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify(remoteSessions));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Cash Movements listener
    unsubs.push(
      subscribeToCollection<CashMovement>('cashMovements', (remoteCashMovements) => {
        if (!isCancelled && remoteCashMovements && remoteCashMovements.length > 0) {
          setCashMovements(sanitizeUniqueList(remoteCashMovements));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify(remoteCashMovements));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Suppliers listener
    unsubs.push(
      subscribeToCollection<Supplier>('suppliers', (remoteSuppliers) => {
        if (!isCancelled && remoteSuppliers && remoteSuppliers.length > 0) {
          setSuppliers(sanitizeUniqueList(remoteSuppliers));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(remoteSuppliers));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Supplier Orders listener
    unsubs.push(
      subscribeToCollection<SupplierOrder>('supplierOrders', (remoteOrders) => {
        if (!isCancelled && remoteOrders && remoteOrders.length > 0) {
          setSupplierOrders(sanitizeUniqueList(remoteOrders));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify(remoteOrders));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Quotes listener
    unsubs.push(
      subscribeToCollection<Quote>('quotes', (remoteQuotes) => {
        if (!isCancelled && remoteQuotes && remoteQuotes.length > 0) {
          setQuotes(sanitizeUniqueList(remoteQuotes));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify(remoteQuotes));
          setLastCloudSync(new Date());
        }
      })
    );

    // Live Inventories listener
    unsubs.push(
      subscribeToCollection<InventorySession>('inventories', (remoteInventories) => {
        if (!isCancelled && remoteInventories && remoteInventories.length > 0) {
          setInventories(sanitizeUniqueList(remoteInventories));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify(remoteInventories));
          setLastCloudSync(new Date());
        }
      })
    );

    return () => {
      isCancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  // Listen to real-time Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChanged(async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser && fUser.email) {
        const emailLower = fUser.email.toLowerCase();
        const isSuperAdmin = emailLower === 'westjunior0805@gmail.com';

        setUsers((prevUsers) => {
          const matched = prevUsers.find(
            (u) => u.email.toLowerCase() === emailLower || (u.firebaseUid && u.firebaseUid === fUser.uid)
          );

          if (matched) {
            const updated: UserProfile = {
              ...matched,
              firebaseUid: fUser.uid,
              avatarUrl: fUser.photoURL || matched.avatarUrl,
              role: isSuperAdmin ? 'ADMIN' : matched.role,
              lastLoginAt: new Date().toISOString(),
            };
            const next = prevUsers.map((u) => (u.id === matched.id ? updated : u));
            localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
            setCurrentUser(updated);
            localStorage.setItem(STORAGE_KEY_PREFIX + 'user', JSON.stringify(updated));
            saveUserToFirebase(updated).catch(console.warn);
            return next;
          } else {
            const newProfile: UserProfile = {
              id: `usr_${Date.now()}`,
              name: fUser.displayName || fUser.email?.split('@')[0] || 'Utilisateur Google',
              email: fUser.email || '',
              role: isSuperAdmin ? 'ADMIN' : 'MAGASINIER',
              avatarUrl: fUser.photoURL || undefined,
              firebaseUid: fUser.uid,
              isActive: true,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };
            const next = [...prevUsers, newProfile];
            localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
            setCurrentUser(newProfile);
            localStorage.setItem(STORAGE_KEY_PREFIX + 'user', JSON.stringify(newProfile));
            saveUserToFirebase(newProfile).catch(console.warn);
            return next;
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(warehouses));
  }, [warehouses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(stocks));
  }, [stocks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify(inventories));
  }, [inventories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify(cashSessions));
  }, [cashSessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify(cashMovements));
  }, [cashMovements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify(supplierOrders));
  }, [supplierOrders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify(quotes));
  }, [quotes]);

  // Stock Getters
  const getStockForArticleAndWarehouse = (articleId: string, warehouseId: string): number => {
    const record = stocks.find((s) => s.articleId === articleId && s.warehouseId === warehouseId);
    return record ? record.quantity : 0;
  };

  const getTotalStockForArticle = (articleId: string): number => {
    return stocks
      .filter((s) => s.articleId === articleId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const getStockValueTotal = (warehouseId?: string | null): number => {
    let relevantStocks = stocks;
    if (warehouseId) {
      relevantStocks = stocks.filter((s) => s.warehouseId === warehouseId);
    }
    return relevantStocks.reduce((total, s) => {
      const art = articles.find((a) => a.id === s.articleId);
      if (!art || s.quantity <= 0) return total;
      return total + s.quantity * art.purchasePrice;
    }, 0);
  };

  const getSaleValueTotal = (warehouseId?: string | null): number => {
    let relevantStocks = stocks;
    if (warehouseId) {
      relevantStocks = stocks.filter((s) => s.warehouseId === warehouseId);
    }
    return relevantStocks.reduce((total, s) => {
      const art = articles.find((a) => a.id === s.articleId);
      if (!art || s.quantity <= 0) return total;
      return total + s.quantity * art.salePrice;
    }, 0);
  };

  const getArticleById = (id: string): Article | undefined => {
    return articles.find((a) => a.id === id);
  };

  const getWarehouseById = (id: string): Warehouse | undefined => {
    return warehouses.find((w) => w.id === id);
  };

  const getCustomerById = (id: string): Customer | undefined => {
    return customers.find((c) => c.id === id);
  };

  const getSaleById = (id: string): Sale | undefined => {
    return sales.find((s) => s.id === id);
  };

  const getActiveCashSession = (warehouseId: string): CashSession | undefined => {
    return cashSessions.find((s) => s.warehouseId === warehouseId && s.status === 'OPEN');
  };

  const getCashMovementsForSession = (sessionId: string): CashMovement[] => {
    return cashMovements.filter((m) => m.cashSessionId === sessionId);
  };

  const getAlerts = (): StockAlert[] => {
    const alerts: StockAlert[] = [];
    articles.forEach((art) => {
      if (art.status !== 'active') return;
      const currentStock = getTotalStockForArticle(art.id);
      const isOutOfStock = currentStock === 0;
      const isUnderThreshold = currentStock > 0 && currentStock <= art.minStockThreshold;

      if (isOutOfStock || isUnderThreshold) {
        const warehousesWithStock = warehouses
          .map((w) => ({
            warehouseName: w.name,
            qty: getStockForArticleAndWarehouse(art.id, w.id),
          }))
          .filter((w) => w.qty > 0);

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
    });

    return alerts.sort((a, b) => {
      if (a.alertType === 'RUPTURE' && b.alertType !== 'RUPTURE') return -1;
      if (b.alertType === 'RUPTURE' && a.alertType !== 'RUPTURE') return 1;
      return b.deficit - a.deficit;
    });
  };

  // Helper to adjust stock in a specific warehouse
  const applyStockDelta = (
    currentStocks: WarehouseStock[],
    articleId: string,
    warehouseId: string,
    delta: number,
    brand?: string
  ): WarehouseStock[] => {
    const existingIndex = currentStocks.findIndex(
      (s) => s.articleId === articleId && s.warehouseId === warehouseId
    );

    if (existingIndex >= 0) {
      const updated = [...currentStocks];
      const prev = updated[existingIndex];
      const newQty = Math.max(0, prev.quantity + delta);
      const nextBreakdown = { ...(prev.brandBreakdown || {}) };
      if (brand) {
        const curBrandQty = nextBreakdown[brand] || 0;
        nextBreakdown[brand] = Math.max(0, curBrandQty + delta);
      }
      updated[existingIndex] = {
        ...prev,
        quantity: newQty,
        brandBreakdown: Object.keys(nextBreakdown).length > 0 ? nextBreakdown : prev.brandBreakdown,
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
          brandBreakdown: brand ? { [brand]: initialQty } : undefined,
        },
      ];
    }
  };

  // Customer Management
  const createCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'outstandingBalance'>) => {
    const code = customerData.code.trim().toUpperCase();
    const exists = customers.some((c) => c.code === code);
    if (exists) {
      return { success: false, error: `Le code client "${code}" existe déjà.` };
    }

    const newId = generateCustomerId(customers.length);
    const newCustomer: Customer = {
      ...customerData,
      id: newId,
      code,
      name: customerData.name.trim(),
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    return { success: true, customer: newCustomer };
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const existing = customers.find((c) => c.id === id);
    if (!existing) return { success: false, error: 'Client introuvable.' };

    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    return { success: true };
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
    const paymentId = generatePaymentId();

    const isAcompte = params.type === 'ACOMPTE_AVANCE';
    const paymentTypeLabel = isAcompte ? 'ACOMPTE_CLIENT' : 'REGLEMENT_CREANCE';
    const defaultReason = isAcompte
      ? `Acompte / Avance sur commande (${customer.name})`
      : `Règlement créance (${customer.name})`;

    const newPayment: PaymentRecord = {
      id: paymentId,
      date: nowIso,
      customerId: params.customerId,
      customerName: customer.name,
      paymentType: paymentTypeLabel,
      warehouseId: params.warehouseId,
      method: params.method,
      amount: params.amount,
      userId: currentUser.id,
      userName: currentUser.name,
      reference: params.reference?.trim() || `${paymentId}`,
      notes: params.notes?.trim() || defaultReason,
    };

    // Update customer balances:
    // If REGLEMENT_CREANCE: deduct debt. If amount > debt, surplus goes to depositBalance.
    // If ACOMPTE_AVANCE: add directly to depositBalance (available credit).
    let nextCustomers = [...customers];
    if (isAcompte) {
      nextCustomers = customers.map((c) =>
        c.id === params.customerId
          ? { ...c, depositBalance: (c.depositBalance || 0) + params.amount }
          : c
      );
    } else {
      const debtToSettle = Math.min(params.amount, customer.outstandingBalance);
      const surplus = params.amount - debtToSettle;
      nextCustomers = customers.map((c) =>
        c.id === params.customerId
          ? {
              ...c,
              outstandingBalance: Math.max(0, c.outstandingBalance - debtToSettle),
              depositBalance: (c.depositBalance || 0) + surplus,
            }
          : c
      );
    }
    setCustomers(nextCustomers);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(nextCustomers));

    const nextPayments = [newPayment, ...payments];
    setPayments(nextPayments);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(nextPayments));

    // Record cash movement if cash session is active (or if Espèces)
    if (activeSession) {
      const isDrawerCash = params.method === 'ESPECES';
      const csmId = generateCashMovementId();
      const newCashMvt: CashMovement = {
        id: csmId,
        cashSessionId: activeSession.id,
        warehouseId: params.warehouseId,
        date: nowIso,
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

      setCashMovements((prev) => [newCashMvt, ...prev]);

      if (isDrawerCash) {
        setCashSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id ? { ...s, theoreticalCash: s.theoreticalCash + params.amount } : s
          )
        );
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
  }) => {
    return recordCustomerPayment({ ...params, type: 'REGLEMENT_CREANCE' });
  };

  // Cash Register Management
  const openCashSession = (params: {
    warehouseId: string;
    initialCashFloat: number;
    notes?: string;
  }) => {
    const wh = warehouses.find((w) => w.id === params.warehouseId);
    if (!wh) return { success: false, error: 'Magasin invalide.' };

    // Prevent multiple active sessions for the same warehouse
    const alreadyOpen = cashSessions.find(
      (s) => s.warehouseId === params.warehouseId && s.status === 'OPEN'
    );
    if (alreadyOpen) {
      return {
        success: false,
        error: `Une session de caisse (${alreadyOpen.id}) est déjà ouverte pour ${wh.name}. Veuillez la clôturer d’abord.`,
      };
    }

    if (params.initialCashFloat < 0) {
      return { success: false, error: 'Le fond de caisse initial ne peut pas être négatif.' };
    }

    const sessionId = generateCashSessionId();
    const nowIso = new Date().toISOString();

    const newSession: CashSession = {
      id: sessionId,
      warehouseId: params.warehouseId,
      warehouseName: wh.name,
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
      warehouseId: params.warehouseId,
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

    setCashSessions((prev) => [newSession, ...prev]);
    if (params.initialCashFloat > 0) {
      setCashMovements((prev) => [initialMvt, ...prev]);
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

    // Formula: Solde théorique = montant initial + encaissements espèces - sorties/remboursements espèces
    const theoretical = session.theoreticalCash;
    const variance = params.countedCash - theoretical;

    if (variance !== 0 && !params.varianceJustification?.trim()) {
      return {
        success: false,
        error: `Un écart de caisse de ${variance > 0 ? '+' : ''}${variance.toLocaleString()} FCFA a été constaté. Une justification explicite est obligatoire.`,
      };
    }

    const nowIso = new Date().toISOString();
    setCashSessions((prev) =>
      prev.map((s) =>
        s.id === params.sessionId
          ? {
              ...s,
              status: 'CLOSED' as const,
              closedAt: nowIso,
              closedByUserId: currentUser.id,
              closedByUserName: currentUser.name,
              countedCash: params.countedCash,
              cashVariance: variance,
              varianceJustification: params.varianceJustification?.trim(),
              notes: params.notes?.trim() || s.notes,
            }
          : s
      )
    );

    return { success: true };
  };

  const recordCashExpense = (params: {
    warehouseId: string;
    type: 'DEPENSE' | 'RETRAIT_BANQUE' | 'APPORT_ESPECES';
    amount: number;
    reason: string;
    notes?: string;
  }) => {
    const activeSession = getActiveCashSession(params.warehouseId);
    if (!activeSession) {
      return {
        success: false,
        error: 'Aucune caisse ouverte pour ce magasin. Veuillez ouvrir une session de caisse avant de saisir une opération.',
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

    const nowIso = new Date().toISOString();
    const csmId = generateCashMovementId('CSM-EXP');
    const newMvt: CashMovement = {
      id: csmId,
      cashSessionId: activeSession.id,
      warehouseId: params.warehouseId,
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

    setCashMovements((prev) => [newMvt, ...prev]);
    setCashSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              theoreticalCash: isOut
                ? s.theoreticalCash - params.amount
                : s.theoreticalCash + params.amount,
            }
          : s
      )
    );

    return { success: true };
  };

  // Operation: RECORD A COMPLETE SALE (ATOMIC & STRICT)
  const recordSale = (params: RecordSaleParams): { success: boolean; error?: string; sale?: Sale } => {
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Le panier de vente est vide.' };
    }

    const wh = warehouses.find((w) => w.id === params.warehouseId);
    if (!wh) return { success: false, error: 'Magasin vendeur introuvable.' };

    // 1. Verify items and available stock
    for (const item of params.items) {
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return { success: false, error: `Quantité invalide pour l'article ${item.articleId}.` };
      }

      const article = articles.find((a) => a.id === item.articleId);
      if (!article) {
        return { success: false, error: `Article ${item.articleId} introuvable.` };
      }

      const availableStock = getStockForArticleAndWarehouse(item.articleId, params.warehouseId);
      if (availableStock < item.quantity) {
        return {
          success: false,
          error: `Stock insuffisant pour ${article.mainReference} (${article.designation}) dans ${wh.name}. Disponible : ${availableStock} ${article.unit}, demandé : ${item.quantity}. Vente bloquée.`,
        };
      }
    }

    // 2. Build verified items and amounts
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    const validatedItems: SaleItem[] = params.items.map((it) => {
      const art = articles.find((a) => a.id === it.articleId)!;
      let chosenBrandOffer = art.brandOffers?.find((bo) => bo.id === it.selectedBrandOfferId);
      if (!chosenBrandOffer && art.brandOffers && art.brandOffers.length > 0) {
        chosenBrandOffer = art.brandOffers.find((bo) => bo.isDefault) || art.brandOffers[0];
      }

      const brandName = chosenBrandOffer ? chosenBrandOffer.brand : art.brand;
      const unitCost = chosenBrandOffer ? chosenBrandOffer.purchasePrice : art.purchasePrice;
      const catalogPrice = chosenBrandOffer ? chosenBrandOffer.salePrice : art.salePrice;
      const appliedPrice = it.unitPrice !== undefined && it.unitPrice >= 0 ? it.unitPrice : catalogPrice;
      const isPriceOverridden = appliedPrice !== catalogPrice;

      const rawLine = it.quantity * appliedPrice;
      let discountAmount = it.discountAmount || 0;
      if (it.discountPercent && it.discountPercent > 0) {
        discountAmount = Math.round((rawLine * it.discountPercent) / 100);
      }
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
    const nowIso = new Date().toISOString();

    const activeSession = getActiveCashSession(params.warehouseId);

    const newSale: Sale = {
      id: saleId,
      receiptNumber,
      date: nowIso,
      warehouseId: params.warehouseId,
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
      notes: params.notes?.trim(),
      cashSessionId: activeSession?.id,
    };

    // 4. ATOMIC DATA UPDATES:
    // A. Decrement stocks and record Stock Movements of type SORTIE
    let nextStocks = [...stocks];
    const newStockMovements: StockMovement[] = [];

    validatedItems.forEach((it) => {
      const currentQty = getStockForArticleAndWarehouse(it.articleId, params.warehouseId);
      const afterQty = currentQty - it.quantity;

      nextStocks = applyStockDelta(nextStocks, it.articleId, params.warehouseId, -it.quantity, it.brand);

      const mvtId = generateMovementId();
      newStockMovements.push({
        id: mvtId,
        date: nowIso,
        type: 'SORTIE',
        articleId: it.articleId,
        quantity: it.quantity,
        sourceWarehouseId: params.warehouseId,
        userId: currentUser.id,
        userName: currentUser.name,
        documentRef: saleId,
        reason: `Vente pièces - Reçu ${receiptNumber}`,
        thirdParty: newSale.customerName,
        unitPrice: it.unitPrice,
        totalPrice: it.totalLine,
        stockBefore: currentQty,
        stockAfter: afterQty,
        notes: `Réf commande / vente ${saleId}`,
      });
    });

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
    setStocks(nextStocks);
    setMovements((prev) => [...newStockMovements, ...prev]);
    setSales((prev) => [newSale, ...prev]);
    if (newPaymentRecords.length > 0) {
      setPayments((prev) => [...newPaymentRecords, ...prev]);
    }
    if (newCashMovements.length > 0) {
      setCashMovements((prev) => [...newCashMovements, ...prev]);
    }

    // Update customer debt balance if needed
    if (remainingDue > 0 && params.customerId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === params.customerId
            ? { ...c, outstandingBalance: c.outstandingBalance + remainingDue }
            : c
        )
      );
    }

    // Update active cash session theoretical cash if cash received
    if (activeSession && cashAddedToDrawer > 0) {
      setCashSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, theoreticalCash: s.theoreticalCash + cashAddedToDrawer }
            : s
        )
      );
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

    // 2. Adjust customer balance if this sale had an outstanding debt
    if (sale.remainingDue > 0 && sale.customerId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === sale.customerId
            ? { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - sale.remainingDue) }
            : c
        )
      );
    }

    // 3. Process cash refund if requested and paid
    const activeSession = getActiveCashSession(sale.warehouseId);
    if (params.refundCash && sale.totalPaid > 0 && activeSession) {
      const csmId = generateCashMovementId('CSM-REFUND');
      const refundMvt: CashMovement = {
        id: csmId,
        cashSessionId: activeSession.id,
        warehouseId: sale.warehouseId,
        date: nowIso,
        type: 'REMBOURSEMENT',
        method: 'ESPECES',
        amount: sale.totalPaid,
        isCashInDrawer: true,
        direction: 'OUT',
        reason: `Remboursement vente ${sale.receiptNumber}`,
        saleId: sale.id,
        customerId: sale.customerId,
        documentRef: `REFUND-${sale.receiptNumber}`,
        userId: currentUser.id,
        userName: currentUser.name,
        notes: params.reason,
      };

      setCashMovements((prev) => [refundMvt, ...prev]);
      setCashSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, theoreticalCash: Math.max(0, s.theoreticalCash - sale.totalPaid) }
            : s
        )
      );
    }

    // 4. Update sale record
    setSales((prev) =>
      prev.map((s) =>
        s.id === params.saleId
          ? {
              ...s,
              status: 'CANCELLED' as const,
              cancelledAt: nowIso,
              cancelledBy: currentUser.name,
              cancelledReason: params.reason.trim(),
              refundedAmount: params.refundCash ? sale.totalPaid : 0,
            }
          : s
      )
    );

    return { success: true };
  };

  // Operation: ENTRÉE DE STOCK
  const recordStockIn = (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
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
      const next = applyStockDelta(prev, params.articleId, params.warehouseId, params.quantity);
      const updatedStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.warehouseId);
      if (updatedStock) saveStockToFirebase(updatedStock).catch(console.warn);
      return next;
    });
    setMovements((prev) => [newMovement, ...prev]);
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
  };

  // Operation: SORTIE DE STOCK
  const recordStockOut = (params: {
    articleId: string;
    warehouseId: string;
    quantity: number;
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
      const next = applyStockDelta(prev, params.articleId, params.warehouseId, -params.quantity);
      const updatedStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.warehouseId);
      if (updatedStock) saveStockToFirebase(updatedStock).catch(console.warn);
      return next;
    });
    setMovements((prev) => [newMovement, ...prev]);
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
  };

  // Operation: TRANSFERT ENTRE MAGASINS
  const recordTransfer = (params: {
    articleId: string;
    sourceWarehouseId: string;
    targetWarehouseId: string;
    quantity: number;
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

    const sourceQty = getStockForArticleAndWarehouse(params.articleId, params.sourceWarehouseId);
    if (sourceQty < params.quantity) {
      return {
        success: false,
        error: `Stock insuffisant au départ de ${sourceWh.name}. Disponible : ${sourceQty}, demandé : ${params.quantity}.`,
      };
    }

    if (!params.documentRef.trim()) {
      return { success: false, error: 'Le numéro de bordereau de transfert est obligatoire.' };
    }

    const targetQty = getStockForArticleAndWarehouse(params.articleId, params.targetWarehouseId);
    const newSourceQty = sourceQty - params.quantity;
    const newTargetQty = targetQty + params.quantity;

    const newMvtId = generateMovementId();
    const newMovement: StockMovement = {
      id: newMvtId,
      date: new Date().toISOString(),
      type: 'TRANSFERT',
      articleId: params.articleId,
      quantity: params.quantity,
      sourceWarehouseId: params.sourceWarehouseId,
      targetWarehouseId: params.targetWarehouseId,
      userId: currentUser.id,
      userName: currentUser.name,
      documentRef: params.documentRef.trim(),
      reason: params.reason.trim() || `Transfert de ${sourceWh.code} vers ${targetWh.code}`,
      thirdParty: `${sourceWh.name} ➔ ${targetWh.name}`,
      unitPrice: article.purchasePrice,
      totalPrice: article.purchasePrice * params.quantity,
      stockBefore: sourceQty,
      stockAfter: newSourceQty,
      notes: params.notes?.trim(),
    };

    setStocks((prev) => {
      let next = applyStockDelta(prev, params.articleId, params.sourceWarehouseId, -params.quantity);
      next = applyStockDelta(next, params.articleId, params.targetWarehouseId, params.quantity);
      const sStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.sourceWarehouseId);
      const tStock = next.find((s) => s.articleId === params.articleId && s.warehouseId === params.targetWarehouseId);
      if (sStock) saveStockToFirebase(sStock).catch(console.warn);
      if (tStock) saveStockToFirebase(tStock).catch(console.warn);
      return next;
    });

    setMovements((prev) => [newMovement, ...prev]);
    saveMovementToFirebase(newMovement).catch(console.warn);

    return { success: true };
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

    const newId = generateArticleId(articles.length);
    const initialBrandOffers = articleData.brandOffers && articleData.brandOffers.length > 0
      ? articleData.brandOffers
      : [
          {
            id: `bo_${Date.now()}_init`,
            brand: articleData.brand || 'Générique',
            brandReference: articleData.mainReference,
            purchasePrice: articleData.purchasePrice || 0,
            salePrice: articleData.salePrice || 0,
            isDefault: true,
            ...(articleData.preferredSupplier ? { preferredSupplier: articleData.preferredSupplier } : {}),
            ...(articleData.barcode ? { barcode: articleData.barcode } : {}),
          },
        ];

    const newArticle: Article = {
      ...articleData,
      id: newId,
      brandOffers: initialBrandOffers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextArticles = [newArticle, ...articles];
    setArticles(nextArticles);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(nextArticles));

    const initialStocksForNewArticle: WarehouseStock[] = warehouses.map((w) => ({
      articleId: newId,
      warehouseId: w.id,
      quantity: 0,
      brandBreakdown: {},
      shelfLocation: articleData.defaultLocation,
    }));
    const nextStocks = [...stocks, ...initialStocksForNewArticle];
    setStocks(nextStocks);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(nextStocks));

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

    const updatedArticle = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const nextArticles = articles.map((a) => (a.id === id ? updatedArticle : a));
    setArticles(nextArticles);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(nextArticles));

    saveArticleToFirebase(updatedArticle).catch(console.warn);

    return { success: true };
  };

  // Delete single article (with audit & safety protection)
  const deleteArticle = (articleId: string): {
    success: boolean;
    error?: string;
    actionType: 'DELETED' | 'ARCHIVED';
    message: string;
  } => {
    // 1. Role verification: MAGASINIER cannot delete
    if (currentUser.role === 'MAGASINIER') {
      return {
        success: false,
        error: 'Droits insuffisants : les magasiniers ne sont pas autorisés à supprimer ou archiver des pièces du catalogue. Seul un Responsable ou Administrateur peut effectuer cette opération.',
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

    // 2. Check current physical stock across all warehouses
    const currentTotalStock = getTotalStockForArticle(articleId);

    // 3. Check historical records across modules:
    const hasSales = sales.some((s) => s.items.some((item) => item.articleId === articleId));
    const hasMovements = movements.some((m) => m.articleId === articleId);
    const hasInventories = inventories.some((inv) => inv.items.some((item) => item.articleId === articleId));
    const hasHistory = hasSales || hasMovements || hasInventories;

    // Safety rule: If article has history OR has non-zero stock, it MUST NOT be deleted permanently
    if (hasHistory || currentTotalStock > 0) {
      const updatedArticles = articles.map((a) =>
        a.id === articleId ? { ...a, status: 'archived' as const, updatedAt: new Date().toISOString() } : a
      );
      setArticles(updatedArticles);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(updatedArticles));

      const reason = currentTotalStock > 0
        ? `Le produit possède encore du stock disponible (${currentTotalStock} ${article.unit}).`
        : `Le produit est rattaché à un historique comptable (${hasSales ? 'ventes, ' : ''}${hasMovements ? 'mouvements, ' : ''}${hasInventories ? 'inventaires' : ''}).`;

      return {
        success: true,
        actionType: 'ARCHIVED',
        message: `${reason} Pour préserver l'intégrité comptable et légale, la fiche "${article.mainReference} - ${article.designation}" a été désactivée et archivée au lieu d'être détruite.`,
      };
    }

    // Otherwise: Article is brand new / unused and has 0 stock -> Safe to permanently delete
    const updatedArticles = articles.filter((a) => a.id !== articleId);
    const updatedStocks = stocks.filter((s) => s.articleId !== articleId);

    setArticles(updatedArticles);
    setStocks(updatedStocks);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(updatedArticles));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(updatedStocks));

    return {
      success: true,
      actionType: 'DELETED',
      message: `La pièce "${article.mainReference} - ${article.designation}" (sans historique ni stock) a été définitivement supprimée de la base de données.`,
    };
  };

  // Multiple deletion with safety rules
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

    let deletedCount = 0;
    let archivedCount = 0;
    let nextArticles = [...articles];
    let nextStocks = [...stocks];
    const nowIso = new Date().toISOString();

    for (const id of articleIds) {
      const article = nextArticles.find((a) => a.id === id);
      if (!article) continue;

      const currentTotalStock = nextStocks
        .filter((s) => s.articleId === id)
        .reduce((sum, s) => sum + s.quantity, 0);

      const hasSales = sales.some((s) => s.items.some((item) => item.articleId === id));
      const hasMovements = movements.some((m) => m.articleId === id);
      const hasInventories = inventories.some((inv) => inv.items.some((item) => item.articleId === id));
      const hasHistory = hasSales || hasMovements || hasInventories;

      if (hasHistory || currentTotalStock > 0) {
        // Archive to preserve traceability
        nextArticles = nextArticles.map((a) => (a.id === id ? { ...a, status: 'archived', updatedAt: nowIso } : a));
        archivedCount += 1;
      } else {
        // Safe permanent deletion
        nextArticles = nextArticles.filter((a) => a.id !== id);
        nextStocks = nextStocks.filter((s) => s.articleId !== id);
        deletedCount += 1;
      }
    }

    setArticles(nextArticles);
    setStocks(nextStocks);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(nextArticles));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(nextStocks));

    let msg = '';
    if (deletedCount > 0 && archivedCount > 0) {
      msg = `${deletedCount} produit(s) sans historique supprimé(s) définitivement, et ${archivedCount} produit(s) avec historique/stock archivé(s) pour préserver la traçabilité.`;
    } else if (deletedCount > 0) {
      msg = `${deletedCount} produit(s) sans historique définitivement supprimé(s) du catalogue.`;
    } else {
      msg = `${archivedCount} produit(s) avec historique ou stock archivé(s) avec succès.`;
    }

    return {
      success: true,
      deletedCount,
      archivedCount,
      message: msg,
    };
  };

  // Execute Catalog & Stock Import with full audit, strict single reference counting, and saturation protection
  const executeImport = (params: {
    mode: ImportMode;
    fileName: string;
    rows: ParsedImportRow[];
    targetWarehouseId: string;
    overwriteExistingStock?: boolean;
  }): { success: boolean; report: ImportResultReport; error?: string } => {
    const targetWh = warehouses.find((w) => w.id === params.targetWarehouseId);
    if (!targetWh) {
      return {
        success: false,
        error: 'Magasin sélectionné introuvable.',
        report: {
          timestamp: new Date().toISOString(),
          mode: params.mode,
          fileName: params.fileName,
          totalRows: params.rows.length,
          uniqueReferencesCount: 0,
          brandOffersCreatedCount: 0,
          createdArticles: 0,
          updatedArticles: 0,
          skippedArticles: 0,
          rejectedRows: params.rows.length,
          createdMovements: 0,
          positiveStockEntriesCount: 0,
          totalQuantityImported: 0,
          errors: ['Magasin de destination invalide.'],
          rejectedDetails: [],
        },
      };
    }

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
      if (row.warehouseId && warehouses.some((w) => w.id === row.warehouseId)) {
        return row.warehouseId;
      }
      if (row.warehouseName) {
        const found = warehouses.find(
          (w) =>
            w.name.toLowerCase().trim() === row.warehouseName!.toLowerCase().trim() ||
            w.code.toLowerCase().trim() === row.warehouseName!.toLowerCase().trim()
        );
        if (found) return found.id;
      }
      return targetWh.id;
    };

    // 3. Process each unique reference strictly ONCE
    for (const [normRef, rowsForRef] of groupsByRef.entries()) {
      // Find if master article already exists in catalog (by mainReference or equivalent cross-references)
      const existingIndex = nextArticles.findIndex(
        (a) =>
          normalizeRef(a.mainReference) === normRef ||
          a.equivalentReferences?.some((eq) => normalizeRef(eq) === normRef)
      );
      const existing = existingIndex !== -1 ? nextArticles[existingIndex] : null;

      // Extract consolidated metadata for this reference from the group
      const masterRow = rowsForRef[0];
      const masterReference = masterRow.mainReference.trim();
      const bestDesignation = rowsForRef.find((r) => r.designation?.trim())?.designation?.trim() || masterRow.designation.trim();
      const bestCategory = rowsForRef.find((r) => r.category)?.category || masterRow.category || 'Filtration';
      const bestLocation = rowsForRef.find((r) => r.physicalLocation && r.physicalLocation !== 'Non renseigné')?.physicalLocation || masterRow.physicalLocation || 'Non renseigné';
      const bestMinThreshold = rowsForRef.find((r) => r.minStockThreshold !== undefined && r.minStockThreshold >= 0)?.minStockThreshold ?? 2;
      const bestRack = rowsForRef.find((r) => r.rack?.trim())?.rack?.trim();
      const bestShelf = rowsForRef.find((r) => r.shelf?.trim())?.shelf?.trim();
      const bestBin = rowsForRef.find((r) => r.bin?.trim())?.bin?.trim();
      const bestSupplier = rowsForRef.find((r) => r.preferredSupplier?.trim())?.preferredSupplier?.trim();
      const bestBarcode = rowsForRef.find((r) => r.barcode?.trim())?.barcode?.trim();
      const bestImageUrl = rowsForRef.find((r) => r.imageUrl?.trim())?.imageUrl?.trim();

      // Collect all unique cross-references
      const mergedEquivalentsSet = new Set<string>();
      if (existing?.equivalentReferences) {
        existing.equivalentReferences.forEach((eq) => mergedEquivalentsSet.add(eq.trim()));
      }
      for (const r of rowsForRef) {
        if (r.equivalentReferences) {
          r.equivalentReferences.forEach((eq) => mergedEquivalentsSet.add(eq.trim()));
        }
      }
      const allEquivalents = Array.from(mergedEquivalentsSet).filter(Boolean);

      // Consolidate brand variables & quantities for this reference
      interface BrandAccumulator {
        brandName: string;
        purchasePrice: number;
        salePrice: number;
        preferredSupplier?: string;
        barcode?: string;
        // Quantities aggregated by warehouseId
        warehouseQtys: Record<string, number>;
      }

      const brandMap = new Map<string, BrandAccumulator>();

      for (const r of rowsForRef) {
        const brandName = (r.brand || 'Générique').trim();
        const brandKey = brandName.toLowerCase();
        const whId = getRowWarehouseId(r);
        const qty = Math.max(0, Math.floor(r.initialQuantity ?? 0));

        if (!brandMap.has(brandKey)) {
          brandMap.set(brandKey, {
            brandName,
            purchasePrice: Math.max(0, r.purchasePrice || 0),
            salePrice: Math.max(0, r.salePrice || 0),
            preferredSupplier: r.preferredSupplier?.trim() || undefined,
            barcode: r.barcode?.trim() || undefined,
            warehouseQtys: { [whId]: qty },
          });
        } else {
          const acc = brandMap.get(brandKey)!;
          if (r.purchasePrice && r.purchasePrice > 0) acc.purchasePrice = r.purchasePrice;
          if (r.salePrice && r.salePrice > 0) acc.salePrice = r.salePrice;
          if (r.preferredSupplier?.trim()) acc.preferredSupplier = r.preferredSupplier.trim();
          if (r.barcode?.trim()) acc.barcode = r.barcode.trim();
          acc.warehouseQtys[whId] = (acc.warehouseQtys[whId] || 0) + qty;
        }
      }

      let activeArticle: Article;
      let hasNewBrandsForExisting = false;

      if (existing) {
        // --- CASE 1: EXISTING ARTICLE IN CATALOG ---
        const existingOffers: ArticleBrandOffer[] = existing.brandOffers && existing.brandOffers.length > 0
          ? [...existing.brandOffers]
          : [
              {
                id: `bo_${existing.id}_init`,
                brand: existing.brand || 'Générique',
                brandReference: existing.mainReference,
                purchasePrice: existing.purchasePrice,
                salePrice: existing.salePrice,
                preferredSupplier: existing.preferredSupplier,
                barcode: existing.barcode,
                isDefault: true,
              },
            ];

        for (const [bKey, acc] of brandMap.entries()) {
          const offerIdx = existingOffers.findIndex(
            (o) => o.brand.toLowerCase().trim() === bKey
          );

          if (offerIdx === -1) {
            // New brand variable to attach to this existing article
            existingOffers.push({
              id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              brand: acc.brandName,
              brandReference: existing.mainReference,
              purchasePrice: acc.purchasePrice > 0 ? acc.purchasePrice : existing.purchasePrice,
              salePrice: acc.salePrice > 0 ? acc.salePrice : existing.salePrice,
              isDefault: false,
              ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
              ...(acc.barcode ? { barcode: acc.barcode } : {}),
            });
            report.brandOffersCreatedCount += 1;
            hasNewBrandsForExisting = true;
          } else if (params.mode === 'CATALOG_UPDATE' || params.mode === 'PRICING_UPDATE') {
            // Update pricing and details on existing offer
            existingOffers[offerIdx] = {
              ...existingOffers[offerIdx],
              purchasePrice: acc.purchasePrice > 0 ? acc.purchasePrice : existingOffers[offerIdx].purchasePrice,
              salePrice: acc.salePrice > 0 ? acc.salePrice : existingOffers[offerIdx].salePrice,
              ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
              ...(acc.barcode ? { barcode: acc.barcode } : {}),
            };
          }
        }

        const updatedArt: Article = {
          ...existing,
          designation: params.mode === 'CATALOG_UPDATE' && bestDesignation ? bestDesignation : existing.designation,
          category: params.mode === 'CATALOG_UPDATE' && bestCategory ? bestCategory : existing.category,
          minStockThreshold: params.mode === 'CATALOG_UPDATE' && bestMinThreshold !== undefined ? bestMinThreshold : existing.minStockThreshold,
          equivalentReferences: allEquivalents,
          brandOffers: existingOffers,
          purchasePrice: existingOffers[0]?.purchasePrice ?? existing.purchasePrice,
          salePrice: existingOffers[0]?.salePrice ?? existing.salePrice,
          updatedAt: nowIso,
        };

        nextArticles[existingIndex] = updatedArt;
        activeArticle = updatedArt;
        report.updatedArticles += 1; // Strict single increment for this piece
      } else {
        // --- CASE 2: BRAND NEW ARTICLE IN CATALOG ---
        const newArtId = generateArticleId(nextArticles.length);
        const builtOffers: ArticleBrandOffer[] = Array.from(brandMap.values()).map((acc, idx) => ({
          id: `bo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          brand: acc.brandName,
          brandReference: masterReference,
          purchasePrice: acc.purchasePrice,
          salePrice: acc.salePrice,
          isDefault: idx === 0,
          ...(acc.preferredSupplier ? { preferredSupplier: acc.preferredSupplier } : {}),
          ...(acc.barcode ? { barcode: acc.barcode } : {}),
        }));

        report.brandOffersCreatedCount += builtOffers.length;

        const primaryOffer = builtOffers[0] || {
          id: `bo_${newArtId}_init`,
          brand: 'Générique',
          brandReference: masterReference,
          purchasePrice: 0,
          salePrice: 0,
          isDefault: true,
        };

        const newArt: Article = {
          id: newArtId,
          mainReference: masterReference,
          designation: bestDesignation,
          brand: primaryOffer.brand,
          category: bestCategory,
          compatibleMachines: [],
          equivalentReferences: allEquivalents,
          purchasePrice: primaryOffer.purchasePrice,
          salePrice: primaryOffer.salePrice,
          minStockThreshold: bestMinThreshold,
          brandOffers: builtOffers,
          defaultLocation: bestLocation,
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
        report.createdArticles += 1; // Strict single increment for this piece
      }

      // 4. Consolidate warehouse stocks & single movements per warehouse for this article
      // Group total quantities and brand breakdowns for each warehouse
      const allWarehouseIds = Array.from(new Set(warehouses.map((w) => w.id)));

      for (const whId of allWarehouseIds) {
        const whObj = warehouses.find((w) => w.id === whId) || targetWh;
        const brandQtysForWh: Record<string, number> = {};
        let totalQtyInThisWh = 0;

        for (const acc of brandMap.values()) {
          const q = acc.warehouseQtys[whId] || 0;
          if (q > 0) {
            brandQtysForWh[acc.brandName] = (brandQtysForWh[acc.brandName] || 0) + q;
            totalQtyInThisWh += q;
          }
        }

        const existingStockIdx = nextStocks.findIndex(
          (s) => s.articleId === activeArticle.id && s.warehouseId === whId
        );
        const currentStockQty = existingStockIdx !== -1 ? nextStocks[existingStockIdx].quantity : 0;

        if (existing) {
          // If existing article, only update stock if we have new brands or overwrite confirmed
          if (totalQtyInThisWh > 0 && (hasNewBrandsForExisting || params.overwriteExistingStock)) {
            const newTotalQty = currentStockQty + totalQtyInThisWh;

            if (existingStockIdx !== -1) {
              const mergedBreakdown = { ...(nextStocks[existingStockIdx].brandBreakdown || {}) };
              for (const [b, q] of Object.entries(brandQtysForWh)) {
                mergedBreakdown[b] = (mergedBreakdown[b] || 0) + q;
              }
              nextStocks[existingStockIdx] = {
                ...nextStocks[existingStockIdx],
                quantity: newTotalQty,
                brandBreakdown: mergedBreakdown,
              };
            } else {
              nextStocks.push({
                articleId: activeArticle.id,
                warehouseId: whId,
                quantity: totalQtyInThisWh,
                brandBreakdown: brandQtysForWh,
                shelfLocation: bestLocation || activeArticle.defaultLocation,
              });
            }

            // Create ONE consolidated movement for this warehouse
            const brandSummary = Object.entries(brandQtysForWh)
              .map(([b, q]) => `${b} (x${q})`)
              .join(', ');

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
              documentRef: `IMPORT-${new Date().getFullYear()}-${activeArticle.id.slice(-4).toUpperCase()}`,
              reason: `Entrée stock importation : ${brandSummary}`,
              thirdParty: bestSupplier || 'Import Fichier Excel/CSV',
              unitPrice: activeArticle.purchasePrice,
              totalPrice: activeArticle.purchasePrice * totalQtyInThisWh,
              stockBefore: currentStockQty,
              stockAfter: newTotalQty,
              notes: `Ajout groupé de ${totalQtyInThisWh} unité(s) pour la référence ${activeArticle.mainReference} (${brandSummary}) dans le magasin ${whObj.name}`,
            };

            nextMovements = [initMovement, ...nextMovements];
            report.createdMovements += 1;
            report.positiveStockEntriesCount += 1;
            report.totalQuantityImported += totalQtyInThisWh;
          } else if (!hasNewBrandsForExisting && totalQtyInThisWh === 0 && params.mode === 'INITIAL_IMPORT') {
            report.skippedArticles += 1;
          }
        } else {
          // Brand new article: initialize stock record
          nextStocks.push({
            articleId: activeArticle.id,
            warehouseId: whId,
            quantity: totalQtyInThisWh,
            brandBreakdown: brandQtysForWh,
            shelfLocation: bestLocation || activeArticle.defaultLocation,
          });

          if (totalQtyInThisWh > 0) {
            report.positiveStockEntriesCount += 1;
            report.totalQuantityImported += totalQtyInThisWh;

            const brandSummary = Object.entries(brandQtysForWh)
              .map(([b, q]) => `${b} (x${q})`)
              .join(', ');

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
              documentRef: `IMPORT-INIT-${new Date().getFullYear()}-${activeArticle.id.slice(-4).toUpperCase()}`,
              reason: `Stock initial importé : ${brandSummary}`,
              thirdParty: bestSupplier || 'Import Fichier Excel/CSV',
              unitPrice: activeArticle.purchasePrice,
              totalPrice: activeArticle.purchasePrice * totalQtyInThisWh,
              stockBefore: 0,
              stockAfter: totalQtyInThisWh,
              notes: `Création initiale de ${totalQtyInThisWh} unité(s) (${brandSummary}) pour la référence ${activeArticle.mainReference} dans le magasin ${whObj.name}`,
            };

            nextMovements = [initMovement, ...nextMovements];
            report.createdMovements += 1;
          }
        }
      }
    }

    setArticles(nextArticles);
    setStocks(nextStocks);
    setMovements(nextMovements);

    // Synchronously write to localStorage to ensure immediate persistence across reloads
    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(nextArticles));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(nextStocks));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(nextMovements));

    // Automatically persist to Firebase Cloud Firestore in background
    uploadAllToFirebase({
      articles: nextArticles,
      warehouses,
      stocks: nextStocks,
      movements: nextMovements,
      customers,
      sales,
      payments,
      cashSessions,
      cashMovements,
      inventories,
      suppliers,
      supplierOrders,
      quotes,
    }).catch((err) => {
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

    const newStocks: WarehouseStock[] = articles.map((a) => ({
      articleId: a.id,
      warehouseId: newId,
      quantity: 0,
      shelfLocation: a.defaultLocation,
    }));
    setStocks((prev) => [...prev, ...newStocks]);

    return { success: true, warehouse: newWarehouse };
  };

  const updateWarehouse = (id: string, updates: Partial<Warehouse>) => {
    setWarehouses((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
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

    const totalStock = stocks
      .filter((s) => s.warehouseId === warehouseId)
      .reduce((sum, s) => sum + s.quantity, 0);

    if (totalStock > 0) {
      return {
        success: false,
        error: `Le magasin "${warehouse.name}" contient encore ${totalStock.toLocaleString('fr-FR')} pièce(s) en stock physique. Veuillez transférer ou sortir ce stock avant de supprimer le magasin.`,
        actionType: 'DELETED',
        message: 'Stock non nul',
      };
    }

    const hasMovements = movements.some(
      (m) => m.sourceWarehouseId === warehouseId || m.targetWarehouseId === warehouseId
    );
    const hasSales = sales.some((s) => s.warehouseId === warehouseId);
    const hasInventories = inventories.some((inv) => inv.warehouseId === warehouseId);
    const hasSupplierOrders = (supplierOrders || []).some((so) => so.targetWarehouseId === warehouseId);
    const hasHistory = hasMovements || hasSales || hasInventories || hasSupplierOrders;

    if (hasHistory) {
      const nextWarehouses = warehouses.map((w) =>
        w.id === warehouseId
          ? {
              ...w,
              isActive: false,
              notes: (w.notes ? `${w.notes} | ` : '') + `[Magasin désactivé le ${new Date().toLocaleDateString('fr-FR')} par ${currentUser.name}]`,
            }
          : w
      );
      setWarehouses(nextWarehouses);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(nextWarehouses));

      if (selectedWarehouseId === warehouseId) {
        setSelectedWarehouseId(null);
      }

      return {
        success: true,
        actionType: 'ARCHIVED',
        message: `Le magasin "${warehouse.name}" possède un historique d'opérations (ventes, mouvements ou inventaires). Il a été archivé et désactivé afin de préserver l'intégrité comptable et les statistiques.`,
      };
    } else {
      const nextWarehouses = warehouses.filter((w) => w.id !== warehouseId);
      const nextStocks = stocks.filter((s) => s.warehouseId !== warehouseId);

      setWarehouses(nextWarehouses);
      setStocks(nextStocks);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(nextWarehouses));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(nextStocks));

      if (selectedWarehouseId === warehouseId) {
        setSelectedWarehouseId(null);
      }

      return {
        success: true,
        actionType: 'DELETED',
        message: `Le magasin "${warehouse.name}" a été définitivement supprimé.`,
      };
    }
  };

  // Inventory Management
  const createInventorySession = (warehouseId: string, notes?: string) => {
    const wh = warehouses.find((w) => w.id === warehouseId);
    if (!wh) return { success: false, error: 'Magasin sélectionné invalide.' };

    const activeDraft = inventories.find(
      (inv) => inv.warehouseId === warehouseId && (inv.status === 'DRAFT' || inv.status === 'COUNTING')
    );
    if (activeDraft) {
      return {
        success: false,
        error: `Une session d'inventaire est déjà en cours pour ce magasin (${activeDraft.code}). Veuillez la terminer ou l'annuler d'abord.`,
      };
    }

    const sessionCode = `INV-${wh.code}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const items: InventorySession['items'] = articles.map((art) => {
      const theoQty = getStockForArticleAndWarehouse(art.id, warehouseId);
      return {
        articleId: art.id,
        theoreticalQty: theoQty,
        countedQty: null,
        variance: 0,
        unitCost: art.purchasePrice,
        varianceValue: 0,
      };
    });

    const newSession: InventorySession = {
      id: `INV-${Date.now()}`,
      warehouseId,
      code: sessionCode,
      date: new Date().toISOString().slice(0, 10),
      status: 'COUNTING',
      supervisor: currentUser.name,
      createdAt: new Date().toISOString(),
      notes,
      items,
    };

    setInventories((prev) => [newSession, ...prev]);
    return { success: true, session: newSession };
  };

  const updateInventoryCount = (
    sessionId: string,
    articleId: string,
    countedQty: number | null,
    notes?: string
  ) => {
    setInventories((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId || session.status === 'VALIDATED') return session;

        const updatedItems = session.items.map((item) => {
          if (item.articleId !== articleId) return item;
          const variance = countedQty !== null ? countedQty - item.theoreticalQty : 0;
          const varianceValue = variance * item.unitCost;
          return {
            ...item,
            countedQty,
            variance,
            varianceValue,
            notes: notes !== undefined ? notes : item.notes,
          };
        });

        return {
          ...session,
          items: updatedItems,
        };
      })
    );
  };

  const validateInventorySession = (sessionId: string) => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session d’inventaire introuvable.' };
    if (session.status === 'VALIDATED') return { success: false, error: 'Cette session est déjà validée et verrouillée.' };

    const uncounted = session.items.filter((it) => it.countedQty === null);
    if (uncounted.length > 0) {
      return {
        success: false,
        error: `Il reste ${uncounted.length} article(s) non compté(s). Veuillez renseigner leur comptage physique (ou saisir 0 si absent).`,
      };
    }

    const wh = warehouses.find((w) => w.id === session.warehouseId);
    if (!wh) return { success: false, error: 'Magasin associé introuvable.' };

    const adjustmentMovements: StockMovement[] = [];
    const updatedStocks = [...stocks];

    session.items.forEach((item) => {
      if (item.variance !== 0 && item.countedQty !== null) {
        const art = articles.find((a) => a.id === item.articleId);
        if (!art) return;

        const currentQty = getStockForArticleAndWarehouse(item.articleId, session.warehouseId);
        const adjustmentMvt: StockMovement = {
          id: generateMovementId(),
          date: new Date().toISOString(),
          type: 'AJUSTEMENT',
          articleId: item.articleId,
          quantity: Math.abs(item.variance),
          targetWarehouseId: session.warehouseId,
          userId: currentUser.id,
          userName: currentUser.name,
          documentRef: `PV-${session.code}`,
          reason: `Ajustement d'inventaire (${item.variance > 0 ? '+' : ''}${item.variance} ${art.unit})`,
          thirdParty: `Commission Inventaire - ${wh.name}`,
          unitPrice: item.unitCost,
          totalPrice: Math.abs(item.varianceValue),
          stockBefore: currentQty,
          stockAfter: item.countedQty,
          notes: item.notes || `Régularisation session ${session.code}`,
        };

        adjustmentMovements.push(adjustmentMvt);

        const stockIdx = updatedStocks.findIndex(
          (s) => s.articleId === item.articleId && s.warehouseId === session.warehouseId
        );
        if (stockIdx >= 0) {
          updatedStocks[stockIdx] = {
            ...updatedStocks[stockIdx],
            quantity: item.countedQty,
            lastInventoryDate: new Date().toISOString(),
          };
        } else {
          updatedStocks.push({
            articleId: item.articleId,
            warehouseId: session.warehouseId,
            quantity: item.countedQty,
            lastInventoryDate: new Date().toISOString(),
          });
        }
      }
    });

    setStocks(updatedStocks);
    setMovements((prev) => [...adjustmentMovements, ...prev]);

    setInventories((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'VALIDATED' as const,
              validatedAt: new Date().toISOString(),
              validatedBy: currentUser.name,
            }
          : s
      )
    );

    return { success: true };
  };

  const cancelInventorySession = (sessionId: string) => {
    const session = inventories.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: 'Session introuvable.' };
    if (session.status === 'VALIDATED') {
      return { success: false, error: 'Impossible d’annuler une session déjà validée.' };
    }

    setInventories((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'CANCELLED' as const } : s))
    );
    return { success: true };
  };

  // Supplier & PO Management
  const createSupplierOrder = (params: {
    supplierName: string;
    supplierContact?: string;
    supplierEmail?: string;
    targetWarehouseId: string;
    items: Array<{
      articleId: string;
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
      const brand = art?.brand || '';
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
      status: 'TO_ORDER',
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
    return { success: true, order: newOrder };
  };

  const updateSupplierOrderStatus = (orderId: string, status: SupplierOrderStatus) => {
    const existing = supplierOrders.find((o) => o.id === orderId);
    if (!existing) return { success: false, error: 'Commande introuvable.' };

    const updates: Partial<SupplierOrder> = { status };
    if (status === 'ORDERED' && !existing.orderedAt) {
      updates.orderedAt = new Date().toISOString();
    }

    setSupplierOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
    return { success: true };
  };

  const receiveSupplierOrder = (params: {
    orderId: string;
    itemsReceived: Array<{
      itemId: string;
      quantityReceivedNow: number;
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
      if (qtyNow > 0) {
        const currentQtyInWh = getStockForArticleAndWarehouse(item.articleId, wh.id);
        const newQtyInWh = currentQtyInWh + qtyNow;

        // Apply delta to stocks
        updatedStocks = applyStockDelta(updatedStocks, item.articleId, wh.id, qtyNow);

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
          reason: `Réception bon de commande ${order.orderNumber} (${order.supplierName})`,
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

    setSupplierOrders((prev) =>
      prev.map((o) =>
        o.id === params.orderId
          ? {
              ...o,
              status: newStatus,
              items: updatedItems,
              lastReceivedAt: nowIso,
            }
          : o
      )
    );

    // Save immediately to localStorage
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(updatedStocks));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify([...newMovements, ...movements]));

    return { success: true };
  };

  const cancelSupplierOrder = (orderId: string, reason?: string) => {
    const order = supplierOrders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Commande introuvable.' };
    if (order.status === 'RECEIVED') {
      return { success: false, error: 'Impossible d\'annuler une commande déjà intégralement réceptionnée.' };
    }

    setSupplierOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'CANCELLED' as const,
              cancelledAt: new Date().toISOString(),
              cancelledReason: reason || 'Annulation manuelle par l\'utilisateur',
            }
          : o
      )
    );
    return { success: true };
  };

  const createSupplier = (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    const id = generateSupplierId(suppliers.length);
    const newSupplier: Supplier = {
      ...supplierData,
      id,
      createdAt: new Date().toISOString(),
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    return { success: true, supplier: newSupplier };
  };

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
    return { success: true, quote: newQuote };
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status } : q)));
    return { success: true };
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
    setQuotes((prev) =>
      prev.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              status: 'CONVERTED' as const,
              convertedSaleId: saleRes.sale?.id,
            }
          : q
      )
    );

    return { success: true, saleId: saleRes.sale?.id };
  };

  // Reset to initial demo data
  const resetToDemoData = () => {
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

    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify(INITIAL_ARTICLES));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(INITIAL_WAREHOUSES));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify(INITIAL_WAREHOUSE_STOCKS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify(INITIAL_MOVEMENTS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify(INITIAL_INVENTORIES));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify(INITIAL_CUSTOMERS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify(INITIAL_SALES));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify(INITIAL_CASH_SESSIONS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify(INITIAL_CASH_MOVEMENTS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(INITIAL_SUPPLIERS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify(INITIAL_SUPPLIER_ORDERS));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify(INITIAL_QUOTES));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'user', JSON.stringify(INITIAL_USERS[0]));
  };

  // Table Rase : remise à zéro complète de la base pour exploitation
  const clearAllData = async (options?: { keepWarehouses?: boolean }) => {
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

    localStorage.setItem(STORAGE_KEY_PREFIX + 'articles', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'stocks', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'movements', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'inventories', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'customers', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sales', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'payments', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_sessions', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cash_movements', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'supplier_orders', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'quotes', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'warehouses', JSON.stringify(nextWh));

    // Supprimer également toutes les données correspondantes dans Cloud Firestore
    try {
      await wipeAllFromFirebase(options);
    } catch (err) {
      console.warn('Avertissement lors de la purge Cloud Firestore pendant Table Rase:', err);
    }
  };

  // Export full DB as JSON backup
  const exportDatabaseJson = () => {
    const dump = {
      exportDate: new Date().toISOString(),
      version: '2.0-sales-cash-purchases',
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
      users,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipstock_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date().toISOString(),
    };

    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(nextUsers));

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
    localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(nextUsers));

    if (currentUser.id === userId) {
      setCurrentUser(updated);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'user', JSON.stringify(updated));
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

    const nextUsers = users.filter((u) => u.id !== userId);
    setUsers(nextUsers);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(nextUsers));

    try {
      await deleteUserFromFirebase(userId);
    } catch (err) {
      console.warn('Erreur suppression utilisateur Firebase:', err);
    }

    return { success: true };
  };

  const hasPermission = (allowedRoles: UserRole[]): boolean => {
    if (currentUser.role === 'ADMIN') return true;
    return allowedRoles.includes(currentUser.role);
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Erreur connexion Google:', err);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmail(email, pass);
    } catch (err) {
      console.error('Erreur connexion Email:', err);
      throw err;
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string, role: UserRole = 'MAGASINIER') => {
    try {
      const res = await signUpWithEmail(email, pass);
      const isSuperAdmin = email.toLowerCase() === 'westjunior0805@gmail.com';
      const newProfile: UserProfile = {
        id: `usr_${Date.now()}`,
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        role: isSuperAdmin ? 'ADMIN' : role,
        firebaseUid: res.user.uid,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      await addUser(newProfile);
      setCurrentUser(newProfile);
    } catch (err) {
      console.error('Erreur inscription email:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setFirebaseUser(null);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
      throw err;
    }
  };

  const loadDataFromCloud = (cloudData: any) => {
    if (cloudData.articles && Array.isArray(cloudData.articles)) setArticles(sanitizeUniqueList(cloudData.articles));
    if (cloudData.warehouses && Array.isArray(cloudData.warehouses) && cloudData.warehouses.length > 0) setWarehouses(sanitizeUniqueList(cloudData.warehouses));
    if (cloudData.stocks && Array.isArray(cloudData.stocks)) setStocks(cloudData.stocks);
    if (cloudData.movements && Array.isArray(cloudData.movements)) setMovements(sanitizeUniqueList(cloudData.movements));
    if (cloudData.customers && Array.isArray(cloudData.customers)) setCustomers(sanitizeUniqueList(cloudData.customers));
    if (cloudData.sales && Array.isArray(cloudData.sales)) setSales(sanitizeUniqueList(cloudData.sales));
    if (cloudData.payments && Array.isArray(cloudData.payments)) setPayments(sanitizeUniqueList(cloudData.payments));
    if (cloudData.cashSessions && Array.isArray(cloudData.cashSessions)) setCashSessions(sanitizeUniqueList(cloudData.cashSessions));
    if (cloudData.cashMovements && Array.isArray(cloudData.cashMovements)) setCashMovements(sanitizeUniqueList(cloudData.cashMovements));
    if (cloudData.inventories && Array.isArray(cloudData.inventories)) setInventories(sanitizeUniqueList(cloudData.inventories));
    if (cloudData.suppliers && Array.isArray(cloudData.suppliers)) setSuppliers(sanitizeUniqueList(cloudData.suppliers));
    if (cloudData.supplierOrders && Array.isArray(cloudData.supplierOrders)) setSupplierOrders(sanitizeUniqueList(cloudData.supplierOrders));
    if (cloudData.quotes && Array.isArray(cloudData.quotes)) setQuotes(sanitizeUniqueList(cloudData.quotes));
  };

  return (
    <StockContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        firebaseUser,
        addUser,
        updateUser,
        deleteUser,
        hasPermission,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        selectedWarehouseId,
        setSelectedWarehouseId,
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
        createArticle,
        updateArticle,
        deleteArticle,
        deleteMultipleArticles,
        executeImport,
        createWarehouse,
        updateWarehouse,
        deleteWarehouse,
        createInventorySession,
        updateInventoryCount,
        validateInventorySession,
        cancelInventorySession,
        createCustomer,
        updateCustomer,
        recordCustomerPayment,
        recordCustomerDebtPayment,
        recordSale,
        cancelOrRefundSale,
        openCashSession,
        closeCashSession,
        recordCashExpense,
        createSupplierOrder,
        updateSupplierOrderStatus,
        receiveSupplierOrder,
        cancelSupplierOrder,
        createSupplier,
        createQuote,
        updateQuoteStatus,
        convertQuoteToSale,
        resetToDemoData,
        clearAllData,
        exportDatabaseJson,
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
