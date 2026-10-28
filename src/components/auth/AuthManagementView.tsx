import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Shield,
  ShieldCheck,
  Key,
  Lock,
  User,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  RefreshCw,
  Edit2,
  Trash2,
  Search,
  Filter,
  Info,
  Check,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';

export const AuthManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    warehouses,
    firebaseUser,
    addUser,
    updateUser,
    deleteUser,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
  } = useStock();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix' | 'login_modal'>('directory');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Add user modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('MAGASINIER');
  const [addWarehouseId, setAddWarehouseId] = useState<string>('');
  const [addPhone, setAddPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('MAGASINIER');
  const [editWarehouseId, setEditWarehouseId] = useState<string>('');
  const [editPhone, setEditPhone] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete confirm modal state
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Direct login form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Administrateur
          </span>
        );
      case 'RESPONSABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <UserCheck className="w-3.5 h-3.5" />
            Responsable
          </span>
        );
      case 'MAGASINIER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <User className="w-3.5 h-3.5" />
            Magasinier
          </span>
        );
    }
  };

  const handleOpenAddModal = () => {
    setAddName('');
    setAddEmail('');
    setAddRole('MAGASINIER');
    setAddWarehouseId(warehouses[0]?.id || '');
    setAddPhone('');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      setAddError('Veuillez renseigner le nom et l’adresse email.');
      return;
    }

    setIsSubmittingAdd(true);
    setAddError(null);

    const res = await addUser({
      name: addName.trim(),
      email: addEmail.trim(),
      role: addRole,
      assignedWarehouseId: addRole === 'MAGASINIER' ? addWarehouseId : undefined,
      phone: addPhone.trim() || undefined,
      isActive: true,
    });

    setIsSubmittingAdd(false);

    if (!res.success) {
      setAddError(res.error || 'Erreur lors de la création du compte.');
      return;
    }

    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditWarehouseId(u.assignedWarehouseId || warehouses[0]?.id || '');
    setEditPhone(u.phone || '');
    setEditIsActive(u.isActive !== false);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    const res = await updateUser(editingUser.id, {
      name: editName.trim(),
      role: editRole,
      assignedWarehouseId: editRole === 'MAGASINIER' ? editWarehouseId : undefined,
      phone: editPhone.trim() || undefined,
      isActive: editIsActive,
    });

    setIsSubmittingEdit(false);

    if (!res.success) {
      setEditError(res.error || 'Erreur lors de la mise à jour.');
      return;
    }

    setEditingUser(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError(null);

    const res = await deleteUser(deletingUser.id);
    setIsDeleting(false);

    if (!res.success) {
      setDeleteError(res.error || 'Impossible de supprimer cet utilisateur.');
      return;
    }

    setDeletingUser(null);
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('token-service-api-has-not-been-used') || msg.includes('securetoken.googleapis.com')) {
        setAuthError("L'API Firebase Authentication (Secure Token) est en cours d'activation sur le projet Google Cloud. Utilisez un profil collaborateur de l'annuaire ci-dessus en attendant.");
      } else {
        setAuthError(msg || 'Erreur lors de la connexion Google.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setAuthError('Veuillez saisir votre email et mot de passe.');
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      if (loginMode === 'signin') {
        await loginWithEmail(emailInput, passwordInput);
      } else {
        await registerWithEmail(emailInput.split('@')[0], emailInput, passwordInput);
      }
      setEmailInput('');
      setPasswordInput('');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('token-service-api-has-not-been-used') || msg.includes('securetoken.googleapis.com')) {
        setAuthError("L'API Firebase Authentication (Secure Token) est en cours d'activation sur le projet Google Cloud. Utilisez un profil de l'annuaire ci-dessus en attendant.");
      } else {
        setAuthError(msg || 'Erreur d’authentification.');
      }
    } finally {
      setIsAuthLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Gestion des Accès & Authentifications
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Contrôle d'accès basé sur les rôles (RBAC), comptes utilisateurs et session Firebase Cloud.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'directory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Annuaire Utilisateurs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Matrice des Rôles (RBAC)</span>
          </button>
        </div>
      </div>

      {/* Firebase Cloud Live Session Card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              {firebaseUser?.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || 'Avatar'}
                  className="w-14 h-14 rounded-2xl border-2 border-indigo-400 object-cover shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/60 border border-indigo-400/40 flex items-center justify-center text-white font-bold text-xl shadow-inner">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              {firebaseUser && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {firebaseUser?.displayName || currentUser.name}
                </h2>
                {getRoleBadge(currentUser.role)}
                {currentUser.email === 'westjunior0805@gmail.com' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Sparkles className="w-3 h-3" />
                    Super Admin Racine
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-y-1 gap-x-4">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  {firebaseUser?.email || currentUser.email}
                </span>

                {firebaseUser ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connecté via Firebase Cloud Auth (UID: {firebaseUser.uid.substring(0, 10)}...)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-300 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Session Locale (Non connecté à un compte Google Firebase)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Session Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {firebaseUser ? (
              <button
                type="button"
                disabled={isAuthLoading}
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnecter le compte Google</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isAuthLoading}
                onClick={handleGoogleSignIn}
                className="px-4 py-2.5 text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.13C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.63H1.24A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.24 5.37l4.03-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.24 6.63l4.03 3.13c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>{isAuthLoading ? 'Connexion en cours...' : 'Se connecter avec Google'}</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Controls: Search, filter, Add User */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email ou téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
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
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Ajouter un utilisateur</span>
            </button>
          </div>

          {/* User Directory Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Rôle & Privilèges</th>
                    <th className="py-3 px-4">Affectation Magasin</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">Aucun utilisateur trouvé.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Ajustez vos filtres ou ajoutez un nouveau collaborateur.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const assignedWh = warehouses.find((w) => w.id === u.assignedWarehouseId);
                      const isCurrentUser = currentUser.id === u.id;
                      const isRootAdmin = u.email.toLowerCase() === 'westjunior0805@gmail.com';

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCurrentUser ? 'bg-purple-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center border border-purple-200">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{u.name}</span>
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                      Vous
                                    </span>
                                  )}
                                  {isRootAdmin && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                      Root
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3" />
                                  <span>{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                          <td className="py-3.5 px-4">
                            {u.role === 'MAGASINIER' ? (
                              assignedWh ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                  {assignedWh.name} ({assignedWh.code})
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">Non assigné</span>
                              )
                            ) : (
                              <span className="text-slate-400 font-medium">
                                Tous les magasins (Global)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {u.phone ? (
                              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                {u.phone}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Non renseigné</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {u.isActive !== false ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                <X className="w-3 h-3" />
                                Inactif
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="Modifier le profil & rôle"
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {!isRootAdmin && !isCurrentUser && (
                                <button
                                  type="button"
                                  title="Supprimer l’utilisateur"
                                  onClick={() => setDeletingUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RBAC Matrix Tab */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-600" />
              Matrice de Contrôle d'Accès par Rôle (RBAC)
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Ce tableau récapitule les autorisations strictes accordées à chaque profil dans l'ERP EquipStock Pro.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Module Métier</th>
                    <th className="py-3 px-4 text-center">Magasinier</th>
                    <th className="py-3 px-4 text-center">Responsable</th>
                    <th className="py-3 px-4 text-center">Administrateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Catalogue Pièces (Consultation références & équivalences)
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Lecture</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Complet</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Complet</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Prix d'Achat & Marges Commerciales
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Masqué</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Visible</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Visible & Modifiable</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Mouvements Physiques (Entrées / Sorties / Transferts)
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Magasin assigné</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Tous magasins</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Tous magasins</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Point de Vente Comptoir & Encaissements
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Autorisé</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Autorisé</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Caisse Enregistreuse & Clôture de Session
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Autorisé</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Autorisé & Audit</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Devis & Factures Proforma
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Création / Validation</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Complet</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Commandes Fournisseurs & Approvisionnements
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 font-semibold">Réception physique</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Création & Suivi</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Validation financière</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Gestion des Magasins & Entrepôts
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-slate-500">Lecture seule</td>
                    <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Création / Édition / Clôture</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Gestion des Utilisateurs & Rôles
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-purple-700 font-bold">✓ Exclusif Administrateur</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Remise à zéro complète (Table Rase) & Purge Cloud
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-rose-500 font-bold">✗ Interdit</td>
                    <td className="py-3 px-4 text-center text-rose-600 font-bold">✓ Exclusif Administrateur</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
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
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
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
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rôle attribué <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="MAGASINIER">Magasinier (Opérations de stock)</option>
                    <option value="RESPONSABLE">Responsable (Ventes, Stocks, Caisse)</option>
                    <option value="ADMIN">Administrateur (Accès total)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +221 77 123 45 67"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
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
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Modifier l’utilisateur</h3>
                  <p className="text-xs text-slate-400">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rôle</label>
                  <select
                    disabled={editingUser.email.toLowerCase() === 'westjunior0805@gmail.com'}
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="MAGASINIER">Magasinier</option>
                    <option value="RESPONSABLE">Responsable</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status toggle */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  disabled={editingUser.email.toLowerCase() === 'westjunior0805@gmail.com'}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Compte utilisateur actif</span>
                  <span className="text-slate-500 block">
                    Si désactivé, cet utilisateur ne pourra plus effectuer d'opérations.
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
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2"
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
              Cette action retirera ce compte de l'annuaire local et de Google Cloud Firestore.
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
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2"
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
