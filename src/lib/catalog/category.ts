// Normalizacao de categoria usada pelo catalogo publico (servidor e navegador).
// Produto guarda a categoria como texto (ex.: "pizza"); a tabela categories guarda
// slug/nome/icone. As duas pontas passam por canonicalCategoryKey para casar.

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function slugifyCategory(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalCategoryKey(value: string) {
  const slug = slugifyCategory(value);

  if (["porcao", "porcoes", "porcaoes", "acompanhamentos"].includes(slug)) {
    return "acompanhamento";
  }
  if (slug === "bebidas") return "bebida";
  if (slug === "sobremesas") return "sobremesa";
  if (slug === "pizzas") return "pizza";

  return slug || "outros";
}

// Usado so quando a categoria ainda nao foi cadastrada no admin.
const FALLBACK_UI: Record<string, { label: string; icon: string }> = {
  pizza: { label: "Pizzas", icon: "🍕" },
  bebida: { label: "Bebidas", icon: "🥤" },
  sobremesa: { label: "Sobremesas", icon: "🍰" },
  acompanhamento: { label: "Acompanhamentos", icon: "🍟" },
};

export function fallbackCategoryUi(key: string) {
  const mapped = FALLBACK_UI[key];
  if (mapped) return mapped;

  const label = key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return { label: label || "Outros", icon: "🍽️" };
}

export function shortCategoryName(label: string) {
  return label.length > 9 ? `${label.slice(0, 8)}.` : label;
}
