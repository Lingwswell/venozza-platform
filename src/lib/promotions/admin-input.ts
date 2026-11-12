// Validacao do cadastro de promocao (Marketing do admin).

export class PromotionInputError extends Error {}

export const PROMO_COLORS = ["#B91C1C", "#C2410C", "#15803D", "#1D4ED8", "#7E22CE", "#1C1917"];

export type PromotionData = {
  title: string;
  message: string | null;
  kind: "notice" | "discount";
  productId: string | null;
  discountType: "percent" | "fixed_price" | null;
  discountValue: number | null;
  color: string;
  emoji: string | null;
  storeIds: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

function text(value: unknown, max: number) {
  const t = String(value ?? "").trim();
  return t ? t.slice(0, max) : null;
}

function date(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new PromotionInputError(`Data inválida em ${field}.`);
  return d;
}

export function parsePromotionInput(body: Record<string, unknown>, allowedStoreIds: string[]): PromotionData {
  const title = text(body.title, 40);
  if (!title) throw new PromotionInputError("Dê um título curto para a promoção (até 40 letras).");

  const kind = body.kind === "discount" ? "discount" : "notice";
  const productId = text(body.productId, 60);

  let discountType: PromotionData["discountType"] = null;
  let discountValue: number | null = null;

  if (kind === "discount") {
    if (!productId) throw new PromotionInputError("Promoção com desconto precisa de um produto.");
    discountType = body.discountType === "fixed_price" ? "fixed_price" : "percent";
    const raw = Number(body.discountValue);
    if (!Number.isFinite(raw) || raw <= 0) throw new PromotionInputError("Informe o valor do desconto.");
    if (discountType === "percent") {
      if (raw < 1 || raw > 90) throw new PromotionInputError("O desconto em % deve ficar entre 1 e 90.");
      discountValue = Math.round(raw);
    } else {
      discountValue = Math.round(raw); // centavos
    }
  }

  const color = PROMO_COLORS.includes(String(body.color)) ? String(body.color) : PROMO_COLORS[0];
  const emoji = text(body.emoji, 4);

  const storeIds = Array.isArray(body.storeIds)
    ? Array.from(new Set(body.storeIds.map(String))).filter((id) => allowedStoreIds.includes(id))
    : [];

  const startsAt = date(body.startsAt, "início");
  const endsAt = date(body.endsAt, "fim");
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new PromotionInputError("O fim da promoção precisa ser depois do início.");
  }

  return {
    title,
    message: text(body.message, 90),
    kind,
    productId,
    discountType,
    discountValue,
    color,
    emoji,
    storeIds,
    startsAt,
    endsAt,
    active: body.active !== false,
  };
}
