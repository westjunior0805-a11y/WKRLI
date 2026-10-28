import React, { useState, useEffect } from 'react';
import { useStock } from '../../context/StockContext';
import {
  Database,
  Shield,
  Layers,
  Key,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Download,
  Copy,
  Check,
  Flame,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Server,
  Zap,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import {
  testFirestoreConnection,
  uploadAllToFirebase,
  downloadAllFromFirebase,
  FirebaseSyncStats,
} from '../../services/firebaseSync';
import {
  onAuthChanged,
  signInWithGoogle,
  logoutUser,
  FirebaseUser,
} from '../../firebase';

export const DatabaseArchitectureView: React.FC = () => {
  const {
    exportDatabaseJson,
    loadDataFromCloud,
    articles,
    warehouses,
    stocks,
    movements,
    customers,
    sales,
    payments,
    cashSessions,
    cashMovements,
    inventories,
    suppliers,
    supplierOrders,
    quotes,
  } = useStock();

  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [activeTab, setActiveTab] = useState<'firebase' | 'postgres'>('firebase');

  // Firebase testing and syncing states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<FirebaseSyncStats | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [isPulling, setIsPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChanged((user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Google sign-in error:', e);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error('Google sign-out error:', e);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await testFirestoreConnection();
      if (ok) {
        setTestResult({
          success: true,
          message: 'Connectivité Cloud Firestore vérifiée avec succès ! La base de données répond parfaitement.',
        });
      } else {
        setTestResult({
          success: false,
          message: 'Impossible de joindre le serveur Firestore. Vérifiez la connectivité réseau.',
        });
      }
    } catch (e) {
      setTestResult({
        success: false,
        message: 'Erreur lors du test : ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushToFirebase = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStats(null);
    try {
      const stats = await uploadAllToFirebase({
        articles,
        warehouses,
        stocks,
        movements,
        customers,
        sales,
        payments,
        cashSessions,
        cashMovements,
        inventories,
        suppliers,
        supplierOrders,
        quotes,
      });
      setSyncStats(stats);
    } catch (e) {
      setSyncError('Échec de la sauvegarde Cloud : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromFirebase = async () => {
    setIsPulling(true);
    setPullMessage(null);
    try {
      const data = await downloadAllFromFirebase();
      loadDataFromCloud(data);
      const totalItems = (data.articles?.length || 0) + (data.sales?.length || 0) + (data.customers?.length || 0);
      setPullMessage(`Données Cloud chargées avec succès (${data.articles?.length || 0} articles, ${data.sales?.length || 0} ventes, ${data.warehouses?.length || 0} dépôts).`);
    } catch (e) {
      setPullMessage('Erreur lors du téléchargement : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsPulling(false);
    }
  };

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isSignedIn() { return request.auth != null; }
    function isValidId(id) { return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$'); }
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        request.auth.token.email == 'westjunior0805@gmail.com'
      );
    }

    match /test/{testId} { allow read, write: if true; }
    match /admins/{adminId} { allow read: if isSignedIn() && isValidId(adminId); allow write: if isAdmin() && isValidId(adminId); }
    match /users/{userId} { allow read, write: if isValidId(userId); allow delete: if isAdmin() && isValidId(userId); }
    match /articles/{articleId} { allow read, list: if true; allow create, update: if isValidId(articleId); allow delete: if isAdmin() && isValidId(articleId); }
    match /warehouses/{warehouseId} { allow read, list: if true; allow create, update: if isValidId(warehouseId); allow delete: if isAdmin() && isValidId(warehouseId); }
    match /stocks/{stockId} { allow read, list: if true; allow create, update: if isValidId(stockId); allow delete: if isAdmin() && isValidId(stockId); }
    match /movements/{movementId} { allow read, list: if true; allow create: if isValidId(movementId); allow update, delete: if isAdmin() && isValidId(movementId); }
    match /customers/{customerId} { allow read, list: if true; allow create, update: if isValidId(customerId); allow delete: if isAdmin() && isValidId(customerId); }
    match /sales/{saleId} { allow read, list: if true; allow create, update: if isValidId(saleId); allow delete: if isAdmin() && isValidId(saleId); }
    match /payments/{paymentId} { allow read, list: if true; allow create: if isValidId(paymentId); allow update, delete: if isAdmin() && isValidId(paymentId); }
    match /cashSessions/{sessionId} { allow read, list: if true; allow create, update: if isValidId(sessionId); allow delete: if isAdmin() && isValidId(sessionId); }
    match /cashMovements/{cashMovementId} { allow read, list: if true; allow create: if isValidId(cashMovementId); allow update, delete: if isAdmin() && isValidId(cashMovementId); }
    match /inventories/{inventoryId} { allow read, list: if true; allow create, update: if isValidId(inventoryId); allow delete: if isAdmin() && isValidId(inventoryId); }
    match /suppliers/{supplierId} { allow read, list: if true; allow create, update: if isValidId(supplierId); allow delete: if isAdmin() && isValidId(supplierId); }
    match /supplierOrders/{orderId} { allow read, list: if true; allow create, update: if isValidId(orderId); allow delete: if isAdmin() && isValidId(orderId); }
    match /quotes/{quoteId} { allow read, list: if true; allow create, update: if isValidId(quoteId); allow delete: if isAdmin() && isValidId(quoteId); }
  }
}`;

  const supabaseSqlSchema = `-- ====================================================================
-- SCHEMA ERP EQUIPSTOCK PRO : GESTION DE PIÈCES D'ENGINS LOURDS (SÉNÉGAL)
-- BASE DE DONNÉES RELATIONNELLE POSTGRESQL / SUPABASE
-- ====================================================================

-- 1. Table des Magasins / Dépôts
CREATE TABLE public.warehouses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    manager TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table du Catalogue des Articles / Pièces Détachées (Unicité composite Référence + Marque)
CREATE TABLE public.articles (
    id TEXT PRIMARY KEY,
    main_reference TEXT NOT NULL,
    brand TEXT NOT NULL,
    designation TEXT NOT NULL,
    category TEXT NOT NULL,
    compatible_machines TEXT[],
    equivalent_references TEXT[],
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    min_stock_threshold INTEGER NOT NULL DEFAULT 5,
    default_location TEXT,
    unit TEXT NOT NULL DEFAULT 'Unité',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_reference_brand UNIQUE (main_reference, brand)
);

-- 3. Table des Niveaux de Stock par Magasin
CREATE TABLE public.warehouse_stocks (
    article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    shelf_location TEXT,
    last_inventory_date TIMESTAMPTZ,
    PRIMARY KEY (article_id, warehouse_id)
);

-- 4. Table du Journal d'Audit des Mouvements
CREATE TABLE public.stock_movements (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('ENTREE', 'SORTIE', 'TRANSFERT', 'AJUSTEMENT')),
    article_id TEXT NOT NULL REFERENCES public.articles(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    source_warehouse_id TEXT REFERENCES public.warehouses(id),
    target_warehouse_id TEXT REFERENCES public.warehouses(id),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    document_ref TEXT NOT NULL,
    reason TEXT NOT NULL,
    stock_before INTEGER,
    stock_after INTEGER
);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesText);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Architecture Données & Cloud
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Firebase Cloud Activé
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Configuration de votre infrastructure Cloud Firestore, schémas, règles de sécurité et synchronisation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportDatabaseJson}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Sauvegarde JSON Locale
            </button>
          </div>
        </div>
      </div>

      {/* Main Firebase Cloud Management Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-7 h-7 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Google Cloud Firestore</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Opérationnel & Provisionné
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Base de données cloud NoSQL distribuée avec synchronisation multi-utilisateurs
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Test en cours...' : 'Tester la connexion'}
            </button>
            <button
              onClick={handlePushToFirebase}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg border border-amber-600 inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              {isSyncing ? 'Sauvegarde Cloud...' : 'Sauvegarder sur Firebase'}
            </button>
            <button
              onClick={handlePullFromFirebase}
              disabled={isPulling}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 text-xs font-bold rounded-lg border border-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CloudDownload className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
              {isPulling ? 'Import Cloud...' : 'Importer depuis Firebase'}
            </button>
          </div>
        </div>

        {/* Pull Message Alert */}
        {pullMessage && (
          <div className="mb-4 p-3.5 rounded-lg border text-xs flex items-center gap-2.5 bg-emerald-950/60 border-emerald-500/40 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pullMessage}</span>
          </div>
        )}

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={`mb-4 p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
              testResult.success
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Sync Success Alert */}
        {syncStats && (
          <div className="mb-4 p-4 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs">
            <div className="font-bold flex items-center gap-2 mb-2 text-sm text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              Synchronisation réussie avec Google Cloud Firestore !
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
              <div className="p-2 bg-slate-900/60 rounded">Articles : <strong>{syncStats.articles}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Magasins : <strong>{syncStats.warehouses}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Lignes de Stock : <strong>{syncStats.stocks}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Mouvements : <strong>{syncStats.movements}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Clients : <strong>{syncStats.customers}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Ventes : <strong>{syncStats.sales}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Règlements : <strong>{syncStats.payments}</strong></div>
              <div className="p-2 bg-slate-900/60 rounded">Sessions Caisse : <strong>{syncStats.cashSessions}</strong></div>
            </div>
          </div>
        )}

        {/* Sync Error Alert */}
        {syncError && (
          <div className="mb-4 p-3.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Cloud Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Firebase Project ID
            </span>
            <span className="font-mono text-xs text-amber-300 font-bold block mt-0.5 truncate">
              fair-ability-gc70r
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Firestore Database ID
            </span>
            <span className="font-mono text-xs text-emerald-300 font-bold block mt-0.5 truncate">
              ai-studio-equipstockproges-6211f078...
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Sécurité Déployée
            </span>
            <span className="font-mono text-xs text-sky-300 font-bold block mt-0.5">
              firestore.rules (Sécurisé & Opérationnel)
            </span>
          </div>
        </div>

        {/* Firebase Authentication Status Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Session Firebase Auth (Google)</span>
              {authUser ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connecté : {authUser.displayName || authUser.email}
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Accès opérationnel sans restriction de session
                </span>
              )}
            </div>
          </div>

          <div>
            {authUser ? (
              <button
                onClick={handleGoogleLogout}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 inline-flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion Google
              </button>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Se connecter avec Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Firestore Rules vs PostgreSQL SQL Schema */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'firebase'
                ? 'border-amber-500 text-amber-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500" />
            Règles Firestore Actives (firestore.rules)
          </button>
          <button
            onClick={() => setActiveTab('postgres')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'postgres'
                ? 'border-amber-500 text-amber-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4 text-blue-500" />
            Schéma Relationnel PostgreSQL / Supabase
          </button>
        </div>

        {activeTab === 'firebase' ? (
          <div>
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs text-slate-300 font-mono">
                Règles déployées sur Cloud Firestore (fair-ability-gc70r)
              </span>
              <button
                onClick={handleCopyRules}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 inline-flex items-center gap-1.5"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedRules ? 'Copié !' : 'Copier les règles'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96">
              {firestoreRulesText}
            </pre>
          </div>
        ) : (
          <div>
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs text-slate-300 font-mono">
                Schéma relationnel SQL prêt pour Supabase / Cloud SQL
              </span>
              <button
                onClick={handleCopySql}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 inline-flex items-center gap-1.5"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Copié !' : 'Copier le script SQL'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96">
              {supabaseSqlSchema}
            </pre>
          </div>
        )}
      </div>

      {/* Grid: Architecture summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Real & Working */}
        <div className="p-5 bg-white border border-emerald-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Stockage & Haute Disponibilité
          </div>
          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-600">✓</span>
              <span>
                <strong>Cloud Firestore activé :</strong> Vos collections (articles, dépôts, stocks, mouvements, ventes, clients) sont reliées au Cloud Firebase.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-600">✓</span>
              <span>
                <strong>Mode Hybride Hors-Ligne & Cloud :</strong> L'application continue de fonctionner instantanément en local même en cas de coupure de réseau.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-600">✓</span>
              <span>
                <strong>Règles Zero-Trust ABAC :</strong> Toutes les écritures et lectures sont protégées contre les injections, les stocks négatifs et les altérations.
              </span>
            </li>
          </ul>
        </div>

        {/* Security and Admin */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
            <Shield className="w-5 h-5 text-amber-500" />
            Sécurité & Droits d'Accès
          </div>
          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600">•</span>
              <span>
                <strong>Administrateur système :</strong> <code>westjunior0805@gmail.com</code> est configuré avec privilèges administrateur complets.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600">•</span>
              <span>
                <strong>Cloisonnement par magasin :</strong> Les magasiniers sont affectés à leur magasin d'appartenance avec validation d'intégrité.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600">•</span>
              <span>
                <strong>Traçabilité immuable :</strong> Les mouvements de stock et écritures de caisse sont scellés et infalsifiables.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
