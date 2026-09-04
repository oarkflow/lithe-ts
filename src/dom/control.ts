import { effect, isSignal, signal } from '../core/reactive.ts';
import { createScope, onCleanup } from '../core/owner.ts';
import { dynamic } from './dom.ts';
import { h, Fragment } from './vnode.ts';
function read(value) {
    return isSignal(value) ? value.value : typeof value === 'function' ? value() : value;
}
function removeRow(row) {
    row?.scope?.dispose();
    for (const node of row?.nodes || []) node.remove();
}
function keyFor(item, index, key) {
    if (typeof key === 'function') return key(item, index);
    if (typeof key === 'string') return item?.[key];
    if (item && typeof item === 'object') return item.id ?? item.key ?? item;
    return item;
}
const NEGATIVE_ZERO = Symbol('lithe.negative-zero');
function bucketKey(key) {
    return typeof key === 'number' && Object.is(key, -0) ? NEGATIVE_ZERO : key;
}
function renderScope(mountAny, view, options) {
    const fragment = document.createDocumentFragment(),
        scope = createScope(() => mountAny(fragment, view, null, options));
    return {
        fragment,
        scope,
        nodes: [...scope.value.nodes]
    };
}
export function Show(props) {
    return dynamic(() => {
        const when = read(props.when);
        if (when) return typeof props.children === 'function' ? props.children(when) : props.children;
        return typeof props.fallback === 'function' ? props.fallback() : props.fallback ?? null;
    });
}
export function For(props) {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children;
    return dynamic(() => {
        const items = read(props.each) || [];
        return items.length ? items.map((item, i) => renderer(item, signal(i))) : props.fallback ?? null;
    });
}
For.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:for'),
        end = document.createComment('/lithe:for');
    parent.insertBefore(start, before);
    parent.insertBefore(end, before);
    let rows = [],
        fallback = null;
    const dispose = effect(() => {
        const items = read(props.each) || [];
        if (!Array.isArray(items)) throw new TypeError('<For each> must be an array.');
        if (!items.length) {
            for (const row of rows) removeRow(row);
            rows = [];
            if (!fallback && props.fallback != null) {
                fallback = renderScope(mountAny, read(props.fallback), options);
                parent.insertBefore(fallback.fragment, end);
            }
            return;
        }
        if (fallback) {
            removeRow(fallback);
            fallback = null;
        }
        const buckets = new Map(),
            occurrences = new Map(),
            next = [];
        for (const row of rows) {
            const id = bucketKey(row.base);
            let bucket = buckets.get(id);
            if (!bucket) buckets.set(id, bucket = []);
            bucket.push(row);
        }
        for (let i = 0; i < items.length; i++) {
            const base = keyFor(items[i], i, props.key);
            const bucketId = bucketKey(base),
                occ = occurrences.get(bucketId) || 0;
            occurrences.set(bucketId, occ + 1);
            let row = buckets.get(bucketId)?.[occ];
            if (row && row.item !== items[i]) {
                row = null;
            }
            if (!row) {
                const index = signal(i),
                    built = renderScope(mountAny, renderer(items[i], index), options);
                row = {
                    ...built,
                    base,
                    occ,
                    item: items[i],
                    index
                };
                parent.insertBefore(built.fragment, end);
            } else row.index.value = i;
            next.push(row);
        }
        const retained = new Set(next);
        for (const row of rows) if (!retained.has(row)) removeRow(row);
        rows = next;
        for (const row of rows) for (const node of row.nodes) parent.insertBefore(node, end);
    }, {
        sync: true
    });
    onCleanup(() => {
        dispose();
        for (const row of rows) removeRow(row);
        removeRow(fallback);
        start.remove();
        end.remove();
    });
    return {
        nodes: [start, end]
    };
};
export function Index(props) {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children;
    return dynamic(() => {
        const items = read(props.each) || [];
        return items.length ? items.map((item, i) => renderer(signal(item), i)) : props.fallback ?? null;
    });
}
Index.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:index'),
        end = document.createComment('/lithe:index');
    parent.insertBefore(start, before);
    parent.insertBefore(end, before);
    let rows = [],
        fallback = null;
    const dispose = effect(() => {
        const items = read(props.each) || [];
        if (!items.length) {
            for (const row of rows) removeRow(row);
            rows = [];
            if (!fallback && props.fallback != null) {
                fallback = renderScope(mountAny, read(props.fallback), options);
                parent.insertBefore(fallback.fragment, end);
            }
            return;
        }
        if (fallback) {
            removeRow(fallback);
            fallback = null;
        }
        for (let i = 0; i < items.length; i++) {
            if (rows[i]) rows[i].item.value = items[i]; else {
                const item = signal(items[i]),
                    built = renderScope(mountAny, renderer(item, i), options);
                rows[i] = {
                    ...built,
                    item
                };
                parent.insertBefore(built.fragment, end);
            }
        }
        while (rows.length > items.length) removeRow(rows.pop());
    }, {
        sync: true
    });
    onCleanup(() => {
        dispose();
        for (const row of rows) removeRow(row);
        removeRow(fallback);
        start.remove();
        end.remove();
    });
    return {
        nodes: [start, end]
    };
};
export function Switch(props) {
    const children = Array.isArray(props.children) ? props.children : [props.children];
    return dynamic(() => {
        for (const child of children) if (child?.type === Match && read(child.props.when)) return child.props.children;
        return props.fallback ?? null;
    });
}
export function Match() {
    return null;
}
export function Dynamic(props) {
    return dynamic(() => {
        const component = read(props.component);
        if (!component) return null;
        const {
            component: _ignored,
            children,
            ...rest
        } = props;
        return h(component, rest, ...(children || []));
    });
}
export function Portal(props) {
    return props.children || null;
}
Portal.__litheMount = ({
    props,
    options,
    mountAny
}) => {
    const target = read(props.mount || props.target) || document.body,
        scope = createScope(() => mountAny(target, props.children, null, options));
    onCleanup(() => {
        scope.dispose();
        for (const n of scope.value.nodes) n.remove();
    });
    return {
        nodes: []
    };
};
export function Island(props) {
    if (typeof document === 'undefined') return {
        __litheIsland: true,
        children: props.children
    };
    return props.fallback ?? null;
}
Island.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const placeholder = document.createComment(`lithe:island:${props.when || props.policy || 'load'}`);
    parent.insertBefore(placeholder, before);
    let scope = null,
        disposed = false,
        marker = null,
        cancelActivation = () => { };
    const activate = () => {
        if (disposed || scope) return;
        const fragment = document.createDocumentFragment();
        scope = createScope(() => mountAny(fragment, props.children, null, options));
        parent.insertBefore(fragment, placeholder);
        placeholder.remove();
    };
    const policy = props.when || props.policy || 'load';
    if (policy === 'load') queueMicrotask(activate); else if (policy === 'idle') {
        if (typeof globalThis.requestIdleCallback === 'function') {
            const id = globalThis.requestIdleCallback(activate);
            cancelActivation = () => globalThis.cancelIdleCallback?.(id);
        } else {
            const id = setTimeout(activate, 1);
            cancelActivation = () => clearTimeout(id);
        }
    } else if (policy === 'visible' && typeof IntersectionObserver !== 'undefined') {
        marker = document.createElement('span');
        marker.hidden = true;
        parent.insertBefore(marker, placeholder);
        const io = new IntersectionObserver(es => {
            if (es.some(e => e.isIntersecting)) {
                io.disconnect();
                marker.remove();
                activate();
            }
        });
        io.observe(marker);
        onCleanup(() => io.disconnect());
    } else if (policy === 'media' && typeof matchMedia === 'function') {
        const mq = matchMedia(props.media || 'all'),
            fn = () => {
                if (mq.matches) {
                    mq.removeEventListener?.('change', fn);
                    activate();
                }
            };
        mq.addEventListener?.('change', fn);
        fn();
        onCleanup(() => mq.removeEventListener?.('change', fn));
    } else activate();
    onCleanup(() => {
        disposed = true;
        cancelActivation();
        marker?.remove();
        scope?.dispose();
        placeholder.remove();
    });
    return {
        nodes: [placeholder]
    };
};
export function ErrorBoundary(props) {
    try {
        return props.children;
    } catch (error) {
        return typeof props.fallback === 'function' ? props.fallback(error) : props.fallback;
    }
}
export function Await(props) {
    return dynamic(() => {
        const resource = props.resource;
        if (resource.loading) return props.pending ?? null;
        if (resource.error) return typeof props.error === 'function' ? props.error(resource.error) : props.error ?? null;
        const child = Array.isArray(props.children) ? props.children[0] : props.children;
        return typeof child === 'function' ? child(resource.data) : child;
    });
}
export function lazy(loader, options = {}) {
    let component = null,
        promise = null;
    return function Lazy(props) {
        const tick = signal(0);
        if (!component && !promise) promise = Promise.resolve(loader()).then(mod => {
            component = mod?.default || mod;
            tick.value++;
            return component;
        }).catch(error => {
            promise = null;
            if (options.onError) options.onError(error); else queueMicrotask(() => {
                throw error;
            });
        });
        return dynamic(() => {
            tick.value;
            if (!component) return typeof options.fallback === 'function' ? options.fallback() : options.fallback ?? null;
            return h(component, props, ...(props.children || []));
        });
    };
}
export function lazyEvent(loader, exportName = 'default') {
    let loaded;
    return async function (...args) {
        loaded ||= Promise.resolve(loader()).then(mod => mod?.[exportName] ?? (exportName === 'default' ? mod?.default : undefined));
        const fn = await loaded;
        if (typeof fn !== 'function') throw new TypeError(`Lazy event export ${exportName} is not a function.`);
        return fn.apply(this, args);
    };
}
export { Fragment };
