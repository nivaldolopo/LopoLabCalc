"use client";

import { useEffect, useRef, useState } from "react";
import {
  MaquinasDesatualizadasError,
  persistMachines,
  subscribeMachines,
} from "@/lib/firebase/machinesRepository";
import {
  DEFAULT_MACHINES,
  MACHINE_STORAGE_KEY,
  defaultMaintenanceForId,
} from "../constants";
import type { Machine } from "../types";
import { errorMessage, guardOnline } from "@/lib/errors";

function cloneMachines(machines: Machine[]): Machine[] {
  return machines.map((machine) => ({ ...machine }));
}

function readLocalMachines(): Machine[] | null {
  try {
    const raw = window.localStorage.getItem(MACHINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as Machine[]).map((machine) => ({
        ...machine,
        maintenancePerHour:
          typeof machine.maintenancePerHour === "number"
            ? machine.maintenancePerHour
            : defaultMaintenanceForId(machine.id),
        // [FROTA] Fase 2 — cache local escrito antes da fase não tem o peso.
        // Mesmo default do repositório: 0 = frota em média simples.
        weight: typeof machine.weight === "number" ? machine.weight : 0,
      }));
    }
  } catch {
    // ignora cache inválido
  }
  return null;
}

function writeLocalMachines(machines: Machine[]) {
  try {
    window.localStorage.setItem(MACHINE_STORAGE_KEY, JSON.stringify(machines));
  } catch {
    // ignora falha de cache local
  }
}

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>(() =>
    cloneMachines(DEFAULT_MACHINES),
  );
  const seededRef = useRef(false);
  // AUD-18 — a versão do doc `config/machines` contra a qual `machines` foi
  // lido. Vai para o ESTADO, e não para uma `ref`, porque quem grava precisa
  // capturá-la junto com o rascunho: lê-la no instante do save é o que a
  // primeira tentativa de correção fez, e aí o snapshot da outra aba já tinha
  // atualizado o número — a conferência passava contra a versão de quem
  // acabara de sobrescrever. É a mesma disciplina do estoque, onde o `esperado`
  // viaja DENTRO do plano (`{...color}`), não é relido na hora de gravar.
  const [rev, setRev] = useState(0);
  // A última lista que o SERVIDOR entregou — o lugar para onde voltar quando a
  // gravação é recusada por versão (ver `saveMachines`).
  const servidorRef = useRef<Machine[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeMachines(
      (nextMachines, revDoServidor) => {
        setRev(revDoServidor);
        if (nextMachines === null) {
          // Documento ainda não existe → semeia (migrando do localStorage, se houver).
          if (!seededRef.current) {
            seededRef.current = true;
            const seed = readLocalMachines() ?? cloneMachines(DEFAULT_MACHINES);
            setMachines(seed);
            void persistMachines(seed, 0);
          }
          return;
        }
        const resolved = nextMachines.length
          ? nextMachines
          : cloneMachines(DEFAULT_MACHINES);
        servidorRef.current = resolved;
        setMachines(resolved);
        writeLocalMachines(resolved);
      },
      () => {
        // Erro ao ler do Firestore (ex.: offline/regras) → fallback local.
        setMachines(readLocalMachines() ?? cloneMachines(DEFAULT_MACHINES));
      },
    );

    return unsubscribe;
  }, []);

  /**
   * TD-020 — grava as máquinas e devolve a MENSAGEM DE ERRO, ou `null` se deu
   * certo. Antes era `void persistMachines(...)`: fire-and-forget, sem tratar
   * erro. Offline isso "fingia que salvou" — o estado local e o localStorage
   * mostravam o valor novo e a escrita ficava enfileirada, sem nada na tela
   * dizendo que o doc compartilhado `config/machines` não tinha mudado.
   *
   * O `guardOnline` vem ANTES de tocar em estado local: offline a Promise do
   * Firestore não resolve nem rejeita (fica pendente para sempre), então quem
   * tenta descobrir a falha esperando o `await` espera para sempre.
   *
   * Quando a escrita falha JÁ ONLINE, o estado local fica com o valor novo de
   * propósito — desfazer o que o dono acabou de digitar surpreende mais do que
   * ajuda. O que não pode é ele não saber, e é isso que o retorno resolve.
   */
  async function saveMachines(
    nextMachines: Machine[],
    revEsperado: number,
  ): Promise<string | null> {
    try {
      guardOnline();
    } catch (err) {
      return errorMessage(err);
    }
    const normalized = nextMachines.length
      ? cloneMachines(nextMachines)
      : cloneMachines(DEFAULT_MACHINES);
    const doServidor = servidorRef.current;
    setMachines(normalized);
    writeLocalMachines(normalized);
    try {
      await persistMachines(normalized, revEsperado);
      return null;
    } catch (err) {
      // AUD-18 — a RECUSA por versão é a exceção à regra do parágrafo acima. Um
      // erro genérico deixa o valor digitado na tela porque desfazê-lo
      // surpreende; aqui não: o servidor tem OUTRA lista, e ficar com o
      // rascunho reprecificaria o catálogo inteiro a partir de uma frota que
      // não existe do lado de lá. E não se perde nada — o rascunho é do modal,
      // que segue aberto com o motivo (TD-020).
      if (err instanceof MaquinasDesatualizadasError && doServidor) {
        setMachines(doServidor);
        writeLocalMachines(doServidor);
      }
      return errorMessage(err);
    }
  }

  return { machines, rev, saveMachines };
}
