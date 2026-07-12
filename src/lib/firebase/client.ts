import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config real do projeto lopo-lab, embutida diretamente (valores públicos de um
// app web Firebase). NÃO lemos mais de NEXT_PUBLIC_FIREBASE_* na Vercel de
// propósito: as envs de produção estavam quebradas — a apiKey fora salva
// MASCARADA com "•" (colada da UI do Firebase quando exibida oculta), o que
// enviava uma chave inválida ao Firebase Auth (o Firestore tolerava, o login
// não → auth/api-key-not-valid). Fixar aqui elimina essa classe de erro.
const firebaseConfig = {
  apiKey: "AIzaSyBDKwyCxte1qeWYZM9kfySQs8jG55akULY",
  authDomain: "lopo-lab.firebaseapp.com",
  projectId: "lopo-lab",
  storageBucket: "lopo-lab.firebasestorage.app",
  messagingSenderId: "449845612191",
  appId: "1:449845612191:web:9b2ba51b5d51d91c8a5caa",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app, "lopo-lab-calculadora");

export const auth = getAuth(app);
