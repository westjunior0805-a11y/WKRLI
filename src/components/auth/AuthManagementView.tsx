import React, { useState, useEffect } from 'react';
import {
  useStock,
  getDefaultPermissionsForRole,
  resolveUserPermissions,
  DEFAULT_COMPANY_INFO,
} from '../../context/StockContext';
import { UserProfile, UserRole, UserPermissions, CompanyInfo } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  ShieldCheck,
  Users,
  UserPlus,
  Mail,
  Phone,
  Building2,
  Edit2,
  Trash2,
  Check,
  X,
  Lock,
  AlertTriangle,
  LogOut,
  Search,
  Filter,
  Sparkles,
  UserX,
  Key,
  FileText,
  Upload,
  RotateCcw,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { TablePagination, SortableTh, usePagination } from '../common/TablePagination';
import { RowActionsMenu } from '../common/RowActionsMenu';
import { SearchField } from '../common/SearchField';

type UserSortField = 'name' | 'role' | 'warehouse' | 'phone' | 'status';

interface PermissionMeta {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: 'COMMERCIAL' | 'STOCK_CATALOG' | 'FINANCE_REPORTS' | 'ADMIN';
}

export const PERMISSION_DEFINITIONS: PermissionMeta[] = [
  // Commercial & Guichet
  {
    key: 'canSell',
    label: 'Accès au Guichet & Ventes Comptoir',
    description: 'Autoriser l’encaissement et la création de ventes au guichet',
    category: 'COMMERCIAL',
  },
  {
    key: 'canOverridePrice',
    label: 'Modification des prix & Remises',
    description: 'Autoriser la modification manuelle du prix unitaire et les remises spéciales',
    category: 'COMMERCIAL',
  },
  {
    key: 'canBackdateTransactions',
    label: 'Antidatage direct (sans code PIN externe)',
    description: 'Autoriser la saisie de ventes ou écritures de caisse à une date passée',
    category: 'COMMERCIAL',
  },
  {
    key: 'canDeleteSales',
    label: 'Annulation, Retour & Suppression de ventes',
    description: 'Autoriser l’avoir client, le remboursement ou la suppression de factures',
    category: 'COMMERCIAL',
  },
  {
    key: 'canManageQuotes',
    label: 'Devis & Factures Proforma',
    description: 'Créer, modifier, imprimer et convertir les devis clients en ventes',
    category: 'COMMERCIAL',
  },
  {
    key: 'canManageCustomers',
    label: 'Gestion Clients, Créances & Soldes',
    description: 'Créer/modifier les fiches clients, encaisser des acomptes et ajuster les soldes',
    category: 'COMMERCIAL',
  },
  // Catalogue & Logistique
  {
    key: 'canManageCatalog',
    label: 'Création & Modification du Catalogue',
    description: 'Ajouter de nouvelles références, modifier les fiches techniques et importer Excel/CSV',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canDeleteArticles',
    label: 'Suppression de fiches articles',
    description: 'Autoriser la suppression ou l’archivage de pièces du catalogue',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canViewPurchasePrices',
    label: 'Visibilité des Prix d’Achat & Marges',
    description: 'Afficher les coûts d’achat fournisseurs et les marges commerciales',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canManageStockMovements',
    label: 'Mouvements de Stock (Entrées, Sorties, Transferts)',
    description: 'Enregistrer des réceptions, sorties internes, transferts et ajustements rapides',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canManageInventory',
    label: 'Inventaires Physiques',
    description: 'Ouvrir des sessions de comptage et valider les écarts d’inventaire',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canManagePurchases',
    label: 'Commandes Fournisseurs & Approvisionnements',
    description: 'Créer des bons de commande fournisseurs et réceptionner les livraisons',
    category: 'STOCK_CATALOG',
  },
  {
    key: 'canManageWarehouses',
    label: 'Administration des Magasins & Dépôts',
    description: 'Créer, éditer ou supprimer des entrepôts et points de vente',
    category: 'STOCK_CATALOG',
  },
  // Finances & Rapports
  {
    key: 'canManageCash',
    label: 'Caisse Enregistreuse & Dépenses',
    description: 'Ouvrir/clôturer la session de caisse, saisir des dépenses et versements banque',
    category: 'FINANCE_REPORTS',
  },
  {
    key: 'canViewReports',
    label: 'Bilans Financiers & Rapports de Ventes',
    description: 'Consulter le chiffre d’affaires, le bénéfice net et les statistiques détaillées',
    category: 'FINANCE_REPORTS',
  },
  // Administration
  {
    key: 'canManageUsers',
    label: 'Gestion des Utilisateurs, Droits & Entreprise',
    description: 'Gérer les comptes collaborateurs, leurs autorisations et les coordonnées société',
    category: 'ADMIN',
  },
  {
    key: 'canManageDatabase',
    label: 'Administration Base de Données & Table Rase',
    description: 'Exporter/restaurer les sauvegardes JSON, synchroniser le Cloud et purger les tables',
    category: 'ADMIN',
  },
];

export const PERMISSION_CATEGORIES: Array<{
  id: PermissionMeta['category'];
  title: string;
}> = [
  { id: 'COMMERCIAL', title: '1. Guichet, Ventes & Clients' },
  { id: 'STOCK_CATALOG', title: '2. Catalogue, Stocks & Achats' },
  { id: 'FINANCE_REPORTS', title: '3. Trésorerie & Bilans Financiers' },
  { id: 'ADMIN', title: '4. Administration & Sécurité' },
];

export const AuthManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    warehouses,
    addUser,
    updateUser,
    deleteUser,
    logout,
    companyInfo,
    updateCompanyInfo,
    resetCompanyInfo,
  } = useStock();

  // Tabs: 'company' | 'directory' | 'matrix'
  const [activeTab, setActiveTab] = useState<'company' | 'directory' | 'matrix'>('directory');

  // Search, Filter & Sort for User Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [userSortField, setUserSortField] = useState<UserSortField>('name');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');

  const handleUserSort = (field: UserSortField) => {
    if (userSortField === field) {
      setUserSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setUserSortField(field);
      setUserSortDir('asc');
    }
  };

  // Selected user in the Permissions Configurator ('matrix' tab)
  const [selectedUserIdForPerms, setSelectedUserIdForPerms] = useState<string>(
    () => users[0]?.id || currentUser.id
  );
  const [permSaveBanner, setPermSaveBanner] = useState<string | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('MAGASINIER');
  const [addPinCode, setAddPinCode] = useState('1234');
  const [addPhone, setAddPhone] = useState('');
  const [addWarehouseId, setAddWarehouseId] = useState(warehouses[0]?.id || 'mag_principal');
  const [addPermissions, setAddPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole('MAGASINIER')
  );
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('MAGASINIER');
  const [editPinCode, setEditPinCode] = useState('0000');
  const [editPhone, setEditPhone] = useState('');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole('MAGASINIER')
  );
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirmation Modal State
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Company Info Form State
  const [companyForm, setCompanyForm] = useState<CompanyInfo>(companyInfo);
  const [companySavedBanner, setCompanySavedBanner] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    setCompanyForm(companyInfo);
  }, [companyInfo]);

  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone && u.phone.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (userSortField) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '', 'fr');
          break;
        case 'role':
          cmp = (a.role || '').localeCompare(b.role || '', 'fr');
          break;
        case 'warehouse': {
          const wA = warehouses.find((w) => w.id === a.assignedWarehouseId)?.name || 'Global';
          const wB = warehouses.find((w) => w.id === b.assignedWarehouseId)?.name || 'Global';
          cmp = wA.localeCompare(wB, 'fr');
          break;
        }
        case 'phone':
          cmp = (a.phone || '').localeCompare(b.phone || '', 'fr');
          break;
        case 'status':
          cmp = Number(a.isActive !== false) - Number(b.isActive !== false);
          break;
      }
      return userSortDir === 'asc' ? cmp : -cmp;
    });

  const {
    currentPage: usersPage,
    setCurrentPage: setUsersPage,
    pageSize: usersPageSize,
    setPageSize: setUsersPageSize,
    paginatedItems: paginatedUsers,
  } = usePagination(filteredUsers, 15);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            Administrateur
          </span>
        );
      case 'RESPONSABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            Responsable
          </span>
        );
      case 'MAGASINIER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Magasinier
          </span>
        );
    }
  };

  // Handlers for Add User
  const handleOpenAddModal = () => {
    setAddName('');
    setAddEmail('');
    setAddRole('MAGASINIER');
    setAddPinCode('1234');
    setAddPhone('');
    setAddWarehouseId(warehouses[0]?.id || 'mag_principal');
    setAddPermissions(getDefaultPermissionsForRole('MAGASINIER'));
    setAddError('');
    setIsAddModalOpen(true);
  };

  const handleRoleChangeInAdd = (newRole: UserRole) => {
    setAddRole(newRole);
    setAddPermissions(getDefaultPermissionsForRole(newRole));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addName.trim() || !addEmail.trim()) {
      setAddError('Le nom complet et l’adresse email sont obligatoires.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await addUser({
        name: addName.trim(),
        email: addEmail.trim(),
        role: addRole,
        pinCode: addPinCode.trim() || '1234',
        phone: addPhone.trim() || undefined,
        assignedWarehouseId: addRole === 'MAGASINIER' ? addWarehouseId : undefined,
        permissions: addPermissions,
        isActive: true,
      });

      if (!res.success) {
        setAddError(res.error || 'Erreur lors de la création.');
      } else {
        setIsAddModalOpen(false);
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handlers for Edit User
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPinCode(user.pinCode || '0000');
    setEditPhone(user.phone || '');
    setEditWarehouseId(user.assignedWarehouseId || warehouses[0]?.id || 'mag_principal');
    setEditIsActive(user.isActive !== false);
    setEditPermissions(resolveUserPermissions(user));
    setEditError('');
  };

  const handleRoleChangeInEdit = (newRole: UserRole) => {
    setEditRole(newRole);
    setEditPermissions(getDefaultPermissionsForRole(newRole));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');

    if (!editName.trim()) {
      setEditError('Le nom ne peut pas être vide.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await updateUser(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        pinCode: editPinCode.trim() || '0000',
        phone: editPhone.trim() || undefined,
        assignedWarehouseId: editRole === 'MAGASINIER' ? editWarehouseId : undefined,
        isActive: editIsActive,
        permissions: editPermissions,
      });

      if (!res.success) {
        setEditError(res.error || 'Impossible de mettre à jour ce profil.');
      } else {
        setEditingUser(null);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handlers for Delete User
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      const res = await deleteUser(deletingUser.id);
      if (!res.success) {
        setDeleteError(res.error || 'Impossible de supprimer cet utilisateur.');
      } else {
        setDeletingUser(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await logout();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handlers for Granular Permissions Matrix Tab
  const targetPermUser =
    users.find((u) => u.id === selectedUserIdForPerms) || users[0] || currentUser;
  const targetUserResolvedPerms = resolveUserPermissions(targetPermUser);
  const isTargetSuperAdmin =
    targetPermUser.email.toLowerCase() === 'westjunior0805@gmail.com';

  const handleToggleUserPermission = async (permKey: keyof UserPermissions) => {
    if (isTargetSuperAdmin) return;
    const nextPerms: UserPermissions = {
      ...targetUserResolvedPerms,
      [permKey]: !targetUserResolvedPerms[permKey],
    };
    const res = await updateUser(targetPermUser.id, {
      permissions: nextPerms,
    });
    if (res.success) {
      setPermSaveBanner(
        `Autorisations de ${targetPermUser.name} mises à jour et appliquées immédiatement.`
      );
      setTimeout(() => setPermSaveBanner(null), 3500);
    }
  };

  const handleResetUserPermissionsToRoleDefault = async () => {
    if (isTargetSuperAdmin) return;
    const defaultPerms = getDefaultPermissionsForRole(targetPermUser.role);
    const res = await updateUser(targetPermUser.id, {
      permissions: defaultPerms,
    });
    if (res.success) {
      setPermSaveBanner(
        `Autorisations de ${targetPermUser.name} réinitialisées selon le profil ${targetPermUser.role}.`
      );
      setTimeout(() => setPermSaveBanner(null), 3500);
    }
  };

  // Handlers for Company Info Form
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const compressedDataUrl = await compressImageFile(file, 360, 360, 0.85);
      setCompanyForm((prev) => ({ ...prev, logoUrl: compressedDataUrl }));
    } catch (err) {
      console.error('Erreur chargement logo:', err);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyInfo({
      ...companyForm,
      name: companyForm.name.trim() || DEFAULT_COMPANY_INFO.name,
      shortName: companyForm.shortName.trim() || companyForm.name.trim() || DEFAULT_COMPANY_INFO.shortName,
    });
    setCompanySavedBanner(
      "Les informations de l'entreprise ont été enregistrées. Elles apparaissent désormais sur toutes vos factures, devis, reçus et bons de commande."
    );
    setTimeout(() => setCompanySavedBanner(null), 5000);
  };

  const handleRestoreDefaultCompanyInfo = () => {
    resetCompanyInfo();
    setCompanyForm(DEFAULT_COMPANY_INFO);
    setCompanySavedBanner("Les informations par défaut de l'entreprise ont été restaurées.");
    setTimeout(() => setCompanySavedBanner(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Administration : Entreprise, Utilisateurs & Autorisations
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Paramétrez l'identité de votre société, les comptes opérateurs et les autorisations détaillées de chaque collaborateur.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'company'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Informations Entreprise</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Utilisateurs ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Autorisations Utilisateur</span>
          </button>
        </div>
      </div>

      {/* Local Active Session Card */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-bold text-lg">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {currentUser.name}
                </h2>
                {getRoleBadge(currentUser.role)}
                {currentUser.email === 'westjunior0805@gmail.com' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Sparkles className="w-3 h-3" />
                    Administrateur Principal
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-y-1 gap-x-4">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  {currentUser.email}
                </span>

                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Key className="w-3.5 h-3.5" />
                  Session Active (Protégée par Code PIN)
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isAuthLoading}
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Verrouiller la session</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: INFORMATIONS DE L'ENTREPRISE                                  */}
      {/* ==================================================================== */}
      {activeTab === 'company' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Fiche d'Identité de l'Entreprise
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ces coordonnées sont automatiquement injectées sur vos Factures A4, Tickets 80mm, Devis, Bons de Livraison et Bons de Commande.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestoreDefaultCompanyInfo}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Restaurer les valeurs par défaut"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Par défaut</span>
              </button>
            </div>

            {companySavedBanner && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{companySavedBanner}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompanyInfo} className="space-y-4 text-xs sm:text-sm">
              {/* Logo + Nom + Sigle */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Logo de l'entreprise
                  </label>
                  <div className="flex items-center gap-3">
                    {companyForm.logoUrl ? (
                      <div className="relative w-16 h-16 rounded-xl border border-slate-200 bg-white p-1 flex items-center justify-center shadow-2xs shrink-0">
                        <img
                          src={companyForm.logoUrl}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setCompanyForm((prev) => ({ ...prev, logoUrl: '' }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs hover:bg-rose-700 cursor-pointer"
                          title="Retirer le logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-900 text-amber-400 border border-amber-500/40 font-black text-lg flex items-center justify-center shrink-0">
                        {companyForm.shortName || companyForm.name?.slice(0, 5) || 'WKRLI'}
                      </div>
                    )}

                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Chargement...' : 'Importer logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Raison sociale / Nom de l'entreprise <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    placeholder="Ex: EQUIPSTOCK PRO S.A.R.L"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sigle / Initiales
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={companyForm.shortName}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, shortName: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: ESP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Activité principale / Slogan (affiché sous le nom sur les factures)
                </label>
                <input
                  type="text"
                  value={companyForm.slogan}
                  onChange={(e) => setCompanyForm({ ...companyForm, slogan: e.target.value })}
                  placeholder="Ex: Pièces d'Engins, Filtration Industrielle & Matériel TP"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse géographique complète
                  </label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    placeholder="Ex: Zone Industrielle Bel-Air, Dakar, Sénégal"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphones de contact
                  </label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    placeholder="Ex: +221 33 849 20 10 / +221 77 450 88 00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email commercial
                  </label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="Ex: commercial@equipstock.sn"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    N° NINEA / Identifiant Fiscal
                  </label>
                  <input
                    type="text"
                    value={companyForm.ninea}
                    onChange={(e) => setCompanyForm({ ...companyForm, ninea: e.target.value })}
                    placeholder="Ex: 004829102-2B3"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    N° Registre de Commerce (RC)
                  </label>
                  <input
                    type="text"
                    value={companyForm.rc}
                    onChange={(e) => setCompanyForm({ ...companyForm, rc: e.target.value })}
                    placeholder="Ex: SN-DKR-2023-B-1402"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Capital Social (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={companyForm.capital || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, capital: e.target.value })}
                    placeholder="Ex: 10 000 000 FCFA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Coordonnées Bancaires / RIB / Mobile Money
                  </label>
                  <input
                    type="text"
                    value={companyForm.bankInfo}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankInfo: e.target.value })}
                    placeholder="Ex: Banque CBAO · Compte: 010023489102-45"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mention de bas de page sur les factures & reçus
                </label>
                <textarea
                  rows={2}
                  value={companyForm.invoiceFooter}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, invoiceFooter: e.target.value })
                  }
                  placeholder="Ex: Merci pour votre confiance ! Les pièces vendues ne sont ni reprises ni échangées après 48h."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer les informations de l'entreprise</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Live Invoice Header Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Aperçu en direct sur vos Factures A4
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Synchronisé
                </span>
              </div>

              {/* Miniature A4 Header Preview */}
              <div className="p-5 bg-white border-2 border-black text-black space-y-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      {companyForm.logoUrl ? (
                        <img
                          src={companyForm.logoUrl}
                          alt={companyForm.name}
                          className="w-10 h-10 object-contain border border-neutral-300 bg-white p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-black text-amber-500 border border-amber-500 font-black text-sm flex items-center justify-center shrink-0">
                          {companyForm.shortName || companyForm.name?.slice(0, 5) || 'WKRLI'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-base font-black tracking-tight text-amber-500 uppercase leading-none">
                          {companyForm.name || 'NOM DE VOTRE ENTREPRISE'}
                        </h4>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-800 mt-1">
                          {companyForm.slogan || 'Activité de votre entreprise'}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-800 space-y-0.5 pt-1">
                      <p>{companyForm.address}</p>
                      <p>
                        Tél : {companyForm.phone}
                        {companyForm.email ? ` · ${companyForm.email}` : ''}
                      </p>
                      {(companyForm.ninea || companyForm.rc) && (
                        <p className="font-mono text-[10px] text-neutral-700">
                          {companyForm.ninea && (
                            <>
                              NINEA : <strong>{companyForm.ninea}</strong>
                            </>
                          )}
                          {companyForm.ninea && companyForm.rc && ' · '}
                          {companyForm.rc && (
                            <>
                              RC : <strong>{companyForm.rc}</strong>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-black uppercase tracking-tight text-amber-500 font-mono leading-none">
                      FACTURE
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-black mt-0.5">
                      DE VENTE
                    </div>
                  </div>
                </div>

                <div className="h-0.5 bg-black w-full relative">
                  <div className="absolute left-0 top-0 h-1 bg-amber-500 w-20 -translate-y-[1px]" />
                </div>

                <div className="pt-2 border-t border-neutral-200 text-center text-[9px] text-neutral-600 space-y-0.5">
                  <p className="font-semibold text-black">
                    {companyForm.name}
                    {companyForm.ninea ? ` · NINEA : ${companyForm.ninea}` : ''}
                    {companyForm.rc ? ` · RC : ${companyForm.rc}` : ''}
                  </p>
                  {companyForm.bankInfo && (
                    <p className="font-mono text-neutral-700">{companyForm.bankInfo}</p>
                  )}
                  <p className="italic">{companyForm.invoiceFooter}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ANNUAIRE UTILISATEURS                                         */}
      {/* ==================================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Controls: Search, filter, Add User */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                className="flex-1"
                placeholder="Rechercher par nom, email ou téléphone..."
              />

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                >
                  <option value="ALL">Tous les rôles ({users.length})</option>
                  <option value="ADMIN">Administrateurs</option>
                  <option value="RESPONSABLE">Responsables</option>
                  <option value="MAGASINIER">Magasiniers</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Ajouter un utilisateur</span>
            </button>
          </div>

          {/* User Directory Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="w-full">
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <SortableTh label="Utilisateur" active={userSortField === 'name'} direction={userSortDir} onClick={() => handleUserSort('name')} className="w-[28%]" />
                    <SortableTh label="Rôle & Droits" active={userSortField === 'role'} direction={userSortDir} onClick={() => handleUserSort('role')} className="w-[20%]" />
                    <SortableTh label="Magasin" active={userSortField === 'warehouse'} direction={userSortDir} onClick={() => handleUserSort('warehouse')} className="hidden lg:table-cell w-[20%]" />
                    <SortableTh label="Contact" active={userSortField === 'phone'} direction={userSortDir} onClick={() => handleUserSort('phone')} className="hidden md:table-cell w-[14%]" />
                    <SortableTh label="Statut" active={userSortField === 'status'} direction={userSortDir} onClick={() => handleUserSort('status')} className="w-[10%]" />
                    <th className="py-2.5 px-2 text-right w-14">Opt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">Aucun utilisateur trouvé.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const assignedWh = warehouses.find((w) => w.id === u.assignedWarehouseId);
                      const isCurrentUser = currentUser.id === u.id;
                      const isRootAdmin = u.email.toLowerCase() === 'westjunior0805@gmail.com';
                      const userPerms = resolveUserPermissions(u);
                      const enabledPermsCount = Object.values(userPerms).filter(Boolean).length;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCurrentUser ? 'bg-purple-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center border border-purple-200 shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span className="truncate">{u.name}</span>
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 shrink-0">
                                      Vous
                                    </span>
                                  )}
                                  {isRootAdmin && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                      Principal
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-2.5">
                            <div className="flex flex-col items-start gap-1">
                              {getRoleBadge(u.role)}
                              <span className="text-[10px] font-mono text-slate-500 truncate max-w-full">
                                {enabledPermsCount}/{PERMISSION_DEFINITIONS.length} droits
                              </span>
                            </div>
                          </td>

                          <td className="hidden lg:table-cell py-3 px-2.5">
                            {u.role === 'MAGASINIER' ? (
                              assignedWh ? (
                                <span className="inline-flex items-center gap-1 font-medium text-slate-800 truncate max-w-full">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{assignedWh.name} ({assignedWh.code})</span>
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">Non assigné</span>
                              )
                            ) : (
                              <span className="text-slate-400 font-medium truncate block">
                                Tous les magasins
                              </span>
                            )}
                          </td>

                          <td className="hidden md:table-cell py-3 px-2.5">
                            {u.phone ? (
                              <span className="flex items-center gap-1 text-slate-600 font-medium font-mono truncate">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{u.phone}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>

                          <td className="py-3 px-2">
                            {u.isActive !== false ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                <X className="w-3 h-3" />
                                Inactif
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            <RowActionsMenu
                              actions={[
                                {
                                  label: 'Gérer les autorisations',
                                  icon: <Sliders className="w-3.5 h-3.5" />,
                                  tone: 'warning',
                                  onClick: () => {
                                    setSelectedUserIdForPerms(u.id);
                                    setActiveTab('matrix');
                                  },
                                },
                                {
                                  label: 'Modifier profil, PIN & rôle',
                                  icon: <Edit2 className="w-3.5 h-3.5" />,
                                  tone: 'primary',
                                  onClick: () => handleOpenEditModal(u),
                                },
                                {
                                  label: 'Supprimer l’utilisateur',
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  tone: 'danger',
                                  dividerBefore: true,
                                  hidden: isRootAdmin || isCurrentUser,
                                  onClick: () => setDeletingUser(u),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={usersPage}
              totalItems={filteredUsers.length}
              pageSize={usersPageSize}
              onPageChange={setUsersPage}
              onPageSizeChange={setUsersPageSize}
              itemLabel="utilisateurs"
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AUTORISATIONS UTILISATEUR (PAR COLLABORATEUR & PAR RÔLE)       */}
      {/* ==================================================================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-600" />
                  Configuration des Autorisations par Collaborateur
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sélectionnez un utilisateur ci-dessous et cochez ou décochez précisément les modules et actions qu'il est autorisé à utiliser.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Collaborateur :</span>
                <select
                  value={targetPermUser.id}
                  onChange={(e) => setSelectedUserIdForPerms(e.target.value)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-slate-900 text-amber-400 border border-slate-800 rounded-xl focus:outline-none cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>

                {!isTargetSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleResetUserPermissionsToRoleDefault}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Réinitialiser les droits par défaut du rôle de cet utilisateur"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Droits par défaut ({targetPermUser.role})</span>
                  </button>
                )}
              </div>
            </div>

            {permSaveBanner && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{permSaveBanner}</span>
              </div>
            )}

            {isTargetSuperAdmin && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Ce compte est l'<strong>Administrateur Principal</strong> : toutes les autorisations sont activées de manière permanente pour garantir un accès total au système.
                </span>
              </div>
            )}

            {/* Grid of Permission Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {PERMISSION_CATEGORIES.map((cat) => {
                const catPerms = PERMISSION_DEFINITIONS.filter((p) => p.category === cat.id);
                return (
                  <div
                    key={cat.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40"
                  >
                    <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
                      {cat.title}
                    </div>
                    <div className="divide-y divide-slate-200/70">
                      {catPerms.map((perm) => {
                        const isAllowed = Boolean(targetUserResolvedPerms[perm.key]);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start justify-between gap-3 p-3.5 transition-colors ${
                              isTargetSuperAdmin
                                ? 'opacity-80 cursor-not-allowed'
                                : 'hover:bg-white cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900">
                                {perm.label}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {perm.description}
                              </div>
                            </div>

                            <div className="shrink-0 pt-0.5">
                              <input
                                type="checkbox"
                                checked={isAllowed}
                                disabled={isTargetSuperAdmin}
                                onChange={() => handleToggleUserPermission(perm.key)}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Ajouter un collaborateur</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom et prénom <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mamadou Ndiaye"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: m.ndiaye@equipstock.sn"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rôle de base <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => handleRoleChangeInAdd(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    <option value="MAGASINIER">Magasinier</option>
                    <option value="RESPONSABLE">Responsable</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Code PIN d'accès <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    placeholder="Ex: 1234"
                    value={addPinCode}
                    onChange={(e) => setAddPinCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +221 77 123 45 67"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {addRole === 'MAGASINIER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Magasin de rattachement
                  </label>
                  <select
                    value={addWarehouseId}
                    onChange={(e) => setAddWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Permissions Checklist in Add Modal */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" />
                    Autorisations accordées à ce collaborateur
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {PERMISSION_DEFINITIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 text-xs cursor-pointer hover:border-purple-300"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(addPermissions[perm.key])}
                        onChange={(e) =>
                          setAddPermissions({
                            ...addPermissions,
                            [perm.key]: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300"
                      />
                      <span className="font-medium text-slate-800 truncate" title={perm.description}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmittingAdd ? 'Création en cours...' : 'Enregistrer le collaborateur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Modifier l’utilisateur & ses droits</h3>
                  <p className="text-xs text-slate-400">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle</label>
                  <select
                    disabled={editingUser.email.toLowerCase() === 'westjunior0805@gmail.com'}
                    value={editRole}
                    onChange={(e) => handleRoleChangeInEdit(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none disabled:opacity-60"
                  >
                    <option value="MAGASINIER">Magasinier</option>
                    <option value="RESPONSABLE">Responsable</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Code PIN d'accès opérateur
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={editPinCode}
                    onChange={(e) => setEditPinCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {editRole === 'MAGASINIER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Magasin de rattachement
                  </label>
                  <select
                    value={editWarehouseId}
                    onChange={(e) => setEditWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Permissions Checklist in Edit Modal */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    Autorisations individuelles
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {PERMISSION_DEFINITIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 text-xs cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="checkbox"
                        disabled={editingUser.email.toLowerCase() === 'westjunior0805@gmail.com'}
                        checked={Boolean(editPermissions[perm.key])}
                        onChange={(e) =>
                          setEditPermissions({
                            ...editPermissions,
                            [perm.key]: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                      />
                      <span className="font-medium text-slate-800 truncate" title={perm.description}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  disabled={editingUser.email.toLowerCase() === 'westjunior0805@gmail.com'}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Compte utilisateur actif</span>
                  <span className="text-slate-500 block">
                    Si désactivé, cet utilisateur ne pourra plus ouvrir de session.
                  </span>
                </div>
              </label>

              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingEdit ? 'Enregistrement...' : 'Mettre à jour'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Supprimer l’utilisateur</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Êtes-vous certain de vouloir supprimer l’accès de{' '}
              <strong className="text-slate-900">{deletingUser.name}</strong> ({deletingUser.email}) ?
            </p>

            {deleteError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Suppression...' : 'Confirmer la suppression'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
