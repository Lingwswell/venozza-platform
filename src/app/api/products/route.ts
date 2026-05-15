import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const queryStoreId = url.searchParams.get("storeId");
    const headerStoreId = req.headers.get("x-store-id");

    const storeId = queryStoreId || headerStoreId || null;

    if (storeId) {
      const productStores = await prisma.productStore.findMany({
        where: {
          storeId,
          available: true,
          product: {
            available: true,
          },
        },
        orderBy: {
          product: {
            name: "asc",
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
              storeId: true,
              price_cents: true,
              createdAt: true,
            },
          },
        },
      });

      if (productStores.length > 0) {
        return NextResponse.json({
          ok: true,
          source: "productStore",
          storeId,
          items: productStores.map((row) => {
            const priceCents = row.price_cents ?? row.product.price_cents;
            const stock = Number(row.stock ?? 0);
            const isAvailable = row.available && row.product.available && stock > 0;

            return {
              id: row.product.id,
              productStoreId: row.id,
              name: row.product.name,
              description: row.product.description,
              image: row.product.image,
              category: row.product.category,
              customizationType: row.product.customizationType,
              active: isAvailable,
              available: isAvailable,
              stock,
              stockStatus: stock <= 0 ? "out_of_stock" : "available",
              storeId: row.storeId,
              baseStoreId: row.product.storeId,
              price_cents: priceCents,
              price: priceCents / 100,
              createdAt: row.product.createdAt,
            };
          }),
        });
      }
    }

    const products = await prisma.product.findMany({
      where: {
        available: true,
        ...(storeId ? { storeId } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        category: true,
        customizationType: true,
        available: true,
        storeId: true,
        price_cents: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      source: "legacyProduct",
      storeId,
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        category: product.category,
        customizationType: product.customizationType,
        active: product.available,
        available: product.available,
        storeId: product.storeId,
        price_cents: product.price_cents,
        price: product.price_cents / 100,
        createdAt: product.createdAt,
      })),
    });
  } catch (error) {
    console.error("[api/products][GET]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao listar produtos.",
      },
      { status: 500 }
    );
  }
}
