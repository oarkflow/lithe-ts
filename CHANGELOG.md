# Changelog

## 1.1.3 - 2026-09-04

- added the lightweight `@oarkflow/lithe/signals` entry point
- expanded reactive, router, store, query and runtime behavior with regression coverage
- updated project structure, examples and package exports for the current TypeScript-first layout

## 1.1.0 — 2026-08-23

TypeScript-first source release.

- converted every authored framework runtime module from `.js` to `.ts`
- converted compiler/build/dev/CLI tooling, tests and benchmarks to TypeScript
- converted example component entry points to `.tsx` with explicit domain/form types
- added generic/internal types for reactive core, ownership, scheduler, router, query, schema and forms
- updated build/dev/server splitting to compile TypeScript framework modules into browser/server JavaScript artifacts
- added a TypeScript source-policy regression gate that rejects authored JavaScript implementation files
- added zero-dependency `sourcecheck` for repository TypeScript syntax validation
- added self-contained minimal Node built-in ambient declarations without `@types/node`
- aligned public declarations with implementation types and router overloads
- retained zero dependencies/devDependencies and the original lightweight production budgets

## 1.0.0 — 2026-08-23

First completed zero-dependency Lithe release.

Highlights:

- fine-grained signals/proxy state, lifecycle ownership and adaptive scheduling
- compiler-generated direct DOM plus static template hoisting
- keyed/indexed reconciliation, hydration, islands and resumable named bindings
- independent safe event-handler chunks and native-ESM production graph
- nested/parallel/intercepted router and generated route types
- persistent/infinite query system and automatic tag invalidation
- advanced forms, field arrays, async validation, AutoForm and OpenAPI/JSON Schema output
- server actions, `.server.*` isolation, automatic/directive server placement, SSR/streaming/SSG/ISR and edge adapters
- IndexedDB/offline queues, Background Sync, local-first sync and LWW CRDT collaboration
- virtualization, DataGrid and headless accessible UI primitives
- CSS extraction/modules/scoping, themes, animation and image metadata/transcoding platform bridge
- Worker/SharedWorker helpers and safe compiler Worker placement
- Web Components, injected React/Vue/Svelte bridges and generic native host renderer
- DevTools graph/update tracing/time travel and end-to-end correlation events
- zero-dependency HMR dev server, checker, type checker, tree shaking, DCE, minifier, source maps, build budgets, prerender and declaration generation
- complete official declaration coverage and expanded regression/release suite
