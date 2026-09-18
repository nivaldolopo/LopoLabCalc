"use client";

type FixedCostsPanelProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

/**
 * O toggle "incluir custo fixo nesta peça" — por-produto (`includeFixed`).
 *
 * ⚠ Frente 2 (2026-09-17): este painel MOSTRAVA a taxa inteira (aluguel,
 * máquinas, horas/dia, resultado, barra de aplicar). Ela mudou de casa — a
 * taxa é GLOBAL, reprecifica o catálogo inteiro e não tem por quê aparecer
 * (nem ser editável) no meio do formulário de UM produto; mora agora na aba
 * "Custo fixo" do modal de Configurações (`FixedCostRatePanel`). O que fica
 * aqui é só a decisão que É do produto: entra ou não no custo desta peça.
 */
export function FixedCostsPanel({ enabled, onChange }: FixedCostsPanelProps) {
  return (
    <div className="fixed-costs-banner collapsed">
      <div className="fc-title">
        <button className="toggle-wrap" type="button" onClick={() => onChange(!enabled)}>
          <span>
            <span className="toggle-label">
              {enabled ? "Incluído no preço da peça" : "Desativado"}
            </span>
            <span className="toggle-desc">
              {enabled
                ? "O custo fixo do negócio (Configurações → Custo fixo) será embutido no custo desta peça."
                : "Precifique pelo custo de produção. Ajuste a taxa em Configurações → Custo fixo."}
            </span>
          </span>
          <span className={`toggle-track ${enabled ? "on" : ""}`}>
            <span className="toggle-thumb" />
          </span>
        </button>
      </div>
    </div>
  );
}
