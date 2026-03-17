// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAuNPBccDi_opSF27yiu9Y1BBgDT0sJ_Oo",
  authDomain: "zoriapp-23b52.firebaseapp.com",
  projectId: "zoriapp-23b52",
  storageBucket: "zoriapp-23b52.firebasestorage.app",
  messagingSenderId: "320087340928",
  appId: "1:320087340928:web:f9848adfc5f3076808b365",
};

const app = initializeApp(firebaseConfig);

// Exportamos todos los servicios que usamos en la app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
