"use client";

import { useEffect, useState } from "react";
import { guardOnline } from "@/lib/errors";
import {
  removePrintAlias,
  subscribePrintAliases,
} from "@/lib/firebase/printAliasesRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import type { CloudStatus, SavedPrintAlias } from "../types";

// S3 — os apelidos de impressão em tempo real. Lidos pelo catálogo (conflito
// na importação, contagem) e pelo formulário (a lista do produto aberto).
export function usePrintAliases() {
  const [aliases, setAliases] = useState<SavedPrintAlias[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePrintAliases(
      (next, origin) => {
        setAliases(next);
        // AUD-15 [E4]: "chegou" não é "veio do servidor" — ver `cloudStatusOf`.
        setStatus(cloudStatusOf(origin));
        setError(null);
      },
      (nextError) => {
        setStatus("error");
        setError(nextError.message);
      },
    );
    return unsubscribe;
  }, []);

  async function deleteAlias(aliasId: string) {
    guardOnline();
    await removePrintAlias(aliasId);
  }

  return { aliases, status, error, deleteAlias };
}
