import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canonicalCategoryKey,
  fallbackCategoryUi,
  shortCategoryName,
} from "@/lib/catalog/category";
import { loadStoreSettings } from "@/lib/store/settings";
import { enabledPaymentMethods, getOpenStatus } from "@/lib/store/settings-shared";
import { resolveTenantFromRequest } from "@/lib/tenant/resolve";
import { loadLivePromotions } from "@/lib/promotions/server";
import { bestPromoPrice } from "@/lib/promotions/pricing";

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
  original_price_cents: number | null;
  promo_title: string | null;
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

    const tenant = await resolveTenantFromRequest(req);

    if (!tenant) {
      return NextResponse.json(
        { ok: false, code: "TENANT_NOT_FOUND", error: "Rede não encontrada para este endereço." },
        { status: 404 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { ok: false, code: "STORE_REQUIRED", error: "Escolha uma loja." },
        { status: 400 }
      );
    }

    // A loja precisa ser da rede do dominio acessado.
    const store = await prisma.store.findFirst({
      where: { id: storeId, tenantId: tenant.id, active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        addressStreet: true,
        addressNumber: true,
        addressNeighborhood: true,
        tenantId: true,
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!store) {
      return NextResponse.json(
        { ok: false, code: "STORE_NOT_FOUND", error: "Loja não encontrada nesta rede." },
        { status: 404 }
      );
    }

    const [settings, categoryRows, productStores, promos] = await Promise.all([
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
      loadLivePromotions(store.id, store.tenantId),
    ]);

    let products: CatalogProduct[] = productStores.map((row) => {
      const listPrice = row.price_cents ?? row.product.price_cents;
      const promo = bestPromoPrice(row.product.id, listPrice, promos);
      return {
        id: row.product.id,
        name: row.product.name,
        description: row.product.description,
        image: row.product.image,
        category: canonicalCategoryKey(row.product.category || "outros"),
        customizationType: row.product.customizationType,
        // Preco ja com a promocao valendo; o original vai junto para aparecer riscado.
        price_cents: promo.priceCents,
        original_price_cents: promo.promo ? listPrice : null,
        promo_title: promo.promo?.title ?? null,
        stock: row.stock,
        featured: row.featured,
      };
    });

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

        products = legacy.map((p) => {
          const promo = bestPromoPrice(p.id, p.price_cents, promos);
          return {
            ...p,
            price_cents: promo.priceCents,
            original_price_cents: promo.promo ? p.price_cents : null,
            promo_title: promo.promo?.title ?? null,
            category: canonicalCategoryKey(p.category || "outros"),
            stock: 0,
            featured: false,
          };
        });
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
        // Endereco em uma linha (rodape do site); null se nao cadastrado.
        address:
          [
            [store.addressStreet, store.addressNumber].filter(Boolean).join(", "),
            store.addressNeighborhood,
            [store.city, store.state].filter(Boolean).join(" - "),
          ]
            .filter(Boolean)
            .join(", ") || null,
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
