import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: "date-3963e.firebaseapp.com",
  databaseURL: "https://date-3963e-default-rtdb.firebaseio.com",
  projectId: "date-3963e",
storageBucket: "date-3963e.appspot.com",
  messagingSenderId: "172915248443",
  appId: "1:172915248443:web:aa0bf66ed5e9c8379ffb1e",
  measurementId: "G-MCD9RC9VBP"
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

// Initialize Cloud Functions with region
export const functions = getFunctions(app, 'us-central1');

export default app;
