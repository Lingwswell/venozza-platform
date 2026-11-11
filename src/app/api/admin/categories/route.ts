import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLegacyAdminContext } from "@/lib/auth/admin-context";
import { scopeErrorResponse } from "@/lib/auth/scope";

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
  // Permissao vem so do token validado + banco (nunca de cabecalhos do navegador).
  return getLegacyAdminContext(req);
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
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
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
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/categories][POST]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao criar categoria" },
      { status: 500 }
    );
  }
}
