import { signal } from '../core/reactive.ts';
import { h } from '../dom/vnode.ts';
import { mount } from '../dom/dom.ts';

export function defineElement(name, Component, options = {}) {
  if (typeof customElements === 'undefined') return null;
  if (customElements.get(name)) return customElements.get(name);
  const observed=options.observedAttributes || [];
  class LitheElement extends HTMLElement {
    static get observedAttributes(){ return observed; }
    constructor(){
      super(); this.__signals={}; for(const attr of observed)this.__signals[attr]=signal(this.getAttribute(attr)); this.__dispose=null;
      this.__root=options.shadow===false?this:this.attachShadow({mode:options.shadowMode||'open'});
    }
    connectedCallback(){
      const props={element:this}; for(const attr of observed)Object.defineProperty(props,attr,{enumerable:true,get:()=>this.__signals[attr].value});
      this.__dispose=mount(this.__root,h(Component,props),{clear:true,delegateEvents:false}); options.connected?.(this);
    }
    disconnectedCallback(){ this.__dispose?.(); this.__dispose=null; options.disconnected?.(this); }
    attributeChangedCallback(name,oldValue,newValue){ if(oldValue!==newValue&&this.__signals[name])this.__signals[name].value=newValue; }
  }
  customElements.define(name,LitheElement); return LitheElement;
}

export function foreign(mountForeign) {
  return function ForeignComponent(props) {
    let host;
    queueMicrotask(()=>{ if(host) host.__foreignDispose=mountForeign(host,props) || null; });
    return h('div',{ref:(el)=>{ if(!el&&host?.__foreignDispose)host.__foreignDispose(); host=el; }});
  };
}
