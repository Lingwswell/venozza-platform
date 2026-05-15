export type CartItem = {
  id: string | number;
  name: string;
  quantity: number;
  price_cents?: number;
  image?: string;
  note?: string;
  addons?: string[];
  size?: string;
  crust?: string;
  tenantId?: string;
  storeId?: string;
};

export type CreateOrderItemInput = {
  id: string | number;
  name: string;
  quantity: number;
  price?: string;
  price_cents?: number;
  image?: string;
  note?: string;
  addons?: string[];
  size?: string;
  crust?: string;
  tenantId?: string;
  storeId?: string;
};

export type CreateOrderInput = {
  customerName?: string;
  customer_name?: string;
  phone?: string;
  customer_phone?: string;
  address?: string;
  notes?: string;
  order_type?: "entrega" | "retirada";
  channel?: "site" | "app" | "totem" | "pdv" | "whatsapp" | "ifood";
  payment_method?: "pix" | "credito" | "debito" | "dinheiro";
  paymentMethod?: "pix" | "credito" | "debito" | "dinheiro";
  store_id?: number | string | null;
  storeId?: number | string | null;
  store_name?: string | null;
  coupon_code?: string | null;
  freight?: number;
  deliveryFee?: number;
  freight_cents?: number;
  subtotal?: number;
  subtotal_cents?: number;
  total?: number;
  total_cents?: number;
  items: CreateOrderItemInput[];
  tenantId?: string;
};

export type CreateOrderResult = {
  orderId: string | number;
  orderCode: string;
  status: string;
  subtotal_cents: number;
  freight_cents: number;
  total_cents: number;
  store_id?: string | number | null;
};

export type Order = {
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  items: CartItem[];
  subtotal?: number;
  subtotal_cents?: number;
  deliveryFee?: number;
  freight_cents?: number;
  total: number;
  total_cents?: number;
  paymentMethod?: string;
};
