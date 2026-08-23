# Lithe v1.1 — Zero-Dependency TypeScript-First Frontend Stack

Lithe is a compiler-first, fine-grained frontend/full-stack framework implemented with **zero third-party runtime or tooling dependencies**. It aims for Solid-like reactivity simplicity, React-like component ergonomics, integrated application primitives, resumable SSR, and a lightweight native-ESM production model.

The repository has **no `dependencies`, no `devDependencies`, and no `node_modules` requirement**. Browser code uses Web Platform APIs; build/server tooling uses Node.js 22.6+ built-ins and its native TypeScript stripping support.

## Quick start

```bash
node --experimental-strip-types cli/lithe.ts check examples/todo
node --experimental-strip-types cli/lithe.ts typecheck examples/todo
node --experimental-strip-types cli/lithe.ts dev examples/todo --port=3000
node --experimental-strip-types cli/lithe.ts build examples/todo
node --experimental-strip-types cli/lithe.ts analyze examples/todo
node --experimental-strip-types --test tests/*.test.ts
```

No `npm install` is required.

## TypeScript-first source policy

**All authored implementation code in this repository is TypeScript.** Framework internals, compiler/build tooling, CLI commands, tests and benchmarks use `.ts`; component/example entry points use `.tsx`; public declarations use `.d.ts`. A release test fails if an authored `.js` implementation file is introduced.

Node.js executes Lithe's tooling directly with `--experimental-strip-types`, so no TypeScript npm package, Babel, SWC, ts-node or other compiler dependency is installed. The Lithe production builder compiles/strips `.ts`/`.tsx` into standards-based browser `.js` modules. That emitted JavaScript is a build artifact, not authored framework source—browsers ultimately execute JavaScript.

The repository also ships minimal Node ambient shims in `types/node-shim.d.ts` so editors can understand the zero-dependency tooling without requiring `@types/node`. Projects may still use their own richer Node typings externally.

## Core programming model

```tsx
import { signal, computed } from '@lithe/core';
import { mount } from '@lithe/dom';

const count = signal<number>(0, { name:'count' });
const doubled = computed(() => count.value * 2);

function Counter() {
  return <button onClick={() => count.value++}>
    {count} / {doubled}
  </button>;
}

mount(document.getElementById('app'), <Counter />);
```

Components construct a reactive graph. A signal update targets the affected binding rather than rerendering and diffing the whole component tree.

## What is included

### Compiler and rendering

- JSX/TSX compiler with native elements, components, member components and fragments
- compiler-generated direct DOM instructions for native dynamic JSX
- zero-VNode static native template hoisting
- fine-grained text/attribute/property/class/style bindings
- persistent keyed and indexed list reconciliation
- hydration and resumable named-signal bindings
- automatic island candidates and load/idle/visible/media activation
- safe imported event-symbol lazy loading
- safe inline event closures extracted into independent event chunks with serialized read-only captures
- structural JavaScript program/scope analysis backed by full V8 grammar validation
- Node 22 TypeScript syntax transformation plus an in-repo fallback
- framework semantic TypeScript assignability checks
- source maps, static accessibility diagnostics and reactive graph diagnostics

### Application framework

- nested/parallel/intercepted router with loaders, typed search params and View Transitions
- query cache, persistence, infinite/cursor queries, request cancellation, retries and focus/reconnect refresh
- optimistic mutations and tag-driven automatic invalidation
- schemas, nested forms, cancelable async validation, field arrays, drafts and `AutoForm`
- JSON Schema/OpenAPI schema generation
- incremental collections, maintained indexes, virtualization and editable DataGrid
- headless Dialog/Tabs/Menu/Listbox/Combobox/Tree/Tooltip/Toast/Command Palette UI primitives
- i18n, Intl formatting, RTL/LTR and head/SEO management
- CSS utility, design tokens, static CSS/theme extraction, CSS Modules and scoped CSS
- Web Animations, springs, native View Transitions and shared-element naming
- responsive image primitive and common image-format metadata inspection

### Full stack and platform

- typed-style server actions/RPC over Web `Request`/`Response`
- `.server.*` isolation and private server build output
- `"use server"` and conservative automatic server placement
- SSR, independent streaming boundaries, SSG/prerender and ISR
- resumable signals, text/attribute bindings, ownership snapshots, importable computations and event handlers
- WebSocket/SSE realtime primitives
- Worker/SharedWorker helpers with transferables and compiler placement
- offline network state, generated Service Worker, IndexedDB, Background Sync and persistent mutations
- local-first synchronized collections and deterministic LWW map/set/list CRDTs
- adaptive network/device/battery scheduling and prefetch policy
- Web Components plus injected React/Vue/Svelte bridges
- generic host renderer and reference DOM-less/native memory driver

### Development and production tooling

- zero-dependency dev server
- ESM HMR with dependency invalidation and named-signal preservation
- production native-ESM chunk graph
- reachability pruning, symbol tree shaking, DCE and dependency-free minification
- event-level lazy chunks
- final-transform source maps
- transitive secret/server-client checks
- performance budgets
- build/data/reactive/island/worker/server/event manifests
- route/action type generation
- static prerendering
- image inspector
- custom zero-dependency Chromium DevTools Protocol browser test driver
- reactive graph DevTools, update-reason tracing, mutation time travel and correlation tracing

## CLI

```text
lithe dev <project> [--port=3000]
  lithe build <project> [--bundle=chunks|single]
lithe check <project>
lithe typecheck <project>
lithe analyze <project>
lithe create <directory>
lithe prerender <project> [--out=dist]
lithe types <project> [--out=lithe.generated.d.ts]
lithe image <file>
```

When running directly from this repository, use `node --experimental-strip-types cli/lithe.ts ...`, or execute the `lithe` bin after linking the package. No JavaScript-authored implementation files are required.

## Production model

Lithe intentionally emits browser-native ESM rather than forcing all code into a single concatenated bundle. The builder still performs:

1. JSX/TSX and server/client compilation
2. direct-DOM/static-template lowering
3. static CSS/theme extraction
4. server-module isolation
5. event handler chunk extraction
6. module reachability analysis
7. symbol-level safe tree shaking
8. dead-branch elimination
9. dependency-free minification
10. source-map generation
11. production/debug budget enforcement

Only reachable Lithe runtime modules are copied into `dist/__lithe`.

## Security defaults

- SSR escapes text and attributes by default
- raw browser HTML requires `trustedHTML()`
- Trusted Types integration is available
- server actions support schemas and permission hooks
- CSRF and CSP/security-header helpers are included
- `.server.*` and detected secret-tainted dependency chains are rejected from browser graphs
- 5xx server errors hide internal details by default

## Zero-dependency boundaries

Some capabilities intentionally use platform implementations rather than embedding another large implementation:

- Node/V8 is the ECMAScript grammar authority; Lithe supplies structural AST/scope/IR analysis for its transformations.
- Node 22 supplies the native TypeScript syntax transformer when available. Lithe also ships semantic framework checks and a fallback syntax stripper, but does not attempt to reproduce the entire TypeScript editor/language-service ecosystem.
- AVIF/WebP transcoding uses browser-native decoders/canvas encoders when supported rather than bundling codecs.
- React/Vue/Svelte bridges take their runtimes from the host application rather than making them dependencies.
- Native/mobile rendering is exposed through a host-renderer protocol so platform drivers can be implemented independently.

See [`Tasks.md`](./Tasks.md) for the completed engineering ledger and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for internals.
