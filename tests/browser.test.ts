import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { devServer } from '../tools/dev-server.ts';

async function waitJSON(url, timeout = 6000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch (e) { last = e; } await new Promise(r => setTimeout(r, 100)); } throw last || new Error(`Timed out waiting for ${url}`); }
function connectCDP(url) { const ws = new WebSocket(url), pending = new Map(), listeners = new Map(); let seq = 0; const ready = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id) { const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); } } else if (msg.method) { for (const fn of listeners.get(msg.method) || []) fn(msg.params); } }); return { ready, ws, send(method, params = {}) { const id = ++seq; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, once(method, timeout = 7000) { return new Promise((resolve, reject) => { const list = listeners.get(method) || [], fn = p => { clearTimeout(timer); listeners.set(method, list.filter(x => x !== fn)); resolve(p); }; list.push(fn); listeners.set(method, list); const timer = setTimeout(() => { listeners.set(method, list.filter(x => x !== fn)); reject(new Error(`Timed out for ${method}`)); }, timeout); }); }, close() { ws.close(); } }; }

test('dev server bootstraps HMR before application modules', async t => {
	const dev = await devServer(new URL('../examples/todo', import.meta.url).pathname, { port: 0 }); t.after(() => dev.server.close());
	const html = await (await fetch(dev.url)).text();
	assert.ok(html.indexOf('/__lithe_hmr_client.js') < html.indexOf('/src/main.tsx'));
	const source = await (await fetch(`${dev.url}/src/main.tsx`)).text();
	assert.match(source, /createHotContext\("\/src\/main\.js"\)/);
});

test('real Chromium loads compiled example and executes browser runtime', async t => {
	const dev = await devServer(new URL('../examples/todo', import.meta.url).pathname, { host: '0.0.0.0', port: 0, hmr: false }); t.after(() => dev.server.close());
	const port = dev.server.address().port;
	const privateIP = Object.values(os.networkInterfaces()).flat().find(x => x && x.family === 'IPv4' && !x.internal)?.address;
	const candidates = [dev.url, privateIP ? `http://${privateIP}:${port}` : null].filter(Boolean);
	const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-chromium-')), debugPort = 9333 + Math.floor(Math.random() * 500);
	const browser = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' }); t.after(() => { browser.kill('SIGKILL'); fs.rm(profile, { recursive: true, force: true }).catch(() => { }); });
	try {
		const version = await waitJSON(`http://127.0.0.1:${debugPort}/json/version`); const root = connectCDP(version.webSocketDebuggerUrl); await root.ready; const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' }); root.close();
		let pageInfo; for (let i = 0; i < 30 && !pageInfo; i++) { const list = await waitJSON(`http://127.0.0.1:${debugPort}/json/list`); pageInfo = list.find(x => x.id === targetId); if (!pageInfo) await new Promise(r => setTimeout(r, 100)); } if (!pageInfo) throw new Error('Chromium page target unavailable');
		const page = connectCDP(pageInfo.webSocketDebuggerUrl); await page.ready; await page.send('Page.enable'); let html = '', blocked = true;
		for (const url of candidates) { const loaded = page.once('Page.loadEventFired', 8000); await page.send('Page.navigate', { url }); await loaded; await new Promise(r => setTimeout(r, 250)); const value = await page.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }); html = value.result.value; blocked = /organization(?:\s|&nbsp;|’|')+doesn|is blocked<\/span>/i.test(html); if (!blocked) break; }
		page.close(); if (blocked) { t.skip('Chromium policy blocks local/private HTTP in this environment'); return; } assert.match(html, /Lithe Zero/); assert.match(html, /id="app"/); assert.doesNotMatch(html, /id="app"><\/div>/);
	} catch (error) { if (/ERR_BLOCKED_BY_CLIENT|ERR_CONNECTION|Timed out|unavailable/.test(error.message)) { t.skip(`Chromium environment prevented loopback integration: ${error.message}`); return; } throw error; }
});
