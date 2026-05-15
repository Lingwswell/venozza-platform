type Listener = (payload: string) => void;

type ChannelMap = Map<string, Set<Listener>>;

const globalForKDS = globalThis as typeof globalThis & {
  __venozzaKdsChannels?: ChannelMap;
};

const channels: ChannelMap =
  globalForKDS.__venozzaKdsChannels ?? new Map<string, Set<Listener>>();

if (!globalForKDS.__venozzaKdsChannels) {
  globalForKDS.__venozzaKdsChannels = channels;
}

export function subscribeKdsChannel(channel: string, listener: Listener) {
  const listeners = channels.get(channel) ?? new Set<Listener>();
  listeners.add(listener);
  channels.set(channel, listeners);

  return () => {
    const current = channels.get(channel);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      channels.delete(channel);
    }
  };
}

export function publishKdsEvent(channel: string, event: unknown) {
  const listeners = channels.get(channel);
  if (!listeners || listeners.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // ignora listener quebrado
    }
  }
}

export function getTenantChannel(tenantId: string) {
  return `tenant:${tenantId}`;
}

export function getStoreChannel(tenantId: string, storeId: string) {
  return `tenant:${tenantId}:store:${storeId}`;
}
