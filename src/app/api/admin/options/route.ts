import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function toInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function toBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function canManageOptions(role: string | null | undefined) {
  return ["owner", "admin", "super_admin"].includes(
    String(role || "").toLowerCase()
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContextFromRequest(request);

    if (!auth?.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 401 }
      );
    }

    if (!canManageOptions(auth.role)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão para listar opções" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const categorySlug = searchParams.get("categorySlug");
    const type = searchParams.get("type");

    const groups = await prisma.optionGroup.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(includeInactive ? {} : { active: true }),
        ...(type ? { type } : {}),
        ...(categorySlug
          ? {
              categoryOptionGroups: {
                some: {
                  active: true,
                  category: {
                    slug: categorySlug,
                    tenantId: auth.tenantId,
                  },
                },
              },
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: includeInactive ? {} : { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            storeOptionAvailabilities: {
              include: {
                store: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    active: true,
                  },
                },
              },
            },
          },
        },
        categoryOptionGroups: {
          where: includeInactive ? {} : { active: true },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                active: true,
                showInMobile: true,
                showInSite: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }],
        },
        productOptionGroups: {
          where: includeInactive ? {} : { active: true },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                customizationType: true,
                available: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }],
        },
      },
    });

    return NextResponse.json({
      ok: true,
      role: auth.role,
      tenantId: auth.tenantId,
      total: groups.length,
      groups,
    });
  } catch (error) {
    console.error("[api/admin/options][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao listar opções de montagem" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContextFromRequest(request);

    if (!auth?.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 401 }
      );
    }

    if (!canManageOptions(auth.role)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão para criar opções" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const name = normalizeText(body.name);
    const slug = slugify(normalizeText(body.slug) || name);
    const description = normalizeText(body.description) || null;
    const type = normalizeText(body.type) || "generic";
    const required = toBool(body.required, false);
    const minSelect = toInt(body.minSelect, required ? 1 : 0);
    const maxSelect = Math.max(toInt(body.maxSelect, 1), minSelect);
    const sortOrder = toInt(body.sortOrder, 0);
    const active = toBool(body.active, true);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Nome do grupo é obrigatório" },
        { status: 400 }
      );
    }

    const categoryIds = Array.isArray(body.categoryIds)
      ? body.categoryIds.map(String).filter(Boolean)
      : [];

    const items = Array.isArray(body.items) ? body.items : [];

    const group = await prisma.$transaction(async (tx) => {
      const createdGroup = await tx.optionGroup.create({
        data: {
          tenantId: auth.tenantId!,
          name,
          slug,
          description,
          type,
          required,
          minSelect,
          maxSelect,
          sortOrder,
          active,
        },
      });

      const stores = await tx.store.findMany({
        where: {
          tenantId: auth.tenantId!,
          active: true,
        },
        select: { id: true },
      });

      for (const [index, rawItem] of items.entries()) {
        const itemName = normalizeText(rawItem?.name);
        if (!itemName) continue;

        const itemSlug = slugify(normalizeText(rawItem?.slug) || itemName);

        const item = await tx.optionItem.create({
          data: {
            tenantId: auth.tenantId!,
            optionGroupId: createdGroup.id,
            name: itemName,
            slug: itemSlug,
            description: normalizeText(rawItem?.description) || null,
            price_cents: toInt(rawItem?.price_cents, 0),
            sortOrder: toInt(rawItem?.sortOrder, index + 1),
            active: toBool(rawItem?.active, true),
          },
        });

        for (const store of stores) {
          await tx.storeOptionAvailability.create({
            data: {
              storeId: store.id,
              optionItemId: item.id,
              available: true,
              stock: null,
              price_cents: null,
            },
          });
        }
      }

      for (const [index, categoryId] of categoryIds.entries()) {
        const category = await tx.category.findFirst({
          where: {
            id: categoryId,
            tenantId: auth.tenantId!,
          },
          select: { id: true },
        });

        if (!category) continue;

        await tx.categoryOptionGroup.create({
          data: {
            categoryId: category.id,
            optionGroupId: createdGroup.id,
            sortOrder: sortOrder + index,
            active: true,
          },
        });
      }

      return tx.optionGroup.findUnique({
        where: { id: createdGroup.id },
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              storeOptionAvailabilities: true,
            },
          },
          categoryOptionGroups: {
            include: {
              category: true,
            },
          },
          productOptionGroups: true,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      group,
    });
  } catch (error: any) {
    console.error("[api/admin/options][POST]", error);

    if (String(error?.code) === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Já existe um grupo ou item com esse slug" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Erro ao criar opção de montagem" },
      { status: 500 }
    );
  }
}
