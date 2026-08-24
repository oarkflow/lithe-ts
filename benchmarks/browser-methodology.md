# Lithe Browser Benchmark Methodology

Lithe performance claims must be backed by browser-run measurements, not only synthetic runtime loops or DOM emulators.

## Rules

- Run DOM lifecycle tests in a real Chromium-family browser through CDP or WebDriver.
- Pin comparison framework versions in `benchmarks/package.json`.
- Report raw timings, median/p95 where available, browser version, machine, OS, and commit SHA.
- Keep framework comparison dependencies inside `benchmarks/`; the root Lithe package remains zero-dependency.
- Include vanilla DOM as a baseline and treat emulator results as development smoke tests only.

## Required Scenarios

- create 1k and 10k rows
- update every 10th row
- select one row
- swap two rows
- delete one row
- clear all rows
- hydrate SSR markup
- measure startup, JS bytes, gzip bytes, and long tasks

## Running

Use:

```bash
node --experimental-strip-types benchmarks/real-browser.ts
```

The script requires a local Chromium binary and records JSON output suitable for CI artifacts.
