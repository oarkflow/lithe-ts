import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { compileModule } from '../src/compiler/jsx.ts';
import { reactiveGraphIR, mergeReactiveGraphs, findReactiveCycles } from '../src/compiler/ir.ts';
import { transformWorkerPlacement } from '../src/compiler/workers.ts';
import { analyzeAccessibility } from '../src/compiler/a11y.ts';
import { signal } from '../src/core/reactive.ts';
import { pendingSignals, installSignalSnapshot } from '../src/core/reactive-resume.ts';
import { compiledTemplate, compiledElement } from '../src/dom/dom.ts';
import { renderToString } from '../src/server/ssr.ts';
import { CRDTDocument } from '../src/sync/crdt.ts';
import { edgeAdapterMatrix } from '../src/server/edge.ts';
import { createMemoryNativeDriver, createNativeRenderer } from '../src/interop/native.ts';
import { h } from '../src/dom/vnode.ts';
import { server, handleServerFunction } from '../src/server/rpc.ts';
import { buildProject } from '../tools/build.ts';

test('V8-backed JavaScript validation accepts full module grammar and reports syntax locations', () => {
	const good = validateJavaScript(`export class Box { #x=1; static { this.ready=true } value=()=>this.#x }\nawait Promise.resolve();`, { filename: 'full.js' });
	assert.equal(good.valid, true);
	const bad = validateJavaScript(`export const a = ;\nexport function broken( {\n`, { filename: 'bad.js', maxErrors: 3 });
	assert.equal(bad.valid, false); assert.ok(bad.diagnostics.length >= 1); assert.equal(bad.diagnostics[0].file, 'bad.js');
});

test('compiler emits direct native DOM instructions, member components, lazy event symbols and accessibility diagnostics', () => {
	const out = compileModule(`import { save } from './events.ts';\nexport function Page(){ return <main><button onClick={save}>Save</button><router.View/></main> }`, { runtimeImport: '@lithe/dom', filename: 'src/page.jsx' });
	assert.match(out.code, /compiledElement\("main"/);
	assert.match(out.code, /eventSymbol\("\/src\/events\.js",\s*"save"\)/);
	assert.match(out.code, /h\(router\.View/);
	const issues = analyzeAccessibility(`const x=<div onClick={()=>1}>x</div><img src="x">`, 'a.jsx');
	assert.ok(issues.some(x => x.code.includes('CLICK') || x.code.includes('KEY'))); assert.ok(issues.some(x => x.code.includes('ALT')));
});

test('compile-time reactive graphs link across modules and diagnose cycles', () => {
	const a = reactiveGraphIR(`import { b } from './b.ts'; export const a=computed(()=>b.value+1);`, 'src/a.js');
	const b = reactiveGraphIR(`import { a } from './a.ts'; export const b=computed(()=>a.value+1);`, 'src/b.js');
	const graph = mergeReactiveGraphs([a, b]); const cycles = findReactiveCycles(graph);
	assert.equal(graph.edges.filter(x => x.kind === 'import-depends').length, 2); assert.ok(cycles.length >= 1);
});

test('automatic and directive worker placement only transform safe awaited functions', () => {
	const explicit = transformWorkerPlacement(`export function sum(a,b){'use worker';return a+b}`);
	assert.equal(explicit.changed, true); assert.match(explicit.code, /__litheWorker/);
	const automatic = transformWorkerPlacement(`async function heavy(items){let total=0;for(const item of items)total+=item;return total}\nexport async function run(){return await heavy([1,2,3])}`);
	assert.equal(automatic.changed, true); assert.equal(automatic.candidates[0].mode, 'auto');
	const unsafe = transformWorkerPlacement(`const outside=2; async function heavy(items){let total=outside;for(const item of items)total+=item;return total}\nexport async function run(){return await heavy([1])}`);
	assert.equal(unsafe.changed, false);
});

test('SSR compiled templates/elements serialize named resume signals without rerender protocol', async () => {
	const count = signal(7, { name: 'completion-count' });
	const view = compiledElement('section', { id: 'x' }, [compiledTemplate('<p><!--l:0--></p>', [() => count])]);
	const html = await renderToString(view, { resume: true });
	assert.match(html, /<section id="x"><p><!--l:s:0-->7<!--l:e:0--><\/p><\/section>/);
	assert.match(html, /"completion-count":7/);
	installSignalSnapshot({ 'future-signal': 42 }); assert.equal(pendingSignals()['future-signal'], 42); assert.equal(signal(0, { name: 'future-signal' }).value, 42);
});

test('CRDT document converges maps, sets and ordered lists', () => {
	const a = new CRDTDocument('a', { profile: 'map', tags: 'set', items: 'list' }), b = new CRDTDocument('b', { profile: 'map', tags: 'set', items: 'list' });
	const ops = [a.set('profile', 'name', 'Ada'), a.add('tags', 'engineer'), a.insert('items', 'first')]; b.merge(ops); a.merge(b.operations());
	assert.deepEqual(a.toJSON(), b.toJSON()); assert.equal(b.get('profile', 'name'), 'Ada'); assert.deepEqual(b.value('tags'), ['engineer']); assert.deepEqual(b.value('items'), ['first']);
});

test('edge adapters preserve web Request/Response behavior across supported runtimes', async () => {
	const matrix = await edgeAdapterMatrix((request, ctx) => Response.json({ path: new URL(request.url).pathname, runtime: ctx.runtime }));
	for (const key of ['cloudflare', 'deno', 'bun', 'lambda']) { assert.equal(matrix[key].status, 200); assert.match(matrix[key].body, /\/ping/); }
});

test('native host renderer mounts Lithe component trees without a DOM', () => {
	const driver = createMemoryNativeDriver(), root = driver.createRoot(), renderer = createNativeRenderer(driver);
	const dispose = renderer.mount(root, h('stack', { gap: 8 }, h('text', { value: 'hello' }, 'Hello')));
	const snap = driver.snapshot(root); assert.equal(snap.children[0].type, 'stack'); assert.equal(snap.children[0].children[0].type, 'text');
	dispose(); assert.equal(root.children.length, 0);
});

test('RPC request carries distributed correlation id into server context', async () => {
	const action = server(async (_input, ctx) => ctx.traceId);
	const request = new Request(`https://example.test/_lithe/action/${action.id}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lithe-trace-id': 'trace-completion' }, body: '{"input":null}' });
	const response = await handleServerFunction(request); const body = await response.json();
	assert.equal(body.data, 'trace-completion'); assert.equal(response.headers.get('x-lithe-trace-id'), 'trace-completion');
});

test('production chunk reachability keeps event-symbol modules and prunes unreachable application modules', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-complete-'));
	try {
		await fs.mkdir(path.join(root, 'src'), { recursive: true }); await fs.mkdir(path.join(root, 'public'), { recursive: true });
		await fs.writeFile(path.join(root, 'public', 'index.html'), `<div id="app"></div><script type="module" src="/src/main.jsx"></script>`);
		await fs.writeFile(path.join(root, 'public', 'app.css'), `.ready{color:red}`);
		await fs.writeFile(path.join(root, 'src', 'main.jsx'), `import { save } from './events.ts'; import { mount } from '@lithe/dom'; mount(document.getElementById('app'), <button onClick={save}>Save</button>);`);
		await fs.writeFile(path.join(root, 'src', 'events.js'), `export function save(){ globalThis.__saved=(globalThis.__saved||0)+1 }`);
		await fs.writeFile(path.join(root, 'src', 'unused.js'), `export const shouldDisappear='unused-marker'`);
		const { manifest, out } = await buildProject(root, { enforceBudgets: false, sourceMaps: false });
		assert.ok(manifest.chunks.reachable.includes('src/events.js')); assert.ok(!manifest.chunks.reachable.includes('src/unused.js'));
		await fs.access(path.join(out, 'src', 'events.js')); await assert.rejects(fs.access(path.join(out, 'src', 'unused.js')));
		const main = await fs.readFile(path.join(out, 'src', 'main.js'), 'utf8'); assert.match(main, /eventSymbol\("\/src\/events\.js"/);
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('production single bundle mode emits one static app entry', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-single-'));
	try {
		await fs.mkdir(path.join(root, 'src'), { recursive: true }); await fs.mkdir(path.join(root, 'public'), { recursive: true });
		await fs.writeFile(path.join(root, 'public', 'index.html'), `<div id="app"></div><script type="module" src="/src/main.jsx"></script>`);
		await fs.writeFile(path.join(root, 'public', 'app.css'), `.ready{color:red}`);
		await fs.writeFile(path.join(root, 'src', 'main.jsx'), `import { mount } from '@lithe/dom'; export function unusedHelper(){return 'remove-me'} mount(document.getElementById('app'), <main className="ready">Ready</main>);`);
		const { manifest, out } = await buildProject(root, { bundle: 'single', sourceMaps: false, enforceBudgets: false });
		assert.equal(manifest.bundle, 'single'); assert.deepEqual(manifest.chunks.entries, ['app.js']); assert.equal(manifest.eventChunks.length, 0); assert.equal(manifest.assetVersion, null); await assert.rejects(fs.access(path.join(out, '__lithe_events')));
		const app = await fs.readFile(path.join(out, 'app.js'), 'utf8'); assert.ok(app.includes('__litheRequire')); assert.doesNotMatch(app, /remove-me/); await assert.rejects(fs.access(path.join(out, 'src', 'main.js')));
		assert.match(await fs.readFile(path.join(out, 'index.html'), 'utf8'), /src="\/app\.js"/);
		assert.match(await fs.readFile(path.join(out, 'app.css'), 'utf8'), /\.ready\{color:red\}/); await assert.rejects(fs.access(path.join(out, 'lithe.css')));
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});
