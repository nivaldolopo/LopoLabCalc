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

// [DEC-06] Local (pnpm dev) e Preview da Vercel caem no banco de TESTE — só
// produção (VERCEL_ENV "production") usa o banco real. NEXT_PUBLIC_VERCEL_ENV é
// exposto automaticamente pela Vercel; se por algum motivo não vier (build
// local sem essa env), cai no NODE_ENV — o que faz o pior caso possível ser o
// de HOJE (preview sem isolamento), nunca produção apontando pro banco errado.
const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV
  ? process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
  : process.env.NODE_ENV === "production";

export const db = getFirestore(
  app,
  isProduction ? "lopo-lab-calculadora" : "lopo-lab-calculadora-test",
);

export const auth = getAuth(app);
