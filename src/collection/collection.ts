import { signal, state, computed, effect, batch } from '../core/reactive.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
export function collection(initial = [], options = {}) {
    const idKey = options.idKey || 'id',
        items = state([...initial]),
        version = signal(0),
        index = new Map(),
        secondary = new Map(),
        incremental = new Set();
    let disposed = false;
    const idOf = item => item?.[idKey];
    const addSecondary = (field, item) => {
        const maps = secondary.get(field);
        if (!maps) return;
        const value = item?.[field];
        let set = maps.get(value);
        if (!set) maps.set(value, set = new Set());
        set.add(idOf(item));
    };
    const removeSecondary = (field, item) => {
        const maps = secondary.get(field);
        if (!maps) return;
        const value = item?.[field],
            set = maps.get(value);
        set?.delete(idOf(item));
        if (set?.size === 0) maps.delete(value);
    };
    const rebuild = () => {
        if (disposed) return;
        index.clear();
        items.forEach((item, i) => index.set(idOf(item), i));
        for (const [field, map] of secondary) {
            map.clear();
            for (const item of items) addSecondary(field, item);
        }
        version.value++;
        for (const q of incremental) q.rebuild();
    };
    const notifyItem = (oldItem, newItem) => {
        if (disposed) return;
        for (const field of secondary.keys()) {
            removeSecondary(field, oldItem);
            addSecondary(field, newItem);
        }
        for (const q of incremental) q.update?.(oldItem, newItem);
        version.value++;
    };
    function createIncrementalQuery(predicate) {
        const out = signal([]),
            matches = new Map(),
            watchers = new Map();
        let rebuilding = false,
            disposed = false;
        const publish = () => {
            if (rebuilding) return;
            out.value = items.filter(item => matches.get(idOf(item)) === true);
        };
        const attach = item => {
            const id = idOf(item);
            watchers.get(id)?.();
            let first = true;
            const dispose = effect(() => {
                const yes = Boolean(predicate(item)),
                    before = matches.get(id);
                matches.set(id, yes);
                if (!first && before !== yes) publish();
                first = false;
            }, {
                sync: true
            });
            watchers.set(id, dispose);
        };
        const detach = id => {
            watchers.get(id)?.();
            watchers.delete(id);
            matches.delete(id);
        };
        const q = {
            rebuild() {
                if (disposed) return;
                rebuilding = true;
                const live = new Set();
                for (const item of items) {
                    const id = idOf(item);
                    live.add(id);
                    if (!watchers.has(id)) attach(item);
                }
                for (const id of [...watchers.keys()]) if (!live.has(id)) detach(id);
                rebuilding = false;
                publish();
            },
            update(oldItem, newItem) {
                if (disposed) return;
                const oldId = idOf(oldItem),
                    newId = idOf(newItem);
                if (oldId !== newId) detach(oldId);
                attach(newItem);
                publish();
            },
            dispose() {
                if (disposed) return;
                disposed = true;
                for (const d of watchers.values()) d();
                watchers.clear();
                matches.clear();
                incremental.delete(q);
            }
        };
        if (getOwner()) onCleanup(q.dispose);
        incremental.add(q);
        q.rebuild();
        return Object.freeze({
            get value() {
                return out.value;
            },
            peek: out.peek,
            subscribe: out.subscribe,
            dispose: q.dispose,
            __litheSignal: true,
            __litheIncrementalQuery: true
        });
    }
    rebuild();
    const api: any = {
        items,
        insert(item, at = items.length) {
            if (disposed) return undefined;
            items.splice(at, 0, item);
            rebuild();
            return item;
        },
        upsert(item) {
            if (disposed) return undefined;
            const i = index.get(idOf(item));
            if (i == null) return api.insert(item);
            const existing = items[i];
            const before = { ...(existing?.__raw || existing) };
            for (const key of Object.keys(item)) {
                existing[key] = item[key];
            }
            notifyItem(before, existing);
            return existing;
        },
        update(id, patch) {
            if (disposed) return undefined;
            const i = index.get(id);
            if (i == null) return undefined;
            const item = items[i];
            const before = { ...(item?.__raw || item) };
            const next = typeof patch === 'function' ? patch(item) : patch;
            if (next && next !== item) {
                for (const key of Object.keys(next)) {
                    item[key] = next[key];
                }
            }
            notifyItem(before, item);
            return item;
        },
        delete(id) {
            if (disposed) return false;
            const i = index.get(id);
            if (i == null) return false;
            items.splice(i, 1);
            rebuild();
            return true;
        },
        get(id) {
            version.value;
            const i = index.get(id);
            return i == null ? undefined : items[i];
        },
        clear() {
            if (disposed) return;
            items.splice(0, items.length);
            rebuild();
        },
        replace(next) {
            if (disposed) return;
            items.splice(0, items.length, ...next);
            rebuild();
        },
        where(predicate, queryOptions = {}) {
            if (disposed) return computed(() => []);
            return queryOptions.incremental === false ? computed(() => {
                version.value;
                return items.filter(predicate);
            }) : createIncrementalQuery(predicate);
        },
        indexBy(field) {
            if (disposed) return { get: () => [], has: () => false, values: () => new Map() };
            if (!secondary.has(field)) {
                secondary.set(field, new Map());
                for (const item of items) addSecondary(field, item);
            }
            return {
                get(value) {
                    version.value;
                    const ids = secondary.get(field).get(value) || new Set();
                    return [...ids].map(id => api.get(id)).filter(Boolean);
                },
                has(value) {
                    version.value;
                    return secondary.get(field).has(value);
                },
                values() {
                    version.value;
                    return secondary.get(field);
                }
            };
        },
        whereIndexed(field, value) {
            if (disposed) return computed(() => []);
            const idx = api.indexBy(field);
            return computed(() => idx.get(typeof value === 'function' ? value() : value));
        },
        incrementalWhere(predicate) {
            if (disposed) return Object.freeze({ value: [], peek: () => [], subscribe: () => () => false, dispose: () => {}, __litheSignal: true, __litheIncrementalQuery: true });
            return createIncrementalQuery(predicate);
        },
        sort(compare) {
            items.sort(compare);
            rebuild();
        },
        get size() {
            version.value;
            return items.length;
        },
        toJSON() {
            version.value;
            return items.map(x => x?.__raw || x);
        },
        transaction(fn) {
            if (disposed) throw new Error('Collection has been disposed.');
            const snapshot = api.toJSON().map(x => ({
                ...x
            }));
            try {
                return batch(() => fn(api));
            } catch (e) {
                api.replace(snapshot);
                throw e;
            }
        }
    };
    api.dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const query of [...incremental]) query.dispose();
        incremental.clear();
        index.clear();
        secondary.clear();
        items.splice(0, items.length);
        version.value++;
    };
    if (getOwner()) onCleanup(api.dispose);
    return api;
}
