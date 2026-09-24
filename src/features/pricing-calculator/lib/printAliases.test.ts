import { describe, expect, it } from "vitest";
import {
  aliasDocId,
  aliasesCell,
  lookupPrintAlias,
  normalizeAliasChave,
  parseAliasesCell,
  type AliasLookupProduct,
} from "./printAliases";
import type { PrintAliasDraft, PrintStage, SavedPrintAlias } from "../types";

const etapa = (id: string, name: string): PrintStage =>
  ({ id, name, machineIds: [], printHours: 1, laborMinutes: 0, filaments: [] }) as PrintStage;

const salvo = (over: Partial<SavedPrintAlias> & Pick<PrintAliasDraft, "fonte" | "chave">): SavedPrintAlias => {
  const base = {
    variante: null,
    plate: null,
    stageKey: "main",
    objetosPorUnidade: 1,
    productId: "p1",
    createdAt: 0,
    ...over,
  };
  return { ...base, id: aliasDocId(base) } as SavedPrintAlias;
};

describe("S3 — chave canônica", () => {
  it("arquivo: normaliza caixa, acento, _ e extensão — sem traduzir", () => {
    expect(normalizeAliasChave("arquivo", "Coração_Quatto  Face.gcode.3mf")).toBe(
      "coracao quatto face",
    );
    expect(normalizeAliasChave("arquivo", "Zipper Pull Rev K.3mf")).toBe("zipper pull rev k");
  });

  it("codigo: forma canônica, ilegível vira null", () => {
    expect(normalizeAliasChave("codigo", "ll-42")).toBe("LL-0042");
    expect(normalizeAliasChave("codigo", "Quatto")).toBeNull();
  });

  it("vazio é null", () => {
    expect(normalizeAliasChave("mw", "  ")).toBeNull();
  });
});

describe("S3 — id do documento", () => {
  it("campos diferentes nunca colidem, nem com ~ dentro do valor", () => {
    const a = aliasDocId({ fonte: "arquivo", chave: "a~b", variante: null, plate: null });
    const b = aliasDocId({ fonte: "arquivo", chave: "a", variante: "b", plate: null });
    expect(a).not.toBe(b);
  });

  it("sem / (o Firestore recusa)", () => {
    expect(aliasDocId({ fonte: "arquivo", chave: "pasta/arquivo", variante: null, plate: 2 })).not.toContain(
      "/",
    );
  });

  it("plate e variante fazem parte da identidade", () => {
    const base = { fonte: "mw" as const, chave: "123", variante: "9", plate: 1 };
    expect(aliasDocId(base)).not.toBe(aliasDocId({ ...base, plate: 2 }));
    expect(aliasDocId(base)).not.toBe(aliasDocId({ ...base, variante: "8" }));
  });
});

describe("S3 — coluna Apelidos JSON", () => {
  const stages = [etapa("stage_tampa", "Tampa"), etapa("stage_x", "Encaixe")];

  it("célula vazia = nenhum apelido, sem problema", () => {
    expect(parseAliasesCell("", "Corpo", stages)).toEqual({ aliases: [], problems: [] });
  });

  it("lê os campos e resolve a etapa por id, por nome ou vazio = principal", () => {
    const { aliases, problems } = parseAliasesCell(
      JSON.stringify([
        { fonte: "mw", chave: "1234567", variante: "998877", plate: 1 },
        { fonte: "mw", chave: "1234567", variante: "998877", plate: 2, etapa: "tampa", objetosPorUnidade: 2 },
        { fonte: "arquivo", chave: "Zipper_Pull.3mf", etapa: "stage_x" },
        { fonte: "arquivo", chave: "Corpo solto", etapa: "corpo" },
      ]),
      "Corpo",
      stages,
    );
    expect(problems).toEqual([]);
    expect(aliases).toEqual([
      { fonte: "mw", chave: "1234567", variante: "998877", plate: 1, stageKey: "main", objetosPorUnidade: 1 },
      { fonte: "mw", chave: "1234567", variante: "998877", plate: 2, stageKey: "stage_tampa", objetosPorUnidade: 2 },
      { fonte: "arquivo", chave: "zipper pull", variante: null, plate: null, stageKey: "stage_x", objetosPorUnidade: 1 },
      { fonte: "arquivo", chave: "corpo solto", variante: null, plate: null, stageKey: "main", objetosPorUnidade: 1 },
    ]);
  });

  it("aceita número onde o curador escreveu texto (chave/plate) sem coerção cega", () => {
    const { aliases } = parseAliasesCell('[{"fonte":"mw","chave":1234567,"plate":"3"}]', "", []);
    expect(aliases[0]).toMatchObject({ chave: "1234567", plate: 3 });
  });

  it("item ruim sai e se anuncia; o bom entra", () => {
    const { aliases, problems } = parseAliasesCell(
      JSON.stringify([
        { fonte: "mw", chave: "1" },
        null,
        { fonte: "bambu", chave: "1" },
        { fonte: "mw", chave: "" },
        { fonte: "mw", chave: "2", plate: 0 },
        { fonte: "mw", chave: "3", plate: 1.5 },
        { fonte: "mw", chave: "4", objetosPorUnidade: 0 },
        { fonte: "mw", chave: "5", etapa: "Inexistente" },
        { fonte: "mw", chave: "6", variante: { x: 1 } },
      ]),
      "Corpo",
      stages,
    );
    expect(aliases.map((a) => a.chave)).toEqual(["1"]);
    expect(problems).toHaveLength(8);
    expect(problems.every((p) => p.kind === "invalido")).toBe(true);
  });

  it("nome de etapa que casa com duas é ambíguo — descarta, não chuta", () => {
    const { problems } = parseAliasesCell(
      '[{"fonte":"mw","chave":"1","etapa":"Tampa"}]',
      "Tampa",
      [etapa("stage_tampa", "Tampa")],
    );
    expect(problems).toHaveLength(1);
  });

  it("fonte codigo é recusada na planilha (o site é quem gera o código)", () => {
    const { aliases, problems } = parseAliasesCell('[{"fonte":"codigo","chave":"LL-0001"}]', "", []);
    expect(aliases).toEqual([]);
    expect(problems).toEqual([{ kind: "codigo", detalhe: 'item 1: "LL-0001"' }]);
  });

  it("JSON ilegível ou não-lista se anuncia", () => {
    expect(parseAliasesCell("[{", "", []).problems[0].kind).toBe("invalido");
    expect(parseAliasesCell('{"fonte":"mw"}', "", []).problems[0].kind).toBe("invalido");
  });

  it("round-trip: o que o export escreve é o que a importação lê", () => {
    const gravados = [
      salvo({ fonte: "mw", chave: "1234567", variante: "99", plate: 2, stageKey: "stage_tampa", objetosPorUnidade: 3 }),
      salvo({ fonte: "arquivo", chave: "zipper pull" }),
    ];
    const { aliases, problems } = parseAliasesCell(aliasesCell(gravados), "Corpo", stages);
    expect(problems).toEqual([]);
    const semMeta = gravados
      .map(({ fonte, chave, variante, plate, stageKey, objetosPorUnidade }) => ({
        fonte, chave, variante, plate, stageKey, objetosPorUnidade,
      }))
      .sort((a, b) => aliasDocId(a).localeCompare(aliasDocId(b)));
    expect(aliases).toEqual(semMeta);
  });
});

describe("S3 — busca em camadas (só a exata preenche)", () => {
  const produtos: AliasLookupProduct[] = [
    { id: "p1", name: "Zipper", codigo: "LL-0001", stages: [etapa("stage_cursor", "Cursor")] },
    { id: "p2", name: "Quatto", codigo: "LL-0002", linkModel: "https://makerworld.com/en/models/555-quatto" },
    { id: "p3", name: "Outro", codigo: "LL-0003" },
  ];
  const apelidos = [
    salvo({ fonte: "mw", chave: "777", variante: "a", plate: 1, productId: "p1" }),
    salvo({ fonte: "mw", chave: "777", variante: "a", plate: 2, productId: "p1", stageKey: "stage_cursor" }),
    salvo({ fonte: "mw", chave: "888", variante: "a", plate: 1, productId: "p3" }),
    salvo({ fonte: "arquivo", chave: "zipper pull rev j", productId: "p1" }),
    salvo({ fonte: "codigo", chave: "LL-0003", plate: 1, productId: "p3", stageKey: "stage_morta" }),
  ];

  it("exata preenche", () => {
    const r = lookupPrintAlias({ fonte: "mw", chave: "777", variante: "a", plate: 2 }, apelidos, produtos);
    expect(r.exata?.stageKey).toBe("stage_cursor");
    expect(r.sugestoes).toEqual([]);
  });

  it("arquivo: exata casa pela chave normalizada", () => {
    const r = lookupPrintAlias(
      { fonte: "arquivo", chave: "Zipper_Pull_Rev_J.3mf", variante: null, plate: null },
      apelidos,
      produtos,
    );
    expect(r.exata?.productId).toBe("p1");
  });

  it("mesma origem, outra mesa → qual etapa?", () => {
    const r = lookupPrintAlias({ fonte: "mw", chave: "777", variante: "a", plate: 3 }, apelidos, produtos);
    expect(r.exata).toBeNull();
    expect(r.sugestoes).toEqual([{ productId: "p1", stageKey: null, motivo: "outra-mesa" }]);
  });

  it("mesmo design, outra instância → sugestão", () => {
    const r = lookupPrintAlias({ fonte: "mw", chave: "888", variante: "b", plate: 1 }, apelidos, produtos);
    expect(r.exata).toBeNull();
    expect(r.sugestoes).toEqual([{ productId: "p3", stageKey: null, motivo: "outra-variante" }]);
  });

  it("Link Modelo sugere pelo designId", () => {
    const r = lookupPrintAlias({ fonte: "mw", chave: "555", variante: null, plate: 1 }, apelidos, produtos);
    expect(r.sugestoes).toEqual([{ productId: "p2", stageKey: null, motivo: "link-modelo" }]);
  });

  it("código sem apelido gravado → o produto, sem a etapa (não preenche)", () => {
    const r = lookupPrintAlias({ fonte: "codigo", chave: "ll-2", variante: null, plate: 1 }, apelidos, produtos);
    expect(r.exata).toBeNull();
    expect(r.sugestoes).toEqual([{ productId: "p2", stageKey: null, motivo: "codigo" }]);
  });

  it("apelido exato cuja etapa foi removida vira sugestão, não preenche", () => {
    const r = lookupPrintAlias({ fonte: "codigo", chave: "LL-0003", variante: null, plate: 1 }, apelidos, produtos);
    expect(r.exata).toBeNull();
    expect(r.sugestoes).toEqual([{ productId: "p3", stageKey: null, motivo: "etapa-removida" }]);
  });

  it("nome parecido → sugestão", () => {
    const r = lookupPrintAlias(
      { fonte: "arquivo", chave: "Zipper Pull Rev K", variante: null, plate: null },
      apelidos,
      produtos,
    );
    expect(r.sugestoes).toEqual([{ productId: "p1", stageKey: null, motivo: "nome-parecido" }]);
  });

  it("apelido de produto apagado não preenche nem sugere", () => {
    const r = lookupPrintAlias(
      { fonte: "mw", chave: "777", variante: "a", plate: 2 },
      apelidos,
      produtos.filter((p) => p.id !== "p1"),
    );
    expect(r).toEqual({ exata: null, sugestoes: [] });
  });

  it("nada → nada", () => {
    expect(
      lookupPrintAlias({ fonte: "arquivo", chave: "Coisa nova", variante: null, plate: null }, apelidos, produtos),
    ).toEqual({ exata: null, sugestoes: [] });
  });
});
