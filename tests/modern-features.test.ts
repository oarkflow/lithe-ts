import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripTypeScript } from '../src/compiler/typescript.ts';
import { compileModule } from '../src/compiler/jsx.ts';
import { reactiveGraphIR, findReactiveCycles } from '../src/compiler/ir.ts';
import { identitySourceMap } from '../src/compiler/sourcemap.ts';
import { createRouter } from '../src/router/router.ts';
import { object, string, number } from '../src/forms/schema.ts';
import { createForm } from '../src/forms/form.ts';
import { createAdvancedForm } from '../src/forms/advanced.ts';
import { toJSONSchema } from '../src/forms/emit.ts';
import { collection } from '../src/collection/collection.ts';
import { LWWMap } from '../src/sync/crdt.ts';
import { createISRCache } from '../src/server/isr.ts';
import { h } from '../src/dom/vnode.ts';
import { renderToStream, streamBoundary } from '../src/server/ssr.ts';
import { createDevtools } from '../src/devtools/devtools.ts';
import { createScope } from '../src/core/owner.ts';
import { effect } from '../src/core/reactive.ts';
import { installDelegatedEvents, setDelegatedEvent } from '../src/dom/events.ts';
import { __setAttribute } from '../src/dom/dom.ts';
import { capturedEventSymbol } from '../src/dom/event-symbol.ts';
import { QueryClient, createStoragePersister, mutation } from '../src/data/query.ts';
import { checkProject } from '../tools/check.ts';
import { createMemoryStorage, createPersistentMutationQueue } from '../src/offline/storage.ts';
import { imageMetadata } from '../tools/image.ts';
import { generateTypes } from '../tools/types.ts';
import { prerenderProject } from '../tools/prerender.ts';
import { doctorProject } from '../tools/doctor.ts';
import { createToasts } from '../src/ui/primitives.ts';
import { createVirtualizer } from '../src/virtual/virtual.ts';
import { createNetworkState } from '../src/offline/offline.ts';
import { createAdaptiveScheduler } from '../src/core/adaptive.ts';
import { createMutationQueue } from '../src/offline/offline.ts';
import { css, clearCollectedCSS } from '../src/style/style.ts';

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('TypeScript stripper and compiler handle typed TSX and static hoisting', () => {
	const src = `interface User { name:string }\nconst n:number=1; export function Card(p:{name:string}){ return <div className="x">Hi</div> }`;
	const stripped = stripTypeScript(src); assert.doesNotMatch(stripped, /interface User/); assert.doesNotMatch(stripped, /n:number/);
	const c = compileModule(src, { typescript: true, runtimeImport: '@oarkflow/lithe/dom', filename: 'card.tsx' }); assert.match(c.code, /staticTemplate/); assert.ok(c.map); assert.deepEqual(c.diagnostics, []);
});

test('reactive IR detects computed cycles', () => {
	const g = reactiveGraphIR(`const a=computed(()=>b.value); const b=computed(()=>a.value);`, 'x.js');
	assert.ok(findReactiveCycles(g).length >= 1); const map = identitySourceMap('a\nb', 'a\nb', 'x.js', 'x.js'); assert.equal(map.version, 3);
});

test('nested router and validated search params work', () => {
	const schema = object({ q: string().default('') }); const Layout = () => null, Child = () => null;
	const router = createRouter({ initialURL: 'http://test/users/42?q=abc', routes: [{ path: 'users', component: Layout, children: [{ path: ':id', component: Child, searchSchema: schema }] }] });
	assert.equal(router.params.id, '42'); assert.equal(router.search.q, 'abc'); assert.equal(router.matched.value.chain.length, 2);
});

test('nested forms and stable field arrays work', () => {
	const form = createForm({ initial: { profile: { name: 'A' } } }); form.set('profile.name', 'B'); assert.equal(form.get('profile.name'), 'B');
	const advanced = createAdvancedForm({ initial: { items: [{ x: 1 }, { x: 2 }] } }); const arr = advanced.fieldArray('items'); const first = arr.fields[0].id; arr.move(0, 1); assert.equal(arr.fields[1].id, first);
});

test('schema emits JSON Schema', () => { const s = object({ name: string().min(2), age: number({ min: 1 }) }); const j = toJSONSchema(s); assert.equal(j.type, 'object'); assert.deepEqual(j.required.sort(), ['age', 'name']); assert.equal(j.properties.name.minLength, 2); });

test('advanced form owner disposal cancels autosave', async () => {
	let saves = 0;
	const scope = createScope(() => createAdvancedForm({ initial: { name: '' }, autosave: async () => { saves++; }, autosaveDelay: 10 }));
	scope.value.set('name', 'draft');
	scope.dispose();
	await sleep(30);
	assert.equal(saves, 0);
});

test('toast manager clears owned state and timers on disposal', () => {
	const scope = createScope(() => createToasts());
	scope.value.push('temporary');
	assert.equal(scope.value.items.value.length, 1);
	scope.dispose();
	assert.equal(scope.value.items.value.length, 0);
});

test('virtualizer bounds retained row measurements by default and supports an unlimited mode', () => {
	const bounded = createVirtualizer({ count: 100, maxMeasurements: 2 });
	bounded.measure(0, 10); bounded.measure(1, 20); bounded.measure(2, 30);
	assert.equal(bounded.sizeFor(0), 40);
	assert.equal(bounded.sizeFor(2), 30);
	const unlimited = createVirtualizer({ count: 3, maxMeasurements: 0 });
	unlimited.measure(0, 10); unlimited.measure(1, 20); unlimited.measure(2, 30);
	assert.equal(unlimited.sizeFor(0), 10);
});

test('virtualizer disposal releases measurements and makes reads inert', () => {
	const v = createVirtualizer({ count: 2 });
	v.measure(0, 80);
	assert.equal(v.sizeFor(0), 80);
	v.dispose();
	assert.equal(v.sizeFor(0), 40);
	v.measure(1, 120);
	assert.equal(v.sizeFor(1), 40);
});

test('network state removes global listeners when its owner is disposed', () => {
	const previousWindow = globalThis.window;
	const previousAdd = globalThis.addEventListener;
	const previousRemove = globalThis.removeEventListener;
	const added = [];
	const removed = [];
	try {
		globalThis.window = {};
		globalThis.addEventListener = (name, listener) => added.push([name, listener]);
		globalThis.removeEventListener = (name, listener) => removed.push([name, listener]);
		const network = createScope(() => {
			const state = createNetworkState();
			state.start();
			return state;
		});
		assert.equal(added.length, 2);
		network.dispose();
		assert.equal(removed.length, 2);
	} finally {
		globalThis.window = previousWindow;
		globalThis.addEventListener = previousAdd;
		globalThis.removeEventListener = previousRemove;
	}
});

test('offline mutation queues bound retained operations by default and support unlimited mode', async () => {
	const queue = createMutationQueue(`queue-${Date.now()}`, { maxItems: 2 });
	queue.add({ value: 1 }); queue.add({ value: 2 }); queue.add({ value: 3 });
	assert.deepEqual(queue.list().map(item => item.value), [2, 3]);
	const storage = createMemoryStorage();
	const persistentKey = `persistent-${Date.now()}`;
	await storage.setItem(persistentKey, JSON.stringify([{ value: 1 }, { value: 2 }, { value: 3 }]));
	const persistent = createPersistentMutationQueue(storage, persistentKey, { maxItems: 2 });
	assert.deepEqual((await persistent.list()).map(item => item.value), [2, 3]);
	assert.deepEqual(JSON.parse(await storage.getItem(persistentKey)).map(item => item.value), [2, 3]);
	await persistent.add({ value: 1 }); await persistent.add({ value: 2 }); await persistent.add({ value: 3 });
	assert.deepEqual((await persistent.list()).map(item => item.value), [2, 3]);
});

test('adaptive scheduler rejects queued work and releases it on disposal', async () => {
	const scope = createScope(() => {
		const scheduler = createAdaptiveScheduler({ concurrency: 1 });
		const running = scheduler.schedule(() => new Promise(() => {}));
		const pending = scheduler.schedule(() => 2);
		return { scheduler, running, pending };
	});
	assert.equal(scope.value.scheduler.pending, 1);
	scope.dispose();
	await assert.rejects(scope.value.pending, /disposed/);
	void scope.value.running;
	assert.equal(scope.value.scheduler.pending, 0);
});

test('collection indexes and incremental predicates update only logical result', () => {
	const c = collection([{ id: 1, status: 'open' }, { id: 2, status: 'closed' }]); const idx = c.indexBy('status'); assert.deepEqual(idx.get('open').map(x => x.id), [1]); const q = c.incrementalWhere(x => x.status === 'open'); c.update(2, { status: 'open' }); assert.deepEqual(q.value.map(x => x.id).sort(), [1, 2]); q.dispose();
});

test('collection snapshots are reactive for list renders', () => {
	const c = collection([{ id: '1', text: 'Offline task', done: false }]);
	let snapshot;
	const stop = effect(() => {
		snapshot = c.toJSON();
	}, { sync: true });
	c.update('1', { done: true });
	assert.deepEqual(snapshot, [{ id: '1', text: 'Offline task', done: true }]);
	stop();
});

test('owner disposal releases incremental collection watchers', () => {
	const c = collection([{ id: 1, active: true }]);
	let query: any;
	const scope = createScope(() => {
		query = c.where(item => item.active);
		return query;
	});
	assert.equal(query.value.length, 1);
	scope.dispose();
	c.update(1, { active: false });
	assert.equal(query.value.length, 1);
});

test('collection disposal clears retained indexes and makes mutations inert', () => {
	const c = collection([{ id: 1, status: 'open' }]);
	c.indexBy('status');
	c.incrementalWhere(item => item.status === 'open');
	c.dispose();
	assert.equal(c.size, 0);
	assert.equal(c.insert({ id: 2, status: 'closed' }), undefined);
	assert.deepEqual(c.indexBy('status').get('closed'), []);
	c.dispose();
});

test('LWW CRDT deterministically resolves operations', () => { const a = new LWWMap('a'), b = new LWWMap('b'); const op = a.set('x', 1); b.apply(op); const newer = b.set('x', 2); a.apply(newer); assert.equal(a.get('x'), 2); assert.equal(b.get('x'), 2); });

test('ISR returns stale value and revalidates', async () => { let n = 0; const cache = createISRCache({ ttl: 1 }); assert.equal((await cache.get('x', async () => ++n)).value, 1); await sleep(3); const stale = await cache.get('x', async () => ++n); assert.equal(stale.value, 1); assert.equal(stale.stale, true); await sleep(1); assert.equal((await cache.get('x', async () => ++n)).value, 2); });

test('ISR cache bounds retained keys and supports unlimited mode', async () => {
	const cache = createISRCache({ maxEntries: 2 });
	await cache.get('a', async () => 'a'); await cache.get('b', async () => 'b'); await cache.get('c', async () => 'c');
	assert.deepEqual(cache.inspect().map(x => x.key), ['b', 'c']);
	const unlimited = createISRCache({ maxEntries: 0 });
	await unlimited.get('a', async () => 'a'); await unlimited.get('b', async () => 'b');
	assert.equal(unlimited.inspect().length, 2);
});

test('clearing collected CSS removes generated style nodes', () => {
	const previousDocument = (globalThis as any).document;
	const removed: any[] = [];
	(globalThis as any).document = {
		querySelector: () => null,
		createElement: () => {
			const node = { dataset: {}, remove() { removed.push(node); } };
			return node;
		},
		head: { appendChild() { } }
	};
	try {
		css({ color: 'red' }, { name: `test-style-${Date.now()}` });
		clearCollectedCSS();
		assert.equal(removed.length, 1);
	} finally {
		(globalThis as any).document = previousDocument;
		clearCollectedCSS();
	}
});

test('streaming SSR emits fallback then independent replacement', async () => { const chunks = []; for await (const x of renderToStream(h('main', null, streamBoundary(Promise.resolve(h('b', null, 'done')), h('i', null, 'wait'))), { document: false })) chunks.push(x); assert.match(chunks[0], /wait/); assert.ok(chunks.some(x => x.includes('data-lithe-replace'))); });

test('query persistence and tag invalidation work', async () => { const storage = createMemoryStorage(), persister = createStoragePersister(storage), cache = new Map(), client = new QueryClient({ cache, persistence: persister, autoStart: false }); client.setQueryData(['products'], [{ id: 1 }], { tags: ['Product'] }); await client.persist(); const client2 = new QueryClient({ cache: new Map(), persistence: persister, autoStart: false }); await client2.restore(); assert.equal(client2.getQueryData(['products'])[0].id, 1); const m = mutation({ client: client2, writes: ['Product'], action: async () => ({ ok: true }) }); await m.mutate({}); const entry = client2.getEntry(['products']); assert.equal(entry.updatedAt, 0); });

test('image metadata reads PNG dimensions', () => { const b = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(320, 16); b.writeUInt32BE(200, 20); assert.deepEqual(imageMetadata(b), { format: 'png', width: 320, height: 200 }); });

test('type generator derives route params and server action names', async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-types-')); await fs.mkdir(path.join(root, 'src/routes/users'), { recursive: true }); await fs.writeFile(path.join(root, 'src/routes/users/[id].tsx'), `export default()=>null`); await fs.writeFile(path.join(root, 'src/actions.server.ts'), `export const save=server<Input, Output>(()=>{})`); const r = await generateTypes(root); const text = await fs.readFile(r.out, 'utf8'); assert.ok(text.includes('\"/users/:id\"')); assert.ok(text.includes('\"save\"')); });

test('prerender command writes route HTML without dependencies', async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-pre-')); await fs.writeFile(path.join(root, 'prerender.ts'), `export const routes:string[]=['/','/a']; export const render=(r:string):string=>'<!doctype html><p>'+r+'</p>';`); const r = await prerenderProject(root); assert.equal(r.routes.length, 2); assert.match(await fs.readFile(path.join(root, 'dist/a/index.html'), 'utf8'), />\/a</); });

test('devtools exposes component metadata and debugger snapshots', () => { const tools = createDevtools(); const scope = createScope(() => 42, { name: 'DebugComponent' }); try { assert.ok(tools.components().some(x => x.name === 'DebugComponent')); tools.debugger.pause(); assert.equal(globalThis.__LITHE_DEBUG_PAUSED__, true); assert.ok(tools.debugger.snapshot().components.some(x => x.name === 'DebugComponent')); tools.debugger.resume(); } finally { scope.dispose(); tools.dispose(); } });

test('devtools disposal releases history and installed global references', () => {
	const tools = createDevtools();
	tools.record({ type: 'retained', value: { data: 'large' } });
	tools.installGlobal('__LITHE_TEST_DEVTOOLS__');
	tools.dispose();
	assert.equal(tools.history.length, 0);
	assert.equal((globalThis as any).__LITHE_TEST_DEVTOOLS__, undefined);
	tools.dispose();
});

test('delegated events expose the matched element as currentTarget', () => { const listeners = new Map(); let adds = 0; const root = { parentNode: null, addEventListener(type, fn) { adds++; listeners.set(type, fn); }, removeEventListener() { } }; const input = { parentNode: root }; let current; installDelegatedEvents(root, ['change', 'change']); assert.equal(adds, 1); setDelegatedEvent(input, 'onChange', event => { current = event.currentTarget; }); listeners.get('change')({ target: input, cancelBubble: false }); assert.equal(current, input); });

test('delegated root listeners follow owner scope disposal', () => {
	let removed = 0;
	const root = { parentNode: null, addEventListener() {}, removeEventListener() { removed++; } };
	const scope = createScope(() => installDelegatedEvents(root, ['click', 'input']));
	scope.dispose();
	assert.equal(removed, 2);
});

test('delegated events keep currentTarget stable across async handlers', async () => {
	const listeners = new Map();
	const root = { parentNode: null, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener() { } };
	const input = { parentNode: root };
	let current;
	installDelegatedEvents(root, ['change']);
	setDelegatedEvent(input, 'onChange', async event => {
		await Promise.resolve();
		current = event.currentTarget;
	});
	listeners.get('change')({ target: input, cancelBubble: false });
	await Promise.resolve();
	assert.equal(current, input);
});

test('captured lazy events preserve live functions and expose serializable snapshots', () => {
	const onToggle = (id: string) => id;
	const symbol = capturedEventSymbol('/event.js', 'handler', { onToggle, todo: { id: '1', done: false } });
	assert.equal(symbol.captures.onToggle, onToggle);
	assert.deepEqual(symbol.snapshot, { todo: { id: '1', done: false } });
});

test('DOM attributes follow HTML names and reject unsafe URLs', () => { const attrs = new Map(); const element = { setAttribute(key, value) { attrs.set(key, value); }, removeAttribute(key) { attrs.delete(key); } }; __setAttribute(element, 'className', 'active'); __setAttribute(element, 'htmlFor', 'title'); __setAttribute(element, 'href', 'javascript:alert(1)'); assert.equal(attrs.get('class'), 'active'); assert.equal(attrs.get('for'), 'title'); assert.equal(attrs.has('href'), false); });

test('framework security check rejects javascript anchors and warns about target blank', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-security-'));
	try {
		await fs.mkdir(path.join(root, 'src'), { recursive: true });
		await fs.writeFile(path.join(root, 'src', 'main.tsx'), `export const view=<><a href="javascript:alert(1)">Bad</a><a href="https://example.com" target="_blank">Blank</a></>;`);
		const result = await checkProject(root);
		assert.equal(result.ok, false);
		assert.ok(result.issues.some(x => x.code === 'SEC003'));
		assert.ok(result.issues.some(x => x.code === 'SEC002'));
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('framework check resolves project aliases before dependency checks', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-alias-'));
	try {
		await fs.mkdir(path.join(root, 'src', 'lib'), { recursive: true });
		await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
			compilerOptions: {
				baseUrl: '.',
				paths: { '@/*': ['src/*'] }
			}
		}));
		await fs.writeFile(path.join(root, 'src', 'entry.client.ts'), `import { token } from '@/lib/secret.ts'; export const value=token;`);
		await fs.writeFile(path.join(root, 'src', 'lib', 'secret.ts'), `export const token=process.env.API_SECRET;`);
		const result = await checkProject(root);
		assert.equal(result.issues.some(x => x.code === 'DEP001'), false, JSON.stringify(result.issues, null, 2));
		assert.equal(result.ok, false);
		assert.ok(result.issues.some(x => x.code === 'SECRET002'), JSON.stringify(result.issues, null, 2));
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('doctor dependency policy allows local file links', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-doctor-'));
	try {
		await fs.mkdir(path.join(root, 'src'), { recursive: true });
		await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
			type: 'module',
			dependencies: { lithe: 'file:../..' },
			devDependencies: {}
		}));
		await fs.writeFile(path.join(root, 'src', 'main.ts'), `export const ready=true;`);
		const result = await doctorProject(root, { build: false, sourceRoot: root });
		const policy = result.checks.find(x => x.name === 'dependency policy');
		assert.equal(policy?.status, 'pass');
		assert.match(policy?.detail || '', /0 external dependencies/);
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});
