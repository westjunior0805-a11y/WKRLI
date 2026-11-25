import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Receipt,
  Users,
  TrendingUp,
  ShieldCheck,
  LogOut,
  Download,
  Trash2,
  X,
  Layers,
  Database,
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

interface NavModuleItem {
  id: string;
  defaultView: string;
  matchViews: string[];
  label: string;
  subLabel?: string;
  icon: React.ElementType;
  count?: number;
  countTone?: 'amber' | 'rose' | 'emerald' | 'slate';
  adminOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavModuleItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
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
    currentPermissions,
    companyInfo,
  } = useStock();

  const isCollapsed = false;

  const alerts = getAlerts();
  const alertCount = alerts.length;
  const openSessionsCount = cashSessions.filter((s) => s.status === 'OPEN').length;
  const customersWithDebtCount = customers.filter((c) => c.outstandingBalance > 0).length;
  const pendingQuotesCount = (quotes || []).filter(
    (q) => q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'ACCEPTED'
  ).length;
  const activeOrdersCount = (supplierOrders || []).filter(
    (o) =>
      o.status === 'DRAFT' ||
      o.status === 'TO_ORDER' ||
      o.status === 'ORDERED' ||
      o.status === 'PARTIALLY_RECEIVED'
  ).length;

  // Architecture modulaire simplifiée en 4 pôles métiers filtrée selon les autorisations de l'opérateur
  const rawNavGroups: NavGroup[] = [
    {
      title: 'Pilotage',
      items: [
        {
          id: 'mod_dashboard',
          defaultView: 'dashboard',
          matchViews: ['dashboard'],
          label: 'Tableau de bord',
          subLabel: 'Synthèse & indicateurs',
          icon: LayoutDashboard,
        },
        ...(currentPermissions.canViewReports
          ? [
              {
                id: 'mod_analytics',
                defaultView: 'sales_reports',
                matchViews: ['sales_reports', 'reports'],
                label: 'Rapports & Alertes',
                subLabel: 'Finances & ruptures stock',
                icon: TrendingUp,
                count: alertCount > 0 ? alertCount : undefined,
                countTone: 'rose' as const,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Commercial & Caisse',
      items: [
        ...(currentPermissions.canSell ||
        currentPermissions.canManageQuotes ||
        currentPermissions.canManageCash
          ? [
              {
                id: 'mod_commercial',
                defaultView: 'sales_history',
                matchViews: ['sales_history', 'quotes', 'cash_register'],
                label: 'Ventes, Devis & Caisse',
                subLabel: 'Facturation & tiroir-caisse',
                icon: Receipt,
                count:
                  pendingQuotesCount + openSessionsCount > 0
                    ? pendingQuotesCount + openSessionsCount
                    : undefined,
                countTone: (openSessionsCount > 0 ? 'emerald' : 'slate') as 'emerald' | 'slate',
              },
            ]
          : []),
        ...(currentPermissions.canManageCustomers
          ? [
              {
                id: 'mod_customers',
                defaultView: 'customers',
                matchViews: ['customers'],
                label: 'Clients & Créances',
                subLabel: 'Comptes & règlements',
                icon: Users,
                count: customersWithDebtCount > 0 ? customersWithDebtCount : undefined,
                countTone: 'amber' as const,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Catalogue & Logistique',
      items: [
        {
          id: 'mod_catalog',
          defaultView: 'catalog',
          matchViews: ['catalog'],
          label: 'Catalogue',
          subLabel: 'Références, fiches & import',
          icon: Boxes,
          count: articles.length > 0 ? articles.length : undefined,
          countTone: 'slate',
        },
        {
          id: 'mod_logistics',
          defaultView: 'warehouses',
          matchViews: ['warehouses', 'movements', 'inventory', 'warehouse_management'],
          label: 'Stock & Dépôts',
          subLabel: 'Stock, prix, import & mouvements',
          icon: Layers,
        },
        ...(currentPermissions.canManagePurchases
          ? [
              {
                id: 'mod_purchases',
                defaultView: 'purchase_orders',
                matchViews: ['purchase_orders'],
                label: 'Achats Fournisseurs',
                subLabel: 'Commandes & réceptions',
                icon: Truck,
                count: activeOrdersCount > 0 ? activeOrdersCount : undefined,
                countTone: 'amber' as const,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Administration',
      items: [
        ...(currentPermissions.canManageDatabase
          ? [
              {
                id: 'mod_database',
                defaultView: 'database',
                matchViews: ['database', 'architecture'],
                label: 'Bases de Données',
                subLabel: 'Tables, Cloud, sauvegardes & purge',
                icon: Database,
              },
            ]
          : []),
        ...(currentPermissions.canManageUsers ||
        currentUser.role === 'ADMIN' ||
        currentUser.role === 'RESPONSABLE'
          ? [
              {
                id: 'mod_security',
                defaultView: 'auth_management',
                matchViews: ['auth_management'],
                label: 'Entreprise & Accès',
                subLabel: 'Société, utilisateurs & droits',
                icon: ShieldCheck,
              },
            ]
          : []),
      ],
    },
  ];

  const navGroups = rawNavGroups.filter((group) => group.items.length > 0);

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    onCloseMobile();
  };

  const displayCompanyName =
    companyInfo?.name && !companyInfo.name.toUpperCase().includes('EQUIPSTOCK')
      ? companyInfo.name
      : companyInfo?.shortName &&
        companyInfo.shortName !== 'ESP' &&
        companyInfo.shortName !== 'E-STOCK'
      ? companyInfo.shortName
      : 'WKRLI';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container — Caterpillar SIS 2.0 Palette + Refined Spacing */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 xl:w-[268px] bg-white dark:bg-slate-950 text-[#111111] dark:text-slate-200 border-r border-[#E0E0E0] dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Boxed Monospace Brand Header (SIS 2.0 Black & Cat Yellow) */}
        <div
          className={`flex items-center justify-between pt-5 pb-5 border-b border-[#E0E0E0] dark:border-slate-800 shrink-0 ${
            isCollapsed ? 'px-3 lg:justify-center' : 'px-6'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {companyInfo.logoUrl && (
              <img
                src={companyInfo.logoUrl}
                alt={companyInfo.name}
                className="w-8 h-8 object-contain bg-white border border-[#E0E0E0] p-0.5 shrink-0"
              />
            )}
            {!isCollapsed && (
              <div
                className="font-mono font-bold text-xs tracking-[0.15em] uppercase px-3 py-1.5 bg-[#111111] text-white border-b-[3px] border-[#FFCD11] truncate max-w-[180px]"
                title={displayCompanyName}
              >
                {displayCompanyName}
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-[#111111]/60 hover:text-[#111111]"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editorial Numbered Navigation */}
        <nav className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
          {navGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {!isCollapsed ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#595959] dark:text-slate-400 block mb-2">
                  {String(groupIndex + 1).padStart(2, '0')}. {group.title}
                </span>
              ) : (
                <div className="h-px bg-[#E0E0E0] my-2" />
              )}

              <div className="flex flex-col">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.matchViews.includes(activeView);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.defaultView)}
                      title={isCollapsed ? `${item.label} — ${item.subLabel || ''}` : undefined}
                      className={`nav-link w-full flex items-center justify-between text-left bg-transparent! border-0 border-b! transition-colors ${
                        isActive
                          ? 'active border-b-[2.5px]! border-[#FFCD11]! text-[#111111]! dark:text-white! font-semibold'
                          : 'border-[#EBEBEB]! dark:border-slate-800! text-[#595959] dark:text-slate-400 hover:text-[#111111] dark:hover:text-white'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-2.5 min-w-0 ${
                          isCollapsed ? 'lg:justify-center' : ''
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive
                              ? 'text-[#111111] dark:text-[#FFCD11]'
                              : 'text-[#737373] dark:text-slate-500'
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="text-[13px] truncate leading-snug">
                            {item.label}
                          </span>
                        )}
                      </div>

                      {/* Subtle Monospace Counter Chip */}
                      {!isCollapsed && item.count !== undefined && (
                        <span
                          className={`nav-count font-mono tabular-nums text-[10.5px] shrink-0 ml-2 ${
                            isActive
                              ? 'bg-[#FFCD11]! text-[#111111]! font-bold'
                              : 'bg-[#ECECEC] text-[#3D3D3D] dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Utility Bar */}
        <div className="border-t border-[#E0E0E0] dark:border-slate-800 px-6 py-4 shrink-0">
          <div
            className={`flex items-center justify-between text-[11px] text-[#595959] dark:text-slate-400 ${
              isCollapsed ? 'lg:flex-col lg:gap-1.5' : ''
            }`}
          >
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => handleNavClick('database')}
                className="font-mono tabular-nums truncate hover:text-[#111111] transition-colors cursor-pointer text-left font-bold text-[11px] border-0! bg-transparent! p-0!"
                title="Ouvrir le module Bases de Données"
              >
                {articles.length} RÉF. EN BASE
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exportDatabaseJson}
                className="p-1.5 text-[#595959] hover:text-[#111111] border border-[#D4D4D4] bg-white transition-colors cursor-pointer"
                title="Exporter une sauvegarde complète (JSON)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {currentPermissions.canManageDatabase && (
                <button
                  type="button"
                  onClick={onWipeData}
                  className="p-1.5 text-[#595959] hover:text-rose-600 border border-[#D4D4D4] bg-white transition-colors cursor-pointer"
                  title="Purger la base de données (Table rase)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
