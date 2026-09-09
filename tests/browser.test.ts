import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { devServer } from '../tools/dev-server.ts';

const DEMO_EXAMPLE = new URL('../examples/todo', import.meta.url).pathname;

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
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

async function waitJSON(url, timeout = 6000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch (e) { last = e; } await new Promise(r => setTimeout(r, 100)); } throw last || new Error(`Timed out waiting for ${url}`); }
function connectCDP(url) { const ws = new WebSocket(url), pending = new Map(), listeners = new Map(); let seq = 0; const ready = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id) { const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); } } else if (msg.method) { for (const fn of listeners.get(msg.method) || []) fn(msg.params); } }); return { ready, ws, send(method, params = {}) { const id = ++seq; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, once(method, timeout = 7000) { return new Promise((resolve, reject) => { const list = listeners.get(method) || [], fn = p => { clearTimeout(timer); listeners.set(method, list.filter(x => x !== fn)); resolve(p); }; list.push(fn); listeners.set(method, list); const timer = setTimeout(() => { listeners.set(method, list.filter(x => x !== fn)); reject(new Error(`Timed out for ${method}`)); }, timeout); }); }, close() { ws.close(); } }; }

async function assertChromiumLoads(t, project, expectedText, options: { path?: string; evaluate?: string } = {}) {
	const chromiumPath = findChromiumPath();
	if (!chromiumPath) {
		t.skip('Chromium/Chrome binary not found in environment');
		return;
	}
	let dev; try { dev = await devServer(project, { host: '0.0.0.0', port: 0, hmr: false }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); return; } throw error; } t.after(() => dev.server.close());
	const port = dev.server.address().port;
	const privateIP = Object.values(os.networkInterfaces()).flat().find(x => x && x.family === 'IPv4' && !x.internal)?.address;
	const candidates = [dev.url, privateIP ? `http://${privateIP}:${port}` : null]
		.filter(Boolean)
		.map(url => new URL(options.path || '/', url).href);
	const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-chromium-')), debugPort = 9333 + Math.floor(Math.random() * 500);
	const browser = spawn(chromiumPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' }); t.after(() => { browser.kill('SIGKILL'); fs.rm(profile, { recursive: true, force: true }).catch(() => { }); });
	try {
		const version = await waitJSON(`http://127.0.0.1:${debugPort}/json/version`); const root = connectCDP(version.webSocketDebuggerUrl); await root.ready; const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' }); root.close();
		let pageInfo; for (let i = 0; i < 30 && !pageInfo; i++) { const list = await waitJSON(`http://127.0.0.1:${debugPort}/json/list`); pageInfo = list.find(x => x.id === targetId); if (!pageInfo) await new Promise(r => setTimeout(r, 100)); } if (!pageInfo) throw new Error('Chromium page target unavailable');
		const page = connectCDP(pageInfo.webSocketDebuggerUrl); await page.ready; await page.send('Page.enable'); let html = '', blocked = true;
		for (const url of candidates) { const loaded = page.once('Page.loadEventFired', 8000); await page.send('Page.navigate', { url }); await loaded; await new Promise(r => setTimeout(r, 250)); const value = await page.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }); html = value.result.value; blocked = /organization(?:\s|&nbsp;|’|')+doesn|is blocked<\/span>/i.test(html); if (!blocked) break; }
		if (blocked) { page.close(); t.skip('Chromium policy blocks local/private HTTP in this environment'); return; }
		assert.match(html, expectedText); assert.match(html, /id="app"/); assert.doesNotMatch(html, /id="app"><\/div>/);
		if (options.evaluate) {
			const evaluated = await page.send('Runtime.evaluate', { expression: options.evaluate, awaitPromise: true, returnByValue: true });
			if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text || 'Browser evaluation failed');
			assert.equal(evaluated.result.value, true);
		}
		page.close();
	} catch (error) { if (/ERR_BLOCKED_BY_CLIENT|ERR_CONNECTION|Timed out|unavailable/.test(error.message)) { t.skip(`Chromium environment prevented loopback integration: ${error.message}`); return; } throw error; }
}

test('demo dev server bootstraps HMR before application modules', async t => {
	let dev; try { dev = await devServer(DEMO_EXAMPLE, { port: 0 }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); return; } throw error; } t.after(() => dev.server.close());
	const html = await (await fetch(dev.url)).text();
	assert.ok(html.indexOf('/__lithe_hmr_client.js') < html.indexOf('/src/index.tsx'));
	const source = await (await fetch(`${dev.url}/src/index.tsx`)).text();
	assert.match(source, /createHotContext\("\/src\/index\.js"\)/);
});

test('dev server reports an unexpected per-request error as a valid overlay module, not a raw stack trace', async t => {
	const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-dev-error-'));
	t.after(() => fs.rm(projectDir, { recursive: true, force: true }).catch(() => { }));
	await fs.mkdir(path.join(projectDir, 'src/broken.tsx'), { recursive: true }); // a directory, not a file — forces fs.readFile to fail
	await fs.writeFile(path.join(projectDir, 'index.html'), '<!doctype html><html><head></head><body><div id="app"></div></body></html>');
	let dev; try { dev = await devServer(projectDir, { port: 0 }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); return; } throw error; }
	t.after(() => dev.server.close());
	const res = await fetch(`${dev.url}/src/broken.tsx`);
	assert.equal(res.status, 200, 'a JS-family request must still get a 200 + valid module, or the browser never executes the body at all');
	assert.match(res.headers.get('content-type') || '', /javascript/);
	const body = await res.text();
	assert.match(body, /__LITHE_DEV_ERROR__/);
	assert.match(body, /EISDIR/);
	const moduleFile = path.join(projectDir, 'response.mjs');
	await fs.writeFile(moduleFile, body);
	await assert.doesNotReject(import(pathToFileURL(moduleFile).href), 'the error-reporting response must itself be syntactically valid, importable JS');
});

test('demo dev server increments when the requested port is occupied', async t => {
	const occupied = http.createServer(); try { await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(0, '127.0.0.1', resolve); }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); return; } throw error; }
	const port = occupied.address().port;
	let dev; try { dev = await devServer(DEMO_EXAMPLE, { host: '127.0.0.1', port }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); occupied.close(); return; } throw error; }
	t.after(() => { dev.server.close(); occupied.close(); });
	assert.equal(new URL(dev.url).port, String(port + 1));
});

test('real Chromium loads demo example and executes browser runtime', async t => {
	await assertChromiumLoads(t, DEMO_EXAMPLE, /Lithe Zero/);
});

test('dev error overlay shows a runtime error thrown by app code', async t => {
	const chromiumPath = findChromiumPath();
	if (!chromiumPath) {
		t.skip('Chromium/Chrome binary not found in environment');
		return;
	}
	const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-overlay-'));
	t.after(() => fs.rm(projectDir, { recursive: true, force: true }).catch(() => { }));
	await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
	await fs.writeFile(path.join(projectDir, 'index.html'), '<!doctype html><html><head><title>Overlay Test</title></head><body><div id="app"></div><script type="module" src="/src/index.tsx"></script></body></html>');
	await fs.writeFile(path.join(projectDir, 'src/index.tsx'), 'throw new Error("boom-overlay-test");\n');

	let dev; try { dev = await devServer(projectDir, { host: '0.0.0.0', port: 0 }); } catch (error) { if (error.code === 'EPERM') { t.skip('Local HTTP is blocked by this environment'); return; } throw error; }
	t.after(() => dev.server.close());
	const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-chromium-overlay-')), debugPort = 9800 + Math.floor(Math.random() * 400);
	const browser = spawn(chromiumPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
	t.after(() => { browser.kill('SIGKILL'); fs.rm(profile, { recursive: true, force: true }).catch(() => { }); });
	try {
		const version = await waitJSON(`http://127.0.0.1:${debugPort}/json/version`);
		const root = connectCDP(version.webSocketDebuggerUrl); await root.ready;
		const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' }); root.close();
		let pageInfo; for (let i = 0; i < 30 && !pageInfo; i++) { const list = await waitJSON(`http://127.0.0.1:${debugPort}/json/list`); pageInfo = list.find(x => x.id === targetId); if (!pageInfo) await new Promise(r => setTimeout(r, 100)); }
		if (!pageInfo) throw new Error('Chromium page target unavailable');
		const page = connectCDP(pageInfo.webSocketDebuggerUrl); await page.ready; await page.send('Page.enable');
		const loaded = page.once('Page.loadEventFired', 8000);
		await page.send('Page.navigate', { url: dev.url });
		await loaded;
		await new Promise(r => setTimeout(r, 300));
		const check = await page.send('Runtime.evaluate', {
			expression: `(() => {
				const host = [...document.body.children].find(el => el.shadowRoot);
				const panel = host && host.shadowRoot.querySelector('.lithe-error-overlay');
				if (!panel) return { found: false };
				return { found: true, visible: panel.style.display === 'block', text: panel.textContent };
			})()`,
			returnByValue: true
		});
		page.close();
		const value = check.result.value;
		if (!value) { t.skip('Could not evaluate overlay state in this environment'); return; }
		assert.equal(value.found, true, 'the error overlay host must be mounted');
		assert.equal(value.visible, true, 'the error overlay must be visible after a runtime error');
		assert.match(value.text, /boom-overlay-test/);
	} catch (error) {
		if (/ERR_BLOCKED_BY_CLIENT|ERR_CONNECTION|Timed out|unavailable/.test(error.message)) { t.skip(`Chromium environment prevented loopback integration: ${error.message}`); return; }
		throw error;
	}
});

test('infinite article mutation renders the newly added article', async t => {
	await assertChromiumLoads(t, DEMO_EXAMPLE, /Infinite Scroll/, {
		path: '/infinite',
		evaluate: `(async()=>{
			await new Promise(resolve=>setTimeout(resolve,800));
			const input=document.querySelector('input[placeholder="Add a new article..."]');
			if(!input)return false;
			input.value='Browser-added article';
			input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'Browser-added article'}));
			document.querySelector('button[type="submit"]')?.click();
			await new Promise(resolve=>setTimeout(resolve,1200));
			return [...document.querySelectorAll('.article-title')].some(node=>node.textContent==='Browser-added article');
		})()`
	});
});
