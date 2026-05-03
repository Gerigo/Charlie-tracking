import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
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
      const auth = getAuth(firebaseApp);
      // Persist sessions in localStorage so reloads keep the user signed in.
      void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
      return auth;
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
