export type Priority = 'sync' | 'userBlocking' | 'normal' | 'transition' | 'background' | 'idle';

export interface SignalOptions {
  name?: string;
}

export interface ObserverOptions {
  sync?: boolean;
  priority?: Priority;
  name?: string;
}

export interface Signal<T> {
  value: T;
  peek(): T;
  update(fn:(value:T)=>T): T;
  subscribe(fn:(value:T)=>void, options?:ObserverOptions): () => void;
  toJSON(): T;
  valueOf(): T;
  toString(): string;
  readonly __litheSignal: true;
  readonly __litheName?: string | null;
}

export interface ReadonlySignal<T> {
  readonly value: T;
  peek(): T;
  subscribe(fn:(value:T)=>void, options?:ObserverOptions): () => void;
  toJSON(): T;
  valueOf(): T;
  toString(): string;
  readonly __litheSignal: true;
  readonly __computed: true;
}
