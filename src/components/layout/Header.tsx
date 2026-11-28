import React, { useState, useRef, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  LogIn,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Layers,
  Sun,
  Moon,
  Eye,
  KeyRound,
  ShoppingCart,
} from 'lucide-react';

export type AppTheme = 'light' | 'soft' | 'dark';

interface HeaderProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenTransfer: () => void;
  onOpenNewSale?: () => void;
  onNavigateToReports?: () => void;
  onToggleSidebarMobile: () => void;
  onOpenAuth?: () => void;
  onOpenLogin?: () => void;
  activeView: string;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  onSelectTheme?: (theme: AppTheme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
  onOpenNewSale,
  onNavigateToReports,
  onToggleSidebarMobile,
  onOpenAuth,
  onOpenLogin,
  activeView,
}) => {
  const {
    currentUser,
    firebaseUser,
    warehouses,
    selectedWarehouseId,
    setSelectedWarehouseId,
    getAlerts,
    lockSession,
    logout,
    refreshFromCloud,
  } = useStock();

  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
    root.style.removeProperty('--accent-tint');
    root.style.removeProperty('--accent-border');
    root.style.removeProperty('--accent-dark');
    root.style.removeProperty('--accent-ring');
    root.style.removeProperty('--bg');
    try {
      localStorage.removeItem('wkrli_color_nuance_idx');
    } catch {
      // ignore
    }
  }, []);

  const stockMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stockMenuRef.current && !stockMenuRef.current.contains(event.target as Node)) {
        setIsStockMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alerts = getAlerts();
  const criticalCount = alerts.filter((a) => a.alertType === 'RUPTURE').length;

  // View title translation
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'new_sale':
        return 'Point de Vente';
      case 'sales_history':
        return 'Ventes & Facturation';
      case 'quotes':
        return 'Devis Clients';
      case 'cash_register':
        return 'Caisse du jour';
      case 'customers':
        return 'Clients & Créances';
      case 'sales_reports':
        return 'Rapports Financiers';
      case 'catalog':
        return 'Catalogue';
      case 'import_catalog':
        return 'Importation';
      case 'purchase_orders':
        return 'Achats Fournisseurs';
      case 'warehouses':
        return 'Stock & Dépôts';
      case 'boutique_replenishment':
        return 'Réapprovisionnement Boutique';
      case 'warehouse_management':
        return 'Magasins & Dépôts';
      case 'movements':
        return 'Mouvements';
      case 'inventory':
        return 'Inventaire';
      case 'reports':
        return 'Alertes & Rapports';
      case 'test_suite':
        return 'Validation';
      case 'database':
      case 'architecture':
        return 'Bases de Données';
      case 'auth_management':
        return 'Entreprise & Accès';
      default:
        return 'Gestion de stock';
    }
  };

  return (
    <header className="sis-header sticky top-0 z-30 bg-[#111111] text-white border-b-[3px] border-[#FFCD11] px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8 lg:py-3.5">
      <div className="header-bar flex flex-wrap md:flex-nowrap items-center justify-between gap-x-2.5 sm:gap-x-4 gap-y-2">
        {/* Left: Editorial View Title (Mobile menu lives in bottom navigation bar) */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-initial">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
              <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-white tracking-[-0.015em] leading-tight truncate">
                {getViewTitle()}
              </h2>
            </div>
          </div>
        </div>

        {/* Mobile Row-1 Right / Desktop Right-End: Primary CTA + Critical Alert + User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 md:order-3">
          {/* Desktop Primary Header CTA Button: + Nouvelle Vente (on mobile/tablet, Vente lives in MobileBottomNav) */}
          {onOpenNewSale && (
            <button
              type="button"
              onClick={onOpenNewSale}
              title="Accéder au Guichet Comptoir / Nouvelle Vente"
              className={`cta-btn hidden lg:inline-flex items-center gap-1.5 px-4 py-2 font-bold text-xs uppercase tracking-[0.05em] border-0 cursor-pointer transition-colors whitespace-nowrap ${
                activeView === 'new_sale'
                  ? 'bg-[#E5B700]! text-[#111111]!'
                  : 'bg-[#FFCD11]! hover:bg-[#E5B700]! text-[#111111]!'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-[#111111] shrink-0" />
              <span>+ Nouvelle Vente</span>
            </button>
          )}

          {/* Stock Rupture Alert Button (visible dès md / portable 13") */}
          {criticalCount > 0 && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="sis-header-ctrl hidden md:flex items-center gap-1.5 px-2.5 xl:px-3 py-2 text-xs font-mono font-bold text-white bg-[#1F1F1F] hover:border-[#FFCD11] border border-[#3A3A3A] transition-colors cursor-pointer whitespace-nowrap"
              title={`${criticalCount} référence(s) en rupture totale — Cliquer pour voir les alertes`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#FFCD11] shrink-0" />
              <span className="xl:hidden">{criticalCount}</span>
              <span className="hidden xl:inline">
                {criticalCount} RUPTURE{criticalCount > 1 ? 'S' : ''}
              </span>
            </button>
          )}

          {/* Unified Operator & Account Management Container */}
          <div className="relative border-l border-[#333333] pl-1.5 sm:pl-2.5" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="sis-header-ctrl flex items-center gap-2 sm:gap-2.5 px-2 sm:px-2.5 py-1.5 bg-[#1F1F1F] hover:border-[#FFCD11] border border-[#3A3A3A] transition-colors text-left cursor-pointer"
              title="Compte opérateur, gestion des accès et session"
            >
              <div className="relative shrink-0">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={currentUser.name}
                    className="w-6 h-6 object-cover border border-[#3A3A3A]"
                  />
                ) : (
                  <div className="w-6 h-6 bg-[#FFCD11] text-[#111111] font-mono font-bold text-xs flex items-center justify-center">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-white leading-none truncate max-w-[125px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#FFCD11] mt-0.5 leading-none uppercase">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown
                className={`hidden md:block w-3.5 h-3.5 text-white/70 transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-[#D4D4D4] py-2 z-50 text-xs shadow-lg">
                {/* Active user header */}
                <div className="px-3.5 pb-2.5 border-b border-[#E0E0E0]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#111111] truncate">
                      {currentUser.name}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#FFCD11] text-[#111111] shrink-0">
                      {currentUser.role}
                    </span>
                  </div>
                  {currentUser.email && (
                    <div className="text-[11px] font-mono text-[#595959] truncate mt-1">
                      {currentUser.email}
                    </div>
                  )}
                </div>

                {/* Session & Security Actions */}
                <div className="pt-1.5 space-y-0.5">
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuth();
                      }}
                      title="Gérer l'annuaire des opérateurs, codes PIN et droits d'accès"
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#111111] hover:bg-[#F4F4F4] border-0 transition-colors font-semibold cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#7A5C00] shrink-0" />
                      <span>Comptes & codes PIN</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      lockSession();
                      if (onOpenLogin) onOpenLogin();
                    }}
                    title="Verrouiller la session actuelle et changer d'opérateur par code PIN"
                    className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#111111] hover:bg-[#F4F4F4] border-0 transition-colors font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-[#7A5C00] shrink-0" />
                    <span>Changer d'opérateur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                      if (onOpenLogin) onOpenLogin();
                    }}
                    title="Fermer complètement la session"
                    className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-rose-600 hover:bg-[#F4F4F4] border-0 border-t border-[#E0E0E0] mt-1 pt-2 transition-colors font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Row-2 Full-Width Utility Bar / Desktop Middle-Right Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto md:order-2 pt-2 md:pt-0 border-t border-[#2A2A2A] md:border-t-0">
          {/* Warehouse Selector */}
          <div className="relative flex items-center flex-1 min-w-0 md:flex-initial">
            <Building2 className="w-3.5 h-3.5 text-[#FFCD11] absolute left-2.5 pointer-events-none" />
            <select
              value={selectedWarehouseId || 'ALL'}
              onChange={(e) =>
                setSelectedWarehouseId(e.target.value === 'ALL' ? null : e.target.value)
              }
              disabled={currentUser.role === 'MAGASINIER' && !!currentUser.assignedWarehouseId}
              className="w-full md:w-auto text-xs pl-8 pr-6 sm:pr-7 py-1.5 sm:py-2 bg-[#1F1F1F] border border-[#3A3A3A] text-white font-medium hover:border-[#FFCD11] focus:outline-none focus:border-[#FFCD11] transition-colors disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer md:max-w-[190px] lg:max-w-none truncate"
              title="Filtrer la vue par magasin"
            >
              <option value="ALL">Tous les magasins</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unified Stock Operations Dropdown */}
          <div className="relative shrink-0" ref={stockMenuRef}>
            <button
              type="button"
              onClick={() => setIsStockMenuOpen((prev) => !prev)}
              className="sis-header-ctrl inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-white bg-[#1F1F1F] hover:border-[#FFCD11] border border-[#3A3A3A] transition-colors whitespace-nowrap cursor-pointer"
              title="Effectuer une entrée, une sortie ou un transfert"
            >
              <Layers className="w-3.5 h-3.5 text-[#FFCD11]" />
              <span>Mouvements</span>
              <ChevronDown
                className={`w-3 h-3 text-white/70 transition-transform ${isStockMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isStockMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white border border-[#D4D4D4] py-1 z-50 text-xs shadow-lg">
                <div className="px-3.5 py-2 label border-b border-[#E0E0E0]">
                  Actions Stock
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockIn();
                  }}
                  title="Réception fournisseur / bon d'entrée en stock"
                  className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-[#F4F4F4] text-[#111111] font-semibold border-0 border-b border-[#EBEBEB] transition-colors cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Entrée de pièces</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockOut();
                  }}
                  title="Livraison / bon de sortie ou consommation interne"
                  className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-[#F4F4F4] text-[#111111] font-semibold border-0 border-b border-[#EBEBEB] transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-[#7A5C00] shrink-0" />
                  <span>Sortie de pièces</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenTransfer();
                  }}
                  title="Déplacement de stock entre deux magasins / dépôts"
                  className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-[#F4F4F4] text-[#111111] font-semibold border-0 transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[#111111] shrink-0" />
                  <span>Transfert inter-dépôts</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


