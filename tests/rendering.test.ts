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
			// Restoring the globals alone leaves happy-dom's internal async
			// task tracking (timers, MutationObserver microtasks, etc.) alive
			// on this Window forever, since nothing else ever references it
			// again to close it. Across a whole file's worth of tests that
			// piles up into background work that starves later tests — the
			// window must be told to abort/close, not just unlinked.
			window.happyDOM?.close();
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

test('signal updates patch DOM bindings without rerunning components or remounting nodes', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ signal }, { createRoot, compiledElement }, { h }] = await Promise.all([
		import('../src/core/reactive.ts'),
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts')
	]);

	const count = signal(0);
	const label = signal('ready');
	let appRuns = 0;
	let childRuns = 0;

	function Child() {
		childRuns++;
		return compiledElement('button', {
			class: () => `count-${count.value}`,
			title: () => label.value
		}, [() => `Count ${count.value}`]);
	}

	function App() {
		appRuns++;
		return compiledElement('main', null, [h(Child, null)]);
	}

	const root = document.createElement('div');
	document.body.append(root);
	const app = createRoot(root);
	app.render(h(App, null));
	const button = root.querySelector('button')!;

	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.className, 'count-0');
	assert.equal(button.textContent, 'Count 0');

	count.value = 1;
	assert.equal(root.querySelector('button'), button);
	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.className, 'count-1');
	assert.equal(button.textContent, 'Count 1');

	label.value = 'updated';
	assert.equal(root.querySelector('button'), button);
	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.title, 'updated');

	app.unmount();
	assert.equal(root.textContent, '');
});

test('replacing a mount disposes the previous reactive scope', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ signal, effect }, { mount }, { h }] = await Promise.all([
		import('../src/core/reactive.ts'),
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts')
	]);

	const value = signal(0);
	let firstRuns = 0;
	const root = document.createElement('div');
	mount(root, h(() => {
		effect(() => { value.value; firstRuns++; });
		return 'first';
	}, null));
	assert.equal(firstRuns, 1);
	mount(root, 'second');
	value.value = 1;
	assert.equal(firstRuns, 1);
	assert.equal(root.textContent, 'second');
});

test('disposing a deferred visible island removes its observer marker', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const previousObserver = (globalThis as any).IntersectionObserver;
	class FakeIntersectionObserver {
		disconnect() { }
		observe() { }
	}
	(globalThis as any).IntersectionObserver = FakeIntersectionObserver;
	t.after(() => { (globalThis as any).IntersectionObserver = previousObserver; });
	const [{ mount }, { h }, { Island }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);

	const root = document.createElement('div');
	const dispose = mount(root, h(Island, { when: 'visible' }, h('span', null, 'deferred')), { clearOnDispose: false });
	assert.ok(root.querySelector('span'));
	dispose();
	assert.equal(root.querySelector('span'), null);
});

test('ErrorBoundary renders the fallback when a child component throws while mounting', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { ErrorBoundary }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);

	function Bomb() {
		throw new Error('boom');
	}

	const root = document.createElement('div');
	mount(root, h(ErrorBoundary, { fallback: (error: Error) => h('div', null, error.message) }, h(Bomb, {})));
	assert.equal(root.innerHTML, '<div>boom</div>');
});

test('ErrorBoundary renders its children normally when nothing throws', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { ErrorBoundary }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);

	const root = document.createElement('div');
	mount(root, h(ErrorBoundary, { fallback: () => h('div', null, 'error') }, h('span', null, 'ok')));
	assert.equal(root.innerHTML, '<span>ok</span>');
});

test('releasing one owner sharing delegated root events does not silently kill another', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ installDelegatedEvents, setDelegatedEvent }, { createScope }] = await Promise.all([
		import('../src/dom/events.ts'),
		import('../src/core/owner.ts')
	]);

	const root = document.createElement('div');
	const a = document.createElement('button');
	const b = document.createElement('button');
	root.append(a, b);
	document.body.appendChild(root);
	let clickedA = 0, clickedB = 0;
	setDelegatedEvent(a, 'onClick', () => clickedA++);
	setDelegatedEvent(b, 'onClick', () => clickedB++);

	const scopeA = createScope(() => installDelegatedEvents(root));
	const scopeB = createScope(() => installDelegatedEvents(root));
	const click = (el: any) => el.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));

	click(a);
	click(b);
	assert.equal(clickedA, 1);
	assert.equal(clickedB, 1);

	scopeB.dispose();
	click(a);
	assert.equal(clickedA, 2, 'root delegation must still work for the mount that did not release');
});

test('lazy() notifies every already-mounted instance once the shared module load resolves', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h, Fragment }, { lazy }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts')
	]);

	let resolveLoad: (mod: any) => void;
	const LazyRow = lazy(() => new Promise(resolve => { resolveLoad = resolve; }));
	function Row(props: { n: number }) {
		return h('span', null, `row-${props.n}`);
	}

	const root = document.createElement('div');
	// All three instances race to see `!component && !promise` at mount
	// time; only the first would previously ever get notified when the
	// shared module load resolved.
	mount(root, h(Fragment, null, h(LazyRow, { n: 1 }), h(LazyRow, { n: 2 }), h(LazyRow, { n: 3 })));
	assert.equal(root.textContent, '');
	resolveLoad!({ default: Row });
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(root.textContent, 'row-1row-2row-3');
});

test('Suspense shows fallback while a descendant query() is pending, then commits real content exactly once', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const previousListeners = { add: (globalThis as any).addEventListener, remove: (globalThis as any).removeEventListener };
	(globalThis as any).addEventListener = window.addEventListener.bind(window);
	(globalThis as any).removeEventListener = window.removeEventListener.bind(window);
	t.after(() => { (globalThis as any).addEventListener = previousListeners.add; (globalThis as any).removeEventListener = previousListeners.remove; });

	const [{ mount }, { h }, { Suspense }, { query }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/data/query.ts')
	]);

	let resolveFetch: (v: string) => void;
	let fetchCalls = 0;
	function UserProfile() {
		const q: any = query({ key: 'suspense-test-user', fetch: () => { fetchCalls++; return new Promise(resolve => { resolveFetch = resolve; }); } });
		return h('div', null, () => q.data ? `Hello ${q.data}` : 'no data yet');
	}

	const root = document.createElement('div');
	mount(root, h(Suspense as any, { fallback: h('p', null, 'Loading...') }, h(UserProfile, {})));
	assert.match(root.innerHTML, /Loading\.\.\./);
	assert.doesNotMatch(root.innerHTML, /no data yet|Hello/);

	resolveFetch!('Ada');
	await new Promise(r => setTimeout(r, 20));
	assert.match(root.innerHTML, /Hello Ada/);
	assert.doesNotMatch(root.innerHTML, /Loading/);
	assert.equal(fetchCalls, 1, 'toggling from fallback back to content must not re-invoke the component / re-fetch');
});

test('Suspense waits for every pending resource in its subtree before committing content', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const previousListeners = { add: (globalThis as any).addEventListener, remove: (globalThis as any).removeEventListener };
	(globalThis as any).addEventListener = window.addEventListener.bind(window);
	(globalThis as any).removeEventListener = window.removeEventListener.bind(window);
	t.after(() => { (globalThis as any).addEventListener = previousListeners.add; (globalThis as any).removeEventListener = previousListeners.remove; });

	const [{ mount }, { h }, { Suspense }, { query, queryClient }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/data/query.ts')
	]);
	t.after(() => queryClient.clear());
	let resolveA: (v: string) => void, resolveB: (v: string) => void;
	function A() { const q: any = query({ key: 'suspense-test-a', fetch: () => new Promise(r => { resolveA = r; }) }); return h('span', null, () => q.data || '...'); }
	function B() { const q: any = query({ key: 'suspense-test-b', fetch: () => new Promise(r => { resolveB = r; }) }); return h('span', null, () => q.data || '...'); }

	const root = document.createElement('div');
	mount(root, h(Suspense as any, { fallback: h('p', null, 'Loading...') }, h('div', null, h(A, {}), h(B, {}))));
	assert.match(root.innerHTML, /Loading/);

	resolveA!('A-done');
	await new Promise(r => setTimeout(r, 20));
	assert.match(root.innerHTML, /Loading/, 'must still show fallback while B is pending');

	resolveB!('B-done');
	await new Promise(r => setTimeout(r, 20));
	assert.match(root.innerHTML, /A-done/);
	assert.match(root.innerHTML, /B-done/);
});

test('<For> only repositions rows whose DOM position actually changed', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { For }, { state, batch }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/core/reactive.ts')
	]);

	const items = state([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
	const root = document.createElement('div');
	mount(root, h('ul', null, h(For as any, { each: items }, (item: any) => h('li', null, () => String(item.id)))));
	const before = [...root.querySelectorAll('li')];
	assert.equal(before.length, 4);

	// Removing item 2 shifts items 3 and 4 to new array indices but their
	// relative DOM order and adjacency to each other is unchanged — none of
	// their <li> nodes should be recreated or physically moved. Comparing DOM
	// node identity with assert.ok(a === b) rather than assert.equal(a, b) is
	// deliberate: on failure, assert.equal's diff formatter calls
	// util.inspect on both operands, and inspecting a live DOM node (its
	// whole ownerDocument/defaultView graph) is so slow it looks exactly
	// like a hung test rather than a fast, clear assertion failure.
	(items as any).splice(1, 1);
	const after = [...root.querySelectorAll('li')];
	assert.equal(after.length, 3);
	assert.ok(before[0] === after[0], 'item 1 must be the same node');
	assert.ok(before[2] === after[1], 'item 3 must be the same node, not recreated');
	assert.ok(before[3] === after[2], 'item 4 must be the same node, not recreated');
	assert.equal(root.textContent, '134');

	// A genuine reorder must still actually move the right nodes: array is
	// [1, 3, 4] here; move 4 from the end to the front -> [4, 1, 3]. This
	// must be one atomic update (batch()), not two independent ones: an
	// unbatched pop() followed by an unbatched unshift() are each a
	// complete, independently-committed mutation, so the reactive diff sees
	// item 4 fully removed (and its row correctly disposed) before it ever
	// sees the unshift that brings an item with the same id back — from the
	// diff's perspective those are two different rows that happen to share
	// an id, not one row that moved, so recreating the node is correct
	// behavior for that sequence. Batching is what makes it one transition.
	const item1 = after[0], item4 = after[2];
	batch(() => {
		const moved = (items as any).pop();
		(items as any).unshift(moved);
	});
	assert.equal(root.textContent, '413');
	assert.ok(root.querySelectorAll('li')[0] === item4, 'the moved node must be reused, not recreated');
	assert.ok(root.querySelectorAll('li')[1] === item1);
});

test('<For> reposition uses the longest-stable-run so a swap does not cascade through untouched rows', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { For }, { state, batch }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/core/reactive.ts')
	]);

	// A naive "is this row still contiguous with the previous one" check
	// (rather than the longest-stable-run one this exercises) cascades on
	// this exact shape: a single swap near opposite ends of a large list
	// makes every untouched row in between look "out of place" to a purely
	// left-to-right or purely physical-DOM-neighbor check, since the row
	// that moved poisons every subsequent comparison. 50 rows is enough to
	// prove the untouched middle isn't touched at all without making the
	// test slow.
	const n = 50;
	const items = state(Array.from({ length: n }, (_, i) => ({ id: i })));
	const root = document.createElement('div');
	mount(root, h('ul', null, h(For as any, { each: items }, (item: any) => h('li', null, () => String(item.id)))));
	const before = [...root.querySelectorAll('li')];
	assert.equal(before.length, n);

	// Swap the second row with the second-to-last row — everything from
	// index 2 through n-3 keeps its exact relative order and must keep its
	// exact DOM node.
	batch(() => {
		const a = (items as any)[1], b = (items as any)[n - 2];
		(items as any)[1] = b;
		(items as any)[n - 2] = a;
	});
	const afterSwap = [...root.querySelectorAll('li')];
	assert.equal(afterSwap.length, n);
	for (let i = 2; i < n - 2; i++) {
		assert.ok(before[i] === afterSwap[i], `row ${i} must not be touched by an unrelated swap`);
	}
	assert.ok(before[n - 2] === afterSwap[1], 'the swapped-in row must be the reused node, not recreated');
	assert.ok(before[1] === afterSwap[n - 2], 'the swapped-out row must be the reused node, not recreated');
	assert.equal(root.textContent, Array.from({ length: n }, (_, i) => i === 1 ? n - 2 : i === n - 2 ? 1 : i).join(''));

	// A full reverse must still end up in the exactly-reversed physical DOM
	// order, reusing every node (no id disappears/reappears as a new node).
	batch(() => {
		(items as any).reverse();
	});
	const afterReverse = [...root.querySelectorAll('li')];
	assert.equal(afterReverse.map((n: any) => n.textContent).join(','), afterSwap.map((n: any) => n.textContent).join(',').split(',').reverse().join(','));
	const beforeReverseSet = new Set(afterSwap);
	for (const node of afterReverse) assert.ok(beforeReverseSet.has(node), 'reverse must reuse every existing node, not recreate any of them');
});

test('<For> lazily-created index signals stay reactive after structural edits', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { For }, { state }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/dom/control.ts'),
		import('../src/core/reactive.ts')
	]);
	const items = state([{ id: 1 }, { id: 2 }, { id: 3 }]);
	const root = document.createElement('div');
	mount(root, h(For as any, { each: items }, (item: any, index: any) => h('i', null, () => `${item.id}:${index.value}`)));
	assert.equal(root.textContent, '1:02:13:2');
	(items as any).splice(0, 1);
	assert.equal(root.textContent, '2:03:1');
});

test('compiled native subtrees patch dynamic text and attributes after cloning', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount, compiledTemplate }, { signal }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/core/reactive.ts')
	]);
	const label = signal('one');
	const active = signal(false);
	const root = document.createElement('div');
	mount(root, compiledTemplate('<section><div data-lithe-a0=""><b><!--l:0--></b></div></section>', [label], [['class', () => active.value ? 'active' : '']]));
	assert.equal(root.querySelector('div')!.className, '');
	assert.equal(root.querySelector('b')!.textContent, 'one');
	label.value = 'two';
	active.value = true;
	assert.equal(root.querySelector('div')!.className, 'active');
	assert.equal(root.querySelector('b')!.textContent, 'two');
});

test('an element with several reactive attribute bindings shares one effect and still updates every binding independently', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { h }, { signal }] = await Promise.all([
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts'),
		import('../src/core/reactive.ts')
	]);

	const cls = signal('a');
	const title = signal('t1');
	const disabled = signal(false);
	const root = document.createElement('div');
	mount(root, h('button', { class: () => cls.value, title: () => title.value, disabled: () => disabled.value }, 'hi'));
	const el = root.querySelector('button')!;
	assert.equal(el.className, 'a');
	assert.equal(el.title, 't1');
	assert.equal(el.disabled, false);

	// Changing just one of the three bindings must still update only what
	// actually changed — the other two bindings' last-applied values stay
	// exactly as they were (the shared effect re-applies every binding on
	// any one of them changing, but __setAttribute's own previous-value
	// diffing means an unrelated attribute is never redundantly touched).
	cls.value = 'b';
	assert.equal(el.className, 'b');
	assert.equal(el.title, 't1');
	assert.equal(el.disabled, false);

	title.value = 't2';
	disabled.value = true;
	assert.equal(el.className, 'b');
	assert.equal(el.title, 't2');
	assert.equal(el.disabled, true);
});
