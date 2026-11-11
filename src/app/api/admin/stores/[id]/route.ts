import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import {
  StoreInputError,
  parseStoreInput,
  serializeStore,
  storeAdminSelect,
} from "@/lib/store/store-input";

// Editar loja: dono da rede/super_admin edita qualquer loja da rede.
// Operador nao edita cadastro de loja (so abre/fecha em Configuracoes).

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    let auth;
    try {
      auth = await getAuthContextFromRequest(req);
    } catch {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Entre novamente." }, { status: 401 });
    }

    const role = String(auth.role || "").toLowerCase();
    if (!auth.tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId obrigatório" }, { status: 400 });
    }
    if (!["owner", "admin", "super_admin"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Só o dono da rede pode editar lojas." }, { status: 403 });
    }

    const current = await prisma.store.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!current) {
      return NextResponse.json({ ok: false, error: "Loja não encontrada" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = parseStoreInput(body);

    if (data.slug) {
      const clash = await prisma.store.findFirst({
        where: { tenantId: auth.tenantId, slug: data.slug, NOT: { id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { ok: false, error: "Já existe uma loja com esse identificador nesta rede." },
          { status: 409 }
        );
      }
    }

    if (data.active === false) {
      const activeCount = await prisma.store.count({
        where: { tenantId: auth.tenantId, active: true, NOT: { id } },
      });
      if (activeCount === 0) {
        return NextResponse.json(
          { ok: false, error: "A rede precisa ter pelo menos uma loja ativa." },
          { status: 400 }
        );
      }
    }

    const store = await prisma.store.update({
      where: { id },
      data,
      select: storeAdminSelect,
    });

    return NextResponse.json({ ok: true, store: serializeStore(store) });
  } catch (error) {
    if (error instanceof StoreInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[api/admin/stores/:id][PATCH]", error);
    return NextResponse.json({ ok: false, error: "Erro ao salvar loja" }, { status: 500 });
  }
}
