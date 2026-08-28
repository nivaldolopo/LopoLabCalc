"use client";

import type { ReactNode } from "react";
import type { CloudStatus } from "../types";
import { LogoutButton } from "./LogoutButton";

type PageHeaderProps = {
  // O `<h1>` da página. É `ReactNode` (e não `string`) por causa da
  // calculadora, onde o título é o botão da marca que recarrega os campos.
  title: ReactNode;
  // A linha discreta abaixo do título ("Histórico de vendas — Lopo Lab").
  meta: ReactNode;
  // Chip de sincronização. Opcional: o /orcamento não assina coleção nenhuma.
  status?: CloudStatus;
  // O quadrado com ícone à esquerda do título. Só a calculadora e a /producao
  // têm — nas outras 5 rotas o título começa na margem.
  icon?: ReactNode;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

// AUD-15 [E4] — "Sincronizado" é uma AFIRMAÇÃO sobre o servidor, e o chip a
// fazia com a rede derrubada. Os dois rótulos novos são os estados em que ela
// não é verdade: `pending` (a escrita local ainda não voltou do servidor) e
// `offline` (o que está na tela veio do cache). Quem os escolhe é o
// `cloudStatusOf`, pelo `metadata` do snapshot — não pelo `navigator.onLine`.
const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  pending: "Gravando...",
  offline: "Sem conexão",
  importing: "Importando...",
  error: "Erro de Conexão",
};

// O rótulo curto cabe no cabeçalho; a consequência não. Ela vai no `title`, que
// aqui é LEGÍTIMO (A11Y-01 proíbe o `title` como único NOME de controle — este
// não é controle, é texto visível, e o `title` só acrescenta).
const statusHint: Partial<Record<CloudStatus, string>> = {
  pending:
    "A gravação saiu daqui mas o servidor ainda não confirmou. Não repita a ação.",
  offline:
    "O servidor do Firestore não responde: o que está na tela veio do cache local e pode estar desatualizado. Nada que você salvar agora entra até a conexão voltar.",
};

// UX-33 — cabeçalho de página, um só. Este bloco estava COPIADO em 7 arquivos
// (as 6 páginas + o Header da calculadora), junto com o mapa `statusLabel`, e
// variava só em título, linha de meta, ícone e presença do chip de status.
//
// Ele também é quem resolve a segunda metade do UX-33: "Escuro" e "Sair" moravam
// na `.navbar-utils`, dentro da barra de navegação, e empurravam os utilitários
// para uma FAIXA PRÓPRIA de ~40px em toda página — uma linha inteira para dois
// botões. Aqui eles sobem para a linha do título, que tem espaço vazio de sobra
// à direita em todas as rotas.
export function PageHeader({
  title,
  meta,
  status,
  icon,
  theme,
  onToggleTheme,
}: PageHeaderProps) {
  return (
    // UX-29 — `<header>` de verdade, não `<div>`: com o `<nav>` da NavBar e o
    // `<main>` das 8 rotas, é o terceiro marco que faltava para a página ter
    // regiões navegáveis. Um arquivo só, porque o UX-33 já unificou as 7 cópias.
    <header className="header">
      <div className="brand">
        {icon ? (
          <div className="logo" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="sg">{title}</h1>
          <div className="brand-meta">
            <span>{meta}</span>
            {status ? (
              <span className={`cloud-status ${status}`} title={statusHint[status]}>
                {statusLabel[status]}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {/* No celular estes dois viram ícone puro e se juntam ao ☰ no canto — o
          rótulo sai por CSS (`.header-utils` no responsive.css), não por
          renderização condicional, para não haver dois nós disputando a mesma
          ordem de tabulação. */}
      <div className="header-utils">
        {/* A11Y-01 — o `title` NÃO é rótulo: ele é só o último recurso do
            cálculo do nome acessível, não sai em toque nenhum e alguns leitores
            de tela o ignoram por configuração. E aqui o botão fica REALMENTE sem
            texto no celular, onde o `.header-utils-label` some por CSS: sobrava
            um emoji `aria-hidden` e mais nada. O `aria-label` nomeia a AÇÃO
            ("mudar para…"), não o estado, e contém a palavra do rótulo visível
            do desktop — WCAG 2.5.3. */}
        <button
          className="icon-label-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"
          }
          title={
            theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"
          }
        >
          {/* ☀️/🌙 continuam emoji de propósito: trocar por lucide é a [DEC-05],
              que o dono deixou FORA desta onda para sair junto do rebrand. */}
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span className="header-utils-label">
            {theme === "dark" ? "Claro" : "Escuro"}
          </span>
        </button>
        <LogoutButton />
      </div>
    </header>
  );
}
