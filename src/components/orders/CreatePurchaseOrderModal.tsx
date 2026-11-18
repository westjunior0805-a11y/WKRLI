import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { SupplierOrder } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatFCFA } from '../../utils/formatters';
import { getArticleBrandOffers, cleanBrandName } from '../../utils/articleHelpers';
import {
  Truck,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Search,
  Tag,
  Save,
  ListPlus,
  FilePlus2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
} from 'lucide-react';
import { NumericInput } from '../common/NumericInput';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  orderToEdit?: SupplierOrder | null;
  initialItems?: Array<{
    articleId: string;
    brand?: string;
    quantityOrdered: number;
    purchasePrice: number;
  }>;
  initialSupplierName?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

type LineSortField = 'reference' | 'designation' | 'brand' | 'quantity' | 'price' | 'total';

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  orderToEdit,
  initialItems,
  initialSupplierName,
  onClose,
  onSuccess,
}) => {
  const {
    articles,
    stocks,
    warehouses,
    suppliers,
    supplierOrders,
    createSupplierOrder,
    updateSupplierOrder,
    getTotalStockForArticle,
  } = useStock();

  // Mode selector when clicking "Commander": 'EXISTING' (Ajouter sur une liste déjà existante) vs 'NEW' (Créer une nouvelle liste)
  const [orderActionMode, setOrderActionMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [targetDraftOrderId, setTargetDraftOrderId] = useState<string>('');

  const [supplierName, setSupplierName] = useState(initialSupplierName || '');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [additionalFees, setAdditionalFees] = useState(0);
  const [notes, setNotes] = useState('');

  // Items to order
  const [orderLines, setOrderLines] = useState<
    Array<{
      articleId: string;
      brand: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>
  >([]);

  // Search and sort inside orderLines table
  const [linesSearchQuery, setLinesSearchQuery] = useState('');
  const [lineSortField, setLineSortField] = useState<LineSortField>('reference');
  const [lineSortDir, setLineSortDir] = useState<'asc' | 'desc'>('asc');

  // Search article dropdown (Reference only) + Separate Brand field
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const deferredArticleSearchQuery = useDeferredValue(articleSearchQuery);
  const [isArticleDropdownOpen, setIsArticleDropdownOpen] = useState(false);
  const [selectedArticleIdToAdd, setSelectedArticleIdToAdd] = useState('');
  const [brandToAdd, setBrandToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(5);
  const [priceToAdd, setPriceToAdd] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collect all distinct brands across catalog for datalist suggestions
  const allCatalogBrands = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      const cb = cleanBrandName(a.brand);
      if (cb) set.add(cb);
      if (a.brandOffers) {
        a.brandOffers.forEach((bo) => {
          const cbo = cleanBrandName(bo.brand);
          if (cbo) set.add(cbo);
        });
      }
    });
    stocks.forEach((s) => {
      if (s.brandBreakdown) {
        Object.keys(s.brandBreakdown).forEach((b) => {
          const cb = cleanBrandName(b);
          if (cb) set.add(cb);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articles, stocks]);

  // List of existing editable/active orders (DRAFT, TO_ORDER, or ORDERED) that the user can add products to
  const editableOrders = useMemo(() => {
    return supplierOrders.filter(
      (o) => o.status === 'DRAFT' || o.status === 'TO_ORDER' || o.status === 'ORDERED'
    );
  }, [supplierOrders]);

  const resolveDefaultBrandForArticle = (artId: string, requestedBrand?: string): string => {
    const cleanReq = cleanBrandName(requestedBrand);
    if (cleanReq) return cleanReq;
    const art = articles.find((a) => a.id === artId);
    if (!art) return '';
    const offers = getArticleBrandOffers(art);
    const defaultOfferBrand = cleanBrandName(
      (offers.find((o) => o.isDefault) || offers[0])?.brand
    );
    if (defaultOfferBrand) return defaultOfferBrand;
    return cleanBrandName(art.brand);
  };

  const resetToNewOrderForm = (extraItems?: typeof initialItems) => {
    setTargetDraftOrderId('');
    setExpectedDeliveryDate('');
    setAdditionalFees(0);
    setNotes('');
    setSelectedArticleIdToAdd('');
    setArticleSearchQuery('');
    setBrandToAdd('');
    setIsArticleDropdownOpen(false);
    const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '';
    setTargetWarehouseId(defaultWh);

    if (extraItems && extraItems.length > 0) {
      setOrderLines(
        extraItems.map((it) => {
          const resolvedBrand = resolveDefaultBrandForArticle(it.articleId, it.brand);
          const art = articles.find((a) => a.id === it.articleId);
          const matchingOffer = art
            ? getArticleBrandOffers(art).find(
                (bo) => cleanBrandName(bo.brand).toLowerCase() === resolvedBrand.toLowerCase()
              )
            : undefined;
          return {
            articleId: it.articleId,
            brand: resolvedBrand,
            quantityOrdered: Math.max(1, it.quantityOrdered || 1),
            purchasePrice:
              it.purchasePrice > 0
                ? it.purchasePrice
                : matchingOffer?.purchasePrice || art?.purchasePrice || 0,
          };
        })
      );
    } else {
      setOrderLines([]);
    }

    const cleanInitSupp =
      initialSupplierName &&
      !initialSupplierName.toLowerCase().includes('non spécifié') &&
      !initialSupplierName.toLowerCase().includes('non specifie')
        ? initialSupplierName
        : '';

    if (cleanInitSupp) {
      setSupplierName(cleanInitSupp);
      const foundSupp = suppliers.find((s) =>
        s.name.toLowerCase().includes(cleanInitSupp.toLowerCase())
      );
      if (foundSupp) {
        setSupplierContact(`${foundSupp.contactPerson || ''} (${foundSupp.phone || ''})`.trim());
        setSupplierEmail(foundSupp.email || '');
      } else {
        setSupplierContact('');
        setSupplierEmail('');
      }
    } else {
      setSupplierName('');
      setSupplierContact('');
      setSupplierEmail('');
    }
  };

  const loadDraftOrderIntoForm = (draft: SupplierOrder, extraItems?: typeof initialItems) => {
    setTargetDraftOrderId(draft.id);
    setSupplierName(draft.supplierName);
    setSupplierContact(draft.supplierContact || '');
    setSupplierEmail(draft.supplierEmail || '');
    setTargetWarehouseId(draft.targetWarehouseId || '');
    setExpectedDeliveryDate(draft.expectedDeliveryDate || '');
    setAdditionalFees(draft.additionalFees || 0);
    setNotes(draft.notes || '');
    setSelectedArticleIdToAdd('');
    setArticleSearchQuery('');
    setBrandToAdd('');
    setIsArticleDropdownOpen(false);

    const mergedLines = draft.items.map((it) => ({
      articleId: it.articleId,
      brand: cleanBrandName(it.brand),
      quantityOrdered: it.quantityOrdered,
      purchasePrice: it.purchasePrice,
    }));

    if (extraItems && extraItems.length > 0) {
      extraItems.forEach((ext) => {
        const extBrand = resolveDefaultBrandForArticle(ext.articleId, ext.brand);
        const existingIdx = mergedLines.findIndex(
          (l) =>
            l.articleId === ext.articleId &&
            cleanBrandName(l.brand).toLowerCase() === extBrand.toLowerCase()
        );
        if (existingIdx === -1) {
          mergedLines.push({
            articleId: ext.articleId,
            brand: extBrand,
            quantityOrdered: Math.max(1, ext.quantityOrdered || 1),
            purchasePrice: ext.purchasePrice,
          });
        }
      });
    }

    setOrderLines(mergedLines);
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setLinesSearchQuery('');

    if (orderToEdit) {
      setOrderActionMode('EXISTING');
      loadDraftOrderIntoForm(orderToEdit, initialItems);
      return;
    }

    setOrderActionMode('NEW');
    resetToNewOrderForm(initialItems);
  }, [orderToEdit, isOpen, initialItems, initialSupplierName]);

  const handleSelectMode = (mode: 'NEW' | 'EXISTING') => {
    setOrderActionMode(mode);
    setErrorMessage(null);
    if (mode === 'NEW') {
      resetToNewOrderForm(initialItems);
    } else {
      const firstOrder = editableOrders[0];
      if (firstOrder) {
        loadDraftOrderIntoForm(firstOrder, initialItems);
      }
    }
  };

  const handleSelectSupplier = (suppId: string) => {
    const supp = suppliers.find((s) => s.id === suppId);
    if (supp) {
      setSupplierName(supp.name);
      setSupplierContact(`${supp.contactPerson || ''} (${supp.phone || ''})`.trim());
      setSupplierEmail(supp.email || '');
    }
  };

  const handleSelectArticleToAdd = (artId: string) => {
    setSelectedArticleIdToAdd(artId);
    setIsArticleDropdownOpen(false);
    const art = articles.find((a) => a.id === artId);
    if (art) {
      const resolvedBrand = resolveDefaultBrandForArticle(art.id);
      setBrandToAdd(resolvedBrand);
      const matchingOffer = getArticleBrandOffers(art).find(
        (bo) => cleanBrandName(bo.brand).toLowerCase() === resolvedBrand.toLowerCase()
      );
      setPriceToAdd(matchingOffer?.purchasePrice || art.purchasePrice || 0);
      const stock = getTotalStockForArticle(art.id);
      const suggested = Math.max(1, (art.minStockThreshold || 5) * 2 - stock);
      setQtyToAdd(suggested);
    }
  };

  const selectedArtObj = articles.find((a) => a.id === selectedArticleIdToAdd);
  const selectedArtKnownBrands = selectedArtObj
    ? Array.from(
        new Set([
          ...(cleanBrandName(selectedArtObj.brand) ? [cleanBrandName(selectedArtObj.brand)] : []),
          ...getArticleBrandOffers(selectedArtObj)
            .map((bo) => cleanBrandName(bo.brand))
            .filter(Boolean),
        ])
      )
    : [];

  const handleAddLine = () => {
    if (!selectedArticleIdToAdd) return;
    const cleanBrand =
      cleanBrandName(brandToAdd) || cleanBrandName(selectedArtObj?.brand);
    const existsIndex = orderLines.findIndex(
      (l) =>
        l.articleId === selectedArticleIdToAdd &&
        cleanBrandName(l.brand).toLowerCase() === cleanBrand.toLowerCase()
    );
    if (existsIndex !== -1) {
      setOrderLines((prev) =>
        prev.map((l, idx) =>
          idx === existsIndex
            ? { ...l, quantityOrdered: l.quantityOrdered + qtyToAdd }
            : l
        )
      );
    } else {
      setOrderLines((prev) => [
        ...prev,
        {
          articleId: selectedArticleIdToAdd,
          brand: cleanBrand,
          quantityOrdered: qtyToAdd,
          purchasePrice: priceToAdd,
        },
      ]);
    }
    setSelectedArticleIdToAdd('');
    setArticleSearchQuery('');
    setBrandToAdd('');
  };

  const handleRemoveLine = (index: number) => {
    setOrderLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateLineBrand = (index: number, newBrand: string) => {
    setOrderLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== index) return l;
        const art = articles.find((a) => a.id === l.articleId);
        const matchingOffer = art
          ? getArticleBrandOffers(art).find(
              (bo) => cleanBrandName(bo.brand).toLowerCase() === cleanBrandName(newBrand).toLowerCase()
            )
          : undefined;
        return {
          ...l,
          brand: newBrand,
          purchasePrice:
            matchingOffer && matchingOffer.purchasePrice > 0
              ? matchingOffer.purchasePrice
              : l.purchasePrice,
        };
      })
    );
  };

  const handleUpdateLineQty = (index: number, q: number) => {
    setOrderLines((prev) =>
      prev.map((l, idx) => (idx === index ? { ...l, quantityOrdered: Math.max(1, q || 1) } : l))
    );
  };

  const handleUpdateLinePrice = (index: number, p: number) => {
    setOrderLines((prev) =>
      prev.map((l, idx) => (idx === index ? { ...l, purchasePrice: Math.max(0, p || 0) } : l))
    );
  };

  const subtotal = orderLines.reduce((sum, l) => sum + l.quantityOrdered * l.purchasePrice, 0);
  const total = subtotal + (additionalFees || 0);

  const filteredArticles = useMemo(() => {
    const q = deferredArticleSearchQuery.toLowerCase().trim();
    const active = articles.filter((a) => a.status !== 'archived');
    if (!q) return active.slice(0, 20);
    return active
      .filter(
        (a) =>
          a.mainReference.toLowerCase().includes(q) ||
          a.designation.toLowerCase().includes(q) ||
          (a.equivalentReferences || []).some((eq) => eq.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [articles, deferredArticleSearchQuery]);

  // Filtered and sorted orderLines with original index preserved for editing
  const displayedOrderLines = useMemo(() => {
    const withMeta = orderLines.map((line, originalIndex) => {
      const art = articles.find((a) => a.id === line.articleId);
      return {
        line,
        originalIndex,
        reference: art?.mainReference || '',
        designation: art?.designation || '',
        lineTotal: line.quantityOrdered * line.purchasePrice,
      };
    });

    const filtered = withMeta.filter((item) => {
      if (!linesSearchQuery.trim()) return true;
      const q = linesSearchQuery.toLowerCase().trim();
      return (
        item.reference.toLowerCase().includes(q) ||
        item.designation.toLowerCase().includes(q) ||
        item.line.brand.toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      if (lineSortField === 'reference') cmp = a.reference.localeCompare(b.reference);
      else if (lineSortField === 'designation') cmp = a.designation.localeCompare(b.designation);
      else if (lineSortField === 'brand') cmp = a.line.brand.localeCompare(b.line.brand);
      else if (lineSortField === 'quantity') cmp = a.line.quantityOrdered - b.line.quantityOrdered;
      else if (lineSortField === 'price') cmp = a.line.purchasePrice - b.line.purchasePrice;
      else if (lineSortField === 'total') cmp = a.lineTotal - b.lineTotal;
      return lineSortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [orderLines, articles, linesSearchQuery, lineSortField, lineSortDir]);

  const toggleLineSort = (field: LineSortField) => {
    if (lineSortField === field) {
      setLineSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLineSortField(field);
      setLineSortDir('asc');
    }
  };

  const renderSortIcon = (field: LineSortField) => {
    if (lineSortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    return lineSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 inline ml-1" />
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierName.trim()) {
      setErrorMessage('Veuillez renseigner le nom du fournisseur.');
      return;
    }

    if (!targetWarehouseId) {
      setErrorMessage('Veuillez sélectionner le magasin de destination / réception.');
      return;
    }

    let finalOrderLines = [...orderLines];
    if (selectedArticleIdToAdd) {
      const cleanBrand = brandToAdd.trim() || selectedArtObj?.brand || '';
      const existsIndex = finalOrderLines.findIndex(
        (l) =>
          l.articleId === selectedArticleIdToAdd &&
          l.brand.toLowerCase().trim() === cleanBrand.toLowerCase().trim()
      );
      if (existsIndex !== -1) {
        finalOrderLines[existsIndex] = {
          ...finalOrderLines[existsIndex],
          quantityOrdered: finalOrderLines[existsIndex].quantityOrdered + qtyToAdd,
        };
      } else {
        finalOrderLines.push({
          articleId: selectedArticleIdToAdd,
          brand: cleanBrand,
          quantityOrdered: qtyToAdd,
          purchasePrice: priceToAdd,
        });
      }
    }

    if (finalOrderLines.length === 0) {
      setErrorMessage('Veuillez ajouter au moins un article à la commande.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (targetDraftOrderId) {
        const res = updateSupplierOrder({
          orderId: targetDraftOrderId,
          supplierName,
          supplierContact,
          supplierEmail,
          targetWarehouseId,
          items: finalOrderLines,
          additionalFees,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          notes,
        });

        if (res.success && res.order) {
          onSuccess(
            `Produit(s) ajouté(s) et commande ${res.order.orderNumber} enregistrée (${finalOrderLines.length} produit(s)).`
          );
          onClose();
        } else {
          setErrorMessage(res.error || 'Erreur lors de la mise à jour de la commande.');
        }
      } else {
        const res = createSupplierOrder({
          supplierName,
          supplierContact,
          supplierEmail,
          targetWarehouseId,
          items: finalOrderLines,
          additionalFees,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          notes,
        });

        if (res.success && res.order) {
          onSuccess(
            `Nouvelle liste de commande ${res.order.orderNumber} créée et enregistrée (${orderLines.length} produit(s)).`
          );
          onClose();
        } else {
          setErrorMessage(res.error || 'Erreur lors de l’enregistrement de la commande.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur inattendue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialArticleLabels = useMemo(() => {
    if (!initialItems || initialItems.length === 0) return [];
    return initialItems
      .map((it) => {
        const art = articles.find((a) => a.id === it.articleId);
        return art ? `${art.mainReference} (${art.designation})` : null;
      })
      .filter(Boolean) as string[];
  }, [initialItems, articles]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">
                {orderToEdit
                  ? `Modifier la Liste de Commande ${orderToEdit.orderNumber}`
                  : targetDraftOrderId
                  ? 'Ajouter sur une Liste de Commande Existante'
                  : 'Créer une Nouvelle Liste de Commande'}
              </h3>
              <p className="text-xs text-slate-300">
                Ajoutez vos produits au fur et à mesure puis cliquez sur Enregistrer (la validation se fait une fois la liste terminée)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto max-h-[74vh]">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* DEUX OPTIONS EXPLICITES LORSQU'ON CLIQUE SUR COMMANDER */}
            {!orderToEdit && (
              <div className="space-y-3">
                {initialArticleLabels.length > 0 && (
                  <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold">Pièce(s) à commander : </span>
                      <span className="font-mono font-semibold">
                        {initialArticleLabels.slice(0, 3).join(' · ')}
                        {initialArticleLabels.length > 3 ? ` +${initialArticleLabels.length - 3} autre(s)` : ''}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1 : Ajouter sur une liste déjà existante */}
                  <button
                    type="button"
                    onClick={() => handleSelectMode('EXISTING')}
                    disabled={editableOrders.length === 0}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      orderActionMode === 'EXISTING'
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        orderActionMode === 'EXISTING'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <ListPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          1. Ajouter sur une liste déjà existante
                        </span>
                        {orderActionMode === 'EXISTING' && (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {editableOrders.length > 0
                          ? `Insérer dans l'une des ${editableOrders.length} liste(s) de commande en cours.`
                          : 'Aucune liste de commande en cours actuellement.'}
                      </p>
                    </div>
                  </button>

                  {/* Option 2 : Créer une nouvelle liste de commande et l'ajouter */}
                  <button
                    type="button"
                    onClick={() => handleSelectMode('NEW')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                      orderActionMode === 'NEW'
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        orderActionMode === 'NEW'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <FilePlus2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          2. Créer une nouvelle liste de commande
                        </span>
                        {orderActionMode === 'NEW' && (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ouvrir un nouveau bon de commande et y ajouter directement ce produit.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Selector of existing order list when Option 1 is active */}
                {orderActionMode === 'EXISTING' && editableOrders.length > 0 && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-amber-950 block">
                        Sélectionnez la liste de commande existante à compléter :
                      </span>
                      <span className="text-amber-800 text-[11px]">
                        Les articles de cette liste sont chargés ci-dessous avec votre nouveau produit ajouté.
                      </span>
                    </div>
                    <select
                      value={targetDraftOrderId}
                      onChange={(e) => {
                        const chosenId = e.target.value;
                        const found = editableOrders.find((o) => o.id === chosenId);
                        if (found) {
                          loadDraftOrderIntoForm(found, initialItems);
                        }
                      }}
                      className="px-3 py-2 bg-white border border-amber-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                    >
                      {editableOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} — {o.supplierName} ({o.items.length} réf. ·{' '}
                          {o.status === 'DRAFT' ? 'Brouillon' : o.status === 'TO_ORDER' ? 'À commander' : 'Commandé'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Supplier & Warehouse settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fournisseur habituel ou raison sociale *
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ex: Tractafric, BIA, Techni-Filtres..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  {suppliers.length > 0 && (
                    <select
                      onChange={(e) => handleSelectSupplier(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px]"
                    >
                      <option value="">Sélectionner dans le carnet fournisseurs...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Fournisseur (Téléphone / Nom)
                </label>
                <input
                  type="text"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder="+221 33 839 ... / Marc Delvaux"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Magasin de destination / Réception *
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                >
                  <option value="">-- Sélectionner un magasin de réception --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date de livraison souhaitée (optionnel)
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Frais de port / douane (FCFA)
                </label>
                <NumericInput
                  min={0}
                  value={additionalFees}
                  onChange={(val) => setAdditionalFees(val)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email commande
                </label>
                <input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="commandes@fournisseur.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <datalist id="po-brands-datalist">
              {allCatalogBrands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            {/* Order Lines Table with Search & Sort (Placed FIRST so pre-selected piece is immediately visible without searching again) */}
            <div className="border-2 border-amber-300/80 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="p-3 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Liste des pièces de la commande ({orderLines.length})
                  </span>
                  {initialItems && initialItems.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      ✓ Pièce pré-remplie automatiquement
                    </span>
                  )}
                </div>
                {orderLines.length > 1 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={linesSearchQuery}
                      onChange={(e) => setLinesSearchQuery(e.target.value)}
                      placeholder="Filtrer dans la liste..."
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                )}
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th
                      onClick={() => toggleLineSort('reference')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-900 select-none"
                    >
                      Référence & Désignation {renderSortIcon('reference')}
                    </th>
                    <th
                      onClick={() => toggleLineSort('brand')}
                      className="py-2.5 px-3 w-48 cursor-pointer hover:text-slate-900 select-none"
                    >
                      Marque / Constructeur {renderSortIcon('brand')}
                    </th>
                    <th
                      onClick={() => toggleLineSort('quantity')}
                      className="py-2.5 px-3 text-right w-24 cursor-pointer hover:text-slate-900 select-none"
                    >
                      Quantité {renderSortIcon('quantity')}
                    </th>
                    <th
                      onClick={() => toggleLineSort('price')}
                      className="py-2.5 px-3 text-right w-32 cursor-pointer hover:text-slate-900 select-none"
                    >
                      Prix Achat (FCFA) {renderSortIcon('price')}
                    </th>
                    <th
                      onClick={() => toggleLineSort('total')}
                      className="py-2.5 px-3 text-right w-32 cursor-pointer hover:text-slate-900 select-none"
                    >
                      Total Ligne {renderSortIcon('total')}
                    </th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedOrderLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        {orderLines.length === 0
                          ? 'Aucun article sélectionné. Recherchez et ajoutez une pièce ci-dessous.'
                          : 'Aucune pièce ne correspond à votre filtre.'}
                      </td>
                    </tr>
                  ) : (
                    displayedOrderLines.map(({ line, originalIndex, reference, designation, lineTotal }) => {
                      const isNewlyAdded =
                        initialItems?.some((init) => init.articleId === line.articleId) ?? false;
                      const lineArt = articles.find((a) => a.id === line.articleId);
                      const lineKnownBrands = lineArt
                        ? Array.from(
                            new Set([
                              ...(cleanBrandName(lineArt.brand) ? [cleanBrandName(lineArt.brand)] : []),
                              ...getArticleBrandOffers(lineArt)
                                .map((bo) => cleanBrandName(bo.brand))
                                .filter(Boolean),
                            ])
                          )
                        : [];

                      return (
                        <tr
                          key={`${line.articleId}-${originalIndex}`}
                          className={`hover:bg-slate-50/50 ${
                            isNewlyAdded ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">{reference}</span>
                              {isNewlyAdded && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">
                                  Sélectionné
                                </span>
                              )}
                            </div>
                            <div className="text-slate-600 font-medium">{designation}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              list="po-brands-datalist"
                              value={line.brand}
                              onChange={(e) => handleUpdateLineBrand(originalIndex, e.target.value)}
                              placeholder="Marque (ex: CAT, CTP...)"
                              className="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                            {lineKnownBrands.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {lineKnownBrands.map((kb) => {
                                  const isSelectedBrand =
                                    cleanBrandName(line.brand).toLowerCase() === kb.toLowerCase();
                                  return (
                                    <button
                                      key={kb}
                                      type="button"
                                      onClick={() => handleUpdateLineBrand(originalIndex, kb)}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                        isSelectedBrand
                                          ? 'bg-amber-500 text-slate-950 border-amber-600'
                                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-amber-50'
                                      }`}
                                    >
                                      {kb}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <NumericInput
                              min={1}
                              value={line.quantityOrdered}
                              onChange={(val) =>
                                handleUpdateLineQty(originalIndex, val)
                              }
                              placeholder="1"
                              className="w-20 px-2 py-1 text-right font-mono font-bold border border-slate-300 rounded bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <NumericInput
                              min={0}
                              value={line.purchasePrice}
                              onChange={(val) =>
                                handleUpdateLinePrice(originalIndex, val)
                              }
                              placeholder="0"
                              className="w-28 px-2 py-1 text-right font-mono border border-slate-300 rounded bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(lineTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(originalIndex)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Retirer cette pièce de la commande"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Additional Article Bar (Optional when orderLines already has items) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {orderLines.length > 0
                    ? '+ Ajouter une autre référence à cette commande (facultatif)'
                    : 'Ajouter un article à cette commande'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Recherchez une autre pièce pour compléter le bon de commande
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                {/* 1. Reference Produit */}
                <div className="sm:col-span-4 relative">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    1. Référence Produit {orderLines.length === 0 ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    value={articleSearchQuery}
                    onFocus={() => setIsArticleDropdownOpen(true)}
                    onChange={(e) => {
                      setArticleSearchQuery(e.target.value);
                      setIsArticleDropdownOpen(true);
                    }}
                    placeholder="Réf produit (ex: 1R-0716, P551313)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white font-medium"
                  />
                  {isArticleDropdownOpen && filteredArticles.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                      {filteredArticles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            handleSelectArticleToAdd(art.id);
                            setArticleSearchQuery(`${art.mainReference} - ${art.designation}`);
                          }}
                          className="p-2 hover:bg-amber-50 cursor-pointer border-b border-slate-100 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-slate-900 block">
                              {art.mainReference}
                            </span>
                            <span className="text-slate-600 truncate block text-[11px]">
                              {art.designation}
                            </span>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px] shrink-0">
                            {formatFCFA(art.purchasePrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Separate Brand Field (Facultatif) */}
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-600" />
                    2. Marque (facultative)
                  </label>
                  <input
                    type="text"
                    list="po-brands-datalist"
                    value={brandToAdd}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBrandToAdd(val);
                      if (selectedArtObj) {
                        const matchingOffer = getArticleBrandOffers(selectedArtObj).find(
                          (bo) => cleanBrandName(bo.brand).toLowerCase() === cleanBrandName(val).toLowerCase()
                        );
                        if (matchingOffer && matchingOffer.purchasePrice > 0) {
                          setPriceToAdd(matchingOffer.purchasePrice);
                        }
                      }
                    }}
                    placeholder="Optionnel (ex: CAT, Donaldson...)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Qté
                  </label>
                  <NumericInput
                    min={1}
                    value={qtyToAdd}
                    onChange={(val) => setQtyToAdd(val || 1)}
                    placeholder="1"
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg font-mono font-bold text-center bg-white"
                    title="Quantité à commander"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Prix Achat (FCFA)
                  </label>
                  <NumericInput
                    min={0}
                    value={priceToAdd}
                    onChange={(val) => setPriceToAdd(val)}
                    placeholder="0"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono text-right bg-white"
                    title="Prix d'achat unitaire (FCFA)"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={!selectedArticleIdToAdd}
                    className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Quick chips for known brands on selected reference */}
              {selectedArtKnownBrands.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400">
                    Marques connues sur {selectedArtObj?.mainReference} :
                  </span>
                  {selectedArtKnownBrands.map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      onClick={() => {
                        setBrandToAdd(kb);
                        if (selectedArtObj) {
                          const matchingOffer = getArticleBrandOffers(selectedArtObj).find(
                            (bo) => cleanBrandName(bo.brand).toLowerCase() === kb.toLowerCase()
                          );
                          if (matchingOffer && matchingOffer.purchasePrice > 0) {
                            setPriceToAdd(matchingOffer.purchasePrice);
                          }
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        cleanBrandName(brandToAdd).toLowerCase() === kb.toLowerCase()
                          ? 'bg-amber-500 text-slate-950 border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                      }`}
                    >
                      {kb}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instructions ou remarques sur la commande (facultatif)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Livraison par conteneur groupé, conditionnement étanche..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Footer : uniquement le bouton Enregistrer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-500">Montant total commande : </span>
              <span className="font-mono font-bold text-base text-slate-900 ml-1">
                {formatFCFA(total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting || orderLines.length === 0}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
