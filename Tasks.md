# Lithe Engineering Progress Ledger

This is the canonical progress tracker for the zero-third-party-dependency Lithe frontend/full-stack framework.

**Status legend**
- `[x]` implemented and covered by source/build validation or a dedicated regression test.
- There are no unchecked implementation items in the v1.1 TypeScript-first scope.
- Platform-backed capabilities are explicitly identified where reimplementing an operating-system/browser codec or another framework runtime would violate the zero-third-party rule.

## Release snapshot — v1.1.0

- [x] Zero `dependencies` and zero `devDependencies`.
- [x] All authored framework/tooling/CLI/test/benchmark implementation files are `.ts`/`.tsx`; no authored `.js` implementation files.
- [x] TypeScript-first source regression gate prevents JavaScript source reintroduction.
- [x] Production browser output is compiled JavaScript with no unresolved `.ts`/`.tsx` imports.
- [x] Self-contained minimal Node ambient declarations are shipped without `@types/node`.
- [x] No `node_modules` required or shipped.
- [x] Browser runtime uses Web Platform APIs only.
- [x] Tooling/server code uses Node.js 22.6+ built-ins only, with native TypeScript stripping for repository tooling.
- [x] Fine-grained runtime, compiler, app primitives, full-stack runtime, dev server and production builder are implemented in-repo.
- [x] Runnable Todo/router/forms/i18n example included.
- [x] Performance budgets are enforced by production builds.
- [x] Public declarations cover every official runtime export.
- [x] Release suite includes compiler, runtime, SSR, resume, server split, security, worker, CRDT, router, forms, query, build and release tests.
- [x] Custom dependency-free Chromium/CDP integration driver exists, passes when local HTTP is permitted, and explicitly skips when a managed environment blocks loopback/private HTTP instead of reporting a false pass.

## 1. Reactive core

- [x] Writable named/unnamed `signal()`.
- [x] `computed()` fine-grained derivations.
- [x] `effect()` with automatic dependency tracking.
- [x] `watch()`, `batch()`, `untrack()`.
- [x] Proxy object/array `state()` with per-property dependencies.
- [x] Ownership scopes, nested disposal, `onCleanup()`, `onMount()` and context.
- [x] Effect ownership retained across reruns; dynamic scopes cleanly replaced.
- [x] Priority scheduler: sync, user-blocking, normal, transition, background, idle.
- [x] `transition()` and adaptive scheduling.
- [x] Runtime reactive graph metadata and DevTools inspection.
- [x] Compile-time Reactive Graph IR with cross-module linking.
- [x] Source-positioned reactive cycle diagnostics.
- [x] Dead-node/duplicate-derivation optimization metadata.
- [x] Incrementally maintained collection predicates and equality indexes.
- [x] Named-signal serialization/restoration for resumability and HMR.
- [x] Serializable ownership graph and resumable computation registry.

## 2. DOM/rendering

- [x] Component VNode boundary for component composition.
- [x] Compiler-generated direct native DOM elements for native JSX.
- [x] Zero-VNode static template hoisting and cloned `<template>` fast path.
- [x] Fine-grained text, child, attribute/property, class and style bindings.
- [x] Boolean/form properties and writable `bind:*` support.
- [x] Delegated and direct events with root-scoped listener tracking.
- [x] Fragments, `Show`, `For`, `Index`, `Switch`, `Match`, `Dynamic`, `Await` and error boundary primitives.
- [x] Persistent keyed row reconciliation with DOM movement and scope retention.
- [x] Index-preserving non-keyed list reconciliation.
- [x] Portal primitive.
- [x] Lazy component loading.
- [x] `trustedHTML()` explicit raw-HTML gate and Trusted Types integration.
- [x] Ref callbacks and cleanup.
- [x] Hydration that claims existing server DOM for compiled/native/component bindings.
- [x] Resumable named-signal text and attribute/property bindings without component remount.
- [x] Islands with load/idle/visible/media activation policies and SSR children preservation.

## 3. JavaScript/TypeScript/JSX compiler

- [x] Dependency-free JSX parser/transformer.
- [x] Native tags, components, member components, fragments, expressions, spreads and self-closing nodes.
- [x] Native-tag classification prevents member components such as `router.View` being emitted as HTML.
- [x] Direct-DOM instruction generation for dynamic native nodes.
- [x] Static native template hoisting.
- [x] V8-backed complete JavaScript module grammar validation with line/column diagnostics.
- [x] Lossless structural JavaScript program/scope/token representation for framework analysis, including regex literals and imports/exports.
- [x] Node 22 platform TypeScript syntax transformation with an in-repo fallback stripper.
- [x] Framework semantic TypeScript checker for primitive/literal/union/array/object/interface/generic/function assignability and common argument/assignment errors.
- [x] TSX generic-vs-JSX ambiguity handling.
- [x] Transform-aware source maps regenerated after final production transforms.
- [x] Static CSS/theme extraction metadata.
- [x] Reactive derivation/effect misuse diagnostics.
- [x] Compiler accessibility pass with source locations.
- [x] Transitive server/secret dependency taint checks.
- [x] Safe automatic Worker placement and explicit `"use worker"` placement.
- [x] Safe automatic server placement plus explicit `"use server"` splitting.
- [x] Automatic island candidate detection.
- [x] Safe lazy imported-event symbols.
- [x] Safe inline event-closure extraction into independent chunks with serialized read-only captures.
- [x] Unsafe closure capture/mutation cases remain inline instead of being incorrectly extracted.

## 4. Router/navigation

- [x] Browser history and server-safe initial URL router.
- [x] Static, parameterized and nested route/layout matching.
- [x] Route groups/chains and named/parallel outlets.
- [x] Modal/intercepted routes with background route state.
- [x] Route loaders and preload hooks.
- [x] Programmatic navigation and Link interception.
- [x] Pointer/focus prefetch.
- [x] Search params and schema-validated typed search params.
- [x] Scroll preservation/restoration.
- [x] 404 fallback.
- [x] Adaptive memory-aware route/page cache.
- [x] Native View Transition orchestration and shared transition names.
- [x] Generated route-param declarations.
- [x] Correlated navigation trace IDs propagated into loaders/data/RPC/DOM operations.

## 5. Data/query/mutations/realtime

- [x] Stable structural query keys and cache.
- [x] Concurrent request deduplication and AbortController cancellation.
- [x] Superseded request cancellation and race protection.
- [x] Retry with bounded exponential backoff.
- [x] Stale-time, cache GC and stale-while-revalidate behavior.
- [x] Query invalidation and `getQueryData()` / `setQueryData()`.
- [x] Dehydration/hydration and persistent storage adapters.
- [x] Focus/reconnect revalidation.
- [x] Infinite and cursor pagination helpers.
- [x] Resource primitive.
- [x] Mutations with pending/data/error, optimistic state and rollback.
- [x] Tag-aware automatic mutation→query invalidation.
- [x] Compiler/build mutation/query data graph manifest.
- [x] SSE and WebSocket streams with reconnect/backoff.
- [x] Trace correlation for query and realtime operations.

## 6. Schemas/forms

- [x] String/number/boolean/literal/enum/array/object/union/date schemas.
- [x] Email/URL, optional/nullable/default/refine and structured issues.
- [x] Nested path get/set/delete.
- [x] Values/errors/touched/dirty/submitting/submitted state.
- [x] Stable-identity field arrays.
- [x] Cancelable async field validation.
- [x] Schema validation and server-issue mapping.
- [x] Autosave/draft restoration.
- [x] `AutoForm` schema-driven generator.
- [x] JSON Schema and OpenAPI schema emission.
- [x] Accessible focus/error form behavior helpers.
- [x] Form submission correlation events.

## 7. Full-stack/server

- [x] `server()` registry and deterministic action IDs.
- [x] Browser-callable RPC stubs.
- [x] Web `Request`/`Response` protocol.
- [x] Schema validation, permissions and structured safe errors.
- [x] Node HTTP adapter with no Express/Fastify.
- [x] CSP/security headers, CSRF helpers, safe JSON and HTML escaping.
- [x] SSR string rendering.
- [x] Independent async streaming boundaries.
- [x] State/resume serialization.
- [x] `.server.*` client/server splitting with private `.lithe/server` output and generated client references.
- [x] Inline `"use server"` and conservative automatic server placement.
- [x] SSG/prerender command.
- [x] ISR stale-while-revalidate runtime.
- [x] Edge adapters for Cloudflare-style fetch, Deno/Bun fetch and Lambda-style events.
- [x] Generated server-action declarations preserving annotated input/output where available.
- [x] RPC/server-module trace correlation.

## 8. Resumability/islands/chunk loading

- [x] Native browser ESM production output.
- [x] Dependency graph and reachability pruning.
- [x] Lazy component loading.
- [x] Serializable named signal state.
- [x] Serializable ownership graph.
- [x] Serializable resumable computation registry.
- [x] Text and attribute/property resume binding graph.
- [x] Event handler symbols that dynamically import without component remount.
- [x] Imported event-handler lazy boundaries.
- [x] Safe inline closure event chunks with serialized captures.
- [x] Independent event chunk output retained by production reachability analysis.
- [x] Automatic compiler island candidates.
- [x] Load/idle/visibility/media island activation.
- [x] Network/save-data/device-memory-aware prefetch budgeting.
- [x] Resume path reconnects named bindings/handlers/registered computations without mounting the component tree.

## 9. Offline/local-first/collaboration

- [x] Reactive online/offline, connection type and Save-Data state.
- [x] Service Worker registration and generated network/cache worker.
- [x] IndexedDB storage with in-memory fallback.
- [x] Persistent mutation queue.
- [x] Background Sync registration adapter.
- [x] Queue flushing and trace events.
- [x] Local-first synchronized collection.
- [x] Optimistic insert/update/delete.
- [x] User-defined sync transport.
- [x] Server-wins/client-wins/merge conflict strategies.
- [x] Deterministic LWW map/set/list CRDT collaboration document.
- [x] Sync correlation events.

## 10. Collections/virtualization/grid

- [x] Reactive ID-indexed collection.
- [x] Insert/upsert/update/delete/replace/clear/sort.
- [x] Maintained secondary equality indexes.
- [x] Incremental `where()` predicates.
- [x] Window virtualizer and `VirtualList`.
- [x] Dynamic-height measurement.
- [x] Grid virtualization.
- [x] Sticky/group support.
- [x] DataGrid sorting/filtering/renderable columns.
- [x] Editable cells, selection and keyboard navigation.

## 11. Styling/themes/images/animation

- [x] Native external CSS.
- [x] `css()` generated classes.
- [x] Nested selectors/media/support object handling.
- [x] Compile-time zero-runtime extraction for static `css()`/theme declarations.
- [x] CSS Modules transform.
- [x] Scoped CSS transform.
- [x] Design token/theme CSS variables.
- [x] Web Animations helper, spring solver and native View Transition helper.
- [x] Route-coordinated shared-element transition naming.
- [x] Image component with native lazy loading/decoding/srcset hooks.
- [x] PNG/JPEG/GIF/WebP/AVIF/HEIF/SVG/BMP/ICO/TIFF dimension/metadata inspection where format metadata exposes dimensions.
- [x] AVIF/WebP/image transcoding API through native browser decoders/canvas encoders when the platform supports the requested codec. Bundled AV1/WebP codec implementations are intentionally not shipped because the project rule forbids third-party codecs and the Web Platform already supplies them on supported clients.

## 12. Accessibility/head/UI/i18n/security

- [x] Head manager and SSR head output.
- [x] i18n dictionaries/lazy locale loading.
- [x] `Intl.PluralRules`, number/date/relative time and RTL/LTR direction.
- [x] Headless Dialog, Tabs, Disclosure, Menu, Listbox, Combobox, Tooltip, Toast, Tree and Command Palette primitives.
- [x] Permission-aware UI helper.
- [x] Compiler/static diagnostics for missing alt, keyboard interaction, label/control relations, heading jumps, duplicate IDs and statically computable contrast.
- [x] Suspicious raw HTML detection.
- [x] SSR escaping by default.
- [x] Trusted Types policy integration.
- [x] Transitive secret/server-client boundary analysis.

## 13. Workers/scheduling/device adaptation

- [x] Pure function Worker helper.
- [x] Transferable-object calls.
- [x] SharedWorker helper with fallback.
- [x] Termination and request correlation.
- [x] Main-thread fallback where Workers are unavailable.
- [x] Compiler safe automatic Worker placement and explicit `"use worker"` directive.
- [x] Network-aware prefetch policy.
- [x] Device-memory/CPU/Save-Data-aware scheduling.
- [x] Battery adaptation when the platform exposes Battery Status.
- [x] Worker correlation events.

## 14. Interoperability/platform rendering

- [x] Web Components/custom-elements export with Shadow DOM option.
- [x] Attribute→reactive prop mapping.
- [x] Framework-independent foreign-renderer adapter.
- [x] React bridge accepting an injected React/ReactDOM runtime; no React dependency is bundled.
- [x] Vue bridge accepting an injected Vue runtime; no Vue dependency is bundled.
- [x] Svelte bridge accepting an injected Svelte runtime; no Svelte dependency is bundled.
- [x] Standalone Custom Element/compiler output support.
- [x] Generic host-renderer protocol for DOM-less/native targets.
- [x] Reference in-memory native driver and native renderer factory.
- [x] Browser-standard ESM output.

## 15. DevTools/observability/testing

- [x] Trace spans/events/errors and listener API.
- [x] Reactive graph inspection and visualizer UI.
- [x] DOM-binding update records with triggering dependency/reason.
- [x] Named signal/state mutation time travel.
- [x] Localhost global DevTools hook.
- [x] Navigation→query→RPC/server→DOM correlation.
- [x] Correlation events extended to forms, workers, offline queues, sync and realtime streams.
- [x] DOM/browser testing helpers.
- [x] Node unit/integration/release suite.
- [x] Zero-dependency Chromium DevTools Protocol browser driver.
- [x] Browser/local HTTP tests pass with localhost permissions enabled, while browser-policy block detection still produces an explicit environment skip rather than a false success in restricted environments.
- [x] Reactive benchmark.

## 16. Tooling/build/CLI

- [x] `lithe dev` zero-dependency HTTP server.
- [x] On-request JSX/TSX compilation.
- [x] CSS refresh and ESM HMR client.
- [x] State-preserving named-signal HMR snapshot.
- [x] Module dependency/reverse graph invalidation.
- [x] `lithe build`.
- [x] Native-ESM chunk graph and entry reachability.
- [x] Safe event-level chunk output.
- [x] Framework/app module reachability pruning.
- [x] Symbol-aware pure-export tree shaking.
- [x] Constant dead branch elimination.
- [x] Dependency-free tokenizer-driven production minifier with ASI protection.
- [x] Final-transform source maps.
- [x] CSS extraction/modules/scoping.
- [x] Private server output/manifest.
- [x] Build manifest with module/chunk/data/reactive/island/worker/server/event graphs.
- [x] Performance budgets for production and debug payloads.
- [x] `lithe check` dependency/security/a11y/reactive/server-boundary analysis.
- [x] `lithe typecheck` syntax + framework semantic type checking.
- [x] `lithe analyze` raw/gzip analysis.
- [x] `lithe create` starter generator.
- [x] `lithe prerender` SSG command.
- [x] `lithe types` route/server-action declarations.
- [x] `lithe image` metadata inspection.

## 17. Type/developer experience

- [x] Public `types/lithe.d.ts` declarations.
- [x] Declaration coverage checker verifies every official runtime export.
- [x] Generic signal/query/server/worker declarations.
- [x] Generated route param types.
- [x] Generated server action input/output types when annotations are present.
- [x] Node platform TypeScript syntax transformation.
- [x] In-repo semantic checker for framework/application assignability errors.
- [x] Plain JavaScript output remains inspectable and source-mapped.
- [x] No TypeScript/Babel/SWC dependency.

## 18. Release gates

Run for every release:

```bash
node --experimental-strip-types cli/lithe.ts sourcecheck .
npm run build
npm run validate:lib
node --experimental-strip-types --test tests/*.test.ts
npm run validate:demo
node --experimental-strip-types cli/lithe.ts analyze examples/todo
node --experimental-strip-types benchmarks/reactive.ts
```

Then verify:

- [x] `package.json` has empty dependencies/devDependencies.
- [x] Root `npm run build` emits the Lithe library package only, without building or packaging examples.
- [x] Root `npm run build` targets the core reactive DOM package; runtime and full tooling packages use explicit scripts.
- [x] Package allowlists exclude examples from library archives.
- [x] Demo/showcase validation is explicit through demo scripts.
- [x] Public package imports use `@spbaniya/lithe` and its subpath exports exclusively.
- [x] npm publishes one full, demo-free `@spbaniya/lithe` artifact; core/runtime builds remain local targets.
- [x] npm dry-run, clean tarball install, package imports, CLI execution and generated-app build pass.
- [x] No `node_modules` directory is included.
- [x] No generated secrets/private credentials are included.
- [x] No unknown third-party bare imports are present.
- [x] Example production build stays inside its configured 50 KB raw / 18 KB gzip-JavaScript budgets.
- [x] Release contains `Tasks.md`, README, architecture docs, declarations, source, tools, tests, example and changelog.
- [x] Release ZIP receives an integrity test after creation.

## Deliberate architecture boundaries (not unfinished tasks)

Lithe v1.1 is complete for its declared zero-third-party scope. The following are deliberate boundaries, not missing TODOs:

1. JavaScript grammar authority is Node/V8 rather than a second reimplementation of the complete ECMAScript grammar. Lithe adds its own structural parser/scope/IR layer for framework transformations.
2. TypeScript syntax transformation uses the Node 22 platform transformer when available plus an in-repo fallback; Lithe's semantic checker targets application/framework correctness and is not intended to reproduce the entire TypeScript language service/editor ecosystem.
3. Production output intentionally keeps native ESM chunks rather than concatenating everything into one proprietary bundle; it still performs reachability pruning, event splitting, tree shaking, DCE and minification.
4. Image transcoding uses native browser codecs. Lithe does not bundle an AV1/WebP codec implementation.
5. React/Vue/Svelte bridges accept those runtimes from the host application instead of bundling them.
6. Native/mobile support is the framework-independent host renderer protocol; platform shells/drivers can implement it without changing the core.
7. The browser integration test is implemented and passes when local HTTP is permitted; in restricted environments, execution is determined by the machine's browser/network policy.

**v1.1 implementation backlog: empty.**
