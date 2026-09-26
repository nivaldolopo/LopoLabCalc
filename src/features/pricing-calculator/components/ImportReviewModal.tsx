"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Plus, X } from "lucide-react";
import { errorMessage, guardOnline } from "@/lib/errors";
import { formatCurrency, formatDecimal } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import {
  newProductionId,
  saveProductionReview,
} from "@/lib/firebase/productionRepository";
import { uploadPrintImages } from "@/lib/firebase/printImagesRepository";
import { normalizeStages } from "../lib/calculatePricing";
import { aliasDocId } from "../lib/printAliases";
import {
  costSubmissions,
  printLineKey,
  printLineLabel,
  productStageKeys,
  stackFinished,
  type ImportContext,
  type ImportDiscard,
  type ImportPrint,
  type RejectedPrint,
} from "../lib/productionImport";
import {
  aliasesToLearn,
  brandPairs,
  effectiveRow,
  fillBrandTable,
  manualTwin,
  pairKey,
  pickFor,
  productDraftFromPrint,
  productDraftStorageKey,
  resolveGroups,
  reviewSubmissions,
  AVULSO_OUTCOMES,
  PRODUCT_OUTCOMES,
  type BrandPair,
  type BrandTable,
  type EffectiveRow,
  type ReviewOutcome,
  type ReviewRow,
} from "../lib/productionReview";
import { eventImages, imageTasks } from "../lib/printImages";
import { brandCandidates, filamentLabel } from "../lib/stock";
import type {
  FinishedGood,
  Machine,
  PricingResult,
  ProductionEvent,
  SavedPrintAlias,
  SavedProduct,
  StockFilament,
  Supply,
} from "../types";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";

// S7 (lote 5c da 3a) — a REVISÃO do modo `real`: o arquivo v1 sem `curadoria`
// (fase B). Cada impressão é um cartão com o que o dono decide; em cima, a
// tabela de marcas. Toda regra é PURA (`lib/productionReview.ts`); daqui só
// sai estado de tela, Storage e a gravação — UMA transação (a baixa é
// encadeada entre as impressões e só é verdade se entrar inteira).

const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  estoque: "Peça pronta (estoque)",
  falha: "Falha",
  teste: "Teste / calibração",
  brinde: "Brinde",
};

const STATUS_LABEL: Record<ImportPrint["status"], string> = {
  concluida: "concluída",
  cancelada: "cancelada",
  falha: "falhou",
};

const MOTIVO_LABEL: Record<string, string> = {
  "etapa-removida": "a etapa do apelido foi removida",
  "outra-mesa": "mesma origem, outra mesa",
  codigo: "código no título",
  "outra-variante": "mesmo design, outra instância",
  "link-modelo": "Link Modelo do produto",
  "nome-parecido": "nome de arquivo parecido",
};

type ImportReviewModalProps = {
  prints: ImportPrint[];
  fonte: string;
  manual: ProductionEvent[];
  descartadas: ImportDiscard[];
  jaImportadas: number;
  duplicadasNoArquivo: number;
  imagens: Map<string, File>;
  defaultPricePerKg: number;
  machines: Machine[];
  products: SavedProduct[];
  aliases: SavedPrintAlias[];
  stock: StockFilament[];
  supplies: Supply[];
  energyTariff: number;
  goods: FinishedGood[];
  pricingByProduct: Map<string, PricingResult>;
  initialRows: ReviewRow[];
  onBack: () => void;
  onClose: () => void;
  onImported: (count: number) => void;
};

type Saving =
  | { kind: "idle" }
  | { kind: "imagens"; total: number; feitas: number }
  | { kind: "gravando" }
  | { kind: "erro"; mensagem: string };

const productName = (p: SavedProduct) => p.name || p.mainStageName || "(sem nome)";

// "Pote — Tampa" (só quando o produto tem mais de uma etapa).
function stageOptions(product: SavedProduct): { key: string; label: string }[] {
  const keys = productStageKeys(product);
  const stages = normalizeStages(product);
  if (keys.length === 1) return [{ key: keys[0], label: productName(product) }];
  return keys.map((key, i) => ({
    key,
    label: `${productName(product)} — ${
      i === 0 ? product.mainStageName?.trim() || "Principal" : stages[i - 1]?.name?.trim() || `Etapa ${i + 1}`
    }`,
  }));
}

const hora = (at: number) =>
  new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ImportReviewModal(props: ImportReviewModalProps) {
  const {
    prints,
    fonte,
    manual,
    imagens,
    defaultPricePerKg,
    machines,
    products,
    aliases,
    stock,
    supplies,
    energyTariff,
    goods,
    pricingByProduct,
  } = props;
  const [rows, setRows] = useState<ReviewRow[]>(props.initialRows);
  // A tabela guarda só o que o dono MEXEU; o resto é o palpite, recalculado
  // (par novo aparece quando se marca uma linha).
  const [table, setTable] = useState<BrandTable>({});
  const [saving, setSaving] = useState<Saving>({ kind: "idle" });

  const ctx: ImportContext = useMemo(
    () => ({
      machines,
      products,
      aliases,
      stock,
      supplies,
      energyTariff,
      defaultPricePerKg,
      subitemPrices: (productId) => pricingByProduct.get(productId)?.subitems ?? [],
    }),
    [machines, products, aliases, stock, supplies, energyTariff, defaultPricePerKg, pricingByProduct],
  );

  const printById = useMemo(() => new Map(prints.map((p) => [p.taskId, p])), [prints]);
  const effs = useMemo(
    () => rows.map((row) => effectiveRow(row, printById.get(row.taskId)!, ctx)),
    [rows, printById, ctx],
  );
  const pairs = useMemo(() => brandPairs(effs, stock), [effs, stock]);
  const tableEff = useMemo(() => fillBrandTable(pairs, table, effs), [pairs, table, effs]);

  const grupos = useMemo(() => resolveGroups(effs), [effs]);
  const { submissions, rejected } = useMemo(
    () => reviewSubmissions(effs, tableEff, ctx),
    [effs, tableEff, ctx],
  );
  const rejeicaoPorTask = useMemo(
    () => new Map<string, RejectedPrint>(rejected.map((r) => [r.taskId, r])),
    [rejected],
  );
  const previa = useMemo(() => {
    let n = 0;
    // `createdAt` da prévia não aparece em lugar nenhum — 0 mantém o cálculo puro.
    return costSubmissions(submissions, ctx, fonte, () => `previa-${++n}`, 0, () => null);
  }, [submissions, ctx, fonte]);

  const incluidas = effs.filter((e) => e.row.incluir);
  const pendentes = incluidas.filter((e) => e.erro || rejeicaoPorTask.has(e.print.taskId));
  const totais = useMemo(() => {
    let custo = 0;
    let gramasBaixadas = 0;
    let gramasSemRolo = 0;
    let creditadas = 0;
    for (const c of previa.costed) {
      custo += c.planned.summary.frozen;
      creditadas += c.finishedEntries ? c.sub.unidadesCreditadas : 0;
      for (const e of c.planned.built) {
        for (const f of e.filaments) {
          if (f.filamentId) gramasBaixadas += f.totalG;
          else gramasSemRolo += f.totalG;
        }
      }
    }
    const dividas = previa.costed.flatMap((c) => c.planned.summary.debtLots);
    return { custo, gramasBaixadas, gramasSemRolo, creditadas, dividas };
  }, [previa]);

  function patchRow(taskId: string, patch: Partial<ReviewRow>) {
    setRows((atual) => atual.map((r) => (r.taskId === taskId ? { ...r, ...patch } : r)));
  }

  function setSegments(key: string, segs: BrandTable[string]) {
    setTable((atual) => ({ ...atual, [key]: segs }));
  }

  function criarProduto(e: EffectiveRow) {
    const draft = productDraftFromPrint(e.print, e.machine?.id ?? null, stock, defaultPricePerKg);
    try {
      // Apelido que JÁ tem dono sai do rascunho (senão a criação do produto
      // seria recusada inteira por "apelido em uso").
      const donos = new Set(aliases.map((a) => a.id));
      const livre = { ...draft, aliases: draft.aliases.filter((a) => !donos.has(aliasDocId(a))) };
      window.localStorage.setItem(productDraftStorageKey(draft.taskId), JSON.stringify(livre));
    } catch {
      setSaving({
        kind: "erro",
        mensagem: "O navegador não deixou guardar o rascunho (armazenamento bloqueado). Cadastre pelo /catalogo.",
      });
      return;
    }
    window.open(`/?daImpressao=${encodeURIComponent(e.print.taskId)}`, "_blank", "noopener");
  }

  async function confirmar() {
    try {
      guardOnline();
      const tarefas = imageTasks(
        submissions.flatMap((sub) => sub.prints.map((r) => r.print)),
        imagens,
      );
      setSaving({ kind: "imagens", total: tarefas.length, feitas: 0 });
      const existe = await uploadPrintImages(tarefas, (feitas, total) =>
        setSaving({ kind: "imagens", total, feitas }),
      );

      setSaving({ kind: "gravando" });
      const final = costSubmissions(submissions, ctx, fonte, newProductionId, Date.now(), (p) =>
        eventImages(p.taskId, {
          capa: existe.has(`${p.taskId}:capa`),
          foto: existe.has(`${p.taskId}:foto`),
        }),
      );
      const events = final.costed.flatMap((c) => c.events);
      const finished = stackFinished(final.costed, goods).map((f) => ({
        productId: f.productId,
        payload: f.payload,
      }));
      const gravadas = new Set(submissions.flatMap((s) => s.prints.map((r) => r.print.taskId)));
      const aprender = aliasesToLearn(
        effs.filter((e) => gravadas.has(e.print.taskId)),
        aliases,
      );
      await saveProductionReview(events, final.colorUpdates, final.supplyUpdates, finished, aprender);
      props.onImported(events.length);
      props.onClose();
    } catch (err) {
      // Uma transação só: se falhou, nada entrou (as imagens que subiram ficam,
      // e repetir é seguro — mesmo caminho, sobrescreve).
      setSaving({ kind: "erro", mensagem: `${errorMessage(err)} — nada foi gravado.` });
    }
  }

  const ocupado = saving.kind === "imagens" || saving.kind === "gravando";
  const aGravar = submissions.reduce((s, sub) => s + sub.prints.length, 0);
  const podeGravar = !ocupado && aGravar > 0 && pendentes.length === 0;

  return (
    <Modal
      title="Revisar impressões"
      sub="Impressões do dia a dia (sem curadoria): confira o que cada uma foi. Grava com baixa de rolo — o mesmo caminho do registro manual."
      className="import-review-modal"
      onClose={props.onClose}
      footer={
        <>
          <button className="btn primary" type="button" disabled={!podeGravar} onClick={confirmar}>
            {saving.kind === "gravando"
              ? "Gravando…"
              : saving.kind === "imagens"
                ? `Enviando imagens ${saving.feitas}/${saving.total}…`
                : `Registrar ${aGravar} ${aGravar === 1 ? "impressão" : "impressões"}`}
          </button>
          <button className="btn btn-secondary" type="button" disabled={ocupado} onClick={props.onBack}>
            Voltar
          </button>
        </>
      }
    >
      <div className="review">
        <ul className="import-preview-stats">
          <li>
            <strong>{prints.length}</strong> impressão(ões) a revisar · {incluidas.length} marcada(s)
          </li>
          {props.jaImportadas > 0 ? (
            <li>{props.jaImportadas} já importada(s) antes — fora da revisão</li>
          ) : null}
          {props.duplicadasNoArquivo > 0 ? (
            <li className="import-preview-warn">
              ⚠ {props.duplicadasNoArquivo} repetida(s) dentro do arquivo — só a 1ª entra
            </li>
          ) : null}
          {props.descartadas.length > 0 ? (
            <li className="import-preview-warn">
              ⚠ {props.descartadas.length} ilegível(is) no arquivo:{" "}
              {props.descartadas
                .slice(0, 3)
                .map((d) => `${d.taskId ?? "?"} (${d.motivo})`)
                .join("; ")}
              {props.descartadas.length > 3 ? `; e mais ${props.descartadas.length - 3}` : ""}
            </li>
          ) : null}
        </ul>

        {pairs.length > 0 ? (
          <BrandTableView pairs={pairs} table={tableEff} onChange={setSegments} />
        ) : null}

        <h3 className="section-label">Impressões</h3>
        <div className="review-list">
          {effs.map((e) => (
            <ReviewCard
              key={e.print.taskId}
              e={e}
              effs={effs}
              grupo={grupos.get(e.print.taskId) ?? null}
              products={products}
              stock={stock}
              table={tableEff}
              twin={manualTwin(e.print, e.machine?.id ?? null, e.product?.id ?? null, manual)}
              rejeicao={rejeicaoPorTask.get(e.print.taskId) ?? null}
              onPatch={(patch) => patchRow(e.print.taskId, patch)}
              onCreateProduct={() => criarProduto(e)}
            />
          ))}
        </div>

        <h3 className="section-label">Resumo</h3>
        <ul className="import-preview-stats">
          <li>
            {aGravar} impressão(ões) em {submissions.length}{" "}
            {submissions.length === 1 ? "registro" : "registros"} · custo congelado{" "}
            {formatCurrency(totais.custo)}
          </li>
          <li>
            {formatDecimal(totais.gramasBaixadas)} g com baixa de rolo
            {totais.gramasSemRolo > 0 ? ` · ${formatDecimal(totais.gramasSemRolo)} g sem marca (só custo, sem baixa)` : ""}
          </li>
          <li>{totais.creditadas} peça(s) pronta(s) creditada(s)</li>
          {totais.dividas.length > 0 ? (
            <li className="import-preview-warn">
              ⚠ {totais.dividas.length} cor(es)/insumo(s) sem saldo suficiente — a diferença entra
              como lote de acerto (confira o rolo no /estoque)
            </li>
          ) : null}
          {pendentes.length > 0 ? (
            <li className="import-preview-warn">
              ⚠ {pendentes.length} impressão(ões) marcada(s) com pendência — resolva ou desmarque
              para registrar
            </li>
          ) : null}
        </ul>

        {saving.kind === "erro" ? <div className="form-error">{saving.mensagem}</div> : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// A tabela máquina × cor → marca
// ---------------------------------------------------------------------------

function BrandTableView({
  pairs,
  table,
  onChange,
}: {
  pairs: BrandPair[];
  table: BrandTable;
  onChange: (key: string, segs: BrandTable[string]) => void;
}) {
  return (
    <>
      <h3 className="section-label">Marca por máquina e cor</h3>
      <p className="field-hint">
        De qual rolo sai cada cor, em cada máquina. Trocou de marca no meio do período? Use “a
        partir de”. Sem marca, a cor entra só no custo, sem baixa.
      </p>
      <div className="review-brands">
        {pairs.map((par) => {
          const segs = [...(table[par.key] ?? [])].sort(
            (a, b) => (a.desde ?? -Infinity) - (b.desde ?? -Infinity),
          );
          const base = segs.find((s) => s.desde === null) ?? { desde: null, filamentId: null };
          const trocas = segs.filter((s) => s.desde !== null);
          const setSeg = (i: number, patch: Partial<(typeof segs)[number]>) =>
            onChange(
              par.key,
              [base, ...trocas].map((s, j) => (j === i ? { ...s, ...patch } : s)),
            );
          const usadas = new Set(trocas.map((t) => t.desde));
          const livre = par.prints.slice(1).find((p) => !usadas.has(p.at));
          return (
            <div className="review-brand" key={par.key}>
              <div className="review-brand-head">
                <span className="review-brand-name">
                  {par.machineName} · {par.label}
                </span>
                <span className="field-hint">
                  {par.prints.length} impressão(ões)
                  {!par.traduzida ? " — escolher a marca traduz a cor" : ""}
                </span>
              </div>
              <BrandSelect
                label={`Marca de ${par.label} na ${par.machineName}`}
                candidates={par.candidates}
                value={base.filamentId}
                onChange={(id) => setSeg(0, { filamentId: id })}
              />
              {trocas.map((t, i) => (
                <div className="review-brand-switch" key={`${t.desde}-${i}`}>
                  <label className="field-hint" htmlFor={`troca-${par.key}-${i}`}>
                    a partir de
                  </label>
                  <select
                    id={`troca-${par.key}-${i}`}
                    className="field-input"
                    value={String(t.desde)}
                    onChange={(ev) => setSeg(i + 1, { desde: Number(ev.target.value) })}
                  >
                    {par.prints.map((p) => (
                      <option key={p.taskId} value={String(p.at)}>
                        {formatDate(p.at)} {hora(p.at)} · {p.titulo || p.taskId}
                      </option>
                    ))}
                  </select>
                  <BrandSelect
                    label={`Marca de ${par.label} a partir da troca`}
                    candidates={par.candidates}
                    value={t.filamentId}
                    onChange={(id) => setSeg(i + 1, { filamentId: id })}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remover a troca de marca de ${par.label} na ${par.machineName}`}
                    title="Remover a troca"
                    onClick={() =>
                      onChange(
                        par.key,
                        [base, ...trocas.filter((_, j) => j !== i)],
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {livre ? (
                <button
                  className="link-button"
                  type="button"
                  onClick={() =>
                    onChange(par.key, [
                      base,
                      ...trocas,
                      { desde: livre.at, filamentId: base.filamentId },
                    ])
                  }
                >
                  <Plus size={14} /> a partir de uma impressão, outra marca
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function BrandSelect({
  label,
  candidates,
  value,
  onChange,
}: {
  label: string;
  candidates: StockFilament[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      className="field-input"
      aria-label={label}
      value={value ?? ""}
      onChange={(ev) => onChange(ev.target.value || null)}
    >
      <option value="">— sem marca (sem baixa) —</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {filamentLabel(c)}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Um cartão = uma impressão
// ---------------------------------------------------------------------------

function ReviewCard({
  e,
  effs,
  grupo,
  products,
  stock,
  table,
  twin,
  rejeicao,
  onPatch,
  onCreateProduct,
}: {
  e: EffectiveRow;
  effs: EffectiveRow[];
  grupo: string | null;
  products: SavedProduct[];
  stock: StockFilament[];
  table: BrandTable;
  twin: ProductionEvent | null;
  rejeicao: RejectedPrint | null;
  onPatch: (patch: Partial<ReviewRow>) => void;
  onCreateProduct: () => void;
}) {
  const { print, row } = e;
  const id = `rev-${print.taskId}`;
  const titulo = print.facts.titulo || "(sem título)";
  const sugeridos = new Set(e.lookup.sugestoes.map((s) => s.productId));
  const ordenados = [...products].sort((a, b) => productName(a).localeCompare(productName(b), "pt-BR"));
  const choiceValue =
    row.choice.kind === "avulso"
      ? "avulso"
      : row.choice.kind === "produto"
        ? `p:${row.choice.productId}:${row.choice.stageKey}`
        : "auto";
  const exataLabel =
    e.lookup.exata && e.product
      ? stageOptions(e.product).find((o) => o.key === e.lookup.exata!.stageKey)?.label
      : null;
  const outcomes = e.product ? PRODUCT_OUTCOMES : AVULSO_OUTCOMES;
  const multiEtapa = e.product ? productStageKeys(e.product).length > 1 : false;
  const companheiras = effs.filter(
    (o) =>
      o.print.taskId !== print.taskId &&
      o.row.incluir &&
      o.product &&
      o.product.id === e.product?.id,
  );
  const juntoCom = grupo && grupo !== print.taskId ? effs.find((o) => o.print.taskId === grupo) : null;

  // As linhas de cor, como vão pro evento (depois do fator).
  const linhas = new Map<string, { label: string; g: number }>();
  print.facts.filamentos.forEach((f, i) => {
    const g = f.g * e.fator;
    if (g <= 0) return;
    const site = print.coresSite[i];
    const key = printLineKey(f, site);
    const atual = linhas.get(key);
    const label = printLineLabel(f, site);
    if (atual) atual.g += g;
    else linhas.set(key, { label, g });
  });

  const problema = e.erro ?? rejeicao?.detail ?? null;

  return (
    <div className={`review-card${row.incluir ? "" : " is-off"}`}>
      <div className="review-card-head">
        <label className="review-check">
          <input
            type="checkbox"
            checked={row.incluir}
            onChange={(ev) => onPatch({ incluir: ev.target.checked })}
          />
          <span className="review-title">{titulo}</span>
        </label>
        <span className="field-hint">
          {formatDate(print.at)} {hora(print.at)} · {print.facts.maquina}
          {e.machineFuzzy ? " (≈)" : ""} · {STATUS_LABEL[print.status]}
          {print.status !== "concluida" ? " · ≈ estimado" : ""}
        </span>
      </div>

      {twin ? (
        <p className="review-note">
          Parece já registrada à mão: “{twin.productName}” em {formatDate(twin.at)} na mesma
          máquina{row.incluir ? " — marcada mesmo assim" : " — desmarcada"}.
        </p>
      ) : null}

      {row.incluir ? (
        <>
          <div className="review-grid">
            <div className="field-block">
              <label className="section-label" htmlFor={`${id}-prod`}>
                Produto e etapa
              </label>
              <select
                id={`${id}-prod`}
                className="field-input"
                value={choiceValue}
                onChange={(ev) => {
                  const v = ev.target.value;
                  if (v === "auto") onPatch({ choice: { kind: "auto" }, outcome: null });
                  else if (v === "avulso") onPatch({ choice: { kind: "avulso" }, outcome: null });
                  else {
                    const [, productId, ...rest] = v.split(":");
                    onPatch({
                      choice: { kind: "produto", productId, stageKey: rest.join(":") },
                      outcome: null,
                    });
                  }
                }}
              >
                <option value="auto">
                  {exataLabel ? `${exataLabel} (pelo apelido)` : "— escolha —"}
                </option>
                {e.lookup.sugestoes.length > 0 ? (
                  <optgroup label="Sugestões">
                    {e.lookup.sugestoes.flatMap((s) => {
                      const p = products.find((x) => x.id === s.productId);
                      if (!p) return [];
                      return stageOptions(p).map((o) => (
                        <option key={`s-${p.id}-${o.key}`} value={`p:${p.id}:${o.key}`}>
                          {o.label} — {MOTIVO_LABEL[s.motivo] ?? s.motivo}
                        </option>
                      ));
                    })}
                  </optgroup>
                ) : null}
                <optgroup label="Catálogo">
                  {ordenados
                    .filter((p) => !sugeridos.has(p.id))
                    .flatMap((p) =>
                      stageOptions(p).map((o) => (
                        <option key={`${p.id}-${o.key}`} value={`p:${p.id}:${o.key}`}>
                          {o.label}
                        </option>
                      )),
                    )}
                </optgroup>
                <option value="avulso">Avulso (fora do catálogo)</option>
              </select>
              {!e.lookup.exata ? (
                <button className="link-button" type="button" onClick={onCreateProduct}>
                  <PackagePlus size={14} /> Criar produto a partir desta impressão
                </button>
              ) : null}
            </div>

            <div className="field-block">
              <label className="section-label" htmlFor={`${id}-out`}>
                Desfecho
              </label>
              <select
                id={`${id}-out`}
                className="field-input"
                value={e.outcome}
                onChange={(ev) => onPatch({ outcome: ev.target.value as ReviewOutcome })}
              >
                {outcomes.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-block">
              <label className="section-label" htmlFor={`${id}-prod-un`}>
                Unidades feitas
              </label>
              <NumberInput
                id={`${id}-prod-un`}
                className="field-input"
                min={1}
                value={e.produzidas}
                onChange={(v) => onPatch({ produzidas: v })}
              />
              <span className="field-hint">{e.objetos} objeto(s) na mesa</span>
            </div>

            {e.outcome === "estoque" ? (
              <div className="field-block">
                <label className="section-label" htmlFor={`${id}-cred`}>
                  Vão pra prateleira
                </label>
                <NumberInput
                  id={`${id}-cred`}
                  className="field-input"
                  min={0}
                  max={e.produzidas}
                  value={e.creditadas}
                  onChange={(v) => onPatch({ creditadas: v })}
                />
              </div>
            ) : null}

            {print.status !== "concluida" ? (
              <div className="field-block">
                <label className="section-label" htmlFor={`${id}-fator`}>
                  Consumo (% do plano)
                </label>
                <NumberInput
                  id={`${id}-fator`}
                  className="field-input"
                  min={0}
                  max={100}
                  value={Math.round(e.fator * 1000) / 10}
                  step={0.1}
                  onChange={(v) => onPatch({ fator: Math.min(100, Math.max(0, v)) / 100 })}
                />
                <span className="field-hint">
                  ≈ relógio ÷ plano. Plano: {formatDecimal((print.facts.pesoTotalG ?? 0))} g,{" "}
                  {formatDecimal((print.facts.duracaoPlanoS ?? 0) / 3600)} h
                </span>
              </div>
            ) : null}

            {multiEtapa && e.outcome === "estoque" ? (
              <div className="field-block">
                <label className="section-label" htmlFor={`${id}-grupo`}>
                  Submissão
                </label>
                <select
                  id={`${id}-grupo`}
                  className="field-input"
                  value={
                    row.grupo.kind === "com" ? `com:${row.grupo.taskId}` : row.grupo.kind
                  }
                  onChange={(ev) => {
                    const v = ev.target.value;
                    onPatch({
                      grupo:
                        v === "auto" || v === "sozinha"
                          ? { kind: v }
                          : { kind: "com", taskId: v.slice("com:".length) },
                    });
                  }}
                >
                  <option value="auto">
                    Automático
                    {juntoCom ? ` (junto com ${juntoCom.print.facts.titulo || juntoCom.print.taskId})` : ""}
                  </option>
                  <option value="sozinha">Sozinha</option>
                  {companheiras.map((o) => (
                    <option key={o.print.taskId} value={`com:${o.print.taskId}`}>
                      Junto com {o.print.facts.titulo || o.print.taskId} ({formatDate(o.print.at)}{" "}
                      {hora(o.print.at)})
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  As mesas de um produto vendido inteiro se juntam para creditar.
                </span>
              </div>
            ) : null}
          </div>

          {linhas.size > 0 && e.machine ? (
            <ul className="review-fils">
              {[...linhas].map(([key, l]) => {
                const base = pickFor(table, pairKey(e.machine!.id, key), print.at);
                const baseColor = base ? stock.find((c) => c.id === base) : undefined;
                const div = row.dividir[key];
                // A outra marca da MESMA cor + material (o AMS trocou sozinho).
                const candidatas = baseColor
                  ? brandCandidates(stock, baseColor.colorName, baseColor.material).filter(
                      (c) => c.id !== base,
                    )
                  : [];
                return (
                  <li key={key} className="review-fil">
                    <span>
                      {l.label}: <strong>{formatDecimal(l.g)} g</strong> ·{" "}
                      {baseColor ? filamentLabel(baseColor) : "sem marca (só custo)"}
                    </span>
                    {candidatas.length > 0 ? (
                      div ? (
                        <span className="review-split">
                          <NumberInput
                            className="field-input"
                            aria-label={`Gramas de ${l.label} da outra marca`}
                            min={0}
                            max={l.g}
                            value={div.g}
                            onChange={(v) =>
                              onPatch({ dividir: { ...row.dividir, [key]: { ...div, g: v } } })
                            }
                          />
                          <span className="field-hint">g de</span>
                          <select
                            className="field-input"
                            aria-label={`Outra marca de ${l.label}`}
                            value={div.filamentId}
                            onChange={(ev) =>
                              onPatch({
                                dividir: { ...row.dividir, [key]: { ...div, filamentId: ev.target.value } },
                              })
                            }
                          >
                            {candidatas.map((c) => (
                              <option key={c.id} value={c.id}>
                                {filamentLabel(c)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Desfazer a divisão de ${l.label}`}
                            title="Desfazer a divisão"
                            onClick={() => {
                              const resto = { ...row.dividir };
                              delete resto[key];
                              onPatch({ dividir: resto });
                            }}
                          >
                            <X size={15} />
                          </button>
                        </span>
                      ) : (
                        <button
                          className="link-button"
                          type="button"
                          onClick={() =>
                            onPatch({
                              dividir: {
                                ...row.dividir,
                                [key]: { filamentId: candidatas[0].id, g: Math.round(l.g / 2) },
                              },
                            })
                          }
                        >
                          dividir entre marcas
                        </button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {problema ? <p className="review-problem">⚠ {problema}</p> : null}
        </>
      ) : null}
    </div>
  );
}
