import { describe, expect, it } from "vitest";
import { computeMachineRoi } from "./machineRoi";
import type { Machine, ProductionEvent, Sale } from "../types";

const DAY = 24 * 60 * 60 * 1000;
// Data-base realista (saleDate é sempre um timestamp real, nunca 0).
const BASE = Date.UTC(2026, 0, 1);

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "a1",
    name: "A1 Combo",
    price: 5299,
    lifeHours: 10000,
    watts: 95,
    maintenancePerHour: 0.12,
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    reciboId: "r1",
    saleDate: 0,
    customer: "",
    material: "",
    paymentMethod: "pix",
    channel: "quiosque",
    notes: "",
    status: "concluida",
    productId: "p1",
    productName: "Peça",
    machineId: "a1",
    machineName: "A1 Combo",
    printHours: 2,
    quantity: 1,
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
    totalCost: 20,
    totalRevenue: 50,
    feeRate: 0,
    feeAmount: 0,
    feePassedToCustomer: false,
    profit: 30,
    margin: 60,
    createdAt: 0,
    ...overrides,
  };
}

// Evento de produção (FEAT-04c): a fonte das horas/vida. Um evento = uma
// impressão (sem `quantity`), com uma máquina só.
function prod(overrides: Partial<ProductionEvent> = {}): ProductionEvent {
  return {
    id: "e1",
    at: BASE,
    outcome: "estoque",
    mode: "real",
    productName: "Peça",
    machineId: "a1",
    machineName: "A1 Combo",
    printHours: 2,
    filaments: [],
    frozenCost: 10,
    stockMoves: [],
    createdAt: BASE,
    ...overrides,
  };
}

describe("computeMachineRoi", () => {
  it("máquina sem uso aparece zerada", () => {
    const [roi] = computeMachineRoi([machine()], [], []);
    expect(roi.salesCount).toBe(0);
    expect(roi.printedCount).toBe(0);
    expect(roi.printedHours).toBe(0);
    expect(roi.profit).toBe(0);
    expect(roi.paybackFraction).toBe(0);
    expect(roi.isPaidBack).toBe(false);
    expect(roi.monthsToPayback).toBeNull();
    expect(roi.firstSaleDate).toBeNull();
  });

  it("atribui vendas pela machineId (ignora as de outra máquina)", () => {
    const roi = computeMachineRoi(
      [machine({ id: "a1" }), machine({ id: "x2d", name: "X2D" })],
      [
        sale({ id: "s1", machineId: "a1", profit: 30 }),
        sale({ id: "s2", machineId: "x2d", profit: 99 }),
      ],
    );
    const a1 = roi.find((r) => r.machine.id === "a1")!;
    const x2d = roi.find((r) => r.machine.id === "x2d")!;
    expect(a1.salesCount).toBe(1);
    expect(a1.profit).toBe(30);
    expect(x2d.salesCount).toBe(1);
    expect(x2d.profit).toBe(99);
  });

  it("soma receita/lucro/depreciação das vendas ponderando pela quantidade", () => {
    const [roi] = computeMachineRoi(
      [machine({ price: 5299, lifeHours: 10000 })],
      [
        sale({ id: "s1", quantity: 3, totalRevenue: 150, profit: 90 }),
        sale({ id: "s2", quantity: 1, totalRevenue: 60, profit: 40 }),
      ],
    );
    expect(roi.units).toBe(4);
    expect(roi.revenue).toBe(210);
    expect(roi.profit).toBe(130);
    // depreciação recuperada = 1/un × (3 + 1) unidades
    expect(roi.depreciationRecovered).toBeCloseTo(4, 6);
    // Sem produção, a vida útil fica zerada (as horas não saem mais da venda).
    expect(roi.printedHours).toBe(0);
    expect(roi.lifeUsedFraction).toBe(0);
  });

  describe("vida útil vem da produção (FEAT-04c)", () => {
    it("soma horas de TODOS os desfechos, inclusive teste e falha", () => {
      const [roi] = computeMachineRoi(
        [machine({ lifeHours: 10000 })],
        [],
        [
          prod({ id: "e1", outcome: "estoque", printHours: 5 }),
          prod({ id: "e2", outcome: "teste", printHours: 1 }),
          prod({ id: "e3", outcome: "falha", printHours: 4 }),
        ],
      );
      expect(roi.printedCount).toBe(3);
      expect(roi.printedHours).toBe(10);
      expect(roi.lifeUsedFraction).toBeCloseTo(10 / 10000, 6);
    });

    it("atribui horas por machineId (ignora produção de outra máquina)", () => {
      const roi = computeMachineRoi(
        [machine({ id: "a1" }), machine({ id: "x2d", name: "X2D" })],
        [],
        [
          prod({ id: "e1", machineId: "a1", printHours: 3 }),
          prod({ id: "e2", machineId: "x2d", printHours: 7 }),
        ],
      );
      const a1 = roi.find((r) => r.machine.id === "a1")!;
      const x2d = roi.find((r) => r.machine.id === "x2d")!;
      expect(a1.printedHours).toBe(3);
      expect(a1.printedCount).toBe(1);
      expect(x2d.printedHours).toBe(7);
      expect(x2d.printedCount).toBe(1);
    });

    it("o modo historico (backfill) também conta horas de vida", () => {
      const [roi] = computeMachineRoi(
        [machine({ lifeHours: 1000 })],
        [],
        [prod({ mode: "historico", outcome: "historico", printHours: 40 })],
      );
      expect(roi.printedHours).toBe(40);
      expect(roi.lifeUsedFraction).toBeCloseTo(40 / 1000, 6);
    });

    it("produção sem venda conta vida, mas não payback", () => {
      const [roi] = computeMachineRoi(
        [machine({ price: 1000, lifeHours: 10000 })],
        [],
        [prod({ outcome: "teste", printHours: 12 })],
      );
      expect(roi.printedHours).toBe(12);
      expect(roi.lifeUsedFraction).toBeCloseTo(12 / 10000, 6);
      // Nenhuma venda → nada pago.
      expect(roi.salesCount).toBe(0);
      expect(roi.profit).toBe(0);
      expect(roi.paybackFraction).toBe(0);
      expect(roi.isPaidBack).toBe(false);
    });
  });

  it("marca como pago quando o lucro cobre o preço da máquina", () => {
    const [roi] = computeMachineRoi(
      [machine({ price: 100 })],
      [sale({ profit: 150, saleDate: BASE })],
      [],
      BASE + 30 * DAY,
    );
    expect(roi.isPaidBack).toBe(true);
    expect(roi.surplus).toBe(50);
    expect(roi.remaining).toBe(0);
    expect(roi.monthsToPayback).toBeNull(); // já pago, nada a projetar
    expect(roi.paybackFraction).toBeCloseTo(1.5, 6);
  });

  it("projeta payback pelo ritmo de lucro quando há histórico suficiente", () => {
    const now = BASE + 60 * DAY;
    const [roi] = computeMachineRoi(
      [machine({ price: 1000 })],
      [sale({ profit: 200, saleDate: BASE })], // 200 de lucro em ~2 meses
      [],
      now,
    );
    expect(roi.isPaidBack).toBe(false);
    expect(roi.remaining).toBe(800);
    // ~2 meses decorridos → ~100/mês → faltam ~8 meses
    expect(roi.profitPerMonth).not.toBeNull();
    expect(roi.profitPerMonth!).toBeGreaterThan(90);
    expect(roi.profitPerMonth!).toBeLessThan(110);
    expect(roi.monthsToPayback).not.toBeNull();
    expect(roi.monthsToPayback!).toBeGreaterThan(7);
    expect(roi.monthsToPayback!).toBeLessThan(9);
    expect(roi.projectedPaybackDate).not.toBeNull();
    expect(roi.projectedPaybackDate!).toBeGreaterThan(now);
  });

  it("não projeta com histórico curto (< 14 dias)", () => {
    const now = BASE + 5 * DAY;
    const [roi] = computeMachineRoi(
      [machine({ price: 1000 })],
      [sale({ profit: 200, saleDate: BASE })],
      [],
      now,
    );
    expect(roi.profitPerMonth).toBeNull();
    expect(roi.monthsToPayback).toBeNull();
  });

  it("não projeta quando a máquina está no prejuízo", () => {
    const now = BASE + 60 * DAY;
    const [roi] = computeMachineRoi(
      [machine({ price: 1000 })],
      [sale({ profit: -50, saleDate: BASE })],
      [],
      now,
    );
    expect(roi.profit).toBe(-50);
    expect(roi.profitPerMonth).toBeNull();
    expect(roi.monthsToPayback).toBeNull();
  });

  it("reparte depreciação por máquina e lucro/receita proporcional às horas", () => {
    const roi = computeMachineRoi(
      [machine({ id: "a1", name: "A1" }), machine({ id: "x2d", name: "X2D" })],
      [
        sale({
          id: "s1",
          machineId: "a1", // principal (informativa/compat)
          printHours: 4, // total (3 na A1 + 1 na X2D)
          quantity: 1,
          totalRevenue: 100,
          profit: 40,
          machineUsage: [
            { machineId: "a1", machineName: "A1", hours: 3, depreciation: 3 },
            { machineId: "x2d", machineName: "X2D", hours: 1, depreciation: 0.5 },
          ],
        }),
      ],
    );
    const a1 = roi.find((r) => r.machine.id === "a1")!;
    const x2d = roi.find((r) => r.machine.id === "x2d")!;

    // A máquina participou da venda nas duas.
    expect(a1.salesCount).toBe(1);
    expect(x2d.salesCount).toBe(1);
    // Depreciação: exata de cada máquina (congelada no `machineUsage`).
    expect(a1.depreciationRecovered).toBeCloseTo(3, 6);
    expect(x2d.depreciationRecovered).toBeCloseTo(0.5, 6);
    // Lucro/receita: proporcional às horas (3/4 e 1/4).
    expect(a1.profit).toBeCloseTo(30, 6);
    expect(x2d.profit).toBeCloseTo(10, 6);
    expect(a1.revenue).toBeCloseTo(75, 6);
    expect(x2d.revenue).toBeCloseTo(25, 6);
    // A soma pela frota preserva o total da venda.
    expect(a1.profit + x2d.profit).toBeCloseTo(40, 6);
    expect(a1.revenue + x2d.revenue).toBeCloseTo(100, 6);
  });

  it("pondera a repartição do dinheiro pela quantidade", () => {
    const roi = computeMachineRoi(
      [machine({ id: "a1" }), machine({ id: "x2d", name: "X2D" })],
      [
        sale({
          id: "s1",
          printHours: 3,
          quantity: 5,
          totalRevenue: 500,
          profit: 200,
          machineUsage: [
            { machineId: "a1", machineName: "A1", hours: 2, depreciation: 2 },
            { machineId: "x2d", machineName: "X2D", hours: 1, depreciation: 1 },
          ],
        }),
      ],
    );
    const a1 = roi.find((r) => r.machine.id === "a1")!;
    const x2d = roi.find((r) => r.machine.id === "x2d")!;
    // Depreciação × quantidade.
    expect(a1.depreciationRecovered).toBeCloseTo(2 * 5, 6);
    expect(x2d.depreciationRecovered).toBeCloseTo(1 * 5, 6);
    expect(a1.units).toBe(5);
    expect(x2d.units).toBe(5);
    // Lucro proporcional às horas (2/3 e 1/3), independente da quantidade.
    expect(a1.profit).toBeCloseTo((200 * 2) / 3, 6);
    expect(x2d.profit).toBeCloseTo((200 * 1) / 3, 6);
  });
});
