"use client";

// Error boundary de segmento (App Router): se qualquer componente da página
// quebrar em runtime, o Next renderiza isto no lugar — evita a "tela branca".
// O layout raiz (AuthGate etc.) continua montado; erros DELE caem no
// global-error.tsx. Estilizado com as classes já existentes no globals.css.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga para diagnóstico (o digest ajuda a rastrear em produção).
    console.error(error);
  }, [error]);

  return (
    <main className="wrap">
      <div
        className="app-error"
        role="alert"
        style={{ fontSize: 14, padding: "16px 18px", marginTop: 24 }}
      >
        <strong>⚠️ Algo deu errado.</strong> Ocorreu um erro inesperado ao
        carregar esta tela. Seus dados estão salvos — tente novamente.
        {error.digest ? (
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
            Código: {error.digest}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="btn primary"
          type="button"
          onClick={reset}
          style={{ flex: "0 0 auto" }}
        >
          Tentar novamente
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Recarregar página
        </button>
      </div>
    </main>
  );
}
