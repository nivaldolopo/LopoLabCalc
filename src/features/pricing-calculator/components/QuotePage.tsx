"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  DEFAULT_FIXED_COSTS,
  DEFAULT_QUOTE_BUSINESS,
  DEFAULT_QUOTE_VALIDITY_DAYS,
} from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { generateQuotePdf } from "../lib/generateQuotePdf";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useQuoteConfig } from "../hooks/useQuoteConfig";
import { useTheme } from "../hooks/useTheme";
import type { QuoteBusiness } from "../types";
import { LogoutButton } from "./LogoutButton";

type QuoteItem = {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toTimestamp(dateStr: string): number {
  const parsed = new Date(`${dateStr}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

let itemSeq = 0;
function newItem(partial: Partial<QuoteItem>): QuoteItem {
  itemSeq += 1;
  return {
    key: `qi_${Date.now()}_${itemSeq}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
    ...partial,
  };
}

export function QuotePage() {
  const { theme, toggleTheme } = useTheme();
  const { products } = useProducts();
  const { machines } = useMachines();
  const {
    business: cfgBusiness,
    lastNumber,
    loaded,
    saveBusiness,
    commitNumber,
  } = useQuoteConfig();

  const [business, setBusiness] = useState<QuoteBusiness>(
    DEFAULT_QUOTE_BUSINESS,
  );
  const [quoteNumber, setQuoteNumber] = useState(1);
  const [customer, setCustomer] = useState("");
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [validityDays, setValidityDays] = useState(DEFAULT_QUOTE_VALIDITY_DAYS);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState("");
  const [addPick, setAddPick] = useState("");
  const seeded = useRef(false);

  // Semeia os dados do negócio e o próximo número quando o config chega (1x).
  useEffect(() => {
    if (loaded && !seeded.current) {
      seeded.current = true;
      setBusiness(cfgBusiness);
      setQuoteNumber(lastNumber + 1);
    }
  }, [loaded, cfgBusiness, lastNumber]);

  // Produtos do catálogo como opções (com preço sugerido), em ordem alfabética.
  const catalogOptions = useMemo(
    () =>
      products
        .map((product) => ({
          name: product.name || product.mainStageName || "Produto",
          price: round2(
            calculatePricing(product, machines, DEFAULT_FIXED_COSTS)
              .suggestedPrice,
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products, machines],
  );

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Math.max(0, item.unitPrice) * Math.max(1, item.quantity || 1),
        0,
      ),
    [items],
  );

  function updateBusiness(patch: Partial<QuoteBusiness>) {
    setBusiness((current) => ({ ...current, ...patch }));
  }

  function updateItem(key: string, patch: Partial<QuoteItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function addFromCatalog(indexStr: string) {
    const option = catalogOptions[Number(indexStr)];
    if (!option) return;
    setItems((current) => [
      ...current,
      newItem({ description: option.name, unitPrice: option.price }),
    ]);
    setAddPick("");
  }

  function addFreeItem() {
    setItems((current) => [...current, newItem({})]);
  }

  function handleGenerate() {
    if (items.length === 0) {
      window.alert("Adicione ao menos um item ao orçamento.");
      return;
    }
    for (const item of items) {
      if (!item.description.trim()) {
        window.alert("Dê uma descrição a todos os itens.");
        return;
      }
    }

    const numberStr = String(quoteNumber).padStart(4, "0");
    generateQuotePdf({
      business,
      number: numberStr,
      customer: customer.trim(),
      date: toTimestamp(dateStr),
      validityDays: Math.max(1, validityDays || 1),
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Math.max(1, item.quantity || 1),
        unitPrice: Math.max(0, item.unitPrice || 0),
      })),
      notes: notes.trim(),
    });

    // Persiste dados do negócio + fixa a numeração (próximo parte de +1).
    void saveBusiness(business);
    void commitNumber(quoteNumber);
    setQuoteNumber((current) => current + 1);
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="brand">
          <div>
            <h1 className="sg">Orçamento</h1>
            <div className="brand-meta">
              <span>Gerar orçamento em PDF — Lopo Lab</span>
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

      <div className="quote-grid">
        <div className="card quote-card">
          <div className="section-label">
            Dados do negócio <span className="label-hint">(saem no PDF)</span>
          </div>
          <div className="field-block compact">
            <input
              className="field-input"
              type="text"
              value={business.name}
              onChange={(event) => updateBusiness({ name: event.target.value })}
              onBlur={() => void saveBusiness(business)}
              placeholder="Nome do negócio"
            />
          </div>
          <div className="two-col">
            <div className="field-block compact">
              <div className="section-label">Telefone / WhatsApp</div>
              <input
                className="field-input"
                type="text"
                value={business.phone}
                onChange={(event) =>
                  updateBusiness({ phone: event.target.value })
                }
                onBlur={() => void saveBusiness(business)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="field-block compact">
              <div className="section-label">Instagram</div>
              <input
                className="field-input"
                type="text"
                value={business.instagram}
                onChange={(event) =>
                  updateBusiness({ instagram: event.target.value })
                }
                onBlur={() => void saveBusiness(business)}
                placeholder="@lopolab"
              />
            </div>
          </div>
          <div className="field-block compact">
            <div className="section-label">E-mail</div>
            <input
              className="field-input"
              type="text"
              value={business.email}
              onChange={(event) => updateBusiness({ email: event.target.value })}
              onBlur={() => void saveBusiness(business)}
              placeholder="contato@lopolab.com.br"
            />
          </div>
        </div>

        <div className="card quote-card">
          <div className="section-label">Dados do orçamento</div>
          <div className="two-col">
            <div className="field-block compact">
              <div className="section-label">Número</div>
              <input
                className="field-input"
                type="number"
                min={1}
                value={quoteNumber}
                onChange={(event) =>
                  setQuoteNumber(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
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
              <div className="section-label">Validade (dias)</div>
              <input
                className="field-input"
                type="number"
                min={1}
                value={validityDays}
                onChange={(event) =>
                  setValidityDays(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card quote-items-card">
        <div className="section-label">Itens do orçamento</div>

        <div className="quote-list">
          {items.length === 0 ? (
            <div className="cesta-empty">
              Nenhum item ainda. Adicione do catálogo ou um item livre abaixo.
            </div>
          ) : null}
          {items.map((item) => {
            const qty = Math.max(1, item.quantity || 1);
            const unit = Math.max(0, item.unitPrice || 0);
            return (
              <div className="quote-item" key={item.key}>
                <div className="quote-item-head">
                  <input
                    className="field-input"
                    type="text"
                    value={item.description}
                    onChange={(event) =>
                      updateItem(item.key, { description: event.target.value })
                    }
                    placeholder="Descrição do item"
                  />
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => removeItem(item.key)}
                    title="Remover item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="quote-item-grid">
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
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(item.key, {
                          unitPrice: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="field-block compact">
                    <div className="section-label">Subtotal</div>
                    <div className="quote-subtotal mono">
                      {formatCurrency(unit * qty)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="quote-add">
          {catalogOptions.length > 0 ? (
            <div className="cesta-add quote-add-catalog">
              <Plus size={15} />
              <select
                className="field-input"
                value={addPick}
                onChange={(event) => addFromCatalog(event.target.value)}
              >
                <option value="">Adicionar produto do catálogo…</option>
                {catalogOptions.map((option, index) => (
                  <option key={`${option.name}-${index}`} value={index}>
                    {option.name} — {formatCurrency(option.price)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <button
            className="icon-label-button"
            type="button"
            onClick={addFreeItem}
          >
            <Plus size={15} /> Item livre
          </button>
        </div>

        <div className="field-block compact quote-notes">
          <div className="section-label">
            Observações <span className="label-hint">(opcional)</span>
          </div>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Prazo de entrega, condições, personalização…"
          />
        </div>

        <div className="quote-footer">
          <div className="quote-total">
            <span>Total</span>
            <strong className="sg mono">{formatCurrency(total)}</strong>
          </div>
          <button
            className="btn primary quote-generate"
            type="button"
            onClick={handleGenerate}
            disabled={items.length === 0}
          >
            <FileText size={16} /> Gerar PDF
          </button>
        </div>
      </div>
    </main>
  );
}
