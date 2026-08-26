/** Lithe v1.1 TypeScript-first public declarations. Zero runtime dependencies. */
declare module '@lithe/core' {
	export type Priority = 'sync' | 'userBlocking' | 'normal' | 'transition' | 'background' | 'idle';
	export interface Signal<T> { value: T; peek(): T; update(fn: (value: T) => T): T; subscribe(fn: (value: T) => void, options?: { sync?: boolean; priority?: Priority }): () => void; toJSON(): T; readonly __litheSignal: true; readonly __litheName?: string | null }
	export interface ReadonlySignal<T> { readonly value: T; peek(): T; subscribe(fn: (value: T) => void): () => void; toJSON(): T; readonly __litheSignal: true; readonly __computed?: true }
	export type Equality<T> = false | ((previous: T, next: T) => boolean);
	export function signal<T>(value: T, options?: { name?: string; equals?: Equality<T> }): Signal<T>;
	export function computed<T>(fn: () => T, options?: { name?: string; equals?: Equality<T> }): ReadonlySignal<T>;
	export function effect(fn: (cleanup: (fn: () => void) => void) => void, options?: { sync?: boolean; priority?: Priority; name?: string }): () => void;
	export function watch<T>(source: Signal<T> | ReadonlySignal<T> | (() => T), callback: (value: T, previous: T | undefined) => void, options?: { immediate?: boolean; deep?: boolean; sync?: boolean; priority?: Priority }): () => void;
	export function batch<T>(fn: () => T): T; export function untrack<T>(fn: () => T): T; export function state<T extends object>(value: T): T;
	export function isSignal(value: unknown): value is Signal<unknown> | ReadonlySignal<unknown>; export function unwrap<T>(value: T | Signal<T> | ReadonlySignal<T>): T;
	export function createScope<T>(fn: (dispose: () => void) => T): { value: T; dispose(): void; owner: Owner | null }; export function onCleanup(fn: () => void): () => void; export function onMount(fn: () => void | (() => void)): void;
	export interface Owner { id: number; contexts: Map<string, unknown>; disposed: boolean }
	export function createContext<T>(defaultValue: T): { provide<R>(value: T, fn: () => R): R; use(): T; Provider(props: { value: T; children?: unknown }): unknown }; export function useContext<T>(context: { use(): T }): T; export function getOwner(): Owner | null; export function withOwner<T>(owner: Owner | null, fn: () => T): T; export function disposeOwner(owner: Owner | null): void; export function ownerTree(owner?: Owner | null): unknown; export function serializeOwnerGraph(owner?: Owner | null): unknown[];
	export type SetStateAction<T> = Partial<T> | ((prev: T) => Partial<T> | void) | ((draft: T) => void);
	export type StateCreator<T, Actions = {}> = (set: (action: SetStateAction<T>, actionName?: string) => void, get: () => T, store: StoreApi<T>) => T & Actions;
	export type StoreListener<T> = (state: T, prevState?: T) => void;
	export interface StoreApi<T> { getState(): T; setState(action: SetStateAction<T>, actionName?: string): void; patch(partialOrUpdater: Partial<T> | ((state: T) => Partial<T> | void), actionName?: string): void; setPath(path: readonly PropertyKey[], value: unknown, actionName?: string): void; mutate(producer: (draft: T) => void, actionName?: string): void; subscribe(listener: StoreListener<T>): () => void; select<U>(selector: (state: T) => U, equalityFn?: (a: U, b: U) => boolean): ReadonlySignal<U>; state: T; reset(): void; destroy(): void }
	export interface StoreHook<T> extends StoreApi<T> { <U = T>(selector?: (state: T) => U, equalityFn?: (a: U, b: U) => boolean): U }
	export function createStore<T, Actions extends object = {}>(creator: StateCreator<T, Actions> | (T & Actions) | T): StoreHook<T & Actions>;
	export function defineStore<Id extends string, T extends object, Actions extends object = {}>(id: Id, creator: StateCreator<T, Actions> | (T & Actions)): StoreHook<T & Actions> & { readonly $id: Id };
	export function createContextStore<T extends object, P = Partial<T>>(factory: (props: P) => StoreHook<T>, options?: { name?: string }): [Provider: (props: { value?: StoreHook<T>; initialProps?: P; children?: unknown }) => unknown, useStore: <U = T>(selector?: (state: T) => U) => U, Context: ReturnType<typeof createContext<StoreHook<T> | null>>];
	export function persist<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options: { name: string; storage?: { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void> }; partialize?: (state: T) => Partial<T>; onRehydrate?: (state: T) => void }): StateCreator<T, Actions>;
	export function history<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options?: { limit?: number }): StateCreator<T, Actions & { undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean; clearHistory(): void }>;
	export function devtools<T extends object, Actions extends object = {}>(creator: StateCreator<T, Actions>, options?: { name?: string }): StateCreator<T, Actions>;
	export function produce<T>(baseState: T, recipe: (draft: T) => T | void): T;
	export function schedule<T>(task: () => T, priority?: Priority): Promise<T>; export const scheduler: { flush(): void; cancel(task: unknown): void }; export function transition<T>(fn: () => T): T; export function flushSync(): void;
	export function deviceProfile(): { memory: number | null; cores: number | null; saveData: boolean; connection: string; lowPower: boolean }; export function adaptivePriority(kind?: string): Priority | string; export function adaptiveSchedule<T>(task: () => T, kind?: string): Promise<T>; export function batteryProfile(): Promise<{ supported: boolean; low: boolean; charging?: boolean; level?: number }>; export function initBatteryAdaptation(): Promise<{ supported: boolean; low: boolean; charging?: boolean; level?: number }>; export function prefetchBudget(): { enabled: boolean; concurrency: number; distance: number }; export function createAdaptiveScheduler(options?: { concurrency?: number }): { schedule<T>(task: () => T, kind?: string): Promise<T>; readonly profile: ReturnType<typeof deviceProfile>; readonly pending: number };
	export function enableReactiveDebug(): () => void; export function onMutation(listener: (event: { type: string; id: number; name: string | null; previous: unknown; value: unknown; at: number }) => void): () => void; export function inspectReactiveGraph(): { nodes: Array<{ id: number; kind: string; name: string | null; subscribers?: number; version?: number; dependencies?: number; owner?: number | null; cause?: unknown }>; edges: Array<{ from: number; to: number; kind: string }>; components?: Array<{ id: string; name: string; meta: Record<string, unknown>; at: number }> }; export function explainSignal<T>(signal: Signal<T> | ReadonlySignal<T>): { id: number; name: string | null; kind: string; version: number; subscribers: Array<{ id: number; kind: string; name: string | null }>; value: T } | null; export function traceUpdate<T>(label: string, fn: () => T): T; export function markComponent(name: string, meta?: Record<string, unknown>): { id: string; name: string; meta: Record<string, unknown>; at: number }; export function serializeSignals(): Record<string, unknown>; export function restoreSignals(snapshot?: Record<string, unknown>): void; export function installSignalSnapshot(snapshot?: Record<string, unknown>): () => void; export function pendingSignals(): Record<string, unknown>; export function getNamedSignal(name: string): Signal<unknown> | undefined; export function serializeOwners(): unknown[]; export function restoreOwners(graph?: unknown[]): Owner[]; export function createDetachedOwner(snapshot: unknown, parent?: Owner | null): Owner; export function registerResumableComputation(meta: { name: string; module: string; exportName?: string; signals?: string[] }): unknown; export function serializeComputations(): unknown[]; export function resumeComputations(list?: unknown[]): () => void; export function resumableEffect(name: string, symbol: { module: string; exportName?: string }, signals?: Array<string | Signal<unknown>>): () => void;
	export class SignalImpl<T> { constructor(value: T, options?: { name?: string; equals?: Equality<T> }); value: T; peek(): T; update(fn: (value: T) => T): T; subscribe(fn: (value: T) => void, options?: { sync?: boolean; priority?: Priority }): () => void; toJSON(): T }
	export class ComputedImpl<T> { constructor(fn: () => T, options?: { name?: string; equals?: Equality<T> }); readonly value: T; peek(): T; subscribe(fn: (value: T) => void): () => void; toJSON(): T }
	export interface Dependency { id: number; label: string; kind: string; version: number }
	export interface Observer { id: number; kind: string; label: string; disposed: boolean; running: boolean }
}

declare module '@lithe/dom' {
	import type { Signal, ReadonlySignal } from '@lithe/core';
	export const Fragment: unique symbol; export const Text: unique symbol; export const Comment: unique symbol;
	export interface VNode { __vnode: true; type: string | symbol | ((props: Record<string, unknown>) => unknown); props: Record<string, unknown>; children: unknown[]; key: unknown }
	export function h(type: string | ((props: Record<string, unknown>) => unknown), props?: Record<string, unknown> | null, ...children: unknown[]): VNode; export const jsx: typeof h; export const jsxs: typeof h; export const jsxDEV: typeof h; export function text(value: unknown): VNode; export function comment(value?: string): VNode; export function isVNode(value: unknown): value is VNode;
	export function mount(root: Element | ShadowRoot, view: VNode | (() => VNode), options?: { clear?: boolean; delegateEvents?: boolean }): () => void; export function hydrate(root: Element | ShadowRoot, view: VNode | (() => VNode), options?: { strict?: boolean; onMismatch?: (error: Error, report: HydrationReport) => void; delegateEvents?: boolean }): () => void;
	export interface HydrationReport { status: string; mismatches: Array<{ message: string; node: string; expected: string | null; at: number }>; fallback: boolean; strict: boolean; at: number }
	export function dynamic<T>(fn: () => T): T; export function trustedHTML(value: string): { __trustedHTML: true; value: string }; export function configureTrustedTypes(options?: { name?: string; createHTML?: (v: string) => string; createScriptURL?: (v: string) => string }): unknown; export function staticTemplate(html: string): { __litheStaticTemplate: true; html: string }; export function compiledTemplate(html: string, bindings?: unknown[]): { __litheCompiledTemplate: true; html: string; bindings: unknown[] }; export function compiledElement(type: string, props?: Record<string, unknown> | null, children?: unknown[]): { __litheCompiledElement: true; type: string; props: Record<string, unknown>; children: unknown[] }; export function createElement(type: string | ((props: Record<string, unknown>) => unknown), props?: Record<string, unknown> | null, ...children: unknown[]): VNode;
	export function Show(props: { when: unknown; fallback?: unknown; children: unknown }): unknown; export function For<T>(props: { each: T[] | Signal<T[]> | (() => T[]); children: (item: T, index: number) => unknown; fallback?: unknown; key?: string | ((item: T, index: number) => unknown) }): unknown; export function Index<T>(props: { each: T[] | Signal<T[]> | (() => T[]); children: (item: T, index: number) => unknown; fallback?: unknown }): unknown; export function Switch(props: { fallback?: unknown; children: unknown }): unknown; export function Match(props: { when: unknown; children: unknown }): unknown; export function Dynamic(props: { component: string | ((props: Record<string, unknown>) => unknown); [key: string]: unknown }): unknown; export function Portal(props: { mount?: Element; children: unknown }): unknown; export function Island(props: { load?: 'idle' | 'visible' | 'media' | 'eager'; media?: string; children: unknown }): unknown; export function Await(props: { promise: Promise<unknown>; fallback?: unknown; children: unknown }): unknown; export function ErrorBoundary(props: { fallback: unknown | ((error: unknown) => unknown); children: unknown }): unknown;
	export function lazy(loader: () => Promise<{ default: ((props: Record<string, unknown>) => unknown) }>, fallback?: unknown): (props: Record<string, unknown>) => unknown; export function lazyEvent(loader: () => Promise<unknown>, exportName?: string): unknown;
	export function eventSymbol(module: string, exportName?: string): { __litheEventSymbol: true; module: string; exportName: string }; export function capturedEventSymbol(module: string, exportName?: string, captures?: unknown): { __litheEventSymbol: true; module: string; exportName: string; captures: unknown }; export function resumeDocument(root?: Document | Element, options?: { state?: unknown; stateId?: string }): () => void; export function serializeResumeState(options?: { signals?: Record<string, unknown>; bindings?: Record<string, unknown>; queries?: unknown[]; routes?: unknown; owners?: unknown[]; computations?: unknown[] }): { signals: Record<string, unknown>; bindings: Record<string, unknown>; queries: unknown[]; routes: unknown; owners: unknown[]; computations: unknown[]; version: number }; export function getHydrationReport(): HydrationReport;
	export function installDelegatedEvents(root: EventTarget): () => void; export function isEventProp(name: string): boolean; export function setDelegatedEvent(node: Element, name: string, value: unknown): void; export function setDirectEvent(node: Element, name: string, value: unknown, previous?: unknown): void;
	export function __mountAny(parent: unknown, value: unknown, before: unknown, options?: Record<string, unknown>): { nodes: unknown[] }; export function __mountChild(parent: unknown, child: unknown, before: unknown, options: Record<string, unknown>): { nodes: unknown[] }; export function __setAttribute(el: Element, key: string, value: unknown, previous?: unknown, options?: Record<string, unknown>): void;
}

declare module '@lithe/router' {
	export interface RouterContext { params: Record<string, string>; query: URLSearchParams; search: Record<string, unknown>; url: URL; route: RouteDefinition; target: RouteTarget; traceId: string; data?: unknown }
	export interface RouteTarget { route: RouteDefinition | null; chain: RouteDefinition[]; params: Record<string, string>; query: URLSearchParams; search: Record<string, unknown>; url: URL; fullPath?: string; notFound: boolean }
	export type RouterMiddleware = (context: RouterContext, next: () => Promise<unknown>) => unknown | Promise<unknown>; export interface RouteDefinition { path?: string; name?: string; component?: RouteComponent; layout?: RouteComponent; children?: RouteDefinition[]; outlets?: Record<string, RouteComponent>; load?: (ctx: RouterContext) => unknown | Promise<unknown>; preload?: (ctx?: RouterContext) => unknown | Promise<unknown>; middleware?: RouterMiddleware[]; searchSchema?: { parse(value: unknown): unknown }; intercept?: boolean; cache?: boolean | string | number; index?: boolean }
	export type RouteComponent = (props: Record<string, unknown>) => unknown;
	export type Loader<TData = unknown, TContext extends RouterContext = RouterContext> = (context: TContext) => TData | Promise<TData>;
	export type TypedRouteDefinition<TParams extends Record<string, string> = Record<string, string>, TSearch = Record<string, unknown>, TData = unknown> = Omit<RouteDefinition, 'load' | 'preload' | 'component' | 'children'> & { component?: (props: RouterContext & { params: TParams; search: TSearch; data?: TData; children?: unknown; outlet?: unknown; router?: unknown }) => unknown; load?: Loader<TData, RouterContext & { params: TParams; search: TSearch }>; preload?: Loader<unknown, RouterContext & { params: TParams; search: TSearch }>; children?: RouteDefinition[] };
	export interface RouterOptions { routes?: RouteDefinition[]; initialURL?: string | URL; notFound?: RouteDefinition | RouteComponent | null; fallback?: unknown; cacheEntries?: number; viewTransitions?: boolean; middleware?: RouterMiddleware[] }
	export interface LazyRouteOptions { exportName?: string; fallback?: unknown; onError?: (error: unknown) => void }
	export interface NavigateOptions { replace?: boolean; state?: unknown; modal?: boolean; preserveBackground?: boolean; transition?: boolean; scroll?: boolean; restore?: boolean; traceId?: string | null }
	export interface RouterApi { routes: RouteDefinition[]; flat: unknown[]; currentURL: import('@lithe/core').Signal<URL>; navigation: import('@lithe/core').Signal<{ state: string; to: URL | null; error: unknown; data: unknown; traceId?: string }>; backgroundURL: import('@lithe/core').Signal<URL | null>; matched: import('@lithe/core').ReadonlySignal<RouteTarget>; resolve(urlLike: string | URL): RouteTarget; load(target: RouteTarget, traceId?: string | null): Promise<unknown>; navigate(to: string | { to: string }, options?: NavigateOptions): Promise<unknown>; prefetch(to: string | { to: string }): Promise<unknown>; start(): () => void; View: () => unknown; Outlet: (props?: { name?: string }) => unknown; invalidate(to?: string): void; params: Record<string, string>; query: URLSearchParams; search: Record<string, unknown>; path: string; cache: Map<string, unknown> }
	export function createRouter(options?: RouterOptions): RouterApi; export function createRouter(routes: RouteDefinition[], options?: Omit<RouterOptions, 'routes'>): RouterApi; export function group(children: RouteDefinition[], options?: Omit<RouteDefinition, 'children' | 'path'> & { path?: string }): RouteDefinition; export function Link(props: { to: string; children?: unknown[]; router?: RouterApi; prefetch?: boolean | 'auto' | 'visible' | 'idle'; ref?: (element: HTMLAnchorElement | null) => void; [key: string]: unknown }): unknown; export function Outlet(props?: { name?: string }): unknown; export function defineRoutes<T extends readonly RouteDefinition[]>(routes: T): T; export function defineLoader<TData = unknown, TContext extends RouterContext = RouterContext>(loader: Loader<TData, TContext>): Loader<TData, TContext>; export function lazyRoute<TProps = Record<string, unknown>>(loader: () => Promise<unknown>, options?: LazyRouteOptions): ((props: TProps) => unknown) & { preload?: () => Promise<unknown> }; export function routePath(route: string, params?: Record<string, unknown>): string; export function prefetchPolicy(): boolean; export function routeManifest(routes: RouteDefinition[]): unknown[]; export function sharedTransition(id: string): { viewTransitionName: string };
}

declare module '@lithe/data' {
	export type QueryKey = unknown | (() => unknown); export interface QueryContext { signal: AbortSignal; key: QueryKey; pageParam?: unknown; pageIndex?: number; traceId?: string | null } export interface QueryOptions<T = unknown> { key: QueryKey; fetch?: (context: QueryContext) => T | Promise<T>; queryFn?: (context: QueryContext) => T | Promise<T>; stale?: number | string; gc?: number | string; retry?: number; force?: boolean; enabled?: boolean; tags?: string[]; traceId?: string | null; pageParam?: unknown; client?: QueryClient }
	export class QueryClient { constructor(options?: { stale?: number | string; gc?: number | string; retry?: number; refetchOnFocus?: boolean; refetchOnReconnect?: boolean; persistence?: { save?(snapshot: unknown[]): void | Promise<void>; load?(): unknown[] | null | Promise<unknown[] | null> } | null; autoStart?: boolean }); fetchQuery<T = unknown>(options: QueryOptions<T>): Promise<T>; getQueryData<T = unknown>(key: QueryKey): T | undefined; setQueryData<T = unknown>(key: QueryKey, updater: T | ((old: T | undefined) => T), options?: { tags?: string[] }): T | undefined; invalidate(key: QueryKey): void; invalidateTags(tags: string | string[]): void; refetchStale(reason?: string): Promise<void>; dehydrate(): Array<{ key: string; data: unknown; updatedAt: number; tags: string[] }>; hydrate(snapshot?: Array<{ key: string; data: unknown; updatedAt?: number; tags?: string[] }>): void; persist(): Promise<void>; restore(): Promise<void>; clear(): void; cancel(key: QueryKey): void; start(): () => void; subscribe(fn: (event: { type: string; key?: string; data?: unknown; error?: unknown; traceId?: string | null }) => void): () => void }
	export const queryClient: QueryClient; export function defineQuery<T = unknown>(options: QueryOptions<T>): QueryOptions<T>; export function query<T = unknown>(options: QueryOptions<T>): { readonly data: T | undefined; readonly error: unknown; readonly loading: boolean; readonly stale: boolean; refresh(): Promise<T>; abort(): void; dispose(): void; key(): string }; export function resource<T = unknown>(fetcher: (context: { signal: AbortSignal }) => T | Promise<T>, options?: Partial<QueryOptions<T>>): { readonly data: T | undefined; readonly error: unknown; readonly loading: boolean; readonly stale: boolean; refresh(): Promise<T>; abort(): void; dispose(): void; key(): string }; export function mutation<TVariables = unknown, TData = unknown>(options: { action?: (variables: TVariables) => TData | Promise<TData>; mutationFn?: (variables: TVariables) => TData | Promise<TData>; optimistic?: (variables: TVariables) => unknown | Promise<unknown>; rollback?: (snapshot: unknown, error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSuccess?: (data: TData, variables: TVariables) => unknown | Promise<unknown>; onError?: (error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => unknown | Promise<unknown>; invalidate?: QueryKey[]; invalidates?: QueryKey[]; writes?: string[]; client?: QueryClient }): { mutate(value: TVariables): Promise<TData>; readonly pending: boolean; readonly loading: boolean; readonly error: unknown; readonly data: TData | undefined; reset(): void }; export function defineMutation<TVariables = unknown, TData = unknown>(options: { action?: (variables: TVariables) => TData | Promise<TData>; mutationFn?: (variables: TVariables) => TData | Promise<TData>; optimistic?: (variables: TVariables) => unknown | Promise<unknown>; rollback?: (snapshot: unknown, error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSuccess?: (data: TData, variables: TVariables) => unknown | Promise<unknown>; onError?: (error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => unknown | Promise<unknown>; invalidate?: QueryKey[]; invalidates?: QueryKey[]; writes?: string[]; client?: QueryClient }): { action?: (variables: TVariables) => TData | Promise<TData>; mutationFn?: (variables: TVariables) => TData | Promise<TData>; optimistic?: (variables: TVariables) => unknown | Promise<unknown>; rollback?: (snapshot: unknown, error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSuccess?: (data: TData, variables: TVariables) => unknown | Promise<unknown>; onError?: (error: unknown, variables: TVariables) => unknown | Promise<unknown>; onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => unknown | Promise<unknown>; invalidate?: QueryKey[]; invalidates?: QueryKey[]; writes?: string[]; client?: QueryClient };
	export function infiniteQuery<T = unknown, P = unknown>(options: { key: QueryKey; fetch?: (context: QueryContext) => T | Promise<T>; queryFn?: (context: QueryContext) => T | Promise<T>; getNextPageParam?: (lastPage: T, allPages: T[], lastPageParam: P) => P | undefined | null; initialPageParam: P; enabled?: boolean; select?: (pages: T[]) => unknown }): { readonly pages: T[]; readonly data: unknown; readonly loading: boolean; readonly error: unknown; readonly hasNext: boolean; fetchNext(): Promise<T | undefined>; refresh(): Promise<T>; key(): QueryKey }; export function cursorQuery<T = unknown, P = unknown>(options: { key: QueryKey; fetch?: (context: QueryContext) => T | Promise<T>; queryFn?: (context: QueryContext) => T | Promise<T>; getNextPageParam?: (lastPage: T, allPages: T[], lastPageParam: P) => P | undefined | null; initialPageParam: P; enabled?: boolean; select?: (pages: T[]) => unknown }): { readonly pages: T[]; readonly data: unknown; readonly loading: boolean; readonly error: unknown; readonly hasNext: boolean; fetchNext(): Promise<T | undefined>; refresh(): Promise<T>; key(): QueryKey }; export function createStoragePersister(storage: { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void> }, key?: string): { load(): Promise<unknown[] | null>; save(snapshot: unknown[]): Promise<void> }; export function stream<T = unknown>(url: string, options?: { protocol?: 'websocket' | 'sse'; parse?: (data: string) => T; reconnect?: boolean; retryDelay?: number; maxRetryDelay?: number; autoConnect?: boolean; withCredentials?: boolean; onOpen?: () => void; onMessage?: (data: T) => void; onError?: (error: unknown) => void }): { data: import('@lithe/core').Signal<T | undefined>; error: import('@lithe/core').Signal<unknown>; connected: import('@lithe/core').Signal<boolean>; state: import('@lithe/core').Signal<string>; connect(): void; close(): void; reconnect(): void; send(value: unknown): void }; export function request<T = unknown>(url: string, options?: RequestInit): Promise<T>; export function setDefaultFetcher(fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>): void; export function parseDuration(value: unknown): number; export function stableQueryKey(key: unknown): string;
}

declare module '@lithe/forms' {
	export class ValidationError extends Error { issues: Array<{ path: Array<string | number>; message: string; code: string }> } export class Schema<T = unknown> { parse(value: unknown): T; safeParse(value: unknown): { success: true; data: T } | { success: false; error: ValidationError }; optional(): Schema<T | undefined>; nullable(): Schema<T | null>; default(value: T): Schema<T>; refine(fn: (value: T) => boolean, message?: string): Schema<T> }
	export function string(options?: { min?: number; max?: number; pattern?: RegExp; trim?: boolean }): Schema<string>; export function number(options?: { min?: number; max?: number; integer?: boolean }): Schema<number>; export function boolean(options?: {}): Schema<boolean>; export function literal<T extends string | number | boolean>(value: T): Schema<T>; export function enumOf<T extends readonly (string | number)[]>(values: T): Schema<T[number]>; export function array<T>(schema: Schema<T>, options?: { min?: number; max?: number }): Schema<T[]>; export function object<T extends Record<string, unknown> = Record<string, unknown>>(shape: Record<string, Schema<unknown>>, options?: { strict?: boolean }): Schema<T>; export function union<T = unknown>(schemas: Schema<unknown>[]): Schema<T>; export function date(options?: { min?: Date; max?: Date }): Schema<Date>; export function email(options?: {}): Schema<string>; export function url(options?: {}): Schema<string>;
	export interface FormField<T extends object> { name: string; value: unknown; readonly error?: string; readonly touched: boolean; readonly dirty: boolean; touch(): void; validate(): Promise<boolean>; props: Record<string, unknown> }
	export interface FormApi<T extends object> { values: T; errors: Record<string, string>; touched: Record<string, boolean>; dirty: Record<string, boolean>; field(name: string | Array<string | number>): FormField<T>; get(path: string | Array<string | number>): unknown; set(path: string | Array<string | number>, value: unknown, flags?: { touch?: boolean; validate?: boolean }): unknown; validate(): { success: true; data: T } | { success: false; error: ValidationError }; validateField(path: string | Array<string | number>): Promise<boolean>; submit(event?: { preventDefault?: () => void }): Promise<{ success: true; data: unknown } | { success: false; error: unknown; errors: Record<string, string> }>; reset(next?: T): void; readonly submitting: boolean; readonly validating: boolean; readonly submitted: boolean; readonly submitError: unknown; readonly valid: boolean; props: { onSubmit: (event?: unknown) => Promise<unknown>; noValidate: true } }
	export function createForm<T extends Record<string, unknown> = Record<string, unknown>>(options?: { initial?: T; schema?: Schema<T>; action?: (values: T) => unknown | Promise<unknown>; onSubmit?: (values: T) => unknown | Promise<unknown>; onChange?: (event: { path: string; value: unknown; values: T }) => void; fieldValidators?: Record<string, (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>>; asyncValidateField?: (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>; validateOnBlur?: boolean; name?: string }): FormApi<T>; export function defineForm<T extends Record<string, unknown>>(options: { initial?: T; schema?: Schema<T>; action?: (values: T) => unknown | Promise<unknown>; onSubmit?: (values: T) => unknown | Promise<unknown>; onChange?: (event: { path: string; value: unknown; values: T }) => void; fieldValidators?: Record<string, (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>>; asyncValidateField?: (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>; validateOnBlur?: boolean; name?: string }): { initial?: T; schema?: Schema<T>; action?: (values: T) => unknown | Promise<unknown>; onSubmit?: (values: T) => unknown | Promise<unknown>; onChange?: (event: { path: string; value: unknown; values: T }) => void; fieldValidators?: Record<string, (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>>; asyncValidateField?: (value: unknown, context: { values: T; path: Array<string | number>; signal: AbortSignal }) => string | boolean | void | Promise<string | boolean | void>; validateOnBlur?: boolean; name?: string }; export function createAdvancedForm<T extends Record<string, unknown> = Record<string, unknown>>(options?: { initial?: T; schema?: Schema<T>; action?: (values: T) => unknown | Promise<unknown>; onSubmit?: (values: T) => unknown | Promise<unknown>; onChange?: (event: { path: string; value: unknown; values: T }) => void; autosave?: boolean | ((snapshot: T) => unknown | Promise<unknown>); autosaveDelay?: number; draftKey?: string; storage?: { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void>; removeItem?(key: string): void | Promise<void> }; restoreDraft?: () => T | null | Promise<T | null>; clearDraft?: () => void | Promise<void> }): FormApi<T> & { fieldArray(name: string | Array<string | number>): { fields: Array<{ id: string; index: number; value: unknown; path: string }>; append(value: unknown): void; insert(index: number, value: unknown): void; remove(index: number): void; move(from: number, to: number): void; replace(values: unknown[]): void }; restoreDraft(): Promise<boolean>; clearDraft(): Promise<void> }; export function AutoForm(props: { schema: Schema<unknown>; onSubmit?: (values: unknown) => unknown | Promise<unknown>; [key: string]: unknown }): unknown; export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]>; export function splitPath(path: string | Array<string | number>): Array<string | number>; export function getPath(value: unknown, path: string | Array<string | number>): unknown; export function setPath(value: unknown, path: string | Array<string | number>, next: unknown): unknown; export function deletePath(value: unknown, path: string | Array<string | number>): void; export function toJSONSchema(schema: Schema<unknown>, options?: { title?: string; description?: string }): unknown; export function toOpenAPI(schema: Schema<unknown>, options?: { title?: string; description?: string }): unknown;
}

declare module '@lithe/rpc' {
	export function server<TInput = any, TOutput = any>(handler: (input: TInput, context: any) => TOutput | Promise<TOutput>): ((input: TInput, options?: any) => Promise<TOutput>) & { id: string; __serverFunction: true }; export function server<TInput = any, TOutput = any>(options: any, handler: (input: TInput, context: any) => TOutput | Promise<TOutput>): any; export function defineAction<TInput = any, TOutput = any>(handler: (input: TInput, context: any) => TOutput | Promise<TOutput>): ((input: TInput, options?: any) => Promise<TOutput>) & { id: string; __serverFunction: true };
	export function handleServerFunction(request: Request, context?: any): Promise<Response>; export function serverManifest(): any; export function serverReference<TInput = any, TOutput = any>(moduleId: string, exportName?: string, options?: any): (input: TInput, options?: any) => Promise<TOutput>; export function createServerModuleHandler(manifest: any, options?: any): Promise<(request: Request, context?: any) => Promise<Response | null>>;
}

declare module '@lithe/server' {
	export * from '@lithe/rpc';
	export function escapeHTML(value: any): string; export function safeJSON(value: any): string; export function createCSRF(secret?: string): any; export function secureHeaders(options?: any): Headers;
	export function renderToString(view: any, options?: any): Promise<string>; export function renderToStream(view: any, options?: any): AsyncGenerator<string>; export function renderRouterToString(router: any, request: Request | string, options?: any): Promise<string>; export function createSSRHandler(options: { router: any; render?: Function; headers?: Record<string, string>;[key: string]: any }): (request: Request) => Promise<Response>; export function streamBoundary(promise: Promise<any>, fallback?: any): any; export function readHydrationState(id?: string): any;
	export function nodeRequest(req: any, origin?: string): Request; export function sendNodeResponse(res: any, response: Response): Promise<void>; export function createWebServer(handler: any, options?: any): any;
	export function createISRCache(options?: any): any; export function createEdgeAdapter(handler: any, options?: any): { fetch(request: Request, env?: any, executionCtx?: any): Promise<Response> }; export const cloudflareAdapter: typeof createEdgeAdapter; export const denoAdapter: typeof createEdgeAdapter; export const bunAdapter: typeof createEdgeAdapter; export function createLambdaAdapter(handler: any, options?: any): Function; export function edgeAdapterMatrix(handler: any): Promise<Record<string, { status: number; body: string }>>;
}

declare module '@lithe/offline' {
	export function createNetworkState(): any; export function registerServiceWorker(url?: string, options?: any): Promise<any>; export function createMutationQueue(options?: any): any; export function generateServiceWorker(options?: any): string;
	export function createMemoryStorage(): any; export function createIndexedDBStorage(options?: any): any; export function registerBackgroundSync(registration?: ServiceWorkerRegistration, tag?: string): Promise<boolean>; export function createPersistentMutationQueue(storage: any, key?: string): any;
}

declare module '@lithe/sync' {
	export class LWWMap { constructor(actor?: string); set(key: any, value: any): any; delete(key: any): any; apply(op: any): this; merge(ops: any[]): this; get(key: any): any; operations(): any[]; toJSON(): any }
	export class ORSet { constructor(actor?: string); add(value: any): any; remove(value: any): any; apply(op: any): this; merge(ops: any[]): this; values(): any[]; operations(): any[]; toJSON(): any }
	export class RGAList { constructor(actor?: string); insert(value: any, after?: string | null): any; remove(id: string): any; apply(op: any): this; merge(ops: any[]): this; values(): any[]; entries(): any[]; idAt(index: number): string | null; operations(): any[]; toJSON(): any }
	export class CRDTDocument { constructor(actor?: string, schema?: Record<string, 'map' | 'set' | 'list'>); set(field: string, key: any, value: any): any; delete(field: string, key: any): any; add(field: string, value: any): any; remove(field: string, value: any): any; insert(field: string, value: any, after?: string | null): any; removeAt(field: string, index: number): any; apply(op: any): this; merge(ops: any[]): this; operations(): any[]; get(field: string, key: any): any; value(field: string): any; toJSON(): any }
	export function createCRDTSync(document: CRDTDocument, options?: any): any; export const conflictStrategies: Record<string, Function>; export function syncedCollection<T extends Record<string, any>>(name: string, options?: any): any;
}

declare module '@lithe/collection' { export function collection<T extends Record<string, any>>(initial?: T[], options?: any): any; }
declare module '@lithe/virtual' { export function createVirtualizer(options: any): any; export function createGridVirtualizer(options: any): any; export function VirtualList(props: any): any; }
declare module '@lithe/grid' { export function createDataGrid(options: any): any; export function DataGrid(props: any): any; }
declare module '@lithe/style' { export function css(rules: Record<string, any>, options?: any): string; export function defineTheme(tokens: Record<string, any>, options?: any): any; export function collectedCSS(): string; export function clearCollectedCSS(): void; }
declare module '@lithe/image' { export function Image(props: any): any; export function transformImageURL(src: string, options?: any): string; export function transcodeImage(input: Blob | ImageBitmap | HTMLImageElement, options?: any): Promise<Blob>; export function supportsImageEncoding(type: string): Promise<boolean> | boolean; export function imageDimensions(input: any): Promise<{ width: number; height: number }>; }
declare module '@lithe/animation' { export function animate(element: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes, options?: KeyframeAnimationOptions): Animation | any; export function transitionView(update: () => any, options?: any): any; export function spring(options?: any): any; }
declare module '@lithe/ui' { export function Dialog(props: any): any; export function Tabs(props: any): any; export function Disclosure(props: any): any; export function Menu(props: any): any; export function Listbox(props: any): any; export function Combobox(props: any): any; export function Tooltip(props: any): any; export function createToasts(): any; export function ToastRegion(props: any): any; export function Tree(props: any): any; export function CommandPalette(props: any): any; export function VisuallyHidden(props: any): any; }
declare module '@lithe/worker' { export interface WorkerFunction<TArgs extends any[] = any[], TReturn = any> { (...args: TArgs): Promise<Awaited<TReturn>>; withTransfer?(args: TArgs, transfer?: Transferable[]): Promise<Awaited<TReturn>>; terminate(): void } export function worker<TArgs extends any[], TReturn>(fn: (...args: TArgs) => TReturn | Promise<TReturn>, options?: any): WorkerFunction<TArgs, TReturn>; export function sharedWorker<TArgs extends any[], TReturn>(fn: (...args: TArgs) => TReturn | Promise<TReturn>, options?: any): WorkerFunction<TArgs, TReturn>; }
declare module '@lithe/interop' { export function defineElement(name: string, component: any, options?: any): CustomElementConstructor | null; export function foreign(mount: (host: Element, props: any) => void | (() => void)): any; export function createHostRenderer(adapter: any): any; export function createNativeRenderer(driver: any): any; export function createMemoryNativeDriver(): any; export function createReactBridge(React: any, ReactDOM: any): any; export function createVueBridge(Vue: any): any; export function createSvelteBridge(Svelte?: any): any; export function createExternalBridge(adapter: any): any; }
declare module '@lithe/devtools' { export function createDevtools(options?: any): any; export function mountReactiveGraphInspector(root: Element, options?: any): { render(): void; dispose(): void }; export function mountDevtoolsOverlay(root?: Element, options?: any): { render(): void; dispose(): void }; }
declare module '@lithe/observability' { export function trace(...args: any[]): any; export function traced(...args: any[]): any; export function onTrace(listener: Function): () => void; export function createTraceContext(...args: any[]): any; export function currentTraceContext(): any; export function withTraceContext<T>(ctx: any, fn: () => T): T; export function traceHeaders(...args: any[]): Record<string, string>; export function contextFromHeaders(headers: Headers | Record<string, string>): any; export function newCorrelationId(): string; export function currentCorrelation(): string | null; export function withCorrelation<T>(id: string | null, fn: (id: string) => T): T; export function correlationHeaders(id?: string | null): Record<string, string>; export function correlationFromHeaders(headers: Headers | Record<string, string>): string | null; export function onCorrelation(listener: Function): () => void; export function correlationEvent(type: string, attributes?: any, id?: string | null): any; }
declare module '@lithe/i18n' { export function createI18n(options: any): any; }
declare module '@lithe/head' { export function createHeadManager(options?: any): any; export function headToString(entries: any): string; }
declare module '@lithe/permissions' { export function createPermissions(source: any): any; export function Can(props: any): any; }
declare module '@lithe/testing' { export function render(view: any, options?: any): any; export function tick(fn?: Function): Promise<void>; export function click(element: Element): void; export function input(element: HTMLInputElement, value: any): void; export function assert(condition: any, message?: string): asserts condition; }
declare module '@lithe/app' { export interface AppConvention { root?: string | Element | DocumentFragment | null; component?: any; router?: any; routes?: any[]; server?: Record<string, unknown>; head?: unknown; errorBoundary?: any; adapters?: Record<string, unknown>; notFound?: any; mount?: Record<string, unknown>; devtools?: boolean } export function defineApp<T extends AppConvention>(config: T): Readonly<T>; export function startApp(config: AppConvention): any; }
declare module '@lithe/runtime' { export * from '@lithe/core'; export * from '@lithe/dom'; }

declare module '@lithe/compiler' {
	export function transformJSX(source: string): string; export function compileModule(source: string, options?: any): any; export function stripTypeScript(source: string, options?: any): string; export function hasNativeTypeScriptTransform(): boolean; export function tokenizeJavaScript(source: string): any[]; export function validateJavaScript(source: string, options?: any): any; export function parseJavaScript(source: string, options?: any): any; export function collectTypeEnvironment(sources: string[]): Map<string, any>; export function semanticTypecheck(source: string, options?: any): any; export function parseType(text: string, env?: Map<string, any>): any; export function inferExpression(text: string, vars?: Map<string, any>, env?: Map<string, any>, functions?: Map<string, any>): any; export function isTypeAssignable(from: any, to: any, env?: Map<string, any>): boolean; export function formatType(type: any): string; export function reactiveGraphIR(code: string, file?: string): any; export function mergeReactiveGraphs(graphs: any[], options?: any): any; export function findReactiveCycles(graph: any): string[][]; export function optimizeReactiveGraph(graph: any): any; export function graphDiagnostics(graph: any): any[]; export function graphToDOT(graph: any): string; export function reactiveDiagnostics(code: string, file?: string): any[]; export function transformWorkerPlacement(code: string, options?: any): any; export function analyzeAccessibility(code: string, file?: string): any[]; export function detectIslands(code: string, file?: string): any[]; export function identitySourceMap(generated: string, source: string, filename?: string, generatedFile?: string): any; export function tracedSourceMap(generated: string, source: string, filename?: string, generatedFile?: string): any; export function customElementModule(options: any): string;
}
declare module '@lithe/experimental' {
	export { detectIslands, transformWorkerPlacement, reactiveGraphIR, optimizeReactiveGraph } from '@lithe/compiler';
	export { createHostRenderer, createNativeRenderer, createMemoryNativeDriver } from '@lithe/interop';
	export { createGridVirtualizer } from '@lithe/virtual';
}

declare module 'lithe-zero-framework' { export * from '@lithe/runtime'; }
declare module 'lithe' { export * from '@lithe/runtime'; }
declare module 'lithe/core' { export * from '@lithe/core'; }
declare module 'lithe/dom' { export * from '@lithe/dom'; }
declare module 'lithe/jsx-runtime' { export * from '@lithe/dom'; }
declare module 'lithe/dom/jsx-runtime' { export * from '@lithe/dom'; }
declare module 'lithe/router' { export * from '@lithe/router'; }
declare module 'lithe/forms' { export * from '@lithe/forms'; }
declare module 'lithe/data' { export * from '@lithe/data'; }
declare module 'lithe/collection' { export * from '@lithe/collection'; }
declare module 'lithe/ui' { export * from '@lithe/ui'; }
declare module 'lithe/style' { export * from '@lithe/style'; }
declare module 'lithe/worker' { export * from '@lithe/worker'; }
declare module 'lithe/offline' { export * from '@lithe/offline'; }
declare module 'lithe/i18n' { export * from '@lithe/i18n'; }
declare module 'lithe/head' { export * from '@lithe/head'; }
declare module 'lithe/permissions' { export * from '@lithe/permissions'; }
declare module 'lithe/testing' { export * from '@lithe/testing'; }
declare module 'lithe/app' { export * from '@lithe/app'; }
declare module 'lithe/runtime' { export * from '@lithe/runtime'; }
declare module 'lithe/compiler' { export * from '@lithe/compiler'; }
declare module 'lithe/experimental' { export * from '@lithe/experimental'; }
declare module 'lithe/virtual' { export * from '@lithe/virtual'; }
declare module 'lithe/grid' { export * from '@lithe/grid'; }
declare module 'lithe/image' { export * from '@lithe/image'; }
declare module 'lithe/animation' { export * from '@lithe/animation'; }
declare module 'lithe/interop' { export * from '@lithe/interop'; }
declare module 'lithe/devtools' { export * from '@lithe/devtools'; }
declare module 'lithe/observability' { export * from '@lithe/observability'; }
declare module '@lithe/plugins' {
	export function litheVitePlugin(options?: any): any;
	export function litheRollupPlugin(options?: any): any;
	export function litheBabelPlugin(api?: any, options?: any): any;
	export function litheTailwindPlugin(options?: any): any;
	export function compileTailwind(css: string, config?: any): Promise<string>;
}
declare module 'lithe/plugins' { export * from '@lithe/plugins'; }
declare module 'lithe/vite' {
	import { litheVitePlugin } from '@lithe/plugins';
	export default litheVitePlugin;
	export { litheVitePlugin };
}
declare module 'lithe/rollup' {
	import { litheRollupPlugin } from '@lithe/plugins';
	export default litheRollupPlugin;
	export { litheRollupPlugin };
}
declare module 'lithe/babel' {
	import { litheBabelPlugin } from '@lithe/plugins';
	export default litheBabelPlugin;
	export { litheBabelPlugin };
}
declare module 'lithe/tailwind' {
	import { litheTailwindPlugin, compileTailwind } from '@lithe/plugins';
	export default litheTailwindPlugin;
	export { litheTailwindPlugin, compileTailwind };
}
declare module 'lithe/jsx-runtime' {
	export { jsx, jsxs, jsxDEV, Fragment } from '@lithe/dom';
	export namespace JSX {
		type Element = any;
		interface ElementChildrenAttribute { children: {}; }
		interface IntrinsicAttributes { key?: any; }
		interface HTMLAttributes {
			class?: string | (() => string) | any;
			className?: string | (() => string) | any;
			id?: string | (() => string);
			style?: string | Record<string, any> | (() => any);
			title?: string | (() => string);
			hidden?: boolean | (() => boolean);
			tabIndex?: number | (() => number);
			role?: string;
			type?: string;
			value?: any;
			placeholder?: string | (() => string);
			disabled?: boolean | (() => boolean);
			checked?: boolean | (() => boolean);
			href?: string;
			src?: string;
			alt?: string;
			target?: string;
			rel?: string;
			name?: string;
			for?: string;
			htmlFor?: string;
			children?: any;
			onClick?: any;
			onInput?: any;
			onChange?: any;
			onSubmit?: any;
			onKeyDown?: any;
			onKeyUp?: any;
			onFocus?: any;
			onBlur?: any;
			onMouseEnter?: any;
			onMouseLeave?: any;
			[key: string]: any;
		}
		interface IntrinsicElements {
			[elemName: string]: HTMLAttributes;
		}
	}
}
declare module 'lithe/jsx-dev-runtime' {
	export * from 'lithe/jsx-runtime';
}
declare module '@lithe/dom/jsx-runtime' {
	export * from 'lithe/jsx-runtime';
}
declare module '@lithe/dom/jsx-dev-runtime' {
	export * from 'lithe/jsx-runtime';
}

declare global {
	namespace JSX {
		type Element = any;
		interface ElementChildrenAttribute {
			children: {};
		}
		interface IntrinsicAttributes {
			key?: any;
		}
		interface HTMLAttributes {
			class?: string | (() => string) | any;
			className?: string | (() => string) | any;
			id?: string | (() => string);
			style?: string | Record<string, any> | (() => any);
			title?: string | (() => string);
			hidden?: boolean | (() => boolean);
			tabIndex?: number | (() => number);
			role?: string;
			type?: string;
			value?: any;
			placeholder?: string | (() => string);
			disabled?: boolean | (() => boolean);
			checked?: boolean | (() => boolean);
			href?: string;
			src?: string;
			alt?: string;
			target?: string;
			rel?: string;
			name?: string;
			for?: string;
			htmlFor?: string;
			children?: any;
			onClick?: any;
			onInput?: any;
			onChange?: any;
			onSubmit?: any;
			onKeyDown?: any;
			onKeyUp?: any;
			onFocus?: any;
			onBlur?: any;
			onMouseEnter?: any;
			onMouseLeave?: any;
			[key: string]: any;
		}
		interface IntrinsicElements {
			[elemName: string]: HTMLAttributes;
		}
	}
}
