import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContextFromRequest(req);

    if (!auth.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const requestedStoreId = url.searchParams.get("storeId")?.trim() || null;

    const effectiveStoreId =
      auth.role === "owner"
        ? requestedStoreId
        : auth.storeId || null;

    const where = {
      tenantId: auth.tenantId,
      ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
      status: {
        in: ["novo", "preparo", "pronto", "saiu_entrega"],
      },
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      role: auth.role,
      currentStoreId: auth.storeId,
      selectedStoreId: effectiveStoreId,
      orders,
    });
  } catch (error) {
    console.error("[api/admin/kds][GET]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar KDS" },
      { status: 500 }
    );
  }
}
