// Ponte entre timestamp (ms, como tudo é guardado) e o `<input type="date">`,
// que fala "YYYY-MM-DD" em horário LOCAL.
//
// As duas pontas compensam o fuso de propósito: `toDateInput` desconta o offset
// antes do `toISOString` (que é UTC) e `toTimestamp` ancora ao MEIO-DIA local.
// Sem isso, no Brasil (UTC-3) a meia-noite volta um dia ao virar UTC — uma venda
// registrada dia 5 apareceria como dia 4.
//
// Vivia duplicado em SaleModal e QuotePage; o estoque seria a terceira cópia.

export function toDateInput(ms: number): string {
  const date = new Date(ms);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return toDateInput(Date.now());
}

export function toTimestamp(dateStr: string): number {
  const parsed = new Date(`${dateStr}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}
