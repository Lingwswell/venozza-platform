export type CartItem = {
  id: number;
  name: string;
  quantity: number;
  price_cents?: number;
  image?: string;
  note?: string;
  addons?: string[];
  size?: string;
  crust?: string;
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
