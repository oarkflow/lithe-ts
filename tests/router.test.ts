import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, group } from '../src/router/router.ts';

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
