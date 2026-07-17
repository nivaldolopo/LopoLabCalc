import { describe, expect, it } from "vitest";
import {
  calculateFixedCostPerHour,
  calculatePricing,
} from "./calculatePricing";
import { DEFAULT_PRODUCT_INPUT, DEFAULT_MACHINES } from "../constants";
import type {
  FilamentRoll,
  FixedCostSettings,
  ProductInput,
  StockFilament,
} from "../types";

function makeProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return { ...DEFAULT_PRODUCT_INPUT, ...overrides };
}

// Cor do Estoque para os testes de preço vivo (7c). Rolos na ordem informada.
function makeColor(
  id: string,
  rolls: Array<Partial<FilamentRoll>>,
): StockFilament {
  return {
    id,
    material: "PLA",
    brand: "Bambu",
    colorName: "Preto",
    minG: 0,
    archived: false,
    rolls: rolls.map((roll, index) => ({
      id: `${id}_r${index}`,
      purchaseDate: index,
      initialG: 1000,
      remainingG: 1000,
      pricePerKg: 100,
      ...roll,
    })),
    adjustments: [],
    createdAt: 0,
  };
}

const NO_FIXED: FixedCostSettings = {
  enabled: false,
  rent: 0,
  other: 0,
  machines: 1,
  hoursDay: 20,
  daysMonth: 26,
};

describe("calculatePricing — componentes de custo", () => {
  it("calcula cada categoria da etapa principal (a1, 40g/3h)", () => {
    const r = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    expect(r.materialCost).toBeCloseTo(4.4, 6); // (40/1000)*110
    expect(r.energyCost).toBeCloseTo(0.228, 6); // 3*(95/1000)*0.8
    expect(r.depreciationCost).toBeCloseTo(1.5897, 4); // (5299/10000)*3
    expect(r.maintenanceCost).toBeCloseTo(0.36, 6); // 3*0.12
    expect(r.laborCost).toBeCloseTo(5, 6); // (10/60)*30
    expect(r.machine.id).toBe("a1");
  });

  it("reserva de falha infla o custo variável e some com taxa 0", () => {
    const comFalha = calculatePricing(
      makeProduct({ failureRate: 3 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const semFalha = calculatePricing(
      makeProduct({ failureRate: 0 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(comFalha.failureReserve).toBeGreaterThan(0);
    expect(semFalha.failureReserve).toBe(0);
    expect(comFalha.variableCost).toBeGreaterThan(semFalha.variableCost);
  });

  it("preço = custo variável × markup quando não há custo fixo", () => {
    const r = calculatePricing(
      makeProduct({ markup: 3, failureRate: 0, roundingMode: "exact" }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.fixedCost).toBe(0);
    expect(r.suggestedPrice).toBeCloseTo(r.variableCost * 3, 6);
    // markup 3x, sem fixo -> margem = (3-1)/3 = 66,67%
    expect(r.margin).toBeCloseTo(66.6667, 3);
  });

  it("acessórios entram no custo mas ficam fora da reserva de falha", () => {
    const semAcess = calculatePricing(
      makeProduct({ failureRate: 10 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const comAcess = calculatePricing(
      makeProduct({
        failureRate: 10,
        accessories: [{ desc: "Ímã", qty: 2, unitPrice: 1.5 }],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(comAcess.accessoriesCost).toBeCloseTo(3, 6);
    // A reserva de falha (peça perdida) não deve crescer com acessórios —
    // ímãs são montados depois e não se perdem numa falha de impressão.
    expect(comAcess.failureReserve).toBeCloseTo(semAcess.failureReserve, 6);
    expect(comAcess.variableCost).toBeCloseTo(semAcess.variableCost + 3, 6);
  });

  it("custo fixo entra quando habilitado (repassado, sem markup no fixo)", () => {
    const fixed: FixedCostSettings = {
      enabled: true,
      rent: 1500,
      other: 150,
      machines: 2,
      hoursDay: 20,
      daysMonth: 26,
    };
    const r = calculatePricing(
      makeProduct({ includeFixed: true }),
      DEFAULT_MACHINES,
      fixed,
    );
    const perHour = calculateFixedCostPerHour(fixed);
    expect(r.fixedCost).toBeCloseTo(perHour * 3, 6); // 3h de impressão
    expect(r.fixedCost).toBeGreaterThan(0);
  });

  it("divide os custos por peça quando piecesCount > 1", () => {
    const um = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    const dois = calculatePricing(
      makeProduct({ piecesCount: 2 }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(dois.pieces).toBe(2);
    expect(dois.materialCost).toBeCloseTo(um.materialCost / 2, 6);
    expect(dois.variableCost).toBeCloseTo(um.variableCost / 2, 6);
  });
});

describe("calculatePricing — múltiplas etapas / máquinas", () => {
  it("soma etapa extra nas mesmas categorias e reparte uso por máquina", () => {
    const r = calculatePricing(
      makeProduct({
        stages: [
          {
            machineId: "x2d",
            weightG: 20,
            printHours: 1,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.stagesCount).toBe(1);
    expect(r.materialCost).toBeCloseTo(6.6, 6); // 4,4 (a1) + 2,2 (x2d)
    // Uma entrada de uso por máquina participante.
    expect(r.machineUsage).toHaveLength(2);
    const ids = r.machineUsage.map((u) => u.machineId).sort();
    expect(ids).toEqual(["a1", "x2d"]);
  });
});

describe("calculatePricing — filamento por cor (FEAT-02)", () => {
  it("material multicolor soma cada cor (peso × preço)", () => {
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: null, colorName: "Preto", totalG: 40, pricePerKg: 110 },
          { filamentId: null, colorName: "Vermelho", totalG: 20, pricePerKg: 200 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    // 40/1000*110 + 20/1000*200 = 4,4 + 4 = 8,4
    expect(r.materialCost).toBeCloseTo(8.4, 6);
    expect(r.filaments).toHaveLength(2); // multicolor
  });

  it("suporte, torre e purga entram no custo (usa o Total por cor)", () => {
    const r = calculatePricing(
      makeProduct({
        filaments: [
          {
            filamentId: null,
            colorName: "Preto",
            modelG: 80,
            supportG: 22,
            purgedG: 68,
            towerG: 10,
            totalG: 0,
            pricePerKg: 100,
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    // Total = 80+22+68+10 = 180 g → 180/1000*100 = 18 (não só os 80 g da peça).
    expect(r.materialCost).toBeCloseTo(18, 6);
    expect(r.filaments[0].totalG).toBe(180);
  });

  it("agrega a mesma cor da etapa principal + extra num só item", () => {
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: null, colorName: "Preto", totalG: 40, pricePerKg: 110 },
        ],
        stages: [
          {
            machineId: "a1",
            printHours: 1,
            laborMinutes: 0,
            filaments: [
              { filamentId: null, colorName: "Preto", totalG: 20, pricePerKg: 110 },
            ],
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.filaments).toHaveLength(1); // mesma cor/preço → merge
    expect(r.filaments[0].totalG).toBe(60);
  });

  it("produto legado (escalar) vira uma cor única — mesmo custo", () => {
    const legado = calculatePricing(
      makeProduct({ weightG: 40, filamentPricePerKg: 110, filaments: undefined }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(legado.filaments).toHaveLength(1);
    expect(legado.materialCost).toBeCloseTo(4.4, 6);
  });
});

describe("calculatePricing — subitens / rateio aditivo (FEAT-01)", () => {
  // Produto de 2 etapas: principal (main) + 1 extra ("s1"), cada uma num subitem.
  function twoSubitemProduct(overrides: Partial<ProductInput> = {}): ProductInput {
    return makeProduct({
      markup: 3,
      failureRate: 0,
      roundingMode: "exact",
      sellBySubitems: true,
      stages: [
        {
          id: "s1",
          machineId: "a1",
          printHours: 1,
          laborMinutes: 0,
          filaments: [
            { filamentId: null, colorName: "X", totalG: 20, pricePerKg: 110 },
          ],
        },
      ],
      subitems: [
        { id: "A", name: "Base", stageKeys: ["main"] },
        { id: "B", name: "Adorno", stageKeys: ["s1"] },
      ],
      ...overrides,
    });
  }

  it("OFF: sem subitens no resultado e preço inalterado", () => {
    const r = calculatePricing(
      makeProduct({ markup: 3, failureRate: 0, roundingMode: "exact" }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.subitems).toBeUndefined();
    expect(r.suggestedPrice).toBeCloseTo(r.variableCost * 3, 6);
  });

  it("Σ preço dos subitens = preço do inteiro; Σ custo = custo total", () => {
    const r = calculatePricing(twoSubitemProduct(), DEFAULT_MACHINES, NO_FIXED);
    expect(r.subitems).toHaveLength(2);
    const sumPrice = r.subitems!.reduce((s, x) => s + x.price, 0);
    const sumCost = r.subitems!.reduce((s, x) => s + x.cost, 0);
    expect(sumPrice).toBeCloseTo(r.suggestedPrice, 6);
    expect(sumCost).toBeCloseTo(r.totalCost, 6);
  });

  it("aditividade se mantém com custo fixo e arredondamento", () => {
    const fixed: FixedCostSettings = {
      enabled: true,
      rent: 1500,
      other: 150,
      machines: 2,
      hoursDay: 20,
      daysMonth: 26,
    };
    const r = calculatePricing(
      twoSubitemProduct({ includeFixed: true, roundingMode: "1", failureRate: 5 }),
      DEFAULT_MACHINES,
      fixed,
    );
    const sumPrice = r.subitems!.reduce((s, x) => s + x.price, 0);
    const sumCost = r.subitems!.reduce((s, x) => s + x.cost, 0);
    // O inteiro é DEFINIDO como a soma das partes arredondadas.
    expect(sumPrice).toBeCloseTo(r.suggestedPrice, 6);
    expect(sumCost).toBeCloseTo(r.totalCost, 6);
  });

  it("passo interno (etapa fora de subitem) é rateado — Σ ainda = inteiro", () => {
    const r = calculatePricing(
      twoSubitemProduct({
        stages: [
          {
            id: "s1",
            machineId: "a1",
            printHours: 1,
            laborMinutes: 0,
            filaments: [
              { filamentId: null, colorName: "X", totalG: 20, pricePerKg: 110 },
            ],
          },
          {
            id: "s2", // interna: não está em nenhum subitem
            machineId: "a1",
            printHours: 2,
            laborMinutes: 0,
            filaments: [
              { filamentId: null, colorName: "Y", totalG: 30, pricePerKg: 110 },
            ],
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const sumCost = r.subitems!.reduce((s, x) => s + x.cost, 0);
    expect(sumCost).toBeCloseTo(r.totalCost, 6); // custo interno foi distribuído
    // Cada subitem custa mais que só o próprio material (recebeu fatia da interna).
    expect(r.subitems![0].cost).toBeGreaterThan(4.4);
  });

  it("markup próprio por subitem sobrepõe o do produto", () => {
    const r = calculatePricing(
      twoSubitemProduct({
        subitems: [
          { id: "A", name: "Base", stageKeys: ["main"] },
          { id: "B", name: "Adorno", stageKeys: ["s1"], markup: 5 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const a = r.subitems!.find((s) => s.id === "A")!;
    const b = r.subitems!.find((s) => s.id === "B")!;
    expect(a.markup).toBe(3);
    expect(b.markup).toBe(5);
    // Sem fixo, o preço exato do subitem = custo × markup.
    expect(b.exactPrice).toBeCloseTo(b.cost * 5, 6);
  });

  it("acessório atribuído vai 100% no subitem; não atribuído é rateado", () => {
    const atribuido = calculatePricing(
      twoSubitemProduct({
        accessories: [{ desc: "Ímã", qty: 1, unitPrice: 4, subitemId: "A" }],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const a = atribuido.subitems!.find((s) => s.id === "A")!;
    const b = atribuido.subitems!.find((s) => s.id === "B")!;
    expect(a.costBreakdown.accessories).toBeCloseTo(4, 6); // tudo na Base
    expect(b.costBreakdown.accessories).toBeCloseTo(0, 6);

    const rateado = calculatePricing(
      twoSubitemProduct({
        accessories: [{ desc: "Ímã", qty: 1, unitPrice: 4 }], // sem subitemId
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    const sumAcc = rateado.subitems!.reduce(
      (s, x) => s + x.costBreakdown.accessories,
      0,
    );
    expect(sumAcc).toBeCloseTo(4, 6); // rateado, mas soma fecha
    expect(rateado.subitems![0].costBreakdown.accessories).toBeGreaterThan(0);
    expect(rateado.subitems![1].costBreakdown.accessories).toBeGreaterThan(0);
  });

  it("subitem sem custo de impressão não quebra (divisão por zero → peso igual)", () => {
    const r = calculatePricing(
      twoSubitemProduct({
        // Zera o custo de impressão de ambas as etapas (sem peso, sem tempo/labor).
        printHours: 0,
        laborMinutes: 0,
        weightG: 0,
        filaments: [{ filamentId: null, colorName: "X", totalG: 0, pricePerKg: 0 }],
        stages: [
          {
            id: "s1",
            machineId: "a1",
            printHours: 0,
            laborMinutes: 0,
            filaments: [
              { filamentId: null, colorName: "X", totalG: 0, pricePerKg: 0 },
            ],
          },
        ],
        accessories: [{ desc: "Ímã", qty: 1, unitPrice: 4 }],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.subitems).toHaveLength(2);
    const sumCost = r.subitems!.reduce((s, x) => s + x.cost, 0);
    expect(sumCost).toBeCloseTo(r.totalCost, 6);
    // Acessório de R$4 rateado em pesos iguais → R$2 em cada.
    expect(r.subitems![0].costBreakdown.accessories).toBeCloseTo(2, 6);
    expect(r.subitems![1].costBreakdown.accessories).toBeCloseTo(2, 6);
  });
});

describe("calculatePricing — máquina órfã (TD-009)", () => {
  it("não sinaliza quando o machineId existe", () => {
    const r = calculatePricing(makeProduct(), DEFAULT_MACHINES, NO_FIXED);
    expect(r.machineMissing).toBe(false);
  });

  it("sinaliza e cai no fallback (1ª máquina) quando o machineId não existe", () => {
    const r = calculatePricing(
      makeProduct({ machineId: "inexistente" }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.machineMissing).toBe(true);
    // Fallback: usa a 1ª máquina para não quebrar o preço.
    expect(r.machine.id).toBe(DEFAULT_MACHINES[0].id);
  });

  it("sinaliza quando a máquina órfã está numa etapa extra", () => {
    const r = calculatePricing(
      makeProduct({
        stages: [
          {
            machineId: "inexistente",
            weightG: 20,
            printHours: 1,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
    );
    expect(r.machineMissing).toBe(true);
  });
});

describe("calculatePricing — preço vivo do Estoque (7c)", () => {
  it("cor ligada usa o preço do rolo MAIS NOVO (D3), não o salvo", () => {
    const stock = [
      makeColor("cor1", [
        { purchaseDate: 1, pricePerKg: 90 },
        { purchaseDate: 2, pricePerKg: 130 }, // mais novo → custo de repor
      ]),
    ];
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: "cor1", colorName: "Preto", totalG: 100, pricePerKg: 50 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
      stock,
    );
    // Usa 130 (rolo mais novo), ignorando o pricePerKg salvo (50): 100/1000*130.
    expect(r.materialCost).toBeCloseTo(13, 6);
    expect(r.filamentMissing).toBe(false);
  });

  it("cor sem rolo cai no preço salvo (fallback D3), sem marcar missing", () => {
    const stock = [makeColor("cor1", [])];
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: "cor1", colorName: "Preto", totalG: 100, pricePerKg: 80 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
      stock,
    );
    expect(r.materialCost).toBeCloseTo(8, 6); // 100/1000*80 (salvo)
    expect(r.filamentMissing).toBe(false);
  });

  it("cor removida do Estoque marca filamentMissing e usa o preço salvo", () => {
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: "sumiu", colorName: "Preto", totalG: 100, pricePerKg: 70 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
      [], // estoque vazio → a cor "sumiu" não existe
    );
    expect(r.materialCost).toBeCloseTo(7, 6); // fallback no salvo
    expect(r.filamentMissing).toBe(true);
  });

  it("avulso (filamentId null) usa o preço digitado e não marca missing", () => {
    const r = calculatePricing(
      makeProduct({
        filaments: [
          { filamentId: null, colorName: "Avulso", totalG: 100, pricePerKg: 60 },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
      [makeColor("cor1", [{ pricePerKg: 999 }])],
    );
    expect(r.materialCost).toBeCloseTo(6, 6); // 100/1000*60
    expect(r.filamentMissing).toBe(false);
  });

  it("cor removida numa etapa extra também sinaliza", () => {
    const r = calculatePricing(
      makeProduct({
        stages: [
          {
            machineId: "a1",
            printHours: 1,
            laborMinutes: 0,
            filaments: [
              { filamentId: "sumiu", colorName: "X", totalG: 10, pricePerKg: 100 },
            ],
          },
        ],
      }),
      DEFAULT_MACHINES,
      NO_FIXED,
      [],
    );
    expect(r.filamentMissing).toBe(true);
  });
});
