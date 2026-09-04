import { onTrace } from '../observability/tracing.ts';
import { onMutation, inspectReactiveGraph } from '../core/reactive-debug.ts';
import { getOwner, onCleanup, inspectOwners } from '../core/owner.ts';
export function createDevtools(options = {}) {
    const history = [],
        mutations = [];
    const max = options.maxEvents || 1000;
    let cursor = 0,
        replaying = false,
        disposed = false;
    const installedGlobals = new Set<string>();
    const push = e => {
        if (disposed) return;
        history.push(e);
        if (history.length > max) history.shift();
        options.onEvent?.(e);
    };
    const stopTrace = onTrace(push);
    const stopMutation = onMutation(event => {
        if (replaying) return;
        if (cursor < mutations.length) mutations.splice(cursor);
        mutations.push(event);
        cursor = mutations.length;
        if (mutations.length > max) {
            mutations.shift();
            cursor--;
        }
        push({
            type: 'mutation',
            ...event,
            signal: undefined
        });
    });
    const inspectSignal = sig => ({
        value: sig.peek?.() ?? sig.value,
        subscribers: sig.__dep?.subscribers?.size ?? null,
        name: sig.__dep?.label || null,
        id: sig.__dep?.id || null
    });
    const record = event => push(event);
    const step = direction => {
        const next = cursor + direction;
        if (next < 0 || next > mutations.length) return false;
        replaying = true;
        try {
            if (direction < 0) {
                const m = mutations[cursor - 1];
                if (m?.signal) m.signal.value = m.previous;
                cursor--;
            } else {
                const m = mutations[cursor];
                if (m?.signal) m.signal.value = m.value;
                cursor++;
            }
            return true;
        } finally {
            replaying = false;
        }
    };
    const graph = () => inspectReactiveGraph();
    const components = () => inspectOwners().filter(owner => owner.name && !owner.name.startsWith('context:')).map(owner => ({
        ...owner,
        kind: 'component'
    }));
    const toDOT = () => {
        const g = graph();
        return `digraph Lithe {\n${g.nodes.map(n => `  n${n.id} [label=${JSON.stringify(n.name || n.kind)}];`).join('\n')}\n${g.edges.map(e => `  n${e.from} -> n${e.to};`).join('\n')}\n}`;
    };
    const installGlobal = (name = '__LITHE_DEVTOOLS__') => {
        if (disposed) return () => { };
        if (typeof globalThis !== 'undefined') globalThis[name] = {
            history,
            mutations,
            inspectSignal,
            graph,
            components,
            toDOT,
            record,
            debugger: debuggerTools,
            back: () => step(-1),
            forward: () => step(1),
            get cursor() {
                return cursor;
            }
        };
        installedGlobals.add(name);
        return () => {
            if (globalThis[name]?.history === history) delete globalThis[name];
            installedGlobals.delete(name);
        };
    };
    const debuggerTools = {
        pause() {
            globalThis.__LITHE_DEBUG_PAUSED__ = true;
            record({
                type: 'debugger',
                action: 'pause'
            });
        },
        resume() {
            globalThis.__LITHE_DEBUG_PAUSED__ = false;
            record({
                type: 'debugger',
                action: 'resume'
            });
        },
        stepBack: () => step(-1),
        stepForward: () => step(1),
        snapshot: () => ({
            history: [...history],
            mutations: [...mutations],
            components: components(),
            graph: graph()
        }),
        clear() {
            history.length = 0;
            mutations.length = 0;
            cursor = 0;
        }
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        stopTrace();
        stopMutation();
        for (const name of installedGlobals) {
            if (globalThis[name]?.history === history) delete globalThis[name];
        }
        installedGlobals.clear();
        history.length = 0;
        mutations.length = 0;
        cursor = 0;
    };
    if (getOwner()) onCleanup(dispose);
    return {
        history,
        mutations,
        inspectSignal,
        graph,
        components,
        toDOT,
        record,
        debugger: debuggerTools,
        back: () => step(-1),
        forward: () => step(1),
        installGlobal,
        dispose
    };
}
