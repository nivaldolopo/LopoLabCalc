import type { Machine, Sale } from "../types";

// Milissegundos em um mês médio (365,25 / 12 dias). Usado para projetar o ritmo
// de lucro e o payback em "meses".
const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;

// Só projetamos payback depois de acumular algum histórico. Extrapolar o ritmo a
// partir de poucos dias de venda daria uma estimativa maluca (dividir o lucro por
// uma fração ínfima de mês). Abaixo disso, mostramos o progresso mas sem projeção.
const MIN_HISTORY_MS = 14 * 24 * 60 * 60 * 1000;

export type MachineRoi = {
  machine: Machine;
  // Atribuição: vendas cujo `machineId` bate com o da máquina. O snapshot da
  // venda guarda só a máquina PRINCIPAL e o `printHours` TOTAL (soma das etapas),
  // então produto com 2ª etapa em outra máquina joga todas as horas na principal.
  salesCount: number; // nº de itens de venda atribuídos
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

function num(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

// Cruza as máquinas com o histórico de vendas e devolve o ROI/payback de cada uma.
// Máquina sem venda ainda aparece (zerada), para o dono ver que ela existe.
export function computeMachineRoi(
  machines: Machine[],
  sales: Sale[],
  now: number = Date.now(),
): MachineRoi[] {
  return machines.map((machine) => {
    const own = sales.filter((sale) => sale.machineId === machine.id);
    const price = Math.max(0, num(machine.price));
    const lifeHours = Math.max(0, num(machine.lifeHours));

    let units = 0;
    let printedHours = 0;
    let revenue = 0;
    let profit = 0;
    let depreciationRecovered = 0;
    let firstSaleDate: number | null = null;
    let lastSaleDate: number | null = null;

    for (const sale of own) {
      const qty = Math.max(1, num(sale.quantity) || 1);
      units += qty;
      printedHours += num(sale.printHours) * qty;
      revenue += num(sale.totalRevenue);
      profit += num(sale.profit);
      depreciationRecovered += num(sale.costBreakdown?.depreciation) * qty;
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
      salesCount: own.length,
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
