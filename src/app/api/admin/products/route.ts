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

async function getAdminContext(req: Request) {
  let auth: AuthContext = {};

  try {
    auth = await getAuthContextFromRequest(req);
  } catch (error) {
    console.warn("[api/admin/products][auth fallback]", error);
    auth = {};
  }

  const headerTenantId = req.headers.get("x-tenant-id");
  const headerStoreId = req.headers.get("x-store-id");
  const headerRole = normalizeRole(req.headers.get("x-user-role"));

  const authRole = normalizeRole(auth.role);

  const tenantId = auth.tenantId || headerTenantId;
  const currentStoreId = auth.storeId || headerStoreId;

  const role =
    authRole !== "customer"
      ? authRole
      : headerRole !== "customer"
        ? headerRole
        : authRole;

  return {
    tenantId,
    currentStoreId,
    role,
  };
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const queryStoreId = url.searchParams.get("storeId");

    const { tenantId, currentStoreId, role } = await getAdminContext(req);

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

    const stores = await prisma.store.findMany({
      where: {
        tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const allowedStoreIds = stores.map((store) => store.id);

    const effectiveStoreId =
      role === "operator"
        ? currentStoreId
        : queryStoreId && queryStoreId !== "all"
          ? queryStoreId
          : null;

    if (role === "operator" && !currentStoreId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Operador sem loja vinculada",
        },
        { status: 400 }
      );
    }

    const productStores = await prisma.productStore.findMany({
      where: {
        storeId: effectiveStoreId
          ? effectiveStoreId
          : {
              in: allowedStoreIds,
            },
      },
      include: {
        product: {
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
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: [{ storeId: "asc" }, { productId: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      role,
      tenantId,
      currentStoreId,
      selectedStoreId: effectiveStoreId || "all",
      stores,
      products: productStores.map((productStore) => {
        const price_cents =
          typeof productStore.price_cents === "number"
            ? productStore.price_cents
            : productStore.product.price_cents;

        return {
          id: productStore.product.id,
          productStoreId: productStore.id,
          name: productStore.product.name,
          description: productStore.product.description,
          image: productStore.product.image,
          category: productStore.product.category,
          customizationType: productStore.product.customizationType,
          available: productStore.available && productStore.product.available,
          productAvailable: productStore.product.available,
          storeAvailable: productStore.available,
          stock: productStore.stock,
          price_cents,
          price: price_cents / 100,
          storeId: productStore.storeId,
          store: productStore.store,
          createdAt: productStore.product.createdAt,
          source: "productStore",
        };
      }),
    });
  } catch (error) {
    console.error("[api/admin/products][GET]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao listar produtos",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, currentStoreId, role } = await getAdminContext(req);

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

    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const customizationType = String(body.customizationType || "auto").trim() || "auto";
    const description = body.description ? String(body.description).trim() : null;
    const image = body.image ? String(body.image).trim() : null;
    const available = body.available !== false;

    const createForAllStores = body.allStores === true && role !== "operator";

    const requestedStoreId = String(body.storeId || body.store_id || "").trim();
    const storeId =
      role === "operator"
        ? String(currentStoreId || "")
        : requestedStoreId;

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

    if (!storeId && !createForAllStores) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loja é obrigatória",
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

    if (createForAllStores) {
      const stores = await prisma.store.findMany({
        where: {
          tenantId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      if (stores.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Nenhuma loja ativa encontrada para este tenant",
          },
          { status: 400 }
        );
      }

      const createdProducts = await prisma.$transaction(
        stores.map((store) =>
          prisma.product.create({
            data: {
              name,
              category,
              customizationType,
              description,
              image,
              available,
              price_cents: priceCents,
              storeId: store.id,
              productStores: {
                create: {
                  storeId: store.id,
                  available,
                  stock: 0,
                  price_cents: priceCents,
                },
              },
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
          })
        )
      );

      return NextResponse.json(
        {
          ok: true,
          mode: "all_stores",
          count: createdProducts.length,
          products: createdProducts.map((product) => ({
            ...product,
            price: product.price_cents / 100,
          })),
        },
        { status: 201 }
      );
    }

    const store = await prisma.store.findFirst({
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

    if (!store) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loja inválida para este tenant",
        },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        category,
        customizationType,
        description,
        image,
        available,
        price_cents: priceCents,
        storeId: store.id,
        productStores: {
          create: {
            storeId: store.id,
            available,
            stock: 0,
            price_cents: priceCents,
          },
        },
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
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "single_store",
        product: {
          ...product,
          price: product.price_cents / 100,
          store,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/admin/products][POST]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao criar produto",
      },
      { status: 500 }
    );
  }
}
