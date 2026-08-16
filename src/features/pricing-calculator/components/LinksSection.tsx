"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { ProductInput } from "../types";

type LinksSectionProps = {
  product: ProductInput;
  onChange: (patch: Partial<ProductInput>) => void;
};

export function LinksSection({ product, onChange }: LinksSectionProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const hasLinks = Boolean(product.linkModel || product.linkCompetitor || product.linkFile);

  return (
    <div className={`collapse-section ${open ? "open" : ""}`}>
      <button
        className="collapse-head"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="collapse-title">
          🔗 Links e referências
          {hasLinks ? <span className="collapse-badge">•</span> : null}
        </span>
        <ChevronDown className="collapse-chevron" size={14} />
      </button>
      <div className="collapse-body">
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-model`}>
            Fonte do modelo{" "}
            <span className="label-hint">
              (MakerWorld, Printables, STLFlix...)
            </span>
          </label>
          <input
            id={`${fieldId}-model`}
            className="field-input"
            type="url"
            value={product.linkModel}
            onChange={(event) => onChange({ linkModel: event.target.value })}
            placeholder="https://makerworld.com/..."
          />
        </div>
        <div className="field-block compact">
          <label className="section-label" htmlFor={`${fieldId}-competitor`}>
            Referência concorrente{" "}
            <span className="label-hint">(Mercado Livre, Shopee...)</span>
          </label>
          <input
            id={`${fieldId}-competitor`}
            className="field-input"
            type="url"
            value={product.linkCompetitor}
            onChange={(event) =>
              onChange({ linkCompetitor: event.target.value })
            }
            placeholder="https://..."
          />
        </div>
        <div className="field-block compact last">
          <label className="section-label" htmlFor={`${fieldId}-file`}>
            Arquivo STL / gcode{" "}
            <span className="label-hint">(link do Drive, Dropbox...)</span>
          </label>
          <input
            id={`${fieldId}-file`}
            className="field-input"
            type="url"
            value={product.linkFile}
            onChange={(event) => onChange({ linkFile: event.target.value })}
            placeholder="https://drive.google.com/..."
          />
        </div>
      </div>
    </div>
  );
}
