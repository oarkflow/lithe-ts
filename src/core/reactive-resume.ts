import { batch, effect } from './reactive.ts';
import { createDetachedOwner } from './owner-resume.ts';
function named() {
    return globalThis.__LITHE_NAMED_SIGNALS__ ||= new Map();
}
function snapshot() {
    return globalThis.__LITHE_RESUME_SIGNAL_SNAPSHOT__ ||= Object.create(null);
}
function computations() {
    return globalThis.__LITHE_RESUME_COMPUTATIONS__ ||= new Map();
}
const owners = new Map();
const previousOwnerHook = globalThis.__LITHE_OWNER_HOOK__;
if (!previousOwnerHook?.__litheResume) {
    globalThis.__LITHE_OWNER_HOOK__ = {
        __litheResume: true,
        create(owner) {
            owners.set(owner.id, owner);
            previousOwnerHook?.create?.(owner);
        },
        dispose(owner) {
            owners.delete(owner.id);
            previousOwnerHook?.dispose?.(owner);
        },
        context(owner, key, value) {
            previousOwnerHook?.context?.(owner, key, value);
        }
    };
}
export function serializeSignals() {
    const out = {};
    for (const [name, sig] of named()) out[name] = sig.peek();
    return out;
}
export function restoreSignals(values = {}) {
    Object.assign(snapshot(), values);
    batch(() => {
        for (const [name, value] of Object.entries(values)) {
            const sig = named().get(name);
            if (sig) sig.value = value;
        }
    });
}
export function installSignalSnapshot(values = {}) {
    restoreSignals(values);
    return () => {
        const state = snapshot();
        for (const key of Object.keys(values)) delete state[key];
    };
}
export function pendingSignals() {
    return {
        ...snapshot()
    };
}
export function getNamedSignal(name) {
    return named().get(name);
}
export function serializeOwners() {
    const roots = [...owners.values()].filter(o => !o.parent);
    const clean = o => ({
        id: o.id,
        name: o.name || null,
        disposed: o.disposed,
        contexts: Object.fromEntries([...o.contexts].map(([k, v]) => [k.description || String(k), v?.__litheSignal ? v.peek?.() ?? v.value : v]).filter(([, v]) => v == null || ['string', 'number', 'boolean'].includes(typeof v))),
        resume: o.resume || null,
        children: [...o.children].map(clean)
    });
    return roots.map(clean);
}
export function restoreOwners(graph = []) {
    const restored = (graph || []).map(x => createDetachedOwner(x));
    globalThis.__LITHE_RESTORED_OWNERS__ = restored;
    return restored;
}
export function registerResumableComputation(meta) {
    if (!meta?.name || !meta?.module) throw new TypeError('Resumable computation requires name and module.');
    const normalized = {
        name: meta.name,
        module: meta.module,
        exportName: meta.exportName || 'default',
        signals: [...(meta.signals || [])],
        kind: meta.kind || 'effect',
        options: meta.options || null
    };
    computations().set(normalized.name, normalized);
    return normalized;
}
export function serializeComputations() {
    return [...computations().values()].map(x => ({
        ...x
    }));
}
export function resumeComputations(list = []) {
    const disposers = [];
    for (const meta of list || []) {
        const registered = registerResumableComputation(meta);
        let active = true;
        let loaded = null;
        const run = async () => {
            if (!active) return;
            const values = {};
            for (const name of meta.signals || []) {
                const sig = getNamedSignal(name);
                values[name] = sig?.value ?? pendingSignals()[name];
            }
            loaded ||= import(meta.module).then(mod => {
                const fn = mod[meta.exportName || 'default'];
                if (typeof fn !== 'function') throw new TypeError(`Resumable computation ${meta.name} export is not callable.`);
                return fn;
            });
            if (!active) return;
            const fn = await loaded;
            if (!active) return;
            return fn(values, {
                name: meta.name,
                kind: meta.kind
            });
        };
        const signals = (meta.signals || []).map(getNamedSignal).filter(Boolean);
        if (signals.length) {
            const stop = effect(() => {
                for (const sig of signals) sig.value;
                run();
            }, {
                sync: false,
                name: `resume:${meta.name}`
            });
            disposers.push(() => {
                active = false;
                stop();
                if (computations().get(registered.name) === registered) computations().delete(registered.name);
            });
        } else {
            run();
            disposers.push(() => {
                active = false;
                if (computations().get(registered.name) === registered) computations().delete(registered.name);
            });
        }
    }
    return () => disposers.splice(0).forEach(fn => fn());
}
export function resumableEffect(name, symbol, signals = []) {
    const meta = registerResumableComputation({
        name,
        module: symbol.module,
        exportName: symbol.exportName,
        signals: signals.map(s => typeof s === 'string' ? s : s?.__litheName).filter(Boolean),
        kind: 'effect'
    });
    if (typeof document !== 'undefined') return resumeComputations([meta]);
    return () => { };
}
