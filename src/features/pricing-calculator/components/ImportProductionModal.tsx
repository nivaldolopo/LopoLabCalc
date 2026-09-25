"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import {
  fetchImportedExternalIds,
  newProductionId,
  saveProduction,
} from "@/lib/firebase/productionRepository";
import {
  buildImportFinishedUpdates,
  buildImportPreview,
  bulkImportChunks,
  costImportLine,
  dedupeByTaskId,
  estoqueGroupsByProduct,
  IMPORT_FONTE,
  parseBambuImportFile,
  resolveImportLine,
  type CostedImportLine,
  type ImportContext,
  type ImportPreview,
} from "../lib/productionImport";
import type {
  FinishedGood,
  Machine,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";

// Item 3 — "Importar histórico" na /producao: um arquivo JSON gerado por
// ferramenta externa (fora deste repo, a partir do histórico de impressão da
// Bambu) vira N eventos de produção (`mode: "historico"`), com prévia
// OBRIGATÓRIA antes de gravar (a gravação é em lote — a conferência tem que
// ser em lote também, não peça a peça). Toda a resolução/custo é PURA
// (`lib/productionImport.ts`); este componente só orquestra arquivo → prévia
// → Firestore.

type ImportProductionModalProps = {
  machines: Machine[];
  products: SavedProduct[];
  stock: StockFilament[];
  supplies: Supply[];
  energyTariff: number;
  goods: FinishedGood[];
  onClose: () => void;
  onImported: (count: number) => void;
};

type Step =
  | { kind: "input" }
  | { kind: "analisando" }
  | { kind: "preview"; preview: ImportPreview; costed: CostedImportLine[] }
  | { kind: "gravando"; total: number; feitos: number }
  | { kind: "erro"; mensagem: string };

export function ImportProductionModal({
  machines,
  products,
  stock,
  supplies,
  energyTariff,
  goods,
  onClose,
  onImported,
}: ImportProductionModalProps) {
  const [raw, setRaw] = useState("");
  const [defaultPricePerKg, setDefaultPricePerKg] = useState(110);
  const [step, setStep] = useState<Step>({ kind: "input" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => setRaw(String(event.target?.result ?? ""));
    reader.readAsText(file, "UTF-8");
  }

  async function analisar() {
    setStep({ kind: "analisando" });
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      setStep({ kind: "erro", mensagem: "O texto colado (ou o arquivo) não é um JSON válido." });
      return;
    }
    const parsed = parseBambuImportFile(json);
    if (!parsed.ok) {
      setStep({ kind: "erro", mensagem: parsed.erro });
      return;
    }
    try {
      guardOnline();
      // 6 — idempotência ANTES de resolver: reimportar o mesmo arquivo não
      // duplica. Compara pelo `origemExterna` (S4), nunca pela nota.
      const jaImportados = await fetchImportedExternalIds(IMPORT_FONTE);
      const novos = parsed.file.eventos.filter((e) => !jaImportados.has(e.task_id));
      // A idempotência acima só sabe o que já está no Firestore — um
      // `task_id` repetido DENTRO deste arquivo passaria batido nela.
      const { unicos, duplicadosNoArquivo } = dedupeByTaskId(novos);
      const ctx: ImportContext = {
        machines,
        products,
        stock,
        supplies,
        energyTariff,
        defaultPricePerKg,
      };
      const results = unicos.map((evento) => resolveImportLine(evento, ctx));
      const preview = buildImportPreview(
        results,
        parsed.file.eventos.length - novos.length,
        duplicadosNoArquivo,
      );
      const now = Date.now();
      const costed = results
        .filter((r) => r.ok)
        .map((r) => costImportLine(r.line, ctx, newProductionId(), now));
      setStep({ kind: "preview", preview, costed });
    } catch (err) {
      setStep({ kind: "erro", mensagem: errorMessage(err) });
    }
  }

  async function confirmar(costed: CostedImportLine[]) {
    const totalEventos = costed.length;
    setStep({ kind: "gravando", total: totalEventos, feitos: 0 });
    let feitos = 0;
    try {
      guardOnline();
      const finishedUpdates = buildImportFinishedUpdates(costed, goods);
      const finishedByProduct = new Map(
        finishedUpdates.map((u) => [u.productId, u]),
      );
      const estoqueGrupos = estoqueGroupsByProduct(costed);
      for (const [productId, linhas] of estoqueGrupos) {
        await saveProduction(
          linhas.map((c) => ({ id: c.eventId, payload: c.payload })),
          [],
          finishedByProduct.get(productId) ?? null,
        );
        feitos += linhas.length;
        setStep({ kind: "gravando", total: totalEventos, feitos });
      }
      for (const chunk of bulkImportChunks(costed)) {
        await saveProduction(
          chunk.map((c) => ({ id: c.eventId, payload: c.payload })),
          [],
          null,
        );
        feitos += chunk.length;
        setStep({ kind: "gravando", total: totalEventos, feitos });
      }
      onImported(totalEventos);
      onClose();
    } catch (err) {
      setStep({ kind: "erro", mensagem: errorMessage(err) });
    }
  }

  return (
    <Modal
      title="Importar histórico de produção"
      sub='Arquivo JSON exportado da ferramenta de histórico da Bambu. Cada evento vira uma produção "histórico" — reimportar o mesmo arquivo não duplica.'
      onClose={onClose}
      footer={
        step.kind === "input" || step.kind === "analisando" ? (
          <>
            <button
              className="btn primary"
              type="button"
              disabled={!raw.trim() || step.kind === "analisando"}
              onClick={analisar}
            >
              {step.kind === "analisando" ? "Analisando…" : "Analisar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Cancelar
            </button>
          </>
        ) : step.kind === "preview" ? (
          <>
            <button
              className="btn primary"
              type="button"
              disabled={step.preview.aImportar === 0}
              onClick={() => confirmar(step.costed)}
            >
              Importar {step.preview.aImportar}{" "}
              {step.preview.aImportar === 1 ? "evento" : "eventos"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setStep({ kind: "input" })}
            >
              Voltar
            </button>
          </>
        ) : step.kind === "erro" ? (
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Fechar
          </button>
        ) : null
      }
    >
      {step.kind === "input" || step.kind === "analisando" ? (
        <>
          <div className="field-block">
            <label className="section-label" htmlFor="bambu-json">
              Cole o JSON, ou escolha o arquivo
            </label>
            <textarea
              id="bambu-json"
              className="field-input"
              rows={8}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder='{"eventos": [...]}'
            />
            <button
              className="link-button bordered"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} /> Escolher arquivo…
            </button>
            <input
              ref={fileInputRef}
              accept=".json"
              hidden
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="field-block">
            <label className="section-label" htmlFor="bambu-preco-padrao">
              R$/kg padrão pros materiais sem preço nesta importação
            </label>
            <NumberInput
              id="bambu-preco-padrao"
              className="field-input"
              min={0}
              value={defaultPricePerKg}
              onChange={setDefaultPricePerKg}
            />
            <div className="field-hint">
              Vale para todo filamento avulso do lote (sem marca ligada ao Estoque, direto
              no arquivo ou sugerida pelo cadastro) — decisão de quem importa, não fato da
              impressora.
            </div>
          </div>
        </>
      ) : null}

      {step.kind === "preview" ? <PreviewView preview={step.preview} /> : null}

      {step.kind === "gravando" ? (
        <p>
          Gravando {step.feitos} de {step.total}…
        </p>
      ) : null}

      {step.kind === "erro" ? (
        <div className="form-error">{step.mensagem}</div>
      ) : null}
    </Modal>
  );
}

function PreviewView({ preview }: { preview: ImportPreview }) {
  return (
    <div className="import-preview">
      <ul className="import-preview-stats">
        <li>
          <strong>{preview.totalArquivo}</strong> evento(s) no arquivo
        </li>
        <li>
          <strong>{preview.aImportar}</strong> a importar
        </li>
        {preview.jaImportados > 0 ? (
          <li>{preview.jaImportados} já importado(s) antes — ignorado(s)</li>
        ) : null}
        {preview.duplicadosNoArquivo > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.duplicadosNoArquivo} repetido(s) dentro do próprio arquivo —
            só a 1ª ocorrência entra
          </li>
        ) : null}
        {preview.semMaquina > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.semMaquina} não importado(s): máquina não reconhecida
          </li>
        ) : null}
        {preview.maquinaAproximada > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.maquinaAproximada} com máquina casada por aproximação
            (nome não bateu exato) — confira antes de confirmar
          </li>
        ) : null}
        {preview.estoqueSemProduto > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.estoqueSemProduto} não importado(s): desfecho &quot;estoque&quot; sem
            produto religado
          </li>
        ) : null}
        <li>
          {preview.comProduto} com produto religado (herda acessórios/mão de obra) ·{" "}
          {preview.semProduto} sem produto (só o dado bruto)
        </li>
        {preview.periodo ? (
          <li>
            Período: {formatDate(preview.periodo.inicio)} até{" "}
            {formatDate(preview.periodo.fim)}
          </li>
        ) : null}
      </ul>

      <h3 className="section-label">Por desfecho</h3>
      <ul className="import-preview-stats">
        <li>{preview.porOutcome.historico} histórico</li>
        <li>{preview.porOutcome.falha} falha</li>
        <li>{preview.porOutcome.estoque} estoque (vira peça pronta)</li>
      </ul>

      <h3 className="section-label">Por máquina</h3>
      <ul className="import-preview-stats">
        {preview.porMaquina.map((m) => (
          <li key={m.machineId}>
            {m.machineName}: {m.eventos} evento(s), {formatDecimal(m.horas)} h
          </li>
        ))}
      </ul>
    </div>
  );
}
