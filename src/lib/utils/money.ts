export function parseMoneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();

    const num = Number(cleaned);
    if (Number.isFinite(num)) {
      return Math.round(num * 100);
    }
  }

  return 0;
}

export function centsToNumber(value: number): number {
  return value / 100;
}

export function formatMoneyFromCents(value: number): string {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
