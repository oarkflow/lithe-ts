// Minimal browser entrypoint for signal-driven libraries and small widgets.
// Keep stores, DevTools, resumability and adaptive helpers out of this graph.
export type { Priority, SignalOptions, ObserverOptions, Signal, ReadonlySignal } from './core/types.ts';
export {
    Dependency,
    Observer,
    SignalImpl,
    ComputedImpl,
    signal,
    computed,
    effect,
    batch,
    untrack,
    isSignal,
    unwrap,
    state,
    watch
} from './core/reactive.ts';
export { schedule, flushSync, transition, scheduler } from './core/scheduler.ts';
