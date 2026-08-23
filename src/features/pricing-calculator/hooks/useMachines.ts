"use client";

import { useEffect, useRef, useState } from "react";
import {
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

  useEffect(() => {
    const unsubscribe = subscribeMachines(
      (nextMachines) => {
        if (nextMachines === null) {
          // Documento ainda não existe → semeia (migrando do localStorage, se houver).
          if (!seededRef.current) {
            seededRef.current = true;
            const seed = readLocalMachines() ?? cloneMachines(DEFAULT_MACHINES);
            setMachines(seed);
            void persistMachines(seed);
          }
          return;
        }
        const resolved = nextMachines.length
          ? nextMachines
          : cloneMachines(DEFAULT_MACHINES);
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
  ): Promise<string | null> {
    try {
      guardOnline();
    } catch (err) {
      return errorMessage(err);
    }
    const normalized = nextMachines.length
      ? cloneMachines(nextMachines)
      : cloneMachines(DEFAULT_MACHINES);
    setMachines(normalized);
    writeLocalMachines(normalized);
    try {
      await persistMachines(normalized);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  return { machines, saveMachines };
}
