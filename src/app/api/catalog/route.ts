import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canonicalCategoryKey,
  fallbackCategoryUi,
  shortCategoryName,
} from "@/lib/catalog/category";
import { loadStoreSettings } from "@/lib/store/settings";
import { enabledPaymentMethods, getOpenStatus } from "@/lib/store/settings-shared";

// Catalogo publico de uma loja: a mesma resposta alimenta o app (/m) e o site (/).
// Tudo vem do banco: loja, marca (tenant), categorias, produtos, destaques e regras.

type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  category: string;
  customizationType: string;
  price_cents: number;
  stock: number;
  featured: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storeId = (
      url.searchParams.get("storeId") ||
      req.headers.get("x-store-id") ||
      ""
    ).trim();

    if (!storeId) {
      return NextResponse.json({ ok: false, error: "Loja não informada." }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { id: storeId, active: true, tenant: { active: true } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        tenantId: true,
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!store) {
      return NextResponse.json({ ok: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const [settings, categoryRows, productStores] = await Promise.all([
      loadStoreSettings(store.id),
      prisma.category.findMany({
        where: { tenantId: store.tenantId },
        select: {
          name: true,
          slug: true,
          icon: true,
          sortOrder: true,
          active: true,
          showInMobile: true,
          showInSite: true,
        },
      }),
      prisma.productStore.findMany({
        where: {
          storeId: store.id,
          available: true,
          stock: { gt: 0 },
          product: { available: true },
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
              price_cents: true,
            },
          },
        },
        orderBy: { product: { name: "asc" } },
      }),
    ]);

    let products: CatalogProduct[] = productStores.map((row) => ({
      id: row.product.id,
      name: row.product.name,
      description: row.product.description,
      image: row.product.image,
      category: canonicalCategoryKey(row.product.category || "outros"),
      customizationType: row.product.customizationType,
      price_cents: row.price_cents ?? row.product.price_cents,
      stock: row.stock,
      featured: row.featured,
    }));

    // Lojas antigas, sem nenhum vinculo em product_stores: usa o cadastro legado.
    if (products.length === 0) {
      const hasAnyLink = await prisma.productStore.count({ where: { storeId: store.id } });

      if (hasAnyLink === 0) {
        const legacy = await prisma.product.findMany({
          where: { storeId: store.id, available: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            category: true,
            customizationType: true,
            price_cents: true,
          },
        });

        products = legacy.map((p) => ({
          ...p,
          category: canonicalCategoryKey(p.category || "outros"),
          stock: 0,
          featured: false,
        }));
      }
    }

    const categoryByKey = new Map(
      categoryRows.map((row) => [canonicalCategoryKey(row.slug || row.name), row])
    );

    // Categoria desativada no admin esconde os produtos dela.
    products = products.filter((p) => categoryByKey.get(p.category)?.active !== false);

    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) || 0) + 1);

    const noneMarkedForSite = !categoryRows.some((row) => row.active && row.showInSite);

    const categories = Array.from(counts.entries())
      .map(([key, count]) => {
        const row = categoryByKey.get(key);
        const fallback = fallbackCategoryUi(key);
        const label = row?.name || fallback.label;

        return {
          key,
          label,
          shortName: shortCategoryName(label),
          icon: row?.icon || fallback.icon,
          sortOrder: row?.sortOrder ?? 999,
          count,
          showInMobile: row ? row.showInMobile : true,
          // Enquanto nenhuma categoria for marcada para o site, o site mostra as do app.
          showInSite: row ? row.showInSite || (noneMarkedForSite && row.showInMobile) : true,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR"));

    return NextResponse.json({
      ok: true,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        city: store.city,
        state: store.state,
        tenantId: store.tenantId,
        brandName: store.tenant.name,
      },
      settings: {
        deliveryTimeMinMinutes: settings.deliveryTimeMinMinutes,
        deliveryTimeMaxMinutes: settings.deliveryTimeMaxMinutes,
        minimumOrderCents: settings.minimumOrderCents,
        deliveryFeeCents: settings.deliveryFeeCents,
        freeDeliveryAboveCents: settings.freeDeliveryAboveCents,
        whatsapp: settings.whatsapp,
      },
      status: getOpenStatus(settings),
      paymentMethods: enabledPaymentMethods(settings),
      categories,
      products,
    });
  } catch (error) {
    console.error("[api/catalog][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar o cardápio." },
      { status: 500 }
    );
  }
}
