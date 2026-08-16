"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
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
  { href: "/catalogo", label: "Catálogo", emoji: "📚" },
  { href: "/vendas", label: "Vendas", emoji: "🧾" },
  { href: "/orcamento", label: "Orçamento", emoji: "📄" },
  { href: "/maquinas", label: "Impressoras", emoji: "🖨️" },
  { href: "/estoque", label: "Estoque", emoji: "📦" },
  { href: "/producao", label: "Produção", emoji: "🏭" },
] as const;

// Barra de navegação compartilhada por todas as páginas. É uma linha própria,
// independente do brand — assim as abas ocupam SEMPRE a mesma posição, sem
// mudar de lugar ao trocar de página. Ações da página descem para baixo dela.
//
// UX-14 (celular): o MESMO markup vira painel lateral abaixo de 760px — a
// `.navbar-bar` sai do fluxo e a `.navbar-mobile-head` (nome da página + botão
// de abrir) fica no lugar dela. Medido antes: os 7 destinos quebravam em 4
// linhas de 2 + tema/sair numa quinta, 227px de barra, e o 1º campo do
// formulário só começava aos 421px = 50,2% da tela.
export function NavBar({ theme, onToggleTheme, children }: NavBarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeLabel =
    NAV_ITEMS.find((item) => item.href === pathname)?.label ?? "Menu";

  // Escape fecha; enquanto aberto, o fundo não rola (a gaveta é que rola).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <nav
      className={`navbar${open ? " is-open" : ""}`}
      aria-label="Navegação principal"
    >
      {/* Só existe no celular (display:none no desktop): a linha de ~44px que
          substitui a barra de 227px quando a gaveta está fechada. */}
      <div className="navbar-mobile-head">
        <span className="navbar-current">{activeLabel}</span>
        <button
          className="navbar-toggle"
          type="button"
          aria-label="Abrir menu de navegação"
          aria-expanded={open}
          aria-controls="navbar-panel"
          onClick={() => setOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Fundo escurecido da gaveta. z-index acima do .back-to-top e abaixo do
          overlay de modal — cobrir e bloquear o resto sai de graça daí. */}
      <div
        className="navbar-backdrop"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="navbar-bar" id="navbar-panel">
        <button
          className="navbar-close"
          type="button"
          aria-label="Fechar menu de navegação"
          onClick={() => setOpen(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>

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
                // Fecha a gaveta ao navegar. É por link, e não um efeito no
                // `pathname`, porque setState dentro de effect é erro de lint
                // aqui (react-hooks/set-state-in-effect).
                onClick={() => setOpen(false)}
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
