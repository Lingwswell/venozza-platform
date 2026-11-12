import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ScopeError, canAccessStore, type AdminScope } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { CENTRAL } from "@/lib/stock/server";

// Quem ve e quem mexe em cada local de estoque (loja ou cozinha central).

export type StockLocation = { id: string; name: string; central: boolean };

export class StockInputError extends Error {}

/** Locais que o usuario enxerga: cozinha central (se for dele) e as lojas dele. */
export async function stockLocations(scope: AdminScope): Promise<StockLocation[]> {
  const list: StockLocation[] = [];
  if (can.manageCentralStock(scope.role)) list.push({ id: CENTRAL, name: "Cozinha central", central: true });

  if (scope.role !== "kitchen_operator" && can.viewStock(scope.role)) {
    const stores = await prisma.store.findMany({
      where: { tenantId: scope.tenantId, id: { in: scope.storeIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    for (const s of stores) list.push({ id: s.id, name: s.name, central: false });
  }
  return list;
}

/** Confere o acesso ao local; write = pode lancar entrada, acerto, minimo. */
export function assertLocation(scope: AdminScope, location: string, write: boolean) {
  if (!can.viewStock(scope.role)) throw new ScopeError("Sem acesso ao estoque.", 403);

  if (location === CENTRAL) {
    if (!can.manageCentralStock(scope.role)) {
      throw new ScopeError("Só a rede e a cozinha central mexem no estoque da central.", 403);
    }
    return;
  }

  if (scope.role === "kitchen_operator" || !canAccessStore(scope, location)) {
    throw new ScopeError("Você não tem acesso a esta loja.", 403);
  }
  if (write && !can.manageStoreStock(scope.role)) {
    throw new ScopeError("Seu papel não altera o estoque.", 403);
  }
}

/** Numero positivo (aceita "1,5"). */
export function positiveNumber(value: unknown, label: string) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new StockInputError(`${label}: informe um número maior que zero.`);
  if (n > 1e9) throw new StockInputError(`${label}: número grande demais.`);
  return Math.round(n * 1000) / 1000;
}

/** Numero >= 0 ou null (campo vazio). */
export function optionalNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new StockInputError(`${label}: informe um número válido.`);
  return Math.round(n * 1000) / 1000;
}

export function stockFail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Campos de um pedido de abastecimento devolvidos pelas APIs. */
export const supplySelect = {
  id: true,
  status: true,
  origin: true,
  note: true,
  sentAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
  store: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      quantityRequested: true,
      quantitySent: true,
      quantityReceived: true,
      ingredient: { select: { id: true, name: true, unit: true } },
    },
  },
} as const;
