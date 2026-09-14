# Changelog

## Unreleased

### Performance pass: reactive core, list growth, hydration correctness — plus a crash found and fixed by real-browser verification

A perf-focused audit (4 parallel agents over the reactive core, DOM
reconciliation, compiler, and SSR/hydration) found and fixed real
algorithmic issues, then a real-browser run (not just happy-dom/unit tests)
caught a genuine crash before it shipped — see below.

- **`core/reactive.ts`**: `Observer`/`ComputedImpl` deduped tracked
  dependencies via `Array.prototype.indexOf` — O(n) per tracked read, O(n^2)
  per evaluation for any effect/computed with many dependencies. Now O(1)
  via a `Set` mirror. `Observer.run()` also no longer allocates its
  invoke/cleanup-adder closures on every re-run (hoisted to the
  constructor), and `signal()`/`computed()` no longer force a `{}`
  allocation for the common no-options call.
- **`core/scheduler.ts`**: draining a flush queue used
  `Array.prototype.shift()`, which re-indexes the array on every call —
  O(n^2) for a batch of N pending effects. Now an O(n) index-based drain
  with O(1) tombstone cancellation instead of `indexOf`+`splice`.
- **`core/store.ts`**: `store.patch` computed a cache key by walking the
  whole source tree, then re-descended from the target root once per leaf
  — O(depth * leafCount) through the reactive proxy. Replaced with a
  single-pass recursive merge that visits each node once.
- **`server/ssr.ts`**: `ownerTree()` (walks + clones a component's owner/
  context subtree) ran on every function-component render even when
  `resume` wasn't requested — pure discarded work. Now skipped entirely
  when resume is off. `escapeHTML`/`safeJSON` did 5 sequential
  `replaceAll` passes each; now one regex pass.
- **`dom/control.ts`, `<For>`**: added a pure-append fast path — appending
  new items onto an unchanged list (infinite scroll, live feeds, "load
  more") previously fell through to the general Map+LIS keyed diff, paying
  full reconciliation cost for rows that didn't change at all. Measured:
  500 sequential appends onto a 2,000-row list, 621ms -> 47ms (13x).
- **`dom/hydrate.ts`**: attribute-marker resolution for compiled templates
  re-scanned every descendant element (`querySelectorAll('*')` +
  `hasAttribute` per binding) on every hydrate call; now reuses the same
  cached template-shape index `dom.ts` already builds for CSR mounting,
  with a safe fallback when the cached shape can't be trusted.
- **`dom/dom.ts`, `dom/vnode.ts`**: removed a redundant props-object
  allocation on every component mount (`{...vnode.props, children}` when
  `vnode.props` was already the final, uniquely-owned object), hoisted a
  per-call closure out of `h()`, and added fragment-batching for a bare
  array/Fragment of >1 children mounted directly into an already-attached
  parent (was one `insertBefore` per child).
- **`compiler/jsx.ts`**: a component tag nested inside a native element
  used to disqualify the *whole* enclosing subtree from template-cloning
  (`<div><Child/><span>hi</span></div>` fell back to `createElement` +
  separate clones per child). The compiler now treats a nested component
  tag as a binding marker, the same way it already treats a `{expr}`
  child, so the common "native wrapper around component children" shape
  compiles to one cloneable template.

**Hydration correctness fix, found while verifying the above**: compiled-
template *content* bindings (`{expr}` children, not attributes) were
silently never re-wired for reactivity after `hydrate()` — the code was
searching for `<!--l:s:N-->`/`<!--l:e:N-->` marker pairs that
`renderCompiledTemplate` never actually emits for ordinary bindings (only
named-signal resume markers use that format, on an unrelated page-wide
counter, and only coincidentally matched in trivial single-binding pages).
Fixed by walking the cached offline template shape in lockstep with the
live SSR DOM and handing each binding's position to `setupDynamicRegion`
— the same structural `claim()` mechanism ordinary dynamic children
already use for hydration — instead of any marker protocol. This also
surfaced and fixed two related SSR text-coalescing bugs (one of them
**pre-existing in the generic, non-compiled-template hydration path
too**): adjacent static/dynamic text merging into one Text node with no
recoverable boundary (fixed by extending the existing `joinRenderedSiblings`
separator technique into `renderCompiledTemplate`), and a null/false
conditional child silently letting its *non-adjacent* static neighbors
merge (fixed in `joinRenderedSiblings` itself by tracking the last
non-empty sibling instead of strictly the previous one, closing the gap
for both hydration paths at once).

**Crash found and fixed by real-browser verification, not caught by the
test suite or happy-dom**: wrapping a component as a compiled-template
binding (the fix above) routes it through `__mountChild`'s dynamic-child
branch, which mounts into a throwaway `DocumentFragment` before moving its
contents into the real container in one `insertBefore` call. `For`/
`Index`/`Suspense`'s (and `Island`'s deferred-activation) internal
reactive effects closed over that fragment as their working `parent` —
correct for the initial synchronous mount, but stale forever after, since
the fragment is discarded once its children move. Any later reactive
update called `insertBefore` against a node that no longer contained its
target, throwing `NotFoundError` in a real browser (happy-dom did not
reproduce this). Confirmed as a pre-existing, general bug reachable by
ordinary user code too — `{() => <For>...}` as an explicit dynamic child,
with no compiled template involved — not something the compiler change
introduced, just something it made much easier to hit. Fixed generally:
`For`, `Index`, `Suspense`, and `Island` now re-derive their working
parent from a stable marker node (`end.parentNode` /
`contentMarker.parentNode` / `placeholder.parentNode`) on every run
instead of trusting a closed-over `parent` argument that can go stale.
Full real-browser benchmark suite re-verified green after the fix (no
crash across 3 runs); real-browser numbers for this benchmark app were
also **not** a broad win over React/Solid the way the happy-dom-only
numbers first suggested for `create1k`/`update10th`/`selectOne`/
`swapRows`/`removeOne`/`clearAll` — reported honestly rather than only the
favorable happy-dom comparison, consistent with this project's existing
"real browser, not the emulator" verification standard (see
`benchmarks/browser-methodology.md`).

### Real browser-vs-React/Solid benchmark

- Added `benchmarks/apps/` and rewrote `benchmarks/real-browser.ts`: real,
  production-built apps (Lithe via `lithe build`, React and Solid via esbuild
  production bundles, plus a hand-written vanilla baseline) driven through
  actual headless Chromium via CDP — not the happy-dom emulator
  `framework-comparison.ts` uses, which is a development smoke test only.
  See `benchmarks/browser-methodology.md` for the full methodology, apps,
  and results.
- **Honest result, not a good one**: Lithe is currently the slowest of the
  four in every scenario measured (`create1k`, `update10th`, `selectOne`,
  `swapRows`, `removeOne`, `clearAll`) in a real browser — this contradicts
  `framework-comparison.ts`'s happy-dom numbers, which show Lithe beating
  React. Profiling (Chrome DevTools Protocol `Profiler`, 20µs sampling) of
  `create1k` points at per-row owner-scope/effect allocation, the
  compiled-template marker walk (`document.createTreeWalker` + a regex
  match per comment node per row), and `<For>`'s keyed-diff rebuilding two
  fresh `Map`s from scratch on every update regardless of how much changed,
  as the actual dominant costs — see browser-methodology.md for detail.
  These are architectural, not one-line fixes, and are flagged as the
  starting point for a dedicated performance pass rather than rushed here.
- Two real (smaller, but genuine) inefficiencies found and fixed while
  investigating: `For`/`Index`'s reconciliation (`syncForRows`/
  `syncIndexRows` in `src/dom/control.ts`) used to reposition every row's
  DOM nodes on every update via `insertBefore`, even rows that never moved
  at all — now it only moves a row when its current DOM position doesn't
  already match its target position. Newly-created rows were also each
  inserted with their own separate `insertBefore` call instead of being
  batched into one shared fragment and inserted once.
- `core/owner.ts`'s `Owner.children`/`Owner.contexts` (a `Set` and a `Map`)
  are now lazily allocated on first write instead of eagerly on every
  `createScope()` call — the large majority of owners (one per row in any
  keyed list, for example) never receive a child scope or a provided
  context, so eagerly allocating both for every single one was pure
  per-instance overhead paid by code that never used either.

### Architectural performance pass: closing the round-1 gap

Directly addressed the three dominant costs the round-1 profile identified,
plus one more found while verifying the third fix — measured, real
improvement, not a rewrite that merely looks better: 13-52% faster across
five of six real-browser scenarios, full test suite still green (182/182),
new regression tests added for the trickiest fix. See
`benchmarks/browser-methodology.md` "round 2" for full before/after numbers
and root-cause detail; summary:

- **`src/dom/dom.ts`, `__mountChild`**: no longer allocates a `createScope()`
  owner for a dynamic child that only ever renders text or nothing (the
  overwhelmingly common case — `{() => item.label}`-style bindings). Only a
  child that actually renders a vnode/array/component gets a scope now.
- **`src/dom/dom.ts`, `templateRecipe()`** (new): compiled/static templates'
  `html` string is a compile-time constant re-parsed into a fresh
  `<template>` and re-walked with a `TreeWalker` + a regex test per comment
  marker on *every single mount* — now parsed and walked exactly once per
  `document`, cached by `html`; every later mount clones the cached
  `.content` and resolves markers via plain array indexing.
- **`src/dom/control.ts`, `syncForRows`**: `state.byKey` (the keyed lookup
  used to match/reuse rows) now persists across updates instead of being
  rebuilt from `state.rows` from scratch on every single call — the lookup
  built for *this* pass's matching is exactly next pass's starting point.
  Reused rows whose position hasn't changed also skip writing their `index`
  signal.
- **`src/dom/control.ts`, `syncForRows` reposition** (found verifying the
  above didn't move `swapRows`/`removeOne` at all): the existing "reposition
  a row only if it isn't already contiguous with the previous one" check had
  a real bug — a single moved row poisons every comparison after it (the
  physical "previous node" no longer matches reality for anything
  downstream), turning a 2-row swap into re-inserting the entire rest of the
  list. Replaced with a longest-increasing-subsequence pass (patience
  sorting, O(n log n)) over each row's previous position — the technique
  Vue 3's `patchKeyedChildren` and Inferno use — so only rows genuinely
  outside the stable run get an `insertBefore` call, processed back-to-front
  so each already-placed row anchors the one before it. New regression test
  (`tests/rendering.test.ts`) swaps rows near opposite ends of a 50-row list
  and asserts every untouched row in between keeps its exact DOM node, plus
  a full-reverse case.
- `tests/release.test.ts`'s core-runtime gzip budget bumped 30,000 →
  31,000 bytes to cover the ~150 bytes the fixes above add — a fair trade
  for the measured wins, not bloat.

### Architectural performance pass, round 3: profile-driven follow-up

A fresh, isolated CPU profile of `create1k` (not contaminated by
`runScenarios()`'s rAF-yield delays between scenarios, unlike round 1's)
found `syncForRows` in `src/dom/control.ts` reading a `state()` reactive
array's `items[i]` up to four separate times per row per pass (key,
identity check, renderer call, stored item) — each a fresh trip through the
array proxy's `get` trap (dependency tracking + object re-wrap). Now read
once into a local and reused. Real-browser results (median of 2 runs,
milliseconds): `create1k` 18.4 → 17.1, `update10th` 5.3 → 4.7, `swapRows`
2.0 → 1.5, `removeOne` 2.8 → 2.1 — `swapRows`/`removeOne` improved the most
since they re-read the *entire* array every update regardless of how few
rows changed. See `benchmarks/browser-methodology.md` "round 3" for the
full profile breakdown and cumulative before/after across all three rounds.

### Architectural performance pass, round 4: merge multi-attribute effects

`mountNativeElement` in `src/dom/dom.ts` now shares one `effect()` across
all of an element's reactive attributes instead of giving each its own —
real savings for elements with several reactive props together (`class` +
`style` + `disabled`, etc.), which this session's benchmark app doesn't
happen to exercise (its only reactive prop is a single `class`). The
zero-or-one-reactive-prop case — the overwhelming common one — is tracked
without allocating any array at all, so it pays nothing extra.

**Caught by verification, not by luck**: the first version of this
allocated two small tracking arrays unconditionally, even for the
single-prop case. Re-running the real-browser benchmark immediately showed
`create1k` regressing to ~22.7ms (from round 3's ~17ms) — a clear signal
this "obviously safe" refactor wasn't. Fixed by tracking a single reactive
prop in two plain locals with no array, only promoting to arrays once an
actual second reactive prop appears; the benchmark then returned to round-3
levels. This is exactly why every round in this pass got measured on the
real benchmark rather than assumed correct from reading the diff — see
`benchmarks/browser-methodology.md` "round 4" for the full account and
numbers. New regression test in `tests/rendering.test.ts` covers an element
with three independent reactive attributes updating correctly on their own.

### Architectural performance pass, round 5: small-edit and fan-out fast paths

- `<For>` now recognizes identity-preserving two-row swaps and single-row
  removals before allocating the general keyed diff's Maps, Sets, position
  arrays, and longest-increasing-subsequence workspace. Reactive arrays also
  expose the active native-mutation hint internally, so a one-item `splice`
  reuses its already-known index instead of scanning the other 999 rows.
- Dependencies promote their subscriber storage from the allocation-light
  one/few-subscriber representation to a `Set` at high fan-out. This changes
  cleanup after a shared signal update from repeated linear array splices to
  constant-time deletion; the benchmark's selected-row signal has 1,000
  subscribers. Sync batch deduplication now uses an indexed array plus an
  observer flag instead of a hash Set, and skips asynchronous queue state for
  effects that execute synchronously.
- Keyed rows use detached-but-explicitly-owned scopes, dynamic client regions
  use one boundary marker instead of two, HTML class updates no longer write
  both `className` and the identical `class` attribute, and DOM effects no
  longer register the same owner cleanup twice.
- Chrome 152 median of three production runs: `create1k` 17.0ms,
  `update10th` 4.0ms, `selectOne` 1.3ms, `swapRows` 0.6ms, `removeOne` 0.8ms,
  `clearAll` 6.1ms. The targeted wins versus round 4 are swaps (1.45 → 0.6),
  removals (2.15 → 0.8), and high-fan-out selection (~1.5 → 1.3); mount and
  wholesale disposal remain the next compiler/runtime bottlenecks.
- The core release budget moves from 101 KB to 104 KB raw and 31.0 KB to
  31.5 KB gzip for these paths; the measured build is about 103.4 KB raw and
  31.2 KB gzip.

### Architectural performance pass, round 6: whole-subtree templates

- The JSX compiler now folds nested all-native subtrees with dynamic text and
  attributes into one cached compiled template. A benchmark row that formerly
  allocated a chain of five element/template descriptors now clones one native
  subtree and resolves all bindings through cached node paths. Compiled marker
  comments double as live dynamic boundaries, removing two DOM operations per
  text binding. SSR and hydration support the new attribute bindings too.
- `<For>` tracks one structural array dependency instead of subscribing its
  reconciler to all 1,000 numeric indices, and its index signals allocate a
  full dependency only when a renderer actually observes the index.
- Chrome 152 median of three production runs: `create1k` 14.1ms,
  `update10th` 3.9ms, `selectOne` 1.1ms, `swapRows` 0.4ms, `removeOne` 0.8ms,
  `clearAll` 5.5ms. Versus round 5 this is 17% faster creation, 15% faster
  selection, 33% faster swapping, and 10% faster clearing. The swap median
  now beats React (0.5ms) and ties Solid (0.4ms); remaining gaps are documented
  without claiming a suite-wide win.

### New feature: `Suspense`

- Added a real `Suspense` boundary (`@oarkflow/lithe/dom`, also re-exported
  from the root/runtime entry). `query()`/`resource()` now report a pending
  fetch to the nearest ancestor `Suspense` automatically via a new
  `core/suspense.ts` context (`SuspenseContext`/`registerSuspense`) — a
  subtree can show one fallback for however many resources it starts
  without each one manually checking its own `.loading`. Only the initial
  load of a resource suspends its boundary; a later manual `refresh()` is
  "stale while revalidating" and does not re-trigger the fallback, matching
  the React/Solid convention.
- The initial implementation swapped between fallback/content with a single
  reactive region driven by the pending count — natural-looking, but
  actually broken: flipping from fallback back to content re-invoked every
  descendant component from scratch, so a component whose resource call
  isn't itself cached would register a brand-new pending promise on that
  remount and immediately flip back to the fallback again, never settling.
  Caught before shipping by testing an end-to-end resolve, not just the
  initial fallback render. Content is now mounted exactly once for the
  boundary's lifetime; only its DOM attachment (not its reactive scope) is
  toggled, so an already-resolved resource is never re-fetched by the
  boundary's own state changes. `Suspense` also claims hydrated SSR content
  correctly (`__litheClaim`), consistent with the `For`/`Index`/`Portal`/
  `Island` hydration work above. SSR itself renders `Suspense`'s children
  directly without waiting on pending resources — an existing, unchanged
  characteristic of the data layer's SSR story, not something new here.

### Dev server: in-browser error overlay

- `lithe dev` now shows compile errors, unexpected dev-server errors,
  uncaught runtime exceptions/unhandled promise rejections, and hydration
  mismatches in a full-screen in-browser overlay (installed by the HMR
  client, so it's active before app code runs) instead of only a console
  stack trace — a compile/server-side error is served as a valid,
  executable module that reports itself to the overlay rather than as raw
  stack-trace text a `<script type="module">` would otherwise try (and
  fail) to parse as JavaScript, and the overlay dismisses itself
  optimistically on the next accepted HMR update
- Fixed a bug introduced and caught while building this: the per-request
  error handler referenced `url` (parsed inside the `try` block it was
  written to catch errors from) from its `catch` block, where a
  block-scoped `const` isn't visible — every unexpected dev-server error
  would have thrown a second, masking `ReferenceError` instead of reaching
  the overlay. Caught by a regression test that actually imports the error
  response as a module rather than just checking its text, and by a real
  headless-Chromium test that loads a throwing app and asserts the overlay
  is visible in the page.

A correctness audit swept the reactive core, router, data/query layer,
compiler/build pipeline, server/security, DOM/rendering and forms — 30
confirmed bugs fixed, verified with new regression tests, full suite green.

- **reactive core**: sync `subscribe()`/`effect({sync:true})` observers no
  longer double-fire with a torn intermediate value when two dependencies of
  the same downstream computed change from one write (diamond-dependency
  glitch); a reentrant write from inside a running sync observer is no
  longer silently dropped; `watch(..., {deep:true})` no longer reports
  deeply-nested-but-equal values (depth > 5) as changed
- **router**: `navigate()` no longer commits the URL/history when middleware
  denies access without calling `next()`; a slower, superseded `navigate()`
  call can no longer overwrite a faster, later one; a denied navigation's
  result is no longer cached and served to a later, actually-allowed attempt
- **data/query**: `invalidate()` no longer treats array key segments as tags,
  which could stale an unrelated query sharing a coincidental tag value; a
  disposed `query()` can no longer be resurrected via `refresh()`; a
  superseded `infiniteQuery` fetch can no longer clear the loading state of
  the newer fetch that replaced it
- **compiler/build**: the production minifier no longer joins statements
  across an original line break (a real ASI-hazard, not an edge case — it
  broke any semicolon-less source); dead-branch elimination now correctly
  handles `if(true/false){}else if(...){}else{}` chains instead of leaving a
  dangling `else`; tree-shaking no longer deletes array/object literals
  containing `++`/`--`/assignment side effects as "pure"; static JSX
  markup no longer corrupts literal text that happens to contain
  `className=`/`htmlFor=`; unsafe event-handler capture extraction now
  detects `delete captured.prop`; the TypeScript fallback stripper now
  expands constructor parameter properties instead of dropping their
  `this.x = x` assignment (and typed class method/constructor params no
  longer crash it)
- **server/security**: a `permission`-protected server action now fails
  closed instead of silently public when no `context.can` is wired in;
  the same permission/CSRF checks are now enforced for the
  `/_lithe/module/:id/:name` route, not just `/_lithe/action/:id`; CSRF
  tokens issued by `createCSRF()` are now actually verified server-side
  (previously never wired into request handling at all); SSR now rejects
  an attacker-controlled attribute *name* instead of emitting it literally
  (a spread-prop injection vector no amount of value-escaping can close);
  template rendering no longer corrupts output containing literal `$$`/`` $` ``
  sequences; a failed ISR revalidation is now caught instead of becoming an
  unhandled rejection that can crash the whole process; offline mutation
  queue `flush()` is now reentrant-safe and can no longer deliver the same
  mutation twice
- **DOM/rendering**: `ErrorBoundary` now actually catches errors thrown
  while mounting its children and renders its fallback (previously it never
  caught anything); delegated root event listeners are now reference-counted
  so disposing one mount sharing a root no longer kills event delegation for
  other still-active mounts on the same root; `lazy()` now notifies every
  already-mounted instance once the shared module load resolves, not just
  whichever instance happened to start the load
- **forms**: `.default(x).optional()` now applies the default for
  `undefined` input instead of silently discarding it; `reset(next)` now
  moves the dirty-tracking baseline to `next` instead of comparing forever
  against the form's original construction-time values; `submit()` now
  re-runs registered `fieldValidators` and blocks on their failure instead
  of only checking the schema; `fieldArray().insert/remove/move` now
  re-index `errors`/`touched`/`dirty` so they follow the shifted item
  instead of staying pinned to the old index
- **grid/virtualization**: `DataGrid.commitEdit` now resolves the edited row
  by a stable key instead of a raw index, so a sort/filter that happens
  while a cell is being edited can no longer commit the value to the wrong
  row; the virtualizer's measurement cache is now true LRU instead of FIFO,
  so a repeatedly-remeasured but still-visible row is no longer the first
  one evicted

The hydration/Portal gaps noted above have since been closed (see below);
`Portal` content being outside the delegated-event root's subtree remains
open — it needs either a change to where delegation is installed or a
dedicated event bridge, and is a candidate for a future pass.

### Hydration, array reactivity and forms follow-up

- **hydration**: `hydrate()`/`claim()` now dispatches to `For`/`Index`/
  `Portal`/`Island`'s own claim logic instead of falling back to generic
  mounting — `For`/`Index` claim their server-rendered rows and keep real
  keyed-row identity across a later update instead of a full remount on
  every change; `Portal` claims its content in place and relocates it to
  the real target, matching a fresh client mount; `Island` claims its real
  server-rendered children directly instead of mismatching against its
  CSR-only fallback shape (deferred/lazy activation policies are not yet
  applied during hydration — see the code comment on `Island.__litheClaim`)
- **hydration**: fixed a separate, previously-undiscovered bug found while
  verifying the above — any element with more than one text/signal child
  (e.g. `<button>clicks: {count}</button>`) always mismatched and fell back
  to a full remount, because the HTML parser coalesces adjacent text into a
  single DOM Text node while `claim()` expected one node per vnode child;
  SSR now inserts an empty comment between two text-adjacent renders and
  `claim()` skips it back out
- **reactive core**: fixed a second previously-undiscovered bug found in
  the same pass — `state()` array mutator methods (`push`/`splice`/`sort`/
  etc.) perform their work as several separate low-level writes, each of
  which independently notified subscribers; a sync effect/computed reading
  the array mid-call could observe a torn intermediate state (in the worst
  case, indexing past a not-yet-updated `length` into a hole and crashing).
  Array mutator calls are now batched as one atomic operation
- **forms**: `Schema.refine()` now accepts `{ message, path }`, so a
  cross-field check (e.g. "confirm password must match") can attach its
  issue to a specific child field — previously such a check's issue always
  landed on the object schema's own root path, which no field's `.error`
  could ever read, making the check effectively invisible in any form UI;
  `email()`/`url()` now tag `meta.format` (`toJSONSchema()` emits the
  corresponding `format: "email"`/`"uri"`) instead of leaving it for
  `refine()` to silently drop; `AutoForm` now renders `array()`-typed
  schema fields as an actual add/remove field-array UI instead of a bare
  text input, generates a unique `id` per control with a matching
  `<label for>`, and wires `aria-invalid`/`aria-describedby` to the visible
  error message

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
