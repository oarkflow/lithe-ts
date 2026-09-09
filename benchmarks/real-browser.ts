// Real-browser DOM lifecycle comparison: Lithe vs React vs Solid vs vanilla,
// driven through actual Chromium via the DevTools Protocol — not a Node DOM
// emulator. See browser-methodology.md for why this exists as a separate
// script from framework-comparison.ts (which runs in happy-dom and is a
// development smoke test only, not a performance claim).
//
// Each app is a real production build:
//   - Lithe:  `lithe build` (native-ESM chunk graph, tree-shaken, minified)
//   - React:  esbuild production bundle (NODE_ENV=production, minified)
//   - Solid:  esbuild production bundle (minified), authored with Solid's
//             own JSX-free hyperscript (solid-js/h) since wiring up
//             babel-preset-solid was out of scope for this harness — it
//             still runs through real solid-js/solid-js/web reactivity and
//             DOM insertion, only the authoring syntax differs from a
//             compiled <template>.
//   - vanilla: hand-written DOM calls, the baseline every framework pays a
//             tax against.
//
// Usage: node --experimental-strip-types benchmarks/real-browser.ts
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(HERE, 'apps');
const LITHE_DIST = path.join(APPS_DIR, 'lithe-project', 'dist');

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8'
};

function findChromiumPath(): string | null {
	const candidates = [
		process.env.CHROME_BIN,
		process.env.CHROMIUM_BIN,
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium'
	].filter(Boolean) as string[];
	for (const candidate of candidates) if (fsSync.existsSync(candidate)) return candidate;
	return null;
}

async function waitJSON(url: string, timeout = 8000): Promise<any> {
	const end = Date.now() + timeout;
	let last: unknown;
	while (Date.now() < end) {
		try {
			const response = await fetch(url);
			if (response.ok) return response.json();
		} catch (error) {
			last = error;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw last || new Error(`Timed out waiting for ${url}`);
}

function connectCDP(url: string) {
	const ws = new WebSocket(url);
	const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
	const listeners = new Map<string, Array<(params: any) => void>>();
	let seq = 0;
	const ready = new Promise<void>((resolve, reject) => {
		ws.addEventListener('open', () => resolve(), { once: true });
		ws.addEventListener('error', reject, { once: true });
	});
	ws.addEventListener('message', event => {
		const message = JSON.parse(String((event as MessageEvent).data));
		if (message.id) {
			const request = pending.get(message.id);
			if (!request) return;
			pending.delete(message.id);
			message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
		} else if (message.method) {
			for (const fn of listeners.get(message.method) || []) fn(message.params);
		}
	});
	return {
		ready,
		send(method: string, params: Record<string, unknown> = {}): Promise<any> {
			const id = ++seq;
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				ws.send(JSON.stringify({ id, method, params }));
			});
		},
		once(method: string, timeout = 8000): Promise<any> {
			return new Promise((resolve, reject) => {
				const list = listeners.get(method) || [];
				const fn = (params: any) => {
					clearTimeout(timer);
					listeners.set(method, (listeners.get(method) || []).filter(x => x !== fn));
					resolve(params);
				};
				list.push(fn);
				listeners.set(method, list);
				const timer = setTimeout(() => {
					listeners.set(method, (listeners.get(method) || []).filter(x => x !== fn));
					reject(new Error(`Timed out waiting for ${method}`));
				}, timeout);
			});
		},
		close() {
			ws.close();
		}
	};
}

// Each app gets its own origin serving its build output as the actual root
// (not a path prefix) — the Lithe build's HTML/JS reference absolute paths
// like /lithe.css and /__lithe/dom/vnode.js exactly as a real deployment
// would serve them from its domain root, so a shared server with per-app
// path prefixes would silently 404 every one of those references instead
// of exercising the framework at all.
function serveDir(root: string): Promise<{ url: string; close(): void }> {
	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url || '/', 'http://localhost');
			const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
			if (!file.startsWith(path.resolve(root))) {
				res.writeHead(403);
				res.end('Forbidden');
				return;
			}
			const data = await fs.readFile(file);
			res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
			res.end(data);
		} catch (error: any) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end(String(error?.message || error));
		}
	});
	return new Promise((resolve, reject) => {
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
		});
		server.once('error', reject);
	});
}

async function runInBrowser(page: ReturnType<typeof connectCDP>, url: string): Promise<any> {
	const loaded = page.once('Page.loadEventFired', 15000);
	await page.send('Page.navigate', { url });
	await loaded;
	const result = await page.send('Runtime.evaluate', {
		expression: 'window.runBenchmark()',
		awaitPromise: true,
		returnByValue: true,
		timeout: 30000
	});
	if (result.exceptionDetails) {
		const d = result.exceptionDetails;
		throw new Error(d.exception?.description || d.exception?.value || d.text || JSON.stringify(d));
	}
	return result.result.value;
}

function gitSha(): string {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

async function main() {
	const chromiumPath = findChromiumPath();
	if (!chromiumPath) {
		console.error('No Chromium/Chrome binary found (set CHROME_BIN or CHROMIUM_BIN). Skipping real-browser benchmark.');
		process.exitCode = 0;
		return;
	}

	const appsServer = await serveDir(APPS_DIR);
	const litheServer = await serveDir(LITHE_DIST);
	const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-realbench-'));
	const debugPort = 9700 + Math.floor(Math.random() * 300);
	const browser = spawn(chromiumPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

	const cleanup = async () => {
		browser.kill('SIGKILL');
		appsServer.close();
		litheServer.close();
		await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
	};

	try {
		const version = await waitJSON(`http://127.0.0.1:${debugPort}/json/version`);
		const browserVersion = version.Browser as string;
		const root = connectCDP(version.webSocketDebuggerUrl);
		await root.ready;

		const targets: Record<string, string> = {
			vanilla: `${appsServer.url}/vanilla.html`,
			lithe: `${litheServer.url}/`,
			react: `${appsServer.url}/react.html`,
			solid: `${appsServer.url}/solid.html`
		};

		const results: Record<string, any> = {};
		for (const [name, url] of Object.entries(targets)) {
			const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' });
			let pageInfo: any;
			for (let i = 0; i < 30 && !pageInfo; i++) {
				const list = await waitJSON(`http://127.0.0.1:${debugPort}/json/list`);
				pageInfo = list.find((x: any) => x.id === targetId);
				if (!pageInfo) await new Promise(r => setTimeout(r, 100));
			}
			if (!pageInfo) throw new Error(`Chromium page target unavailable for ${name}`);
			const page = connectCDP(pageInfo.webSocketDebuggerUrl);
			await page.ready;
			await page.send('Page.enable');
			await page.send('Runtime.enable');
			try {
				results[name] = await runInBrowser(page, url);
			} catch (error: any) {
				results[name] = { error: String(error?.message || error) };
			}
			page.close();
			await root.send('Target.closeTarget', { targetId });
		}
		root.close();

		const report = {
			at: new Date().toISOString(),
			commit: gitSha(),
			platform: `${os.platform()} ${os.release()} (${os.arch()})`,
			browser: browserVersion,
			results
		};
		console.log(JSON.stringify(report, null, 2));

		const scenarios = ['create1k', 'update10th', 'selectOne', 'swapRows', 'removeOne', 'clearAll'];
		const frameworks = Object.keys(targets);
		console.log('\n' + 'Scenario'.padEnd(14) + frameworks.map(f => f.padStart(10)).join(''));
		for (const scenario of scenarios) {
			const row = frameworks.map(f => {
				const v = results[f]?.[scenario];
				return (typeof v === 'number' ? v.toFixed(2) + 'ms' : 'err').padStart(10);
			}).join('');
			console.log(scenario.padEnd(14) + row);
		}
	} finally {
		await cleanup();
	}
}

main().catch(error => {
	console.error(error?.stack || error);
	process.exitCode = 1;
});
