import { effect, isSignal } from '../core/reactive.ts';
import { createScope, onCleanup } from '../core/owner.ts';
import { Fragment, isVNode, h } from './vnode.ts';
import { mount, __mountAny, __setAttribute } from './dom.ts';
import { isEventProp, installDelegatedEvents } from './events.ts';
let lastHydrationReport = {
    status: 'idle',
    mismatches: [],
    fallback: false,
    strict: false,
    at: 0
};
function nodeLabel(node) {
    if (!node) return 'null';
    if (node.nodeType === 1) return `<${node.localName}>`;
    if (node.nodeType === 3) return '#text';
    if (node.nodeType === 8) return `<!--${String(node.data || '').slice(0, 32)}-->`;
    return `node:${node.nodeType}`;
}
function resetHydrationReport(options = {}) {
    lastHydrationReport = {
        status: 'hydrating',
        mismatches: [],
        fallback: false,
        strict: Boolean(options.strict),
        at: Date.now()
    };
}
function reportMismatch(message, node, expected) {
    const entry = {
        message,
        node: nodeLabel(node),
        expected: expected ?? null,
        at: Date.now()
    };
    lastHydrationReport.mismatches.push(entry);
    try {
        globalThis.__LITHE_DEVTOOLS__?.record?.({
            type: 'hydration:mismatch',
            ...entry
        });
    } catch { }
}
function mismatch(message, node, expected) {
    reportMismatch(message, node, expected);
    return new Error(message);
}
export function getHydrationReport() {
    return {
        ...lastHydrationReport,
        mismatches: [...lastHydrationReport.mismatches]
    };
}
function resolve(v) {
    return isSignal(v) ? v.value : typeof v === 'function' ? v() : v;
}
function primitive(v) {
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint';
}
// SSR inserts an empty `<!---->` comment between two sibling children that
// would otherwise both render as plain text, so the HTML parser can't
// coalesce them into a single Text node (see joinRenderedSiblings in
// ssr.ts) — claim() needs exactly one DOM node per vnode child. Skip that
// marker back out here before claiming the next child in a sequence.
function skipTextSeparator(node) {
    return node && node.nodeType === 8 && node.data === '' ? node.nextSibling : node;
}
function removeBetween(start, end) {
    let n = start.nextSibling;
    while (n && n !== end) {
        const next = n.nextSibling;
        n.remove();
        n = next;
    }
}
function setupDynamicRegion(parent, node, source, options) {
    let first = true,
        start,
        end,
        nextAfter,
        scope = null;
    const dispose = effect(() => {
        const value = resolve(source);
        if (first) {
            start = document.createComment('lithe:hydrate:start');
            parent.insertBefore(start, node);
            const claimed = claim(parent, node, value, options);
            nextAfter = claimed.next;
            end = document.createComment('lithe:hydrate:end');
            parent.insertBefore(end, nextAfter);
            first = false;
            return;
        }
        scope?.dispose();
        scope = null;
        removeBetween(start, end);
        const local = createScope(() => __mountAny(parent, value, end, options));
        scope = local;
    }, {
        sync: true
    });
    onCleanup(() => {
        dispose();
        scope?.dispose();
        start?.remove();
        end?.remove();
    });
    return {
        next: nextAfter,
        nodes: [start, end]
    };
}
function setupProps(node, props, options) {
    for (const [k, val] of Object.entries(props || {})) {
        if (k === 'children' || k === 'key' || k === 'ref') continue;
        if (k.startsWith('bind:')) continue;
        if (isEventProp(k)) {
            __setAttribute(node, k, val, undefined, options);
            continue;
        }
        if (isSignal(val) || typeof val === 'function') {
            let prev;
            const d = effect(() => {
                const next = resolve(val);
                __setAttribute(node, k, next, prev, options);
                prev = next;
            }, {
                sync: true
            });
            onCleanup(d);
        } else __setAttribute(node, k, val, undefined, options);
    }
    if (typeof props?.ref === 'function') {
        props.ref(node);
        onCleanup(() => props.ref(null));
    }
}
function claimCompiledTemplate(parent, node, value, options) {
    if (!node || node.nodeType !== 1) throw mismatch('Hydration compiled template mismatch', node, 'compiled template root');
    const starts = new Map(),
        ends = new Map(),
        walker = document.createTreeWalker(node, 128);
    let c;
    while (c = walker.nextNode()) {
        let m = String(c.data || '').match(/^l:s:(\d+)$/);
        if (m) starts.set(Number(m[1]), c);
        m = String(c.data || '').match(/^l:e:(\d+)$/);
        if (m) ends.set(Number(m[1]), c);
    }
    for (let i = 0; i < (value.bindings || []).length; i++) {
        const start = starts.get(i),
            end = ends.get(i);
        if (!start || !end) {
            reportMismatch(`Hydration missing compiled binding ${i}`, node, `binding ${i}`);
            continue;
        }
        let first = true,
            scope = null;
        const d = effect(() => {
            const current = resolve(value.bindings[i]);
            if (first) {
                first = false;
                return;
            }
            scope?.dispose();
            removeBetween(start, end);
            scope = createScope(() => __mountAny(start.parentNode, current, end, options));
        }, {
            sync: true
        });
        onCleanup(() => {
            d();
            scope?.dispose();
        });
    }
    return {
        next: node.nextSibling,
        nodes: [node]
    };
}
function claim(parent, node, v, options) {
    if (isSignal(v) || typeof v === 'function') return setupDynamicRegion(parent, node, v, options);
    if (v == null || v === false || v === true) return {
        next: node,
        nodes: []
    };
    if (v?.__litheCompiledTemplate) return claimCompiledTemplate(parent, node, v, options);
    if (v?.__litheStaticTemplate) {
        const t = document.createElement('template');
        t.innerHTML = v.html;
        let cur = node,
            nodes = [];
        for (const expected of [...t.content.childNodes]) {
            if (!cur) throw mismatch('Hydration static template mismatch', cur, nodeLabel(expected));
            if (expected.nodeType === 1 && cur.nodeType === 1 && expected.localName !== cur.localName) throw mismatch('Hydration static template tag mismatch', cur, `<${expected.localName}>`);
            nodes.push(cur);
            cur = cur.nextSibling;
        }
        return {
            next: cur,
            nodes
        };
    }
    if (Array.isArray(v)) {
        let cur = node,
            nodes = [];
        for (const x of v) {
            const r = claim(parent, skipTextSeparator(cur), x, options);
            cur = r.next;
            nodes.push(...r.nodes);
        }
        return {
            next: cur,
            nodes
        };
    }
    if (primitive(v)) {
        if (!node || node.nodeType !== 3) throw mismatch('Hydration text mismatch', node, '#text');
        if (node.data !== String(v)) {
            reportMismatch('Hydration text content differed', node, String(v));
            node.data = String(v);
        }
        return {
            next: node.nextSibling,
            nodes: [node]
        };
    }
    if (v?.__litheCompiledElement) {
        if (!node || node.nodeType !== 1 || node.localName !== String(v.type).toLowerCase()) throw mismatch(`Hydration mismatch: ${v.type}`, node, `<${String(v.type).toLowerCase()}>`);
        setupProps(node, v.props, options);
        let child = node.firstChild;
        for (const x of v.children || []) child = claim(node, skipTextSeparator(child), x, options).next;
        while (child) {
            const next = child.nextSibling;
            reportMismatch('Hydration removed extra child', child, null);
            child.remove();
            child = next;
        }
        return {
            next: node.nextSibling,
            nodes: [node]
        };
    }
    if (!isVNode(v)) return claim(parent, node, String(v), options);
    if (v.type === Fragment) {
        let cur = node,
            nodes = [];
        for (const x of v.children) {
            const r = claim(parent, skipTextSeparator(cur), x, options);
            cur = r.next;
            nodes.push(...r.nodes);
        }
        return {
            next: cur,
            nodes
        };
    }
    if (typeof v.type === 'function') {
        if (v.type.__litheClaim) {
            // Mirrors __mountAny's .__litheMount dispatch: For/Index/Portal/
            // Island each need to claim their already-rendered SSR DOM and
            // wire up their real update/relocation/activation behavior,
            // not fall through to invoking the plain component function
            // (which returns CSR-only fallback shapes for Island/Portal, and
            // a bare reactive closure for For/Index that would only ever
            // get generic full-remount-on-change handling downstream).
            return v.type.__litheClaim({
                parent,
                node,
                props: {
                    ...v.props,
                    children: v.children
                },
                children: v.children,
                options,
                claim,
                mountAny: __mountAny
            });
        }
        const scope = createScope(() => v.type({
            ...v.props,
            children: v.children
        }));
        const result = claim(parent, node, scope.value, options);
        onCleanup(scope.dispose);
        return result;
    }
    if (!node || node.nodeType !== 1 || node.localName !== String(v.type).toLowerCase()) throw mismatch(`Hydration mismatch: ${v.type}`, node, `<${String(v.type).toLowerCase()}>`);
    setupProps(node, v.props, options);
    let child = node.firstChild;
    for (const x of v.children) child = claim(node, skipTextSeparator(child), x, options).next;
    while (child) {
        const next = child.nextSibling;
        reportMismatch('Hydration removed extra child', child, null);
        child.remove();
        child = next;
    }
    return {
        next: node.nextSibling,
        nodes: [node]
    };
}
export function hydrate(root, view, options = {}) {
    if (!root) throw new Error('hydrate(root, view) requires a root.');
    resetHydrationReport(options);
    const resolved = typeof view === 'function' && !view.__litheDynamic ? h(view, {}) : view;
    try {
        const scope = createScope(() => {
            if (options.delegateEvents !== false) {
                const d = installDelegatedEvents(root);
                onCleanup(d);
            }
            let result = claim(root, root.firstChild, resolved, options),
                next = result.next;
            while (next) {
                const n = next.nextSibling;
                reportMismatch('Hydration removed extra root node', next, null);
                next.remove();
                next = n;
            }
        });
        lastHydrationReport.status = 'hydrated';
        return () => scope.dispose();
    } catch (error) {
        lastHydrationReport.status = 'fallback';
        lastHydrationReport.fallback = true;
        if (!lastHydrationReport.mismatches.length) reportMismatch(error.message, root, null);
        if (options.onMismatch) options.onMismatch(error, getHydrationReport());
        // Surface to the dev error overlay automatically (installed by the
        // dev server's HMR client) without requiring every app to wire its
        // own onMismatch — a silent full-remount fallback is exactly the
        // kind of regression that's easy to miss without it.
        globalThis.__LITHE_DEV_OVERLAY__?.({
            type: 'Hydration Mismatch',
            message: `${error.message} — fell back to a full client remount.`,
            stack: lastHydrationReport.mismatches.map(m => `${m.message} (expected ${m.expected ?? '?'}, got ${m.node})`).join('\n')
        });
        if (options.strict) throw error;
        return mount(root, resolved, {
            ...options,
            clear: true
        });
    }
}
