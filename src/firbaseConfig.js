// config/firebase.js

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  // apiKey: "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: "date-3963e.firebaseapp.com",
  projectId: "date-3963e",
  storageBucket: "date-3963e.appspot.com",
  messagingSenderId: "172915248443",
  appId: "1:172915248443:web:aa0bf66ed5e9c8379ffb1e",
  measurementId: "G-MCD9RC9VBP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Optional: Analytics
getAnalytics(app);

// Initialize Firestore and Storage
export const db = getFirestore(app);
export const storage = getStorage(app);