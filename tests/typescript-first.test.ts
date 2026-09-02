import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from '../tools/create.ts';
import { buildProject } from '../tools/build.ts';
import { walk } from '../tools/shared.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const authoredRoots=['src','tools','cli','tests','benchmarks'];

test('repository has no authored JavaScript implementation files',async()=>{
  const offenders:string[]=[];
  for(const dir of authoredRoots){for(const file of await walk(path.join(root,dir)))if(file.endsWith('.js')&&!file.includes(`${path.sep}node_modules${path.sep}`))offenders.push(path.relative(root,file));}
  for(const file of await walk(path.join(root,'examples')))if(file.endsWith('.js')&&!file.includes(`${path.sep}dist${path.sep}`)&&!file.includes(`${path.sep}node_modules${path.sep}`))offenders.push(path.relative(root,file));
  assert.deepEqual(offenders,[]);
});

test('project generator creates TypeScript/TSX source',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-ts-create-'));
  try{
    await createProject(dir);
    await fs.access(path.join(dir,'src/main.tsx'));
    const html=await fs.readFile(path.join(dir,'public/index.html'),'utf8');
    assert.match(html,/\/src\/main\.tsx/);
    const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));
    assert.equal(pkg.scripts.dev,'lithe dev .');
    const frameworkPkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
    assert.equal(pkg.dependencies['@oarkflow/lithe'],`^${frameworkPkg.version}`);
    const main=await fs.readFile(path.join(dir,'src/main.tsx'),'utf8');
    assert.match(main,/signal<number>/);
    assert.doesNotMatch(main,/\bsignal\s*,\s*h\s*,\s*mount\b/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('typed TSX builds to browser JavaScript without unresolved TypeScript imports',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-ts-build-'));
  try{
    await fs.mkdir(path.join(dir,'src'),{recursive:true});await fs.mkdir(path.join(dir,'public'),{recursive:true});
    await fs.writeFile(path.join(dir,'public/index.html'),'<!doctype html><div id="app"></div><script type="module" src="/src/main.tsx"></script>');
    await fs.writeFile(path.join(dir,'src/model.ts'),`export interface Item { id:string; value:number }\nexport const seed:Item={id:'a',value:1};`);
    await fs.writeFile(path.join(dir,'src/main.tsx'),`import { signal } from '@oarkflow/lithe/core'; import { mount } from '@oarkflow/lithe/dom'; import { seed, type Item } from './model.ts'; const current=signal<Item>(seed); function App(){return <strong>{()=>current.value.value}</strong>} mount(document.getElementById('app')!,<App/>);`);
    await fs.writeFile(path.join(dir,'lithe.config.json'),JSON.stringify({performance:{totalBytes:1000000,jsGzip:1000000}}));
    const {out}=await buildProject(dir,{sourceMaps:false,minify:false});
    const main=await fs.readFile(path.join(out,'src/main.js'),'utf8');
    const model=await fs.readFile(path.join(out,'src/model.js'),'utf8');
    assert.doesNotMatch(main,/from\s*['"][^'"]+\.ts['"]/);
    assert.doesNotMatch(model,/\binterface\b|:\s*Item\b/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
