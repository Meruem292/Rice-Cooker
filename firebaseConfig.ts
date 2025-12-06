import firebase from "firebase/compat/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// REPLACE WITH YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDgfliL1uZtZ9f8Sedo12cD5Cq7bgLVp_4",
  authDomain: "ricecooker-e5b58.firebaseapp.com",
  databaseURL: "https://ricecooker-e5b58-default-rtdb.firebaseio.com",
  projectId: "ricecooker-e5b58",
  storageBucket: "ricecooker-e5b58.firebasestorage.app",
  messagingSenderId: "655100217984",
  appId: "1:655100217984:web:da147275ab160e5be9f465",
  measurementId: "G-XNF2PTC112"
};

// Use compat app initialization to resolve export issues
const app = firebase.initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);