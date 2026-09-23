"use client";

import { useEffect, useRef, useState } from "react";
import {
  persistEnergyTariff,
  persistFixedCostRate,
  seedBusinessSettings,
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

// [W2] O que a tela diz quando o que está nela é o PADRÃO do código, e não o
// custo fixo/tarifa do negócio. Antes, erro de leitura era um `() => {}`: as
// 7 rotas precificavam pelo padrão sem nada na tela contar.
const SEM_LEITURA =
  "Não foi possível ler o custo fixo e a tarifa de energia do servidor — os " +
  "preços na tela estão usando os valores PADRÃO, não os do negócio.";

/**
 * Configurações do negócio, persistidas no Firestore (config/negocio) e
 * compartilhadas entre aparelhos (TD-001): a taxa de custo fixo e, desde a
 * frente 2 (2026-09-17), a tarifa de energia GLOBAL (`energyTariff`, R$/kWh —
 * era por produto).
 *
 * ⚠ A semeadura é CONDICIONAL no servidor (`seedBusinessSettings`): só grava o
 * campo que o servidor não tem. E não parte de snapshot do cache — um "doc não
 * existe" do cache não é prova de nada [W2].
 */
export function useBusinessSettings() {
  const [fixedCostRate, setFixedCostRate] =
    useState<FixedCostRate>(DEFAULT_RATE);
  const [energyTariff, setEnergyTariff] = useState<number>(DEFAULT_ENERGY_TARIFF);
  // [W3] A versão do doc contra a qual os dois valores acima foram lidos. Vai
  // para o ESTADO (e não para uma ref) pelo motivo do `useMachines`: quem abre
  // uma prévia CAPTURA a versão junto dela; lida na hora de gravar, o snapshot
  // da outra aba já a teria adiantado e a trava passaria batida.
  const [rev, setRev] = useState(0);
  // [W2] Falha de LEITURA (ou de semeadura): a tela está no padrão. `null` = ok.
  // As falhas de GRAVAÇÃO não moram aqui — voltam no retorno do save, para o
  // `RepriceGate` não gravar rastro de mudança que não aconteceu [V1].
  const [error, setError] = useState<string | null>(null);
  const semeandoRef = useRef(false);

  useEffect(() => {
    function semear() {
      if (semeandoRef.current) return;
      semeandoRef.current = true;
      void (async () => {
        try {
          guardOnline();
          await seedBusinessSettings(DEFAULT_RATE, DEFAULT_ENERGY_TARIFF);
        } catch (err) {
          // Não semeou: a tela segue no padrão, e diz. Libera a próxima
          // tentativa (o snapshot volta a chamar quando a conexão voltar).
          setError(`${SEM_LEITURA} (${errorMessage(err)})`);
        } finally {
          semeandoRef.current = false;
        }
      })();
    }

    const unsubscribe = subscribeBusinessSettings(
      (next, revDoServidor, origin) => {
        if (next === null) {
          // Do cache, "não existe" só quer dizer "ainda não sei" — semear aqui
          // regravaria os padrões por cima do valor real [W2]. Espera o
          // servidor, sem aviso: é o estado normal de toda carga a frio, e a
          // falha de verdade chega pelo `onError` ou pela semeadura.
          if (origin.fromCache) return;
          setRev(revDoServidor);
          semear();
          return;
        }
        setRev(revDoServidor);
        setFixedCostRate(next.fixedCostRate);
        setError(null);
        if (next.energyTariff === null) {
          // Doc existe (de antes da frente 2) mas sem a tarifa → semeia só ela.
          if (!origin.fromCache) semear();
        } else {
          setEnergyTariff(next.energyTariff);
        }
      },
      (err) => {
        setError(`${SEM_LEITURA} (${err.message})`);
      },
    );
    return unsubscribe;
  }, []);

  /**
   * Grava a taxa de custo fixo — chamada só ao APLICAR (via `RepriceGate`).
   * Devolve a mensagem de erro, ou `null` se gravou [V1]: era `void`, e o
   * `RepriceGate` gravava o rastro de uma mudança que tinha falhado.
   *
   * O estado local NÃO é adiantado: é o snapshot que traz o valor novo. Uma
   * gravação recusada não pode deixar a tela mostrando um custo fixo que o
   * servidor não tem.
   */
  async function saveFixedCostRate(
    next: FixedCostRate,
    revEsperado: number,
  ): Promise<string | null> {
    try {
      guardOnline();
      await persistFixedCostRate(next, revEsperado);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  /** Grava a tarifa de energia GLOBAL — mesmo contrato do custo fixo. */
  async function saveEnergyTariff(
    next: number,
    revEsperado: number,
  ): Promise<string | null> {
    try {
      guardOnline();
      await persistEnergyTariff(next, revEsperado);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  return {
    fixedCostRate,
    saveFixedCostRate,
    energyTariff,
    saveEnergyTariff,
    rev,
    error,
  };
}
