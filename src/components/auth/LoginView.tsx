import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Lock,
  Mail,
  KeyRound,
  User,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  LogIn,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const {
    users,
    companyInfo,
    authenticateOperator,
    loginWithEmail,
    registerWithEmail,
    warehouses,
  } = useStock();

  const [activeTab, setActiveTab] = useState<'operators' | 'email'>('operators');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Operator PIN verification state
  const [selectedOperator, setSelectedOperator] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');

  const companyName =
    companyInfo?.name && !companyInfo.name.toUpperCase().includes('EQUIPSTOCK')
      ? companyInfo.name
      : 'WKRLI';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setErrorMessage('Veuillez renseigner votre adresse email et votre code PIN / mot de passe.');
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
      setErrorMessage(err?.message || 'Identifiants incorrects.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOperatorPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOperator) return;
    setErrorMessage(null);

    const res = authenticateOperator(selectedOperator.id, pinInput);
    if (!res.success) {
      setErrorMessage(res.error || 'Code PIN invalide.');
      setPinInput('');
      return;
    }

    setPinInput('');
    onSuccess();
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-[#1B1B1B] text-white border-[#1B1B1B]';
      case 'RESPONSABLE':
        return 'bg-[#E35E2D]/10 text-[#E35E2D] border-[#E35E2D]/30';
      case 'MAGASINIER':
        return 'bg-[#F8F7F4] text-[#1B1B1B]/70 border-[#E5E5E5]';
    }
  };

  const activeUsers = users.filter((u) => u.isActive !== false);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1B1B1B] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          {companyInfo?.logoUrl ? (
            <div className="inline-flex items-center justify-center p-2 bg-white border border-[#E5E5E5] rounded-lg mb-1">
              <img
                src={companyInfo.logoUrl}
                alt={companyName}
                className="w-12 h-12 object-contain"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#E35E2D] text-white font-display font-extrabold text-xl rounded-lg mb-1">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-[-0.04em] text-[#1B1B1B]">
            {companyName}
          </h1>
          <p className="text-xs text-[#1B1B1B]/60">
            {companyInfo?.slogan || 'Gestion commerciale, stocks et facturation multi-dépôts'}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-6 sm:p-7 space-y-6 shadow-xs">
          {/* Method Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#F8F7F4] p-1 rounded-md border border-[#E5E5E5] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('operators');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'operators'
                  ? 'bg-[#E35E2D] text-white shadow-xs'
                  : 'text-[#1B1B1B]/60 hover:text-[#1B1B1B]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Code PIN</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('email');
                setErrorMessage(null);
                setSelectedOperator(null);
              }}
              className={`py-2 px-3 rounded transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'email'
                  ? 'bg-[#E35E2D] text-white shadow-xs'
                  : 'text-[#1B1B1B]/60 hover:text-[#1B1B1B]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Code</span>
            </button>
          </div>

          {/* TAB 1: OPERATORS WITH PIN CODE PROTECTION */}
          {activeTab === 'operators' && (
            <div className="space-y-4">
              {!selectedOperator ? (
                <>
                  <p className="text-xs text-[#1B1B1B]/60 font-medium">
                    Sélectionnez votre profil utilisateur :
                  </p>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {activeUsers.map((u) => {
                      const assignedWh = warehouses.find((w) => w.id === u.assignedWarehouseId);

                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedOperator(u);
                            setPinInput('');
                            setErrorMessage(null);
                          }}
                          className="w-full p-3 bg-[#F9FAFB] hover:bg-[#E35E2D]/5 border border-[#E5E5E5] hover:border-[#E35E2D] rounded-md transition-all text-left flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded bg-white text-[#E35E2D] font-bold flex items-center justify-center border border-[#E5E5E5] group-hover:border-[#E35E2D] shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#1B1B1B] group-hover:text-[#E35E2D] transition-colors truncate">
                                {u.name}
                              </div>
                              <div className="text-[11px] text-[#1B1B1B]/60 truncate">
                                {u.role === 'MAGASINIER' && assignedWh
                                  ? `Magasin : ${assignedWh.name}`
                                  : u.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(
                                u.role
                              )}`}
                            >
                              {u.role}
                            </span>
                            <ArrowRight className="w-4 h-4 text-[#1B1B1B]/40 group-hover:text-[#E35E2D] transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <form onSubmit={handleOperatorPinSubmit} className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#F8F7F4] border border-[#E5E5E5] rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded bg-[#E35E2D] text-white font-bold flex items-center justify-center shrink-0">
                        {selectedOperator.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[#1B1B1B] truncate">
                          {selectedOperator.name}
                        </div>
                        <div className="text-[11px] text-[#1B1B1B]/60 truncate">
                          {selectedOperator.email}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperator(null);
                        setPinInput('');
                        setErrorMessage(null);
                      }}
                      className="text-xs text-[#1B1B1B]/60 hover:text-[#1B1B1B] flex items-center gap-1 px-2 py-1 rounded hover:bg-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Changer</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60 mb-1.5">
                      Code PIN de sécurité
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#1B1B1B]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        autoFocus
                        required
                        placeholder="••••"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-center tracking-[0.5em] font-mono text-base bg-[#F9FAFB] border border-[#E5E5E5] text-[#1B1B1B] rounded focus:outline-none focus:border-[#E35E2D]"
                      />
                    </div>
                    {(!selectedOperator.pinCode || selectedOperator.pinCode === '0000') && (
                      <p className="text-[11px] text-[#1B1B1B]/50 mt-1.5 text-center">
                        Code PIN initial par défaut : <span className="font-mono font-bold text-[#1B1B1B]">0000</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white font-semibold text-xs sm:text-sm rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Ouvrir la session</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL & PIN AUTH */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isRegisterMode && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60 mb-1.5">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#1B1B1B]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nom et prénom"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#F9FAFB] border border-[#E5E5E5] text-[#1B1B1B] rounded focus:outline-none focus:border-[#E35E2D]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60 mb-1.5">
                  Adresse email professionnelle
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#1B1B1B]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="westjunior0805@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#F9FAFB] border border-[#E5E5E5] text-[#1B1B1B] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60 mb-1.5">
                  Code PIN / Mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#1B1B1B]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#F9FAFB] border border-[#E5E5E5] text-[#1B1B1B] rounded focus:outline-none focus:border-[#E35E2D]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1B1B1B]/40 hover:text-[#1B1B1B] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#E35E2D] hover:bg-[#1B1B1B] text-white font-semibold text-xs sm:text-sm rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'Vérification...'
                    : isRegisterMode
                    ? 'Créer le profil'
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
                  className="text-xs text-[#1B1B1B]/60 hover:text-[#E35E2D] transition-colors font-medium cursor-pointer"
                >
                  {isRegisterMode
                    ? 'Vous avez déjà un profil ? Se connecter'
                    : 'Créer un nouveau profil utilisateur'}
                </button>
              </div>
            </form>
          )}

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
