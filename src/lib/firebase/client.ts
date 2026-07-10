import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyBDKwyCxte1qeWYZM9kfySQs8jG55akULY",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "lopo-lab.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "lopo-lab",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "lopo-lab.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "449845612191",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:449845612191:web:9b2ba51b5d51d91c8a5caa",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(
  app,
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ?? "lopo-lab-calculadora",
);
