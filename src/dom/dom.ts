import { effect, isSignal } from '../core/reactive.ts';
import { createScope, onCleanup, withOwner } from '../core/owner.ts';
import { Fragment, Text, Comment, h, isVNode } from './vnode.ts';
import { isEventProp, setDirectEvent, setDelegatedEvent, installDelegatedEvents } from './events.ts';
const SVG_NS = 'http://www.w3.org/2000/svg';
const ROOT_MOUNT = Symbol('lithe.root-mount');
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
// A compiled/static template's `html` string is a compile-time constant —
// the same call site produces byte-identical markup on every render (only
// `bindings`' values differ). Re-parsing that HTML into a <template> and
// re-walking the whole clone with a TreeWalker + a regex test per comment
// node — on every single mount of every single row — was one of the three
// dominant costs a CPU profile of a 1,000-row keyed list turned up (see
// benchmarks/browser-methodology.md). Both are pure functions of `html`, so
// they're computed once and cached: the parsed <template> element itself
// (its .content gets cloned, never re-parsed again) plus, for compiled
// templates, each marker's position as a plain array of child-node indices
// from the fragment root — resolving a marker on a fresh clone is then a
// handful of array index lookups instead of a full-tree comment walk.
// Cached per-document (not in one flat map) because more than one
// `document` can be alive in the same process during tests (each test's
// happy-dom window has its own): a template's parsed content belongs to the
// document that parsed it, and cloning across documents is not something
// every DOM implementation tolerates.
const templateRecipeCache = new WeakMap<any, Map<string, {
    template: any;
    markerPaths: Map<number, number[]> | null;
}>>();
function templateRecipe(html: string, withMarkers: boolean) {
    let perDoc = templateRecipeCache.get(document);
    if (!perDoc) {
        perDoc = new Map();
        templateRecipeCache.set(document, perDoc);
    }
    let recipe = perDoc.get(html);
    if (recipe) return recipe;
    const template = document.createElement('template');
    template.innerHTML = html;
    let markerPaths: Map<number, number[]> | null = null;
    if (withMarkers) {
        markerPaths = new Map();
        const walk = (node: any, path: number[]) => {
            const children = node.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === 8) {
                    const m = /^l:(\d+)$/.exec(child.data || '');
                    if (m) markerPaths!.set(Number(m[1]), [...path, i]);
                } else if (child.nodeType === 1 && child.childNodes.length) {
                    walk(child, [...path, i]);
                }
            }
        };
        walk(template.content, []);
    }
    recipe = {
        template,
        markerPaths
    };
    perDoc.set(html, recipe);
    return recipe;
}
function resolveMarkerPath(fragment: any, path: number[]) {
    let node = fragment;
    for (let i = 0; i < path.length; i++) {
        node = node?.childNodes[path[i]];
        if (!node) return null;
    }
    return node;
}
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
    if (isSignal(v)) return effect(() => apply((v as any).value), {
        sync: true
    });
    if (typeof v === 'function') return effect(() => apply(v()), {
        sync: true
    });
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
                k.startsWith('--') ? el.style.removeProperty(k) : el.style[k] = '';
            }
        }
    }
    for (const k in value) {
        const v = value[k];
        if (v == null) {
            k.startsWith('--') ? el.style.removeProperty(k) : el.style[k] = '';
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
    const classValue = Array.isArray(value) ? value.filter(Boolean).join(' ') : value && typeof value === 'object' ? Object.entries(value).filter(([, v]) => v).map(([k]) => k).join(' ') : '';
    el.className = classValue;
    el.setAttribute?.('class', classValue);
}
function safeURL(value: any, key: string) {
    const text = String(value).trim();
    if (!URL_ATTRIBUTES.has(key.toLowerCase()) || !text) return text;
    try {
        const protocol = new URL(text, typeof location !== 'undefined' ? location.href : 'http://localhost/').protocol;
        if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:' || protocol === 'blob:' || key.toLowerCase() === 'src' && protocol === 'data:') return text;
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
        if (value?.__trustedHTML) el.innerHTML = value.value; else throw new Error('Raw HTML requires trustedHTML(value).');
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
        if (key === 'value') {
            const nextStr = value == null ? '' : String(value);
            if (el.value !== nextStr) {
                const isFocused = typeof document !== 'undefined' && document.activeElement === el;
                if (isFocused && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    el.value = nextStr;
                    try {
                        el.setSelectionRange?.(start, end);
                    } catch { }
                } else {
                    el.value = nextStr;
                }
            }
            if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
            return;
        }
        if (key === 'checked') {
            const nextBool = Boolean(value);
            if (el.checked !== nextBool) el.checked = nextBool;
            if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
            return;
        }
        const next = value ?? '';
        if (el[key] !== next) el[key] = next;
        if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
        return;
    }
    const safe = safeURL(value, attribute);
    value == null || value === false || URL_ATTRIBUTES.has(attribute.toLowerCase()) && !safe ? el.removeAttribute(attribute) : el.setAttribute(attribute, URL_ATTRIBUTES.has(attribute.toLowerCase()) ? safe : String(value));
    if (globalThis.__LITHE_DEVTOOLS__) report(el, key, value);
}
function setupBinding(el: any, key: string, target: any) {
    const prop = key.slice(5);
    if (!target?.__litheSignal || Object.getOwnPropertyDescriptor(target, 'value')?.set === undefined) {
        throw new Error(`bind:${prop} requires a writable signal.`);
    }
    const dispose = effect(() => {
        const next = target.value;
        if (prop === 'value') {
            const nextStr = next == null ? '' : String(next);
            if (el.value !== nextStr) {
                const isFocused = typeof document !== 'undefined' && document.activeElement === el;
                if (isFocused && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    el.value = nextStr;
                    try {
                        el.setSelectionRange?.(start, end);
                    } catch { }
                } else {
                    el.value = nextStr;
                }
            }
            return;
        }
        if (prop === 'checked') {
            const nextBool = Boolean(next);
            if (el.checked !== nextBool) el.checked = nextBool;
            return;
        }
        if (el[prop] !== next) el[prop] = next ?? '';
    }, {
        sync: true
    });
    const event = prop === 'value' ? 'input' : 'change';
    const listener = () => target.value = el[prop];
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
        // `scope` backs the general case (a vnode/array/component result) and
        // is the expensive path — a whole owner scope per dynamic child.
        // `textNode` backs the overwhelmingly common case (a text
        // interpolation, or a conditional collapsing to null/boolean) and
        // needs no scope at all: nothing inside a bare string/number/null has
        // any cleanup to own. Skipping scope creation for that case is what
        // keeps something like `<For>` rows with a couple of `{() =>
        // item.label}`-style bindings from paying one owner-scope allocation
        // per binding per row — previously *every* dynamic child paid it,
        // even ones that could only ever render text or nothing.
        let scope: any = null;
        let textNode: any = null;
        let alive = true;
        const dispose = effect(() => {
            if (!alive || !end.parentNode) return;
            const value = resolveValue(child);
            const container = end.parentNode;
            if (value == null || value === false || value === true) {
                if (!scope && !textNode && nodes.length === 0) return;
                scope?.dispose();
                scope = null;
                textNode = null;
                for (let i = 0; i < nodes.length; i++) nodes[i].remove();
                nodes = [];
                return;
            }
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
                const text = String(value);
                if (textNode) {
                    if (textNode.data !== text) textNode.data = text;
                    return;
                }
                scope?.dispose();
                scope = null;
                for (let i = 0; i < nodes.length; i++) nodes[i].remove();
                textNode = document.createTextNode(text);
                nodes = [textNode];
                if (container) container.insertBefore(textNode, end); else {
                    textNode = null;
                    nodes = [];
                }
                return;
            }
            textNode = null;
            scope?.dispose();
            for (let i = 0; i < nodes.length; i++) nodes[i].remove();
            const frag = document.createDocumentFragment();
            scope = createScope(() => __mountAny(frag, value, null, options));
            nodes = scope.value.nodes;
            if (container) container.insertBefore(frag, end); else {
                scope.dispose();
                scope = null;
                nodes = [];
            }
        }, {
            sync: true
        });
        onCleanup(() => {
            alive = false;
            dispose();
            scope?.dispose();
            start.remove();
            end.remove();
            for (let i = 0; i < nodes.length; i++) nodes[i].remove();
        });
        return {
            nodes: [start, ...nodes, end]
        };
    }
    return __mountAny(parent, child, before, options);
}
function mountNativeElement(parent: any, type: string, props: any = {}, children: any[] = [], before: any, options: any = {}) {
    const svg = options.svg || type === 'svg';
    const el = svg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
    if (props) {
        const childOptions = svg ? {
            ...options,
            svg: true
        } : options;
        // Reactive (signal/function) props share one effect instead of each
        // getting its own, so an element with several of them (class +
        // style + disabled + an aria-* flag together is a common
        // combination) pays for one Observer instead of one per prop. The
        // overwhelmingly common case — zero or exactly one reactive prop —
        // must not pay anything extra for this: `singleKey`/`singleSource`
        // hold that one prop directly, with no array allocated at all,
        // until (rarely) a *second* reactive prop shows up and the two get
        // promoted into `reactiveKeys`/`reactiveSources` together. An
        // earlier version of this always allocated both arrays up front
        // "just in case" — cheap-looking, but real per-row overhead at
        // list-benchmark scale for the single-reactive-prop element shape
        // that's actually the common case.
        let singleKey: string | null = null,
            singleSource: any = null,
            reactiveKeys: string[] | null = null,
            reactiveSources: any[] | null = null;
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
            if (isSignal(source) || typeof source === 'function') {
                if (reactiveKeys) {
                    reactiveKeys.push(key);
                    reactiveSources!.push(source);
                } else if (singleKey === null) {
                    singleKey = key;
                    singleSource = source;
                } else {
                    reactiveKeys = [singleKey, key];
                    reactiveSources = [singleSource, source];
                    singleKey = null;
                    singleSource = null;
                }
            } else {
                // Not actually reactive (e.g. a plain style object) — apply
                // once, same as dynamicEffect's own non-signal/function
                // branch did.
                __setAttribute(el, key, source, undefined, childOptions);
            }
        }
        if (reactiveKeys) {
            const previousValues = new Array(reactiveKeys.length);
            const dispose = effect(() => {
                for (let i = 0; i < reactiveKeys!.length; i++) {
                    // Single-level unwrap only, matching dynamicEffect's own
                    // behavior exactly (not resolveValue's deeper
                    // signal-of-signal/function-of-function chasing) so an
                    // element with one reactive prop behaves identically
                    // whether or not a sibling prop is also reactive.
                    const source = reactiveSources![i];
                    const next = isSignal(source) ? source.value : source();
                    __setAttribute(el, reactiveKeys![i], next, previousValues[i], childOptions);
                    previousValues[i] = next;
                }
            }, {
                sync: true
            });
            onCleanup(dispose);
        } else if (singleKey !== null) {
            let previous: any;
            const dispose = dynamicEffect(singleSource, next => {
                __setAttribute(el, singleKey!, next, previous, childOptions);
                previous = next;
            });
            if (dispose) onCleanup(dispose);
        }
    }
    if (children && children.length > 0) {
        if (children.length === 1 && typeof children[0] === 'string') {
            el.textContent = children[0];
        } else {
            const childOptions = svg ? {
                ...options,
                svg: true
            } : options;
            for (let i = 0; i < children.length; i++) {
                __mountChild(el, children[i], null, childOptions);
            }
        }
    }
    if (before) parent.insertBefore(el, before); else parent.appendChild(el);
    if (typeof props?.ref === 'function') {
        props.ref(el);
        onCleanup(() => props.ref(null));
    }
    return {
        nodes: [el]
    };
}
export function __mountAny(parent: any, value: any, before: any, options: any = {}): {
    nodes: any[];
} {
    if (value == null || value === false || value === true) return {
        nodes: []
    };
    if (value.__litheCompiledElement) {
        return mountNativeElement(parent, value.type, value.props, value.children, before, options);
    }
    if (value.__litheCompiledTemplate) {
        const recipe = templateRecipe(value.html, true);
        const frag = recipe.template.content.cloneNode(true);
        const nodes = Array.from(frag.childNodes);
        for (let i = 0; i < value.bindings.length; i++) {
            const path = recipe.markerPaths!.get(i);
            const marker = path && resolveMarkerPath(frag, path);
            if (!marker) continue;
            __mountChild(marker.parentNode, value.bindings[i], marker, options);
            marker.remove();
        }
        parent.insertBefore(frag, before);
        return {
            nodes
        };
    }
    if (value.__litheStaticTemplate) {
        const recipe = templateRecipe(value.html, false);
        const frag = recipe.template.content.cloneNode(true);
        const nodes = Array.from(frag.childNodes);
        parent.insertBefore(frag, before);
        return {
            nodes
        };
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
        return {
            nodes
        };
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
        const node = document.createTextNode(String(value));
        parent.insertBefore(node, before);
        return {
            nodes: [node]
        };
    }
    if (!isVNode(value)) {
        const node = document.createTextNode(String(value));
        parent.insertBefore(node, before);
        return {
            nodes: [node]
        };
    }
    const vnode = value;
    if (vnode.type === Text) return __mountAny(parent, vnode.children[0], before, options);
    if (vnode.type === Comment) {
        const n = document.createComment(String(vnode.children[0] ?? ''));
        parent.insertBefore(n, before);
        return {
            nodes: [n]
        };
    }
    if (vnode.type === Fragment) {
        const nodes: any[] = [];
        for (let i = 0; i < vnode.children.length; i++) {
            const res = __mountChild(parent, vnode.children[i], before, options);
            if (res && res.nodes) {
                for (let j = 0; j < res.nodes.length; j++) nodes.push(res.nodes[j]);
            }
        }
        return {
            nodes
        };
    }
    if (typeof vnode.type === 'function') {
        if ((vnode.type as any).__litheMount) {
            return (vnode.type as any).__litheMount({
                parent,
                before,
                props: {
                    ...vnode.props,
                    children: vnode.children
                },
                children: vnode.children,
                options,
                mountAny: __mountAny,
                mountChild: __mountChild
            });
        }
        const scope = createScope(() => (vnode.type as any)({
            ...vnode.props,
            children: vnode.children
        }));
        const mounted = withOwner(scope.owner, () => __mountChild(parent, scope.value, before, options));
        onCleanup(scope.dispose);
        return mounted;
    }
    return mountNativeElement(parent, vnode.type as string, vnode.props || {}, vnode.children, before, options);
}
export function mount(root: any, view: any, options: any = {}) {
    if (!root) throw new Error('mount(root, view) requires a root element.');
    root[ROOT_MOUNT]?.();
    if (options.clear !== false) root.textContent = '';
    const scope = createScope(() => {
        if (options.delegateEvents !== false) {
            const d = installDelegatedEvents(root);
            onCleanup(d);
        }
        return __mountChild(root, typeof view === 'function' && !(view as any).__litheDynamic ? h(view, {}) : view, null, options);
    });
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        scope.dispose();
        if (options.clearOnDispose !== false) root.textContent = '';
        if (root[ROOT_MOUNT] === dispose) delete root[ROOT_MOUNT];
    };
    root[ROOT_MOUNT] = dispose;
    return dispose;
}
export function createRoot(root: any, options: any = {}) {
    let dispose: (() => void) | null = null;
    return {
        render(view: any) {
            dispose?.();
            dispose = mount(root, view, {
                ...options,
                clear: true
            });
        },
        unmount() {
            dispose?.();
            dispose = null;
        }
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
    return Object.freeze({
        __trustedHTML: true,
        value: safe
    });
}
export function staticTemplate(html: string) {
    return Object.freeze({
        __litheStaticTemplate: true,
        html: String(html)
    });
}
export function compiledTemplate(html: string, bindings: any[] = []) {
    return Object.freeze({
        __litheCompiledTemplate: true,
        html: String(html),
        bindings
    });
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
