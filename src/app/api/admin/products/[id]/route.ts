import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLegacyAdminContext } from "@/lib/auth/admin-context";
import { scopeErrorResponse } from "@/lib/auth/scope";

async function getAdminContext(req: Request) {
  // Permissao vem so do token validado + banco (nunca de cabecalhos do navegador).
  return getLegacyAdminContext(req);
}

function normalizePriceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const normalized = value
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();

    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100);
    }
  }

  return 0;
}

function normalizeStock(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").trim());

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }

  return 0;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { tenantId, currentStoreId, role, scope } = await getAdminContext(req);

    if (!tenantId) {
      return NextResponse.json(
        {
          ok: false,
          error: "tenantId obrigatório",
        },
        { status: 400 }
      );
    }

    if (role === "customer") {
      return NextResponse.json(
        {
          ok: false,
          error: "Acesso administrativo obrigatório",
        },
        { status: 403 }
      );
    }

    const currentProduct = await prisma.product.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        storeId: true,
        tenantId: true,
      },
    });

    if (!currentProduct) {
      return NextResponse.json(
        {
          ok: false,
          error: "Produto não encontrado",
        },
        { status: 404 }
      );
    }

    // Produto precisa ser da rede do usuario.
    const belongsToTenant = currentProduct.tenantId
      ? currentProduct.tenantId === tenantId
      : !!(await prisma.store.findFirst({
          where: { id: currentProduct.storeId, tenantId },
          select: { id: true },
        }));

    if (!belongsToTenant) {
      return NextResponse.json(
        {
          ok: false,
          error: "Produto não pertence a este tenant",
        },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const customizationType = String(body.customizationType || "auto").trim() || "auto";
    const description = body.description ? String(body.description).trim() : null;
    const image = body.image ? String(body.image).trim() : null;
    const available = body.available !== false;
    const stock = normalizeStock(body.stock);
    // So altera o destaque quando o campo vier no corpo.
    const featured = typeof body.featured === "boolean" ? body.featured : undefined;

    const requestedStoreId = String(
      body.storeId || body.store_id || currentProduct.storeId
    ).trim();

    // Usuario de loja: so mexe no preco/estoque/disponibilidade das lojas dele.
    const storeId =
      role === "operator"
        ? scope.storeIds.includes(requestedStoreId)
          ? requestedStoreId
          : currentStoreId || ""
        : requestedStoreId;

    if (role === "operator" && !scope.storeIds.includes(storeId)) {
      return NextResponse.json(
        { ok: false, error: "Você não tem acesso a esta loja." },
        { status: 403 }
      );
    }

    const priceCents = normalizePriceCents(
      typeof body.price_cents !== "undefined" ? body.price_cents : body.price
    );

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nome do produto é obrigatório",
        },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        {
          ok: false,
          error: "Categoria é obrigatória",
        },
        { status: 400 }
      );
    }

    if (!priceCents || priceCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Preço precisa ser maior que zero",
        },
        { status: 400 }
      );
    }

    const targetStore = await prisma.store.findFirst({
      where: {
        id: storeId,
        tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!targetStore) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loja inválida para este tenant",
        },
        { status: 400 }
      );
    }

    // Dono da rede edita o cadastro do produto; usuario de loja so a parte da loja
    // (preco, estoque, disponibilidade, destaque) — o cadastro central fica igual.
    const [product, productStore] = await prisma.$transaction([
      prisma.product.update({
        where: {
          id,
        },
        data:
          role === "operator"
            ? {}
            : {
                tenantId,
                name,
                category,
                customizationType,
                description,
                image,
                available,
                price_cents: priceCents,
                storeId: targetStore.id,
              },
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          category: true,
          customizationType: true,
          available: true,
          price_cents: true,
          storeId: true,
          createdAt: true,
        },
      }),
      prisma.productStore.upsert({
        where: {
          productId_storeId: {
            productId: id,
            storeId: targetStore.id,
          },
        },
        update: {
          available,
          stock,
          price_cents: priceCents,
          ...(typeof featured === "boolean" ? { featured } : {}),
        },
        create: {
          productId: id,
          storeId: targetStore.id,
          available,
          stock,
          price_cents: priceCents,
          featured: featured === true,
        },
        select: {
          id: true,
          available: true,
          stock: true,
          featured: true,
          price_cents: true,
          storeId: true,
        },
      }),
    ]);

    const effectivePriceCents =
      typeof productStore.price_cents === "number"
        ? productStore.price_cents
        : product.price_cents;

    return NextResponse.json({
      ok: true,
      product: {
        ...product,
        productStoreId: productStore.id,
        available: productStore.available && product.available,
        storeAvailable: productStore.available,
        productAvailable: product.available,
        stock: productStore.stock,
        featured: productStore.featured,
        price_cents: effectivePriceCents,
        price: effectivePriceCents / 100,
        storeId: productStore.storeId,
        store: targetStore,
        source: "productStore",
      },
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/products/:id][PATCH]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao editar produto",
      },
      { status: 500 }
    );
  }
}
