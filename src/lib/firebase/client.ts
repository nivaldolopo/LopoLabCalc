import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Usa a variável de ambiente quando ela tem valor de verdade; senão cai no
// fallback embutido (valores reais do projeto lopo-lab). ATENÇÃO: usar `||`
// em vez de `??` é proposital — na Vercel essas envs estão cadastradas como
// string VAZIA, e `??` deixaria o "" passar, quebrando o Firebase (login +
// Firestore). `envOr` trata "" (e espaços) como ausente.
function envOr(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

const firebaseConfig = {
  apiKey: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    "AIzaSyBDKwyCxte1qeWYZM9kfySQs8jG55akULY",
  ),
  authDomain: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "lopo-lab.firebaseapp.com",
  ),
  projectId: envOr(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "lopo-lab"),
  storageBucket: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "lopo-lab.firebasestorage.app",
  ),
  messagingSenderId: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "449845612191",
  ),
  appId: envOr(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "1:449845612191:web:9b2ba51b5d51d91c8a5caa",
  ),
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(
  app,
  envOr(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID, "lopo-lab-calculadora"),
);

export const auth = getAuth(app);
