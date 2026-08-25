import { collection } from '../collection/collection.ts';
import { signal } from '../core/reactive.ts';
import { conflictStrategies } from './crdt.ts';
function traceSync(type, attributes = {}) {
    try {
        globalThis.__LITHE_CORRELATION_EVENT__?.(type, attributes, globalThis.__LITHE_CORRELATION_ID__ || null);
    } catch { }
}
export function syncedCollection(name, options = {}) {
    const key = `lithe:collection:${name}`,
        queueKey = `${key}:pending`;
    let initial = options.initial || [];
    const storage = options.storage || globalThis.localStorage;
    if (storage && typeof storage.getItem === 'function' && !(storage.getItem(key) instanceof Promise)) {
        try {
            initial = JSON.parse(storage.getItem(key) || 'null') || initial;
        } catch { }
    }
    const base = collection(initial, options),
        status = signal('idle'),
        pending = [];
    let syncing = false;
    const ready = (async () => {
        if (!storage) return base;
        try {
            const raw = await storage.getItem(key),
                queued = await storage.getItem(queueKey);
            if (raw) base.replace(JSON.parse(raw));
            if (queued) pending.push(...JSON.parse(queued));
        } catch { }
        return base;
    })();
    const persist = async () => {
        if (!storage) return;
        try {
            await storage.setItem(key, JSON.stringify(base.toJSON()));
            await storage.setItem(queueKey, JSON.stringify(pending));
        } catch { }
    };
    const enqueue = op => {
        pending.push({
            ...op,
            id: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
            at: Date.now()
        });
        persist();
        if (options.autoSync !== false) sync().catch(() => { });
    };
    const original = {
        insert: base.insert,
        update: base.update,
        delete: base.delete
    };
    base.insert = (item, at) => {
        const r = original.insert(item, at);
        enqueue({
            type: 'insert',
            item: r?.__raw || r
        });
        return r;
    };
    base.update = (id, patch) => {
        const r = original.update(id, patch);
        enqueue({
            type: 'update',
            id,
            item: r?.__raw || r
        });
        return r;
    };
    base.delete = id => {
        const ok = original.delete(id);
        if (ok) enqueue({
            type: 'delete',
            id
        });
        return ok;
    };
    async function sync() {
        await ready;
        if (!options.sync || !pending.length || syncing) return;
        syncing = true;
        status.value = 'syncing';
        traceSync('sync:start', {
            name,
            count: pending.length
        });
        try {
            const sent = [...pending],
                result = await options.sync(sent, {
                    snapshot: base.toJSON()
                });
            pending.splice(0, sent.length);
            if (result?.conflicts?.length) {
                const strategy = typeof options.conflict === 'function' ? options.conflict : conflictStrategies[options.conflict || 'serverWins'];
                for (const c of result.conflicts) {
                    const resolved = strategy(c);
                    if (resolved == null) original.delete(c.id); else original.upsert ? original.upsert(resolved) : base.upsert(resolved);
                }
            }
            if (result?.items) base.replace(result.items);
            await persist();
            status.value = 'idle';
            traceSync('sync:end', {
                name,
                remaining: pending.length
            });
            return result;
        } catch (error) {
            status.value = 'error';
            traceSync('sync:error', {
                name,
                message: error.message
            });
            throw error;
        } finally {
            syncing = false;
        }
    }
    return Object.assign(base, {
        status,
        pending,
        sync,
        persist,
        ready
    });
}
