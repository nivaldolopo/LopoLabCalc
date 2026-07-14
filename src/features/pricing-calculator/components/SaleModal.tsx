"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import { round2 } from "@/lib/number";
import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_SALE_CHANNEL,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import { stripFilamentIds } from "../lib/filaments";
import { feeRateForMethod, saleItemFinancials } from "../lib/paymentFees";
import {
  chargedWithFee,
  type SaleModalContext,
} from "../lib/saleContext";
import { NumberInput } from "./NumberInput";
import type {
  PaymentFeeSettings,
  PaymentMethod,
  ReciboUpsert,
  SaleChannel,
  SalePayload,
} from "../types";

// Um item já salvo de um recibo, para o modo edição. `source` é reconstruído a
// partir do snapshot congelado da venda (custo/preço não mudam ao editar).
export type SaleModalEditItem = {
  id: string;
  source: SaleModalContext;
  productName: string;
  material: string;
  quantity: number;
  salePrice: number;
  createdAt: number;
};

// Recibo existente aberto para edição (campos compartilhados + itens salvos).
export type EditReciboSeed = {
  reciboId: string;
  customer: string;
  saleDate: number;
  paymentMethod: PaymentMethod;
  channel: SaleChannel;
  feePassedToCustomer: boolean;
  notes: string;
  items: SaleModalEditItem[];
};

// Um item da cesta: a foto (source) congelada + o que o usuário edita na venda.
// `id`/`createdAt` só existem para itens já salvos (modo edição).
type CestaItem = {
  key: string;
  id?: string;
  createdAt?: number;
  source: SaleModalContext;
  productName: string;
  material: string;
  quantity: number;
  salePrice: number;
};

type SaleModalProps = {
  // Produto que abriu o modal (do card ou do catálogo) — vira o 1º item.
  // null/ausente quando o recibo começa vazio ("Nova venda"): usuário adiciona
  // itens pelo seletor do catálogo.
  seed?: SaleModalContext | null;
  // Recibo já existente aberto para edição. Quando presente, o modal entra em
  // modo edição (grava sobre os mesmos docs em vez de criar um recibo novo).
  editRecibo?: EditReciboSeed | null;
  // Demais produtos do catálogo, para adicionar mais itens ao mesmo recibo.
  catalogItems: SaleModalContext[];
  // Taxas por forma de pagamento (config global) + callback para editá-las ali.
  fees: PaymentFeeSettings;
  onFeesChange?: (fees: PaymentFeeSettings) => void;
  onClose: () => void;
  onConfirm: (upserts: ReciboUpsert[], removedIds: string[]) => Promise<void>;
};

function toDateInput(ms: number): string {
  const date = new Date(ms);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function todayInputValue(): string {
  return toDateInput(Date.now());
}

function toTimestamp(dateStr: string): number {
  const parsed = new Date(`${dateStr}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

// Percentual enxuto (4.5 → "4,5", 2 → "2") para rótulos de taxa.
function formatDecimalPct(value: number): string {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}

let itemSeq = 0;
function itemFromContext(source: SaleModalContext): CestaItem {
  itemSeq += 1;
  return {
    key: `item_${Date.now()}_${itemSeq}`,
    source,
    productName: source.defaultProductName,
    material: "",
    quantity: 1,
    salePrice: round2(source.suggestedPrice),
  };
}

export function SaleModal({
  seed,
  editRecibo,
  catalogItems,
  fees,
  onFeesChange,
  onClose,
  onConfirm,
}: SaleModalProps) {
  const isEdit = Boolean(editRecibo);
  const [items, setItems] = useState<CestaItem[]>(() => {
    if (editRecibo) {
      return editRecibo.items.map((entry) => ({
        key: `item_${entry.id}`,
        id: entry.id,
        createdAt: entry.createdAt,
        source: entry.source,
        productName: entry.productName,
        material: entry.material,
        quantity: entry.quantity,
        salePrice: entry.salePrice,
      }));
    }
    return seed ? [itemFromContext(seed)] : [];
  });
  const [customer, setCustomer] = useState(editRecibo?.customer ?? "");
  const [dateStr, setDateStr] = useState(
    editRecibo ? toDateInput(editRecibo.saleDate) : todayInputValue(),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    editRecibo?.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
  );
  const [channel, setChannel] = useState<SaleChannel>(
    editRecibo?.channel ?? DEFAULT_SALE_CHANNEL,
  );
  // Repassar a taxa ao cliente (infla o preço) ou absorver (desconta da margem).
  const [feePassedToCustomer, setFeePassedToCustomer] = useState(
    editRecibo?.feePassedToCustomer ?? false,
  );
  const [notes, setNotes] = useState(editRecibo?.notes ?? "");
  const [addPick, setAddPick] = useState("");
  const [showFeesEditor, setShowFeesEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  // Aviso inline (validação ou erro de gravação), no lugar do window.alert.
  const [error, setError] = useState<string | null>(null);

  const feeRatePct = feeRateForMethod(fees, paymentMethod);
  const hasFee = feeRatePct > 0;

  // Ao mudar a forma de pagamento OU ligar/desligar o repasse, recalcula o preço
  // cobrado de cada item a partir do sugerido (gross-up se repassa; sugerido puro
  // se absorve). Sem taxa, cai no sugerido. Isso reescreve edições manuais de
  // preço — o usuário pode reajustar depois se quiser.
  function repriceItems(passed: boolean, ratePct: number) {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        salePrice: passed
          ? chargedWithFee(item.source, ratePct)
          : round2(item.source.suggestedPrice),
      })),
    );
  }

  function changePaymentMethod(method: PaymentMethod) {
    setPaymentMethod(method);
    if (feePassedToCustomer) {
      repriceItems(true, feeRateForMethod(fees, method));
    }
  }

  function toggleFeePassed() {
    const next = !feePassedToCustomer;
    setFeePassedToCustomer(next);
    repriceItems(next, feeRatePct);
  }

  function updateFee(method: PaymentMethod, valueStr: string) {
    if (!onFeesChange) return;
    const value = Math.max(0, Number(valueStr) || 0);
    onFeesChange({ ...fees, [method]: value });
  }

  function updateItem(key: string, patch: Partial<CestaItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : current,
    );
  }

  function addFromCatalog(indexStr: string) {
    const index = Number(indexStr);
    const source = catalogItems[index];
    if (!source) return;
    const item = itemFromContext(source);
    // Se o repasse está ligado, o item novo já nasce com o preço inflado e redondo.
    if (feePassedToCustomer && hasFee) {
      item.salePrice = chargedWithFee(source, feeRatePct);
    }
    setItems((current) => [...current, item]);
    setAddPick("");
  }

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const fin = saleItemFinancials({
          chargedUnitPrice: item.salePrice,
          quantity: item.quantity,
          unitCost: item.source.unitCost,
          feeRatePct,
        });
        acc.revenue += fin.totalRevenue;
        acc.cost += fin.totalCost;
        acc.fee += fin.feeAmount;
        return acc;
      },
      { revenue: 0, cost: 0, fee: 0 },
    );
  }, [items, feeRatePct]);

  const profit = totals.revenue - totals.cost - totals.fee;
  const margin = totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0;

  async function confirm() {
    if (items.length === 0) {
      setError("Adicione ao menos um produto à venda.");
      return;
    }
    for (const item of items) {
      if (!item.productName.trim()) {
        setError("Dê um nome a todos os produtos da venda.");
        return;
      }
      if (Math.max(0, Number(item.salePrice) || 0) <= 0) {
        setError(`Informe o preço de venda de "${item.productName}".`);
        return;
      }
    }

    setError(null);

    // Offline: o Firestore enfileira a escrita e a Promise fica pendente para
    // sempre (nem resolve, nem rejeita) — o botão travaria em "Registrando...".
    // Bloqueia com aviso claro em vez de pendurar (TD-004).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(
        "Sem conexão com a internet. Reconecte e tente de novo — nada foi salvo ainda.",
      );
      return;
    }

    setSaving(true);
    const now = Date.now();
    const reciboId =
      editRecibo?.reciboId ?? `r_${now}_${Math.floor(Math.random() * 1000)}`;
    const saleDate = toTimestamp(dateStr);

    const upserts: ReciboUpsert[] = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.salePrice) || 0);
      const fin = saleItemFinancials({
        chargedUnitPrice: unitPrice,
        quantity: qty,
        unitCost: item.source.unitCost,
        feeRatePct,
      });
      const payload: SalePayload = {
        reciboId,
        saleDate,
        customer: customer.trim(),
        material: item.material.trim(),
        paymentMethod,
        channel,
        notes: notes.trim(),
        status: "concluida",
        productId: item.source.productId,
        productName: item.productName.trim(),
        machineId: item.source.machineId,
        machineName: item.source.machineName,
        printHours: item.source.printHours,
        machineUsage: item.source.machineUsage,
        // FEAT-02: congela o consumo por cor (limpo p/ Firestore — sem undefined).
        filaments: stripFilamentIds(item.source.filaments),
        quantity: qty,
        suggestedPrice: item.source.suggestedPrice,
        salePrice: unitPrice,
        unitCost: item.source.unitCost,
        costBreakdown: item.source.costBreakdown,
        totalCost: fin.totalCost,
        totalRevenue: fin.totalRevenue,
        feeRate: feeRatePct,
        feeAmount: fin.feeAmount,
        feePassedToCustomer,
        profit: fin.profit,
        margin: fin.margin,
        // Preserva o createdAt de itens já salvos (mantém a ordem no recibo);
        // itens novos nascem agora.
        createdAt: item.createdAt ?? now,
      };
      return { id: item.id, payload };
    });

    // Itens que estavam no recibo original e saíram na edição → apagar.
    const currentIds = new Set(
      items
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id)),
    );
    const removedIds = editRecibo
      ? editRecibo.items
          .map((entry) => entry.id)
          .filter((id) => !currentIds.has(id))
      : [];

    try {
      await onConfirm(upserts, removedIds);
      onClose();
    } catch (err) {
      setError(
        `Erro ao ${isEdit ? "salvar" : "registrar"} venda: ${(err as Error).message}. Nada foi salvo — tente de novo.`,
      );
      setSaving(false);
    }
  }

  const multiItem = items.length > 1;

  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div
        className="modal-box sale-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 className="modal-title">
          {isEdit ? "Editar venda" : "Registrar venda"}
        </h3>
        <p className="modal-sub">
          {isEdit
            ? "Ajuste os dados desta venda. O custo permanece congelado no valor do momento da venda; alterar quantidade ou preço recalcula receita e lucro."
            : "Congela uma foto do custo e do preço no momento da venda. Adicione um ou mais produtos ao mesmo recibo. Editar valores na calculadora depois não altera este registro."}
        </p>

        <div className="two-col">
          <div className="field-block compact">
            <div className="section-label">
              Cliente <span className="label-hint">(opcional)</span>
            </div>
            <input
              className="field-input"
              type="text"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="field-block compact">
            <div className="section-label">Data</div>
            <input
              className="field-input"
              type="date"
              value={dateStr}
              onChange={(event) => setDateStr(event.target.value)}
            />
          </div>
        </div>

        <div className="two-col">
          <div className="field-block compact">
            <div className="section-label">Canal</div>
            <select
              className="field-input"
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as SaleChannel)
              }
            >
              {SALE_CHANNELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-block compact">
            <div className="section-label">Forma de pagamento</div>
            <select
              className="field-input"
              value={paymentMethod}
              onChange={(event) =>
                changePaymentMethod(event.target.value as PaymentMethod)
              }
            >
              {PAYMENT_METHODS.map((option) => {
                const rate = feeRateForMethod(fees, option.value);
                return (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {rate > 0 ? ` (${formatDecimalPct(rate)}%)` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className={`fee-row ${hasFee ? "" : "fee-row-muted"}`}>
          <button
            className="fee-toggle"
            type="button"
            onClick={toggleFeePassed}
            disabled={!hasFee}
            title={
              hasFee
                ? undefined
                : "Sem taxa nesta forma de pagamento (Pix/dinheiro)"
            }
          >
            <span className={`toggle-track ${feePassedToCustomer ? "on" : ""}`}>
              <span className="toggle-thumb" />
            </span>
            <span>
              <span className="fee-toggle-label">
                {feePassedToCustomer
                  ? "Repassar a taxa ao cliente"
                  : "Absorver a taxa"}
              </span>
              <span className="fee-toggle-desc">
                {hasFee
                  ? feePassedToCustomer
                    ? `Preço sobe para cobrir a taxa de ${formatDecimalPct(feeRatePct)}% — você recebe o valor cheio.`
                    : `A taxa de ${formatDecimalPct(feeRatePct)}% desconta da sua margem.`
                  : "Pix e dinheiro não têm taxa."}
              </span>
            </span>
          </button>
          {onFeesChange ? (
            <button
              className="fee-edit-link"
              type="button"
              onClick={() => setShowFeesEditor((v) => !v)}
            >
              {showFeesEditor ? "Fechar taxas" : "Ajustar taxas"}
            </button>
          ) : null}
        </div>

        {showFeesEditor && onFeesChange ? (
          <div className="fee-editor">
            <div className="fee-editor-title">Taxas por forma de pagamento (%)</div>
            <div className="fee-editor-grid">
              {PAYMENT_METHODS.map((option) => (
                <div className="fee-editor-item" key={option.value}>
                  <label>{option.label}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={fees[option.value] ?? 0}
                    onChange={(event) =>
                      updateFee(option.value, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            <div className="fee-editor-hint">
              Use os valores da sua maquininha. Salvo na nuvem e compartilhado
              entre aparelhos.
            </div>
          </div>
        ) : null}

        <div className="section-label cesta-label">
          {items.length > 1
            ? `Itens da venda (${items.length})`
            : "Item da venda"}
        </div>

        <div className="cesta-list">
          {items.length === 0 ? (
            <div className="cesta-empty">
              Nenhum produto ainda. Adicione pelo seletor abaixo.
            </div>
          ) : null}
          {items.map((item) => {
            const qty = Math.max(1, Number(item.quantity) || 1);
            const unitPrice = Math.max(0, Number(item.salePrice) || 0);
            const fin = saleItemFinancials({
              chargedUnitPrice: unitPrice,
              quantity: qty,
              unitCost: item.source.unitCost,
              feeRatePct,
            });
            const itemProfit = fin.profit;
            const priceDelta = unitPrice - item.source.suggestedPrice;

            return (
              <div className="cesta-item" key={item.key}>
                <div className="cesta-item-head">
                  <input
                    className="field-input"
                    type="text"
                    value={item.productName}
                    onChange={(event) =>
                      updateItem(item.key, { productName: event.target.value })
                    }
                    placeholder="Nome do produto vendido"
                  />
                  {multiItem ? (
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeItem(item.key)}
                      title="Remover item"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>

                <div className="cesta-item-grid">
                  <div className="field-block compact">
                    <div className="section-label">
                      Material <span className="label-hint">(opcional)</span>
                    </div>
                    <input
                      className="field-input"
                      type="text"
                      value={item.material}
                      onChange={(event) =>
                        updateItem(item.key, { material: event.target.value })
                      }
                      placeholder="Ex.: PLA Silk"
                    />
                  </div>
                  <div className="field-block compact">
                    <div className="section-label">Qtd</div>
                    <NumberInput
                      className="field-input"
                      min={1}
                      value={item.quantity}
                      onChange={(quantity) =>
                        updateItem(item.key, { quantity })
                      }
                    />
                  </div>
                  <div className="field-block compact">
                    <div className="section-label">Preço unit.</div>
                    <NumberInput
                      className="field-input"
                      min={0}
                      step="0.01"
                      value={item.salePrice}
                      onChange={(salePrice) =>
                        updateItem(item.key, { salePrice })
                      }
                    />
                  </div>
                </div>

                <div className="cesta-item-foot">
                  <span>
                    sugerido: {formatCurrency(item.source.suggestedPrice)}
                    {priceDelta !== 0 ? (
                      <span className={priceDelta < 0 ? "sale-neg" : "sale-pos"}>
                        {" "}
                        ({priceDelta < 0 ? "−" : "+"}
                        {formatCurrency(Math.abs(priceDelta))})
                      </span>
                    ) : null}
                  </span>
                  <span>
                    lucro{" "}
                    <strong className={itemProfit < 0 ? "sale-neg" : "sale-pos"}>
                      {formatCurrency(itemProfit)}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {catalogItems.length > 0 ? (
          <div className="cesta-add">
            <Plus size={15} />
            <select
              className="field-input"
              value={addPick}
              onChange={(event) => addFromCatalog(event.target.value)}
            >
              <option value="">Adicionar outro produto do catálogo…</option>
              {catalogItems.map((option, index) => (
                <option key={`${option.productId}-${index}`} value={index}>
                  {option.defaultProductName} —{" "}
                  {formatCurrency(option.suggestedPrice)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field-block compact">
          <div className="section-label">
            Observações <span className="label-hint">(opcional)</span>
          </div>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Detalhes da venda, personalização, etc."
          />
        </div>

        <div className="sale-summary">
          <div className="sale-summary-item">
            <span>Receita</span>
            <strong className="mono">{formatCurrency(totals.revenue)}</strong>
          </div>
          <div className="sale-summary-item">
            <span>Custo</span>
            <strong className="mono">{formatCurrency(totals.cost)}</strong>
          </div>
          {totals.fee > 0 ? (
            <div className="sale-summary-item">
              <span>Taxa ({formatDecimalPct(feeRatePct)}%)</span>
              <strong className="mono sale-neg">
                −{formatCurrency(totals.fee)}
              </strong>
            </div>
          ) : null}
          <div className="sale-summary-item">
            <span>Lucro</span>
            <strong className={`mono ${profit < 0 ? "sale-neg" : "sale-pos"}`}>
              {formatCurrency(profit)}{" "}
              <span className="sale-summary-margin">({margin.toFixed(0)}%)</span>
            </strong>
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={confirm}
            disabled={saving || items.length === 0}
          >
            {saving
              ? isEdit
                ? "Salvando..."
                : "Registrando..."
              : isEdit
                ? multiItem
                  ? `Salvar (${items.length} itens)`
                  : "Salvar alterações"
                : multiItem
                  ? `Registrar venda (${items.length} itens)`
                  : "Registrar venda"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
