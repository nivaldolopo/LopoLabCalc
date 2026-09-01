import type { Machine, MachineUsage, ProductionEvent, Sale } from "../types";
import { num } from "@/lib/number";

// Milissegundos em um mês médio (365,25 / 12 dias). Usado para projetar o ritmo
// de lucro e o payback em "meses".
const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;

// Só projetamos payback depois de acumular algum histórico. Extrapolar o ritmo a
// partir de poucos dias de venda daria uma estimativa maluca (dividir o lucro por
// uma fração ínfima de mês). Abaixo disso, mostramos o progresso mas sem projeção.
const MIN_HISTORY_MS = 14 * 24 * 60 * 60 * 1000;

// TD-016 — a janela do RITMO. O ritmo era `lucro ÷ (agora − 1ª venda)`, ou seja
// média de vida inteira: um mês forte seguido de meses parados fazia a média
// decair sozinha e a projeção afastar a data mesmo com ritmo recente bom. Ele
// respondia "quanto rendeu até aqui", e a pergunta do payback é "quanto rende
// AGORA". 90 dias (e não 60) porque, no volume de vendas de hoje, a janela
// curta deixa um mês vazio zerar a projeção inteira.
const RECENT_WINDOW_DAYS = 90;
const RECENT_WINDOW_MS = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type MachineRoi = {
  machine: Machine;
  // DUAS fontes, de propósito (FEAT-04c):
  // • VIDA/HORAS vêm da PRODUÇÃO — TODA impressão desgasta a máquina, inclusive
  //   teste/falha/brinde que nunca viram venda (é o ponto do quiosque). Cada
  //   evento carrega uma máquina só, e desde a Fase 1 do [FROTA] ele é uma
  //   ETAPA (não mais um grupo de etapas por máquina): duas etapas na mesma
  //   impressora são duas impressões, e o `printedCount` passou a dizê-lo.
  // • DINHEIRO (payback/lucro/receita/depreciação recuperada) vem das VENDAS —
  //   é sobre o que voltou em caixa. Atribuição por `machineUsage`, congelado na
  //   RECONCILIAÇÃO ([FROTA] Fase 1): quem imprimiu, não quem foi precificado.
  //   Cada máquina recebe uma fatia do LUCRO/RECEITA proporcional às suas horas —
  //   e a fatia é sobre as horas que cobririam TODAS as unidades da venda, de
  //   modo que as unidades sem lastro (`unattributedUnits`) NÃO têm o lucro
  //   distribuído. A DEPRECIAÇÃO recuperada é a REAL de cada máquina, que agora
  //   vem congelada por máquina no próprio `machineUsage`.
  //
  // ⚠ Aqui morava o malabarismo "depreciação real repartida na proporção da
  //   precificada": o `realCostBreakdown` era um total por unidade e a única
  //   forma de dividi-lo entre máquinas era pela razão da depreciação PRECIFICADA
  //   — misturando as duas fontes num número só. Não é mais necessário: cada
  //   evento de produção congela a sua própria depreciação real, e ela desce pela
  //   camada do acabado até a venda.
  //
  // ⚠ Venda anterior à Fase 1 traz a repartição PRECIFICADA gravada na época e é
  //   lida como está — o ROI mistura atribuição precificada (vendas velhas) com
  //   real (novas) até o recadastro do dono (Diretriz 7, declarado).
  printedCount: number; // nº de impressões (eventos de produção) nesta máquina
  printedHours: number; // Σ printHours dos eventos de produção desta máquina
  salesCount: number; // nº de vendas em que a máquina participou
  units: number; // Σ quantity vendida
  revenue: number; // Σ totalRevenue
  profit: number; // Σ profit (já líquido de taxa)
  depreciationRecovered: number; // Σ realCostBreakdown.depreciation × quantity (fallback: precificada)
  firstSaleDate: number | null;
  lastSaleDate: number | null;

  // TD-016: o lucro da JANELA recente (mesma repartição por máquina do
  // `profit`). É a base do ritmo — o `profit` acima continua sendo o acumulado
  // de vida inteira, e é ele que paga a máquina.
  recentProfit: number;
  recentWindowDays: number; // p/ a UI rotular sem cravar o número no JSX

  // Vida útil consumida (cruza com lifeHours). Horas físicas realmente impressas,
  // da PRODUÇÃO — mede desgaste, não recuperação de caixa.
  lifeUsedFraction: number; // printedHours / lifeHours (pode passar de 1)

  // Payback do investimento (cruza com price). Quanto da máquina o LUCRO já pagou.
  paybackFraction: number; // profit / price (pode passar de 1)
  isPaidBack: boolean; // profit >= price
  surplus: number; // max(0, profit − price): lucro real depois de pagar a máquina
  remaining: number; // max(0, price − profit): quanto falta pagar

  // Projeção (null quando não há histórico/ritmo suficiente para estimar).
  // TD-016: `profitPerMonth` é o ritmo dos últimos `recentWindowDays` — não mais
  // a média desde a 1ª venda. Pode ser 0 (máquina parada), e aí não há projeção.
  profitPerMonth: number | null; // ritmo recente de lucro, por mês
  monthsToPayback: number | null; // remaining / profitPerMonth
  projectedPaybackDate: number | null; // now + monthsToPayback (timestamp ms)
};

// Repartição de uso da venda por máquina. Lista VAZIA é resposta legítima: a
// venda não tem lastro nenhum e não credita máquina nenhuma. O fallback antigo
// ("tudo na máquina principal") caiu com os campos `machineId`/`machineName` da
// venda — inventar um dono era o oposto do que a Fase 1 foi fazer.
function saleShares(sale: Sale): MachineUsage[] {
  return sale.machineUsage ?? [];
}

// [FROTA] Fase 1 — quanto da venda tem dono. As horas do `machineUsage` são POR
// UNIDADE ATRIBUÍDA, então extrapolá-las para as `quantity` significa dividir a
// fração por esta cobertura — e é o que faz Σ das frações dar `atribuídas/qty`
// em vez de 1.
//
// 🔴 Sem isto o D4 vira atribuição invisível: vender 10 tendo produzido 6 daria
// às máquinas 100% do lucro dos 10, porque `horas ÷ total` soma 1 de qualquer
// jeito. O buraco não apareceria em lugar nenhum.
function saleCoverage(sale: Sale): number {
  const qty = Math.max(1, num(sale.quantity) || 1);
  const atribuidas = Math.max(0, qty - num(sale.unattributedUnits));
  return atribuidas / qty;
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
    let recentProfit = 0;
    let firstSaleDate: number | null = null;
    let lastSaleDate: number | null = null;
    const windowStart = now - RECENT_WINDOW_MS;

    for (const sale of sales) {
      const shares = saleShares(sale);
      const share = shares.find((s) => s.machineId === machine.id);
      if (!share) continue;

      const qty = Math.max(1, num(sale.quantity) || 1);
      const totalHours = shares.reduce((sum, s) => sum + num(s.hours), 0);
      // [FROTA] Fase 1 — fatia do lucro/receita: proporcional às horas desta
      // máquina, MULTIPLICADA pela cobertura. Sem horas (produto de 0h), reparte
      // igualmente entre as máquinas da venda — e a cobertura continua valendo.
      const coverage = saleCoverage(sale);
      const fraction =
        (totalHours > 0 ? num(share.hours) / totalHours : 1 / shares.length) *
        coverage;

      // Depreciação RECUPERADA (Tier 4): a REAL desta máquina, congelada por
      // máquina na reconciliação. `share.depreciation` é por unidade ATRIBUÍDA,
      // então multiplica pelas atribuídas — nunca pela quantidade vendida, que
      // recuperaria depreciação de peça sem origem.
      const atribuidas = qty * coverage;

      salesCount += 1;
      units += qty;
      depreciationRecovered += num(share.depreciation) * atribuidas;
      revenue += num(sale.totalRevenue) * fraction;
      profit += num(sale.profit) * fraction;

      const when = num(sale.saleDate);
      // TD-016: a mesma fatia do lucro, restrita à janela. Venda sem data
      // (`saleDate` 0) não entra no ritmo — não dá pra situá-la no tempo.
      if (when > 0 && when >= windowStart) {
        recentProfit += num(sale.profit) * fraction;
      }
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

    // Ritmo de lucro (TD-016): lucro da JANELA ÷ meses da janela, só se houver
    // histórico mínimo e lucro acumulado positivo. A janela ENCURTA quando o
    // histórico é menor que ela — senão uma máquina com 30 dias de vida teria o
    // ritmo diluído por 90. Ritmo 0 (nada vendido na janela) é resposta legítima
    // e mata a projeção: máquina parada não tem data de payback.
    let profitPerMonth: number | null = null;
    let monthsToPayback: number | null = null;
    let projectedPaybackDate: number | null = null;

    const elapsedMs = firstSaleDate !== null ? now - firstSaleDate : 0;
    if (firstSaleDate !== null && elapsedMs >= MIN_HISTORY_MS && profit > 0) {
      const windowMs = Math.min(elapsedMs, RECENT_WINDOW_MS);
      profitPerMonth = recentProfit / (windowMs / MONTH_MS);
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
      recentProfit,
      recentWindowDays: RECENT_WINDOW_DAYS,
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
