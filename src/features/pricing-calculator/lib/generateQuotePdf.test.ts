import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { sanitizeForPdf } from "./generateQuotePdf";

// UX-43 — ver a nota longa no `generateQuotePdf.ts`: o item nasceu de um
// diagnóstico errado (o travessão NÃO era comido; a extração é que lia o byte
// 0x97 como Latin-1). O defeito real é outro e maior: um único caractere sem
// byte no cp1252 faz o jsPDF reescrever a STRING INTEIRA em UTF-16BE, com a
// fonte ainda declarada WinAnsi — a linha toda vira lixo, não só o caractere.
//
// Os caracteres em questão são invisíveis ou quase — travessão vs hífen, aspa
// curva vs reta —, então cada teste diz o nome do que está exercitando.

describe("sanitizeForPdf — preserva o que o cp1252 acomoda", () => {
  it("NÃO mexe no travessão nem nas aspas curvas (o falso positivo do item)", () => {
    const original = "Produto — Corpo · “A” ‘b’";
    expect(sanitizeForPdf(original)).toBe(original);
  });

  it("NÃO mexe em reticências, bullet, euro, TM, por-mil, meia-risca", () => {
    const original = "… • € ™ ‰ –";
    expect(sanitizeForPdf(original)).toBe(original);
  });

  it("NÃO mexe no acentuado — é a maior parte de um orçamento", () => {
    expect(sanitizeForPdf("Orçamento válido · Nº 12 · R$ 1.234,56")).toBe(
      "Orçamento válido · Nº 12 · R$ 1.234,56",
    );
    expect(sanitizeForPdf("ação, coração, ãéíõü, ÇÃO, 2 × 3")).toBe(
      "ação, coração, ãéíõü, ÇÃO, 2 × 3",
    );
  });

  it("texto simples e vazio passam intactos", () => {
    expect(sanitizeForPdf("")).toBe("");
    expect(sanitizeForPdf("Caneca 350ml")).toBe("Caneca 350ml");
  });
});

describe("sanitizeForPdf — troca só o que jogaria a linha para UTF-16", () => {
  it("os primos do travessão que ficaram fora do cp1252", () => {
    // U+2010, U+2011, U+2012, U+2015, U+2212, U+2043 — nenhum tem byte no
    // cp1252, ao contrário do — e do – , que têm.
    expect(sanitizeForPdf("‐‑‒―−⁃")).toBe("------");
  });

  it("as aspas invertidas e as linhas viram a forma que tem byte", () => {
    expect(sanitizeForPdf("‛")).toBe("’");
    expect(sanitizeForPdf("‟")).toBe("”");
    expect(sanitizeForPdf("5′ e 6″")).toBe("5' e 6\"");
  });

  it("espaço fino vira espaço normal; largura zero SOME", () => {
    expect(sanitizeForPdf("a b")).toBe("a b"); // thin space
    expect(sanitizeForPdf("a b")).toBe("a b"); // narrow nbsp (o do Excel)
    expect(sanitizeForPdf("a​b")).toBe("ab"); // zero-width space
    expect(sanitizeForPdf("a﻿b")).toBe("ab"); // BOM no meio do texto
  });

  it("o que não tem equivalente é decomposto antes de ser descartado", () => {
    expect(sanitizeForPdf("oﬁm")).toBe("ofim"); // ligadura fi
    expect(sanitizeForPdf("item ①")).toBe("item 1"); // ① cercado
  });

  it("emoji e CJK saem sem quebrar o resto", () => {
    expect(sanitizeForPdf("Chaveiro \u{1F431} Gatinho")).toBe(
      "Chaveiro  Gatinho",
    );
    expect(sanitizeForPdf("a中b")).toBe("ab");
  });
});

// Os testes acima cobrem a função pura. Estes cobrem o que importa: o que sai
// no ARQUIVO. Escrevem com a fonte padrão e leem o bloco de texto do PDF — o
// jsPDF não comprime o content stream por padrão, então os bytes estão à vista.
describe("o PDF gerado de verdade", () => {
  // Bytes do literal `(...)` do bloco BT…ET. Devolve os BYTES, não o texto: é a
  // diferença entre ver o que o leitor de PDF vê e ver o que a nossa própria
  // decodificação inventou — foi essa confusão que gerou o diagnóstico errado.
  const bytesDoTexto = (texto: string): number[] => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.text(texto, 40, 60);
    const cru = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    const bloco = cru.slice(cru.indexOf("BT"), cru.indexOf("ET") + 2);
    const achado = bloco.match(/\(([\s\S]*)\) Tj/);
    return achado ? [...achado[1]].map((c) => c.codePointAt(0) ?? 0) : [];
  };

  const UTF16 = (bytes: number[]) => bytes.includes(0x00);

  it("o travessão SAI certo, no byte 0x97 do WinAnsi", () => {
    // O teste que teria evitado o diagnóstico errado: 0x97 lido como Latin-1
    // parece um controle invisível, e foi assim que ele "sumiu" na extração.
    expect(bytesDoTexto("A—B")).toEqual([0x41, 0x97, 0x42]);
    expect(bytesDoTexto("A“B")).toEqual([0x41, 0x93, 0x42]); // aspa curva
    expect(bytesDoTexto("A·B")).toEqual([0x41, 0xb7, 0x42]); // middot
  });

  it("UM caractere sem byte joga a STRING INTEIRA para UTF-16", () => {
    // Este é o defeito de verdade, e ele não é local: a linha toda vira lixo,
    // porque a fonte continua declarada WinAnsi e o leitor lê byte a byte.
    expect(UTF16(bytesDoTexto("A‐B"))).toBe(true); // hífen U+2010
    expect(UTF16(bytesDoTexto("A\u{1F431}B"))).toBe(true); // emoji
    expect(UTF16(bytesDoTexto("Aﬁ B"))).toBe(true); // ligadura
    // e o texto limpo NÃO vira
    expect(UTF16(bytesDoTexto("A-B"))).toBe(false);
  });

  it("depois do saneamento a linha volta ao caminho de 1 byte", () => {
    const bagunca = "Produto — “A” · ação… ﬁm \u{1F431} 5′ €10 x​① ‐ 中";
    const saida = bytesDoTexto(sanitizeForPdf(bagunca));
    expect(saida.length).toBeGreaterThan(0);
    expect(UTF16(saida)).toBe(false);
    expect(saida.every((b) => b <= 0xff)).toBe(true);
    // e o travessão continua lá, intacto
    expect(saida).toContain(0x97);
  });
});
