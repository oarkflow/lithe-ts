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
import { createMemoryStorage } from '../src/offline/storage.ts';
import { imageMetadata } from '../tools/image.ts';
import { generateTypes } from '../tools/types.ts';
import { prerenderProject } from '../tools/prerender.ts';

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('TypeScript stripper and compiler handle typed TSX and static hoisting', () => {
	const src = `interface User { name:string }\nconst n:number=1; export function Card(p:{name:string}){ return <div className="x">Hi</div> }`;
	const stripped = stripTypeScript(src); assert.doesNotMatch(stripped, /interface User/); assert.doesNotMatch(stripped, /n:number/);
	const c = compileModule(src, { typescript: true, runtimeImport: '@lithe/dom', filename: 'card.tsx' }); assert.match(c.code, /staticTemplate/); assert.ok(c.map); assert.deepEqual(c.diagnostics, []);
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

test('LWW CRDT deterministically resolves operations', () => { const a = new LWWMap('a'), b = new LWWMap('b'); const op = a.set('x', 1); b.apply(op); const newer = b.set('x', 2); a.apply(newer); assert.equal(a.get('x'), 2); assert.equal(b.get('x'), 2); });

test('ISR returns stale value and revalidates', async () => { let n = 0; const cache = createISRCache({ ttl: 1 }); assert.equal((await cache.get('x', async () => ++n)).value, 1); await sleep(3); const stale = await cache.get('x', async () => ++n); assert.equal(stale.value, 1); assert.equal(stale.stale, true); await sleep(1); assert.equal((await cache.get('x', async () => ++n)).value, 2); });

test('streaming SSR emits fallback then independent replacement', async () => { const chunks = []; for await (const x of renderToStream(h('main', null, streamBoundary(Promise.resolve(h('b', null, 'done')), h('i', null, 'wait'))), { document: false })) chunks.push(x); assert.match(chunks[0], /wait/); assert.ok(chunks.some(x => x.includes('data-lithe-replace'))); });

test('query persistence and tag invalidation work', async () => { const storage = createMemoryStorage(), persister = createStoragePersister(storage), cache = new Map(), client = new QueryClient({ cache, persistence: persister, autoStart: false }); client.setQueryData(['products'], [{ id: 1 }], { tags: ['Product'] }); await client.persist(); const client2 = new QueryClient({ cache: new Map(), persistence: persister, autoStart: false }); await client2.restore(); assert.equal(client2.getQueryData(['products'])[0].id, 1); const m = mutation({ client: client2, writes: ['Product'], action: async () => ({ ok: true }) }); await m.mutate({}); const entry = client2.getEntry(['products']); assert.equal(entry.updatedAt, 0); });

test('image metadata reads PNG dimensions', () => { const b = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(320, 16); b.writeUInt32BE(200, 20); assert.deepEqual(imageMetadata(b), { format: 'png', width: 320, height: 200 }); });

test('type generator derives route params and server action names', async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-types-')); await fs.mkdir(path.join(root, 'src/routes/users'), { recursive: true }); await fs.writeFile(path.join(root, 'src/routes/users/[id].tsx'), `export default()=>null`); await fs.writeFile(path.join(root, 'src/actions.server.ts'), `export const save=server<Input, Output>(()=>{})`); const r = await generateTypes(root); const text = await fs.readFile(r.out, 'utf8'); assert.ok(text.includes('\"/users/:id\"')); assert.ok(text.includes('\"save\"')); });

test('prerender command writes route HTML without dependencies', async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-pre-')); await fs.writeFile(path.join(root, 'prerender.ts'), `export const routes:string[]=['/','/a']; export const render=(r:string):string=>'<!doctype html><p>'+r+'</p>';`); const r = await prerenderProject(root); assert.equal(r.routes.length, 2); assert.match(await fs.readFile(path.join(root, 'dist/a/index.html'), 'utf8'), />\/a</); });

test('devtools exposes component metadata and debugger snapshots', () => { const tools = createDevtools(); const scope = createScope(() => 42, { name: 'DebugComponent' }); try { assert.ok(tools.components().some(x => x.name === 'DebugComponent')); tools.debugger.pause(); assert.equal(globalThis.__LITHE_DEBUG_PAUSED__, true); assert.ok(tools.debugger.snapshot().components.some(x => x.name === 'DebugComponent')); tools.debugger.resume(); } finally { scope.dispose(); tools.dispose(); } });

test('delegated events expose the matched element as currentTarget', () => { const listeners = new Map(); const root = { parentNode: null, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener() { } }; const input = { parentNode: root }; let current; installDelegatedEvents(root, ['change']); setDelegatedEvent(input, 'onChange', event => { current = event.currentTarget; }); listeners.get('change')({ target: input, cancelBubble: false }); assert.equal(current, input); });

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
