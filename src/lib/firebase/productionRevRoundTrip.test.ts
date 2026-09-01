import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentData } from "firebase/firestore";

// TD-026 — "cada produto só pode ser produzido para o estoque UMA vez".
//
// ⚠ Este teste NÃO é unitário DE PROPÓSITO, e a razão é o próprio defeito: as
// funções puras estavam certas isoladamente (o payload tinha as camadas certas,
// o custo certo, o saldo certo) e a produção mesmo assim era recusada. O que
// quebrava só existe no CICLO — gravar, o banco incrementar o `rev`, RELER, e
// planejar a gravação seguinte sobre o doc relido. Um teste sobre
// `addProductionLayers` sozinho passa com o bug dentro.
//
// Então o ciclo é o que se monta aqui: um Firestore de mentira em memória, e por
// cima dele o repositório de VERDADE (`saveProduction`/`removeProduction`, com o
// `lerEConferirRevs` real) e os serializadores de VERDADE nos dois sentidos. O
// que é falso é só o SDK.

type Store = Map<string, DocumentData>;

const { store } = vi.hoisted(() => ({ store: new Map() as Store }));

vi.mock("./client", () => ({ db: { __fake: true }, auth: {} }));

vi.mock("firebase/firestore", () => {
  type Ref = { path: string; __kind: "doc" | "collection" };
  const isRef = (v: unknown): v is Ref =>
    typeof v === "object" && v !== null && "__kind" in v;

  const doc = (base: unknown, ...segments: string[]) => {
    const prefix = isRef(base) ? base.path : "";
    const path = [prefix, ...segments].filter(Boolean).join("/");
    return { path, __kind: "doc" as const };
  };
  const snapshot = (path: string) => {
    const data = store.get(path);
    return {
      id: path.split("/").pop() ?? "",
      exists: () => data !== undefined,
      data: () => data,
    };
  };

  return {
    collection: (_db: unknown, path: string) => ({
      path,
      __kind: "collection" as const,
    }),
    doc,
    getDoc: async (ref: Ref) => snapshot(ref.path),
    deleteDoc: async (ref: Ref) => void store.delete(ref.path),
    setDoc: async (ref: Ref, data: DocumentData) =>
      void store.set(ref.path, data),
    // A transação: as escritas ficam em ESPERA até o corpo terminar sem lançar.
    // É o que faz "nada foi gravado" ser verificável — se o `lerEConferirRevs`
    // recusar, o store tem de sair intacto.
    runTransaction: async (
      _db: unknown,
      body: (tx: unknown) => Promise<unknown>,
    ) => {
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: Ref) => snapshot(ref.path),
        set: (ref: Ref, data: DocumentData) =>
          pending.push(() => void store.set(ref.path, data)),
        update: (ref: Ref, patch: DocumentData) =>
          pending.push(
            () => void store.set(ref.path, { ...store.get(ref.path), ...patch }),
          ),
        delete: (ref: Ref) => pending.push(() => void store.delete(ref.path)),
      };
      const out = await body(tx);
      pending.forEach((write) => write());
      return out;
    },
    addDoc: async () => {
      throw new Error("addDoc não é usado neste teste");
    },
    getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
    limit: () => ({}),
    onSnapshot: () => () => {},
    orderBy: () => ({}),
    query: () => ({}),
    where: () => ({}),
  };
});

const { saveProduction, removeProduction } = await import(
  "./productionRepository"
);
const { toFinishedGood } = await import("./finishedGoodsRepository");
const { toStockFilament } = await import("./stockRepository");
const { EstoqueDesatualizadoError } = await import("./revGuard");
const { addProductionLayers, finishedGoodToPayload, removeEventLayers } =
  await import("@/features/pricing-calculator/lib/finishedGoods");
const { planProduction, reverseProduction } = await import(
  "@/features/pricing-calculator/lib/production"
);

import type {
  FilamentUsage,
  ProductionFilament,
  FinishedGood,
  ProductionEvent,
  ProductionPayload,
  StockFilament,
} from "@/features/pricing-calculator/types";

const PRODUTO = "prod-sonda";
const COR = "cor-laranja";
const GRAMAS = 40;
const CUSTO = 15.75;

// A cor como o Estoque a entrega: um rolo com 1403 g restantes (o mesmo número
// do banco de produção quando a varredura AUD-13 pegou o defeito).
function semearCor() {
  store.set(`estoque/${COR}`, {
    material: "PLA",
    brand: "Voolt",
    colorName: "Laranja",
    minG: 0,
    archived: false,
    rolls: [
      {
        id: "rolo-1",
        purchaseDate: 1,
        initialG: 1000,
        remainingG: 1403,
        pricePerKg: 100,
      },
    ],
    adjustments: [],
    createdAt: 1,
    rev: 7,
  });
}

const lerCor = (): StockFilament =>
  toStockFilament(COR, store.get(`estoque/${COR}`)!);

const lerAcabado = (): FinishedGood | null => {
  const data = store.get(`acabados/${PRODUTO}`);
  return data ? toFinishedGood(PRODUTO, data) : null;
};

const saldoG = (color: StockFilament) =>
  color.rolls.reduce((sum, roll) => sum + roll.remainingG, 0);

// A cor como a TELA a tem (entrada do planejamento).
const filamentosForm = (): FilamentUsage[] => [
  { filamentId: COR, colorName: "Laranja", pricePerKg: 100, totalG: GRAMAS },
];

// A mesma cor já CONGELADA no evento: AUD-14 [D9] — no documento o preço é o de
// CADASTRO, e o nome do campo passou a dizer isso (o custo real é FIFO e mora no
// `frozenBreakdown.material`).
const filamentos = (): ProductionFilament[] => [
  { filamentId: COR, colorName: "Laranja", catalogPricePerKg: 100, totalG: GRAMAS },
];

const eventoPayload = (
  stockMoves: ProductionPayload["stockMoves"],
  submissionId = "sub-1",
): ProductionPayload => ({
  at: 1000,
  outcome: "estoque",
  mode: "real",
  productId: PRODUTO,
  productName: "ZZ AUDIT sonda",
  submissionId,
  machineId: "a1",
  machineName: "A1",
  printHours: 1,
  filaments: filamentos(),
  frozenCost: CUSTO,
  stockMoves,
  createdAt: 1000,
});

/**
 * Uma submissão inteira da `/producao` com desfecho `estoque`, montada como a
 * tela monta: LÊ o estado atual do banco, planeja em cima dele e grava.
 */
async function produzir(eventId: string) {
  const plano = planProduction(filamentosForm(), [lerCor()], eventId, "real");
  const acabado = addProductionLayers(
    lerAcabado(),
    PRODUTO,
    "ZZ AUDIT sonda",
    [{ name: "ZZ AUDIT sonda", qty: 1, unitCost: CUSTO }],
    eventId,
    1000,
  );
  await saveProduction(
    [{ id: eventId, payload: eventoPayload(plano.moves, eventId) }],
    plano.colorUpdates,
    { productId: PRODUTO, payload: acabado },
  );
}

/** O "Excluir e estornar" da `/producao`, no mesmo molde. */
async function excluirEEstornar(eventId: string) {
  const evento = store.get(`producao/${eventId}`) as unknown as ProductionEvent;
  const cores = reverseProduction(evento.stockMoves, [lerCor()]);
  await removeProduction([eventId], cores, {
    productId: PRODUTO,
    payload: finishedGoodToPayload(removeEventLayers(lerAcabado()!, eventId)),
  });
}

describe("TD-026 — produzir o mesmo produto duas vezes, e desfazer", () => {
  beforeEach(() => {
    store.clear();
    semearCor();
  });

  it("a SEGUNDA produção do mesmo produto grava — era ela que era recusada", async () => {
    await produzir("ev-1");
    // 1ª produção: o doc do acabado nasce (rev 0 → 1) e a cor cede 40 g.
    expect(lerAcabado()!.rev).toBe(1);
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS);

    // A 2ª planeja sobre o doc RELIDO, que agora está na versão 1. Com o `rev`
    // ficando para trás na remontagem, aqui era `EstoqueDesatualizadoError` —
    // dizendo que "outra aba" tinha mexido, o que nunca tinha acontecido.
    await produzir("ev-2");

    const acabado = lerAcabado()!;
    expect(acabado.rev).toBe(2);
    expect(acabado.skus).toHaveLength(1);
    expect(acabado.skus[0].layers.map((l) => l.sourceEventId)).toEqual([
      "ev-1",
      "ev-2",
    ]);
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS * 2);
    expect(store.has("producao/ev-1")).toBe(true);
    expect(store.has("producao/ev-2")).toBe(true);
  });

  it("a TERCEIRA também — não é o par 1ª/2ª que é especial, é a versão", async () => {
    await produzir("ev-1");
    await produzir("ev-2");
    await produzir("ev-3");
    expect(lerAcabado()!.skus[0].layers).toHaveLength(3);
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS * 3);
  });

  it("'Excluir e estornar' apaga o evento, a camada E devolve as gramas", async () => {
    await produzir("ev-1");
    await produzir("ev-2");

    await excluirEEstornar("ev-1");

    expect(store.has("producao/ev-1")).toBe(false);
    const acabado = lerAcabado()!;
    expect(acabado.skus[0].layers.map((l) => l.sourceEventId)).toEqual(["ev-2"]);
    expect(acabado.rev).toBe(3);
    // O caso do banco de produção: 1403 → 1353 com as duas sondas no ar, e a
    // exclusão das duas tem de reencontrar o 1403.
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS);
    await excluirEEstornar("ev-2");
    expect(saldoG(lerCor())).toBe(1403);
    expect(lerAcabado()!.skus[0].layers).toHaveLength(0);
  });

  it("produzir DEPOIS de excluir tudo segue funcionando (o doc existe, vazio)", async () => {
    await produzir("ev-1");
    await excluirEEstornar("ev-1");
    await produzir("ev-2");
    expect(lerAcabado()!.skus[0].layers).toHaveLength(1);
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS);
  });

  it("a trava CONTINUA travando: plano calculado sobre versão velha é recusado", async () => {
    // O contraponto obrigatório — o conserto não podia ser "parar de conferir".
    // Aqui a 2ª gravação usa o acabado lido ANTES da 1ª, que é exatamente o caso
    // real de duas abas abertas.
    const fotoVelha = lerAcabado(); // null: o doc ainda não existe
    await produzir("ev-1");

    const plano = planProduction(filamentosForm(), [lerCor()], "ev-2", "real");
    const payloadVelho = addProductionLayers(
      fotoVelha,
      PRODUTO,
      "ZZ AUDIT sonda",
      [{ name: "ZZ AUDIT sonda", qty: 1, unitCost: CUSTO }],
      "ev-2",
      1000,
    );
    await expect(
      saveProduction(
        [{ id: "ev-2", payload: eventoPayload(plano.moves) }],
        plano.colorUpdates,
        { productId: PRODUTO, payload: payloadVelho },
      ),
    ).rejects.toThrow(EstoqueDesatualizadoError);

    // E recusar é recusar INTEIRO: sem evento, sem camada nova, sem baixa.
    expect(store.has("producao/ev-2")).toBe(false);
    expect(lerAcabado()!.skus[0].layers).toHaveLength(1);
    expect(saldoG(lerCor())).toBe(1403 - GRAMAS);
  });
});
