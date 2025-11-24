import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// REPLACE THIS WITH YOUR REAL KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
apiKey: "AIzaSyDCzSdHUvIozSG5vqv3_Gguiej00t--FSM",
  authDomain: "nashville-tickets.firebaseapp.com",
  projectId: "nashville-tickets",
  storageBucket: "nashville-tickets.firebasestorage.app",
  messagingSenderId: "742085040220",
  appId: "1:742085040220:web:c4ce3496879a7b3366ee99"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// You can change this ID to whatever you want
export const appId = "nashville-roadshow-live";