export const EVENTS = {
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  ORDER_STATUS_CHANGED: "order.status.changed",

  KDS_NEW_ORDER: "kds.new_order",
  KDS_UPDATE: "kds.update",

  DELIVERY_ASSIGNED: "delivery.assigned",
  DELIVERY_STATUS: "delivery.status",
} as const;

export type EventKey = (typeof EVENTS)[keyof typeof EVENTS];
