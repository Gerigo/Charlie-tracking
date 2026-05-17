import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDXOKB3GCmKq_Y4NR-1PaMPqYbSP0aWU_M",
  authDomain: "sleeptracker-71e30.firebaseapp.com",
  projectId: "sleeptracker-71e30",
  storageBucket: "sleeptracker-71e30.firebasestorage.app",
  messagingSenderId: "621914073040",
  appId: "1:621914073040:web:37a4fa561275e9137abbd5"
};


export const firebaseApp = initializeApp(firebaseConfig);

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
