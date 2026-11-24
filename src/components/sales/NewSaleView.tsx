import React, { useState, useMemo, useDeferredValue, useEffect, useCallback, useRef } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleBrandOffer, PaymentMethod, Sale } from '../../types';
import { formatFCFA, formatDateTime, formatDate } from '../../utils/formatters';
import {
  getArticleBrandOffers,
  getBrandStockAcrossWarehouses,
  getSingleWarehouseBrandLocation,
  stripWarehousePrefix,
  cleanBrandName,
} from '../../utils/articleHelpers';
import {
  fuzzyFilter,
  scoreArticleByScope,
  SearchTargetScope,
  SEARCH_SCOPE_OPTIONS,
} from '../../utils/fuzzySearch';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  User,
  CreditCard,
  ShieldCheck,
  Edit2,
  X,
  Boxes,
  MapPin,
  Bookmark,
  FolderOpen,
  Percent,
  Clock,
  Calendar,
  Lock as LockIcon,
  Snowflake,
  RotateCcw,
  Info,
  Barcode,
  Image as ImageIcon,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Building2,
  Tag,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { ArticleDetailModal } from '../catalog/ArticleDetailModal';
import { ArticleFormModal } from '../catalog/ArticleFormModal';
import { QuickStockEditModal } from '../catalog/QuickStockEditModal';
import { NumericInput } from '../common/NumericInput';

interface CartItem {
  article: Article;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  discountPercent: number;
  discountAmount: number;
  isPriceOverridden: boolean;
  overriddenReason?: string;
  selectedBrandOffer?: ArticleBrandOffer;
  sourceWarehouseId?: string;
  sourceWarehouseName?: string;
  sourceLocation?: string;
}

interface SaleProductOption {
  key: string;
  article: Article;
  brandOffer: ArticleBrandOffer;
  brand: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  location: string;
  stockQty: number;
  salePrice: number;
}

interface TenderEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
}

interface SavedSaleDraft {
  id: string;
  createdAt: string;
  customerType: 'REGISTERED' | 'WALK_IN';
  selectedCustomerId: string;
  customerDisplayName: string;
  walkInName: string;
  walkInPhone: string;
  orderRef: string;
  saleNotes: string;
  globalDiscountMode: 'PERCENT' | 'MANUAL';
  globalDiscountPercent: number;
  globalDiscountManual: number;
  items: Array<{
    articleId: string;
    quantity: number;
    unitPrice: number;
    catalogPrice: number;
    discountPercent: number;
    discountAmount: number;
    isPriceOverridden: boolean;
    overriddenReason?: string;
    selectedBrandOfferId?: string;
    sourceWarehouseId?: string;
    sourceWarehouseName?: string;
    sourceLocation?: string;
  }>;
  subtotal: number;
  netTotal: number;
}

const SAVED_DRAFTS_STORAGE_KEY = 'equipstock_pos_saved_lists_v1';

interface NewSaleViewProps {
  onOpenStockIn?: (articleId: string) => void;
  onOpenStockOut?: (articleId: string) => void;
  onOpenPurchaseOrder?: (articleId?: string, brand?: string) => void;
  onNavigateToPurchaseOrder?: (orderId: string) => void;
}

export const NewSaleView: React.FC<NewSaleViewProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onOpenPurchaseOrder,
  onNavigateToPurchaseOrder,
}) => {
  const {
    articles,
    stocks,
    warehouses,
    customers,
    users,
    getTotalStockForArticle,
    recordSale,
    updateArticle,
    selectedWarehouseId,
    getActiveCashSession,
    cashSessions,
    currentUser,
    currentPermissions,
    showProductImages,
    isStockFrozen,
    toggleStockFreeze,
  } = useStock();

  const heroSearchInputRef = useRef<HTMLInputElement>(null);
  const step2SearchInputRef = useRef<HTMLInputElement>(null);

  // Modals for viewing/editing part details
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [quickEditTarget, setQuickEditTarget] = useState<{
    article: Article;
    brand?: string;
    warehouseId?: string | null;
  } | null>(null);

  // Date selection & Admin backdating approval
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isAdminApprovedForBackdating, setIsAdminApprovedForBackdating] = useState<boolean>(false);
  const [isAdminApprovalModalOpen, setIsAdminApprovalModalOpen] = useState<boolean>(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminApprovalError, setAdminApprovalError] = useState<string>('');

  // Default store warehouse for recording sale accounting
  const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0];
  const warehouseId = selectedWarehouseId || defaultWarehouse?.id || 'mag_principal';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchTargetScope>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isStep2SearchOpen, setIsStep2SearchOpen] = useState<boolean>(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer selection & Unified Search Combobox (Block 1)
  const [customerType, setCustomerType] = useState<'REGISTERED' | 'WALK_IN'>('WALK_IN');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerComboboxRef = useRef<HTMLDivElement>(null);
  const [walkInName, setWalkInName] = useState('Client Comptoir');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerComboboxRef.current &&
        !customerComboboxRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Discount & Secondary Options
  const [globalDiscountMode, setGlobalDiscountMode] = useState<'PERCENT' | 'MANUAL'>('PERCENT');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [globalDiscountManual, setGlobalDiscountManual] = useState<number>(0);
  const [showExtraInvoiceOptions, setShowExtraInvoiceOptions] = useState<boolean>(false);

  // Saved Sale Lists (without stock impact)
  const [savedDrafts, setSavedDrafts] = useState<SavedSaleDraft[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_DRAFTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isSavedDraftsModalOpen, setIsSavedDraftsModalOpen] = useState(false);
  const [draftToDeleteId, setDraftToDeleteId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<{
    url: string;
    title: string;
    ref: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_DRAFTS_STORAGE_KEY, JSON.stringify(savedDrafts));
    } catch (e) {
      console.warn('Could not persist saved sale drafts:', e);
    }
  }, [savedDrafts]);

  useEffect(() => {
    const handleSyncSavedDrafts = () => {
      try {
        const raw = localStorage.getItem(SAVED_DRAFTS_STORAGE_KEY);
        setSavedDrafts(raw ? JSON.parse(raw) : []);
      } catch {
        // Ignore parse error
      }
    };
    window.addEventListener('equipstock-saved-drafts-updated', handleSyncSavedDrafts);
    return () => {
      window.removeEventListener('equipstock-saved-drafts-updated', handleSyncSavedDrafts);
    };
  }, []);

  // Payment Tenders (Block 4 of Model 2)
  const [tenders, setTenders] = useState<TenderEntry[]>([{ method: 'ESPECES', amount: 0 }]);

  // Form submission state & modals
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmSaleModalOpen, setIsConfirmSaleModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptFormat] = useState<'THERMAL' | 'A4' | 'BL'>('A4');

  // Price override modal state
  const [overrideItemIndex, setOverrideItemIndex] = useState<number | null>(null);
  const [overridePriceInput, setOverridePriceInput] = useState<number>(0);
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Complete reset function ("rafraîchir la page comme neuf pour préparer une nouvelle vente")
  // Returns automatically to State 1 (Single Large Centered Search Div)
  const resetSalePageAsNew = useCallback(() => {
    setSearchQuery('');
    setSearchScope('ALL');
    setSelectedCategory('ALL');
    setIsStep2SearchOpen(false);
    setCart([]);
    setCustomerType('WALK_IN');
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
    setIsCustomerDropdownOpen(false);
    setWalkInName('Client Comptoir');
    setWalkInPhone('');
    setOrderRef('');
    setSaleNotes('');
    setGlobalDiscountMode('PERCENT');
    setGlobalDiscountPercent(0);
    setGlobalDiscountManual(0);
    setShowExtraInvoiceOptions(false);
    setTenders([{ method: 'ESPECES', amount: 0 }]);
    setSaleDate(new Date().toISOString().slice(0, 10));
    setIsAdminApprovedForBackdating(false);
    setErrorMessage('');
    setSuccessBanner(null);
    setOverrideItemIndex(null);
    setDetailArticle(null);
    setTimeout(() => {
      heroSearchInputRef.current?.focus();
    }, 60);
  }, []);

  const adminUsers = useMemo(() => {
    return users.filter((u) => u.role === 'ADMIN');
  }, [users]);

  const handleAdminApprovalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminApprovalError('');

    const targetAdmin =
      (selectedAdminId ? adminUsers.find((u) => u.id === selectedAdminId) : null) || adminUsers[0];
    if (!targetAdmin) {
      setAdminApprovalError('Aucun profil administrateur trouvé.');
      return;
    }

    const expectedPin = targetAdmin.pinCode || '0000';
    if (adminPinInput.trim() !== expectedPin) {
      setAdminApprovalError('Code PIN administrateur incorrect.');
      return;
    }

    setIsAdminApprovedForBackdating(true);
    setIsAdminApprovalModalOpen(false);
    setAdminPinInput('');
  };

  const activeCashSession =
    getActiveCashSession(warehouseId) || cashSessions.find((s) => s.status === 'OPEN');

  const stocksByArticleId = useMemo(() => {
    const map = new Map<string, (typeof stocks)[number][]>();
    for (const s of stocks) {
      const list = map.get(s.articleId);
      if (list) list.push(s);
      else map.set(s.articleId, [s]);
    }
    return map;
  }, [stocks]);

  const getAllBrandOffersForArticle = useCallback(
    (article: Article): ArticleBrandOffer[] => {
      const baseOffers = getArticleBrandOffers(article);
      const offers: ArticleBrandOffer[] = [...baseOffers];
      const articleStocks = stocksByArticleId.get(article.id) || [];

      articleStocks.forEach((s) => {
        if (s.brandBreakdown) {
          Object.keys(s.brandBreakdown).forEach((bName) => {
            const cleaned = cleanBrandName(bName);
            if (
              cleaned &&
              !offers.some((o) => cleanBrandName(o.brand).toLowerCase() === cleaned.toLowerCase())
            ) {
              offers.push({
                id: `bo_dyn_${article.id}_${cleaned}`,
                brand: cleaned,
                brandReference: article.mainReference,
                purchasePrice: article.purchasePrice,
                salePrice: article.salePrice,
                location: s.shelfLocation || article.defaultLocation || 'Non renseigné',
              });
            }
          });
        }
      });

      return offers;
    },
    [stocksByArticleId]
  );

  const getPureWarehouseLocation = useCallback(
    (article: Article, brandName: string, targetWhId: string): string => {
      const articleStocks = stocksByArticleId.get(article.id) || [];
      const st = articleStocks.find((s) => s.warehouseId === targetWhId);
      const whObj = warehouses.find((w) => w.id === targetWhId);
      const rawLoc = getSingleWarehouseBrandLocation(
        st,
        article,
        brandName,
        targetWhId,
        warehouses,
        articleStocks
      );
      const stripped = stripWarehousePrefix(rawLoc, warehouses, whObj?.name);
      if (stripped) return stripped;

      const detailed = [
        article.rack ? `${article.rack}` : '',
        article.shelf ? `${article.shelf}` : '',
        article.bin ? `${article.bin}` : '',
      ]
        .filter(Boolean)
        .join('-');
      if (detailed) return detailed;

      const fallbackStripped = stripWarehousePrefix(
        article.defaultLocation,
        warehouses,
        whObj?.name
      );
      return fallbackStripped || 'Non renseigné';
    },
    [stocksByArticleId, warehouses]
  );

  const getSaleOptionsForArticle = useCallback(
    (article: Article): SaleProductOption[] => {
      const offers = getAllBrandOffersForArticle(article);
      const articleStocks = stocksByArticleId.get(article.id) || [];
      const options: SaleProductOption[] = [];

      // Collect all warehouses known in app + any referenced in articleStocks
      const whList = [...warehouses];
      articleStocks.forEach((st) => {
        if (!whList.some((w) => w.id === st.warehouseId)) {
          whList.push({
            id: st.warehouseId,
            code: st.warehouseId,
            name: st.warehouseId,
            location: '',
            phone: '',
            manager: '',
            isActive: true,
            isDefault: false,
          });
        }
      });

      offers.forEach((offer, offerIdx) => {
        const brandLabel = cleanBrandName(offer.brand) || cleanBrandName(article.brand);
        let addedPositiveForOffer = false;

        whList.forEach((wh) => {
          const st = articleStocks.find((s) => s.warehouseId === wh.id);
          const qtyInWh = st
            ? getBrandStockAcrossWarehouses([st], article, offer.brand || brandLabel, wh.id)
            : 0;

          if (qtyInWh > 0) {
            const loc = getPureWarehouseLocation(article, offer.brand || brandLabel, wh.id);
            options.push({
              key: `${article.id}__${offer.id}__${wh.id}__${offerIdx}`,
              article,
              brandOffer: offer,
              brand: brandLabel,
              warehouseId: wh.id,
              warehouseName: wh.name,
              warehouseCode: wh.code,
              location: loc,
              stockQty: qtyInWh,
              salePrice: offer.salePrice > 0 ? offer.salePrice : article.salePrice,
            });
            addedPositiveForOffer = true;
          }
        });

        if (!addedPositiveForOffer && isStockFrozen) {
          const fallbackWh =
            (selectedWarehouseId && whList.find((w) => w.id === selectedWarehouseId)) ||
            whList.find((w) => w.id === warehouseId) ||
            defaultWarehouse ||
            whList[0];
          if (fallbackWh) {
            const loc = getPureWarehouseLocation(
              article,
              offer.brand || brandLabel,
              fallbackWh.id
            );
            options.push({
              key: `${article.id}__${offer.id}__${fallbackWh.id}__frozen__${offerIdx}`,
              article,
              brandOffer: offer,
              brand: brandLabel,
              warehouseId: fallbackWh.id,
              warehouseName: fallbackWh.name,
              warehouseCode: fallbackWh.code,
              location: loc,
              stockQty: 0,
              salePrice: offer.salePrice > 0 ? offer.salePrice : article.salePrice,
            });
          }
        }
      });

      // Fallback if total stock > 0 globally but brand breakdown missed a warehouse
      if (options.length === 0) {
        const defaultOffer = offers[0];
        const brandLabel =
          cleanBrandName(defaultOffer?.brand) || cleanBrandName(article.brand);
        const positiveWhStocks = articleStocks.filter((s) => (Number(s.quantity) || 0) > 0);
        if (positiveWhStocks.length > 0) {
          positiveWhStocks.forEach((st, idx) => {
            const wh = whList.find((w) => w.id === st.warehouseId);
            const loc = getPureWarehouseLocation(article, brandLabel, st.warehouseId);
            options.push({
              key: `${article.id}__fallback__${st.warehouseId}__${idx}`,
              article,
              brandOffer: defaultOffer,
              brand: brandLabel,
              warehouseId: st.warehouseId,
              warehouseName: wh?.name || st.warehouseId,
              warehouseCode: wh?.code || st.warehouseId,
              location: loc,
              stockQty: Number(st.quantity) || 0,
              salePrice: defaultOffer?.salePrice > 0 ? defaultOffer.salePrice : article.salePrice,
            });
          });
        } else {
          const fallbackWh = defaultWarehouse || whList[0];
          if (fallbackWh) {
            options.push({
              key: `${article.id}__empty__${fallbackWh.id}`,
              article,
              brandOffer: defaultOffer,
              brand: brandLabel,
              warehouseId: fallbackWh.id,
              warehouseName: fallbackWh.name,
              warehouseCode: fallbackWh.code,
              location: getPureWarehouseLocation(article, brandLabel, fallbackWh.id),
              stockQty: 0,
              salePrice: defaultOffer?.salePrice > 0 ? defaultOffer.salePrice : article.salePrice,
            });
          }
        }
      }

      // Sort: positive stock first, active selected warehouse first, then higher stock
      return options.sort((a, b) => {
        if (a.stockQty > 0 && b.stockQty <= 0) return -1;
        if (a.stockQty <= 0 && b.stockQty > 0) return 1;
        if (selectedWarehouseId) {
          if (a.warehouseId === selectedWarehouseId && b.warehouseId !== selectedWarehouseId)
            return -1;
          if (a.warehouseId !== selectedWarehouseId && b.warehouseId === selectedWarehouseId)
            return 1;
        }
        return b.stockQty - a.stockQty;
      });
    },
    [
      getAllBrandOffersForArticle,
      stocksByArticleId,
      warehouses,
      getPureWarehouseLocation,
      isStockFrozen,
      selectedWarehouseId,
      warehouseId,
      defaultWarehouse,
    ]
  );

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.status !== 'archived' && a.category?.trim()) {
        set.add(a.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [articles]);

  // Filtered Articles for Search
  const filteredArticles = useMemo(() => {
    const activeArticles = articles.filter((art) => {
      if (art.status === 'archived') return false;
      if (!isStockFrozen) {
        const totalStock = getTotalStockForArticle(art.id);
        if (totalStock <= 0) return false;
      }
      if (selectedCategory !== 'ALL' && art.category !== selectedCategory) {
        return false;
      }
      return true;
    });

    const trimmedQuery = deferredSearchQuery.trim();
    if (!trimmedQuery) {
      return activeArticles.slice(0, 15);
    }

    const scored: Array<{ art: Article; score: number }> = [];
    for (const art of activeArticles) {
      const artStocks = stocksByArticleId.get(art.id) || [];
      const score = scoreArticleByScope(art, trimmedQuery, searchScope, artStocks);
      if (score > 0) {
        scored.push({ art, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.art.mainReference.localeCompare(b.art.mainReference);
    });

    return scored.slice(0, 25).map((s) => s.art);
  }, [
    articles,
    stocksByArticleId,
    deferredSearchQuery,
    searchScope,
    isStockFrozen,
    getTotalStockForArticle,
    selectedCategory,
  ]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) {
      return customers.slice(0, 30);
    }
    return fuzzyFilter(customers, customerSearchQuery.trim(), (c) => [
      c.name,
      c.code,
      c.phone,
      c.email,
      c.address,
      c.notes,
    ]).slice(0, 25);
  }, [customers, customerSearchQuery]);

  // Cart & Discount Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const lineDiscountsTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.discountAmount, 0);
  }, [cart]);

  const subtotalAfterLineDiscounts = Math.max(0, subtotal - lineDiscountsTotal);

  const computedGlobalDiscount = useMemo(() => {
    if (subtotalAfterLineDiscounts <= 0) return 0;
    if (globalDiscountMode === 'PERCENT') {
      const clampedPct = Math.min(100, Math.max(0, globalDiscountPercent || 0));
      return Math.round((subtotalAfterLineDiscounts * clampedPct) / 100);
    } else {
      return Math.min(
        subtotalAfterLineDiscounts,
        Math.max(0, Math.round(globalDiscountManual || 0))
      );
    }
  }, [
    subtotalAfterLineDiscounts,
    globalDiscountMode,
    globalDiscountPercent,
    globalDiscountManual,
  ]);

  const totalDiscount = lineDiscountsTotal + computedGlobalDiscount;
  const netTotal = Math.max(0, subtotal - totalDiscount);

  // Sync single tender amount with netTotal when cart changes
  useEffect(() => {
    if (cart.length === 0) {
      setTenders([{ method: 'ESPECES', amount: 0 }]);
      return;
    }
    setTenders((prev) => {
      if (prev.length === 1 && prev[0].method !== 'CREDIT') {
        return [{ ...prev[0], amount: netTotal }];
      }
      return prev;
    });
  }, [netTotal, cart.length]);

  const totalTendered = useMemo(() => {
    return tenders.reduce((sum, t) => {
      if (t.method === 'CREDIT') return sum;
      return sum + (Number(t.amount) || 0);
    }, 0);
  }, [tenders]);

  const remainingBalanceDue = Math.max(0, netTotal - totalTendered);
  const changeToReturn = totalTendered > netTotal ? totalTendered - netTotal : 0;

  const handleAddToCart = (article: Article, preferredOption?: SaleProductOption) => {
    setErrorMessage('');
    setSuccessBanner(null);
    const availableStock = getTotalStockForArticle(article.id);

    if (!isStockFrozen && availableStock <= 0) {
      setErrorMessage(
        `Rupture de stock : "${article.mainReference}" (${article.designation}) est épuisé.`
      );
      return;
    }

    const options = getSaleOptionsForArticle(article);
    const chosenOption =
      preferredOption || options.find((o) => o.stockQty > 0) || options[0];

    const chosenOffer = chosenOption?.brandOffer || getArticleBrandOffers(article)[0];
    const chosenBrand =
      cleanBrandName(chosenOption?.brand) ||
      cleanBrandName(chosenOffer?.brand) ||
      cleanBrandName(article.brand);
    const chosenWhId = chosenOption?.warehouseId || warehouseId;
    const chosenWhName =
      chosenOption?.warehouseName ||
      warehouses.find((w) => w.id === chosenWhId)?.name ||
      defaultWarehouse?.name ||
      'Magasin Principal';
    const chosenLoc =
      chosenOption?.location || getPureWarehouseLocation(article, chosenBrand, chosenWhId);
    const initialPrice = chosenOption ? chosenOption.salePrice : article.salePrice;

    const existingIndex = cart.findIndex(
      (i) =>
        i.article.id === article.id &&
        (i.selectedBrandOffer?.brand || i.article.brand).toLowerCase().trim() ===
          chosenBrand.toLowerCase().trim() &&
        (i.sourceWarehouseId || warehouseId) === chosenWhId
    );

    const totalArticleInCart = cart
      .filter((i) => i.article.id === article.id)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (!isStockFrozen && totalArticleInCart + 1 > availableStock) {
      setErrorMessage(
        `Stock maximum disponible atteint (${availableStock} ${article.unit}) pour ${article.mainReference}.`
      );
      return;
    }

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const updated = [...cart];
      const newQty = existing.quantity + 1;
      const rawLine = newQty * existing.unitPrice;
      const discAmt =
        existing.discountPercent > 0
          ? Math.round((rawLine * existing.discountPercent) / 100)
          : existing.discountAmount;

      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        discountAmount: discAmt,
      };
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          article,
          quantity: 1,
          unitPrice: initialPrice,
          catalogPrice: initialPrice,
          discountPercent: 0,
          discountAmount: 0,
          isPriceOverridden: false,
          selectedBrandOffer: chosenOffer,
          sourceWarehouseId: chosenWhId,
          sourceWarehouseName: chosenWhName,
          sourceLocation: chosenLoc,
        },
      ]);
    }

    // Clear search query and close dropdown after selecting an item so Model 2 table is clean and visible
    setSearchQuery('');
    setIsStep2SearchOpen(false);
  };

  // Enter key in search input adds best match immediately
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && filteredArticles.length > 0) {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      const exactMatch =
        filteredArticles.find((a) => a.mainReference.toLowerCase() === q) ||
        filteredArticles[0];
      if (exactMatch) {
        const opts = getSaleOptionsForArticle(exactMatch);
        const firstAvailable = opts.find((o) => o.stockQty > 0) || opts[0];
        handleAddToCart(exactMatch, firstAvailable);
      }
    }
  };

  const handleSelectBrandOffer = (index: number, brandOfferId: string) => {
    const item = cart[index];
    const offers = getAllBrandOffersForArticle(item.article);
    const offer = offers.find((o) => o.id === brandOfferId) || offers[0];
    const artStocks = stocksByArticleId.get(item.article.id) || [];

    // Keep current warehouse if brand has stock there, otherwise switch to a warehouse holding stock for this brand
    let targetWhId = item.sourceWarehouseId || warehouseId;
    const currentWhStockObj = artStocks.find((s) => s.warehouseId === targetWhId);
    const qtyInCurrentWh = currentWhStockObj
      ? getBrandStockAcrossWarehouses([currentWhStockObj], item.article, offer.brand, targetWhId)
      : 0;

    if (qtyInCurrentWh <= 0) {
      const whWithStock = warehouses.find((w) => {
        const st = artStocks.find((s) => s.warehouseId === w.id);
        return st
          ? getBrandStockAcrossWarehouses([st], item.article, offer.brand, w.id) > 0
          : false;
      });
      if (whWithStock) {
        targetWhId = whWithStock.id;
      }
    }

    const targetWhName =
      warehouses.find((w) => w.id === targetWhId)?.name ||
      item.sourceWarehouseName ||
      defaultWarehouse?.name ||
      'Magasin Principal';

    const updated = [...cart];
    const newUnitPrice = offer.salePrice > 0 ? offer.salePrice : item.article.salePrice;
    const rawLine = item.quantity * newUnitPrice;
    const discAmt =
      item.discountPercent > 0
        ? Math.round((rawLine * item.discountPercent) / 100)
        : item.discountAmount;

    updated[index] = {
      ...item,
      selectedBrandOffer: offer,
      catalogPrice: newUnitPrice,
      unitPrice: item.isPriceOverridden ? item.unitPrice : newUnitPrice,
      discountAmount: discAmt,
      sourceWarehouseId: targetWhId,
      sourceWarehouseName: targetWhName,
      sourceLocation: getPureWarehouseLocation(item.article, offer.brand, targetWhId),
    };
    setCart(updated);
  };

  const handleSelectWarehouse = (index: number, newWarehouseId: string) => {
    const item = cart[index];
    const wh = warehouses.find((w) => w.id === newWarehouseId);
    const brandName = item.selectedBrandOffer?.brand || item.article.brand;
    const updated = [...cart];
    updated[index] = {
      ...item,
      sourceWarehouseId: newWarehouseId,
      sourceWarehouseName: wh?.name || newWarehouseId,
      sourceLocation: getPureWarehouseLocation(item.article, brandName, newWarehouseId),
    };
    setCart(updated);
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    const item = cart[index];
    const available = getTotalStockForArticle(item.article.id);

    if (!isStockFrozen && newQty > available) {
      setErrorMessage(
        `Quantité demandée (${newQty}) supérieure au stock total disponible (${available} ${item.article.unit}).`
      );
      return;
    }

    const updated = [...cart];
    const rawLine = newQty * item.unitPrice;
    const discAmt =
      item.discountPercent > 0
        ? Math.round((rawLine * item.discountPercent) / 100)
        : Math.min(rawLine, item.discountAmount);

    updated[index] = {
      ...item,
      quantity: newQty,
      discountAmount: discAmt,
    };
    setCart(updated);
  };

  const handleUpdateDiscountPercent = (index: number, percent: number) => {
    const item = cart[index];
    const clamped = Math.min(100, Math.max(0, percent));
    const rawLine = item.quantity * item.unitPrice;
    const discAmt = Math.round((rawLine * clamped) / 100);

    const updated = [...cart];
    updated[index] = {
      ...item,
      discountPercent: clamped,
      discountAmount: discAmt,
    };
    setCart(updated);
  };

  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleOpenPriceOverride = (index: number) => {
    if (!currentPermissions.canOverridePrice) {
      setErrorMessage(
        "Votre profil ne dispose pas de l'autorisation pour modifier manuellement les prix."
      );
      return;
    }
    setOverrideItemIndex(index);
    setOverridePriceInput(cart[index].unitPrice);
    setOverrideReasonInput(cart[index].overriddenReason || '');
  };

  const handleApplyPriceOverride = () => {
    if (overrideItemIndex === null) return;
    if (overridePriceInput < 0) return;

    const item = cart[overrideItemIndex];
    const isOverridden = overridePriceInput !== item.catalogPrice;

    const updated = [...cart];
    const rawLine = item.quantity * overridePriceInput;
    const discAmt =
      item.discountPercent > 0
        ? Math.round((rawLine * item.discountPercent) / 100)
        : Math.min(rawLine, item.discountAmount);

    updated[overrideItemIndex] = {
      ...item,
      unitPrice: overridePriceInput,
      isPriceOverridden: isOverridden,
      overriddenReason: isOverridden
        ? overrideReasonInput || 'Ajustement tarifaire commercial'
        : undefined,
      discountAmount: discAmt,
    };

    setCart(updated);
    setOverrideItemIndex(null);
  };

  // Quick tender setters
  const setExactTender = (method: PaymentMethod) => {
    if (method === 'CREDIT') {
      setCustomerType('REGISTERED');
      setTenders([{ method: 'CREDIT', amount: 0 }]);
    } else {
      setTenders([{ method, amount: netTotal }]);
    }
  };

  const handleUpdatePrimaryTenderAmount = (amt: number) => {
    if (tenders.length === 0) {
      setTenders([{ method: 'ESPECES', amount: Math.max(0, amt) }]);
      return;
    }
    const updated = [...tenders];
    if (updated[0].method === 'CREDIT') {
      updated[0] = { method: 'ESPECES', amount: Math.max(0, amt) };
    } else {
      updated[0] = { ...updated[0], amount: Math.max(0, amt) };
    }
    setTenders(updated);
  };

  const handleSaveDraftList = () => {
    setErrorMessage('');
    setSuccessBanner(null);

    if (cart.length === 0) {
      setErrorMessage(
        'Veuillez ajouter au moins un article dans le panier avant de mettre en attente.'
      );
      return;
    }

    const selectedCust =
      customerType === 'REGISTERED' ? customers.find((c) => c.id === selectedCustomerId) : null;
    const customerDisplayName =
      customerType === 'REGISTERED' && selectedCust
        ? `${selectedCust.name} (${selectedCust.code})`
        : walkInName.trim() || 'Client Comptoir';

    const newDraft: SavedSaleDraft = {
      id: `ATT-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      customerType,
      selectedCustomerId,
      customerDisplayName,
      walkInName,
      walkInPhone,
      orderRef,
      saleNotes,
      globalDiscountMode,
      globalDiscountPercent,
      globalDiscountManual,
      items: cart.map((c) => ({
        articleId: c.article.id,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        catalogPrice: c.catalogPrice,
        discountPercent: c.discountPercent,
        discountAmount: c.discountAmount,
        isPriceOverridden: c.isPriceOverridden,
        overriddenReason: c.overriddenReason,
        selectedBrandOfferId: c.selectedBrandOffer?.id,
        sourceWarehouseId: c.sourceWarehouseId,
        sourceWarehouseName: c.sourceWarehouseName,
        sourceLocation: c.sourceLocation,
      })),
      subtotal,
      netTotal,
    };

    setSavedDrafts((prev) => [newDraft, ...prev]);
    resetSalePageAsNew();
    setSuccessBanner(
      `Vente mise en attente sous le N° ${newDraft.id} (${customerDisplayName} — ${formatFCFA(netTotal)}).`
    );
  };

  const handleRestoreDraftList = (draft: SavedSaleDraft) => {
    setErrorMessage('');
    setSuccessBanner(null);

    const restoredCart: CartItem[] = [];
    for (const item of draft.items) {
      const art = articles.find((a) => a.id === item.articleId);
      if (!art) continue;
      const offers = getArticleBrandOffers(art);
      const offer = offers.find((o) => o.id === item.selectedBrandOfferId) || offers[0];
      restoredCart.push({
        article: art,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        catalogPrice: item.catalogPrice,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        isPriceOverridden: item.isPriceOverridden,
        overriddenReason: item.overriddenReason,
        selectedBrandOffer: offer,
        sourceWarehouseId: item.sourceWarehouseId,
        sourceWarehouseName: item.sourceWarehouseName,
        sourceLocation: item.sourceLocation,
      });
    }

    setCart(restoredCart);
    setCustomerType(draft.customerType);
    setSelectedCustomerId(draft.selectedCustomerId);
    setWalkInName(draft.walkInName);
    setWalkInPhone(draft.walkInPhone);
    setOrderRef(draft.orderRef);
    setSaleNotes(draft.saleNotes);
    setGlobalDiscountMode(draft.globalDiscountMode);
    setGlobalDiscountPercent(draft.globalDiscountPercent);
    setGlobalDiscountManual(draft.globalDiscountManual);
    setTenders([{ method: 'ESPECES', amount: draft.netTotal }]);

    setSavedDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setIsSavedDraftsModalOpen(false);
    setSuccessBanner(`Liste "${draft.id}" rechargée dans le mode facturation.`);
  };

  const handleDeleteSavedDraft = (draftId: string) => {
    setSavedDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setDraftToDeleteId(null);
  };

  const handleValidateSale = () => {
    if (isSubmitting) return;
    setErrorMessage('');
    setSuccessBanner(null);

    if (!currentPermissions.canSell) {
      setErrorMessage("Votre profil utilisateur n'est pas autorisé à valider des ventes.");
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Veuillez choisir au moins une pièce.');
      return;
    }

    if (remainingBalanceDue > 0 && (customerType !== 'REGISTERED' || !selectedCustomerId)) {
      setCustomerType('REGISTERED');
      setErrorMessage(
        `Cette vente comporte un reste à payer (créance de ${remainingBalanceDue.toLocaleString()} FCFA). Veuillez sélectionner un Client en Compte dans le bloc "1. Sélection du Client" en haut à gauche.`
      );
      return;
    }

    setIsConfirmSaleModalOpen(true);
  };

  const executeConfirmedSale = () => {
    if (isSubmitting) return;
    setIsConfirmSaleModalOpen(false);
    setIsSubmitting(true);

    try {
      const selectedCust =
        customerType === 'REGISTERED' ? customers.find((c) => c.id === selectedCustomerId) : null;

      const customerName =
        customerType === 'REGISTERED' && selectedCust
          ? selectedCust.name
          : walkInName.trim() || 'Client Comptoir';

      const customerPhone =
        customerType === 'REGISTERED' && selectedCust
          ? selectedCust.phone
          : walkInPhone.trim() || undefined;

      let remainingToAllocate = netTotal;
      const validPayments = tenders
        .filter((t) => t.method !== 'CREDIT' && t.amount > 0)
        .map((t) => {
          const appliedAmt = Math.min(t.amount, remainingToAllocate);
          remainingToAllocate = Math.max(0, remainingToAllocate - appliedAmt);
          return {
            ...t,
            amount: appliedAmt,
          };
        })
        .filter((t) => t.amount > 0);

      let remainingGlobalDisc = computedGlobalDiscount;
      const itemsWithDistributedDiscount = cart.map((c, idx) => {
        const rawLine = c.quantity * c.unitPrice;
        const netLineBeforeGlobal = Math.max(0, rawLine - c.discountAmount);
        let extraGlobalDisc = 0;

        if (remainingGlobalDisc > 0 && subtotalAfterLineDiscounts > 0) {
          if (idx === cart.length - 1) {
            extraGlobalDisc = Math.min(netLineBeforeGlobal, remainingGlobalDisc);
          } else {
            extraGlobalDisc = Math.min(
              netLineBeforeGlobal,
              Math.round(
                (netLineBeforeGlobal / subtotalAfterLineDiscounts) * computedGlobalDiscount
              )
            );
          }
          remainingGlobalDisc = Math.max(0, remainingGlobalDisc - extraGlobalDisc);
        }

        return {
          articleId: c.article.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discountPercent: c.discountPercent,
          discountAmount: c.discountAmount + extraGlobalDisc,
          isPriceOverridden: c.isPriceOverridden,
          overriddenReason: c.overriddenReason,
          selectedBrandOfferId: c.selectedBrandOffer?.id,
          brand: c.selectedBrandOffer?.brand || c.article.brand,
          sourceWarehouseId: c.sourceWarehouseId,
          sourceWarehouseName: c.sourceWarehouseName,
          sourceLocation: c.sourceLocation,
        };
      });

      const discountNote =
        computedGlobalDiscount > 0
          ? `Remise globale: -${formatFCFA(computedGlobalDiscount)}${
              globalDiscountMode === 'PERCENT' ? ` (${globalDiscountPercent}%)` : ' (Manuel)'
            }. `
          : '';

      const result = recordSale({
        warehouseId,
        saleDate: saleDate || undefined,
        freezeStock: isStockFrozen,
        customerId: customerType === 'REGISTERED' ? selectedCustomerId : undefined,
        customerName,
        customerPhone,
        items: itemsWithDistributedDiscount,
        payments: validPayments,
        notes:
          discountNote +
          (orderRef ? `Réf BC: ${orderRef}. ` : '') +
          (saleNotes ? saleNotes : ''),
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Erreur lors de la validation de la vente.');
        setIsSubmitting(false);
      } else if (result.sale) {
        // Rafraîchir immédiatement toute la page comme neuf (revient au grand div de recherche centré)
        resetSalePageAsNew();
        setIsSubmitting(false);
        setCompletedSale(result.sale);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
      setIsSubmitting(false);
    }
  };

  const selectedCustObj = customers.find((c) => c.id === selectedCustomerId);
  const canBackdateDirectly =
    currentUser.role === 'ADMIN' ||
    currentPermissions.canBackdateTransactions ||
    isAdminApprovedForBackdating;
  const isBackdated = saleDate !== new Date().toISOString().slice(0, 10);
  const activeSingleMethod = tenders.length === 1 ? tenders[0].method : 'ESPECES';
  const totalCartUnits = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Notifications / Alertes globales */}
      {successBanner && (
        <div className="max-w-4xl mx-auto p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="max-w-4xl mx-auto p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-800 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================================================================== */}
      {/* ÉTAT 1 : AUCUN PRODUIT CHOISI -> UN SEUL GRAND DIV DE RECHERCHE    */}
      {/*          AU CENTRE DE LA PAGE                                      */}
      {/* ================================================================== */}
      {cart.length === 0 ? (
        <div className="max-w-4xl mx-auto py-4 sm:py-6">
          <div className="card bg-white border border-[#E5E5E5] rounded-lg overflow-hidden p-0!">
            {/* En-tête du grand bloc de recherche central — Variation 19 */}
            <div className="px-6 py-5 bg-[#FDFDFD] border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-[#E35E2D] text-white rounded flex items-center justify-center font-bold shrink-0">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="label text-[#E35E2D] opacity-100">Guichet Central · POS</div>
                  <h2 className="font-display text-lg sm:text-xl font-bold tracking-[-0.04em] text-[#1B1B1B]">
                    Nouvelle Vente — Rechercher une pièce
                  </h2>
                </div>
              </div>

              {/* Outils discrets (Listes en attente & Gel de stock) */}
              <div className="flex items-center gap-2">
                {savedDrafts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSavedDraftsModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#E35E2D] text-white hover:bg-[#C94D1E] rounded inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-white" />
                    <span>En attente ({savedDrafts.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleStockFreeze}
                  className={`px-3 py-1.5 border text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isStockFrozen
                      ? 'bg-[#E35E2D] text-white border-[#E35E2D]'
                      : 'bg-white text-[#1B1B1B] border-[#E5E5E5] hover:border-[#E35E2D]'
                  }`}
                  title="Mode Gel de Stock : enregistrer une vente sans déduire le stock physique"
                >
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>Gel stock : {isStockFrozen ? 'OUI' : 'Non'}</span>
                </button>
              </div>
            </div>

            {/* Corps du grand bloc de recherche */}
            <div className="p-6 space-y-5">
              {/* Grande barre de saisie centrale — Variation 19 */}
              <div className="relative">
                <Search className="w-5 h-5 text-[#E35E2D] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={heroSearchInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={
                    SEARCH_SCOPE_OPTIONS.find((o) => o.id === searchScope)?.placeholder ||
                    'Rechercher une référence (ex: 1R-0716), une désignation, une marque ou un modèle d’engin...'
                  }
                  className="w-full pl-12 pr-24 py-4 text-sm sm:text-base font-medium bg-[#F9FAFB] border border-[#E5E5E5] rounded text-[#1B1B1B] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:border-[#E35E2D] transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1.5 text-[#1B1B1B]/60 hover:text-[#1B1B1B] border-0! bg-transparent! cursor-pointer"
                      title="Effacer la recherche"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  <span
                    className="px-2.5 py-1 bg-white text-[#1B1B1B] text-[11px] font-mono font-semibold inline-flex items-center gap-1 border border-[#E5E5E5] rounded"
                    title="Appuyez sur Entrée pour ajouter directement le 1er résultat"
                  >
                    <Barcode className="w-3.5 h-3.5 text-[#E35E2D]" />
                    <span className="hidden sm:inline">ENTRÉE</span>
                  </span>
                </div>
              </div>

              {/* Filtres rapides de ciblage et catégories */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="label mr-1">Cibler :</span>
                  {SEARCH_SCOPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSearchScope(opt.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer border ${
                        searchScope === opt.id
                          ? 'bg-[#E35E2D]! text-white! border-[#E35E2D]!'
                          : 'bg-white text-[#1B1B1B]/75 border-[#E5E5E5] hover:border-[#E35E2D]'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>

                {availableCategories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1 text-xs font-semibold bg-[#F9FAFB] border border-[#E5E5E5] rounded text-[#1B1B1B] cursor-pointer"
                  >
                    <option value="ALL">Toutes les catégories</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Liste des pièces correspondantes */}
              <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E5E5] flex items-center justify-between text-xs font-semibold text-[#1B1B1B]">
                  <span>
                    {searchQuery.trim()
                      ? `Résultats pour « ${searchQuery} » (${filteredArticles.length})`
                      : `Pièces disponibles en stock (${filteredArticles.length})`}
                  </span>
                </div>

                <div className="divide-y divide-[#E5E5E5] max-h-[420px] overflow-y-auto bg-white">
                  {filteredArticles.length === 0 ? (
                    <div className="py-12 text-center text-[#1B1B1B]/40 space-y-1.5">
                      <Boxes className="w-8 h-8 mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-[#1B1B1B]">
                        Aucune pièce en stock ne correspond à votre recherche
                      </p>
                      <p className="text-xs">
                        Essayez un autre mot-clé ou changez le filtre de ciblage ci-dessus.
                      </p>
                    </div>
                  ) : (
                    filteredArticles.map((art) => {
                      const totalStock = getTotalStockForArticle(art.id);
                      const saleOptions = getSaleOptionsForArticle(art);

                      return (
                        <div key={art.id} className="px-4 py-3.5 bg-white space-y-2.5">
                          {/* En-tête de la référence article */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {showProductImages && (
                                <div
                                  onClick={(e) => {
                                    if (art.imageUrl) {
                                      e.stopPropagation();
                                      setImagePreviewUrl({
                                        url: art.imageUrl,
                                        title: art.designation,
                                        ref: art.mainReference,
                                      });
                                    }
                                  }}
                                  className="w-10 h-10 border border-[#E5E5E5] rounded bg-[#F9FAFB] flex items-center justify-center p-1 shrink-0 overflow-hidden cursor-pointer"
                                >
                                  {art.imageUrl ? (
                                    <img
                                      src={art.imageUrl}
                                      alt={art.designation}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-[#1B1B1B]/40" />
                                  )}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-semibold text-xs sm:text-sm px-2 py-0.5 bg-[#FFF5F1] text-[#E35E2D] rounded">
                                    {art.mainReference}
                                  </span>
                                  <span className="font-semibold text-sm text-[#1B1B1B] truncate">
                                    {art.designation}
                                  </span>
                                  <span className="font-mono font-semibold text-emerald-700 text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                    Stock total : {totalStock} {art.unit}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setDetailArticle(art)}
                              className="p-2 border border-[#E5E5E5] rounded bg-white text-[#1B1B1B] hover:border-[#E35E2D] transition-colors cursor-pointer shrink-0"
                              title="Ouvrir la fiche complète de la pièce (Modifier, Entrée, Sortie)"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Options distinctes : Marque | Magasin | Emplacement */}
                          <div className="space-y-1.5 pl-0 sm:pl-2">
                            {saleOptions.map((opt) => {
                              const canSellOption = opt.stockQty > 0 || isStockFrozen;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  disabled={!canSellOption}
                                  onClick={() => handleAddToCart(art, opt)}
                                  className={`w-full text-left px-3 py-2 rounded border transition-colors flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 group ${
                                    canSellOption
                                      ? 'bg-[#F9FAFB] hover:bg-[#FFF5F1] border-[#E5E5E5] hover:border-[#E35E2D] cursor-pointer'
                                      : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-w-0 items-center">
                                    {/* 1. Marque */}
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/45 shrink-0">
                                        Marque :
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1B1B1B] text-white font-semibold text-xs truncate">
                                        <Tag className="w-3 h-3 text-[#E35E2D] shrink-0" />
                                        <span className="truncate">{opt.brand}</span>
                                      </span>
                                    </div>

                                    {/* 2. Magasin */}
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/45 shrink-0">
                                        Magasin :
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E5E5E5] text-[#1B1B1B] font-semibold text-xs truncate">
                                        <Building2 className="w-3 h-3 text-[#E35E2D] shrink-0" />
                                        <span className="truncate">{opt.warehouseName}</span>
                                      </span>
                                    </div>

                                    {/* 3. Emplacement */}
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-semibold uppercase text-[#1B1B1B]/45 shrink-0">
                                        Empl. :
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E5E5E5] text-[#1B1B1B]/80 font-mono text-xs truncate">
                                        <MapPin className="w-3 h-3 text-[#E35E2D] shrink-0" />
                                        <span className="truncate">{opt.location}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                                    <span
                                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                                        opt.stockQty > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                                      }`}
                                    >
                                      {opt.stockQty} {art.unit}
                                    </span>

                                    <span className="font-mono font-bold text-xs sm:text-sm text-[#1B1B1B] tabular-nums min-w-[85px] text-right">
                                      {formatFCFA(opt.salePrice)}
                                    </span>

                                    <span
                                      className={`px-3 py-1.5 font-semibold text-xs rounded inline-flex items-center gap-1 transition-colors ${
                                        canSellOption
                                          ? 'bg-[#1B1B1B] group-hover:bg-[#E35E2D] text-white'
                                          : 'bg-slate-200 text-slate-500'
                                      }`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Choisir</span>
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================== */
        /* ÉTAT 2 : PRODUIT CHOISI -> BASCULE AUTOMATIQUE SUR LE MODÈLE 2     */
        /*          (MODE FACTURATION DIRECTE PLEINE LARGEUR : 1, 2, 3, 4)    */
        /* ================================================================== */
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Barre supérieure du Mode Facturation Directe */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E5E5E5] rounded-lg px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#E35E2D] text-white rounded flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[#1B1B1B] tracking-[-0.04em]">
                Facturation Directe
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraftList}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:border-[#E35E2D] text-[#1B1B1B] border border-[#E5E5E5] rounded inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Mettre cette vente en attente sans déduire le stock"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#E35E2D]" />
                <span>Mettre en attente</span>
              </button>

              {savedDrafts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSavedDraftsModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:border-[#E35E2D] text-[#1B1B1B] border border-[#E5E5E5] rounded inline-flex items-center gap-1.5 cursor-pointer"
                  title="Ouvrir les listes de vente mises en attente"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#E35E2D]" />
                  <span>En attente ({savedDrafts.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={resetSalePageAsNew}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:border-rose-500 text-rose-600 border border-[#E5E5E5] rounded inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Tout vider et revenir à l'écran de recherche initial"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RANGÉE HAUTE : 1. SÉLECTION DU CLIENT + 2. RECHERCHE DE PIÈCE  */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* BLOC 1 : 1. Sélection du Client (Champ recherche + liste fusionnés) */}
            <div className="lg:col-span-5 card bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3
                  className="font-display text-sm sm:text-base font-bold text-[#1B1B1B]"
                  title="Choisir un client comptoir (vente directe) ou un client en compte"
                >
                  1. Sélection du Client
                </h3>
              </div>

              {/* Sélecteur Type de Client */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F9FAFB] border border-[#E5E5E5] rounded text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerType('WALK_IN')}
                  title="Vente directe au comptoir sans ouverture de compte client"
                  className={`py-2 px-3 rounded font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    customerType === 'WALK_IN'
                      ? 'bg-[#1B1B1B]! text-white!'
                      : 'bg-transparent! text-[#1B1B1B]/70! hover:text-[#1B1B1B]!'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-[#E35E2D]" />
                  <span>Client Comptoir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerType('REGISTERED');
                    if (!selectedCustomerId) {
                      setIsCustomerDropdownOpen(true);
                    }
                  }}
                  title="Facturer un client enregistré dans le répertoire (avec suivi de créance)"
                  className={`py-2 px-3 rounded font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    customerType === 'REGISTERED'
                      ? 'bg-[#1B1B1B]! text-white!'
                      : 'bg-transparent! text-[#1B1B1B]/70! hover:text-[#1B1B1B]!'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#E35E2D]" />
                  <span>Client en Compte</span>
                </button>
              </div>

              {/* Champs Client selon le type choisi */}
              {customerType === 'WALK_IN' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1B1B1B]/60 mb-1">
                      Nom du client
                    </label>
                    <input
                      type="text"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      placeholder="Client Comptoir"
                      title="Nom ou raison sociale à afficher sur la facture"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded bg-[#F9FAFB] text-[#1B1B1B] font-medium focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1B1B1B]/60 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      placeholder="Ex: 77 000 00 00"
                      title="Numéro de téléphone du client (facultatif)"
                      className="w-full px-3 py-2 border border-[#E5E5E5] rounded bg-[#F9FAFB] text-[#1B1B1B] font-mono focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {selectedCustObj ? (
                    <div className="p-3 bg-[#FFF5F1] border border-[#E35E2D]/40 rounded flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-[#1B1B1B] text-xs sm:text-sm truncate">
                          {selectedCustObj.name}{' '}
                          <span className="font-mono text-[11px] text-[#1B1B1B]/60">
                            ({selectedCustObj.code})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#1B1B1B]/70 mt-0.5 font-mono">
                          Solde dû :{' '}
                          <strong
                            className={
                              selectedCustObj.outstandingBalance > 0
                                ? 'text-rose-600'
                                : 'text-emerald-700'
                            }
                          >
                            {formatFCFA(selectedCustObj.outstandingBalance)}
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerSearchQuery('');
                          setIsCustomerDropdownOpen(true);
                        }}
                        title="Changer de client en compte"
                        className="px-2.5 py-1.5 bg-white border border-[#E5E5E5] hover:border-[#E35E2D] rounded font-semibold text-[#1B1B1B] cursor-pointer shrink-0"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    /* Champ unique fusionné : Recherche + Sélection dans la liste */
                    <div className="relative" ref={customerComboboxRef}>
                      <label className="block text-[11px] font-semibold text-[#1B1B1B]/60 mb-1">
                        Client en compte
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#E35E2D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={customerSearchQuery}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          onChange={(e) => {
                            setCustomerSearchQuery(e.target.value);
                            setIsCustomerDropdownOpen(true);
                          }}
                          placeholder="Rechercher ou choisir un client dans la liste..."
                          title="Tapez un nom, un code ou un téléphone, ou cliquez pour dérouler la liste des clients"
                          className="w-full pl-9 pr-14 py-2 border border-[#E5E5E5] rounded bg-[#F9FAFB] text-[#1B1B1B] font-medium focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                        />
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          {customerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerSearchQuery('');
                                setIsCustomerDropdownOpen(true);
                              }}
                              title="Effacer la recherche"
                              className="p-1 text-[#1B1B1B]/50 hover:text-[#1B1B1B] bg-transparent! border-0! cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
                            title="Afficher la liste des clients"
                            className="p-1 text-[#1B1B1B]/60 hover:text-[#E35E2D] bg-transparent! border-0! cursor-pointer"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                isCustomerDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {isCustomerDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-40 max-h-56 overflow-y-auto divide-y divide-[#E5E5E5]">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-[#1B1B1B]/50">
                              Aucun client trouvé pour « {customerSearchQuery} »
                            </div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setCustomerSearchQuery('');
                                  setIsCustomerDropdownOpen(false);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-[#FFF5F1] bg-white! text-[#1B1B1B]! border-0! flex items-center justify-between gap-2 transition-colors cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-[#1B1B1B] truncate">
                                    {c.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-[#1B1B1B]/60 truncate">
                                    {c.code}
                                    {c.phone ? ` · ${c.phone}` : ''}
                                  </div>
                                </div>
                                <span
                                  className={`font-mono text-[11px] font-semibold shrink-0 tabular-nums ${
                                    c.outstandingBalance > 0
                                      ? 'text-rose-600'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  Dû: {formatFCFA(c.outstandingBalance)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BLOC 2 : 2. Recherche Rapide de Pièce */}
            <div className="lg:col-span-7 card bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between space-y-3 relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  className="font-display text-sm sm:text-base font-bold text-[#1B1B1B]"
                  title="Rechercher et ajouter une autre pièce à la facture"
                >
                  2. Ajouter une Pièce
                </h3>

                {/* Ciblage rapide + bouton catalogue en tooltip */}
                <div className="flex items-center gap-1.5">
                  {SEARCH_SCOPE_OPTIONS.slice(0, 4).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSearchScope(opt.id)}
                      title={`Cibler la recherche par : ${opt.label}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border ${
                        searchScope === opt.id
                          ? 'bg-[#E35E2D]! text-white! border-[#E35E2D]!'
                          : 'bg-[#F9FAFB]! text-[#1B1B1B]/70! border-[#E5E5E5] hover:border-[#E35E2D]'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsStep2SearchOpen((prev) => !prev)}
                    title={
                      isStep2SearchOpen
                        ? 'Masquer la liste rapide des pièces'
                        : 'Afficher la liste rapide des pièces disponibles'
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white! text-[#1B1B1B]! border border-[#E5E5E5] hover:border-[#E35E2D] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Catalogue</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isStep2SearchOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Champ de recherche */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#E35E2D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={step2SearchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsStep2SearchOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsStep2SearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Référence (ex: 1R-0716), désignation, marque..."
                  title="Tapez une référence ou désignation puis appuyez sur Entrée ou cliquez sur une pièce pour l'ajouter"
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium bg-[#F9FAFB] border border-[#E5E5E5] rounded text-[#1B1B1B] focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                />
                {(searchQuery || isStep2SearchOpen) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsStep2SearchOpen(false);
                    }}
                    title="Fermer la recherche"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1B1B1B]/50 hover:text-[#1B1B1B] bg-transparent! border-0! p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Menu déroulant instantané des résultats */}
                {(isStep2SearchOpen || searchQuery.trim().length > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E5E5E5] rounded-lg shadow-xl z-30 max-h-80 overflow-y-auto divide-y divide-[#E5E5E5]">
                    {filteredArticles.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#1B1B1B]/50">
                        Aucune pièce disponible pour « {searchQuery} »
                      </div>
                    ) : (
                      filteredArticles.map((art) => {
                        const stockQty = getTotalStockForArticle(art.id);
                        const saleOptions = getSaleOptionsForArticle(art);

                        return (
                          <div key={art.id} className="px-3.5 py-2.5 bg-white space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1 text-xs">
                                <span className="font-mono font-semibold text-[#E35E2D] shrink-0">
                                  {art.mainReference}
                                </span>
                                <span className="font-semibold text-[#1B1B1B] truncate">
                                  {art.designation}
                                </span>
                                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                                  Total : {stockQty}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDetailArticle(art)}
                                className="p-1 text-[#1B1B1B]/50 hover:text-[#1B1B1B] bg-transparent! border-0! rounded cursor-pointer shrink-0"
                                title="Voir fiche article"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1">
                              {saleOptions.map((opt) => {
                                const canSellOption = opt.stockQty > 0 || isStockFrozen;
                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    disabled={!canSellOption}
                                    onClick={() => handleAddToCart(art, opt)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded border text-xs flex flex-wrap items-center justify-between gap-2 transition-colors ${
                                      canSellOption
                                        ? 'bg-[#F9FAFB] hover:bg-[#FFF5F1] border-[#E5E5E5] hover:border-[#E35E2D] cursor-pointer'
                                        : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1B1B1B] text-white font-semibold text-[11px]">
                                        <Tag className="w-3 h-3 text-[#E35E2D]" />
                                        {opt.brand}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-[#E5E5E5] text-[#1B1B1B] font-semibold text-[11px]">
                                        <Building2 className="w-3 h-3 text-[#E35E2D]" />
                                        {opt.warehouseName}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-[#E5E5E5] text-[#1B1B1B]/75 font-mono text-[11px]">
                                        <MapPin className="w-3 h-3 text-[#E35E2D]" />
                                        {opt.location}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                      <span
                                        className={`font-mono text-[11px] font-bold ${
                                          opt.stockQty > 0 ? 'text-emerald-700' : 'text-rose-600'
                                        }`}
                                      >
                                        {opt.stockQty} {art.unit}
                                      </span>
                                      <strong className="font-mono text-[#1B1B1B] tabular-nums">
                                        {formatFCFA(opt.salePrice)}
                                      </strong>
                                      <span
                                        className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                                          canSellOption
                                            ? 'bg-[#1B1B1B] text-white'
                                            : 'bg-slate-200 text-slate-500'
                                        }`}
                                      >
                                        + Ajouter
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION CENTRALE PLEINE LARGEUR : 3. ARTICLES DE LA VENTE      */}
          {/* ============================================================== */}
          <div className="card bg-white border border-[#E5E5E5] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm sm:text-base font-bold text-[#1B1B1B]">
                3. Articles de la Vente ({totalCartUnits})
              </h3>

              {/* Bouton Options de Facture concis avec tooltip */}
              <button
                type="button"
                onClick={() => setShowExtraInvoiceOptions((prev) => !prev)}
                title={`Configurer la remise globale (${
                  computedGlobalDiscount > 0 ? `-${formatFCFA(computedGlobalDiscount)}` : '0 FCFA'
                }), la date de vente (${formatDate(saleDate)}) ou le N° de Bon de Commande`}
                className="px-3 py-1.5 rounded bg-[#F9FAFB] hover:border-[#E35E2D] border border-[#E5E5E5] text-xs font-semibold text-[#1B1B1B] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#E35E2D]" />
                <span>Options & Remise</span>
                {(computedGlobalDiscount > 0 || isBackdated) && (
                  <span className="font-mono text-[11px] text-[#E35E2D] font-bold">
                    {computedGlobalDiscount > 0 ? `-${formatFCFA(computedGlobalDiscount)}` : formatDate(saleDate)}
                  </span>
                )}
                {showExtraInvoiceOptions ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Tiroir repliable pour Remise globale, Date de vente & Notes */}
            {showExtraInvoiceOptions && (
              <div className="p-3.5 rounded bg-[#F9FAFB] border border-[#E5E5E5] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Remise Globale */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1B1B1B] flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-[#E35E2D]" />
                      Remise globale
                    </span>
                    <div className="inline-flex p-0.5 bg-white border border-[#E5E5E5] rounded text-[10px]">
                      <button
                        type="button"
                        onClick={() => setGlobalDiscountMode('PERCENT')}
                        className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                          globalDiscountMode === 'PERCENT'
                            ? 'bg-[#1B1B1B]! text-white!'
                            : 'bg-transparent! text-[#1B1B1B]/70!'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setGlobalDiscountMode('MANUAL')}
                        className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                          globalDiscountMode === 'MANUAL'
                            ? 'bg-[#1B1B1B]! text-white!'
                            : 'bg-transparent! text-[#1B1B1B]/70!'
                        }`}
                      >
                        FCFA
                      </button>
                    </div>
                  </div>
                  {globalDiscountMode === 'PERCENT' ? (
                    <NumericInput
                      min={0}
                      max={100}
                      value={globalDiscountPercent}
                      onChange={(val) =>
                        setGlobalDiscountPercent(Math.min(100, Math.max(0, val)))
                      }
                      placeholder="0 %"
                      className="w-full px-3 py-1.5 bg-white border border-[#E5E5E5] rounded text-right font-mono font-semibold"
                    />
                  ) : (
                    <NumericInput
                      min={0}
                      step={500}
                      value={globalDiscountManual}
                      onChange={(val) => setGlobalDiscountManual(Math.max(0, val))}
                      placeholder="0 FCFA"
                      className="w-full px-3 py-1.5 bg-white border border-[#E5E5E5] rounded text-right font-mono font-semibold"
                    />
                  )}
                </div>

                {/* Date de la vente */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1B1B1B] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#E35E2D]" />
                      Date de vente
                    </span>
                    {isBackdated && (
                      <button
                        type="button"
                        onClick={() => setSaleDate(new Date().toISOString().slice(0, 10))}
                        className="text-[10px] text-[#E35E2D] underline bg-transparent! border-0! cursor-pointer"
                      >
                        Aujourd'hui
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={saleDate}
                      max={new Date().toISOString().slice(0, 10)}
                      disabled={!canBackdateDirectly}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-[#E5E5E5] rounded font-mono font-semibold disabled:opacity-60"
                    />
                    {!canBackdateDirectly && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminApprovalError('');
                          setAdminPinInput('');
                          setSelectedAdminId(adminUsers[0]?.id || '');
                          setIsAdminApprovalModalOpen(true);
                        }}
                        title="Autorisation PIN Administrateur pour antidater"
                        className="px-2.5 py-1.5 bg-[#FFF5F1] text-[#E35E2D] border border-[#E35E2D]/30 font-semibold rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <LockIcon className="w-3.5 h-3.5" />
                        <span>PIN</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* N° BC & Observation */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-[#1B1B1B] block">
                    N° BC & Note
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                      placeholder="N° BC..."
                      title="Numéro de Bon de Commande client (facultatif)"
                      className="px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded font-mono"
                    />
                    <input
                      type="text"
                      value={saleNotes}
                      onChange={(e) => setSaleNotes(e.target.value)}
                      placeholder="Note / Engin..."
                      title="Observation ou affectation machine (facultatif)"
                      className="px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tableau Pleine Largeur */}
            <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
              <table className="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#1B1B1B]/70 text-[11px] font-semibold border-b border-[#E5E5E5]">
                    <th className="py-2.5 px-2.5 w-[12%]">Réf</th>
                    <th className="py-2.5 px-2.5 w-[18%]">Désignation</th>
                    <th className="py-2.5 px-2 w-[10%]">Marque</th>
                    <th className="py-2.5 px-2 w-[11%] hidden lg:table-cell">Magasin</th>
                    <th className="py-2.5 px-2 w-[9%] hidden xl:table-cell">Empl.</th>
                    <th className="py-2.5 px-2 text-center w-[14%]">Qté</th>
                    <th className="py-2.5 px-2 text-right w-[10%]">P.U</th>
                    <th className="py-2.5 px-2 text-center w-[8%]">Rem. %</th>
                    <th className="py-2.5 px-2.5 text-right w-[11%]">Total</th>
                    <th className="py-2.5 px-1.5 text-center w-[38px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] text-xs">
                  {cart.map((item, idx) => {
                    const brandOffers = getAllBrandOffersForArticle(item.article);
                    const activeBrand = item.selectedBrandOffer?.brand || item.article.brand;
                    const activeWhId = item.sourceWarehouseId || warehouseId;
                    const activeWhName =
                      item.sourceWarehouseName ||
                      warehouses.find((w) => w.id === activeWhId)?.name ||
                      defaultWarehouse?.name ||
                      'Magasin Principal';
                    const activeLocation =
                      item.sourceLocation ||
                      getPureWarehouseLocation(item.article, activeBrand, activeWhId);
                    const artStocks = stocksByArticleId.get(item.article.id) || [];
                    const currentWhStockObj = artStocks.find((s) => s.warehouseId === activeWhId);
                    const whBrandStock = currentWhStockObj
                      ? getBrandStockAcrossWarehouses(
                          [currentWhStockObj],
                          item.article,
                          activeBrand,
                          activeWhId
                        )
                      : 0;
                    const netLine = item.quantity * item.unitPrice - item.discountAmount;

                    return (
                      <tr
                        key={`${item.article.id}-${activeWhId}-${idx}`}
                        className="hover:bg-[#F9FAFB] transition-colors"
                      >
                        {/* Réf (cliquable pour ouvrir la fiche info) */}
                        <td className="py-2.5 px-2.5 font-mono font-semibold text-[#E35E2D] truncate">
                          <button
                            type="button"
                            onClick={() => setDetailArticle(item.article)}
                            className="hover:underline inline-flex items-center gap-1 max-w-full bg-transparent! border-0! text-[#E35E2D]! p-0! cursor-pointer"
                            title={`Cliquer pour consulter la fiche (${item.article.mainReference})`}
                          >
                            <span className="truncate">{item.article.mainReference}</span>
                            <Info className="w-3 h-3 text-[#1B1B1B]/40 shrink-0" />
                          </button>
                        </td>

                        {/* Désignation */}
                        <td className="py-2.5 px-2.5 font-medium text-[#1B1B1B] truncate" title={item.article.designation}>
                          {item.article.designation}
                        </td>

                        {/* Marque */}
                        <td className="py-2.5 px-2 truncate">
                          {brandOffers.length > 1 ? (
                            <select
                              value={item.selectedBrandOffer?.id || ''}
                              onChange={(e) => handleSelectBrandOffer(idx, e.target.value)}
                              title="Choisir la marque pour cette ligne"
                              className="w-full px-1.5 py-1 rounded bg-[#FFF5F1] text-[#E35E2D] font-semibold text-[11px] border border-[#E35E2D]/30 cursor-pointer"
                            >
                              {brandOffers.map((bo) => (
                                <option key={bo.id} value={bo.id}>
                                  {cleanBrandName(bo.brand) || '—'}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1B1B1B] text-white font-semibold text-[11px] max-w-full truncate">
                              <Tag className="w-2.5 h-2.5 text-[#E35E2D] shrink-0" />
                              <span className="truncate">{cleanBrandName(activeBrand) || '—'}</span>
                            </span>
                          )}
                        </td>

                        {/* Magasin */}
                        <td className="py-2.5 px-2 hidden lg:table-cell truncate">
                          {warehouses.length > 1 ? (
                            <select
                              value={activeWhId}
                              onChange={(e) => handleSelectWarehouse(idx, e.target.value)}
                              title="Choisir le magasin source pour cette ligne"
                              className="w-full px-1.5 py-1 rounded bg-white text-[#1B1B1B] font-semibold text-[11px] border border-[#E5E5E5] hover:border-[#E35E2D] cursor-pointer"
                            >
                              {warehouses.map((wh) => {
                                const st = artStocks.find((s) => s.warehouseId === wh.id);
                                const qtyWh = st
                                  ? getBrandStockAcrossWarehouses(
                                      [st],
                                      item.article,
                                      activeBrand,
                                      wh.id
                                    )
                                  : 0;
                                return (
                                  <option key={wh.id} value={wh.id}>
                                    {wh.name} ({qtyWh})
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B1B1B] truncate">
                              <Building2 className="w-3 h-3 text-[#E35E2D] shrink-0" />
                              <span className="truncate">{activeWhName}</span>
                            </span>
                          )}
                        </td>

                        {/* Emplacement */}
                        <td className="py-2.5 px-2 font-mono text-[11px] text-[#1B1B1B]/75 hidden xl:table-cell truncate" title={activeLocation}>
                          <span className="inline-flex items-center gap-1 truncate max-w-full">
                            <MapPin className="w-3 h-3 text-[#E35E2D] shrink-0" />
                            <span className="truncate">{activeLocation}</span>
                          </span>
                        </td>

                        {/* Quantité */}
                        <td className="py-2.5 px-1.5">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                                title="Diminuer la quantité"
                                className="w-6 h-6 rounded border border-[#E5E5E5] bg-white! hover:border-[#E35E2D] text-[#1B1B1B]! flex items-center justify-center font-semibold cursor-pointer p-0! shrink-0"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <NumericInput
                                min={1}
                                max={getTotalStockForArticle(item.article.id)}
                                value={item.quantity}
                                onChange={(val) =>
                                  handleUpdateQuantity(idx, Math.max(1, Math.floor(val)))
                                }
                                placeholder="1"
                                className="w-12 text-center font-mono font-bold text-sm py-1 border border-[#E5E5E5] rounded bg-[#F9FAFB] text-[#1B1B1B] focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                                title="Augmenter la quantité"
                                className="w-7 h-7 rounded border border-[#E5E5E5] bg-white! hover:border-[#E35E2D] text-[#1B1B1B]! flex items-center justify-center font-semibold cursor-pointer p-0!"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {!isStockFrozen && whBrandStock > 0 && item.quantity > whBrandStock && (
                              <span
                                className="text-[10px] font-mono text-amber-700 mt-0.5"
                                title="La quantité demandée dépasse le stock de ce magasin ; le surplus sera prélevé sur un autre dépôt."
                              >
                                Dépôt : {whBrandStock} dispo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Prix Unitaire FCFA */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[#1B1B1B] whitespace-nowrap tabular-nums">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <span>{item.unitPrice.toLocaleString('fr-FR')}</span>
                            {currentPermissions.canOverridePrice && (
                              <button
                                type="button"
                                onClick={() => handleOpenPriceOverride(idx)}
                                className="p-1 text-[#1B1B1B]/40 hover:text-[#E35E2D] bg-transparent! border-0! rounded cursor-pointer"
                                title="Modifier le prix unitaire"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Remise (%) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-0.5">
                            <NumericInput
                              min={0}
                              max={100}
                              value={item.discountPercent}
                              onChange={(val) =>
                                handleUpdateDiscountPercent(
                                  idx,
                                  Math.min(100, Math.max(0, val))
                                )
                              }
                              placeholder="0"
                              className="w-12 px-1.5 py-1 text-center font-mono font-semibold text-xs border border-[#E5E5E5] rounded bg-[#F9FAFB]"
                            />
                            <span className="text-xs font-semibold text-[#1B1B1B]/50">%</span>
                          </div>
                        </td>

                        {/* Total Ligne FCFA */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1B1B1B] whitespace-nowrap tabular-nums">
                          {netLine.toLocaleString('fr-FR')}
                        </td>

                        {/* Bouton Supprimer [x] */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-7 h-7 rounded border border-rose-200 bg-rose-50! hover:bg-rose-100! text-rose-600! inline-flex items-center justify-center cursor-pointer transition-colors p-0!"
                            title="Retirer cette ligne de la vente"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 4. RÈGLEMENT & VALIDATION — MÊME MODÈLE QUE LES AUTRES DIVS    */}
          {/* ============================================================== */}
          <div className="card bg-white border border-[#E5E5E5] rounded-lg p-5 text-[#1B1B1B]">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              {/* Gauche : 4. Règlement & Validation + Modes de paiement */}
              <div className="space-y-2.5">
                <h3
                  className="font-display text-sm sm:text-base font-bold text-[#1B1B1B]"
                  title="Choisir le mode d'encaissement et valider la facture"
                >
                  4. Règlement & Validation
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'ESPECES', label: 'Espèces', tip: 'Encaissement en espèces au tiroir-caisse' },
                      { id: 'WAVE', label: 'Wave', tip: 'Paiement mobile par Wave' },
                      { id: 'ORANGE_MONEY', label: 'Orange Money', tip: 'Paiement mobile par Orange Money' },
                      { id: 'CARTE', label: 'Carte / Virement', tip: 'Paiement par carte bancaire ou virement' },
                      { id: 'CREDIT', label: 'Crédit', tip: 'Vente à crédit (imputée sur le compte du client)' },
                    ] as const
                  ).map((m) => {
                    const isActive = activeSingleMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setExactTender(m.id)}
                        title={m.tip}
                        className={`px-3.5 py-2 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#1B1B1B]! text-white! border-[#1B1B1B]!'
                            : 'bg-[#F9FAFB]! hover:bg-white! text-[#1B1B1B]! border-[#E5E5E5] hover:border-[#E35E2D]'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Centre : Montant reçu & Monnaie / Reste */}
              <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
                <div className="w-40 sm:w-44">
                  <label className="block text-[11px] font-semibold text-[#1B1B1B]/60 mb-1">
                    Montant reçu
                  </label>
                  {activeSingleMethod === 'CREDIT' ? (
                    <div
                      className="px-3 py-2 rounded bg-[#F9FAFB] border border-[#E5E5E5] font-mono font-bold text-sm text-rose-600 text-right"
                      title="Vente enregistrée intégralement en créance client"
                    >
                      Créance (0 F)
                    </div>
                  ) : (
                    <NumericInput
                      min={0}
                      step={500}
                      value={tenders[0]?.amount ?? 0}
                      onChange={(val) => handleUpdatePrimaryTenderAmount(val)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 rounded bg-[#F9FAFB] border border-[#E5E5E5] font-mono font-bold text-sm text-[#1B1B1B] text-right focus:bg-white focus:outline-none focus:border-[#E35E2D]"
                    />
                  )}
                </div>

                <div className="w-44 sm:w-48">
                  <label className="block text-[11px] font-semibold text-[#1B1B1B]/60 mb-1">
                    {remainingBalanceDue > 0 ? 'Reste à payer' : 'Monnaie à rendre'}
                  </label>
                  <div
                    className={`px-3.5 py-2 rounded bg-[#F9FAFB] border border-[#E5E5E5] font-mono font-bold text-sm text-right tabular-nums ${
                      remainingBalanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {remainingBalanceDue > 0
                      ? formatFCFA(remainingBalanceDue)
                      : formatFCFA(changeToReturn)}
                  </div>
                </div>
              </div>

              {/* Droite : TOTAL À PAYER + Bouton Valider */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 pt-3 xl:pt-0 border-t xl:border-t-0 border-[#E5E5E5]">
                <div className="text-right">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60">
                    Total à payer
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold font-mono text-[#1B1B1B] tabular-nums">
                    {formatFCFA(netTotal)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={cart.length === 0 || isSubmitting}
                  onClick={handleValidateSale}
                  title="Valider la vente et afficher la facture pour impression"
                  className="px-5 py-3 rounded bg-[#E35E2D]! hover:bg-[#C94D1E]! disabled:opacity-50 text-white! font-semibold text-xs sm:text-sm border-0! transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>
                    {isSubmitting ? 'Validation...' : 'Valider & Facturer'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODALES SECONDAIRES (LISTES EN ATTENTE, PRIX, CONFIRMATION, REÇU)  */}
      {/* ================================================================== */}
      {isSavedDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-lg">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Listes de vente en attente ({savedDrafts.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ces listes n'impactent pas le stock tant qu'elles ne sont pas validées.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSavedDraftsModalOpen(false);
                  setDraftToDeleteId(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
              {savedDrafts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Aucune liste en attente enregistrée pour le moment.
                </div>
              ) : (
                savedDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            {draft.id}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {draft.customerDisplayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>Enregistrée le {formatDateTime(draft.createdAt)}</span>
                          <span>·</span>
                          <span>
                            {draft.items.reduce((s, i) => s + i.quantity, 0)} pièce(s)
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="block text-[10px] uppercase text-slate-400 font-bold">
                          Total à payer
                        </span>
                        <span className="font-mono font-extrabold text-sm text-emerald-700">
                          {formatFCFA(draft.netTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {draft.items.map((it, idx) => {
                        const art = articles.find((a) => a.id === it.articleId);
                        return (
                          <span
                            key={`${draft.id}-item-${idx}`}
                            className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700"
                          >
                            <strong>{it.quantity}x</strong> {art?.mainReference || it.articleId}
                          </span>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-end gap-2">
                      {draftToDeleteId === draft.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-rose-700 font-semibold">Confirmer ?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedDraft(draft.id)}
                            className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                          >
                            Oui, supprimer
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraftToDeleteId(null)}
                            className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setDraftToDeleteId(draft.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreDraftList(draft)}
                            className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Ouvrir dans la facturation</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price Override Modal */}
      {overrideItemIndex !== null && cart[overrideItemIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Modifier le prix unitaire de la pièce
            </h3>
            <p className="text-xs text-slate-500">
              Pièce : {cart[overrideItemIndex].article.mainReference} (Prix catalogue :{' '}
              {formatFCFA(cart[overrideItemIndex].catalogPrice)})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nouveau prix unitaire (FCFA)
              </label>
              <NumericInput
                min={0}
                step={500}
                value={overridePriceInput}
                onChange={(val) => setOverridePriceInput(val)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Motif (facultatif)
              </label>
              <input
                type="text"
                value={overrideReasonInput}
                onChange={(e) => setOverrideReasonInput(e.target.value)}
                placeholder="Ex: Accord commercial..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOverrideItemIndex(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleApplyPriceOverride}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold cursor-pointer"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal — Closing it refreshes the POS page back to State 1 */}
      <ReceiptModal
        sale={completedSale}
        initialFormat={receiptFormat}
        onClose={() => {
          setCompletedSale(null);
          resetSalePageAsNew();
        }}
      />

      {/* Product Image Lightbox Modal */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setImagePreviewUrl(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <span className="font-mono font-extrabold text-sm text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                  {imagePreviewUrl.ref}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 truncate">
                  {imagePreviewUrl.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImagePreviewUrl(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50 rounded-xl my-3 border border-slate-100">
              <img
                src={imagePreviewUrl.url}
                alt={imagePreviewUrl.title}
                className="max-h-[380px] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal d'approbation Administrateur pour Antidater une vente */}
      {isAdminApprovalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <LockIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Approbation Administrateur</h3>
                  <p className="text-[11px] text-slate-500">
                    Autorisation requise pour antidater une vente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminApprovalModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminApprovalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {adminApprovalError}
              </div>
            )}

            <form onSubmit={handleAdminApprovalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Administrateur Référent
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold"
                >
                  {adminUsers.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      {adm.name} ({adm.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Code PIN Administrateur
                </label>
                <input
                  type="password"
                  maxLength={8}
                  autoFocus
                  required
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="Code PIN..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center font-mono text-base font-bold tracking-widest"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdminApprovalModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Autoriser</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmation de Validation de Vente */}
      {isConfirmSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Confirmer la validation de la vente
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    La facture sera affichée immédiatement et la page sera remise à neuf
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmSaleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Client :</span>
                <span className="font-bold text-slate-900">
                  {customerType === 'REGISTERED' && selectedCustObj
                    ? selectedCustObj.name
                    : walkInName.trim() || 'Client Comptoir'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date :</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatDate(saleDate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Articles :</span>
                <span className="font-mono font-bold text-slate-900">
                  {totalCartUnits} pièce(s)
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total à Payer :</span>
                  <span className="font-mono text-amber-600">{formatFCFA(netTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Montant encaissé :</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatFCFA(Math.min(totalTendered, netTotal))}
                  </span>
                </div>
                {remainingBalanceDue > 0 && (
                  <div className="flex justify-between items-center text-rose-600 font-bold">
                    <span>Reste dû (Créance) :</span>
                    <span className="font-mono">{formatFCFA(remainingBalanceDue)}</span>
                  </div>
                )}
                {changeToReturn > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold">
                    <span>Monnaie à rendre :</span>
                    <span className="font-mono">{formatFCFA(changeToReturn)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmSaleModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={executeConfirmedSale}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer & Afficher la Facture</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails Article */}
      {detailArticle && (
        <ArticleDetailModal
          article={detailArticle}
          onClose={() => setDetailArticle(null)}
          onOpenStockIn={(articleId) => {
            setDetailArticle(null);
            if (onOpenStockIn) onOpenStockIn(articleId);
          }}
          onOpenStockOut={(articleId) => {
            setDetailArticle(null);
            if (onOpenStockOut) onOpenStockOut(articleId);
          }}
          onEditArticle={(art) => {
            setDetailArticle(null);
            setEditingArticle(art);
          }}
          onQuickEditStock={(art, brand) => {
            setDetailArticle(null);
            setQuickEditTarget({
              article: art,
              brand,
              warehouseId: selectedWarehouseId,
            });
          }}
          onOpenPurchaseOrder={
            onOpenPurchaseOrder
              ? (articleId, brand) => {
                  setDetailArticle(null);
                  onOpenPurchaseOrder(articleId, brand);
                }
              : undefined
          }
          onNavigateToPurchaseOrder={
            onNavigateToPurchaseOrder
              ? (orderId) => {
                  setDetailArticle(null);
                  onNavigateToPurchaseOrder(orderId);
                }
              : undefined
          }
        />
      )}

      {editingArticle && (
        <ArticleFormModal
          isOpen={true}
          articleToEdit={editingArticle}
          onClose={() => setEditingArticle(null)}
          onSubmit={(data) => {
            const res = updateArticle(editingArticle.id, data);
            if (res.success) {
              setEditingArticle(null);
              setSuccessBanner(`Fiche "${data.mainReference}" mise à jour.`);
            }
            return res;
          }}
        />
      )}

      {quickEditTarget && (
        <QuickStockEditModal
          article={quickEditTarget.article}
          initialBrand={quickEditTarget.brand}
          warehouseId={quickEditTarget.warehouseId || selectedWarehouseId}
          onClose={() => setQuickEditTarget(null)}
          onSaved={(msg) => {
            setQuickEditTarget(null);
            setSuccessBanner(msg);
          }}
        />
      )}
    </div>
  );
};
