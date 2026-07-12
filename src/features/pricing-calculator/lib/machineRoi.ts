import type { Machine, MachineUsage, Sale } from "../types";
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
  // Atribuição por `machineUsage` (repartição por máquina congelada na venda):
  // cada impressora recebe as HORAS e a DEPRECIAÇÃO exatas que rodou, e uma fatia
  // proporcional às horas do LUCRO e da RECEITA do produto. Um produto que usou 2
  // máquinas conta como venda nas duas. Vendas antigas (sem `machineUsage`) caem
  // no fallback: tudo na máquina principal (`machineId`).
  salesCount: number; // nº de vendas em que a máquina participou
  units: number; // Σ quantity
  printedHours: number; // Σ printHours × quantity
  revenue: number; // Σ totalRevenue
  profit: number; // Σ profit (já líquido de taxa)
  depreciationRecovered: number; // Σ costBreakdown.depreciation × quantity
  firstSaleDate: number | null;
  lastSaleDate: number | null;

  // Vida útil consumida (cruza com lifeHours). É a depreciação embutida no preço
  // voltando hora a hora — bate com depreciationRecovered / price.
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

// Cruza as máquinas com o histórico de vendas e devolve o ROI/payback de cada uma.
// Máquina sem venda ainda aparece (zerada), para o dono ver que ela existe.
export function computeMachineRoi(
  machines: Machine[],
  sales: Sale[],
  now: number = Date.now(),
): MachineRoi[] {
  return machines.map((machine) => {
    const price = Math.max(0, num(machine.price));
    const lifeHours = Math.max(0, num(machine.lifeHours));

    let salesCount = 0;
    let units = 0;
    let printedHours = 0;
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
      printedHours += num(share.hours) * qty;
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
      salesCount,
      units,
      printedHours,
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
