function traceOffline(type, attributes = {}) {
    try {
        globalThis.__LITHE_CORRELATION_EVENT__?.(type, attributes, globalThis.__LITHE_CORRELATION_ID__ || null);
    } catch { }
}
export function createMemoryStorage() {
    const map = new Map();
    return {
        async getItem(k) {
            return map.has(k) ? map.get(k) : null;
        },
        async setItem(k, v) {
            map.set(k, String(v));
        },
        async removeItem(k) {
            map.delete(k);
        },
        async keys() {
            return [...map.keys()];
        },
        async clear() {
            map.clear();
        }
    };
}
export function createIndexedDBStorage(options = {}) {
    const dbName = options.dbName || 'lithe',
        storeName = options.storeName || 'kv',
        version = options.version || 1;
    if (typeof indexedDB === 'undefined') return createMemoryStorage();
    let dbPromise;
    const open = () => dbPromise ||= new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
            options.upgrade?.(req.result, req.transaction);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    const run = async (mode, fn) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode),
                store = tx.objectStore(storeName);
            let result;
            try {
                result = fn(store);
            } catch (e) {
                reject(e);
                return;
            }
            tx.oncomplete = () => resolve(result?.result ?? result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        });
    };
    return {
        async getItem(key) {
            return run('readonly', s => s.get(key));
        },
        async setItem(key, value) {
            await run('readwrite', s => s.put(String(value), key));
        },
        async removeItem(key) {
            await run('readwrite', s => s.delete(key));
        },
        async keys() {
            return run('readonly', s => s.getAllKeys());
        },
        async clear() {
            await run('readwrite', s => s.clear());
        },
        async close() {
            (await open()).close();
            dbPromise = null;
        }
    };
}
export async function registerBackgroundSync(registration, tag = 'lithe-sync') {
    const reg = registration || (await navigator.serviceWorker?.ready);
    if (!reg?.sync?.register) return false;
    await reg.sync.register(tag);
    return true;
}
export function createPersistentMutationQueue(storage, storageKey = 'lithe:mutation-queue') {
    let queue = [],
        loaded = false;
    const listeners = new Set();
    const ready = (async () => {
        try {
            queue = JSON.parse((await storage.getItem(storageKey)) || '[]');
        } catch {
            queue = [];
        }
        loaded = true;
        emit();
        return queue;
    })();
    const emit = () => {
        for (const fn of listeners) try {
            fn([...queue]);
        } catch { }
    };
    const save = () => storage.setItem(storageKey, JSON.stringify(queue));
    return {
        ready,
        subscribe(fn) {
            listeners.add(fn);
            if (loaded) fn([...queue]);
            return () => listeners.delete(fn);
        },
        async add(operation) {
            await ready;
            const item = {
                id: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
                createdAt: Date.now(),
                ...operation
            };
            queue.push(item);
            await save();
            emit();
            traceOffline('offline:queue:add', {
                id: item.id
            });
            return item;
        },
        async list() {
            await ready;
            return [...queue];
        },
        async remove(id) {
            await ready;
            queue = queue.filter(x => x.id !== id);
            await save();
            emit();
        },
        async flush(handler) {
            await ready;
            traceOffline('offline:queue:flush:start', {
                count: queue.length
            });
            for (const item of [...queue]) {
                try {
                    await handler(item);
                    queue = queue.filter(x => x.id !== item.id);
                    await save();
                    emit();
                    traceOffline('offline:queue:item:end', {
                        id: item.id
                    });
                } catch (error) {
                    traceOffline('offline:queue:error', {
                        id: item.id,
                        message: error.message
                    });
                    break;
                }
            }
            traceOffline('offline:queue:flush:end', {
                remaining: queue.length
            });
        },
        async clear() {
            queue = [];
            await save();
            emit();
        }
    };
}
