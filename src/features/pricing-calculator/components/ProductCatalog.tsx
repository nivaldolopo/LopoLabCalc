"use client";

import { Download, Edit3, Trash2, Upload } from "lucide-react";
import { Fragment } from "react";
import { useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatting/currency";
import type {
  FixedCostSettings,
  Machine,
  SavedProduct,
  SortMode,
} from "../types";
import { calculatePricing } from "../lib/calculatePricing";
import {
  downloadCsv,
  exportProductsCsv,
  parseProductsCsv,
} from "../lib/productCsv";

type ProductCatalogProps = {
  products: SavedProduct[];
  machines: Machine[];
  fixedCosts: FixedCostSettings;
  sortMode: SortMode;
  onSortModeChange: (sortMode: SortMode) => void;
  onLoadProduct: (product: SavedProduct) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
  onImportProducts: (products: ReturnType<typeof parseProductsCsv>) => Promise<void>;
};

export function ProductCatalog({
  products,
  machines,
  fixedCosts,
  sortMode,
  onSortModeChange,
  onLoadProduct,
  onDeleteProduct,
  onImportProducts,
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
                <th className="col-price">Preço</th>
                <th>Máquina</th>
                <th>Peças</th>
                <th>Custo Total</th>
                <th>Margem</th>
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
                      </td>
                      <td>{result.machine.name}</td>
                      <td className="mono muted">
                        {result.pieces > 1 ? `${result.pieces}x` : "—"}
                      </td>
                      <td className="mono">{formatCurrency(result.totalCost)}</td>
                      <td className="mono muted">{result.margin.toFixed(0)}%</td>
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
                        <CatalogDetails product={product} result={result} />
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
}: {
  product: SavedProduct;
  result: ReturnType<typeof calculatePricing>;
}) {
  const stages = product.stages ?? [];
  const accessories = product.accessories ?? [];
  const links = [
    ["📦 Modelo original ↗", product.linkModel],
    ["🏷️ Concorrente ↗", product.linkCompetitor],
    ["📁 Arquivo STL/gcode ↗", product.linkFile],
  ].filter(([, href]) => Boolean(href));

  return (
    <div className="details-container">
      <DetailBox label="Material" value={formatCurrency(result.materialCost)} />
      <DetailBox label="Energia" value={formatCurrency(result.energyCost)} />
      <DetailBox label="Desgaste" value={formatCurrency(result.depreciationCost)} />
      <DetailBox label="Mão de Obra" value={formatCurrency(result.laborCost)} />
      {result.stagesCost > 0 ? (
        <DetailBox
          label="Etapas extras"
          value={formatCurrency(result.stagesCost)}
          valueClassName="accent"
        />
      ) : null}
      {result.accessoriesCost > 0 ? (
        <DetailBox
          label="Acessórios"
          value={formatCurrency(result.accessoriesCost)}
          valueClassName="purple"
        />
      ) : null}
      <DetailBox label="Custo Fixo" value={formatCurrency(result.fixedCost)} />
      <DetailBox
        label="Markup"
        value={`${product.markup.toFixed(1)}x`}
        valueClassName="green"
      />
      <DetailBox
        label="Preço/peça"
        value={formatCurrency(result.suggestedPrice)}
        valueClassName="price"
      />

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

function DetailBox({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="details-box">
      <span className="db-label">{label}</span>
      <span className={`db-val ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}
