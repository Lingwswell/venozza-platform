import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

type AdminRole = "super_admin" | "owner" | "operator" | "customer";

type AuthContext = {
  tenantId?: string | null;
  storeId?: string | null;
  role?: string | null;
};

function normalizeRole(role: string | null | undefined): AdminRole {
  if (role === "super_admin") return "super_admin";
  if (role === "owner") return "owner";
  if (role === "operator") return "operator";
  return "customer";
}

export async function GET(req: Request) {
  try {
    let auth: AuthContext = {};

    try {
      auth = await getAuthContextFromRequest(req);
    } catch (authError) {
      console.warn("[api/admin/stores][auth fallback]", authError);
      auth = {};
    }

    const headerTenantId = req.headers.get("x-tenant-id");
    const headerStoreId = req.headers.get("x-store-id");
    const headerRole = normalizeRole(req.headers.get("x-user-role"));

    const authRole = normalizeRole(auth.role);

    const tenantId = auth.tenantId || headerTenantId;
    const storeId = auth.storeId || headerStoreId;

    const role =
      authRole !== "customer"
        ? authRole
        : headerRole !== "customer"
          ? headerRole
          : authRole;

    if (!tenantId) {
      return NextResponse.json(
        {
          ok: false,
          error: "tenantId obrigatório",
          debug: {
            authRole,
            headerRole,
            hasAuthTenantId: Boolean(auth.tenantId),
            hasHeaderTenantId: Boolean(headerTenantId),
          },
        },
        { status: 400 }
      );
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

    const where =
      role === "operator"
        ? {
            tenantId,
            id: storeId || "",
            active: true,
          }
        : {
            tenantId,
            active: true,
          };

    const stores = await prisma.store.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        active: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      role,
      currentStoreId: storeId,
      tenantId,
      stores,
    });
  } catch (error) {
    console.error("[api/admin/stores][GET]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao listar lojas",
      },
      { status: 500 }
    );
  }
}
