import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  Key,
  User,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Sparkles,
  LogIn,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserRole } from '../../types';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const {
    users,
    setCurrentUser,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    warehouses,
  } = useStock();

  const [activeTab, setActiveTab] = useState<'google' | 'email' | 'operators'>('google');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      const rawMsg = err?.message || '';
      let msg = 'Erreur lors de la connexion Google. Vérifiez votre connexion internet.';
      if (rawMsg.includes('token-service-api-has-not-been-used') || rawMsg.includes('securetoken.googleapis.com')) {
        msg = "L'API Firebase Authentication (Secure Token) est en cours d'activation sur le projet Google Cloud. Vous pouvez vous connecter immédiatement via l'onglet 'Opérateur' ou en 'Accès libre'.";
      } else if (rawMsg) {
        msg = rawMsg;
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setErrorMessage('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isRegisterMode) {
        await registerWithEmail(nameInput || emailInput.split('@')[0], emailInput, passwordInput);
      } else {
        await loginWithEmail(emailInput, passwordInput);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || 'Erreur d’authentification.';
      if (msg.includes('token-service-api-has-not-been-used') || msg.includes('securetoken.googleapis.com')) {
        msg = "L'API Firebase Authentication (Secure Token) est en cours d'activation sur le projet Google Cloud. Vous pouvez continuer immédiatement via l'onglet 'Opérateur' ou en 'Accès libre'.";
      } else if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        msg = 'Identifiants incorrects. Vérifiez votre adresse email et votre mot de passe.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'Cette adresse email possède déjà un compte. Veuillez vous connecter.';
      } else if (msg.includes('weak-password')) {
        msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOperator = (userId: string) => {
    const selected = users.find((u) => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      onSuccess();
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background glowing decorations */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md sm:max-w-lg z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl shadow-lg shadow-amber-500/20 mb-2">
            <Boxes className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            EquipStock <span className="text-amber-400">Pro</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Portail d'authentification et de gestion de stock multi-magasins
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connecté à Firebase Cloud Firestore</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Method Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/80 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('google');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'google'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('email');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'email'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('operators');
                setErrorMessage(null);
              }}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'operators'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Opérateur</span>
            </button>
          </div>

          {/* TAB 1: GOOGLE AUTH */}
          {activeTab === 'google' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl text-xs space-y-2 text-slate-300">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Accès Administrateur Garanti</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Connectez-vous avec votre compte Google. Si vous utilisez{' '}
                  <strong className="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                    westjunior0805@gmail.com
                  </strong>
                  , l'accès <strong className="text-purple-300">ADMINISTRATEUR</strong> complet est immédiatement déverrouillé.
                </p>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleLogin}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>{isLoading ? 'Connexion Google en cours...' : 'Continuer avec Google'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: EMAIL AUTH */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: Ibrahima Ndiaye"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="nom@equipstock.sn"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'Chargement...'
                    : isRegisterMode
                    ? 'Créer mon compte'
                    : 'Se connecter'}
                </span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setErrorMessage(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  {isRegisterMode
                    ? 'Vous avez déjà un compte ? Se connecter'
                    : 'Pas encore de compte ? S’inscrire'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: OPERATORS (DIRECT STORE SWITCH) */}
          {activeTab === 'operators' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-2">
                Sélectionnez un collaborateur pour ouvrir immédiatement sa session de travail locale :
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {users.map((u) => {
                  const assignedWh = warehouses.find((w) => w.id === u.assignedWarehouseId);

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectOperator(u.id)}
                      className="w-full p-3 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-left flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 text-indigo-300 font-bold flex items-center justify-center border border-slate-700 group-hover:border-indigo-500">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {u.role === 'MAGASINIER' && assignedWh
                              ? `Magasinier : ${assignedWh.name}`
                              : u.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Guest / Demo Bypass Option */}
        <div className="text-center">
          <button
            type="button"
            onClick={onSuccess}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
          >
            Continuer directement en mode consultation (accès libre)
          </button>
        </div>
      </div>
    </div>
  );
};
