import { createContext, useContext } from './owner.ts';
export interface SuspenseController {
    register(promise: Promise<unknown>): void;
}
// Lives in core (not dom) so data-layer modules (query()/resource()) can
// report a pending fetch to the nearest ancestor <Suspense> boundary
// without the data layer depending on the DOM layer. `dom/control.ts`'s
// `Suspense` component is the only thing that actually provides a non-null
// value for this context; everywhere else it's just an inert default.
export const SuspenseContext = createContext<SuspenseController | null>(null, {
    name: 'lithe.suspense'
});
// A resource load calls this once, synchronously, when it starts an actual
// fetch. If no ancestor <Suspense> is currently in scope, this is a no-op —
// callers keep working exactly as they do today (reading .loading/.data
// directly), so adding a <Suspense> boundary around existing code is purely
// additive and never required.
export function registerSuspense(promise: Promise<unknown>): void {
    useContext(SuspenseContext)?.register(promise);
}
