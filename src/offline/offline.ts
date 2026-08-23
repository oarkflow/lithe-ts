import { signal } from '../core/reactive.ts';

export function createNetworkState() {
  const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  const effectiveType = signal(typeof navigator === 'undefined' ? 'unknown' : navigator.connection?.effectiveType || 'unknown');
  const saveData = signal(Boolean(typeof navigator !== 'undefined' && navigator.connection?.saveData));
  const start = () => {
    if (typeof window === 'undefined') return () => {};
    const on = () => online.value = true, off = () => online.value = false;
    const change = () => { effectiveType.value = navigator.connection?.effectiveType || 'unknown'; saveData.value = Boolean(navigator.connection?.saveData); };
    addEventListener('online',on); addEventListener('offline',off); navigator.connection?.addEventListener?.('change',change);
    return () => { removeEventListener('online',on); removeEventListener('offline',off); navigator.connection?.removeEventListener?.('change',change); };
  };
  return { online, effectiveType, saveData, start };
}

export async function registerServiceWorker(url = '/sw.js', options = {}) {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register(url, { scope:options.scope || '/' });
}

export function createMutationQueue(storageKey = 'lithe:mutation-queue') {
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
  const save = () => { try { localStorage.setItem(storageKey,JSON.stringify(queue)); } catch {} };
  return {
    add(operation) { queue.push({ id:crypto.randomUUID(), createdAt:Date.now(), ...operation }); save(); },
    list() { return [...queue]; },
    remove(id) { queue = queue.filter(x => x.id !== id); save(); },
    async flush(handler) {
      for (const item of [...queue]) {
        try { await handler(item); queue = queue.filter(x => x.id !== item.id); save(); }
        catch { break; }
      }
    }
  };
}
