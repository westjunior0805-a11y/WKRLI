export type UserRole = 'ADMIN' | 'RESPONSABLE' | 'MAGASINIER';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  assignedWarehouseId?: string; // For MAGASINIER
  isActive?: boolean;
  phone?: string;
  avatarUrl?: string;
  firebaseUid?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  phone: string;
  manager: string;
  isActive: boolean;
  isDefault: boolean;
  notes?: string;
}

export type ArticleCategory =
  | 'Filtration'
  | 'Moteur & Refroidissement'
  | 'Système Injection & Carburant'
  | 'Train de Roulement & Chenilles'
  | 'Hydraulique & Vérins'
  | 'Freinage & Friction'
  | 'Électricité & Démarreurs'
  | 'Transmission & Ponts'
  | 'Outils d’Attaque au Sol (Dents/Lames)';

export interface ArticleBrandOffer {
  id: string; // Identifiant de l'offre ou nom de marque
  brand: string; // Ex: Caterpillar, Donaldson, Fleetguard, Komatsu, Bosch, etc.
  brandReference?: string; // Référence spécifique de ce fabricant si différente de la référence pivot
  purchasePrice: number; // En FCFA
  salePrice: number; // En FCFA
  preferredSupplier?: string;
  barcode?: string;
  isDefault?: boolean;
  notes?: string;
}

export interface Article {
  id: string;
  mainReference: string; // Référence constructeur / pivot principale (unique au catalogue)
  designation: string; // Nom de la pièce
  brand: string; // Marque principale / de référence (ex: Caterpillar ou Générique)
  category: ArticleCategory;
  compatibleMachines: string[]; // Ex: ["CAT 336D", "CAT 330D"]
  equivalentReferences: string[]; // Ex: ["Donaldson P551313", "Baldwin B7299", "LF3349"]
  purchasePrice: number; // En FCFA (prix de la marque principale)
  salePrice: number; // En FCFA (prix de la marque principale)
  minStockThreshold: number; // Seuil de réapprovisionnement minimal (global pour la pièce)
  brandOffers?: ArticleBrandOffer[]; // Grille multi-marques & constructeurs avec leurs prix respectifs
  defaultLocation: string; // Emplacement théorique (ex: Travée A - Étagère 03)
  rack?: string; // Rayonnage (ex: Rayonnage B)
  shelf?: string; // Étagère (ex: Étagère 03)
  bin?: string; // Case (ex: Case 12)
  warehouseLocation?: string; // Nom du magasin de référence pour l'emplacement
  preferredSupplier?: string; // Fournisseur habituel
  imageUrl?: string; // URL ou dataURI de l'image
  imageType?: 'REAL_PHOTO' | 'SUPPLIER_IMAGE' | 'AI_ILLUSTRATION'; // Origine de l'image
  unit: string; // Unité, Jeu, Paire, Kit, Fût 200L, Mètre
  barcode?: string;
  weightKg?: number;
  status: 'active' | 'archived';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStock {
  articleId: string;
  warehouseId: string;
  quantity: number; // Quantité physique totale courante dans ce magasin
  brandBreakdown?: Record<string, number>; // Détail physique par marque (ex: { "Caterpillar": 2, "Donaldson": 8 })
  shelfLocation?: string; // Emplacement spécifique dans ce magasin
  lastInventoryDate?: string;
}

export type MovementType = 'ENTREE' | 'SORTIE' | 'TRANSFERT' | 'AJUSTEMENT';

export interface StockMovement {
  id: string;
  date: string; // ISO string
  type: MovementType;
  articleId: string;
  quantity: number; // Toujours positif; l'effet dépend du type
  sourceWarehouseId?: string; // Obligatoire si SORTIE ou TRANSFERT
  targetWarehouseId?: string; // Obligatoire si ENTREE ou TRANSFERT
  userId: string;
  userName: string;
  documentRef: string; // N° Bon de livraison, Facture, Bon de sortie, Ordre de transfert, PV inventaire
  reason: string; // Motif d'opération
  thirdParty?: string; // Fournisseur ou Client / Bénéficiaire
  unitPrice?: number; // Prix unitaire FCFA appliqué
  totalPrice?: number; // Total FCFA
  stockBefore?: number; // Stock avant opération (magasin concerné)
  stockAfter?: number; // Stock après opération
  notes?: string;
}

export type InventoryStatus = 'DRAFT' | 'COUNTING' | 'VALIDATED' | 'CANCELLED';

export interface InventoryItemCount {
  articleId: string;
  theoreticalQty: number; // Stock théorique gelé
  countedQty: number | null; // Saisie du magasinier
  variance: number; // countedQty - theoreticalQty
  unitCost: number; // Prix achat FCFA
  varianceValue: number; // variance * unitCost
  notes?: string;
}

export interface InventorySession {
  id: string;
  warehouseId: string;
  code: string; // Ex: INV-DKR-2026-01
  date: string;
  status: InventoryStatus;
  supervisor: string;
  items: InventoryItemCount[];
  createdAt: string;
  validatedAt?: string;
  validatedBy?: string;
  notes?: string;
}

export interface StockAlert {
  articleId: string;
  mainReference: string;
  designation: string;
  brand: string;
  category: ArticleCategory;
  currentStock: number;
  minThreshold: number;
  deficit: number;
  alertType: 'RUPTURE' | 'SOUS_SEUIL';
  warehousesWithStock: { warehouseName: string; qty: number }[];
}

// ====================================================================
// MODULES VENTES, CLIENTS & CAISSE
// ====================================================================

export type PaymentMethod =
  | 'ESPECES'
  | 'WAVE'
  | 'ORANGE_MONEY'
  | 'VIREMENT'
  | 'CARTE'
  | 'CREDIT';

export interface Customer {
  id: string;
  code: string;
  name: string; // Nom ou raison sociale
  phone?: string;
  address?: string;
  email?: string;
  outstandingBalance: number; // Solde restant dû (créances clients)
  creditLimit?: number; // Plafond crédit
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  articleId: string;
  mainReference: string;
  designation: string;
  brand: string;
  unit: string;
  quantity: number;
  unitCost: number; // Coût d'achat (pour calcul marge)
  catalogUnitPrice: number; // Prix catalogue officiel
  unitPrice: number; // Prix unitaire appliqué
  discountPercent: number; // 0 à 100
  discountAmount: number; // En FCFA
  totalLine: number; // (quantity * unitPrice) - discountAmount
  isPriceOverridden?: boolean;
  overriddenReason?: string;
  selectedBrandOfferId?: string; // Id de l'offre marque sélectionnée
  brandReference?: string; // Référence spécifique de la marque vendue
}

export type SaleStatus = 'VALIDATED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface PaymentRecord {
  id: string;
  date: string;
  saleId?: string;
  customerId?: string;
  cashSessionId?: string;
  warehouseId: string;
  method: PaymentMethod;
  amount: number; // En FCFA
  userId: string;
  userName: string;
  reference?: string; // N° transaction Wave / Orange Money / Chèque
  notes?: string;
}

export interface Sale {
  id: string; // Ex: VTE-2026-0001
  receiptNumber: string; // Ex: REC-2026-0001
  date: string; // ISO
  warehouseId: string;
  warehouseName: string;
  userId: string;
  userName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number; // Avant remises
  totalDiscount: number;
  totalAmount: number; // Net à payer
  totalCost: number; // Coût d'achat global pour marge
  totalPaid: number; // Montant effectivement réglé
  remainingDue: number; // Solde dû = totalAmount - totalPaid
  paymentStatus: PaymentStatus;
  status: SaleStatus;
  notes?: string;
  cashSessionId?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;
  refundedAmount?: number;
}

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string; // Ex: CS-2026-0001
  warehouseId: string;
  warehouseName: string;
  openedAt: string;
  openedByUserId: string;
  openedByUserName: string;
  initialCashFloat: number; // Fond de caisse espèces en FCFA
  closedAt?: string;
  closedByUserId?: string;
  closedByUserName?: string;
  status: CashSessionStatus;
  countedCash: number | null; // Montant espèces compté lors de la clôture
  theoreticalCash: number; // Fond initial + encaissements espèces - sorties/remboursements espèces
  cashVariance: number; // countedCash - theoreticalCash
  varianceJustification?: string;
  notes?: string;
}

export type CashMovementType =
  | 'VENTE_ESPECES'
  | 'VENTE_DIGITAL'
  | 'REGLEMENT_CREANCE'
  | 'DEPENSE'
  | 'REMBOURSEMENT'
  | 'APPORT_ESPECES'
  | 'RETRAIT_BANQUE';

export interface CashMovement {
  id: string; // Ex: CSM-2026-0001
  cashSessionId: string;
  warehouseId: string;
  date: string;
  type: CashMovementType;
  method: PaymentMethod;
  amount: number; // En FCFA (toujours positif)
  isCashInDrawer: boolean; // TRUE uniquement pour ESPECES physiques !
  direction: 'IN' | 'OUT';
  reason: string;
  saleId?: string;
  customerId?: string;
  documentRef?: string;
  userId: string;
  userName: string;
  notes?: string;
}

// ====================================================================
// MODULE IMPORTATION EXCEL / CSV
// ====================================================================

export type ImportMode = 'INITIAL_IMPORT' | 'CATALOG_UPDATE' | 'PRICING_UPDATE';

export interface ImportFieldMapping {
  mainReference: string; // Nom de la colonne dans le fichier
  designation: string;
  brand?: string;
  equivalentReferences?: string; // Références équivalentes / cross-references
  category?: string;
  initialQuantity?: string;
  purchasePrice?: string;
  salePrice?: string;
  preferredSupplier?: string;
  warehouse?: string;
  physicalLocation?: string; // Rayonnage / Étagère / Case
  rack?: string;
  shelf?: string;
  bin?: string;
  minStockThreshold?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface ParsedImportRow {
  rowIndex: number;
  raw: Record<string, any>;
  mainReference: string;
  designation: string;
  brand: string;
  equivalentReferences?: string[];
  category: ArticleCategory;
  initialQuantity: number;
  purchasePrice: number;
  salePrice: number;
  preferredSupplier?: string;
  warehouseId?: string;
  warehouseName?: string;
  physicalLocation: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  minStockThreshold: number;
  barcode?: string;
  imageUrl?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  errors: string[];
  warnings: string[];
  isDuplicateInCatalog: boolean;
  existingArticleId?: string;
}

export interface ImportResultReport {
  timestamp: string;
  mode: ImportMode;
  fileName: string;
  totalRows: number;
  createdArticles: number;
  updatedArticles: number;
  skippedArticles: number;
  rejectedRows: number;
  createdMovements: number;
  positiveStockEntriesCount: number;
  totalQuantityImported: number;
  errors: string[];
  rejectedDetails?: Array<{ row: number; reference: string; reason: string }>;
}

// ====================================================================
// MODULE COMMANDES FOURNISSEURS
// ====================================================================

export type SupplierOrderStatus =
  | 'DRAFT'
  | 'TO_ORDER'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface SupplierOrderItem {
  id: string;
  articleId: string;
  mainReference: string;
  designation: string;
  brand: string;
  unit: string;
  stockAvailable: number;
  minThreshold: number;
  suggestedQty: number;
  quantityOrdered: number;
  quantityReceived: number;
  purchasePrice: number;
  lineTotal: number;
}

export interface SupplierOrder {
  id: string; // Ex: CMD-2026-0001
  orderNumber: string;
  date: string; // ISO
  supplierName: string;
  supplierContact?: string;
  supplierEmail?: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  status: SupplierOrderStatus;
  items: SupplierOrderItem[];
  additionalFees: number; // Frais de transport, douane, etc.
  totalAmount: number; // Somme des lignes + frais
  notes?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  orderedAt?: string;
  expectedDeliveryDate?: string;
  lastReceivedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
}

// ====================================================================
// MODULE FOURNISSEURS & DEVIS / PROFORMAS
// ====================================================================

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  brandsHandled: string[];
  notes?: string;
  createdAt: string;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED';

export interface QuoteItem {
  articleId: string;
  mainReference: string;
  designation: string;
  brand: string;
  unit: string;
  quantity: number;
  unitCost: number;
  catalogUnitPrice: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  totalLine: number;
}

export interface Quote {
  id: string; // Ex: DEV-2026-0001
  quoteNumber: string;
  date: string;
  validUntil: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  warehouseId: string;
  warehouseName: string;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  notes?: string;
  terms?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  convertedSaleId?: string;
}


