// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDCWHhVorLWlqMidHPTCpAhh0wbl8DDA9U",
  authDomain: "scholarai-fe879.firebaseapp.com",
  projectId: "scholarai-fe879",
  storageBucket: "scholarai-fe879.firebasestorage.app",
  messagingSenderId: "1083496829270",
  appId: "1:1083496829270:web:6830748ded4b132d54c6f7",
  measurementId: "G-SZCSSLCMZ9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);