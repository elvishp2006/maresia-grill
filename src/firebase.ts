import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "menu-7f7cd.firebaseapp.com",
  projectId: "menu-7f7cd",
  storageBucket: "menu-7f7cd.firebasestorage.app",
  messagingSenderId: "311492602456",
  appId: "1:311492602456:web:b25ceb743e1524a018782d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
