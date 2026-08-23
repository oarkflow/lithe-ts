import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileModule } from '../src/compiler/jsx.ts';
import { renderToString } from '../src/server/ssr.ts';
import { h } from '../src/dom/vnode.ts';
import { Island } from '../src/dom/control.ts';
import { buildProject } from '../tools/build.ts';
import { splitInlineServerFunctions } from '../tools/server-placement.ts';
import { treeShakeModule } from '../tools/tree-shake.ts';
import { minifyJS } from '../tools/minify.ts';
import { createScope } from '../src/core/owner.ts';
import { serializeOwners } from '../src/core/reactive-resume.ts';

async function project(files) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-final-')); for (const [name, body] of Object.entries(files)) { const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, body); } return root; }

test('safe captured event handlers become independent lazy chunks and retain imported dependencies', async () => {
	const root = await project({
		'public/index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.jsx"></script>',
		'src/api.js': 'export async function save(id){return id}',
		'src/main.jsx': `import {mount} from '@lithe/dom'; import {save} from './api.ts'; function App(){const id=42;return <button onClick={()=>save(id)}>Save</button>} mount(document.querySelector('#app'),<App/>);`,
		'lithe.config.json': JSON.stringify({ performance: { totalBytes: 1000000, jsGzip: 1000000 } })
	});
	try { const { out, manifest } = await buildProject(root); assert.equal(manifest.eventChunks.length, 1); assert.equal(manifest.minified, true); assert.equal(manifest.sourceMaps, false); assert.equal((await fs.readdir(path.join(out, 'src'))).some(file => file.endsWith('.map')), false); const chunk = manifest.eventChunks[0].chunk; const main = await fs.readFile(path.join(out, 'src/main.js'), 'utf8'), event = await fs.readFile(path.join(out, '__lithe_events', chunk), 'utf8'); assert.match(main, /capturedEventSymbol\("\/__lithe_events\//); assert.doesNotMatch(main, /import\{save\}/); assert.match(event, /from"\/src\/api\.js"/); assert.equal(await fs.readFile(path.join(out, 'src/api.js'), 'utf8').then(() => true), true); } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('captured event extraction refuses handlers that mutate captured state', () => {
	const c = compileModule(`function Row({item}){return <button onClick={()=>item.done=true}>x</button>}`, { filename: 'src/row.jsx' });
	assert.equal(c.eventHandlers.length, 0); assert.doesNotMatch(c.code, /capturedEventSymbol/);
});

test('SSR Island renders children while client policy remains deferred', async () => {
	const html = await renderToString(h(Island, { when: 'visible' }, h('span', null, 'island child')), { document: false });
	assert.equal(html, '<span>island child</span>');
});

test('owner resume registry releases disposed owners', () => {
	const scope = createScope(() => 42, { name: 'release-test' }); assert.ok(serializeOwners().some(x => x.name === 'release-test')); scope.dispose(); assert.ok(!serializeOwners().some(x => x.name === 'release-test'));
});

test('inline use-server placement produces private module reference', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-place-')); try { const file = path.join(root, 'main.js'), src = `export async function secret(input){'use server';return input}`; const out = splitInlineServerFunctions(src, file, root, { auto: true }); assert.equal(out.refs.length, 1); assert.equal(out.refs[0].exportName, 'secret'); assert.match(out.code, /__litheServerReference/); assert.doesNotMatch(out.code, /'use server'/); } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('symbol tree shaking removes unused pure exports but preserves requested exports', () => {
	const code = `export function used(){return 1}\nexport function unused(){return 2}\nexport const inert=3;`;
	const r = treeShakeModule(code, new Set(['used'])); assert.match(r.code, /function used/); assert.doesNotMatch(r.code, /function unused/); assert.doesNotMatch(r.code, /inert/); assert.deepEqual(new Set(r.removed), new Set(['unused', 'inert']));
});

test('tree shaking removes unused named imports, default imports and unused destructuring properties', () => {
	const code = `import { active, unusedImport } from './module.js';
import UnusedDefault from './other.js';
import { live } from './live.js';
const { usedProp, unusedProp } = { usedProp: 1, unusedProp: 2 };
export function run() {
	return active() + usedProp + live();
}`;
	const r = treeShakeModule(code, new Set(['run']));
	assert.match(r.code, /import \{ active \} from '\.\/module\.js';/);
	assert.doesNotMatch(r.code, /unusedImport/);
	assert.doesNotMatch(r.code, /UnusedDefault/);
	assert.doesNotMatch(r.code, /unusedProp/);
	assert.match(r.code, /usedProp/);
});

test('minifier preserves ASI-sensitive newline after return', () => {
	const out = minifyJS(`function f(){return\n{value:1}}`); assert.match(out, /return\n\{/); assert.doesNotThrow(() => new Function(out + ';return f')());
});

