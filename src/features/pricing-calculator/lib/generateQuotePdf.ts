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
  doc.text(data.business.name || "Lopo Lab", textX, logoY + 19);

  // Contato formatado, uma linha por item
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  let contactY = logoY + 35;
  [
    formatPhone(data.business.phone),
    formatInstagram(data.business.instagram),
    data.business.email.trim(),
  ]
    .filter((line) => line)
    .forEach((line) => {
      doc.text(line, textX, contactY);
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
  doc.text(`Nº ${data.number}`, pageWidth - marginX, logoY + 32, {
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
    doc.text(data.customer, marginX + 52, y);
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
      item.description,
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
    const wrapped = doc.splitTextToSize(data.notes, pageWidth - marginX * 2);
    doc.text(wrapped, marginX, cursorY);
    cursorY += wrapped.length * 12 + 12;
  }

  // Validade
  const validUntil = new Date(data.date + data.validityDays * 86400000);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Orçamento válido por ${data.validityDays} dias — até ${validUntil.toLocaleDateString("pt-BR")}.`,
    marginX,
    cursorY,
  );

  doc.save(
    `${slug(data.business.name || "lopolab")}-orcamento-${data.number}-${slug(data.customer)}.pdf`,
  );
}
