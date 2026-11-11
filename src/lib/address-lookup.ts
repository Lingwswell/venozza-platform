// Busca de endereco por CEP (ViaCEP) e coordenadas pelo endereco (OpenStreetMap/Nominatim).
// Roda so no servidor: os dois servicos sao gratuitos e nao precisam de chave.

export type AddressLookup = {
  zipCode: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  /** "number" = achou pelo numero da casa; "street" = rua; "zip" = so pelo CEP/bairro */
  precision: "number" | "street" | "zip" | null;
};

const USER_AGENT = "venozza-platform/1.0 (cadastro de lojas)";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

type ViaCepResponse = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function geocode(params: Record<string, string>): Promise<[number, number] | null> {
  const query = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "br",
    ...params,
  });
  const rows = await fetchJson<{ lat: string; lon: string }[]>(
    `https://nominatim.openstreetmap.org/search?${query.toString()}`
  );
  const first = rows?.[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

export async function lookupAddress(input: {
  zipCode: string;
  number?: string | null;
  street?: string | null;
}): Promise<AddressLookup | null> {
  const cep = onlyDigits(input.zipCode);
  if (cep.length !== 8) return null;

  const via = await fetchJson<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
  if (!via || via.erro) return null;

  const street = (input.street || via.logradouro || "").trim() || null;
  const neighborhood = via.bairro?.trim() || null;
  const city = via.localidade?.trim() || null;
  const state = via.uf?.trim() || null;
  const number = onlyDigits(input.number || "");

  let coords: [number, number] | null = null;
  let precision: AddressLookup["precision"] = null;

  // 1) rua + numero (mais preciso)
  if (street && number && city) {
    coords = await geocode({ street: `${number} ${street}`, city, state: state || "", country: "Brasil" });
    if (coords) precision = "number";
  }
  // 2) so a rua
  if (!coords && street && city) {
    coords = await geocode({ street, city, state: state || "", country: "Brasil" });
    if (coords) precision = "street";
  }
  // 3) bairro/CEP
  if (!coords && city) {
    coords =
      (await geocode({ postalcode: `${cep.slice(0, 5)}-${cep.slice(5)}`, country: "Brasil" })) ||
      (neighborhood ? await geocode({ q: `${neighborhood}, ${city}, ${state || ""}, Brasil` }) : null);
    if (coords) precision = "zip";
  }

  return {
    zipCode: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    street,
    neighborhood,
    city,
    state,
    latitude: coords ? Number(coords[0].toFixed(6)) : null,
    longitude: coords ? Number(coords[1].toFixed(6)) : null,
    precision,
  };
}
