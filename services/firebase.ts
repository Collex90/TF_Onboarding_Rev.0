
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

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

// Funzione per leggere le variabili d'ambiente (Vercel/Vite)
const getEnvFirebaseConfig = (): FirebaseConfig | null => {
  try {
    // @ts-ignore
    const env = import.meta.env;
    
    // Safety check to ensure env exists before accessing properties
    if (env && env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID
      };
    }
  } catch (e) {
    console.warn("Error reading environment variables", e);
  }
  return null;
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
  storage = null;
  // Se ci sono variabili d'ambiente, reinizializzerà quelle al reload, 
  // ma rimuovendo dal localstorage puliamo l'override manuale.
};

let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

export const initFirebase = () => {
  // Priorità: 1. Configurazione Manuale (LocalStorage) -> 2. Variabili d'Ambiente (Vercel)
  const manualConfig = getStoredFirebaseConfig();
  const envConfig = getEnvFirebaseConfig();
  
  const config = manualConfig || envConfig;

  if (config && config.apiKey) {
    try {
      const app = !getApps().length ? initializeApp(config) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      if (config.storageBucket) {
        storage = getStorage(app);
      }
      console.log("Firebase initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
      db = null;
      auth = null;
      storage = null;
    }
  } else {
      db = null;
      auth = null;
      storage = null;
  }
  return { db, auth, storage };
};

// Initialize on load
initFirebase();

export { db, auth, storage };
