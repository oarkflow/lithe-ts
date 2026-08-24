const dependencies=new Map(),observers=new Map(),listeners=new Set(),components=new Map();
let previous:any=null,installed=false;
const hook={
  registerDependency(dep){dependencies.set(dep.id,dep);previous?.registerDependency?.(dep);},
  registerObserver(observer){observers.set(observer.id,observer);previous?.registerObserver?.(observer);},
  unregisterObserver(observer){observers.delete(observer.id);previous?.unregisterObserver?.(observer);},
  mutation(event){for(const fn of listeners)try{fn(event);}catch{}previous?.mutation?.(event);}
};
export function enableReactiveDebug(){if(installed)return()=>{};previous=globalThis.__LITHE_REACTIVE_DEBUG_HOOK__;if(previous!==hook)globalThis.__LITHE_REACTIVE_DEBUG_HOOK__=hook;installed=true;return()=>{if(globalThis.__LITHE_REACTIVE_DEBUG_HOOK__===hook)globalThis.__LITHE_REACTIVE_DEBUG_HOOK__=previous;installed=false;previous=null;};}
export function onMutation(listener){enableReactiveDebug();listeners.add(listener);return()=>listeners.delete(listener);}
export function inspectReactiveGraph(){enableReactiveDebug();const nodes=[],edges=[];for(const dep of dependencies.values()){nodes.push({id:dep.id,kind:dep.kind||'dependency',name:dep.label||null,subscribers:dep.subscribers.size,version:dep.version});for(const observer of dep.subscribers)edges.push({from:dep.id,to:observer.id,kind:'notifies'});}for(const obs of observers.values()){nodes.push({id:obs.id,kind:obs.kind||'effect',name:obs.label||null,dependencies:obs.dependencies?.length??0,owner:obs.owner?.id||null,cause:obs.lastCause||null});if(obs.output)edges.push({from:obs.id,to:obs.output.id,kind:'produces'});}return{nodes,edges,components:[...components.values()]};}
export function explainSignal(signal){const dep=signal?.__dep||signal;return dep?{id:dep.id??null,name:dep.label||signal?.__litheName||null,kind:dep.kind||'signal',version:dep.version??0,subscribers:dep.subscribers?[...dep.subscribers].map(x=>({id:x.id,kind:x.kind||'observer',name:x.label||null})):[],value:signal?.peek?.()}:null;}
export function traceUpdate(label,fn){const now=()=>globalThis.performance?.now?.()??Date.now();const event={type:'trace:update',label,start:now()};try{globalThis.__LITHE_DEVTOOLS__?.record?.(event);}catch{}try{return fn();}finally{const end=now();try{globalThis.__LITHE_DEVTOOLS__?.record?.({...event,end,duration:end-event.start});}catch{}}}
export function markComponent(name,meta={}){const id=meta.id||`${name}:${components.size+1}`;const record={id,name,meta,at:Date.now()};components.set(id,record);try{globalThis.__LITHE_DEVTOOLS__?.record?.({type:'component:mark',...record});}catch{}return record;}
