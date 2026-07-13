"use client";

import { useEffect, useRef, useState } from "react";
import {
  persistFixedCostRate,
  subscribeFixedCostRate,
} from "@/lib/firebase/businessSettingsRepository";
import { DEFAULT_FIXED_COSTS } from "../constants";
import type { FixedCostRate } from "../types";

// Taxa padrão derivada do DEFAULT_FIXED_COSTS (só os campos de taxa, sem os
// toggles enabled/markupOnFixed, que são por-produto).
const DEFAULT_RATE: FixedCostRate = {
  rent: DEFAULT_FIXED_COSTS.rent,
  other: DEFAULT_FIXED_COSTS.other,
  machines: DEFAULT_FIXED_COSTS.machines,
  hoursDay: DEFAULT_FIXED_COSTS.hoursDay,
  daysMonth: DEFAULT_FIXED_COSTS.daysMonth,
};

/**
 * Taxa de custo fixo do negócio, persistida no Firestore (config/negocio) e
 * compartilhada entre aparelhos (TD-001). Antes disso, cada tela usava o default
 * em memória e o preço divergia entre calculadora, orçamento e vendas.
 */
export function useBusinessSettings() {
  const [fixedCostRate, setFixedCostRate] =
    useState<FixedCostRate>(DEFAULT_RATE);
  const seededRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeFixedCostRate(
      (next) => {
        if (next === null) {
          // Doc ainda não existe → semeia com o default (uma vez).
          if (!seededRef.current) {
            seededRef.current = true;
            void persistFixedCostRate(DEFAULT_RATE);
          }
          return;
        }
        setFixedCostRate(next);
      },
      () => {
        // Erro ao ler (offline/regras) → mantém o default local.
      },
    );
    return unsubscribe;
  }, []);

  function saveFixedCostRate(patch: Partial<FixedCostRate>) {
    setFixedCostRate((current) => {
      const next = { ...current, ...patch };
      void persistFixedCostRate(next);
      return next;
    });
  }

  return { fixedCostRate, saveFixedCostRate };
}
