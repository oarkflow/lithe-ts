import { effect, isSignal } from '../core/reactive.ts';
import { createScope, onCleanup } from '../core/owner.ts';
import { Fragment, isVNode, h } from './vnode.ts';
import { mount, __mountAny, __setAttribute, __templateRecipe, __resolveMarkerPath } from './dom.ts';
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
// Walks the offline (unrendered, cached — see __templateRecipe in dom.ts)
// template shape in lockstep with the live, already-SSR-rendered DOM to
// locate each content binding's position, instead of relying on any
// SSR-emitted marker: static structure (real elements/text) advances both
// cursors together, recursing into element children; a marker comment
// (<!--l:i-->) hands its live position to setupDynamicRegion — the exact
// mechanism an ordinary {expr} child already uses for hydration — which
// claims however many live nodes that binding's *current* value structurally
// requires (0, 1, or many, via claim()) and returns where it ended, so the
// walk resumes from there for the next sibling. This needs no fixed
// per-binding node width and no SSR-side marker protocol (an earlier version
// of this looked for <!--l:s:N-->/<!--l:e:N--> pairs, but SSR's
// renderCompiledTemplate fully substitutes <!--l:i--> with the rendered
// content — nothing survives for it to find; see renderCompiledTemplate in
// server/ssr.ts).
function claimTemplateContent(liveParent, firstLive, offlineParent, bindings, options) {
    let live = firstLive;
    const offlineChildren = offlineParent.childNodes;
    for (let i = 0; i < offlineChildren.length; i++) {
        const offlineChild = offlineChildren[i];
        if (offlineChild.nodeType === 8) {
            const m = /^l:(\d+)$/.exec(offlineChild.data || '');
            if (m) {
                // renderCompiledTemplate (ssr.ts) inserts an empty <!---->
                // separator around this binding's rendered content whenever
                // it could otherwise coalesce with adjacent text into one
                // Text node — skip it on both sides, same as sibling
                // children already do via skipTextSeparator.
                const result = setupDynamicRegion(liveParent, skipTextSeparator(live), bindings[Number(m[1])], options);
                live = skipTextSeparator(result.next);
                continue;
            }
        }
        if (!live) {
            reportMismatch('Hydration compiled template ran out of live nodes', liveParent, nodeLabel(offlineChild));
            return;
        }
        if (offlineChild.nodeType === 1) {
            if (live.nodeType !== 1 || live.localName !== offlineChild.localName) {
                reportMismatch('Hydration compiled template structure mismatch', live, nodeLabel(offlineChild));
                return;
            }
            if (offlineChild.childNodes.length) claimTemplateContent(live, live.firstChild, offlineChild, bindings, options);
        }
        live = live.nextSibling;
    }
}
function claimCompiledTemplate(parent, node, value, options) {
    if (!node || node.nodeType !== 1) throw mismatch('Hydration compiled template mismatch', node, 'compiled template root');
    // Shared by both the attribute-marker fast path and content-binding
    // hydration below: dom.ts already computes, and caches per unique
    // `html` string, the parsed offline <template> plus each marker's
    // position as a plain child-index path (see __templateRecipe). Paths/
    // structure are relative to the template's root *fragment*, whose first
    // child is this compiled template's root element (`node` here) — only
    // safe to reuse directly when that's the fragment's ONLY top-level node,
    // which the fallbacks below guard for.
    const recipe = __templateRecipe(value.html, true);
    const singleRooted = recipe.template.content.childNodes.length === 1 && recipe.template.content.firstChild?.nodeType === 1;
    if (value.attributes?.length) {
        const resolved = new Set();
        const wire = (element, i) => {
            const marker = `data-lithe-a${i}`;
            if (!element || typeof element.hasAttribute !== 'function' || !element.hasAttribute(marker)) return false;
            element.removeAttribute(marker);
            const binding = value.attributes[i];
            let previous = element.getAttribute(binding[0]);
            const d = effect(() => {
                const next = resolve(binding[1]);
                __setAttribute(element, binding[0], next, previous, options);
                previous = next;
            }, { sync: true });
            onCleanup(d);
            return true;
        };
        if (singleRooted) {
            for (let i = 0; i < value.attributes.length; i++) {
                const path = recipe.attributePaths?.get(i);
                const element = path && __resolveMarkerPath(node, path.slice(1));
                if (wire(element, i)) resolved.add(i);
            }
        }
        // Fall back to the exhaustive scan for any binding the fast path
        // didn't account for (a multi-rooted template, or — should the
        // cached shape ever disagree with this live DOM — a mismatch), so
        // correctness never depends on the single-root assumption holding.
        // Bindings the fast path already wired are skipped here so nothing
        // gets double-applied.
        if (resolved.size !== value.attributes.length) {
            const elements = [node, ...node.querySelectorAll('*')];
            for (const element of elements) {
                for (let i = 0; i < value.attributes.length; i++) {
                    if (resolved.has(i)) continue;
                    if (wire(element, i)) resolved.add(i);
                }
            }
        }
    }
    if (value.bindings?.length) {
        if (singleRooted) {
            claimTemplateContent(node, node.firstChild, recipe.template.content.firstChild, value.bindings, options);
        } else {
            for (let i = 0; i < value.bindings.length; i++) {
                reportMismatch(`Hydration missing compiled binding ${i}`, node, `binding ${i}`);
            }
        }
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
