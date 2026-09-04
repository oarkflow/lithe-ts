import { getOwner, onCleanup } from '../core/owner.ts';

const STYLE = `:host{all:initial}.lithe-debug{position:fixed;z-index:2147483647;right:16px;bottom:16px;width:min(360px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;background:#10151c;color:#e8edf2;border:1px solid #34404d;border-radius:8px;box-shadow:0 12px 36px #0008;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.lithe-debug header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #34404d}.lithe-debug h2{font:600 13px system-ui,sans-serif;margin:0}.lithe-debug section{padding:8px 12px;border-bottom:1px solid #28323d}.lithe-debug button{border:1px solid #536273;border-radius:4px;background:#1b2530;color:inherit;padding:4px 7px;cursor:pointer}.lithe-debug button+button{margin-left:5px}.lithe-debug ul{margin:6px 0 0;padding-left:18px}.lithe-debug li{margin:3px 0;color:#b9c4cf}.lithe-debug .muted{color:#8190a0}`;
function button(text, fn) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = text;
    node.addEventListener('click', fn);
    return node;
}
export function mountDevtoolsOverlay(root = document.body, options = {}) {
    if (!root?.appendChild) throw new TypeError('mountDevtoolsOverlay requires a DOM root.');
    const tools = options.devtools || globalThis.__LITHE_DEVTOOLS__;
    if (!tools) throw new Error('Install devtools before mounting the overlay.');
    const host = document.createElement('div');
    const shadow = host.attachShadow?.({
        mode: 'open'
    }) || host;
    const style = document.createElement('style');
    style.textContent = STYLE;
    shadow.append(style);
    const panel = document.createElement('aside');
    panel.className = 'lithe-debug';
    shadow.append(panel);
    root.append(host);
    let timer,
        closed = false;
    const render = () => {
        if (closed) return;
        const graph = tools.graph?.() || {
            nodes: [],
            edges: []
        },
            components = tools.components?.() || [];
        panel.replaceChildren();
        const header = document.createElement('header'),
            title = document.createElement('h2');
        title.textContent = 'Lithe debugger';
        header.append(title, button('×', dispose));
        panel.append(header);
        const controls = document.createElement('section');
        controls.append(button('Back', tools.debugger?.stepBack || tools.back), button('Forward', tools.debugger?.stepForward || tools.forward), button('Pause', tools.debugger?.pause || (() => { })), button('Resume', tools.debugger?.resume || (() => { })));
        panel.append(controls);
        const info = document.createElement('section');
        info.textContent = `Components ${components.length} · Graph ${graph.nodes.length} nodes / ${graph.edges.length} edges · Events ${tools.history?.length || 0}`;
        panel.append(info);
        const list = document.createElement('ul');
        for (const component of components) {
            const item = document.createElement('li');
            item.textContent = `${component.name} #${component.id}${component.parent ? ` · parent #${component.parent}` : ''}`;
            list.append(item);
        }
        const section = document.createElement('section');
        section.append(document.createTextNode('Mounted components'));
        if (list.children.length) section.append(list); else {
            const empty = document.createElement('span');
            empty.className = 'muted';
            empty.textContent = ' none';
            section.append(empty);
        }
        panel.append(section);
    };
    const dispose = () => {
        closed = true;
        clearInterval(timer);
        host.remove();
    };
    render();
    if (options.live !== false) timer = setInterval(render, options.interval || 250);
    if (getOwner()) onCleanup(dispose);
    return {
        render,
        dispose
    };
}
