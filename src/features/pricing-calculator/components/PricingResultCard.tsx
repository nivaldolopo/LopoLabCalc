"use client";

import {
  ChevronRight,
  Factory,
  FileText,
  Plus,
  Receipt,
  Save,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import type {
  CapacityResult,
  CapacitySettings,
  FixedCostSettings,
  PaymentFeeSettings,
  PricingResult,
  RoundingMode,
} from "../types";
import { marginTierClass, marginTierTitle } from "../lib/marginTier";
import { ROUNDING_OPTIONS } from "../lib/roundPrice";
import { CapacityPanel } from "./CapacityPanel";
import { CostBars } from "./CostBars";
import { NetMarginHint } from "./NetMarginHint";
import { ProfitSummary } from "./ProfitSummary";

type PricingResultCardProps = {
  result: PricingResult;
  fixedCosts: FixedCostSettings;
  // UX-10: só para exibir a margem líquida ao lado da bruta.
  fees: PaymentFeeSettings;
  capacitySettings: CapacitySettings;
  capacityResult: CapacityResult | null;
  // TD-010: true quando o painel está SIMULANDO (o usuário mexeu nos campos) em
  // vez de usar o padrão do negócio.
  capacityIsCustom: boolean;
  roundingMode: RoundingMode;
  printHours: number;
  onRoundingModeChange: (mode: RoundingMode) => void;
  onCapacityChange: (patch: Partial<CapacitySettings>) => void;
  onCapacityReset: () => void;
  // UX-11: TODAS as ações do formulário moram aqui (a coluna esquerda virou só
  // input). `canSave` = o formulário passa no mínimo pra salvar (tem nome); as
  // 3 ações de destino salvam antes de agir, então dependem dele também.
  canSave: boolean;
  editingProductId: string | null;
  saved: boolean;
  // AUD-14 [D2]: gravação em curso. Apaga as 4 ações (todas gravam o MESMO
  // produto) e troca o rótulo — sem isto o clique repetido enfileirava escrita.
  saving: boolean;
  saveError?: string | null;
  onSave: () => void;
  onSaveAsNew: () => void;
  onCancelEdit: () => void;
  onRegisterSale: () => void;
  onProduce: () => void;
  onQuote: () => void;
};

export function PricingResultCard({
  result,
  fixedCosts,
  fees,
  capacitySettings,
  capacityResult,
  capacityIsCustom,
  roundingMode,
  printHours,
  onRoundingModeChange,
  onCapacityChange,
  onCapacityReset,
  canSave,
  editingProductId,
  saved,
  saving,
  saveError,
  onSave,
  onSaveAsNew,
  onCancelEdit,
  onRegisterSale,
  onProduce,
  onQuote,
}: PricingResultCardProps) {
  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.profitPerPiece > 0
      ? Math.ceil(totalFixedMonth / result.profitPerPiece)
      : null;
  // Contextualiza a meta contra a capacidade produtiva: a meta é fácil (usa
  // pouco da capacidade) ou impossível (acima do que dá pra produzir)?
  const capacityMonth = capacityResult?.piecesMonth ?? 0;
  const breakEvenPct =
    breakEvenUnits && capacityMonth > 0
      ? Math.round((breakEvenUnits / capacityMonth) * 100)
      : null;
  const breakEvenOverCapacity =
    breakEvenUnits != null && capacityMonth > 0 && breakEvenUnits > capacityMonth;
  const multiPiece = result.pieces > 1;

  const isRounded = result.suggestedPrice !== result.exactPrice;
  const batchTotal = result.suggestedPrice * result.pieces;

  return (
    <div className="result-card">
      <div className="result-label">
        Preço sugerido{multiPiece ? " (por peça)" : ""}
      </div>
      {/* UX-30: a interação central do app é mexer no dial e o número mudar —
          e ela não anunciava nada. `role="status"` já é o padrão de região viva
          do projeto (FeedbackNote). Fica SÓ aqui: a MobilePriceBar espelha o
          mesmo preço, e uma segunda região viva faria o leitor falar duas
          vezes. */}
      <div className="result-price sg" role="status" aria-live="polite">
        {formatCurrency(result.suggestedPrice)}
      </div>
      {isRounded ? (
        <div className="result-exact">
          exato: {formatCurrency(result.exactPrice)}
        </div>
      ) : null}
      <div className="result-margin">
        {/* UX-19: aqui é onde o dial de markup é mexido — a faixa da DEC-04
            responde ao vivo. O <span> existe porque a classe precisa de um
            elemento próprio (o `.result-margin` já tem cor do sections.css);
            só cor, nada de peso, pra não mexer na geometria. */}
        margem de{" "}
        <span
          className={marginTierClass(result.margin)}
          title={marginTierTitle(result.margin)}
        >
          {result.margin.toFixed(0)}%
        </span>{" "}
        sobre o preço final
        {/* UX-10: a margem acima é BRUTA (só vale em Pix/dinheiro). O piso —
            pior taxa configurada — fica logo abaixo, onde o markup é decidido. */}
        <NetMarginHint result={result} fees={fees} />
      </div>

      {/* [FROTA] Fase 2 — o aviso mudou de fato: antes era "a máquina salva não
          existe mais, estou usando outra"; agora é "não há conjunto elegível
          válido, estou precificando pela FROTA INTEIRA". O efeito no preço é
          maior, não menor — a média de todas costuma ficar longe da máquina que
          o produto usava. */}
      {result.machineMissing ? (
        <div className="form-error machine-missing">
          ⚠ Sem máquinas elegíveis válidas — precificando pela{" "}
          <strong>frota inteira</strong>
          {result.eligibleMachines.length > 0
            ? ` (${result.eligibleMachines.map((m) => m.name).join(", ")})`
            : ""}
          . Marque onde o produto realmente cabe.
        </div>
      ) : null}

      {result.filamentMissing ? (
        <div className="form-error machine-missing">
          ⚠ Cor removida do Estoque — usando o preço salvo como fallback.
          Reatribua a cor do produto (o custo pode estar errado).
        </div>
      ) : null}

      <div className="rounding-control">
        <label htmlFor="rounding-mode">Arredondar preço</label>
        <select
          id="rounding-mode"
          value={roundingMode}
          onChange={(event) =>
            onRoundingModeChange(event.target.value as RoundingMode)
          }
        >
          {ROUNDING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* UX-11: bloco único de ações, no TOPO do card — é o topo que o
          `position: sticky` do `.result-card` prende na tela enquanto se rola o
          formulário à esquerda. Vender/Produzir/Orçar salvam o produto antes de
          agir (ver `ensureSavedProductId` em PricingCalculator): sem id a venda
          registraria receita SEM disparar produção nem baixar estoque. */}
      <div className="result-actions">
        <button
          className={`btn primary ${saved ? "saved" : ""}`}
          disabled={!canSave || saving}
          type="button"
          onClick={onSave}
        >
          <Save size={16} />
          {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar"}
        </button>
        {/* UX-32 — a linha só aparece quando o botão está apagado, e diz o que
            falta. Cobre as 4 ações do bloco: todas dependem do mesmo `canSave`. */}
        {!canSave ? (
          <div className="disabled-why">
            dê um nome ao produto para salvar
          </div>
        ) : saving ? (
          <div className="disabled-why">gravando no servidor...</div>
        ) : null}

        <div className="result-actions-row">
          <button
            className="btn btn-secondary"
            disabled={!canSave || saving}
            type="button"
            onClick={onRegisterSale}
            title="Salva o produto e abre o registro de venda"
          >
            <Receipt size={15} />
            Vender
          </button>
          <button
            className="btn btn-secondary"
            disabled={!canSave || saving}
            type="button"
            onClick={onProduce}
            title="Salva o produto e abre a produção"
          >
            <Factory size={15} />
            Produzir
          </button>
          <button
            className="btn btn-secondary"
            disabled={!canSave || saving}
            type="button"
            onClick={onQuote}
            title="Salva o produto e abre o orçamento"
          >
            <FileText size={15} />
            Orçar
          </button>
        </div>

        {editingProductId ? (
          <div className="result-actions-row">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onCancelEdit}
            >
              <X size={15} />
              Cancelar
            </button>
            <button
              className="btn btn-secondary"
              disabled={saving}
              type="button"
              onClick={onSaveAsNew}
            >
              <Plus size={15} />
              {saving ? "Salvando..." : "Salvar como novo"}
            </button>
          </div>
        ) : null}

        {saveError ? <div className="form-error">{saveError}</div> : null}
      </div>

      <CostBars result={result} />

      <div className="breakdown-total">
        <span>Custo total{multiPiece ? " (por peça)" : ""}</span>
        <span className="mono">{formatCurrency(result.totalCost)}</span>
      </div>

      {multiPiece ? (
        <div className="per-piece-row">
          <div className="per-piece-label">
            Total da impressão ({result.pieces} peças)
          </div>
          <div className="result-price sg small">
            {formatCurrency(batchTotal)}
          </div>
        </div>
      ) : null}

      {/* UX-13a: tudo depois do "Custo total" colapsa. Medido: o card inteiro
          media 1286px contra uma viewport de 910px, e um `sticky` mais alto que
          a tela nunca prende no topo — rolava junto e o preço saía de vista
          justo ao mexer no markup. Fechado, o card cai pra ~493px e o `sticky`
          do `.result-card` volta a funcionar sozinho, sem layout novo.
          Dois detalhes que NÃO podem mudar sem quebrar o item:
          - sem prop `open` (uncontrolled): nasce fechado e o estado do usuário
            sobrevive aos re-renders — o card redesenha a cada tecla do form;
          - o <details> é renderizado SEMPRE, com o break-even condicional
            DENTRO. Condicionar o próprio <details> o remontaria (e fecharia
            sozinho) quando o break-even aparecesse ou sumisse. */}
      <details className="result-advanced">
        <summary>
          <ChevronRight className="result-advanced-caret" size={14} />
          Ver informações avançadas
        </summary>

        {/* UX-12: a meta de break-even é CONSEQUÊNCIA do custo — fica depois do
            total pra não separar o preço das barras de composição. */}
        {breakEvenUnits ? (
          <div className="break-even-box visible">
            <div className="break-even-title">🎯 Meta de Break-Even</div>
            <div className="break-even-val">
              Vender <strong>{breakEvenUnits}</strong> peças/mês deste produto
              cobre o aluguel + custos fixos e inicia o lucro.
            </div>
            {capacityMonth > 0 ? (
              breakEvenOverCapacity ? (
                <div className="break-even-context warn">
                  ⚠️ Acima da capacidade ({capacityMonth} pçs/mês) — reveja preço
                  ou volume.
                </div>
              ) : (
                <div className="break-even-context">
                  ≈ {breakEvenPct}% da sua capacidade mensal ({breakEvenUnits} de{" "}
                  {capacityMonth} peças).
                </div>
              )
            ) : null}
          </div>
        ) : null}

        <ProfitSummary result={result} printHours={printHours} />

        <CapacityPanel
          settings={capacitySettings}
          result={capacityResult}
          isCustom={capacityIsCustom}
          onChange={onCapacityChange}
          onReset={onCapacityReset}
        />
      </details>
    </div>
  );
}
