import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Configuration prioritizes environment variables, falls back to hardcoded values for testing
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDgfliL1uZtZ9f8Sedo12cD5Cq7bgLVp_4",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "ricecooker-e5b58.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://ricecooker-e5b58-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "ricecooker-e5b58",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "ricecooker-e5b58.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "655100217984",
  appId: process.env.FIREBASE_APP_ID || "1:655100217984:web:da147275ab160e5be9f465",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-XNF2PTC112"
};

// Use compat app initialization to resolve export issues
const app = firebase.initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);