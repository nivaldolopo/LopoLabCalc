"use client";

import { useEffect, useState } from "react";
import {
  persistQuoteBusiness,
  subscribeQuoteBusiness,
} from "@/lib/firebase/quoteConfigRepository";
import { errorMessage, guardOnline } from "@/lib/errors";
import { DEFAULT_QUOTE_BUSINESS } from "../constants";
import type { QuoteBusiness } from "../types";

export function useQuoteConfig() {
  const [business, setBusiness] = useState<QuoteBusiness>(
    DEFAULT_QUOTE_BUSINESS,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeQuoteBusiness(
      (next) => {
        if (next) setBusiness(next);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return unsubscribe;
  }, []);

  /**
   * TD-029 — grava os dados do negócio e devolve a MENSAGEM DE ERRO, ou `null`
   * se deu certo (molde do `saveMachines`). Não lança: os quatro campos chamam
   * isto no `onBlur`, sem esperar, e um `throw` viraria unhandled rejection ao
   * sair de um campo offline.
   *
   * O `guardOnline` vem ANTES do `await`: offline a Promise do Firestore não
   * resolve nem rejeita, então quem esperasse o resultado esperaria para sempre.
   * O valor local fica com o que foi digitado de propósito — desfazer surpreende
   * mais do que ajuda; o que não pode é o dono não saber.
   */
  async function saveBusiness(next: QuoteBusiness): Promise<string | null> {
    setBusiness(next);
    try {
      guardOnline();
      await persistQuoteBusiness(next);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  return { business, loaded, saveBusiness };
}
