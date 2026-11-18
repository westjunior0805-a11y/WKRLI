import React, { useState, useRef, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import { getFirebaseEnvironmentInfo, subscribeToQuotaExceeded } from '../../firebase';
import {
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  Menu,
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
  const [envInfo, setEnvInfo] = useState(() => getFirebaseEnvironmentInfo());
  const [quotaExceeded, setQuotaExceeded] = useState(false);

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

  useEffect(() => {
    const handleEnvChange = () => setEnvInfo(getFirebaseEnvironmentInfo());
    window.addEventListener('equipstock-firebase-env-changed', handleEnvChange);
    const unsubQuota = subscribeToQuotaExceeded(setQuotaExceeded);
    return () => {
      window.removeEventListener('equipstock-firebase-env-changed', handleEnvChange);
      unsubQuota();
    };
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

  const activeWarehouseName = selectedWarehouseId
    ? warehouses.find((w) => w.id === selectedWarehouseId)?.name || 'Magasin sélectionné'
    : 'Vue consolidée multi-dépôts';

  return (
    <header className="sticky top-0 z-30 bg-[#F8F7F4]/95 dark:bg-[#0b0f19]/95 backdrop-blur-xs border-b border-[#E5E5E5] dark:border-slate-800 px-4 sm:px-10 py-5">
      <div className="header-bar flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + Syne Bold View Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 text-[#1B1B1B] bg-white border border-[#E5E5E5] rounded transition-colors shrink-0"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 min-w-0">
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[#1B1B1B] dark:text-white tracking-[-0.05em] leading-[0.95] truncate">
                {getViewTitle()}
              </h2>
              <span
                className={`hidden md:inline-flex items-center gap-1.5 font-mono font-semibold text-[10px] uppercase tracking-wider ${
                  envInfo.isAiStudioPreview
                    ? 'text-[#E35E2D]'
                    : quotaExceeded
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
                title={
                  envInfo.isAiStudioPreview
                    ? 'Aperçu Google AI Studio : données de démo isolées (sans impact sur vos données réelles)'
                    : quotaExceeded
                    ? 'Quota gratuit quotidien Firebase dépassé : mode local autonome actif (réinitialisation demain)'
                    : `Synchronisation Cloud Firestore active (${envInfo.projectId})`
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    envInfo.isAiStudioPreview
                      ? 'bg-[#E35E2D]'
                      : quotaExceeded
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                {envInfo.isAiStudioPreview
                  ? 'APERÇU DÉMO ISOLÉ'
                  : quotaExceeded
                  ? 'QUOTA FIREBASE ATTEINT (LOCAL)'
                  : 'CLOUD FIRESTORE ACTIF'}
              </span>
            </div>
            <div className="meta mt-1">
              {activeWarehouseName}
            </div>
          </div>
        </div>

        {/* Right Zone: Variation 19 Controls & Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Warehouse Selector */}
          <div className="relative flex items-center">
            <Building2 className="w-3.5 h-3.5 text-[#E35E2D] absolute left-2.5 pointer-events-none" />
            <select
              value={selectedWarehouseId || 'ALL'}
              onChange={(e) =>
                setSelectedWarehouseId(e.target.value === 'ALL' ? null : e.target.value)
              }
              disabled={currentUser.role === 'MAGASINIER' && !!currentUser.assignedWarehouseId}
              className="text-xs pl-8 pr-6 sm:pr-7 py-2 bg-white border border-[#E5E5E5] text-[#1B1B1B] font-semibold rounded hover:border-[#E35E2D] focus:outline-none focus:border-[#E35E2D] transition-colors disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer max-w-[140px] sm:max-w-none truncate"
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
          <div className="relative" ref={stockMenuRef}>
            <button
              type="button"
              onClick={() => setIsStockMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1B1B1B] bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded transition-colors whitespace-nowrap cursor-pointer"
              title="Effectuer une entrée, une sortie ou un transfert"
            >
              <Layers className="w-3.5 h-3.5 text-[#E35E2D]" />
              <span className="hidden sm:inline">Mouvements</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isStockMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isStockMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#E5E5E5] rounded-lg py-1 z-50 text-xs shadow-lg">
                <div className="px-3 py-2 label border-b border-[#E5E5E5]">
                  Actions Stock
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockIn();
                  }}
                  title="Réception fournisseur / bon d'entrée en stock"
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-[#F9FAFB] text-[#1B1B1B] font-semibold border-0 border-b border-[#E5E5E5] transition-colors cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Entrée de pièces</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockOut();
                  }}
                  title="Livraison / bon de sortie ou consommation interne"
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-[#F9FAFB] text-[#1B1B1B] font-semibold border-0 border-b border-[#E5E5E5] transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-[#E35E2D] shrink-0" />
                  <span>Sortie de pièces</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenTransfer();
                  }}
                  title="Déplacement de stock entre deux magasins / dépôts"
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-[#F9FAFB] text-[#1B1B1B] font-semibold border-0 transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-[#1B1B1B] shrink-0" />
                  <span>Transfert inter-dépôts</span>
                </button>
              </div>
            )}
          </div>

          {/* Permanent Primary Header CTA Button: + Nouvelle Vente */}
          {onOpenNewSale && (
            <button
              type="button"
              onClick={onOpenNewSale}
              title="Accéder au Guichet Comptoir / Nouvelle Vente"
              className={`cta-btn inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 font-semibold text-xs rounded border-0 cursor-pointer transition-colors ${
                activeView === 'new_sale'
                  ? 'bg-[#E35E2D]! text-white!'
                  : 'bg-[#1B1B1B]! hover:bg-[#E35E2D]! text-white!'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="hidden sm:inline">+ Nouvelle Vente</span>
              <span className="sm:hidden">Vente</span>
            </button>
          )}

          {/* Stock Rupture Alert Button */}
          {criticalCount > 0 && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="hidden xl:flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold text-rose-600 bg-white hover:border-rose-500 border border-[#E5E5E5] rounded transition-colors cursor-pointer"
              title={`${criticalCount} référence(s) en rupture totale — Cliquer pour voir les alertes`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {criticalCount} RUPTURE{criticalCount > 1 ? 'S' : ''}
              </span>
            </button>
          )}

          {/* Unified Operator & Account Management Container */}
          <div className="relative border-l border-[#E5E5E5] pl-2 sm:pl-3" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 px-3 py-1.5 bg-white hover:border-[#E35E2D] border border-[#E5E5E5] rounded transition-colors text-left cursor-pointer"
              title="Compte opérateur, gestion des accès et session"
            >
              <div className="relative shrink-0">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={currentUser.name}
                    className="w-6 h-6 object-cover rounded border border-[#E5E5E5]"
                  />
                ) : (
                  <div className="w-6 h-6 bg-[#E35E2D] text-white font-semibold text-xs rounded flex items-center justify-center">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-[#1B1B1B] leading-none truncate max-w-[130px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-mono font-semibold text-[#E35E2D] mt-0.5 leading-none uppercase">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown
                className={`hidden md:block w-3.5 h-3.5 text-[#1B1B1B]/60 transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-68 bg-white border border-[#E5E5E5] rounded-lg py-2 z-50 text-xs">
                {/* Active user header */}
                <div className="px-3.5 pb-2.5 border-b border-[#E5E5E5]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1B1B1B] truncate">
                      {currentUser.name}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#E35E2D] text-white rounded shrink-0">
                      {currentUser.role}
                    </span>
                  </div>
                  {currentUser.email && (
                    <div className="text-[11px] font-mono text-[#1B1B1B]/50 truncate mt-1">
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
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1B1B1B] hover:bg-[#F9FAFB] border-0 transition-colors font-semibold cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#E35E2D] shrink-0" />
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
                    className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1B1B1B] hover:bg-[#F9FAFB] border-0 transition-colors font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-[#E35E2D] shrink-0" />
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
                    className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-rose-600 hover:bg-[#F9FAFB] border-0 border-t border-[#E5E5E5] mt-1 pt-2 transition-colors font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


