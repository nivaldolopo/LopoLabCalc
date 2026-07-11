"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_SALE_CHANNEL,
  PAYMENT_METHODS,
  SALE_CHANNELS,
} from "../constants";
import type {
  PaymentMethod,
  SaleChannel,
  SaleCostBreakdown,
  SalePayload,
} from "../types";

type SaleModalProps = {
  defaultProductName: string;
  productId: string;
  machineId: string;
  machineName: string;
  printHours: number;
  suggestedPrice: number;
  unitCost: number;
  costBreakdown: SaleCostBreakdown;
  onClose: () => void;
  onConfirm: (payload: SalePayload) => Promise<void>;
};

function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toTimestamp(dateStr: string): number {
  const parsed = new Date(`${dateStr}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function SaleModal({
  defaultProductName,
  productId,
  machineId,
  machineName,
  printHours,
  suggestedPrice,
  unitCost,
  costBreakdown,
  onClose,
  onConfirm,
}: SaleModalProps) {
  const [productName, setProductName] = useState(defaultProductName);
  const [customer, setCustomer] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(suggestedPrice);
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    DEFAULT_PAYMENT_METHOD,
  );
  const [channel, setChannel] = useState<SaleChannel>(DEFAULT_SALE_CHANNEL);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const qty = Math.max(1, Number(quantity) || 1);
  const unitPrice = Math.max(0, Number(salePrice) || 0);
  const totalRevenue = unitPrice * qty;
  const totalCost = unitCost * qty;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const priceDelta = unitPrice - suggestedPrice;

  async function confirm() {
    if (!productName.trim()) {
      window.alert("Dê um nome ao produto vendido.");
      return;
    }
    if (unitPrice <= 0) {
      window.alert("Informe o preço de venda.");
      return;
    }

    setSaving(true);
    const now = Date.now();
    const payload: SalePayload = {
      reciboId: `r_${now}_${Math.floor(Math.random() * 1000)}`,
      saleDate: toTimestamp(dateStr),
      customer: customer.trim(),
      material: material.trim(),
      paymentMethod,
      channel,
      notes: notes.trim(),
      status: "concluida",
      productId,
      productName: productName.trim(),
      machineId,
      machineName,
      printHours,
      quantity: qty,
      suggestedPrice,
      salePrice: unitPrice,
      unitCost,
      costBreakdown,
      totalCost,
      totalRevenue,
      profit,
      margin,
      createdAt: now,
    };

    try {
      await onConfirm(payload);
      onClose();
    } catch (error) {
      window.alert(`Erro ao registrar venda: ${(error as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={(event) => event.stopPropagation()}>
        <h3 className="modal-title">Registrar venda</h3>
        <p className="modal-sub">
          Congela uma foto do custo e do preço no momento da venda. Editar
          valores na calculadora depois não altera este registro.
        </p>

        <div className="field-block compact">
          <div className="section-label">Produto</div>
          <input
            className="field-input"
            type="text"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="Nome do produto vendido"
          />
        </div>

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
            <div className="section-label">
              Material <span className="label-hint">(opcional)</span>
            </div>
            <input
              className="field-input"
              type="text"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              placeholder="Ex.: PLA Silk Rainbow"
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

        <div className="two-col">
          <div className="field-block compact">
            <div className="section-label">Quantidade</div>
            <input
              className="field-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Number(event.target.value) || 1))
              }
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

        <div className="field-block compact">
          <div className="section-label">Preço de venda (unitário)</div>
          <input
            className="field-input"
            type="number"
            min={0}
            step="0.01"
            value={salePrice}
            onChange={(event) =>
              setSalePrice(Math.max(0, Number(event.target.value) || 0))
            }
          />
          <div className="sale-price-hint">
            sugerido: {formatCurrency(suggestedPrice)}
            {priceDelta !== 0 ? (
              <span className={priceDelta < 0 ? "sale-neg" : "sale-pos"}>
                {" "}
                ({priceDelta < 0 ? "−" : "+"}
                {formatCurrency(Math.abs(priceDelta))})
              </span>
            ) : null}
          </div>
        </div>

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
            <strong className="mono">{formatCurrency(totalRevenue)}</strong>
          </div>
          <div className="sale-summary-item">
            <span>Custo</span>
            <strong className="mono">{formatCurrency(totalCost)}</strong>
          </div>
          <div className="sale-summary-item">
            <span>Lucro</span>
            <strong
              className={`mono ${profit < 0 ? "sale-neg" : "sale-pos"}`}
            >
              {formatCurrency(profit)}{" "}
              <span className="sale-summary-margin">
                ({margin.toFixed(0)}%)
              </span>
            </strong>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn primary"
            type="button"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? "Registrando..." : "Registrar venda"}
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
