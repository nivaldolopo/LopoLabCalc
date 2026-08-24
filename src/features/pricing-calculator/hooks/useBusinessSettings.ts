"use client";

import { useEffect, useRef, useState } from "react";
import {
  persistFixedCostRate,
  subscribeFixedCostRate,
} from "@/lib/firebase/businessSettingsRepository";
import { errorMessage, guardOnline } from "@/lib/errors";
import { DEFAULT_FIXED_COSTS } from "../constants";
import type { FixedCostRate } from "../types";

// Taxa padrão derivada do DEFAULT_FIXED_COSTS (só os campos de taxa, sem o
// toggle `enabled`, que é por-produto).
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
  // TD-029: a última falha de gravação, para a tela poder dizer. `null` = ok.
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);
  // O valor corrente também vive num ref: `saveFixedCostRate` recebe um PATCH e
  // o merge precisa acontecer FORA do updater de estado — gravar de dentro dele
  // é efeito colateral em função que o React pode chamar duas vezes.
  const rateRef = useRef<FixedCostRate>(DEFAULT_RATE);

  useEffect(() => {
    const unsubscribe = subscribeFixedCostRate(
      (next) => {
        if (next === null) {
          // Doc ainda não existe → semeia com o default (uma vez).
          if (!seededRef.current) {
            seededRef.current = true;
            void (async () => {
              try {
                guardOnline();
                await persistFixedCostRate(DEFAULT_RATE);
              } catch (err) {
                // Não semeou de verdade: libera a próxima tentativa (o snapshot
                // volta a chamar quando a conexão voltar) e conta o motivo, em
                // vez de deixar o app achando que o doc compartilhado existe.
                seededRef.current = false;
                setError(errorMessage(err));
              }
            })();
          }
          return;
        }
        rateRef.current = next;
        setFixedCostRate(next);
      },
      () => {
        // Erro ao ler (offline/regras) → mantém o default local.
      },
    );
    return unsubscribe;
  }, []);

  /**
   * TD-029 — os campos de custo fixo chamam isto a CADA TECLA, e o chamador não
   * espera o resultado. Molde do `saveFees` (TD-020): a falha NÃO é lançada
   * (viraria unhandled rejection a cada dígito) — ela vira o `error`, que o
   * painel mostra.
   *
   * O `guardOnline` vem antes do `await` pelo motivo de sempre: offline a
   * Promise do Firestore fica pendente para sempre, e este era o caminho mais
   * caro do app a gravar calado — `config/negocio` alimenta o custo fixo por
   * hora do CATÁLOGO INTEIRO, e a tela mostrava o valor novo dizendo
   * "Sincronizado". O valor local é aplicado do mesmo jeito, senão o campo
   * travaria enquanto se digita.
   */
  async function saveFixedCostRate(patch: Partial<FixedCostRate>) {
    const next = { ...rateRef.current, ...patch };
    rateRef.current = next;
    setFixedCostRate(next);
    try {
      guardOnline();
      await persistFixedCostRate(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return { fixedCostRate, saveFixedCostRate, error };
}
