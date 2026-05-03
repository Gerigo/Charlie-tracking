import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { canUseDevTools, env, isFirebaseConfigured } from './env';

const firebaseConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
};

export const firebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = firebaseApp
  ? (() => {
      // Use initializeAuth so the persistence chain is set BEFORE any auth
      // operation runs — async setPersistence after getAuth() races with
      // the first signIn and was leaving sessions in-memory only on iOS PWA.
      //
      // Fallback order:
      //   1. IndexedDB — survives Safari's ITP best (kept across the
      //      7-day inactivity window if the user opens the PWA regularly)
      //   2. localStorage — for browsers without IndexedDB or in private
      //      mode
      //
      // initializeAuth throws if called twice on the same app, so guard
      // against the IIFE re-running (HMR, fast refresh) by falling back
      // to getAuth in that case.
      try {
        return initializeAuth(firebaseApp, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        });
      } catch {
        return getAuth(firebaseApp);
      }
    })()
  : null;

export const firestore = firebaseApp
  ? (() => {
      try {
        if (canUseDevTools) {
          setLogLevel('debug');
        }
        return initializeFirestore(firebaseApp, {
          experimentalAutoDetectLongPolling: true,
        });
      } catch {
        if (canUseDevTools) {
          setLogLevel('debug');
        }
        return getFirestore(firebaseApp);
      }
    })()
  : null;

export const storage = firebaseApp ? getStorage(firebaseApp) : null;
