import { inspectReactiveGraph } from '../core/reactive-debug.ts';
export function mountReactiveGraphInspector(root, options = {}) {
    if (!root?.appendChild) throw new TypeError('mountReactiveGraphInspector requires a DOM root.');
    let disposed = false,
        timer = null;
    const render = () => {
        if (disposed) return;
        const graph = options.graph?.() || inspectReactiveGraph();
        root.replaceChildren();
        const wrap = document.createElement('div');
        wrap.className = 'lithe-reactive-graph';
        const title = document.createElement('strong');
        title.textContent = `Reactive graph · ${graph.nodes.length} nodes · ${graph.edges.length} edges`;
        wrap.append(title);
        const list = document.createElement('ol');
        for (const n of graph.nodes) {
            const li = document.createElement('li');
            li.dataset.nodeId = String(n.id);
            li.textContent = `${n.name || n.kind || 'node'} #${n.id}${n.subscribers != null ? ` · ${n.subscribers} subscriber(s)` : ''}`;
            const incoming = graph.edges.filter(e => e.to === n.id).length,
                outgoing = graph.edges.filter(e => e.from === n.id).length;
            li.title = `incoming ${incoming}, outgoing ${outgoing}`;
            list.append(li);
        }
        wrap.append(list);
        root.append(wrap);
    };
    render();
    if (options.live !== false) {
        timer = setInterval(render, options.interval ?? 500);
        timer.unref?.();
    }
    return {
        render,
        dispose() {
            disposed = true;
            clearInterval(timer);
            root.replaceChildren();
        }
    };
}
