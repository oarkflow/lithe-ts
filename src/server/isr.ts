export function createISRCache(options = {}) {
    const entries = new Map();
    const defaultTTL = options.ttl ?? 60_000;
    const maxEntries = options.maxEntries === 0 ? Infinity : Math.max(1, Number(options.maxEntries ?? 1000) || 1000);
    return {
        async get(key, render, ttl = defaultTTL) {
            const now = Date.now();
            let entry = entries.get(key);
            if (!entry) {
                const value = await render();
                while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
                entries.set(key, {
                    value,
                    expires: now + ttl,
                    promise: null
                });
                return {
                    value,
                    stale: false,
                    revalidated: true
                };
            }
            if (entry.expires > now) return {
                value: entry.value,
                stale: false,
                revalidated: false
            };
            if (!entry.promise) {
                entry.promise = Promise.resolve().then(render).then(value => {
                    entry.value = value;
                    entry.expires = Date.now() + ttl;
                    return value;
                }).finally(() => entry.promise = null);
                // In the default non-blocking path below, this promise is
                // never awaited by the caller (the stale value is returned
                // immediately) — it's only observed opportunistically if a
                // later get() happens to await it in blocking mode. A
                // transient render() failure must not become an unhandled
                // rejection: by default Node terminates the process on one,
                // which would take down every ISR-cached page, not just this
                // key, defeating stale-while-revalidate's whole purpose.
                entry.promise.catch(error => options.onError?.(error, key));
            }
            if (options.blocking) {
                entry.value = await entry.promise;
                return {
                    value: entry.value,
                    stale: false,
                    revalidated: true
                };
            }
            return {
                value: entry.value,
                stale: true,
                revalidated: false
            };
        },
        invalidate(key) {
            if (key === undefined) entries.clear(); else entries.delete(key);
        },
        inspect() {
            return [...entries].map(([key, e]) => ({
                key,
                expires: e.expires,
                revalidating: Boolean(e.promise)
            }));
        }
    };
}
