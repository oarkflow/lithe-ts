export function animate(element, keyframes, options = {}) {
  if (!element?.animate) return { finished:Promise.resolve(), cancel() {}, finish() {} };
  return element.animate(keyframes, { duration:options.duration ?? 200, easing:options.easing || 'ease', fill:options.fill || 'both', ...options });
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
  return function solve(from,to,onUpdate) {
    let x = from, v = 0, last = performance.now(), frame;
    return new Promise((resolve) => {
      const step = (now) => {
        const dt = Math.min((now-last)/1000,0.032); last = now;
        const force = -stiffness*(x-to); const damp = -damping*v;
        v += ((force+damp)/mass)*dt; x += v*dt; onUpdate(x);
        if (Math.abs(v)<precision && Math.abs(to-x)<precision) { onUpdate(to); resolve(to); return; }
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
  };
}
