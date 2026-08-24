import { signal, computed, batch } from '../core/reactive.ts';
import { h, Fragment } from '../dom/vnode.ts';
import { dynamic } from '../dom/dom.ts';

export type RouteComponent = (props: any) => any;
export interface RouterContext { params: Record<string, string>; query: URLSearchParams; search: Record<string, unknown>; url: URL; route: RouteDefinition; target: any; traceId: string; data?: unknown }
export type RouterMiddleware = (context: RouterContext, next: () => Promise<unknown>) => unknown | Promise<unknown>;
export interface RouteDefinition { path?: string; name?: string; component?: RouteComponent; layout?: RouteComponent; children?: RouteDefinition[]; outlets?: Record<string, RouteComponent>; load?: (context: RouterContext) => unknown | Promise<unknown>; preload?: (context?: RouterContext) => unknown | Promise<unknown>; middleware?: RouterMiddleware[]; searchSchema?: { parse(value: unknown): any }; intercept?: boolean; cache?: boolean | string | number; index?: boolean }
export interface RouterOptions { routes?: RouteDefinition[]; initialURL?: string | URL; notFound?: RouteDefinition | RouteComponent | null; fallback?: any; cacheEntries?: number; viewTransitions?: boolean; middleware?: RouterMiddleware[] }
export type RouteTo = string | { to: string };
export interface NavigateOptions { replace?: boolean; state?: unknown; modal?: boolean; preserveBackground?: boolean; transition?: boolean; scroll?: boolean; restore?: boolean; traceId?: string | null }
export interface LinkProps { to: string; children?: any[]; router?: any; prefetch?: boolean | 'auto' | 'visible' | 'idle'; ref?: (element: HTMLAnchorElement | null) => void;[key: string]: any }
export type Loader<TData = unknown, TContext extends RouterContext = RouterContext> = (context: TContext) => TData | Promise<TData>;
export type TypedRouteDefinition<TParams extends Record<string, string> = Record<string, string>, TSearch = Record<string, unknown>, TData = unknown> = Omit<RouteDefinition, 'load' | 'preload' | 'component' | 'children'> & {
	component?: (props: RouterContext & { params: TParams; search: TSearch; data?: TData; children?: any; outlet?: any; router?: any }) => any;
	load?: Loader<TData, RouterContext & { params: TParams; search: TSearch }>;
	preload?: Loader<unknown, RouterContext & { params: TParams; search: TSearch }>;
	children?: RouteDefinition[];
};
export interface LazyRouteOptions { exportName?: string; fallback?: any; onError?: (error: unknown) => void }


let traceSeq = 0;
function newCorrelationId(): string { return globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now().toString(36)}${(++traceSeq).toString(36)}`; }
function correlationEvent(type: string, attributes: Record<string, unknown> = {}, id: string | null = null): void { try { globalThis.__LITHE_CORRELATION_EVENT__?.(type, attributes, id); globalThis.__LITHE_DEVTOOLS__?.record?.({ type: 'trace-correlation', id, attributes, time: Date.now() }); } catch { } }
function withCorrelation<T>(id: string | null | undefined, fn: (id: string) => T): T { const previous = globalThis.__LITHE_CORRELATION_ID__; globalThis.__LITHE_CORRELATION_ID__ = id || previous || newCorrelationId(); let value; try { value = fn(globalThis.__LITHE_CORRELATION_ID__); } catch (error) { globalThis.__LITHE_CORRELATION_ID__ = previous; throw error; } if (value && typeof value.then === 'function') return value.finally(() => { if (globalThis.__LITHE_CORRELATION_ID__ === id) globalThis.__LITHE_CORRELATION_ID__ = previous; }); globalThis.__LITHE_CORRELATION_ID__ = previous; return value; }

function normalizePath(pathname = ''): string {
	const value = String(pathname || '').replace(/\/+/g, '/');
	if (!value) return '/';
	return (value.startsWith('/') ? '' : '/') + value.replace(/\/$/, '') || '/';
}
function joinPath(parent: string, child: string): string {
	if (!child) return normalizePath(parent || '/');
	if (child.startsWith('/')) return normalizePath(child);
	return normalizePath(`${parent === '/' ? '' : parent}/${child}`);
}
function compilePattern(pattern: string): { regex: RegExp; keys: string[] } {
	const keys = [];
	const escaped = normalizePath(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.replace(/:([A-Za-z_$][\w$]*)/g, (_, key) => { keys.push(key); return '([^/]+)'; })
		.replace(/\\\*([A-Za-z_$][\w$]*)/g, (_, key) => { keys.push(key); return '(.*)'; })
		.replace(/\\\*/g, '(.*)');
	return { regex: new RegExp(`^${escaped === '/' ? '/?' : escaped + '/?'}$`), keys };
}
function flattenRoutes(routes: RouteDefinition[], parentPath = '/', chain: RouteDefinition[] = [], out: any[] = []): any[] {
	for (const route of routes || []) {
		const fullPath = joinPath(parentPath, route.path ?? '');
		const next = [...chain, route];
		if (route.component || route.index || !route.children?.length) out.push({ route, chain: next, fullPath, _compiled: compilePattern(fullPath), notFound: route.path?.includes('*') });
		if (route.children?.length) flattenRoutes(route.children, fullPath, next, out);
	}
	return out;
}
function matchFlat(entry: any, pathname: string): Record<string, string> | null {
	const match = normalizePath(pathname).match(entry._compiled.regex); if (!match) return null;
	const params = {}; entry._compiled.keys.forEach((key, i) => params[key] = decodeURIComponent(match[i + 1] || ''));
	return params;
}
function searchObject(params: URLSearchParams): Record<string, string | string[]> { const out = {}; for (const [k, v] of params) { if (k in out) out[k] = Array.isArray(out[k]) ? [...out[k], v] : [out[k], v]; else out[k] = v; } return out; }
function memoryLimit(options: RouterOptions): number {
	if (options.cacheEntries) return options.cacheEntries;
	const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
	if (memory && memory <= 2) return 2; if (memory && memory <= 4) return 4; if (memory && memory >= 8) return 12; return 6;
}

export function lazyRoute<TProps = any>(loader: () => Promise<any>, options: LazyRouteOptions = {}) {
	let component: any = null, promise: Promise<any> | null = null, error: unknown = null;
	const tick = signal(0);
	const load = () => promise ||= Promise.resolve(loader()).then(mod => {
		component = options.exportName ? mod?.[options.exportName] : mod?.default || mod;
		if (!component && mod && typeof mod === 'object') component = Object.values(mod).find(x => typeof x === 'function');
		if (typeof component !== 'function') throw new TypeError('lazyRoute() loader must resolve to a component function.');
		error = null; tick.value++; return component;
	}).catch(err => { promise = null; error = err; options.onError?.(err); tick.value++; throw err; });
	function LazyRoute(props: TProps) {
		if (!component && !promise) load().catch(() => { });
		return dynamic(() => { tick.value; if (component) return h(component, props); if (error) return options.fallback ?? null; return typeof options.fallback === 'function' ? options.fallback() : options.fallback ?? null; });
	}
	(LazyRoute as any).preload = load;
	return LazyRoute;
}

export function createRouter(optionsOrRoutes: RouterOptions | RouteDefinition[] = {}, { ...legacyOptions }: RouterOptions = {} as RouterOptions) {
	const options: RouterOptions = Array.isArray(optionsOrRoutes) ? { ...legacyOptions, routes: optionsOrRoutes } : optionsOrRoutes;
	const routes = options.routes || []; const flat = flattenRoutes(routes);
	const initial = options.initialURL || (typeof location !== 'undefined' ? location.href : 'http://localhost/');
	const currentURL = signal(new URL(initial, 'http://localhost'));
	const navigation = signal({ state: 'idle', to: null, error: null, data: null });
	const backgroundURL = signal(null);
	const scrollPositions = new Map(); const prefetchCache = new Map(); const pageCache = new Map(); const cacheLimit = memoryLimit(options);

	function resolve(urlLike) {
		const url = urlLike instanceof URL ? urlLike : new URL(urlLike, currentURL.value);
		const candidates = [];
		for (const entry of flat) { const params = matchFlat(entry, url.pathname); if (params) candidates.push({ entry, params }); }
		candidates.sort((a, b) => Number(a.entry.notFound) - Number(b.entry.notFound) || b.entry.fullPath.length - a.entry.fullPath.length);
		const picked = candidates[0];
		if (!picked) {
			const fallback = typeof options.notFound === 'function' ? { component: options.notFound } : options.notFound;
			return { route: fallback || null, chain: fallback ? [fallback] : [], params: {}, query: url.searchParams, search: searchObject(url.searchParams), url, notFound: true };
		}
		const route = picked.entry.route;
		let search = searchObject(url.searchParams);
		const schema = route.searchSchema || picked.entry.chain.findLast?.(r => r.searchSchema)?.searchSchema;
		if (schema) search = schema.parse(search);
		return { route, chain: picked.entry.chain, params: picked.params, query: url.searchParams, search, url, fullPath: picked.entry.fullPath, notFound: Boolean(picked.entry.notFound) };
	}

	const matched = computed(() => resolve(currentURL.value));

	async function loadResolved(target, traceId = null) {
		const href = target.url.href;
		const context = { params: target.params, query: target.query, search: target.search, url: target.url, route: target.route, target, traceId };
		const middleware = [...(options.middleware || []), ...target.chain.flatMap(route => route.middleware || [])];
		let result;
		let index = -1;
		const run = async (position) => {
			if (position <= index) throw new Error('Router middleware called next() more than once.'); index = position; const current = middleware[position]; if (current) return current(context, () => run(position + 1));
			const cached = pageCache.get(href); if (cached && !cached.stale) { cached.used = Date.now(); result = cached.byRoute; return cached.data; }
			const values = {}; for (let i = 0; i < target.chain.length; i++) { const route = target.chain[i]; if (!route.load) continue; values[i] = await withCorrelation(traceId, () => route.load({ ...context, route, target, traceId })); } result = values; return target.chain.length ? values[target.chain.length - 1] : undefined;
		};
		const data = await withCorrelation(traceId, () => run(0));
		pageCache.set(href, { data, byRoute: result, used: Date.now(), stale: false });
		if (pageCache.size > cacheLimit) { const oldest = [...pageCache.entries()].sort((a, b) => a[1].used - b[1].used)[0]; if (oldest) pageCache.delete(oldest[0]); }
		return data;
	}

	async function preloadResolved(target, traceId = null): Promise<void> {
		for (const r of target.chain) {
			await withCorrelation(traceId, () => (r.component as any)?.preload?.());
			for (const component of Object.values(r.outlets || {})) await withCorrelation(traceId, () => (component as any)?.preload?.());
		}
	}

	async function prefetch(to: RouteTo): Promise<unknown> {
		const next = new URL(typeof to === 'string' ? to : to.to, currentURL.value); if (prefetchCache.has(next.href)) return prefetchCache.get(next.href);
		const target = resolve(next);
		const promise = (async () => { const traceId = newCorrelationId(); await preloadResolved(target, traceId); for (const r of target.chain) { await r.preload?.({ params: target.params, query: target.query, search: target.search, url: target.url, route: r, target, traceId }); } return loadResolved(target, traceId); })();
		prefetchCache.set(next.href, promise); try { return await promise; } catch (error) { prefetchCache.delete(next.href); throw error; }
	}

	async function navigate(to: RouteTo, navOptions: NavigateOptions = {}): Promise<unknown> {
		const next = new URL(typeof to === 'string' ? to : to.to, currentURL.value); const target = resolve(next), traceId = navOptions.traceId || newCorrelationId(); correlationEvent('navigation:start', { from: currentURL.value.href, to: next.href }, traceId);
		if (typeof window !== 'undefined') scrollPositions.set(currentURL.value.href, { x: scrollX, y: scrollY });
		navigation.value = { state: 'loading', to: next, error: null, data: navigation.peek?.()?.data, traceId };
		try {
			const data = prefetchCache.has(next.href) ? await prefetchCache.get(next.href) : await Promise.all([preloadResolved(target, traceId), loadResolved(target, traceId)]).then(([, value]) => value);
			const commit = () => {
				if (typeof history !== 'undefined') { const fn = navOptions.replace ? history.replaceState : history.pushState; fn.call(history, navOptions.state || {}, '', next); }
				withCorrelation(traceId, () => batch(() => { if (navOptions.modal || target.route?.intercept) backgroundURL.value = currentURL.value; else if (!navOptions.preserveBackground) backgroundURL.value = null; currentURL.value = next; navigation.value = { state: 'idle', to: null, error: null, data, traceId }; })); correlationEvent('navigation:end', { to: next.href }, traceId);
			};
			if (navOptions.transition !== false && typeof document !== 'undefined' && document.startViewTransition) await document.startViewTransition(commit).finished; else commit();
			if (typeof window !== 'undefined' && navOptions.scroll !== false) { const saved = navOptions.restore !== false && scrollPositions.get(next.href); requestAnimationFrame(() => scrollTo(saved?.x || 0, saved?.y || 0)); }
			return data;
		} catch (error) { navigation.value = { state: 'error', to: next, error, traceId }; correlationEvent('navigation:error', { to: next.href, message: error.message }, traceId); throw error; }
	}

	function start(): () => void {
		if (typeof window === 'undefined') return () => { };
		const pop = () => { currentURL.value = new URL(location.href); };
		const click = (event) => { if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; const a = event.target.closest?.('a[data-lithe-link]'); if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return; event.preventDefault(); navigate(a.href, { replace: false }).catch(console.error); };
		addEventListener('popstate', pop); document.addEventListener('click', click); return () => { removeEventListener('popstate', pop); document.removeEventListener('click', click); };
	}

	function compose(target, outletName = 'default') {
		if (!target.route) return options.fallback || `Not found: ${target.url.pathname}`;
		let child = null;
		for (let i = target.chain.length - 1; i >= 0; i--) {
			const route = target.chain[i];
			const Component = outletName === 'default' ? route.component : route.outlets?.[outletName];
			if (!Component) continue;
			const cached = pageCache.get(target.url.href);
			const data = cached?.byRoute?.[i] ?? (i === target.chain.length - 1 ? navigation.value.data : undefined);
			child = h(Component, { params: target.params, query: target.query, search: target.search, router: api, data, outlet: child }, ...(child ? [child] : []));
		}
		return child;
	}

	const View = () => dynamic(() => compose(matched.value, 'default'));
	const Outlet = (props = {}) => dynamic(() => compose(matched.value, props.name || 'default'));
	const api = {
		routes, flat, currentURL, navigation, backgroundURL, matched, resolve, load: loadResolved, render: (target = resolve(currentURL.value), outlet = 'default') => compose(target, outlet), navigate, prefetch, start, View, Outlet,
		invalidate(to) { if (to) { const href = new URL(to, currentURL.value).href; if (pageCache.has(href)) pageCache.get(href).stale = true; } else for (const e of pageCache.values()) e.stale = true; },
		get params() { return matched.value.params; }, get query() { return matched.value.query; }, get search() { return matched.value.search; }, get path() { return currentURL.value.pathname; }, get cache() { return pageCache; }
	};
	return api;
}

export function prefetchPolicy(): boolean { if (typeof navigator === 'undefined') return true; const c = navigator.connection; if (c?.saveData) return false; return !['slow-2g', '2g'].includes(c?.effectiveType); }
export function defineRoutes<T extends readonly RouteDefinition[]>(routes: T): T { return routes; }
export function defineLoader<TData = unknown, TContext extends RouterContext = RouterContext>(loader: Loader<TData, TContext>): Loader<TData, TContext> { return loader; }
export function group(children: RouteDefinition[], options: Omit<RouteDefinition, 'children' | 'path'> & { path?: string } = {}): RouteDefinition { return { ...options, path: options.path ?? '', children }; }
export function Link(props: LinkProps): any { const { to, children, router, prefetch = 'auto', ref: userRef, ...rest } = props; let observer, idle; const warm = () => { if (prefetch !== false && router?.prefetch && prefetchPolicy()) router.prefetch(to).catch(() => { }); }; const ref = el => { userRef?.(el); observer?.disconnect(); observer = null; if (idle) { (globalThis.cancelIdleCallback || clearTimeout)(idle); idle = null; } if (!el || prefetch === false) return; if ((prefetch === 'auto' || prefetch === 'visible') && typeof IntersectionObserver !== 'undefined' && prefetchPolicy()) { observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); observer = null; warm(); } }, { rootMargin: '200px' }); observer.observe(el); } if (prefetch === 'idle' && prefetchPolicy()) { const run = () => warm(); idle = (globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 120)))(run, { timeout: 1500 }); } }; return h('a', { ...rest, ref, href: to, 'data-lithe-link': '', onPointerenter: warm, onFocus: warm, onTouchstart: warm }, ...(children || [])); }
