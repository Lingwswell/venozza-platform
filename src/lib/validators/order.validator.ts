import { CreateOrderSchema, type CreateOrderSchemaInput } from "@/lib/schemas/order.schema";

export function validateCreateOrder(input: unknown): CreateOrderSchemaInput {
  return CreateOrderSchema.parse(input);
}
