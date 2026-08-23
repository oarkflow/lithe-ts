const listeners = new Set();
let seq = 0;
let currentContext = null;
function now(){return globalThis.performance?.now?.()??Date.now();}
function randomId(){return globalThis.crypto?.randomUUID?.().replaceAll('-','')||`${Date.now().toString(36)}${(++seq).toString(36)}`;}
export function onTrace(listener){listeners.add(listener);return()=>listeners.delete(listener);}
function emit(event){for(const listener of listeners)try{listener(event);}catch{}}
export function currentTraceContext(){return currentContext;}
export function createTraceContext(input={}){return{traceId:input.traceId||randomId(),spanId:input.spanId||null,baggage:{...(input.baggage||{})}};}
export function withTraceContext(context,fn){const previous=currentContext;currentContext=context;try{return fn();}finally{currentContext=previous;}}
export function traceHeaders(context=currentContext){if(!context?.traceId)return{};return{'x-lithe-trace-id':context.traceId,...(context.spanId?{'x-lithe-parent-span':context.spanId}:{})};}
export function contextFromHeaders(headers){const h=headers instanceof Headers?headers:new Headers(headers||{}),traceId=h.get('x-lithe-trace-id');return traceId?createTraceContext({traceId,spanId:h.get('x-lithe-parent-span')}):null;}
export function trace(name,attributes={},options={}){const parent=options.parent||currentContext,traceId=options.traceId||parent?.traceId||randomId(),id=randomId(),start=now(),context=createTraceContext({traceId,spanId:id,baggage:parent?.baggage});emit({type:'start',id,traceId,parentId:parent?.spanId||null,name,attributes,time:Date.now()});return{id,traceId,context,event(event,attrs={}){emit({type:'event',id,traceId,name,event,attributes:attrs,time:Date.now()});},end(attrs={}){emit({type:'end',id,traceId,name,attributes:attrs,duration:now()-start,time:Date.now()});},fail(error){emit({type:'error',id,traceId,name,error:{name:error.name,message:error.message},duration:now()-start,time:Date.now()});}};}
export async function traced(name,fn,attributes,options){const span=trace(name,attributes,options);try{const result=await fn(span,span.context);span.end();return result;}catch(error){span.fail(error);throw error;}}
