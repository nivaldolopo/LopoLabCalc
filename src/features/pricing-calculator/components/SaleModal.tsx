"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_SALE_CHANNEL,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import type {
  PaymentMethod,
  PricingResult,
  ReciboUpsert,
  SaleChannel,
  SaleCostBreakdown,
  SalePayload,
  SavedProduct,
} from "../types";

// Dados de origem de UM produto — servem tanto para o formulário ao vivo quanto
// para um produto vindo do catálogo. O modal só lê isto e congela.
export type SaleModalContext = {
  defaultProductName: string;
  productId: string;
  machineId: string;
  machineName: string;
  printHours: number;
  suggestedPrice: number;
  unitCost: number;
  costBreakdown: SaleCostBreakdown;
};

// Monta a foto congelada de UM produto a partir do resultado de precificação.
// Pura (sem estado): serve o item que abre o modal e a lista do catálogo.
export function saleContextFromResult(
  productName: string,
  productId: string,
  result: PricingResult,
  printHours: number,
): SaleModalContext {
  return {
    defaultProductName: productName,
    productId,
    machineId: result.machine.id,
    machineName: result.machine.name,
    printHours,
    suggestedPrice: result.suggestedPrice,
    unitCost: result.totalCost,
    costBreakdown: {
      material: result.materialCost,
      energy: result.energyCost,
      depreciation: result.depreciationCost,
      maintenance: result.maintenanceCost,
      labor: result.laborCost,
      accessories: result.accessoriesCost,
      failureReserve: result.failureReserve,
      fixed: result.fixedCost,
    },
  };
}

// Horas totais de impressão de um produto (etapa principal + etapas extras).
export function productPrintHours(product: SavedProduct): number {
  return (
    product.printHours +
    (product.stages ?? []).reduce(
      (sum, stage) => sum + (stage.printHours || 0),
      0,
    )
  );
}

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

// Arredonda para centavos (o preço sugerido no modo "exato" vem com muitas casas).
function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
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
  const [notes, setNotes] = useState(editRecibo?.notes ?? "");
  const [addPick, setAddPick] = useState("");
  const [saving, setSaving] = useState(false);

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
    setItems((current) => [...current, itemFromContext(source)]);
    setAddPick("");
  }

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.salePrice) || 0);
        acc.revenue += unitPrice * qty;
        acc.cost += item.source.unitCost * qty;
        return acc;
      },
      { revenue: 0, cost: 0 },
    );
  }, [items]);

  const profit = totals.revenue - totals.cost;
  const margin = totals.revenue > 0 ? (profit / totals.revenue) * 100 : 0;

  async function confirm() {
    if (items.length === 0) {
      window.alert("Adicione ao menos um produto à venda.");
      return;
    }
    for (const item of items) {
      if (!item.productName.trim()) {
        window.alert("Dê um nome a todos os produtos da venda.");
        return;
      }
      if (Math.max(0, Number(item.salePrice) || 0) <= 0) {
        window.alert(`Informe o preço de venda de "${item.productName}".`);
        return;
      }
    }

    setSaving(true);
    const now = Date.now();
    const reciboId =
      editRecibo?.reciboId ?? `r_${now}_${Math.floor(Math.random() * 1000)}`;
    const saleDate = toTimestamp(dateStr);

    const upserts: ReciboUpsert[] = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.salePrice) || 0);
      const totalRevenue = unitPrice * qty;
      const totalCost = item.source.unitCost * qty;
      const itemProfit = totalRevenue - totalCost;
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
        quantity: qty,
        suggestedPrice: item.source.suggestedPrice,
        salePrice: unitPrice,
        unitCost: item.source.unitCost,
        costBreakdown: item.source.costBreakdown,
        totalCost,
        totalRevenue,
        profit: itemProfit,
        margin: totalRevenue > 0 ? (itemProfit / totalRevenue) * 100 : 0,
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
    } catch (error) {
      window.alert(
        `Erro ao ${isEdit ? "salvar" : "registrar"} venda: ${(error as Error).message}`,
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
                setPaymentMethod(event.target.value as PaymentMethod)
              }
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            const itemRevenue = unitPrice * qty;
            const itemCost = item.source.unitCost * qty;
            const itemProfit = itemRevenue - itemCost;
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
                    <input
                      className="field-input"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, {
                          quantity: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="field-block compact">
                    <div className="section-label">Preço unit.</div>
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.salePrice}
                      onChange={(event) =>
                        updateItem(item.key, {
                          salePrice: Math.max(0, Number(event.target.value) || 0),
                        })
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
          <div className="sale-summary-item">
            <span>Lucro</span>
            <strong className={`mono ${profit < 0 ? "sale-neg" : "sale-pos"}`}>
              {formatCurrency(profit)}{" "}
              <span className="sale-summary-margin">({margin.toFixed(0)}%)</span>
            </strong>
          </div>
        </div>

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
