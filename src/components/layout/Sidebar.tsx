import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ClipboardCheck,
  History,
  AlertOctagon,
  Database,
  RotateCcw,
  Download,
  X,
  Truck,
  ShoppingCart,
  Receipt,
  Banknote,
  Users,
  TrendingUp,
  FlaskConical,
  FileSpreadsheet,
  FileText,
  Trash2,
  Sparkles,
  ShieldCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenTransfer: () => void;
  onResetDemo: () => void;
  onWipeData: () => void;
  onOpenLogin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
  onResetDemo,
  onWipeData,
  onOpenLogin,
}) => {
  const {
    exportDatabaseJson,
    getAlerts,
    customers,
    cashSessions,
    quotes,
    supplierOrders,
    articles,
    currentUser,
    firebaseUser,
    logout,
  } = useStock();
  const alerts = getAlerts();
  const alertCount = alerts.length;

  // Count active open sessions and customers with unpaid debt
  const openSessionsCount = cashSessions.filter((s) => s.status === 'OPEN').length;
  const customersWithDebtCount = customers.filter((c) => c.outstandingBalance > 0).length;
  const pendingQuotesCount = (quotes || []).filter(
    (q) => q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'ACCEPTED'
  ).length;
  const activeOrdersCount = (supplierOrders || []).filter(
    (o) => o.status === 'TO_ORDER' || o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED'
  ).length;

  const salesNavItems = [
    { id: 'new_sale', label: 'Nouvelle Vente (Caisse)', icon: ShoppingCart, highlight: true },
    { id: 'sales_history', label: 'Historique des Ventes', icon: Receipt },
    {
      id: 'quotes',
      label: 'Devis & Factures Proforma',
      icon: FileText,
      badge: pendingQuotesCount > 0 ? `${pendingQuotesCount} en attente` : undefined,
      badgeColor: 'bg-sky-500/20 text-sky-400',
    },
    {
      id: 'cash_register',
      label: 'Caisse & Tiroir',
      icon: Banknote,
      badge: openSessionsCount > 0 ? `${openSessionsCount} ouv.` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      id: 'customers',
      label: 'Clients & Créances',
      icon: Users,
      badge: customersWithDebtCount > 0 ? `${customersWithDebtCount} créances` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400',
    },
  ];

  const stockNavItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'catalog', label: 'Catalogue des pièces', icon: Boxes },
    { id: 'import_catalog', label: 'Importation Excel / CSV', icon: FileSpreadsheet },
    {
      id: 'purchase_orders',
      label: 'Commandes Fournisseurs',
      icon: Truck,
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} en cours` : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-400',
    },
    { id: 'warehouses', label: 'Gestion des magasins', icon: Building2 },
    { id: 'movements', label: 'Mouvements de stock', icon: History },
    { id: 'inventory', label: 'Inventaire physique', icon: ClipboardCheck },
  ];

  const analysisNavItems = [
    { id: 'sales_reports', label: 'Rapports Ventes & Caisse', icon: TrendingUp },
    {
      id: 'reports',
      label: 'Alertes & Stock',
      icon: AlertOctagon,
      badge: alertCount > 0 ? `${alertCount}` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-400',
    },
    {
      id: 'test_suite',
      label: 'Banc d’Essai (10 Tests)',
      icon: FlaskConical,
      badge: 'Auto',
      badgeColor: 'bg-indigo-500/20 text-indigo-400',
      adminOnly: true,
    },
    { id: 'architecture', label: 'Architecture & Schéma BDD', icon: Database, adminOnly: true },
    {
      id: 'auth_management',
      label: 'Accès & Authentification',
      icon: ShieldCheck,
      badge: 'RBAC',
      badgeColor: 'bg-purple-500/20 text-purple-300',
      adminOnly: true,
    },
  ].filter((item) => !item.adminOnly || currentUser.role === 'ADMIN' || currentUser.role === 'RESPONSABLE');

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
              <Truck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">
                EquipStock Pro
              </span>
              <span className="text-[11px] text-amber-400 font-medium tracking-wide">
                Pièces d'Engins Lourds
              </span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {/* Section 1: Commercial & Point de Vente */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 px-3">
              Commercial & Vente
            </span>
            <div className="space-y-0.5">
              {salesNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-slate-950' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-slate-950 text-amber-400'
                            : item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Stocks & Entrepôts */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 px-3">
              Stocks & Approvisionnement
            </span>
            <div className="space-y-0.5">
              {stockNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-slate-950' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-slate-950 text-amber-400'
                            : item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Pilotage & Sécurité */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 px-3">
              Pilotage & Sécurité
            </span>
            <div className="space-y-0.5">
              {analysisNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-slate-950' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-slate-950 text-amber-400'
                            : item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Account / Session Bar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectView('auth_management');
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity flex-1"
            title="Gérer les accès et rôles"
          >
            <div className="relative shrink-0">
              {firebaseUser?.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center border border-slate-700">
                  {currentUser.name.charAt(0)}
                </div>
              )}
              {firebaseUser && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400">
                <span className="text-amber-400 font-semibold">{currentUser.role}</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenLogin) onOpenLogin();
              else onSelectView('auth_management');
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="Connexion Google / Authentification"
          >
            <LogIn className="w-4 h-4" />
          </button>
        </div>

        {/* Minimalist Database & Utility Footer */}
        <div className="px-3.5 py-2.5 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
            <span className="text-[11px] text-slate-400 font-mono truncate">
              {articles.length === 0 ? 'Base vierge (0)' : `${articles.length} pièces`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={exportDatabaseJson}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Télécharger une sauvegarde complète JSON"
              aria-label="Sauvegarder JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onResetDemo}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
              title="Charger les pièces d'exemple démo (CAT, Komatsu...)"
              aria-label="Recharger démo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onWipeData}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
              title="Faire table rase (Vider toutes les données)"
              aria-label="Table rase"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
