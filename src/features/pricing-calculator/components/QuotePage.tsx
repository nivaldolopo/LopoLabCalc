"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { errorMessage, isOffline } from "@/lib/errors";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate, todayInputValue, toTimestamp } from "@/lib/formatting/date";
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
import { useStock } from "../hooks/useStock";
import { useTheme } from "../hooks/useTheme";
import { reserveQuoteNumber } from "@/lib/firebase/quotesRepository";
import type { QuoteBusiness, QuoteRecord, QuoteRecordPayload } from "../types";
import { useConfirm } from "./ConfirmDialog";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { NumberInput } from "./NumberInput";

type QuoteItem = {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
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
  const fieldId = useId();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const { products } = useProducts();
  const { machines } = useMachines();
  // TD-017: o orcamento precifica com o preco VIVO do rolo, igual ao catalogo.
  const { filaments: stock } = useStock();
  const { fixedCostRate } = useBusinessSettings();
  const { business: cfgBusiness, loaded, saveBusiness } = useQuoteConfig();

  // Taxa de custo fixo real do negócio (TD-001). O toggle `enabled` vem do
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
  const { note, ok, fail, clear } = useFeedback();
  const { ask, dialog } = useConfirm();
  const businessSeeded = useRef(false);
  const numberEdited = useRef(false);

  // Sugestão exibida no campo Número = maior do histórico + 1 (ou 1 se vazio).
  // É só sugestão: o número DEFINITIVO é reservado atomicamente no servidor na
  // hora de gerar (reserveQuoteNumber), o que evita duas abas/cliques repetirem
  // o mesmo número. `maxHistory` semeia/pisa o contador do servidor.
  const maxHistory = useMemo(
    () =>
      quotes.length
        ? Math.max(...quotes.map((quote) => quote.numberValue))
        : 0,
    [quotes],
  );
  const nextNumber = maxHistory + 1;

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
  // FEAT-01: produtos com subitens contribuem TAMBÉM uma opção por subitem
  // (preço aditivo), além do inteiro — o dono pode cotar só uma parte.
  const catalogOptions = useMemo(
    () =>
      products
        .flatMap((product) => {
          const result = calculatePricing(product, machines, fixedCosts, stock);
          const baseName = product.name || product.mainStageName || "Produto";
          // FEAT-08: os ids acompanham a opção pro seed do catálogo achar a linha
          // certa. O dropdown continua escolhendo por índice.
          const whole = {
            name: baseName,
            price: round2(result.suggestedPrice),
            productId: product.id,
            subitemId: undefined as string | undefined,
          };
          const subs = (result.subitems ?? []).map((subitem, index) => ({
            name: `${baseName} — ${subitem.name || `Subitem ${index + 1}`}`,
            price: round2(subitem.price),
            productId: product.id,
            subitemId: subitem.id as string | undefined,
          }));
          return [whole, ...subs];
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products, machines, fixedCosts, stock],
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

  // FEAT-08: "Orçar" no catálogo manda pra cá com `?produto=&subitem=`. Mesmo
  // padrão da /producao: ajuste durante o render (os produtos chegam por
  // assinatura) com o par já consumido marcado, pra que snapshots seguintes não
  // dupliquem a linha no orçamento que o dono já está montando.
  const seedProductId = searchParams.get("produto");
  const seedSubitemId = searchParams.get("subitem");
  const seedToken = seedProductId ? `${seedProductId}:${seedSubitemId ?? ""}` : null;
  const [handledSeed, setHandledSeed] = useState<string | null>(null);
  if (seedToken && handledSeed !== seedToken && products.length > 0) {
    // Produto excluído ou subitem removido entre o clique e o load: ignora em
    // silêncio (nada é gravado num orçamento até o dono gerar o PDF).
    const option = catalogOptions.find(
      (item) =>
        item.productId === seedProductId &&
        (item.subitemId ?? null) === (seedSubitemId ?? null),
    );
    setHandledSeed(seedToken);
    if (option) {
      setItems((current) => [
        ...current,
        newItem({ description: option.name, unitPrice: option.price }),
      ]);
    }
  }

  // Some com a query depois de consumida — recarregar não deve re-adicionar.
  useEffect(() => {
    if (handledSeed) window.history.replaceState(null, "", "/orcamento");
  }, [handledSeed]);

  const orderedQuotes = useMemo(
    () => [...quotes].sort((a, b) => b.createdAt - a.createdAt),
    [quotes],
  );

  async function handleGenerate() {
    if (items.length === 0) {
      fail("Adicione ao menos um item ao orçamento.");
      return;
    }
    for (const item of items) {
      if (!item.description.trim()) {
        fail("Dê uma descrição a todos os itens.");
        return;
      }
    }
    clear();

    // O número é reservado no servidor (transação) ANTES do PDF, então precisa de
    // conexão. Offline: a transação ficaria pendente para sempre — bloqueia com
    // aviso antes de gerar qualquer coisa (o número precisa ser autoritativo).
    if (isOffline()) {
      fail(
        "Sem conexão para gerar o orçamento (o número precisa ser reservado no servidor). Tente quando reconectar.",
      );
      return;
    }

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

    setSaving(true);
    let reserved: number;
    try {
      // Reserva atômica: quando o dono editou o campo, respeita o número digitado
      // (override); senão, contador + 1. `maxHistory` semeia/pisa o contador.
      reserved = await reserveQuoteNumber(
        maxHistory,
        numberEdited.current ? quoteNumber : undefined,
      );
    } catch (err) {
      fail(
        `Não foi possível reservar o número do orçamento: ${errorMessage(err)}. Tente de novo.`,
      );
      setSaving(false);
      return;
    }

    const numberStr = String(reserved).padStart(4, "0");
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
      numberValue: reserved,
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
    try {
      // O `saveBusiness` não lança (TD-029): ele devolve a mensagem. São duas
      // gravações independentes — o histórico pode entrar e o `config/orcamento`
      // não, e nesse caso o aviso precisa dizer qual das duas ficou de fora.
      const [, businessError] = await Promise.all([
        addQuote(payload),
        saveBusiness(business),
      ]);
      // Volta a numeração a seguir o histórico (o novo registro puxa o próximo nº).
      numberEdited.current = false;
      if (businessError) {
        fail(
          `Orçamento nº ${numberStr} salvo no histórico, mas os dados do negócio não foram gravados: ${businessError}`,
        );
      } else {
        ok(`Orçamento nº ${numberStr} salvo no histórico.`);
      }
    } catch (err) {
      fail(
        `O PDF foi gerado (nº ${numberStr}), mas falhou ao salvar no histórico: ${errorMessage(err)}. Tente gerar de novo.`,
      );
    } finally {
      setSaving(false);
    }
  }

  // TD-029 — os quatro campos do negócio gravam ao sair do campo, e a falha era
  // engolida pelo `void`: offline o dado ficava só na tela, com o app calado.
  async function persistBusiness(next: QuoteBusiness) {
    const failure = await saveBusiness(next);
    if (failure) fail(`Dados do negócio não foram salvos: ${failure}`);
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
    const confirmed = await ask({
      title: `Excluir o orçamento nº ${quote.number}${
        quote.customer ? ` (${quote.customer})` : ""
      }?`,
      body: (
        <>
          <p>
            Sai do histórico daqui — o PDF que você já enviou ao cliente
            continua com ele.
          </p>
          <p className="confirm-safe">
            A numeração não recua: o próximo orçamento segue do maior número já
            emitido.
          </p>
        </>
      ),
      confirmLabel: "Excluir orçamento",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteQuote(quote.id);
      ok(`Orçamento nº ${quote.number} excluído do histórico.`);
    } catch (err) {
      // Sem ponto final no template: a frase do `guardOnline` já termina em
      // ponto, e o aviso saía com ".." (medido ao vivo).
      fail(`Erro ao excluir o orçamento nº ${quote.number}: ${errorMessage(err)}`);
    }
  }

  return (
    <main className="wrap" id="conteudo">
      {/* Sem `status`: o /orcamento não assina coleção nenhuma em tempo real. */}
      <PageHeader
        title="Orçamento"
        meta="Gerar orçamento em PDF — Lopo Lab"
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <NavBar />

      <div className="quote-grid">
        <div className="card quote-card">
          {/* UX-29 — os 4 títulos de cartão desta rota são `<h2>`. */}
          <h2 className="section-label">
            Dados do negócio <span className="label-hint">(saem no PDF)</span>
          </h2>
          <div className="field-block compact">
            {/* UX-22 — este campo era o ÚNICO da tela sem rótulo visível (só um
                `aria-label`), e era ele quem desalinhava os dois cartões: o da
                direita começa com rótulo, este não, e os 15px de diferença
                desciam por todas as linhas seguintes. O rótulo também resolve o
                nome acessível de verdade — o placeholder some ao digitar. */}
            <label className="section-label" htmlFor={`${fieldId}-business`}>
              Nome do negócio
            </label>
            <input
              id={`${fieldId}-business`}
              className="field-input"
              type="text"
              value={business.name}
              onChange={(event) => updateBusiness({ name: event.target.value })}
              onBlur={() => void persistBusiness(business)}
              placeholder="Nome do negócio"
            />
          </div>
          <div className="two-col">
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-phone`}>
                Telefone / WhatsApp
              </label>
              <input
                id={`${fieldId}-phone`}
                className="field-input"
                type="text"
                value={business.phone}
                onChange={(event) =>
                  updateBusiness({ phone: event.target.value })
                }
                onBlur={() => void persistBusiness(business)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-instagram`}>
                Instagram
              </label>
              <input
                id={`${fieldId}-instagram`}
                className="field-input"
                type="text"
                value={business.instagram}
                onChange={(event) =>
                  updateBusiness({ instagram: event.target.value })
                }
                onBlur={() => void persistBusiness(business)}
                placeholder="@lopolab"
              />
            </div>
          </div>
          <div className="field-block compact">
            <label className="section-label" htmlFor={`${fieldId}-email`}>
              E-mail
            </label>
            <input
              id={`${fieldId}-email`}
              className="field-input"
              type="text"
              value={business.email}
              onChange={(event) => updateBusiness({ email: event.target.value })}
              onBlur={() => void persistBusiness(business)}
              placeholder="contato@lopolab.com.br"
            />
          </div>
        </div>

        <div className="card quote-card">
          <h2 className="section-label">Dados do orçamento</h2>
          <div className="two-col">
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-number`}>
                Número
              </label>
              <NumberInput
                id={`${fieldId}-number`}
                className="field-input"
                min={1}
                value={quoteNumber}
                onChange={(next) => {
                  numberEdited.current = true;
                  setQuoteNumber(next);
                }}
              />
            </div>
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-customer`}>
                Cliente <span className="label-hint">(opcional)</span>
              </label>
              <input
                id={`${fieldId}-customer`}
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
              <label className="section-label" htmlFor={`${fieldId}-date`}>
                Data
              </label>
              <input
                id={`${fieldId}-date`}
                className="field-input"
                type="date"
                value={dateStr}
                onChange={(event) => setDateStr(event.target.value)}
              />
            </div>
            <div className="field-block compact">
              <label className="section-label" htmlFor={`${fieldId}-validity`}>
                Validade (dias)
              </label>
              <NumberInput
                id={`${fieldId}-validity`}
                className="field-input"
                min={1}
                value={validityDays}
                onChange={setValidityDays}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card quote-items-card">
        <h2 className="section-label">Itens do orçamento</h2>

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
                    aria-label="Descrição do item"
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
                    <label
                      className="section-label"
                      htmlFor={`${fieldId}-${item.key}-qty`}
                    >
                      Qtd
                    </label>
                    <NumberInput
                      id={`${fieldId}-${item.key}-qty`}
                      className="field-input"
                      min={1}
                      value={item.quantity}
                      onChange={(quantity) =>
                        updateItem(item.key, { quantity })
                      }
                    />
                  </div>
                  <div className="field-block compact">
                    <label
                      className="section-label"
                      htmlFor={`${fieldId}-${item.key}-price`}
                    >
                      Preço unit.
                    </label>
                    <NumberInput
                      id={`${fieldId}-${item.key}-price`}
                      className="field-input"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(unitPrice) =>
                        updateItem(item.key, { unitPrice })
                      }
                    />
                  </div>
                  <div className="field-block compact">
                    {/* Subtotal é valor calculado, não campo — segue <div>. */}
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
                aria-label="Adicionar produto do catálogo"
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
          <label className="section-label" htmlFor={`${fieldId}-notes`}>
            Observações <span className="label-hint">(opcional)</span>
          </label>
          <textarea
            id={`${fieldId}-notes`}
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
        {/* UX-32 — o que falta. Só o carrinho vazio é "falta"; `saving` é
            espera, e o próprio rótulo do botão já diz isso. */}
        {items.length === 0 ? (
          <div className="disabled-why">
            adicione ao menos um item para gerar o PDF
          </div>
        ) : null}
        <FeedbackNote note={note} onClose={clear} />
      </div>

      {orderedQuotes.length > 0 ? (
        <div className="card quote-history">
          <h2 className="section-label">
            Histórico de orçamentos ({orderedQuotes.length})
          </h2>
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

      {dialog}
    </main>
  );
}
