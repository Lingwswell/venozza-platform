import { prisma } from "@/lib/db";
import type { AdminScope } from "@/lib/auth/scope";
import { ScopeError } from "@/lib/auth/scope";
import { billingState, type BillingState } from "@/lib/billing/state";

// Assinatura no servidor: situacao da rede, bloqueio de pedidos e quem e admin da plataforma.

export function graceDays() {
  const n = Number(process.env.BILLING_GRACE_DAYS);
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

const billingSelect = { status: true, trialEndsAt: true, pastDueSince: true, asaasSubscriptionId: true } as const;

export async function tenantBillingState(tenantId: string): Promise<BillingState> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: billingSelect });
  if (!tenant) return { key: "active", blocked: false, daysLeft: null };
  return billingState(tenant, new Date(), graceDays());
}

// Cache curto: o site consulta a cada carregamento de cardapio.
const cache = new Map<string, { at: number; blocked: boolean }>();

export async function isTenantBlocked(tenantId: string): Promise<boolean> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < 30_000) return hit.blocked;
  try {
    const state = await tenantBillingState(tenantId);
    cache.set(tenantId, { at: Date.now(), blocked: state.blocked });
    return state.blocked;
  } catch (error) {
    // Na duvida, nao derruba a venda.
    console.error("[billing][isTenantBlocked]", error);
    return false;
  }
}

export function forgetBillingCache(tenantId: string) {
  cache.delete(tenantId);
}

export async function isStoreBlocked(storeId: string): Promise<boolean> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  return store ? isTenantBlocked(store.tenantId) : false;
}

/** Admin da plataforma: papel super_admin ou e-mail listado em PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdminEmail(email: string | null | undefined) {
  const list = String(process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.trim().toLowerCase());
}

export function isPlatformAdmin(scope: Pick<AdminScope, "role" | "email">) {
  return scope.role === "super_admin" || isPlatformAdminEmail(scope.email);
}

export function assertPlatformAdmin(scope: AdminScope) {
  if (!isPlatformAdmin(scope)) throw new ScopeError("Só o administrador da plataforma acessa esta área.", 403);
}

export function slugifyTenant(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Slug livre para uma rede nova (pizzaria-do-ze, pizzaria-do-ze-2...). */
export async function uniqueTenantSlug(name: string) {
  const base = slugifyTenant(name) || "rede";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const exists = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Endereco publico do site de uma rede: dominio proprio, ou subdominio da plataforma. */
export function tenantSiteUrl(slug: string, domains: string[]) {
  if (domains.length > 0) return `https://${domains[0]}`;
  const root = String(process.env.PLATFORM_ROOT_DOMAIN || "").trim();
  if (!root) return null;
  const protocol = /^\d+\.\d+\.\d+\.\d+/.test(root) || root.includes("nip.io") ? "http" : "https";
  const port = String(process.env.PLATFORM_PUBLIC_PORT || "").trim();
  return `${protocol}://${slug}.${root}${port ? `:${port}` : ""}`;
}
