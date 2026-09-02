# Lithe Trust and DX Guide

This guide defines how Lithe turns “faster and better” into verifiable engineering work.

## Stable vs Experimental

Stable public APIs live under exports such as `@spbaniya/lithe`, `@spbaniya/lithe/core`, `@spbaniya/lithe/dom`, `@spbaniya/lithe/router`, `@spbaniya/lithe/data`, `@spbaniya/lithe/forms`, `@spbaniya/lithe/server`, and `@spbaniya/lithe/app`.

Advanced optimization and renderer internals that may change live under `lithe/experimental`.

## Typed Helper APIs

Use definition helpers to preserve inference at framework boundaries:

```ts
import { defineRoutes, defineLoader } from '@spbaniya/lithe/router';
import { defineQuery, defineMutation } from '@spbaniya/lithe/data';
import { defineForm } from '@spbaniya/lithe/forms';
import { defineAction } from '@spbaniya/lithe/server';
import { defineApp } from '@spbaniya/lithe/app';
```

These helpers are intentionally small runtime wrappers. Their main job is to make user code easier for editors, docs, generated types, and future compiler passes to understand.

## Runtime Debugging

- `explainSignal(signal)` reports signal identity, version, value, and subscribers.
- `traceUpdate(label, fn)` records a named update span in DevTools when installed.
- `markComponent(name, meta)` records component metadata for ownership and update inspection.
- `getHydrationReport()` reports the most recent hydration status, mismatches, and fallback behavior.

## TypeScript Honesty

Lithe validates JavaScript syntax through the platform and provides a lightweight semantic checker for common framework-boundary mistakes. Advanced TypeScript patterns such as conditional types, `infer`, and `keyof` are syntax-valid, but the semantic checker reports warnings when it cannot model them deeply.

## Health Checks

Run:

```bash
node --experimental-strip-types cli/lithe.ts doctor examples/todo --build=false
```

`lithe doctor` summarizes dependency policy, public declaration coverage, source policy, semantic typecheck status, framework checks, benchmark isolation, and optionally a production build.

## Performance Proof

Framework comparisons must use real-browser results with pinned dependency versions. See `benchmarks/browser-methodology.md` and `benchmarks/real-browser.ts`.

Production builds distinguish initial static JavaScript from lazy route chunks. Use `performance.initialJsGzip` in `lithe.config.json` to enforce startup weight independently from deferred feature code.
