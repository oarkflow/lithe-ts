import { schedule } from './scheduler.ts';
import { getOwner, onCleanup, withOwner } from './owner.ts';
import type { Priority, Signal, ReadonlySignal, SignalOptions, ObserverOptions } from './types.ts';
let activeObserver: any = null;
let tracking = true;
let batchDepth = 0;
let reactiveSeq = 0;
const pendingObservers = new Set<any>();
const proxyCache = new WeakMap<object, object>();
const depsByTarget = new WeakMap<object, Map<PropertyKey, Dependency>>();
const STATE_CLEAN = 0;
const STATE_DIRTY = 1;
export class Dependency {
    id: number;
    label: string;
    kind: string;
    version: number;
    _sub1: any = null;
    _subs: any[] | null = null;
    _subscribers: Set<any> | null = null;
    get subscribers(): Set<any> {
        if (!this._subscribers) {
            this._subscribers = new Set<any>();
            if (this._subs) {
                for (let i = 0; i < this._subs.length; i++) this._subscribers.add(this._subs[i]);
            } else if (this._sub1) {
                this._subscribers.add(this._sub1);
            }
        }
        return this._subscribers;
    }
    constructor(label = '', kind = 'dependency') {
        this.id = ++reactiveSeq;
        this.label = label;
        this.kind = kind;
        this.version = 0;
        if (globalThis.__LITHE_REACTIVE_DEBUG_HOOK__) {
            globalThis.__LITHE_REACTIVE_DEBUG_HOOK__.registerDependency?.(this);
        }
    }
    hasSubscriber(sub: any): boolean {
        if (this._sub1 === sub) return true;
        if (this._subs && this._subs.indexOf(sub) !== -1) return true;
        return Boolean(this._subscribers?.has(sub));
    }
    addSubscriber(sub: any) {
        if (this.hasSubscriber(sub)) return;
        if (this._subscribers) this._subscribers.add(sub);
        if (!this._sub1) {
            this._sub1 = sub;
        } else if (!this._subs) {
            this._subs = [this._sub1, sub];
        } else {
            this._subs.push(sub);
        }
    }
    removeSubscriber(sub: any) {
        if (!this.hasSubscriber(sub)) return;
        if (this._subscribers) this._subscribers.delete(sub);
        if (this._sub1 === sub) {
            if (this._subs && this._subs.length > 1) {
                const idx = this._subs.indexOf(sub);
                if (idx !== -1) this._subs.splice(idx, 1);
                this._sub1 = this._subs[0];
            } else {
                this._sub1 = null;
                this._subs = null;
            }
        } else if (this._subs) {
            const idx = this._subs.indexOf(sub);
            if (idx !== -1) this._subs.splice(idx, 1);
        }
    }
    track() {
        if (!tracking || !activeObserver) return;
        activeObserver.addDependency(this);
    }
    notify() {
        this.version++;
        if (this._subs) {
            const arr = this._subs.slice();
            const len = arr.length;
            for (let i = 0; i < len; i++) {
                arr[i].markDirty(this);
            }
        } else if (this._sub1) {
            this._sub1.markDirty(this);
        }
    }
}
function queueObserver(observer: any) {
    if (observer.disposed) return;
    if (batchDepth) {
        pendingObservers.add(observer);
        return;
    }
    if (observer.sync) observer.run(); else schedule(() => observer.run(), observer.priority || 'normal');
}
function flushBatch() {
    const list = Array.from(pendingObservers);
    pendingObservers.clear();
    for (const observer of list) {
        queueObserver(observer);
    }
}
export class Observer<T = unknown> {
    fn: (cleanup: (fn: () => void) => void) => T;
    dependencies: Dependency[];
    cleanups: Array<() => void>;
    disposed: boolean;
    running: boolean;
    sync: boolean;
    priority: Priority;
    value: T | undefined;
    owner: ReturnType<typeof getOwner>;
    id: number;
    onInvalidate?: () => void;
    kind: string;
    label: string;
    output: Dependency | null;
    lastCause: {
        id: number;
        name: string | null;
        kind: string;
    } | null;
    constructor(fn: (cleanup: (fn: () => void) => void) => T, options: ObserverOptions & {
        kind?: string;
        onInvalidate?: () => void;
    } = {}) {
        this.fn = fn;
        this.dependencies = [];
        this.cleanups = [];
        this.disposed = false;
        this.running = false;
        this.sync = options.sync ?? true;
        this.priority = options.priority || 'normal';
        this.value = undefined;
        this.owner = getOwner();
        this.id = ++reactiveSeq;
        this.onInvalidate = options.onInvalidate;
        this.kind = options.kind || 'effect';
        this.label = options.name || '';
        this.output = null;
        this.lastCause = null;
        globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.registerObserver?.(this);
        this.run();
    }
    addDependency(dep: Dependency) {
        if (this.dependencies.indexOf(dep) !== -1) return;
        this.dependencies.push(dep);
        dep.addSubscriber(this);
    }
    markDirty(cause?: Dependency) {
        if (this.disposed) return;
        if (cause) {
            this.lastCause = {
                id: cause.id,
                name: cause.label || null,
                kind: cause.kind
            };
        }
        this.onInvalidate?.();
        queueObserver(this);
    }
    cleanupDeps() {
        const len = this.dependencies.length;
        for (let i = 0; i < len; i++) {
            this.dependencies[i].removeSubscriber(this);
        }
        this.dependencies.length = 0;
        for (let i = this.cleanups.length - 1; i >= 0; i--) {
            this.cleanups[i]();
        }
        this.cleanups.length = 0;
    }
    run() {
        if (this.disposed || this.running) return this.value;
        this.running = true;
        this.cleanupDeps();
        const previous = activeObserver;
        activeObserver = this;
        const previousCause = globalThis.__LITHE_REACTIVE_CAUSE__;
        globalThis.__LITHE_REACTIVE_CAUSE__ = this.lastCause;
        try {
            const invoke = () => this.fn(cleanup => this.cleanups.push(cleanup));
            this.value = this.owner ? withOwner(this.owner, invoke) : invoke();
            return this.value;
        } finally {
            globalThis.__LITHE_REACTIVE_CAUSE__ = previousCause;
            activeObserver = previous;
            this.running = false;
        }
    }
    dispose() {
        this.disposed = true;
        globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.unregisterObserver?.(this);
        this.cleanupDeps();
    }
}
export class SignalImpl<T> extends Dependency implements Signal<T> {
    _value: T;
    _equals: false | ((previous: T, next: T) => boolean);
    __litheSignal = true;
    __dep: Dependency;
    __litheName: string | null = null;
    constructor(initial: T, options: SignalOptions = {}) {
        super(options.name || '', 'signal');
        const name = options.name;
        let val = initial;
        if (name) {
            const resumeSnapshot = globalThis.__LITHE_RESUME_SIGNAL_SNAPSHOT__;
            const hmrSnapshot = globalThis.__LITHE_HMR_SIGNAL_SNAPSHOT__;
            if (hmrSnapshot && Object.prototype.hasOwnProperty.call(hmrSnapshot, name)) {
                val = hmrSnapshot[name];
            } else if (resumeSnapshot && Object.prototype.hasOwnProperty.call(resumeSnapshot, name)) {
                val = resumeSnapshot[name];
            }
        }
        this._value = val;
        this._equals = options.equals === false ? false : options.equals as any || Object.is;
        this.__dep = this;
        this.__litheName = name || null;
        if (name) {
            (globalThis.__LITHE_NAMED_SIGNALS__ ||= new Map()).set(name, this);
            const wait = globalThis.__LITHE_RESUME_SIGNAL_WAITERS__?.get?.(name);
            if (wait) {
                for (const fn of Array.from(wait)) {
                    try {
                        fn(this);
                    } catch { }
                }
                globalThis.__LITHE_RESUME_SIGNAL_WAITERS__.delete(name);
            }
            if (globalThis.__LITHE_HMR__) {
                (globalThis.__LITHE_HMR_SIGNAL_REGISTRY__ ||= new Map()).set(name, this);
            }
        }
    }
    get value(): T {
        this.track();
        return this._value;
    }
    set value(next: T | ((prev: T) => T)) {
        const resolved = typeof next === 'function' ? (next as any)(this._value) : next;
        if (this._equals && this._equals(this._value, resolved)) return;
        const previous = this._value;
        this._value = resolved;
        if (globalThis.__LITHE_REACTIVE_DEBUG_HOOK__) {
            try {
                globalThis.__LITHE_REACTIVE_DEBUG_HOOK__.mutation?.({
                    type: 'signal',
                    id: this.id,
                    name: this.label || null,
                    previous,
                    value: resolved,
                    at: Date.now(),
                    signal: this
                });
            } catch { }
        }
        this.notify();
    }
    peek(): T {
        return this._value;
    }
    update(fn: (value: T) => T): T {
        this.value = fn(this._value);
        return this._value;
    }
    subscribe(fn: (value: T) => void, opts: ObserverOptions = {}) {
        const obs = new Observer(() => fn(this.value), {
            sync: opts.sync ?? true,
            priority: opts.priority
        });
        return () => obs.dispose();
    }
    toJSON() {
        return this._value;
    }
    valueOf() {
        return this._value;
    }
    toString() {
        return String(this._value);
    }
}
export class ComputedImpl<T> extends Dependency implements ReadonlySignal<T> {
    _fn: () => T;
    _value: T = undefined as any;
    _state: number = STATE_DIRTY;
    _deps: Dependency[] = [];
    _depVersions: number[] = [];
    _owner: ReturnType<typeof getOwner>;
    _disposed = false;
    _equals: false | ((previous: T, next: T) => boolean);
    __litheSignal = true;
    __computed = true;
    __dep: Dependency;
    _dep1: Dependency | null = null;
    _dep1Version = -1;
    constructor(fn: () => T, options: SignalOptions = {}) {
        super(options.name || '', 'computed');
        this._fn = fn;
        this._equals = options.equals === false ? false : options.equals as any || Object.is;
        this.__dep = this;
        this._owner = getOwner();
        if (this._owner) {
            onCleanup(() => this.dispose());
        }
    }
    addDependency(dep: Dependency) {
        if (this._dep1 === dep || this._deps.indexOf(dep) !== -1) return;
        if (!this._dep1) {
            this._dep1 = dep;
            this._dep1Version = dep.version;
        } else {
            this._deps.push(dep);
            this._depVersions.push(dep.version);
        }
        dep.addSubscriber(this);
    }
    markDirty(cause?: Dependency) {
        if (this._state === STATE_DIRTY) return;
        this._state = STATE_DIRTY;
        if (this._subs) {
            const arr = this._subs.slice();
            const len = arr.length;
            for (let i = 0; i < len; i++) {
                arr[i].markDirty(this);
            }
        } else if (this._sub1) {
            this._sub1.markDirty(this);
        }
    }
    _update() {
        if (this._state === STATE_CLEAN) return;
        if (this._dep1) {
            let changed = false;
            if (this._dep1 instanceof ComputedImpl && this._dep1._state !== STATE_CLEAN) {
                this._dep1._update();
            }
            if (this._dep1Version !== this._dep1.version) {
                changed = true;
            }
            if (!changed && this._deps.length > 0) {
                const len = this._deps.length;
                for (let i = 0; i < len; i++) {
                    const dep = this._deps[i];
                    if (dep instanceof ComputedImpl && dep._state !== STATE_CLEAN) {
                        dep._update();
                    }
                    if (this._depVersions[i] !== dep.version) {
                        changed = true;
                        break;
                    }
                }
            }
            if (!changed) {
                this._state = STATE_CLEAN;
                return;
            }

            // In-place re-evaluation without resubscription churn
            const prevObserver = activeObserver;
            activeObserver = null;
            try {
                const nextVal = this._owner ? withOwner(this._owner, this._fn) : this._fn();
                if (!this._equals || !this._equals(this._value, nextVal)) {
                    this._value = nextVal;
                    this.version++;
                }
                this._state = STATE_CLEAN;
                this._dep1Version = this._dep1.version;
                for (let i = 0; i < this._deps.length; i++) {
                    this._depVersions[i] = this._deps[i].version;
                }
            } finally {
                activeObserver = prevObserver;
            }
            return;
        }

        // Initial evaluation with dependency tracking
        const prevObserver = activeObserver;
        activeObserver = this;
        try {
            const nextVal = this._owner ? withOwner(this._owner, this._fn) : this._fn();
            if (!this._equals || !this._equals(this._value, nextVal)) {
                this._value = nextVal;
                this.version++;
            }
            this._state = STATE_CLEAN;
            if (this._dep1) this._dep1Version = this._dep1.version;
            for (let i = 0; i < this._deps.length; i++) {
                this._depVersions[i] = this._deps[i].version;
            }
        } finally {
            activeObserver = prevObserver;
        }
    }
    get value(): T {
        this.track();
        if (this._state !== STATE_CLEAN) {
            this._update();
        }
        return this._value;
    }
    peek(): T {
        if (this._state !== STATE_CLEAN) {
            this._update();
        }
        return this._value;
    }
    subscribe(fn: (value: T) => void, opts: ObserverOptions = {}) {
        const obs = new Observer(() => fn(this.value), {
            sync: opts.sync ?? true,
            priority: opts.priority
        });
        return () => obs.dispose();
    }
    dispose() {
        this._disposed = true;
        if (this._dep1) {
            this._dep1.removeSubscriber(this);
            this._dep1 = null;
        }
        const len = this._deps.length;
        for (let i = 0; i < len; i++) {
            this._deps[i].removeSubscriber(this);
        }
        this._deps.length = 0;
        this._depVersions.length = 0;
    }
    toJSON() {
        return this.value;
    }
    valueOf() {
        return this.value;
    }
    toString() {
        return String(this.value);
    }
}
export function signal<T>(initial: T, options: SignalOptions = {}): Signal<T> {
    return new SignalImpl(initial, options);
}
export function computed<T>(fn: () => T, options: SignalOptions = {}): ReadonlySignal<T> {
    return new ComputedImpl(fn, options);
}
export function effect(fn: (cleanup: (fn: () => void) => void) => unknown, options: ObserverOptions = {}): () => void {
    const obs = new Observer(fn, {
        sync: options.sync ?? false,
        priority: options.priority || 'normal',
        kind: 'effect',
        name: options.name
    });
    const owner = getOwner();
    if (owner) onCleanup(() => obs.dispose());
    return () => obs.dispose();
}
export function batch<T>(fn: () => T): T {
    batchDepth++;
    try {
        return fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) flushBatch();
    }
}
export function untrack<T>(fn: () => T): T {
    const previous = tracking;
    tracking = false;
    try {
        return fn();
    } finally {
        tracking = previous;
    }
}
export function isSignal(value: unknown): value is Signal<unknown> | ReadonlySignal<unknown> {
    return Boolean(value && typeof value === 'object' && (value as any).__litheSignal);
}
export function unwrap<T>(value: T | Signal<T> | ReadonlySignal<T>): T {
    return isSignal(value) ? (value as any).value as T : value as T;
}
function getDep(target: object, key: PropertyKey): Dependency {
    let map = depsByTarget.get(target);
    if (!map) depsByTarget.set(target, map = new Map());
    let dep = map.get(key);
    if (!dep) map.set(key, dep = new Dependency(String(key), 'state-property'));
    return dep;
}
function peekDep(target: object, key: PropertyKey): Dependency | undefined {
    return depsByTarget.get(target)?.get(key);
}
function notifyDep(target: object, key: PropertyKey): void {
    peekDep(target, key)?.notify();
}
export function state<T>(target: T): T {
    if (target === null || typeof target !== 'object') {
        return signal(target) as unknown as T;
    }
    if (isSignal(target)) return target as T;
    if (proxyCache.has(target)) return proxyCache.get(target) as T;

    // Map Collection
    if (target instanceof Map) {
        const map = target;
        const mapProxy: any = new Proxy(map, {
            get(obj, key, receiver) {
                if (key === '__raw') return obj;
                if (key === 'size') {
                    getDep(obj, 'size').track();
                    return obj.size;
                }
                if (key === 'get') {
                    return (k: any) => {
                        getDep(obj, k).track();
                        const val = obj.get(k);
                        return val && typeof val === 'object' ? state(val) : val;
                    };
                }
                if (key === 'has') {
                    return (k: any) => {
                        getDep(obj, k).track();
                        return obj.has(k);
                    };
                }
                if (key === 'set') {
                    return (k: any, v: any) => {
                        const had = obj.has(k);
                        const prev = obj.get(k);
                        obj.set(k, v);
                        if (!had || !Object.is(prev, v)) {
                            notifyDep(obj, k);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                        return receiver;
                    };
                }
                if (key === 'delete') {
                    return (k: any) => {
                        const had = obj.has(k);
                        const ok = obj.delete(k);
                        if (had && ok) {
                            notifyDep(obj, k);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                        return ok;
                    };
                }
                if (key === 'clear') {
                    return () => {
                        if (obj.size > 0) {
                            const keys = Array.from(obj.keys());
                            obj.clear();
                            for (const k of keys) notifyDep(obj, k);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                    };
                }
                if (key === 'keys' || key === 'values' || key === 'entries' || key === Symbol.iterator || key === 'forEach') {
                    getDep(obj, Symbol.for('iterate')).track();
                    const method = (obj as any)[key];
                    return typeof method === 'function' ? method.bind(obj) : method;
                }
                const val = Reflect.get(obj, key);
                return typeof val === 'function' ? val.bind(obj) : val;
            }
        });
        proxyCache.set(target, mapProxy);
        return mapProxy as T;
    }

    // Set Collection
    if (target instanceof Set) {
        const setObj = target;
        const setProxy: any = new Proxy(setObj, {
            get(obj, key, receiver) {
                if (key === '__raw') return obj;
                if (key === 'size') {
                    getDep(obj, 'size').track();
                    return obj.size;
                }
                if (key === 'has') {
                    return (v: any) => {
                        getDep(obj, v).track();
                        return obj.has(v);
                    };
                }
                if (key === 'add') {
                    return (v: any) => {
                        const had = obj.has(v);
                        obj.add(v);
                        if (!had) {
                            notifyDep(obj, v);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                        return receiver;
                    };
                }
                if (key === 'delete') {
                    return (v: any) => {
                        const had = obj.has(v);
                        const ok = obj.delete(v);
                        if (had && ok) {
                            notifyDep(obj, v);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                        return ok;
                    };
                }
                if (key === 'clear') {
                    return () => {
                        if (obj.size > 0) {
                            const values = Array.from(obj.values());
                            obj.clear();
                            for (const v of values) notifyDep(obj, v);
                            notifyDep(obj, 'size');
                            notifyDep(obj, Symbol.for('iterate'));
                        }
                    };
                }
                if (key === 'keys' || key === 'values' || key === 'entries' || key === Symbol.iterator || key === 'forEach') {
                    getDep(obj, Symbol.for('iterate')).track();
                    const method = (obj as any)[key];
                    return typeof method === 'function' ? method.bind(obj) : method;
                }
                const val = Reflect.get(obj, key);
                return typeof val === 'function' ? val.bind(obj) : val;
            }
        });
        proxyCache.set(target, setProxy);
        return setProxy as T;
    }

    // Date / RegExp / TypedArray built-ins
    if (target instanceof Date || target instanceof RegExp || ArrayBuffer.isView(target)) {
        const builtInProxy: any = new Proxy(target as any, {
            get(obj, key, receiver) {
                if (key === '__raw') return obj;
                getDep(obj, key).track();
                const val = Reflect.get(obj, key);
                return typeof val === 'function' ? val.bind(obj) : val;
            },
            set(obj, key, value, receiver) {
                const previous = Reflect.get(obj, key);
                const ok = Reflect.set(obj, key, value, obj);
                if (!Object.is(previous, value)) {
                    notifyDep(obj, key);
                }
                return ok;
            }
        });
        proxyCache.set(target as any, builtInProxy);
        return builtInProxy as T;
    }

    // Plain Objects and Arrays
    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            if (key === '__raw') return obj;
            getDep(obj, key).track();
            const value = (obj as any)[key];
            if (value && typeof value === 'object') return state(value);
            return value;
        },
        set(obj, key, value, receiver) {
            const unwrapped = value && (value as any).__raw ? (value as any).__raw : value;
            const previous = (obj as any)[key];
            if (previous === unwrapped) return true;
            (obj as any)[key] = unwrapped;
            notifyDep(obj, key);
            if (Array.isArray(obj) && key !== 'length') notifyDep(obj, 'length');
            notifyDep(obj, Symbol.for('iterate'));
            return true;
        },
        deleteProperty(obj, key) {
            const had = key in obj;
            const ok = Reflect.deleteProperty(obj, key);
            if (had && ok) {
                notifyDep(obj, key);
                notifyDep(obj, Symbol.for('iterate'));
                if (Array.isArray(obj)) notifyDep(obj, 'length');
            }
            return ok;
        },
        has(obj, key) {
            getDep(obj, key).track();
            return Reflect.has(obj, key);
        },
        getOwnPropertyDescriptor(obj, key) {
            getDep(obj, key).track();
            return Reflect.getOwnPropertyDescriptor(obj, key);
        },
        ownKeys(obj) {
            getDep(obj, Symbol.for('iterate')).track();
            return Reflect.ownKeys(obj);
        }
    });
    proxyCache.set(target, proxy);
    proxyCache.set(proxy, proxy);
    return proxy as T;
}
function deepEqual(a: unknown, b: unknown, depth = 0, seen?: Set<object>): boolean {
    if (Object.is(a, b)) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (depth > 5) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (!seen) seen = new Set();
    if (seen.has(a as object) || seen.has(b as object)) return false;
    seen.add(a as object);
    seen.add(b as object);
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual((a as any)[key], (b as any)[key], depth + 1, seen)) return false;
    }
    return true;
}
export function watch<T>(source: Signal<T> | ReadonlySignal<T> | (() => T), callback: (value: T, previous: T | undefined) => void, options: ObserverOptions & {
    immediate?: boolean;
    deep?: boolean;
} = {}): () => void {
    let first = true;
    let previous: T | undefined;
    return effect(() => {
        const next = typeof source === 'function' ? source() : unwrap(source);
        if (first) {
            first = false;
            previous = next;
            if (options.immediate) callback(next, undefined);
            return;
        }
        const changed = options.deep ? !deepEqual(next, previous) : !Object.is(next, previous);
        if (changed) {
            const old = previous;
            previous = next;
            callback(next, old);
        }
    }, options);
}
