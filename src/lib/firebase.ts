import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigValues = Object.values(firebaseConfig);

export const hasFirebaseConfig = requiredConfigValues.every(value => typeof value === 'string' && value.length > 0);

export const app: FirebaseApp | null = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const googleProvider: GoogleAuthProvider | null = auth ? new GoogleAuthProvider() : null;

googleProvider?.setCustomParameters({ prompt: 'select_account' });

if (import.meta.env.DEV && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

if (auth) {
  void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
    console.warn('Falha ao persistir a sessao do Firebase Auth:', error);
  });
}
