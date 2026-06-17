import { EventEmitter } from 'events';

// Tiny per-user pub/sub used to push "your data changed" signals to open SSE
// connections (live dashboard updates).
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function emitRefresh(userId, payload = {}) {
  emitter.emit(`refresh:${userId}`, payload);
  emitter.emit('refresh:any', userId, payload); // global channel for server-side reactors
}

export function onRefresh(userId, handler) {
  const channel = `refresh:${userId}`;
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}

// Subscribe to ALL users' data-change events (used by the notification engine
// for real-time threshold-breach / improvement checks).
export function onAnyRefresh(handler) {
  emitter.on('refresh:any', handler);
  return () => emitter.off('refresh:any', handler);
}
