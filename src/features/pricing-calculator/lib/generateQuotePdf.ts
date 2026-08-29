import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuoteBusiness } from "../types";

export type QuotePdfItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuotePdfData = {
  business: QuoteBusiness;
  number: string;
  customer: string;
  date: number; // timestamp (ms)
  validityDays: number;
  items: QuotePdfItem[];
  notes: string;
};

const ACCENT: [number, number, number] = [255, 107, 53]; // #FF6B35

// UX-43 — o que o PDF faz com caractere que a fonte não sabe escrever.
//
// ⚠ O item nasceu de um diagnóstico ERRADO, e desfazê-lo é metade do valor
// deste bloco. A auditoria extraiu o texto do PDF, viu "Produto  Corpo" onde o
// app escreve "Produto — Corpo" e concluiu que o travessão era comido. Não é:
// o jsPDF declara `/Encoding /WinAnsiEncoding` e grava o travessão no byte
// 0x97, que nessa tabela É o travessão. Quem lê o stream como Latin-1 (onde
// 0x97 é um controle invisível) vê o caractere "sumir" — artefato de extração.
// Rebaixar o travessão para hífen "por precaução" pioraria um PDF que já
// estava certo.
//
// O defeito de verdade está ao lado, e é MAIOR do que o relatado. Um único
// caractere sem byte no cp1252 não se perde sozinho: o jsPDF reescreve a
// STRING INTEIRA em UTF-16BE e deixa a fonte declarada como WinAnsi. Medido,
// olhando o bloco de texto do arquivo:
//
//   "A—B"  (travessão, tem byte) → (A<97>B) Tj            1 byte por char, ok
//   "A‐B"  (U+2010, sem byte)    → (<00>A <10><00>B) Tj    UTF-16BE
//   "A🐱B" (emoji, sem byte)     → (<00>A<d8>=<dc>1<00>B)  UTF-16BE
//
// Como o leitor de PDF interpreta byte a byte com a tabela WinAnsi, não é o
// caractere que some — é a linha toda que vira lixo. Um nome de produto com
// emoji levaria junto o nome inteiro.
//
// Por isso o saneamento é CIRÚRGICO e obrigatório ao mesmo tempo: preserva tudo
// que tem byte (é o que mantém a linha no caminho de 1 byte) e troca só o que
// não tem (é o que impede a virada para UTF-16).
//
// Embutir uma fonte Unicode resolveria o resto também, mas custa centenas de KB
// no bundle do cliente para ganhar caracteres que um orçamento não usa.

// Os 27 caracteres que o cp1252 acomoda ACIMA do Latin-1, nos bytes 0x80–0x9F.
// É o que separa "cabe no PDF" de "cabe em um byte" — a confusão que gerou o
// diagnóstico errado.
const WINANSI_EXTRA = new Set([
  "\u20AC", "\u201A", "\u0192", "\u201E", "\u2026", "\u2020", "\u2021",
  "\u02C6", "\u2030", "\u0160", "\u2039", "\u0152", "\u017D", "\u2018",
  "\u2019", "\u201C", "\u201D", "\u2022", "\u2013", "\u2014", "\u02DC",
  "\u2122", "\u0161", "\u203A", "\u0153", "\u017E", "\u0178",
]);

function cabeNoPdf(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x20 && cp <= 0x7e) return true; // ASCII imprimível
  if (cp >= 0xa0 && cp <= 0xff) return true; // Latin-1 alto (á, ç, ·, º, ×…)
  return WINANSI_EXTRA.has(ch);
}

// Só o que NÃO cabe e tem um equivalente óbvio. Os primos do travessão e das
// aspas que ficaram de fora do cp1252 caem no parente que entrou.
const SEM_BYTE: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2015": "-", "\u2212": "-",
  "\u2043": "-",
  "\u201B": "\u2019", "\u201F": "\u201D", // aspas invertidas → a curva normal
  "\u2032": "'", "\u2033": '"',
  "\u2007": " ", "\u2009": " ", "\u200A": " ", "\u202F": " ",
  "\u200B": "", "\uFEFF": "", // largura zero
};

// Toda forma de "linha nova" que chega colada de outro programa (AUD-16 [E6]).
const QUEBRA_DE_LINHA = /\r\n?|[\u2028\u2029]/g;

/**
 * Texto pronto para as fontes padrão do jsPDF (WinAnsi/cp1252).
 *
 * Preserva tudo que a tabela acomoda — inclusive o travessão, as aspas curvas e
 * o acentuado, que é a maior parte de um orçamento em português. Age só sobre o
 * que viraria `??`: primeiro o equivalente óbvio, depois o NFKD (que devolve as
 * letras de um "ﬁ" ou de um "①"), e o que ainda assim não couber é descartado —
 * um espaço em branco incomoda menos que `??` no meio do nome do produto.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return "";
  // AUD-16 [E6]: quebra e tabulação não cabem no cp1252 e caíam no descarte —
  // "um\ndois" virava "umdois", colando duas palavras que nunca foram uma.
  // Numa LINHA a quebra é um SEPARADOR, então vira espaço. (Parágrafo de
  // verdade é assunto do `sanitizeBlockForPdf`, logo abaixo.)
  const linha = text
    .replace(QUEBRA_DE_LINHA, "\n")
    .replace(/[\n\t]+/g, " ");
  return [...linha]
    .map((ch) => {
      if (cabeNoPdf(ch)) return ch;
      const trocado = SEM_BYTE[ch];
      if (trocado !== undefined) return trocado;
      return [...ch.normalize("NFKD").normalize("NFC")]
        .filter((c) => cabeNoPdf(c))
        .join("");
    })
    .join("");
}

/**
 * O mesmo saneamento, para texto de PARÁGRAFO (hoje só as Observações do
 * orçamento) — AUD-16 [E6].
 *
 * A quebra de linha SOBREVIVE: cada linha é saneada sozinha e o `\n` e
 * recolocado entre elas. O `splitTextToSize` do jsPDF já quebra em `\n`
 * (medido: devolve uma entrada por linha, inclusive a vazia da linha em
 * branco) e o `doc.text` desenha o array uma linha por vez — preservar o
 * caractere é tudo o que faltava para o texto sair como o dono digitou.
 *
 * `\r\n`, `\r` e os separadores Unicode (U+2028/U+2029) entram normalizados:
 * quem cola de um Word ou de um WhatsApp não traz o `\n` puro.
 */
export function sanitizeBlockForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(QUEBRA_DE_LINHA, "\n")
    .split("\n")
    .map((linha) => sanitizeForPdf(linha))
    .join("\n");
}

// Atalho para não esquecer o saneamento em nenhuma chamada de texto.
const t = sanitizeForPdf;

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

// (00) 00000-0000 para celular (11 díg.), (00) 0000-0000 para fixo (10), e
// +55 (00) 00000-0000 se vier com código do país. Fora disso, devolve como veio.
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return raw.trim();
}

function formatInstagram(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  return `@${value.replace(/^@+/, "")}`;
}

// Link de WhatsApp a partir do telefone. Garante o DDI 55 quando o número vier
// só com DDD (10/11 díg.); se já vier com o 55 (13 díg.), usa como está.
function whatsappUrl(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const withCountry =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

// Link do perfil no Instagram a partir do handle (sem o @).
function instagramUrl(raw: string): string {
  const handle = raw.trim().replace(/^@+/, "");
  if (!handle) return "";
  return `https://instagram.com/${handle}`;
}

// Logo placeholder: quadrado arredondado laranja com uma impressora branca
// simplificada (mesma cara do ícone do app). Quando existir a marca, trocar a
// chamada por doc.addImage(logoDataUrl, "PNG", x, y, size, size).
function drawPrinterLogo(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
): void {
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.roundedRect(x, y, size, size, 9, 9, "F");

  doc.setFillColor(255, 255, 255);
  // Papel de entrada (topo)
  doc.rect(x + size * 0.3, y + size * 0.22, size * 0.4, size * 0.16, "F");
  // Corpo da impressora
  doc.roundedRect(x + size * 0.2, y + size * 0.4, size * 0.6, size * 0.28, 2, 2, "F");
  // Papel de saída (base)
  doc.rect(x + size * 0.3, y + size * 0.64, size * 0.4, size * 0.16, "F");

  // Detalhes em laranja: fenda de saída + botão
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(x + size * 0.34, y + size * 0.55, size * 0.32, size * 0.03, "F");
  doc.circle(x + size * 0.72, y + size * 0.47, size * 0.022, "F");
}

function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cliente"
  );
}

export function generateQuotePdf(data: QuotePdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Logo (placeholder da marca) à esquerda; nome + contato ao lado.
  const logoSize = 42;
  const logoX = marginX;
  const logoY = 40;
  drawPrinterLogo(doc, logoX, logoY, logoSize);
  const textX = logoX + logoSize + 14;

  // Nome do negócio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text(t(data.business.name) || "Lopo Lab", textX, logoY + 19);

  // Contato formatado, uma linha por item
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  let contactY = logoY + 35;
  [
    { text: formatPhone(data.business.phone), url: whatsappUrl(data.business.phone) },
    { text: formatInstagram(data.business.instagram), url: instagramUrl(data.business.instagram) },
    { text: data.business.email.trim(), url: "" },
  ]
    .filter((line) => line.text)
    .forEach((line) => {
      if (line.url) {
        doc.textWithLink(t(line.text), textX, contactY, { url: line.url });
      } else {
        doc.text(t(line.text), textX, contactY);
      }
      contactY += 13;
    });

  // Bloco "ORÇAMENTO" (direita)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("ORÇAMENTO", pageWidth - marginX, logoY + 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(t(`Nº ${data.number}`), pageWidth - marginX, logoY + 32, {
    align: "right",
  });
  doc.text(`Data: ${formatDate(data.date)}`, pageWidth - marginX, logoY + 45, {
    align: "right",
  });

  let y = Math.max(contactY, logoY + logoSize + 6, logoY + 52) + 8;

  // Divisória
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  // Cliente
  if (data.customer.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text("Cliente:", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70);
    doc.text(t(data.customer), marginX + 52, y);
    y += 18;
  }

  // Tabela de itens
  const total = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Qtd", "Preço unit.", "Subtotal"]],
    body: data.items.map((item) => [
      t(item.description),
      String(item.quantity),
      brl(item.unitPrice),
      brl(item.quantity * item.unitPrice),
    ]),
    margin: { left: marginX, right: marginX },
    headStyles: {
      fillColor: ACCENT,
      textColor: 255,
      halign: "left",
      fontStyle: "bold",
    },
    columnStyles: {
      1: { halign: "right", cellWidth: 45 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    styles: { fontSize: 10, cellPadding: 6, textColor: 40 },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y;

  // Total (direita)
  let cursorY = finalY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40);
  doc.text(`Total: ${brl(total)}`, pageWidth - marginX, cursorY, {
    align: "right",
  });
  cursorY += 30;

  // Observações
  if (data.notes.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text("Observações", marginX, cursorY);
    cursorY += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70);
    // AUD-16 [E6]: bloco, não linha — a quebra que o dono digitou é parte do
    // recado comercial ("Prazo: 5 dias" / "Frete à parte" em linhas próprias).
    const wrapped = doc.splitTextToSize(
      sanitizeBlockForPdf(data.notes),
      pageWidth - marginX * 2,
    );
    doc.text(wrapped, marginX, cursorY);
    cursorY += wrapped.length * 12 + 12;
  }

  // Validade
  const validUntil = new Date(data.date + data.validityDays * 86400000);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    t(
      `Orçamento válido por ${data.validityDays} dias — até ${validUntil.toLocaleDateString("pt-BR")}.`,
    ),
    marginX,
    cursorY,
  );

  doc.save(
    `${slug(data.business.name || "lopolab")}-orcamento-${data.number}-${slug(data.customer)}.pdf`,
  );
}
