import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse, storeFilter } from "@/lib/auth/scope";

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);

    const url = new URL(req.url);
    const requestedStoreId = url.searchParams.get("storeId")?.trim() || null;

    // Usuario de uma loja so: sempre a loja dele. Varias lojas: a escolhida ou todas as dele.
    const effectiveStoreId =
      scope.storeIds.length === 1 && !scope.networkWide ? scope.storeIds[0] : requestedStoreId;

    const where = {
      tenantId: scope.tenantId,
      ...storeFilter(scope, effectiveStoreId),
      status: {
        in: ["novo", "preparo", "pronto", "saiu_entrega"],
      },
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      role: scope.role,
      currentStoreId: scope.primaryStoreId,
      selectedStoreId: effectiveStoreId,
      orders,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/kds][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar KDS" },
      { status: 500 }
    );
  }
}
