"use client";

import { Download, Edit3, Receipt, Trash2, Upload } from "lucide-react";
import { Fragment } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import { round2 } from "@/lib/number";
import type {
  CapacitySettings,
  FixedCostSettings,
  Machine,
  PricingResult,
  SavedProduct,
  SortMode,
} from "../types";
import { calculatePricing } from "../lib/calculatePricing";
import { calculateCapacity } from "../lib/calculateCapacity";
import {
  downloadCsv,
  exportProductsCsv,
  parseProductsCsv,
} from "../lib/productCsv";
import { CostBars } from "./CostBars";
import { ProfitSummary } from "./ProfitSummary";

// Diário pode ser fracionário (mesa que dura mais de um dia). Até 1 casa, sem
// zeros à toa: 4 → "4", 0.25 → "0,3".
function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

type ProductCatalogProps = {
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  pricingByProduct: Map<string, PricingResult>;
  capacitySettings: CapacitySettings;
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  onLoadProduct: (product: SavedProduct) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
  onImportProducts: (products: ReturnType<typeof parseProductsCsv>) => Promise<void>;
  onRegisterSale: (product: SavedProduct, result: PricingResult) => void;
  onNewSale: () => void;
};

export function ProductCatalog({
  products,
  machines,
  fixedCosts,
  pricingByProduct,
  capacitySettings,
  sortMode,
  onSortModeChange,
  onLoadProduct,
  onDeleteProduct,
  onImportProducts,
  onRegisterSale,
  onNewSale,
}: ProductCatalogProps) {
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lê a precificação já memoizada no pai; fallback defensivo se algum produto
  // ainda não estiver no map.
  const resultFor = useCallback(
    (product: SavedProduct) =>
      pricingByProduct.get(product.id) ??
      calculatePricing(product, machines, fixedCosts),
    [pricingByProduct, machines, fixedCosts],
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

  if (products.length === 0) return null;

  function exportCsv() {
    const csv = exportProductsCsv(products, machines, fixedCosts);
    downloadCsv("catalogo-precos-3d.csv", csv);
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = String(event.target?.result ?? "");
        const importedProducts = parseProductsCsv(content, machines);
        if (importedProducts.length === 0) {
          window.alert("Nenhum produto válido encontrado.");
          return;
        }

        if (
          window.confirm(
            `Encontrados ${importedProducts.length} produtos. Deseja importá-los agora?`,
          )
        ) {
          await onImportProducts(importedProducts);
          window.alert("✓ Todos os produtos foram importados com sucesso!");
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "CSV inválido.");
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
      <div className="catalog-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="col-name">Produto</th>
                <th className="col-price">Preço/peça</th>
                <th>Peças</th>
                <th>Custo/peça</th>
                <th>Margem</th>
                <th>Máquina</th>
                <th className="col-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => {
                const result = resultFor(product);
                const isOpen = openProductId === product.id;

                return (
                  <Fragment key={product.id}>
                    <tr
                      className={`main-row ${isOpen ? "open" : ""}`}
                      onClick={() =>
                        setOpenProductId((current) =>
                          current === product.id ? null : product.id,
                        )
                      }
                    >
                      <td className="col-name strong">
                        <span className="arrow-icon">▼</span>
                        {product.name}
                      </td>
                      <td className="col-price mono price-cell">
                        {formatCurrency(result.suggestedPrice)}
                        <span className="per-unit-hint">/peça</span>
                      </td>
                      <td className="mono muted" data-label="Peças/impressão">
                        {result.pieces > 1 ? `${result.pieces}x` : "—"}
                      </td>
                      <td className="mono" data-label="Custo/peça">
                        {formatCurrency(result.totalCost)}
                      </td>
                      <td className="mono muted" data-label="Margem">
                        {result.margin.toFixed(0)}%
                      </td>
                      <td data-label="Máquina">
                        {result.machineMissing ? (
                          <span
                            className="machine-missing-badge"
                            title="Máquina não encontrada — usando esta como fallback. Reatribua a impressora."
                          >
                            ⚠ {result.machine.name}
                          </span>
                        ) : (
                          result.machine.name
                        )}
                      </td>
                      <td className="col-actions">
                        <button
                          className="icon-button edit"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onLoadProduct(product);
                          }}
                          title="Carregar no formulário"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (window.confirm("Deseja realmente excluir este produto?")) {
                              await onDeleteProduct(product.id);
                            }
                          }}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
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
                          onRegisterSale={onRegisterSale}
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
    </div>
  );
}

function CatalogDetails({
  product,
  result,
  fixedCosts,
  capacitySettings,
  onRegisterSale,
}: {
  product: SavedProduct;
  result: ReturnType<typeof calculatePricing>;
  fixedCosts: FixedCostSettings;
  capacitySettings: CapacitySettings;
  onRegisterSale: (product: SavedProduct, result: PricingResult) => void;
}) {
  const stages = product.stages ?? [];
  const accessories = product.accessories ?? [];
  const links = [
    ["📦 Modelo original ↗", product.linkModel],
    ["🏷️ Concorrente ↗", product.linkCompetitor],
    ["📁 Arquivo STL/gcode ↗", product.linkFile],
  ].filter(([, href]) => Boolean(href));

  const totalWeight = round2(
    product.weightG + stages.reduce((sum, stage) => sum + (stage.weightG || 0), 0),
  );
  const totalHours = round2(
    product.printHours +
      stages.reduce((sum, stage) => sum + (stage.printHours || 0), 0),
  );

  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.contributionMargin > 0
      ? Math.ceil(totalFixedMonth / result.contributionMargin)
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
      <div className="cd-meta">
        <span>
          <span className="db-label">Máquina</span>{" "}
          {result.machineMissing ? (
            <span
              className="machine-missing-badge"
              title="Máquina não encontrada — usando esta como fallback. Reatribua a impressora."
            >
              ⚠ {result.machine.name}
            </span>
          ) : (
            result.machine.name
          )}
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
          <span className="db-label">Filamento</span>{" "}
          {formatCurrency(product.filamentPricePerKg)}/kg
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
              margem de {result.margin.toFixed(0)}% sobre o preço final
            </span>
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
                {capacitySettings.hoursDay}h/dia · {capacitySettings.machines}{" "}
                máq.
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
          <button
            className="btn primary cd-register-sale"
            type="button"
            onClick={() => onRegisterSale(product, result)}
          >
            <Receipt size={16} /> Registrar venda
          </button>
        </div>
      </div>

      {stages.length > 0 ? (
        <div className="details-span">
          <div className="db-label">🔗 Etapas de impressão</div>
          <div className="details-tags">
            <span>
              1. {product.mainStageName || "Principal"}{" "}
              <em>
                ({product.printHours}h · {product.weightG}g)
              </em>
            </span>
            {stages.map((stage, index) => (
              <span key={`${stage.name}-${index}`}>
                {index + 2}. {stage.name || `Etapa ${index + 2}`}{" "}
                <em>
                  ({stage.printHours || 0}h · {stage.weightG || 0}g)
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
