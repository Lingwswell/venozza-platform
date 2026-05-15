export type CustomizationOptionItem = {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  matchTerms?: string[];
};

export type PizzaSizeOption = {
  id: "25cm" | "35cm" | "40cm";
  name: string;
  description: string;
  price_delta_cents: number;
  matchTerms?: string[];
};

export const pizzaSizeOptions: PizzaSizeOption[] = [
  {
    id: "25cm",
    name: "Pizza Pequena - 25cm",
    description: "Ideal para 1 pessoa.",
    price_delta_cents: -1000,
    matchTerms: ["25cm", "pequena"],
  },
  {
    id: "35cm",
    name: "Pizza Grande - 35cm",
    description: "Aproximadamente 8 fatias.",
    price_delta_cents: 0,
    matchTerms: ["35cm", "grande"],
  },
  {
    id: "40cm",
    name: "Pizza Família - 40cm",
    description: "Tamanho família com 1 sabor.",
    price_delta_cents: 2000,
    matchTerms: ["40cm", "familia", "família"],
  },
];

export const pizzaBorderOptions: CustomizationOptionItem[] = [
  { id: "sem-borda", name: "Borda sem recheio", price_cents: 0, matchTerms: ["sem borda", "sem recheio"] },
  { id: "borda-catupiry", name: "Borda Catupiry", price_cents: 1590, matchTerms: ["catupiry"] },
  { id: "borda-cream-cheese", name: "Borda Cream Cheese", price_cents: 1590, matchTerms: ["cream cheese"] },
  { id: "borda-mucarela", name: "Borda Muçarela", price_cents: 1790, matchTerms: ["mucarela", "muçarela"] },
  { id: "borda-calabresa-catupiry", name: "Borda Calabresa c/ Catupiry", price_cents: 1790, matchTerms: ["calabresa c", "calabresa com"] },
  { id: "borda-chocolate", name: "Borda Chocolate ao Leite", price_cents: 1090, matchTerms: ["chocolate ao leite"] },
  { id: "borda-creme-avela", name: "Borda Creme de Avelã", price_cents: 1390, matchTerms: ["creme de avela", "creme de avelã"] },
];

export const pizzaDoughOptions: CustomizationOptionItem[] = [
  { id: "massa-tradicional", name: "Massa Tradicional", price_cents: 0, matchTerms: ["tradicional"] },
  { id: "massa-integral", name: "Massa Integral", price_cents: 400, matchTerms: ["integral"] },
];

export const pizzaExtraDrinkOptions: CustomizationOptionItem[] = [
  { id: "guarana-15", name: "Guaraná Antarctica - 1,5L", price_cents: 1290, matchTerms: ["guarana antarctica - 1,5l", "guaraná antarctica - 1,5l"] },
  { id: "guarana-2", name: "Guaraná Antarctica - 2L", price_cents: 1490, matchTerms: ["guarana antarctica - 2l", "guaraná antarctica - 2l"] },
  { id: "pepsi-15", name: "Pepsi - 1,5L", price_cents: 1290, matchTerms: ["pepsi - 1,5l"] },
  { id: "pepsi-2", name: "Pepsi - 2L", price_cents: 1490, matchTerms: ["pepsi - 2l"] },
];

export const potatoSizeOptions: CustomizationOptionItem[] = [
  { id: "batata-pequena", name: "Batata Pequena", description: "Porção menor.", price_cents: 0, matchTerms: ["pequena"] },
  { id: "batata-media", name: "Batata Média", description: "Porção média.", price_cents: 500, matchTerms: ["media", "média"] },
  { id: "batata-grande", name: "Batata Grande", description: "Porção grande.", price_cents: 1000, matchTerms: ["grande"] },
];

export const potatoFillingOptions: CustomizationOptionItem[] = [
  { id: "batata-sem-recheio", name: "Sem recheio adicional", price_cents: 0, matchTerms: ["sem recheio", "sem recheio adicional"] },
  { id: "batata-cheddar", name: "Cheddar", price_cents: 500, matchTerms: ["cheddar"] },
  { id: "batata-catupiry", name: "Catupiry", price_cents: 500, matchTerms: ["catupiry"] },
  { id: "batata-bacon", name: "Bacon", price_cents: 700, matchTerms: ["bacon"] },
  { id: "batata-calabresa", name: "Calabresa", price_cents: 700, matchTerms: ["calabresa"] },
  { id: "batata-frango-cremoso", name: "Frango cremoso", price_cents: 800, matchTerms: ["frango cremoso"] },
];

export function normalizeCustomizationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getOptionPriceByText(
  options: CustomizationOptionItem[],
  value: string
) {
  const normalized = normalizeCustomizationText(value);

  const matched = options.find((option) => {
    const terms = [
      option.id,
      option.name,
      ...(option.matchTerms || []),
    ].map(normalizeCustomizationText);

    return terms.some((term) => term && normalized.includes(term));
  });

  return matched?.price_cents || 0;
}

export function getPizzaSizeDeltaByText(value: string) {
  const normalized = normalizeCustomizationText(value);

  const matched = pizzaSizeOptions.find((option) => {
    const terms = [
      option.id,
      option.name,
      ...(option.matchTerms || []),
    ].map(normalizeCustomizationText);

    return terms.some((term) => term && normalized.includes(term));
  });

  return matched?.price_delta_cents || 0;
}

export function getPizzaExtraDrinkOptionPriceByName(value: string) {
  return getOptionPriceByText(pizzaExtraDrinkOptions, value);
}
