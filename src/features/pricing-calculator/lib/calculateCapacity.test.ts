import { describe, expect, it } from "vitest";
import { calculateCapacity } from "./calculateCapacity";
import { calculatePricing } from "./calculatePricing";
import { DEFAULT_PRODUCT_INPUT, DEFAULT_MACHINES } from "../constants";
import type {
  CapacitySettings,
  FixedCostSettings,
  ProductInput,
} from "../types";

function makeProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  // [FROTA] Fase 2 — o `DEFAULT_PRODUCT_INPUT` nasce com `machineIds: []` (ele
  // não conhece a frota viva; quem marca todas é o formulário). A cobaia declara
  // a A1 explicitamente para os números abaixo continuarem sendo os da A1 pura —
  // um conjunto UNITÁRIO tem média ponderada igual ao seu único membro, então a
  // taxa de frota reduz ao custo daquela máquina. Quem exercita conjunto de 2+ é
  // o `frotaFase2.test.ts`.
  return { ...DEFAULT_PRODUCT_INPUT, machineIds: ["a1"], ...overrides };
}

const NO_FIXED: FixedCostSettings = {
  enabled: false,
  rent: 0,
  other: 0,
  machines: 1,
  hoursDay: 20,
  daysMonth: 26,
};

function priceOf(product: ProductInput) {
  return calculatePricing(product, DEFAULT_MACHINES, NO_FIXED);
}

// Os casos herdados foram escritos quando o horizonte era 30 dias fixos e a
// falha não descontava volume (pré TD-010/TD-011); passar `daysMonth: 30` e
// `failureRate: 0` preserva a intenção original de cada um. Os casos novos no
// fim do arquivo cobrem as duas mudanças.
function legacySettings(
  overrides: Partial<CapacitySettings> = {},
): CapacitySettings {
  return { hoursDay: 20, machines: 1, daysMonth: 30, ...overrides };
}

function makeProductNoFail(overrides: Partial<ProductInput> = {}): ProductInput {
  return makeProduct({ failureRate: 0, ...overrides });
}

describe("calculateCapacity", () => {
  it("conta ciclos sobre o horizonte mensal (20h/dia, job de 3h)", () => {
    const product = makeProductNoFail();
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // floor((20*30)/3)*1 = floor(200) = 200 ciclos/mês
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(200);
    expect(cap?.cyclesDay).toBeCloseTo(200 / 30, 6);
  });

  it("mais máquinas multiplicam a capacidade", () => {
    const product = makeProductNoFail();
    const cap = calculateCapacity(
      priceOf(product),
      product,
      legacySettings({ machines: 3 }),
    );
    expect(cap?.cyclesMonth).toBe(600);
  });

  it("etapa extra soma no tempo total de impressão e reduz os ciclos", () => {
    const product = makeProductNoFail({
      stages: [
        {
          machineIds: ["a1"],
          weightG: 10,
          printHours: 1,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // total = 3 + 1 = 4h -> floor(600/4) = 150
    expect(cap?.cyclesMonth).toBe(150);
  });

  // ⚠ [FROTA] Fase 2 — este teste provava o CONTRÁRIO até hoje: "o gargalo é a
  // A1 (3h), então 200 ciclos, não 120". O gargalo saía do `machineUsage` da
  // precificação, e ele era a máquina escolhida para PRECIFICAR — a Fase 1 já
  // tinha provado que não é a que imprime. Com a etapa declarando um CONJUNTO,
  // não existe mais atribuição de onde tirar paralelismo: as duas etapas podem
  // cair na mesma impressora. O ciclo voltou a ser a SOMA (o pior caso honesto),
  // e o `machineBreakdown` saiu do resultado.
  it("etapas em máquinas diferentes: o ciclo é a SOMA, sem inventar paralelismo", () => {
    const product = makeProductNoFail({
      printHours: 3,
      stages: [
        {
          machineIds: ["x2d"],
          weightG: 10,
          printHours: 2,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    // 3 + 2 = 5h -> floor(600/5) = 120.
    expect(cap?.cyclesMonth).toBe(120);
    expect(cap?.piecesMonth).toBe(120);
  });

  // DEC-06 (dono, 2026-08-16) — este caso é a definição de `machines`, não um
  // efeito colateral: N CÓPIAS IDÊNTICAS do conjunto que o produto usa. Produto
  // A1+X2D com `machines: 2` pressupõe 2 A1 e 2 X2D = 4 impressoras, e por isso
  // 400 ciclos está CERTO. A oficina real tem 2 máquinas, uma de cada — quem
  // preencher `machines: 2` pensando "tenho 2 impressoras" projeta o dobro. A
  // saída escolhida foi tornar a premissa VISÍVEL (aviso no CapacityPanel), não
  // mudar a conta.
  it("o multiplicador de máquinas escala o ciclo", () => {
    const product = makeProductNoFail({
      printHours: 3,
      stages: [
        {
          machineIds: ["x2d"],
          weightG: 10,
          printHours: 2,
          filamentPricePerKg: 110,
          laborMinutes: 0,
        },
      ],
    });
    const cap = calculateCapacity(
      priceOf(product),
      product,
      legacySettings({ machines: 2 }),
    );
    // [FROTA] Fase 2 — o ciclo é a soma (3 + 2 = 5h): floor(600/5) = 120, ×2
    // conjuntos = 240. O `× machines` (DEC-06) é o que este teste guarda, e ele
    // não mudou; o que mudou é o ciclo sobre o qual ele incide.
    expect(cap?.cyclesMonth).toBe(240);
  });

  it("piecesCount multiplica as peças por ciclo", () => {
    const product = makeProductNoFail({ piecesCount: 2 });
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    expect(cap?.cyclesMonth).toBe(200);
    expect(cap?.piecesMonth).toBe(400); // 200 ciclos × 2 peças
  });

  it("devolve null sem horas de impressão, sem horas/dia ou sem dias/mês", () => {
    const semHoras = makeProduct({ printHours: 0, stages: [] });
    expect(
      calculateCapacity(priceOf(semHoras), semHoras, legacySettings()),
    ).toBeNull();

    const product = makeProduct();
    expect(
      calculateCapacity(priceOf(product), product, legacySettings({ hoursDay: 0 })),
    ).toBeNull();
    expect(
      calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 0 }),
      ),
    ).toBeNull();
  });

  it("fixedIncluded reflete se o custo fixo entrou no preço", () => {
    const product = makeProduct();
    const cap = calculateCapacity(priceOf(product), product, legacySettings());
    expect(cap?.fixedIncluded).toBe(false);
  });

  // TD-010 — o horizonte usa o MESMO mês que rateia o custo fixo (daysMonth).
  describe("TD-010 — horizonte por daysMonth", () => {
    it("26 dias rendem menos ciclos no mês que 30", () => {
      const product = makeProductNoFail();
      const cap = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 26 }),
      );
      // floor((20*26)/3) = floor(173,33) = 173 ciclos (contra 200 com 30 dias)
      expect(cap?.cyclesMonth).toBe(173);
      expect(cap?.piecesMonth).toBe(173);
    });

    it("a média DIÁRIA não muda com o número de dias do mês", () => {
      const product = makeProductNoFail();
      const trinta = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 30 }),
      );
      const vinteSeis = calculateCapacity(
        priceOf(product),
        product,
        legacySettings({ daysMonth: 26 }),
      );
      // 200/30 = 6,67 e 173/26 = 6,65 — numerador e denominador escalam juntos.
      expect(vinteSeis!.cyclesDay).toBeCloseTo(trinta!.cyclesDay, 1);
      expect(vinteSeis!.piecesDay).toBeCloseTo(trinta!.piecesDay, 1);
    });
  });

  // TD-011 — peças/mês são peças BOAS; ciclos incluem a impressão que falhou.
  describe("TD-011 — a taxa de falha desconta o volume", () => {
    it("3% de falha corta as peças, não os ciclos", () => {
      const product = makeProduct({ failureRate: 3 });
      const result = priceOf(product);
      const cap = calculateCapacity(result, product, legacySettings());
      expect(cap?.cyclesMonth).toBe(200); // a máquina roda a peça que falha
      expect(cap?.piecesMonth).toBe(194); // floor(200 × 0,97)
      expect(cap?.failureRatePct).toBeCloseTo(3, 6);
      expect(cap?.grossMonth).toBeCloseTo(194 * result.suggestedPrice, 6);
    });

    it("sem falha configurada, nada é descontado", () => {
      const product = makeProductNoFail();
      const cap = calculateCapacity(priceOf(product), product, legacySettings());
      expect(cap?.piecesMonth).toBe(cap!.cyclesMonth);
      expect(cap?.failureRatePct).toBe(0);
    });

    it("a taxa de falha desconta sobre o ciclo somado", () => {
      // [FROTA] Fase 2 — era "a máquina com folga também rende peças boas", e a
      // folga por máquina saiu com o `machineBreakdown`. O que continua valendo
      // (e é o ponto do TD-011) é que a falha deflaciona PEÇAS, não CICLOS.
      const product = makeProduct({
        failureRate: 3,
        printHours: 3,
        stages: [
          {
            machineIds: ["x2d"],
            weightG: 10,
            printHours: 2,
            filamentPricePerKg: 110,
            laborMinutes: 0,
          },
        ],
      });
      const cap = calculateCapacity(priceOf(product), product, legacySettings());
      expect(cap?.cyclesMonth).toBe(120); // 5h de ciclo, o mês inteiro
      expect(cap?.piecesMonth).toBe(116); // floor(120 × 0,97)
    });
  });
});
