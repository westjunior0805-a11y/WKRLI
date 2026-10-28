import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, testFirestoreConnection } from '../firebase';
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

  try {
    // 1. Articles
    for (const art of data.articles) {
      const path = `articles/${art.id}`;
      try {
        let finalArticle = { ...art };
        if (finalArticle.imageUrl && finalArticle.imageUrl.startsWith('data:image/')) {
          finalArticle.imageUrl = await compressBase64Image(finalArticle.imageUrl, 480, 480, 0.7);
          // If still over 400KB, apply more aggressive compression
          if (finalArticle.imageUrl.length > 400000) {
            finalArticle.imageUrl = await compressBase64Image(finalArticle.imageUrl, 320, 320, 0.5);
          }
          // If still over 700KB, omit image to strictly respect Firestore's 1MB limit
          if (finalArticle.imageUrl.length > 700000) {
            console.warn(`Article image for ${art.id} too large, omitted from cloud payload.`);
            delete (finalArticle as any).imageUrl;
          }
        }
        await setDoc(doc(db, 'articles', art.id), {
          ...cleanPayload(finalArticle),
          syncedAt: serverTimestamp(),
        });
        stats.articles++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 2. Warehouses
    for (const wh of data.warehouses) {
      const path = `warehouses/${wh.id}`;
      try {
        await setDoc(doc(db, 'warehouses', wh.id), {
          ...cleanPayload(wh),
          syncedAt: serverTimestamp(),
        });
        stats.warehouses++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 3. Stocks
    for (const st of data.stocks) {
      const stockKey = `${st.articleId}_${st.warehouseId}`;
      const path = `stocks/${stockKey}`;
      try {
        await setDoc(doc(db, 'stocks', stockKey), {
          ...cleanPayload(st),
          syncedAt: serverTimestamp(),
        });
        stats.stocks++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 4. Movements
    for (const mvt of data.movements) {
      const path = `movements/${mvt.id}`;
      try {
        await setDoc(doc(db, 'movements', mvt.id), {
          ...cleanPayload(mvt),
          syncedAt: serverTimestamp(),
        });
        stats.movements++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 5. Customers
    for (const cust of data.customers) {
      const path = `customers/${cust.id}`;
      try {
        await setDoc(doc(db, 'customers', cust.id), {
          ...cleanPayload(cust),
          syncedAt: serverTimestamp(),
        });
        stats.customers++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 6. Sales
    for (const sale of data.sales) {
      const path = `sales/${sale.id}`;
      try {
        await setDoc(doc(db, 'sales', sale.id), {
          ...cleanPayload(sale),
          syncedAt: serverTimestamp(),
        });
        stats.sales++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 7. Payments
    for (const pay of data.payments) {
      const path = `payments/${pay.id}`;
      try {
        await setDoc(doc(db, 'payments', pay.id), {
          ...cleanPayload(pay),
          syncedAt: serverTimestamp(),
        });
        stats.payments++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 8. Cash Sessions
    for (const cs of data.cashSessions) {
      const path = `cashSessions/${cs.id}`;
      try {
        await setDoc(doc(db, 'cashSessions', cs.id), {
          ...cleanPayload(cs),
          syncedAt: serverTimestamp(),
        });
        stats.cashSessions++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 9. Cash Movements
    for (const cm of data.cashMovements) {
      const path = `cashMovements/${cm.id}`;
      try {
        await setDoc(doc(db, 'cashMovements', cm.id), {
          ...cleanPayload(cm),
          syncedAt: serverTimestamp(),
        });
        stats.cashMovements++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 10. Suppliers
    for (const supp of data.suppliers) {
      const path = `suppliers/${supp.id}`;
      try {
        await setDoc(doc(db, 'suppliers', supp.id), {
          ...cleanPayload(supp),
          syncedAt: serverTimestamp(),
        });
        stats.suppliers++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 11. Supplier Orders
    for (const po of data.supplierOrders) {
      const path = `supplierOrders/${po.id}`;
      try {
        await setDoc(doc(db, 'supplierOrders', po.id), {
          ...cleanPayload(po),
          syncedAt: serverTimestamp(),
        });
        stats.supplierOrders++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // 12. Quotes
    for (const quote of data.quotes) {
      const path = `quotes/${quote.id}`;
      try {
        await setDoc(doc(db, 'quotes', quote.id), {
          ...cleanPayload(quote),
          syncedAt: serverTimestamp(),
        });
        stats.quotes++;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    return stats;
  } catch (err) {
    console.error('Erreur globale de synchronisation vers Firebase:', err);
    throw err;
  }
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

export async function wipeAllFromFirebase(options?: { keepWarehouses?: boolean }) {
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

  for (const colName of collectionsToWipe) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, colName, docSnap.id)));
        await Promise.all(deletePromises);
      }
    } catch (err) {
      console.warn(`Avertissement suppression collection Firestore ${colName}:`, err);
    }
  }
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

