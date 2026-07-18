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
import { newProductionId } from "@/lib/firebase/productionRepository";
import { DEFAULT_FIXED_COSTS, DEFAULT_PRODUCT_INPUT } from "../constants";
import { calculatePricing, normalizeStages } from "../lib/calculatePricing";
import { filamentTotalG, normalizeFilaments } from "../lib/filaments";
import {
  planProduction,
  productionCost,
  reverseProduction,
} from "../lib/production";
import { catalogPricePerKg, filamentLabel } from "../lib/stock";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useProduction } from "../hooks/useProduction";
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import type {
  CloudStatus,
  FilamentUsage,
  FixedCostSettings,
  Machine,
  ProductionEvent,
  ProductionMode,
  ProductionOutcome,
  ProductionPayload,
  SavedProduct,
  StockFilament,
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

// Uma linha de filamento sendo editada no form (default do produto ou avulsa).
type FilRow = {
  filamentId: string | null;
  label: string; // exibição (cor do estoque) ou texto livre
  colorName: string;
  totalG: number;
  pricePerKg: number;
};

// Uma linha = UM evento de produção a gravar. A maioria das seleções tem 1 linha;
// um produto inteiro que roda em máquinas diferentes semeia N linhas (uma por
// máquina), conforme decisão do dono (o ROI da 04c atribui à impressora certa).
type EventRow = {
  key: string;
  productName: string;
  productId?: string;
  subitemId?: string;
  machineId: string;
  printHours: number;
  filaments: FilRow[];
  laborCost: number; // labor congelado da etapa/subitem (não editado aqui)
};

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

let rowSeq = 0;
const rowKey = () => `row_${Date.now()}_${(rowSeq += 1)}`;

// FilamentUsage (do produto/etapa) → FilRow, resolvendo nome/preço/material da COR
// viva do Estoque quando ligada. Sem `filamentId` = avulso (mantém o texto/preço).
function resolveFilRow(f: FilamentUsage, stock: StockFilament[]): FilRow {
  const total = filamentTotalG(f);
  if (f.filamentId) {
    const color = stock.find((c) => c.id === f.filamentId);
    if (color) {
      const live = catalogPricePerKg(color);
      return {
        filamentId: color.id,
        label: filamentLabel(color),
        colorName: color.colorName,
        totalG: total,
        pricePerKg: live > 0 ? live : num(f.pricePerKg),
      };
    }
  }
  return {
    filamentId: null,
    label: f.colorName || "Avulso",
    colorName: f.colorName ?? "",
    totalG: total,
    pricePerKg: num(f.pricePerKg),
  };
}

// Labor congelado de uma etapa: min/60 × taxa (a da etapa, ou a do produto).
function stageLabor(
  laborMinutes: number,
  laborRate: number | undefined,
  productRate: number,
): number {
  return (num(laborMinutes) / 60) * num(laborRate ?? productRate);
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

  // Monta as linhas-evento de um produto INTEIRO: agrupa etapas (principal +
  // extras) por máquina; cada grupo vira uma linha (hora Σ, filamentos concat,
  // labor Σ). Mono-máquina = 1 linha; multi-máquina = N linhas (decisão do dono).
  function wholeRows(product: SavedProduct): EventRow[] {
    const base = product.name || product.mainStageName || "(sem nome)";
    const stages = [
      {
        machineId: product.machineId,
        printHours: num(product.printHours),
        filaments: normalizeFilaments(product),
        labor: stageLabor(product.laborMinutes, undefined, product.laborRate),
      },
      ...normalizeStages(product).map((stage) => ({
        machineId: stage.machineId,
        printHours: num(stage.printHours),
        filaments: normalizeFilaments(stage),
        labor: stageLabor(stage.laborMinutes, stage.laborRate, product.laborRate),
      })),
    ];

    const byMachine = new Map<
      string,
      { printHours: number; filaments: FilamentUsage[]; labor: number }
    >();
    for (const stage of stages) {
      const group = byMachine.get(stage.machineId) ?? {
        printHours: 0,
        filaments: [],
        labor: 0,
      };
      group.printHours += stage.printHours;
      group.filaments.push(...stage.filaments);
      group.labor += stage.labor;
      byMachine.set(stage.machineId, group);
    }

    const multi = byMachine.size > 1;
    return Array.from(byMachine.entries()).map(([machineId, group]) => {
      const machineName =
        machines.find((m) => m.id === machineId)?.name ?? "";
      return {
        key: rowKey(),
        productName: multi ? `${base} (${machineName})` : base,
        productId: product.id,
        machineId,
        printHours: group.printHours,
        filaments: group.filaments.map((f) => resolveFilRow(f, stock)),
        laborCost: group.labor,
      };
    });
  }

  function subitemRow(product: SavedProduct, subitemId: string): EventRow[] {
    const result = pricingByProduct.get(product.id);
    const sub = result?.subitems?.find((s) => s.id === subitemId);
    if (!sub) return [];
    const base = product.name || product.mainStageName || "(sem nome)";
    const primary = sub.machineUsage[0];
    return [
      {
        key: rowKey(),
        productName: `${base} — ${sub.name || "subitem"}`,
        productId: product.id,
        subitemId: sub.id,
        machineId: primary?.machineId ?? product.machineId,
        printHours: sub.printHours,
        filaments: sub.filaments.map((f) => resolveFilRow(f, stock)),
        laborCost: sub.costBreakdown.labor,
      },
    ];
  }

  function avulsoRow(): EventRow {
    return {
      key: rowKey(),
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
      setRows(product ? wholeRows(product) : []);
      return;
    }
    if (key.startsWith("sub:")) {
      const [, productId, subitemId] = key.split(":");
      const product = products.find((p) => p.id === productId);
      setRows(product ? subitemRow(product, subitemId) : []);
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

  // Converte uma FilRow em FilamentUsage congelável (material/brand da COR — D7).
  function toUsage(f: FilRow): FilamentUsage {
    const color = f.filamentId
      ? stock.find((c) => c.id === f.filamentId)
      : undefined;
    return {
      filamentId: f.filamentId ?? null,
      colorName: color ? color.colorName : f.colorName,
      pricePerKg: num(f.pricePerKg),
      totalG: num(f.totalG),
      ...(color?.material ? { material: color.material } : {}),
      ...(color?.brand ? { brand: color.brand } : {}),
    };
  }

  // Planeja TODOS os eventos das linhas com a baixa ENCADEADA (dois eventos na
  // mesma cor deduzem do saldo já mexido). Puro em relação ao estado — não grava.
  // `genId` gera o id de cada evento (real ao salvar; placeholder no preview).
  function planEvents(genId: () => string) {
    const map = new Map(stock.map((c) => [c.id, c]));
    const touched = new Set<string>();
    const built = rows.map((row) => {
      const filaments = row.filaments
        .filter((f) => num(f.totalG) > 0)
        .map(toUsage);
      const id = genId();
      const plan = planProduction(filaments, Array.from(map.values()), id, mode);
      for (const color of plan.colorUpdates) {
        map.set(color.id, color);
        touched.add(color.id);
      }
      const machine: Machine | undefined =
        machines.find((m) => m.id === row.machineId) ?? machines[0];
      const product = row.productId
        ? products.find((p) => p.id === row.productId)
        : undefined;
      const tariff = product?.energyTariff ?? DEFAULT_PRODUCT_INPUT.energyTariff;
      const cost = machine
        ? productionCost(
            machine,
            row.printHours,
            tariff,
            plan.materialCost,
            row.laborCost,
          )
        : {
            material: plan.materialCost,
            energy: 0,
            depreciation: 0,
            maintenance: 0,
            labor: row.laborCost,
            total: plan.materialCost + row.laborCost,
          };
      return { id, row, plan, cost, machine, filaments };
    });

    const colorUpdates = Array.from(touched).map((id) => map.get(id)!);
    const summary = built.reduce(
      (acc, e) => {
        acc.material += e.plan.materialCost;
        acc.frozen += e.cost.total;
        acc.grams += e.filaments.reduce((s, f) => s + num(f.totalG), 0);
        acc.crossesRoll = acc.crossesRoll || e.plan.crossesRoll;
        acc.shortfallG += e.plan.shortfallG;
        return acc;
      },
      { material: 0, frozen: 0, grams: 0, crossesRoll: false, shortfallG: 0 },
    );
    return { built, colorUpdates, summary };
  }

  // Preview ao vivo (não grava): usa um id fixo — o itemId não importa aqui.
  const preview = useMemo(
    () => planEvents(() => "preview"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode, stock, machines, products],
  );

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

    const entries = planned.built.map((e) => {
      const payload: ProductionPayload = {
        at,
        outcome,
        mode,
        ...(e.row.productId ? { productId: e.row.productId } : {}),
        ...(e.row.subitemId ? { subitemId: e.row.subitemId } : {}),
        productName: e.row.productName.trim(),
        machineId: e.machine?.id ?? e.row.machineId,
        machineName: e.machine?.name ?? "",
        printHours: num(e.row.printHours),
        filaments: e.filaments,
        frozenCost: e.cost.total,
        stockMoves: e.plan.moves,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdAt: now,
      };
      return { id: e.id, payload };
    });

    try {
      await addProduction(entries, planned.colorUpdates);
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
      await deleteProduction(event.id, colorUpdates);
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
