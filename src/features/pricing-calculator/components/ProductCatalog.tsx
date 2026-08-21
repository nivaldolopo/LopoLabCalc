"use client";

import {
  Download,
  Edit3,
  FileText,
  Factory,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { Fragment } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import { round2 } from "@/lib/number";
import type {
  CapacitySettings,
  FixedCostSettings,
  Machine,
  PaymentFeeSettings,
  PricingResult,
  ProductPayload,
  SavedProduct,
  SortMode,
  StockFilament,
} from "../types";
import { errorMessage } from "@/lib/errors";
import { matchesQuery } from "@/lib/text";
import { calculatePricing } from "../lib/calculatePricing";
import { calculateCapacity } from "../lib/calculateCapacity";
import { filamentsTotalG, normalizeFilaments } from "../lib/filaments";
import { marginTierClass, marginTierTitle } from "../lib/marginTier";
import {
  downloadCsv,
  exportProductsCsv,
  parseProductsCsv,
} from "../lib/productCsv";
import { useConfirm } from "./ConfirmDialog";
import { CostBars } from "./CostBars";
import { FeedbackNote, useFeedback } from "./FeedbackNote";
import { NetMarginHint } from "./NetMarginHint";
import { ProfitSummary } from "./ProfitSummary";
import { SearchBox } from "./SearchBox";

// Diário pode ser fracionário (mesa que dura mais de um dia). Até 1 casa, sem
// zeros à toa: 4 → "4", 0.25 → "0,3".
function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

// UX-04: um produto pode usar mais de uma impressora (etapas em máquinas
// diferentes). `machineUsage` traz cada máquina que participou; a principal nem
// sempre é a única. Devolve os nomes DISTINTOS, na ordem em que aparecem.
function machineNames(result: PricingResult): string[] {
  const names = result.machineUsage.map((u) => u.machineName);
  return names.length > 0 ? Array.from(new Set(names)) : [result.machine.name];
}

// Célula "Máquina" reusada na linha fechada (compacta: "A1 +1") e no painel
// expandido (`full`: lista inteira). Mantém o badge de máquina órfã (TD-009).
function MachineCell({
  result,
  full = false,
}: {
  result: PricingResult;
  full?: boolean;
}) {
  if (result.machineMissing) {
    return (
      <span
        className="machine-missing-badge"
        title="Máquina não encontrada — usando esta como fallback. Reatribua a impressora."
      >
        ⚠ {result.machine.name}
      </span>
    );
  }
  const names = machineNames(result);
  if (names.length <= 1) return <>{names[0]}</>;
  if (full) return <>{names.join(" · ")}</>;
  return (
    <span title={names.join(" · ")}>
      {names[0]} <span className="muted">+{names.length - 1}</span>
    </span>
  );
}

type ProductCatalogProps = {
  products: SavedProduct[];
  machines: Machine[];
  stock: StockFilament[];
  fixedCosts: FixedCostSettings;
  pricingByProduct: Map<string, PricingResult>;
  capacitySettings: CapacitySettings;
  // UX-10: taxas de pagamento só para EXIBIR a margem líquida ao lado da bruta.
  // Não entram em nenhum cálculo de preço/custo aqui.
  fees: PaymentFeeSettings;
  // UX-08: produto a abrir já expandido ao entrar (vindo do "Ver no catálogo" do
  // estoque). Ausente = nada aberto.
  initialOpenId?: string | null;
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  onLoadProduct: (product: SavedProduct) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
  onImportProducts: (products: ProductPayload[]) => Promise<void>;
  // FEAT-08: as 3 ações operam sobre o produto INTEIRO ou sobre um subitem
  // vendável (`subitemId`) — a mesma unidade que a produção e o orçamento já
  // sabem receber. Ausente = produto inteiro.
  onRegisterSale: (
    product: SavedProduct,
    result: PricingResult,
    subitemId?: string,
  ) => void;
  onProduce: (product: SavedProduct, subitemId?: string) => void;
  onQuote: (product: SavedProduct, subitemId?: string) => void;
  onNewSale: () => void;
};

export function ProductCatalog({
  products,
  machines,
  stock,
  fixedCosts,
  pricingByProduct,
  capacitySettings,
  fees,
  initialOpenId,
  sortMode,
  onSortModeChange,
  onLoadProduct,
  onDeleteProduct,
  onImportProducts,
  onRegisterSale,
  onProduce,
  onQuote,
  onNewSale,
}: ProductCatalogProps) {
  const [openProductId, setOpenProductId] = useState<string | null>(
    initialOpenId ?? null,
  );
  // UX-08: ao entrar via "Ver no catálogo", rola até o card semeado. Uma vez só
  // (mount) — o produto pode não estar na 1ª tela.
  useEffect(() => {
    if (!initialOpenId) return;
    document
      .getElementById(`cat-row-${initialOpenId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Só no mount — o foco inicial não deve refazer scroll a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // UX-05: busca por nome. Client-side porque o catálogo mora inteiro no
  // cliente (produtos têm teto natural — não paginam na TD-006).
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Resultado da importação de CSV, inline no lugar do window.alert (TD-004);
  // desde o UX-15 vem do aviso compartilhado (sucesso some sozinho).
  const { note, ok, fail, clear } = useFeedback();
  // UX-15: excluir e importar deixaram de usar o `window.confirm` nativo.
  const { ask, dialog } = useConfirm();

  // Lê a precificação já memoizada no pai; fallback defensivo se algum produto
  // ainda não estiver no map.
  const resultFor = useCallback(
    (product: SavedProduct) =>
      pricingByProduct.get(product.id) ??
      calculatePricing(product, machines, fixedCosts, stock),
    [pricingByProduct, machines, fixedCosts, stock],
  );

  const sortedProducts = useMemo(() => {
    const nextProducts = [...products];
    const priceOf = (product: SavedProduct) => resultFor(product).suggestedPrice;

    switch (sortMode) {
      case "oldest":
        return nextProducts.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      case "az":
        return nextProducts.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "pt-BR"),
        );
      case "za":
        return nextProducts.sort((a, b) =>
          (b.name || "").localeCompare(a.name || "", "pt-BR"),
        );
      case "price-desc":
        return nextProducts.sort((a, b) => priceOf(b) - priceOf(a));
      case "price-asc":
        return nextProducts.sort((a, b) => priceOf(a) - priceOf(b));
      case "recent":
      default:
        return nextProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  }, [products, resultFor, sortMode]);

  const filteredProducts = useMemo(
    () => sortedProducts.filter((product) => matchesQuery(query, product.name)),
    [sortedProducts, query],
  );

  if (products.length === 0) return null;

  // UX-15 — a confirmação que motivou o item. `removeProduct` é um `deleteDoc`
  // SEM cascata: venda e acabado guardam nome + custo congelados, então o
  // histórico e os números de dinheiro sobrevivem. O que some é a receita — e é
  // exatamente isso que o texto precisa dizer, produto pelo nome.
  async function confirmDelete(product: SavedProduct) {
    const confirmed = await ask({
      title: `Excluir “${product.name}”?`,
      body: (
        <>
          <p>
            Some a receita do produto: peso, horas, cores, subitens, acessórios
            e etapas. Não há lixeira nem desfazer.
          </p>
          <p className="confirm-safe">
            Não afeta as vendas já registradas, o estoque de acabados nem o
            histórico de produção — cada um guarda o nome e o custo congelados
            na época.
          </p>
        </>
      ),
      confirmLabel: "Excluir produto",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await onDeleteProduct(product.id);
      ok(`“${product.name}” excluído do catálogo.`);
    } catch (error) {
      fail(
        `Não foi possível excluir “${product.name}”: ${errorMessage(error)}`,
      );
    }
  }

  function exportCsv() {
    const csv = exportProductsCsv(products, machines, fixedCosts, stock);
    downloadCsv("catalogo-precos-3d.csv", csv);
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      clear();
      try {
        const content = String(event.target?.result ?? "");
        const {
          products: importedProducts,
          warnings,
          recalc,
        } = parseProductsCsv(content, machines, { fixedCosts, stock });
        if (importedProducts.length === 0) {
          fail("Nenhum produto válido encontrado no CSV.");
          return;
        }

        const confirmed = await ask({
          title: `Importar ${importedProducts.length} produtos do CSV?`,
          body: (
            <>
              <p>
                Eles entram como produtos <strong>novos</strong> no catálogo — o
                que já está salvo continua onde está.
              </p>
              {/* O aviso vem ANTES de gravar: máquina que não casou muda
                  energia e desgaste, e o dono ainda pode corrigir o CSV. */}
              {warnings.length > 0 && (
                <div className="import-warnings">
                  <strong>
                    ⚠️ {warnings.length}{" "}
                    {warnings.length === 1 ? "linha" : "linhas"} com máquina não
                    reconhecida:
                  </strong>
                  <ul>
                    {warnings.slice(0, 5).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                  {warnings.length > 5 && (
                    <p>e mais {warnings.length - 5}…</p>
                  )}
                </div>
              )}
              {/* CSV-03: preço e custo são sempre RECALCULADOS a partir das
                  entradas — editar essas colunas na planilha não muda nada.
                  Antes isso acontecia calado; agora o dono vê o que foi
                  ignorado antes de gravar. Não bloqueia. */}
              {recalc && (
                <div className="import-warnings">
                  <strong>
                    ⚠️ {recalc.divergentes} de {recalc.comparadas}{" "}
                    {recalc.comparadas === 1 ? "linha" : "linhas"} com preço/custo
                    diferente do recalculado:
                  </strong>
                  <ul>
                    {recalc.exemplos.map((exemplo) => (
                      <li key={exemplo}>{exemplo}</li>
                    ))}
                  </ul>
                  <p>
                    Essas colunas <strong>não são importadas</strong> — o preço
                    sai sempre das entradas (peso, horas, markup, máquina,
                    arredondamento). Vale conferir se a diferença é uma edição
                    sua na planilha ou uma mudança de configuração desde o
                    export.
                  </p>
                </div>
              )}
            </>
          ),
          confirmLabel: "Importar",
        });
        if (!confirmed) return;

        await onImportProducts(importedProducts);
        ok(`${importedProducts.length} produtos importados com sucesso.`);
      } catch (error) {
        fail(error instanceof Error ? error.message : "CSV inválido.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  return (
    <div className="catalog-section">
      <div className="catalog-header">
        <h2 className="catalog-title sg">Catálogo ({products.length})</h2>
        <div className="catalog-actions">
          <button
            className="btn primary catalog-new-sale"
            type="button"
            onClick={onNewSale}
          >
            <Receipt size={15} /> Nova venda
          </button>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar produto..."
            resultCount={filteredProducts.length}
          />
          <select
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as SortMode)}
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="az">Nome (A→Z)</option>
            <option value="za">Nome (Z→A)</option>
            <option value="price-desc">Preço (maior)</option>
            <option value="price-asc">Preço (menor)</option>
          </select>
          <button
            className="icon-label-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} />
            Importar
          </button>
          <button className="icon-label-button" type="button" onClick={exportCsv}>
            <Download size={15} />
            Exportar
          </button>
          <input
            ref={fileInputRef}
            accept=".csv"
            hidden
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <FeedbackNote note={note} onClose={clear} />
      <div className="catalog-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="col-name">Produto</th>
                {/* UX-21: `.num` é a convenção que /vendas (sales.css) e o
                    recibo (cesta-recibo.css) já usavam — alinha a coluna à
                    direita. A fonte destas células já é mono, então é o
                    `text-align` sozinho que faz a vírgula parar de dançar
                    entre `R$ 33,64` e `R$ 617,90`. */}
                <th className="col-price num">Preço/peça</th>
                <th className="num">Peças</th>
                <th className="num">Custo/peça</th>
                <th className="num">Margem</th>
                <th>Máquina</th>
                <th className="col-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr className="catalog-no-results">
                  <td colSpan={7}>
                    Nenhum produto encontrado para “{query.trim()}”.
                  </td>
                </tr>
              ) : null}
              {filteredProducts.map((product) => {
                const result = resultFor(product);
                const isOpen = openProductId === product.id;

                return (
                  <Fragment key={product.id}>
                    <tr
                      id={`cat-row-${product.id}`}
                      className={`main-row ${isOpen ? "open" : ""}`}
                      onClick={() =>
                        setOpenProductId((current) =>
                          current === product.id ? null : product.id,
                        )
                      }
                    >
                      {/* UX-03: a faixa de "Ações" (146px, FEAT-08) trunca o
                          nome; o `title` ajuda no hover (desktop) e o painel
                          expandido repete o nome inteiro (toque/mobile). */}
                      <td className="col-name strong" title={product.name}>
                        <span className="arrow-icon">▼</span>
                        {product.name}
                      </td>
                      <td className="col-price mono price-cell num">
                        {formatCurrency(result.suggestedPrice)}
                        <span className="per-unit-hint">/peça</span>
                      </td>
                      <td
                        className="mono muted num"
                        data-label="Peças/impressão"
                      >
                        {result.pieces > 1 ? `${result.pieces}x` : "—"}
                      </td>
                      <td className="mono num" data-label="Custo/peça">
                        {formatCurrency(result.totalCost)}
                      </td>
                      {/* UX-10: a margem do `PricingResult` é BRUTA (pré-taxa).
                          Ao lado dela, o piso: o que sobra no pior meio de
                          pagamento configurado. */}
                      <td className="mono muted num" data-label="Margem">
                        {/* UX-19: a faixa pinta um <span> PRÓPRIO — o `.muted`
                            do td é 0,1,0 e vem depois do base.css na cascata,
                            então a classe no td perderia o empate. */}
                        <span
                          className={marginTierClass(result.margin)}
                          title={marginTierTitle(result.margin)}
                        >
                          {result.margin.toFixed(0)}%
                        </span>
                        <NetMarginHint result={result} fees={fees} compact />
                      </td>
                      <td data-label="Máquina">
                        <MachineCell result={result} />
                      </td>
                      <td className="col-actions">
                        {/* FEAT-08: a linha fechada age só sobre o produto
                            INTEIRO — subitem não existe visualmente aqui; as
                            ações por parte moram no painel expandido. */}
                        <button
                          className="icon-button sale"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRegisterSale(product, result);
                          }}
                          title="Registrar venda"
                        >
                          <Receipt size={15} />
                        </button>
                        <button
                          className="icon-button produce"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onProduce(product);
                          }}
                          title="Produzir item"
                        >
                          <Factory size={15} />
                        </button>
                        <button
                          className="icon-button quote"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onQuote(product);
                          }}
                          title="Orçar item"
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          className="icon-button edit"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onLoadProduct(product);
                          }}
                          title="Carregar no formulário"
                        >
                          <Edit3 size={15} />
                        </button>
                        {/* UX-15: o divisor mudou de lugar (era entre orçar e
                            editar). O que precisa de distância é o DESTRUTIVO,
                            que estava colado no botão mais clicado da linha. */}
                        <span className="icon-button-divider" />
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await confirmDelete(product);
                          }}
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                    <tr className={`details-row ${isOpen ? "open" : ""}`}>
                      <td colSpan={7}>
                        <CatalogDetails
                          product={product}
                          result={result}
                          fixedCosts={fixedCosts}
                          capacitySettings={capacitySettings}
                          fees={fees}
                          onRegisterSale={onRegisterSale}
                          onProduce={onProduce}
                          onQuote={onQuote}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {dialog}
    </div>
  );
}

function CatalogDetails({
  product,
  result,
  fixedCosts,
  capacitySettings,
  fees,
  onRegisterSale,
  onProduce,
  onQuote,
}: {
  product: SavedProduct;
  result: ReturnType<typeof calculatePricing>;
  fixedCosts: FixedCostSettings;
  capacitySettings: CapacitySettings;
  fees: PaymentFeeSettings;
  onRegisterSale: (
    product: SavedProduct,
    result: PricingResult,
    subitemId?: string,
  ) => void;
  onProduce: (product: SavedProduct, subitemId?: string) => void;
  onQuote: (product: SavedProduct, subitemId?: string) => void;
}) {
  const stages = product.stages ?? [];
  const accessories = product.accessories ?? [];
  const links = [
    ["📦 Modelo original ↗", product.linkModel],
    ["🏷️ Concorrente ↗", product.linkCompetitor],
    ["📁 Arquivo STL/gcode ↗", product.linkFile],
  ].filter(([, href]) => Boolean(href));

  // FEAT-02: peso total = soma por cor do produto inteiro (etapa principal +
  // extras). `result.filaments` já agrega tudo por cor (pesos por impressão).
  const totalWeight = round2(filamentsTotalG(result.filaments));
  // Rótulo de filamento: preço/kg quando mono; "N cores" quando multicolor.
  const filamentLabel =
    result.filaments.length > 1
      ? `${result.filaments.length} cores`
      : `${formatCurrency(result.filaments[0]?.pricePerKg ?? 0)}/kg`;
  const totalHours = round2(
    product.printHours +
      stages.reduce((sum, stage) => sum + (stage.printHours || 0), 0),
  );

  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.profitPerPiece > 0
      ? Math.ceil(totalFixedMonth / result.profitPerPiece)
      : null;

  const capacityResult = calculateCapacity(result, product, capacitySettings);
  // Contextualiza a meta contra a capacidade produtiva (espelha o card de preço).
  const capacityMonth = capacityResult?.piecesMonth ?? 0;
  const breakEvenPct =
    breakEvenUnits && capacityMonth > 0
      ? Math.round((breakEvenUnits / capacityMonth) * 100)
      : null;
  const breakEvenOverCapacity =
    breakEvenUnits != null && capacityMonth > 0 && breakEvenUnits > capacityMonth;

  return (
    <div className="catalog-details">
      {/* UX-03: o nome trunca na linha fechada e o `title` não serve em toque.
          Repetido aqui inteiro (quebra em várias linhas) — quem não conseguiu
          ler o nome expande o card e vê. */}
      <h3 className="cd-product-name">{product.name}</h3>
      <div className="cd-meta">
        <span>
          <span className="db-label">Máquina</span>{" "}
          <MachineCell result={result} full />
        </span>
        <span>
          <span className="db-label">Markup</span> {product.markup.toFixed(1)}x
        </span>
        <span>
          <span className="db-label">Peso total</span> {totalWeight}g
        </span>
        <span>
          <span className="db-label">Impressão</span> {totalHours}h
        </span>
        <span>
          <span className="db-label">Peças/impressão</span> {result.pieces}
        </span>
        <span>
          <span className="db-label">Filamento</span> {filamentLabel}
          {result.filamentMissing ? (
            <span
              className="machine-missing-badge"
              title="Cor removida do Estoque — usando o preço salvo. Reatribua a cor do produto (o custo pode estar errado)."
            >
              {" "}
              ⚠ cor removida
            </span>
          ) : null}
        </span>
        <span>
          <span className="db-label">Mão de obra</span> {product.laborMinutes}min
        </span>
      </div>

      <div className="cd-main">
        <div className="cd-cost">
          <div className="cd-price-highlight">
            <span className="cd-ph-label">💰 Preço sugerido / peça</span>
            <span className="cd-ph-value">
              {formatCurrency(result.suggestedPrice)}
            </span>
            <span className="cd-ph-margin">
              margem de{" "}
              <span
                className={marginTierClass(result.margin)}
                title={marginTierTitle(result.margin)}
              >
                {result.margin.toFixed(0)}%
              </span>{" "}
              sobre o preço final
            </span>
            {/* UX-10: a linha acima é a margem BRUTA (Pix/dinheiro). Esta é o
                piso — o que sobra na pior taxa configurada. */}
            <NetMarginHint result={result} fees={fees} />
          </div>
          <div className="result-label cd-comp-label">Composição do custo</div>
          <CostBars result={result} />
          <div className="cd-total-row">
            <span>Custo total / peça</span>
            <span className="mono">{formatCurrency(result.totalCost)}</span>
          </div>
          {result.pieces > 1 ? (
            <div className="cd-total-row muted">
              <span>Preço da impressão ({result.pieces} peças)</span>
              <span className="mono">
                {formatCurrency(result.suggestedPrice * result.pieces)}
              </span>
            </div>
          ) : null}
          {breakEvenUnits ? (
            <div className="break-even-box visible cd-breakeven">
              <div className="break-even-title">🎯 Meta de Break-Even</div>
              <div className="break-even-val">
                Vender <strong>{breakEvenUnits}</strong> peças/mês deste produto
                cobre o aluguel + custos fixos e inicia o lucro.
              </div>
              {capacityMonth > 0 ? (
                breakEvenOverCapacity ? (
                  <div className="break-even-context warn">
                    ⚠️ Acima da capacidade ({capacityMonth} pçs/mês) — reveja
                    preço ou volume.
                  </div>
                ) : (
                  <div className="break-even-context">
                    ≈ {breakEvenPct}% da sua capacidade mensal ({breakEvenUnits}{" "}
                    de {capacityMonth} peças).
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="cd-side">
          <div className="cd-capacity-lite">
            <div className="cd-section-head">
              <span className="result-label green">📊 Capacidade produtiva</span>
              <span className="cd-capacity-note">
                {capacitySettings.hoursDay}h/dia · {capacitySettings.daysMonth}
                d/mês · {capacitySettings.machines} máq.
              </span>
            </div>
            {capacityResult ? (
              <div className="cd-cap-rows">
                <div className="cd-cap-row">
                  <span className="cd-cap-period">☀️ Diário</span>
                  <span className="cd-cap-pieces">
                    {formatCount(capacityResult.piecesDay)} pçs
                  </span>
                  <span className="cd-cap-money">
                    {capacityResult.fixedIncluded ? "lucro" : "contrib."}{" "}
                    {formatCurrency(capacityResult.netDay)}
                    <em>bruto {formatCurrency(capacityResult.grossDay)}</em>
                  </span>
                </div>
                <div className="cd-cap-row">
                  <span className="cd-cap-period">📅 Mensal</span>
                  <span className="cd-cap-pieces">
                    {capacityResult.piecesMonth} pçs
                  </span>
                  <span className="cd-cap-money">
                    {capacityResult.fixedIncluded ? "lucro" : "contrib."}{" "}
                    {formatCurrency(capacityResult.netMonth)}
                    <em>bruto {formatCurrency(capacityResult.grossMonth)}</em>
                  </span>
                </div>
              </div>
            ) : (
              <div className="cd-capacity-empty">
                Defina o tempo de impressão para estimar a capacidade.
              </div>
            )}
          </div>
          <ProfitSummary result={result} printHours={totalHours} />
          {/* FEAT-08: os 3 destinos do produto INTEIRO. "Registrar venda" abre o
              modal aqui mesmo; produzir/orçar navegam com o produto semeado. */}
          <div className="cd-actions">
            <button
              className="btn primary cd-register-sale"
              type="button"
              onClick={() => onRegisterSale(product, result)}
            >
              <Receipt size={16} /> Registrar venda
            </button>
            <button
              className="btn cd-action"
              type="button"
              onClick={() => onProduce(product)}
            >
              <Factory size={16} /> Produzir
            </button>
            <button
              className="btn cd-action"
              type="button"
              onClick={() => onQuote(product)}
            >
              <FileText size={16} /> Orçar
            </button>
          </div>
        </div>
      </div>

      {result.subitems && result.subitems.length > 0 ? (
        <div className="details-span">
          <div className="db-label">🧩 Subitens vendáveis</div>
          <div className="subitem-price-list">
            {result.subitems.map((subitem, index) => (
              <div className="subitem-price-row" key={subitem.id}>
                <span className="sp-name">
                  {subitem.name || `Subitem ${index + 1}`}
                </span>
                <span className="sp-meta">
                  {round2(subitem.printHours)}h · markup{" "}
                  {subitem.markup.toFixed(1)}x
                </span>
                <span className="sp-price mono sg">
                  {formatCurrency(subitem.price)}
                </span>
                {/* FEAT-08: vender/produzir/orçar só ESTA parte. A venda de
                    subitem já existia (saleContextFromSubitem, FEAT-01); a
                    produção e o orçamento recebem o `subitemId` na query. */}
                <span className="sp-actions">
                  <button
                    className="icon-button sale"
                    type="button"
                    onClick={() => onRegisterSale(product, result, subitem.id)}
                    title="Registrar venda deste subitem"
                  >
                    <Receipt size={15} />
                  </button>
                  <button
                    className="icon-button produce"
                    type="button"
                    onClick={() => onProduce(product, subitem.id)}
                    title="Produzir este subitem"
                  >
                    <Factory size={15} />
                  </button>
                  <button
                    className="icon-button quote"
                    type="button"
                    onClick={() => onQuote(product, subitem.id)}
                    title="Orçar este subitem"
                  >
                    <FileText size={15} />
                  </button>
                </span>
              </div>
            ))}
            <div className="subitem-price-row total">
              <span className="sp-name">Produto inteiro (Σ partes)</span>
              <span className="sp-meta" />
              <span className="sp-price mono">
                {formatCurrency(result.suggestedPrice)}
              </span>
              <span className="sp-actions" />
            </div>
          </div>
        </div>
      ) : null}

      {stages.length > 0 ? (
        <div className="details-span">
          <div className="db-label">🔗 Etapas de impressão</div>
          <div className="details-tags">
            <span>
              1. {product.mainStageName || "Principal"}{" "}
              <em>
                ({product.printHours}h ·{" "}
                {round2(filamentsTotalG(normalizeFilaments(product)))}g)
              </em>
            </span>
            {stages.map((stage, index) => (
              <span key={`${stage.name}-${index}`}>
                {index + 2}. {stage.name || `Etapa ${index + 2}`}{" "}
                <em>
                  ({stage.printHours || 0}h ·{" "}
                  {round2(filamentsTotalG(normalizeFilaments(stage)))}g)
                </em>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {accessories.length > 0 ? (
        <div className="details-span">
          <div className="db-label">🧩 Acessórios</div>
          <div className="details-tags">
            {accessories.map((accessory, index) => (
              <span key={`${accessory.desc}-${index}`}>
                {accessory.desc || "item"}{" "}
                <em>
                  {accessory.qty}× {formatCurrency(accessory.unitPrice)}
                </em>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {links.length > 0 ? (
        <div className="details-span">
          <div className="db-label">🔗 Links e referências</div>
          <div className="details-links">
            {links.map(([label, href]) => (
              <a href={href} key={label} rel="noopener noreferrer" target="_blank">
                {label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
