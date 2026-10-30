import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, testFirestoreConnection, isQuotaExceeded, setQuotaExceededFlag } from '../firebase';
import {
  Article,
  Warehouse,
  WarehouseStock,
  StockMovement,
  Customer,
  Sale,
  PaymentRecord,
  CashSession,
  CashMovement,
  InventorySession,
  Supplier,
  SupplierOrder,
  Quote,
  UserProfile,
} from '../types';
import { compressBase64Image } from '../utils/imageCompressor';

export { testFirestoreConnection };

export interface FirebaseSyncStats {
  articles: number;
  warehouses: number;
  stocks: number;
  movements: number;
  customers: number;
  sales: number;
  payments: number;
  cashSessions: number;
  cashMovements: number;
  suppliers: number;
  supplierOrders: number;
  quotes: number;
}

function isPlainObject(val: any): boolean {
  if (val === null || typeof val !== 'object') return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => cleanForFirestore(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (!isPlainObject(data)) {
    return data;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      const cleanedVal = cleanForFirestore(val);
      if (cleanedVal !== undefined) {
        clean[key] = cleanedVal;
      }
    }
  }
  return clean as T;
}

function cleanPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  return cleanForFirestore(obj) || {};
}


// High-performance batch committer (groups up to 450 writes per network round-trip)
async function commitBatchChunks(entries: { collection: string; id: string; data: any }[]): Promise<number> {
  if (entries.length === 0 || isQuotaExceeded()) return 0;
  const BATCH_SIZE = 400;
  let count = 0;
  try {
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      if (isQuotaExceeded()) break;
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, item.collection, item.id), item.data);
      }
      await batch.commit();
      count += chunk.length;
    }
  } catch (err: any) {
    if (err?.message?.includes('resource-exhausted') || err?.code === 'resource-exhausted') {
      setQuotaExceededFlag(true);
      console.warn('⚡ Quota Cloud Firestore dépassé : désactivation préventive des écritures réseau.');
    } else {
      handleFirestoreError(err, OperationType.WRITE, 'batch');
    }
  }
  return count;
}

export async function uploadAllToFirebase(data: {
  articles: Article[];
  warehouses: Warehouse[];
  stocks: WarehouseStock[];
  movements: StockMovement[];
  customers: Customer[];
  sales: Sale[];
  payments: PaymentRecord[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  inventories: InventorySession[];
  suppliers: Supplier[];
  supplierOrders: SupplierOrder[];
  quotes: Quote[];
}): Promise<FirebaseSyncStats> {
  const stats: FirebaseSyncStats = {
    articles: 0,
    warehouses: 0,
    stocks: 0,
    movements: 0,
    customers: 0,
    sales: 0,
    payments: 0,
    cashSessions: 0,
    cashMovements: 0,
    suppliers: 0,
    supplierOrders: 0,
    quotes: 0,
  };

  if (isQuotaExceeded()) {
    console.warn('⚡ Quota Cloud Firestore dépassé : annulation de l’envoi groupé.');
    return stats;
  }

  try {
    const allEntries: { collection: string; id: string; data: any }[] = [];

    // 1. Articles with image compression
    for (const art of data.articles) {
      let finalArticle = { ...art };
      if (finalArticle.imageUrl && finalArticle.imageUrl.startsWith('data:image/')) {
        finalArticle.imageUrl = await compressBase64Image(finalArticle.imageUrl, 480, 480, 0.7);
        if (finalArticle.imageUrl.length > 400000) {
          finalArticle.imageUrl = await compressBase64Image(finalArticle.imageUrl, 320, 320, 0.5);
        }
        if (finalArticle.imageUrl.length > 700000) {
          delete (finalArticle as any).imageUrl;
        }
      }
      allEntries.push({
        collection: 'articles',
        id: art.id,
        data: {
          ...cleanPayload(finalArticle),
          syncedAt: serverTimestamp(),
        },
      });
      stats.articles++;
    }

    // 2. Warehouses
    for (const wh of data.warehouses) {
      allEntries.push({
        collection: 'warehouses',
        id: wh.id,
        data: {
          ...cleanPayload(wh),
          syncedAt: serverTimestamp(),
        },
      });
      stats.warehouses++;
    }

    // 3. Stocks
    for (const st of data.stocks) {
      const stockKey = `${st.articleId}_${st.warehouseId}`;
      allEntries.push({
        collection: 'stocks',
        id: stockKey,
        data: {
          ...cleanPayload(st),
          syncedAt: serverTimestamp(),
        },
      });
      stats.stocks++;
    }

    // 4. Movements
    for (const mvt of data.movements) {
      allEntries.push({
        collection: 'movements',
        id: mvt.id,
        data: {
          ...cleanPayload(mvt),
          syncedAt: serverTimestamp(),
        },
      });
      stats.movements++;
    }

    // 5. Customers
    for (const cust of data.customers) {
      allEntries.push({
        collection: 'customers',
        id: cust.id,
        data: {
          ...cleanPayload(cust),
          syncedAt: serverTimestamp(),
        },
      });
      stats.customers++;
    }

    // 6. Sales
    for (const sale of data.sales) {
      allEntries.push({
        collection: 'sales',
        id: sale.id,
        data: {
          ...cleanPayload(sale),
          syncedAt: serverTimestamp(),
        },
      });
      stats.sales++;
    }

    // 7. Payments
    for (const pay of data.payments) {
      allEntries.push({
        collection: 'payments',
        id: pay.id,
        data: {
          ...cleanPayload(pay),
          syncedAt: serverTimestamp(),
        },
      });
      stats.payments++;
    }

    // 8. Cash Sessions
    for (const cs of data.cashSessions) {
      allEntries.push({
        collection: 'cashSessions',
        id: cs.id,
        data: {
          ...cleanPayload(cs),
          syncedAt: serverTimestamp(),
        },
      });
      stats.cashSessions++;
    }

    // 9. Cash Movements
    for (const cm of data.cashMovements) {
      allEntries.push({
        collection: 'cashMovements',
        id: cm.id,
        data: {
          ...cleanPayload(cm),
          syncedAt: serverTimestamp(),
        },
      });
      stats.cashMovements++;
    }

    // 10. Suppliers
    for (const supp of data.suppliers) {
      allEntries.push({
        collection: 'suppliers',
        id: supp.id,
        data: {
          ...cleanPayload(supp),
          syncedAt: serverTimestamp(),
        },
      });
      stats.suppliers++;
    }

    // 11. Supplier Orders
    for (const po of data.supplierOrders) {
      allEntries.push({
        collection: 'supplierOrders',
        id: po.id,
        data: {
          ...cleanPayload(po),
          syncedAt: serverTimestamp(),
        },
      });
      stats.supplierOrders++;
    }

    // 12. Quotes
    for (const quote of data.quotes) {
      allEntries.push({
        collection: 'quotes',
        id: quote.id,
        data: {
          ...cleanPayload(quote),
          syncedAt: serverTimestamp(),
        },
      });
      stats.quotes++;
    }

    // Commit all records in rapid atomic batches
    await commitBatchChunks(allEntries);

    return stats;
  } catch (err) {
    console.error('Erreur globale de synchronisation vers Firebase:', err);
    throw err;
  }
}

// --- Granular Real-Time Firebase Persistence Functions ---

export async function saveArticleToFirebase(art: Article): Promise<void> {
  const path = `articles/${art.id}`;
  try {
    let finalArticle = { ...art };
    if (finalArticle.imageUrl && finalArticle.imageUrl.startsWith('data:image/')) {
      finalArticle.imageUrl = await compressBase64Image(finalArticle.imageUrl, 480, 480, 0.7);
      if (finalArticle.imageUrl.length > 500000) {
        delete (finalArticle as any).imageUrl;
      }
    }
    await setDoc(doc(db, 'articles', art.id), {
      ...cleanPayload(finalArticle),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteArticleFromFirebase(articleId: string): Promise<void> {
  const path = `articles/${articleId}`;
  try {
    await deleteDoc(doc(db, 'articles', articleId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveStockToFirebase(st: WarehouseStock): Promise<void> {
  const stockKey = `${st.articleId}_${st.warehouseId}`;
  const path = `stocks/${stockKey}`;
  try {
    await setDoc(doc(db, 'stocks', stockKey), {
      ...cleanPayload(st),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveMultipleStocksToFirebase(stocksList: WarehouseStock[]): Promise<void> {
  try {
    const entries = stocksList.map((st) => ({
      collection: 'stocks',
      id: `${st.articleId}_${st.warehouseId}`,
      data: {
        ...cleanPayload(st),
        syncedAt: serverTimestamp(),
      },
    }));
    await commitBatchChunks(entries);
  } catch (err) {
    console.warn('Erreur sauvegarde stocks multiple vers Firebase:', err);
  }
}

export async function saveMovementToFirebase(mvt: StockMovement): Promise<void> {
  const path = `movements/${mvt.id}`;
  try {
    await setDoc(doc(db, 'movements', mvt.id), {
      ...cleanPayload(mvt),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveWarehouseToFirebase(wh: Warehouse): Promise<void> {
  const path = `warehouses/${wh.id}`;
  try {
    await setDoc(doc(db, 'warehouses', wh.id), {
      ...cleanPayload(wh),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteWarehouseFromFirebase(warehouseId: string): Promise<void> {
  const path = `warehouses/${warehouseId}`;
  try {
    await deleteDoc(doc(db, 'warehouses', warehouseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveCustomerToFirebase(cust: Customer): Promise<void> {
  const path = `customers/${cust.id}`;
  try {
    await setDoc(doc(db, 'customers', cust.id), {
      ...cleanPayload(cust),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCustomerFromFirebase(customerId: string): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveSaleToFirebase(sale: Sale): Promise<void> {
  const path = `sales/${sale.id}`;
  try {
    await setDoc(doc(db, 'sales', sale.id), {
      ...cleanPayload(sale),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function savePaymentToFirebase(pay: PaymentRecord): Promise<void> {
  const path = `payments/${pay.id}`;
  try {
    await setDoc(doc(db, 'payments', pay.id), {
      ...cleanPayload(pay),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCashSessionToFirebase(cs: CashSession): Promise<void> {
  const path = `cashSessions/${cs.id}`;
  try {
    await setDoc(doc(db, 'cashSessions', cs.id), {
      ...cleanPayload(cs),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCashMovementToFirebase(cm: CashMovement): Promise<void> {
  const path = `cashMovements/${cm.id}`;
  try {
    await setDoc(doc(db, 'cashMovements', cm.id), {
      ...cleanPayload(cm),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveSupplierToFirebase(supp: Supplier): Promise<void> {
  const path = `suppliers/${supp.id}`;
  try {
    await setDoc(doc(db, 'suppliers', supp.id), {
      ...cleanPayload(supp),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveSupplierOrderToFirebase(po: SupplierOrder): Promise<void> {
  const path = `supplierOrders/${po.id}`;
  try {
    await setDoc(doc(db, 'supplierOrders', po.id), {
      ...cleanPayload(po),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveQuoteToFirebase(quote: Quote): Promise<void> {
  const path = `quotes/${quote.id}`;
  try {
    await setDoc(doc(db, 'quotes', quote.id), {
      ...cleanPayload(quote),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveInventoryToFirebase(inv: InventorySession): Promise<void> {
  const path = `inventories/${inv.id}`;
  try {
    await setDoc(doc(db, 'inventories', inv.id), {
      ...cleanPayload(inv),
      syncedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Real-Time collection listener subscription helper
export function subscribeToCollection<T>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  if (isQuotaExceeded()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as T);
      onData(items);
    },
    (err: any) => {
      const msg = err?.message || String(err);
      if (msg.includes('resource-exhausted') || err?.code === 'resource-exhausted' || msg.includes('Quota limit exceeded')) {
        setQuotaExceededFlag(true);
        console.warn(`⚡ Quota Cloud Firestore dépassé pour ${collectionName}. Mode hors-ligne conservé.`);
      } else {
        console.warn(`Avis écoute temps-réel ${collectionName}:`, err);
      }
      if (onError) onError(err);
    }
  );
}

export async function downloadAllFromFirebase() {
  const result: {
    articles: Article[];
    warehouses: Warehouse[];
    stocks: WarehouseStock[];
    movements: StockMovement[];
    customers: Customer[];
    sales: Sale[];
    payments: PaymentRecord[];
    cashSessions: CashSession[];
    cashMovements: CashMovement[];
    inventories: InventorySession[];
    suppliers: Supplier[];
    supplierOrders: SupplierOrder[];
    quotes: Quote[];
  } = {
    articles: [],
    warehouses: [],
    stocks: [],
    movements: [],
    customers: [],
    sales: [],
    payments: [],
    cashSessions: [],
    cashMovements: [],
    inventories: [],
    suppliers: [],
    supplierOrders: [],
    quotes: [],
  };

  try {
    // Articles
    try {
      const snap = await getDocs(collection(db, 'articles'));
      result.articles = snap.docs.map((d) => d.data() as Article);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'articles');
    }

    // Warehouses
    try {
      const snap = await getDocs(collection(db, 'warehouses'));
      result.warehouses = snap.docs.map((d) => d.data() as Warehouse);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'warehouses');
    }

    // Stocks
    try {
      const snap = await getDocs(collection(db, 'stocks'));
      result.stocks = snap.docs.map((d) => d.data() as WarehouseStock);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'stocks');
    }

    // Movements
    try {
      const snap = await getDocs(collection(db, 'movements'));
      result.movements = snap.docs.map((d) => d.data() as StockMovement);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'movements');
    }

    // Customers
    try {
      const snap = await getDocs(collection(db, 'customers'));
      result.customers = snap.docs.map((d) => d.data() as Customer);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'customers');
    }

    // Sales
    try {
      const snap = await getDocs(collection(db, 'sales'));
      result.sales = snap.docs.map((d) => d.data() as Sale);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'sales');
    }

    // Payments
    try {
      const snap = await getDocs(collection(db, 'payments'));
      result.payments = snap.docs.map((d) => d.data() as PaymentRecord);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'payments');
    }

    // CashSessions
    try {
      const snap = await getDocs(collection(db, 'cashSessions'));
      result.cashSessions = snap.docs.map((d) => d.data() as CashSession);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'cashSessions');
    }

    // CashMovements
    try {
      const snap = await getDocs(collection(db, 'cashMovements'));
      result.cashMovements = snap.docs.map((d) => d.data() as CashMovement);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'cashMovements');
    }

    // Suppliers
    try {
      const snap = await getDocs(collection(db, 'suppliers'));
      result.suppliers = snap.docs.map((d) => d.data() as Supplier);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'suppliers');
    }

    // SupplierOrders
    try {
      const snap = await getDocs(collection(db, 'supplierOrders'));
      result.supplierOrders = snap.docs.map((d) => d.data() as SupplierOrder);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'supplierOrders');
    }

    // Quotes
    try {
      const snap = await getDocs(collection(db, 'quotes'));
      result.quotes = snap.docs.map((d) => d.data() as Quote);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'quotes');
    }

    return result;
  } catch (err) {
    console.error('Erreur téléchargement depuis Firebase:', err);
    throw err;
  }
}

export async function wipeAllFromFirebase(options?: { keepWarehouses?: boolean }): Promise<{ success: boolean; error?: string }> {
  const collectionsToWipe = [
    'articles',
    'stocks',
    'movements',
    'customers',
    'sales',
    'payments',
    'cashSessions',
    'cashMovements',
    'inventories',
    'suppliers',
    'supplierOrders',
    'quotes',
  ];

  if (!options?.keepWarehouses) {
    collectionsToWipe.push('warehouses');
  }

  let quotaBlocked = false;

  for (const colName of collectionsToWipe) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, colName, docSnap.id)));
        await Promise.all(deletePromises);
      }
    } catch (err: any) {
      console.warn(`Avertissement suppression collection Firestore ${colName}:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
        quotaBlocked = true;
      }
    }
  }

  if (quotaBlocked) {
    return {
      success: false,
      error: "La purge locale est 100% effectuée. Cependant, la suppression Cloud sur Firestore est bloquée car le quota quotidien gratuit Firebase est temporairement dépassé.",
    };
  }

  return { success: true };
}

export async function saveUserToFirebase(user: UserProfile) {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), {
      ...cleanPayload(user),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirebase(userId: string) {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function downloadUsersFromFirebase(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (err) {
    console.warn('Impossible de charger les utilisateurs depuis Firestore:', err);
    return [];
  }
}

