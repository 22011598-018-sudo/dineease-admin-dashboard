// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAWWcQ4COUHuyGuECoM1m4hXWfci01KlZ8",
  authDomain: "dineease-8c3d3.firebaseapp.com",
  databaseURL: "https://dineease-8c3d3-default-rtdb.firebaseio.com",
  projectId: "dineease-8c3d3",
  storageBucket: "dineease-8c3d3.firebasestorage.app",
  messagingSenderId: "656557953066",
  appId: "1:656557953066:web:7fc190cbde694fe9ec3353",
  measurementId: "G-LN3X76DGDB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const auth = getAuth(app);