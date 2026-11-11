import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { canAccessStore, getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import {
  OPERATOR_FIELDS,
  SettingsValidationError,
  loadStoreSettings,
  parseSettingsPatch,
  toSettingsData,
} from "@/lib/store/settings";
import { enabledPaymentMethods, getOpenStatus } from "@/lib/store/settings-shared";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Loja que o usuario quer ver/editar (pedida ou a principal), dentro do escopo dele.
 * Quem nao pode editar tudo (operador) so abre/fecha a loja.
 */
async function resolveStore(req: Request, requestedStoreId: string | null) {
  const scope = await getAdminScope(req);

  if (!can.openCloseStore(scope.role)) {
    return { error: fail("Sem permissão para configurações de loja.", 403) };
  }

  const storeId = requestedStoreId || scope.primaryStoreId;
  if (!canAccessStore(scope, storeId)) {
    return { error: fail("Você não tem acesso a esta loja.", 403) };
  }

  const store = await prisma.store.findFirst({
    where: { id: storeId!, tenantId: scope.tenantId },
    select: { id: true, name: true, slug: true },
  });

  if (!store) return { error: fail("Loja não encontrada", 404) };

  return { store, role: scope.role, canEditAll: can.editStoreSettings(scope.role) };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const resolved = await resolveStore(req, url.searchParams.get("storeId"));
    if ("error" in resolved) return resolved.error;

    const settings = await loadStoreSettings(resolved.store.id);

    return NextResponse.json({
      ok: true,
      role: resolved.role,
      canEditAll: resolved.canEditAll,
      store: resolved.store,
      settings,
      status: getOpenStatus(settings),
      paymentMethods: enabledPaymentMethods(settings),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/store-settings][GET]", error);
    return fail("Erro ao carregar configurações", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return fail("Corpo inválido", 400);

    const requestedStoreId = typeof body.storeId === "string" ? body.storeId : null;
    const resolved = await resolveStore(req, requestedStoreId);
    if ("error" in resolved) return resolved.error;

    let input = body;
    if (!resolved.canEditAll) {
      input = Object.fromEntries(
        Object.entries(body).filter(([key]) =>
          (OPERATOR_FIELDS as readonly string[]).includes(key)
        )
      );
    }

    const data = parseSettingsPatch(input);

    // Confere regras que dependem do valor final (atual + alteracao).
    const current = await loadStoreSettings(resolved.store.id);
    const merged = {
      ...current,
      ...(Object.fromEntries(
        Object.entries(data).filter(([key]) => key !== "openingHours")
      ) as Partial<typeof current>),
    };

    if (merged.deliveryTimeMaxMinutes < merged.deliveryTimeMinMinutes) {
      return fail("O tempo máximo não pode ser menor que o mínimo.", 400);
    }

    if (
      !merged.paymentPix &&
      !merged.paymentCash &&
      !merged.paymentCredit &&
      !merged.paymentDebit
    ) {
      return fail("Ative pelo menos uma forma de pagamento.", 400);
    }

    const row = await prisma.storeSettings.upsert({
      where: { storeId: resolved.store.id },
      update: data,
      create: {
        ...(data as unknown as Prisma.StoreSettingsUncheckedCreateInput),
        storeId: resolved.store.id,
      },
    });

    const settings = toSettingsData(row);

    return NextResponse.json({
      ok: true,
      store: resolved.store,
      settings,
      status: getOpenStatus(settings),
      paymentMethods: enabledPaymentMethods(settings),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof SettingsValidationError) {
      return fail(error.message, 400);
    }

    console.error("[api/admin/store-settings][PATCH]", error);
    return fail("Erro ao salvar configurações", 500);
  }
}
