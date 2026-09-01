"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { computeMachineRoi, type MachineRoi } from "../lib/machineRoi";
import { depreciationPerHourOf, resolveFleet, weightOf } from "../lib/fleet";
import { useMachines } from "../hooks/useMachines";
import { useProduction } from "../hooks/useProduction";
import { useSales } from "../hooks/useSales";
import { useTheme } from "../hooks/useTheme";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { PageIntro } from "./PageIntro";

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function barWidth(fraction: number): string {
  return `${Math.min(100, Math.max(0, fraction * 100))}%`;
}

function formatMonths(months: number): string {
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `~${Math.round(months)} ${Math.round(months) === 1 ? "mês" : "meses"}`;
  const years = months / 12;
  return `~${years.toFixed(1).replace(".", ",")} anos`;
}

function formatMonthYear(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

// Frase de status do payback, do "melhor" caso ao "pior".
function paybackStatus(roi: MachineRoi): { text: string; tone: "pos" | "neg" | "muted" } {
  if (roi.salesCount === 0) {
    return { text: "Sem vendas registradas ainda.", tone: "muted" };
  }
  if (roi.isPaidBack) {
    return {
      text: `Paga! Lucro além da máquina: ${formatCurrency(roi.surplus)}.`,
      tone: "pos",
    };
  }
  if (roi.profit <= 0) {
    return {
      text: `No prejuízo até aqui (${formatCurrency(roi.profit)}). Sem projeção.`,
      tone: "neg",
    };
  }
  if (roi.monthsToPayback !== null && roi.projectedPaybackDate !== null) {
    return {
      text: `Falta ${formatCurrency(roi.remaining)} · ${formatMonths(
        roi.monthsToPayback,
      )} no ritmo atual (por volta de ${formatMonthYear(roi.projectedPaybackDate)}).`,
      tone: "muted",
    };
  }
  // TD-016: com o ritmo em janela móvel, "sem projeção" passou a ter DUAS
  // causas bem diferentes — histórico curto demais (`profitPerMonth` null) e
  // máquina parada na janela (ritmo 0, mas com lucro acumulado). Dizer "junte
  // 2 semanas" para a segunda seria mentira: ela já tem histórico de sobra.
  if (roi.profitPerMonth !== null) {
    return {
      text: `Falta ${formatCurrency(roi.remaining)} · sem vendas nos últimos ${
        roi.recentWindowDays
      } dias, não há ritmo para projetar o prazo.`,
      tone: "muted",
    };
  }
  return {
    text: `Falta ${formatCurrency(roi.remaining)} · junte ~2 semanas de vendas para projetar o prazo.`,
    tone: "muted",
  };
}

export function MachinesPage() {
  const { theme, toggleTheme } = useTheme();
  const { machines } = useMachines();
  const { sales, status, error } = useSales();
  const { events: production } = useProduction();

  const rois = useMemo(
    () => computeMachineRoi(machines, sales, production),
    [machines, sales, production],
  );

  // [FROTA] Fase 2 — a taxa de frota, só-leitura. O R$/h de cada máquina era
  // invisível em QUALQUER tela do app: o preço saía dele, ninguém o via, e a
  // diferença de 7× entre a Mini e a X2D só aparecia depois, no preço final.
  // A frota INTEIRA é o denominador certo aqui — é o que um produto sem
  // restrição paga.
  const frota = useMemo(() => {
    const fleet = resolveFleet(
      machines,
      machines.map((machine) => machine.id),
    );
    const pesoTotal = machines.reduce((sum, m) => sum + weightOf(m), 0);
    const linhas = machines.map((machine) => ({
      machine,
      depreciation: depreciationPerHourOf(machine),
      maintenance: machine.maintenancePerHour,
      // A fatia REAL depois da renormalização — é ela que o dono precisa ler,
      // não o percentual digitado (os pesos não precisam somar 100).
      share: pesoTotal > 0 ? weightOf(machine) / pesoTotal : 1 / (machines.length || 1),
    }));
    return { fleet, linhas, pesoTotal };
  }, [machines]);

  const totals = useMemo(() => {
    const investment = rois.reduce((sum, r) => sum + r.machine.price, 0);
    const profit = rois.reduce((sum, r) => sum + r.profit, 0);
    const paid = rois.filter((r) => r.isPaidBack).length;
    return { investment, profit, paid, count: rois.length };
  }, [rois]);

  return (
    <main className="wrap" id="conteudo">
      <PageHeader
        title="Impressoras"
        meta="ROI e payback — Lopo Lab"
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />

      {error ? <div className="app-error">{error}</div> : null}

      <div className="sales-totals roi-totals">
        <div className="sales-total-card">
          <span>Investimento</span>
          <strong className="sg mono">{formatCurrency(totals.investment)}</strong>
          <span className="sales-total-sub">{totals.count} máquinas</span>
        </div>
        <div className="sales-total-card">
          <span>Lucro acumulado</span>
          {/* UX-20 — EXCEÇÃO DELIBERADA: a sub-linha deste cartão é a ressalva
              do UX-09, não uma %. Sem % companheira, a cor mora no R$
              (sub-decisão (c) do dono). Regra no `auth-sale.css`. */}
          <strong
            className={`sg mono ${totals.profit < 0 ? "sale-neg" : "sale-pos"}`}
          >
            {formatCurrency(totals.profit)}
          </strong>
          <span className="sales-total-sub">
            líquido de taxas · bruto de custo fixo
          </span>
        </div>
        <div className="sales-total-card">
          <span>Máquinas pagas</span>
          <strong className="sg">
            {totals.paid}/{totals.count}
          </strong>
          <span className="sales-total-sub">pelo lucro gerado</span>
        </div>
      </div>

      {/* UX-23 — este era o 1º de DOIS parágrafos empilhados antes do 1º dado
          (~120px de texto). Ele é a introdução da página e vira `PageIntro`; o
          segundo é a ressalva do payback (UX-09) e continua `.roi-note`, porque
          é aviso, não introdução. Encolher a ressalva é assunto do UX-34. */}
      <PageIntro>
        O <strong>payback</strong> cruza o preço de compra de cada máquina com o
        lucro que ela já gerou nas vendas (o lucro/receita/depreciação são
        repartidos pela máquina certa quando o produto usa mais de uma). A{" "}
        <strong>vida útil</strong> vem do registro de produção: toda impressão
        desgasta a máquina, inclusive teste, falha e brinde que nunca viram venda.
      </PageIntro>
      {/* UX-09: o payback soma `sale.profit` — receita menos COGS real menos
          taxa. Ele NÃO desconta custo fixo (aluguel etc.) nem as impressões com
          `outcome: "falha"`, que queimam filamento e horas sem abater nada em
          lugar nenhum. Ou seja: a barra enche mais rápido do que o caixa. O
          número honesto só existe quando o Dashboard consolidar fixo + perdas —
          até lá, este aviso é o guarda-rail contra decidir comprar máquina nova
          com base numa barra otimista.
          UX-34: o aviso continua nos 3 pontos do UX-09, mas ESTE (o do topo)
          custava ~5 linhas antes do 1º dado. Vira `<details>` fechado, no mesmo
          padrão do `.result-advanced`/`.stock-spent`: a ressalva segue visível
          em uma linha e o porquê fica a um clique — que funciona no toque, ao
          contrário de dica por hover. Sem prop `open` (uncontrolled). */}
      <details className="roi-note roi-warn">
        <summary>
          <ChevronRight className="roi-warn-caret" size={14} />⚠ O payback usa o{" "}
          <strong>lucro bruto das vendas</strong> — por quê
        </summary>
        <p>
          Já desconta o custo de produzir e a taxa de pagamento, mas{" "}
          <strong>não</strong> desconta o custo fixo (aluguel, etc.) nem as
          impressões perdidas por falha. O payback real é mais lento do que a
          barra mostra — trate-a como teto otimista, não como caixa.
        </p>
      </details>

      {/* [FROTA] Fase 2 — a taxa de frota. Fica ANTES dos cartões de ROI porque é
          a premissa deles: o desgaste que o payback recupera é o que o preço
          embutiu, e o preço embute a MÉDIA, não a máquina. */}
      <section className="fleet-card">
        <h2 className="fleet-title">Taxa de frota — o que entra no preço</h2>
        <p className="fleet-sub">
          Um produto que pode rodar em todas paga a{" "}
          <strong>média ponderada</strong> abaixo, e não o custo da impressora em
          que ele por acaso saiu. Cada componente tem a sua média — as três somam
          a taxa cheia.
          {frota.pesoTotal <= 0 ? (
            <>
              {" "}
              <span className="fleet-warn">
                ⚠ Nenhuma máquina tem peso cadastrado, então a média está{" "}
                <strong>simples</strong> — todas pesam igual. Defina a proporção
                de uso em <em>Gerenciar Máquinas</em>, na calculadora.
              </span>
            </>
          ) : null}
        </p>
        <div className="fleet-table-wrap">
          <table className="fleet-table">
            <thead>
              <tr>
                <th>Máquina</th>
                <th className="num">Peso</th>
                <th className="num">Desgaste</th>
                <th className="num">Manutenção</th>
                <th className="num">Watts</th>
                <th className="num">R$/h (sem energia)</th>
              </tr>
            </thead>
            <tbody>
              {frota.linhas.map((linha) => {
                // ⚠ "Excluída da média" e "média simples" são estados
                // DIFERENTES, e só o primeiro é problema. Com a frota inteira em
                // zero não há quem excluir: todas entram, em partes iguais — e
                // esse é o estado em que o app nasce. Marcar as três como
                // excluídas ali seria o oposto do que acontece.
                const excluida =
                  frota.pesoTotal > 0 && weightOf(linha.machine) <= 0;
                return (
                <tr
                  key={linha.machine.id}
                  className={excluida ? "fleet-zero" : ""}
                >
                  <td>{linha.machine.name}</td>
                  <td className="num mono">
                    {excluida ? (
                      <span className="fleet-zero-tag">0% — fora da média</span>
                    ) : (
                      <>
                        {(linha.share * 100).toFixed(0)}%
                        {frota.pesoTotal > 0 ? null : (
                          <span className="fleet-simples-tag"> simples</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="num mono">
                    {formatCurrency(linha.depreciation)}
                  </td>
                  <td className="num mono">
                    {formatCurrency(linha.maintenance)}
                  </td>
                  <td className="num mono">{linha.machine.watts}</td>
                  <td className="num mono">
                    {formatCurrency(linha.depreciation + linha.maintenance)}
                  </td>
                </tr>
                );
              })}
              <tr className="fleet-total">
                <td>Frota inteira</td>
                <td className="num mono">100%</td>
                <td className="num mono">
                  {formatCurrency(frota.fleet.depreciationPerHour)}
                </td>
                <td className="num mono">
                  {formatCurrency(frota.fleet.maintenancePerHour)}
                </td>
                <td className="num mono">{formatDecimal(frota.fleet.watts)}</td>
                <td className="num mono">
                  {formatCurrency(
                    frota.fleet.depreciationPerHour +
                      frota.fleet.maintenancePerHour,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* A energia fica FORA da coluna de R$/h porque depende da tarifa, que é
            do PRODUTO (conta de luz), não da máquina. Os watts médios estão ao
            lado para quem quiser fechar a conta. */}
        <p className="fleet-foot">
          A energia não entra na coluna de R$/h: ela é{" "}
          <code>horas × watts ÷ 1000 × tarifa</code>, e a tarifa é do produto.
        </p>
      </section>

      <div className="roi-list">
        {rois.map((roi) => {
          const st = paybackStatus(roi);
          return (
            <div className="roi-card" key={roi.machine.id}>
              <div className="roi-head">
                <div className="roi-title">{roi.machine.name}</div>
                <div className="roi-price mono">
                  {formatCurrency(roi.machine.price)}
                </div>
              </div>

              <div className="roi-block">
                <div className="roi-block-label">
                  <span>Payback do investimento</span>
                  <strong className="mono">{pct(roi.paybackFraction)}</strong>
                </div>
                <div className="roi-bar">
                  <div
                    className={`roi-bar-fill payback ${roi.isPaidBack ? "done" : ""}`}
                    style={{ width: barWidth(roi.paybackFraction) }}
                  />
                </div>
                <div className={`roi-status ${st.tone}`}>{st.text}</div>
                {/* UX-09: a ressalva viaja junto do número — quem rola até o
                    card não vê mais a nota do topo. */}
                <div className="roi-caveat">
                  lucro bruto — antes do custo fixo e das perdas por falha
                </div>
              </div>

              <div className="roi-block">
                <div className="roi-block-label">
                  <span>Vida útil consumida</span>
                  <strong className="mono">{pct(roi.lifeUsedFraction)}</strong>
                </div>
                <div className="roi-bar">
                  <div
                    className="roi-bar-fill life"
                    style={{ width: barWidth(roi.lifeUsedFraction) }}
                  />
                </div>
                <div className="roi-status muted">
                  {formatDecimal(roi.printedHours)} h impressas de{" "}
                  {formatDecimal(roi.machine.lifeHours)} h em{" "}
                  {roi.printedCount}{" "}
                  {roi.printedCount === 1 ? "impressão" : "impressões"} ·{" "}
                  {formatCurrency(roi.depreciationRecovered)} de depreciação já
                  embutida nos preços de venda.
                </div>
              </div>

              <div className="roi-metrics">
                <div className="roi-metric">
                  <span>Vendas</span>
                  <strong className="mono">{roi.salesCount}</strong>
                </div>
                <div className="roi-metric">
                  <span>Receita</span>
                  <strong className="mono">{formatCurrency(roi.revenue)}</strong>
                </div>
                <div className="roi-metric">
                  <span>Lucro</span>
                  {/* UX-20 — EXCEÇÃO DELIBERADA: as métricas do cartão de ROI
                      não têm % de margem. Sem % companheira, a cor mora no R$
                      (sub-decisão (c) do dono). Regra no `auth-sale.css`. */}
                  <strong
                    className={`mono ${roi.profit < 0 ? "sale-neg" : "sale-pos"}`}
                  >
                    {formatCurrency(roi.profit)}
                  </strong>
                </div>
                <div className="roi-metric">
                  {/* TD-016: o rótulo diz a janela porque o número mudou de
                      sentido — é o ritmo dos últimos 90 dias, não a média de
                      vida inteira (que decaía sozinha em mês parado). */}
                  <span>Ritmo ({roi.recentWindowDays}d)</span>
                  <strong className="mono">
                    {roi.profitPerMonth !== null
                      ? `${formatCurrency(roi.profitPerMonth)}/mês`
                      : "—"}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
