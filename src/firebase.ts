import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, disableNetwork, enableNetwork } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export type { FirebaseUser };

// Dedicated app for rock-solid Cloud Firestore connectivity without being blocked by Auth token service
const firestoreApp = getApps().some((a) => a.name === 'firestoreApp')
  ? getApp('firestoreApp')
  : initializeApp(firebaseConfig, 'firestoreApp');

export const db = getFirestore(firestoreApp, firebaseConfig.firestoreDatabaseId);

// Default to Local Mode unless explicitly re-enabled
let quotaExceededFlag = localStorage.getItem('equipstock_force_local') !== 'false';

if (quotaExceededFlag) {
  try {
    disableNetwork(db).catch(() => {});
  } catch (e) {
    // ignore
  }
}

export function setQuotaExceededFlag(val: boolean = true) {
  quotaExceededFlag = val;
  if (val) {
    localStorage.setItem('equipstock_force_local', 'true');
    try {
      disableNetwork(db).catch(() => {});
    } catch (e) {
      // ignore
    }
  } else {
    localStorage.setItem('equipstock_force_local', 'false');
    try {
      enableNetwork(db).catch(() => {});
    } catch (e) {
      // ignore
    }
  }
}

export function isQuotaExceeded(): boolean {
  return quotaExceededFlag;
}

export function onAuthChanged(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(
    auth,
    async (user) => {
      if (user) {
        try {
          await user.getIdToken();
          callback(user);
        } catch (err: any) {
          const errMsg = err?.message || '';
          if (
            errMsg.includes('token-service-api-has-not-been-used') ||
            err?.code === 'auth/token-service-api-has-not-been-used' ||
            errMsg.includes('securetoken.googleapis.com')
          ) {
            console.warn(
              'Avis: API Firebase Token Service non active sur le projet Google Cloud. Réinitialisation préventive de la session pour permettre un accès direct Firestore :',
              err
            );
            try {
              await signOut(auth);
            } catch (soErr) {
              // Ignore
            }
            callback(null);
            return;
          }
          callback(user);
        }
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn('Avis Firebase Auth onAuthStateChanged:', error);
      callback(null);
    }
  );
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded =
    message.includes('resource-exhausted') ||
    message.includes('Quota limit exceeded') ||
    message.includes('quota');
  const isOffline =
    message.includes('offline') ||
    message.includes('backend') ||
    message.includes('unavailable');

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  if (isQuotaExceeded) {
    setQuotaExceededFlag(true);
    console.warn(
      '⚡ Quota Cloud Firestore journalier atteint (Free tier). Mode hors-ligne / Cache local activé sans interruption.'
    );
  } else if (isOffline) {
    console.warn('📶 Mode hors-ligne Cloud Firestore actif:', message);
  } else {
    console.warn('Firestore Notice:', JSON.stringify(errInfo));
  }

  return errInfo;
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken();
      } catch (tokenErr: any) {
        if (
          tokenErr?.message?.includes('token-service-api-has-not-been-used') ||
          tokenErr?.code?.includes('token-service') ||
          tokenErr?.message?.includes('securetoken.googleapis.com')
        ) {
          console.warn('Session avec Secure Token Service non activé, bascule vers un accès direct Firestore.');
          try {
            await signOut(auth);
          } catch (e) {
            // ignore
          }
        }
      }
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('resource-exhausted') || msg.includes('Quota limit exceeded') || msg.includes('quota')) {
      setQuotaExceededFlag(true);
      console.warn('⚡ Quota Cloud Firestore dépassé (test de connexion). Mode local basculé.');
    } else if (msg.includes('the client is offline') || msg.includes('backend')) {
      console.warn('📶 Client Firebase hors-ligne ou indisponible:', msg);
    }
    return false;
  }
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('Erreur authentification Google:', err);
    throw err;
  }
}

export async function signInWithEmail(email: string, pass: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error('Erreur authentification email/mot de passe:', err);
    throw err;
  }
}

export async function signUpWithEmail(email: string, pass: string) {
  try {
    return await createUserWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error('Erreur création compte email/mot de passe:', err);
    throw err;
  }
}

export async function logoutUser() {
  try {
    return await signOut(auth);
  } catch (err) {
    console.error('Erreur déconnexion:', err);
    throw err;
  }
}
