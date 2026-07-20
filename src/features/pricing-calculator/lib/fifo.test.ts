import { describe, expect, it } from "vitest";
import { fifoSort, shiftLots, simulateFifo, type FifoLot } from "./fifo";

// O núcleo do FIFO é compartilhado pelos dois estoques (filamento e insumos), o
// que faz destes testes a rede que impede a regra do D4 de mudar sem querer para
// os dois de uma vez. As unidades e o custo NÃO são testados aqui — são de quem
// chama (`stock.test.ts` em gramas/kg, `supplies.test.ts` em unidades).

function lot(id: string, remaining: number, unitPrice = 1): FifoLot {
  return { id, remaining, unitPrice };
}

describe("fifoSort", () => {
  it("ordena do mais antigo para o mais novo", () => {
    const items = [
      { id: "b", date: 20 },
      { id: "a", date: 10 },
      { id: "c", date: 30 },
    ];
    expect(fifoSort(items, (item) => item.date).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("desempata pela ordem de inserção (consumo determinístico)", () => {
    const items = [
      { id: "primeiro", date: 10 },
      { id: "segundo", date: 10 },
    ];
    expect(fifoSort(items, (item) => item.date).map((item) => item.id)).toEqual([
      "primeiro",
      "segundo",
    ]);
  });

  it("não altera o array recebido", () => {
    const items = [
      { id: "b", date: 20 },
      { id: "a", date: 10 },
    ];
    fifoSort(items, (item) => item.date);
    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("simulateFifo", () => {
  it("quantidade zero ou negativa não gera move", () => {
    expect(simulateFifo([lot("l1", 100)], 0)).toEqual({
      moves: [],
      crossesLot: false,
      shortfall: 0,
    });
    expect(simulateFifo([lot("l1", 100)], -5).moves).toEqual([]);
  });

  it("consome do lote mais antigo primeiro, sem atravessar", () => {
    const result = simulateFifo([lot("velho", 100), lot("novo", 50)], 40);
    expect(result.moves).toEqual([{ lotId: "velho", qty: 40, unitPrice: 1 }]);
    expect(result.crossesLot).toBe(false);
    expect(result.shortfall).toBe(0);
  });

  it("atravessa para o próximo lote quando o primeiro não basta", () => {
    const result = simulateFifo(
      [lot("velho", 100, 9), lot("novo", 50, 11)],
      120,
    );
    expect(result.moves).toEqual([
      { lotId: "velho", qty: 100, unitPrice: 9 },
      { lotId: "novo", qty: 20, unitPrice: 11 },
    ]);
    expect(result.crossesLot).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("pula lote zerado (ou negativo) sem consumir dele", () => {
    const result = simulateFifo([lot("vazio", 0), lot("cheio", 50)], 30);
    expect(result.moves).toEqual([{ lotId: "cheio", qty: 30, unitPrice: 1 }]);
    expect(result.crossesLot).toBe(false);
  });

  it("D4: o excedente vai para o lote mais NOVO, empurrando-o a negativo", () => {
    // 150 disponíveis, quer 200: faltam 50, que engrossam o move do lote novo.
    const result = simulateFifo([lot("velho", 100), lot("novo", 50)], 200);
    expect(result.moves).toEqual([
      { lotId: "velho", qty: 100, unitPrice: 1 },
      { lotId: "novo", qty: 100, unitPrice: 1 }, // 50 do saldo + 50 de overdraft
    ]);
    expect(result.shortfall).toBe(50);
  });

  it("D4: o lote mais novo recebe o overdraft mesmo estando zerado", () => {
    const result = simulateFifo([lot("velho", 30), lot("novo", 0)], 100);
    expect(result.moves).toEqual([
      { lotId: "velho", qty: 30, unitPrice: 1 },
      { lotId: "novo", qty: 70, unitPrice: 1 },
    ]);
    expect(result.shortfall).toBe(70);
  });

  it("sem lote nenhum: só o shortfall carrega o recado", () => {
    const result = simulateFifo([], 100);
    expect(result.moves).toEqual([]);
    expect(result.shortfall).toBe(100);
  });

  it("é pura: não mexe nos lotes recebidos", () => {
    const lots = [lot("velho", 100), lot("novo", 50)];
    simulateFifo(lots, 200);
    expect(lots.map((item) => item.remaining)).toEqual([100, 50]);
  });
});

describe("shiftLots", () => {
  type Item = { id: string; saldo: number };
  const read = (item: Item) => item.saldo;
  const write = (item: Item, saldo: number) => ({ ...item, saldo });

  it("sem delta nenhum devolve o mesmo array", () => {
    const lots: Item[] = [{ id: "a", saldo: 10 }];
    expect(shiftLots(lots, new Map(), read, write)).toBe(lots);
  });

  it("aplica o delta só nos lotes citados", () => {
    const lots: Item[] = [
      { id: "a", saldo: 10 },
      { id: "b", saldo: 20 },
    ];
    const result = shiftLots(lots, new Map([["a", -4]]), read, write);
    expect(result[0].saldo).toBe(6);
    // Lote intocado volta pela MESMA referência.
    expect(result[1]).toBe(lots[1]);
  });

  it("round-trip: aplicar e estornar volta ao saldo original", () => {
    const lots: Item[] = [{ id: "a", saldo: 10 }];
    const baixa = shiftLots(lots, new Map([["a", -7]]), read, write);
    const estorno = shiftLots(baixa, new Map([["a", 7]]), read, write);
    expect(estorno[0].saldo).toBe(10);
  });
});
