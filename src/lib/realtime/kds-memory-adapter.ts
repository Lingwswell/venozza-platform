import type { KdsListener, KdsRealtimeAdapter, KdsRealtimeEvent } from "@/lib/realtime/kds-adapter";

type ChannelMap = Map<string, Set<KdsListener>>;

const globalForKDS = globalThis as typeof globalThis & {
  __venozzaKdsMemoryChannels?: ChannelMap;
};

const channels: ChannelMap =
  globalForKDS.__venozzaKdsMemoryChannels ?? new Map<string, Set<KdsListener>>();

if (!globalForKDS.__venozzaKdsMemoryChannels) {
  globalForKDS.__venozzaKdsMemoryChannels = channels;
}

export class KdsMemoryAdapter implements KdsRealtimeAdapter {
  subscribe(channel: string, listener: KdsListener) {
    const listeners = channels.get(channel) ?? new Set<KdsListener>();
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

  publish(channel: string, event: KdsRealtimeEvent) {
    const listeners = channels.get(channel);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // ignora listener quebrado
      }
    }
  }
}
