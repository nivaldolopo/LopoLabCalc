"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

type NavBarProps = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  // Ações específicas da página (ex.: "Nova venda"), renderizadas antes dos links.
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

// Barra de navegação compartilhada por todas as páginas. Substitui os
// header-actions hand-rolled (cada página mostrava um subconjunto ad-hoc).
export function NavBar({ theme, onToggleTheme, children }: NavBarProps) {
  const pathname = usePathname();

  return (
    <div className="header-actions">
      {children}
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
      <button className="icon-label-button" type="button" onClick={onToggleTheme}>
        <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        {theme === "dark" ? "Claro" : "Escuro"}
      </button>
      <LogoutButton />
    </div>
  );
}
