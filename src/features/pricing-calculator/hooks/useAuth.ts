"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { ALLOWED_EMAILS } from "../constants";

export type AuthState = "loading" | "signed-out" | "unauthorized" | "authorized";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Rede de segurança: se o Firebase Auth não resolver o estado inicial em
    // alguns segundos (ex.: IndexedDB/armazenamento travado em certos
    // navegadores mobile), cai para a tela de login em vez de ficar em
    // "Carregando…" eterno. O onAuthStateChanged, quando dispara, cancela isto.
    const fallback = window.setTimeout(() => {
      setState((current) => (current === "loading" ? "signed-out" : current));
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      window.clearTimeout(fallback);
      setUser(nextUser);
      if (!nextUser) {
        setState("signed-out");
        return;
      }
      const email = (nextUser.email ?? "").toLowerCase();
      setState(ALLOWED_EMAILS.includes(email) ? "authorized" : "unauthorized");
    });

    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  async function signIn() {
    setError(null);
    try {
      // Popup em vez de redirect: o handshake acontece na própria janela do
      // popup e o resultado volta por postMessage. Não depende de armazenamento
      // de terceiro (que os navegadores bloqueiam) — o redirect quebrava porque
      // o handler fica em lopo-lab.firebaseapp.com (domínio diferente do site)
      // e o estado não sobrevivia à volta, gerando loop de login.
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return { user, state, error, signIn, signOut };
}
