import { isValidLatLng } from "@/lib/geo";

// Validacao do cadastro de loja (criar/editar no admin).

export class StoreInputError extends Error {}

export type StoreInput = {
  name?: string;
  slug?: string;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deliveryRadiusKm?: number | null;
  active?: boolean;
};

export function slugifyStore(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function text(value: unknown, max: number): string | null {
  if (value === null || typeof value === "undefined") return null;
  const t = String(value).trim();
  return t ? t.slice(0, max) : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n)) throw new StoreInputError("Número inválido.");
  return n;
}

/** Le so os campos presentes no corpo; ausentes nao mudam. */
export function parseStoreInput(body: Record<string, unknown>): StoreInput {
  const data: StoreInput = {};

  if ("name" in body) {
    const name = text(body.name, 80);
    if (!name) throw new StoreInputError("Nome da loja é obrigatório.");
    data.name = name;
  }

  if ("slug" in body && body.slug) {
    const slug = slugifyStore(String(body.slug));
    if (!slug) throw new StoreInputError("Identificador (slug) inválido.");
    data.slug = slug;
  }

  for (const [key, max] of [
    ["addressStreet", 120],
    ["addressNumber", 20],
    ["addressComplement", 80],
    ["addressNeighborhood", 80],
    ["city", 80],
    ["zipCode", 12],
  ] as const) {
    if (key in body) data[key] = text(body[key], max);
  }

  if ("state" in body) {
    const uf = text(body.state, 2);
    data.state = uf ? uf.toUpperCase() : null;
  }

  if ("latitude" in body || "longitude" in body) {
    const lat = optionalNumber(body.latitude);
    const lng = optionalNumber(body.longitude);

    if (lat === null && lng === null) {
      data.latitude = null;
      data.longitude = null;
    } else if (lat === null || lng === null || !isValidLatLng(lat, lng)) {
      throw new StoreInputError("Coordenadas inválidas. Informe latitude e longitude.");
    } else {
      data.latitude = lat;
      data.longitude = lng;
    }
  }

  if ("deliveryRadiusKm" in body) {
    const radius = optionalNumber(body.deliveryRadiusKm);
    if (radius !== null && (radius < 0 || radius > 200)) {
      throw new StoreInputError("Raio de entrega deve ficar entre 0 e 200 km.");
    }
    data.deliveryRadiusKm = radius;
  }

  if ("active" in body) data.active = body.active !== false;

  return data;
}

export const storeAdminSelect = {
  id: true,
  name: true,
  slug: true,
  addressStreet: true,
  addressNumber: true,
  addressComplement: true,
  addressNeighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  latitude: true,
  longitude: true,
  deliveryRadiusKm: true,
  active: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Decimal do Prisma vira numero simples no JSON.
export function serializeStore<
  T extends { latitude: unknown; longitude: unknown; deliveryRadiusKm: unknown },
>(store: T) {
  return {
    ...store,
    latitude: store.latitude === null ? null : Number(store.latitude),
    longitude: store.longitude === null ? null : Number(store.longitude),
    deliveryRadiusKm: store.deliveryRadiusKm === null ? null : Number(store.deliveryRadiusKm),
  };
}

