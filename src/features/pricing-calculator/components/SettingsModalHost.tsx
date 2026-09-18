"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { SettingsModal, type SettingsTab } from "./SettingsModal";

type OpenOptions = {
  tab?: SettingsTab;
  // A entrada do registro que o "ver quais" do aviso pós-fato quer abrir já —
  // sem `tab` explícito, ela força a aba "Alterações de preço".
  entrada?: string;
};

type SettingsModalControls = {
  openSettings: (options?: OpenOptions) => void;
};

const SettingsModalContext = createContext<SettingsModalControls | null>(null);

export function useSettingsModal(): SettingsModalControls {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error("useSettingsModal só funciona dentro do SettingsModalProvider");
  }
  return ctx;
}

/**
 * [FEAT-12] peça 4 — a casa do `SettingsModal`, montada UMA vez na raiz
 * (`layout.tsx`) para que o ⚙ do `PageHeader` (em toda página) e o "ver
 * quais" do `RepriceNotice` (nas portas do estoque) abram o MESMO modal sem
 * navegar. O modal só monta de verdade — e só aí assina `useMachines`,
 * `useFees` etc. — quando `openSettings` é chamado; fechado, o Provider é só
 * o Context.
 */
export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    tab: SettingsTab;
    entrada: string | null;
  }>({ open: false, tab: "maquinas", entrada: null });

  function openSettings(options: OpenOptions = {}) {
    setState({
      open: true,
      tab: options.tab ?? (options.entrada ? "alteracoes" : "maquinas"),
      entrada: options.entrada ?? null,
    });
  }

  function close() {
    setState((current) => ({ ...current, open: false }));
  }

  return (
    <SettingsModalContext.Provider value={{ openSettings }}>
      {children}
      {state.open ? (
        <SettingsModal initialTab={state.tab} entrada={state.entrada} onClose={close} />
      ) : null}
    </SettingsModalContext.Provider>
  );
}
