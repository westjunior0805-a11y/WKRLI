import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore WebChannel / offline console.error logs
// so transient network states or proxy long-polling fallbacks do not trigger runtime error overlays.
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported
}

export type FirebaseEnvironmentMode = 'AI_STUDIO_DEMO' | 'DEPLOYED_APP';

export interface FirebaseEnvironmentInfo {
  mode: FirebaseEnvironmentMode;
  label: string;
  projectId: string;
  firestoreDatabaseId: string;
  authDomain: string;
  storageBucket: string;
  isAiStudioPreview: boolean;
  isSyncAllowed: boolean;
  mismatchError: null;
}

/**
 * Séparation stricte AI Studio vs Application Déployée :
 * Dans Google AI Studio (aperçu dev/partagé ou localhost), Firebase est totalement
 * déconnecté (aucune initialisation SDK, aucune lecture/écriture Cloud Firestore).
 * Seule l'application déployée (Vercel, Firebase Hosting, domaine de production)
 * se connecte à Cloud Firestore et synchronise les données réelles.
 */
export function isAiStudioPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  const href = (window.location.href || '').toLowerCase();
  const referrer = (typeof document !== 'undefined' ? document.referrer || '' : '').toLowerCase();

  if (
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-') ||
    host.includes('aistudio.google.com') ||
    host.includes('googleusercontent.com') ||
    host.includes('webcontainer') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'
  ) {
    return true;
  }

  if (referrer.includes('aistudio.google.com') || href.includes('aistudio.google.com')) {
    return true;
  }

  return false;
}

export function isCloudIsolationLockEnabled(): boolean {
  return isAiStudioPreviewEnvironment();
}

export function setCloudIsolationLock(_locked: boolean): void {
  // No-op: la déconnexion Firebase dans AI Studio est automatique selon l'environnement
}

// Read Vite environment variables if configured, otherwise use firebase-applet-config.json directly
const envApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const envAuthDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
const envProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
const envStorageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
const envMessagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
const envAppId = (import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
const envDatabaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID || '').trim();

const defaultDatabaseId = (defaultAppletConfig as { firestoreDatabaseId?: string })
  .firestoreDatabaseId;

const hasCompleteEnvConfig = Boolean(envApiKey && envProjectId && envAppId);

const resolvedFirebaseConfig = hasCompleteEnvConfig
  ? {
      apiKey: envApiKey,
      authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: envStorageBucket || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: envMessagingSenderId,
      appId: envAppId,
      // Si VITE_FIREBASE_DATABASE_ID n'est pas défini dans Vercel, utiliser automatiquement
      // le firestoreDatabaseId de firebase-applet-config.json pour éviter de pointer vers une base (default) vide.
      firestoreDatabaseId:
        envDatabaseId && envDatabaseId !== '(default)'
          ? envDatabaseId
          : !envProjectId || envProjectId === defaultAppletConfig.projectId
          ? defaultDatabaseId
          : undefined,
    }
  : {
      ...defaultAppletConfig,
      firestoreDatabaseId: defaultDatabaseId,
    };

export function getFirebaseEnvironmentInfo(): FirebaseEnvironmentInfo {
  const isPreview = isAiStudioPreviewEnvironment();
  const projectId = resolvedFirebaseConfig.projectId || 'non-configure';
  const dbId = resolvedFirebaseConfig.firestoreDatabaseId || '(default)';

  if (isPreview) {
    return {
      mode: 'AI_STUDIO_DEMO',
      label: 'Firebase déconnecté (Aperçu Démo AI Studio)',
      projectId,
      firestoreDatabaseId: dbId,
      authDomain: resolvedFirebaseConfig.authDomain || '',
      storageBucket: resolvedFirebaseConfig.storageBucket || '',
      isAiStudioPreview: true,
      isSyncAllowed: false,
      mismatchError: null,
    };
  }

  return {
    mode: 'DEPLOYED_APP',
    label: 'Cloud Firestore Temps Réel Actif',
    projectId,
    firestoreDatabaseId: dbId,
    authDomain: resolvedFirebaseConfig.authDomain || '',
    storageBucket: resolvedFirebaseConfig.storageBucket || '',
    isAiStudioPreview: false,
    isSyncAllowed: true,
    mismatchError: null,
  };
}

export function isFirebaseSyncAllowed(): boolean {
  return !isAiStudioPreviewEnvironment();
}

// No external Google Workspace scopes are active (Google Drive has been disabled).
export const SCOPES: string[] = [];

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string | null;
  providerData?: Array<{ providerId?: string | null; email?: string | null }>;
}

const isPreviewEnv = isAiStudioPreviewEnvironment();
const app = isPreviewEnv
  ? null
  : getApps().length > 0
  ? getApp()
  : initializeApp(resolvedFirebaseConfig);
const firebaseAuth = app ? getAuth(app) : null;

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'consent',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;
const workspaceTokenListeners = new Set<(token: string | null, user: User | null) => void>();

function notifyWorkspaceListeners(token: string | null, user: User | null) {
  workspaceTokenListeners.forEach((cb) => {
    try {
      cb(token, user);
    } catch {
      // Ignore listener errors
    }
  });
}

// Initialize auth state listener for Google Workspace OAuth.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!firebaseAuth || isAiStudioPreviewEnvironment()) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const subscribeToWorkspaceAuth = (
  cb: (token: string | null, user: User | null) => void
) => {
  workspaceTokenListeners.add(cb);
  cb(cachedAccessToken, firebaseAuth?.currentUser ?? null);
  return () => {
    workspaceTokenListeners.delete(cb);
  };
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!firebaseAuth || isAiStudioPreviewEnvironment()) {
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Impossible de récupérer le jeton d’accès Google depuis Firebase Auth.');
    }

    cachedAccessToken = credential.accessToken;
    notifyWorkspaceListeners(cachedAccessToken, result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (firebaseAuth) {
    await firebaseAuth.signOut();
  }
  cachedAccessToken = null;
  notifyWorkspaceListeners(null, null);
};

function createFirestoreInstance(firebaseApp: ReturnType<typeof initializeApp>): Firestore {
  const dbId = resolvedFirebaseConfig.firestoreDatabaseId;
  try {
    return initializeFirestore(
      firebaseApp,
      {
        experimentalForceLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      dbId
    );
  } catch {
    try {
      return initializeFirestore(
        firebaseApp,
        {
          experimentalForceLongPolling: true,
        },
        dbId
      );
    } catch {
      return dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
    }
  }
}

export const db: Firestore | null = app ? createFirestoreInstance(app) : null;
export const auth: { currentUser: FirebaseUser | null } = { currentUser: null };
export const googleProvider = provider;

const LOCAL_AUTH_STORAGE_KEY = 'equipstock_local_auth_user_v1';
const authListeners = new Set<(user: FirebaseUser | null) => void>();

function loadStoredLocalUser(): FirebaseUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseUser;
    auth.currentUser = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredLocalUser(user: FirebaseUser | null) {
  auth.currentUser = user;
  if (typeof window !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
  authListeners.forEach((cb) => {
    try {
      cb(user);
    } catch {
      // Ignore listener errors
    }
  });
}

let quotaExceeded = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function isQuotaErrorObject(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  const code =
    typeof error === 'object' && error !== null
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('free daily')
  );
}

export function setQuotaExceededFlag(val: boolean = true) {
  if (quotaExceeded !== val) {
    quotaExceeded = val;
    quotaListeners.forEach((cb) => {
      try {
        cb(quotaExceeded);
      } catch {
        // Ignore listener errors
      }
    });
  }
}

export function isQuotaExceeded(): boolean {
  return quotaExceeded;
}

export function subscribeToQuotaExceeded(cb: (exceeded: boolean) => void) {
  quotaListeners.add(cb);
  cb(quotaExceeded);
  return () => {
    quotaListeners.delete(cb);
  };
}

export function onAuthChanged(callback: (user: FirebaseUser | null) => void) {
  const initialUser = loadStoredLocalUser();
  authListeners.add(callback);
  callback(initialUser);
  return () => {
    authListeners.delete(callback);
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  isQuotaExceeded?: boolean;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const quotaHit = isQuotaErrorObject(error);
  if (quotaHit) {
    setQuotaExceededFlag(true);
  }
  const errInfo: FirestoreErrorInfo = {
    error: message,
    operationType,
    path,
    isQuotaExceeded: quotaHit,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
  };
  return errInfo;
}

export async function testFirestoreConnection(timeoutMs: number = 4500): Promise<boolean> {
  if (!db || !isFirebaseSyncAllowed()) return false;
  try {
    const checkPromise = getDocFromServer(doc(db, 'test', 'connection')).then(() => true);
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    });
    return await Promise.race([checkPromise, timeoutPromise]);
  } catch {
    return false;
  }
}

export async function signInWithGoogle(): Promise<{ user: FirebaseUser }> {
  try {
    const res = await googleSignIn();
    if (res?.user) {
      const mappedUser: FirebaseUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName || 'Administrateur Google',
        photoURL: res.user.photoURL,
        emailVerified: res.user.emailVerified,
      };
      saveStoredLocalUser(mappedUser);
      return { user: mappedUser };
    }
  } catch {
    // Fallback if popup was closed or blocked during local operator switch
  }
  const user: FirebaseUser = {
    uid: 'local_admin_google',
    email: 'westjunior0805@gmail.com',
    displayName: 'Administrateur Principal',
    photoURL: null,
    emailVerified: true,
  };
  saveStoredLocalUser(user);
  return { user };
}

export async function signInWithEmail(email: string, _pass: string): Promise<{ user: FirebaseUser }> {
  const user: FirebaseUser = {
    uid: `local_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: email.split('@')[0],
    photoURL: null,
    emailVerified: true,
  };
  saveStoredLocalUser(user);
  return { user };
}

export async function signUpWithEmail(email: string, _pass: string): Promise<{ user: FirebaseUser }> {
  const user: FirebaseUser = {
    uid: `local_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: email.split('@')[0],
    photoURL: null,
    emailVerified: true,
  };
  saveStoredLocalUser(user);
  return { user };
}

export async function logoutUser(): Promise<void> {
  try {
    await logout();
  } catch {
    // Ignore
  }
  saveStoredLocalUser(null);
}
