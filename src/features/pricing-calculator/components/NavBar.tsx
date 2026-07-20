"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

type NavBarProps = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  // Ações específicas da página (ex.: "Nova venda"). Entram numa linha PRÓPRIA
  // abaixo da barra — nunca no meio das abas, que ficam fixas em toda página.
  children?: ReactNode;
};

// Destinos fixos, sempre na mesma ordem em todas as páginas. "Início" é
// navegação limpa para a calculadora (o reset dos campos mora no brand da raiz).
const NAV_ITEMS = [
  { href: "/", label: "Calculadora", emoji: "🧮" },
  { href: "/vendas", label: "Vendas", emoji: "🧾" },
  { href: "/orcamento", label: "Orçamento", emoji: "📄" },
  { href: "/maquinas", label: "Impressoras", emoji: "🖨️" },
  { href: "/estoque", label: "Estoque", emoji: "📦" },
  { href: "/producao", label: "Produção", emoji: "🏭" },
] as const;

// Barra de navegação compartilhada por todas as páginas. É uma linha própria,
// independente do brand — assim as abas ocupam SEMPRE a mesma posição, sem
// mudar de lugar ao trocar de página. Ações da página descem para baixo dela.
export function NavBar({ theme, onToggleTheme, children }: NavBarProps) {
  const pathname = usePathname();

  return (
    <nav className="navbar" aria-label="Navegação principal">
      <div className="navbar-bar">
        <div className="navbar-tabs">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                className="icon-label-button"
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <span aria-hidden="true">{item.emoji}</span> {item.label}
              </Link>
            );
          })}
        </div>
        <div className="navbar-utils">
          <button
            className="icon-label-button"
            type="button"
            onClick={onToggleTheme}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
          <LogoutButton />
        </div>
      </div>
      {children ? <div className="navbar-page-actions">{children}</div> : null}
    </nav>
  );
}
