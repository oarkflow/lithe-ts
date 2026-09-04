import { signal, batch } from '../core/reactive.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
import { currentCorrelation, withCorrelation, correlationEvent } from '../observability/carrier.ts';
import type { Signal } from '../core/types.ts';
export type QueryKey = unknown | (() => unknown);
export interface QueryContext {
    signal: AbortSignal;
    key: QueryKey;
    pageParam?: unknown;
    pageIndex?: number;
    traceId?: string | null;
}
export interface QueryPersistence {
    save?(snapshot: unknown[]): void | Promise<void>;
    load?(): unknown[] | null | Promise<unknown[] | null>;
}
export interface QueryOptions<T = unknown> {
    key: QueryKey;
    fetch?: (context: QueryContext) => T | Promise<T>;
    queryFn?: (context: QueryContext) => T | Promise<T>;
    stale?: number | string;
    gc?: number | string;
    retry?: number;
    force?: boolean;
    enabled?: boolean;
    tags?: string[];
    traceId?: string | null;
    pageParam?: unknown;
    client?: QueryClient;
}
interface QueryEntry<T = unknown> {
    key: string;
    data: Signal<T | undefined>;
    error: Signal<unknown>;
    loading: Signal<boolean>;
    updatedAt: number;
    promise: Promise<T> | null;
    controller: AbortController | null;
    subscribers: number;
    gcTimer: any;
    tags: Set<string>;
    options: QueryOptions<T> | null;
}
export interface QueryResult<T> {
    readonly data: T | undefined;
    readonly error: unknown;
    readonly loading: boolean;
    readonly stale: boolean;
    refresh(): Promise<T>;
    abort(): void;
    dispose(): void;
    key(): string;
}
export interface QueryClientOptions {
    cache?: Map<string, QueryEntry<any>>;
    stale?: number | string;
    gc?: number | string;
    retry?: number;
    refetchOnFocus?: boolean;
    refetchOnReconnect?: boolean;
    persistence?: QueryPersistence | null;
    autoStart?: boolean;
}
let defaultFetcher = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? r.json() : r.text();
});
function stable(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return `[fn:${value.name || 'anonymous'}]`;
    if (value && typeof value === 'object') {
        if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
export function parseDuration(value: unknown): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const m = String(value).match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
    if (!m) return Number(value) || 0;
    return Number(m[1]) * {
        ms: 1,
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000
    }[m[2]];
}
function resolveKey(key: QueryKey): string {
    return stable(typeof key === 'function' ? key() : key);
}
function newEntry<T = unknown>(key: string): QueryEntry<T> {
    return {
        key,
        data: signal<T | undefined>(undefined),
        error: signal<unknown>(null),
        loading: signal(false),
        updatedAt: 0,
        promise: null,
        controller: null,
        subscribers: 0,
        gcTimer: null,
        tags: new Set<string>(),
        options: null
    };
}
function safeTimer(fn: (...args: any[]) => void, ms: number) {
    const t = setTimeout(fn, ms);
    t.unref?.();
    return t;
}
export class QueryClient {
    cache: Map<string, QueryEntry<any>>;
    defaults: {
        stale: number;
        gc: number;
        retry: number;
        refetchOnFocus: boolean;
        refetchOnReconnect: boolean;
    };
    persistence: QueryPersistence | null;
    listeners: Set<(event: any) => void>;
    _started: boolean;
    stopListening: (() => void) | null;
    constructor(options: QueryClientOptions = {}) {
        // Clients are isolated by default. The exported `queryClient` below
        // remains the shared application singleton; independently created
        // clients must not retain or expose one another's query data.
        this.cache = options.cache || new Map<string, QueryEntry<any>>();
        this.defaults = {
            stale: parseDuration(options.stale ?? '30s'),
            gc: parseDuration(options.gc ?? '5m'),
            retry: options.retry ?? 1,
            refetchOnFocus: options.refetchOnFocus ?? true,
            refetchOnReconnect: options.refetchOnReconnect ?? true
        };
        this.persistence = options.persistence || null;
        this.listeners = new Set();
        this._started = false;
        this.stopListening = null;
        if (this.persistence) this.restore().catch(e => console.warn('[lithe:data] Failed to restore query cache:', e));
        if (options.autoStart !== false) this.start();
    }
    getEntry<T = unknown>(key: QueryKey | string): QueryEntry<T> {
        const hash = typeof key === 'string' ? key : resolveKey(key);
        let entry = this.cache.get(hash);
        if (!entry) {
            entry = newEntry(hash);
            this.cache.set(hash, entry);
        }
        return entry;
    }
    private scheduleGC(entry: QueryEntry<any>, fallback?: number | string): void {
        if (entry.subscribers > 0) return;
        const gc = parseDuration(entry.options?.gc ?? fallback ?? this.defaults.gc);
        if (gc <= 0) return;
        clearTimeout(entry.gcTimer);
        entry.gcTimer = safeTimer(() => {
            if (entry.subscribers === 0 && this.cache.get(entry.key) === entry) {
                entry.controller?.abort('gc');
                this.cache.delete(entry.key);
            }
        }, gc);
    }
    emit(event: unknown): void {
        for (const fn of this.listeners) try {
            fn(event);
        } catch { }
    }
    subscribe(fn: (event: any) => void): () => boolean {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    async fetchQuery<T = unknown>(options: QueryOptions<T>): Promise<T> {
        const hash = resolveKey(options.key),
            entry = this.getEntry(hash),
            stale = parseDuration(options.stale ?? this.defaults.stale);
        entry.options = options;
        entry.tags = new Set(options.tags || []);
        clearTimeout(entry.gcTimer);
        entry.gcTimer = null;
        if (entry.data.peek() !== undefined && Date.now() - entry.updatedAt < stale && !options.force) {
            this.scheduleGC(entry, options.gc);
            return entry.data.peek();
        }
        if (entry.promise && !options.force) return entry.promise;
        if (entry.controller) entry.controller.abort('superseded');
        const controller = new AbortController(),
            traceId = options.traceId || currentCorrelation();
        entry.controller = controller;
        entry.loading.value = true;
        entry.error.value = null;
        correlationEvent('query:start', {
            key: hash
        }, traceId);
        const fetcher = options.fetch || options.queryFn;
        if (typeof fetcher !== 'function') throw new TypeError('query requires fetch/queryFn function');
        const retries = options.retry ?? this.defaults.retry;
        entry.promise = (async () => {
            let attempt = 0;
            while (true) {
                try {
                    const result = await withCorrelation(traceId, () => fetcher({
                        signal: controller.signal,
                        key: options.key,
                        pageParam: options.pageParam,
                        traceId
                    }));
                    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                    withCorrelation(traceId, () => batch(() => {
                        entry.data.value = result;
                        entry.error.value = null;
                        entry.updatedAt = Date.now();
                    }));
                    this.emit({
                        type: 'success',
                        key: hash,
                        data: result,
                        traceId
                    });
                    correlationEvent('query:end', {
                        key: hash
                    }, traceId);
                    await this.persist();
                    return result;
                } catch (error) {
                    if (controller.signal.aborted) throw error;
                    if (attempt++ >= retries) {
                        entry.error.value = error;
                        this.emit({
                            type: 'error',
                            key: hash,
                            error,
                            traceId
                        });
                        correlationEvent('query:error', {
                            key: hash,
                            message: error.message
                        }, traceId);
                        throw error;
                    }
                    await new Promise(r => safeTimer(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
                }
            }
        })().finally(() => {
            // A forced refetch may have replaced this request. An older
            // request must not clear the newer request's state in finally().
            if (entry.controller === controller) {
                entry.controller = null;
                entry.promise = null;
                entry.loading.value = false;
                this.scheduleGC(entry, options.gc);
            }
        });
        return entry.promise;
    }
    setQueryData<T = unknown>(key: QueryKey, updater: T | ((old: T | undefined) => T), {
        tags
    }: {
        tags?: string[];
    } = {}): T | undefined {
        const entry = this.getEntry(resolveKey(key));
        entry.data.value = typeof updater === 'function' ? updater(entry.data.peek()) : updater;
        entry.updatedAt = Date.now();
        if (tags) entry.tags = new Set(tags);
        this.persist().catch(e => console.warn('[lithe:data] Failed to persist after setQueryData:', e));
        this.scheduleGC(entry);
        return entry.data.peek();
    }
    getQueryData<T = unknown>(key: QueryKey): T | undefined {
        return this.cache.get(resolveKey(key))?.data.peek();
    }
    invalidate(prefix: QueryKey): void {
        const hash = resolveKey(prefix);
        for (const [key, entry] of this.cache) if (key.includes(hash) || key.startsWith(hash) || key === hash) entry.updatedAt = 0;
        if (typeof prefix === 'string' || Array.isArray(prefix)) {
            const tags = Array.isArray(prefix) ? prefix : [prefix];
            for (const entry of this.cache.values()) if (tags.some(t => entry.tags.has(String(t)))) entry.updatedAt = 0;
        }
        this.emit({
            type: 'invalidate',
            key: hash
        });
        this.refetchStale('invalidate').catch(e => console.warn('[lithe:data] Failed to refetch stale:', e));
    }
    invalidateTags(tags: string | string[]): void {
        const wanted = new Set(Array.isArray(tags) ? tags : [tags]);
        for (const entry of this.cache.values()) if ([...entry.tags].some(t => wanted.has(t))) entry.updatedAt = 0;
        this.emit({
            type: 'invalidateTags',
            tags: [...wanted]
        });
        this.refetchStale('invalidateTags').catch(e => console.warn('[lithe:data] Failed to refetch stale tags:', e));
    }
    async refetchStale(reason = 'manual'): Promise<void> {
        const jobs = [];
        for (const entry of this.cache.values()) {
            if (!entry.options || entry.subscribers <= 0) continue;
            const stale = parseDuration(entry.options.stale ?? this.defaults.stale);
            if (!entry.updatedAt || Date.now() - entry.updatedAt >= stale) jobs.push(this.fetchQuery({
                ...entry.options,
                force: true
            }).catch(() => { }));
        }
        this.emit({
            type: 'revalidate',
            reason,
            count: jobs.length
        });
        await Promise.all(jobs);
    }
    cancel(key: QueryKey): void {
        this.cache.get(resolveKey(key))?.controller?.abort('cancelled');
    }
    clear(): void {
        for (const entry of this.cache.values()) {
            entry.controller?.abort('cache cleared');
            clearTimeout(entry.gcTimer);
        }
        this.cache.clear();
        this.persist().catch(e => console.warn('[lithe:data] Failed to persist after clear:', e));
    }
    destroy(): void {
        this.stopListening?.();
        this.clear();
        this.listeners.clear();
    }
    dehydrate(): Array<{
        key: string;
        data: unknown;
        updatedAt: number;
        tags: string[];
    }> {
        return [...this.cache].filter(([, e]) => e.data.peek() !== undefined).map(([key, e]) => ({
            key,
            data: e.data.peek(),
            updatedAt: e.updatedAt,
            tags: [...e.tags]
        }));
    }
    hydrate(snapshot: Array<{
        key: string;
        data: any;
        updatedAt?: number;
        tags?: string[];
    }> = []): void {
        for (const item of snapshot) {
            const entry = this.getEntry(item.key);
            entry.data.value = item.data;
            entry.updatedAt = item.updatedAt || Date.now();
            entry.tags = new Set(item.tags || []);
        }
    }
    async persist(): Promise<void> {
        if (!this.persistence?.save) return;
        await this.persistence.save(this.dehydrate());
    }
    async restore(): Promise<void> {
        if (!this.persistence?.load) return;
        const data = await this.persistence.load();
        if (data) this.hydrate(data);
    }
    start(): () => void {
        if (this._started || typeof window === 'undefined') return () => { };
        this._started = true;
        const focus = () => {
            if (document.visibilityState === 'visible' && this.defaults.refetchOnFocus) this.refetchStale('focus');
        };
        const online = () => {
            if (this.defaults.refetchOnReconnect) this.refetchStale('reconnect');
        };
        addEventListener('visibilitychange', focus);
        addEventListener('online', online);
        this.stopListening = () => {
            removeEventListener('visibilitychange', focus);
            removeEventListener('online', online);
            this._started = false;
            this.stopListening = null;
        };
        return this.stopListening;
    }
    retain(entry: QueryEntry<any>, options: {
        gc?: number | string;
    } = {}): () => void {
        entry.subscribers++;
        clearTimeout(entry.gcTimer);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            entry.subscribers = Math.max(0, entry.subscribers - 1);
            if (entry.subscribers === 0) {
                this.scheduleGC(entry, options.gc);
            }
        };
    }
}
export const queryClient = new QueryClient();
export function query<T = unknown>(options: QueryOptions<T>): QueryResult<T> {
    const client = options.client || queryClient;
    let currentHash = resolveKey(options.key),
        entry = client.getEntry(currentHash);
    entry.options = options;
    if (options.tags) entry.tags = new Set(options.tags);
    let release = client.retain(entry, options);
    const refresh = async (force = true) => {
        const hash = resolveKey(options.key);
        if (hash !== currentHash) {
            release();
            currentHash = hash;
            entry = client.getEntry(hash);
            entry.options = options;
            if (options.tags) entry.tags = new Set(options.tags);
            release = client.retain(entry, options);
        }
        return client.fetchQuery({
            ...options,
            force
        });
    };
    if (options.enabled !== false) refresh(false).catch(e => console.warn('[lithe:data] Failed to fetch query:', e));
    if (getOwner()) onCleanup(() => release());
    return {
        get data() {
            return entry.data.value;
        },
        get error() {
            return entry.error.value;
        },
        get loading() {
            return entry.loading.value;
        },
        get stale() {
            return !entry.updatedAt || Date.now() - entry.updatedAt >= parseDuration(options.stale ?? client.defaults.stale);
        },
        refresh: () => refresh(true),
        abort: () => entry.controller?.abort('aborted'),
        dispose: release,
        key: () => currentHash
    };
}
export function defineQuery<T = unknown>(options: QueryOptions<T>): QueryOptions<T> {
    return options;
}
export function resource<T = unknown>(fetcher: (context: {
    signal: AbortSignal;
}) => T | Promise<T>, options: Partial<QueryOptions<T>> = {}): QueryResult<T> {
    return query({
        key: options.key || ['resource', fetcher.name || 'anonymous', Math.random().toString(36).slice(2)],
        fetch: ({
            signal
        }) => fetcher({
            signal
        }),
        ...options
    });
}
export function infiniteQuery<T = unknown, P = unknown>(options: any) {
    const pages = signal([]),
        pageParams = signal([]),
        loading = signal(false),
        error = signal(null),
        hasNext = signal(true);
    let activeController: AbortController | null = null,
        disposed = false;
    const baseKey = () => typeof options.key === 'function' ? options.key() : options.key;
    async function fetchPage(pageParam, replace = false) {
        if (disposed) throw new Error('infiniteQuery has been disposed');
        if (activeController) activeController.abort('superseded');
        const controller = new AbortController();
        activeController = controller;
        loading.value = true;
        error.value = null;
        try {
            const index = replace ? 0 : pages.peek().length;
            const data = await (options.fetch || options.queryFn)({
                pageParam,
                signal: controller.signal,
                pageIndex: index
            });
            if (controller.signal.aborted || disposed) return;
            batch(() => {
                pages.value = replace ? [data] : [...pages.peek(), data];
                pageParams.value = replace ? [pageParam] : [...pageParams.peek(), pageParam];
                const next = options.getNextPageParam?.(data, pages.peek());
                hasNext.value = next !== undefined && next !== null;
            });
            return data;
        } catch (e) {
            if (controller.signal.aborted) return;
            error.value = e;
            throw e;
        } finally {
            if (activeController === controller) activeController = null;
            loading.value = false;
        }
    }
    const initial = options.initialPageParam;
    if (options.enabled !== false) fetchPage(initial, true).catch(e => {
        if (!disposed) console.warn('[lithe:data] Failed to fetch initial page:', e);
    });
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        activeController?.abort('infinite query disposed');
        activeController = null;
        batch(() => {
            pages.value = [];
            pageParams.value = [];
            loading.value = false;
            error.value = null;
            hasNext.value = false;
        });
    };
    if (getOwner()) onCleanup(dispose);
    return {
        get pages() {
            return pages.value;
        },
        get data() {
            return options.select ? options.select(pages.value) : pages.value.flatMap(x => Array.isArray(x) ? x : [x]);
        },
        get loading() {
            return loading.value;
        },
        get error() {
            return error.value;
        },
        get hasNext() {
            return hasNext.value;
        },
        async fetchNext() {
            if (!pages.peek().length) return fetchPage(initial, true);
            const next = options.getNextPageParam?.(pages.peek().at(-1), pages.peek(), pageParams.peek().at(-1));
            if (next == null) {
                hasNext.value = false;
                return;
            }
            return fetchPage(next, false);
        },
        refresh: () => fetchPage(initial, true),
        key: baseKey,
        dispose
    };
}
export const cursorQuery = infiniteQuery;
export function mutation<TVariables = unknown, TData = unknown>(options: any) {
    const pending = signal(false),
        error = signal(null),
        data = signal(undefined);
    const client = options.client || queryClient;
    const mutate = async variables => {
        const snapshot = options.optimistic ? await options.optimistic(variables) : undefined;
        pending.value = true;
        error.value = null;
        try {
            const result = await (options.action || options.mutationFn)(variables);
            data.value = result;
            const invalidates = options.invalidate || options.invalidates;
            if (invalidates) {
                const list = Array.isArray(invalidates) ? invalidates : [invalidates];
                for (const key of list) {
                    client.invalidate(key);
                    if (typeof key === 'string') client.invalidateTags(key);
                }
            }
            if (options.writes) client.invalidateTags(options.writes);
            await options.onSuccess?.(result, variables);
            return result;
        } catch (err) {
            error.value = err;
            await options.rollback?.(snapshot, err, variables);
            await options.onError?.(err, variables);
            throw err;
        } finally {
            pending.value = false;
            await options.onSettled?.(data.peek(), error.peek(), variables);
        }
    };
    return {
        mutate,
        get pending() {
            return pending.value;
        },
        get loading() {
            return pending.value;
        },
        get error() {
            return error.value;
        },
        get data() {
            return data.value;
        },
        reset() {
            batch(() => {
                pending.value = false;
                error.value = null;
                data.value = undefined;
            });
        }
    };
}
export interface MutationOptions<TVariables = unknown, TData = unknown> {
    action?: (variables: TVariables) => TData | Promise<TData>;
    mutationFn?: (variables: TVariables) => TData | Promise<TData>;
    optimistic?: (variables: TVariables) => unknown | Promise<unknown>;
    rollback?: (snapshot: unknown, error: unknown, variables: TVariables) => unknown | Promise<unknown>;
    onSuccess?: (data: TData, variables: TVariables) => unknown | Promise<unknown>;
    onError?: (error: unknown, variables: TVariables) => unknown | Promise<unknown>;
    onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => unknown | Promise<unknown>;
    invalidate?: QueryKey[];
    invalidates?: QueryKey[];
    writes?: string[];
    client?: QueryClient;
}
export function defineMutation<TVariables = unknown, TData = unknown>(options: MutationOptions<TVariables, TData>): MutationOptions<TVariables, TData> {
    return options;
}
export function createStoragePersister(storage, key = 'lithe:query-cache') {
    return {
        async load() {
            try {
                const raw = await storage.getItem(key);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        },
        async save(snapshot) {
            try {
                await storage.setItem(key, JSON.stringify(snapshot));
            } catch (e) {
                console.warn('[lithe:data] Failed to persist query cache:', e);
            }
        }
    };
}
export function setDefaultFetcher(fn: typeof defaultFetcher): void {
    defaultFetcher = fn;
}
export function request<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    return defaultFetcher(input, init) as Promise<T>;
}
export { stable as stableQueryKey };
