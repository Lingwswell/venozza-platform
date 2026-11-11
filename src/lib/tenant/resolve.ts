import { prisma } from "@/lib/db";

// Descobre qual rede (tenant) o visitante esta acessando, pelo dominio.
//
// Ordem:
// 1. Dominio cadastrado em tenant_domains (ex.: pedidos.venozza.com.br)
// 2. Subdominio da plataforma: <slug>.PLATFORM_ROOT_DOMAIN (ex.: venozza.suaplataforma.com.br)
// 3. DEFAULT_TENANT_SLUG do .env (acesso por IP no laboratorio)
// 4. Se so existe uma rede ativa, ela

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
};

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

export function normalizeHost(raw: string | null | undefined): string {
  return String(raw || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function getRequestHost(req: Request): string {
  return normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
}

const tenantSelect = { id: true, slug: true, name: true } as const;

export async function resolveTenantFromHost(host: string): Promise<ResolvedTenant | null> {
  if (host) {
    const domain = await prisma.tenantDomain.findUnique({
      where: { host },
      select: { tenant: { select: { ...tenantSelect, active: true } } },
    });

    if (domain?.tenant?.active) {
      const { id, slug, name } = domain.tenant;
      return { id, slug, name };
    }

    const root = normalizeHost(process.env.PLATFORM_ROOT_DOMAIN);
    if (root && host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
        const tenant = await prisma.tenant.findFirst({
          where: { slug: sub, active: true },
          select: tenantSelect,
        });
        if (tenant) return tenant;
      }
    }
  }

  const defaultSlug = String(process.env.DEFAULT_TENANT_SLUG || "").trim();
  if (defaultSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: defaultSlug, active: true },
      select: tenantSelect,
    });
    if (tenant) return tenant;
  }

  const active = await prisma.tenant.findMany({
    where: { active: true },
    select: tenantSelect,
    take: 2,
  });

  return active.length === 1 ? active[0] : null;
}

export async function resolveTenantFromRequest(req: Request) {
  return resolveTenantFromHost(getRequestHost(req));
}
