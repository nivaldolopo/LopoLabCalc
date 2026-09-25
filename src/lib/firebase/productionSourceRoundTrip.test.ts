import { describe, expect, it, vi } from "vitest";

// S4 (lote 5 da 3a) — o ROUND-TRIP da origem e dos FATOS crus do evento, campo
// a campo. O bloco `impressao` existe pra análise futura sem migração: se um
// campo dele morrer no serializador, o dado some calado e só aparece meses
// depois, quando alguém tentar calcular algo com ele. O teste é o diff do
// DOCUMENTO (regra do CLAUDE.md), não um número derivado.
//
// Mesmo molde do `frotaFase1RoundTrip`: só o SDK é falso; os serializadores dos
// dois sentidos são os de verdade.

vi.mock("./client", () => ({ db: { __fake: true }, auth: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: () => ({ path: "" }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async () => ({ docs: [] }),
  deleteDoc: async () => {},
  runTransaction: async () => {},
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  limit: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  where: () => ({}),
}));

const { productionToDocument, toProduction } = await import("./productionRepository");

import type { PrintFacts, ProductionPayload } from "@/features/pricing-calculator/types";
import { MANUAL_SOURCE } from "@/features/pricing-calculator/lib/productionPlan";

// Todos os campos preenchidos, e cada um com um valor DIFERENTE do default de
// leitura — um campo que o serializador esquecesse voltaria como null/""/0 e o
// diff acusaria.
const FATOS: PrintFacts = {
  maquina: "X2D Combo",
  serial: "0948AD5A1200123",
  inicio: 1_750_000_000_000,
  fim: 1_750_000_900_000,
  duracaoPlanoS: 5824,
  duracaoRelogioS: 1358,
  status: "cancelada",
  statusCru: "3",
  pesoTotalG: 31.2,
  objetos: [
    { nome: "Assembly", qtd: 2 },
    { nome: "Zipper_pull_1", qtd: 1 },
  ],
  filamentos: [
    {
      corCarregada: "161616",
      corPlanejada: "0A2989",
      material: "PLA",
      g: 30.1,
      ams: 0,
      slot: 2,
      idNaFonte: "GFA00",
    },
    {
      corCarregada: "FFFF00",
      corPlanejada: "FFFFFF",
      material: "PLA",
      g: 1.1,
      ams: 255,
      slot: 0,
      idNaFonte: null,
    },
  ],
  apelido: { fonte: "mw", chave: "1234567", variante: "998877", plate: 2 },
  designId: "1234567",
  titulo: "LL-0042 Quatto face",
  personalizado: false,
};

const evento = (over: Partial<ProductionPayload> = {}): ProductionPayload => ({
  at: 1000,
  outcome: "falha",
  mode: "historico",
  productId: "p1",
  productName: "Quatto face",
  submissionId: "ev1",
  machineId: "x2d",
  machineName: "X2D Combo",
  printHours: 0.4,
  filaments: [],
  frozenCost: 3,
  stockMoves: [],
  unidadesProduzidas: 10,
  unidadesCreditadas: 7,
  origemExterna: { fonte: "bambu", id: "1214307195" },
  fonteDosNumeros: "estimativa",
  imagens: {
    capa: "impressoes/1214307195/capa.png",
    foto: "impressoes/1214307195/foto.jpg",
  },
  impressao: FATOS,
  createdAt: 2000,
  ...over,
});

const idaEVolta = (payload: ProductionPayload) => {
  const { id: _id, ...lido } = toProduction("ev1", productionToDocument(payload));
  void _id;
  return lido;
};

describe("S4 — origem + fatos crus, ida e volta campo a campo", () => {
  it("evento importado completo volta IGUAL", () => {
    expect(idaEVolta(evento())).toEqual(evento());
  });

  it("evento manual: os nulls são gravados EXPLÍCITOS (AUD-02) e voltam null", () => {
    const manual = evento({ ...MANUAL_SOURCE, unidadesCreditadas: 0 });
    const doc = productionToDocument(manual);
    // A chave existe no documento, com null — não sumiu num spread.
    expect(doc).toHaveProperty("origemExterna", null);
    expect(doc).toHaveProperty("imagens", null);
    expect(doc).toHaveProperty("impressao", null);
    expect(doc.fonteDosNumeros).toBe("manual");
    expect(idaEVolta(manual)).toEqual(manual);
  });

  it("fatos com os opcionais vazios: null continua null, lista vazia continua vazia", () => {
    const magro: PrintFacts = {
      ...FATOS,
      serial: null,
      inicio: null,
      fim: null,
      duracaoPlanoS: null,
      duracaoRelogioS: null,
      statusCru: null,
      pesoTotalG: null,
      objetos: [],
      filamentos: [],
      apelido: null,
      designId: null,
      titulo: null,
      personalizado: null,
    };
    const payload = evento({ impressao: magro, imagens: { capa: null, foto: null } });
    expect(idaEVolta(payload)).toEqual(payload);
  });

  it("zero é dado, não ausência: slot 0 / ams 0 / 0 s sobrevivem", () => {
    const zeros: PrintFacts = {
      ...FATOS,
      duracaoRelogioS: 0,
      filamentos: [{ ...FATOS.filamentos[0], ams: 0, slot: 0, g: 0 }],
    };
    const payload = evento({ impressao: zeros });
    expect(idaEVolta(payload).impressao).toEqual(zeros);
  });

  it("documento anterior ao S4 lê como manual, sem origem, 0 unidades", () => {
    const doc = productionToDocument(evento());
    for (const campo of [
      "origemExterna",
      "fonteDosNumeros",
      "imagens",
      "impressao",
      "unidadesProduzidas",
      "unidadesCreditadas",
    ]) {
      delete doc[campo];
    }
    const lido = toProduction("ev1", doc);
    expect(lido.origemExterna).toBeNull();
    expect(lido.fonteDosNumeros).toBe("manual");
    expect(lido.imagens).toBeNull();
    expect(lido.impressao).toBeNull();
    expect(lido.unidadesProduzidas).toBe(0);
    expect(lido.unidadesCreditadas).toBe(0);
  });

  it("origem pela metade (sem id) não vira identidade", () => {
    const doc = productionToDocument(evento());
    doc.origemExterna = { fonte: "bambu", id: "" };
    expect(toProduction("ev1", doc).origemExterna).toBeNull();
  });
});
