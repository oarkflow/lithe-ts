import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { declarationCoverage, typecheckProject } from '../tools/typecheck.ts';
import { generateTypes } from '../tools/types.ts';
import { checkProject } from '../tools/check.ts';
import { buildLibraryPackage } from '../tools/build-library.ts';
import { prefetchBudget, deviceProfile } from '../src/core/adaptive.ts';
import { signal } from '../src/core/reactive.ts';
import { compiledTemplate } from '../src/dom/dom.ts';
import { renderToString } from '../src/server/ssr.ts';
import { onCorrelation } from '../src/observability/carrier.ts';
import { createRouter } from '../src/router/router.ts';

async function tempProject(prefix='lithe-release-') {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),prefix));
  await fs.mkdir(path.join(root,'src'),{recursive:true});
  return root;
}

test('all official runtime exports are covered by shipped declarations', async () => {
  const issues=await declarationCoverage();
  assert.deepEqual(issues,[]);
});

test('core library build emits only reactive DOM package surface', async () => {
  const out=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-lib-'));
  try {
    const result=await buildLibraryPackage({outDir:out,mode:'core'});
    assert.ok(result.files.includes('package.json'));
    assert.ok(result.files.includes('src/core/index.js'));
    assert.ok(result.files.includes('src/dom/index.js'));
    assert.ok(result.files.includes('types/exports/core.d.ts'));
    assert.equal(result.files.some(x=>x.startsWith('src/router/')),false);
    assert.equal(result.files.some(x=>x.startsWith('src/server/')),false);
    assert.equal(result.files.some(x=>x.startsWith('src/data/')),false);
    assert.equal(result.files.some(x=>x.startsWith('cli/')),false);
    assert.equal(result.files.some(x=>x.startsWith('tools/')),false);
    assert.equal(result.files.some(x=>x.startsWith('src/compiler/')),false);
    assert.equal(result.files.some(x=>x.startsWith('src/plugins/')),false);
    assert.equal(result.files.some(x=>x.startsWith('examples/')),false);
    assert.ok(result.runtimeBytes<85_000,`core runtime is ${result.runtimeBytes} bytes`);
    assert.ok(result.runtimeGzipBytes<30_000,`core runtime gzip is ${result.runtimeGzipBytes} bytes`);
    assert.ok(result.declarationBytes<25_000,`core declarations are ${result.declarationBytes} bytes`);
    const declarations=await fs.readFile(path.join(out,'types/lithe.d.ts'),'utf8');
    assert.match(declarations,/declare module '@oarkflow\/lithe\/core'/);
    assert.doesNotMatch(declarations,/declare module '@oarkflow\/lithe\/router'/);
    const runtime=await import(pathToFileURL(path.join(out,'src/runtime/index.js')).href);
    const count=runtime.signal(1);
    assert.equal(count.value,1);
  } finally { await fs.rm(out,{recursive:true,force:true}); }
});

test('runtime library build emits app modules without CLI tooling or examples', async () => {
  const out=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-runtime-'));
  try {
    const result=await buildLibraryPackage({outDir:out,mode:'runtime'});
    assert.ok(result.files.includes('src/router/index.js'));
    assert.ok(result.files.includes('src/server/index.js'));
    assert.ok(result.files.includes('src/data/index.js'));
    assert.equal(result.files.some(x=>x.startsWith('cli/')),false);
    assert.equal(result.files.some(x=>x.startsWith('tools/')),false);
    assert.equal(result.files.some(x=>x.startsWith('examples/')),false);
  } finally { await fs.rm(out,{recursive:true,force:true}); }
});

test('full library build emits CLI and tooling without examples', async () => {
  const out=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-full-'));
  try {
    const result=await buildLibraryPackage({outDir:out,mode:'full'});
    assert.ok(result.files.includes('cli/lithe.js'));
    assert.ok(result.files.includes('tools/build.js'));
    assert.ok(result.files.includes('src/compiler/jsx.js'));
    assert.ok(result.files.includes('src/plugins/vite.js'));
    assert.equal(result.files.some(x=>x.startsWith('examples/')),false);
    const pkg=JSON.parse(await fs.readFile(path.join(out,'package.json'),'utf8'));
    assert.equal(pkg.name,'@oarkflow/lithe');
    assert.equal(pkg.private,undefined);
    assert.equal(pkg.publishConfig.access,'public');
    assert.equal(pkg.bin.lithe,'cli/lithe.js');
    assert.equal(pkg.exports['./core'].types,'./types/exports/core.d.ts');
    assert.equal(pkg.exports['./core'].import,'./src/core/index.js');
    const declarations=await fs.readFile(path.join(out,'types/lithe.d.ts'),'utf8');
    assert.match(declarations,/declare module '@oarkflow\/lithe'/);
    assert.doesNotMatch(declarations,/@lithe\//);
    assert.doesNotMatch(declarations,/declare module 'lithe(?:\/|')/);
  } finally { await fs.rm(out,{recursive:true,force:true}); }
});

test('zero-dependency TypeScript/TSX checker accepts modern syntax through platform transformer', async () => {
  const root=await tempProject();
  try {
    await fs.writeFile(path.join(root,'src','main.tsx'),`
      interface Item<T> { value: T }
      enum Mode { Ready='ready' }
      namespace Util { export const n = 1 }
      const box: Item<number> = { value: 2 };
      export const view = <section data-mode={Mode.Ready}>{box.value + Util.n}</section>;
    `);
    const result=await typecheckProject(root);
    assert.equal(result.files,1);
    assert.equal(result.ok,true,JSON.stringify(result.issues,null,2));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('generated server action declarations preserve annotated input and output types', async () => {
  const root=await tempProject();
  try {
    await fs.writeFile(path.join(root,'src','actions.ts'),`
      type CreateUser = { name: string };
      type User = { id: string; name: string };
      export const createUser = server(async (input: CreateUser): Promise<User> => ({ id: '1', name: input.name }));
    `);
    const result=await generateTypes(root);
    const dts=await fs.readFile(result.out,'utf8');
    assert.match(dts,/"createUser": \(input: CreateUser\) => Promise<User>/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('checker rejects transitive secret-tainted dependencies from client code', async () => {
  const root=await tempProject();
  try {
    await fs.writeFile(path.join(root,'src','entry.client.ts'),`import { value } from './shared.ts'; export const client=value;`);
    await fs.writeFile(path.join(root,'src','shared.ts'),`export const value=process.env.API_SECRET;`);
    const result=await checkProject(root);
    assert.equal(result.ok,false);
    assert.ok(result.issues.some(x=>x.code==='SECRET002'),JSON.stringify(result.issues,null,2));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('SSR resume state contains named-signal text binding graph', async () => {
  const name=`release-count-${Date.now()}`;
  const count=signal(9,{name});
  const html=await renderToString(compiledTemplate('<strong><!--l:0--></strong>',[()=>count]),{resume:true});
  assert.match(html,/<!--l:s:0-->9<!--l:e:0-->/);
  assert.match(html,new RegExp(`"signal":"${name}"`));
  assert.match(html,/"bindings":\{"0":\{"kind":"text"/);
});

test('adaptive policy has deterministic server-safe profile and usable prefetch budget', () => {
  const profile=deviceProfile(),budget=prefetchBudget();
  assert.equal(profile.connection,'unknown');
  assert.equal(profile.lowPower,false);
  assert.equal(budget.enabled,true);
  assert.ok(budget.concurrency>=1);
  assert.ok(budget.distance>=1);
});

test('router navigation emits correlation events through observability bridge', async () => {
  const events=[];const off=onCorrelation(e=>events.push(e));
  try {
    const router=createRouter([{path:'/a',component:()=>null},{path:'/b',component:()=>null}],{initialURL:'https://example.test/a'});
    await router.navigate('/b',{history:false});
    assert.ok(events.some(e=>String(e.type).includes('navigation')),JSON.stringify(events,null,2));
    const correlated=events.filter(e=>String(e.type).includes('navigation'));
    assert.ok(correlated.some(e=>e.id));
    router.dispose?.();
  } finally { off(); }
});
