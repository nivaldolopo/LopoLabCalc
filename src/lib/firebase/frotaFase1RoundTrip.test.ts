import { describe, expect, it, vi } from "vitest";

// [FROTA] Fase 1 — o ROUND-TRIP dos três campos novos, campo a campo.
//
// ⚠ Por que este arquivo existe separado do `frotaFase1.test.ts`: aquele prova a
// MATEMÁTICA (o preço não muda, a repartição soma certo). Ele passa inteiro com
// um serializador que joga o campo fora — as funções puras nunca chegam perto do
// documento. E é EXATAMENTE aí que este projeto já perdeu dado calado duas
// vezes: o `supplyId` sumindo no save (FORM-01) e o `supplyUpdates` opcional que
// deixava a venda não debitar insumo (AUD-02).
//
// A regra do CLAUDE.md é explícita: campo novo entra em TODOS os lados no mesmo
// commit, e o teste é o diff do DOCUMENTO — não o preço, que não é canário.
//
// O que é falso aqui é só o SDK (mesmo molde do `productionRevRoundTrip`); os
// serializadores dos dois sentidos são os de verdade.

vi.mock("./client", () => ({ db: { __fake: true }, auth: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: () => ({ path: "" }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async () => ({ docs: [] }),
  deleteDoc: async () => {},
  setDoc: async () => {},
  addDoc: async () => {},
  runTransaction: async () => {},
  writeBatch: () => ({ set: () => {}, delete: () => {}, commit: async () => {} }),
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  limit: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  startAfter: () => ({}),
  where: () => ({}),
  serverTimestamp: () => 0,
}));

const { productionToDocument, toProduction } = await import(
  "./productionRepository"
);
const { finishedGoodToDocument, toFinishedGood } = await import(
  "./finishedGoodsRepository"
);
const { saleToDocument, toSale } = await import("./salesRepository");

import type {
  FinishedGoodPayload,
  ProductionPayload,
  SalePayload,
} from "@/features/pricing-calculator/types";

const USO = [
  { machineId: "a1", machineName: "A1 Combo", hours: 4, depreciation: 1.5 },
  { machineId: "x2d", machineName: "X2D Combo", hours: 2, depreciation: 3.25 },
];

// ===========================================================================
// producao — o submissionId
// ===========================================================================

const evento = (over: Partial<ProductionPayload> = {}): ProductionPayload => ({
  at: 1000,
  outcome: "estoque",
  mode: "real",
  productId: "peca",
  productName: "Peça",
  submissionId: "sub-1",
  machineId: "a1",
  machineName: "A1 Combo",
  printHours: 3,
  filaments: [],
  frozenCost: 10,
  stockMoves: [],
  createdAt: 1000,
  ...over,
});

describe("[FROTA] Fase 1 — round-trip do `submissionId`", () => {
  it("o elo do lote sobrevive à ida e à volta", () => {
    const doc = productionToDocument(evento());
    expect(doc.submissionId).toBe("sub-1");
    expect(toProduction("ev-2", doc).submissionId).toBe("sub-1");
  });

  it("o 1º evento aponta para si mesmo, e continua apontando na volta", () => {
    const doc = productionToDocument(evento({ submissionId: "ev-1" }));
    expect(toProduction("ev-1", doc).submissionId).toBe("ev-1");
  });

  it("🔴 documento SEM o campo (anterior à Fase 1) lê como o PRÓPRIO id", () => {
    // Diretriz 7, sem migração. A leitura errada aqui seria `""`, e aí a query
    // de irmãos casaria com TODOS os eventos antigos de uma vez — excluir um
    // apagaria o histórico inteiro. O fallback não é cosmético.
    const { submissionId: _fora, ...antigo } = productionToDocument(evento());
    void _fora;
    expect(toProduction("ev-velho", antigo).submissionId).toBe("ev-velho");
  });

  it("o resto do documento não se mexeu — diff campo a campo", () => {
    const payload = evento();
    const volta = toProduction("ev-1", productionToDocument(payload));
    for (const chave of [
      "at",
      "outcome",
      "mode",
      "productId",
      "productName",
      "machineId",
      "machineName",
      "printHours",
      "frozenCost",
      "createdAt",
    ] as const) {
      expect(volta[chave]).toEqual(payload[chave]);
    }
  });
});

// ===========================================================================
// acabados — a repartição da camada
// ===========================================================================

const acabado = (
  machineUsage?: typeof USO,
): FinishedGoodPayload => ({
  productId: "peca",
  productName: "Peça",
  createdAt: 0,
  skus: [
    {
      colorKey: "azul",
      colorLabel: "Azul",
      name: "Peça",
      layers: [
        {
          id: "ev1__whole",
          at: 1000,
          qty: 4,
          unitCost: 5,
          ...(machineUsage ? { machineUsage } : {}),
          sourceEventId: "ev1",
        },
      ],
    },
  ],
});

describe("[FROTA] Fase 1 — round-trip da repartição na CAMADA", () => {
  it("horas e depreciação por máquina sobrevivem, número a número", () => {
    const doc = finishedGoodToDocument(acabado(USO));
    const volta = toFinishedGood("peca", doc);
    expect(volta.skus[0].layers[0].machineUsage).toEqual(USO);
  });

  it("🔴 camada SEM repartição continua SEM — ausência é o dado, não lista vazia", () => {
    // A distinção decide a conta: ausente = "não sei quem imprimiu" (a venda
    // conta a unidade em `unattributedUnits`); `[]` gravado seria lido como
    // "sei, e não foi ninguém", que credita 0 hora e cala o buraco.
    const doc = finishedGoodToDocument(acabado());
    expect(doc.skus[0].layers[0]).not.toHaveProperty("machineUsage");
    expect(toFinishedGood("peca", doc).skus[0].layers[0]).not.toHaveProperty(
      "machineUsage",
    );
  });

  it("entrada torta no documento é DESCARTADA, não coagida (AUD-16 [E5])", () => {
    const volta = toFinishedGood("peca", {
      productId: "peca",
      productName: "Peça",
      createdAt: 0,
      skus: [
        {
          colorKey: "azul",
          colorLabel: "Azul",
          name: "Peça",
          layers: [
            {
              id: "l1",
              at: 0,
              qty: 1,
              unitCost: 1,
              sourceEventId: "ev1",
              machineUsage: [
                { machineId: {}, hours: 3 }, // sem id utilizável
                { machineId: "a1", machineName: "A1", hours: 2, depreciation: 1 },
              ],
            },
          ],
        },
      ],
    });
    // `String({})` fabricaria a máquina "[object Object]" — um id que não existe
    // com cara de id que existe, exatamente o defeito do [E5].
    expect(volta.skus[0].layers[0].machineUsage).toEqual([
      { machineId: "a1", machineName: "A1", hours: 2, depreciation: 1 },
    ]);
  });

  it("o resto da camada não se mexeu", () => {
    const volta = toFinishedGood("peca", finishedGoodToDocument(acabado(USO)));
    const camada = volta.skus[0].layers[0];
    expect(camada.id).toBe("ev1__whole");
    expect(camada.qty).toBe(4);
    expect(camada.unitCost).toBe(5);
    expect(camada.sourceEventId).toBe("ev1");
  });
});

// ===========================================================================
// vendas — machineUsage + unattributedUnits
// ===========================================================================

const venda = (over: Partial<SalePayload> = {}): SalePayload => ({
  reciboId: "r1",
  saleDate: 1000,
  customer: "Maria",
  material: "PLA",
  paymentMethod: "pix",
  channel: "quiosque",
  notes: "",
  status: "concluida",
  productId: "peca",
  productName: "Peça",
  printHours: 6,
  machineUsage: USO,
  unattributedUnits: 0,
  quantity: 2,
  suggestedPrice: 50,
  salePrice: 50,
  unitCost: 20,
  costBreakdown: {
    material: 5,
    energy: 1,
    depreciation: 1,
    maintenance: 0.5,
    labor: 5,
    accessories: 0,
    failureReserve: 0,
    fixed: 0,
  },
  totalCost: 40,
  totalRevenue: 100,
  feeRate: 0,
  feeAmount: 0,
  feePassedToCustomer: false,
  profit: 60,
  margin: 60,
  createdAt: 1000,
  origem: "acabado",
  ...over,
});

describe("[FROTA] Fase 1 — round-trip da atribuição na VENDA", () => {
  it("a repartição real sobrevive, número a número", () => {
    const volta = toSale("v1", saleToDocument(venda()));
    expect(volta.machineUsage).toEqual(USO);
    expect(volta.unattributedUnits).toBe(0);
  });

  it("🔴 lista VAZIA é gravada — ela significa 'sem lastro', não 'esqueci'", () => {
    // É o oposto da regra da camada, e de propósito: aqui a ausência do campo
    // seria indistinguível de venda antiga. Se o `saleToDocument` a omitisse
    // (spread condicional, o reflexo do resto do arquivo), a venda sem origem
    // viraria venda velha e o ROI a leria como totalmente atribuída.
    const doc = saleToDocument(
      venda({ machineUsage: [], unattributedUnits: 3, quantity: 3 }),
    );
    expect(doc.machineUsage).toEqual([]);
    expect(doc.unattributedUnits).toBe(3);
    const volta = toSale("v1", doc);
    expect(volta.machineUsage).toEqual([]);
    expect(volta.unattributedUnits).toBe(3);
  });

  it("venda ANTERIOR à Fase 1 lê 0 órfãs — nunca `quantity`", () => {
    // Ela tem a repartição PRECIFICADA gravada na época e simplesmente não tem
    // o campo novo. Ler `quantity` apagaria o ROI inteiro retroativamente.
    const { unattributedUnits: _fora, ...antiga } = saleToDocument(venda());
    void _fora;
    const volta = toSale("v-velha", antiga);
    expect(volta.unattributedUnits).toBe(0);
    expect(volta.machineUsage).toEqual(USO);
  });

  it("venda MAIS velha ainda (sem machineUsage) chega vazia, e é toda órfã no ROI", () => {
    const { machineUsage: _fora, ...antiga } = saleToDocument(venda());
    void _fora;
    expect(toSale("v-velhissima", antiga).machineUsage).toEqual([]);
  });

  it("os campos que saíram não voltam a ser lidos", () => {
    // `machineId`/`machineName` saíram da venda. Um documento antigo ainda os
    // tem, e o leitor tem de ignorá-los — senão eles voltam por acaso.
    const volta = toSale("v1", {
      ...saleToDocument(venda()),
      machineId: "a1",
      machineName: "A1 Combo",
    });
    expect(volta).not.toHaveProperty("machineId");
    expect(volta).not.toHaveProperty("machineName");
  });

  it("o resto da venda não se mexeu — diff campo a campo", () => {
    const payload = venda();
    const volta = toSale("v1", saleToDocument(payload));
    for (const chave of [
      "reciboId",
      "saleDate",
      "customer",
      "material",
      "paymentMethod",
      "channel",
      "productId",
      "productName",
      "printHours",
      "quantity",
      "suggestedPrice",
      "salePrice",
      "unitCost",
      "totalCost",
      "totalRevenue",
      "profit",
      "margin",
      "createdAt",
      "origem",
    ] as const) {
      expect(volta[chave]).toEqual(payload[chave]);
    }
    expect(volta.costBreakdown).toEqual(payload.costBreakdown);
  });
});
