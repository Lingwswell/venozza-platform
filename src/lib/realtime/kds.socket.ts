type Listener = (payload: any) => void;

const listeners: Record<string, Listener[]> = {};

export function emit(event: string, payload: any) {
  if (!listeners[event]) return;

  for (const cb of listeners[event]) {
    cb(payload);
  }
}

export function on(event: string, callback: Listener) {
  if (!listeners[event]) {
    listeners[event] = [];
  }

  listeners[event].push(callback);
}

export function off(event: string, callback: Listener) {
  if (!listeners[event]) return;

  listeners[event] = listeners[event].filter((cb) => cb !== callback);
}
