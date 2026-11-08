# Lithe Framework Guide

This guide covers the public framework surface in Lithe: how to start an app,
choose imports, use the runtime and compiler, and understand the limits of each
platform feature. The package export map in `package.json` is authoritative;
this guide describes the user-facing groups and their current contracts.

## Contents

- [What Lithe is](#what-lithe-is)
- [Install and create an app](#install-and-create-an-app)
- [Run, check, and build](#run-check-and-build)
- [Choose package entry points](#choose-package-entry-points)
- [Reactive programming](#reactive-programming)
- [Components and DOM rendering](#components-and-dom-rendering)
- [Compiler and TypeScript](#compiler-and-typescript)
- [Routing and navigation](#routing-and-navigation)
- [Queries, mutations, and streams](#queries-mutations-and-streams)
- [Forms and schemas](#forms-and-schemas)
- [Server rendering and server functions](#server-rendering-and-server-functions)
- [Offline and synchronization](#offline-and-synchronization)
- [Styling, UI, images, animation, and head](#styling-ui-images-animation-and-head)
- [Collections, virtualization, and grids](#collections-virtualization-and-grids)
- [Workers, permissions, and scheduling](#workers-permissions-and-scheduling)
- [Interop and host renderers](#interop-and-host-renderers)
- [DevTools, observability, and testing](#devtools-observability-and-testing)
- [Build integrations and output](#build-integrations-and-output)
- [CLI reference](#cli-reference)
- [Support and limitations](#support-and-limitations)
- [Further reading](#further-reading)

## What Lithe is

Lithe is a TypeScript-first, compiler-led UI and application framework. Its
reactive runtime updates the DOM bindings that depend on changed values. The
compiler lowers TSX into DOM-oriented instructions and static templates; it
does not require a virtual DOM diff for ordinary compiled elements. Routing,
queries, forms, server rendering, offline primitives, and build tooling are
available as optional package entry points.

The framework and its build tools have no third-party dependencies. Node.js
22.6 or newer is required for the framework CLI and repository tooling. The
browser is the primary runtime. Optional modules are separate imports so a
small client can avoid pulling in higher-level framework features.

## Install and create an app

Install the package and create a project:

```sh
npm install @oarkflow/lithe
npx lithe create my-app
cd my-app
npx lithe dev .
```

The default browser entry is `src/index.tsx`; its HTML page points to that
source entry and the Lithe dev server/build pipeline compiles it. A minimal
component can use the small default entry:

```tsx
import { signal } from '@oarkflow/lithe/signals';
import { createRoot } from '@oarkflow/lithe/dom';

const count = signal(0);

function Counter() {
  return <button onClick={() => count.value++}>Count: {count}</button>;
}

createRoot(document.getElementById('app')!).render(<Counter />);
```

`createRoot` returns a root handle with `render` and `unmount`. Unmounting
disposes the reactive owner scope and listeners created under that root.
Alternatively use `mount(container, view)` when a root handle is not needed.

## Run, check, and build

The installed CLI can run project tasks. From this repository, prefix it with
Node's TypeScript stripping flag:

```sh
node --experimental-strip-types cli/lithe.ts dev examples/todo --port=3000
node --experimental-strip-types cli/lithe.ts build examples/todo --bundle=chunks
node --experimental-strip-types cli/lithe.ts preview examples/todo --port=4173
```

Use `lithe create <directory>` for a starter, `lithe check <project>` for
framework diagnostics, and `lithe typecheck <project>` for Lithe's TypeScript
syntax and semantic checks. `lithe sourcecheck <repository>` checks Lithe's own
source policy. `lithe analyze <project>` reports built output sizes, while
`lithe doctor <project>` runs project health checks. See [CLI reference](#cli-reference)
for all commands and flags.

Useful repository scripts include `npm run build`, `npm run build:runtime`,
`npm run build:full`, `npm run build:demo`, `npm run test`,
`npm run validate:lib`, and `npm run validate:demo`.

## Choose package entry points

Import only the capabilities an app uses. The root entry is a convenience
runtime entry; explicit paths make the client dependency graph clearer.

| Import | Provides |
| --- | --- |
| `@oarkflow/lithe` or `/runtime` | Signals and `mount`/`createRoot` |
| `/signals` | Minimal signals, computed values, effects, state, scheduler, transitions |
| `/core` | Reactivity, stores, contexts, ownership, scheduling, adaptive behavior, resume, suspense |
| `/dom` | DOM mount, JSX runtime, control flow, hydration, resume, events, portals |
| `/jsx-runtime`, `/jsx-dev-runtime` | Automatic JSX runtime entry points |
| `/router` | Router, routes, loaders, links, navigation and route helpers |
| `/data` | Query cache, resources, mutations, pagination, streams |
| `/forms` | Schemas, forms, validation, generated forms and schema emitters |
| `/server` or `/rpc` | SSR, HTTP adapters, server actions/RPC, security helpers and ISR |
| `/offline`, `/sync` | Network/storage queues, service worker helpers, local-first sync and CRDTs |
| `/collection`, `/virtual`, `/grid` | Reactive collections, virtual lists and data grids |
| `/style`, `/i18n`, `/head`, `/image`, `/animation` | Styling, localization, document metadata, images and animation |
| `/ui`, `/permissions` | Headless UI primitives and permission-aware rendering helpers |
| `/worker`, `/interop` | Worker helpers, web components, injected bridges and host renderers |
| `/observability`, `/devtools`, `/testing` | Tracing, graph diagnostics and test helpers |
| `/app` | App configuration conventions and startup helper |
| `/compiler` | JSX/TSX compiler, source maps, diagnostics and analysis helpers |
| `/plugins`, `/vite`, `/rollup`, `/babel`, `/tailwind` | Build integration adapters |
| `/experimental` | Experimental compiler, host renderer and virtualizer exports |

The complete machine-readable map is the `exports` field in `package.json`.
Some functions have similar names across modules; import from the documented
subpath rather than relying on undocumented deep source paths.

## Reactive programming

Signals are mutable values with a `.value` property. `computed` derives a
read-only value and tracks dependencies when read. `effect` tracks reads and
runs again when those dependencies change. Updates are synchronous at the
framework's scheduling boundary; `batch` coalesces observer work.

```tsx
import { batch, computed, effect, signal } from '@oarkflow/lithe/core';

const first = signal('Ada');
const last = signal('Lovelace');
const fullName = computed(() => `${first.value} ${last.value}`);
const stop = effect(() => console.log(fullName.value));

batch(() => {
  first.value = 'Grace';
  last.value = 'Hopper';
});
stop(); // stop this effect
```

Core primitives:

- `signal` / `computed`: mutable and derived reactive values.
- `effect` / `watch`: run side effects or observe a source, with cleanup/dispose.
- `createSelector`: keyed boolean selection that limits notifications to keys
  whose selected state changes.
- `state`: reactive proxy wrapping for object/array state.
- `batch`, `untrack`, `unwrap`, `isSignal`: update grouping and tracking helpers.
- `schedule`, `flushSync`, `transition`: scheduler and update-priority tools.
- `createScope`, `onMount`, `onCleanup`, `createContext`, `useContext`:
  lifetime, cleanup, and dependency injection.

Stores (`createStore`, `defineStore`) provide selector subscriptions, actions,
imperative `getState`, and optional middleware for persistence, history,
DevTools, immutable `produce`, and context-scoped instances. Use signals for
local fine-grained values; stores suit shared application state and action
boundaries. Ownership is hierarchical: effects and DOM work created inside a
scope are disposed with it.

## Components and DOM rendering

Components are ordinary functions returning JSX-compatible values. Reactive
expressions in compiled JSX become targeted bindings. Native static markup is
eligible for template hoisting. Event attributes use Lithe's event handling;
refs, properties, class/style updates, and SVG/namespace nodes are handled by
the DOM renderer.

The DOM entry exposes `mount`, `createRoot`, `hydrate`, and `resumeDocument`.
Control-flow and composition helpers include:

- `Show`: conditionally renders a value or fallback.
- `For`: keyed list rendering; use a stable key when item identity matters.
- `Index`: indexed list rendering for position-stable collections.
- `Switch` / `Match`: render the first matching conditional branch.
- `Dynamic`: render a component or element selected at runtime.
- `Portal`: renders content into another DOM target.
- `ErrorBoundary`: catches errors from a rendered subtree and displays a
  fallback.
- `Suspense`: displays a fallback while registered async resources are pending.
- `Await`: renders the outcome of an asynchronous value.
- `lazy` / `lazyEvent`: defer loading a component or event handler module.
- Island helpers: defer selected UI until a `load`, `idle`, `visible`, or
  media-query activation policy is met.

Dynamic expressions may return text, DOM nodes, arrays, components, or
nullish values. Always render untrusted values as ordinary text. For deliberate
HTML injection, configure an appropriate Trusted Types policy and pass the
trusted value through the supported DOM helpers; do not treat user strings as
trusted markup.

Hydration claims existing server markup and attaches reactive behavior. Resume
reconnects serialized named bindings and event symbols without rebuilding the
component tree when the required metadata is present. Resumability depends on
serializable state and compiler-recognized references; it is not automatic for
arbitrary closures or values.

## Compiler and TypeScript

Lithe compiles TSX and JSX into JavaScript and DOM operations. The compiler
includes JSX parsing/lowering, static template generation, source maps,
accessibility diagnostics, reactive-graph diagnostics, island detection,
worker-placement analysis, and framework-aware type checks. Production builds
can split route and event chunks or emit a single bundle.

TypeScript source is supported directly by the Node 22.6+ toolchain and by
Lithe's compiler. The in-house `typecheck` catches common syntax and
framework-boundary issues; it is **not** the full TypeScript compiler or editor
language service. Use `tsc` and the TypeScript editor service as well when your
project depends on advanced conditional, generic, declaration-merging, or
language-service behavior.

Compiler analysis APIs are exported from `/compiler`; lower-level graph
optimizers, worker placement and selected renderer helpers are under
`/experimental` and can change without the stable API guarantee.

## Routing and navigation

`createRouter` accepts route definitions with paths, components, nested
children, layouts, named outlets, loaders, middleware, and search schemas.
Dynamic path parameters and typed loader helpers (`defineLoader`,
`TypedRouteDefinition`) help connect route inputs to page data. `lazyRoute`
loads a route module on demand. `Link` creates navigable links and can prefetch
routes; `router.navigate` performs imperative navigation, while
`router.prefetch` warms route code/data. Wildcard routes can render 404 pages.

Routes can use history navigation, redirects, route guards through middleware,
search/query parameters, and browser View Transitions where supported. Server
rendering can render matched routes with the server helpers. Protect sensitive
data on the server as well as hiding links in the client; client middleware is
not an authorization boundary.

## Queries, mutations, and streams

The `/data` entry exports a query client and reactive `query`/`resource`
primitives. Query options describe a key, fetcher, staleness/cache behavior,
retry policy, and focus/reconnect behavior. Query results expose reactive data
and loading/error state, refetching, and cancellation support. Pending query
resources can register with the nearest `Suspense` boundary.

`infiniteQuery` and `cursorQuery` support paginated data. `mutation` supports
mutation state, optimistic updates, and invalidation hooks. Persistence can be
configured with a storage persister. `request` is a typed fetch convenience;
`setDefaultFetcher` can configure the default request behavior. The `stream`
helper in `/data` provides event-stream consumption; realtime transport helpers
also include WebSocket/SSE primitives where available.

Queries and mutations run in the environment where they are called. Keep
credentials and privileged writes in server functions, and provide cancellation
and error handling for long-lived requests.

## Forms and schemas

`/forms` includes a schema builder for strings, numbers, booleans, literals,
enums, arrays, objects, unions, dates, email and URL values. Schemas parse and
validate input and expose inferred TypeScript output types. `createForm` and
`defineForm` manage values, nested field paths, errors, touched/dirty state,
submit state, field-level validation, and asynchronous validation. Advanced
form helpers add field arrays, drafts/autosave, and related form workflows.

`AutoForm` renders fields from schema metadata. `toJSONSchema` and `toOpenAPI`
emit schema descriptions for tooling and API documentation. Generated output
does not replace server-side validation: validate submitted data at the trust
boundary.

## Server rendering and server functions

The `/server` entry contains HTML escaping and safe JSON helpers, SSR rendering,
streaming boundaries, router rendering, hydration-state output, and an HTTP
handler. Server functions can be declared with `server` or `defineAction` and
handled through Web `Request`/`Response` APIs. Build transforms recognize
server-only modules and server directives, and production output separates
server code from browser code. `createEdgeAdapter` plus named Cloudflare,
Deno, Bun, and Lambda adapter helpers bridge supported handler shapes.

SSR helpers can render to a string or stream and can produce hydration/resume
state. Static prerendering is available through `lithe prerender`; ISR cache
helpers are available from `/server`. Server actions need application-level
authorization, input validation and CSRF policy appropriate to the deployment.
Never ship secrets in client modules or resume data. Edge adapters are
integration points: validate the platform APIs and deployment behavior for the
target provider.

## Offline and synchronization

The `/offline` entry provides network state, service-worker registration and
generation helpers, memory and IndexedDB storage adapters, background-sync
registration, and mutation queues. Queue retention is bounded by default;
choose a deliberate cap for your data volume and eviction requirements.

The `/sync` entry provides synchronized collections and conflict-resolution
structures including last-write-wins maps, observed-remove sets, and
RGA-style lists, plus a CRDT document/sync interface. These are building blocks:
you still need to define server authority, identity, authorization, schema
migrations, retention, and conflict UX for a real product. Browser storage and
Background Sync availability varies by browser and context; provide a fallback
path for unsupported capabilities.

## Styling, UI, images, animation, and head

- `/style`: CSS helpers, design-token/theme definition, collected CSS, and
  build transforms for eligible static style calls, CSS Modules, and scoped
  styles.
- `/ui`: headless Dialog, Tabs, Disclosure, Menu, Listbox, Combobox, Tooltip,
  toast, Tree, Command Palette and VisuallyHidden primitives. Supply styling and
  verify keyboard/focus behavior for your use case.
- `/image`: responsive `Image`, URL transformation helpers, image dimension and
  format metadata inspection, and native browser image transcode/encoding
  capability helpers. Actual codecs depend on platform support.
- `/animation`: Web Animations wrapper, view-transition helper and spring
  primitive. The browser controls supported animation features and reduced
  motion preferences should be respected by the application.
- `/i18n`: message/locale state and Intl-based number/date/relative-time
  formatting, including direction support.
- `/head`: head manager and server-side descriptor serialization for title,
  metadata and related document head output.
- `/permissions`: permission state helper and `Can` conditional rendering
  primitive. This is UI policy, not server authorization.

## Collections, virtualization, and grids

`/collection` exports an incremental reactive collection abstraction with
maintained indexes and change-oriented updates. `/virtual` exports a virtual
list and viewport-based virtualizer to keep large lists from mounting every
row. `/grid` provides a `DataGrid` and grid state helper for tabular data,
including editable and virtualized workflows. Provide stable row keys and
measure variable-size content when estimates would cause visible jumps.

The experimental entry currently exposes `createGridVirtualizer`; use the
stable `/virtual` and `/grid` exports for their documented public primitives.

## Workers, permissions, and scheduling

`/worker` includes `worker` and `sharedWorker` helpers with options for worker
creation and message/transfer behavior. Compiler analysis can identify safe
worker placement candidates; placement is conservative and code that uses
browser-only globals or captures unsupported values must stay on the main
thread. Worker availability and CSP rules depend on the deployment.

Core adaptive scheduling helpers can account for device/network conditions
when choosing lower-priority work or prefetch behavior. Always retain a
functional non-worker/non-adaptive path; constrained devices and privacy
settings may hide or restrict capability signals.

## Interop and host renderers

`/interop` supports custom elements (`defineElement`), embedding foreign views,
and injected React, Vue, and Svelte bridges. The bridge receives the external
framework objects from the application; Lithe does not install or bundle those
frameworks. Their versions and lifecycle behavior remain the host application's
responsibility.

The generic host renderer accepts an adapter for creating elements/text,
inserting/removing nodes and setting properties. A memory native driver is
provided as a reference/test adapter. This is an integration protocol, not a
shipped or certified native mobile renderer. The current experimental entry
re-exports host/native helpers while that API is being stabilized.

## DevTools, observability, and testing

`/devtools` provides a reactive graph inspector/overlay, update-reason tracing,
and store debugging/time-travel integrations. Keep debugging imports out of
production entry graphs when not needed. `/observability` provides tracing and
correlation context helpers for carrying IDs and headers across requests.

`/testing` includes render helpers, scheduler ticks, basic click/input helpers,
and assertions. Browser-oriented tests in the repository use a custom
Chromium DevTools Protocol driver. Test behavior in the actual supported
browsers for production claims; the repository browser runner is Chromium-only
at this time.

## Build integrations and output

The CLI can emit native ESM chunks (`--bundle=chunks`) or a single bundle
(`--bundle=single`). The production pipeline includes reachability pruning,
tree shaking/dead-code removal, minification, source maps, optional event-level
chunks, server/client boundary checks, and manifests for chunks, routes,
actions, islands, workers, events, and data. The `analyze` command reports
output sizes, including initial JavaScript when the build manifest contains it.

The package provides Vite, Rollup, Babel and Tailwind plugin entry points.
These adapters integrate Lithe transforms with those tools; they do not add
those bundlers as dependencies of Lithe itself. See the corresponding sections
in the repository README for configuration examples.

## CLI reference

Run `lithe --help` to print the short command list. Commands are:

| Command | Purpose and common options |
| --- | --- |
| `lithe create <directory>` | Scaffold a starter project. |
| `lithe dev <project> [--port=3000] [--host=...]` | Start dev server with HMR and error overlay. |
| `lithe build <project> [--out=dist] [--bundle=chunks\|single]` | Compile a production app. |
| `lithe preview <project> [--port=4173] [--host=...] [--out=dist]` | Serve built output; `serve` is an alias. |
| `lithe check <project>` | Run Lithe project diagnostics. |
| `lithe typecheck <project>` | Run Lithe's limited TS checks. |
| `lithe sourcecheck <repository>` | Check framework source policy. |
| `lithe analyze <project>` | Report output file sizes and initial JS size. |
| `lithe doctor <project> [--build=false]` | Run project health checks, optionally skip build. |
| `lithe prerender <project> [--out=dist] [--config=...]` | Render configured routes to static files. |
| `lithe types <project> [--out=lithe.generated.d.ts]` | Generate route/action declarations. |
| `lithe image <file>` | Print image metadata inspection as JSON. |

The CLI parses flags as `--name=value`; use the printed help for the installed
version since options can evolve.

## Support and limitations

The compatibility target is evergreen Chrome, Firefox and Safari, and Node.js
22.6+ for tooling/server. A target browser is not automatically a verified
release claim: current comparative browser evidence is Chromium-only. Edge
platforms are served through adapters and require deployment-specific checks.
Native rendering is an adapter protocol, not an officially supported platform
renderer. Third-party runtime and tooling dependencies remain disallowed.

Lithe's public core APIs are intended to be stable and semver-governed;
uncertain additions belong under `/experimental`. The in-house TypeScript
checker is intentionally narrower than TypeScript itself. Optional browser
features (IndexedDB, workers, codecs, View Transitions, Background Sync, and
permission APIs) vary by browser and policy; check capability and handle
failure at runtime.

Lithe has workload-specific performance results, not an established
suite-wide win over React or Solid. Consult the current [benchmark methodology](../benchmarks/browser-methodology.md)
and result files for measured scenarios, machine/browser details and known
gaps. Performance depends on equivalent workloads and production builds.

## Further reading

- [README: installation, quick start, integrations and build examples](../README.md)
- [Architecture and runtime design](ARCHITECTURE.md)
- [Production roadmap, support status and release evidence](PRODUCTION_ROADMAP.md)
- [Trust, DX, type-checker and debugging notes](TRUST_DX.md)
- [Release validation record](../RELEASE_VALIDATION.md)
- [Browser benchmark methodology](../benchmarks/browser-methodology.md)
- [Feature showcase](../examples/todo)
- [Consumer library demo](../examples/lib-demo)
