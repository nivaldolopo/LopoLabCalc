"use client";

import { useEffect, useRef, useState } from "react";
import {
  persistEnergyTariff,
  persistFixedCostRate,
  subscribeBusinessSettings,
} from "@/lib/firebase/businessSettingsRepository";
import { errorMessage, guardOnline } from "@/lib/errors";
import { DEFAULT_ENERGY_TARIFF, DEFAULT_FIXED_COSTS } from "../constants";
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
 * Configurações do negócio, persistidas no Firestore (config/negocio) e
 * compartilhadas entre aparelhos (TD-001): a taxa de custo fixo e, desde a
 * frente 2 (2026-09-17), a tarifa de energia GLOBAL (`energyTariff`, R$/kWh —
 * era por produto). Antes disso, cada tela usava o default em memória e o
 * preço divergia entre calculadora, orçamento e vendas.
 *
 * ⚠ As duas semeiam de forma INDEPENDENTE: um doc que já tem `fixedCosts` mas
 * ainda não tem `energyTariff` (escrito antes da frente 2) semeia só o campo
 * que falta, sem regravar a taxa de custo fixo já em vigor.
 */
export function useBusinessSettings() {
  const [fixedCostRate, setFixedCostRate] =
    useState<FixedCostRate>(DEFAULT_RATE);
  const [energyTariff, setEnergyTariff] = useState<number>(DEFAULT_ENERGY_TARIFF);
  // TD-029: a última falha de gravação, para a tela poder dizer. `null` = ok.
  const [error, setError] = useState<string | null>(null);
  const seededRateRef = useRef(false);
  const seededTariffRef = useRef(false);
  // O valor corrente também vive num ref: `saveFixedCostRate` recebe um PATCH e
  // o merge precisa acontecer FORA do updater de estado — gravar de dentro dele
  // é efeito colateral em função que o React pode chamar duas vezes.
  const rateRef = useRef<FixedCostRate>(DEFAULT_RATE);

  useEffect(() => {
    const unsubscribe = subscribeBusinessSettings(
      (next) => {
        if (next === null) {
          // Doc ainda não existe → semeia os dois defaults (uma vez).
          if (!seededRateRef.current) {
            seededRateRef.current = true;
            seededTariffRef.current = true;
            void (async () => {
              try {
                guardOnline();
                await persistFixedCostRate(DEFAULT_RATE);
                await persistEnergyTariff(DEFAULT_ENERGY_TARIFF);
              } catch (err) {
                // Não semeou de verdade: libera a próxima tentativa (o snapshot
                // volta a chamar quando a conexão voltar) e conta o motivo, em
                // vez de deixar o app achando que o doc compartilhado existe.
                seededRateRef.current = false;
                seededTariffRef.current = false;
                setError(errorMessage(err));
              }
            })();
          }
          return;
        }
        rateRef.current = next.fixedCostRate;
        setFixedCostRate(next.fixedCostRate);
        if (next.energyTariff === null) {
          // Doc existe (de antes da frente 2) mas sem a tarifa → semeia só ela.
          if (!seededTariffRef.current) {
            seededTariffRef.current = true;
            void (async () => {
              try {
                guardOnline();
                await persistEnergyTariff(DEFAULT_ENERGY_TARIFF);
              } catch (err) {
                seededTariffRef.current = false;
                setError(errorMessage(err));
              }
            })();
          }
        } else {
          setEnergyTariff(next.energyTariff);
        }
      },
      () => {
        // Erro ao ler (offline/regras) → mantém o default local.
      },
    );
    return unsubscribe;
  }, []);

  /**
   * TD-029 — o painel de custo fixo chama isto só ao APLICAR (via RepriceGate),
   * não a cada tecla. Molde do `saveFees` (TD-020): a falha NÃO é lançada, vira
   * o `error`, que o painel mostra.
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

  /** Grava a tarifa de energia GLOBAL — chamada só ao APLICAR (RepriceGate). */
  async function saveEnergyTariff(next: number) {
    setEnergyTariff(next);
    try {
      guardOnline();
      await persistEnergyTariff(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return {
    fixedCostRate,
    saveFixedCostRate,
    energyTariff,
    saveEnergyTariff,
    error,
  };
}
