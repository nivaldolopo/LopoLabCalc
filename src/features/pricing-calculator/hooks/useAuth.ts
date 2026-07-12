"use client";

import { useEffect, useState } from "react";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
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
    // Ao voltar do redirect do Google, captura erros (o login em si é refletido
    // pelo onAuthStateChanged abaixo).
    getRedirectResult(auth).catch((caught) =>
      setError((caught as Error).message),
    );

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setState("signed-out");
        return;
      }
      const email = (nextUser.email ?? "").toLowerCase();
      setState(ALLOWED_EMAILS.includes(email) ? "authorized" : "unauthorized");
    });
  }, []);

  async function signIn() {
    setError(null);
    try {
      // Redirect em vez de popup: a página vai ao Google e volta logada. Evita
      // o iframe/cookies de terceiros do popup (que quebra em vários navegadores
      // e no mobile).
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return { user, state, error, signIn, signOut };
}
