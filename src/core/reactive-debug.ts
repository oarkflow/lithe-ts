const dependencies=new Map(),observers=new Map(),listeners=new Set();
const previous=globalThis.__LITHE_REACTIVE_DEBUG_HOOK__;
const hook={
  registerDependency(dep){dependencies.set(dep.id,dep);previous?.registerDependency?.(dep);},
  registerObserver(observer){observers.set(observer.id,observer);previous?.registerObserver?.(observer);},
  unregisterObserver(observer){observers.delete(observer.id);previous?.unregisterObserver?.(observer);},
  mutation(event){for(const fn of listeners)try{fn(event);}catch{}previous?.mutation?.(event);}
};
if(previous!==hook)globalThis.__LITHE_REACTIVE_DEBUG_HOOK__=hook;
export function onMutation(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function inspectReactiveGraph(){const nodes=[],edges=[];for(const dep of dependencies.values()){nodes.push({id:dep.id,kind:dep.kind||'dependency',name:dep.label||null,subscribers:dep.subscribers.size});for(const observer of dep.subscribers)edges.push({from:dep.id,to:observer.id,kind:'notifies'});}for(const obs of observers.values()){nodes.push({id:obs.id,kind:obs.kind||'effect',name:obs.label||null,dependencies:obs.dependencies.size,owner:obs.owner?.id||null});if(obs.output)edges.push({from:obs.id,to:obs.output.id,kind:'produces'});}return{nodes,edges};}
