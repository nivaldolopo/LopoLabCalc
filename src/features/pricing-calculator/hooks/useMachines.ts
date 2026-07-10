"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MACHINES, MACHINE_STORAGE_KEY } from "../constants";
import type { Machine } from "../types";

function cloneMachines(machines: Machine[]): Machine[] {
  return machines.map((machine) => ({ ...machine }));
}

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>(() =>
    cloneMachines(DEFAULT_MACHINES),
  );

  useEffect(() => {
    window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(MACHINE_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMachines(parsed);
        }
      } catch {
        setMachines(cloneMachines(DEFAULT_MACHINES));
      }
    }, 0);
  }, []);

  function saveMachines(nextMachines: Machine[]) {
    const normalized = nextMachines.length
      ? cloneMachines(nextMachines)
      : cloneMachines(DEFAULT_MACHINES);
    setMachines(normalized);
    window.localStorage.setItem(MACHINE_STORAGE_KEY, JSON.stringify(normalized));
  }

  return { machines, saveMachines };
}
