import type {
  KdsListener,
  KdsRealtimeAdapter,
  KdsRealtimeEvent,
} from "@/lib/realtime/kds-adapter";

/**
 * Placeholder para próxima etapa:
 * aqui vai entrar Redis Pub/Sub real.
 */
export class KdsRedisAdapter implements KdsRealtimeAdapter {
  subscribe(_channel: string, _listener: KdsListener): () => void {
    throw new Error("KdsRedisAdapter ainda não implementado nesta etapa.");
  }

  async publish(
    _channel: string,
    _event: KdsRealtimeEvent
  ): Promise<void> {
    throw new Error("KdsRedisAdapter ainda não implementado nesta etapa.");
  }
}
