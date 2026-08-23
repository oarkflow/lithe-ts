import test from 'node:test';
import assert from 'node:assert/strict';
import { h, Fragment } from '../src/dom/vnode.ts';
import { signal } from '../src/core/reactive.ts';
import { createSSRHandler, renderRouterToString, renderToString } from '../src/server/ssr.ts';
import { createRouter } from '../src/router/router.ts';

test('SSR renders components, signals and escaped HTML', async () => {
	const value = signal('<safe>');
	function App() { return h('main', { class: 'app' }, h('h1', null, value), h('input', { disabled: true, value: 'x' })); }
	const html = await renderToString(h(App, {}), { document: false });
	assert.equal(html, '<main class="app"><h1>&lt;safe&gt;</h1><input disabled value="x"></main>');
});

test('SSR unwraps function-valued child props', async () => {
	function Button({ label }: { label: () => string }) { return h('button', null, label); }
	const html = await renderToString(h(Button, { label: () => 'Add task' }), { document: false });
	assert.equal(html, '<button>Add task</button>');
});

test('SSR handler resolves routes through middleware and returns 404s', async () => {
	const router = createRouter({ routes: [{ path: '/hello', component: ({ data }) => h('h1', null, data), middleware: [async (_ctx, next) => next()], load: () => 'hello' }] });
	const handler = createSSRHandler({ router, entry: '/src/main.js' });
	const found = await handler(new Request('http://test/hello'));
	assert.equal(found.status, 200); assert.match(await found.text(), /<h1>hello<\/h1>/);
	const missing = await handler(new Request('http://test/missing'));
	assert.equal(missing.status, 404); assert.match(await missing.text(), /Not found/);
});
