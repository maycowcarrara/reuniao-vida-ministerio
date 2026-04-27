import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";

const firebaseEnv = {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingFirebaseEnv = Object.entries(firebaseEnv)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);

if (missingFirebaseEnv.length > 0) {
    throw new Error(
        [
            "Configuracao do Firebase incompleta.",
            `Defina as variaveis ${missingFirebaseEnv.join(", ")} em .env.local ou .env.`
        ].join(" ")
    );
}

const firebaseConfig = {
    apiKey: firebaseEnv.VITE_FIREBASE_API_KEY,
    authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: firebaseEnv.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Configuração corrigida de persistência (Cache Offline)
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager() // Permite abrir em várias abas offline
    })
});

export const googleProvider = new GoogleAuthProvider();
