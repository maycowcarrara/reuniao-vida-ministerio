import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDuW-J-vBJgyaRkXA-aYJwfN03RxLhaoyY",
    authDomain: "vidaeministerio.firebaseapp.com",
    projectId: "vidaeministerio",
    storageBucket: "vidaeministerio.firebasestorage.app",
    messagingSenderId: "275725526035",
    appId: "1:275725526035:web:448fb316a8f2a6d9180be6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Configuração corrigida de persistência (Cache Offline)
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache() // Configuração padrão moderna
});

export const googleProvider = new GoogleAuthProvider();