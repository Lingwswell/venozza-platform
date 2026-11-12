import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { effectiveMin } from "@/lib/stock/server";
import { isBelowMin } from "@/lib/stock/consumption";

// Contador do menu Estoque:
// - central: pedidos esperando separar/enviar;
// - loja: insumos abaixo do minimo + envios da central esperando confirmar o recebimento.
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.viewStock(scope.role)) return NextResponse.json({ ok: true, count: 0 });

    let central = 0;
    let low = 0;
    let toReceive = 0;

    if (can.manageCentralStock(scope.role)) {
      central = await prisma.supplyRequest.count({
        where: { tenantId: scope.tenantId, status: { in: ["aberto", "separando"] } },
      });
    }

    if (scope.role !== "kitchen_operator" && scope.storeIds.length > 0) {
      const [ingredients, sent] = await Promise.all([
        prisma.ingredient.findMany({
          where: { tenantId: scope.tenantId, active: true },
          select: {
            minStore: true,
            stockLevels: {
              where: { location: { in: scope.storeIds } },
              select: { location: true, quantity: true, minQuantity: true },
            },
          },
        }),
        prisma.supplyRequest.count({
          where: { tenantId: scope.tenantId, storeId: { in: scope.storeIds }, status: "enviado" },
        }),
      ]);
      toReceive = sent;
      for (const ing of ingredients) {
        for (const level of ing.stockLevels) {
          if (isBelowMin(level.quantity, effectiveMin(level.location, level, ing))) low += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, count: central + low + toReceive, central, low, toReceive });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/alerts][GET]", error);
    return NextResponse.json({ ok: false, count: 0 }, { status: 500 });
  }
}
