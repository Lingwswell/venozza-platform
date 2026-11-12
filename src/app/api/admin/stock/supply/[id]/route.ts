import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertLocation, stockFail } from "@/lib/stock/access";

// Loja cancela um pedido que a central ainda nao comecou a separar.
// (Separar, enviar e receber chegam na proxima entrega, com o painel da central.)
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const request = await prisma.supplyRequest.findFirst({
      where: { id, tenantId: scope.tenantId },
      select: { id: true, storeId: true, status: true },
    });
    if (!request) return stockFail("Pedido não encontrado.", 404);
    assertLocation(scope, request.storeId, true);

    if (body.action !== "cancel") return stockFail("Ação inválida.", 400);
    if (request.status !== "aberto") return stockFail("A central já começou este pedido; não dá mais para cancelar.", 409);

    await prisma.supplyRequest.update({ where: { id }, data: { status: "cancelado" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/supply/:id][PATCH]", error);
    return stockFail("Erro ao cancelar o pedido.", 500);
  }
}
