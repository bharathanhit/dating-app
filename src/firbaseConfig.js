// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
 // apiKey: "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: "date-3963e.firebaseapp.com",
  projectId: "date-3963e",
  storageBucket: "date-3963e.firebasestorage.app",
  messagingSenderId: "172915248443",
  appId: "1:172915248443:web:aa0bf66ed5e9c8379ffb1e",
  measurementId: "G-MCD9RC9VBP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);