import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { Article, ArticleBrandOffer, Customer, PaymentMethod, Sale } from '../../types';
import { formatFCFA } from '../../utils/formatters';
import {
  getArticleBrandOffers,
  getDefaultBrandOffer,
  formatSalePriceRange,
} from '../../utils/articleHelpers';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  User,
  CreditCard,
  QrCode,
  Smartphone,
  Banknote,
  Building,
  ShieldCheck,
  Edit2,
  X,
  ArrowRight,
  Boxes,
  Barcode,
  Printer,
  FileCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';

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
}

interface TenderEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
}

export const NewSaleView: React.FC = () => {
  const {
    articles,
    warehouses,
    customers,
    selectedWarehouseId,
    getStockForArticleAndWarehouse,
    recordSale,
    getActiveCashSession,
    currentUser,
  } = useStock();

  // Active selling warehouse
  const [warehouseId, setWarehouseId] = useState<string>(
    selectedWarehouseId ||
      (currentUser.role === 'MAGASINIER' && currentUser.assignedWarehouseId
        ? currentUser.assignedWarehouseId
        : warehouses[0]?.id || '')
  );

  // Search & Article selection
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer selection
  const [customerType, setCustomerType] = useState<'REGISTERED' | 'WALK_IN'>('WALK_IN');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [walkInName, setWalkInName] = useState('Client Comptoir');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Payment Tenders
  const [tenders, setTenders] = useState<TenderEntry[]>([
    { method: 'ESPECES', amount: 0 },
  ]);

  // Form submission state & modals
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<'THERMAL' | 'A4' | 'BL'>('THERMAL');

  // Barcode / Douchette Scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeSuccess, setBarcodeSuccess] = useState<string | null>(null);

  // Price override modal state
  const [overrideItemIndex, setOverrideItemIndex] = useState<number | null>(null);
  const [overridePriceInput, setOverridePriceInput] = useState<number>(0);
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  const activeWarehouse = warehouses.find((w) => w.id === warehouseId);
  const activeCashSession = getActiveCashSession(warehouseId);

  // Filtered articles for fast picker
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) {
      return articles.slice(0, 8); // show popular 8 articles by default
    }
    const q = searchQuery.toLowerCase().trim();
    return articles
      .filter((art) => {
        if (art.status !== 'active') return false;
        const matchMain = art.mainReference.toLowerCase().includes(q);
        const matchDesig = art.designation.toLowerCase().includes(q);
        const matchBrand = art.brand.toLowerCase().includes(q);
        const matchEq = art.equivalentReferences?.some((eq) => eq.toLowerCase().includes(q));
        const matchMach = art.compatibleMachines?.some((m) => m.toLowerCase().includes(q));
        return matchMain || matchDesig || matchBrand || matchEq || matchMach;
      })
      .slice(0, 10);
  }, [articles, searchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.discountAmount, 0);
  }, [cart]);

  const netTotal = Math.max(0, subtotal - totalDiscount);

  const totalTendered = useMemo(() => {
    return tenders.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [tenders]);

  const remainingBalanceDue = Math.max(0, netTotal - totalTendered);
  const changeToReturn = totalTendered > netTotal ? totalTendered - netTotal : 0;

  // Add article to cart with multi-warehouse support
  const handleAddToCart = (article: Article, preferredWhId?: string) => {
    setErrorMessage('');
    let targetWhId = preferredWhId || warehouseId;
    let availableStock = getStockForArticleAndWarehouse(article.id, targetWhId);

    // If target warehouse has 0 stock, check if any other warehouse in the network has stock
    if (availableStock <= 0) {
      const whWithStock = warehouses.find(
        (w) => getStockForArticleAndWarehouse(article.id, w.id) > 0
      );
      if (whWithStock) {
        targetWhId = whWithStock.id;
        setWarehouseId(whWithStock.id);
        availableStock = getStockForArticleAndWarehouse(article.id, whWithStock.id);
      } else {
        setErrorMessage(
          `Rupture réseau : "${article.mainReference}" (${article.designation}) est épuisé dans l'ensemble des magasins (${warehouses.map((w) => w.code).join(', ')}).`
        );
        return;
      }
    } else if (preferredWhId && preferredWhId !== warehouseId) {
      setWarehouseId(preferredWhId);
    }

    const targetWh = warehouses.find((w) => w.id === targetWhId);
    const existingIndex = cart.findIndex((i) => i.article.id === article.id);
    const offers = getArticleBrandOffers(article);
    const defaultOffer = getDefaultBrandOffer(article) || offers[0];
    const initialPrice = defaultOffer ? defaultOffer.salePrice : article.salePrice;

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (existing.quantity + 1 > availableStock) {
        setErrorMessage(
          `Stock maximum atteint (${availableStock} ${article.unit}) dans ${targetWh?.name} pour ${article.mainReference}.`
        );
        return;
      }
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
          selectedBrandOffer: defaultOffer,
        },
      ]);
    }
  };

  // Switch brand offer on a cart item
  const handleSelectBrandOffer = (index: number, brandOfferId: string) => {
    const item = cart[index];
    const offers = getArticleBrandOffers(item.article);
    const offer = offers.find((o) => o.id === brandOfferId) || offers[0];
    const updated = [...cart];
    const newUnitPrice = offer.salePrice;
    const rawLine = item.quantity * newUnitPrice;
    const discAmt =
      item.discountPercent > 0
        ? Math.round((rawLine * item.discountPercent) / 100)
        : item.discountAmount;

    updated[index] = {
      ...item,
      selectedBrandOffer: offer,
      catalogPrice: offer.salePrice,
      unitPrice: item.isPriceOverridden ? item.unitPrice : offer.salePrice,
      discountAmount: discAmt,
    };
    setCart(updated);
  };

  // Barcode / Douchette Scanner submission handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!barcodeInput.trim()) return;

    const term = barcodeInput.trim().toLowerCase();
    const matched = articles.find(
      (a) =>
        a.status === 'active' &&
        (a.barcode?.toLowerCase() === term ||
          a.mainReference.toLowerCase() === term ||
          a.equivalentReferences?.some((eq) => eq.toLowerCase() === term))
    );

    if (matched) {
      handleAddToCart(matched);
      setBarcodeSuccess(`Pièce identifiée : ${matched.mainReference} (${matched.designation})`);
      setBarcodeInput('');
      setTimeout(() => setBarcodeSuccess(null), 3000);
    } else {
      setErrorMessage(`Aucune pièce trouvée pour le code scanné : "${barcodeInput}".`);
      setBarcodeInput('');
    }
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    const item = cart[index];
    const available = getStockForArticleAndWarehouse(item.article.id, warehouseId);

    if (newQty > available) {
      setErrorMessage(
        `Quantité demandée (${newQty}) supérieure au stock disponible (${available} ${item.article.unit}).`
      );
      return;
    }

    const updated = [...cart];
    const rawLine = newQty * item.unitPrice;
    const discAmt =
      item.discountPercent > 0
        ? Math.round((rawLine * item.discountPercent) / 100)
        : item.discountAmount;

    updated[index] = {
      ...item,
      quantity: newQty,
      discountAmount: discAmt,
    };
    setCart(updated);
  };

  const handleUpdateDiscount = (index: number, percent: number) => {
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

  // Price override handlers
  const handleOpenPriceOverride = (index: number) => {
    if (currentUser.role === 'MAGASINIER') {
      setErrorMessage('La modification manuelle de prix requiert une autorisation Responsable ou Administrateur.');
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
        : item.discountAmount;

    updated[overrideItemIndex] = {
      ...item,
      unitPrice: overridePriceInput,
      isPriceOverridden: isOverridden,
      overriddenReason: isOverridden ? overrideReasonInput || 'Ajustement tarifaire commercial' : undefined,
      discountAmount: discAmt,
    };

    setCart(updated);
    setOverrideItemIndex(null);
  };

  // Quick tender setters
  const setExactTender = (method: PaymentMethod) => {
    setTenders([{ method, amount: netTotal }]);
  };

  const handleAddTenderRow = () => {
    setTenders([...tenders, { method: 'WAVE', amount: remainingBalanceDue }]);
  };

  const handleRemoveTenderRow = (idx: number) => {
    if (tenders.length > 1) {
      setTenders(tenders.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateTenderAmount = (idx: number, amt: number) => {
    const updated = [...tenders];
    updated[idx] = { ...updated[idx], amount: Math.max(0, amt) };
    setTenders(updated);
  };

  const handleUpdateTenderMethod = (idx: number, method: PaymentMethod) => {
    const updated = [...tenders];
    updated[idx] = { ...updated[idx], method };
    setTenders(updated);
  };

  // Final submit handler with double-click protection
  const handleValidateSale = () => {
    if (isSubmitting) return; // Anti-double click protection!
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Veuillez ajouter au moins un article dans le panier.');
      return;
    }

    if (remainingBalanceDue > 0 && customerType !== 'REGISTERED') {
      setErrorMessage(
        `Une vente avec solde impayé (créance de ${remainingBalanceDue.toLocaleString()} FCFA) exige obligatoirement de sélectionner un client régulier enregistré.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedCust =
        customerType === 'REGISTERED' ? customers.find((c) => c.id === selectedCustomerId) : null;

      const customerName =
        customerType === 'REGISTERED' && selectedCust
          ? selectedCust.name
          : walkInName.trim() || 'Client Comptoir Occasionnel';

      const customerPhone =
        customerType === 'REGISTERED' && selectedCust
          ? selectedCust.phone
          : walkInPhone.trim() || undefined;

      // Filter non-zero tenders
      const validPayments = tenders.filter((t) => t.amount > 0);

      const result = recordSale({
        warehouseId,
        customerId: customerType === 'REGISTERED' ? selectedCustomerId : undefined,
        customerName,
        customerPhone,
        items: cart.map((c) => ({
          articleId: c.article.id,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discountPercent: c.discountPercent,
          discountAmount: c.discountAmount,
          isPriceOverridden: c.isPriceOverridden,
          overriddenReason: c.overriddenReason,
          selectedBrandOfferId: c.selectedBrandOffer?.id,
        })),
        payments: validPayments,
        notes: (orderRef ? `Réf: ${orderRef}. ` : '') + (saleNotes ? saleNotes : ''),
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Erreur lors de la validation de la vente.');
        setIsSubmitting(false);
      } else if (result.sale) {
        // Success: clear cart and open receipt modal
        setCart([]);
        setTenders([{ method: 'ESPECES', amount: 0 }]);
        setOrderRef('');
        setSaleNotes('');
        setIsSubmitting(false);
        setCompletedSale(result.sale);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur inattendue est survenue.');
      setIsSubmitting(false);
    }
  };

  const selectedCustObj = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-4">
      {/* Top Banner & Warehouse / Cash Session Indicator */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Point de Vente & Caisse Comptoir
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Saisie rapide de vente pour pièces d'engins</span>
              <span>·</span>
              <span className="font-mono">Devise : FCFA</span>
            </div>
          </div>
        </div>

        {/* Warehouse selector + Cash Session Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setCart([]); // Reset cart if changing warehouse to prevent stock discrepancies
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeCashSession
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
            title={
              activeCashSession
                ? `Caisse ${activeCashSession.id} ouverte par ${activeCashSession.openedByUserName}`
                : 'Aucune session de caisse ouverte sur ce magasin'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeCashSession ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>{activeCashSession ? 'Caisse Ouverte' : 'Caisse Non Ouverte'}</span>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (7 cols): Article Search & Catalog Picker */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barcode / Douchette Quick Scanner Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xs border border-slate-800">
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
              <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shrink-0">
                <Barcode className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scanner douchette ou réf exacte (ex: 1R-0716, P551313) + [Entrée]..."
                  className="w-full bg-slate-800 text-white placeholder-slate-400 text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors shrink-0"
              >
                Ajouter
              </button>
            </form>
            {barcodeSuccess && (
              <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{barcodeSuccess}</span>
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une pièce : Réf constructeur (1R-0716), Donaldson (P551313), engin (CAT 336)..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Articles Grid Picker */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <span>Pièces disponibles ({filteredArticles.length})</span>
              <span>Cliquez pour ajouter au panier</span>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="py-14 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                <p className="text-xs font-semibold text-slate-700">Aucune pièce disponible</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Le catalogue est actuellement vide ou aucun article ne correspond à votre recherche.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {filteredArticles.map((art) => {
                  const totalNetworkStock = warehouses.reduce(
                    (sum, w) => sum + getStockForArticleAndWarehouse(art.id, w.id),
                    0
                  );
                  const stockInWh = getStockForArticleAndWarehouse(art.id, warehouseId);
                  const isOutOfStock = totalNetworkStock <= 0;
                  const inCart = cart.find((i) => i.article.id === art.id);

                  return (
                    <div
                      key={art.id}
                      onClick={() => !isOutOfStock && handleAddToCart(art)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isOutOfStock
                          ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                          : inCart
                          ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start gap-2.5">
                          {/* Article photo / thumbnail */}
                          {art.imageUrl ? (
                            <img
                              src={art.imageUrl}
                              alt={art.designation}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-mono font-bold text-sm text-slate-900 block truncate">
                                {art.mainReference}
                              </span>
                              <span className="text-[10px] text-slate-700 font-semibold uppercase bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {art.brand}
                                {art.brandOffers && art.brandOffers.length > 1 && ` (+${art.brandOffers.length - 1})`}
                              </span>
                            </div>
                            <h4 className="text-xs text-slate-700 font-medium line-clamp-1 mt-0.5" title={art.designation}>
                              {art.designation}
                            </h4>

                            {/* Cross references pill */}
                            {art.equivalentReferences && art.equivalentReferences.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                Éq: {art.equivalentReferences.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Multi-Warehouse Stock Availability Bar */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="text-slate-500 font-medium">Stock par magasin :</span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                totalNetworkStock <= 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : totalNetworkStock <= art.minStockThreshold
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              Total : {totalNetworkStock} {art.unit}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {warehouses.map((wh) => {
                              const whStock = getStockForArticleAndWarehouse(art.id, wh.id);
                              const isCurrentWh = wh.id === warehouseId;
                              const hasStock = whStock > 0;

                              return (
                                <button
                                  key={wh.id}
                                  type="button"
                                  disabled={!hasStock}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (hasStock) {
                                      handleAddToCart(art, wh.id);
                                    }
                                  }}
                                  title={
                                    hasStock
                                      ? `Ajouter 1 ${art.unit} depuis ${wh.name} (${whStock} dispo)`
                                      : `Rupture dans ${wh.name}`
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                                    hasStock
                                      ? isCurrentWh
                                        ? 'bg-slate-900 text-white font-bold shadow-xs hover:bg-slate-800'
                                        : 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                  }`}
                                >
                                  <span>{wh.code}:</span>
                                  <span>{whStock}</span>
                                  {hasStock && <Plus className="w-2.5 h-2.5 opacity-75" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          {formatSalePriceRange(art)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {stockInWh > 0 ? (
                            <span className="text-[11px] font-mono text-slate-600">
                              Magasin actuel: <strong className="text-slate-900">{stockInWh}</strong>
                            </span>
                          ) : totalNetworkStock > 0 ? (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Dispo autre magasin
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              Rupture réseau
                            </span>
                          )}

                          {inCart && (
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-mono text-[10px] font-bold">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Shopping Cart, Customer & Checkout */}
        <div className="lg:col-span-5 space-y-4">
          {/* Cart Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Panier ({cart.reduce((sum, i) => sum + i.quantity, 0)} articles)
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  Vider
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-3 divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Aucun article sélectionné. Cliquez sur une pièce à gauche pour l'ajouter.
                </div>
              ) : (
                cart.map((item, idx) => {
                  const brandOffers = getArticleBrandOffers(item.article);
                  return (
                    <div key={`${item.article.id}-${idx}`} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 truncate">
                              {item.article.mainReference}
                            </span>
                            {brandOffers.length > 1 ? (
                              <select
                                value={item.selectedBrandOffer?.id || ''}
                                onChange={(e) => handleSelectBrandOffer(idx, e.target.value)}
                                className="text-[10px] text-amber-900 bg-amber-50 border border-amber-300 font-bold rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
                                title="Changer la marque vendue pour cette référence"
                              >
                                {brandOffers.map((bo) => (
                                  <option key={bo.id} value={bo.id}>
                                    {bo.brand} · {bo.salePrice.toLocaleString()} F
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-semibold uppercase">
                                {item.selectedBrandOffer?.brand || item.article.brand}
                              </span>
                            )}
                            {item.isPriceOverridden && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                                Prix modifié
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {item.article.designation}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-300 hover:text-rose-600 p-0.5"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    {/* Quantity Stepper & Price Controls */}
                    <div className="flex items-center justify-between text-xs">
                      {/* Stepper */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={getStockForArticleAndWarehouse(item.article.id, warehouseId)}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(idx, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-12 text-center text-xs font-mono font-bold py-1 border-x border-slate-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Unit Price & Line Total */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {formatFCFA(item.quantity * item.unitPrice - item.discountAmount)}
                          </span>
                          {currentUser.role !== 'MAGASINIER' && (
                            <button
                              type="button"
                              onClick={() => handleOpenPriceOverride(idx)}
                              className="text-slate-400 hover:text-slate-800 p-0.5"
                              title="Ajuster le prix unitaire"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatFCFA(item.unitPrice)} / {item.article.unit}
                        </div>
                      </div>
                    </div>

                    {/* Discount row toggle */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Remise ligne :</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={item.discountPercent || ''}
                          onChange={(e) =>
                            handleUpdateDiscount(idx, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-12 px-1.5 py-0.5 text-right font-mono border border-slate-200 rounded text-[10px]"
                        />
                        <span>%</span>
                        {item.discountAmount > 0 && (
                          <span className="text-emerald-700 font-mono text-[10px]">
                            (-{formatFCFA(item.discountAmount)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Subtotals & Net Amount */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total brut :</span>
                <span className="font-mono">{formatFCFA(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Remises déduites :</span>
                  <span className="font-mono">-{formatFCFA(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>NET À PAYER :</span>
                <span className="font-mono">{formatFCFA(netTotal)}</span>
              </div>
            </div>
          </div>

          {/* Customer Selection Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Client & Coordonnées
              </span>
              <div className="inline-flex p-0.5 bg-slate-100 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setCustomerType('WALK_IN')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    customerType === 'WALK_IN' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Occasionnel
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('REGISTERED')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    customerType === 'REGISTERED' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Compte Client
                </button>
              </div>
            </div>

            {customerType === 'WALK_IN' ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Nom client ou chauffeur"
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="Téléphone (ex: 77 123 45 67)"
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-800 bg-white"
                >
                  <option value="">Sélectionner un client...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - Dû: {formatFCFA(c.outstandingBalance)}
                    </option>
                  ))}
                </select>

                {selectedCustObj && (
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] flex justify-between">
                    <div>
                      <span className="text-slate-500 block">Créance en cours :</span>
                      <span
                        className={`font-mono font-bold ${
                          selectedCustObj.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatFCFA(selectedCustObj.outstandingBalance)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block">Plafond crédit :</span>
                      <span className="font-mono text-slate-700">
                        {formatFCFA(selectedCustObj.creditLimit || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Ref & Observations */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <input
                type="text"
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value)}
                placeholder="Réf Bon de Commande (BC)"
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
              />
              <input
                type="text"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                placeholder="Observation (n° engin...)"
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Payment & Tender Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Règlement & Encaissement
              </span>
              <button
                type="button"
                onClick={handleAddTenderRow}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-900"
              >
                + Autre mode
              </button>
            </div>

            {/* Quick Solder Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setExactTender('ESPECES')}
                className="py-1 px-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Banknote className="w-3 h-3 text-emerald-600" />
                Tout Espèces
              </button>
              <button
                type="button"
                onClick={() => setExactTender('WAVE')}
                className="py-1 px-1.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <QrCode className="w-3 h-3 text-sky-600" />
                Tout Wave
              </button>
              <button
                type="button"
                onClick={() => setExactTender('ORANGE_MONEY')}
                className="py-1 px-1.5 rounded bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Smartphone className="w-3 h-3 text-orange-600" />
                Orange Money
              </button>
            </div>

            {/* Tender rows */}
            <div className="space-y-2">
              {tenders.map((tender, tIdx) => (
                <div key={tIdx} className="flex items-center gap-2 text-xs">
                  <select
                    value={tender.method}
                    onChange={(e) =>
                      handleUpdateTenderMethod(tIdx, e.target.value as PaymentMethod)
                    }
                    className="w-36 px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-800"
                  >
                    <option value="ESPECES">Espèces FCFA</option>
                    <option value="WAVE">Wave</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="VIREMENT">Virement Bancaire</option>
                    <option value="CARTE">Carte Bancaire</option>
                    <option value="CREDIT">À Crédit (Créance)</option>
                  </select>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={tender.amount === 0 ? '' : tender.amount}
                      onChange={(e) =>
                        handleUpdateTenderAmount(tIdx, parseFloat(e.target.value) || 0)
                      }
                      placeholder="Montant FCFA"
                      className="w-full px-2.5 py-1.5 text-right font-mono font-bold border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  {tenders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTenderRow(tIdx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Tender Summary Balance */}
            <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Encaissé :</span>
                <span className="font-mono font-bold text-slate-900">{formatFCFA(totalTendered)}</span>
              </div>

              {remainingBalanceDue > 0 && (
                <div className="flex justify-between font-bold text-rose-700">
                  <span>Reste dû (Créance client) :</span>
                  <span className="font-mono">{formatFCFA(remainingBalanceDue)}</span>
                </div>
              )}

              {changeToReturn > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Monnaie à rendre :</span>
                  <span className="font-mono">{formatFCFA(changeToReturn)}</span>
                </div>
              )}
            </div>

            {/* Final Validate Button */}
            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleValidateSale}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? 'Validation en cours...' : 'Valider & Imprimer le Reçu'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Price Override Modal */}
      {overrideItemIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Ajustement exceptionnel du prix unitaire
            </h3>
            <p className="text-xs text-slate-500">
              Pièce : {cart[overrideItemIndex].article.mainReference} (Prix catalogue :{' '}
              {formatFCFA(cart[overrideItemIndex].catalogPrice)})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Nouveau prix unitaire (FCFA)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={overridePriceInput}
                onChange={(e) => setOverridePriceInput(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Justification commerciale
              </label>
              <input
                type="text"
                value={overrideReasonInput}
                onChange={(e) => setOverrideReasonInput(e.target.value)}
                placeholder="Ex: Négociation volume grand compte, accord Resp..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOverrideItemIndex(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleApplyPriceOverride}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        initialFormat={receiptFormat}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
};
