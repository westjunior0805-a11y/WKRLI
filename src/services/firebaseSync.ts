import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import {
  db,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
  isFirebaseSyncAllowed,
  isQuotaExceeded,
  isQuotaErrorObject,
  setQuotaExceededFlag,
} from '../firebase';
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
  SaleReturn,
  CompanyInfo,
  UserProfile,
} from '../types';

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
  returns?: number;
}

/**
 * Recursively strips undefined values from objects/arrays before writing to Firestore.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

async function commitBatchedItems<T>(
  collectionName: string,
  items: T[],
  getId: (item: T) => string,
  options?: { ignoreQuotaSkip?: boolean }
): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !items || items.length === 0) return;
  if (!options?.ignoreQuotaSkip && isQuotaExceeded()) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docId = getId(item);
      if (!docId) continue;
      const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      const ref = doc(db, collectionName, safeId);
      batch.set(ref, cleanForFirestore(item) as any, { merge: true });
    }
    await batch.commit();
  }
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
  returns?: SaleReturn[];
  companyInfo?: CompanyInfo;
}): Promise<FirebaseSyncStats> {
  if (!isFirebaseSyncAllowed()) {
    throw new Error(
      'Synchronisation Cloud bloquée dans Google AI Studio (réservée exclusivement à l’application déployée).'
    );
  }
  try {
    await Promise.all([
      commitBatchedItems('articles', data.articles, (a) => a.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('warehouses', data.warehouses, (w) => w.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('stocks', data.stocks, (s) => `${s.articleId}_${s.warehouseId}`, { ignoreQuotaSkip: true }),
      commitBatchedItems('movements', data.movements, (m) => m.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('customers', data.customers, (c) => c.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('sales', data.sales, (s) => s.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('payments', data.payments, (p) => p.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('cashSessions', data.cashSessions, (cs) => cs.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('cashMovements', data.cashMovements, (cm) => cm.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('inventories', data.inventories, (inv) => inv.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('suppliers', data.suppliers, (sup) => sup.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('supplierOrders', data.supplierOrders, (po) => po.id, { ignoreQuotaSkip: true }),
      commitBatchedItems('quotes', data.quotes, (q) => q.id, { ignoreQuotaSkip: true }),
      ...(Array.isArray(data.returns)
        ? [commitBatchedItems('returns', data.returns, (r) => r.id, { ignoreQuotaSkip: true })]
        : []),
      ...(data.companyInfo
        ? [saveCompanyInfoToFirebase(data.companyInfo)]
        : []),
    ]);
    setQuotaExceededFlag(false);
  } catch (err) {
    const info = handleFirestoreError(err, OperationType.WRITE, 'batch_upload');
    if (info.isQuotaExceeded || isQuotaErrorObject(err)) {
      throw new Error(
        'Quota quotidien gratuit Firebase (Cloud Firestore) dépassé (Quota exceeded). Vos données restent enregistrées en local et le quota gratuit se réinitialise demain.'
      );
    }
    throw err instanceof Error ? err : new Error(info.error);
  }

  return {
    articles: data.articles.length,
    warehouses: data.warehouses.length,
    stocks: data.stocks.length,
    movements: data.movements.length,
    customers: data.customers.length,
    sales: data.sales.length,
    payments: data.payments.length,
    cashSessions: data.cashSessions.length,
    cashMovements: data.cashMovements.length,
    suppliers: data.suppliers.length,
    supplierOrders: data.supplierOrders.length,
    quotes: data.quotes.length,
    returns: data.returns ? data.returns.length : 0,
  };
}

export async function saveArticleToFirebase(art: Article): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || isQuotaExceeded() || !art?.id) return;
  try {
    const safeId = art.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'articles', safeId), cleanForFirestore(art), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `articles/${art.id}`);
  }
}

export async function saveMultipleArticlesToFirebase(articlesList: Article[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || isQuotaExceeded() || !articlesList || articlesList.length === 0) return;
  try {
    await commitBatchedItems('articles', articlesList, (a) => a.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'articles/batch');
  }
}

export async function deleteArticleFromFirebase(articleId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !articleId) return;
  try {
    const safeId = articleId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'articles', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `articles/${articleId}`);
  }
}

export async function deleteStocksForArticleFromFirebase(
  articleId: string,
  warehouseIds: string[]
): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !articleId || !warehouseIds || warehouseIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const whId of warehouseIds) {
      const rawId = `${articleId}_${whId}`;
      const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      batch.delete(doc(db, 'stocks', safeId));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `stocks/${articleId}`);
  }
}

export async function deleteMovementsFromFirebase(movementIds: string[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !movementIds || movementIds.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < movementIds.length; i += CHUNK_SIZE) {
      const chunk = movementIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const mId of chunk) {
        if (!mId) continue;
        const safeId = mId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        batch.delete(doc(db, 'movements', safeId));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'movements/batch_delete');
  }
}

export async function saveStockToFirebase(st: WarehouseStock): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !st?.articleId || !st?.warehouseId) return;
  try {
    const rawId = `${st.articleId}_${st.warehouseId}`;
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'stocks', safeId), cleanForFirestore(st), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stocks/${st.articleId}_${st.warehouseId}`);
  }
}

export async function saveMultipleStocksToFirebase(stocksList: WarehouseStock[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !stocksList || stocksList.length === 0) return;
  try {
    await commitBatchedItems('stocks', stocksList, (s) => `${s.articleId}_${s.warehouseId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'stocks/batch');
  }
}

export async function saveMovementToFirebase(mvt: StockMovement): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || isQuotaExceeded() || !mvt?.id) return;
  try {
    const safeId = mvt.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'movements', safeId), cleanForFirestore(mvt), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `movements/${mvt.id}`);
  }
}

export async function saveMultipleMovementsToFirebase(movementsList: StockMovement[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || isQuotaExceeded() || !movementsList || movementsList.length === 0) return;
  try {
    await commitBatchedItems('movements', movementsList, (m) => m.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'movements/batch');
  }
}

export async function saveWarehouseToFirebase(wh: Warehouse): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !wh?.id) return;
  try {
    const safeId = wh.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'warehouses', safeId), cleanForFirestore(wh), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `warehouses/${wh.id}`);
  }
}

export async function deleteWarehouseFromFirebase(warehouseId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !warehouseId) return;
  try {
    const safeId = warehouseId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'warehouses', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `warehouses/${warehouseId}`);
  }
}

export async function saveCustomerToFirebase(cust: Customer): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !cust?.id) return;
  try {
    const safeId = cust.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'customers', safeId), cleanForFirestore(cust), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `customers/${cust.id}`);
  }
}

export async function saveMultipleCustomersToFirebase(customersList: Customer[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !customersList || customersList.length === 0) return;
  try {
    await commitBatchedItems('customers', customersList, (c) => c.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'customers/batch');
  }
}

export async function deleteCustomerFromFirebase(customerId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !customerId) return;
  try {
    const safeId = customerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'customers', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `customers/${customerId}`);
  }
}

export async function saveSaleToFirebase(sale: Sale): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !sale?.id) return;
  try {
    const safeId = sale.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'sales', safeId), cleanForFirestore(sale), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sales/${sale.id}`);
  }
}

export async function deleteSaleFromFirebase(saleId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !saleId) return;
  try {
    const safeId = saleId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'sales', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sales/${saleId}`);
  }
}

export async function savePaymentToFirebase(pay: PaymentRecord): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !pay?.id) return;
  try {
    const safeId = pay.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'payments', safeId), cleanForFirestore(pay), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `payments/${pay.id}`);
  }
}

export async function deletePaymentsFromFirebase(paymentIds: string[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !paymentIds || paymentIds.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < paymentIds.length; i += CHUNK_SIZE) {
      const chunk = paymentIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        if (!id) continue;
        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        batch.delete(doc(db, 'payments', safeId));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'payments/batch_delete');
  }
}

export async function saveCashSessionToFirebase(cs: CashSession): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !cs?.id) return;
  try {
    const safeId = cs.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'cashSessions', safeId), cleanForFirestore(cs), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `cashSessions/${cs.id}`);
  }
}

export async function saveCashMovementToFirebase(cm: CashMovement): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !cm?.id) return;
  try {
    const safeId = cm.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'cashMovements', safeId), cleanForFirestore(cm), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `cashMovements/${cm.id}`);
  }
}

export async function deleteCashMovementsFromFirebase(movementIds: string[]): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !movementIds || movementIds.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < movementIds.length; i += CHUNK_SIZE) {
      const chunk = movementIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        if (!id) continue;
        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        batch.delete(doc(db, 'cashMovements', safeId));
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'cashMovements/batch_delete');
  }
}

export async function saveSupplierToFirebase(supp: Supplier): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !supp?.id) return;
  try {
    const safeId = supp.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'suppliers', safeId), cleanForFirestore(supp), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `suppliers/${supp.id}`);
  }
}

export async function deleteSupplierFromFirebase(supplierId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !supplierId) return;
  try {
    const safeId = supplierId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'suppliers', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `suppliers/${supplierId}`);
  }
}

export async function saveSupplierOrderToFirebase(po: SupplierOrder): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !po?.id) return;
  try {
    const safeId = po.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'supplierOrders', safeId), cleanForFirestore(po), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `supplierOrders/${po.id}`);
  }
}

export async function deleteSupplierOrderFromFirebase(orderId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !orderId) return;
  try {
    const safeId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'supplierOrders', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `supplierOrders/${orderId}`);
  }
}

export async function saveQuoteToFirebase(quote: Quote): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !quote?.id) return;
  try {
    const safeId = quote.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'quotes', safeId), cleanForFirestore(quote), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `quotes/${quote.id}`);
  }
}

export async function deleteQuoteFromFirebase(quoteId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !quoteId) return;
  try {
    const safeId = quoteId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'quotes', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `quotes/${quoteId}`);
  }
}

export async function saveInventoryToFirebase(inv: InventorySession): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !inv?.id) return;
  try {
    const safeId = inv.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'inventories', safeId), cleanForFirestore(inv), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `inventories/${inv.id}`);
  }
}

export async function saveReturnToFirebase(ret: SaleReturn): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !ret?.id) return;
  try {
    const safeId = ret.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'returns', safeId), cleanForFirestore(ret), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `returns/${ret.id}`);
  }
}

export async function deleteReturnFromFirebase(returnId: string): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !returnId) return;
  try {
    const safeId = returnId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'returns', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `returns/${returnId}`);
  }
}

export async function saveCompanyInfoToFirebase(info: CompanyInfo): Promise<void> {
  if (!db || !isFirebaseSyncAllowed() || !info) return;
  try {
    await setDoc(
      doc(db, 'companyInfo', 'main'),
      cleanForFirestore({ ...info, id: 'main', updatedAt: info.updatedAt || new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'companyInfo/main');
  }
}

export function subscribeToCollection<T>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!db || !isFirebaseSyncAllowed()) return () => {};
  try {
    return onSnapshot(
      collection(db, collectionName),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as T);
        onData(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, collectionName);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

async function fetchCollectionSafely<T>(
  collectionName: string,
  timeoutMs: number = 20000,
  options?: { rethrowQuotaError?: boolean }
): Promise<T[]> {
  if (!db || !isFirebaseSyncAllowed()) return [];
  try {
    const fetchPromise = getDocs(collection(db, collectionName)).then((snap) =>
      snap.docs.map((d) => d.data() as T)
    );
    const timeoutPromise = new Promise<T[]>((resolve) => {
      setTimeout(() => resolve([]), timeoutMs);
    });
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    const info = handleFirestoreError(err, OperationType.LIST, collectionName);
    if (options?.rethrowQuotaError && (info.isQuotaExceeded || isQuotaErrorObject(err))) {
      throw new Error(
        'Quota quotidien gratuit Firebase (Cloud Firestore) dépassé (Quota exceeded). Les lectures Cloud sont temporairement bloquées jusqu’à demain.'
      );
    }
    return [];
  }
}

export async function downloadAllFromFirebase() {
  if (!isFirebaseSyncAllowed()) {
    return {
      articles: [] as Article[],
      warehouses: [] as Warehouse[],
      stocks: [] as WarehouseStock[],
      movements: [] as StockMovement[],
      customers: [] as Customer[],
      sales: [] as Sale[],
      payments: [] as PaymentRecord[],
      cashSessions: [] as CashSession[],
      cashMovements: [] as CashMovement[],
      inventories: [] as InventorySession[],
      suppliers: [] as Supplier[],
      supplierOrders: [] as SupplierOrder[],
      quotes: [] as Quote[],
      returns: [] as SaleReturn[],
      companyInfoList: [] as CompanyInfo[],
      users: [] as UserProfile[],
    };
  }

  const [
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
    companyInfoList,
    users,
  ] = await Promise.all([
    fetchCollectionSafely<Article>('articles', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<Warehouse>('warehouses', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<WarehouseStock>('stocks', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<StockMovement>('movements', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<Customer>('customers', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<Sale>('sales', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<PaymentRecord>('payments', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<CashSession>('cashSessions', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<CashMovement>('cashMovements', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<InventorySession>('inventories', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<Supplier>('suppliers', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<SupplierOrder>('supplierOrders', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<Quote>('quotes', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<SaleReturn>('returns', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<CompanyInfo>('companyInfo', 20000, { rethrowQuotaError: true }),
    fetchCollectionSafely<UserProfile>('users', 20000, { rethrowQuotaError: true }),
  ]);

  return {
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
    companyInfoList,
    users,
  };
}

export async function wipeCollectionFromFirebase(
  collectionName: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  if (!db || !isFirebaseSyncAllowed() || !collectionName) return { success: true, deletedCount: 0 };
  try {
    const snap = await getDocs(collection(db, collectionName));
    const docs = snap.docs;
    let deletedCount = 0;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 400);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deletedCount += chunk.length;
    }
    return { success: true, deletedCount };
  } catch (err: any) {
    return {
      success: false,
      deletedCount: 0,
      error: err?.message || String(err),
    };
  }
}

export async function wipeAllFromFirebase(options?: {
  keepWarehouses?: boolean;
  wipeLegacyUsers?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  if (!db || !isFirebaseSyncAllowed()) return { success: true };
  try {
    const cols = [
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
      'returns',
    ];
    if (!options?.keepWarehouses) cols.push('warehouses');

    await Promise.all(cols.map((cName) => wipeCollectionFromFirebase(cName)));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function saveUserToFirebase(user: UserProfile): Promise<boolean> {
  if (!db || !isFirebaseSyncAllowed() || !user?.id) return false;
  try {
    const safeId = user.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await setDoc(doc(db, 'users', safeId), cleanForFirestore(user), { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    return false;
  }
}

export async function deleteUserFromFirebase(userId: string): Promise<boolean> {
  if (!db || !isFirebaseSyncAllowed() || !userId) return false;
  try {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    await deleteDoc(doc(db, 'users', safeId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    return false;
  }
}

export async function downloadUsersFromFirebase(): Promise<UserProfile[]> {
  return fetchCollectionSafely<UserProfile>('users');
}
