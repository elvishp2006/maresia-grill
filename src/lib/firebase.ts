import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBgUQrmoFlU-WlqXr0E3_PLFEe4Q6KscnI",
  authDomain: "menu-7f7cd.firebaseapp.com",
  projectId: "menu-7f7cd",
  storageBucket: "menu-7f7cd.firebasestorage.app",
  messagingSenderId: "311492602456",
  appId: "1:311492602456:web:b25ceb743e1524a018782d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
  console.warn('Falha ao persistir a sessao do Firebase Auth:', error);
});
