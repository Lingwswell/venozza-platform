import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

async function findGroupForTenant(id: string, tenantId: string) {
  return prisma.optionGroup.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      items: {
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
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthContextFromRequest(request);
    const { id } = await context.params;

    if (!auth?.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 401 }
      );
    }

    if (!canManageOptions(auth.role)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão para ver opções" },
        { status: 403 }
      );
    }

    const group = await findGroupForTenant(id, auth.tenantId);

    if (!group) {
      return NextResponse.json(
        { ok: false, error: "Grupo de opções não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      group,
    });
  } catch (error) {
    console.error("[api/admin/options/[id]][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao buscar grupo de opções" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthContextFromRequest(request);
    const { id } = await context.params;

    if (!auth?.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 401 }
      );
    }

    if (!canManageOptions(auth.role)) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão para editar opções" },
        { status: 403 }
      );
    }

    const existing = await prisma.optionGroup.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Grupo de opções não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = normalizeText(body.name);
      if (!name) {
        return NextResponse.json(
          { ok: false, error: "Nome do grupo não pode ficar vazio" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if ("slug" in body) {
      const slug = slugify(normalizeText(body.slug));
      if (!slug) {
        return NextResponse.json(
          { ok: false, error: "Slug do grupo não pode ficar vazio" },
          { status: 400 }
        );
      }
      data.slug = slug;
    }

    if ("description" in body) data.description = normalizeText(body.description) || null;
    if ("type" in body) data.type = normalizeText(body.type) || "generic";
    if ("required" in body) data.required = toBool(body.required, false);
    if ("minSelect" in body) data.minSelect = toInt(body.minSelect, 0);
    if ("maxSelect" in body) data.maxSelect = toInt(body.maxSelect, 1);
    if ("sortOrder" in body) data.sortOrder = toInt(body.sortOrder, 0);
    if ("active" in body) data.active = toBool(body.active, true);

    const categoryIds = Array.isArray(body.categoryIds)
      ? body.categoryIds.map(String).filter(Boolean)
      : null;

    const items = Array.isArray(body.items) ? body.items : null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.optionGroup.update({
          where: { id },
          data,
        });
      }

      if (categoryIds) {
        await tx.categoryOptionGroup.deleteMany({
          where: {
            optionGroupId: id,
          },
        });

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
              optionGroupId: id,
              sortOrder: toInt(body.sortOrder, 0) + index,
              active: true,
            },
          });
        }
      }

      if (items) {
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

          const itemId = normalizeText(rawItem?.id);
          const itemSlug = slugify(normalizeText(rawItem?.slug) || itemName);

          let savedItem;

          if (itemId) {
            const existingItem = await tx.optionItem.findFirst({
              where: {
                id: itemId,
                tenantId: auth.tenantId!,
                optionGroupId: id,
              },
              select: { id: true },
            });

            if (!existingItem) continue;

            savedItem = await tx.optionItem.update({
              where: { id: existingItem.id },
              data: {
                name: itemName,
                slug: itemSlug,
                description: normalizeText(rawItem?.description) || null,
                price_cents: toInt(rawItem?.price_cents, 0),
                sortOrder: toInt(rawItem?.sortOrder, index + 1),
                active: toBool(rawItem?.active, true),
              },
            });
          } else {
            savedItem = await tx.optionItem.upsert({
              where: {
                optionGroupId_slug: {
                  optionGroupId: id,
                  slug: itemSlug,
                },
              },
              update: {
                name: itemName,
                description: normalizeText(rawItem?.description) || null,
                price_cents: toInt(rawItem?.price_cents, 0),
                sortOrder: toInt(rawItem?.sortOrder, index + 1),
                active: toBool(rawItem?.active, true),
              },
              create: {
                tenantId: auth.tenantId!,
                optionGroupId: id,
                name: itemName,
                slug: itemSlug,
                description: normalizeText(rawItem?.description) || null,
                price_cents: toInt(rawItem?.price_cents, 0),
                sortOrder: toInt(rawItem?.sortOrder, index + 1),
                active: toBool(rawItem?.active, true),
              },
            });
          }

          for (const store of stores) {
            await tx.storeOptionAvailability.upsert({
              where: {
                storeId_optionItemId: {
                  storeId: store.id,
                  optionItemId: savedItem.id,
                },
              },
              update: {},
              create: {
                storeId: store.id,
                optionItemId: savedItem.id,
                available: true,
                stock: null,
                price_cents: null,
              },
            });
          }
        }
      }
    });

    const group = await findGroupForTenant(id, auth.tenantId);

    return NextResponse.json({
      ok: true,
      group,
    });
  } catch (error: any) {
    console.error("[api/admin/options/[id]][PATCH]", error);

    if (String(error?.code) === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Já existe um grupo ou item com esse slug" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar grupo de opções" },
      { status: 500 }
    );
  }
}
