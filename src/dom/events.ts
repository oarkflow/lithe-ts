import { getOwner, onCleanup } from '../core/owner.ts';

const ROOT_EVENTS = Symbol('lithe.events');
function eventName(prop) {
    return prop.slice(2).toLowerCase();
}
export function isEventProp(key) {
    return /^on[A-Z]/.test(key);
}
export function setDirectEvent(element, prop, handler, previous) {
    const name = eventName(prop);
    if (previous) element.removeEventListener(name, previous);
    if (handler) element.addEventListener(name, handler);
}
export function installDelegatedEvents(root, eventTypes = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'pointerdown', 'pointerup']) {
    const existing = root[ROOT_EVENTS];
    if (existing) {
        // Multiple independent mounts can share one root (e.g. islands, or
        // several mount() calls into the same container). Previously every
        // caller received and registered onCleanup() with the SAME shared
        // dispose function, so disposing any one of them tore down
        // delegation for every other mount still using this root. Give each
        // caller its own release that only decrements a shared ref count;
        // the real listeners come off only once the last one releases.
        return existing.retain();
    }
    const disposers = [];
    let disposed = false;
    for (const type of new Set(eventTypes)) {
        const listener = event => {
            let node = event.target;
            const key = `__lithe_${type}`;
            while (node && node !== root.parentNode) {
                const handler = node[key];
                if (handler) {
                    const current = node;
                    const delegatedEvent = new Proxy(event, {
                        get(target, key) {
                            if (key === 'currentTarget') return current;
                            const value = Reflect.get(target, key, target);
                            return typeof value === 'function' ? value.bind(target) : value;
                        }
                    });
                    handler.call(current, delegatedEvent);
                    if (event.cancelBubble) break;
                }
                if (node === root) break;
                node = node.parentNode;
            }
        };
        root.addEventListener(type, listener);
        disposers.push(() => root.removeEventListener(type, listener));
    }
    let refs = 0;
    const teardown = () => {
        if (disposed) return;
        disposed = true;
        for (const fn of disposers) fn();
        delete root[ROOT_EVENTS];
    };
    const retain = () => {
        refs++;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            refs = Math.max(0, refs - 1);
            if (refs === 0) teardown();
        };
        if (getOwner()) onCleanup(release);
        return release;
    };
    root[ROOT_EVENTS] = {
        retain
    };
    return retain();
}
export function setDelegatedEvent(element, prop, handler) {
    element[`__lithe_${eventName(prop)}`] = handler;
}
