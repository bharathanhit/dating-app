import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

// TODO: Replace with your Firebase project config
// Get this from Firebase Console: https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "date-3963e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "date-3963e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "date-3963e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "172915248443",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:172915248443:web:aa0bf66ed5e9c8379ffb1e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Realtime Database
export const realtimeDb = getDatabase(app);

export default app;
