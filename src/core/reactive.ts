import { schedule } from './scheduler.ts';
import { getOwner, onCleanup, withOwner } from './owner.ts';
import type { Priority, Signal, ReadonlySignal, SignalOptions, ObserverOptions } from './types.ts';

let activeObserver: Observer | null = null;
let tracking = true;
let batchDepth = 0;
let reactiveSeq = 0;
const pendingObservers = new Set<Observer>();
const proxyCache = new WeakMap<object, object>();
const depsByTarget = new WeakMap<object, Map<PropertyKey, Dependency>>();

class Dependency {
  id:number; subscribers:Set<Observer>; label:string; kind:string; sources:Set<Dependency>;
  constructor(label = '',kind='dependency') { this.id = ++reactiveSeq; this.subscribers = new Set<Observer>(); this.label = label; this.kind=kind; this.sources = new Set<Dependency>(); globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.registerDependency?.(this); }
  track() {
    if (!tracking || !activeObserver) return;
    this.subscribers.add(activeObserver);
    activeObserver.dependencies.add(this);
  }
  notify() {
    for (const observer of [...this.subscribers]) { observer.lastCause={id:this.id,name:this.label||null,kind:this.kind}; queueObserver(observer); }
  }
}

function queueObserver(observer: Observer) {
  if (observer.disposed) return;
  if (batchDepth) { pendingObservers.add(observer); return; }
  if (observer.sync) observer.run();
  else schedule(() => observer.run(), observer.priority || 'normal');
}

function flushBatch() {
  const list = [...pendingObservers];
  pendingObservers.clear();
  for (const observer of list) queueObserver(observer);
}

class Observer<T=unknown> {
  fn:(cleanup:(fn:()=>void)=>void)=>T; dependencies:Set<Dependency>; cleanups:Array<()=>void>; disposed:boolean; running:boolean; sync:boolean; priority:Priority; value:T|undefined; owner:ReturnType<typeof getOwner>; id:number; onInvalidate?:()=>void; kind:string; label:string; output:Dependency|null; lastCause:{id:number;name:string|null;kind:string}|null;
  constructor(fn:(cleanup:(fn:()=>void)=>void)=>T, options:ObserverOptions & {kind?:string;onInvalidate?:()=>void} = {}) {
    this.fn = fn;
    this.dependencies = new Set();
    this.cleanups = [];
    this.disposed = false;
    this.running = false;
    this.sync = options.sync ?? true;
    this.priority = options.priority || 'normal';
    this.value = undefined;
    this.owner = getOwner();
    this.id = ++reactiveSeq;
    this.onInvalidate = options.onInvalidate;
    this.kind=options.kind||'effect';this.label=options.name||'';this.output=null;this.lastCause=null;globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.registerObserver?.(this);
    this.run();
  }
  cleanupDeps() {
    for (const dep of this.dependencies) dep.subscribers.delete(this);
    this.dependencies.clear();
    for (let i = this.cleanups.length - 1; i >= 0; i--) this.cleanups[i]();
    this.cleanups.length = 0;
  }
  run() {
    if (this.disposed || this.running) return this.value;
    this.running = true;
    this.cleanupDeps();
    const previous = activeObserver;
    activeObserver = this;
    const previousCause=globalThis.__LITHE_REACTIVE_CAUSE__;globalThis.__LITHE_REACTIVE_CAUSE__=this.lastCause;
    try {
      const invoke = () => this.fn((cleanup) => this.cleanups.push(cleanup));
      this.value = this.owner ? withOwner(this.owner, invoke) : invoke();
      return this.value;
    } finally {
      globalThis.__LITHE_REACTIVE_CAUSE__=previousCause;activeObserver = previous;
      this.running = false;
    }
  }
  dispose() {
    this.disposed = true;
    globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.unregisterObserver?.(this);
    this.cleanupDeps();
  }
}

export function signal<T>(initial:T, options:SignalOptions = {}): Signal<T> {
  const resumeSnapshot=globalThis.__LITHE_RESUME_SIGNAL_SNAPSHOT__||{};let value = options.name && Object.prototype.hasOwnProperty.call(globalThis.__LITHE_HMR_SIGNAL_SNAPSHOT__||{},options.name) ? globalThis.__LITHE_HMR_SIGNAL_SNAPSHOT__[options.name] : (options.name && Object.prototype.hasOwnProperty.call(resumeSnapshot,options.name) ? resumeSnapshot[options.name] : initial);
  const dep = new Dependency(options.name,'signal');
  const api: Signal<T> & {__dep:Dependency} = {
    get value() { dep.track(); return value; },
    set value(next) {
      const resolved = typeof next === 'function' ? (next as unknown as (value:T)=>T)(value) : next;
      if (Object.is(value, resolved)) return;
      const previous = value;
      value = resolved;
      try{globalThis.__LITHE_REACTIVE_DEBUG_HOOK__?.mutation?.({type:'signal',id:dep.id,name:dep.label||null,previous,value:resolved,at:Date.now(),signal:api});}catch{}
      dep.notify();
    },
    peek() { return value; },
    update(fn:(value:T)=>T) { api.value = fn(value); return value; },
    subscribe(fn:(value:T)=>void, opts:ObserverOptions = {}) {
      const obs = new Observer(() => fn(api.value), { sync: opts.sync ?? true, priority: opts.priority });
      return () => obs.dispose();
    },
    toJSON() { return value; },
    valueOf() { return value; },
    toString() { return String(value); },
    __litheSignal: true,
    __dep: dep,
    __litheName: options.name || null
  };
  if (options.name) { (globalThis.__LITHE_NAMED_SIGNALS__||=new Map()).set(options.name,api); const wait=globalThis.__LITHE_RESUME_SIGNAL_WAITERS__?.get?.(options.name);if(wait){for(const fn of [...wait])try{fn(api);}catch{}globalThis.__LITHE_RESUME_SIGNAL_WAITERS__.delete(options.name);} if(globalThis.__LITHE_HMR__){globalThis.__LITHE_HMR_SIGNAL_REGISTRY__||=new Map();globalThis.__LITHE_HMR_SIGNAL_REGISTRY__.set(options.name,api);} }
  return api;
}

export function computed<T>(fn:()=>T, options:SignalOptions = {}): ReadonlySignal<T> {
  const out = signal<T|undefined>(undefined, options);
  let initialized = false;
  const obs = new Observer(() => {
    const next = fn();
    if (!initialized || !Object.is(out.peek(), next)) {
      initialized = true;
      out.value = next;
    }
  }, { sync: true, kind:'computed', name:options.name });
  obs.output=out.__dep;
  const owner = getOwner();
  if (owner) onCleanup(() => obs.dispose());
  return Object.freeze({
    get value() { return out.value; },
    peek: out.peek,
    subscribe: out.subscribe,
    toJSON: out.toJSON,
    valueOf: out.valueOf,
    toString: out.toString,
    __litheSignal: true,
    __computed: true
  });
}

export function effect(fn:(cleanup:(fn:()=>void)=>void)=>unknown, options:ObserverOptions = {}):()=>void {
  const obs = new Observer(fn, { sync: options.sync ?? false, priority: options.priority || 'normal', kind:'effect', name:options.name });
  const owner = getOwner();
  if (owner) onCleanup(() => obs.dispose());
  return () => obs.dispose();
}

export function batch<T>(fn:()=>T):T {
  batchDepth++;
  try { return fn(); }
  finally {
    batchDepth--;
    if (batchDepth === 0) flushBatch();
  }
}

export function untrack<T>(fn:()=>T):T {
  const previous = tracking;
  tracking = false;
  try { return fn(); } finally { tracking = previous; }
}

export function isSignal(value:unknown): value is Signal<unknown>|ReadonlySignal<unknown> { return Boolean(value && typeof value==='object' && (value as any).__litheSignal); }
export function unwrap<T>(value:T|Signal<T>|ReadonlySignal<T>):T { return isSignal(value) ? value.value as T : value as T; }

function getDep(target:object, key:PropertyKey):Dependency {
  let map = depsByTarget.get(target);
  if (!map) depsByTarget.set(target, map = new Map());
  let dep = map.get(key);
  if (!dep) map.set(key, dep = new Dependency(String(key),'state-property'));
  return dep;
}

export function state<T extends object>(target:T):T {
  if (target === null || typeof target !== 'object') throw new TypeError('state() expects an object or array.');
  if (proxyCache.has(target)) return proxyCache.get(target) as T;
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === '__raw') return obj;
      getDep(obj, key).track();
      const value = Reflect.get(obj, key, receiver);
      if (value && typeof value === 'object') return state(value);
      return value;
    },
    set(obj, key, value, receiver) {
      const previous = Reflect.get(obj,key);
      const ok = Reflect.set(obj, key, value, receiver);
      if (!Object.is(previous, value)) {
        getDep(obj, key).notify();
        if (Array.isArray(obj) && key !== 'length') getDep(obj, 'length').notify();
        getDep(obj, Symbol.for('iterate')).notify();
      }
      return ok;
    },
    deleteProperty(obj, key) {
      const had = key in obj;
      const ok = Reflect.deleteProperty(obj, key);
      if (had && ok) {
        getDep(obj, key).notify();
        getDep(obj, Symbol.for('iterate')).notify();
        if (Array.isArray(obj)) getDep(obj, 'length').notify();
      }
      return ok;
    },
    ownKeys(obj) {
      getDep(obj, Symbol.for('iterate')).track();
      return Reflect.ownKeys(obj);
    }
  });
  proxyCache.set(target, proxy);
  return proxy as T;
}

export function watch<T>(source:Signal<T>|ReadonlySignal<T>|(()=>T), callback:(value:T,previous:T|undefined)=>void, options:ObserverOptions & {immediate?:boolean;deep?:boolean} = {}):()=>void {
  let first = true;
  let previous:T|undefined;
  return effect(() => {
    const next = typeof source === 'function' ? source() : unwrap(source);
    if (first) {
      first = false;
      previous = next;
      if (options.immediate) callback(next, undefined);
      return;
    }
    if (!Object.is(next, previous) || options.deep) {
      const old = previous;
      previous = next;
      callback(next, old);
    }
  }, options);
}

