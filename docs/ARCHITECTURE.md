# Lithe v1.1 TypeScript-First Architecture

## Design invariants

1. **Zero third-party framework/tooling dependencies.** Browser APIs and Node.js built-ins only.
2. **TypeScript-authored.** Framework runtime, compiler, tooling, CLI, tests and benchmarks are authored as `.ts`/`.tsx`; browser JavaScript exists only as generated build output.
3. **Fine-grained updates.** State changes notify exact reactive consumers rather than triggering component rerenders.
4. **Compiler-first DOM.** Native JSX lowers to static templates or direct native DOM instructions; component VNodes are retained only as a composition boundary.
5. **Native ESM.** Production output remains standards-based while reachability, event splitting, tree shaking, DCE and minification remove unused work.
6. **Progressive full stack.** The same component model supports CSR, SSR, streaming, SSG, ISR, hydration, islands and explicit resumability.
7. **Safe optimization.** Automatic Worker/server/event placement occurs only when analysis can preserve semantics; uncertain cases remain in place.

## Compile pipeline

```text
TS/TSX authored source
    │
    ├─ V8 grammar validation / structural tokenizer+scope model
    ├─ framework semantic TypeScript checks
    ├─ lazy imported event detection
    ├─ safe captured-event extraction metadata
    ├─ JSX lowering
    │    ├─ static native subtree -> staticTemplate
    │    ├─ native dynamic node -> compiledElement/compiledTemplate
    │    └─ component boundary -> VNode
    ├─ Node 22.6+ native TypeScript syntax erasure (in-repo fallback where needed)
    ├─ Worker placement analysis
    ├─ reactive graph IR + cycle/a11y diagnostics
    └─ source map metadata
```

The production builder then performs CSS/theme extraction, server placement/splitting, event-chunk emission, native-ESM module graph construction, reachability pruning, pure-export tree shaking, dead-branch elimination, minification and final source-map generation.


## TypeScript execution model

Repository-side modules are executed directly by Node.js 22.6+ with `--experimental-strip-types`. This keeps the source TypeScript-first without adding `typescript`, `ts-node`, Babel, SWC or `@types/node` as package dependencies. Lithe ships minimal ambient Node declarations for editor self-containment.

Browser builds never ship TypeScript syntax. The production builder resolves `.ts`/`.tsx`, lowers TSX/JSX, erases TypeScript, rewrites local extensions to `.js`, applies framework transforms/tree shaking/minification, then emits native ESM `.js`. A regression test verifies emitted browser modules contain no unresolved TypeScript imports.

## Reactive graph

Signals and proxy-state properties track observers dynamically. Computeds/effects own their dependency sets and are attached to lifecycle owners. Compile-time IR separately describes discoverable signal/computed dependencies across modules and reports cycles/dead/duplicate derivation opportunities.

Named signals additionally participate in:

- SSR resume-state serialization
- direct text/attribute binding reconnection
- HMR state preservation
- resumable computation dependency lookup
- DevTools time travel

## Ownership and lifecycle

Every component/dynamic region may execute inside an owner scope. Owners contain cleanups, children and context values. Disposal recursively tears down child scopes and cleanup callbacks. Resume mode can serialize a safe owner snapshot and restore detached ownership metadata without mounting the component tree.

## Rendering and hydration

The client renderer has three native fast paths:

1. cloned fully-static templates
2. compiled native elements with exact reactive binding effects
3. compiled text-template markers

Components remain small VNode boundaries. `For` retains keyed rows and moves their existing nodes; `Index` retains row positions and updates item signals.

Hydration claims existing DOM where possible. Resume mode can reconnect named text/attribute bindings and delegated importable event symbols directly to server-rendered markup.

## Event-level loading

Imported handlers used only as JSX events can become `eventSymbol()` references. Inline closures are extracted only if:

- all module-level dependencies are imports rather than module-local state,
- captures are serializable component-local values,
- captured values are not mutated by the handler.

The builder emits a standalone `__lithe_events/*.event.js` module. Unsafe handlers remain inline rather than being transformed incorrectly.

## Router/data/server correlation

Navigation creates a correlation ID. It flows through route loaders, query fetches, RPC/server handlers and DOM commits. Workers, forms, realtime streams, offline queues and sync operations publish compatible correlation events through the same global carrier/DevTools channel.

## Server isolation

Client imports of `.server.*` modules are replaced with generated server references. The original implementation is emitted only under `.lithe/server`. Inline exported functions may also be split using `"use server"` or conservative server-only analysis. The browser production tree never needs the implementation source.

## SSR/resume

SSR produces escaped HTML plus optional versioned resume state:

```text
signals
bindings (text + attributes/properties)
owners
importable resumable computations
```

Event symbols are serialized as DOM data attributes containing public module/export references and optional safe capture snapshots. `resumeDocument()` reconnects these without mounting the component tree.

## Offline/local-first

IndexedDB-backed adapters, persistent mutation queues, Background Sync, optimistic synchronized collections and LWW CRDT map/set/list structures are optional modules. No offline/local-first code is present in the minimum client graph unless imported.

## Styling/images

Static theme and eligible style calls are converted to CSS during production builds. CSS Modules and scoped CSS are build transforms. Image metadata inspection is implemented in Node for common web/desktop formats; transcoding delegates to native browser codec/canvas support, preserving the zero-codec-dependency rule.

## Interoperability

Web Components are native. React/Vue/Svelte adapters are dependency-injected bridges: Lithe never imports those packages itself. A generic five-operation host renderer (`createElement`, `createText`, `insert`, `remove`, `setProperty`) enables DOM-less/native drivers.

## Performance budget

The included Todo application deliberately keeps a strict budget:

- production payload: <= 50,000 raw bytes
- JavaScript gzip: <= 18,000 bytes

Advanced features are split into optional modules so adding framework capabilities does not force them into a simple app.
