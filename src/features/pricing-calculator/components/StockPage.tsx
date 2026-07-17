"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import {
  activeRoll,
  adjustRoll,
  balanceG,
  catalogPricePerKg,
  colorStatement,
  filamentLabel,
  filamentReferences,
  isBelowMin,
  materialOptions,
  rollNumbers,
} from "../lib/stock";
import { useProducts } from "../hooks/useProducts";
import { useSales } from "../hooks/useSales";
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import type {
  CloudStatus,
  FilamentRoll,
  StockFilament,
  StockFilamentPayload,
} from "../types";
import { LogoutButton } from "./LogoutButton";
import { StockAdjustModal } from "./StockAdjustModal";
import { StockColorModal, type StockColorDraft } from "./StockColorModal";
import { StockRollModal } from "./StockRollModal";

const statusLabel: Record<CloudStatus, string> = {
  connecting: "Conectando nuvem...",
  synced: "Sincronizado",
  importing: "Importando...",
  error: "Erro de Conexão",
};

function grams(value: number): string {
  return `${Math.round(num(value))} g`;
}

// A cor viva JÁ satisfaz o payload de gravação — o `id` sobra, mas é a chave do
// doc, não um campo: o repo monta o documento campo a campo e não o copia.
// Poupa uma cópia manual a cada gravação desta tela.
function toPayload(color: StockFilament): StockFilamentPayload {
  return color;
}

// Offline o Firestore enfileira a escrita e a Promise fica pendente para sempre
// (nem resolve, nem rejeita) — o botão travaria em "Salvando...". Bloqueia com
// aviso, como em SaleModal/QuotePage (TD-004).
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

export function StockPage() {
  const { theme, toggleTheme } = useTheme();
  const {
    filaments,
    status,
    error,
    addFilament,
    updateFilament,
    deleteFilament,
  } = useStock();
  // Só para o guarda do excluir: quem ainda aponta para a cor. Passa a ter
  // conteúdo a partir da 7c (produto) e da 8 (venda).
  const { products } = useProducts();
  const { sales } = useSales();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rollForId, setRollForId] = useState<string | null>(null);
  const [adjustForId, setAdjustForId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    msg: string;
  } | null>(null);

  // Os modais buscam a cor pelo id na lista viva (não guardam uma cópia): o
  // onSnapshot devolve o doc novo depois de cada gravação e uma cópia presa no
  // estado mostraria o saldo velho no ajuste seguinte.
  const byId = (id: string | null) =>
    id ? (filaments.find((color) => color.id === id) ?? null) : null;
  const editing = byId(editingId);
  const rollFor = byId(rollForId);
  const adjustFor = byId(adjustForId);

  const materials = useMemo(() => materialOptions(filaments), [filaments]);

  const { active, archived } = useMemo(() => {
    const sorted = [...filaments].sort((a, b) =>
      filamentLabel(a).localeCompare(filamentLabel(b), "pt-BR"),
    );
    return {
      active: sorted.filter((color) => !color.archived),
      archived: sorted.filter((color) => color.archived),
    };
  }, [filaments]);

  const totals = useMemo(() => {
    const totalG = active.reduce((sum, color) => sum + balanceG(color), 0);
    return {
      count: active.length,
      totalG,
      low: active.filter(isBelowMin).length,
    };
  }, [active]);

  async function saveColor(draft: StockColorDraft) {
    guardOnline();
    if (editing) {
      await updateFilament(editing.id, { ...toPayload(editing), ...draft });
      return;
    }
    await addFilament({
      ...draft,
      archived: false,
      rolls: [],
      adjustments: [],
      createdAt: Date.now(),
    });
  }

  async function saveRoll(color: StockFilament, roll: FilamentRoll) {
    guardOnline();
    await updateFilament(color.id, {
      ...toPayload(color),
      rolls: [...color.rolls, roll],
    });
  }

  async function saveAdjust(
    color: StockFilament,
    input: { rollId: string; countedG: number; reason: string; at: number },
  ) {
    guardOnline();
    // D6: o saldo passa por `adjustRoll`, que anexa o rastro. É o único caminho
    // desta tela que mexe em `remainingG`.
    const next = adjustRoll(
      color,
      input.rollId,
      input.countedG,
      input.reason,
      input.at,
    );
    await updateFilament(color.id, toPayload(next));
  }

  async function toggleArchive(color: StockFilament) {
    try {
      guardOnline();
      await updateFilament(color.id, {
        ...toPayload(color),
        archived: !color.archived,
      });
      setFeedback({
        kind: "ok",
        msg: color.archived
          ? `✓ "${filamentLabel(color)}" voltou para as cores ativas.`
          : `✓ "${filamentLabel(color)}" foi arquivada.`,
      });
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    }
  }

  async function remove(color: StockFilament) {
    const rolls = color.rolls.length;
    const ok = window.confirm(
      `Excluir "${filamentLabel(color)}" de vez?\n\n` +
        (rolls > 0
          ? `Você perde o histórico de compra de ${rolls} rolo(s) desta cor.\n\n`
          : "") +
        "Isso não pode ser desfeito.",
    );
    if (!ok) return;

    try {
      guardOnline();
      await deleteFilament(color.id);
      setFeedback({ kind: "ok", msg: `✓ "${filamentLabel(color)}" excluída.` });
    } catch (err) {
      setFeedback({ kind: "error", msg: errorMessage(err) });
    }
  }

  function renderCard(color: StockFilament) {
    const balance = balanceG(color);
    const current = activeRoll(color);
    const numbers = rollNumbers(color);
    const refill = catalogPricePerKg(color);
    const low = isBelowMin(color);
    const expanded = expandedId === color.id;
    // Arquivar é a ação normal; excluir só quando ninguém mais aponta para a cor
    // (a partir da 7c/8 isso passa a bloquear de verdade).
    const refs = color.archived
      ? filamentReferences(color.id, products, sales)
      : null;
    const blocked =
      refs !== null && (refs.productNames.length > 0 || refs.salesCount > 0);

    const rolls = [...color.rolls].sort(
      (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
    );
    const spent = rolls.filter((roll) => num(roll.remainingG) <= 0);
    const live = rolls.filter((roll) => num(roll.remainingG) > 0);

    return (
      <div
        className={`stock-card ${color.archived ? "archived" : ""}`}
        key={color.id}
      >
        <div className="stock-head">
          <span
            className="stock-dot"
            style={{ background: color.colorHex || "var(--muted2)" }}
            aria-hidden="true"
          />
          <div className="stock-title">
            <strong>{filamentLabel(color)}</strong>
            <span className="stock-sub">
              {rolls.length === 0
                ? "sem rolo registrado"
                : `${rolls.length} rolo${rolls.length > 1 ? "s" : ""} · repor a ${formatCurrency(refill)}/kg`}
            </span>
          </div>
          <div className="stock-balance">
            <strong className={`mono ${balance < 0 ? "sale-neg" : ""}`}>
              {grams(balance)}
            </strong>
            {low ? (
              <span className="stock-badge low">
                abaixo do mínimo ({grams(color.minG)})
              </span>
            ) : null}
          </div>
        </div>

        <div className="stock-current">
          {current ? (
            <>
              Rolo #{numbers.get(current.id)} em uso ·{" "}
              <strong className="mono">{grams(current.remainingG)}</strong>{" "}
              restantes · pago {formatCurrency(current.pricePerKg)}/kg
            </>
          ) : rolls.length === 0 ? (
            "Nenhum rolo — registre a compra para o saldo começar a contar."
          ) : (
            "Nenhum rolo com saldo. A próxima impressão já sai no negativo."
          )}
        </div>

        <div className="stock-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setRollForId(color.id)}
          >
            <Plus size={14} /> Rolo
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setAdjustForId(color.id)}
            disabled={rolls.length === 0}
            title={
              rolls.length === 0
                ? "Registre um rolo antes de contar"
                : "Ajuste de inventário"
            }
          >
            <ClipboardCheck size={14} /> Ajustar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setEditingId(color.id)}
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => void toggleArchive(color)}
          >
            {color.archived ? (
              <>
                <ArchiveRestore size={14} /> Reativar
              </>
            ) : (
              <>
                <Archive size={14} /> Arquivar
              </>
            )}
          </button>
          {refs !== null && !blocked ? (
            <button
              className="btn btn-secondary btn-sm danger"
              type="button"
              onClick={() => void remove(color)}
            >
              <Trash2 size={14} /> Excluir
            </button>
          ) : null}
          <button
            className="link-button stock-expand"
            type="button"
            onClick={() => setExpandedId(expanded ? null : color.id)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Ocultar" : "Rolos e extrato"}
          </button>
        </div>

        {blocked && refs ? (
          <div className="stock-blocked">
            Não dá para excluir: em uso por{" "}
            {refs.productNames.length > 0
              ? `${refs.productNames.length} produto(s) (${refs.productNames.join(", ")})`
              : ""}
            {refs.productNames.length > 0 && refs.salesCount > 0 ? " e " : ""}
            {refs.salesCount > 0 ? `${refs.salesCount} venda(s)` : ""}. Arquivada
            ela some da lista sem quebrar nada.
          </div>
        ) : null}

        {expanded ? (
          <div className="stock-detail">
            <div className="section-label">Rolos</div>
            {live.length === 0 ? (
              <div className="stock-empty-line">Nenhum rolo com saldo.</div>
            ) : (
              live.map((roll) => (
                <div className="stock-roll" key={roll.id}>
                  <span className="stock-roll-name">
                    #{numbers.get(roll.id)}
                    {roll.id === current?.id ? (
                      <em className="stock-tag">em uso</em>
                    ) : null}
                  </span>
                  <span className="stock-roll-info">
                    {formatDate(roll.purchaseDate)} · {grams(roll.initialG)} a{" "}
                    {formatCurrency(roll.pricePerKg)}/kg
                    {roll.note ? ` · ${roll.note}` : ""}
                  </span>
                  <span className="mono stock-roll-left">
                    {grams(roll.remainingG)}
                  </span>
                </div>
              ))
            )}

            {spent.length > 0 ? (
              <details className="stock-spent">
                <summary>Rolos anteriores ({spent.length})</summary>
                {spent.map((roll) => (
                  <div className="stock-roll" key={roll.id}>
                    <span className="stock-roll-name">#{numbers.get(roll.id)}</span>
                    <span className="stock-roll-info">
                      {formatDate(roll.purchaseDate)} · {grams(roll.initialG)} a{" "}
                      {formatCurrency(roll.pricePerKg)}/kg
                      {roll.note ? ` · ${roll.note}` : ""}
                    </span>
                    <span
                      className={`mono stock-roll-left ${
                        num(roll.remainingG) < 0 ? "sale-neg" : ""
                      }`}
                    >
                      {grams(roll.remainingG)}
                    </span>
                  </div>
                ))}
              </details>
            ) : null}

            <div className="section-label stock-statement-label">Extrato</div>
            {colorStatement(color).map((entry) => (
              <div className="stock-entry" key={entry.id}>
                <span className="stock-entry-date mono">
                  {formatDate(entry.at)}
                </span>
                <span className="stock-entry-desc">
                  {entry.kind === "purchase" ? (
                    <>
                      Compra do rolo #{numbers.get(entry.rollId)} ·{" "}
                      {formatCurrency(entry.pricePerKg)}/kg
                      {entry.note ? ` · ${entry.note}` : ""}
                    </>
                  ) : (
                    <>
                      Ajuste do rolo #{numbers.get(entry.rollId)} ·{" "}
                      {entry.reason}
                      <em className="stock-entry-sub">
                        sistema tinha {grams(entry.beforeG)}, contado{" "}
                        {grams(entry.afterG)}
                      </em>
                    </>
                  )}
                </span>
                <span
                  className={`mono stock-entry-delta ${
                    entry.deltaG < 0 ? "sale-neg" : "sale-pos"
                  }`}
                >
                  {entry.deltaG > 0 ? "+" : "−"}
                  {Math.round(Math.abs(entry.deltaG))} g
                </span>
              </div>
            ))}
            <p className="stock-note">
              O consumo das impressões ainda não aparece aqui: ele nasce junto da
              baixa automática na venda. Por enquanto o saldo só se move por
              compra e por ajuste.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Estoque</h1>
            <div className="brand-meta">
              <span>Filamento por cor — Lopo Lab</span>
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
          <Link className="icon-label-button" href="/vendas">
            <span aria-hidden="true">🧾</span> Vendas
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

      <div className="sales-totals stock-totals">
        <div className="sales-total-card">
          <span>Cores ativas</span>
          <strong className="sg">{totals.count}</strong>
          <span className="sales-total-sub">
            {archived.length > 0 ? `${archived.length} arquivada(s)` : "nenhuma arquivada"}
          </span>
        </div>
        <div className="sales-total-card">
          <span>Saldo total</span>
          <strong className={`sg mono ${totals.totalG < 0 ? "sale-neg" : ""}`}>
            {formatDecimal(totals.totalG / 1000)} kg
          </strong>
          <span className="sales-total-sub">soma dos rolos</span>
        </div>
        <div className="sales-total-card">
          <span>Abaixo do mínimo</span>
          <strong className={`sg ${totals.low > 0 ? "sale-neg" : ""}`}>
            {totals.low}
          </strong>
          <span className="sales-total-sub">precisa repor</span>
        </div>
      </div>

      <div className="stock-bar">
        <p className="stock-intro">
          Cada cor guarda os rolos que você comprou, com o preço real de cada um.
          O consumo é do rolo mais antigo para o mais novo. Já dá para escolher a
          cor no produto (o preço/kg sai daqui, do rolo mais novo); a baixa
          automática na venda vem no próximo passo.
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> Nova cor
        </button>
      </div>

      {feedback ? (
        <div className={feedback.kind === "ok" ? "form-ok" : "form-error"}>
          {feedback.msg}
        </div>
      ) : null}

      {filaments.length === 0 ? (
        <div className="sales-empty">
          Nenhuma cor cadastrada ainda. Comece pelo filamento que você mais usa —
          cadastre a cor e registre o rolo que está na impressora.
        </div>
      ) : (
        <div className="stock-list">{active.map(renderCard)}</div>
      )}

      {archived.length > 0 ? (
        <details className="stock-archived-box">
          <summary>Cores arquivadas ({archived.length})</summary>
          <div className="stock-list">{archived.map(renderCard)}</div>
        </details>
      ) : null}

      {creating || editing ? (
        <StockColorModal
          color={editing}
          materials={materials}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSave={saveColor}
        />
      ) : null}

      {rollFor ? (
        <StockRollModal
          color={rollFor}
          onClose={() => setRollForId(null)}
          onSave={(roll) => saveRoll(rollFor, roll)}
        />
      ) : null}

      {adjustFor ? (
        <StockAdjustModal
          color={adjustFor}
          onClose={() => setAdjustForId(null)}
          onSave={(input) => saveAdjust(adjustFor, input)}
        />
      ) : null}
    </main>
  );
}
