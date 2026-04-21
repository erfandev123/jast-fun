import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDwXJEDzlDz0nzv-UIxscv0Dl8GhYpEbv8",
  authDomain: "reelix-app.firebaseapp.com",
  databaseURL: "https://reelix-app-default-rtdb.firebaseio.com",
  projectId: "reelix-app",
  storageBucket: "reelix-app.firebasestorage.app",
  messagingSenderId: "991326509726",
  appId: "1:991326509726:web:fc3ba39eefafe28a39398f",
  measurementId: "G-GNPN3LZK04"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
