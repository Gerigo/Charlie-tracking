import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Firebase web config (apiKey & co ne sont PAS secrets — la sécurité
// passe par les règles Firestore + restrictions de clé API). Lu depuis
// les variables Vercel (VITE_FIREBASE_*) si présentes, sinon repli sur
// les valeurs du projet (l'app marche dans tous les cas).
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "AIzaSyDXOKB3GCmKq_Y4NR-1PaMPqYbSP0aWU_M",
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ?? "sleeptracker-71e30.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "sleeptracker-71e30",
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ??
    "sleeptracker-71e30.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "621914073040",
  appId:
    env.VITE_FIREBASE_APP_ID ??
    "1:621914073040:web:37a4fa561275e9137abbd5",
};


// Reuse the app across Vite HMR reloads (initializeApp twice throws).
export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

let firestore: Firestore;
try {
  firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    // Safari / content blockers / extensions often break Firestore's
    // WebChannel streaming ("access control checks"). Let the SDK fall
    // back to long-polling automatically.
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  firestore = getFirestore(firebaseApp);
}
export const db = firestore;
