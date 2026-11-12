import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { distanceKm, isValidLatLng } from "@/lib/geo";
import { toSettingsData } from "@/lib/store/settings";
import { getOpenStatus } from "@/lib/store/settings-shared";
import { resolveTenantFromRequest } from "@/lib/tenant/resolve";
import { isTenantBlocked } from "@/lib/billing/server";
import { BLOCKED_ORDER_MESSAGE } from "@/lib/billing/state";

// Lojas publicas da rede do dominio acessado. Com ?lat=&lng= (localizacao do
// celular) devolve a distancia de cada loja e ordena da mais perto para a mais longe.

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveTenantFromRequest(req);

    if (!tenant) {
      return NextResponse.json(
        { ok: false, code: "TENANT_NOT_FOUND", error: "Rede não encontrada para este endereço." },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const hasPosition = url.searchParams.has("lat") && isValidLatLng(lat, lng);

    const stores = await prisma.store.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        addressStreet: true,
        addressNumber: true,
        addressNeighborhood: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        settings: true,
      },
    });

    const blocked = await isTenantBlocked(tenant.id);

    const items = stores.map((store) => {
      const storeLat = store.latitude === null ? null : Number(store.latitude);
      const storeLng = store.longitude === null ? null : Number(store.longitude);
      const radius = store.deliveryRadiusKm === null ? null : Number(store.deliveryRadiusKm);

      const distance =
        hasPosition && storeLat !== null && storeLng !== null
          ? Math.round(distanceKm(lat, lng, storeLat, storeLng) * 10) / 10
          : null;

      const street = [store.addressStreet, store.addressNumber].filter(Boolean).join(", ");
      const place = [store.addressNeighborhood, store.city, store.state].filter(Boolean).join(" · ");

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        tenantId: tenant.id,
        address: [street, place].filter(Boolean).join(" — ") || null,
        hasLocation: storeLat !== null && storeLng !== null,
        distanceKm: distance,
        deliveryRadiusKm: radius,
        // null = nao da para saber (sem localizacao do cliente ou da loja, ou sem raio)
        deliversHere: distance === null || radius === null || radius <= 0 ? null : distance <= radius,
        status: blocked
          ? { open: false, reason: "manual" as const, message: BLOCKED_ORDER_MESSAGE }
          : getOpenStatus(toSettingsData(store.settings)),
      };
    });

    if (hasPosition) {
      items.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    // Sugestao: a mais perto que entrega no local; senao a mais perto.
    const suggested = hasPosition
      ? items.find((s) => s.deliversHere === true) ||
        items.find((s) => s.distanceKm !== null) ||
        null
      : items.length === 1
        ? items[0]
        : null;

    return NextResponse.json({
      ok: true,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      stores: items,
      suggestedStoreId: suggested?.id ?? null,
    });
  } catch (error) {
    console.error("[api/stores][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar lojas." }, { status: 500 });
  }
}
