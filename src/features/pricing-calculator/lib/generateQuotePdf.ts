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
  const y0 = 48;

  // Cabeçalho — nome do negócio (esquerda)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text(data.business.name || "Lopo Lab", marginX, y0);

  // Contato abaixo do nome
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  let contactY = y0 + 16;
  [data.business.phone, data.business.contact]
    .filter((line) => line.trim())
    .forEach((line) => {
      doc.text(line, marginX, contactY);
      contactY += 13;
    });

  // Bloco "ORÇAMENTO" (direita)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("ORÇAMENTO", pageWidth - marginX, y0, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Nº ${data.number}`, pageWidth - marginX, y0 + 16, {
    align: "right",
  });
  doc.text(`Data: ${formatDate(data.date)}`, pageWidth - marginX, y0 + 29, {
    align: "right",
  });

  let y = Math.max(contactY, y0 + 42) + 8;

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

  doc.save(`orcamento-${data.number}-${slug(data.customer)}.pdf`);
}
