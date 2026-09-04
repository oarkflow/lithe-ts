# Lithe — Zero-Dependency TypeScript-First Frontend/Full-Stack Framework

> Published on npm as **`@oarkflow/lithe`**

Lithe is a compiler-first, fine-grained frontend and full-stack framework implemented with **zero third-party runtime or tooling dependencies**. It combines Solid-like fine-grained reactivity, React-like component ergonomics, integrated application primitives, resumable SSR, and a lightweight native-ESM production model.

The entire framework — runtime, compiler, build tooling, dev server, and CLI — is authored in TypeScript and runs on **Node.js 22.6+**, using only built-in modules and the platform's native TypeScript stripping. No `dependencies`, no `devDependencies`, and no `node_modules` requirement for the framework itself.

---

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Complete router example](#complete-router-example)
- [Core programming model](#core-programming-model)
- [What is included](#what-is-included)
- [Entry points](#entry-points)
- [CLI](#cli)
- [Examples](#examples)
- [Library & demo builds](#library--demo-builds)
- [Production model](#production-model)
- [Security defaults](#security-defaults)
- [Bundler & toolchain integrations](#bundler--toolchain-integrations)
- [TypeScript-first source policy](#typescript-first-source-policy)
- [Repository structure](#repository-structure)
- [Links](#links)

---

## Installation

Install the published package from the npm registry:

```bash
npm install @oarkflow/lithe
```

No transitive dependencies are installed — the framework has a completely empty `dependencies` map.

To use the CLI as an installed binary dependency, run it through your package manager's script runner (the package ships a `lithe` bin):

```bash
npx lithe --help
```

---

## Quick start

Install the published package:

```bash
npm install @oarkflow/lithe
```

Create the standard root `index.html` alongside `src/index.tsx`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lithe app</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

The minimum production entry points are `@oarkflow/lithe/signals` (the
lightweight signal/computed/effect scheduler) and `@oarkflow/lithe/dom` (mount,
hydration, JSX runtime, control-flow components). Use `@oarkflow/lithe/core`
when stores, contexts, ownership, resumability, or adaptive scheduling are
needed.

```tsx
import { signal, computed } from '@oarkflow/lithe/signals';
import { createRoot } from '@oarkflow/lithe/dom';

const count = signal<number>(0, { name: 'count' });
const doubled = computed(() => count.value * 2);

function Counter() {
  return <button onClick={() => count.value++}>
    {count} / {doubled}
  </button>;
}

createRoot(document.getElementById('app')!).render(<Counter />);
```

`createRoot(container).render(view)` is the React-style default mount API;
call `.unmount()` to dispose the root and all owned effects/listeners.

For the smallest signal-driven browser entry, import from
`@oarkflow/lithe/signals`. It excludes stores, DevTools, resumability,
adaptive scheduling, and other higher-level modules. Use
`@oarkflow/lithe/core` when those features are needed.

## Complete router example

`@oarkflow/lithe/router` supports ordinary routes, lazy route components, nested
children, groups, layouts, loaders, middleware, search parameters, prefetching,
navigation, and a wildcard 404 route. A small application can be wired like
this:

```tsx
// src/index.tsx — the default browser entry
import { mount } from '@oarkflow/lithe/dom';
import {
  createRouter,
  group,
  lazyRoute,
  Link,
  type RouterContext
} from '@oarkflow/lithe/router';

// The import is not fetched until /reports is visited or prefetched.
const Reports = lazyRoute(() => import('./views/Reports.tsx'), {
  exportName: 'Reports',
  fallback: <p>Loading reports…</p>,
  onError: error => console.error('Could not load reports', error)
});

const requireUser = async (_context: RouterContext, next: () => Promise<unknown>) => {
  if (!localStorage.getItem('user')) return 'Sign in to continue';
  return next();
};

function AppLayout(props: { outlet?: unknown }) {
  return <>
    <header>
      <Link to="/">Home</Link>{' '}
      <Link to="/reports" prefetch="visible">Reports</Link>{' '}
      <Link to="/admin/users">Admin</Link>
    </header>
    <main>{props.outlet}</main>
  </>;
}

function AdminLayout(props: { outlet?: unknown }) {
  return <section>
    <h1>Administration</h1>
    <nav><Link to="/admin/users">Users</Link></nav>
    {props.outlet}
  </section>;
}

function Home() {
  return <><h1>Home</h1><p>Welcome to Lithe.</p></>;
}

function Users(props: { data?: { users: string[] } }) {
  return <ul>{props.data?.users.map(user => <li>{user}</li>)}</ul>;
}

const router = createRouter({
  viewTransitions: true,
  middleware: [async (_context, next) => {
    console.log('before every route');
    return next();
  }],
  routes: [
    // A group can organize routes without adding a URL segment.
    group([
      { path: '/', component: Home },
      {
        path: '/reports',
        component: Reports,
        load: ({ search }) => ({ range: search.range || 'week' }),
        searchSchema: {
          parse(value: unknown) {
            const input = value as Record<string, unknown>;
            return { range: input.range === 'month' ? 'month' : 'week' };
          }
        }
      },
      group([
        {
          path: '',
          index: true,
          component: () => <p>Select an admin page.</p>
        },
        {
          path: 'users',
          component: Users,
          load: async () => ({ users: ['Ada', 'Grace'] })
        }
      ], { path: '/admin', layout: AdminLayout, middleware: [requireUser] })
    ], { layout: AppLayout }),
    { path: '*', component: () => <><h1>404</h1><Link to="/">Go home</Link></> }
  ]
});

router.start();
mount(document.getElementById('app')!, <router.View />);

// Imperative navigation and data/component prefetching are also available:
async function warmReports() {
  await router.prefetch('/reports?range=month');
}
async function openAdmin() {
  await router.navigate('/admin/users', { replace: true, transition: true });
}
```

The lazy view can export a named component:

```tsx
// src/views/Reports.tsx
export function Reports({ data }: { data?: { range: string } }) {
  return <article><h1>Reports</h1><p>Range: {data?.range}</p></article>;
}
```

For typed route definitions, use `TypedRouteDefinition` (or infer a route
loader with `defineLoader`) and read `params`, `search`, `data`, `router`, and
`outlet` from the component props:

```tsx
import { defineLoader, type TypedRouteDefinition } from '@oarkflow/lithe/router';

const loadProject = defineLoader(async ({ params }) =>
  fetch(`/api/projects/${params.id}`).then(response => response.json())
);

const projectRoute: TypedRouteDefinition<
  { id: string },
  { tab?: string },
  { name: string }
> = {
  path: '/projects/:id',
  load: loadProject,
  component: ({ params, search, data }) => (
    <h1>{data?.name} — {params.id} — {search.tab || 'overview'}</h1>
  )
};
```

Use `layout` on a route or group to wrap its matched default outlet. Use
`outlets` for named parallel views and render one with
`router.Outlet({ name: 'sidebar' })`. `Link` intercepts same-origin clicks and
prefetches by default; set `prefetch={false}` to disable it.

For example, a route can provide a default page and a parallel sidebar:

```tsx
const dashboardRoutes = [{
  path: '/dashboard',
  component: Dashboard,
  outlets: { sidebar: lazyRoute(() => import('./views/Sidebar.tsx')) }
}];

function DashboardApp() {
  return <>
    <router.View />
    <aside><router.Outlet name="sidebar" /></aside>
  </>;
}
```

**Development from this repository** (no `npm install` required):

```bash
npm run build          # build the Lithe library package (core mode)
npm run validate:lib   # validate the library package only
npm run validate:demo  # validate the todo showcase separately
node --experimental-strip-types cli/lithe.ts dev examples/todo --port=3000
node --experimental-strip-types --test tests/*.test.ts
```

---

## Core programming model

Components construct a **reactive graph**. A signal update targets only the affected bindings rather than rerendering and diffing the whole component tree.

- `signal<T>()` — a mutable reactive cell (`.value`, `.peek()`, `.update()`, `.subscribe()`)
- `computed<T>()` — a lazy derived value that tracks dependencies and propagates changes
- `effect()` — a side-effect that re-runs when its tracked dependencies change
- `state()` / `createStore()` — proxy objects and Zustand-style stores with selectors
- `batch()` / `untrack()` — group update flushes and temporarily disable tracking
- `createContext()` / `useContext()` — dependency-injection contexts with an owner scope
- `onMount()` / `onCleanup()` — lifecycle hooks tied to the component's owner scope
- `createScope()` — an independent reactive scope that can be disposed

```tsx
import { signal, computed, effect, batch } from '@oarkflow/lithe/core';
import { mount, For, Show } from '@oarkflow/lithe/dom';

const todos = signal<{ id: number; done: boolean; text: string }[]>([]);
const filter = signal<'all' | 'active' | 'done'>('all');

const visible = computed(() => {
  const f = filter.value;
  return todos.value.filter(t => f === 'all' ? true : f === 'done' ? t.done : !t.done);
});

effect(() => {
  console.log(`${visible.value.length} visible todos`);
});

function App() {
  return <ul>
    <For each={todos}>{(todo) =>
      <li class={todo.done ? 'done' : ''}>{todo.text}</li>
    }</For>
  </ul>;
}
```

### State and stores

```tsx
import { createStore } from '@oarkflow/lithe/core';

const useCart = createStore((set) => ({
  items: [] as string[],
  add: (name: string) => set(s => ({ items: [...s.items, name] }))
}));

const items = useCart(s => s.items);      // reactive selector
useCart.getState().add('apple');          // imperative mutation
```

Stores also support `persist`, `history` (undo/redo), `devtools` middleware, immutable `produce`, and context-scoped stores via `createContextStore`.

Offline mutation queues are bounded to 1,000 retained operations by default to
keep memory and browser storage predictable. Configure the limit, or explicitly
opt out when durable retention is required:

```ts
import { createMutationQueue } from '@oarkflow/lithe/offline';
import { createPersistentMutationQueue } from '@oarkflow/lithe/sync';

const memoryQueue = createMutationQueue('app:mutations', { maxItems: 250 });
const durableQueue = createPersistentMutationQueue(storage, 'app:mutations', { maxItems: 0 });
```

---

## What is included

### Compiler and rendering

- JSX/TSX compiler supporting native elements, components, member components, fragments, and namespaces
- compiler-generated **direct DOM instructions** for native dynamic JSX
- zero-VNode **static template hoisting**
- fine-grained text / attribute / property / class / style bindings
- persistent **keyed and indexed list reconciliation** (`For`, `Index`)
- **hydration** and resumable **named-signal bindings**
- automatic **island** candidates and `load` / `idle` / `visible` / `media` activation
- safe imported **event-symbol lazy loading** and inline event closures extracted into independent event chunks with serialized read-only captures
- structural JavaScript program/scope analysis backed by full **V8 grammar validation**
- Node 22 native TypeScript syntax transformation plus an in-repo fallback
- framework **semantic TypeScript assignability checks**
- source maps, static **accessibility diagnostics**, and **reactive graph diagnostics**

### Application framework

- nested / parallel / intercepted **router** with typed loaders, typed search params, and View Transitions
- **query cache** with persistence, infinite/cursor queries, request cancellation, retries, and focus/reconnect refresh
- optimistic **mutations** and tag-driven automatic invalidation
- **schemas**, nested forms, cancelable async validation, field arrays, drafts, and `AutoForm`
- **JSON Schema / OpenAPI** schema generation
- incremental **collections**, maintained indexes, virtualization, and editable **DataGrid**
- headless **Dialog / Tabs / Menu / Listbox / Combobox / Tree / Tooltip / Toast / Command Palette** UI primitives
- **i18n** with Intl formatting, RTL/LTR, and head/SEO management
- **CSS** utility functions, design tokens, static CSS/theme extraction, CSS Modules, and scoped CSS
- **Web Animations**, springs, native View Transitions, and shared-element naming
- responsive **image** primitive and common image-format metadata inspection

### Full stack and platform

- typed-style **server actions / RPC** over Web `Request` / `Response`
- `.server.*` module isolation and private server build output
- `"use server"` and conservative automatic server placement
- **SSR**, independent streaming boundaries, **SSG**/prerender, and **ISR**
- resumable signals, text/attribute bindings, ownership snapshots, importable computations, and event handlers
- **WebSocket / SSE** realtime primitives
- **Worker / SharedWorker** helpers with transferables and compiler placement
- offline **network state**, generated **Service Worker**, **IndexedDB**, **Background Sync**, and persistent mutations
- local-first synchronized **collections** and deterministic LWW map/set/list **CRDTs**
- adaptive network/device/battery **scheduling** and prefetch policy
- **Web Components** plus injected **React / Vue / Svelte** bridges
- generic **host renderer** and reference DOM-less / native memory driver

### Development and production tooling

- zero-dependency **dev server** with HMR, dependency invalidation, and named-signal preservation
- production **native-ESM chunk graph** (`--bundle=chunks`) or single-file bundle
- reachability pruning, **symbol tree shaking**, **DCE**, and dependency-free minification
- **event-level lazy chunks**
- final-transform **source maps**
- transitive **secret / server-client checks**
- **performance budgets**
- build / data / reactive / island / worker / server / event **manifests**
- **route/action type generation** (`lithe types`)
- **static prerendering** (`lithe prerender`)
- **image inspector** (`lithe image`)
- custom zero-dependency **Chromium DevTools Protocol browser test driver**
- reactive graph **DevTools**, update-reason tracing, mutation time travel, and correlation tracing

---

## Entry points

The published package exposes a full map of subpath entry points, each with its own compiled JavaScript and matching type declarations:

| Entry point | What it provides |
| --- | --- |
| `@oarkflow/lithe` / `./runtime` | Lightweight React-like entry: signals plus `mount`/`createRoot` |
| `@oarkflow/lithe/core` | Signals, computed, effects, stores, contexts, ownership, scheduling, adaptive, resume |
| `@oarkflow/lithe/signals` | Minimal signals, computed values, effects, state, scheduling, and transitions |
| `@oarkflow/lithe/dom` | Mount/hydrate, JSX runtime, control-flow components, portals, islands, resume |
| `@oarkflow/lithe/forms` | Schemas, forms, validation, `AutoForm`, JSON Schema/OpenAPI |
| `@oarkflow/lithe/router` | Router, Link/Outlet, loaders, lazy routes |
| `@oarkflow/lithe/data` | Queries, mutations, infinite/cursor queries, streams |
| `@oarkflow/lithe/server` | SSR, RPC/actions, adapters, security, ISR |
| `@oarkflow/lithe/rpc` | Server functions and actions |
| `@oarkflow/lithe/style` | CSS utility, themes, collection |
| `@oarkflow/lithe/i18n` | Internationalization |
| `@oarkflow/lithe/head` | Head/SEO management |
| `@oarkflow/lithe/offline` | Network state, Service Worker, IndexedDB, Background Sync, queues |
| `@oarkflow/lithe/sync` | Local-first sync and CRDTs |
| `@oarkflow/lithe/worker` | Worker / SharedWorker helpers |
| `@oarkflow/lithe/collection` | Incremental collections |
| `@oarkflow/lithe/virtual` | Virtualizers |
| `@oarkflow/lithe/grid` | Editable DataGrid |
| `@oarkflow/lithe/ui` | Headless accessible UI primitives |
| `@oarkflow/lithe/image` | Responsive image primitive and metadata |
| `@oarkflow/lithe/animation` | Web Animations, springs, transitions |
| `@oarkflow/lithe/interop` | Web Components and React/Vue/Svelte bridges |
| `@oarkflow/lithe/observability` | Tracing and correlation |
| `@oarkflow/lithe/permissions` | Permission helpers |
| `@oarkflow/lithe/app` | App conventions and `startApp` |
| `@oarkflow/lithe/testing` | Render and test helpers |
| `@oarkflow/lithe/compiler` | JSX/TSX compiler, parser, type analysis, graph IR |
| `@oarkflow/lithe/experimental` | Experimental compiler/interop/virtual features |
| `@oarkflow/lithe/plugins` | Vite / Rollup / Babel / Tailwind plugin adapters |
| `@oarkflow/lithe/vite` / `./rollup` / `./babel` / `./tailwind` | Per-integration plugin entry points |
| `@oarkflow/lithe/devtools` | DevTools overlay and reactive graph inspector |

All entry points support `import { … } from '@oarkflow/lithe/<name>'` with full TypeScript declarations included.

---

## CLI

`lithe` ships a zero-dependency CLI. When developing this repository, invoke it as `node --experimental-strip-types cli/lithe.ts …`; when installed from npm, run it via your package runner (e.g. `npx lithe …`).

```text
lithe dev <project> [--port=3000] [--host=...]
lithe preview|serve <project> [--port=3000] [--out=dist]
lithe build <project> [--bundle=chunks|single]
lithe check <project>
lithe typecheck <project>
lithe analyze <project>
lithe create <directory>
lithe prerender <project> [--out=dist] [--config=...]
lithe types <project> [--out=lithe.generated.d.ts]
lithe doctor <project> [--build=false]
lithe sourcecheck <project>
lithe image <file>
```

---

## Examples

The repository ships two examples.

### `examples/todo` — the feature showcase

A large Todo/Studio app demonstrating lazy routes, router, i18n, themes, stores, offline/sync, DataGrid, Tailwind utilities, and DevTools screens.

```bash
npm run build:demo       # build the showcase
npm run dev:demo         # run the dev server
```

### `examples/lib-demo` — consuming the published library

A **minimal example that installs and imports the real published package** (`@oarkflow/lithe@^1.1.1` from npm), demonstrating the framework used exactly as an external consumer would:

```bash
cd examples/lib-demo
npm install              # fetches @oarkflow/lithe from the registry
npm run build            # or: lithe build
npm run dev              # or: lithe dev
```

Its `src/index.tsx` imports `signal`, `computed`, and `mount` from the default `@oarkflow/lithe` entrypoint. This is the reference for how to wire Lithe into your own project; use the optimized subpaths when minimizing the browser module graph.

```bash
npm run build:libdemo    # build the library demo from the repo root
npm run dev:libdemo
```

---

## Library & demo builds

### Building the library

```bash
npm run build            # core mode       → dist/lithe-package
npm run build:runtime    # runtime mode    → dist/lithe-package-runtime
npm run build:full       # full mode       → dist/lithe-package-full
```

Each emits a self-contained, zero-dependency package with compiled JavaScript, per-subpath type declarations (`types/exports/*.d.ts`), metadata, and a `lithe-package-manifest.json` recording byte budgets.

### Publishing

The npm release is the **full, demo-free package** so a single version owns the complete public export map:

```bash
npm run pack:npm         # validate + build full, then inspect the publishable tarball
npm run publish:npm      # validate + build full, then publish publicly
```

Core and runtime builds remain local validation / size targets; they are not published as competing packages under the same name.

### Building the examples

The showcase output is intentionally larger because it includes many lazy routes, UI states, offline/sync examples, DevTools screens, and a Tailwind showcase. Treat demo bytes as showcase payload, not the core library footprint.

```bash
npm run build:demo       # build examples/todo
npm run build:libdemo    # build examples/lib-demo
```

---

## Production model

Lithe intentionally emits **browser-native ESM** rather than forcing all code into a single concatenated bundle. The builder still performs:

1. JSX/TSX and server/client compilation
2. direct-DOM / static-template lowering
3. static CSS/theme extraction
4. server-module isolation
5. event-handler chunk extraction
6. module reachability analysis
7. symbol-level safe tree shaking
8. dead-branch elimination (DCE)
9. dependency-free minification
10. final-transform source-map generation
11. production/debug/startup budget enforcement

Only reachable Lithe runtime modules are copied into the build output's `dist/__lithe`.

---

## Security defaults

- SSR escapes text and attributes by default
- raw browser HTML requires `trustedHTML()`
- Trusted Types integration is available
- server actions support schemas and permission hooks
- CSRF and CSP / security-header helpers are included
- `.server.*` and detected secret-tainted dependency chains are rejected from browser graphs
- 5xx server errors hide internal details by default

---

## Bundler & toolchain integrations

Lithe includes official zero-dependency plugin adapters for third-party build systems and bundlers both for use inside a Lithe project and for incremental adoption in existing pipelines.

### Vite (`vite.config.ts`)

```ts
import { defineConfig } from 'vite';
import { litheVitePlugin } from '@oarkflow/lithe/vite';

export default defineConfig({
  plugins: [
    litheVitePlugin({
      typescript: true,
      sourceMap: true
    })
  ]
});
```

### Rollup (`rollup.config.js`)

```js
import { litheRollupPlugin } from '@oarkflow/lithe/rollup';

export default {
  input: 'src/index.tsx',
  output: { dir: 'dist', format: 'esm' },
  plugins: [
    litheRollupPlugin({ typescript: true })
  ]
};
```

### Babel (`.babelrc` or `babel.config.js`)

```js
import { litheBabelPlugin } from '@oarkflow/lithe/babel';

export default {
  plugins: [
    [litheBabelPlugin, { runtimeImport: '@oarkflow/lithe/dom' }]
  ]
};
```

### Tailwind CSS (`@oarkflow/lithe/tailwind`)

A zero-runtime on-demand atomic CSS compiler and optimizer:

```ts
import { compileTailwind, litheTailwindPlugin } from '@oarkflow/lithe/tailwind';

// Programmatic compilation
const css = await compileTailwind([sourceCode]);

// Or as a build plugin
const plugin = litheTailwindPlugin();
```

---

## TypeScript-first source policy

**All authored implementation code in this repository is TypeScript.** Framework internals, compiler/build tooling, CLI commands, tests, and benchmarks use `.ts`; component/example entry points use `.tsx`; public declarations use `.d.ts`. A release test fails if an authored `.js` implementation file is introduced.

Node.js executes Lithe's tooling directly with `--experimental-strip-types`, so no TypeScript npm package, Babel, SWC, or ts-node is installed. The production builder compiles/strips `.ts`/`.tsx` into standards-based browser `.js` modules — that emitted JavaScript is a build artifact, not authored framework source (browsers ultimately execute JavaScript).

The repository also ships minimal Node ambient shims in `types/node-shim.d.ts` so editors understand the zero-dependency tooling without requiring `@types/node`. Projects may still use their own richer Node typings externally.

---

## Repository structure

```text
src/            framework runtime, compiler, and tooling (TypeScript)
cli/            the lithe CLI (shell wrapper + lithe.ts source)
tools/          build / dev / check / type tooling
types/          public declarations (lithe.d.ts, node-shim.d.ts)
tests/          Node test runner suite (zero external test framework)
benchmarks/     performance comparisons (React / Solid / Zustand)
examples/       todo showcase + lib-demo (published-package consumer)
dist/           generated distributable packages
docs/           architecture and DX documentation
```

---

## Links

- [`Tasks.md`](./Tasks.md) — the completed engineering ledger
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — internals and architecture
- [`docs/TRUST_DX.md`](./docs/TRUST_DX.md) — typed helpers, debugging surfaces, `lithe doctor`, benchmark-proof rules
- [`RELEASE_VALIDATION.md`](./RELEASE_VALIDATION.md) — the release validation process
- [`CHANGELOG.md`](./CHANGELOG.md) — release history
- Package on npm: [`@oarkflow/lithe`](https://www.npmjs.com/package/@oarkflow/lithe)
