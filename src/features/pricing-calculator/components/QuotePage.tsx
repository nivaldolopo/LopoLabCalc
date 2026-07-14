"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, FileText, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  DEFAULT_FIXED_COSTS,
  DEFAULT_QUOTE_BUSINESS,
  DEFAULT_QUOTE_VALIDITY_DAYS,
} from "../constants";
import { calculatePricing } from "../lib/calculatePricing";
import { generateQuotePdf } from "../lib/generateQuotePdf";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useMachines } from "../hooks/useMachines";
import { useProducts } from "../hooks/useProducts";
import { useQuoteConfig } from "../hooks/useQuoteConfig";
import { useQuotes } from "../hooks/useQuotes";
import { useTheme } from "../hooks/useTheme";
import type { QuoteBusiness, QuoteRecord, QuoteRecordPayload } from "../types";
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
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
  const { fixedCostRate } = useBusinessSettings();
  const { business: cfgBusiness, loaded, saveBusiness } = useQuoteConfig();

  // Taxa de custo fixo real do negócio (TD-001). enabled/markupOnFixed vêm do
  // próprio produto no cálculo, então aqui só a taxa importa.
  const fixedCosts = useMemo(
    () => ({ ...DEFAULT_FIXED_COSTS, ...fixedCostRate }),
    [fixedCostRate],
  );
  const { quotes, addQuote, deleteQuote } = useQuotes();

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
  const [openQuoteId, setOpenQuoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Feedback inline de escrita (validação/erro/sucesso), no lugar do alert e da
  // gravação fire-and-forget silenciosa (TD-004).
  const [feedback, setFeedback] = useState<
    { kind: "error" | "ok"; msg: string } | null
  >(null);
  const businessSeeded = useRef(false);
  const numberEdited = useRef(false);

  // Próximo número = maior do histórico + 1 (ou 1 se vazio). Assim a numeração
  // zera sozinha quando o histórico esvazia — sem contador separado no banco.
  const nextNumber = useMemo(
    () =>
      quotes.length
        ? Math.max(...quotes.map((quote) => quote.numberValue)) + 1
        : 1,
    [quotes],
  );

  // Semeia os dados do negócio quando o config chega (1x).
  useEffect(() => {
    if (loaded && !businessSeeded.current) {
      businessSeeded.current = true;
      setBusiness(cfgBusiness);
    }
  }, [loaded, cfgBusiness]);

  // O campo Número segue o histórico, a menos que o usuário digite um valor.
  useEffect(() => {
    if (!numberEdited.current) setQuoteNumber(nextNumber);
  }, [nextNumber]);

  // Produtos do catálogo como opções (com preço sugerido), em ordem alfabética.
  const catalogOptions = useMemo(
    () =>
      products
        .map((product) => ({
          name: product.name || product.mainStageName || "Produto",
          price: round2(
            calculatePricing(product, machines, fixedCosts).suggestedPrice,
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products, machines, fixedCosts],
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

  const orderedQuotes = useMemo(
    () => [...quotes].sort((a, b) => b.createdAt - a.createdAt),
    [quotes],
  );

  async function handleGenerate() {
    if (items.length === 0) {
      setFeedback({ kind: "error", msg: "Adicione ao menos um item ao orçamento." });
      return;
    }
    for (const item of items) {
      if (!item.description.trim()) {
        setFeedback({ kind: "error", msg: "Dê uma descrição a todos os itens." });
        return;
      }
    }
    setFeedback(null);

    const numberStr = String(quoteNumber).padStart(4, "0");
    const cleanItems = items.map((item) => ({
      description: item.description.trim(),
      quantity: Math.max(1, item.quantity || 1),
      unitPrice: Math.max(0, item.unitPrice || 0),
    }));
    const cleanTotal = cleanItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const date = toTimestamp(dateStr);
    const days = Math.max(1, validityDays || 1);

    generateQuotePdf({
      business,
      number: numberStr,
      customer: customer.trim(),
      date,
      validityDays: days,
      items: cleanItems,
      notes: notes.trim(),
    });

    // Salva no histórico (congela o orçamento) + persiste os dados do negócio.
    const payload: QuoteRecordPayload = {
      number: numberStr,
      numberValue: quoteNumber,
      customer: customer.trim(),
      date,
      validityDays: days,
      items: cleanItems,
      notes: notes.trim(),
      business,
      total: cleanTotal,
      createdAt: Date.now(),
    };
    // O PDF já baixou (client-side); a gravação no histórico pode falhar e antes
    // era fire-and-forget silenciosa. Agora aguarda e reporta (TD-004).
    setSaving(true);
    try {
      await Promise.all([addQuote(payload), saveBusiness(business)]);
      // Volta a numeração a seguir o histórico (o novo registro puxa o próximo nº).
      numberEdited.current = false;
      setFeedback({
        kind: "ok",
        msg: `✓ Orçamento nº ${numberStr} salvo no histórico.`,
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        msg: `O PDF foi gerado, mas falhou ao salvar no histórico: ${(err as Error).message}. Tente gerar de novo.`,
      });
    } finally {
      setSaving(false);
    }
  }

  function reDownload(quote: QuoteRecord) {
    generateQuotePdf({
      business: quote.business,
      number: quote.number,
      customer: quote.customer,
      date: quote.date,
      validityDays: quote.validityDays,
      items: quote.items,
      notes: quote.notes,
    });
  }

  async function handleDeleteQuote(quote: QuoteRecord) {
    const ok = window.confirm(
      `Excluir o orçamento nº ${quote.number}${quote.customer ? ` (${quote.customer})` : ""}? Isso não pode ser desfeito.`,
    );
    if (!ok) return;
    try {
      await deleteQuote(quote.id);
    } catch (err) {
      setFeedback({
        kind: "error",
        msg: `Erro ao excluir o orçamento nº ${quote.number}: ${(err as Error).message}.`,
      });
    }
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
                onChange={(event) => {
                  numberEdited.current = true;
                  setQuoteNumber(Math.max(1, Number(event.target.value) || 1));
                }}
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
            onClick={() => void handleGenerate()}
            disabled={items.length === 0 || saving}
          >
            <FileText size={16} /> {saving ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
        {feedback ? (
          <div className={feedback.kind === "ok" ? "form-ok" : "form-error"}>
            {feedback.msg}
          </div>
        ) : null}
      </div>

      {orderedQuotes.length > 0 ? (
        <div className="card quote-history">
          <div className="section-label">
            Histórico de orçamentos ({orderedQuotes.length})
          </div>
          <div className="quote-history-list">
            {orderedQuotes.map((quote) => {
              const isOpen = openQuoteId === quote.id;
              return (
                <div className="quote-history-row" key={quote.id}>
                  <div
                    className="qh-header"
                    onClick={() =>
                      setOpenQuoteId((current) =>
                        current === quote.id ? null : quote.id,
                      )
                    }
                  >
                    <div className="qh-main">
                      <span className="qh-arrow">{isOpen ? "▼" : "▶"}</span>
                      <span className="qh-number">Nº {quote.number}</span>
                      <span className="qh-customer">
                        {quote.customer || "Sem cliente"}
                      </span>
                      <span className="qh-date">{formatDate(quote.date)}</span>
                    </div>
                    <div className="qh-side">
                      <span className="qh-total mono">
                        {formatCurrency(quote.total)}
                      </span>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          reDownload(quote);
                        }}
                        title="Baixar PDF novamente"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteQuote(quote);
                        }}
                        title="Excluir orçamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="qh-details">
                      <div className="qh-items">
                        {quote.items.map((item, index) => (
                          <div className="qh-item" key={index}>
                            <span className="qh-item-desc">
                              {item.description}
                            </span>
                            <span className="qh-item-calc mono">
                              {item.quantity} × {formatCurrency(item.unitPrice)}
                            </span>
                            <span className="qh-item-sub mono">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="qh-total-row">
                        <span>Total</span>
                        <strong className="mono">
                          {formatCurrency(quote.total)}
                        </strong>
                      </div>
                      <div className="qh-extra">
                        <span>Validade: {quote.validityDays} dias</span>
                        {quote.notes ? <span>Obs.: {quote.notes}</span> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </main>
  );
}
