
import * as firebaseApp from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const { initializeApp, getApps, getApp } = firebaseApp as any;

const CONFIG_KEY = 'talentflow_firebase_config';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const getStoredFirebaseConfig = (): FirebaseConfig | null => {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveFirebaseConfig = (config: FirebaseConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  // Re-initialize immediately
  initFirebase();
};

export const removeFirebaseConfig = () => {
  localStorage.removeItem(CONFIG_KEY);
  // Reset instances
  db = null;
  auth = null;
};

let db: Firestore | null = null;
let auth: Auth | null = null;

export const initFirebase = () => {
  const config = getStoredFirebaseConfig();
  if (config && config.apiKey) {
    try {
      const app = !getApps().length ? initializeApp(config) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      console.log("Firebase initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
      db = null;
      auth = null;
    }
  } else {
      db = null;
      auth = null;
  }
  return { db, auth };
};

// Initialize on load
initFirebase();

export { db, auth };
