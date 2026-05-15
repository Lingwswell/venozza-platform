export type KdsRealtimeEvent = {
  type: "order_created" | "order_status_changed" | "heartbeat";
  orderId?: string;
  orderCode?: string;
  status?: string;
  storeId?: string;
  tenantId?: string;
  ts: number;
};

export type KdsListener = (event: KdsRealtimeEvent) => void;

export interface KdsRealtimeAdapter {
  subscribe(channel: string, listener: KdsListener): () => void;
  publish(channel: string, event: KdsRealtimeEvent): Promise<void> | void;
}
