import test from 'node:test';
import assert from 'node:assert/strict';

async function withDOM(t: any) {
	try {
		const { Window } = await import('../benchmarks/node_modules/happy-dom/lib/index.js');
		const window = new Window({ url: 'http://localhost/' });
		const previous = {
			window: globalThis.window,
			document: globalThis.document,
			Node: globalThis.Node,
			Element: globalThis.Element,
			Event: globalThis.Event
		};
		globalThis.window = window as any;
		globalThis.document = window.document as any;
		globalThis.Node = window.Node as any;
		globalThis.Element = window.Element as any;
		globalThis.Event = window.Event as any;
		t.after(() => {
			globalThis.window = previous.window;
			globalThis.document = previous.document;
			globalThis.Node = previous.Node;
			globalThis.Element = previous.Element;
			globalThis.Event = previous.Event;
		});
		return window;
	} catch {
		t.skip('happy-dom is not installed in this workspace');
		return null;
	}
}

test('hydrate() does not fall back to a client remount for adjacent text/signal children', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ renderToString }, { hydrate, getHydrationReport }, { h }, { signal }] = await Promise.all([
		import('../src/server/ssr.ts'),
		import('../src/dom/hydrate.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/core/reactive.ts')
	]);
	const count = signal(0);
	function App() {
		return h('button', { onClick: () => count.value++ }, 'clicks: ', count);
	}
	const html = await renderToString(h(App, {}), { document: false });
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.appendChild(root);
	hydrate(root, h(App, {}));
	assert.equal(getHydrationReport().status, 'hydrated');
	const button = root.querySelector('button')!;
	button.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
	assert.equal(button.textContent, 'clicks: 1');
});

test('hydrate() claims <For> rows and keeps keyed row identity on a later update', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ renderToString }, { hydrate, getHydrationReport }, { h }, { For }, { state }] = await Promise.all([
		import('../src/server/ssr.ts'),
		import('../src/dom/hydrate.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/core/reactive.ts')
	]);
	const items = state([{ id: 1, text: 'a' }, { id: 2, text: 'b' }, { id: 3, text: 'c' }]);
	function App() {
		return h('ul', null, h(For as any, { each: items }, (item: any) => h('li', { key: item.id }, item.text)));
	}
	const html = await renderToString(h(App, {}), { document: false });
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.appendChild(root);
	hydrate(root, h(App, {}));
	assert.equal(getHydrationReport().status, 'hydrated');
	const liB = [...root.querySelectorAll('li')].find(li => li.textContent === 'b')!;
	(items as any).unshift({ id: 0, text: 'z' });
	assert.equal(root.textContent, 'zabc');
	const liBAfter = [...root.querySelectorAll('li')].find(li => li.textContent === 'b');
	assert.equal(liB, liBAfter, 'the claimed row for item "b" must be reused, not recreated, on a keyed update');
});

test('hydrate() relocates <Portal> content to its target instead of leaving it in place', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ renderToString }, { hydrate, getHydrationReport }, { h }, { Portal }] = await Promise.all([
		import('../src/server/ssr.ts'),
		import('../src/dom/hydrate.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);
	const modalRoot = document.createElement('div');
	modalRoot.id = 'modal-root';
	document.body.appendChild(modalRoot);
	function App() {
		return h('div', { id: 'app' }, h(Portal as any, { target: modalRoot }, h('p', null, 'in a portal')));
	}
	const html = await renderToString(h(App, {}), { document: false });
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.insertBefore(root, modalRoot);
	hydrate(root, h(App, {}));
	assert.equal(getHydrationReport().status, 'hydrated');
	assert.equal(root.querySelector('#app')!.innerHTML, '');
	assert.equal(modalRoot.innerHTML, '<p>in a portal</p>');
});

test('hydrate() claims an <Island>\'s real server-rendered content instead of mismatching against its fallback', async t => {
	// ssr.ts's Island renders real children only when `document` is not yet
	// defined (matching an actual Node SSR process) — render before withDOM()
	// installs the browser globals, exactly as a real server/client split would.
	const [{ renderToString }, { h }, { Island }, { signal }] = await Promise.all([
		import('../src/server/ssr.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/core/reactive.ts')
	]);
	const count = signal(0);
	function App() {
		return h('div', { id: 'app' }, h(Island as any, { when: 'load' }, h('button', { onClick: () => count.value++ }, 'clicks: ', count)));
	}
	const html = await renderToString(h(App, {}), { document: false });
	assert.match(html, /<button>/, 'SSR must render the island\'s real content, not its fallback');

	const window = await withDOM(t);
	if (!window) return;
	const { hydrate, getHydrationReport } = await import('../src/dom/hydrate.ts');
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.appendChild(root);
	hydrate(root, h(App, {}));
	assert.equal(getHydrationReport().status, 'hydrated');
	const button = root.querySelector('button')!;
	button.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
	assert.equal(button.textContent, 'clicks: 1');
});

test('hydrate() claims <Suspense> content and its toggle keeps working after hydration', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ renderToString }, { hydrate, getHydrationReport }, { h }, { Suspense }] = await Promise.all([
		import('../src/server/ssr.ts'),
		import('../src/dom/hydrate.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);
	function App() {
		return h('div', { id: 'app' }, h(Suspense as any, { fallback: h('p', null, 'Loading...') }, h('span', null, 'static content')));
	}
	const html = await renderToString(h(App, {}), { document: false });
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.appendChild(root);
	hydrate(root, h(App, {}));
	assert.equal(getHydrationReport().status, 'hydrated');
	assert.match(root.innerHTML, /static content/);
});

test('state() array mutator methods batch their notifications atomically', async () => {
	const { state, effect } = await import('../src/core/reactive.ts');
	const items = state([{ id: 1 }, { id: 2 }, { id: 3 }]) as any;
	const log: string[] = [];
	effect(() => {
		log.push(JSON.stringify(items.map((x: any) => x && x.id)));
	}, { sync: true });
	items.splice(1, 1);
	assert.deepEqual(log, ['[1,2,3]', '[1,3]'], 'splice() must not observably run the effect against a torn intermediate array state');
	items.push({ id: 4 });
	assert.deepEqual(log, ['[1,2,3]', '[1,3]', '[1,3,4]']);
});
