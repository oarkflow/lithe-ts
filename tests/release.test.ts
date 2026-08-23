import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { declarationCoverage, typecheckProject } from '../tools/typecheck.ts';
import { generateTypes } from '../tools/types.ts';
import { checkProject } from '../tools/check.ts';
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
