import { z } from "zod";

export const CreateOrderItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  price: z.string().optional(),
  price_cents: z.number().int().nonnegative().optional(),
  image: z.string().optional(),
  note: z.string().optional(),
  size: z.string().optional(),
  crust: z.string().optional(),
  addons: z.array(z.string()).optional(),
});

export const CreateOrderSchema = z.object({
  customerName: z.string().optional(),
  customer_name: z.string().optional(),
  phone: z.string().optional(),
  customer_phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  order_type: z.enum(["entrega", "retirada"]).optional(),
  channel: z.enum(["site", "app", "totem", "pdv", "whatsapp", "ifood"]).optional(),
  payment_method: z.enum(["pix", "credito", "debito", "dinheiro"]).optional(),
  paymentMethod: z.enum(["pix", "credito", "debito", "dinheiro"]).optional(),
  store_id: z.union([z.number().int().positive(), z.string().min(1)]).nullable().optional(),
  storeId: z.union([z.number().int().positive(), z.string().min(1)]).nullable().optional(),
  tenantId: z.string().min(1).optional(),
  store_name: z.string().nullable().optional(),
  coupon_code: z.string().nullable().optional(),
  freight: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  freight_cents: z.number().int().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  subtotal_cents: z.number().int().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  total_cents: z.number().int().nonnegative().optional(),
  items: z.array(CreateOrderItemSchema).min(1),
});

export type CreateOrderSchemaInput = z.infer<typeof CreateOrderSchema>;
