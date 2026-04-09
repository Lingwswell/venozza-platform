export type Product = {
  id: string | number;
  name?: string;
  description?: string;
  image?: string;
  category?: string;
  price?: number;
  available?: boolean;
  tag?: string | null;

  // compat legado
  nome?: string;
  desc?: string;
  cat?: string;
  preco?: number;
  ativo?: boolean;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  image?: string;
  category: string;
  price: number;
  available: boolean;
  tag?: string | null;
};

export type CartItem = Product & {
  qty: number;
};
