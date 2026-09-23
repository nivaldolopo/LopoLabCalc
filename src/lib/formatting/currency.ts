export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// [V7] Preço UNITÁRIO de insumo cotado em frações de centavo (a tarifa de
// energia, R$/kWh): as 2 casas do `formatCurrency` arredondavam 0,8543 e
// 0,8499 para o mesmo "R$ 0,85", e o rastro dizia "R$ 0,85 → R$ 0,85".
// Mantém no mínimo 2 casas (continua parecendo dinheiro) e mostra até 4.
export function formatUnitCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatDecimal(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
