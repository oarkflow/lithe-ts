export interface OwnerOptions { name?:string|null; resume?:unknown }
export interface Owner {
  id:number;
  parent:Owner|null;
  cleanups:Array<()=>void>;
  children:Set<Owner>;
  contexts:Map<symbol,unknown>;
  disposed:boolean;
  name:string|null;
  resume:unknown;
}

let currentOwner:Owner|null=null,ownerSeq=0;
function hook(name:string,...args:unknown[]):unknown{try{return globalThis.__LITHE_OWNER_HOOK__?.[name]?.(...args);}catch{return undefined;}}
function createOwner(parent:Owner|null=currentOwner,options:OwnerOptions={}):Owner{const owner:Owner={id:++ownerSeq,parent,cleanups:[],children:new Set<Owner>(),contexts:new Map<symbol,unknown>(),disposed:false,name:options.name||null,resume:options.resume||null};hook('create',owner);return owner;}
export function getOwner():Owner|null{return currentOwner;}
export function withOwner<T>(owner:Owner,fn:()=>T):T{const previous=currentOwner;currentOwner=owner;try{return fn();}finally{currentOwner=previous;}}
export function createScope<T>(fn:(dispose:()=>void)=>T,options:OwnerOptions={}):{value:T;dispose:()=>void;owner:Owner}{const parent=currentOwner,owner=createOwner(parent,options);if(parent)parent.children.add(owner);const dispose=()=>disposeOwner(owner);try{return{value:withOwner(owner,()=>fn(dispose)),dispose,owner};}catch(error){disposeOwner(owner);throw error;}}
export function onMount(fn:()=>void|(()=>void)):void{if(!currentOwner)throw new Error('onMount() requires an active reactive scope.');const owner=currentOwner;queueMicrotask(()=>{if(owner.disposed)return;const cleanup=withOwner(owner,fn);if(typeof cleanup==='function'&&!owner.disposed)owner.cleanups.push(cleanup);});}
export function onCleanup<T extends()=>void>(fn:T):T{if(!currentOwner)throw new Error('onCleanup() requires an active reactive scope.');currentOwner.cleanups.push(fn);return fn;}
export function disposeOwner(owner:Owner|null|undefined):void{if(!owner||owner.disposed)return;owner.disposed=true;for(const child of [...owner.children])disposeOwner(child);owner.children.clear();for(let i=owner.cleanups.length-1;i>=0;i--)try{owner.cleanups[i]();}catch(error){queueMicrotask(()=>{throw error;});}owner.cleanups.length=0;if(owner.parent)owner.parent.children.delete(owner);hook('dispose',owner);}
export function createContext<T>(defaultValue:T,options:{name?:string}={}){const key=Symbol(options.name||'lithe.context');return{key,defaultValue,name:options.name||null,provide<R>(value:T,fn:()=>R):R|Promise<Awaited<R>>{const scope=createScope(()=>{currentOwner!.contexts.set(key,value);hook('context',currentOwner,key,value);return fn();},{name:options.name?`context:${options.name}`:null});const valueOut=scope.value;if(valueOut&&typeof (valueOut as any).then==='function')return (valueOut as any).finally(scope.dispose);scope.dispose();return valueOut;},use():T{let owner=currentOwner;while(owner){if(owner.contexts.has(key))return owner.contexts.get(key) as T;owner=owner.parent;}return defaultValue;}};}
export function __setOwnerSequence(value:number):void{ownerSeq=Math.max(ownerSeq,Number(value)||0);}
