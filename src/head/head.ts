import { effect, isSignal } from '../core/reactive.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
function read(v) {
    return isSignal(v) ? v.value : typeof v === 'function' ? v() : v;
}
export function createHeadManager() {
    const owned = new Set(), active = new Set();
    const set = descriptor => {
        if (typeof document === 'undefined') return () => { };
        const disposers = [];
        if ('title' in descriptor) disposers.push(effect(() => {
            document.title = read(descriptor.title) || '';
        }, {
            sync: true
        }));
        for (const meta of descriptor.meta || []) {
            const el = document.createElement('meta');
            for (const [k, v] of Object.entries(meta)) if (v != null) el.setAttribute(k, String(read(v)));
            el.dataset.litheHead = '1';
            document.head.appendChild(el);
            owned.add(el);
            disposers.push(() => {
                owned.delete(el);
                el.remove();
            });
        }
        for (const link of descriptor.links || []) {
            const el = document.createElement('link');
            for (const [k, v] of Object.entries(link)) if (v != null) el.setAttribute(k, String(read(v)));
            el.dataset.litheHead = '1';
            document.head.appendChild(el);
            owned.add(el);
            disposers.push(() => {
                owned.delete(el);
                el.remove();
            });
        }
        let disposed = false;
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            active.delete(dispose);
            disposers.splice(0).forEach(fn => fn());
        };
        active.add(dispose);
        return dispose;
    };
    const clear = () => {
        for (const dispose of [...active]) dispose();
        for (const el of owned) el.remove();
        owned.clear();
    };
    if (getOwner()) onCleanup(clear);
    return {
        set,
        clear
    };
}
export function headToString(descriptor = {}) {
    const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    let out = descriptor.title ? `<title>${esc(read(descriptor.title))}</title>` : '';
    for (const meta of descriptor.meta || []) out += `<meta ${Object.entries(meta).map(([k, v]) => `${k}="${esc(read(v))}"`).join(' ')}>`;
    for (const link of descriptor.links || []) out += `<link ${Object.entries(link).map(([k, v]) => `${k}="${esc(read(v))}"`).join(' ')}>`;
    return out;
}
