import React from 'react';
import { useStock } from '../../context/StockContext';
import {
  Building2,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  Menu,
  ShoppingCart,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { UserRole } from '../../types';

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
  } = useStock();

  const alerts = getAlerts();
  const criticalCount = alerts.filter((a) => a.alertType === 'RUPTURE').length;

  // View title translation
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'new_sale':
        return 'Point de Vente — Nouvelle Vente Comptoir';
      case 'sales_history':
        return 'Journal des Ventes & Facturation';
      case 'quotes':
        return 'Devis Clients & Factures Proforma';
      case 'cash_register':
        return 'Session de Caisse & Tiroir-Caisse';
      case 'customers':
        return 'Portefeuille Clients & Suivi des Créances';
      case 'sales_reports':
        return 'Rapports Financiers & Analyse Commerciale';
      case 'catalog':
        return 'Catalogue des pièces détachées';
      case 'import_catalog':
        return 'Importation des Pièces (Excel / CSV)';
      case 'purchase_orders':
        return 'Commandes Fournisseurs & Réapprovisionnement';
      case 'warehouses':
        return 'Gestion des magasins';
      case 'movements':
        return 'Historique des mouvements de stock';
      case 'inventory':
        return 'Inventaire physique';
      case 'reports':
        return 'Alertes & Rapports de stock';
      case 'test_suite':
        return 'Banc de Validation Automatisé (10 Scénarios)';
      case 'architecture':
        return 'Architecture & Base de données';
      case 'auth_management':
        return 'Gestion des Accès & Authentifications';
      default:
        return 'Gestion de stock';
    }
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = users.find((u) => u.id === e.target.value);
    if (selected) {
      setCurrentUser(selected);
      // If user is a magasinier with assigned warehouse, switch to that warehouse
      if (selected.role === 'MAGASINIER' && selected.assignedWarehouseId) {
        setSelectedWarehouseId(selected.assignedWarehouseId);
      }
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RESPONSABLE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MAGASINIER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {getViewTitle()}
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span>Sénégal (Dakar - Thiès - Kédougou)</span>
              <span>·</span>
              <span>Devise : FCFA</span>
            </div>
          </div>
        </div>

        {/* Center / Right: Warehouse Filter, Cloud Badge & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Firebase Cloud Live Badge */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg shadow-2xs"
            title="Firebase Cloud Firestore activé et connecté (Projet: fair-ability-gc70r)"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold">Firebase Cloud : Actif</span>
          </div>

          {/* Warehouse Selector */}
          <div className="relative flex items-center">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedWarehouseId || 'ALL'}
              onChange={(e) =>
                setSelectedWarehouseId(e.target.value === 'ALL' ? null : e.target.value)
              }
              disabled={currentUser.role === 'MAGASINIER' && !!currentUser.assignedWarehouseId}
              className="text-xs sm:text-sm pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
              title="Filtrer la vue par magasin"
            >
              <option value="ALL">Tous les magasins (Global)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action buttons */}
          <div className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-3">
            {onOpenNewSale && (
              <button
                onClick={onOpenNewSale}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/30 rounded-lg shadow-2xs transition-colors whitespace-nowrap"
                title="Accéder au terminal de vente rapide"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Vente
              </button>
            )}
            <button
              onClick={onOpenStockIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
              title="Enregistrer une réception de pièces"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Entrée
            </button>
            <button
              onClick={onOpenStockOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap"
              title="Enregistrer une sortie ou livraison"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Sortie
            </button>
            <button
              onClick={onOpenTransfer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Transférer du stock entre magasins"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Transfert
            </button>
          </div>

          {/* Alerts pill if any */}
          {criticalCount > 0 && (
            <div
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
              title={`${criticalCount} référence(s) en rupture totale`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{criticalCount} rupture{criticalCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Authentication & Profile Section */}
          <div className="relative flex items-center border-l border-slate-200 pl-3 gap-2">
            {!firebaseUser && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors shrink-0"
                title="Se connecter avec Google ou ouvrir une session collaborateur"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connexion</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAuth}
                title="Gérer les accès ou changer d'opérateur"
                className="relative group cursor-pointer focus:outline-none"
              >
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-300 group-hover:ring-2 group-hover:ring-indigo-400 transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 group-hover:ring-2 group-hover:ring-indigo-400 transition-all">
                    {currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                )}
                {firebaseUser && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                )}
              </button>

              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">
                  {currentUser.role.toLowerCase()}
                </span>
              </div>

              <select
                value={currentUser.id}
                onChange={handleUserChange}
                className="text-xs py-1 px-2 bg-slate-50 border border-slate-200 rounded text-slate-700 font-medium hover:bg-slate-100 cursor-pointer"
                title="Changer d’opérateur ou de rôle actif"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.role}: {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
