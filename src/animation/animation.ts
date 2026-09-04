import { getOwner, onCleanup } from '../core/owner.ts';

export function animate(element, keyframes, options = {}) {
    if (!element?.animate) return {
        finished: Promise.resolve(),
        cancel() { },
        finish() { }
    };
    return element.animate(keyframes, {
        duration: options.duration ?? 200,
        easing: options.easing || 'ease',
        fill: options.fill || 'both',
        ...options
    });
}
export function transitionView(update, options = {}) {
    if (typeof document !== 'undefined' && document.startViewTransition && options.enabled !== false) return document.startViewTransition(update);
    return Promise.resolve().then(update);
}
export function spring(options = {}) {
    const stiffness = options.stiffness ?? 170;
    const damping = options.damping ?? 26;
    const mass = options.mass ?? 1;
    const precision = options.precision ?? 0.001;
    return function solve(from, to, onUpdate) {
        let x = from,
            v = 0,
            last = performance.now(),
            frame = null,
            cancelled = false,
            resolveResult;
        const result = new Promise(resolve => {
            resolveResult = resolve;
            const step = now => {
                if (cancelled) return;
                const dt = Math.min((now - last) / 1000, 0.032);
                last = now;
                const force = -stiffness * (x - to);
                const damp = -damping * v;
                v += (force + damp) / mass * dt;
                x += v * dt;
                onUpdate(x);
                if (Math.abs(v) < precision && Math.abs(to - x) < precision) {
                    onUpdate(to);
                    resolve(to);
                    return;
                }
                frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
        });
        const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            if (frame != null) cancelAnimationFrame(frame);
            resolveResult?.(x);
        };
        const finish = () => {
            if (cancelled) return;
            cancelled = true;
            if (frame != null) cancelAnimationFrame(frame);
            onUpdate(to);
            resolveResult?.(to);
        };
        (result as any).cancel = cancel;
        (result as any).finish = finish;
        if (getOwner()) onCleanup(cancel);
        return result;
    };
}
