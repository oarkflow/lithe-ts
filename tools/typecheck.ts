import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from '../src/compiler/jsx.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { collectTypeEnvironment, semanticTypecheck } from '../src/compiler/typecheck.ts';
import { exists, walk, FRAMEWORK_ROOT } from './shared.ts';

const publicModules={
  '@lithe/core':'src/core/index.ts','@lithe/dom':'src/dom/index.ts','@lithe/router':'src/router/index.ts','@lithe/data':'src/data/index.ts','@lithe/forms':'src/forms/index.ts','@lithe/rpc':'src/server/rpc.ts','@lithe/server':'src/server/index.ts','@lithe/offline':'src/offline/index.ts','@lithe/sync':'src/sync/index.ts','@lithe/collection':'src/collection/index.ts','@lithe/virtual':'src/virtual/index.ts','@lithe/grid':'src/grid/index.ts','@lithe/style':'src/style/index.ts','@lithe/image':'src/image/index.ts','@lithe/animation':'src/animation/index.ts','@lithe/ui':'src/ui/index.ts','@lithe/worker':'src/worker/index.ts','@lithe/interop':'src/interop/index.ts','@lithe/devtools':'src/devtools/index.ts','@lithe/observability':'src/observability/index.ts','@lithe/i18n':'src/i18n/index.ts','@lithe/head':'src/head/index.ts','@lithe/permissions':'src/permissions/index.ts','@lithe/testing':'src/testing/index.ts','@lithe/app':'src/app/index.ts','@lithe/compiler':'src/compiler/index.ts'
};
function moduleBlock(source,name){const marker=`declare module '${name}'`;const start=source.indexOf(marker);if(start<0)return'';const open=source.indexOf('{',start);let depth=0,quote=null;for(let i=open;i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='\''||c==='"'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(open+1,i);}return source.slice(open+1);}
export async function declarationCoverage(){const declaration=await fs.readFile(path.join(FRAMEWORK_ROOT,'types/lithe.d.ts'),'utf8'),issues=[];for(const[specifier,file]of Object.entries(publicModules)){const block=moduleBlock(declaration,specifier);if(!block){issues.push({severity:'error',code:'TYPE_MODULE_MISSING',file:'types/lithe.d.ts',message:`Missing declaration module ${specifier}`});continue;}const mod=await import(pathToFileURL(path.join(FRAMEWORK_ROOT,file)).href);for(const name of Object.keys(mod))if(!new RegExp(`\\b${name.replace(/[$]/g,'\\$&')}\\b`).test(block)&&!(/@lithe\/server/.test(specifier)&&moduleBlock(declaration,'@lithe/rpc').includes(name)))issues.push({severity:'error',code:'TYPE_EXPORT_MISSING',file:'types/lithe.d.ts',message:`${specifier} is missing declaration for export ${name}`});}return issues;}
export async function typecheckProject(projectDir='.'){
  const root=path.resolve(projectDir),issues=await declarationCoverage(),src=path.join(root,'src');let files=0;
  if(await exists(src)){
    const typed=(await walk(src)).filter(f=>/\.(?:ts|tsx)$/.test(f)),sources=[];
    for(const file of typed)sources.push(await fs.readFile(file,'utf8'));
    const env=collectTypeEnvironment(sources);
    for(let index=0;index<typed.length;index++){const file=typed[index],code=sources[index],rel=path.relative(root,file).replace(/\\/g,'/');files++;try{const semantics=semanticTypecheck(code,{filename:rel,env});issues.push(...semantics.issues);const compiled=compileModule(code,{typescript:true,filename:rel,injectRuntime:false,sourceMap:false,captureEvents:false});for(const d of compiled.diagnostics||[])if(d.severity==='error')issues.push({...d,file:rel});const syntax=validateJavaScript(compiled.code,{filename:rel,maxErrors:6});for(const d of syntax.diagnostics)issues.push({...d,file:rel});}catch(error){issues.push({severity:'error',code:'TS_TRANSFORM',file:rel,message:error.message});}}
  }
  return{ok:!issues.some(x=>x.severity==='error'),files,issues};
}
