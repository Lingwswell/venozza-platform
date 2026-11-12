import { NextResponse } from "next/server";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { StockInputError, stockFail } from "@/lib/stock/access";
import { runSupplyAction, type SupplyAction } from "@/lib/stock/supply";

const ACTIONS: SupplyAction[] = ["separate", "send", "receive", "cancel"];

// Separar / enviar (central), receber (loja), cancelar.
// body: { action, quantities?: { [itemId]: numero } } (quantidades na unidade base)
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "") as SupplyAction;
    if (!ACTIONS.includes(action)) return stockFail("Ação inválida.", 400);

    const quantities =
      body.quantities && typeof body.quantities === "object" ? (body.quantities as Record<string, unknown>) : {};

    await runSupplyAction(scope, id, action, quantities);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock/supply/:id][PATCH]", error);
    return stockFail("Erro ao atualizar o pedido.", 500);
  }
}
