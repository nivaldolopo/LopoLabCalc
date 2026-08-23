"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import { num } from "@/lib/number";
import { matchesQuery } from "@/lib/text";
import {
  activeLot,
  adjustLot,
  balanceQty,
  catalogUnitPrice,
  isBelowMin,
  lotNumbers,
  supplyReferences,
  supplyStatement,
} from "../lib/supplies";
import { supplyIdTable } from "../lib/idTable";
import { useSupplies } from "../hooks/useSupplies";
import type {
  ProductionEvent,
  SavedProduct,
  Supply,
  SupplyLot,
  SupplyPayload,
} from "../types";
import { useConfirm } from "./ConfirmDialog";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { PageIntro } from "./PageIntro";
import { SearchBox } from "./SearchBox";
import { SupplyAdjustModal } from "./SupplyAdjustModal";
import { SupplyLotModal } from "./SupplyLotModal";
import { SupplyModal, type SupplyDraft } from "./SupplyModal";

// Aba "Insumos" do Estoque (7e). Componente próprio — não mais um ramo do
// ternário da `StockPage`: ele já carrega filamento e produtos, e um terceiro
// vocabulário inline deixaria a página ilegível. Assina o `useSupplies` sozinho;
// produtos e produção chegam por prop, de quem já os assina.
type SuppliesTabProps = {
  products: SavedProduct[];
  production: ProductionEvent[];
  // Rótulo curto do desfecho da produção, para a linha de consumo do extrato.
  outcomeShort: Record<ProductionEvent["outcome"], string>;
};

// O insumo vivo JÁ satisfaz o payload (o `id` sobra, mas é a chave do doc e o
// repo monta o documento campo a campo) — mesma economia do `toPayload` da cor.
function toPayload(supply: Supply): SupplyPayload {
  return supply;
}

export function SuppliesTab({
  products,
  production,
  outcomeShort,
}: SuppliesTabProps) {
  const { supplies, error, addSupply, updateSupply, deleteSupply } =
    useSupplies();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lotForId, setLotForId] = useState<string | null>(null);
  const [adjustForId, setAdjustForId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // UX-05: busca por nome do insumo. Client-side (insumos têm teto natural).
  const [query, setQuery] = useState("");
  const { note, ok, fail, clear } = useFeedback();

  // Ver o comentário do gêmeo em `StockPage` (aba Filamentos).
  async function copiarDePara() {
    try {
      await copyText(supplyIdTable(supplies));
      ok(
        `Tabela de ${supplies.length} insumo(s) copiada — cole no Sheets/Excel.`,
      );
    } catch (err) {
      fail(errorMessage(err));
    }
  }
  const { ask, dialog } = useConfirm();

  // Os modais buscam o insumo pelo id na lista viva (não guardam cópia): uma
  // cópia presa no estado mostraria o saldo velho no ajuste seguinte.
  const byId = (id: string | null) =>
    id ? (supplies.find((supply) => supply.id === id) ?? null) : null;
  const editing = byId(editingId);
  const lotFor = byId(lotForId);
  const adjustFor = byId(adjustForId);

  const { active, archived } = useMemo(() => {
    const sorted = [...supplies].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
    return {
      active: sorted.filter((supply) => !supply.archived),
      archived: sorted.filter((supply) => supply.archived),
    };
  }, [supplies]);

  // UX-05: só a lista visível filtra; os totais do topo contam o estoque inteiro.
  const activeShown = useMemo(
    () => active.filter((supply) => matchesQuery(query, supply.name)),
    [active, query],
  );
  const archivedShown = useMemo(
    () => archived.filter((supply) => matchesQuery(query, supply.name)),
    [archived, query],
  );

  const totals = useMemo(() => {
    // Valor parado = saldo de cada lote ao preço REAL pago nele (não ao de
    // catálogo): é dinheiro que já saiu do caixa, não custo de repor.
    const value = active.reduce(
      (sum, supply) =>
        sum +
        supply.lots.reduce(
          (lotSum, lot) => lotSum + num(lot.remainingQty) * num(lot.unitPrice),
          0,
        ),
      0,
    );
    return {
      count: active.length,
      value,
      low: active.filter(isBelowMin).length,
    };
  }, [active]);

  async function saveSupplyDraft(draft: SupplyDraft) {
    guardOnline();
    if (editing) {
      await updateSupply(editing.id, { ...toPayload(editing), ...draft });
      return;
    }
    await addSupply({
      ...draft,
      archived: false,
      lots: [],
      adjustments: [],
      createdAt: Date.now(),
    });
  }

  async function saveLot(supply: Supply, lot: SupplyLot) {
    guardOnline();
    await updateSupply(supply.id, {
      ...toPayload(supply),
      lots: [...supply.lots, lot],
    });
  }

  async function saveAdjust(
    supply: Supply,
    input: { lotId: string; counted: number; reason: string; at: number },
  ) {
    guardOnline();
    // D6: o saldo passa por `adjustLot`, que anexa o rastro. É o único caminho
    // desta aba que mexe em `remainingQty`.
    const next = adjustLot(
      supply,
      input.lotId,
      input.counted,
      input.reason,
      input.at,
    );
    await updateSupply(supply.id, toPayload(next));
  }

  async function toggleArchive(supply: Supply) {
    try {
      guardOnline();
      await updateSupply(supply.id, {
        ...toPayload(supply),
        archived: !supply.archived,
      });
      ok(
        supply.archived
          ? `“${supply.name}” voltou para os insumos ativos.`
          : `“${supply.name}” foi arquivado.`,
      );
    } catch (err) {
      fail(errorMessage(err));
    }
  }

  async function remove(supply: Supply) {
    const lots = supply.lots.length;
    const confirmed = await ask({
      title: `Excluir “${supply.name}” de vez?`,
      body: (
        <>
          {lots > 0 ? (
            <p>
              Você perde o histórico de compra de{" "}
              <strong>
                {lots} lote{lots > 1 ? "s" : ""}
              </strong>{" "}
              deste insumo.
            </p>
          ) : null}
          <p className="confirm-safe">
            As produções que já consumiram este insumo não mudam — o custo delas
            está congelado.
          </p>
          <p>Isso não pode ser desfeito.</p>
        </>
      ),
      confirmLabel: "Excluir insumo",
      danger: true,
    });
    if (!confirmed) return;

    try {
      guardOnline();
      await deleteSupply(supply.id);
      ok(`“${supply.name}” excluído.`);
    } catch (err) {
      fail(errorMessage(err));
    }
  }

  function qty(value: number, unit: string): string {
    return `${Math.round(num(value))} ${unit}`;
  }

  function renderCard(supply: Supply) {
    const balance = balanceQty(supply);
    const current = activeLot(supply);
    const numbers = lotNumbers(supply);
    const refill = catalogUnitPrice(supply);
    const low = isBelowMin(supply);
    const expanded = expandedId === supply.id;
    // Arquivar é a ação normal; excluir só quando nenhum produto aponta mais.
    const refs = supply.archived ? supplyReferences(supply.id, products) : null;
    const blocked = refs !== null && refs.productNames.length > 0;

    const lots = [...supply.lots].sort(
      (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
    );
    const spent = lots.filter((lot) => num(lot.remainingQty) <= 0);
    const live = lots.filter((lot) => num(lot.remainingQty) > 0);

    return (
      <div
        className={`stock-card ${supply.archived ? "archived" : ""}`}
        key={supply.id}
      >
        <div className="stock-head">
          <div className="stock-title">
            <strong>{supply.name}</strong>
            <span className="stock-sub">
              {lots.length === 0
                ? "sem compra registrada"
                : `${lots.length} lote${lots.length > 1 ? "s" : ""} · repor a ${formatCurrency(refill)}/${supply.unit}`}
            </span>
          </div>
          <div className="stock-balance">
            <strong className={`mono ${balance < 0 ? "sale-neg" : ""}`}>
              {qty(balance, supply.unit)}
            </strong>
            {low ? (
              <span className="stock-badge low">
                abaixo do mínimo ({qty(supply.minQty, supply.unit)})
              </span>
            ) : null}
          </div>
        </div>

        <div className="stock-current">
          {current ? (
            <>
              Lote #{numbers.get(current.id)} em uso ·{" "}
              <strong className="mono">
                {qty(current.remainingQty, supply.unit)}
              </strong>{" "}
              restantes · pago {formatCurrency(current.unitPrice)}/{supply.unit}
            </>
          ) : lots.length === 0 ? (
            "Nenhuma compra — registre o lote para o saldo começar a contar."
          ) : (
            "Nenhum lote com saldo. A próxima produção já sai no negativo."
          )}
        </div>

        <div className="stock-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setLotForId(supply.id)}
          >
            <Plus size={14} /> Compra
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setAdjustForId(supply.id)}
            disabled={lots.length === 0}
            title={
              lots.length === 0
                ? "Registre uma compra antes de contar"
                : "Ajuste de inventário"
            }
          >
            <ClipboardCheck size={14} /> Ajustar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setEditingId(supply.id)}
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => void toggleArchive(supply)}
          >
            {supply.archived ? (
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
              onClick={() => void remove(supply)}
            >
              <Trash2 size={14} /> Excluir
            </button>
          ) : null}
          <button
            className="link-button stock-expand"
            type="button"
            onClick={() => setExpandedId(expanded ? null : supply.id)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Ocultar" : "Lotes e extrato"}
          </button>
        </div>

        {blocked && refs ? (
          <div className="stock-blocked">
            Não dá para excluir: em uso por {refs.productNames.length}{" "}
            produto(s) ({refs.productNames.join(", ")}). Arquivado ele some da
            lista sem quebrar nada.
          </div>
        ) : null}

        {expanded ? (
          <div className="stock-detail">
            <div className="section-label">Lotes</div>
            {live.length === 0 ? (
              <div className="stock-empty-line">Nenhum lote com saldo.</div>
            ) : (
              live.map((lot) => (
                <div className="stock-roll" key={lot.id}>
                  <span className="stock-roll-name">
                    #{numbers.get(lot.id)}
                    {lot.id === current?.id ? (
                      <em className="stock-tag">em uso</em>
                    ) : null}
                  </span>
                  <span className="stock-roll-info">
                    {formatDate(lot.purchaseDate)} ·{" "}
                    {qty(lot.initialQty, supply.unit)} a{" "}
                    {formatCurrency(lot.unitPrice)}/{supply.unit}
                    {lot.note ? ` · ${lot.note}` : ""}
                  </span>
                  <span className="mono stock-roll-left">
                    {qty(lot.remainingQty, supply.unit)}
                  </span>
                </div>
              ))
            )}

            {spent.length > 0 ? (
              <details className="stock-spent">
                <summary>Lotes anteriores ({spent.length})</summary>
                {spent.map((lot) => (
                  <div className="stock-roll" key={lot.id}>
                    <span className="stock-roll-name">
                      #{numbers.get(lot.id)}
                    </span>
                    <span className="stock-roll-info">
                      {formatDate(lot.purchaseDate)} ·{" "}
                      {qty(lot.initialQty, supply.unit)} a{" "}
                      {formatCurrency(lot.unitPrice)}/{supply.unit}
                      {lot.note ? ` · ${lot.note}` : ""}
                    </span>
                    <span
                      className={`mono stock-roll-left ${
                        num(lot.remainingQty) < 0 ? "sale-neg" : ""
                      }`}
                    >
                      {qty(lot.remainingQty, supply.unit)}
                    </span>
                  </div>
                ))}
              </details>
            ) : null}

            <div className="section-label stock-statement-label">Extrato</div>
            {supplyStatement(supply, production).map((entry) => (
              <div className="stock-entry" key={entry.id}>
                <span className="stock-entry-date mono">
                  {formatDate(entry.at)}
                </span>
                <span className="stock-entry-desc">
                  {entry.kind === "purchase" ? (
                    <>
                      Compra do lote #{numbers.get(entry.lotId)} ·{" "}
                      {formatCurrency(entry.unitPrice)}/{supply.unit}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </>
                  ) : entry.kind === "adjustment" ? (
                    <>
                      Ajuste do lote #{numbers.get(entry.lotId)} · {entry.reason}
                      <em className="stock-entry-sub">
                        sistema tinha {Math.round(entry.before)}, contado{" "}
                        {Math.round(entry.after)}
                      </em>
                    </>
                  ) : (
                    <>
                      Produção do lote #{numbers.get(entry.lotId)} ·{" "}
                      {outcomeShort[entry.outcome]}
                      {entry.productName ? (
                        <em className="stock-entry-sub">{entry.productName}</em>
                      ) : null}
                    </>
                  )}
                </span>
                <span
                  className={`mono stock-entry-delta ${
                    entry.delta < 0 ? "sale-neg" : "sale-pos"
                  }`}
                >
                  {entry.delta > 0 ? "+" : "−"}
                  {Math.round(Math.abs(entry.delta))} {supply.unit}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {error ? <div className="app-error">{error}</div> : null}

      <div className="sales-totals stock-totals">
        <div className="sales-total-card">
          <span>Insumos ativos</span>
          <strong className="sg">{totals.count}</strong>
          <span className="sales-total-sub">
            {archived.length > 0
              ? `${archived.length} arquivado(s)`
              : "nenhum arquivado"}
          </span>
        </div>
        <div className="sales-total-card">
          <span>Valor parado</span>
          <strong className={`sg mono ${totals.value < 0 ? "sale-neg" : ""}`}>
            {formatCurrency(totals.value)}
          </strong>
          <span className="sales-total-sub">ao preço real de compra</span>
        </div>
        <div className="sales-total-card">
          <span>Abaixo do mínimo</span>
          <strong className={`sg ${totals.low > 0 ? "sale-neg" : ""}`}>
            {totals.low}
          </strong>
          <span className="sales-total-sub">precisa repor</span>
        </div>
      </div>

      {/* UX-23 — 6ª e última introdução do app a sair do tratamento próprio. */}
      <PageIntro>
        Ímã, argola, parafuso, embalagem — o que entra na peça sem ser filamento.
        Cada insumo guarda as compras (lotes) com o preço real de cada uma, e o
        consumo é do lote mais antigo para o mais novo. Ligue o insumo ao
        acessório do produto na calculadora: a produção passa a dar baixa por
        unidade.
      </PageIntro>
      <div className="stock-bar">
        <button
          className="btn primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> Novo insumo
        </button>
        {/* Gêmeo do de-para das cores (aba Filamentos): o `supplyId` do
            acessório também é auto-id do Firestore e também não aparece. */}
        {supplies.length > 0 ? (
          <button
            className="btn"
            type="button"
            onClick={copiarDePara}
            title="Copia nome, unidade e ID de cada insumo — para colar na planilha de importação"
          >
            <Copy size={15} /> Copiar de-para
          </button>
        ) : null}
      </div>

      <FeedbackNote note={note} onClose={clear} />

      {supplies.length === 0 ? (
        <div className="sales-empty">
          Nenhum insumo cadastrado ainda. Comece pelo que você mais usa —
          cadastre o item e registre a última compra dele.
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="stock-search">
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder="Buscar insumo..."
                resultCount={activeShown.length}
              />
            </div>
          ) : null}
          {activeShown.length === 0 && query.trim() ? (
            <div className="sales-empty">
              Nenhum insumo encontrado para “{query.trim()}”.
            </div>
          ) : (
            <div className="stock-list">{activeShown.map(renderCard)}</div>
          )}
        </>
      )}

      {archivedShown.length > 0 ? (
        <details className="stock-archived-box">
          <summary>Insumos arquivados ({archivedShown.length})</summary>
          <div className="stock-list">{archivedShown.map(renderCard)}</div>
        </details>
      ) : null}

      {creating || editing ? (
        <SupplyModal
          supply={editing}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSave={saveSupplyDraft}
        />
      ) : null}

      {lotFor ? (
        <SupplyLotModal
          supply={lotFor}
          onClose={() => setLotForId(null)}
          onSave={(lot) => saveLot(lotFor, lot)}
        />
      ) : null}

      {adjustFor ? (
        <SupplyAdjustModal
          supply={adjustFor}
          onClose={() => setAdjustForId(null)}
          onSave={(input) => saveAdjust(adjustFor, input)}
        />
      ) : null}

      {dialog}
    </>
  );
}
