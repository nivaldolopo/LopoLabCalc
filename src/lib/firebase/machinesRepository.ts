import {
  doc,
  onSnapshot,
  runTransaction,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import { ErroAutoExplicativo, withWriteTimeout } from "@/lib/errors";
import type { Machine } from "@/features/pricing-calculator/types";
import { defaultMaintenanceForId } from "@/features/pricing-calculator/constants";

// As máquinas ficam num único documento (a lista é editada como um todo na modal).
const machinesDoc = doc(db, "config", "machines");

function toMachine(data: DocumentData): Machine {
  const id = String(data.id ?? "");
  // Docs anteriores ao recurso não têm o campo → semeia o default pesquisado.
  // Valor explícito (inclusive 0) é respeitado.
  const maintenancePerHour =
    data.maintenancePerHour === undefined || data.maintenancePerHour === null
      ? defaultMaintenanceForId(id)
      : Number(data.maintenancePerHour) || 0;

  return {
    id,
    name: data.name ?? "",
    price: Number(data.price) || 0,
    lifeHours: Number(data.lifeHours) || 0,
    watts: Number(data.watts) || 0,
    maintenancePerHour,
    // [FROTA] Fase 2 — o peso na taxa de frota (%). Doc anterior à fase não tem
    // o campo e vale 0: a frota inteira a zero cai em MÉDIA SIMPLES, que é o
    // ponto de partida honesto — semear 30/40/30 aqui seria martelar no código
    // uma decisão de negócio que se edita em "Gerenciar Máquinas".
    // Negativo é saneado no `resolveFleet` (`weightOf`), junto do dado do form.
    weight: Number(data.weight) || 0,
  };
}

// AUD-18 — a trava de concorrência deste documento, medida faltando.
//
// `config/machines` é COMPARTILHADO e em tempo real, e era o único doc com a
// forma clássica do TD-022 (lista inteira recalculada no cliente e gravada por
// cima) sem o contador `rev` que `vendas`, `producao` e `estoque` já usam. O
// modal "Gerenciar Máquinas" segura um RASCUNHO de propósito — atualizar o que
// o dono está digitando seria pior —, então a janela de perda é o tempo todo em
// que ele fica aberto.
//
// Reproduzido na AUD-18: com o fundo da tela já mostrando o nome novo que o
// outro dispositivo gravou e o rascunho ainda mostrando o antigo, salvar
// apagou a alteração do outro lado — sem aviso em nenhuma das duas telas.
//
// O conselho aqui é OUTRO que o do estoque (por isso a frase é própria): não há
// "refazer sobre o saldo atual", há reabrir o diálogo sobre a lista atual.
export class MaquinasDesatualizadasError extends ErroAutoExplicativo {
  constructor() {
    super(
      "A lista de máquinas mudou em outro dispositivo (ou em outra aba) " +
        "enquanto este diálogo estava aberto. Nada foi gravado — feche e " +
        "reabra “Gerenciar Máquinas” para editar sobre a lista atual, senão a " +
        "alteração do outro lado seria apagada.",
    );
    this.name = "MaquinasDesatualizadasError";
  }
}

/**
 * A regra da trava, pura e testável: devolve a versão a gravar, ou recusa.
 *
 * Documento sem `rev` (o de antes desta fase) vale 0 — logo a primeira gravação
 * de cada tela casa com o `revAtual` 0 que o `subscribeMachines` entrega, e não
 * há migração a fazer.
 */
export function proximaRevDeMaquinas(atual: number, esperado: number): number {
  if (atual !== esperado) throw new MaquinasDesatualizadasError();
  return atual + 1;
}

/**
 * Escuta as máquinas em tempo real. Chama `onMachines(null, 0)` quando o
 * documento ainda não existe (para o chamador semear/migrar).
 *
 * A `rev` sai JUNTO da lista de propósito: é a versão contra a qual aquele
 * conjunto de máquinas foi lido, e gravar exige devolvê-la.
 */
export function subscribeMachines(
  onMachines: (machines: Machine[] | null, rev: number) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    machinesDoc,
    (snapshot) => {
      if (!snapshot.exists()) {
        onMachines(null, 0);
        return;
      }
      const data = snapshot.data();
      const items = Array.isArray(data.items) ? data.items.map(toMachine) : [];
      onMachines(items, Number(data.rev) || 0);
    },
    (error) => onError(error),
  );
}

export async function persistMachines(
  machines: Machine[],
  revEsperado: number,
): Promise<void> {
  const gravacao = runTransaction(db, async (tx) => {
    // Leitura DENTRO da transação: é o que torna a conferência atômica com a
    // escrita. Doc ausente conta como versão 0 (a primeira semeadura).
    const atual = await tx.get(machinesDoc);
    const rev = proximaRevDeMaquinas(
      atual.exists() ? Number(atual.data().rev) || 0 : 0,
      revEsperado,
    );
    tx.set(machinesDoc, {
      items: machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        price: machine.price,
        lifeHours: machine.lifeHours,
        watts: machine.watts,
        maintenancePerHour: machine.maintenancePerHour,
        weight: machine.weight ?? 0,
      })),
      rev,
    });
  });
  await withWriteTimeout(gravacao);
}
