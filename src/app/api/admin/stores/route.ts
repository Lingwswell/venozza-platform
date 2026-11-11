import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can, isMultiStoreRole } from "@/lib/auth/roles";
import {
  StoreInputError,
  parseStoreInput,
  serializeStore,
  slugifyStore,
  storeAdminSelect,
} from "@/lib/store/store-input";

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);

    // ?all=1 (tela Lojas): dono da rede tambem ve lojas desativadas para poder reativar.
    const includeInactive = new URL(req.url).searchParams.get("all") === "1" && scope.networkWide;

    const stores = await prisma.store.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(scope.networkWide ? {} : { id: { in: scope.storeIds } }),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
      select: storeAdminSelect,
    });

    return NextResponse.json({
      ok: true,
      role: scope.role,
      multiStore: isMultiStoreRole(scope.role) && stores.length > 1,
      currentStoreId: scope.primaryStoreId,
      tenantId: scope.tenantId,
      stores: stores.map(serializeStore),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stores][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar lojas" }, { status: 500 });
  }
}

// Criar loja (dono da rede ou super_admin). Opcional: copyFromStoreId copia o cardapio.
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const tenantId = scope.tenantId;

    if (!can.manageStores(scope.role)) {
      return NextResponse.json({ ok: false, error: "Só o dono da rede pode criar lojas." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseStoreInput({ ...body, name: body.name ?? "" });

    const slug = input.slug || slugifyStore(input.name || "");
    if (!slug) {
      return NextResponse.json({ ok: false, error: "Nome da loja é obrigatório." }, { status: 400 });
    }

    const exists = await prisma.store.findFirst({ where: { tenantId, slug }, select: { id: true } });
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "Já existe uma loja com esse identificador nesta rede." },
        { status: 409 }
      );
    }

    const copyFromStoreId = typeof body.copyFromStoreId === "string" ? body.copyFromStoreId : "";
    const source = copyFromStoreId
      ? await prisma.store.findFirst({ where: { id: copyFromStoreId, tenantId }, select: { id: true } })
      : null;

    if (copyFromStoreId && !source) {
      return NextResponse.json({ ok: false, error: "Loja de origem do cardápio inválida." }, { status: 400 });
    }

    const store = await prisma.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: { ...input, name: input.name || slug, slug, tenantId },
        select: storeAdminSelect,
      });

      if (source) {
        const rows = await tx.productStore.findMany({
          where: { storeId: source.id },
          select: { productId: true, available: true, price_cents: true, featured: true, stock: true },
        });

        if (rows.length > 0) {
          // Copia preco, disponibilidade, destaque e estoque; a loja nova ajusta depois.
          await tx.productStore.createMany({
            data: rows.map((row) => ({ ...row, storeId: created.id })),
          });
        }

        // Opcoes (tamanho, borda, massa, bebidas): copia precos proprios e o que estiver desligado.
        const optionRows = await tx.storeOptionAvailability.findMany({
          where: { storeId: source.id },
          select: { optionItemId: true, available: true, stock: true, price_cents: true },
        });
        if (optionRows.length > 0) {
          await tx.storeOptionAvailability.createMany({
            data: optionRows.map((row) => ({ ...row, storeId: created.id })),
          });
        }

        // Configuracoes (horario, taxa, pedido minimo, pagamentos); a loja comeca aberta.
        const settings = await tx.storeSettings.findUnique({ where: { storeId: source.id } });
        if (settings) {
          await tx.storeSettings.create({
            data: {
              storeId: created.id,
              manualClosed: false,
              closedMessage: settings.closedMessage,
              timezone: settings.timezone,
              ...(settings.openingHours !== null
                ? { openingHours: settings.openingHours as Prisma.InputJsonValue }
                : {}),
              deliveryTimeMinMinutes: settings.deliveryTimeMinMinutes,
              deliveryTimeMaxMinutes: settings.deliveryTimeMaxMinutes,
              minimumOrderCents: settings.minimumOrderCents,
              deliveryFeeCents: settings.deliveryFeeCents,
              freeDeliveryAboveCents: settings.freeDeliveryAboveCents,
              whatsapp: settings.whatsapp,
              paymentPix: settings.paymentPix,
              paymentCash: settings.paymentCash,
              paymentCredit: settings.paymentCredit,
              paymentDebit: settings.paymentDebit,
            },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ ok: true, store: serializeStore(store) }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StoreInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[api/admin/stores][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar loja" }, { status: 500 });
  }
}
