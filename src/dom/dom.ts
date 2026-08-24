import { effect, isSignal } from '../core/reactive.ts';
import { createScope, onCleanup, withOwner } from '../core/owner.ts';
import { Fragment, Text, Comment, h, isVNode } from './vnode.ts';
import { isEventProp, setDirectEvent, setDelegatedEvent, installDelegatedEvents } from './events.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOOLEAN_ATTRS = new Set(['disabled', 'checked', 'selected', 'multiple', 'required', 'autofocus', 'hidden', 'open', 'readonly']);
const PROPERTY_KEYS = new Set(['value', 'checked', 'selected', 'muted', 'currentTime', 'volume', 'indeterminate']);
const ATTRIBUTE_NAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  autoPlay: 'autoplay',
  colSpan: 'colspan',
  rowSpan: 'rowspan',
  maxLength: 'maxlength',
  minLength: 'minlength',
  readOnly: 'readonly',
  tabIndex: 'tabindex'
};
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'cite', 'poster', 'xlink:href']);
let trustedTypesPolicy: any = null;

function resolveValue(v: any) {
  let value = v;
  let depth = 0;
  while ((isSignal(value) || typeof value === 'function') && depth < 20) {
    depth++;
    value = isSignal(value) ? (value as any).value : value();
  }
  return value;
}

function dynamicEffect(v: any, apply: (val: any) => void) {
  if (isSignal(v)) return effect(() => apply((v as any).value), { sync: true });
  if (typeof v === 'function') return effect(() => apply(v()), { sync: true });
  apply(v);
  return null;
}

function setStyle(el: any, value: any, previous: any = {}) {
  if (typeof value === 'string') {
    el.style.cssText = value;
    return value;
  }
  value ||= {};
  if (previous && typeof previous === 'object') {
    for (const k in previous) {
      if (!(k in value)) {
        k.startsWith('--') ? el.style.removeProperty(k) : (el.style[k] = '');
      }
    }
  }
  for (const k in value) {
    const v = value[k];
    if (v == null) {
      k.startsWith('--') ? el.style.removeProperty(k) : (el.style[k] = '');
    } else if (k.startsWith('--')) {
      el.style.setProperty(k, String(v));
    } else {
      el.style[k] = typeof v === 'number' && !/^(opacity|zIndex|flex|fontWeight|lineHeight)$/.test(k) ? `${v}px` : String(v);
    }
  }
  return value;
}

function setClass(el: any, value: any) {
  if (typeof value === 'string') {
    el.className = value;
    el.setAttribute?.('class', value);
    return;
  }
  const classValue = Array.isArray(value)
    ? value.filter(Boolean).join(' ')
    : value && typeof value === 'object'
    ? Object.entries(value).filter(([, v]) => v).map(([k]) => k).join(' ')
    : '';
  el.className = classValue;
  el.setAttribute?.('class', classValue);
}

function safeURL(value: any, key: string) {
  const text = String(value).trim();
  if (!URL_ATTRIBUTES.has(key.toLowerCase()) || !text) return text;
  try {
    const protocol = new URL(text, typeof location !== 'undefined' ? location.href : 'http://localhost/').protocol;
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:' || protocol === 'blob:' || (key.toLowerCase() === 'src' && protocol === 'data:')) return text;
    return '';
  } catch {
    return '';
  }
}

function report(el: any, key: string, value: any) {
  if (globalThis.__LITHE_DEVTOOLS__) {
    try {
      globalThis.__LITHE_DEVTOOLS__.record?.({
        type: 'dom',
        element: el,
        key,
        value,
        traceId: globalThis.__LITHE_CORRELATION_ID__ || null,
        cause: globalThis.__LITHE_REACTIVE_CAUSE__ || null,
        at: Date.now()
      });
    } catch { }
  }
}

export function __setAttribute(el: any, key: string, value: any, previous?: any, options: any = {}) {
  if (key === 'key' || key === 'ref' || key === 'children') return;
  if (key === 'class' || key === 'className') {
    setClass(el, value);
    if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
    return;
  }
  if (key === 'style') {
    setStyle(el, value, previous);
    if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
    return;
  }
  if (key === 'html') {
    if (value?.__trustedHTML) el.innerHTML = value.value;
    else throw new Error('Raw HTML requires trustedHTML(value).');
    return;
  }
  if (key.startsWith('bind:')) return;
  if (isEventProp(key)) {
    if (value?.__litheEventSymbol) {
      let fn: any;
      const lazy = async function (this: any, event: any) {
        if (!fn) {
          const mod = await import(value.module);
          fn = mod[value.exportName];
          if (typeof fn !== 'function') throw new TypeError(`Event symbol ${value.exportName} is not callable`);
        }
        return fn.call(this, event, value.captures ?? null);
      };
      options.delegateEvents !== false ? setDelegatedEvent(el, key, lazy) : setDirectEvent(el, key, lazy, previous);
    } else {
      options.delegateEvents !== false ? setDelegatedEvent(el, key, value) : setDirectEvent(el, key, value, previous);
    }
    return;
  }
  const attribute = ATTRIBUTE_NAMES[key] || key;
  if (BOOLEAN_ATTRS.has(key.toLowerCase())) {
    value ? el.setAttribute(attribute, '') : el.removeAttribute(attribute);
    if (key in el) el[key] = Boolean(value);
    if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
    return;
  }
  if (PROPERTY_KEYS.has(key) && key in el) {
    const next = value ?? '';
    if (el[key] !== next) el[key] = next;
    if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
    return;
  }
  const safe = safeURL(value, attribute);
  value == null || value === false || (URL_ATTRIBUTES.has(attribute.toLowerCase()) && !safe)
    ? el.removeAttribute(attribute)
    : el.setAttribute(attribute, URL_ATTRIBUTES.has(attribute.toLowerCase()) ? safe : String(value));
  if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
}

function setupBinding(el: any, key: string, target: any) {
  const prop = key.slice(5);
  if (!target?.__litheSignal || Object.getOwnPropertyDescriptor(target, 'value')?.set === undefined) {
    throw new Error(`bind:${prop} requires a writable signal.`);
  }
  const dispose = effect(() => {
    const next = target.value;
    if (el[prop] !== next) el[prop] = next ?? '';
  }, { sync: true });
  const event = prop === 'value' ? 'input' : 'change';
  const listener = () => (target.value = el[prop]);
  el.addEventListener(event, listener);
  onCleanup(() => {
    dispose();
    el.removeEventListener(event, listener);
  });
}

export function __mountChild(parent: any, child: any, before: any, options: any) {
  if (isSignal(child) || typeof child === 'function') {
    const start = document.createComment('lithe:start');
    const end = document.createComment('lithe:end');
    parent.insertBefore(start, before);
    parent.insertBefore(end, before);
    let nodes: any[] = [];
    let scope: any = null;
    let alive = true;
    const dispose = effect(() => {
      if (!alive || !end.parentNode) return;
      const value = resolveValue(child);
      if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') && nodes.length === 1 && nodes[0].nodeType === 3) {
        const text = String(value);
        if (nodes[0].data !== text) nodes[0].data = text;
        return;
      }
      scope?.dispose();
      for (let i = 0; i < nodes.length; i++) nodes[i].remove();
      const frag = document.createDocumentFragment();
      scope = createScope(() => __mountAny(frag, value, null, options));
      nodes = scope.value.nodes;
      const container = end.parentNode;
      if (container) container.insertBefore(frag, end);
      else {
        scope.dispose();
        scope = null;
        nodes = [];
      }
    }, { sync: true });
    onCleanup(() => {
      alive = false;
      dispose();
      scope?.dispose();
      start.remove();
      end.remove();
      for (let i = 0; i < nodes.length; i++) nodes[i].remove();
    });
    return { nodes: [start, ...nodes, end] };
  }
  return __mountAny(parent, child, before, options);
}

function mountNativeElement(parent: any, type: string, props: any = {}, children: any[] = [], before: any, options: any = {}) {
  const svg = options.svg || type === 'svg';
  const el = svg ? document.createElementNS(SVG_NS, type) : document.createElement(type);

  if (props) {
    const childOptions = svg ? { ...options, svg: true } : options;
    for (const key in props) {
      if (key === 'ref' || key === 'children' || key === 'key') continue;
      const source = props[key];
      if (typeof source === 'string' || typeof source === 'number' || typeof source === 'boolean') {
        if (key === 'className' || key === 'class') {
          el.className = source ? String(source) : '';
        } else {
          __setAttribute(el, key, source, undefined, childOptions);
        }
        continue;
      }
      if (key.startsWith('bind:')) {
        setupBinding(el, key, source);
        continue;
      }
      if (isEventProp(key)) {
        __setAttribute(el, key, source, undefined, childOptions);
        continue;
      }
      let previous: any;
      const dispose = dynamicEffect(source, (next) => {
        __setAttribute(el, key, next, previous, childOptions);
        previous = next;
      });
      if (dispose) onCleanup(dispose);
    }
  }

  if (children && children.length > 0) {
    if (children.length === 1 && typeof children[0] === 'string') {
      el.textContent = children[0];
    } else {
      const childOptions = svg ? { ...options, svg: true } : options;
      for (let i = 0; i < children.length; i++) {
        __mountChild(el, children[i], null, childOptions);
      }
    }
  }

  if (before) parent.insertBefore(el, before);
  else parent.appendChild(el);

  if (typeof props?.ref === 'function') {
    props.ref(el);
    onCleanup(() => props.ref(null));
  }
  return { nodes: [el] };
}

export function __mountAny(parent: any, value: any, before: any, options: any = {}): { nodes: any[] } {
  if (value == null || value === false || value === true) return { nodes: [] };
  if (value.__litheCompiledElement) {
    return mountNativeElement(parent, value.type, value.props, value.children, before, options);
  }
  if (value.__litheCompiledTemplate) {
    const t = document.createElement('template');
    t.innerHTML = value.html;
    const frag = t.content.cloneNode(true);
    const nodes = Array.from(frag.childNodes);
    const markers = new Map();
    const walker = document.createTreeWalker(frag, 128);
    let n: any;
    while ((n = walker.nextNode())) {
      const m = String(n.data || '').match(/^l:(\d+)$/);
      if (m) markers.set(Number(m[1]), n);
    }
    for (let i = 0; i < value.bindings.length; i++) {
      const marker = markers.get(i);
      if (!marker) continue;
      __mountChild(marker.parentNode, value.bindings[i], marker, options);
      marker.remove();
    }
    parent.insertBefore(frag, before);
    return { nodes };
  }
  if (value.__litheStaticTemplate) {
    const t = document.createElement('template');
    t.innerHTML = value.html;
    const frag = t.content.cloneNode(true);
    const nodes = Array.from(frag.childNodes);
    parent.insertBefore(frag, before);
    return { nodes };
  }
  if (Array.isArray(value)) {
    const nodes: any[] = [];
    const len = value.length;
    for (let i = 0; i < len; i++) {
      const res = __mountChild(parent, value[i], before, options);
      if (res && res.nodes) {
        for (let j = 0; j < res.nodes.length; j++) {
          nodes.push(res.nodes[j]);
        }
      }
    }
    return { nodes };
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    const node = document.createTextNode(String(value));
    parent.insertBefore(node, before);
    return { nodes: [node] };
  }
  if (!isVNode(value)) {
    const node = document.createTextNode(String(value));
    parent.insertBefore(node, before);
    return { nodes: [node] };
  }
  const vnode = value;
  if (vnode.type === Text) return __mountAny(parent, vnode.children[0], before, options);
  if (vnode.type === Comment) {
    const n = document.createComment(String(vnode.children[0] ?? ''));
    parent.insertBefore(n, before);
    return { nodes: [n] };
  }
  if (vnode.type === Fragment) {
    const nodes: any[] = [];
    for (let i = 0; i < vnode.children.length; i++) {
      const res = __mountChild(parent, vnode.children[i], before, options);
      if (res && res.nodes) {
        for (let j = 0; j < res.nodes.length; j++) nodes.push(res.nodes[j]);
      }
    }
    return { nodes };
  }
  if (typeof vnode.type === 'function') {
    if ((vnode.type as any).__litheMount) {
      return (vnode.type as any).__litheMount({
        parent,
        before,
        props: { ...vnode.props, children: vnode.children },
        children: vnode.children,
        options,
        mountAny: __mountAny,
        mountChild: __mountChild
      });
    }
    const scope = createScope(() => (vnode.type as any)({ ...vnode.props, children: vnode.children }));
    const mounted = withOwner(scope.owner, () => __mountChild(parent, scope.value, before, options));
    onCleanup(scope.dispose);
    return mounted;
  }
  return mountNativeElement(parent, vnode.type as string, vnode.props || {}, vnode.children, before, options);
}

export function mount(root: any, view: any, options: any = {}) {
  if (!root) throw new Error('mount(root, view) requires a root element.');
  if (options.clear !== false) root.textContent = '';
  const scope = createScope(() => {
    if (options.delegateEvents !== false) {
      const d = installDelegatedEvents(root);
      onCleanup(d);
    }
    return __mountChild(root, typeof view === 'function' && !(view as any).__litheDynamic ? h(view, {}) : view, null, options);
  });
  return () => {
    scope.dispose();
    if (options.clearOnDispose !== false) root.textContent = '';
  };
}

export function dynamic(fn: any) {
  fn.__litheDynamic = true;
  return fn;
}

export function configureTrustedTypes(name = 'lithe', rules: any = {}) {
  if (typeof trustedTypes === 'undefined') return null;
  trustedTypesPolicy ||= (trustedTypes as any).createPolicy(name, {
    createHTML: rules.createHTML || ((v: any) => v),
    createScriptURL: rules.createScriptURL || ((v: any) => v)
  });
  return trustedTypesPolicy;
}

export function trustedHTML(value: any) {
  const raw = String(value);
  const safe = trustedTypesPolicy?.createHTML ? trustedTypesPolicy.createHTML(raw) : raw;
  return Object.freeze({ __trustedHTML: true, value: safe });
}

export function staticTemplate(html: string) {
  return Object.freeze({ __litheStaticTemplate: true, html: String(html) });
}

export function compiledTemplate(html: string, bindings: any[] = []) {
  return Object.freeze({ __litheCompiledTemplate: true, html: String(html), bindings });
}

export function compiledElement(type: string, props: any = null, children: any = []) {
  return Object.freeze({
    __litheCompiledElement: true,
    type,
    props: props || {},
    children: Array.isArray(children) ? children : [children]
  });
}

export function createElement(type: any, props: any, ...children: any[]) {
  return h(type, props, ...children);
}
