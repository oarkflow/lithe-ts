// Small React-like default entry. Higher-level application modules intentionally
// remain on their dedicated entrypoints so importing @oarkflow/lithe does not
// make stores, router, SSR, DevTools, or every DOM helper reachable.
export * from '../signals.ts';
export { mount, createRoot } from '../dom/dom.ts';
