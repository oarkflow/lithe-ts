let active=null,seq=0;const listeners=new Set();
function makeId(){return globalThis.crypto?.randomUUID?.().replaceAll('-','')||`${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2,8)}`;}
export function newCorrelationId(){return makeId();}
export function currentCorrelation(){return active||globalThis.__LITHE_CORRELATION_ID__||null;}
export function withCorrelation(id,fn){const previous=active,globalPrevious=globalThis.__LITHE_CORRELATION_ID__,next=id||previous||makeId();active=next;globalThis.__LITHE_CORRELATION_ID__=next;let value;try{value=fn(next);}catch(error){active=previous;globalThis.__LITHE_CORRELATION_ID__=globalPrevious;throw error;}if(value&&typeof value.then==='function')return value.finally(()=>{if(active===next)active=previous;if(globalThis.__LITHE_CORRELATION_ID__===next)globalThis.__LITHE_CORRELATION_ID__=globalPrevious;});active=previous;globalThis.__LITHE_CORRELATION_ID__=globalPrevious;return value;}
export function correlationHeaders(id=currentCorrelation()){return id?{'x-lithe-trace-id':id}:{};}
export function correlationFromHeaders(headers){const h=headers instanceof Headers?headers:new Headers(headers||{});return h.get('x-lithe-trace-id')||null;}
export function onCorrelation(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function correlationEvent(type,attributes={},id=currentCorrelation()){const event={type,id:id||null,attributes,time:Date.now()};for(const fn of listeners)try{fn(event);}catch{};try{globalThis.__LITHE_DEVTOOLS__?.record?.({type:'trace-correlation',...event});}catch{}return event;}
const previousDispatch=globalThis.__LITHE_CORRELATION_EVENT__;if(previousDispatch!==correlationEvent)globalThis.__LITHE_CORRELATION_EVENT__=(type,attributes,id)=>{try{if(typeof previousDispatch==='function')previousDispatch(type,attributes,id);}catch{}return correlationEvent(type,attributes,id);};
