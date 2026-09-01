"use client";

import { useId } from "react";
import { Settings } from "lucide-react";
import type { Machine } from "../types";
import { MachineCheckboxes } from "./MachineCheckboxes";

type MachineSelectorProps = {
  machines: Machine[];
  selectedMachineIds: string[];
  onChange: (machineIds: string[]) => void;
  onManage: () => void;
};

export function MachineSelector({
  machines,
  selectedMachineIds,
  onChange,
  onManage,
}: MachineSelectorProps) {
  const labelId = useId();
  return (
    <div className="field-block">
      <div className="section-head">
        {/* UX-16: rotula um grupo de CAIXAS, não um campo — `role="group"`
            + `aria-labelledby` no lugar de um <label> que não aponta pra nada. */}
        {/* UX-29: `<h2>` porque é seção da página, não rótulo de campo. Continua
            servindo de `aria-labelledby` do grupo. */}
        <h2 className="section-label" id={labelId}>
          Máquinas
        </h2>
        <button className="link-button" type="button" onClick={onManage}>
          <Settings size={14} />
          Gerenciar
        </button>
      </div>
      <MachineCheckboxes
        machines={machines}
        selectedIds={selectedMachineIds}
        onChange={onChange}
        labelledBy={labelId}
      />
      {/* [FROTA] Fase 2 — o que a marcação SIGNIFICA. Antes o chip escolhia a
          impressora que pagava a conta; agora ele declara onde a peça CABE, e o
          preço é a média ponderada dessas. Sem esta linha, o dono continuaria
          lendo a marcação como "vai rodar aqui". */}
      <p className="field-hint">
        Onde esta peça <strong>pode</strong> ser impressa. O preço é a média da
        frota marcada, ponderada pelo peso de cada máquina — não o custo de uma
        delas.
      </p>
    </div>
  );
}
