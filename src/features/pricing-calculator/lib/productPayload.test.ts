import { describe, expect, it } from "vitest";
import { buildLoadedProduct } from "../hooks/usePricingForm";
import { buildProductPayload } from "./productPayload";
import type { ProductPayload, SavedProduct } from "../types";

// O round-trip do FORMULÁRIO: abrir um produto salvo e salvar sem tocar em nada
// (`buildLoadedProduct` -> `buildProductPayload`). É o caminho que comeu o
// `supplyId` no FORM-01 — e o preço não denunciou, porque o `unitPrice`
// sobrevive. Por isso a prova aqui é DIFF CAMPO A CAMPO DO DOCUMENTO, nunca o
// preço.
//
// As duas funções são as REAIS, importadas: uma cópia do literal apodreceria em
// silêncio no dia em que o original ganhasse um campo — que é exatamente a
// falha que este teste existe para pegar.

// Cobaia: exercita TODO campo ao mesmo tempo.
const salvo: SavedProduct = {
  id: "prod_cobaia",
  createdAt: 1_700_000_000_000,
  name: 'Cobaia "Full"; Round-Trip',
  mainStageName: "Corpo principal",
  machineId: "x2d",
  printHours: 4.75,
  energyTariff: 1.07,
  laborMinutes: 42,
  laborRate: 55.5,
  markup: 2.8,
  failureRate: 7,
  includeFixed: true,
  roundingMode: "0.90",
  piecesCount: 3,
  sellBySubitems: true,
  linkModel: "https://makerworld.com/model/1",
  linkCompetitor: "https://concorrente.com/x",
  linkFile: "https://drive.google.com/file/abc",
  filaments: [
    { filamentId: "fil_azul", colorName: 'Azul "Royal"', pricePerKg: 118.9, totalG: 143.53 },
    {
      filamentId: "fil_branco", colorName: "Branco; Neve", pricePerKg: 99.5,
      totalG: 60, modelG: 40, supportG: 8, purgedG: 7, towerG: 5,
    },
  ],
  stages: [
    {
      id: "stage_extra_1", name: "Tampa (outra maquina)", machineId: "a1",
      printHours: 1.25, laborMinutes: 12,
      filaments: [{ filamentId: "fil_verde", colorName: "Verde", pricePerKg: 105, totalG: 22.4 }],
    },
    {
      id: "stage_extra_2", name: "Encaixe (mesma maquina)", machineId: "x2d",
      printHours: 0.6, laborMinutes: 5,
      filaments: [{ filamentId: null, colorName: "Preto avulso", pricePerKg: 89.9, totalG: 11 }],
    },
  ],
  accessories: [
    { desc: "Argola metalica", qty: 2, unitPrice: 0.43, supplyId: "sup_argola", subitemId: null },
    { desc: "Ima avulso", qty: 1, unitPrice: 1.25, supplyId: null, subitemId: null },
    { desc: "Cordao do topo", qty: 4, unitPrice: 0.9, supplyId: "sup_cordao", subitemId: "sub_topo" },
  ],
  subitems: [
    { id: "sub_corpo", name: "Corpo", stageKeys: ["main", "stage_extra_2"] },
    { id: "sub_topo", name: "Topo", stageKeys: ["stage_extra_1"], markup: 4.2 },
  ],
  fixedCostPerHour: null, combineEnabled: null, stage2: null,
};

function abrirESalvar(doc: SavedProduct): ProductPayload {
  return buildProductPayload(buildLoadedProduct(doc), doc.includeFixed, false);
}

// Caminhos que diferem, chave a chave e item a item.
function deepDiff(a: unknown, b: unknown, path: string, out: string[]) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}.length ${a.length} -> ${b.length}`); return; }
    a.forEach((v, i) => deepDiff(v, b[i], `${path}[${i}]`, out));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) =>
      deepDiff((a as never)[k], (b as never)[k], `${path}.${k}`, out));
    return;
  }
  out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
}

describe("round-trip do formulário — abrir e salvar sem tocar em nada", () => {
  it("nenhum campo do documento se move", () => {
    const depois = abrirESalvar(salvo) as Record<string, unknown>;
    const antes: Record<string, unknown> = { ...salvo };
    // O `id` não é campo do documento (é o caminho no Firestore) e não sai
    // mais no payload. O `createdAt` sai, de carona no estado do form — mas
    // com o MESMO valor que já está gravado, então a reescrita é no-op.
    expect(depois.createdAt).toBe(salvo.createdAt);
    delete antes.id;
    delete antes.createdAt;
    delete depois.createdAt;
    // Escalares legados que o save apaga de propósito (FEAT-02).
    delete antes.weightG;
    delete antes.filamentPricePerKg;

    const out: string[] = [];
    deepDiff(antes, depois, "doc", out);
    expect(out).toEqual([]);
  });

  it("mantém o supplyId — ligado E avulso, os dois casos importam", () => {
    const p = abrirESalvar(salvo);
    expect(p.accessories.map((a) => a.supplyId)).toEqual([
      "sup_argola", null, "sup_cordao",
    ]);
  });

  it("mantém o subitemId — o custo vai 100% para a parte", () => {
    expect(abrirESalvar(salvo).accessories[2].subitemId).toBe("sub_topo");
  });

  it("mantém os stages[].id, e os stageKeys continuam apontando para eles", () => {
    const p = abrirESalvar(salvo);
    expect(p.stages.map((s) => s.id)).toEqual(["stage_extra_1", "stage_extra_2"]);
    const vivos = new Set(["main", ...p.stages.map((s) => s.id)]);
    p.subitems.forEach((s) =>
      s.stageKeys.forEach((k) => expect(vivos.has(k)).toBe(true)));
  });

  it("mantém o filamentId das cores do produto e das etapas", () => {
    const p = abrirESalvar(salvo);
    expect(p.filaments?.map((f) => f.filamentId)).toEqual(["fil_azul", "fil_branco"]);
    expect(p.stages[0].filaments?.[0].filamentId).toBe("fil_verde");
    expect(p.stages[1].filaments?.[0].filamentId).toBeNull();
  });

  it("preserva o override de markup e a AUSÊNCIA dele", () => {
    const p = abrirESalvar(salvo);
    expect(p.subitems[1].markup).toBe(4.2);
    expect("markup" in p.subitems[0]).toBe(false);
  });

  it("não grava o `id` dentro do documento", () => {
    // Em "salvar como novo" isso nascia apontando para o produto ORIGINAL.
    expect((abrirESalvar(salvo) as Record<string, unknown>).id).toBeUndefined();
    const novo = buildProductPayload(buildLoadedProduct(salvo), true, true);
    expect((novo as Record<string, unknown>).id).toBeUndefined();
    expect(novo.createdAt).not.toBe(salvo.createdAt);
  });

  it("nunca produz `undefined` — o Firestore rejeita a gravação", () => {
    const achados: string[] = [];
    const scan = (o: unknown, path: string) => {
      if (Array.isArray(o)) o.forEach((v, i) => scan(v, `${path}[${i}]`));
      else if (o && typeof o === "object")
        Object.entries(o).forEach(([k, v]) => {
          if (v === undefined) achados.push(`${path}.${k}`);
          else scan(v, `${path}.${k}`);
        });
    };
    scan(abrirESalvar(salvo), "produto");
    expect(achados).toEqual([]);
  });

  it("etapa com tarifa/valor-hora legados: as chaves somem, o produto manda", () => {
    const sujo: SavedProduct = {
      ...salvo,
      stages: [{ ...salvo.stages[0], energyTariff: 9.99, laborRate: 999 } as never],
    };
    const p = abrirESalvar(sujo);
    const etapa = p.stages[0] as Record<string, unknown>;
    expect(etapa.energyTariff).toBeUndefined();
    expect(etapa.laborRate).toBeUndefined();
    expect(p.energyTariff).toBe(1.07);
    expect(p.laborRate).toBe(55.5);
  });
});
