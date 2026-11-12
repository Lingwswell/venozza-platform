import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { normalizeHost } from "@/lib/tenant/resolve";
import { uniqueTenantSlug } from "@/lib/billing/server";

// Criacao de uma rede nova (painel Redes ou cadastro publico em /comecar).

export class NetworkInputError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanHost(value: unknown) {
  const host = normalizeHost(String(value ?? ""))
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!host) return null;
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(host) || host.length > 120) {
    throw new NetworkInputError("Domínio inválido. Ex.: pedidos.minhapizzaria.com.br");
  }
  return host;
}

export async function createNetwork(input: {
  name?: unknown;
  ownerName?: unknown;
  ownerEmail?: unknown;
  ownerPassword?: unknown;
  planId?: unknown;
  trialDays?: unknown;
  domain?: unknown;
}) {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) throw new NetworkInputError("Informe o nome da pizzaria ou rede.");

  const ownerName = String(input.ownerName ?? "").trim().slice(0, 80);
  if (!ownerName) throw new NetworkInputError("Informe o nome do responsável.");

  const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase().slice(0, 120);
  if (!EMAIL_RE.test(ownerEmail)) throw new NetworkInputError("Informe um e-mail válido.");

  const ownerPassword = String(input.ownerPassword ?? "");
  if (ownerPassword.length < 8) throw new NetworkInputError("A senha precisa ter pelo menos 8 caracteres.");

  const emailTaken = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (emailTaken) throw new NetworkInputError("Este e-mail já tem cadastro. Entre pelo painel ou use outro e-mail.");

  const plan = input.planId
    ? await prisma.plan.findFirst({ where: { id: String(input.planId), active: true } })
    : await prisma.plan.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (input.planId && !plan) throw new NetworkInputError("Plano inválido.");

  const rawTrial = input.trialDays === undefined || input.trialDays === null || input.trialDays === ""
    ? plan?.trialDays ?? 14
    : Number(input.trialDays);
  if (!Number.isFinite(rawTrial) || rawTrial < 0 || rawTrial > 365) throw new NetworkInputError("Dias de teste inválidos.");
  const trialDays = Math.round(rawTrial);

  const domain = cleanHost(input.domain);
  if (domain) {
    const used = await prisma.tenantDomain.findUnique({ where: { host: domain }, select: { id: true } });
    if (used) throw new NetworkInputError("Este domínio já está em uso por outra rede.");
  }

  const slug = await uniqueTenantSlug(name);
  const hash = await bcrypt.hash(ownerPassword, 10);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        active: true,
        status: trialDays > 0 ? "trial" : "active",
        trialEndsAt: trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null,
        planId: plan?.id ?? null,
        billingEmail: ownerEmail,
        billingName: name,
        ...(domain ? { domains: { create: { host: domain } } } : {}),
      },
      select: { id: true, slug: true, name: true },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: ownerName,
        email: ownerEmail,
        password: hash,
        role: "owner",
        active: true,
      },
      select: { id: true, name: true, email: true, role: true, tenantId: true, storeId: true },
    });

    return { tenant, user };
  });
}
