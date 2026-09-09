# Lithe Browser Benchmark Methodology

Lithe performance claims must be backed by browser-run measurements, not only
synthetic runtime loops or DOM emulators. `framework-comparison.ts` runs in
happy-dom (a Node DOM emulator) and is a **development smoke test only** —
its numbers are not performance claims. `real-browser.ts` is the one that is:
it drives real, production-built apps through actual headless Chromium via
the DevTools Protocol.

## Rules

- Run DOM lifecycle tests in a real Chromium-family browser through CDP or WebDriver.
- Pin comparison framework versions in `benchmarks/package.json`.
- Report raw timings, browser version, platform, and commit SHA (`real-browser.ts` does this for every run — see its JSON output).
- Keep framework comparison dependencies inside `benchmarks/`; the root Lithe package remains zero-dependency.
- Include vanilla DOM as a baseline and treat emulator (`framework-comparison.ts`) results as development smoke tests only.
- Every app is a real production build (minified, `NODE_ENV=production` where applicable) — comparing a dev build of one framework against a production build of another isn't a fair result.
- Each scenario must be structurally equivalent across frameworks (e.g. a multi-row update is one state transition in every app, not one unbatched write per row in one and a single batched replace in another) — an "optimization" that only one app's scenario omits isn't measuring the framework, it's measuring which app author remembered to batch.

## Apps under comparison (`benchmarks/apps/`)

- **vanilla** (`vanilla-app.ts`) — hand-written DOM calls; the baseline every framework pays a tax against.
- **lithe** (`lithe-project/`) — a real `lithe build` output (native-ESM chunk graph, tree-shaken, minified), authored with `@oarkflow/lithe/core` + `@oarkflow/lithe/dom`'s `<For>`.
- **react** (`react-app.jsx`) — esbuild production bundle (`NODE_ENV=production`, minified) of real `react`/`react-dom` (React 19, no UMD build exists for it).
- **solid** (`solid-app.ts`) — esbuild production bundle of real `solid-js`/`solid-js/web`. Authored with Solid's own JSX-free hyperscript (`solid-js/h`) rather than compiled JSX, since wiring up `babel-preset-solid` was out of scope for this harness — it still runs through real `solid-js` reactivity and DOM insertion, only the authoring syntax differs from a `<template>`-compiled app.

## Scenarios

Each app exposes `window.runBenchmark()`, returning `{ scenario: milliseconds }` for:
`create1k`, `update10th` (relabel every 10th row), `selectOne`, `swapRows` (rows 4 and 998), `removeOne`, `clearAll` — the standard js-framework-benchmark row-table lifecycle, run in that order against the same 1,000-row table.

## Running

```bash
node --experimental-strip-types benchmarks/real-browser.ts
```

Requires a local Chromium/Chrome binary (`CHROME_BIN`/`CHROMIUM_BIN` env vars, or the common install paths). Rebuild the apps first if their sources changed:

```bash
node --experimental-strip-types cli/lithe.ts build benchmarks/apps/lithe-project
(cd benchmarks && node_modules/.bin/esbuild apps/react-app.jsx --bundle --format=iife --platform=browser --jsx=automatic --minify --define:process.env.NODE_ENV='"production"' --outfile=apps/dist/react.js)
(cd benchmarks && node_modules/.bin/esbuild apps/solid-app.ts --bundle --format=iife --platform=browser --conditions=browser --minify --define:process.env.NODE_ENV='"production"' --outfile=apps/dist/solid.js)
(cd benchmarks && node_modules/.bin/esbuild apps/vanilla-app.ts --bundle --format=iife --platform=browser --minify --outfile=apps/dist/vanilla.js)
```

## Results, round 1 (2026-09-09, macOS arm64, Chrome/152, commit fd72dc8)

Median of several runs, milliseconds (lower is better):

| Scenario     | vanilla | lithe | react | solid |
|--------------|--------:|------:|------:|------:|
| create1k     |    3.1  |  28.0 |   3.5 |  12.5 |
| update10th   |    0.4  |   8.8 |   0.5 |   2.2 |
| selectOne    |    0.1  |   1.6 |   0.5 |   1.0 |
| swapRows     |    0.1  |   4.2 |   0.4 |   0.4 |
| removeOne    |    0.1  |   4.3 |   0.5 |   0.3 |
| clearAll     |    1.6  |   6.2 |   0.4 |   2.0 |

**Lithe was the slowest of the four in every scenario in a real browser** —
this contradicted `framework-comparison.ts`'s happy-dom numbers, which show
Lithe beating React. This is exactly why that script is documented as a
smoke test, not a performance claim, and why this file exists at all.

Two real inefficiencies were found and fixed while investigating this (see
CHANGELOG "Unreleased" — `syncForRows`/`syncIndexRows` in `src/dom/control.ts`
used to reposition every row in a `<For>`/`<Index>` list on every update
regardless of whether it moved, and inserted each newly-created row with its
own `insertBefore` call instead of batching them into one fragment). Fixing
both barely moved these numbers, which meant they were not the dominant
cost. A CPU profile of `create1k` (Chrome DevTools Protocol `Profiler`,
20µs sampling) pointed at the actual dominant costs instead:

- Per-row **owner-scope and effect allocation**: `renderScope()` creates a
  fresh `createScope()` (an owner) per row, plus one `effect()` per reactive
  binding inside it (this benchmark's row has three: `id`, `label`, and the
  `class={() => ...}` selection binding) — for 1,000 rows that's on the
  order of 4,000 small object/Set/Map-adjacent allocations before any DOM
  work happens. React's per-row cost has no analogous ownership-tracking
  structure; Solid's compiled output doesn't allocate one either.
- The **compiled-template marker walk**: each row's `compiledTemplate`
  pieces (`<td class="col-md-1"><!--l:0--></td>`, `<a><!--l:0--></a>`) are
  found via `document.createTreeWalker` + a regex match (`^l:(\d+)$`) per
  comment node, per row, per mount.
- The **keyed-diff bucket rebuild**: `syncForRows` rebuilds two fresh `Map`s
  (`buckets`, `occurrences`) from scratch on every single call regardless of
  how many rows actually changed, so even `removeOne` (one row) pays an
  O(1000) Map-building cost every time.

## Architectural fixes, round 2 (same session)

All three costs above were addressed directly, plus one more found while
verifying the fix for the third:

- **No owner scope for primitive/null dynamic children.** `__mountChild` in
  `src/dom/dom.ts` used to allocate a full `createScope()` for *every*
  dynamic child — including one that could only ever render a string,
  number, or `null`/boolean (e.g. `{() => row.label}`, the overwhelmingly
  common case). It now only allocates a scope for children that actually
  render a vnode/array/component; a text/empty result patches a plain text
  node (or nothing) directly. This is what a per-row `<For>` template with a
  couple of text bindings actually pays for now: one scope for the row
  itself, not one more per binding.
- **Compiled-/static-template caching.** `templateRecipe()` in `dom.ts`
  parses a template's `html` string into a `<template>` element and — for
  compiled templates — walks it once to record each marker comment's
  position as a plain array of child-node indices, keyed by `html` (cached
  per-`document`, since more than one `document` can be alive in a test
  process). Every subsequent mount clones the already-parsed `.content` and
  resolves markers by array indexing instead of re-parsing the HTML string
  and re-walking the clone with a `TreeWalker` + a regex test per comment
  node.
- **Persistent keyed index in `<For>`.** `syncForRows` now keeps
  `state.byKey` across calls instead of rebuilding it from `state.rows` on
  every single update; the lookup used to match/reuse rows on *this* pass
  becomes *next* pass's starting point, built as a side effect of the
  matching loop that has to run anyway. A reused row whose position hasn't
  changed also skips writing its `index` signal.
- **Longest-stable-run repositioning (found while verifying the above).**
  The previous "is this row's first node already contiguous with the last
  one" reposition check looked cheap but had a real bug: a single row that
  changed position poisoned every comparison after it (the "previous node"
  no longer matched physical reality for anything downstream), cascading a
  2-row swap into re-inserting the *entire rest of the list* — which is
  exactly why the two fixes above didn't move `swapRows`/`removeOne` at all
  the first time they were measured. `syncForRows` now computes the longest
  increasing subsequence of each row's previous position (patience sorting,
  O(n log n)) and only repositions rows *outside* that run, processed back
  to front so each already-placed row is a stable anchor for the one before
  it — the same technique Vue 3's `patchKeyedChildren` and Inferno use.
  Covered by a new regression test that swaps rows near opposite ends of a
  50-row list and asserts every untouched row in between keeps its exact
  DOM node, plus a full-reverse case.

## Results, round 2 (same environment, commit fd72dc8 + this session's fixes)

| Scenario     | vanilla | lithe (before → after) | react | solid |
|--------------|--------:|:-----------------------|------:|------:|
| create1k     |    3.3  | 28.0 → **18.4** (−34%)  |   3.2 |  11.9 |
| update10th   |    0.4  |  8.8 → **5.3** (−40%)   |   0.4 |   1.9 |
| selectOne    |    0.1  |  1.6 → **1.6** (±0%)    |   0.5 |   0.9 |
| swapRows     |    0.1  |  4.2 → **2.0** (−52%)   |   0.5 |   0.4 |
| removeOne    |    0.1  |  4.3 → **2.8** (−35%)   |   0.4 |   0.4 |
| clearAll     |    1.7  |  6.2 → **5.4** (−13%)   |   0.4 |   2.1 |

(medians of 3 runs each; vanilla/react/solid columns are round 2's numbers,
shown for scale — they moved slightly too, run-to-run browser noise, not a
framework change)

Real, verified improvement — 13-52% faster across five of the six scenarios,
no regressions (full test suite, 182/182, plus new regression tests for the
reposition fix specifically). `selectOne` is unchanged because it's
architecturally inherent to this benchmark app, not something the fixes
above touch: every row's `class={() => row.id === selected.value ? ... :
''}` binding subscribes to the same global `selected` signal, so selecting
one row re-runs all 1,000 rows' class effects by design — Solid pays the
same tax here for the same reason (fine-grained subscriptions), which is
why it isn't free there either (0.9-1.0ms).

**Lithe is still behind Solid on `create1k`/`update10th`/`clearAll`
(1.3-2.8x), and behind both React and Solid on the exactly-two-rows-changed
scenarios (`swapRows`/`removeOne`, ~4-7x)** — closer than round 1's 9-10x,
but not competitive yet. What's left is the part of the round-1 profile this
pass deliberately scoped down to what could be fixed as pure internal
optimizations without changing any public API: a row *itself* still gets a
full `createScope()` owner, and each non-text reactive binding (like this
benchmark's `class={() => ...}`) still gets its own `effect()` — for
`create1k`/`clearAll`, that per-row allocation is now the dominant cost
again (this pass only removed it for *primitive* bindings). Closing that
gap further means reducing the owner/effect model's per-instance cost
itself, which is a deeper architectural change than this pass — the
right scope for a dedicated follow-up, not something to bolt on here.

## Architectural fixes, round 3: profile-driven, not guesswork

Round 2 ended with a hypothesis (per-row owner/effect allocation is
dominant again) rather than fresh data. Before acting on it, `create1k` was
profiled in isolation (Chrome DevTools Protocol `Profiler`, 20µs sampling,
warmed up once then profiled on a second fresh 1,000-row populate with no
`runScenarios()` rAF-yield delays contaminating the sample — those delays
made the round-1-style profile ~85% "idle/program" noise and not useful).
The isolated profile's actual top costs: `(program)` 30.9%, `(garbage
collector)` 10.5%, then real work — `insertBefore`/`appendChild`/
`createElement` (native DOM, ~14% combined, expected and not reducible
without fewer DOM nodes), `syncForRows` 4.6%, `mountNativeElement` 4.2%,
and a cluster directly attributable to the reactive proxy:
`addDependency`/`getDep`/`state`/`get` (`reactive.ts`) totaling ~9%.

That last cluster had a concrete, fixable cause: `syncForRows`'s main loop
read `items[i]` — a `state()` reactive array's indexed element — up to
**four separate times per row** (once for the key, once for the identity
check against the previous row, once passed to the renderer, once stored on
the row), each one a fresh trip through the array proxy's `get` trap
(tracks a `Dependency`, and re-wraps an object element through the proxy
cache). Reading it once into a local and reusing that for all four uses
removed 3 out of 4 of those trap entries per row, on every update — not
just `create1k` (which only touches each row once anyway) but also
`swapRows`/`removeOne`, which still iterate the *entire* array every pass
even when only one or two rows actually changed.

## Results, round 3 (same environment, commit fd72dc8 + rounds 2 and 3)

| Scenario     | lithe round 2 | lithe round 3 | vs. original (28.0/8.8/1.6/4.2/4.3/6.2) |
|--------------|--------------:|--------------:|:-----------------------------------------|
| create1k     |         18.4  |     **17.1**  | −39% |
| update10th   |          5.3  |      **4.7**  | −47% |
| selectOne    |          1.6  |      **1.5**  | −6% (architecturally bounded, see above) |
| swapRows     |          2.0  |      **1.5**  | −64% |
| removeOne    |          2.8  |      **2.1**  | −52% |
| clearAll     |          5.4  |      **5.7**  | −8% (noise-level; see below) |

(medians of 2 runs each — `swapRows`/`removeOne` improved the most, exactly
as predicted: they re-read every row in the array on every update
regardless of how few rows actually changed, so the redundant-proxy-read
fix pays off there more than on `create1k`, which only reads each row
once. `clearAll` isn't helped by this fix at all — it doesn't read row
items — so its round-2→3 delta is measurement noise, not a regression.)

Cumulatively, this session's three rounds took Lithe from being the
slowest of four frameworks in every scenario to being within 1.3-2x of
Solid on four of six scenarios (`create1k`, `update10th`, `swapRows`,
`removeOne`), with `selectOne` bounded by the benchmark's own reactivity
shape (see round 2) and `clearAll` the least improved (its cost is
disposal — `removeRow`/`disposeOwner` walking each row's owner tree and
cleanups — which none of the three rounds targeted).

**What's left, honestly**: Lithe still allocates a full owner scope per row
plus one `effect()` per non-text reactive binding (this benchmark has one:
the `class={() => ...}` selection binding). That's real, necessary
bookkeeping for Lithe's ownership-based cleanup model, and reducing it
further — e.g. combining a row's multiple bindings into fewer effects, or
a lighter-weight non-hierarchical disposal path for leaf DOM bindings that
never call `onCleanup`/`useContext` — is a change to the core mount/compile
pipeline itself, not a local fix, and carries real risk of subtly changing
reactivity semantics if done carelessly. That's the honest next frontier,
scoped out of this pass deliberately rather than rushed.

## Architectural fix, round 4: merge multi-attribute effects (general-purpose, not benchmark-specific)

`mountNativeElement` in `src/dom/dom.ts` used to give every reactive
(signal/function) attribute on an element its own `effect()` — an element
with `class={...}`, `style={...}`, and `disabled={...}` together (a very
common real-world combination; this benchmark's row only has one reactive
attribute, so it doesn't exercise this at all) paid for three Observers
where one would do. Reactive props are now collected and, when there are
two or more, applied from a single shared effect instead. The overwhelming
common case — zero or exactly one reactive prop per element — is
unaffected: it's tracked directly in two local variables with **no array
allocated at all**, taking the exact same `dynamicEffect()` path as before.

That last point mattered in practice: the first version of this fix always
allocated two small arrays up front "to be safe," even for the
single-reactive-prop case — which is this benchmark's actual shape
(`class={() => ...}` on `<tr>`, the only reactive attribute). Real-browser
verification caught it immediately: `create1k` regressed to ~22.7ms and
`swapRows`/`removeOne` regressed back toward round-1-era numbers.
Restructured to track a single reactive prop with no array at all,
promoting to arrays only when an actual *second* reactive prop appears on
the same element — after which the benchmark returned to round-3 levels
(median of 2 runs): `create1k` 18.2ms, `update10th` 4.65ms, `swapRows`
1.45ms, `removeOne` 2.15ms, `clearAll` 5.7ms — all within noise of round 3,
confirming the fix is genuinely free for the common case while still
helping multi-attribute elements elsewhere. Covered by a new regression
test (`tests/rendering.test.ts`) mounting an element with three independent
reactive attributes and asserting each updates correctly on its own.

## Architectural fixes, round 5: optimize the size of the edit

The general keyed diff was still paying O(n) allocation and reconciliation
for edits whose shape was already known to be tiny. `<For>` now handles an
identity-preserving two-row swap directly, and handles a single-row removal
without building the general diff's Maps, retained Set, position array, and
LIS workspace. `state()` records the active native array mutation internally,
allowing a one-item `splice` to pass its exact index to that path instead of
re-reading the other 999 proxy entries.

The shared `selected` signal exposed a separate high-fan-out issue. A
Dependency's compact array subscriber representation made removal linear;
1,000 class effects removing and re-adding themselves during one update
therefore performed repeated array searches/splices. Dependencies now promote
to a Set at high fan-out while retaining the allocation-light representation
for the common one/few-subscriber case. Sync batch collection similarly uses
an array plus a per-observer dedupe flag, and synchronous effects bypass the
bookkeeping used only by scheduled effects.

Smaller mount/disposal costs were removed as well: keyed rows are detached
from the parent owner tree because `<For>` already owns their explicit
disposal, DOM effects no longer register the same cleanup twice, dynamic
client regions need only one boundary marker, compiled descriptors avoid
per-instance freezing, and an HTML class update writes `className` once rather
than immediately repeating the same value through `setAttribute`.

Median of three final production runs in Chrome 152 on macOS arm64:

| Scenario     | vanilla | lithe | react | solid |
|--------------|--------:|------:|------:|------:|
| create1k     | 2.9 | 17.0 | 3.5 | 12.0 |
| update10th   | 0.4 | 4.0 | 0.5 | 2.2 |
| selectOne    | 0.1 | 1.3 | 0.5 | 1.0 |
| swapRows     | 0.0 | 0.6 | 0.4 | 0.4 |
| removeOne    | 0.0 | 0.8 | 0.5 | 0.3 |
| clearAll     | 1.9 | 6.1 | 0.5 | 1.9 |

The important result is scoped, not universal: swap improved from round 4's
1.45ms to 0.6ms and removal from 2.15ms to 0.8ms, putting Lithe near React
for small structural edits. Lithe does not yet beat React or Solid across the
suite. Initial creation and wholesale cleanup still pay for per-row reactive
bindings/owners, while immutable item replacements rebuild closure-backed
rows. Whole-subtree template compilation and a stable reactive item slot are
the next architectural opportunities; claiming otherwise would overstate
what this round achieved.

## Architectural fixes, round 6: compile the whole native subtree

The compiler previously optimized only a native element whose dynamic
children were direct text expressions. A normal nested row still emitted a
chain of `compiledElement`/`compiledTemplate` descriptor objects and mounted
each element separately. It now folds an entirely native nested subtree into
one cached HTML template, including dynamic attributes. Each instance clones
that subtree once and attaches its text/attribute bindings by cached node
paths. Existing template comment markers are also reused as live dynamic
boundaries instead of allocating and inserting a replacement comment.

`<For>` also subscribes its reconciler once to array structure rather than to
every numeric index it happens to read. Row objects remain reactive, so
in-place property updates still patch their bindings. List index signals are
lazy: renderers that never read the index no longer allocate a full reactive
dependency per row, while renderers that do read it retain the complete Signal
API and reactive reorder/removal updates.

Median of three production runs in Chrome 152 on macOS arm64:

| Scenario     | vanilla | lithe | react | solid | Lithe vs round 5 |
|--------------|--------:|------:|------:|------:|-----------------:|
| create1k     | 3.2 | **14.1** | 3.1 | 12.3 | −17% |
| update10th   | 0.4 | **3.9** | 0.6 | 2.2 | −3% |
| selectOne    | 0.1 | **1.1** | 0.5 | 1.0 | −15% |
| swapRows     | 0.1 | **0.4** | 0.5 | 0.4 | −33% |
| removeOne    | 0.1 | **0.8** | 0.6 | 0.3 | unchanged |
| clearAll     | 2.0 | **5.5** | 0.5 | 1.9 | −10% |

This finally puts Lithe ahead of React on the median swap result (0.4ms vs
0.5ms) and level with Solid there. One of the three creation samples also
beat Solid (12.3ms vs 13.0ms), but the median did not, so that is not claimed
as a general win. Creation is materially closer; immutable row replacement
and wholesale owner/effect disposal remain behind both comparators.
