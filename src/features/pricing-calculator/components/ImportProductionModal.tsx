"use client";

import { useRef, useState } from "react";
import { ImageUp, Upload } from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import {
  fetchImportedExternalIds,
  fetchProductionInPeriod,
  newProductionId,
  saveProduction,
} from "@/lib/firebase/productionRepository";
import { uploadPrintImages } from "@/lib/firebase/printImagesRepository";
import {
  buildImportPreview,
  costSubmission,
  dedupeByTaskId,
  importBatches,
  parseImportFile,
  resolveSubmissions,
  type ImportContext,
  type ImportDiscard,
  type ImportPreview,
  type ImportPrint,
  type RejectReason,
  type ResolvedSubmission,
} from "../lib/productionImport";
import { eventImages, imageTasks, type PrintImageKind } from "../lib/printImages";
import { initialRows, type ReviewRow } from "../lib/productionReview";
import { usePrintAliases } from "../hooks/usePrintAliases";
import type {
  FinishedGood,
  Machine,
  PricingResult,
  ProductionEvent,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";
import { ImportReviewModal } from "./ImportReviewModal";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";

// S6 (lote 5b da 3a) — "Importar impressões" na /producao: o arquivo de
// produção do pipeline (formato v1, `lib/productionImport.ts`) + as imagens ao
// lado dele viram eventos. Prévia OBRIGATÓRIA (é lote). Toda a resolução/custo
// é PURA; este componente só orquestra arquivo → prévia → Storage → Firestore.
//
// Ordem na gravação: as IMAGENS sobem primeiro — o evento nunca aponta pra uma
// capa que não existe. Se alguma falhar, nada é gravado (as que subiram ficam,
// e repetir é seguro: mesmo caminho, sobrescreve). Só vale a imagem ESCOLHIDA
// agora: consultar o Storage por cada citada custaria centenas de 404 na fase A
// sem pasta — quem reimporta escolhe a pasta de novo.

type ImportProductionModalProps = {
  machines: Machine[];
  products: SavedProduct[];
  stock: StockFilament[];
  supplies: Supply[];
  energyTariff: number;
  goods: FinishedGood[];
  pricingByProduct: Map<string, PricingResult>;
  onClose: () => void;
  onImported: (count: number) => void;
};

type Step =
  | { kind: "input" }
  | { kind: "analisando" }
  | {
      kind: "preview";
      preview: ImportPreview;
      submissions: ResolvedSubmission[];
      fonte: string;
      defaultPricePerKg: number;
    }
  // 5c — arquivo SEM curadoria (fase B): a revisão linha a linha, modo `real`.
  | {
      kind: "review";
      prints: ImportPrint[];
      fonte: string;
      manual: ProductionEvent[];
      rows: ReviewRow[];
      descartadas: ImportDiscard[];
      jaImportadas: number;
      duplicadasNoArquivo: number;
      defaultPricePerKg: number;
    }
  | { kind: "imagens"; total: number; feitas: number }
  | { kind: "gravando"; total: number; feitos: number }
  | { kind: "erro"; mensagem: string };

const REASON_LABEL: Record<RejectReason, string> = {
  "sem-curadoria": "sem curadoria (dia a dia — vai pela revisão)",
  "maquina-nao-reconhecida": "máquina não reconhecida",
  "apelido-desconhecido": "apelido fora do catálogo",
  "submissao-incoerente": "submissão incoerente",
  "submissao-parcial": "submissão já importada em parte",
  "etapa-repetida": "etapa repetida na submissão",
  "estoque-sem-produto": '"estoque" sem produto',
  "estoque-nao-forma-produto": '"estoque" que não forma o produto nem uma parte',
  "cor-sem-traducao": '"estoque" com cor sem tradução pro site',
};

export function ImportProductionModal({
  machines,
  products,
  stock,
  supplies,
  energyTariff,
  goods,
  pricingByProduct,
  onClose,
  onImported,
}: ImportProductionModalProps) {
  // Os apelidos chegam por snapshot: analisar ANTES dele rejeitaria todo
  // produto como "apelido fora do catálogo" — o botão espera.
  const { aliases, status: aliasesStatus } = usePrintAliases();
  const aliasesProntos = aliasesStatus !== "connecting";
  const [raw, setRaw] = useState("");
  // Pelo NOME do arquivo — o que o JSON cita em `imagens.capa`/`foto`.
  const [imagens, setImagens] = useState<Map<string, File>>(new Map());
  const [defaultPricePerKg, setDefaultPricePerKg] = useState(110);
  const [step, setStep] = useState<Step>({ kind: "input" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => setRaw(String(event.target?.result ?? ""));
    reader.readAsText(file, "UTF-8");
  }

  function escolherImagens(files: FileList) {
    setImagens(new Map(Array.from(files).map((file) => [file.name, file])));
  }

  // A imagem escolhida que o arquivo CITA para esta impressão (nunca por
  // convenção de nome: o que o JSON diz é o que vale).
  function imagemDe(print: ImportPrint, kind: PrintImageKind): File | undefined {
    const nome = print.imagens[kind];
    return nome ? imagens.get(nome) : undefined;
  }

  function contexto(preco: number): ImportContext {
    return {
      machines,
      products,
      aliases,
      stock,
      supplies,
      energyTariff,
      defaultPricePerKg: preco,
      subitemPrices: (productId) => pricingByProduct.get(productId)?.subitems ?? [],
    };
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
    const parsed = parseImportFile(json);
    if (!parsed.ok) {
      setStep({ kind: "erro", mensagem: parsed.erro });
      return;
    }
    try {
      guardOnline();
      // Idempotência de FORA (já no Firestore), por `origemExterna` (S4).
      const jaImportados = await fetchImportedExternalIds(parsed.file.fonte);
      // E a de DENTRO do arquivo.
      const { unicas, duplicadasNoArquivo } = dedupeByTaskId(parsed.file.impressoes);
      const ctx = contexto(defaultPricePerKg);

      // Um arquivo é de UMA fase: com curadoria (A, `historico`) ou sem (B,
      // revisão no modo `real`). Misturar seria gravar metade sem rolo e metade
      // com — o pipeline exporta as duas separadas.
      const semCuradoria = unicas.filter((p) => !p.curadoria).length;
      if (semCuradoria > 0 && semCuradoria < unicas.length) {
        setStep({
          kind: "erro",
          mensagem:
            `O arquivo mistura ${unicas.length - semCuradoria} impressão(ões) com curadoria (carga, fase A) ` +
            `e ${semCuradoria} sem (dia a dia, fase B). Exporte as duas separadas.`,
        });
        return;
      }
      if (unicas.length > 0 && semCuradoria === unicas.length) {
        const novas = unicas.filter((p) => !jaImportados.has(p.taskId));
        const ats = novas.map((p) => p.at);
        const DIA = 24 * 3600 * 1000;
        // "Já registrado?" compara com o que foi lançado à mão no mesmo dia.
        const manual =
          novas.length > 0
            ? await fetchProductionInPeriod(Math.min(...ats) - DIA, Math.max(...ats) + DIA)
            : [];
        setStep({
          kind: "review",
          prints: [...novas].sort((a, b) => a.at - b.at),
          fonte: parsed.file.fonte,
          manual,
          rows: initialRows([...novas].sort((a, b) => a.at - b.at), ctx, manual),
          descartadas: parsed.descartadas,
          jaImportadas: unicas.length - novas.length,
          duplicadasNoArquivo,
          defaultPricePerKg,
        });
        return;
      }
      const { submissions, rejected } = resolveSubmissions(unicas, ctx, jaImportados);
      const now = Date.now();
      // Custo pra prévia (ids provisórios; a gravação recalcula com os finais e
      // com as imagens que de fato existirem).
      let n = 0;
      const costed = submissions.map((sub) =>
        costSubmission(sub, ctx, parsed.file.fonte, () => `previa-${++n}`, now, () => null),
      );
      const escolhidas = new Set<string>();
      for (const p of unicas) {
        for (const kind of ["capa", "foto"] as PrintImageKind[]) {
          if (imagemDe(p, kind)) escolhidas.add(`${p.taskId}:${kind}`);
        }
      }
      const preview = buildImportPreview({
        totalArquivo: parsed.file.impressoes.length + parsed.descartadas.length,
        descartadas: parsed.descartadas,
        jaImportadas: unicas.filter((p) => jaImportados.has(p.taskId)).length,
        duplicadasNoArquivo,
        rejeitadas: rejected,
        costed,
        imagensEscolhidas: escolhidas,
      });
      setStep({
        kind: "preview",
        preview,
        submissions,
        fonte: parsed.file.fonte,
        defaultPricePerKg,
      });
    } catch (err) {
      setStep({ kind: "erro", mensagem: errorMessage(err) });
    }
  }

  async function confirmar(
    submissions: ResolvedSubmission[],
    fonte: string,
    preco: number,
  ) {
    let gravados = 0;
    try {
      guardOnline();

      // 1) Imagens: sobem as escolhidas que o arquivo cita.
      const tarefas = imageTasks(
        submissions.flatMap((sub) => sub.prints.map((r) => r.print)),
        imagens,
      );
      setStep({ kind: "imagens", total: tarefas.length, feitas: 0 });
      const existe = await uploadPrintImages(tarefas, (feitas, total) =>
        setStep({ kind: "imagens", total, feitas }),
      );

      // 2) Custo final, com ids reais e as imagens que existem.
      const ctx = contexto(preco);
      const now = Date.now();
      const costed = submissions.map((sub) =>
        costSubmission(sub, ctx, fonte, newProductionId, now, (p) =>
          eventImages(p.taskId, {
            capa: existe.has(`${p.taskId}:capa`),
            foto: existe.has(`${p.taskId}:foto`),
          }),
        ),
      );
      const batches = importBatches(costed, goods);
      const total = batches.reduce((s, b) => s + b.events.length, 0);
      setStep({ kind: "gravando", total, feitos: 0 });
      for (const batch of batches) {
        await saveProduction(batch.events, [], batch.finished);
        gravados += batch.events.length;
        setStep({ kind: "gravando", total, feitos: gravados });
      }
      onImported(total);
      onClose();
    } catch (err) {
      // Lotes são transações independentes: o que já entrou, entrou. Dizer
      // quanto evita o "nada foi salvo" mentir — e reimportar é seguro (o que
      // já foi gravado é reconhecido pelo `origemExterna` e pulado).
      setStep({
        kind: "erro",
        mensagem:
          gravados > 0
            ? `${errorMessage(err)} — ${gravados} impressão(ões) já tinham sido gravadas antes do erro. ` +
              "Importe o mesmo arquivo de novo: as gravadas são reconhecidas e puladas."
            : errorMessage(err),
      });
    }
  }

  const editando = step.kind === "input" || step.kind === "analisando";

  if (step.kind === "review") {
    return (
      <ImportReviewModal
        prints={step.prints}
        fonte={step.fonte}
        manual={step.manual}
        descartadas={step.descartadas}
        jaImportadas={step.jaImportadas}
        duplicadasNoArquivo={step.duplicadasNoArquivo}
        imagens={imagens}
        defaultPricePerKg={step.defaultPricePerKg}
        machines={machines}
        products={products}
        aliases={aliases}
        stock={stock}
        supplies={supplies}
        energyTariff={energyTariff}
        goods={goods}
        pricingByProduct={pricingByProduct}
        initialRows={step.rows}
        onBack={() => setStep({ kind: "input" })}
        onClose={onClose}
        onImported={onImported}
      />
    );
  }

  return (
    <Modal
      title="Importar impressões"
      sub="Arquivo de produção exportado pelo pipeline (com as imagens ao lado). Com curadoria (carga) entra como histórico; sem curadoria (dia a dia) abre a revisão linha a linha. Reimportar o mesmo arquivo não duplica."
      onClose={onClose}
      footer={
        editando ? (
          <>
            <button
              className="btn primary"
              type="button"
              disabled={!raw.trim() || step.kind === "analisando" || !aliasesProntos}
              onClick={analisar}
            >
              {step.kind === "analisando"
                ? "Analisando…"
                : aliasesProntos
                  ? "Analisar"
                  : "Carregando apelidos…"}
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
              onClick={() => confirmar(step.submissions, step.fonte, step.defaultPricePerKg)}
            >
              Importar {step.preview.aImportar}{" "}
              {step.preview.aImportar === 1 ? "impressão" : "impressões"}
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
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setStep({ kind: "input" })}
            >
              Voltar
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Fechar
            </button>
          </>
        ) : null
      }
    >
      {editando ? (
        <>
          <div className="field-block">
            <label className="section-label" htmlFor="import-json">
              Cole o JSON, ou escolha o arquivo
            </label>
            <textarea
              id="import-json"
              className="field-input"
              rows={6}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder='{"schema_version": 1, "fonte": "bambu", "impressoes": [...]}'
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
            <span className="section-label">Imagens (opcional)</span>
            <button
              className="link-button bordered"
              type="button"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageUp size={15} /> Escolher imagens…
            </button>
            <input
              ref={imageInputRef}
              accept="image/png,image/jpeg"
              hidden
              multiple
              type="file"
              onChange={(event) => {
                if (event.target.files) escolherImagens(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="field-hint">
              {imagens.size > 0
                ? `${imagens.size} arquivo(s) escolhido(s) — a prévia diz quantos o JSON cita`
                : "Selecione as imagens da pasta ao lado do JSON (Ctrl+A). Sem imagem, a importação funciona igual."}
            </div>
          </div>
          <div className="field-block">
            <label className="section-label" htmlFor="import-preco-padrao">
              R$/kg padrão pras cores sem preço no Estoque
            </label>
            <NumberInput
              id="import-preco-padrao"
              className="field-input"
              min={0}
              value={defaultPricePerKg}
              onChange={setDefaultPricePerKg}
            />
            <div className="field-hint">
              Vale para cor que não existe no Estoque (nenhuma marca daquela cor + material) —
              decisão de quem importa, não fato da impressora.
            </div>
          </div>
        </>
      ) : null}

      {step.kind === "preview" ? <PreviewView preview={step.preview} /> : null}

      {step.kind === "imagens" ? (
        <p>
          Enviando imagens: {step.feitas} de {step.total}…
        </p>
      ) : null}

      {step.kind === "gravando" ? (
        <p>
          Gravando {step.feitos} de {step.total}…
        </p>
      ) : null}

      {step.kind === "erro" ? <div className="form-error">{step.mensagem}</div> : null}
    </Modal>
  );
}

function PreviewView({ preview }: { preview: ImportPreview }) {
  const porMotivo = new Map<RejectReason, typeof preview.rejeitadas>();
  for (const r of preview.rejeitadas) {
    porMotivo.set(r.reason, [...(porMotivo.get(r.reason) ?? []), r]);
  }
  return (
    <div className="import-preview">
      <ul className="import-preview-stats">
        <li>
          <strong>{preview.totalArquivo}</strong> impressão(ões) no arquivo
        </li>
        <li>
          <strong>{preview.aImportar}</strong> a importar, em {preview.submissoes}{" "}
          {preview.submissoes === 1 ? "registro" : "registros"}
        </li>
        {preview.jaImportadas > 0 ? (
          <li>{preview.jaImportadas} já importada(s) antes — ignorada(s)</li>
        ) : null}
        {preview.duplicadasNoArquivo > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.duplicadasNoArquivo} repetida(s) dentro do próprio arquivo — só a 1ª entra
          </li>
        ) : null}
        {preview.maquinaAproximada > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.maquinaAproximada} com máquina casada por aproximação — confira
          </li>
        ) : null}
        {preview.corSemTraducao > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.corSemTraducao} filamento(s) sem a cor do site — entram com o hex como
            nome, fora de qualquer prateleira
          </li>
        ) : null}
        {preview.precoPadrao > 0 ? (
          <li className="import-preview-warn">
            ⚠ {preview.precoPadrao} cor(es) fora do Estoque — custo pelo R$/kg padrão
          </li>
        ) : null}
        {preview.estimadas > 0 ? (
          <li>
            ≈ {preview.estimadas} cancelada(s): gramas e horas estimadas (plano × fração do
            relógio)
          </li>
        ) : null}
        <li>
          {preview.comProduto} ligada(s) a produto · {preview.avulsas} avulsa(s)
        </li>
        {preview.periodo ? (
          <li>
            Período: {formatDate(preview.periodo.inicio)} até {formatDate(preview.periodo.fim)}
          </li>
        ) : null}
        {preview.imagens.citadas > 0 ? (
          <li>
            Imagens: {preview.imagens.escolhidas} de {preview.imagens.citadas} citadas foram
            escolhidas
            {preview.imagens.escolhidas < preview.imagens.citadas
              ? " (as outras ficam sem imagem)"
              : ""}
          </li>
        ) : null}
      </ul>

      <h3 className="section-label">Por destino</h3>
      <ul className="import-preview-stats">
        <li>{preview.porDestino.historico} histórico</li>
        <li>{preview.porDestino.falha} falha</li>
        <li>{preview.porDestino.teste} teste</li>
        <li>
          {preview.porDestino.estoque} estoque → {preview.unidadesCreditadas} peça(s) pronta(s)
          creditada(s)
        </li>
      </ul>

      <h3 className="section-label">Por máquina</h3>
      <ul className="import-preview-stats">
        {preview.porMaquina.map((m) => (
          <li key={m.machineId}>
            {m.machineName}: {m.impressoes} impressão(ões), {formatDecimal(m.horas)} h
          </li>
        ))}
      </ul>

      {preview.rejeitadas.length > 0 || preview.descartadas.length > 0 ? (
        <>
          <h3 className="section-label">Fora desta importação</h3>
          <ul className="import-preview-stats">
            {preview.descartadas.length > 0 ? (
              <li className="import-preview-warn">
                ⚠ {preview.descartadas.length} ilegível(is) no arquivo:{" "}
                {resumo(preview.descartadas.map((d) => `${d.taskId ?? "?"} (${d.motivo})`))}
              </li>
            ) : null}
            {[...porMotivo].map(([reason, lista]) => (
              <li key={reason} className="import-preview-warn">
                ⚠ {lista.length} — {REASON_LABEL[reason]}:{" "}
                {resumo(lista.map((r) => `${r.taskId} (${r.detail})`))}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// Os 3 primeiros por extenso — o suficiente pra achar o padrão no pipeline.
function resumo(itens: string[]): string {
  const mostra = itens.slice(0, 3).join("; ");
  return itens.length > 3 ? `${mostra}; e mais ${itens.length - 3}` : mostra;
}
