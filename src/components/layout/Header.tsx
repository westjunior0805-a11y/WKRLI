import React, { useState, useRef, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
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
  KeyRound,
  RefreshCw,
  Check,
} from 'lucide-react';

interface HeaderProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenTransfer: () => void;
  onOpenNewSale?: () => void;
  onToggleSidebarMobile: () => void;
  onOpenAuth?: () => void;
  onOpenLogin?: () => void;
  activeView: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
  onToggleSidebarMobile,
  onOpenAuth,
  onOpenLogin,
  activeView,
  theme = 'light',
  onToggleTheme,
}) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    firebaseUser,
    warehouses,
    selectedWarehouseId,
    setSelectedWarehouseId,
    getAlerts,
    logout,
    refreshFromCloud,
    isSyncing,
    lastCloudSync,
  } = useStock();

  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleManualSync = async () => {
    const res = await refreshFromCloud();
    if (res.success) {
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    }
  };

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
        return 'Point de Vente — Caisse';
      case 'sales_history':
        return 'Journal des Ventes & Facturation';
      case 'quotes':
        return 'Devis Clients & Factures Proforma';
      case 'cash_register':
        return 'Session de Caisse & Tiroir';
      case 'customers':
        return 'Portefeuille Clients & Créances';
      case 'sales_reports':
        return 'Rapports Financiers & Analyse';
      case 'catalog':
        return 'Catalogue des pièces';
      case 'import_catalog':
        return 'Importation des Pièces (Excel / CSV)';
      case 'purchase_orders':
        return 'Commandes Fournisseurs';
      case 'warehouses':
        return 'Gestion des magasins';
      case 'movements':
        return 'Historique des mouvements';
      case 'inventory':
        return 'Inventaire physique';
      case 'reports':
        return 'Alertes & Rapports de stock';
      case 'test_suite':
        return 'Banc de Validation (10 Scénarios)';
      case 'architecture':
        return 'Architecture & Base de données';
      case 'auth_management':
        return 'Gestion des Accès & Authentifications';
      default:
        return 'Gestion de stock';
    }
  };

  const handleSelectUser = (userId: string) => {
    const selected = users.find((u) => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      if (selected.role === 'MAGASINIER' && selected.assignedWarehouseId) {
        setSelectedWarehouseId(selected.assignedWarehouseId);
      }
    }
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile hamburger + View Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
              {getViewTitle()}
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span>Sénégal (Dakar · Thiès · Kédougou)</span>
              <span>·</span>
              <span className="font-mono">FCFA</span>
            </div>
          </div>
        </div>

        {/* Right Zone: Clean controls with strict visual hierarchy */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Warehouse Selector */}
          <div className="relative flex items-center">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedWarehouseId || 'ALL'}
              onChange={(e) =>
                setSelectedWarehouseId(e.target.value === 'ALL' ? null : e.target.value)
              }
              disabled={currentUser.role === 'MAGASINIER' && !!currentUser.assignedWarehouseId}
              className="text-xs pl-8 pr-6 sm:pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer max-w-[130px] sm:max-w-none truncate"
              title="Filtrer la vue par magasin"
            >
              <option value="ALL">Tous les magasins</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unified Stock Operations Dropdown */}
          <div className="relative" ref={stockMenuRef}>
            <button
              type="button"
              onClick={() => setIsStockMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Effectuer une entrée, une sortie ou un transfert"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Mouvements</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isStockMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStockMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Actions Stock
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockIn();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Entrée de pièces</div>
                    <div className="text-[11px] text-slate-500">Réception / bon d'entrée</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenStockOut();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Sortie de pièces</div>
                    <div className="text-[11px] text-slate-500">Livraison / consommation</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsStockMenuOpen(false);
                    onOpenTransfer();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Transfert inter-dépôts</div>
                    <div className="text-[11px] text-slate-500">Déplacement Dakar, Thiès, Kédougou</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Cloud Synchronisation Button */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              syncSuccess
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
            } disabled:opacity-60`}
            title={
              lastCloudSync
                ? `Synchronisé avec le Cloud Firestore à ${lastCloudSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Cliquez pour forcer la mise à jour.`
                : 'Actualiser depuis le Cloud Firestore (temps réel actif)'
            }
          >
            {syncSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
            )}
            <span className="hidden sm:inline">
              {isSyncing ? 'Mise à jour...' : syncSuccess ? 'À jour' : 'Actualiser'}
            </span>
          </button>

          {/* Theme Selection Button */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
              aria-label="Changer de thème"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          )}

          {/* Stock Rupture Alert Pill (if any) */}
          {criticalCount > 0 && (
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg"
              title={`${criticalCount} référence(s) en rupture totale`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{criticalCount} rupture{criticalCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Refined Operator / User Trigger with Popover */}
          <div className="relative border-l border-slate-200 pl-2 sm:pl-2.5" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
              title="Profil opérateur et changement de session"
            >
              <div className="relative shrink-0">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-md object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center">
                    {currentUser.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 leading-none capitalize">
                  {currentUser.role.toLowerCase()}
                </span>
              </div>
              <ChevronDown className="hidden md:block w-3 h-3 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50 text-xs">
                {/* Active user header */}
                <div className="px-3 pb-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {currentUser.role}
                    </span>
                    {currentUser.email && (
                      <span className="truncate max-w-[150px]">{currentUser.email}</span>
                    )}
                  </div>
                </div>

                {/* Operator Switcher List */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Changer d'opérateur actif
                  </div>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u.id)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        u.id === currentUser.id ? 'bg-amber-50/60 font-semibold text-amber-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>{u.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Session Actions */}
                <div className="pt-1 border-t border-slate-100 space-y-0.5">
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                      <span>Gérer les accès & autorisations</span>
                    </button>
                  )}

                  {onOpenLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5 text-slate-500" />
                      <span>Portail de connexion</span>
                    </button>
                  )}

                  {firebaseUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Fermer la session</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


