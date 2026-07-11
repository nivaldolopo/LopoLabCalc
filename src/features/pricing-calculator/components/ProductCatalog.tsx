"use client";

import { Download, Edit3, Receipt, Trash2, Upload } from "lucide-react";
import { Fragment } from "react";
import { useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
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

// Diário pode ser fracionário (mesa que dura mais de um dia). Até 1 casa, sem
// zeros à toa: 4 → "4", 0.25 → "0,3".
function formatCount(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

type ProductCatalogProps = {
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  capacitySettings: CapacitySettings;
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  onLoadProduct: (product: SavedProduct) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
  onImportProducts: (products: ReturnType<typeof parseProductsCsv>) => Promise<void>;
  onRegisterSale: (product: SavedProduct, result: PricingResult) => void;
};

export function ProductCatalog({
  products,
  machines,
  fixedCosts,
  capacitySettings,
  sortMode,
  onSortModeChange,
  onLoadProduct,
  onDeleteProduct,
  onImportProducts,
  onRegisterSale,
}: ProductCatalogProps) {
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedProducts = useMemo(() => {
    const nextProducts = [...products];
    const priceOf = (product: SavedProduct) =>
      calculatePricing(product, machines, fixedCosts).suggestedPrice;

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
  }, [fixedCosts, machines, products, sortMode]);

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
                const result = calculatePricing(product, machines, fixedCosts);
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
                      <td data-label="Máquina">{result.machine.name}</td>
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

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const totalWeight = round2(
    product.weightG + stages.reduce((sum, stage) => sum + (stage.weightG || 0), 0),
  );
  const totalHours = round2(
    product.printHours +
      stages.reduce((sum, stage) => sum + (stage.printHours || 0), 0),
  );

  // Rentabilidade: lucro por peça, pelo lote inteiro e por hora de máquina
  // (esta última diz qual produto "rende mais" ocupando a impressora).
  const profitPerPiece = result.suggestedPrice - result.totalCost;
  const profitBatch = profitPerPiece * result.pieces;
  const profitPerHour = totalHours > 0 ? profitBatch / totalHours : 0;
  const profitClass = profitPerPiece < 0 ? "sale-neg" : "sale-pos";

  const totalFixedMonth = fixedCosts.rent + fixedCosts.other;
  const breakEvenUnits =
    totalFixedMonth > 0 && result.contributionMargin > 0
      ? Math.ceil(totalFixedMonth / result.contributionMargin)
      : null;

  const capacityResult = calculateCapacity(result, product, capacitySettings);

  return (
    <div className="catalog-details">
      <div className="cd-meta">
        <span>
          <span className="db-label">Máquina</span> {result.machine.name}
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
                    líq. {formatCurrency(capacityResult.netDay)}
                    <em>bruto {formatCurrency(capacityResult.grossDay)}</em>
                  </span>
                </div>
                <div className="cd-cap-row">
                  <span className="cd-cap-period">📅 Mensal</span>
                  <span className="cd-cap-pieces">
                    {capacityResult.piecesMonth} pçs
                  </span>
                  <span className="cd-cap-money">
                    líq. {formatCurrency(capacityResult.netMonth)}
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
          <div className="cd-profit-card">
            <div className="cd-section-head">
              <span className="result-label">💵 Rentabilidade</span>
            </div>
            <div className="cd-profit-rows">
              <div className="cd-profit-row">
                <span className="cd-profit-label">Lucro / peça</span>
                <span className={`cd-profit-value ${profitClass}`}>
                  {formatCurrency(profitPerPiece)}
                </span>
              </div>
              <div className="cd-profit-row">
                <span className="cd-profit-label">Lucro / hora de máquina</span>
                <span className={`cd-profit-value ${profitClass}`}>
                  {formatCurrency(profitPerHour)}
                  <em>/h</em>
                </span>
              </div>
              {result.pieces > 1 ? (
                <div className="cd-profit-row">
                  <span className="cd-profit-label">
                    Lucro do lote ({result.pieces} pçs)
                  </span>
                  <span className={`cd-profit-value ${profitClass}`}>
                    {formatCurrency(profitBatch)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <button
            className="btn primary cd-register-sale"
            type="button"
            onClick={() => onRegisterSale(product, result)}
          >
            <Receipt size={18} />
            <span className="cd-rs-text">
              <span className="cd-rs-title">Registrar venda</span>
              <span className="cd-rs-sub">Congela custo e preço agora</span>
            </span>
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
