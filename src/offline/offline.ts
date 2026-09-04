import { signal } from '../core/reactive.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
export function createNetworkState() {
    const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
    const effectiveType = signal(typeof navigator === 'undefined' ? 'unknown' : navigator.connection?.effectiveType || 'unknown');
    const saveData = signal(Boolean(typeof navigator !== 'undefined' && navigator.connection?.saveData));
    let stopListening: (() => void) | null = null;
    const start = () => {
        if (typeof window === 'undefined') return () => { };
        if (stopListening) return stopListening;
        const on = () => online.value = true,
            off = () => online.value = false;
        const change = () => {
            effectiveType.value = navigator.connection?.effectiveType || 'unknown';
            saveData.value = Boolean(navigator.connection?.saveData);
        };
        addEventListener('online', on);
        addEventListener('offline', off);
        navigator.connection?.addEventListener?.('change', change);
        stopListening = () => {
            removeEventListener('online', on);
            removeEventListener('offline', off);
            navigator.connection?.removeEventListener?.('change', change);
            stopListening = null;
        };
        if (getOwner()) onCleanup(stopListening);
        return stopListening;
    };
    const stop = () => stopListening?.();
    return {
        online,
        effectiveType,
        saveData,
        start,
        stop
    };
}
export async function registerServiceWorker(url = '/sw.js', options = {}) {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.register(url, {
        scope: options.scope || '/'
    });
}
export function createMutationQueue(storageKey = 'lithe:mutation-queue', options = {}) {
    let queue = [];
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const maxItems = options.maxItems === 0 ? Infinity : Math.max(1, Number(options.maxItems ?? 1000) || 1000);
    const trim = () => {
        if (queue.length > maxItems) queue.splice(0, queue.length - maxItems);
    };
    try {
        queue = JSON.parse(storage?.getItem(storageKey) || '[]');
        if (!Array.isArray(queue)) queue = [];
        const before = queue.length;
        trim();
        if (storage && queue.length !== before) {
            try {
                storage.setItem(storageKey, JSON.stringify(queue));
            } catch { }
        }
    } catch (e) {
        console.warn('[lithe:offline] Failed to load mutation queue:', e);
    }
    const save = () => {
        if (!storage) return;
        try {
            storage.setItem(storageKey, JSON.stringify(queue));
        } catch (e) {
            console.warn('[lithe:offline] Failed to persist mutation queue:', e);
        }
    };
    return {
        add(operation) {
            queue.push({
                id: crypto.randomUUID(),
                createdAt: Date.now(),
                ...operation
            });
            trim();
            save();
        },
        list() {
            return [...queue];
        },
        remove(id) {
            queue = queue.filter(x => x.id !== id);
            save();
        },
        async flush(handler) {
            for (const item of [...queue]) {
                try {
                    await handler(item);
                    queue = queue.filter(x => x.id !== item.id);
                    save();
                } catch {
                    break;
                }
            }
        }
    };
}
