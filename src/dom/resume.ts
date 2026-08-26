import { installSignalSnapshot, serializeSignals, getNamedSignal, serializeOwners, restoreOwners, serializeComputations, resumeComputations } from '../core/reactive-resume.ts';
const installedByRoot = new WeakMap();
function comments(root) {
    const doc = root.ownerDocument || root;
    if (!doc?.createTreeWalker) return new Map();
    const walker = doc.createTreeWalker(root, 128),
        starts = new Map(),
        ends = new Map();
    let node;
    while (node = walker.nextNode()) {
        const m = String(node.data || '').match(/^l:([se]):(.+)$/);
        if (!m) continue;
        (m[1] === 's' ? starts : ends).set(m[2], node);
    }
    const out = new Map();
    for (const [id, start] of starts) if (ends.has(id)) out.set(id, {
        start,
        end: ends.get(id)
    });
    return out;
}
function bindText(region, signal) {
    let node = region.start.nextSibling;
    if (node === region.end) {
        node = (region.start.ownerDocument || document).createTextNode('');
        region.end.parentNode.insertBefore(node, region.end);
    }
    const update = value => {
        let first = region.start.nextSibling;
        while (first && first !== region.end) {
            const next = first.nextSibling;
            if (first !== node) first.remove();
            first = next;
        }
        node.data = value == null ? '' : String(value);
        if (node.parentNode !== region.end.parentNode) region.end.parentNode.insertBefore(node, region.end);
    };
    update(signal.peek?.() ?? signal.value);
    return signal.subscribe(update, {
        sync: true
    });
}
function applyAttribute(el, key, value) {
    if (key === 'className') key = 'class';
    if (key === 'value' || key === 'checked' || key === 'selected') {
        try {
            el[key] = value ?? (key === 'value' ? '' : false);
        } catch { }
    }
    if (value == null || value === false) el.removeAttribute?.(key); else if (value === true) el.setAttribute?.(key, ''); else if (key !== 'value' && key !== 'checked' && key !== 'selected') el.setAttribute?.(key, String(value));
}
function bindAttribute(el, binding, signal) {
    const update = value => applyAttribute(el, binding.key, value);
    update(signal.peek?.() ?? signal.value);
    return signal.subscribe(update, {
        sync: true
    });
}
function resumeBindings(root, state, disposers) {
    const graph = state?.bindings || {},
        regions = comments(root),
        waiters = globalThis.__LITHE_RESUME_SIGNAL_WAITERS__ ||= new Map();
    for (const [id, binding] of Object.entries(graph)) {
        if (!binding?.signal) continue;
        const region = binding.kind === 'text' ? regions.get(String(id)) : null,
            el = binding.kind === 'attribute' ? root.querySelector?.(`[data-lithe-e="${String(binding.element)}"]`) : null;
        if (!region && !el) continue;
        const attach = sig => disposers.push(binding.kind === 'text' ? bindText(region, sig) : bindAttribute(el, binding, sig)),
            existing = getNamedSignal(binding.signal);
        if (existing) attach(existing); else {
            let set = waiters.get(binding.signal);
            if (!set) waiters.set(binding.signal, set = new Set());
            set.add(attach);
            disposers.push(() => {
                set.delete(attach);
                if (!set.size) waiters.delete(binding.signal);
            });
        }
    }
}
export function resumeDocument(root = document, options = {}) {
    const disposersEarly = [];
    let state = options.state;
    if (state === undefined && root?.getElementById) {
        const node = root.getElementById(options.stateId || '__LITHE_STATE__');
        if (node) try {
            state = JSON.parse(node.textContent || 'null');
        } catch (e) {
            console.warn('[lithe:dom] Failed to parse resume state:', e);
        }
    }
    if (state?.signals) disposersEarly.push(installSignalSnapshot(state.signals));
    if (state?.owners) restoreOwners(state.owners);
    const types = new Set();
    for (const el of root.querySelectorAll?.('*') || []) for (const attr of el.attributes || []) if (attr.name.startsWith('data-lithe-on')) types.add(attr.name.slice('data-lithe-on'.length));
    let installed = installedByRoot.get(root);
    if (!installed) {
        installed = new Map();
        installedByRoot.set(root, installed);
    }
    const disposers = [...disposersEarly];
    resumeBindings(root, state, disposers);
    if (state?.computations?.length) disposers.push(resumeComputations(state.computations));
    for (const type of types) {
        if (installed.has(type)) continue;
        const listener = async event => {
            let node = event.target;
            while (node && node !== root.parentNode) {
                const spec = node.getAttribute?.(`data-lithe-on${type}`);
                if (spec) {
                    const hash = spec.lastIndexOf('#'),
                        module = hash >= 0 ? spec.slice(0, hash) : spec,
                        name = hash >= 0 ? spec.slice(hash + 1) : 'default';
                    const mod = await import(module),
                        fn = mod[name];
                    if (typeof fn === 'function') {
                        let captures = null;
                        const raw = node.getAttribute?.(`data-lithe-cap-${type}`);
                        if (raw) try {
                            captures = JSON.parse(raw);
                        } catch (e) {
                            console.warn('[lithe:dom] Failed to parse event captures:', e);
                        }
                        await fn.call(node, event, captures);
                    }
                    if (event.cancelBubble) break;
                }
                if (node === root) break;
                node = node.parentNode;
            }
        };
        root.addEventListener(type, listener);
        installed.set(type, listener);
        disposers.push(() => {
            root.removeEventListener(type, listener);
            installed.delete(type);
            if (!installed.size) installedByRoot.delete(root);
        });
    }
    return () => disposers.splice(0).forEach(fn => fn());
}
export function serializeResumeState(options = {}) {
    return {
        signals: options.signals || serializeSignals(),
        bindings: options.bindings || {},
        queries: options.queries || [],
        routes: options.routes || null,
        owners: options.owners || serializeOwners(),
        computations: options.computations || serializeComputations(),
        version: 4
    };
}
