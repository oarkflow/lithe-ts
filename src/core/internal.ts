// Runtime-only coordination between state proxies and DOM controls. This is
// intentionally not re-exported from the public core entry point.
export const ARRAY_MUTATION = Symbol.for('lithe.array-mutation');
export const ARRAY_TRACK = Symbol.for('lithe.array-track');
