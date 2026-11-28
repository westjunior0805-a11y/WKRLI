import React from 'react';
import { LayoutDashboard, TrendingUp, ShoppingCart, Layers, Users, Menu } from 'lucide-react';
import { useStock } from '../../context/StockContext';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenMenu,
}) => {
  const { currentPermissions } = useStock();

  const homeView = currentPermissions.canViewReports ? 'sales_reports' : 'dashboard';

  const items = [
    {
      id: homeView,
      label: 'Accueil',
      icon: currentPermissions.canViewReports ? TrendingUp : LayoutDashboard,
      isActive: currentPermissions.canViewReports
        ? ['sales_reports', 'reports'].includes(activeView)
        : activeView === 'dashboard',
      onClick: () => onSelectView(homeView),
      accent: false,
    },
    ...(currentPermissions.canSell
      ? [
          {
            id: 'new_sale',
            label: 'Vente',
            icon: ShoppingCart,
            isActive: activeView === 'new_sale',
            onClick: () => onSelectView('new_sale'),
            accent: true,
          },
        ]
      : []),
    {
      id: 'warehouses',
      label: 'Stock',
      icon: Layers,
      isActive: [
        'warehouses',
        'boutique_replenishment',
        'movements',
        'inventory',
        'warehouse_management',
        'catalog',
      ].includes(activeView),
      onClick: () => onSelectView('warehouses'),
      accent: false,
    },
    ...(currentPermissions.canManageCustomers
      ? [
          {
            id: 'customers',
            label: 'Clients',
            icon: Users,
            isActive: activeView === 'customers',
            onClick: () => onSelectView('customers'),
            accent: false,
          },
        ]
      : []),
    {
      id: 'menu',
      label: 'Menu',
      icon: Menu,
      isActive: false,
      onClick: onOpenMenu,
      accent: false,
    },
  ];

  return (
    <nav
      aria-label="Navigation rapide mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#111111] border-t-2 border-[#FFCD11] print:hidden"
    >
      <div className="grid grid-flow-col auto-cols-fr">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[10px] font-bold uppercase tracking-wider border-0! transition-colors cursor-pointer ${
                item.accent
                  ? item.isActive
                    ? 'bg-[#E5B700]! text-[#111111]!'
                    : 'bg-[#FFCD11]! text-[#111111]!'
                  : item.isActive
                  ? 'bg-[#222222]! text-[#FFCD11]!'
                  : 'bg-transparent! text-white/75 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
