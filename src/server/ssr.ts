import { isSignal } from '../core/reactive.ts';
import { createScope } from '../core/owner.ts';
import { ownerTree } from '../core/owner-resume.ts';
import { Fragment, Text, Comment, isVNode } from '../dom/vnode.ts';
import { escapeHTML, safeJSON } from './security.ts';

const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const BOOL=new Set(['disabled','checked','selected','multiple','required','autofocus','hidden','open','readonly']);
let boundarySeq=0;
function read(value,ctx){if(isSignal(value)){if(ctx?.resumeSignals&&value.__litheName)ctx.resumeSignals[value.__litheName]=value.peek();return value.value;}if(typeof value==='function')return value();return value;}
function eventAttr(name,raw){if(raw?.__litheEventSymbol){const event=name.slice(2).toLowerCase(),capture=raw.captures==null?'':` data-lithe-cap-${escapeHTML(event)}="${escapeHTML(JSON.stringify(raw.captures))}"`;return` data-lithe-on${escapeHTML(event)}="${escapeHTML(`${raw.module}#${raw.exportName}`)}"${capture}`;}return'';}
function attr(name,raw,ctx){
  if(name==='key'||name==='ref'||name==='children'||name.startsWith('bind:')||name==='html')return'';
  if(name.startsWith('on'))return eventAttr(name,raw);
  const value=read(raw,ctx);if(name==='className')name='class';
  if(name==='style'&&value&&typeof value==='object'){const css=Object.entries(value).filter(([,v])=>v!=null).map(([k,v])=>`${k.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}:${typeof v==='number'?`${v}px`:v}`).join(';');return css?` style="${escapeHTML(css)}"`:'';}
  if(name==='class'&&value&&typeof value==='object'){const classes=Array.isArray(value)?value.filter(Boolean).join(' '):Object.entries(value).filter(([,v])=>v).map(([k])=>k).join(' ');return classes?` class="${escapeHTML(classes)}"`:'';}
  if(BOOL.has(name.toLowerCase()))return value?` ${name}`:'';if(value===false||value==null)return'';return` ${name}="${escapeHTML(value)}"`;
}


async function renderCompiledTemplate(value,ctx,renderer){let html=value.html;for(let i=0;i<(value.bindings||[]).length;i++){const binding=value.bindings[i],bound=typeof binding==='function'?binding():binding,rendered=await renderer(bound,ctx);html=html.replace(`<!--l:${i}-->`,rendered);}return html;}
function renderAttrs(props,ctx){let html='',elementId=null;for(const[key,val]of Object.entries(props||{})){if(val?.__litheSignal&&val.__litheName&&!key.startsWith('on')&&key!=='html'&&!key.startsWith('bind:')){elementId||=`e${ctx.elementSeq++}`;const id=ctx.bindingSeq++;ctx.resumeBindings[id]={kind:'attribute',signal:val.__litheName,key,element:elementId};}html+=attr(key,val,ctx);}if(elementId)html+=` data-lithe-e="${escapeHTML(elementId)}"`;return html;}
async function renderCompiledElement(value,ctx,renderer){let html=`<${value.type}${renderAttrs(value.props,ctx)}>`;if(VOID.has(value.type))return html;if(value.props?.html?.__trustedHTML)html+=value.props.html.value;else html+=await renderer(value.children||[],ctx);return html+`</${value.type}>`;}

export function streamBoundary(promise,fallback=''){return{__litheStreamBoundary:true,id:`b${++boundarySeq}`,promise:Promise.resolve(promise),fallback};}

async function render(value,ctx){
  if(isSignal(value)&&value.__litheName){const id=ctx.bindingSeq++;ctx.resumeSignals[value.__litheName]=value.peek();ctx.resumeBindings[id]={kind:'text',signal:value.__litheName};return`<!--l:s:${id}-->${await render(value.value,ctx)}<!--l:e:${id}-->`;}
  value=read(value,ctx);if(value==null||value===false||value===true)return'';
  if(value?.__litheStaticTemplate)return value.html;
  if(value?.__litheCompiledTemplate)return renderCompiledTemplate(value,ctx,render);
  if(value?.__litheCompiledElement)return renderCompiledElement(value,ctx,render);
  if(value?.__litheStreamBoundary)return render(await value.promise,ctx);
  if(value?.__litheList){const items=read(value.each)||[];if(!items.length)return render(value.fallback,ctx);return(await Promise.all(items.map((item,i)=>render(value.renderer(item,{value:i}),ctx)))).join('');}
  if(value?.__lithePortal)return render(value.children,ctx);if(value?.__litheIsland)return render(value.children,ctx);
  if(value instanceof Promise)return render(await value,ctx);if(Array.isArray(value))return(await Promise.all(value.map(x=>render(x,ctx)))).join('');
  if(typeof value==='string'||typeof value==='number'||typeof value==='bigint')return escapeHTML(value);if(!isVNode(value))return escapeHTML(String(value));
  const vnode=value;if(vnode.type===Text)return render(vnode.children[0],ctx);if(vnode.type===Comment)return`<!--${escapeHTML(vnode.children[0]||'')}-->`;if(vnode.type===Fragment)return render(vnode.children,ctx);
  if(typeof vnode.type==='function'){const scope=createScope(()=>vnode.type({...vnode.props,children:vnode.children}),{name:vnode.type.name||null});try{return await render(scope.value,ctx);}finally{ctx.resumeOwners?.push(ownerTree(scope.owner));scope.dispose();}}
  let html=`<${vnode.type}${renderAttrs(vnode.props,ctx)}>`;if(VOID.has(vnode.type))return html;if(vnode.props?.html?.__trustedHTML)html+=vnode.props.html.value;else html+=await render(vnode.children,ctx);return html+`</${vnode.type}>`;
}

async function renderStreaming(value,ctx,tasks){
  if(isSignal(value)&&value.__litheName){const id=ctx.bindingSeq++;ctx.resumeSignals[value.__litheName]=value.peek();ctx.resumeBindings[id]={kind:'text',signal:value.__litheName};return`<!--l:s:${id}-->${await renderStreaming(value.value,ctx,tasks)}<!--l:e:${id}-->`;}
  value=read(value,ctx);if(value==null||value===false||value===true)return'';
  if(value?.__litheStaticTemplate)return value.html;
  if(value?.__litheCompiledTemplate)return renderCompiledTemplate(value,ctx,(v,c)=>renderStreaming(v,c,tasks));
  if(value?.__litheCompiledElement)return renderCompiledElement(value,ctx,(v,c)=>renderStreaming(v,c,tasks));
  if(value?.__litheStreamBoundary){const id=value.id;const fallback=await renderStreaming(value.fallback,ctx,tasks);const task=value.promise.then(v=>renderStreaming(v,ctx,tasks)).then(html=>({id,html}));tasks.add(task);task.finally(()=>tasks.delete(task));return`<span data-lithe-boundary="${escapeHTML(id)}">${fallback}</span>`;}
  if(value?.__litheList){const items=read(value.each)||[];return renderStreaming(items.length?items.map((item,i)=>value.renderer(item,{value:i})):value.fallback,ctx,tasks);}
  if(value?.__lithePortal||value?.__litheIsland)return renderStreaming(value.children,ctx,tasks);
  if(value instanceof Promise)return renderStreaming(streamBoundary(value,''),ctx,tasks);
  if(Array.isArray(value)){let out='';for(const x of value)out+=await renderStreaming(x,ctx,tasks);return out;}
  if(typeof value==='string'||typeof value==='number'||typeof value==='bigint')return escapeHTML(value);if(!isVNode(value))return escapeHTML(String(value));
  const vnode=value;if(vnode.type===Text)return renderStreaming(vnode.children[0],ctx,tasks);if(vnode.type===Comment)return`<!--${escapeHTML(vnode.children[0]||'')}-->`;if(vnode.type===Fragment)return renderStreaming(vnode.children,ctx,tasks);
  if(typeof vnode.type==='function'){const scope=createScope(()=>vnode.type({...vnode.props,children:vnode.children}),{name:vnode.type.name||null});try{return await renderStreaming(scope.value,ctx,tasks);}finally{ctx.resumeOwners?.push(ownerTree(scope.owner));scope.dispose();}}
  let html=`<${vnode.type}${renderAttrs(vnode.props,ctx)}>`;if(VOID.has(vnode.type))return html;if(vnode.props?.html?.__trustedHTML)html+=vnode.props.html.value;else html+=await renderStreaming(vnode.children,ctx,tasks);return html+`</${vnode.type}>`;
}

export async function renderToString(view,options={}){const ctx={...options,resumeSignals:{...(options.resumeSignals||{})},resumeBindings:{},resumeOwners:[],bindingSeq:0,elementSeq:0},body=await render(typeof view==='function'?view():view,ctx);if(options.document===false)return body;const payload=options.state!==undefined?options.state:(options.resume?{signals:ctx.resumeSignals,bindings:ctx.resumeBindings,owners:ctx.resumeOwners,computations:options.computations||[],version:4}:undefined);const state=payload===undefined?'':`<script type="application/json" id="__LITHE_STATE__">${safeJSON(payload)}</script>`;const head=options.head||'',lang=escapeHTML(options.lang||'en'),nonceAttr=options.nonce?` nonce="${escapeHTML(options.nonce)}"`:'';const entry=options.entry?`<script type="module"${nonceAttr} src="${escapeHTML(options.entry)}"></script>`:'';return`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body><div id="app">${body}</div>${state}${entry}</body></html>`;}

export async function* renderToStream(view,options={}){
  const ctx={...options,resumeSignals:{...(options.resumeSignals||{})},resumeBindings:{},resumeOwners:[],bindingSeq:0,elementSeq:0},tasks=new Set();const nonce=options.nonce?` nonce="${escapeHTML(options.nonce)}"`:'';
  if(options.document!==false)yield`<!doctype html><html lang="${escapeHTML(options.lang||'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${options.head||''}</head><body><div id="app">`;
  yield await renderStreaming(typeof view==='function'?view():view,ctx,tasks);
  while(tasks.size){const result=await Promise.race([...tasks]);const payload=safeJSON(result.html);yield`<template data-lithe-replace="${escapeHTML(result.id)}">${result.html}</template><script${nonce}>(()=>{const t=document.currentScript.previousElementSibling,b=document.querySelector('[data-lithe-boundary="${escapeHTML(result.id)}"]');if(b&&t)b.replaceWith(t.content.cloneNode(true));t.remove();document.currentScript.remove()})()</script>`;}
  if(options.document!==false){const payload=options.state!==undefined?options.state:(options.resume?{signals:ctx.resumeSignals,bindings:ctx.resumeBindings,owners:ctx.resumeOwners,computations:options.computations||[],version:4}:undefined);if(payload!==undefined)yield`</div><script type="application/json" id="__LITHE_STATE__">${safeJSON(payload)}</script>`;else yield'</div>';if(options.entry)yield`<script type="module"${nonce} src="${escapeHTML(options.entry)}"></script>`;yield'</body></html>';}
}

export function readHydrationState(id='__LITHE_STATE__'){if(typeof document==='undefined')return undefined;const node=document.getElementById(id);if(!node)return undefined;try{return JSON.parse(node.textContent||'null');}catch{return undefined;}}
