"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  createChangeRecord,
  subscribeChangeLog,
} from "@/lib/firebase/changeLogRepository";
import { cloudStatusOf } from "@/lib/cloudStatus";
import { errorMessage, guardOnline } from "@/lib/errors";
import { CHANGES_DISMISSED_KEY, CHANGES_LOCAL_KEY } from "../constants";
import type { ChangeRecord, ChangeRecordPayload, CloudStatus } from "../types";

/**
 * [FEAT-12] — o registro `alteracoes` e o aviso pós-fato que sai dele.
 *
 * Duas coisas moram aqui porque são a mesma: o aviso não tem conteúdo próprio,
 * ele é um recorte do registro. O que o separa é ONDE ele aparece — só no
 * aparelho que FEZ a mudança (dono, 2026-09-08). Os outros ficam com o registro,
 * que é permanente e não interrompe ninguém no meio de outra tarefa.
 *
 * Como o aparelho sabe que a mudança foi dele: ele guarda o id que acabou de
 * gravar. É a única forma — o `by` é o e-mail, e o mesmo dono usa o celular e o
 * desktop. Nada disso é dado de negócio: perder o localStorage só faz o aviso
 * não aparecer, e o registro continua inteiro no Firestore.
 */

// Quantos ids locais o aparelho lembra. O aviso ACUMULA (cadastrar 4 rolos
// seguidos é UMA caixa dizendo "4 alterações"), então o teto só existe para a
// chave não crescer para sempre — 50 é muito mais do que cabe sem dispensar.
const LOCAL_LIMIT = 50;

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // ⚠ Tipo errado se DESCARTA (AUD-16 [E5]): coagir aqui produziria ids
    // "[object Object]" que nunca casam com entrada nenhuma — o aviso sumiria
    // sem dizer por quê.
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Armazenamento bloqueado (aba anônima, navegador travando site data): o
    // aviso deixa de aparecer, e nada mais. Não é caminho de dado.
  }
}

// ---------------------------------------------------------------------------
// Os ids do APARELHO, num armazém module-level
// ---------------------------------------------------------------------------

/**
 * ⚠ Isto NÃO pode ser `useState` dentro do hook, e o motivo foi medido no ar.
 *
 * A `/configuracoes` monta o hook DUAS vezes: uma na página (que lista o
 * registro) e outra dentro do `RepriceGate` (que grava). Com o conjunto em
 * estado local, cada instância tinha a própria cópia e gravava a lista INTEIRA a
 * partir dela — o último a escrever apagava o id que o outro acabara de somar.
 * Medido: duas alterações aplicadas (uma delas o desfazer), UM id guardado, e o
 * aviso dizendo "Uma alteração reprecificou 63 produtos" no lugar de duas.
 *
 * Um armazém único com `useSyncExternalStore` resolve os dois lados: todas as
 * instâncias leem o mesmo valor e são notificadas juntas. E o `getServerSnapshot`
 * dá o conjunto VAZIO na renderização do servidor, que é a resposta certa lá —
 * sem `useEffect`, sem `setState` em efeito (proibido pelo lint aqui).
 */
type IdSet = { locais: string[]; dispensadas: string[] };

const VAZIO: IdSet = { locais: [], dispensadas: [] };

let armazem: IdSet = VAZIO;
let carregado = false;
const ouvintes = new Set<() => void>();

// A referência só muda quando o conteúdo muda — é o contrato do
// `useSyncExternalStore` (devolver objeto novo a cada chamada faz laço infinito).
function lerArmazem(): IdSet {
  if (!carregado) {
    carregado = true;
    armazem = {
      locais: readIds(CHANGES_LOCAL_KEY),
      dispensadas: readIds(CHANGES_DISMISSED_KEY),
    };
  }
  return armazem;
}

function assinarArmazem(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function publicar(proximo: IdSet) {
  armazem = proximo;
  for (const ouvinte of ouvintes) ouvinte();
}

function marcarLocal(id: string) {
  const atual = lerArmazem();
  const locais = [...atual.locais, id].slice(-LOCAL_LIMIT);
  writeIds(CHANGES_LOCAL_KEY, locais);
  publicar({ ...atual, locais });
}

function marcarDispensadas(ids: string[]) {
  const atual = lerArmazem();
  const dispensadas = Array.from(new Set([...atual.dispensadas, ...ids])).slice(
    -LOCAL_LIMIT,
  );
  writeIds(CHANGES_DISMISSED_KEY, dispensadas);
  publicar({ ...atual, dispensadas });
}

export function useChangeLog() {
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const { locais, dispensadas } = useSyncExternalStore(
    assinarArmazem,
    lerArmazem,
    () => VAZIO,
  );

  useEffect(() => {
    const unsubscribe = subscribeChangeLog(
      (next, origin) => {
        setChanges(next);
        // AUD-15 [E4]: "chegou" não é "veio do servidor".
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

  /**
   * Grava uma entrada e a marca como FEITA AQUI. Devolve o id — o desfazer o
   * usa no `undoOf` da entrada que ele mesmo gera.
   *
   * O `guardOnline` vem ANTES do `await` pelo motivo de sempre: offline a
   * Promise do Firestore nem resolve nem rejeita, e quem esperasse por ela
   * esperaria para sempre. Aqui isso importa em dobro — quem chama já gravou a
   * ALAVANCA, e travar no rastro deixaria o botão em "Salvando..." depois de a
   * mudança já ter acontecido.
   */
  const recordChange = useCallback(
    async (payload: ChangeRecordPayload): Promise<string> => {
      guardOnline();
      const id = await createChangeRecord(payload);
      marcarLocal(id);
      return id;
    },
    [],
  );

  // O aviso pendente: o que ESTE aparelho mudou e ainda não dispensou, do mais
  // recente para o mais antigo (a ordem em que a assinatura já entrega).
  const pending = useMemo(() => {
    const meus = new Set(locais);
    const fora = new Set(dispensadas);
    return changes.filter((item) => meus.has(item.id) && !fora.has(item.id));
  }, [changes, locais, dispensadas]);

  /**
   * Dispensa o aviso. A dispensa é POR ENTRADA (dono: "fica até dispensar"), e
   * não um "não mostrar mais" global — a próxima mudança volta a avisar.
   *
   * Dispensar o aviso acumulado dispensa TODAS as entradas que ele resume: era
   * uma caixa só, e deixar metade dela viva faria o aviso reaparecer sozinho
   * com um número menor.
   */
  const dismissPending = useCallback(() => {
    marcarDispensadas(pending.map((item) => item.id));
  }, [pending]);

  return {
    changes,
    status,
    error,
    recordChange,
    pending,
    dismissPending,
    // Para quem quer reportar a falha do rastro sem derrubar a gravação da
    // alavanca (ver `RepriceGate`).
    describeError: errorMessage,
  };
}
