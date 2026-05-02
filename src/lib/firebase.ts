import { getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { canUseDevTools, env, isFirebaseConfigured } from './env';
import { createReactNativePersistence } from './firebasePersistence';

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
      try {
        return initializeAuth(firebaseApp, {
          persistence: createReactNativePersistence(AsyncStorage),
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
