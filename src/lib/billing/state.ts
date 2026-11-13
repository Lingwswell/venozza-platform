// Situacao da assinatura de uma rede (arquivo puro: servidor, telas e testes).
//
// - active: em dia.
// - trial: em teste ate trialEndsAt.
// - trial_expired: teste acabou sem pagamento (com assinatura criada, ganha a mesma tolerancia do atraso).
// - past_due: fatura vencida; funciona normal durante a tolerancia (graceDays) e depois bloqueia.
// - suspended / canceled: bloqueada pelo super admin (ou cancelada).
// "Bloqueada" = site e app nao aceitam pedidos; o admin continua abrindo para a rede pagar.

export type TenantBillingFields = {
  status: string;
  trialEndsAt: Date | string | null;
  pastDueSince: Date | string | null;
  asaasSubscriptionId?: string | null;
};

export type BillingStateKey = "active" | "trial" | "trial_expired" | "past_due" | "suspended" | "canceled";

export type BillingState = {
  key: BillingStateKey;
  blocked: boolean;
  /** Dias ate o fim do teste (trial) ou ate bloquear (past_due / trial_expired). */
  daysLeft: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(target: Date, now: Date) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY));
}

export function billingState(t: TenantBillingFields, now = new Date(), graceDays = 7): BillingState {
  const status = String(t.status || "active");

  if (status === "suspended") return { key: "suspended", blocked: true, daysLeft: null };
  if (status === "canceled") return { key: "canceled", blocked: true, daysLeft: null };

  if (status === "trial") {
    const end = toDate(t.trialEndsAt);
    if (!end || end.getTime() > now.getTime()) {
      return { key: "trial", blocked: false, daysLeft: end ? daysUntil(end, now) : null };
    }
    // Teste acabou. Com assinatura criada, a primeira fatura vence no fim do teste: mesma tolerancia do atraso.
    if (t.asaasSubscriptionId) {
      const limit = new Date(end.getTime() + graceDays * DAY);
      const blocked = limit.getTime() <= now.getTime();
      return { key: "trial_expired", blocked, daysLeft: blocked ? 0 : daysUntil(limit, now) };
    }
    return { key: "trial_expired", blocked: true, daysLeft: 0 };
  }

  if (status === "past_due") {
    const since = toDate(t.pastDueSince) || now;
    const limit = new Date(since.getTime() + graceDays * DAY);
    const blocked = limit.getTime() <= now.getTime();
    return { key: "past_due", blocked, daysLeft: blocked ? 0 : daysUntil(limit, now) };
  }

  return { key: "active", blocked: false, daysLeft: null };
}

export const BILLING_LABELS: Record<BillingStateKey, string> = {
  active: "Em dia",
  trial: "Em teste",
  trial_expired: "Teste acabou",
  past_due: "Pagamento atrasado",
  suspended: "Suspensa",
  canceled: "Cancelada",
};

/** Valor mensal: preco do plano por loja ativa (minimo 1 loja). */
export function monthlyValueCents(priceCents: number, activeStores: number) {
  return Math.max(0, priceCents) * Math.max(1, activeStores);
}

/** Mensagem que o cliente do site ve quando a rede esta bloqueada. */
export const BLOCKED_ORDER_MESSAGE = "Pedidos online indisponíveis no momento. Fale com a loja.";

// ===== Valor do mes com loja extra e adicionais =====

export type PlanPricing = {
  priceCents: number;
  maxStores: number | null;
  extraStorePriceCents?: number | null;
};

export type MonthlyBreakdown = {
  /** Valor do plano (por loja, ou fixo cobrindo as lojas incluidas). */
  baseCents: number;
  /** Lojas cobertas pelo valor do plano (null = plano cobrado por loja). */
  includedStores: number | null;
  extraStores: number;
  extraCents: number;
  addonsCents: number;
  totalCents: number;
};

/**
 * - Plano sem preco de loja extra: preco x lojas ativas (minimo 1); maxStores e limite.
 * - Plano com preco de loja extra: preco cobre maxStores lojas (minimo 1); cada loja a mais soma o preco extra.
 * Adicionais contratados somam no fim.
 */
export function monthlyBreakdown(plan: PlanPricing, activeStores: number, addonsCents = 0): MonthlyBreakdown {
  const stores = Math.max(1, activeStores);
  const addons = Math.max(0, addonsCents);
  if (typeof plan.extraStorePriceCents === "number" && plan.extraStorePriceCents >= 0) {
    const included = Math.max(1, plan.maxStores ?? 1);
    const extraStores = Math.max(0, stores - included);
    const extraCents = extraStores * plan.extraStorePriceCents;
    return {
      baseCents: plan.priceCents,
      includedStores: included,
      extraStores,
      extraCents,
      addonsCents: addons,
      totalCents: plan.priceCents + extraCents + addons,
    };
  }
  const baseCents = Math.max(0, plan.priceCents) * stores;
  return { baseCents, includedStores: null, extraStores: 0, extraCents: 0, addonsCents: addons, totalCents: baseCents + addons };
}

/** Pode abrir mais uma loja? Com preco de loja extra, pode, e diz quanto soma por mes. */
export function storeOpening(plan: PlanPricing | null, activeStores: number) {
  if (!plan) return { allowed: true, extraCents: 0 };
  if (typeof plan.extraStorePriceCents === "number" && plan.extraStorePriceCents >= 0) {
    const included = Math.max(1, plan.maxStores ?? 1);
    return { allowed: true, extraCents: activeStores + 1 > included ? plan.extraStorePriceCents : 0 };
  }
  if (plan.maxStores !== null && activeStores >= plan.maxStores) return { allowed: false, extraCents: 0 };
  // Plano por loja: a loja nova soma o preco do plano.
  return { allowed: true, extraCents: activeStores >= 1 ? plan.priceCents : 0 };
}

/** Recursos vendidos como adicional (a chave fica em Addon.feature). */
export const FEATURES: Record<string, string> = {
  estoque: "Estoque, ficha técnica e cozinha central",
  promocoes: "Promoções em balão no site e no app",
};
