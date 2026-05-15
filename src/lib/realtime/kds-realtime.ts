import type { KdsRealtimeAdapter } from "@/lib/realtime/kds-adapter";
import { KdsMemoryAdapter } from "@/lib/realtime/kds-memory-adapter";
import { KdsRedisAdapter } from "@/lib/realtime/kds-redis-adapter";

const globalForRealtime = globalThis as typeof globalThis & {
  __venozzaKdsRealtimeAdapter?: KdsRealtimeAdapter;
};

export function getKdsRealtimeAdapter(): KdsRealtimeAdapter {
  if (globalForRealtime.__venozzaKdsRealtimeAdapter) {
    return globalForRealtime.__venozzaKdsRealtimeAdapter;
  }

  const provider = process.env.KDS_REALTIME_PROVIDER || "memory";

  const adapter =
    provider === "redis"
      ? new KdsRedisAdapter()
      : new KdsMemoryAdapter();

  globalForRealtime.__venozzaKdsRealtimeAdapter = adapter;
  return adapter;
}

export function getTenantChannel(tenantId: string) {
  return `tenant:${tenantId}`;
}

export function getStoreChannel(tenantId: string, storeId: string) {
  return `tenant:${tenantId}:store:${storeId}`;
}
