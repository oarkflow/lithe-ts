import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildProject } from '../tools/build.ts';
import { createServerModuleHandler } from '../src/server/rpc.ts';

test('build splits .server modules out of browser output and generates callable stubs',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'lithe-split-'));await fs.mkdir(path.join(root,'src'),{recursive:true});await fs.mkdir(path.join(root,'public'),{recursive:true});
  await fs.writeFile(path.join(root,'public/index.html'),`<div id="app"></div><script type="module" src="/src/main.ts"></script>`);
  await fs.writeFile(path.join(root,'src/main.ts'),`import { secret } from './actions.server.ts'; globalThis.callSecret=secret;`);
  await fs.writeFile(path.join(root,'src/actions.server.ts'),`import { server } from '@oarkflow/lithe/rpc'; export const secret=server(async input=>({value:input.x+1,marker:'VERY_PRIVATE_MARKER'}));`);
  const built=await buildProject(root,{sourceMaps:false,minify:false});const client=await fs.readFile(path.join(root,'dist/src/main.js'),'utf8');assert.match(client,/serverReference/);assert.doesNotMatch(client,/VERY_PRIVATE_MARKER/);await assert.rejects(fs.access(path.join(root,'dist/src/actions.server.js')));
  const manifestPath=path.join(root,'.lithe/server/manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));const id=Object.keys(manifest.modules)[0];const handler=await createServerModuleHandler(manifestPath);const response=await handler(new Request(`http://test/_lithe/module/${id}/secret`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{x:4}})}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,data:{value:5,marker:'VERY_PRIVATE_MARKER'}});
});
