import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, SupplierOrder, SupplierOrderStatus } from '../../types';
import { useStock } from '../../context/StockContext';
import { formatAED, formatDate } from '../../utils/formatters';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  PackageCheck,
  Ban,
  Printer,
  AlertOctagon,
  Building2,
  AlertTriangle,
  Trash2,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Users,
  Phone,
  Mail,
  MapPin,
  History,
  X,
  Save,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { ReceiveOrderModal } from './ReceiveOrderModal';
import { PurchaseOrderPrintModal } from './PurchaseOrderPrintModal';
import { InvoicePdfPriceImportModal } from '../catalog/InvoicePdfPriceImportModal';
import { RowActionsMenu } from '../common/RowActionsMenu';
import { SearchField } from '../common/SearchField';

interface PurchaseOrderListViewProps {
  focusedOrderId?: string | null;
  onClearFocusedOrder?: () => void;
}

type OrderSortField =
  | 'orderNumber'
  | 'date'
  | 'supplierName'
  | 'targetWarehouseName'
  | 'itemsCount'
  | 'totalAmount'
  | 'status';

type SupplierSortField =
  | 'code'
  | 'name'
  | 'contactPerson'
  | 'brands'
  | 'ordersCount'
  | 'totalOrderedAmount'
  | 'lastOrderDate';

export const PurchaseOrderListView: React.FC<PurchaseOrderListViewProps> = ({
  focusedOrderId,
  onClearFocusedOrder,
}) => {
  const {
    supplierOrders,
    suppliers,
    updateSupplierOrderStatus,
    cancelSupplierOrder,
    deleteSupplierOrder,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    currentPermissions,
  } = useStock();

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'SUPPLIERS'>('ORDERS');
  const [isPdfPriceImportOpen, setIsPdfPriceImportOpen] = useState(false);

  // Tab 1: Orders search, filter, sort & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SupplierOrderStatus>('ALL');
  const [orderSortField, setOrderSortField] = useState<OrderSortField>('date');
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('desc');
  const [ordersPageSize, setOrdersPageSize] = useState<number>(25);
  const [ordersCurrentPage, setOrdersCurrentPage] = useState<number>(1);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [orderToInspectState, setOrderToInspect] = useState<SupplierOrder | null>(null);
  const orderToInspect = orderToInspectState
    ? supplierOrders.find((o) => o.id === orderToInspectState.id) || orderToInspectState
    : null;

  // Tab 2: Suppliers search, sort, pagination & modals
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierSortField, setSupplierSortField] = useState<SupplierSortField>('name');
  const [supplierSortDir, setSupplierSortDir] = useState<'asc' | 'desc'>('asc');
  const [suppliersPageSize, setSuppliersPageSize] = useState<number>(25);
  const [suppliersCurrentPage, setSuppliersCurrentPage] = useState<number>(1);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [supplierHistoryTargetState, setSupplierHistoryTarget] = useState<Supplier | null>(null);
  const supplierHistoryTarget = supplierHistoryTargetState
    ? suppliers.find((s) => s.id === supplierHistoryTargetState.id) || supplierHistoryTargetState
    : null;

  // Supplier form fields
  const [suppCode, setSuppCode] = useState('');
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppCountry, setSuppCountry] = useState('Sénégal');
  const [suppBrandsInput, setSuppBrandsInput] = useState('');
  const [suppNotes, setSuppNotes] = useState('');
  const [suppFormError, setSuppFormError] = useState<string | null>(null);

  // Order Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<SupplierOrder | null>(null);
  const [orderToReceive, setOrderToReceive] = useState<SupplierOrder | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<SupplierOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<SupplierOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SupplierOrder | null>(null);

  const [prefilledItemsForPO, setPrefilledItemsForPO] = useState<
    Array<{
      articleId: string;
      brand?: string;
      quantityOrdered: number;
      purchasePrice: number;
    }>
  >([]);
  const [prefilledSupplierName, setPrefilledSupplierName] = useState<string | undefined>(undefined);

  const [notification, setNotification] = useState<string | null>(null);

  // Handle navigation to a specific order list when user clicks "Voir la liste de commande"
  useEffect(() => {
    if (focusedOrderId) {
      setActiveTab('ORDERS');
      setStatusFilter('ALL');
      setSearchQuery('');
      setHighlightedOrderId(focusedOrderId);
      const found = supplierOrders.find((o) => o.id === focusedOrderId);
      if (found) {
        setOrderToInspect(found);
      }
      if (onClearFocusedOrder) {
        onClearFocusedOrder();
      }
    }
  }, [focusedOrderId, supplierOrders, onClearFocusedOrder]);

  const jumpToOrderList = (order: SupplierOrder) => {
    setActiveTab('ORDERS');
    setStatusFilter('ALL');
    setSearchQuery('');
    setHighlightedOrderId(order.id);
    setOrderToInspect(order);
  };

  useEffect(() => {
    setOrdersCurrentPage(1);
  }, [searchQuery, statusFilter, orderSortField, orderSortDir, ordersPageSize]);

  useEffect(() => {
    setSuppliersCurrentPage(1);
  }, [supplierSearchQuery, supplierSortField, supplierSortDir, suppliersPageSize]);

  // Filtered & sorted orders for Tab 1
  const filteredOrders = useMemo(() => {
    const list = supplierOrders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = order.orderNumber.toLowerCase().includes(q);
        const matchSupp = order.supplierName.toLowerCase().includes(q);
        const matchWh = order.targetWarehouseName.toLowerCase().includes(q);
        const matchItem = order.items.some(
          (it) =>
            it.mainReference.toLowerCase().includes(q) ||
            it.designation.toLowerCase().includes(q) ||
            (it.brand || '').toLowerCase().includes(q)
        );
        if (!matchNum && !matchSupp && !matchWh && !matchItem) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (orderSortField) {
        case 'orderNumber':
          cmp = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'supplierName':
          cmp = a.supplierName.localeCompare(b.supplierName);
          break;
        case 'targetWarehouseName':
          cmp = a.targetWarehouseName.localeCompare(b.targetWarehouseName);
          break;
        case 'itemsCount':
          cmp = a.items.length - b.items.length;
          break;
        case 'totalAmount':
          cmp = a.totalAmount - b.totalAmount;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return orderSortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [supplierOrders, statusFilter, searchQuery, orderSortField, orderSortDir]);

  // Enriched suppliers with order statistics for Tab 3
  const enrichedSuppliers = useMemo(() => {
    const list = suppliers.map((supp) => {
      const matchingOrders = supplierOrders.filter(
        (o) => o.supplierName.toLowerCase().trim() === supp.name.toLowerCase().trim()
      );
      const validOrders = matchingOrders.filter((o) => o.status !== 'CANCELLED');
      const totalOrderedAmount = validOrders.reduce((s, o) => s + o.totalAmount, 0);
      const activeOrdersCount = matchingOrders.filter(
        (o) => o.status === 'DRAFT' || o.status === 'TO_ORDER' || o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED'
      ).length;
      const sortedByDate = [...matchingOrders].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastOrderDate = sortedByDate[0]?.date || null;

      return {
        supplier: supp,
        orders: sortedByDate,
        ordersCount: matchingOrders.length,
        activeOrdersCount,
        totalOrderedAmount,
        lastOrderDate,
      };
    });

    const filtered = list.filter((item) => {
      if (!supplierSearchQuery.trim()) return true;
      const q = supplierSearchQuery.toLowerCase().trim();
      const s = item.supplier;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.country || '').toLowerCase().includes(q) ||
        (s.brandsHandled || []).some((b) => b.toLowerCase().includes(q))
      );
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (supplierSortField) {
        case 'code':
          cmp = a.supplier.code.localeCompare(b.supplier.code);
          break;
        case 'name':
          cmp = a.supplier.name.localeCompare(b.supplier.name);
          break;
        case 'contactPerson':
          cmp = (a.supplier.contactPerson || '').localeCompare(b.supplier.contactPerson || '');
          break;
        case 'brands':
          cmp = (a.supplier.brandsHandled || []).join(', ').localeCompare((b.supplier.brandsHandled || []).join(', '), 'fr');
          break;
        case 'ordersCount':
          cmp = a.ordersCount - b.ordersCount;
          break;
        case 'totalOrderedAmount':
          cmp = a.totalOrderedAmount - b.totalOrderedAmount;
          break;
        case 'lastOrderDate':
          cmp =
            (a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0) -
            (b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0);
          break;
      }
      return supplierSortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [suppliers, supplierOrders, supplierSearchQuery, supplierSortField, supplierSortDir]);

  // Sort helpers
  const toggleOrderSort = (field: OrderSortField) => {
    if (orderSortField === field) {
      setOrderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderSortField(field);
      setOrderSortDir('asc');
    }
  };

  const renderOrderSortIcon = (field: OrderSortField) => {
    if (orderSortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    return orderSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 inline ml-1" />
    );
  };

  const toggleSupplierSort = (field: SupplierSortField) => {
    if (supplierSortField === field) {
      setSupplierSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSupplierSortField(field);
      setSupplierSortDir('asc');
    }
  };

  const renderSupplierSortIcon = (field: SupplierSortField) => {
    if (supplierSortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
    return supplierSortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 inline ml-1" />
    );
  };

  const totalOrdersPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const safeOrdersPage = Math.min(ordersCurrentPage, totalOrdersPages);
  const paginatedOrders = useMemo(() => {
    const start = (safeOrdersPage - 1) * ordersPageSize;
    return filteredOrders.slice(start, start + ordersPageSize);
  }, [filteredOrders, safeOrdersPage, ordersPageSize]);

  const totalSuppliersPages = Math.max(1, Math.ceil(enrichedSuppliers.length / suppliersPageSize));
  const safeSuppliersPage = Math.min(suppliersCurrentPage, totalSuppliersPages);
  const paginatedSuppliers = useMemo(() => {
    const start = (safeSuppliersPage - 1) * suppliersPageSize;
    return enrichedSuppliers.slice(start, start + suppliersPageSize);
  }, [enrichedSuppliers, safeSuppliersPage, suppliersPageSize]);

  // Supplier Modal handlers
  const openCreateSupplierModal = () => {
    setSupplierToEdit(null);
    setSuppCode(`FOUR-${String(suppliers.length + 1).padStart(3, '0')}`);
    setSuppName('');
    setSuppContact('');
    setSuppPhone('');
    setSuppEmail('');
    setSuppAddress('');
    setSuppCountry('Sénégal');
    setSuppBrandsInput('');
    setSuppNotes('');
    setSuppFormError(null);
    setIsSupplierModalOpen(true);
  };

  const openEditSupplierModal = (supp: Supplier) => {
    setSupplierToEdit(supp);
    setSuppCode(supp.code);
    setSuppName(supp.name);
    setSuppContact(supp.contactPerson || '');
    setSuppPhone(supp.phone || '');
    setSuppEmail(supp.email || '');
    setSuppAddress(supp.address || '');
    setSuppCountry(supp.country || 'Sénégal');
    setSuppBrandsInput((supp.brandsHandled || []).join(', '));
    setSuppNotes(supp.notes || '');
    setSuppFormError(null);
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setSuppFormError(null);
    if (!suppName.trim()) {
      setSuppFormError('Veuillez renseigner la raison sociale / le nom du fournisseur.');
      return;
    }

    const brandsHandled = suppBrandsInput
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    if (supplierToEdit) {
      const res = updateSupplier(supplierToEdit.id, {
        code: suppCode.trim() || supplierToEdit.code,
        name: suppName.trim(),
        contactPerson: suppContact.trim() || undefined,
        phone: suppPhone.trim() || undefined,
        email: suppEmail.trim() || undefined,
        address: suppAddress.trim() || undefined,
        country: suppCountry.trim() || undefined,
        brandsHandled,
        notes: suppNotes.trim() || undefined,
      });
      if (res.success) {
        setNotification(`Fournisseur "${suppName.trim()}" mis à jour avec succès.`);
        setIsSupplierModalOpen(false);
      } else {
        setSuppFormError(res.error || 'Erreur lors de la modification.');
      }
    } else {
      const res = createSupplier({
        code: suppCode.trim() || `FOUR-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: suppName.trim(),
        contactPerson: suppContact.trim() || undefined,
        phone: suppPhone.trim() || undefined,
        email: suppEmail.trim() || undefined,
        address: suppAddress.trim() || undefined,
        country: suppCountry.trim() || undefined,
        brandsHandled,
        notes: suppNotes.trim() || undefined,
      });
      if (res.success) {
        setNotification(`Fournisseur "${suppName.trim()}" ajouté au carnet fournisseurs.`);
        setIsSupplierModalOpen(false);
      } else {
        setSuppFormError(res.error || 'Erreur lors de la création.');
      }
    }
  };

  const getStatusBadge = (status: SupplierOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            <Clock className="w-3 h-3" />
            Brouillon
          </span>
        );
      case 'TO_ORDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF9DF] text-[#111111]">
            <Clock className="w-3 h-3" />
            À commander
          </span>
        );
      case 'ORDERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Truck className="w-3 h-3" />
            Commandé (En cours)
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF9DF] text-[#111111]">
            <PackageCheck className="w-3 h-3" />
            Partiellement reçu
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Reçu (Complet)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <Ban className="w-3 h-3" />
            Annulé
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-4 h-4 text-slate-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Achats, Commandes & Fournisseurs
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Listes de commandes fournisseurs, suivi des pièces commandées, réapprovisionnement et gestion des fournisseurs
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentPermissions.canViewPurchasePrices && (
            <button
              type="button"
              onClick={() => setIsPdfPriceImportOpen(true)}
              className="px-3.5 py-2 bg-[#FFF9DF] hover:bg-[#FFCD11]/40 text-[#7A5C00] border border-[#E5C130] font-bold text-xs rounded-xl shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Extraire les prix d'achat en AED depuis vos factures PDF fournisseurs"
            >
              <FileText className="w-4 h-4 text-[#7A5C00]" />
              Extraire Prix PDF (AED)
            </button>
          )}

          <button
            onClick={openCreateSupplierModal}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-xs rounded-xl shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-4 h-4 text-amber-600" />
            Nouveau Fournisseur
          </button>

          <button
            onClick={() => {
              setOrderToEdit(null);
              setPrefilledItemsForPO([]);
              setPrefilledSupplierName(undefined);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Liste de Commande
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Segmented Navigation (2 Onglets : Listes de Commandes, Gestion des Fournisseurs) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'ORDERS'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Listes de Commandes ({supplierOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'SUPPLIERS'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-600" />
          Gestion des Fournisseurs ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: LISTES DES COMMANDES */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              className="flex-1"
              placeholder="N° commande ou fournisseur..."
            />

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Statut :</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="DRAFT">Brouillons</option>
                <option value="TO_ORDER">À commander</option>
                <option value="ORDERED">Commandés</option>
                <option value="PARTIALLY_RECEIVED">Partiellement reçus</option>
                <option value="RECEIVED">Reçus (Complets)</option>
                <option value="CANCELLED">Annulés</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="w-full">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">Aucune commande trouvée</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Créez votre première liste de commande fournisseur ou utilisez l&apos;onglet Liste des Pièces.
                  </p>
                </div>
              ) : (
                <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-[#E0E0E0]">
                  {paginatedOrders.map((order) => {
                    const totalQtyOrdered = order.items.reduce((s, it) => s + it.quantityOrdered, 0);
                    const totalQtyReceived = order.items.reduce((s, it) => s + it.quantityReceived, 0);
                    const canReceive =
                      order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
                    const canEditOrder =
                      order.status === 'DRAFT' ||
                      order.status === 'TO_ORDER' ||
                      order.status === 'ORDERED';
                    const canValidateOrder =
                      order.status === 'DRAFT' || order.status === 'TO_ORDER';
                    const isHighlighted = highlightedOrderId === order.id;

                    return (
                      <div
                        key={`m-${order.id}`}
                        className={`p-3.5 space-y-2 ${
                          isHighlighted ? 'bg-[#FFF9DF]' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setOrderToInspect(order)}
                            className="min-w-0 text-left flex-1 bg-transparent! border-0! p-0! cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-sm font-bold text-[#111111]">
                                {order.orderNumber}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="text-xs font-semibold text-[#111111] mt-0.5 truncate">
                              {order.supplierName}
                            </div>
                            <div className="text-[11px] text-[#595959]">
                              {formatDate(order.date)} • {order.targetWarehouseName}
                            </div>
                          </button>

                          <RowActionsMenu
                            actions={[
                              {
                                label: 'Consulter les pièces',
                                icon: <Eye className="w-3.5 h-3.5" />,
                                onClick: () => setOrderToInspect(order),
                              },
                              {
                                label: 'Imprimer le bon de commande',
                                icon: <Printer className="w-3.5 h-3.5" />,
                                onClick: () => setOrderToPrint(order),
                              },
                              {
                                label: 'Ajouter produits / Modifier',
                                icon: <Edit2 className="w-3.5 h-3.5" />,
                                tone: 'primary',
                                hidden: !canEditOrder,
                                onClick: () => {
                                  setOrderToEdit(order);
                                  setPrefilledItemsForPO([]);
                                  setPrefilledSupplierName(undefined);
                                  setIsCreateModalOpen(true);
                                },
                              },
                              {
                                label: 'Valider la commande',
                                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                                tone: 'warning',
                                hidden: !canValidateOrder,
                                onClick: () => {
                                  updateSupplierOrderStatus(order.id, 'ORDERED');
                                  setNotification(
                                    `Commande ${order.orderNumber} validée avec succès ! Elle est maintenant prête pour réception.`
                                  );
                                },
                              },
                              {
                                label: 'Réceptionner en magasin',
                                icon: <PackageCheck className="w-3.5 h-3.5" />,
                                tone: 'success',
                                hidden: !canReceive,
                                onClick: () => setOrderToReceive(order),
                              },
                              {
                                label: 'Annuler la commande',
                                icon: <Ban className="w-3.5 h-3.5" />,
                                tone: 'warning',
                                dividerBefore: true,
                                hidden: order.status === 'RECEIVED' || order.status === 'CANCELLED',
                                onClick: () => setOrderToCancel(order),
                              },
                              {
                                label: 'Supprimer définitivement',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                tone: 'danger',
                                dividerBefore: order.status === 'RECEIVED' || order.status === 'CANCELLED',
                                onClick: () => setOrderToDelete(order),
                              },
                            ]}
                          />
                        </div>

                        <div className="pt-2 border-t border-[#EFEFEF] flex items-center justify-between text-xs">
                          <span className="font-mono text-[#595959]">
                            {order.items.length} réf. ({totalQtyReceived}/{totalQtyOrdered} reçu)
                          </span>
                          <span className="font-mono font-bold text-[#111111]">
                            {formatAED(order.totalAmount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <table className="hidden md:table w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th
                        onClick={() => toggleOrderSort('orderNumber')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[14%]"
                      >
                        N° Cde {renderOrderSortIcon('orderNumber')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('date')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[11%]"
                      >
                        Date {renderOrderSortIcon('date')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('supplierName')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[19%]"
                      >
                        Fournisseur {renderOrderSortIcon('supplierName')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('targetWarehouseName')}
                        className="hidden lg:table-cell py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[14%]"
                      >
                        Magasin {renderOrderSortIcon('targetWarehouseName')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('itemsCount')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:text-slate-900 select-none w-[12%]"
                      >
                        Pièces {renderOrderSortIcon('itemsCount')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('totalAmount')}
                        className="py-2.5 px-2.5 text-right cursor-pointer hover:text-slate-900 select-none w-[13%]"
                      >
                        Total {renderOrderSortIcon('totalAmount')}
                      </th>
                      <th
                        onClick={() => toggleOrderSort('status')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:text-slate-900 select-none w-[11%]"
                      >
                        Statut {renderOrderSortIcon('status')}
                      </th>
                      <th className="py-2.5 px-2 text-right w-14">Opt.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedOrders.map((order) => {
                      const totalQtyOrdered = order.items.reduce((s, it) => s + it.quantityOrdered, 0);
                      const totalQtyReceived = order.items.reduce((s, it) => s + it.quantityReceived, 0);
                      const canReceive =
                        order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
                      const canEditOrder =
                        order.status === 'DRAFT' ||
                        order.status === 'TO_ORDER' ||
                        order.status === 'ORDERED';
                      const canValidateOrder =
                        order.status === 'DRAFT' || order.status === 'TO_ORDER';
                      const isHighlighted = highlightedOrderId === order.id;

                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors ${
                            isHighlighted
                              ? 'bg-amber-50/90 ring-2 ring-inset ring-amber-400'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => setOrderToInspect(order)}
                              className="hover:underline text-left flex items-center gap-1 cursor-pointer max-w-full"
                              title="Voir les pièces de cette liste de commande"
                            >
                              <span className="truncate">{order.orderNumber}</span>
                              <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                            </button>
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                            {formatDate(order.date)}
                          </td>
                          <td className="py-2.5 px-2.5 font-semibold text-slate-800 truncate" title={order.supplierName}>
                            {order.supplierName}
                          </td>
                          <td className="hidden lg:table-cell py-2.5 px-2.5 text-slate-600 truncate" title={order.targetWarehouseName}>
                            <span className="font-medium text-slate-800">
                              {order.targetWarehouseName}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <button
                              type="button"
                              onClick={() => setOrderToInspect(order)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-[11px] text-slate-800 cursor-pointer"
                            >
                              {order.items.length} ({totalQtyReceived}/{totalQtyOrdered})
                            </button>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 truncate">
                            {formatAED(order.totalAmount)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <RowActionsMenu
                              actions={[
                                {
                                  label: 'Consulter les pièces',
                                  icon: <Eye className="w-3.5 h-3.5" />,
                                  onClick: () => setOrderToInspect(order),
                                },
                                {
                                  label: 'Imprimer le bon de commande',
                                  icon: <Printer className="w-3.5 h-3.5" />,
                                  onClick: () => setOrderToPrint(order),
                                },
                                {
                                  label: 'Ajouter produits / Modifier',
                                  icon: <Edit2 className="w-3.5 h-3.5" />,
                                  tone: 'primary',
                                  hidden: !canEditOrder,
                                  onClick: () => {
                                    setOrderToEdit(order);
                                    setPrefilledItemsForPO([]);
                                    setPrefilledSupplierName(undefined);
                                    setIsCreateModalOpen(true);
                                  },
                                },
                                {
                                  label: 'Valider la commande',
                                  icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  hidden: !canValidateOrder,
                                  onClick: () => {
                                    updateSupplierOrderStatus(order.id, 'ORDERED');
                                    setNotification(
                                      `Commande ${order.orderNumber} validée avec succès ! Elle est maintenant prête pour réception.`
                                    );
                                  },
                                },
                                {
                                  label: 'Réceptionner en magasin',
                                  icon: <PackageCheck className="w-3.5 h-3.5" />,
                                  tone: 'success',
                                  hidden: !canReceive,
                                  onClick: () => setOrderToReceive(order),
                                },
                                {
                                  label: 'Annuler la commande',
                                  icon: <Ban className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  dividerBefore: true,
                                  hidden: order.status === 'RECEIVED' || order.status === 'CANCELLED',
                                  onClick: () => setOrderToCancel(order),
                                },
                                {
                                  label: 'Supprimer définitivement',
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  tone: 'danger',
                                  dividerBefore: order.status === 'RECEIVED' || order.status === 'CANCELLED',
                                  onClick: () => setOrderToDelete(order),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              )}
            </div>

            {filteredOrders.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>
                    Affichage{' '}
                    <strong className="font-mono text-slate-900">
                      {(safeOrdersPage - 1) * ordersPageSize + 1}
                    </strong>{' '}
                    à{' '}
                    <strong className="font-mono text-slate-900">
                      {Math.min(safeOrdersPage * ordersPageSize, filteredOrders.length)}
                    </strong>{' '}
                    sur{' '}
                    <strong className="font-mono text-slate-900">
                      {filteredOrders.length}
                    </strong>{' '}
                    commandes
                  </span>
                  <select
                    value={ordersPageSize}
                    onChange={(e) => setOrdersPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                {totalOrdersPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeOrdersPage <= 1}
                      onClick={() => setOrdersCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Précédent</span>
                    </button>
                    <span className="px-2.5 py-1 font-mono font-bold text-slate-800">
                      Page {safeOrdersPage} / {totalOrdersPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeOrdersPage >= totalOrdersPages}
                      onClick={() =>
                        setOrdersCurrentPage((p) => Math.min(totalOrdersPages, p + 1))
                      }
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Suivant</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GESTION DES FOURNISSEURS (CRÉATION, MODIFICATION, SUPPRESSION, HISTORIQUE COMMANDES) */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          {/* KPIs Fournisseurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Fournisseurs Référencés
              </span>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                {suppliers.length}
              </div>
              <span className="text-[11px] text-slate-500">Carnet fournisseurs actif</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Total Commandes Émises
              </span>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                {supplierOrders.length}
              </div>
              <span className="text-[11px] text-slate-500">
                Dont {supplierOrders.filter((o) => o.status === 'DRAFT' || o.status === 'TO_ORDER' || o.status === 'ORDERED').length} en cours
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Volume Cumulé d&apos;Achats
              </span>
              <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                {formatAED(
                  supplierOrders
                    .filter((o) => o.status !== 'CANCELLED')
                    .reduce((s, o) => s + o.totalAmount, 0)
                )}
              </div>
              <span className="text-[11px] text-slate-500">Hors commandes annulées</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Action Rapide
              </span>
              <button
                type="button"
                onClick={openCreateSupplierModal}
                className="mt-2 w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Ajouter un Fournisseur
              </button>
            </div>
          </div>

          {/* Search Bar Suppliers */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <SearchField
              value={supplierSearchQuery}
              onChange={setSupplierSearchQuery}
              className="flex-1"
              placeholder="Nom ou téléphone..."
            />
          </div>

          {/* Suppliers Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="w-full">
              {enrichedSuppliers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">Aucun fournisseur trouvé</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ajoutez un nouveau fournisseur pour suivre ses coordonnées et son historique de commandes.
                  </p>
                </div>
              ) : (
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th
                        onClick={() => toggleSupplierSort('code')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[9%]"
                      >
                        Code {renderSupplierSortIcon('code')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('name')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[22%]"
                      >
                        Fournisseur {renderSupplierSortIcon('name')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('contactPerson')}
                        className="hidden md:table-cell py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[17%]"
                      >
                        Contact {renderSupplierSortIcon('contactPerson')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('brands')}
                        className="hidden xl:table-cell py-2.5 px-2.5 cursor-pointer hover:text-slate-900 select-none w-[14%]"
                      >
                        Marques {renderSupplierSortIcon('brands')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('ordersCount')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:text-slate-900 select-none w-[10%]"
                      >
                        Cdes {renderSupplierSortIcon('ordersCount')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('totalOrderedAmount')}
                        className="py-2.5 px-2.5 text-right cursor-pointer hover:text-slate-900 select-none w-[13%]"
                      >
                        Volume {renderSupplierSortIcon('totalOrderedAmount')}
                      </th>
                      <th
                        onClick={() => toggleSupplierSort('lastOrderDate')}
                        className="hidden lg:table-cell py-2.5 px-2 text-center cursor-pointer hover:text-slate-900 select-none w-[10%]"
                      >
                        Dern. Cde {renderSupplierSortIcon('lastOrderDate')}
                      </th>
                      <th className="py-2.5 px-2 text-right w-14">Opt.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSuppliers.map(
                      ({
                        supplier,
                        ordersCount,
                        activeOrdersCount,
                        totalOrderedAmount,
                        lastOrderDate,
                      }) => (
                        <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900 truncate">
                            {supplier.code}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="font-bold text-slate-900 truncate" title={supplier.name}>{supplier.name}</div>
                            {(supplier.address || supplier.country) && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {[supplier.address, supplier.country].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="hidden md:table-cell py-2.5 px-2.5">
                            <div className="font-medium text-slate-800 truncate">
                              {supplier.contactPerson || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 space-y-0.5">
                              {supplier.phone && (
                                <div className="flex items-center gap-1 truncate">
                                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{supplier.phone}</span>
                                </div>
                              )}
                              {supplier.email && (
                                <div className="flex items-center gap-1 truncate">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{supplier.email}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="hidden xl:table-cell py-2.5 px-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(supplier.brandsHandled || []).length === 0 ? (
                                <span className="text-slate-400 text-[11px]">Toutes</span>
                              ) : (
                                supplier.brandsHandled.slice(0, 2).map((b, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold truncate max-w-full"
                                  >
                                    {b}
                                  </span>
                                ))
                              )}
                              {(supplier.brandsHandled || []).length > 2 && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-semibold">
                                  +{supplier.brandsHandled.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <span className="font-bold text-slate-900">{ordersCount}</span>
                            {activeOrdersCount > 0 && (
                              <span className="block text-[10px] font-bold text-amber-700">
                                {activeOrdersCount} actif
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 truncate">
                            {formatAED(totalOrderedAmount)}
                          </td>
                          <td className="hidden lg:table-cell py-2.5 px-2 text-center text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {lastOrderDate ? formatDate(lastOrderDate) : 'Aucune'}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <RowActionsMenu
                              actions={[
                                {
                                  label: `Historique commandes (${ordersCount})`,
                                  icon: <History className="w-3.5 h-3.5" />,
                                  onClick: () => setSupplierHistoryTarget(supplier),
                                },
                                {
                                  label: 'Nouvelle commande',
                                  icon: <Plus className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  onClick: () => {
                                    setOrderToEdit(null);
                                    setPrefilledItemsForPO([]);
                                    setPrefilledSupplierName(supplier.name);
                                    setIsCreateModalOpen(true);
                                  },
                                },
                                {
                                  label: 'Modifier le fournisseur',
                                  icon: <Edit2 className="w-3.5 h-3.5" />,
                                  tone: 'primary',
                                  onClick: () => openEditSupplierModal(supplier),
                                },
                                {
                                  label: 'Supprimer le fournisseur',
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  tone: 'danger',
                                  dividerBefore: true,
                                  onClick: () => setSupplierToDelete(supplier),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {enrichedSuppliers.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>
                    Affichage{' '}
                    <strong className="font-mono text-slate-900">
                      {(safeSuppliersPage - 1) * suppliersPageSize + 1}
                    </strong>{' '}
                    à{' '}
                    <strong className="font-mono text-slate-900">
                      {Math.min(safeSuppliersPage * suppliersPageSize, enrichedSuppliers.length)}
                    </strong>{' '}
                    sur{' '}
                    <strong className="font-mono text-slate-900">
                      {enrichedSuppliers.length}
                    </strong>{' '}
                    fournisseurs
                  </span>
                  <select
                    value={suppliersPageSize}
                    onChange={(e) => setSuppliersPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                {totalSuppliersPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeSuppliersPage <= 1}
                      onClick={() => setSuppliersCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Précédent</span>
                    </button>
                    <span className="px-2.5 py-1 font-mono font-bold text-slate-800">
                      Page {safeSuppliersPage} / {totalSuppliersPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeSuppliersPage >= totalSuppliersPages}
                      onClick={() =>
                        setSuppliersCurrentPage((p) => Math.min(totalSuppliersPages, p + 1))
                      }
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Suivant</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL : INSPECTION D'UNE LISTE DE COMMANDE (AVEC RECHERCHE ET ACTIONS) */}
      {orderToInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold">
                    Liste de Commande {orderToInspect.orderNumber} — {orderToInspect.supplierName}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Émise le {formatDate(orderToInspect.date)} · Destination :{' '}
                    {orderToInspect.targetWarehouseName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOrderToInspect(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <span>Statut :</span>
                  {getStatusBadge(orderToInspect.status)}
                </div>
                <div className="font-mono font-bold text-slate-900 text-sm">
                  Total : {formatAED(orderToInspect.totalAmount)}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Réf. Constructeur</th>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3">Marque</th>
                      <th className="py-2.5 px-3 text-right">Qté Commandée</th>
                      <th className="py-2.5 px-3 text-right">Qté Reçue</th>
                      <th className="py-2.5 px-3 text-right">Prix Achat</th>
                      <th className="py-2.5 px-3 text-right">Total Ligne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderToInspect.items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {it.mainReference}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{it.designation}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{it.brand}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {it.quantityOrdered}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                          {it.quantityReceived}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {formatAED(it.purchasePrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatAED(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = orderToInspect;
                    setOrderToInspect(null);
                    setOrderToPrint(target);
                  }}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>

                {(orderToInspect.status === 'DRAFT' ||
                  orderToInspect.status === 'TO_ORDER' ||
                  orderToInspect.status === 'ORDERED') && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = orderToInspect;
                      setOrderToInspect(null);
                      setOrderToEdit(target);
                      setPrefilledItemsForPO([]);
                      setPrefilledSupplierName(undefined);
                      setIsCreateModalOpen(true);
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    Ajouter des produits / Modifier la liste
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : CRÉATION / MODIFICATION D'UN FOURNISSEUR */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">
                  {supplierToEdit ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              {suppFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-medium">
                  {suppFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={suppCode}
                    onChange={(e) => setSuppCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nom / Raison Sociale *
                  </label>
                  <input
                    type="text"
                    required
                    value={suppName}
                    onChange={(e) => setSuppName(e.target.value)}
                    placeholder="Ex: Tractafric Equipment, BIA Dakar..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Interlocuteur / Contact
                  </label>
                  <input
                    type="text"
                    value={suppContact}
                    onChange={(e) => setSuppContact(e.target.value)}
                    placeholder="Ex: Marc Delvaux"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                    placeholder="+221 33 839 ..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                    placeholder="contact@fournisseur.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pays</label>
                  <input
                    type="text"
                    value={suppCountry}
                    onChange={(e) => setSuppCountry(e.target.value)}
                    placeholder="Sénégal, France, Belgique..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  placeholder="Zone Industrielle Km 18 Route de Rufisque, Dakar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Marques distribuées (séparées par des virgules)
                </label>
                <input
                  type="text"
                  value={suppBrandsInput}
                  onChange={(e) => setSuppBrandsInput(e.target.value)}
                  placeholder="Ex: CAT, Perkins, Donaldson, Komatsu, ITR"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes / Conditions commerciales
                </label>
                <textarea
                  rows={2}
                  value={suppNotes}
                  onChange={(e) => setSuppNotes(e.target.value)}
                  placeholder="Délais de livraison, conditions de règlement..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : HISTORIQUE DES COMMANDES D'UN FOURNISSEUR */}
      {supplierHistoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold">
                    Historique Fournisseur : {supplierHistoryTarget.name} ({supplierHistoryTarget.code})
                  </h3>
                  <p className="text-xs text-slate-300">
                    {[
                      supplierHistoryTarget.contactPerson,
                      supplierHistoryTarget.phone,
                      supplierHistoryTarget.email,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Coordonnées standard'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSupplierHistoryTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              {(() => {
                const suppOrders = supplierOrders
                  .filter(
                    (o) =>
                      o.supplierName.toLowerCase().trim() ===
                      supplierHistoryTarget.name.toLowerCase().trim()
                  )
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const totalVolume = suppOrders
                  .filter((o) => o.status !== 'CANCELLED')
                  .reduce((s, o) => s + o.totalAmount, 0);

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Commandes passées</span>
                          <span className="text-base font-bold font-mono text-slate-900">
                            {suppOrders.length} bon(s)
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Volume total commandé</span>
                          <span className="text-base font-bold font-mono text-amber-700">
                            {formatAED(totalVolume)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const name = supplierHistoryTarget.name;
                          setSupplierHistoryTarget(null);
                          setOrderToEdit(null);
                          setPrefilledItemsForPO([]);
                          setPrefilledSupplierName(name);
                          setIsCreateModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Nouvelle commande chez {supplierHistoryTarget.name}
                      </button>
                    </div>

                    {suppOrders.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">
                        Aucune commande enregistrée pour ce fournisseur.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">N° Commande</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Magasin</th>
                              <th className="py-2.5 px-3">Articles commandés</th>
                              <th className="py-2.5 px-3 text-right">Montant</th>
                              <th className="py-2.5 px-3 text-center">Statut</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {suppOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {ord.orderNumber}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                  {formatDate(ord.date)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">
                                  {ord.targetWarehouseName}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {ord.items.slice(0, 4).map((it) => (
                                      <span
                                        key={it.id}
                                        className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-mono text-[10px] rounded"
                                      >
                                        {it.mainReference} (x{it.quantityOrdered})
                                      </span>
                                    ))}
                                    {ord.items.length > 4 && (
                                      <span className="text-[10px] text-slate-400">
                                        +{ord.items.length - 4} réf.
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {formatAED(ord.totalAmount)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {getStatusBadge(ord.status)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSupplierHistoryTarget(null);
                                      jumpToOrderList(ord);
                                    }}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Ouvrir</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL : SUPPRESSION D'UN FOURNISSEUR */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Supprimer le fournisseur
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {supplierToDelete.code} — {supplierToDelete.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSupplierToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
              Voulez-vous vraiment supprimer la fiche du fournisseur{' '}
              <strong>{supplierToDelete.name}</strong> ? Ses bons de commande historiques seront
              conservés dans vos archives.
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteSupplier(supplierToDelete.id);
                  if (res.message) setNotification(res.message);
                  setSupplierToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modals */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        orderToEdit={orderToEdit}
        initialItems={prefilledItemsForPO}
        initialSupplierName={prefilledSupplierName}
        onClose={() => {
          setIsCreateModalOpen(false);
          setOrderToEdit(null);
          setPrefilledItemsForPO([]);
          setPrefilledSupplierName(undefined);
        }}
        onSuccess={(msg) => setNotification(msg)}
      />

      <ReceiveOrderModal
        order={orderToReceive}
        onClose={() => setOrderToReceive(null)}
        onSuccess={(msg) => setNotification(msg)}
      />

      <PurchaseOrderPrintModal
        order={orderToPrint}
        onClose={() => setOrderToPrint(null)}
      />

      {/* Cancel Order Confirmation Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirmer l&apos;annulation
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {orderToCancel.orderNumber} — {orderToCancel.supplierName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOrderToCancel(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <p>
                Voulez-vous vraiment annuler le bon de commande{' '}
                <strong>{orderToCancel.orderNumber}</strong> ({orderToCancel.supplierName}) ?
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelSupplierOrder(orderToCancel.id);
                  setNotification(`Commande ${orderToCancel.orderNumber} annulée.`);
                  setOrderToCancel(null);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirmer l&apos;annulation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirmer la suppression
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {orderToDelete.orderNumber} — {orderToDelete.supplierName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOrderToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
              <p>
                Voulez-vous vraiment supprimer définitivement le bon de commande{' '}
                <strong>{orderToDelete.orderNumber}</strong> ({orderToDelete.supplierName}) ?
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteSupplierOrder(orderToDelete.id);
                  if (res.message) setNotification(res.message);
                  setOrderToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <InvoicePdfPriceImportModal
        isOpen={isPdfPriceImportOpen}
        onClose={() => setIsPdfPriceImportOpen(false)}
        onSuccess={(msg) => setNotification(msg)}
      />
    </div>
  );
};
