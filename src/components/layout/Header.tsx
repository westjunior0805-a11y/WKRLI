import React, { useState, useRef, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  Menu,
  ShoppingCart,
  LogIn,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Layers,
  UserCheck,
} from 'lucide-react';

interface HeaderProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenTransfer: () => void;
  onOpenNewSale?: () => void;
  onToggleSidebarMobile: () => void;
  onOpenAuth?: () => void;
  activeView: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onOpenTransfer,
  onOpenNewSale,
  onToggleSidebarMobile,
  onOpenAuth,
  activeView,
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
  } = useStock();

  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + View Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Subtle Cloud Sync Status */}
          <div
            className="hidden lg:flex items-center gap-2 px-2.5 py-1 text-xs text-slate-600 bg-slate-50 border border-slate-200/70 rounded-lg"
            title="Synchronisation temps réel Firestore activée (fair-ability-gc70r)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium text-slate-700">Cloud actif</span>
          </div>

          {/* Warehouse Selector */}
          <div className="relative flex items-center">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedWarehouseId || 'ALL'}
              onChange={(e) =>
                setSelectedWarehouseId(e.target.value === 'ALL' ? null : e.target.value)
              }
              disabled={currentUser.role === 'MAGASINIER' && !!currentUser.assignedWarehouseId}
              className="text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
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

          {/* Actions Group */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 sm:pl-3">
            {/* Unified Stock Operations Dropdown */}
            <div className="relative" ref={stockMenuRef}>
              <button
                type="button"
                onClick={() => setIsStockMenuOpen((prev) => !prev)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                title="Effectuer une entrée, une sortie ou un transfert"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Mouvements</span>
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
                      <div className="text-[11px] text-slate-500">Réception fournisseur / bon d'entrée</div>
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
                      <div className="text-[11px] text-slate-500">Livraison chantier / consommation atelier</div>
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

            {/* Singular High-Intent Primary CTA */}
            {onOpenNewSale && (
              <button
                type="button"
                onClick={onOpenNewSale}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/30 rounded-lg shadow-xs transition-colors whitespace-nowrap"
                title="Accéder au terminal de vente rapide"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-slate-950" />
                <span>+ Vente Comptoir</span>
              </button>
            )}
          </div>

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
          <div className="relative border-l border-slate-200 pl-2 sm:pl-3" ref={userMenuRef}>
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
                {firebaseUser && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-white rounded-full" />
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
                    <span>·</span>
                    <span>{firebaseUser ? 'Google Cloud' : 'Session locale'}</span>
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
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{firebaseUser ? 'Gérer les authentifications' : 'Se connecter (Google / Cloud)'}</span>
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
                      <span>Déconnexion Google</span>
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

