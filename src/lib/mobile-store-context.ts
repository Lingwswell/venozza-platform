// Loja escolhida pelo cliente neste navegador.
// Nao existe mais loja fixa no codigo: a rede vem do dominio e a loja e escolhida
// pela localizacao do celular ou pelo proprio cliente (StorePicker).

export type MobileStoreContext = {
  tenantId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export const STORE_CHANGED_EVENT = "venozza:store-changed";

const KEYS = {
  tenantId: "venozza_tenant_id",
  storeId: "venozza_store_id",
  storeName: "venozza_store_name",
  storeSlug: "venozza_store_slug",
} as const;

const EMPTY: MobileStoreContext = { tenantId: "", storeId: "", storeName: "", storeSlug: "" };

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function getMobileStoreContext(): MobileStoreContext {
  if (!canUseStorage()) return { ...EMPTY };

  try {
    return {
      tenantId: localStorage.getItem(KEYS.tenantId) || "",
      storeId: localStorage.getItem(KEYS.storeId) || "",
      storeName: localStorage.getItem(KEYS.storeName) || "",
      storeSlug: localStorage.getItem(KEYS.storeSlug) || "",
    };
  } catch {
    return { ...EMPTY };
  }
}

export function hasSelectedStore() {
  return getMobileStoreContext().storeId !== "";
}

export function setMobileStoreContext(context: Partial<MobileStoreContext>) {
  if (!canUseStorage()) return;

  const before = getMobileStoreContext().storeId;

  try {
    for (const key of Object.keys(KEYS) as (keyof MobileStoreContext)[]) {
      const value = context[key];
      if (typeof value === "string" && value) localStorage.setItem(KEYS[key], value);
    }
  } catch {
    return;
  }

  if (context.storeId && context.storeId !== before) {
    window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
  }
}

export function clearMobileStoreContext() {
  if (!canUseStorage()) return;
  try {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

/** Mantido por compatibilidade: devolve a loja salva (pode estar vazia). */
export function ensureMobileStoreContext() {
  return getMobileStoreContext();
}

export function getMobileStoreHeaders(): Record<string, string> {
  const context = getMobileStoreContext();
  const headers: Record<string, string> = {};
  if (context.tenantId) headers["x-tenant-id"] = context.tenantId;
  if (context.storeId) headers["x-store-id"] = context.storeId;
  return headers;
}
