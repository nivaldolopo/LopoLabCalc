import type { Machine, MachineUsage, ProductionEvent, Sale } from "../types";
import { num } from "@/lib/number";

// Milissegundos em um mês médio (365,25 / 12 dias). Usado para projetar o ritmo
// de lucro e o payback em "meses".
const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;

// Só projetamos payback depois de acumular algum histórico. Extrapolar o ritmo a
// partir de poucos dias de venda daria uma estimativa maluca (dividir o lucro por
// uma fração ínfima de mês). Abaixo disso, mostramos o progresso mas sem projeção.
const MIN_HISTORY_MS = 14 * 24 * 60 * 60 * 1000;

export type MachineRoi = {
  machine: Machine;
  // DUAS fontes, de propósito (FEAT-04c):
  // • VIDA/HORAS vêm da PRODUÇÃO — TODA impressão desgasta a máquina, inclusive
  //   teste/falha/brinde que nunca viram venda (é o ponto do quiosque). Cada
  //   evento já carrega uma máquina só (a 04b quebra inteiro multi-máquina em N
  //   eventos), então é soma direta por `machineId`, sem repartição.
  // • DINHEIRO (payback/lucro/receita/depreciação recuperada) vem das VENDAS —
  //   é sobre o que voltou em caixa. Atribuição por `machineUsage` (congelado na
  //   venda): cada máquina recebe a DEPRECIAÇÃO exata que rodou e uma fatia do
  //   LUCRO/RECEITA proporcional às suas horas; vendas antigas (sem
  //   `machineUsage`) caem no fallback: tudo na máquina principal (`machineId`).
  printedCount: number; // nº de impressões (eventos de produção) nesta máquina
  printedHours: number; // Σ printHours dos eventos de produção desta máquina
  salesCount: number; // nº de vendas em que a máquina participou
  units: number; // Σ quantity vendida
  revenue: number; // Σ totalRevenue
  profit: number; // Σ profit (já líquido de taxa)
  depreciationRecovered: number; // Σ costBreakdown.depreciation × quantity
  firstSaleDate: number | null;
  lastSaleDate: number | null;

  // Vida útil consumida (cruza com lifeHours). Horas físicas realmente impressas,
  // da PRODUÇÃO — mede desgaste, não recuperação de caixa.
  lifeUsedFraction: number; // printedHours / lifeHours (pode passar de 1)

  // Payback do investimento (cruza com price). Quanto da máquina o LUCRO já pagou.
  paybackFraction: number; // profit / price (pode passar de 1)
  isPaidBack: boolean; // profit >= price
  surplus: number; // max(0, profit − price): lucro real depois de pagar a máquina
  remaining: number; // max(0, price − profit): quanto falta pagar

  // Projeção (null quando não há histórico/ritmo suficiente para estimar).
  profitPerMonth: number | null; // ritmo médio de lucro desde a 1ª venda
  monthsToPayback: number | null; // remaining / profitPerMonth
  projectedPaybackDate: number | null; // now + monthsToPayback (timestamp ms)
};

// Repartição de uso da venda por máquina. Vendas novas trazem `machineUsage`;
// as antigas caem no fallback (uma entrada: máquina principal com o total de
// horas e a depreciação congeladas).
function saleShares(sale: Sale): MachineUsage[] {
  if (sale.machineUsage && sale.machineUsage.length > 0) {
    return sale.machineUsage;
  }
  return [
    {
      machineId: sale.machineId,
      machineName: sale.machineName,
      hours: num(sale.printHours),
      depreciation: num(sale.costBreakdown?.depreciation),
    },
  ];
}

// Cruza as máquinas com o histórico. Vida/horas saem da PRODUÇÃO (todo evento
// desgasta a máquina); payback/lucro/receita saem das VENDAS. Máquina sem uso
// ainda aparece (zerada), para o dono ver que ela existe.
export function computeMachineRoi(
  machines: Machine[],
  sales: Sale[],
  production: ProductionEvent[] = [],
  now: number = Date.now(),
): MachineRoi[] {
  return machines.map((machine) => {
    const price = Math.max(0, num(machine.price));
    const lifeHours = Math.max(0, num(machine.lifeHours));

    // Horas físicas: soma direta dos eventos de produção desta máquina, qualquer
    // desfecho e qualquer modo (real ou historico/backfill). Um evento = uma
    // impressão (sem `quantity`).
    let printedCount = 0;
    let printedHours = 0;
    for (const event of production) {
      if (event.machineId !== machine.id) continue;
      printedCount += 1;
      printedHours += num(event.printHours);
    }

    let salesCount = 0;
    let units = 0;
    let revenue = 0;
    let profit = 0;
    let depreciationRecovered = 0;
    let firstSaleDate: number | null = null;
    let lastSaleDate: number | null = null;

    for (const sale of sales) {
      const shares = saleShares(sale);
      const share = shares.find((s) => s.machineId === machine.id);
      if (!share) continue;

      const qty = Math.max(1, num(sale.quantity) || 1);
      const totalHours = shares.reduce((sum, s) => sum + num(s.hours), 0);
      // Fatia do lucro/receita: proporcional às horas desta máquina no produto.
      // Sem horas (produto de 0h), reparte igualmente entre as máquinas da venda.
      const fraction =
        totalHours > 0 ? num(share.hours) / totalHours : 1 / shares.length;

      salesCount += 1;
      units += qty;
      depreciationRecovered += num(share.depreciation) * qty;
      revenue += num(sale.totalRevenue) * fraction;
      profit += num(sale.profit) * fraction;

      const when = num(sale.saleDate);
      if (when > 0) {
        firstSaleDate =
          firstSaleDate === null ? when : Math.min(firstSaleDate, when);
        lastSaleDate =
          lastSaleDate === null ? when : Math.max(lastSaleDate, when);
      }
    }

    const lifeUsedFraction = lifeHours > 0 ? printedHours / lifeHours : 0;
    const paybackFraction = price > 0 ? profit / price : 0;
    const isPaidBack = price > 0 && profit >= price;
    const surplus = Math.max(0, profit - price);
    const remaining = Math.max(0, price - profit);

    // Ritmo de lucro: lucro acumulado ÷ meses decorridos desde a 1ª venda, só se
    // houver histórico mínimo e lucro positivo. Senão, não dá pra projetar.
    let profitPerMonth: number | null = null;
    let monthsToPayback: number | null = null;
    let projectedPaybackDate: number | null = null;

    const elapsedMs = firstSaleDate !== null ? now - firstSaleDate : 0;
    if (firstSaleDate !== null && elapsedMs >= MIN_HISTORY_MS && profit > 0) {
      profitPerMonth = profit / (elapsedMs / MONTH_MS);
      if (!isPaidBack && profitPerMonth > 0) {
        monthsToPayback = remaining / profitPerMonth;
        projectedPaybackDate = now + monthsToPayback * MONTH_MS;
      }
    }

    return {
      machine,
      printedCount,
      printedHours,
      salesCount,
      units,
      revenue,
      profit,
      depreciationRecovered,
      firstSaleDate,
      lastSaleDate,
      lifeUsedFraction,
      paybackFraction,
      isPaidBack,
      surplus,
      remaining,
      profitPerMonth,
      monthsToPayback,
      projectedPaybackDate,
    };
  });
}
