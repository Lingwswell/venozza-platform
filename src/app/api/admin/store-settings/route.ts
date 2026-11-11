import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest, type AuthContext } from "@/lib/auth/context";
import {
  OPERATOR_FIELDS,
  SettingsValidationError,
  loadStoreSettings,
  parseSettingsPatch,
  toSettingsData,
} from "@/lib/store/settings";
import { enabledPaymentMethods, getOpenStatus } from "@/lib/store/settings-shared";

const MANAGER_ROLES = ["super_admin", "owner", "admin"];

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function getAuth(req: Request): Promise<AuthContext | null> {
  try {
    return await getAuthContextFromRequest(req);
  } catch {
    return null;
  }
}

/**
 * Descobre qual loja o usuario pode ver/editar.
 * - operator: sempre a propria loja
 * - owner/admin/super_admin: qualquer loja ativa do proprio tenant
 */
async function resolveStore(auth: AuthContext, requestedStoreId: string | null) {
  const role = String(auth.role || "").toLowerCase();

  if (!auth.tenantId) return { error: fail("tenantId obrigatório", 400) };

  if (role === "operator") {
    if (!auth.storeId) return { error: fail("Operador sem loja vinculada", 403) };
    if (requestedStoreId && requestedStoreId !== auth.storeId) {
      return { error: fail("Operador não pode acessar outra loja", 403) };
    }
  } else if (!MANAGER_ROLES.includes(role)) {
    return { error: fail("Acesso administrativo obrigatório", 403) };
  }

  const storeId = role === "operator" ? auth.storeId : requestedStoreId || auth.storeId;

  const store = await prisma.store.findFirst({
    where: storeId
      ? { id: storeId, tenantId: auth.tenantId, active: true }
      : { tenantId: auth.tenantId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  if (!store) return { error: fail("Loja não encontrada", 404) };

  return { store, role };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return fail("Sessão inválida. Entre novamente.", 401);

    const url = new URL(req.url);
    const resolved = await resolveStore(auth, url.searchParams.get("storeId"));
    if ("error" in resolved) return resolved.error;

    const settings = await loadStoreSettings(resolved.store.id);

    return NextResponse.json({
      ok: true,
      role: resolved.role,
      store: resolved.store,
      settings,
      status: getOpenStatus(settings),
      paymentMethods: enabledPaymentMethods(settings),
    });
  } catch (error) {
    console.error("[api/admin/store-settings][GET]", error);
    return fail("Erro ao carregar configurações", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return fail("Sessão inválida. Entre novamente.", 401);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return fail("Corpo inválido", 400);

    const requestedStoreId = typeof body.storeId === "string" ? body.storeId : null;
    const resolved = await resolveStore(auth, requestedStoreId);
    if ("error" in resolved) return resolved.error;

    let input = body;
    if (resolved.role === "operator") {
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
    if (error instanceof SettingsValidationError) {
      return fail(error.message, 400);
    }

    console.error("[api/admin/store-settings][PATCH]", error);
    return fail("Erro ao salvar configurações", 500);
  }
}
