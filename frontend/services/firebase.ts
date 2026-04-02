/**
 * Single Firebase app instance for the browser. Web API keys are public by design; real
 * security is enforced in Firebase console rules and backend APIs, not by hiding this file.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCWHhVorLWlqMidHPTCpAhh0wbl8DDA9U",
  authDomain: "scholarai-fe879.firebaseapp.com",
  projectId: "scholarai-fe879",
  storageBucket: "scholarai-fe879.firebasestorage.app",
  messagingSenderId: "1083496829270",
  appId: "1:1083496829270:web:6830748ded4b132d54c6f7",
  measurementId: "G-SZCSSLCMZ9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);