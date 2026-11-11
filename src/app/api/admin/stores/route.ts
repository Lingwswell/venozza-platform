import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import {
  StoreInputError,
  parseStoreInput,
  serializeStore,
  slugifyStore,
  storeAdminSelect,
} from "@/lib/store/store-input";

type AdminRole = "super_admin" | "owner" | "operator" | "customer";

type AuthContext = {
  tenantId?: string | null;
  storeId?: string | null;
  role?: string | null;
};

function normalizeRole(role: string | null | undefined): AdminRole {
  if (role === "super_admin") return "super_admin";
  if (role === "owner" || role === "admin") return "owner";
  if (role === "operator") return "operator";
  return "customer";
}

export async function GET(req: Request) {
  try {
    let auth: AuthContext;

    try {
      auth = await getAuthContextFromRequest(req);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Sessão inválida. Entre novamente." },
        { status: 401 }
      );
    }

    const tenantId = auth.tenantId;
    const storeId = auth.storeId;
    const role = normalizeRole(auth.role);

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId obrigatório" }, { status: 400 });
    }

    if (role === "customer") {
      return NextResponse.json(
        {
          ok: false,
          error: "Acesso administrativo obrigatório",
          role,
          currentStoreId: storeId,
          tenantId,
          stores: [],
        },
        { status: 403 }
      );
    }

    // ?all=1 (tela Lojas): gestor tambem ve lojas desativadas para poder reativar.
    const includeInactive =
      new URL(req.url).searchParams.get("all") === "1" && role !== "operator";

    const where =
      role === "operator"
        ? { tenantId, id: storeId || "", active: true }
        : includeInactive
          ? { tenantId }
          : { tenantId, active: true };

    const stores = await prisma.store.findMany({
      where,
      orderBy: { name: "asc" },
      select: storeAdminSelect,
    });

    return NextResponse.json({
      ok: true,
      role,
      currentStoreId: storeId,
      tenantId,
      stores: stores.map(serializeStore),
    });
  } catch (error) {
    console.error("[api/admin/stores][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar lojas" }, { status: 500 });
  }
}

// Criar loja (dono da rede ou super_admin). Opcional: copyFromStoreId copia o cardapio.
export async function POST(req: Request) {
  try {
    let auth: AuthContext;
    try {
      auth = await getAuthContextFromRequest(req);
    } catch {
      return NextResponse.json({ ok: false, error: "Sessão inválida. Entre novamente." }, { status: 401 });
    }

    const role = normalizeRole(auth.role);
    const tenantId = auth.tenantId;

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId obrigatório" }, { status: 400 });
    }
    if (role !== "owner" && role !== "super_admin") {
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
      }

      return created;
    });

    return NextResponse.json({ ok: true, store: serializeStore(store) }, { status: 201 });
  } catch (error) {
    if (error instanceof StoreInputError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[api/admin/stores][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar loja" }, { status: 500 });
  }
}
