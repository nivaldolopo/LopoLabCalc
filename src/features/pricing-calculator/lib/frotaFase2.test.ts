import { describe, expect, it } from "vitest";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
import { calculatePricing } from "./calculatePricing";
import {
  depreciationPerHourOf,
  machineSelectionNote,
  resolveFleet,
  selectedLive,
  toggleSelection,
} from "./fleet";
import {
  encomendaMachineOptions,
  initialRowMachineId,
  planEventRows,
  wholeEventRows,
} from "./productionPlan";
import { reconcileReciboWrite, type ReconItem } from "./saleReconciliation";
import type {
  Machine,
  ProductInput,
  SavedProduct,
  StockFilament,
} from "../types";

// ---------------------------------------------------------------------------
// [FROTA] Fase 2 — a TAXA DE FROTA.
//
// O problema: a mesma peça saía por R$33,06 (A1 Mini), R$37,45 (A1) ou R$49,01
// (X2D) — 48% de diferença decidida por qual impressora estava livre no dia em
// que alguém abriu a calculadora. Com três máquinas de 7× de diferença de
// preço, isso não é ajustável por parâmetro.
//
// A saída NÃO toca em nenhum número pesquisado: o `lifeHours` de 7.500h segue
// sendo o DEC-02 e os R$2,187/h da X2D continuam verdade. O que muda é a
// DISTRIBUIÇÃO. Este arquivo prova as duas metades disso:
//   1. o preço parou de depender de qual impressora estava livre;
//   2. a mecânica que substituiu a escolha é uma média ponderada POR
//      COMPONENTE, renormalizada dentro do subconjunto elegível de cada etapa.
//
// A frota abaixo é a do dono, com os pesos que ele martelou em 2026-09-01.
// ---------------------------------------------------------------------------

// ⚠ Preço e watts da Mini escolhidos para REPRODUZIR a conta publicada no escopo
// da fase ("desgaste 0,9226 + manutenção 0,1380 + energia 0,0808 = 1,1414/h"):
// são o único par que fecha os três números com os pesos 30/40/30 e a A1/X2D
// reais. Se a Mini do dono tiver outro preço, quem dirá é o cartão da /maquinas
// — o que este arquivo trava é a MECÂNICA, e a aritmética que o escopo publicou.
const MINI: Machine = {
  id: "mini", name: "A1 Mini", price: 2000, lifeHours: 7500,
  watts: 60, maintenancePerHour: 0.1, weight: 30,
};
const A1: Machine = {
  id: "a1", name: "A1 Combo", price: 5299, lifeHours: 7500,
  watts: 95, maintenancePerHour: 0.12, weight: 40,
};
const X2D: Machine = {
  id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 7500,
  watts: 150, maintenancePerHour: 0.2, weight: 30,
};
const FROTA = [MINI, A1, X2D];
const SEM_ESTOQUE: StockFilament[] = [];

function produto(over: Partial<ProductInput> = {}): ProductInput {
  return {
    ...DEFAULT_PRODUCT_INPUT,
    machineIds: FROTA.map((m) => m.id),
    printHours: 3,
    laborMinutes: 10,
    failureRate: 0,
    filaments: [
      { filamentId: null, colorName: "Azul", pricePerKg: 110, totalG: 40 },
    ],
    ...over,
  };
}

const preco = (p: ProductInput) =>
  calculatePricing(p, FROTA, DEFAULT_FIXED_COSTS, SEM_ESTOQUE);

// ===========================================================================
// 1. A MÉDIA — cada componente com a SUA, nunca um total rateado
// ===========================================================================

describe("[FROTA] Fase 2 — a média é POR COMPONENTE", () => {
  it("desgaste, manutenção e watts têm cada um a sua ponderada", () => {
    const f = resolveFleet(FROTA, ["mini", "a1", "x2d"]);
    // Desgaste = preço ÷ 7500h, ponderado 30/40/30:
    // 0,3×0,26667 + 0,4×0,70653 + 0,3×1,86653 = 0,92257
    expect(f.depreciationPerHour).toBeCloseTo(0.9226, 4);
    // Manutenção: 0,3×0,10 + 0,4×0,12 + 0,3×0,20 = 0,1380
    expect(f.maintenancePerHour).toBeCloseTo(0.138, 6);
    // Watts: 0,3×60 + 0,4×95 + 0,3×150 = 101 → 0,0808 R$/h a 0,80/kWh
    expect(f.watts).toBeCloseTo(101, 6);
    expect(f.weighted).toBe(true);
    expect(f.missing).toBe(false);
  });

  it("as três somam a taxa cheia — a média é LINEAR, não sobra resíduo", () => {
    // É por isso que ratear UM total seria errado e desnecessário: a soma das
    // médias é a média das somas. As 3 linhas do `CostDetail` continuam casando
    // com a coluna do custo real linha a linha (desgaste com desgaste), em vez
    // de virarem uma "mistura de mistura" sem significado ao lado dela.
    const f = resolveFleet(FROTA, ["mini", "a1", "x2d"]);
    const fatias = [0.3, 0.4, 0.3];
    const somaDireta = FROTA.reduce(
      (sum, m, i) =>
        sum + fatias[i] * (depreciationPerHourOf(m) + m.maintenancePerHour),
      0,
    );
    expect(f.depreciationPerHour + f.maintenancePerHour).toBeCloseTo(
      somaDireta,
      10,
    );
    // E o número que o cartão da /maquinas mostra: R$/h sem energia.
    expect(f.depreciationPerHour + f.maintenancePerHour).toBeCloseTo(1.0606, 4);
  });

  it("fecha a conta publicada no escopo: 0,9226 + 0,1380 + 0,0808 = 1,1414/h", () => {
    // A soma dos TRÊS componentes por hora, energia inclusive (tarifa 0,80 do
    // `DEFAULT_PRODUCT_INPUT`). É a linha que o BACKLOG usou para dizer que a
    // média é linear e que as 3 linhas do `CostDetail` continuam somando a taxa
    // cheia — vale tê-la travada em teste, e não só em prosa.
    const f = resolveFleet(FROTA, ["mini", "a1", "x2d"]);
    const energiaHora = (f.watts / 1000) * 0.8;
    expect(energiaHora).toBeCloseTo(0.0808, 4);
    expect(
      f.depreciationPerHour + f.maintenancePerHour + energiaHora,
    ).toBeCloseTo(1.1414, 4);
  });
});

// ===========================================================================
// 2. O PROBLEMA QUE A FASE EXISTE PARA RESOLVER
// ===========================================================================

describe("[FROTA] Fase 2 — a diferença por impressora fecha", () => {
  // Esta é a trava de preço da fase, e ela MUDOU DE PROPÓSITO em relação à do
  // `frotaFase1.test.ts`: lá o literal guardava "o preço não pode mexer"; aqui
  // ele guarda "o preço parou de depender de qual impressora estava livre".
  const soMini = preco(produto({ machineIds: ["mini"] }));
  const soA1 = preco(produto({ machineIds: ["a1"] }));
  const soX2d = preco(produto({ machineIds: ["x2d"] }));
  const frotaToda = preco(produto());

  it("uma máquina só: os três preços continuam MUITO diferentes", () => {
    // O caso que motivou a fase, medido aqui para o número não virar folclore.
    const spread =
      (soX2d.suggestedPrice - soMini.suggestedPrice) / soMini.suggestedPrice;
    expect(spread).toBeGreaterThan(0.3);
    expect(soMini.suggestedPrice).toBeLessThan(soA1.suggestedPrice);
    expect(soA1.suggestedPrice).toBeLessThan(soX2d.suggestedPrice);
  });

  it("elegível às três: UM preço só, e ele fica entre os extremos", () => {
    expect(frotaToda.suggestedPrice).toBeGreaterThan(soMini.suggestedPrice);
    expect(frotaToda.suggestedPrice).toBeLessThan(soX2d.suggestedPrice);
    // Ponderado 30/40/30, não a média simples — a A1 pesa mais que as outras.
    expect(frotaToda.depreciationCost).toBeCloseTo(0.9226 * 3, 3);
    expect(frotaToda.maintenanceCost).toBeCloseTo(0.138 * 3, 6);
    expect(frotaToda.energyCost).toBeCloseTo(3 * (101 / 1000) * 0.8, 6);
  });

  it("a frota NÃO é a média simples — o peso do dono é respeitado", () => {
    // Com 30/40/30 a média pende para a A1. Se os pesos fossem ignorados, o
    // desgaste seria (0,2667 + 0,7065 + 1,8665) ÷ 3 = 0,94657/h.
    const simples =
      (depreciationPerHourOf(MINI) +
        depreciationPerHourOf(A1) +
        depreciationPerHourOf(X2D)) /
      3;
    expect(frotaToda.depreciationCost / 3).not.toBeCloseTo(simples, 4);
    expect(frotaToda.depreciationCost / 3).toBeLessThan(simples);
  });

  it("o material e a mão de obra NÃO se mexem — a frota só toca no que é da máquina", () => {
    expect(frotaToda.materialCost).toBeCloseTo(soX2d.materialCost, 10);
    expect(frotaToda.laborCost).toBeCloseTo(soX2d.laborCost, 10);
  });
});

// ===========================================================================
// 3. O SUBCONJUNTO — a renormalização, e o peso zero
// ===========================================================================

describe("[FROTA] Fase 2 — o subconjunto elegível", () => {
  it("peça que só cabe na X2D é precificada pela X2D PURA", () => {
    // A renormalização sai de graça: a fórmula divide pela soma dos pesos
    // PRESENTES, então um subconjunto de um só tem fatia 1 — sem ninguém ter de
    // reescrever percentual nenhum.
    const f = resolveFleet(FROTA, ["x2d"]);
    expect(f.depreciationPerHour).toBeCloseTo(depreciationPerHourOf(X2D), 10);
    expect(f.watts).toBeCloseTo(150, 10);
  });

  it("subconjunto de duas renormaliza entre elas (30 e 40 viram 3/7 e 4/7)", () => {
    const f = resolveFleet(FROTA, ["mini", "a1"]);
    const esperado =
      (30 * depreciationPerHourOf(MINI) + 40 * depreciationPerHourOf(A1)) / 70;
    expect(f.depreciationPerHour).toBeCloseTo(esperado, 10);
  });

  // Sem este caso a peça daria NaN: máquina nova entra a 0% de propósito (uma
  // fatia igual automática reprecificaria o catálogo no ato do cadastro), e um
  // produto que só coubesse nela dividiria por zero.
  it("soma de pesos ZERO no subconjunto → média SIMPLES dele", () => {
    const nova: Machine = { ...X2D, id: "nova", name: "Nova", weight: 0 };
    const comNova = [...FROTA, nova];
    const so = resolveFleet(comNova, ["nova"]);
    expect(Number.isNaN(so.depreciationPerHour)).toBe(false);
    expect(so.weighted).toBe(false);
    expect(so.depreciationPerHour).toBeCloseTo(depreciationPerHourOf(nova), 10);

    // E com duas de peso zero, a média simples é a das duas.
    const outra: Machine = { ...MINI, id: "outra", name: "Outra", weight: 0 };
    const duas = resolveFleet([...comNova, outra], ["nova", "outra"]);
    expect(duas.weighted).toBe(false);
    expect(duas.watts).toBeCloseTo((X2D.watts + MINI.watts) / 2, 10);
  });

  it("máquina de peso zero NÃO puxa a média quando há quem pese", () => {
    const nova: Machine = { ...X2D, id: "nova", name: "Nova", weight: 0 };
    const com = resolveFleet([...FROTA, nova], ["a1", "nova"]);
    // Só a A1 tem peso, então ela leva 100% — a de 0% fica fora da conta, e é
    // isso que o aviso do modal de máquinas cobra do dono.
    expect(com.depreciationPerHour).toBeCloseTo(depreciationPerHourOf(A1), 10);
  });

  it("peso negativo é saneado, não propagado", () => {
    const torta: Machine = { ...A1, id: "torta", name: "Torta", weight: -50 };
    const f = resolveFleet([X2D, torta], ["x2d", "torta"]);
    // −50 vale 0: a X2D leva os 30 pontos inteiros.
    expect(f.depreciationPerHour).toBeCloseTo(depreciationPerHourOf(X2D), 10);
  });
});

// ===========================================================================
// 4. O DADO ÓRFÃO — molde TD-009
// ===========================================================================

describe("[FROTA] Fase 2 — conjunto vazio e ids inexistentes", () => {
  it("vazio (todo produto anterior à fase) → frota inteira, com badge", () => {
    const r = preco(produto({ machineIds: [] }));
    expect(r.machineMissing).toBe(true);
    expect(r.eligibleMachines.map((m) => m.id)).toEqual(["mini", "a1", "x2d"]);
    // E o preço é o mesmo da frota inteira — não quebra, só se anuncia.
    expect(r.suggestedPrice).toBeCloseTo(preco(produto()).suggestedPrice, 10);
  });

  it("id que não existe mais NÃO é ignorado em silêncio — mas as vivas VALEM", () => {
    const r = preco(produto({ machineIds: ["a1", "sumiu"] }));
    expect(r.machineMissing).toBe(true);
    // ⚠ Aqui a frota inteira seria PIOR que o subconjunto: o dono declarou a A1
    // e mais alguma coisa, e a parte que sobrou continua sendo uma declaração
    // dele. Cair na frota ADICIONARIA máquinas que ele nunca nomeou — o preço
    // subiria por conta de uma X2D que ele excluiu de propósito. Só o conjunto
    // que resolve para NADA vira frota inteira; o badge cobre os dois casos.
    expect(r.eligibleMachines.map((m) => m.id)).toEqual(["a1"]);
  });

  it("etapa extra com conjunto órfão acende o badge do produto inteiro", () => {
    const r = preco(
      produto({
        machineIds: ["a1"],
        stages: [
          {
            id: "s1",
            machineIds: ["sumiu"],
            printHours: 1,
            laborMinutes: 0,
            filaments: [],
          },
        ],
      }),
    );
    expect(r.machineMissing).toBe(true);
  });

  it("lista de máquinas VAZIA não explode o preço (TD-024)", () => {
    const r = calculatePricing(produto(), [], DEFAULT_FIXED_COSTS, SEM_ESTOQUE);
    expect(r.machineMissing).toBe(true);
    expect(r.depreciationCost).toBe(0);
    expect(r.energyCost).toBe(0);
    expect(Number.isFinite(r.suggestedPrice)).toBe(true);
  });
});

// ===========================================================================
// 5. A PONTE COM A PRODUÇÃO — "vazia só quando há dúvida" (dono, 2026-09-01)
// ===========================================================================

describe("[FROTA] Fase 2 — a máquina com que a linha de produção nasce", () => {
  it("UMA elegível: não há escolha a fazer, a linha já vem preenchida", () => {
    expect(initialRowMachineId(["x2d"], FROTA)).toBe("x2d");
  });

  it("DUAS ou mais: nasce vazia — o ROI só recebe o que o dono afirmou", () => {
    // A alternativa recusada era chutar a de maior peso: o peso diz com que
    // frequência a frota roda, não quem rodou ESTA placa, e um palpite que
    // ninguém confere vira atribuição errada no ROI, calada.
    expect(initialRowMachineId(["a1", "x2d"], FROTA)).toBe("");
    expect(initialRowMachineId(FROTA.map((m) => m.id), FROTA)).toBe("");
  });

  it("conjunto VAZIO também é dúvida: elegível a tudo é o oposto de só caber numa", () => {
    expect(initialRowMachineId([], FROTA)).toBe("");
    expect(initialRowMachineId(undefined, FROTA)).toBe("");
  });

  it("id órfão não conta como elegível", () => {
    expect(initialRowMachineId(["sumiu"], FROTA)).toBe("");
    expect(initialRowMachineId(["sumiu", "a1"], FROTA)).toBe("a1");
  });
});

// ===========================================================================
// 6. O FALLBACK MUDO QUE MORREU — o `?? machines[0]` do planEventRows
// ===========================================================================

const PECA = {
  ...produto({ machineIds: ["a1", "x2d"] }),
  id: "peca",
  name: "Peça",
  piecesCount: 1,
} as unknown as SavedProduct;

describe("[FROTA] Fase 2 — evento sem máquina custa a FROTA, não a primeira", () => {
  const planejar = (rows: ReturnType<typeof wholeEventRows>) => {
    let n = 0;
    return planEventRows(rows, "real", [], [], FROTA, () => `ev${(n += 1)}`, 0);
  };

  it("o custo sai da média do conjunto elegível", () => {
    const { built, summary } = planejar(wholeEventRows(PECA, FROTA, []));
    expect(built[0].machine).toBeUndefined();
    // Elegível a a1+x2d, pesos 40 e 30 → 4/7 e 3/7.
    const esperado =
      3 *
      ((40 * depreciationPerHourOf(A1) + 30 * depreciationPerHourOf(X2D)) / 70);
    expect(summary.frozenBreakdown.depreciation).toBeCloseTo(esperado, 10);
    // E NÃO o da A1 pura, que era o que o `?? machines[0]` cobrava calado.
    expect(summary.frozenBreakdown.depreciation).not.toBeCloseTo(
      3 * depreciationPerHourOf(A1),
      6,
    );
  });

  it("as horas dele NÃO entram no machineUsage — ficam órfãs", () => {
    const { summary } = planejar(wholeEventRows(PECA, FROTA, []));
    // Empurrá-lo com id vazio faria a soma `horas ÷ total` do ROI fechar em 1
    // sobre as máquinas conhecidas, rateando para elas o lucro das horas órfãs.
    expect(summary.machineUsage).toEqual([]);
    expect(summary.unattributedHours).toBeCloseTo(3, 10);
  });

  it("com a máquina escolhida, tudo volta ao normal", () => {
    const rows = wholeEventRows(PECA, FROTA, []).map((row) => ({
      ...row,
      machineId: "x2d",
    }));
    const { summary } = planejar(rows);
    expect(summary.unattributedHours).toBe(0);
    expect(summary.machineUsage.map((u) => u.machineId)).toEqual(["x2d"]);
    expect(summary.frozenBreakdown.depreciation).toBeCloseTo(
      3 * depreciationPerHourOf(X2D),
      10,
    );
  });
});

// ===========================================================================
// 7. A ENCOMENDA — a venda não tem quem escolha a máquina
// ===========================================================================

describe("[FROTA] Fase 2 — a encomenda conta as unidades sem lastro", () => {
  const ctx = (products: SavedProduct[]) => {
    let n = 0;
    return {
      goods: [],
      colors: [] as StockFilament[],
      supplies: [],
      products,
      machines: FROTA,
      fixedCosts: DEFAULT_FIXED_COSTS,
      at: 1000,
      createdAt: 1000,
      genId: () => `ev${(n += 1)}`,
    };
  };
  const item = (over: Partial<ReconItem> = {}): ReconItem => ({
    key: "k1",
    productId: "peca",
    productName: "Peça",
    quantity: 2,
    origem: "encomenda",
    ...over,
  });

  it("produto elegível a duas: o COGS está certo e as unidades são órfãs", () => {
    // Isto é o `unattributedUnits` da Fase 1 entrando pela porta nova. Sem ele,
    // `horas ÷ total` fecharia em 1 sobre as máquinas conhecidas (aqui, nenhuma)
    // e o lucro seria rateado para quem não imprimiu.
    const plan = reconcileReciboWrite([item()], null, ctx([PECA]));
    const [r] = plan.items;
    expect(r.machineUsage).toEqual([]);
    expect(r.unattributedUnits).toBe(2);
    // Custo certo e dono desconhecido são coisas separadas.
    expect(r.cogsTotal).toBeGreaterThan(0);
  });

  it("produto com UMA elegível: a linha nasce nela e a venda atribui", () => {
    const soX2d = { ...PECA, machineIds: ["x2d"] } as SavedProduct;
    const plan = reconcileReciboWrite([item()], null, ctx([soX2d]));
    const [r] = plan.items;
    expect(r.unattributedUnits).toBe(0);
    expect(r.machineUsage.map((u) => u.machineId)).toEqual(["x2d"]);
  });

  it("PARCIAL: uma etapa resolvida e outra não — a cobertura é por HORAS", () => {
    const misto = {
      ...PECA,
      machineIds: ["a1", "x2d"], // 3h sem dono
      stages: [
        {
          id: "s1",
          name: "Base",
          machineIds: ["x2d"], // 1h com dono
          printHours: 1,
          laborMinutes: 0,
          filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    const plan = reconcileReciboWrite([item()], null, ctx([misto]));
    const [r] = plan.items;
    expect(r.machineUsage.map((u) => u.machineId)).toEqual(["x2d"]);
    // 3 das 4 horas ficaram sem dono → 3/4 das 2 unidades. É por HORAS, e não
    // por evento, porque é assim que o ROI reparte lucro e receita.
    expect(r.unattributedUnits).toBeCloseTo(1.5, 10);
  });
});

// ===========================================================================
// 8. A ENCOMENDA PERGUNTA A MÁQUINA — o buraco que a Fase 2 deixou aberto
// ===========================================================================
//
// A encomenda cria os eventos SOZINHA, sem passar pela /producao. Sem uma
// escolha no modal de venda, todo produto elegível a 2+ impressoras vendia sem
// creditar horas a nenhuma no ROI: o custo saía certo (taxa da frota), a
// atribuição não existia. O seletor fecha isso — com a MESMA regra da /producao
// ("vazia só quando há dúvida").

describe("[FROTA] Fase 2 — a máquina escolhida na venda chega ao evento", () => {
  const ctx = (products: SavedProduct[]) => {
    let n = 0;
    return {
      goods: [],
      colors: [] as StockFilament[],
      supplies: [],
      products,
      machines: FROTA,
      fixedCosts: DEFAULT_FIXED_COSTS,
      at: 1000,
      createdAt: 1000,
      genId: () => `ev${(n += 1)}`,
    };
  };
  const item = (over: Partial<ReconItem> = {}): ReconItem => ({
    key: "k1",
    productId: "peca",
    productName: "Peça",
    quantity: 2,
    origem: "encomenda",
    ...over,
  });

  it("com a máquina escolhida, a venda ATRIBUI — nada fica órfão", () => {
    const plan = reconcileReciboWrite(
      [item({ machineId: "x2d" })],
      null,
      ctx([PECA]),
    );
    const [r] = plan.items;
    expect(r.unattributedUnits).toBe(0);
    expect(r.machineUsage.map((u) => u.machineId)).toEqual(["x2d"]);
    // E a depreciação passa a ser a REAL da X2D, não a média da frota.
    // ⚠ `cogsBreakdown` é POR UNIDADE, e a peça leva 3h: 3 × a taxa da X2D.
    expect(r.cogsBreakdown!.depreciation).toBeCloseTo(
      3 * depreciationPerHourOf(X2D),
      10,
    );
    // A prova de que não é a frota: a média de a1+x2d daria bem menos.
    expect(r.cogsBreakdown!.depreciation).toBeGreaterThan(
      3 * resolveFleet(FROTA, ["a1", "x2d"]).depreciationPerHour,
    );
  });

  it("sem escolher, continua órfã — o comportamento antigo não sumiu", () => {
    const plan = reconcileReciboWrite([item()], null, ctx([PECA]));
    expect(plan.items[0].unattributedUnits).toBe(2);
  });

  it("a escolha NÃO sobrescreve etapa que já tinha máquina resolvida", () => {
    // ⚠ Etapa com UMA elegível é fato, não dúvida. Carimbá-la com a escolha de
    // nível de item trocaria um dado por um palpite.
    const misto = {
      ...PECA,
      machineIds: ["a1", "x2d"], // ambígua: 3h
      stages: [
        {
          id: "s1", name: "Base", machineIds: ["mini"], // resolvida: 1h
          printHours: 1, laborMinutes: 0, filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    const plan = reconcileReciboWrite(
      [item({ machineId: "x2d" })],
      null,
      ctx([misto]),
    );
    const [r] = plan.items;
    const ids = r.machineUsage.map((u) => u.machineId).sort();
    expect(ids).toEqual(["mini", "x2d"]);
    // A Mini ficou com a hora dela; a X2D, com as três da etapa ambígua.
    // ⚠ `machineUsage` é POR UNIDADE ATRIBUÍDA — e a placa rende 1 peça, então
    // por unidade é exatamente o que a etapa gasta.
    const mini = r.machineUsage.find((u) => u.machineId === "mini")!;
    const x2d = r.machineUsage.find((u) => u.machineId === "x2d")!;
    expect(mini.hours).toBeCloseTo(1, 10);
    expect(x2d.hours).toBeCloseTo(3, 10);
    expect(r.unattributedUnits).toBe(0);
  });

  it("escolha que a etapa NÃO aceita é ignorada, e a etapa segue órfã", () => {
    // Quem grava é quem garante: o modal já oferece só a interseção, mas a regra
    // mora na reconciliação. Uma etapa que só cabe na Mini não vira "A1" porque
    // o item foi marcado assim.
    const soMini = {
      ...PECA,
      machineIds: ["mini", "x2d"],
      stages: [],
    } as unknown as SavedProduct;
    const plan = reconcileReciboWrite(
      [item({ machineId: "a1" })], // a1 não está no conjunto
      null,
      ctx([soMini]),
    );
    const [r] = plan.items;
    expect(r.machineUsage).toEqual([]);
    expect(r.unattributedUnits).toBe(2);
  });
});

describe("[FROTA] Fase 2 — o que o seletor da venda pode oferecer", () => {
  it("oferece a INTERSEÇÃO das etapas ambíguas, não a união", () => {
    // A pergunta é "em qual máquina esta encomenda rodou?" — uma resposta só.
    // A união deixaria escolher uma impressora que metade das etapas recusa, e a
    // reconciliação descartaria a escolha naquelas etapas, em silêncio.
    const p = {
      ...PECA,
      machineIds: ["mini", "a1", "x2d"],
      stages: [
        {
          id: "s1", machineIds: ["a1", "x2d"],
          printHours: 1, laborMinutes: 0, filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    const rows = wholeEventRows(p, FROTA, []);
    expect(encomendaMachineOptions(rows, FROTA)!.map((m) => m.id)).toEqual([
      "a1",
      "x2d",
    ]);
  });

  it("etapa JÁ resolvida fica fora da conta — ela não restringe o que falta", () => {
    // Incluí-la reduziria as opções da parte em aberto à única máquina dela.
    const p = {
      ...PECA,
      machineIds: ["mini", "a1", "x2d"], // ambígua
      stages: [
        {
          id: "s1", machineIds: ["mini"], // resolvida
          printHours: 1, laborMinutes: 0, filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    const rows = wholeEventRows(p, FROTA, []);
    expect(encomendaMachineOptions(rows, FROTA)!.map((m) => m.id)).toEqual([
      "mini",
      "a1",
      "x2d",
    ]);
  });

  it("sem interseção: não há resposta única, e o seletor não aparece", () => {
    const p = {
      ...PECA,
      machineIds: ["mini", "a1"],
      stages: [
        {
          id: "s1", machineIds: ["x2d"], printHours: 1,
          laborMinutes: 0, filaments: [],
        },
        {
          id: "s2", machineIds: ["mini", "x2d"], printHours: 1,
          laborMinutes: 0, filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    // s1 tem uma elegível só (resolvida). Sobram a principal (mini+a1) e a s2
    // (mini+x2d) — a interseção é só a Mini.
    const rows = wholeEventRows(p, FROTA, []);
    expect(encomendaMachineOptions(rows, FROTA)!.map((m) => m.id)).toEqual(["mini"]);
  });

  it("produto SEM conjunto (anterior à fase) pode ser qualquer uma da frota", () => {
    const antigo = { ...PECA, machineIds: [], stages: [] } as unknown as SavedProduct;
    const rows = wholeEventRows(antigo, FROTA, []);
    expect(encomendaMachineOptions(rows, FROTA)).toHaveLength(3);
  });

  // AUD-17 [E3] — a INVARIANTE que faltava: "nada ambíguo" e "sem interseção"
  // são estados OPOSTOS, e a função tem de devolver coisas distinguíveis. Com os
  // dois em `[]`, o modal exibia no caso BOM o aviso do caso RUIM ("o ROI não
  // credita ninguém") enquanto o documento gravava a atribuição certa.
  it("nada ambíguo devolve null — não o [] de 'sem interseção'", () => {
    const resolvido = {
      ...PECA, machineIds: ["x2d"], stages: [],
    } as unknown as SavedProduct;
    const rows = wholeEventRows(resolvido, FROTA, []);
    expect(rows.map((r) => r.machineId)).toEqual(["x2d"]); // tudo atribuído
    expect(encomendaMachineOptions(rows, FROTA)).toBeNull();
  });

  it("sem interseção devolve [] — e o [] não é null", () => {
    // Duas ambíguas sem nenhuma máquina em comum: a principal só na Mini+A1, uma
    // extra só na X2D+... — aqui não existe UMA resposta para o item inteiro.
    const p = {
      ...PECA,
      machineIds: ["mini", "a1"],
      stages: [
        {
          id: "s1", machineIds: ["x2d", "a1"], printHours: 1,
          laborMinutes: 0, filaments: [],
        },
        {
          id: "s2", machineIds: ["x2d", "mini"], printHours: 1,
          laborMinutes: 0, filaments: [],
        },
      ],
    } as unknown as SavedProduct;
    const rows = wholeEventRows(p, FROTA, []);
    // As três linhas nasceram ambíguas (2 elegíveis cada), e a interseção
    // {mini,a1} ∩ {x2d,a1} ∩ {x2d,mini} é vazia.
    expect(rows.every((r) => !r.machineId)).toBe(true);
    expect(encomendaMachineOptions(rows, FROTA)).toEqual([]);
    expect(encomendaMachineOptions(rows, FROTA)).not.toBeNull();
  });
});

// ===========================================================================
// AUD-17 [E4]/[E5] — o SELETOR conta o marcado VIVO, nunca o id salvo
//
// O doc `config/machines` é compartilhado e realtime: apagar uma impressora em
// outro dispositivo deixa produtos com id FANTASMA no conjunto. `selectedIds`
// então mente sobre duas coisas ao mesmo tempo — quantas caixas estão marcadas
// (para escolher o aviso) e quantas sobram ao desmarcar (para o guarda do
// no-op). Medido na tela em 2026-09-03: o aviso errado, e um clique que a regra
// escrita chama de no-op movendo o preço de R$27,14 para R$31,00.
// ===========================================================================

describe("[FROTA] Fase 2 — o seletor diante de um id apagado", () => {
  it("[E4] conjunto só com id órfão avisa 'frota inteira', não 'peso 0%'", () => {
    // O dado salvo NÃO é vazio (`length === 1`) — a CONTA é. Contar o fantasma
    // mandava a tela para o aviso da outra conta, com nada marcado.
    expect(["fantasma"].length).toBe(1);
    expect(selectedLive(FROTA, ["fantasma"])).toEqual([]);
    expect(machineSelectionNote(FROTA, ["fantasma"])).toBe("orfa");
    expect(machineSelectionNote(FROTA, ["fantasma", "outro"])).toBe("orfa");
    expect(machineSelectionNote(FROTA, [])).toBe("orfa");
  });

  it("[E4] o aviso descreve a conta que o resolveFleet de fato faz", () => {
    // "frota inteira" é literal: as três, PONDERADAS — não a média simples que
    // o outro aviso anuncia. Foi a divergência medida na tela (R$ 31,00 é o
    // ponderado; o simples daria outro número).
    const f = resolveFleet(FROTA, ["fantasma"]);
    expect(f.missing).toBe(true);
    expect(f.machines).toEqual(FROTA);
    expect(f.weighted).toBe(true);
  });

  it("[E4] 'peso-zero' é só quando HÁ marcada viva e o peso soma zero", () => {
    const novaSemPeso: Machine = { ...MINI, id: "nova", name: "Nova", weight: 0 };
    const frota = [...FROTA, novaSemPeso];
    expect(machineSelectionNote(frota, ["nova"])).toBe("peso-zero");
    expect(machineSelectionNote(frota, ["fantasma", "nova"])).toBe("peso-zero");
    expect(machineSelectionNote(frota, ["nova", "a1"])).toBeNull();
    expect(machineSelectionNote(FROTA, ["a1"])).toBeNull();
  });

  it("[E4] o controle: com um id vivo há marcada viva", () => {
    expect(selectedLive(FROTA, ["a1"]).map((m) => m.id)).toEqual(["a1"]);
    expect(selectedLive(FROTA, ["fantasma", "a1"]).map((m) => m.id)).toEqual(["a1"]);
  });

  it("[E5] desmarcar a última VIVA é no-op, mesmo com um fantasma ao lado", () => {
    // O guarda contava o Set salvo (2), deixava o clique passar, e a
    // reconstrução filtrava o fantasma — devolvendo [] e travando o Salvar.
    expect(toggleSelection(FROTA, ["fantasma", "a1"], "a1", false)).toBeNull();
    expect(toggleSelection(FROTA, ["a1"], "a1", false)).toBeNull();
  });

  it("[E5] com duas vivas, desmarcar uma passa — e o fantasma sai junto", () => {
    expect(toggleSelection(FROTA, ["fantasma", "a1", "x2d"], "a1", false)).toEqual([
      "x2d",
    ]);
  });

  it("[E5] marcar nunca é no-op, e o resultado sai na ordem do cadastro", () => {
    expect(toggleSelection(FROTA, ["fantasma"], "x2d", true)).toEqual(["x2d"]);
    expect(toggleSelection(FROTA, ["x2d"], "mini", true)).toEqual(["mini", "x2d"]);
  });

  it("[E5] o conjunto que sai do seletor nunca esvazia — invariante do controle", () => {
    // Qualquer clique de desmarcar, em qualquer conjunto com pelo menos uma
    // viva, ou é recusado ou devolve uma lista não-vazia. É a promessa que o
    // `validateProduct` cobra tarde demais, feita aqui no ato do clique.
    const conjuntos = [
      ["a1"], ["fantasma", "a1"], ["fantasma", "a1", "x2d"],
      ["mini", "a1", "x2d"], ["fantasma", "outro", "mini"],
    ];
    for (const ids of conjuntos) {
      for (const m of selectedLive(FROTA, ids)) {
        const next = toggleSelection(FROTA, ids, m.id, false);
        expect(next === null || next.length > 0).toBe(true);
      }
    }
  });
});
