import { state, computed, effect, batch, untrack, type ReadonlySignal } from './reactive.ts';
import { createContext, useContext, getOwner, createScope } from './owner.ts';
export type SetStateAction<T> = Partial<T> | ((prev: T) => Partial<T> | void) | ((draft: T) => void);
export type StateCreator<T, Actions = {}> = (set: (action: SetStateAction<T>, actionName?: string) => void, get: () => T, store: StoreApi<T>) => T & Actions;
export type Listener<T> = (state: T, prevState?: T) => void;
export interface StoreApi<T> {
    getState: () => T;
    setState: (action: SetStateAction<T>, actionName?: string) => void;
    patch: (partialOrUpdater: Partial<T> | ((state: T) => Partial<T> | void), actionName?: string) => void;
    setPath: (path: readonly PropertyKey[], value: unknown, actionName?: string) => void;
    mutate: (producer: (draft: T) => void, actionName?: string) => void;
    subscribe: (listener: Listener<T>) => () => void;
    select: <U>(selector: (state: T) => U, equalityFn?: (a: U, b: U) => boolean) => ReadonlySignal<U>;
    state: T;
    reset: () => void;
    destroy: () => void;
}
export interface StoreHook<T> extends StoreApi<T> {
    <U = T>(selector?: (state: T) => U, equalityFn?: (a: U, b: U) => boolean): U;
}
export interface PersistStorage {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem?: (key: string) => void | Promise<void>;
}
export interface PersistOptions<T> {
    name: string;
    storage?: PersistStorage;
    partialize?: (state: T) => Partial<T>;
    onRehydrate?: (state: T) => void;
}
export interface HistoryOptions {
    limit?: number;
}
function clone<T>(val: T): T {
    if (val === null || typeof val !== 'object') return val;
    if (val instanceof Date) return new Date(val.getTime()) as any;
    if (val instanceof RegExp) return new RegExp(val.source, val.flags) as any;
    if (val instanceof Map) {
        const out = new Map();
        for (const [k, v] of val.entries()) out.set(k, clone(v));
        return out as any;
    }
    if (val instanceof Set) {
        const out = new Set();
        for (const v of val.values()) out.add(clone(v));
        return out as any;
    }
    if (ArrayBuffer.isView(val)) return (val as any).slice();
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(val);
        } catch { }
    }
    try {
        const out: any = Array.isArray(val) ? [] : {};
        for (const [k, v] of Object.entries(val)) {
            if (typeof v !== 'function') {
                out[k] = v && typeof v === 'object' ? clone(v) : v;
            }
        }
        return out;
    } catch {
        return val;
    }
}
function isUnsafeObjectKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
function isMergeObject(value: any): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set) return false;
    return true;
}
type PatchPlan = Array<string[]>;
const patchPlanCache = new Map<string, PatchPlan>();
function patchShapeKey(source: any): string {
    let key = '';
    const walk = (node: any) => {
        for (const k in node) {
            if (isUnsafeObjectKey(k)) continue;
            key += k;
            const value = node[k];
            if (isMergeObject(value)) {
                key += '{';
                walk(value);
                key += '}';
            } else {
                key += ';';
            }
        }
    };
    walk(source);
    return key;
}
function buildPatchPlan(source: any): PatchPlan {
    const paths: PatchPlan = [];
    const walk = (node: any, path: string[]) => {
        for (const k in node) {
            if (isUnsafeObjectKey(k)) continue;
            const value = node[k];
            const next = path.concat(k);
            if (isMergeObject(value)) walk(value, next); else paths.push(next);
        }
    };
    walk(source, []);
    return paths;
}
function getPatchPlan(source: any): PatchPlan {
    const key = patchShapeKey(source);
    let plan = patchPlanCache.get(key);
    if (!plan) {
        plan = buildPatchPlan(source);
        if (patchPlanCache.size > 256) patchPlanCache.clear();
        patchPlanCache.set(key, plan);
    }
    return plan;
}
function applyPatchPlan(target: any, source: any, plan: PatchPlan): any {
    for (let i = 0; i < plan.length; i++) {
        const path = plan[i];
        let targetNode = target;
        let sourceNode = source;
        for (let j = 0; j < path.length - 1; j++) {
            const key = path[j];
            sourceNode = sourceNode[key];
            let nextTarget = targetNode[key];
            if (!isMergeObject(nextTarget)) targetNode[key] = nextTarget = {};
            targetNode = nextTarget;
        }
        const leaf = path[path.length - 1];
        const value = sourceNode[leaf];
        if (!Object.is(targetNode[leaf], value)) targetNode[leaf] = value;
    }
    return target;
}
function applySingleLeafPatch(target: any, source: any): boolean {
    let targetNode = target;
    let sourceNode = source;
    while (isMergeObject(sourceNode)) {
        let key = '';
        let count = 0;
        for (const k in sourceNode) {
            if (isUnsafeObjectKey(k)) continue;
            key = k;
            count++;
            if (count > 1) return false;
        }
        if (count === 0) return true;
        const value = sourceNode[key];
        if (isMergeObject(value)) {
            let nextTarget = targetNode[key];
            if (!isMergeObject(nextTarget)) targetNode[key] = nextTarget = {};
            targetNode = nextTarget;
            sourceNode = value;
            continue;
        }
        if (!Object.is(targetNode[key], value)) targetNode[key] = value;
        return true;
    }
    return false;
}
function deepMerge(target: any, source: any): any {
    if (!isMergeObject(source)) return source;
    if (applySingleLeafPatch(target, source)) return target;
    return applyPatchPlan(target, source, getPatchPlan(source));
}

/**
 * Produces the next immutable state from a base state using an in-place mutation draft recipe (Immer style).
 */
export function produce<T>(baseState: T, recipe: (draft: T) => T | void): T {
    const cloned = clone(baseState);
    const draft = state(cloned);
    const result = recipe(draft);
    return (result !== undefined ? result : (draft as any).__raw || cloned) as T;
}

/**
 * Creates an ultrafast, fine-grained reactive store.
 * Supports any data type: scalars (string, number, boolean), Collections (Map, Set), Arrays, and Objects.
 * Supports both direct mutations (`store.x++`, `store.set(k, v)`) and functional updates (`store.setState(...)`).
 */
export function createStore<T, Actions extends object = {}>(creatorOrInitial: StateCreator<T, Actions> | (T & Actions) | T): StoreHook<T & Actions> {
    let initialData: any = {};
    const listeners = new Set<Listener<T & Actions>>();
    let reactiveState: any = null;
    let isScalar = false;
    let observed = false;
    const writeTarget = (): any => {
        if (!reactiveState || observed || listeners.size > 0) return reactiveState || initialData;
        return initialData;
    };
    const rawSetState = (action: SetStateAction<T & Actions>, actionName?: string) => {
        const target = writeTarget();
        const prev = listeners.size > 0 ? clone(target) : null;
        if (isScalar) {
            if (typeof action === 'function') {
                target.value = (action as any)(target.value);
            } else {
                target.value = action;
            }
        } else {
            if (typeof action === 'function') {
                const result = (action as any)(target);
                if (result && typeof result === 'object') {
                    for (const k in result) (target as any)[k] = result[k];
                }
            } else if (action && typeof action === 'object') {
                for (const k in action) (target as any)[k] = (action as any)[k];
            }
        }
        if (listeners.size > 0 && reactiveState) {
            const next = getState();
            for (const listener of [...listeners]) {
                try {
                    listener(next, isScalar ? prev.value : prev);
                } catch (e) {
                    console.error('[lithe:store] listener error:', e);
                }
            }
        }
        if (actionName && (globalThis as any).__LITHE_DEVTOOLS_ACTION__) {
            try {
                (globalThis as any).__LITHE_DEVTOOLS_ACTION__(actionName, getState());
            } catch { }
        }
    };
    const patch = (partialOrUpdater: Partial<T & Actions> | ((state: T & Actions) => Partial<T & Actions> | void), actionName = 'patch'): void => {
        const target = writeTarget();
        const prev = listeners.size > 0 ? clone(target) : null;
        batch(() => {
            if (isScalar) {
                if (typeof partialOrUpdater === 'function') {
                    target.value = (partialOrUpdater as any)(target.value);
                } else {
                    target.value = partialOrUpdater;
                }
            } else {
                if (typeof partialOrUpdater === 'function') {
                    const res = (partialOrUpdater as any)(target);
                    if (res && typeof res === 'object') {
                        deepMerge(target, res);
                    }
                } else if (partialOrUpdater && typeof partialOrUpdater === 'object') {
                    deepMerge(target, partialOrUpdater);
                }
            }
        });
        if (listeners.size > 0 && reactiveState) {
            const next = getState();
            for (const listener of [...listeners]) {
                try {
                    listener(next, isScalar ? prev.value : prev);
                } catch (e) {
                    console.error('[lithe:store] listener error:', e);
                }
            }
        }
        if (actionName && (globalThis as any).__LITHE_DEVTOOLS_ACTION__) {
            try {
                (globalThis as any).__LITHE_DEVTOOLS_ACTION__(actionName, getState());
            } catch { }
        }
    };
    const setPath = (path: readonly PropertyKey[], value: unknown, actionName = 'setPath'): void => {
        if (!path.length) return;
        const target = writeTarget();
        const prev = listeners.size > 0 ? clone(target) : null;
        let node = isScalar ? target.value : target;
        batch(() => {
            for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                if (typeof key === 'string' && isUnsafeObjectKey(key)) return;
                let next = node[key as any];
                if (!isMergeObject(next)) node[key as any] = next = {};
                node = next;
            }
            const leaf = path[path.length - 1];
            if (typeof leaf === 'string' && isUnsafeObjectKey(leaf)) return;
            if (!Object.is(node[leaf as any], value)) node[leaf as any] = value;
        });
        if (listeners.size > 0 && reactiveState) {
            const next = getState();
            for (const listener of [...listeners]) {
                try {
                    listener(next, isScalar ? prev.value : prev);
                } catch (e) {
                    console.error('[lithe:store] listener error:', e);
                }
            }
        }
        if (actionName && (globalThis as any).__LITHE_DEVTOOLS_ACTION__) {
            try {
                (globalThis as any).__LITHE_DEVTOOLS_ACTION__(actionName, getState());
            } catch { }
        }
    };
    const mutate = (producer: (draft: T & Actions) => void, actionName = 'mutate'): void => {
        rawSetState(producer, actionName);
    };
    const getState = (): any => {
        observed = true;
        const curr = reactiveState || initialData;
        return isScalar ? curr.value : curr;
    };
    const dummyStore: StoreApi<T & Actions> = {
        getState,
        setState: rawSetState,
        patch,
        setPath,
        mutate,
        subscribe: (listener: Listener<T & Actions>) => {
            observed = true;
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        select: ((selector: any, equalityFn?: any) => select(selector, equalityFn)) as any,
        state: null as any,
        reset: null as any,
        destroy: null as any
    };
    if (typeof creatorOrInitial === 'function') {
        initialData = (creatorOrInitial as StateCreator<T, Actions>)(rawSetState, getState, dummyStore);
    } else if (creatorOrInitial === null || typeof creatorOrInitial !== 'object') {
        isScalar = true;
        initialData = {
            value: creatorOrInitial
        };
    } else if (Array.isArray(creatorOrInitial)) {
        initialData = creatorOrInitial;
    } else {
        initialData = Object.assign({}, creatorOrInitial);
    }

    // Create persistent snapshot of raw initial values for reset()
    const rawInitial = clone(initialData);

    // Create fine-grained reactive proxy state
    reactiveState = state<any>(initialData);
    const select = <U,>(selector: (state: T & Actions) => U, equalityFn?: (a: U, b: U) => boolean): ReadonlySignal<U> => {
        observed = true;
        return computed(() => {
            const source = isScalar ? reactiveState.value : reactiveState;
            return selector(source);
        }, {
            equals: equalityFn ? (a, b) => equalityFn(a as U, b as U) : undefined
        });
    };
    const subscribe = (listener: Listener<T & Actions>): () => void => {
        observed = true;
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const reset = (): void => {
        batch(() => {
            if (isScalar) {
                reactiveState.value = rawInitial.value;
            } else {
                for (const [key, val] of Object.entries(rawInitial)) {
                    (reactiveState as any)[key] = clone(val);
                }
            }
        });
    };
    const destroy = (): void => {
        listeners.clear();
    };
    const storeApi: StoreApi<T & Actions> = {
        getState,
        setState: rawSetState,
        patch,
        setPath,
        mutate,
        subscribe,
        select,
        state: reactiveState,
        reset,
        destroy
    };

    // Hook callable representation: `useStore(selector)` or `useStore()`
    const hook: any = function <U = T & Actions>(selector?: (state: T & Actions) => U, equalityFn?: (a: U, b: U) => boolean): any {
        observed = true;
        if (isScalar) {
            if (typeof selector === 'function') return selector(reactiveState.value);
            return reactiveState.value;
        }
        if (typeof selector === 'function') {
            // In reactive context, invoking selector on reactiveState automatically registers fine-grained dependencies
            return selector(reactiveState);
        }
        return reactiveState;
    };
    Object.assign(hook, storeApi);
    return new Proxy(hook, {
        get(target, prop, receiver) {
            if (prop !== 'setState' && prop !== 'patch' && prop !== 'setPath' && prop !== 'mutate' && prop !== 'reset' && prop !== 'destroy') observed = true;
            if (prop in target) return Reflect.get(target, prop, receiver);
            if (isScalar) return Reflect.get(target.state, prop, receiver);
            if (target.state && typeof target.state === 'object') return Reflect.get(target.state, prop, receiver);
            return undefined;
        }
    }) as StoreHook<T & Actions>;
}

/**
 * Defines a named, modular store (Zustand / Pinia style).
 */
export function defineStore<Id extends string, T extends object, Actions extends object = {}>(id: Id, creatorOrInitial: StateCreator<T, Actions> | (T & Actions)): StoreHook<T & Actions> & {
    readonly $id: Id;
} {
    const store = createStore(creatorOrInitial);
    Object.defineProperty(store, '$id', {
        value: id,
        writable: false,
        enumerable: true
    });
    return store as StoreHook<T & Actions> & {
        readonly $id: Id;
    };
}

/**
 * Context-Scoped Store Factory.
 * Returns a [Provider, useStore, Context] tuple to allow isolated store instances per subtree.
 */
export function createContextStore<T extends object, P = Partial<T>>(factory: (props: P) => StoreHook<T>, options: {
    name?: string;
} = {}): [Provider: (props: {
    value?: StoreHook<T>;
    initialProps?: P;
    children?: any;
}) => any, useStore: <U = T>(selector?: (state: T) => U) => U, Context: ReturnType<typeof createContext<StoreHook<T> | null>>] {
    const Context = createContext<StoreHook<T> | null>(null, {
        name: options.name || 'StoreContext'
    });
    const Provider = (props: {
        value?: StoreHook<T>;
        initialProps?: P;
        children?: any;
    }) => {
        let instance = props.value;
        if (!instance) {
            instance = factory(props.initialProps || {} as P);
        }
        const owner = getOwner();
        if (owner) {
            owner.contexts.set(Context.key, instance);
        }
        return props.children ?? null;
    };
    const useStore: any = function <U = T>(selector?: (state: T) => U): any {
        const store = useContext(Context);
        if (!store) {
            throw new Error(`useStore must be used within its corresponding <${options.name || 'Store'}Provider>`);
        }
        return typeof selector === 'function' ? store(selector as any) : store;
    };
    useStore.getState = (): T => {
        const store = useContext(Context);
        if (!store) {
            throw new Error(`useStore.getState must be used within its corresponding <${options.name || 'Store'}Provider>`);
        }
        return store.getState();
    };
    useStore.setState = (action: any, actionName?: string): void => {
        const store = useContext(Context);
        if (!store) {
            throw new Error(`useStore.setState must be used within its corresponding <${options.name || 'Store'}Provider>`);
        }
        store.setState(action, actionName);
    };
    return [Provider, useStore, Context];
}

/**
 * Persist Middleware: Automatically synchronizes store state with localStorage / sessionStorage / custom storage.
 */
export function persist<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options: PersistOptions<T>): StateCreator<T, Actions> {
    return (set, get, store) => {
        const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        const initial = creator(set, get, store);
        if (storage) {
            try {
                const item = storage.getItem(options.name);
                const handleLoaded = (raw: string | null) => {
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            Object.assign(initial, parsed);
                            set(parsed as any, 'persist/rehydrate');
                            if (options.onRehydrate) options.onRehydrate(get() as any);
                        } catch (e) {
                            console.error('[lithe:persist] Failed to parse stored state:', e);
                        }
                    }
                };
                if (item && typeof (item as any).then === 'function') {
                    (item as Promise<string | null>).then(handleLoaded);
                } else {
                    handleLoaded(item as string | null);
                }
            } catch (e) {
                console.warn('[lithe:persist] Storage access warning:', e);
            }

            // Watch for store changes and save
            store.subscribe(state => {
                try {
                    const dataToSave = options.partialize ? options.partialize(state as any) : state;
                    storage.setItem(options.name, JSON.stringify(dataToSave));
                } catch (e) {
                    console.error('[lithe:persist] Failed to persist state:', e);
                }
            });
        }
        return initial;
    };
}

/**
 * History Middleware: Adds undo, redo, and time-travel history snapshots to any store.
 */
export function history<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options: HistoryOptions = {}): StateCreator<T, Actions & {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    clearHistory(): void;
}> {
    const limit = options.limit || 50;
    return (set, get, store) => {
        const past: any[] = [];
        const future: any[] = [];
        let isTimeTraveling = false;
        const base = creator(set, get, store);
        store.subscribe((state, prev) => {
            if (isTimeTraveling || !prev) return;
            past.push(clone(prev));
            if (past.length > limit) past.shift();
            future.length = 0;
        });
        const historyActions = {
            undo() {
                if (!past.length) return;
                const current = clone(store.getState());
                const previous = past.pop()!;
                future.unshift(current);
                isTimeTraveling = true;
                try {
                    set(previous, 'history/undo');
                } finally {
                    isTimeTraveling = false;
                }
            },
            redo() {
                if (!future.length) return;
                const current = clone(store.getState());
                const next = future.shift()!;
                past.push(current);
                isTimeTraveling = true;
                try {
                    set(next, 'history/redo');
                } finally {
                    isTimeTraveling = false;
                }
            },
            canUndo: () => past.length > 0,
            canRedo: () => future.length > 0,
            clearHistory: () => {
                past.length = 0;
                future.length = 0;
            }
        };
        return Object.assign({}, base, historyActions);
    };
}

/**
 * Devtools Middleware: Dispatches state mutations to Redux DevTools Extension or Lithe DevTools.
 */
export function devtools<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options: {
    name?: string;
} = {}): StateCreator<T, Actions> {
    return (set, get, store) => {
        const name = options.name || 'LitheStore';
        const extension = typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__;
        let devtoolsConnection: any = null;
        if (extension) {
            devtoolsConnection = extension.connect({
                name
            });
            devtoolsConnection.init(get());
            devtoolsConnection.subscribe((message: any) => {
                if (message.type === 'DISPATCH' && message.state) {
                    try {
                        set(JSON.parse(message.state), 'devtools/timeTravel');
                    } catch { }
                }
            });
        }
        const wrappedSet = (action: SetStateAction<T>, actionName: string = 'setState') => {
            set(action, actionName);
            if (devtoolsConnection) {
                devtoolsConnection.send(actionName, get());
            }
        };
        return creator(wrappedSet as any, get, store);
    };
}
