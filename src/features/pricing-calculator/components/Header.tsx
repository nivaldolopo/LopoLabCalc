"use client";

import { Printer } from "lucide-react";
import type { CloudStatus } from "../types";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { PageIntro } from "./PageIntro";

type HeaderProps = {
  theme: "dark" | "light";
  status: CloudStatus;
  onToggleTheme: () => void;
};

// UX-33 — o cabeçalho da calculadora virou um invólucro fino: `PageHeader` +
// `NavBar` + `PageIntro`. O que sobrou de próprio daqui é o título, que é o
// botão da marca (recarrega e limpa os campos) em vez de um texto.
export function Header({ theme, status, onToggleTheme }: HeaderProps) {
  return (
    <>
      <PageHeader
        icon={<Printer size={18} />}
        title={
          <button
            type="button"
            className="brand-reset"
            onClick={() => window.location.reload()}
            title="Recarregar e limpar os campos"
          >
            Lopo Lab <span>✦</span>
          </button>
        }
        meta="Calculadora de Preço — Impressão 3D"
        status={status}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <NavBar />
      <PageIntro>
        Material, energia, desgaste de máquina, mão de obra e custos fixos do
        quiosque — tudo em uma única ferramenta.
      </PageIntro>
    </>
  );
}
