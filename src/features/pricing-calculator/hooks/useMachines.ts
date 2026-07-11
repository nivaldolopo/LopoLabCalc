"use client";

import { useEffect, useRef, useState } from "react";
import {
  persistMachines,
  subscribeMachines,
} from "@/lib/firebase/machinesRepository";
import { DEFAULT_MACHINES, MACHINE_STORAGE_KEY } from "../constants";
import type { Machine } from "../types";

function cloneMachines(machines: Machine[]): Machine[] {
  return machines.map((machine) => ({ ...machine }));
}

function readLocalMachines(): Machine[] | null {
  try {
    const raw = window.localStorage.getItem(MACHINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Machine[];
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

  function saveMachines(nextMachines: Machine[]) {
    const normalized = nextMachines.length
      ? cloneMachines(nextMachines)
      : cloneMachines(DEFAULT_MACHINES);
    setMachines(normalized);
    writeLocalMachines(normalized);
    void persistMachines(normalized);
  }

  return { machines, saveMachines };
}
