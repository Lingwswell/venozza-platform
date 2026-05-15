import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

type AdminRole = "super_admin" | "owner" | "operator" | "customer";

type AuthContext = {
  tenantId?: string | null;
  storeId?: string | null;
  role?: string | null;
};

function normalizeRole(role: string | null | undefined): AdminRole {
  if (role === "super_admin") return "super_admin";
  if (role === "owner") return "owner";
  if (role === "operator") return "operator";
  return "customer";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getAdminContext(req: Request) {
  let auth: AuthContext = {};

  try {
    auth = await getAuthContextFromRequest(req);
  } catch (error) {
    console.warn("[api/admin/categories][auth fallback]", error);
    auth = {};
  }

  const headerTenantId = req.headers.get("x-tenant-id");
  const headerRole = normalizeRole(req.headers.get("x-user-role"));
  const authRole = normalizeRole(auth.role);

  const tenantId = auth.tenantId || headerTenantId;

  const role =
    authRole !== "customer"
      ? authRole
      : headerRole !== "customer"
        ? headerRole
        : authRole;

  return {
    tenantId,
    role,
  };
}

export async function GET(req: Request) {
  try {
    const { tenantId, role } = await getAdminContext(req);

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    if (role === "customer") {
      return NextResponse.json(
        { ok: false, error: "Acesso administrativo obrigatório" },
        { status: 403 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        icon: true,
        sortOrder: true,
        active: true,
        showInMobile: true,
        showInSite: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      role,
      tenantId,
      categories,
    });
  } catch (error) {
    console.error("[api/admin/categories][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao listar categorias" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getAdminContext(req);

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    if (role !== "owner" && role !== "super_admin") {
      return NextResponse.json(
        { ok: false, error: "Apenas owner pode criar categorias" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const slug = slugify(String(body.slug || name));
    const icon = body.icon ? String(body.icon).trim() : null;
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : 0;
    const active = body.active !== false;
    const showInMobile = body.showInMobile !== false;
    const showInSite = body.showInSite === true;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Nome da categoria é obrigatório" },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug da categoria é obrigatório" },
        { status: 400 }
      );
    }

    const category = await prisma.category.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
      update: {
        name,
        icon,
        sortOrder,
        active,
        showInMobile,
        showInSite,
      },
      create: {
        tenantId,
        name,
        slug,
        icon,
        sortOrder,
        active,
        showInMobile,
        showInSite,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        icon: true,
        sortOrder: true,
        active: true,
        showInMobile: true,
        showInSite: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/admin/categories][POST]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao criar categoria" },
      { status: 500 }
    );
  }
}
