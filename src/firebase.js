// Multisede: nunca conectar una prueba a la base histórica.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const env = import.meta.env;
const projectId = env.VITE_MULTISEDE_PROJECT_ID;
export const multisedeConfigurado = Boolean(projectId && projectId !== "zoriapp-23b52" &&
  env.VITE_MULTISEDE_API_KEY && env.VITE_MULTISEDE_APP_ID && env.VITE_MULTISEDE_AUTH_DOMAIN);
const app = initializeApp(multisedeConfigurado ? {
  projectId, apiKey: env.VITE_MULTISEDE_API_KEY, appId: env.VITE_MULTISEDE_APP_ID,
  authDomain: env.VITE_MULTISEDE_AUTH_DOMAIN, storageBucket: env.VITE_MULTISEDE_STORAGE_BUCKET,
} : {projectId:"zoriapp-no-config", apiKey:"no-config", appId:"no-config",authDomain:"invalid.example"});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
