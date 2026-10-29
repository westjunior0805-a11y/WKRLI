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
import { DatabaseArchitectureView } from './components/architecture/DatabaseArchitectureView';
import { AuthManagementView } from './components/auth/AuthManagementView';
import { LoginView } from './components/auth/LoginView';
import { NewSaleView } from './components/sales/NewSaleView';
import { SalesHistoryView } from './components/sales/SalesHistoryView';
import { QuoteListView } from './components/quotes/QuoteListView';
import { PurchaseOrderListView } from './components/orders/PurchaseOrderListView';
import { CashRegisterView } from './components/cash/CashRegisterView';
import { CustomerListView } from './components/customers/CustomerListView';
import { SalesAndCashReportsView } from './components/reports/SalesAndCashReportsView';
import { SystemTestSuiteView } from './components/testing/SystemTestSuiteView';
import { StockInModal } from './components/movements/StockInModal';
import { StockOutModal } from './components/movements/StockOutModal';
import { StockTransferModal } from './components/movements/StockTransferModal';
import { NotificationToast, ToastMessage } from './components/common/NotificationToast';
import { ConfirmModal } from './components/common/ConfirmModal';
import { Trash2, AlertTriangle } from 'lucide-react';

function AppContent() {
  const { resetToDemoData, clearAllData, firebaseUser } = useStock();

  // Control whether the login gate is displayed at startup / on demand
  const [showAuthGate, setShowAuthGate] = useState<boolean>(() => {
    return sessionStorage.getItem('equipstock_auth_bypassed') !== 'true';
  });

  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Quick modals state
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [preselectedArticleId, setPreselectedArticleId] = useState<string | undefined>(undefined);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
  const [wipeKeepWarehouses, setWipeKeepWarehouses] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

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

  const handleConfirmReset = () => {
    resetToDemoData();
    setIsResetConfirmOpen(false);
    addToast('info', 'Réinitialisation effectuée', 'Les données de test d’origine ont été restaurées.');
  };

  const handleConfirmWipe = async () => {
    setIsWiping(true);
    try {
      await clearAllData({ keepWarehouses: wipeKeepWarehouses });
      setIsWipeConfirmOpen(false);
      addToast(
        'success',
        'Table rase effectuée avec succès',
        'Base de données locale et Cloud Firestore entièrement remises à zéro.'
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

  // Theme state: light or dark
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('equipstock_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('equipstock_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // If user is not authenticated via Firebase and has not bypassed the login screen, show LoginView portal
  if (!firebaseUser && showAuthGate) {
    return (
      <LoginView
        onSuccess={() => {
          setShowAuthGate(false);
          sessionStorage.setItem('equipstock_auth_bypassed', 'true');
          addToast('success', 'Bienvenue sur EquipStock Pro', 'Session active prête pour utilisation.');
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col antialiased transition-colors ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100/70 text-slate-900'}`}>
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
          onResetDemo={() => setIsResetConfirmOpen(true)}
          onWipeData={() => setIsWipeConfirmOpen(true)}
          onOpenLogin={() => setShowAuthGate(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            activeView={activeView}
            onToggleSidebarMobile={() => setIsSidebarMobileOpen((prev) => !prev)}
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={() => handleOpenStockOut()}
            onOpenTransfer={() => handleOpenTransfer()}
            onOpenNewSale={() => setActiveView('new_sale')}
            onOpenAuth={() => setActiveView('auth_management')}
            onOpenLogin={() => setShowAuthGate(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-7xl w-full mx-auto">
            {activeView === 'dashboard' && (
              <DashboardView
                onNavigateToCatalog={() => setActiveView('catalog')}
                onNavigateToMovements={() => setActiveView('movements')}
                onNavigateToReports={() => setActiveView('reports')}
                onOpenStockIn={() => handleOpenStockIn()}
                onOpenStockOut={() => handleOpenStockOut()}
                onOpenTransfer={() => handleOpenTransfer()}
              />
            )}

            {/* Ventes & Caisse */}
            {activeView === 'new_sale' && <NewSaleView />}

            {activeView === 'sales_history' && <SalesHistoryView />}

            {activeView === 'quotes' && <QuoteListView />}

            {activeView === 'cash_register' && <CashRegisterView />}

            {activeView === 'customers' && <CustomerListView />}

            {/* Stock & Dépôts */}
            {activeView === 'catalog' && (
              <ArticleCatalogView
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
              />
            )}

            {activeView === 'import_catalog' && (
              <ImportCatalogView onNavigateToCatalog={() => setActiveView('catalog')} />
            )}

            {activeView === 'purchase_orders' && <PurchaseOrderListView />}

            {activeView === 'warehouses' && (
              <WarehouseListView
                onOpenStockIn={(artId) => handleOpenStockIn(artId)}
                onOpenStockOut={(artId) => handleOpenStockOut(artId)}
              />
            )}

            {activeView === 'movements' && <MovementHistoryView />}

            {activeView === 'inventory' && (
              <InventoryListView
                onSuccess={(msg) => addToast('success', 'Inventaire mis à jour', msg)}
              />
            )}

            {/* Analyses & Contrôle */}
            {activeView === 'sales_reports' && <SalesAndCashReportsView />}

            {activeView === 'reports' && (
              <AlertsAndReportsView onOpenStockIn={(artId) => handleOpenStockIn(artId)} />
            )}

            {activeView === 'test_suite' && <SystemTestSuiteView />}

            {activeView === 'architecture' && <DatabaseArchitectureView />}
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

      {/* Demo Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Réinitialiser les données de démonstration"
        message="Voulez-vous restaurer le jeu de données d'origine ? Tous les mouvements et modifications apportés seront remplacés par le catalogue initial de pièces pour engins lourds."
        confirmLabel="Réinitialiser"
        cancelLabel="Garder mes données"
        variant="warning"
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
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
                  <p className="text-xs text-rose-100">Réinitialisation de la base de données</p>
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
                  Cette opération supprime définitivement tous les <strong>articles</strong>, <strong>stocks physiques</strong>, <strong>ventes</strong>, <strong>sessions de caisse</strong>, <strong>mouvements</strong>, <strong>inventaires</strong>, <strong>clients</strong> et <strong>commandes fournisseurs</strong>.
                </p>
                <p className="font-medium text-rose-950">
                  Votre application sera 100 % vierge et prête pour démarrer la saisie ou l'import de vos véritables données d'entreprise.
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
                    Si coché, les fiches magasins existantes restent créées mais leurs stocks physiques seront tous remis à 0. Si décoché, seul le magasin principal est conservé.
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
                  <span>{isWiping ? 'Purge Cloud et Locale...' : 'Confirmer la Table Rase'}</span>
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
