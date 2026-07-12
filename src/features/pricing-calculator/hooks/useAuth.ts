"use client";

import { useEffect, useState } from "react";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { ALLOWED_EMAILS } from "../constants";

export type AuthState = "loading" | "signed-out" | "unauthorized" | "authorized";

// Erros de popup que indicam "este ambiente não deixa abrir popup" (típico de
// navegadores mobile) — nesses casos caímos para o fluxo de redirect.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/popup-closed-by-user",
  "auth/operation-not-supported-in-this-environment",
]);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ao voltar de um login por redirect (fallback do popup), captura erros.
    // O login em si é refletido pelo onAuthStateChanged abaixo.
    getRedirectResult(auth).catch((caught) =>
      setError((caught as Error).message),
    );

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
    const provider = new GoogleAuthProvider();
    try {
      // Popup: no desktop completa o handshake na própria janela e volta por
      // postMessage (sem depender de armazenamento de terceiro).
      await signInWithPopup(auth, provider);
    } catch (caught) {
      const code = (caught as { code?: string }).code ?? "";
      // Popup não vingou (comum no mobile) → tenta redirect, que não usa popup.
      if (POPUP_FALLBACK_CODES.has(code)) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setError((redirectError as Error).message);
          return;
        }
      }
      setError((caught as Error).message);
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return { user, state, error, signIn, signOut };
}
