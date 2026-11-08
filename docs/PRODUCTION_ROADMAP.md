# Lithe production readiness roadmap

This is the source of truth for product status, supported environments, and
evidence required before Lithe makes production or performance claims.
`Tasks.md` remains the implementation ledger; a checked item does not by itself
prove cross-browser compatibility or competitive performance.

## Product and compatibility policy

- **Runtime/tooling:** Node.js 22.6+ as declared in `package.json`; repository
  tooling runs TypeScript through Node's type stripping.
- **Browser target:** evergreen Chrome, Firefox, and Safari. This is a target,
  not a claim that the current release has been verified on all three. Current
  comparative browser evidence is Chromium-only.
- **Edge:** fetch-style adapters are provided. Each deployment platform must
  validate its exposed APIs; there is no blanket edge-runtime certification.
- **Native:** the host-renderer protocol and memory driver are integration
  points. Platform-specific shells/drivers are not shipped or certified here.
- **Dependencies:** zero third-party runtime and tooling dependencies remains
  a hard constraint. Benchmark-only dependencies stay under `benchmarks/`.
- **API compatibility:** documented core exports are stable and follow semver.
  New or uncertain behavior belongs under `experimental` until its contract and
  verification coverage are established. Deprecations require migration notes
  and a removal window ending only at a major release.
- **Type checking:** Lithe catches common syntax and framework-boundary errors;
  it is not a replacement for the TypeScript compiler or language service.
  Advanced constructs can produce warnings or incomplete semantic analysis.

## Public feature inventory

**Implemented** means code and focused repository checks exist. It does not
mean every target browser or runtime has been certified. **Target** identifies
compatibility work that still needs evidence.

| Area | Status | Public behavior | Evidence and known boundary |
| --- | --- | --- | --- |
| Reactive core and ownership | Implemented | Signals, computed values, effects, stores, batching, scheduling, contexts, cleanup, resumable state | `reactive`, `store`, `finalization` tests; audit disposal and high fan-out |
| DOM, JSX, hydration, islands | Implemented; browser target pending | Fine-grained DOM updates, control flow, keyed lists, portals, hydration, resume, activation policies | rendering, hydration, SSR and browser tests; browser suite is Chromium/CDP only |
| Compiler and TypeScript/JSX | Implemented with limits | JSX lowering, templates, source maps, diagnostics, placement analysis, TS erasure and lightweight semantic checks | compiler, TypeScript-first, completion tests; not a full TypeScript checker |
| Router and navigation | Implemented | Nested routes/layouts, loaders, middleware, typed search, prefetch, transitions, history | router tests; browser behavior needs Firefox/Safari runs |
| Query, streams, collections | Implemented | Cache, cancellation, retry, invalidation, pagination, SSE/WebSocket, reactive indexed collections | query and modern-features tests; verify reconnect behavior on target platforms |
| Forms and schemas | Implemented | Schema validation, field state, arrays, async validation, autosave, generated forms | schema and auto-form tests; verify keyboard and assistive-technology flows |
| Server, RPC, SSR, SSG, ISR | Implemented; runtime-specific support bounded | Request/Response actions, adapters, escaping, streaming, prerendering, server isolation | SSR, RPC, server-split, release tests; adapters need deployment-specific checks |
| Offline, storage, sync, CRDT | Implemented | IndexedDB fallback, persistent queue, background sync adapter, optimistic collections, LWW structures | modern-features tests; storage/service worker matrix coverage needed |
| Styling, UI, images, animation, i18n, head | Implemented | Build-time CSS transforms, UI primitives, image metadata/native codec helpers, animation, locale, document head | modern-features/compiler tests; codec availability is platform-dependent |
| Workers and adaptive scheduling | Implemented | Worker helpers, safe placement analysis, fallbacks, device-aware scheduling | modern-features/compiler tests; verify disabled-worker/constrained-device paths |
| Interop and native renderer | Adapter surface implemented | Web Components, injected framework bridges, host renderer, memory driver | interop tests; framework versions/native platforms are not bundled or certified |
| DevTools, observability, testing | Implemented | Graph/trace inspection, correlation, time travel, DOM test helpers | browser/runtime tests; production overhead must remain optional/tree-shakeable |
| CLI, build, package, plugins | Implemented | `dev`, `build`, `preview`, `check`, `analyze`, `create`, `prerender`, `types`, `typecheck`, `sourcecheck`, `doctor`, `image`; Vite/Rollup/Babel/Tailwind integrations | plugins, release, preview tests; clean consumer/package verification is a release gate |

The authoritative import-path list is the `exports` map in `package.json`.
This table groups those paths by user-facing capability; it does not promise an
independent compatibility guarantee for every export.

## Roadmap and release gates

### Stage 1 — Baseline and audit

- Keep this inventory aligned with exports, CLI help, declarations, examples,
  tests, and actual support evidence.
- Audit lifecycle/disposal, DOM reconciliation, hydration/resume, SSR streaming,
  navigation, server/client boundaries, forms, offline queues, and worker
  fallbacks. Record findings and regression coverage in the engineering ledger.
- Publish browser and adapter support results. A target is not verified until a
  real execution result is recorded.

### Stage 2 — Correctness, security, and compatibility

- Run a browser matrix on production-built applications. Exercise hydration,
  event delegation, navigation, list edits, cleanup, storage, and graceful
  capability fallbacks.
- Review escaping, Trusted Types, CSRF, permission checks, server-action
  exposure, server-only secret isolation, and resume-state serialization.
- Add regressions for confirmed defects; record security and compatibility
  findings and their resolutions in release evidence.

### Stage 3 — Performance evidence and optimization

- Compare structurally equivalent production builds against React, Solid, and
  vanilla DOM. Pin comparison versions and report raw samples, median and
  spread, browser version, platform, and commit.
- Extend scenarios to startup/hydration, create/update/move/remove, interaction
  latency, memory/cleanup, SSR throughput, and initial payload.
- Set per-scenario thresholds after collecting repeatable baselines on named
  reference hardware. Track regressions against Lithe's own baseline; claim
  competitor wins only where repeated results support them.
- Profile before changing runtime/compiler algorithms. Current results in
  `benchmarks/browser-methodology.md` show workload-specific gains, while
  creation and wholesale cleanup remain behind comparators. No suite-wide win
  is claimed.

### Stage 4 — Capability and developer experience expansion

- Prioritize diagnostics, generated types, debugging, documentation, starter
  flows, and interoperability by user value and verification cost.
- Keep optional features out of the minimum client graph unless imported. Add
  uncertain APIs under `experimental`; promote only after contract and test
  coverage exist.
- Do not promise full TypeScript language-service semantics from the in-house
  checker. Consumers can use TypeScript compiler/editor tooling alongside Lithe.

### Release gate

Before a release is called production-ready, record results for:

1. Source policy and public declaration coverage.
2. Runtime, compiler, SSR, hydration, router, data/forms, security, server split,
   offline/sync, workers, and package/release regressions.
3. Core, runtime, and full production library builds, an application build, and
   generated-type checks.
4. Real-browser checks for every browser claimed as supported. Environment
   restrictions are reported as skips, never passes.
5. Dependency/package/export inspection and clean consumer installation.
6. Security review results and unresolved limitations.
7. Browser benchmark report with raw data and regression comparison. Missing
   browser or benchmark runs are unverified, not silently waived.

Existing executable gates include `npm run sourcecheck`, `npm run validate:lib`,
`npm run validate:demo`, `npm test`, `npm run test:browser`, and
`node --experimental-strip-types benchmarks/real-browser.ts`. The browser
benchmark needs built apps, comparison packages, Chromium, and local HTTP
permission. These checks do not yet constitute the full cross-browser matrix.

## Verification matrix

| Concern | Existing focused evidence | Required release evidence |
| --- | --- | --- |
| Reactive updates, ownership, cleanup | reactive, store, finalization tests | regressions plus real-browser cleanup checks |
| Rendering, lists, hydration/resume | rendering, hydration, SSR tests | production app in Chrome, Firefox, Safari; preserve node identity and interaction |
| Compiler, types, output, source maps | compiler, TypeScript-first, completion tests | declaration coverage and clean consumer type/build check |
| Routing, query, forms, UI | router, query, schema, auto-form tests | browser navigation/forms and cancellation/error scenarios |
| Server, RPC, security, serialization | SSR, RPC, server-split, release tests | adapter-specific smoke tests and recorded security review |
| Offline, sync, workers, fallbacks | modern-features tests | storage/service worker/worker capability matrix |
| CLI, package, integrations | plugins, release, preview tests | clean install, exports, CLI smoke test, package inspection |
| Performance and payload | real-browser comparison, analyze/build manifests | repeated production runs with raw samples, environment, spread and thresholds |

## Current gaps

- Evergreen browser support is a target; the comparative runner is Chromium-
  specific and Firefox/Safari compatibility is not demonstrated here.
- Comparative coverage emphasizes a 1,000-row lifecycle workload. Startup,
  hydration, interaction latency, memory, SSR throughput, and broader payload
  comparison still need a common harness.
- Performance evidence shows workload-specific wins and remaining losses;
  repeatable suite-wide wins over React and Solid are not established.
- The in-house type checker intentionally covers common cases, not the complete
  TypeScript type system.
- Edge and native support are adapters/protocols, not certified deployment
  targets.
- `RELEASE_VALIDATION.md` records a specific historical 2026-09-02 v1.1.1 run;
  it is evidence for that run, not current release certification.
