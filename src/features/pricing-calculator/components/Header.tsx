"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import type { CloudStatus } from "../types";

type HeaderProps = {
  theme: "dark" | "light";
  status: CloudStatus;
  onToggleTheme: () => void;
};

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

export function Header({ theme, status, onToggleTheme }: HeaderProps) {
  return (
    <>
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Printer size={18} />
          </div>
          <div>
            <h1 className="sg">
              <button
                type="button"
                className="brand-reset"
                onClick={() => window.location.reload()}
                title="Recarregar e limpar os campos"
              >
                Lopo Lab <span>✦</span>
              </button>
            </h1>
            <div className="brand-meta">
              <span>Calculadora de Preço — Impressão 3D</span>
              <span className={`cloud-status ${status}`}>
                {statusLabel[status]}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <Link
            className="icon-label-button"
            href="/vendas"
            title="Histórico de vendas"
          >
            <span aria-hidden="true">🧾</span> Vendas
          </Link>
          <button
            className="icon-label-button"
            type="button"
            onClick={onToggleTheme}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
        </div>
      </div>
      <p className="subtitle">
        Material, energia, desgaste de máquina, mão de obra e custos fixos do
        quiosque — tudo em uma única ferramenta.
      </p>
    </>
  );
}
