"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  formatDate,
  toTimestamp,
  todayInputValue,
} from "@/lib/formatting/date";
import { num } from "@/lib/number";
import {
  newProductionId,
  type FinishedUpdate,
} from "@/lib/firebase/productionRepository";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { filamentTotalG } from "../lib/filaments";
import {
  addProductionLayers,
  removeEventLayers,
  submissionEntries,
} from "../lib/finishedGoods";
import { reverseProduction } from "../lib/production";
import {
  buildProductionPayloads,
  nextRowKey,
  planEventRows,
  subitemEventRows,
  wholeEventRows,
  type EventRow,
  type FilRow,
} from "../lib/productionPlan";
import { catalogPricePerKg, filamentLabel } from "../lib/stock";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useFinishedGoods } from "../hooks/useFinishedGoods";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useProduction } from "../hooks/useProduction";
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import type {
  CloudStatus,
  FixedCostSettings,
  ProductionEvent,
  ProductionMode,
  ProductionOutcome,
} from "../types";
import { LogoutButton } from "./LogoutButton";
import { NumberInput } from "./NumberInput";
import { PrintTimeField } from "./ProductForm";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

const OUTCOMES: { value: ProductionOutcome; label: string }[] = [
  { value: "estoque", label: "Peça pro estoque" },
  { value: "encomenda", label: "Encomenda" },
  { value: "teste", label: "Teste / calibração" },
  { value: "falha", label: "Falha" },
  { value: "brinde", label: "Brinde / uso interno" },
  { value: "historico", label: "Histórico (backfill)" },
];
const outcomeLabel = (value: ProductionOutcome) =>
  OUTCOMES.find((o) => o.value === value)?.label ?? value;

function grams(value: number): string {
  return `${Math.round(num(value))} g`;
}

function guardOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.",
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Não foi possível salvar.";
}

export function ProductionPage() {
  const { theme, toggleTheme } = useTheme();
  const { products } = useProducts();
  const { machines } = useMachines();
  const { filaments: stock } = useStock();
  const { fixedCostRate } = useBusinessSettings();
  // O custo fixo NÃO entra no frozenCost da produção — só uso o `calculatePricing`
  // pelos subitens/consumo, e nada que eu leio depende do fixo. `enabled: false`.
  const fixedCosts = useMemo<FixedCostSettings>(
    () => ({ ...fixedCostRate, enabled: DEFAULT_FIXED_COSTS.enabled }),
    [fixedCostRate],
  );
  const { events, status, error, addProduction, deleteProduction } =
    useProduction();
  // Leitura viva dos acabados: a submissão empilha camada no doc do produto e a
  // exclusão a estorna (FEAT-05b). O incremento/estorno grava no batch do evento.
  const { goods } = useFinishedGoods();

  const [selectedKey, setSelectedKey] = useState("");
  const [rows, setRows] = useState<EventRow[]>([]);
  const [outcome, setOutcome] = useState<ProductionOutcome>("estoque");
  const [mode, setMode] = useState<ProductionMode>("real");
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    msg: string;
  } | null>(null);

  // Precificação viva por produto — de onde saem os subitens e o consumo default.
  const pricingByProduct = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePricing>>();
    for (const product of products) {
      map.set(product.id, calculatePricing(product, machines, fixedCosts, stock));
    }
    return map;
  }, [products, machines, fixedCosts, stock]);

  // Opções do seletor: produto inteiro + cada subitem vendável + "Avulso".
  const options = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const sorted = [...products].sort((a, b) =>
      (a.name || a.mainStageName || "").localeCompare(
        b.name || b.mainStageName || "",
        "pt-BR",
      ),
    );
    for (const product of sorted) {
      const base = product.name || product.mainStageName || "(sem nome)";
      list.push({ key: `whole:${product.id}`, label: base });
      const subitems = pricingByProduct.get(product.id)?.subitems ?? [];
      for (const sub of subitems) {
        list.push({
          key: `sub:${product.id}:${sub.id}`,
          label: `${base} — ${sub.name || "subitem"}`,
        });
      }
    }
    return list;
  }, [products, pricingByProduct]);

  // Linha avulsa (sem produto): a única montada aqui — as de produto/subitem vêm
  // do builder compartilhado (`productionPlan`), que a encomenda do passo 8 reusa.
  function avulsoRow(): EventRow {
    return {
      key: nextRowKey(),
      productName: "",
      machineId: machines[0]?.id ?? "",
      printHours: 0,
      filaments: [
        {
          filamentId: null,
          label: "",
          colorName: "",
          totalG: 0,
          pricePerKg: DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
        },
      ],
      laborCost: 0,
      energyTariff: DEFAULT_PRODUCT_INPUT.energyTariff ?? 0,
    };
  }

  function selectOption(key: string) {
    setSelectedKey(key);
    setFeedback(null);
    if (key === "avulso") {
      setRows([avulsoRow()]);
      return;
    }
    if (key.startsWith("whole:")) {
      const product = products.find((p) => p.id === key.slice("whole:".length));
      setRows(product ? wholeEventRows(product, machines, stock) : []);
      return;
    }
    if (key.startsWith("sub:")) {
      const [, productId, subitemId] = key.split(":");
      const product = products.find((p) => p.id === productId);
      const sub = pricingByProduct
        .get(productId ?? "")
        ?.subitems?.find((s) => s.id === subitemId);
      setRows(product && sub ? subitemEventRows(product, sub, stock) : []);
      return;
    }
    setRows([]);
  }

  function updateRow(key: string, patch: Partial<EventRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function updateFil(rowKeyId: string, index: number, patch: Partial<FilRow>) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId
          ? {
              ...row,
              filaments: row.filaments.map((f, i) =>
                i === index ? { ...f, ...patch } : f,
              ),
            }
          : row,
      ),
    );
  }

  function setFilColor(rowKeyId: string, index: number, filamentId: string) {
    const color = stock.find((c) => c.id === filamentId);
    updateFil(rowKeyId, index, {
      filamentId: color ? color.id : null,
      label: color ? filamentLabel(color) : "",
      colorName: color ? color.colorName : "",
      pricePerKg: color
        ? catalogPricePerKg(color) || DEFAULT_PRODUCT_INPUT.filamentPricePerKg || 110
        : DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
    });
  }

  function addFil(rowKeyId: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId
          ? {
              ...row,
              filaments: [
                ...row.filaments,
                {
                  filamentId: null,
                  label: "",
                  colorName: "",
                  totalG: 0,
                  pricePerKg: DEFAULT_PRODUCT_INPUT.filamentPricePerKg ?? 110,
                },
              ],
            }
          : row,
      ),
    );
  }

  function removeFil(rowKeyId: string, index: number) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKeyId && row.filaments.length > 1
          ? { ...row, filaments: row.filaments.filter((_, i) => i !== index) }
          : row,
      ),
    );
  }

  // Planeja as linhas via builder compartilhado (baixa FIFO encadeada + custo
  // congelado). `genId` gera o id de cada evento (real ao salvar; fixo no preview).
  const planEvents = (genId: () => string) =>
    planEventRows(rows, mode, stock, machines, genId);

  // Preview ao vivo (não grava): usa um id fixo — o itemId não importa aqui.
  const preview = useMemo(
    () => planEvents(() => "preview"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode, stock, machines],
  );

  // Delta do acabado da submissão (FEAT-05b). Só quando o desfecho é `estoque` e
  // há produto (avulso não vira acabado). Uma submissão = UMA unidade; o custo é a
  // soma do `frozenCost` de todos os eventos (dedup multi-máquina). As camadas são
  // ancoradas no PRIMEIRO evento (`built[0].id`) — excluir aquele card estorna o
  // acabado inteiro da submissão; cards de máquina secundária só estornam filamento.
  function finishedForSave(
    built: ReturnType<typeof planEvents>["built"],
    totalFrozen: number,
    at: number,
  ): FinishedUpdate | null {
    if (outcome !== "estoque" || built.length === 0) return null;

    let productId: string | undefined;
    let subitemId: string | undefined;
    if (selectedKey.startsWith("whole:")) {
      productId = selectedKey.slice("whole:".length);
    } else if (selectedKey.startsWith("sub:")) {
      [, productId, subitemId] = selectedKey.split(":");
    }
    if (!productId) return null; // avulso

    const product = products.find((p) => p.id === productId);
    if (!product) return null;
    const name = product.name || product.mainStageName || "(sem nome)";
    const subitems = pricingByProduct.get(productId)?.subitems ?? [];

    const entries = submissionEntries(name, totalFrozen, {
      subitemId,
      subitemName: subitems.find((s) => s.id === subitemId)?.name,
      subitems:
        !subitemId && subitems.length > 0
          ? subitems.map((s) => ({ id: s.id, name: s.name, cost: s.cost }))
          : undefined,
    });

    const good = goods.find((g) => g.id === productId) ?? null;
    const payload = addProductionLayers(
      good,
      productId,
      name,
      entries,
      built[0].id,
      at,
    );
    return { productId, payload };
  }

  // Estorno do acabado ao excluir um evento (FEAT-05b): só quando aquele evento
  // criou camadas (é o PRIMEIRO da sua submissão). Devolve o doc já sem elas.
  function finishedForRemove(event: ProductionEvent): FinishedUpdate | null {
    if (event.outcome !== "estoque" || !event.productId) return null;
    const good = goods.find((g) => g.id === event.productId);
    if (!good) return null;
    const created = good.skus.some((sku) =>
      sku.layers.some((layer) => layer.sourceEventId === event.id),
    );
    if (!created) return null;
    const reverted = removeEventLayers(good, event.id);
    return {
      productId: good.productId,
      payload: {
        productId: good.productId,
        productName: good.productName,
        skus: reverted.skus,
        createdAt: good.createdAt,
      },
    };
  }

  async function save() {
    if (rows.length === 0) {
      setFeedback({ kind: "error", msg: "Escolha o que foi impresso." });
      return;
    }
    for (const row of rows) {
      if (!row.productName.trim()) {
        setFeedback({ kind: "error", msg: "Dê um nome à impressão." });
        return;
      }
      if (num(row.printHours) <= 0) {
        setFeedback({
          kind: "error",
          msg: `Informe o tempo de impressão de "${row.productName || "impressão"}".`,
        });
        return;
      }
    }

    try {
      guardOnline();
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
      return;
    }

    setSaving(true);
    setFeedback(null);
    const now = Date.now();
    const at = toTimestamp(dateStr);
    const planned = planEvents(newProductionId);

    const entries = buildProductionPayloads(planned.built, {
      at,
      outcome,
      mode,
      notes,
      createdAt: now,
    });

    const finished = finishedForSave(planned.built, planned.summary.frozen, at);

    try {
      await addProduction(entries, planned.colorUpdates, finished);
      setFeedback({
        kind: "ok",
        msg:
          entries.length > 1
            ? `✓ ${entries.length} produções registradas.`
            : "✓ Produção registrada.",
      });
      setSelectedKey("");
      setRows([]);
      setNotes("");
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(event: ProductionEvent) {
    const ok = window.confirm(
      `Excluir a produção "${event.productName || "impressão"}"?\n\n` +
        (event.stockMoves.length > 0
          ? "O filamento deduzido volta pro estoque.\n\n"
          : "") +
        "Isso não pode ser desfeito.",
    );
    if (!ok) return;
    try {
      guardOnline();
      const colorUpdates = reverseProduction(event.stockMoves, stock);
      await deleteProduction(event.id, colorUpdates, finishedForRemove(event));
      setFeedback({ kind: "ok", msg: "✓ Produção excluída e estoque estornado." });
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    }
  }

  const recent = useMemo(
    () => [...events].sort((a, b) => b.at - a.at),
    [events],
  );

  const canSave = rows.length > 0 && !saving;

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Factory size={18} />
          </div>
          <div>
            <h1 className="sg">Produção</h1>
            <div className="brand-meta">
              <span>Registro de impressão — Lopo Lab</span>
              <span className={`cloud-status ${status}`}>
                {statusLabel[status]}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <Link className="icon-label-button" href="/">
            <ArrowLeft size={15} /> Calculadora
          </Link>
          <Link className="icon-label-button" href="/estoque">
            <span aria-hidden="true">📦</span> Estoque
          </Link>
          <Link className="icon-label-button" href="/maquinas">
            <span aria-hidden="true">🖨️</span> Impressoras
          </Link>
          <button
            className="icon-label-button"
            type="button"
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
          <LogoutButton />
        </div>
      </div>

      {error ? <div className="app-error">{error}</div> : null}

      <p className="subtitle prod-intro">
        Registre TODA impressão — vire venda ou não. É daqui que sai a baixa de
        filamento e as horas de máquina. Teste, falha e brinde também contam.
      </p>

      <div className="prod-form">
        <div className="field-block">
          <div className="section-label">O que foi impresso?</div>
          <select
            className="field-input"
            value={selectedKey}
            onChange={(event) => selectOption(event.target.value)}
          >
            <option value="">Escolha um produto, subitem ou avulso…</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="avulso">Avulso / sem produto</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="prod-empty">
            Escolha acima para começar. Cada peça/subitem vira um registro; um
            produto inteiro que roda em máquinas diferentes gera um registro por
            máquina.
          </div>
        ) : null}

        {rows.map((row) => {
          const isAvulso = !row.productId && !row.subitemId;
          return (
            <div className="prod-event" key={row.key}>
              <div className="field-block compact">
                <div className="section-label">Nome da impressão</div>
                <input
                  className="field-input"
                  type="text"
                  value={row.productName}
                  onChange={(event) =>
                    updateRow(row.key, { productName: event.target.value })
                  }
                  placeholder="Ex.: Vaso espiral"
                />
              </div>

              <div className="two-col">
                <div className="field-block compact">
                  <div className="section-label">Máquina</div>
                  <select
                    className="field-input"
                    value={row.machineId}
                    onChange={(event) =>
                      updateRow(row.key, { machineId: event.target.value })
                    }
                  >
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-block compact">
                  <PrintTimeField
                    label="⏱ Tempo"
                    value={row.printHours}
                    onChange={(printHours) =>
                      updateRow(row.key, { printHours })
                    }
                  />
                </div>
              </div>

              <div className="section-label">Filamento</div>
              {row.filaments.map((fil, index) => (
                <div className="prod-fil" key={index}>
                  {isAvulso ? (
                    <select
                      className="field-input"
                      value={fil.filamentId ?? ""}
                      onChange={(event) =>
                        setFilColor(row.key, index, event.target.value)
                      }
                    >
                      <option value="">Avulso (livre)</option>
                      {stock
                        .filter((c) => !c.archived)
                        .map((color) => (
                          <option key={color.id} value={color.id}>
                            {filamentLabel(color)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="prod-fil-name">{fil.label}</span>
                  )}
                  {isAvulso && !fil.filamentId ? (
                    <input
                      className="field-input prod-fil-free"
                      type="text"
                      value={fil.colorName}
                      onChange={(event) =>
                        updateFil(row.key, index, {
                          colorName: event.target.value,
                        })
                      }
                      placeholder="Cor (livre)"
                    />
                  ) : null}
                  <div className="prod-fil-g">
                    <NumberInput
                      className="field-input"
                      min={0}
                      value={fil.totalG}
                      onChange={(totalG) =>
                        updateFil(row.key, index, { totalG })
                      }
                    />
                    <span className="prod-unit">g</span>
                  </div>
                  {isAvulso && !fil.filamentId ? (
                    <div className="prod-fil-price">
                      <NumberInput
                        className="field-input"
                        min={0}
                        step="0.01"
                        value={fil.pricePerKg}
                        onChange={(pricePerKg) =>
                          updateFil(row.key, index, { pricePerKg })
                        }
                      />
                      <span className="prod-unit">/kg</span>
                    </div>
                  ) : null}
                  {isAvulso && row.filaments.length > 1 ? (
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeFil(row.key, index)}
                      title="Remover cor"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ))}
              {isAvulso ? (
                <button
                  className="link-button prod-add-fil"
                  type="button"
                  onClick={() => addFil(row.key)}
                >
                  <Plus size={14} /> Outra cor
                </button>
              ) : null}
            </div>
          );
        })}

        {rows.length > 0 ? (
          <>
            <div className="two-col">
              <div className="field-block compact">
                <div className="section-label">Desfecho</div>
                <select
                  className="field-input"
                  value={outcome}
                  onChange={(event) => {
                    const next = event.target.value as ProductionOutcome;
                    setOutcome(next);
                    if (next === "historico") setMode("historico");
                  }}
                >
                  {OUTCOMES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-block compact">
                <div className="section-label">Modo</div>
                <select
                  className="field-input"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as ProductionMode)
                  }
                >
                  <option value="real">Real (deduz do estoque)</option>
                  <option value="historico">Histórico (não deduz)</option>
                </select>
              </div>
            </div>

            <div className="two-col">
              <div className="field-block compact">
                <div className="section-label">Data</div>
                <input
                  className="field-input"
                  type="date"
                  value={dateStr}
                  onChange={(event) => setDateStr(event.target.value)}
                />
              </div>
              <div className="field-block compact">
                <div className="section-label">
                  Observações <span className="label-hint">(opcional)</span>
                </div>
                <input
                  className="field-input"
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalhes da impressão"
                />
              </div>
            </div>

            <div className="prod-summary">
              <div className="prod-summary-line">
                <span>
                  {preview.built.length > 1
                    ? `${preview.built.length} registros`
                    : "1 registro"}{" "}
                  · {grams(preview.summary.grams)}
                </span>
                <span>
                  custo{" "}
                  <strong className="mono">
                    {formatCurrency(preview.summary.frozen)}
                  </strong>
                </span>
              </div>
              {mode === "historico" ? (
                <div className="prod-note">
                  Modo histórico: registra horas e gramas, mas <strong>não</strong>{" "}
                  deduz rolo (custo pelo preço informado).
                </div>
              ) : (
                <>
                  {preview.summary.crossesRoll ? (
                    <div className="prod-warn info">
                      Vai atravessar pro próximo rolo em alguma cor — custo misto
                      (na A1 sem AMS, é troca manual no meio da impressão).
                    </div>
                  ) : null}
                  {preview.summary.shortfallG > 0 ? (
                    <div className="prod-warn strong">
                      Passa {grams(preview.summary.shortfallG)} do estoque total —
                      o saldo da cor fica negativo (contagem furada?).
                    </div>
                  ) : null}
                </>
              )}
              {outcome === "estoque" && selectedKey && selectedKey !== "avulso" ? (
                <div className="prod-note">
                  → Entra no <strong>Estoque de Produtos</strong> (peça pronta) com
                  o custo desta impressão.
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {feedback ? (
          <div className={feedback.kind === "ok" ? "form-ok" : "form-error"}>
            {feedback.msg}
          </div>
        ) : null}

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={save}
            disabled={!canSave}
          >
            {saving
              ? "Registrando..."
              : preview.built.length > 1
                ? `Registrar (${preview.built.length})`
                : "Registrar produção"}
          </button>
        </div>
      </div>

      <div className="section-label prod-recent-label">
        Produções recentes {recent.length > 0 ? `(${recent.length})` : ""}
      </div>
      {recent.length === 0 ? (
        <div className="sales-empty">
          Nenhuma produção registrada ainda.
        </div>
      ) : (
        <div className="prod-list">
          {recent.map((event) => {
            const totalG = event.filaments.reduce(
              (sum, f) => sum + filamentTotalG(f),
              0,
            );
            return (
              <div className="prod-card" key={event.id}>
                <div className="prod-card-main">
                  <strong>{event.productName || "(sem nome)"}</strong>
                  <span className="prod-card-sub">
                    {formatDate(event.at)} · {event.machineName || "—"} ·{" "}
                    {num(event.printHours).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    h · {grams(totalG)}
                  </span>
                </div>
                <div className="prod-card-side">
                  <span className={`prod-badge ${event.outcome}`}>
                    {outcomeLabel(event.outcome)}
                  </span>
                  {event.mode === "historico" ? (
                    <span className="prod-badge hist">histórico</span>
                  ) : null}
                  <strong className="mono">
                    {formatCurrency(event.frozenCost)}
                  </strong>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => void remove(event)}
                    title="Excluir e estornar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
