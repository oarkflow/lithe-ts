/** Lithe v1.1 TypeScript-first public declarations. Zero runtime dependencies. */
declare module '@lithe/core' {
	export type Priority = 'sync' | 'userBlocking' | 'normal' | 'transition' | 'background' | 'idle';
	export interface Signal<T> { value: T; peek(): T; update(fn: (value: T) => T): T; subscribe(fn: (value: T) => void, options?: { sync?: boolean; priority?: Priority }): () => void; toJSON(): T; readonly __litheSignal: true; readonly __litheName?: string | null }
	export interface ReadonlySignal<T> { readonly value: T; peek(): T; subscribe(fn: (value: T) => void): () => void; toJSON(): T; readonly __litheSignal: true; readonly __computed?: true }
	export function signal<T>(value: T, options?: { name?: string }): Signal<T>;
	export function computed<T>(fn: () => T, options?: { name?: string }): ReadonlySignal<T>;
	export function effect(fn: (cleanup: (fn: () => void) => void) => void, options?: { sync?: boolean; priority?: Priority; name?: string }): () => void;
	export function watch<T>(source: Signal<T> | ReadonlySignal<T> | (() => T), callback: (value: T, previous: T | undefined) => void, options?: { immediate?: boolean; deep?: boolean; sync?: boolean; priority?: Priority }): () => void;
	export function batch<T>(fn: () => T): T; export function untrack<T>(fn: () => T): T; export function state<T extends object>(value: T): T;
	export function isSignal(value: unknown): value is Signal<any> | ReadonlySignal<any>; export function unwrap<T>(value: T | Signal<T> | ReadonlySignal<T>): T;
	export function createScope<T>(fn: (dispose: () => void) => T): { value: T; dispose(): void; owner: any }; export function onCleanup(fn: () => void): () => void; export function onMount(fn: () => void | (() => void)): void;
	export function createContext<T>(defaultValue: T): { provide<R>(value: T, fn: () => R): R; use(): T; Provider(props: { value: T; children?: any }): any }; export function useContext<T>(context: any): T; export function getOwner(): any; export function withOwner<T>(owner: any, fn: () => T): T; export function disposeOwner(owner: any): void; export function ownerTree(owner?: any): any; export function serializeOwnerGraph(owner?: any): any;
	export function createStore<T extends object, Actions extends object = {}>(creator: any): any;
	export function defineStore<Id extends string, T extends object, Actions extends object = {}>(id: Id, creator: any): any;
	export function createContextStore<T extends object, P = any>(factory: any, options?: any): any;
	export function persist<T extends object, Actions extends object = {}>(creator: any, options?: any): any;
	export function history<T extends object, Actions extends object = {}>(creator: any, options?: any): any;
	export function devtools<T extends object, Actions extends object = {}>(creator: any, options?: any): any;
	export function produce<T>(baseState: T, recipe: (draft: T) => T | void): T;
	export function schedule<T>(task: () => T, priority?: Priority): any; export const scheduler: any; export function transition<T>(fn: () => T): T; export function flushSync(): void;
	export function deviceProfile(): { memory: number | null; cores: number | null; saveData: boolean; connection: string; lowPower: boolean }; export function adaptivePriority(kind?: string): Priority | string; export function adaptiveSchedule<T>(task: () => T, kind?: string): any; export function batteryProfile(): Promise<{ supported: boolean; low: boolean; charging?: boolean; level?: number }>; export function initBatteryAdaptation(): Promise<any>; export function prefetchBudget(): { enabled: boolean; concurrency: number; distance: number }; export function createAdaptiveScheduler(options?: any): { schedule<T>(task: () => T, kind?: string): Promise<T>; readonly profile: any; readonly pending: number };
	export function onMutation(listener: (event: any) => void): () => void; export function inspectReactiveGraph(): { nodes: any[]; edges: any[] }; export function serializeSignals(): Record<string, any>; export function restoreSignals(snapshot?: Record<string, any>): void; export function installSignalSnapshot(snapshot?: Record<string, any>): () => void; export function pendingSignals(): Record<string, any>; export function getNamedSignal(name: string): Signal<any> | undefined; export function serializeOwners(): any[]; export function restoreOwners(graph?: any[]): any[]; export function createDetachedOwner(snapshot: any, parent?: any): any; export function registerResumableComputation(meta: any): any; export function serializeComputations(): any[]; export function resumeComputations(list?: any[]): () => void; export function resumableEffect(name: string, symbol: { module: string; exportName?: string }, signals?: Array<string | Signal<any>>): () => void;
	export class SignalImpl<T> { constructor(value: T, options?: any); value: T; peek(): T; update(fn: (value: T) => T): T; subscribe(fn: (value: T) => void, options?: any): () => void; toJSON(): T }
	export class ComputedImpl<T> { constructor(fn: () => T, options?: any); readonly value: T; peek(): T; subscribe(fn: (value: T) => void): () => void; toJSON(): T }
	export interface Dependency { _version: number }
	export interface Observer { _flags: number; _depsVersion: number }
}

declare module '@lithe/dom' {
	import type { Signal } from '@lithe/core';
	export const Fragment: unique symbol; export const Text: unique symbol; export const Comment: unique symbol;
	export interface VNode { __vnode: true; type: any; props: Record<string, any>; children: any[]; key: any }
	export function h(type: any, props?: Record<string, any> | null, ...children: any[]): VNode; export const jsx: typeof h; export const jsxs: typeof h; export const jsxDEV: typeof h; export function text(value: any): VNode; export function comment(value?: string): VNode; export function isVNode(value: any): value is VNode;
	export function mount(root: Element | ShadowRoot, view: any, options?: { clear?: boolean; delegateEvents?: boolean }): () => void; export function hydrate(root: Element | ShadowRoot, view: any, options?: any): () => void;
	export function dynamic<T>(fn: () => T): any; export function trustedHTML(value: string): any; export function configureTrustedTypes(options?: any): any; export function staticTemplate(html: string): any; export function compiledTemplate(html: string, bindings?: any[]): any; export function compiledElement(type: string, props?: Record<string, any> | null, children?: any[]): any; export function createElement(type: string): Element;
	export function Show(props: any): any; export function For<T>(props: { each: T[] | Signal<T[]> | (() => T[]); children: any; fallback?: any; key?: string | ((item: T, index: number) => any) }): any; export function Index<T>(props: any): any; export function Switch(props: any): any; export function Match(props: any): any; export function Dynamic(props: any): any; export function Portal(props: any): any; export function Island(props: any): any; export function Await(props: any): any; export function ErrorBoundary(props: any): any;
	export function lazy(loader: () => Promise<any>, fallback?: any): any; export function lazyEvent(loader: () => Promise<any>, exportName?: string): any;
	export function eventSymbol(module: string, exportName?: string): any; export function capturedEventSymbol(module: string, exportName?: string, captures?: any): any; export function resumeDocument(root?: Document | Element, options?: any): () => void; export function serializeResumeState(options?: any): any;
	export function installDelegatedEvents(root: EventTarget): () => void; export function isEventProp(name: string): boolean; export function setDelegatedEvent(node: Element, name: string, value: any): void; export function setDirectEvent(node: Element, name: string, value: any): void;
	export function __mountAny(...args: any[]): any; export function __mountChild(...args: any[]): any; export function __setAttribute(...args: any[]): any;
}

declare module '@lithe/router' {
	export type RouterMiddleware = (context: any, next: () => Promise<any>) => any; export interface RouteDefinition { path?: string; name?: string; component?: any; layout?: any; children?: RouteDefinition[]; outlets?: Record<string, any>; load?: (ctx: any) => any; preload?: (ctx?: any) => any; middleware?: RouterMiddleware[]; searchSchema?: any; intercept?: boolean; cache?: boolean | string | number }
	export interface RouterOptions { routes?: RouteDefinition[]; initialURL?: string | URL; notFound?: any; cacheSize?: number; viewTransitions?: boolean; middleware?: RouterMiddleware[] }
	export function createRouter(options?: RouterOptions): any; export function createRouter(routes: RouteDefinition[], options?: Omit<RouterOptions, 'routes'>): any; export function group(children: RouteDefinition[], options?: Omit<RouteDefinition, 'children' | 'path'> & { path?: string }): RouteDefinition; export function Link(props: any): any; export function Outlet(props: any): any; export function defineRoutes<T extends RouteDefinition[]>(routes: T): T; export function routePath(route: string, params?: Record<string, any>): string; export function prefetchPolicy(): boolean; export function routeManifest(routes: RouteDefinition[]): any[]; export function sharedTransition(id: string): { viewTransitionName: string };
}

declare module '@lithe/data' {
	export class QueryClient { constructor(options?: any); fetchQuery<T = any>(options: any): Promise<T>; getQueryData<T = any>(key: any): T | undefined; setQueryData<T = any>(key: any, updater: T | ((old: T | undefined) => T), options?: any): T; invalidate(key: any): void; invalidateTags(tags: string | string[]): void; refetchStale(reason?: string): Promise<void>; dehydrate(): any[]; hydrate(snapshot?: any[]): void; persist(): Promise<void>; restore(): Promise<void>; dispose(): void }
	export const queryClient: QueryClient; export function query<T = any>(options: any): { readonly data: T | undefined; readonly error: any; readonly loading: boolean; readonly stale: boolean; refresh(): Promise<T>; abort(): void; dispose(): void; key(): string }; export function resource<T = any>(fetcher: any, options?: any): any; export function mutation<TVariables = any, TData = any>(options: any): { mutate(value: TVariables): Promise<TData>; readonly pending: boolean; readonly error: any; readonly data: TData | undefined; reset(): void };
	export function infiniteQuery<T = any>(options: any): any; export function cursorQuery<T = any>(options: any): any; export function createStoragePersister(storage: any, key?: string): any; export function stream<T = any>(url: string, options?: any): any; export function request<T = any>(url: string, options?: any): Promise<T>; export function setDefaultFetcher(fetcher: Function): void; export function parseDuration(value: any): number; export function stableQueryKey(key: any): string;
}

declare module '@lithe/forms' {
	export class ValidationError extends Error { issues: Array<{ path: Array<string | number>; message: string; code: string }> } export class Schema<T = any> { parse(value: any): T; safeParse(value: any): { success: true; data: T } | { success: false; error: ValidationError }; optional(): Schema<T | undefined>; nullable(): Schema<T | null>; default(value: T): Schema<T>; refine(fn: (value: T) => boolean, message?: string): Schema<T> }
	export function string(options?: any): Schema<string>; export function number(options?: any): Schema<number>; export function boolean(options?: any): Schema<boolean>; export function literal<T>(value: T): Schema<T>; export function enumOf<T extends readonly any[]>(values: T): Schema<T[number]>; export function array<T>(schema: Schema<T>, options?: any): Schema<T[]>; export function object<T = any>(shape: Record<string, Schema<any>>, options?: any): Schema<T>; export function union<T = any>(schemas: Schema<any>[]): Schema<T>; export function date(options?: any): Schema<Date>; export function email(options?: any): Schema<string>; export function url(options?: any): Schema<string>;
	export function createForm<T extends object = any>(options?: any): any; export function createAdvancedForm<T extends object = any>(options?: any): any; export function AutoForm(props: any): any; export function formDataToObject(formData: FormData): Record<string, any>; export function splitPath(path: string | string[]): Array<string | number>; export function getPath(value: any, path: string | string[]): any; export function setPath(value: any, path: string | string[], next: any): any; export function deletePath(value: any, path: string | string[]): void; export function toJSONSchema(schema: Schema<any>, options?: any): any; export function toOpenAPI(schema: Schema<any>, options?: any): any;
}

declare module '@lithe/rpc' {
	export function server<TInput = any, TOutput = any>(handler: (input: TInput, context: any) => TOutput | Promise<TOutput>): ((input: TInput, options?: any) => Promise<TOutput>) & { id: string; __serverFunction: true }; export function server<TInput = any, TOutput = any>(options: any, handler: (input: TInput, context: any) => TOutput | Promise<TOutput>): any;
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
declare module '@lithe/app' { export function defineApp<T extends object>(config: T): Readonly<T>; export function startApp(config: any): any; }
declare module '@lithe/runtime' { export * from '@lithe/core'; export * from '@lithe/dom'; }

declare module '@lithe/compiler' {
	export function transformJSX(source: string): string; export function compileModule(source: string, options?: any): any; export function stripTypeScript(source: string, options?: any): string; export function hasNativeTypeScriptTransform(): boolean; export function tokenizeJavaScript(source: string): any[]; export function validateJavaScript(source: string, options?: any): any; export function parseJavaScript(source: string, options?: any): any; export function collectTypeEnvironment(sources: string[]): Map<string, any>; export function semanticTypecheck(source: string, options?: any): any; export function parseType(text: string, env?: Map<string, any>): any; export function inferExpression(text: string, vars?: Map<string, any>, env?: Map<string, any>, functions?: Map<string, any>): any; export function isTypeAssignable(from: any, to: any, env?: Map<string, any>): boolean; export function formatType(type: any): string; export function reactiveGraphIR(code: string, file?: string): any; export function mergeReactiveGraphs(graphs: any[], options?: any): any; export function findReactiveCycles(graph: any): string[][]; export function optimizeReactiveGraph(graph: any): any; export function graphDiagnostics(graph: any): any[]; export function graphToDOT(graph: any): string; export function reactiveDiagnostics(code: string, file?: string): any[]; export function transformWorkerPlacement(code: string, options?: any): any; export function analyzeAccessibility(code: string, file?: string): any[]; export function detectIslands(code: string, file?: string): any[]; export function identitySourceMap(generated: string, source: string, filename?: string, generatedFile?: string): any; export function tracedSourceMap(generated: string, source: string, filename?: string, generatedFile?: string): any; export function customElementModule(options: any): string;
	export function litheVitePlugin(options?: any): any; export function litheRollupPlugin(options?: any): any; export function litheBabelPlugin(api?: any, options?: any): any; export function litheTailwindPlugin(options?: any): any; export function compileTailwind(css: string, config?: any): Promise<string>;
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

