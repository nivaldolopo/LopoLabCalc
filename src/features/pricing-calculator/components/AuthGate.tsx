"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

// Barreira de acesso: só renderiza o app para um e-mail Google autorizado.
// Envolve TODAS as rotas (usado no layout). Lembrete: isto é a camada de UI —
// a proteção real do banco vem das Regras do Firestore (Console).
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, user, error, signIn, signOut } = useAuth();

  if (state === "authorized") {
    return <>{children}</>;
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo" aria-hidden="true">
          <Printer size={22} />
        </div>
        <div className="auth-brand sg">
          Lopo Lab <span>✦</span>
        </div>

        {state === "loading" ? (
          <p className="auth-sub">Carregando…</p>
        ) : state === "unauthorized" ? (
          <>
            <h1 className="auth-title">Acesso não autorizado</h1>
            <p className="auth-sub">
              A conta <strong>{user?.email}</strong> não tem permissão para
              acessar esta ferramenta.
            </p>
            <button className="btn primary auth-btn" type="button" onClick={signOut}>
              Sair e trocar de conta
            </button>
          </>
        ) : (
          <>
            <h1 className="auth-title">Acesso restrito</h1>
            <p className="auth-sub">
              Entre com a conta Google autorizada para acessar a calculadora e o
              histórico de vendas.
            </p>
            <button className="btn primary auth-btn" type="button" onClick={signIn}>
              Entrar com Google
            </button>
          </>
        )}

        {error ? <div className="auth-error">{error}</div> : null}
      </div>
    </div>
  );
}
