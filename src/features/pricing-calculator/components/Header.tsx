"use client";

import { Printer } from "lucide-react";
import type { CloudStatus } from "../types";
import { NavBar } from "./NavBar";

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
        <NavBar theme={theme} onToggleTheme={onToggleTheme} />
      </div>
      <p className="subtitle">
        Material, energia, desgaste de máquina, mão de obra e custos fixos do
        quiosque — tudo em uma única ferramenta.
      </p>
    </>
  );
}
