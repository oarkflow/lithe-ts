import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';

export const FRAMEWORK_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
export const SRC_ROOT = path.join(FRAMEWORK_ROOT,'src');
export const BUILTINS = new Set([...builtinModules,...builtinModules.map(x=>`node:${x}`)]);

export async function exists(file){ try{await fs.access(file);return true;}catch{return false;} }
export async function walk(dir){ const out=[]; for(const entry of await fs.readdir(dir,{withFileTypes:true})){ const full=path.join(dir,entry.name); if(entry.isDirectory()) out.push(...await walk(full)); else out.push(full); } return out; }
export async function ensureDir(file){ await fs.mkdir(path.dirname(file),{recursive:true}); }
export async function copyFile(from,to){ await ensureDir(to); await fs.copyFile(from,to); }

export const aliases = {
  '@lithe/runtime':'runtime/index.js','@lithe/core':'core/index.js','@lithe/dom':'dom/index.js','@lithe/router':'router/index.js','@lithe/data':'data/index.js','@lithe/forms':'forms/index.js','@lithe/server':'server/index.js','@lithe/rpc':'server/rpc.js','@lithe/worker':'worker/index.js','@lithe/offline':'offline/index.js','@lithe/i18n':'i18n/index.js','@lithe/head':'head/index.js','@lithe/animation':'animation/index.js','@lithe/collection':'collection/index.js','@lithe/virtual':'virtual/index.js','@lithe/permissions':'permissions/index.js','@lithe/observability':'observability/index.js','@lithe/devtools':'devtools/index.js','@lithe/testing':'testing/index.js','@lithe/style':'style/index.js','@lithe/image':'image/index.js','@lithe/sync':'sync/index.js','@lithe/ui':'ui/index.js','@lithe/grid':'grid/index.js','@lithe/app':'app/index.js','@lithe/interop':'interop/index.js'
};


const directExports = {
  '@lithe/core': {signal:'core/reactive.js',computed:'core/reactive.js',effect:'core/reactive.js',batch:'core/reactive.js',untrack:'core/reactive.js',state:'core/reactive.js',watch:'core/reactive.js',isSignal:'core/reactive.js',unwrap:'core/reactive.js',onMutation:'core/reactive-debug.js',inspectReactiveGraph:'core/reactive-debug.js',serializeSignals:'core/reactive-resume.js',restoreSignals:'core/reactive-resume.js',installSignalSnapshot:'core/reactive-resume.js',pendingSignals:'core/reactive-resume.js',getNamedSignal:'core/reactive-resume.js',schedule:'core/scheduler.js',scheduler:'core/scheduler.js',transition:'core/scheduler.js',adaptiveSchedule:'core/adaptive.js',deviceProfile:'core/adaptive.js',adaptivePriority:'core/adaptive.js',batteryProfile:'core/adaptive.js',initBatteryAdaptation:'core/adaptive.js',prefetchBudget:'core/adaptive.js',createAdaptiveScheduler:'core/adaptive.js',createScope:'core/owner.js',onCleanup:'core/owner.js',onMount:'core/owner.js',createContext:'core/owner.js'},
  '@lithe/dom': {h:'dom/vnode.js',Fragment:'dom/vnode.js',mount:'dom/dom.js',dynamic:'dom/dom.js',trustedHTML:'dom/dom.js',staticTemplate:'dom/dom.js',compiledTemplate:'dom/dom.js',compiledElement:'dom/dom.js',configureTrustedTypes:'dom/dom.js',Show:'dom/control.js',For:'dom/control.js',Index:'dom/control.js',Switch:'dom/control.js',Match:'dom/control.js',Dynamic:'dom/control.js',Portal:'dom/control.js',Island:'dom/control.js',Await:'dom/control.js',lazy:'dom/control.js',lazyEvent:'dom/control.js',hydrate:'dom/hydrate.js',eventSymbol:'dom/event-symbol.js',capturedEventSymbol:'dom/event-symbol.js',resumeDocument:'dom/resume.js',serializeResumeState:'dom/resume.js'},
  '@lithe/forms': {createForm:'forms/form.js',formDataToObject:'forms/form.js',getPath:'forms/form.js',setPath:'forms/form.js',AutoForm:'forms/auto.js',string:'forms/schema.js',number:'forms/schema.js',boolean:'forms/schema.js',email:'forms/schema.js',url:'forms/schema.js',object:'forms/schema.js',array:'forms/schema.js',union:'forms/schema.js',date:'forms/schema.js',literal:'forms/schema.js',enumOf:'forms/schema.js',toJSONSchema:'forms/emit.js',toOpenAPI:'forms/emit.js',createAdvancedForm:'forms/advanced.js'},
  '@lithe/router': {createRouter:'router/router.js',Link:'router/router.js',Outlet:'router/utils.js',defineRoutes:'router/utils.js',routePath:'router/utils.js',routeManifest:'router/utils.js',sharedTransition:'router/utils.js'},
  '@lithe/collection': {collection:'collection/collection.js'},
  '@lithe/i18n': {createI18n:'i18n/i18n.js'},
  '@lithe/style': {css:'style/style.js',defineTheme:'style/style.js',collectedCSS:'style/style.js'},
  '@lithe/data': {query:'data/query.js',queryClient:'data/query.js',QueryClient:'data/query.js',mutation:'data/query.js',resource:'data/query.js',infiniteQuery:'data/query.js',cursorQuery:'data/query.js'},
  '@lithe/worker': {worker:'worker/worker.js',sharedWorker:'worker/worker.js'},
  '@lithe/offline': {createNetworkState:'offline/offline.js',registerServiceWorker:'offline/offline.js',createIndexedDBStorage:'offline/storage.js',createPersistentMutationQueue:'offline/storage.js'},
  '@lithe/ui': {Dialog:'ui/primitives.js',Tabs:'ui/primitives.js',Menu:'ui/primitives.js',Listbox:'ui/primitives.js',Combobox:'ui/primitives.js',Tooltip:'ui/primitives.js',Tree:'ui/primitives.js',CommandPalette:'ui/primitives.js'},
};
export function rewriteBareImports(code,prefix='/__lithe/'){
  code=code.replace(/import\s*\{([^}]+)\}\s*from\s*(['"])(@lithe\/[\w-]+)\2\s*;?/g,(full,body,q,spec)=>{
    const map=directExports[spec]; if(!map)return full;
    const groups=new Map(),fallback=[];
    for(const part of body.split(',').map(x=>x.trim()).filter(Boolean)){
      const [exported,local]=part.split(/\s+as\s+/).map(x=>x.trim()); const target=map[exported];
      if(!target){fallback.push(part);continue;} if(!groups.has(target))groups.set(target,[]); groups.get(target).push(local&&local!==exported?`${exported} as ${local}`:exported);
    }
    const lines=[...groups].map(([target,names])=>`import { ${names.join(', ')} } from ${JSON.stringify(prefix+target)};`);
    if(fallback.length){const target=aliases[spec];lines.push(`import { ${fallback.join(', ')} } from ${JSON.stringify(prefix+target)};`);}
    return lines.join('\n');
  });
  return code.replace(/((?:import|export)\s+(?:[^'";]+?\s+from\s+)?|import\s*\()(['"])(@lithe\/[\w-]+)\2/g,(m,lead,q,spec)=>{
    const target=aliases[spec]; return target?`${lead}${q}${prefix}${target}${q}`:m;
  });
}
export function rewriteLocalJSX(code){
  return code.replace(/((?:from\s+|import\s*\()(['"])([^'"]+))\.(?:jsx|tsx|ts)(['"])/g,'$1.js$4');
}

