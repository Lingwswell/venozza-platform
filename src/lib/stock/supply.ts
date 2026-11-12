import { prisma } from "@/lib/db";
import { ScopeError, canAccessStore, type AdminScope } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { CENTRAL, moveStock } from "@/lib/stock/server";
import { StockInputError } from "@/lib/stock/access";

// Ciclo do pedido de abastecimento:
// aberto -> separando (central) -> enviado (central, sai do estoque da central)
//        -> recebido (loja, entra no estoque da loja). Cancelar: loja (aberto) ou central (antes de enviar).

export type SupplyAction = "separate" | "send" | "receive" | "cancel";

type Quantities = Record<string, unknown>;

function readQuantity(raw: unknown, fallback: number) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new StockInputError("Quantidade inválida.");
  return Math.round(n * 1000) / 1000;
}

async function loadRequest(scope: AdminScope, id: string) {
  const request = await prisma.supplyRequest.findFirst({
    where: { id, tenantId: scope.tenantId },
    select: {
      id: true,
      storeId: true,
      status: true,
      store: { select: { name: true } },
      items: { select: { id: true, ingredientId: true, quantityRequested: true, quantitySent: true } },
    },
  });
  if (!request) throw new ScopeError("Pedido não encontrado.", 404);
  return request;
}

function isCentral(scope: AdminScope) {
  return can.manageCentralStock(scope.role);
}

function isStoreSide(scope: AdminScope, storeId: string) {
  return scope.role !== "kitchen_operator" && can.manageStoreStock(scope.role) && canAccessStore(scope, storeId);
}

/** Troca o status so se ainda estiver como esperado (evita enviar ou receber duas vezes). */
async function moveStatus(
  id: string,
  from: string[],
  data: { status: string; sentAt?: Date; receivedAt?: Date }
) {
  const result = await prisma.supplyRequest.updateMany({
    where: { id, status: { in: from } },
    data,
  });
  if (result.count === 0) {
    throw new ScopeError("Este pedido mudou enquanto você estava na tela. Atualize e confira.", 409);
  }
}

export async function runSupplyAction(
  scope: AdminScope,
  id: string,
  action: SupplyAction,
  quantities: Quantities = {}
) {
  const request = await loadRequest(scope, id);

  if (action === "separate") {
    if (!isCentral(scope)) throw new ScopeError("Só a cozinha central separa pedidos.", 403);
    await moveStatus(id, ["aberto"], { status: "separando" });
    return;
  }

  if (action === "send") {
    if (!isCentral(scope)) throw new ScopeError("Só a cozinha central envia pedidos.", 403);
    const lines = request.items.map((item) => ({
      ...item,
      sent: readQuantity(quantities[item.id], item.quantityRequested),
    }));
    if (lines.every((l) => l.sent <= 0)) throw new StockInputError("Informe o que está sendo enviado.");

    await moveStatus(id, ["aberto", "separando"], { status: "enviado", sentAt: new Date() });

    for (const line of lines) {
      await prisma.supplyRequestItem.update({ where: { id: line.id }, data: { quantitySent: line.sent } });
      if (line.sent > 0) {
        await moveStock({
          tenantId: scope.tenantId,
          ingredientId: line.ingredientId,
          location: CENTRAL,
          delta: -line.sent,
          type: "abastecimento",
          supplyRequestId: id,
          userId: scope.userId,
          note: `Enviado para ${request.store.name}`,
        });
      }
    }
    return;
  }

  if (action === "receive") {
    if (!isStoreSide(scope, request.storeId)) throw new ScopeError("Só a loja confirma o recebimento.", 403);
    const lines = request.items.map((item) => {
      const expected = item.quantitySent ?? item.quantityRequested;
      return { ...item, expected, received: readQuantity(quantities[item.id], expected) };
    });

    await moveStatus(id, ["enviado"], { status: "recebido", receivedAt: new Date() });

    for (const line of lines) {
      await prisma.supplyRequestItem.update({ where: { id: line.id }, data: { quantityReceived: line.received } });
      if (line.received > 0) {
        const diff = Math.round((line.received - line.expected) * 1000) / 1000;
        await moveStock({
          tenantId: scope.tenantId,
          ingredientId: line.ingredientId,
          location: request.storeId,
          delta: line.received,
          type: "abastecimento",
          supplyRequestId: id,
          userId: scope.userId,
          note: diff === 0 ? "Recebido da central" : `Recebido da central (diferença de ${diff} no envio)`,
        });
      }
    }
    return;
  }

  if (action === "cancel") {
    if (isCentral(scope)) {
      await moveStatus(id, ["aberto", "separando"], { status: "cancelado" });
      return;
    }
    if (!isStoreSide(scope, request.storeId)) throw new ScopeError("Você não pode cancelar este pedido.", 403);
    if (request.status !== "aberto") {
      throw new ScopeError("A central já começou este pedido; não dá mais para cancelar.", 409);
    }
    await moveStatus(id, ["aberto"], { status: "cancelado" });
    return;
  }

  throw new StockInputError("Ação inválida.");
}
