import { describe, expect, it } from "vitest";
import {
  canUndo,
  describeEnergyTariffChange,
  describeFixedCostChanges,
  describeMachineChanges,
  fixedCostProposal,
  machinesProposal,
  describeStockColorEdit,
  stockChangePayload,
  stockEditPayload,
  stockRepriceWarning,
  summarizeChange,
  toChangeImpact,
  undoLabelOf,
  undoProposal,
} from "./changeLog";
import { computeRepriceImpact, type RepriceLevers } from "./repriceImpact";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
// ⚠ O `formatCurrency` põe ESPAÇO NÃO-SEPARÁVEL entre "R$" e o número (é o
// `Intl` do pt-BR). Escrever "R$ 1.500,00" à mão aqui compara contra um espaço
// comum e falha com as duas strings idênticas na tela — por isso a expectativa
// usa a própria função.
import { formatCurrency } from "@/lib/formatting/currency";
import type {
  ChangeRecord,
  FixedCostRate,
  Machine,
  SavedProduct,
  StockFilament,
} from "../types";

// ---------------------------------------------------------------------------
// [FEAT-12] — a REDAÇÃO da mudança, a proposta e o desfazer.
//
// A conta do preço é do `repriceImpact.test.ts`. Aqui se trava o que se DIZ
// sobre a alavanca e o que o desfazer restaura — as duas coisas que, ficando no
// JSX, nenhum teste alcançaria (AUD-17 [E3]/[E8]).
// ---------------------------------------------------------------------------

const A1: Machine = {
  id: "a1", name: "A1 Combo", price: 5299, lifeHours: 7500,
  watts: 95, maintenancePerHour: 0.12, weight: 40,
};
const X2D: Machine = {
  id: "x2d", name: "X2D Combo", price: 13999, lifeHours: 7500,
  watts: 150, maintenancePerHour: 0.2, weight: 40,
};
const FROTA = [A1, X2D];

const TAXA: FixedCostRate = {
  rent: 1500, other: 150, machines: 2, hoursDay: 20, daysMonth: 26,
};

function produto(id: string, over: Partial<SavedProduct> = {}): SavedProduct {
  return {
    ...DEFAULT_PRODUCT_INPUT,
    id,
    name: id,
    machineIds: FROTA.map((m) => m.id),
    printHours: 3,
    failureRate: 0,
    filaments: [
      { filamentId: null, colorName: "Azul", material: "PLA", pricePerKg: 110, totalG: 40 },
    ],
    ...over,
  };
}

const levers = (machines: Machine[]): RepriceLevers => ({
  machines,
  fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: false },
  energyTariff: 0.8,
  stock: [],
  supplies: [],
});

// ===========================================================================
// 1. A redação — uma linha por campo que MOVE PREÇO
// ===========================================================================

describe("[FEAT-12] descrição da mudança de frota", () => {
  it("uma linha por campo alterado, com o nome da máquina na frente", () => {
    const linhas = describeMachineChanges(FROTA, [
      { ...A1, lifeHours: 750 },
      X2D,
    ]);
    expect(linhas).toEqual(["A1 Combo · vida útil 7.500 h → 750 h"]);
  });

  it("inteiro se escreve inteiro; o resto mantém as duas casas", () => {
    // Vida útil "7.500,00 h" e dias do mês "26,00" são ruído; a manutenção é
    // R$0,12/h e precisa das casas.
    const linhas = describeMachineChanges(FROTA, [
      { ...A1, maintenancePerHour: 0.35, watts: 120 },
      X2D,
    ]);
    expect(linhas).toEqual([
      "A1 Combo · consumo 95 W → 120 W",
      `A1 Combo · manutenção ${formatCurrency(0.12)}/h → ${formatCurrency(0.35)}/h`,
    ]);
  });

  it("renomear NÃO move preço, mas entra: sem ela as outras linhas falam de um nome que não existia", () => {
    const linhas = describeMachineChanges(FROTA, [
      { ...A1, name: "A1 (bancada)", weight: 20 },
      X2D,
    ]);
    expect(linhas).toEqual([
      "A1 Combo · renomeada para A1 (bancada)",
      "A1 (bancada) · peso na frota 40 % → 20 %",
    ]);
  });

  it("máquina EXCLUÍDA se anuncia por extenso, com a consequência", () => {
    // É a única linha que muda o SIGNIFICADO do conjunto salvo em cada produto,
    // e não só um número: o id vira órfão e o `resolveFleet` cai na frota
    // inteira. Escrever "X2D · removida" esconderia isso.
    const linhas = describeMachineChanges(FROTA, [A1]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain("X2D Combo");
    expect(linhas[0]).toContain("EXCLUÍDA");
    expect(linhas[0]).toContain("frota inteira");
  });

  it("máquina adicionada é uma linha só — ela nasce a 0% e não move preço nenhum", () => {
    const nova: Machine = {
      id: "nova", name: "P1S", price: 6000, lifeHours: 7500,
      watts: 120, maintenancePerHour: 0.15, weight: 0,
    };
    expect(describeMachineChanges(FROTA, [...FROTA, nova])).toEqual([
      "P1S · adicionada",
    ]);
  });

  it("nada mudou é lista VAZIA — e é assim que o modal sabe não gravar", () => {
    expect(describeMachineChanges(FROTA, [...FROTA])).toEqual([]);
    expect(describeFixedCostChanges(TAXA, { ...TAXA })).toEqual([]);
  });

  it("o custo fixo descreve em R$/mês e sem unidade onde não há", () => {
    expect(
      describeFixedCostChanges(TAXA, { ...TAXA, rent: 3000, daysMonth: 30 }),
    ).toEqual([
      `aluguel ${formatCurrency(1500)}/mês → ${formatCurrency(3000)}/mês`,
      "dias/mês 26 → 30",
    ]);
  });
});

describe("[FEAT-12] a frase de uma linha", () => {
  it("um campo só vira a própria linha", () => {
    expect(summarizeChange("maquinas", ["A1 Combo · consumo 95 W → 120 W"])).toBe(
      "A1 Combo · consumo 95 W → 120 W",
    );
  });

  it("vários campos viram a contagem, com o nome da alavanca", () => {
    expect(summarizeChange("custo-fixo", ["a", "b", "c"])).toBe(
      "Custo fixo · 3 campos alterados",
    );
  });

  it("lista vazia se ANUNCIA em vez de virar frase vaga", () => {
    expect(summarizeChange("maquinas", [])).toBe("sem alteração");
  });
});

// ===========================================================================
// 2. A proposta — o "antes" congelado, o outro lado parado
// ===========================================================================

describe("[FEAT-12] proposta", () => {
  it("mexer na frota deixa o custo fixo PARADO nos dois lados", () => {
    const p = machinesProposal(FROTA, [{ ...A1, watts: 120 }, X2D], TAXA, 0.8);
    expect(p.lever).toBe("maquinas");
    expect(p.fixedRateBefore).toBe(p.fixedRateAfter);
    expect(p.before.machines).toHaveLength(2);
    expect(p.after.machines?.[0].watts).toBe(120);
    // O campo do outro lado é `null`, não `undefined`: o Firestore não aceita
    // `undefined`, e um campo faltando viraria omissão silenciosa na leitura.
    expect(p.before.fixedCostRate).toBeNull();
    expect(p.before.unitPrice).toBeNull();
  });

  it("mexer no custo fixo deixa a FROTA parada nos dois lados", () => {
    const p = fixedCostProposal(TAXA, { ...TAXA, rent: 3000 }, FROTA, 0.8);
    expect(p.lever).toBe("custo-fixo");
    expect(p.machinesBefore).toBe(p.machinesAfter);
    expect(p.after.fixedCostRate?.rent).toBe(3000);
    expect(p.before.machines).toBeNull();
  });

  it("o `before` é uma CÓPIA: mexer na lista viva depois não reescreve o rastro", () => {
    const viva = [{ ...A1 }, { ...X2D }];
    const p = machinesProposal(viva, [{ ...A1, watts: 120 }, X2D], TAXA, 0.8);
    viva[0].watts = 999;
    expect(p.before.machines?.[0].watts).toBe(95);
  });
});

// ===========================================================================
// 3. O desfazer, derivado do registro (peça 6)
// ===========================================================================

function registro(over: Partial<ChangeRecord> = {}): ChangeRecord {
  return {
    id: "r1",
    at: 1,
    by: "dono@exemplo.com",
    lever: "maquinas",
    summary: "A1 Combo · consumo 95 W → 120 W",
    details: ["A1 Combo · consumo 95 W → 120 W"],
    before: { machines: FROTA, fixedCostRate: null, energyTariff: null, unitPrice: null },
    after: {
      machines: [{ ...A1, watts: 120 }, X2D],
      fixedCostRate: null,
      energyTariff: null,
      unitPrice: null,
    },
    impact: {
      evaluated: 1, affected: 1, up: 1, down: 0, avgPct: 1,
      top: [], crossings: [],
    },
    undoOf: null,
    ...over,
  };
}

describe("[FEAT-12] desfazer", () => {
  it("frota e custo fixo se desfazem; cor e insumo NÃO", () => {
    expect(canUndo(registro())).toBe(true);
    expect(
      canUndo(
        registro({
          lever: "custo-fixo",
          before: { machines: null, fixedCostRate: TAXA, energyTariff: null, unitPrice: null },
        }),
      ),
    ).toBe(true);
    // Desfazer um lote novo seria APAGAR o lote, que é dado de estoque, não uma
    // alavanca de configuração.
    expect(canUndo(registro({ lever: "cor" }))).toBe(false);
    expect(canUndo(registro({ lever: "insumo" }))).toBe(false);
    expect(undoLabelOf(registro({ lever: "cor" }))).toBeNull();
  });

  it("entrada sem o `before` não vira botão morto — ela simplesmente não desfaz", () => {
    // O repositório DESCARTA um `before` torto em vez de montar meio objeto
    // (AUD-16 [E5]); aqui isso tem de virar "não dá", não um save de lista vazia.
    const torto = registro({
      before: { machines: null, fixedCostRate: null, energyTariff: null, unitPrice: null },
    });
    expect(canUndo(torto)).toBe(false);
    expect(undoProposal(torto, FROTA, TAXA, 0.8)).toBeNull();
  });

  it("desfazer parte do estado ATUAL, não do `after` gravado", () => {
    // Entre a mudança e o desfazer pode ter havido outra. Desfazer é "volte para
    // aquele estado", e a prévia tem de mostrar o caminho a partir de onde o
    // preço está AGORA — senão ela descreve um movimento que já não existe.
    const agora = [{ ...A1, watts: 200 }, X2D];
    const p = undoProposal(registro(), agora, TAXA, 0.8);
    expect(p).not.toBeNull();
    expect(p!.machinesBefore).toBe(agora);
    expect(p!.machinesAfter).toBe(registro().before.machines);
    expect(p!.details).toEqual(["A1 Combo · consumo 200 W → 95 W"]);
  });

  it("uma entrada que JÁ é desfazer continua desfazível", () => {
    // Desfazer o desfazer é só mais uma mudança global, com o próprio rastro.
    expect(canUndo(registro({ undoOf: "r0" }))).toBe(true);
  });

  it("o desfazer passa pela MESMA prévia: ele reprecifica de volta", () => {
    const produtos = [produto("chaveiro")];
    const p = undoProposal(registro(), [{ ...A1, watts: 200 }, X2D], TAXA, 0.8)!;
    const impacto = computeRepriceImpact(
      produtos,
      levers(p.machinesBefore),
      levers(p.machinesAfter),
    );
    expect(impacto.affected).toBe(1);
    // 200 W → 95 W é menos energia: o preço CAI.
    expect(impacto.down).toBe(1);
  });
});

// ===========================================================================
// 4. O que vai para o documento — resumo, nunca o catálogo
// ===========================================================================

describe("[FEAT-12] o impacto GRAVADO", () => {
  it("corta o `top` em dez e guarda só id/nome/antes/depois", () => {
    const produtos = Array.from({ length: 25 }, (_, i) =>
      produto(`p${String(i).padStart(2, "0")}`, { printHours: 1 + i }),
    );
    const impacto = computeRepriceImpact(
      produtos,
      levers(FROTA),
      levers(FROTA.map((m) => ({ ...m, lifeHours: 750 }))),
    );
    const gravado = toChangeImpact(impacto);

    expect(gravado.affected).toBe(25);
    expect(gravado.top).toHaveLength(10);
    expect(Object.keys(gravado.top[0]).sort()).toEqual([
      "after",
      "before",
      "id",
      "name",
    ]);
  });

  it("o cruzamento guarda a FAIXA, não o percentual que a produziu", () => {
    const naBorda = produto("na-borda", {
      markup: 3,
      includeFixed: true,
      laborMinutes: 0,
    });
    const semFixo: RepriceLevers = {
      machines: FROTA,
      fixedCosts: { ...DEFAULT_FIXED_COSTS, enabled: true, rent: 0, other: 0 },
      energyTariff: 0.8,
      stock: [],
      supplies: [],
    };
    const comFixo: RepriceLevers = {
      ...semFixo,
      fixedCosts: {
        ...DEFAULT_FIXED_COSTS, enabled: true, rent: 30000, other: 0,
      },
    };
    const gravado = toChangeImpact(
      computeRepriceImpact([naBorda], semFixo, comFixo),
    );
    expect(gravado.crossings).toHaveLength(1);
    expect(gravado.crossings[0].from).toBe("good");
    expect(gravado.crossings[0].to).not.toBe("good");
  });
});

// ===========================================================================
// 5. As alavancas de "conta depois"
// ===========================================================================

describe("[FEAT-12] cotação do estoque", () => {
  it("a frase carrega a unidade — cor cota em R$/kg, insumo em R$/un", () => {
    const impacto = computeRepriceImpact([], levers(FROTA), levers(FROTA));
    const cor = stockChangePayload({
      lever: "cor",
      label: "PLA Basic · Preto · Bambu",
      unit: "R$/kg",
      priceBefore: 110,
      priceAfter: 160,
      by: "dono@exemplo.com",
      impact: impacto,
      at: 123,
    });
    expect(cor.summary).toBe(
      `PLA Basic · Preto · Bambu · cotação ${formatCurrency(110)}/kg → ${formatCurrency(160)}/kg`,
    );
    expect(cor.details).toEqual([cor.summary]);
    expect(cor.at).toBe(123);
    expect(cor.undoOf).toBeNull();

    const insumo = stockChangePayload({
      lever: "insumo",
      label: "Ímã 6×2mm",
      unit: "R$/un",
      priceBefore: 0.5,
      priceAfter: 2,
      by: "dono@exemplo.com",
      impact: impacto,
    });
    expect(insumo.summary).toBe(
      `Ímã 6×2mm · cotação ${formatCurrency(0.5)}/un → ${formatCurrency(2)}/un`,
    );
  });

  it("guarda só a COTAÇÃO nos dois lados — restaurar não é opção aqui", () => {
    const payload = stockChangePayload({
      lever: "cor",
      label: "Azul",
      unit: "R$/kg",
      priceBefore: 110,
      priceAfter: 160,
      by: "",
      impact: computeRepriceImpact([], levers(FROTA), levers(FROTA)),
    });
    expect(payload.before).toEqual({
      machines: null, fixedCostRate: null, energyTariff: null, unitPrice: 110,
    });
    expect(payload.after.unitPrice).toBe(160);
    // E o registro que sai daqui não oferece desfazer.
    expect(canUndo({ ...payload, id: "x" })).toBe(false);
  });
});

// [V2] — arquivar/excluir/renomear no Estoque reprecificava calado: o produto
// sem marca fixada cobra a MAIOR cotação entre as marcas ATIVAS.
describe("[V2] mudança de cadastro de cor no Estoque", () => {
  const marca = (id: string, brand: string, pricePerKg: number, over: Partial<StockFilament> = {}): StockFilament => ({
    id,
    material: "PLA",
    brand,
    colorName: "Azul",
    minG: 0,
    archived: false,
    rolls: [{ id: `${id}_r`, purchaseDate: 0, initialG: 1000, remainingG: 1000, pricePerKg }],
    adjustments: [],
    createdAt: 0,
    ...over,
  });
  const comEstoque = (stock: StockFilament[]): RepriceLevers => ({ ...levers(FROTA), stock });
  const barata = marca("barata", "Voolt", 90);
  const cara = marca("cara", "Bambu", 160);

  it("arquivar a marca mais cara BAIXA o produto sem marca fixada — e a confirmação diz isso", () => {
    const impacto = computeRepriceImpact(
      [produto("p1")],
      comEstoque([barata, cara]),
      comEstoque([barata, { ...cara, archived: true }]),
    );
    expect(impacto.affected).toBe(1);
    expect(impacto.down).toBe(1);
    expect(stockRepriceWarning(impacto)).toBe(
      "Isto muda o preço de 1 produto do catálogo (1 desce).",
    );
  });

  it("renomear a cor desliga o produto do Estoque — preço move, e há o que confirmar", () => {
    const impacto = computeRepriceImpact(
      [produto("p1"), produto("p2")],
      comEstoque([cara]),
      comEstoque([{ ...cara, colorName: "Azul Royal" }]),
    );
    expect(impacto.affected).toBe(2);
    expect(stockRepriceWarning(impacto)).toMatch(/^Isto muda o preço de 2 produtos/);
  });

  it("sem preço movido não há o que confirmar", () => {
    const impacto = computeRepriceImpact([produto("p1")], comEstoque([cara]), comEstoque([cara]));
    expect(stockRepriceWarning(impacto)).toBeNull();
  });

  it("o registro diz a ação, sem desfazer", () => {
    const payload = stockEditPayload({
      label: "PLA · Azul · Bambu",
      action: "arquivada",
      by: "dono@exemplo.com",
      impact: computeRepriceImpact([], levers(FROTA), levers(FROTA)),
      at: 7,
    });
    expect(payload.summary).toBe("PLA · Azul · Bambu · arquivada");
    expect(payload.details).toEqual([payload.summary]);
    expect(payload.lever).toBe("cor");
    expect(payload.at).toBe(7);
    expect(canUndo({ ...payload, id: "x" })).toBe(false);
  });

  it("a edição descreve só material/cor/marca, campo a campo", () => {
    const base = { material: "PLA", colorName: "Azul", brand: "Bambu" };
    expect(describeStockColorEdit(base, { ...base, colorName: "Azul Royal" })).toEqual([
      "cor Azul → Azul Royal",
    ]);
    expect(describeStockColorEdit(base, { ...base })).toEqual([]);
    expect(describeStockColorEdit(base, { ...base, brand: "" })).toEqual(["marca Bambu → (vazio)"]);
  });
});

describe("[V7] a tarifa de energia no rastro", () => {
  // Com 2 casas, 0,8543 → 0,8499 virava "R$ 0,85 → R$ 0,85": uma mudança real
  // que o rastro descrevia como nenhuma.
  it("mostra as frações de centavo que a tarifa tem", () => {
    const [linha] = describeEnergyTariffChange(0.8543, 0.8499);
    expect(linha).toContain("0,8543");
    expect(linha).toContain("0,8499");
  });

  it("valor redondo continua com 2 casas", () => {
    const [linha] = describeEnergyTariffChange(0.8, 0.85);
    expect(linha).toContain("0,80");
    expect(linha).toContain("0,85");
  });
});
