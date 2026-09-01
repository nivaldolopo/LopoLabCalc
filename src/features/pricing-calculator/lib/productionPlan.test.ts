import { describe, expect, it } from "vitest";
import { DEFAULT_MACHINES, DEFAULT_PRODUCT_INPUT } from "../constants";
import {
  accessoryRows,
  buildProductionPayloads,
  planEventRows,
  scaleRow,
  submissionColors,
  wholeEventRows,
} from "./productionPlan";
import { NO_COLOR } from "./filaments";
import { sumFrozen } from "./production";
import type { SavedProduct, StockFilament, Supply } from "../types";

// Foco: a escala dos INSUMOS (7e), que é o ponto onde as unidades se cruzam —
// `Accessory.qty` é POR PEÇA, a linha-evento é POR PLACA, e a submissão são N
// placas. Errar aqui dá baixa a menos (ou a mais) sem nenhum sintoma na tela.

function makeProduct(over: Partial<SavedProduct> = {}): SavedProduct {
  return { ...DEFAULT_PRODUCT_INPUT, id: "p1", name: "Chaveiro", ...over } as SavedProduct;
}

function makeSupply(over: Partial<Supply> & { id: string }): Supply {
  return {
    name: "Ímã",
    unit: "un",
    minQty: 0,
    archived: false,
    lots: [
      {
        id: "l1",
        purchaseDate: 0,
        initialQty: 1000,
        remainingQty: 1000,
        unitPrice: 0.5,
      },
    ],
    adjustments: [],
    createdAt: 0,
    ...over,
  };
}

describe("accessoryRows", () => {
  const product = makeProduct({
    piecesCount: 4,
    accessories: [
      { desc: "Ímã", qty: 2, unitPrice: 0.5, supplyId: "ima" },
      { desc: "Argola", qty: 1, unitPrice: 0.3, supplyId: null },
    ],
  });

  it("converte qtd POR PEÇA em qtd por PLACA (× peças)", () => {
    const rows = accessoryRows(product, 4);
    expect(rows).toEqual([
      { supplyId: "ima", name: "Ímã", qty: 8, catalogUnitPrice: 0.5 },
      { supplyId: null, name: "Argola", qty: 4, catalogUnitPrice: 0.3 },
    ]);
  });

  it("produção de SUBITEM leva só o acessório atribuído a ele", () => {
    const comSubitem = makeProduct({
      piecesCount: 2,
      accessories: [
        { desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima", subitemId: "s1" },
        { desc: "Argola", qty: 1, unitPrice: 0.3, supplyId: "arg", subitemId: "s2" },
        { desc: "Caixa", qty: 1, unitPrice: 2, supplyId: "cx" }, // do produto inteiro
      ],
    });
    const rows = accessoryRows(comSubitem, 2, "s1");
    expect(rows.map((row) => row.name)).toEqual(["Ímã"]);
    expect(rows[0].qty).toBe(2);
  });

  it("acessório com qtd zero fica de fora", () => {
    const zerado = makeProduct({
      accessories: [{ desc: "Nada", qty: 0, unitPrice: 5, supplyId: "x" }],
    });
    expect(accessoryRows(zerado, 3)).toEqual([]);
  });
});

describe("wholeEventRows — ancoragem dos insumos", () => {
  const accessories = [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }];

  it("mono-máquina: os insumos vão na única linha", () => {
    const rows = wholeEventRows(
      makeProduct({ piecesCount: 3, accessories }),
      DEFAULT_MACHINES,
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].supplies[0].qty).toBe(3);
  });

  it("multi-máquina: só a PRIMEIRA linha carrega o insumo (senão conta duas vezes)", () => {
    const rows = wholeEventRows(
      makeProduct({
        piecesCount: 1,
        machineId: "a1",
        accessories,
        stages: [
          {
            id: "s1",
            name: "Base",
            machineId: "x2d",
            printHours: 1,
            laborMinutes: 0,
            filaments: [],
          },
        ],
      }),
      DEFAULT_MACHINES,
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].supplies).toHaveLength(1);
    expect(rows[1].supplies).toEqual([]);
  });
});

describe("scaleRow + planEventRows", () => {
  const product = makeProduct({
    piecesCount: 2,
    printHours: 1,
    accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }],
  });

  it("escala os insumos pelo mesmo fator das gramas (placas)", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    expect(row.supplies[0].qty).toBe(2); // 1/peça × 2 peças = 1 placa
    expect(scaleRow(row, 3).supplies[0].qty).toBe(6); // × 3 placas
  });

  it("a baixa chega ao estoque e ao custo congelado", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const supply = makeSupply({ id: "ima" });
    const planned = planEventRows(
      [scaleRow(row, 3)],
      "real",
      [],
      [supply],
      DEFAULT_MACHINES,
      () => "e1",
    );
    // 6 ímãs a R$0,50 = R$3,00, dentro do frozenCost.
    expect(planned.summary.supplies).toBeCloseTo(3);
    expect(planned.built[0].cost.supplies).toBeCloseTo(3);
    expect(planned.supplyUpdates[0].lots[0].remainingQty).toBe(994);
    expect(planned.built[0].supplyPlan.moves[0]).toMatchObject({
      kind: "supply",
      stockId: "ima",
      qty: 6,
    });
  });

  it("duas linhas do mesmo insumo deduzem em sequência (encadeado)", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const planned = planEventRows(
      [row, { ...row, key: "outra" }],
      "real",
      [],
      [makeSupply({ id: "ima" })],
      DEFAULT_MACHINES,
      () => "e1",
    );
    expect(planned.supplyUpdates[0].lots[0].remainingQty).toBe(996); // 1000 − 2 − 2
  });
});

// FEAT-06 — a composição acompanha o total em cada travessia. O invariante é
// sempre o mesmo (`sumFrozen(breakdown) === total`), mas os caminhos que podem
// quebrá-lo são distintos: somar N eventos, escalar por placas, cair no ramo sem
// máquina e fechar o payload gravável.
describe("FEAT-06 — frozenBreakdown no plano", () => {
  const product = makeProduct({
    piecesCount: 2,
    printHours: 1,
    accessories: [{ desc: "Ímã", qty: 1, unitPrice: 0.5, supplyId: "ima" }],
  });

  function plan(rows: ReturnType<typeof wholeEventRows>, machines = DEFAULT_MACHINES) {
    let n = 0;
    return planEventRows(rows, "real", [], [makeSupply({ id: "ima" })], machines, () => `e${++n}`);
  }

  it("a soma do breakdown é o frozen do summary", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []));
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.summary.frozen,
      6,
    );
  });

  // Multi-máquina: N eventos numa placa só. Se o breakdown fosse somado num
  // segundo laço, ele e o `frozen` poderiam divergir sem sintoma.
  it("com 2 eventos, a soma dos componentes acompanha o total", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const outra = { ...row, key: "outra", machineId: DEFAULT_MACHINES[1]?.id ?? row.machineId };
    const planned = plan([row, outra]);
    expect(planned.built).toHaveLength(2);
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.built[0].cost.total + planned.built[1].cost.total,
      6,
    );
  });

  it("escalar por placas escala cada componente junto", () => {
    const [row] = wholeEventRows(product, DEFAULT_MACHINES, []);
    const um = plan([row]).summary.frozenBreakdown;
    const tres = plan([scaleRow(row, 3)]).summary.frozenBreakdown;
    // Material/insumos/horas triplicam — o labor congelado da etapa não escala
    // com placas, então comparo componente a componente o que de fato escala.
    expect(tres.material).toBeCloseTo(um.material * 3, 6);
    expect(tres.supplies).toBeCloseTo(um.supplies * 3, 6);
    expect(tres.energy).toBeCloseTo(um.energy * 3, 6);
    expect(tres.depreciation).toBeCloseTo(um.depreciation * 3, 6);
  });

  // Ramo sem máquina (`planEventRows` cai no objeto montado à mão): o breakdown
  // tem que existir e ainda somar o total, senão o payload grava um objeto
  // incoerente com o `frozenCost`.
  it("sem máquina, o breakdown ainda bate com o total", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []), []);
    expect(sumFrozen(planned.summary.frozenBreakdown)).toBeCloseTo(
      planned.summary.frozen,
      6,
    );
  });

  it("buildProductionPayloads grava o breakdown, somando o frozenCost", () => {
    const planned = plan(wholeEventRows(product, DEFAULT_MACHINES, []));
    const [{ payload }] = buildProductionPayloads(planned.built, {
      at: 0,
      outcome: "estoque",
      mode: "real",
      createdAt: 0,
    });
    expect(payload.frozenBreakdown).toBeDefined();
    expect(sumFrozen(payload.frozenBreakdown!)).toBeCloseTo(payload.frozenCost, 6);
  });
});

// ---------------------------------------------------------------------------
// AUD-14 [D9] — os dois preços do mesmo documento, e qual é qual
// ---------------------------------------------------------------------------
// O evento congela DUAS coisas de material: a linha de cor (preço de CATÁLOGO,
// para se ler "o que essa impressão levou") e o custo de verdade, que é FIFO e
// mora no `frozenBreakdown.material`. Enquanto a linha se chamava `pricePerKg`,
// nada no documento dizia que os dois números não eram o mesmo — e quem lesse de
// fora somaria gramas × preço achando que reconstruía o custo.
//
// O cenário é o medido na varredura, em `producao/32Fa5M0jFy2wvCe7dDod`: catálogo
// (rolo mais novo) R$ 85/kg, FIFO (rolo que o estoque tinha) R$ 110/kg, 40 g.
describe("AUD-14 [D9] — preço de catálogo × custo FIFO no evento", () => {
  const laranja: StockFilament = {
    id: "fil_laranja",
    material: "PLA",
    brand: "Bambu",
    colorName: "Laranja",
    minG: 0,
    archived: false,
    // Dois rolos: o VELHO é o que o FIFO consome (R$ 110/kg) e o NOVO é o que
    // define o preço de catálogo da cor (R$ 85/kg — a última compra). É esta
    // ordem que faz os dois números divergirem, e ela é o caso comum: o rolo
    // barato chegou depois.
    rolls: [
      {
        id: "rolo-velho",
        purchaseDate: 1,
        initialG: 1000,
        remainingG: 1000,
        pricePerKg: 110,
      },
      {
        id: "rolo-novo",
        purchaseDate: 2,
        initialG: 1000,
        remainingG: 1000,
        pricePerKg: 85,
      },
    ],
    adjustments: [],
    createdAt: 0,
  };

  const product = makeProduct({
    printHours: 1,
    // O preço aqui é irrelevante de propósito: a linha-evento resolve o preço
    // VIVO da cor (o do rolo mais novo). O que o produto guarda é só o vínculo.
    filaments: [
      { filamentId: "fil_laranja", colorName: "Laranja", pricePerKg: 0, totalG: 40 },
    ],
  });

  function payloadDoEvento() {
    const rows = wholeEventRows(product, DEFAULT_MACHINES, [laranja]);
    const planned = planEventRows(
      rows,
      "real",
      [laranja],
      [],
      DEFAULT_MACHINES,
      () => "e1",
    );
    const [{ payload }] = buildProductionPayloads(planned.built, {
      at: 0,
      outcome: "estoque",
      mode: "real",
      createdAt: 0,
    });
    return payload;
  }

  it("a linha de cor guarda o preço do CADASTRO, com o nome dizendo isso", () => {
    const payload = payloadDoEvento();
    expect(payload.filaments[0].catalogPricePerKg).toBe(85);
    // O `pricePerKg` não sobrevive à travessia: o campo antigo era justamente o
    // que fazia os dois números parecerem a mesma coisa.
    expect("pricePerKg" in payload.filaments[0]).toBe(false);
    // Nem o `id` de estado do formulário.
    expect("id" in payload.filaments[0]).toBe(false);
  });

  it("o custo real é o FIFO, e diverge do catálogo dentro do MESMO documento", () => {
    const payload = payloadDoEvento();
    const catalogo =
      (payload.filaments[0].totalG / 1000) * payload.filaments[0].catalogPricePerKg;
    expect(catalogo).toBeCloseTo(3.4, 6); // 40 g × R$ 85/kg
    expect(payload.frozenBreakdown!.material).toBeCloseTo(4.4, 6); // 40 g × R$ 110/kg
    expect(payload.frozenBreakdown!.material - catalogo).toBeCloseTo(1, 6);
  });

  it("no modo historico não há rolo a consumir, e os dois coincidem", () => {
    const rows = wholeEventRows(product, DEFAULT_MACHINES, [laranja]);
    const planned = planEventRows(
      rows,
      "historico",
      [laranja],
      [],
      DEFAULT_MACHINES,
      () => "e1",
    );
    const [{ payload }] = buildProductionPayloads(planned.built, {
      at: 0,
      outcome: "historico",
      mode: "historico",
      createdAt: 0,
    });
    expect(payload.frozenBreakdown!.material).toBeCloseTo(3.4, 6);
    expect(payload.filaments[0].catalogPricePerKg).toBe(85);
  });
});

// ---------------------------------------------------------------------------
// FEAT-11 — a cor que cada PEÇA leva para o estoque de acabados
// ---------------------------------------------------------------------------
// O ponto delicado: a /producao agrupa as linhas por MÁQUINA, mas o acabado é
// creditado por SUBITEM. Sem a etapa de origem em cada linha de filamento, um
// produto corpo-azul + tampa-vermelha carimbaria "Azul + Vermelho" nas duas
// partes — que é justamente o produto multicor de projeto que se quer suportar.

describe("submissionColors (FEAT-11)", () => {
  const AZUL = { filamentId: "fil_azul", colorName: "Azul", pricePerKg: 100, totalG: 40 };
  const VERMELHO = { filamentId: "fil_verm", colorName: "Vermelho", pricePerKg: 100, totalG: 10 };

  // Corpo (etapa principal) em azul; tampa (etapa extra) em vermelho.
  const kit = makeProduct({
    machineId: DEFAULT_MACHINES[0].id,
    printHours: 2,
    filaments: [AZUL],
    sellBySubitems: true,
    subitems: [
      { id: "corpo", name: "Corpo", stageKeys: ["main"] },
      { id: "tampa", name: "Tampa", stageKeys: ["s1"] },
    ],
    stages: [
      {
        id: "s1",
        name: "Tampa",
        machineId: DEFAULT_MACHINES[0].id,
        printHours: 1,
        laborMinutes: 0,
        filaments: [VERMELHO],
      },
    ],
  });

  it("cada parte recebe a cor das SUAS etapas, não a mistura da submissão", () => {
    const rows = wholeEventRows(kit, DEFAULT_MACHINES, []);
    const colors = submissionColors(rows, kit.subitems);
    expect(colors.bySubitem.get("corpo")?.label).toBe("Azul");
    expect(colors.bySubitem.get("tampa")?.label).toBe("Vermelho");
    // A submissão inteira, essa sim, é bicolor.
    expect(colors.whole.label).toBe("Azul + Vermelho");
  });

  it("[FROTA] duas etapas na MESMA máquina são DUAS linhas (uma por etapa)", () => {
    const rows = wholeEventRows(kit, DEFAULT_MACHINES, []);
    // Antes da Fase 1 isto era UMA linha: as etapas vinham agrupadas por
    // máquina, e o `printedCount` do ROI contava 1 impressão onde houve 2.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.filaments.map((f) => f.stageKey))).toEqual([
      ["main"],
      ["s1"],
    ]);
    // A separação por etapa continua chegando na parte certa.
    const colors = submissionColors(rows, kit.subitems);
    expect(colors.bySubitem.get("corpo")?.label).toBe("Azul");
    expect(colors.bySubitem.get("tampa")?.label).toBe("Vermelho");
  });

  it("trocar a cor de uma linha reflete na parte certa", () => {
    const rows = wholeEventRows(kit, DEFAULT_MACHINES, []);
    // O dono troca a tampa para preto na tela (a linha guarda a etapa "s1").
    const trocado = rows.map((row) => ({
      ...row,
      filaments: row.filaments.map((fil) =>
        fil.stageKey === "s1"
          ? { ...fil, filamentId: "fil_preto", colorName: "Preto" }
          : fil,
      ),
    }));
    const colors = submissionColors(trocado, kit.subitems);
    expect(colors.bySubitem.get("corpo")?.label).toBe("Azul");
    expect(colors.bySubitem.get("tampa")?.label).toBe("Preto");
  });

  it("parte sem filamento nenhum (só montagem) fica sem cor", () => {
    const rows = wholeEventRows(kit, DEFAULT_MACHINES, []);
    const colors = submissionColors(rows, [
      ...kit.subitems,
      { id: "montagem", name: "Montagem", stageKeys: [] },
    ]);
    expect(colors.bySubitem.get("montagem")).toEqual(NO_COLOR);
  });

  it("produto de cor única: a peça inteira leva aquela cor", () => {
    const simples = makeProduct({ filaments: [AZUL] });
    const estoque = [
      {
        id: "fil_azul",
        material: "PLA",
        brand: "Bambu",
        colorName: "Azul",
        minG: 0,
        archived: false,
        rolls: [],
        adjustments: [],
        createdAt: 0,
      },
    ];
    const colors = submissionColors(
      wholeEventRows(simples, DEFAULT_MACHINES, estoque),
      [],
    );
    expect(colors.whole).toEqual({ key: "fil_azul", label: "Azul" });
    expect(colors.bySubitem.size).toBe(0);
  });

  // Documenta a borda: cor apagada do Estoque cai no caminho AVULSO (é o que o
  // `resolveFilRow` já fazia — sem a cor não há preço vivo nem de onde dar baixa),
  // e a SKU passa a ser chaveada pelo NOME. Recadastrar a cor não junta o saldo
  // das duas — é o mesmo sintoma que o badge de cor removida (TD-009) já avisa.
  it("cor que não está mais no Estoque vira chave por nome (avulso)", () => {
    const simples = makeProduct({ filaments: [AZUL] });
    const colors = submissionColors(
      wholeEventRows(simples, DEFAULT_MACHINES, []),
      [],
    );
    expect(colors.whole).toEqual({ key: "livre:azul", label: "Azul" });
  });
});
