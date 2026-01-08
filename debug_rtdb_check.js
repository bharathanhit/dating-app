
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth'; // Import auth
import { firebaseConfig } from './src/config/firebase.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Init auth

async function checkStatus() {
  console.log("Authenticating...");
  await signInAnonymously(auth);
  console.log("Authenticated. Checking RTDB status...");
  
  try {
    const statusRef = ref(db, 'status');
    const snapshot = await get(statusRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log("RTDB Data found:");
      console.log(JSON.stringify(data, null, 2));
      
      const count = Object.keys(data).length;
      const onlineCount = Object.values(data).filter(v => v.online === true).length;
      console.log(`Total entires: ${count}, Online: ${onlineCount}`);
    } else {
      console.log("No data in 'status' node.");
    }
  } catch (error) {
    console.error("Error fetching status:", error);
  }
  process.exit();
}

checkStatus();
