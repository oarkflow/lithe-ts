import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, group, lazyRoute } from '../src/router/router.ts';
import { createScope } from '../src/core/owner.ts';

test('router matches static and parameter routes', () => {
	const A = () => null, B = () => null;
	const router = createRouter({ initialURL: 'http://test/users/42', routes: [{ path: '/', component: A }, { path: '/users/:id', component: B }] });
	assert.equal(router.matched.value.route.component, B); assert.equal(router.params.id, '42');
});

test('router middleware composes in order and can short-circuit', async () => {
	const calls = [];
	const router = createRouter({ initialURL: 'http://test/private', middleware: [async (_ctx, next) => { calls.push('before'); const value = await next(); calls.push('after'); return value; }], routes: [{ path: '/private', middleware: [async (_ctx, _next) => { calls.push('guard'); return 'denied'; }], load: () => { calls.push('load'); return 'loaded'; } }] });
	assert.equal(await router.load(router.resolve('http://test/private')), 'denied');
	assert.deepEqual(calls, ['before', 'guard', 'after']);
});

test('router wildcard component matches unknown paths as 404', () => {
	const NotFound = () => null;
	const router = createRouter({ initialURL: 'http://test/missing/page', routes: [{ path: '*', component: NotFound }] });
	assert.equal(router.matched.value.route.component, NotFound);
	assert.equal(router.matched.value.notFound, true);
	assert.deepEqual(router.params, {});
});

test('router groups inherit middleware and preserve child paths', async () => {
	const calls = []; const router = createRouter({ routes: [group([{ path: '/settings', load: () => { calls.push('load'); return 'ok'; } }], { middleware: [async (_ctx, next) => { calls.push('group'); return next(); }] })] });
	assert.equal(await router.load(router.resolve('http://test/settings')), 'ok');
	assert.deepEqual(calls, ['group', 'load']);
});

test('router composes nested route and group layouts around the default outlet', () => {
	const RootLayout = () => null;
	const AdminLayout = () => null;
	const Page = () => null;
	const router = createRouter({
		initialURL: 'http://test/admin/users',
		routes: [group([
			group([{ path: 'users', component: Page }], { path: '/admin', layout: AdminLayout })
		], { layout: RootLayout })]
	});

	const rendered = router.render();
	assert.equal(rendered.type, RootLayout);
	assert.equal(rendered.children[0].type, AdminLayout);
	assert.equal(rendered.children[0].children[0].type, Page);
});

test('router navigation preloads lazy route components before committing', async () => {
	let loaded = 0;
	const Lazy = lazyRoute(async () => {
		await new Promise(resolve => setTimeout(resolve, 5));
		loaded++;
		return { Page: () => null };
	}, { exportName: 'Page' });
	const router = createRouter({
		initialURL: 'http://test/',
		routes: [{ path: '/', component: () => null }, { path: '/lazy', component: Lazy }]
	});

	await router.navigate('/lazy');

	assert.equal(loaded, 1);
	assert.equal(router.path, '/lazy');
});

test('router bounds prefetch promises to the configured cache limit', async () => {
	let loads = 0;
	const route = (path: string) => ({ path, load: () => ++loads });
	const router = createRouter({
		initialURL: 'http://test/a',
		cacheEntries: 2,
		routes: [route('/a'), route('/b'), route('/c')]
	});

	await router.prefetch('/a');
	await router.prefetch('/b');
	await router.prefetch('/c');
	await router.prefetch('/a');

	assert.equal(loads, 4);
});

test('router dispose releases cached route state', async () => {
	const router = createRouter({
		initialURL: 'http://test/a',
		routes: [{ path: '/a', load: () => 'data' }]
	});

	await router.load(router.resolve('/a'));
	router.matched.value;
	assert.equal(router.cache.size, 1);
	router.dispose();
	assert.equal(router.cache.size, 0);
	assert.equal((router.currentURL as any)._sub1, null);
});

test('router disposal rejects in-flight navigation before it can commit or cache', async () => {
	let resolveLoad;
	const router = createRouter({
		initialURL: 'http://test/',
		routes: [{ path: '/', component: () => null }, { path: '/slow', load: () => new Promise(resolve => { resolveLoad = resolve; }) }]
	});
	const navigation = router.navigate('/slow', { history: false });
	router.dispose();
	resolveLoad('late data');
	await assert.rejects(navigation, /disposed/);
	assert.equal(router.cache.size, 0);
});

test('router start listeners follow owner scope disposal', () => {
	const previousWindow = globalThis.window;
	const previousDocument = globalThis.document;
	const previousAdd = globalThis.addEventListener;
	const previousRemove = globalThis.removeEventListener;
	let removedWindow = 0;
	let removedDocument = 0;
	try {
		globalThis.window = {};
		globalThis.document = { addEventListener() {}, removeEventListener() { removedDocument++; } };
		globalThis.addEventListener = () => {};
		globalThis.removeEventListener = () => { removedWindow++; };
		const router = createRouter([{ path: '/', component: () => null }]);
		const scope = createScope(() => router.start());
		scope.dispose();
		assert.equal(removedWindow, 1);
		assert.equal(removedDocument, 1);
		router.dispose();
	} finally {
		globalThis.window = previousWindow;
		globalThis.document = previousDocument;
		globalThis.addEventListener = previousAdd;
		globalThis.removeEventListener = previousRemove;
	}
});
