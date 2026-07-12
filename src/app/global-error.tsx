"use client";

// Error boundary GLOBAL: só dispara se o próprio layout raiz quebrar (caso raro).
// Como ele SUBSTITUI o layout, precisa renderizar <html>/<body> próprios e não
// pode depender do globals.css/fontes — por isso os estilos são inline, no tema
// escuro do app. Só fica ativo em produção.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f1a",
          color: "#e7e7ef",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.8, margin: "0 0 20px" }}>
            Ocorreu um erro inesperado ao carregar o aplicativo. Seus dados estão
            salvos — tente novamente.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: "#ff6b35",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
          {error.digest ? (
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.5 }}>
              Código: {error.digest}
            </div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
