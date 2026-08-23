import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { compileModule } from '../src/compiler/jsx.ts';
import { SRC_ROOT, exists, rewriteBareImports, rewriteLocalJSX, walk } from './shared.ts';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jsx': 'text/javascript; charset=utf-8', '.ts': 'text/javascript; charset=utf-8', '.tsx': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function safe(root, pathname) { const p = path.resolve(root, '.' + pathname); return p.startsWith(path.resolve(root)) ? p : null; }
function deps(code) { const out = []; const re = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g; let m; while ((m = re.exec(code))) out.push(m[1] || m[2]); return out; }
function normalizeURL(spec, from) { if (!spec.startsWith('.')) return spec; try { return new URL(spec, 'http://lithe.local' + from).pathname; } catch { return spec; } }
function sourceURL(root, file) { const rel = path.relative(root, file).replace(/\\/g, '/'); return rel.startsWith('src/') ? '/' + rel.replace(/\.(?:jsx|tsx|ts)$/i, '.js') : null; }
async function resolveSource(file) { if (await exists(file)) return file; if (/\.js$/.test(file)) { for (const ext of ['.jsx', '.ts', '.tsx']) { const alt = file.slice(0, -3) + ext; if (await exists(alt)) return alt; } } return file; }

const HMR_CLIENT = String.raw`
const records=new Map(), hotData=new Map();
function norm(spec,base){try{return new URL(spec,location.origin+base).pathname}catch{return spec}}
function context(url){let rec=records.get(url);if(!rec){rec={url,self:[],deps:new Map(),dispose:[]};records.set(url,rec)}const data=hotData.get(url)||{};hotData.set(url,data);return{data,accept(dep,cb){if(typeof dep==='function'||dep==null){rec.self.push(typeof dep==='function'?dep:(cb||(()=>{})));return}for(const d of(Array.isArray(dep)?dep:[dep]))rec.deps.set(norm(d,url),cb||(()=>{}));},dispose(cb){if(typeof cb==='function')rec.dispose.push(cb)},invalidate(){location.reload()}}}
globalThis.__LITHE_HMR__={createHotContext:context,records,data:hotData};
// FEAT-4: Track which <style data-lithe-style="..."> tags each module owns so they can be
// removed before the module is hot-replaced, preventing stale style accumulation.
const __litheStyleOwners=new Map();
function __litheTrackStyles(url){const before=new Set([...document.querySelectorAll('style[data-lithe-style]')].map(el=>el.dataset.litheStyle));return()=>{const after=[...document.querySelectorAll('style[data-lithe-style]')].map(el=>el.dataset.litheStyle).filter(n=>!before.has(n));__litheStyleOwners.set(url,after);};}
function __litheclearStyles(url){for(const name of __litheStyleOwners.get(url)||[]){const el=document.querySelector('style[data-lithe-style="'+name+'"]');if(el)el.remove();}__litheStyleOwners.delete(url);}
async function replace(url,rec,callbacks){const registry=globalThis.__LITHE_HMR_SIGNAL_REGISTRY__;if(registry){const snap={};for(const [name,sig] of registry)try{snap[name]=sig.peek?.()??sig.value}catch{}globalThis.__LITHE_HMR_SIGNAL_SNAPSHOT__=snap;}for(const fn of rec?.dispose||[])try{await fn(hotData.get(rec.url))}catch(e){console.error('[lithe:HMR] dispose',e)}__litheclearStyles(url);const trackDone=__litheTrackStyles(url);const fresh=await import(url+(url.includes('?')?'&':'?')+'t='+Date.now());trackDone();for(const cb of callbacks)try{await cb(fresh)}catch(e){console.error('[lithe:HMR] accept',e)}return fresh}
const es=new EventSource('/__lithe_hmr');
es.addEventListener('change',async e=>{let msg;try{msg=JSON.parse(e.data)}catch{msg={path:e.data,invalidated:[e.data]}};const file=msg.path;if(/\.css$/.test(file)){for(const l of document.querySelectorAll('link[rel="stylesheet"]')){const u=new URL(l.href);u.searchParams.set('t',Date.now());l.href=u}return}const changed=file.startsWith('/')?file:'/'+file.replace(/^\.?\//,'');let handled=false;const self=records.get(changed);if(self?.self.length){await replace(changed,self,self.self);handled=true}else{for(const rec of records.values()){const cb=rec.deps.get(changed);if(cb){await replace(changed,records.get(changed),[cb]);handled=true}}}if(!handled){console.info('[lithe:HMR] no accept boundary for',changed,'reloading');location.reload()}});
`;

async function watchTree(root, onChange) { const watchers = []; const dirs = new Set(); for (const file of await walk(root).catch(() => [])) dirs.add(path.dirname(file)); dirs.add(root); for (const dir of dirs) { try { watchers.push(fsSync.watch(dir, { persistent: false }, (event, name) => name && onChange(path.join(dir, String(name))))) } catch { } } return () => watchers.forEach(w => w.close()); }

export async function devServer(projectDir, options = {}) {
	const root = path.resolve(projectDir), publicDir = path.join(root, 'public'), port = Number(options.port ?? 3000), clients = new Set(), graph = new Map(), reverse = new Map();
	function recordGraph(url, code) { const previous = graph.get(url) || []; for (const d of previous) { const set = reverse.get(d); set?.delete(url); } const list = deps(code).map(s => normalizeURL(s, url)).filter(s => s.startsWith('/')); graph.set(url, list); for (const d of list) { if (!reverse.has(d)) reverse.set(d, new Set()); reverse.get(d).add(url); } }
	function invalidated(url) { const seen = new Set([url]), q = [url]; while (q.length) { const x = q.shift(); for (const p of reverse.get(x) || []) if (!seen.has(p)) { seen.add(p); q.push(p); } } return [...seen]; }
	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, `http://${req.headers.host}`); if (url.pathname === '/__lithe_hmr') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' }); res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; } if (url.pathname === '/__lithe_hmr_client.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(HMR_CLIENT); return; }
			let file; if (url.pathname.startsWith('/__lithe/')) file = safe(SRC_ROOT, url.pathname.slice('/__lithe'.length)); else if (url.pathname.startsWith('/src/')) file = safe(root, url.pathname); else file = safe(publicDir, url.pathname === '/' ? '/index.html' : url.pathname); if (file) file = await resolveSource(file); if (!file || !await exists(file)) { file = path.join(publicDir, 'index.html'); if (!await exists(file)) { res.writeHead(404); res.end('Not Found'); return; } }
			let data = await fs.readFile(file), ext = path.extname(file); if (/\.(?:js|jsx|ts|tsx)$/.test(ext)) { let code = data.toString('utf8'); if (/\.(?:jsx|tsx|ts)$/.test(ext)) code = compileModule(code, { runtimeImport: '@lithe/dom', typescript: /\.(?:ts|tsx)$/.test(ext), filename: path.relative(root, file), captureEvents: false }).code; code = rewriteLocalJSX(rewriteBareImports(code, '/__lithe/')); const moduleURL = url.pathname.replace(/\.(?:jsx|tsx|ts)$/i, '.js'); if (options.hmr !== false && moduleURL.startsWith('/src/')) code = `import.meta.hot = globalThis.__LITHE_HMR__?.createHotContext(${JSON.stringify(moduleURL)});\n` + code; recordGraph(moduleURL, code); data = Buffer.from(code); ext = '.js'; } else if (ext === '.html' && options.hmr !== false) { let html = data.toString('utf8'); const client = '<script type="module" src="/__lithe_hmr_client.js"></script>'; html = html.includes('</head>') ? html.replace('</head>', `${client}</head>`) : html.replace('<body>', `${client}<body>`); data = Buffer.from(html); } res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
		} catch (error) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end(error.stack); }
	});
	const stopWatch = await watchTree(root, file => { const rel = path.relative(root, file).replace(/\\/g, '/'), url = sourceURL(root, file) || '/' + rel; const payload = JSON.stringify({ path: url, invalidated: invalidated(url) }); for (const client of clients) client.write(`event: change\ndata: ${payload}\n\n`); }); server.on('close', stopWatch);
	let actualPort = port;
	for (let attempt = 0; attempt < 20; attempt++) {
		try { await new Promise((resolve, reject) => { const onError = error => { server.off('listening', resolve); reject(error); }; server.once('error', onError); server.listen(actualPort, options.host || '127.0.0.1', () => { server.off('error', onError); resolve(); }); }); break; }
		catch (error) { if (error?.code !== 'EADDRINUSE' || port === 0 || attempt === 19) { stopWatch(); throw error; } actualPort++; }
	}
	const address = server.address(); actualPort = typeof address === 'object' && address ? address.port : actualPort; return { server, url: `http://${options.host || '127.0.0.1'}:${actualPort}`, moduleGraph: graph };
}
