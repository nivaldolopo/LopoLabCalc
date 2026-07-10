"use client";

import { Moon, Printer, Sun } from "lucide-react";
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
  error: "Erro de conexão",
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
              Lopo Lab <span>+</span>
            </h1>
            <div className="brand-meta">
              <span>Calculadora de Preço - Impressão 3D</span>
              <span className={`cloud-status ${status}`}>
                {statusLabel[status]}
              </span>
            </div>
          </div>
        </div>
        <button
          className="icon-label-button"
          type="button"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Claro" : "Escuro"}
        </button>
      </div>
      <p className="subtitle">
        Material, energia, desgaste de máquina, mão de obra e custos fixos do
        quiosque em uma ferramenta única.
      </p>
    </>
  );
}
