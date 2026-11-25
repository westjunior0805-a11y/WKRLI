/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StockProvider, useStock } from './context/StockContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ArticleCatalogView } from './components/catalog/ArticleCatalogView';
import { ImportCatalogView } from './components/catalog/ImportCatalogView';
import { WarehouseListView } from './components/warehouses/WarehouseListView';
import { MovementHistoryView } from './components/movements/MovementHistoryView';
import { InventoryListView } from './components/inventory/InventoryListView';
import { AlertsAndReportsView } from './components/reports/AlertsAndReportsView';
import { AuthManagementView } from './components/auth/AuthManagementView';
import { DatabaseArchitectureView } from './components/architecture/DatabaseArchitectureView';
import { LoginView } from './components/auth/LoginView';
import { NewSaleView } from './components/sales/NewSaleView';
import { SalesHistoryView } from './components/sales/SalesHistoryView';
import { QuoteListView } from './components/quotes/QuoteListView';
import { PurchaseOrderListView } from './components/orders/PurchaseOrderListView';
import { CashRegisterView } from './components/cash/CashRegisterView';
import { CustomerListView } from './components/customers/CustomerListView';
import { SalesAndCashReportsView } from './components/reports/SalesAndCashReportsView';
import { StockInModal } from './components/movements/StockInModal';
import { StockOutModal } from './components/movements/StockOutModal';
import { StockTransferModal } from './components/movements/StockTransferModal';
import { CreatePurchaseOrderModal } from './components/orders/CreatePurchaseOrderModal';
import { NotificationToast, ToastMessage } from './components/common/NotificationToast';
import {
  Trash2,
  AlertTriangle,
  Receipt,
  FileText,
  Banknote,
  Boxes,
  FileSpreadsheet,
  History,
  ClipboardCheck,
  Building2,
  TrendingUp,
  AlertOctagon,
  ShoppingCart,
  Database,
  Download,
} from 'lucide-react';

interface ModuleSubTab {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

function AppContent() {
  const {
    clearAllData,
    isAuthenticated,
    articles,
    quotes,
    cashSessions,
    warehouses,
    getAlerts,
    getTotalStockForArticle,
    companyInfo,
  } = useStock();

  // Control whether the login gate is explicitly opened for operator switching
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);

  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Quick modals state
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);
  const [preselectedArticleId, setPreselectedArticleId] = useState<string | undefined>(undefined);
  const [preselectedOrderArticleId, setPreselectedOrderArticleId] = useState<string | undefined>(undefined);
  const [preselectedOrderBrand, setPreselectedOrderBrand] = useState<string | undefined>(undefined);
  const [focusedPurchaseOrderId, setFocusedPurchaseOrderId] = useState<string | null>(null);
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
  const [wipeKeepWarehouses, setWipeKeepWarehouses] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [stockImportTrigger, setStockImportTrigger] = useState(0);
  const [stockExportTrigger, setStockExportTrigger] = useState(0);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenStockIn = (articleId?: string) => {
    setPreselectedArticleId(articleId);
    setIsStockInOpen(true);
  };

  const handleOpenStockOut = (articleId?: string) => {
    setPreselectedArticleId(articleId);
    setIsStockOutOpen(true);
  };

  const handleOpenTransfer = (articleId?: string) => {
    setPreselectedArticleId(articleId);
    setIsTransferOpen(true);
  };

  const handleOpenPurchaseOrder = (articleId?: string, brand?: string) => {
    setPreselectedOrderArticleId(articleId);
    setPreselectedOrderBrand(brand);
    setIsPurchaseOrderOpen(true);
  };

  const handleNavigateToPurchaseOrder = (orderId: string) => {
    setFocusedPurchaseOrderId(orderId);
    setActiveView('purchase_orders');
  };

  const handleConfirmWipe = async () => {
    setIsWiping(true);
    try {
      await clearAllData({ keepWarehouses: wipeKeepWarehouses });
      setIsWipeConfirmOpen(false);
      addToast(
        'success',
        'Table rase effectuée',
        'La base de données locale a été intégralement purgée et remise à neuf.'
      );
    } catch (err) {
      console.error(err);
      setIsWipeConfirmOpen(false);
      addToast(
        'info',
        'Table rase effectuée',
        'Les données locales ont été remises à zéro.'
      );
    } finally {
      setIsWiping(false);
    }
  };

  // Theme state: 'light' (Variation 19 #F8F7F4), 'soft' (Doux), or 'dark' (Sombre)
  const [theme, setTheme] = useState<'light' | 'soft' | 'dark'>(() => {
    const saved = localStorage.getItem('equipstock_theme_v19');
    if (saved === 'light' || saved === 'soft' || saved === 'dark') {
      return saved;
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('equipstock_theme_v19', theme);
    document.documentElement.classList.remove('dark', 'soft', 'light');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'soft') {
      document.documentElement.classList.add('soft');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'soft' : prev === 'soft' ? 'dark' : 'light'));
  };

  // Enforce authentication: require valid PIN-verified Operator session or local Email login
  if (!isAuthenticated || showAuthGate) {
    return (
      <LoginView
        onSuccess={() => {
          setShowAuthGate(false);
          addToast('success', 'Session ouverte', `Bienvenue dans votre espace ${companyInfo?.name || 'WKRLI'}.`);
        }}
      />
    );
  }

  // Counters for sub-navigation tabs
  const alertsCount = getAlerts().length;
  const openSessionsCount = cashSessions.filter((s) => s.status === 'OPEN').length;
  const pendingQuotesCount = (quotes || []).filter(
    (q) => q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'ACCEPTED'
  ).length;

  // Determine if the active view belongs to a multi-tab module hub
  const getModuleSubTabs = (): { tabs: ModuleSubTab[]; rightAction?: React.ReactNode } | null => {
    if (['sales_history', 'quotes', 'cash_register'].includes(activeView)) {
      return {
        tabs: [
          { id: 'sales_history', label: 'Factures & Ventes', icon: Receipt },
          {
            id: 'quotes',
            label: 'Devis clients',
            icon: FileText,
            count: pendingQuotesCount > 0 ? pendingQuotesCount : undefined,
          },
          {
            id: 'cash_register',
            label: 'Caisse du jour',
            icon: Banknote,
            count: openSessionsCount > 0 ? openSessionsCount : undefined,
          },
        ],
      };
    }

    if (['warehouses', 'movements', 'inventory', 'warehouse_management'].includes(activeView)) {
      return {
        tabs: [
          {
            id: 'warehouses',
            label: 'Stock des pièces',
            icon: Boxes,
          },
          { id: 'movements', label: 'Historique entrées/sorties', icon: History },
          { id: 'inventory', label: 'Inventaire physique', icon: ClipboardCheck },
          {
            id: 'warehouse_management',
            label: 'Mes Magasins',
            icon: Building2,
            count: warehouses.length,
          },
        ],
        rightAction:
          activeView === 'warehouses' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStockImportTrigger((n) => n + 1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#111111] bg-white hover:border-[#FFCD11] hover:bg-[#FFF9DF] border border-[#E0E0E0] transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#7A5C00]" />
                <span>Importer Stock (Excel / CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => setStockExportTrigger((n) => n + 1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.04em] text-[#111111] bg-[#FFCD11] hover:bg-[#E5B700] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#111111]" />
                <span>Exporter Stock</span>
              </button>
            </div>
          ) : undefined,
      };
    }

    if (['sales_reports', 'reports'].includes(activeView)) {
      return {
        tabs: [
          { id: 'sales_reports', label: 'Bilan des ventes', icon: TrendingUp },
          {
            id: 'reports',
            label: 'Alertes de stock',
            icon: AlertOctagon,
            count: alertsCount > 0 ? alertsCount : undefined,
          },
        ],
      };
    }

    return null;
  };

  const moduleSubNav = getModuleSubTabs();

  return (
    <div
      className={`min-h-screen flex flex-col antialiased transition-colors ${
        theme === 'dark'
          ? 'bg-[#0b0f19] text-slate-100'
          : theme === 'soft'
          ? 'bg-[#2e3440] text-[#eceff4]'
          : 'bg-[#F4F4F4] text-[#111111]'
      }`}
    >
      <div className="flex-1 flex w-full">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={(v) => setActiveView(v)}
          isOpenMobile={isSidebarMobileOpen}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
          onOpenStockIn={() => handleOpenStockIn()}
          onOpenStockOut={() => handleOpenStockOut()}
          onOpenTransfer={() => handleOpenTransfer()}
          onResetDemo={() => {}}
          onWipeData={() => setIsWipeConfirmOpen(true)}
          onOpenLogin={() => setShowAuthGate(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Header
            activeView={activeView}
            onToggleSidebarMobile={() => setIsSidebarMobileOpen((prev) => !prev)}
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={() => handleOpenStockOut()}
            onOpenTransfer={() => handleOpenTransfer()}
            onOpenNewSale={() => setActiveView('new_sale')}
            onNavigateToReports={() => setActiveView('reports')}
            onOpenAuth={() => setActiveView('auth_management')}
            onOpenLogin={() => setShowAuthGate(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSelectTheme={(t) => setTheme(t)}
          />

          <main className="flex-1 px-3 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-8 max-w-[1400px] w-full mx-auto space-y-4 sm:space-y-6">
            {/* Unified Module Editorial Sub-Navigation Bar */}
            {moduleSubNav && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 sm:gap-3 bg-white border border-[#E0E0E0] px-3 sm:px-5 py-0 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
                  {moduleSubNav.tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isTabActive = activeView === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveView(tab.id)}
                        className={`inline-flex items-center gap-2 py-3 sm:py-3.5 text-xs transition-all cursor-pointer bg-transparent! border-0 whitespace-nowrap shrink-0 ${
                          isTabActive
                            ? 'text-[#111111] font-bold border-b-[2.5px]! border-[#FFCD11]!'
                            : 'text-[#595959] font-medium border-b-[2.5px]! border-transparent! hover:text-[#111111]'
                        }`}
                      >
                        <TabIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isTabActive ? 'text-[#111111]' : 'text-[#595959]'
                          }`}
                        />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                          <span
                            className={`nav-count font-mono tabular-nums text-[10px] ${
                              isTabActive
                                ? 'bg-[#FFCD11]! text-[#111111]! font-bold'
                                : 'bg-[#F4F4F4] text-[#595959]'
                            }`}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {moduleSubNav.rightAction && (
                  <div className="py-2 border-t border-[#E0E0E0] sm:border-t-0 flex flex-wrap items-center gap-2 shrink-0">
                    {moduleSubNav.rightAction}
                  </div>
                )}
              </div>
            )}

            {activeView === 'dashboard' && (
              <DashboardView
                onNavigateToCatalog={() => setActiveView('catalog')}
                onNavigateToImport={() => setActiveView('import_catalog')}
                onNavigateToMovements={() => setActiveView('movements')}
                onNavigateToReports={() => setActiveView('reports')}
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
                onOpenTransfer={(artId) => handleOpenTransfer(artId)}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
              />
            )}

            {/* Point de Vente & Commercial */}
            {activeView === 'new_sale' && (
              <NewSaleView
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
              />
            )}
            {activeView === 'sales_history' && <SalesHistoryView />}
            {activeView === 'quotes' && (
              <QuoteListView onNavigateToSales={() => setActiveView('sales_history')} />
            )}
            {activeView === 'cash_register' && <CashRegisterView />}
            {activeView === 'customers' && <CustomerListView />}

            {/* Catalogue, Stocks & Logistique */}
            {activeView === 'catalog' && (
              <ArticleCatalogView
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
              />
            )}
            {activeView === 'import_catalog' && (
              <ImportCatalogView onNavigateToCatalog={() => setActiveView('catalog')} />
            )}
            {activeView === 'purchase_orders' && (
              <PurchaseOrderListView
                focusedOrderId={focusedPurchaseOrderId}
                onClearFocusedOrder={() => setFocusedPurchaseOrderId(null)}
              />
            )}
            {activeView === 'warehouses' && (
              <WarehouseListView
                viewMode="stock"
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
                onNavigateToWarehouses={() => setActiveView('warehouse_management')}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
                openImportTrigger={stockImportTrigger}
                exportStockTrigger={stockExportTrigger}
              />
            )}
            {activeView === 'warehouse_management' && (
              <WarehouseListView
                viewMode="warehouses"
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
                onNavigateToStock={() => setActiveView('warehouses')}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
              />
            )}
            {activeView === 'movements' && <MovementHistoryView />}
            {activeView === 'inventory' && (
              <InventoryListView
                onSuccess={(msg) => addToast('success', 'Inventaire mis à jour', msg)}
              />
            )}

            {/* Analyses & Administration */}
            {activeView === 'sales_reports' && <SalesAndCashReportsView />}
            {activeView === 'reports' && (
              <AlertsAndReportsView
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenPurchaseOrder={(artId, brand) => handleOpenPurchaseOrder(artId, brand)}
                onNavigateToPurchaseOrder={(orderId) => handleNavigateToPurchaseOrder(orderId)}
              />
            )}
            {(activeView === 'database' || activeView === 'architecture') && (
              <DatabaseArchitectureView />
            )}
            {activeView === 'auth_management' && <AuthManagementView />}
          </main>
        </div>
      </div>

      {/* Stock Operation Modals */}
      <StockInModal
        isOpen={isStockInOpen}
        preselectedArticleId={preselectedArticleId}
        onClose={() => {
          setIsStockInOpen(false);
          setPreselectedArticleId(undefined);
        }}
        onSuccess={(msg) => addToast('success', 'Entrée enregistrée', msg)}
      />

      <StockOutModal
        isOpen={isStockOutOpen}
        preselectedArticleId={preselectedArticleId}
        onClose={() => {
          setIsStockOutOpen(false);
          setPreselectedArticleId(undefined);
        }}
        onSuccess={(msg) => addToast('success', 'Sortie validée', msg)}
      />

      <StockTransferModal
        isOpen={isTransferOpen}
        preselectedArticleId={preselectedArticleId}
        onClose={() => {
          setIsTransferOpen(false);
          setPreselectedArticleId(undefined);
        }}
        onSuccess={(msg) => addToast('success', 'Transfert effectué', msg)}
      />

      <CreatePurchaseOrderModal
        isOpen={isPurchaseOrderOpen}
        initialItems={
          preselectedOrderArticleId
            ? (() => {
                const art = articles.find((a) => a.id === preselectedOrderArticleId);
                if (!art) return [];
                const currentStock = getTotalStockForArticle(art.id);
                const suggestedQty = Math.max(1, art.minStockThreshold * 2 - currentStock);
                const rawBrand = (preselectedOrderBrand || art.brand || '').trim();
                const isPlaceholder =
                  !rawBrand ||
                  ['non spécifié', 'non specifie', 'non renseigné', 'générique', '-'].includes(
                    rawBrand.toLowerCase()
                  );
                const targetBrand = isPlaceholder ? '' : rawBrand;
                const brandOffer = art.brandOffers?.find(
                  (bo) => bo.brand.trim().toLowerCase() === targetBrand.trim().toLowerCase()
                );
                return [
                  {
                    articleId: art.id,
                    brand: targetBrand,
                    quantityOrdered: suggestedQty,
                    purchasePrice: brandOffer?.purchasePrice ?? art.purchasePrice,
                  },
                ];
              })()
            : []
        }
        initialSupplierName={
          preselectedOrderArticleId
            ? articles.find((a) => a.id === preselectedOrderArticleId)?.preferredSupplier
            : undefined
        }
        onClose={() => {
          setIsPurchaseOrderOpen(false);
          setPreselectedOrderArticleId(undefined);
          setPreselectedOrderBrand(undefined);
        }}
        onSuccess={(msg) => addToast('success', 'Commande enregistrée', msg)}
      />

      {/* Table Rase Modal with Options */}
      {isWipeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Table Rase — Remise à zéro complète</h3>
                  <p className="text-xs text-rose-100">Purge intégrale de la base de données locale</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs sm:text-sm space-y-1.5 leading-relaxed">
                <p className="font-bold text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Attention : Action irréversible
                </p>
                <p>
                  Cette opération supprime définitivement tous les <strong>articles</strong>, <strong>stocks physiques</strong>, <strong>ventes</strong>, <strong>sessions de caisse</strong>, <strong>mouvements</strong>, <strong>inventaires</strong>, <strong>clients</strong> et <strong>commandes fournisseurs</strong> enregistrés sur cet appareil.
                </p>
                <p className="font-medium text-rose-950">
                  Votre application sera 100 % vierge et prête pour vos propres données.
                </p>
              </div>

              {/* Keep warehouses checkbox */}
              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={wipeKeepWarehouses}
                  onChange={(e) => setWipeKeepWarehouses(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">
                    Conserver la liste des magasins actuels
                  </span>
                  <span className="text-slate-500 block mt-0.5">
                    Si coché, vos dépôts restent créés avec un stock remis à 0. Si décoché, seul le Magasin Principal (MAG-01) est conservé.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWipeConfirmOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={handleConfirmWipe}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isWiping ? 'Purge locale en cours...' : 'Confirmer la Table Rase'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast Layer */}
      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <StockProvider>
      <AppContent />
    </StockProvider>
  );
}
