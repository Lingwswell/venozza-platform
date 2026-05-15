export type MobileStoreContext = {
  tenantId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export const DEFAULT_MOBILE_TENANT_ID = "cmnqqxn9p000092ozb3kd2dyf";
export const DEFAULT_MOBILE_STORE_ID = "cmnqqxng8000192oz4bt0wo3u";
export const DEFAULT_MOBILE_STORE_NAME = "VenoZza Centro";
export const DEFAULT_MOBILE_STORE_SLUG = "centro";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getMobileStoreContext(): MobileStoreContext {
  if (!canUseStorage()) {
    return {
      tenantId: DEFAULT_MOBILE_TENANT_ID,
      storeId: DEFAULT_MOBILE_STORE_ID,
      storeName: DEFAULT_MOBILE_STORE_NAME,
      storeSlug: DEFAULT_MOBILE_STORE_SLUG,
    };
  }

  return {
    tenantId:
      localStorage.getItem("venozza_tenant_id") ||
      DEFAULT_MOBILE_TENANT_ID,
    storeId:
      localStorage.getItem("venozza_store_id") ||
      DEFAULT_MOBILE_STORE_ID,
    storeName:
      localStorage.getItem("venozza_store_name") ||
      DEFAULT_MOBILE_STORE_NAME,
    storeSlug:
      localStorage.getItem("venozza_store_slug") ||
      DEFAULT_MOBILE_STORE_SLUG,
  };
}

export function setMobileStoreContext(context: Partial<MobileStoreContext>) {
  if (!canUseStorage()) return;

  if (context.tenantId) {
    localStorage.setItem("venozza_tenant_id", context.tenantId);
  }

  if (context.storeId) {
    localStorage.setItem("venozza_store_id", context.storeId);
  }

  if (context.storeName) {
    localStorage.setItem("venozza_store_name", context.storeName);
  }

  if (context.storeSlug) {
    localStorage.setItem("venozza_store_slug", context.storeSlug);
  }
}

export function ensureMobileStoreContext() {
  const context = getMobileStoreContext();
  setMobileStoreContext(context);
  return context;
}

export function getMobileStoreHeaders() {
  const context = getMobileStoreContext();

  return {
    "x-tenant-id": context.tenantId,
    "x-store-id": context.storeId,
  };
}
