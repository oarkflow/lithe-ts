import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { compileModule } from '../src/compiler/jsx.ts';
import { compileTailwind, litheTailwindPlugin } from '../src/plugins/tailwind.ts';
import { SRC_ROOT, exists, rewriteBareImports, rewritePathAliases, loadProjectAliases, rewriteLocalJSX, walk } from './shared.ts';

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.jsx': 'text/javascript; charset=utf-8',
	'.ts': 'text/javascript; charset=utf-8',
	'.tsx': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon'
};

function safe(root, pathname) {
	const p = path.resolve(root, '.' + pathname);
	return p.startsWith(path.resolve(root)) ? p : null;
}

function deps(code) {
	const out = [];
	const re = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	let m;
	while ((m = re.exec(code))) out.push(m[1] || m[2]);
	return out;
}

function normalizeURL(spec, from) {
	if (!spec.startsWith('.')) return spec;
	try {
		return new URL(spec, 'http://lithe.local' + from).pathname;
	} catch {
		return spec;
	}
}

function sourceURL(root, file) {
	const rel = path.relative(root, file).replace(/\\/g, '/');
	return rel.startsWith('src/') ? '/' + rel.replace(/\.(?:jsx|tsx|ts)$/i, '.js') : null;
}

async function resolveSource(file) {
	if (await exists(file)) return file;
	if (/\.js$/.test(file)) {
		for (const ext of ['.jsx', '.ts', '.tsx']) {
			const alt = file.slice(0, -3) + ext;
			if (await exists(alt)) return alt;
		}
	}
	return file;
}

const HMR_CLIENT = String.raw`
const records=new Map(),hotData=new Map();
function norm(spec,base){try{return new URL(spec,location.origin+base).pathname}catch{return spec}}
function context(url){let rec=records.get(url);if(!rec){rec={url,self:[],deps:new Map(),dispose:[]};records.set(url,rec)}const data=hotData.get(url)||{};hotData.set(url,data);return{data,accept(dep,cb){if(typeof dep==='function'||dep==null){rec.self.push(typeof dep==='function'?dep:(cb||(()=>{})));return}for(const d of(Array.isArray(dep)?dep:[dep]))rec.deps.set(norm(d,url),cb||(()=>{}));},dispose(cb){if(typeof cb==='function')rec.dispose.push(cb)},invalidate(){location.reload()}}}
globalThis.__LITHE_HMR__={createHotContext:context,records,data:hotData};
const __litheStyleOwners=new Map();
function __litheTrackStyles(url){const before=new Set([...document.querySelectorAll('style[data-lithe-style]')].map(el=>el.dataset.litheStyle));return()=>{const after=[...document.querySelectorAll('style[data-lithe-style]')].map(el=>el.dataset.litheStyle).filter(n=>!before.has(n));__litheStyleOwners.set(url,after);};}
function __litheclearStyles(url){for(const name of __litheStyleOwners.get(url)||[]){const el=document.querySelector('style[data-lithe-style="'+name+'"]');if(el)el.remove();}__litheStyleOwners.delete(url);}
async function replace(url,rec,callbacks){const registry=globalThis.__LITHE_HMR_SIGNAL_REGISTRY__;if(registry){const snap={};for(const [name,sig] of registry)try{snap[name]=sig.peek?.()??sig.value}catch{}globalThis.__LITHE_HMR_SIGNAL_SNAPSHOT__=snap;}for(const fn of rec?.dispose||[])try{await fn(hotData.get(rec.url))}catch(e){console.error('[lithe:HMR] dispose',e)}__litheclearStyles(url);const trackDone=__litheTrackStyles(url);const fresh=await import(url+(url.includes('?')?'&':'?')+'t='+Date.now());trackDone();for(const cb of callbacks)try{await cb(fresh)}catch(e){console.error('[lithe:HMR] accept',e)}return fresh}
const __litheOverlayStyle=":host{all:initial}.lithe-error-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(12,14,18,.92);color:#f2f5f8;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;padding:32px;box-sizing:border-box}.lithe-error-overlay .lithe-eo-card{max-width:900px;margin:0 auto;background:#1a1f27;border:1px solid #3a4452;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px #000a}.lithe-error-overlay header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#3a1a1f;border-bottom:1px solid #5c2530}.lithe-error-overlay h1{font:600 15px system-ui,sans-serif;margin:0;color:#ff9a9a}.lithe-error-overlay button{border:1px solid #6b7686;border-radius:6px;background:#242b35;color:inherit;padding:4px 10px;cursor:pointer;font:inherit}.lithe-error-overlay .lithe-eo-file{padding:10px 20px;color:#9fb4cc;border-bottom:1px solid #2b3341;word-break:break-all}.lithe-error-overlay .lithe-eo-message{padding:16px 20px;color:#f2f5f8;white-space:pre-wrap;word-break:break-word;font-size:15px}.lithe-error-overlay pre{margin:0;padding:16px 20px;overflow:auto;color:#c3cbd6;background:#12161c;max-height:40vh;white-space:pre-wrap}";
let __litheOverlayHost=null;
function __litheOverlayPanel(){if(__litheOverlayHost)return __litheOverlayHost.shadowRoot.querySelector('.lithe-error-overlay');__litheOverlayHost=document.createElement('div');const shadow=__litheOverlayHost.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=__litheOverlayStyle;shadow.append(style);const panel=document.createElement('div');panel.className='lithe-error-overlay';panel.style.display='none';shadow.append(panel);(document.body||document.documentElement).append(__litheOverlayHost);return panel}
function __litheHideError(){if(!__litheOverlayHost)return;__litheOverlayPanel().style.display='none'}
function __litheShowError(info){const panel=__litheOverlayPanel();panel.textContent='';const card=document.createElement('div');card.className='lithe-eo-card';const header=document.createElement('header');const h1=document.createElement('h1');h1.textContent=info.type||'Error';const close=document.createElement('button');close.type='button';close.textContent='Dismiss';close.onclick=__litheHideError;header.append(h1,close);card.append(header);if(info.file){const f=document.createElement('div');f.className='lithe-eo-file';f.textContent=info.file+(info.line?(':'+info.line+(info.col?':'+info.col:'')):'');card.append(f)}const msg=document.createElement('div');msg.className='lithe-eo-message';msg.textContent=info.message||'Unknown error';card.append(msg);if(info.stack){const pre=document.createElement('pre');pre.textContent=info.stack;card.append(pre)}panel.append(card);panel.style.display='block'}
globalThis.__LITHE_DEV_ERROR__=__litheShowError;
globalThis.__LITHE_DEV_OVERLAY__=__litheShowError;
addEventListener('error',e=>__litheShowError({type:'Runtime Error',message:e.message,file:e.filename,line:e.lineno,col:e.colno,stack:e.error&&e.error.stack}));
addEventListener('unhandledrejection',e=>{const r=e.reason;__litheShowError({type:'Unhandled Promise Rejection',message:(r&&r.message)||String(r),stack:r&&r.stack})});
const es=new EventSource('/__lithe_hmr');
es.addEventListener('change',async e=>{__litheHideError();let msg;try{msg=JSON.parse(e.data)}catch{msg={path:e.data,invalidated:[e.data]}};const file=msg.path;if(/\.css$/.test(file)){for(const l of document.querySelectorAll('link[rel="stylesheet"]')){const u=new URL(l.href);u.searchParams.set('t',Date.now());l.href=u}return}const changed=file.startsWith('/')?file:'/'+file.replace(/^\.?\//,'');let handled=false;const self=records.get(changed);if(self?.self.length){await replace(changed,self,self.self);handled=true}else{for(const rec of records.values()){const cb=rec.deps.get(changed);if(cb){await replace(changed,records.get(changed),[cb]);handled=true}}}if(!handled){console.info('[lithe:HMR] no accept boundary for',changed,'reloading');location.reload()}});
`;

// A compile error must not be served as the literal stack-trace text for a
// `<script type="module" src="...">` response: the browser will try to
// parse that text AS JAVASCRIPT and fail with a confusing, unrelated
// "Unexpected token" syntax error instead of showing the real problem.
// Serving a genuinely valid module that reports the error to the overlay
// (installed by HMR_CLIENT, which always loads before app code) gets the
// actual message and file/line in front of the developer instead. Status
// must stay 200 — a non-2xx response body for a module script is never
// executed at all, so the overlay would never even see it.
function overlayErrorModule(info) {
	const payload = JSON.stringify(info);
	return `(globalThis.__LITHE_DEV_ERROR__||function(e){console.error('[lithe:dev]',e)})(${payload});\nexport {};\n`;
}

async function watchTree(root, onChange) {
	const watchers = [];
	const dirs = new Set();
	for (const file of await walk(root).catch(() => [])) dirs.add(path.dirname(file));
	dirs.add(root);
	for (const dir of dirs) {
		try {
			watchers.push(fsSync.watch(dir, { persistent: false }, (event, name) =>
				name && onChange(path.join(dir, String(name)))
			));
		} catch {}
	}
	return () => watchers.forEach(w => w.close());
}

export async function devServer(projectDir, options = {}) {
	const root = path.resolve(projectDir);
	const publicDir = path.join(root, 'public');
	const rootIndex = path.join(root, 'index.html');
	const indexFile = await exists(rootIndex) ? rootIndex : path.join(publicDir, 'index.html');
	const port = Number(options.port ?? 3000);
	const clients = new Set();
	const graph = new Map();
	const reverse = new Map();
	const projectAliases = await loadProjectAliases(root);

	function recordGraph(url, code) {
		const previous = graph.get(url) || [];
		for (const d of previous) {
			const set = reverse.get(d);
			set?.delete(url);
		}
		const list = deps(code).map(s => normalizeURL(s, url)).filter(s => s.startsWith('/'));
		graph.set(url, list);
		for (const d of list) {
			if (!reverse.has(d)) reverse.set(d, new Set());
			reverse.get(d).add(url);
		}
	}

	function invalidated(url) {
		const seen = new Set([url]);
		const q = [url];
		while (q.length) {
			const x = q.shift();
			for (const p of reverse.get(x) || []) {
				if (!seen.has(p)) {
					seen.add(p);
					q.push(p);
				}
			}
		}
		return [...seen];
	}

	const server = http.createServer(async (req, res) => {
		// Parsed before the try block (not inside it) so the catch handler
		// below — which needs url.pathname to decide whether an unexpected
		// error should be reported through the overlay-module response
		// instead of a plain-text 500 — can actually see it. A `const`
		// declared inside `try {}` is not visible in the matching `catch`.
		const url = new URL(req.url, `http://${req.headers.host}`);
		try {

			if (url.pathname === '/__lithe_hmr') {
				res.writeHead(200, {
					'content-type': 'text/event-stream',
					'cache-control': 'no-cache',
					'connection': 'keep-alive'
				});
				res.write('\n');
				clients.add(res);
				req.on('close', () => clients.delete(res));
				return;
			}

			if (url.pathname === '/__lithe_hmr_client.js') {
				res.writeHead(200, {
					'content-type': 'text/javascript; charset=utf-8',
					'cache-control': 'no-store'
				});
				res.end(HMR_CLIENT);
				return;
			}

			if (url.pathname === '/tailwind.css' || url.pathname === '/__lithe_tailwind.css') {
				const tw = await compileTailwind('', { projectRoot: root });
				res.writeHead(200, {
					'content-type': 'text/css; charset=utf-8',
					'cache-control': 'no-store'
				});
				res.end(tw);
				return;
			}

			let reqPath = url.pathname;
			for (const [aliasKey, targetDir] of Object.entries(projectAliases)) {
				if (reqPath === `/${aliasKey}` || reqPath.startsWith(`/${aliasKey}/`)) {
					reqPath = '/' + path.posix.join(targetDir.replace(/^\/+/, ''), reqPath.slice(aliasKey.length + 1));
					break;
				}
			}

			let file;
			if (reqPath.startsWith('/__lithe/')) {
				file = safe(SRC_ROOT, reqPath.slice('/__lithe'.length));
			} else if (reqPath.startsWith('/src/')) {
				file = safe(root, reqPath);
			} else {
				file = reqPath === '/' ? indexFile : safe(publicDir, reqPath);
			}

			if (file) file = await resolveSource(file);

			if (!file || !await exists(file)) {
				file = indexFile;
				if (!await exists(file)) {
					res.writeHead(404);
					res.end('Not Found');
					return;
				}
			}

			let data = await fs.readFile(file);
			let ext = path.extname(file);

			if (ext === '.css') {
				let cssText = data.toString('utf8');
				if (cssText.includes('@tailwind')) {
					cssText = await compileTailwind(cssText, { projectRoot: root });
					data = Buffer.from(cssText);
				}
			} else if (/\.(?:js|jsx|ts|tsx)$/.test(ext)) {
				let code = data.toString('utf8');
				if (/\.(?:jsx|tsx|ts)$/.test(ext)) {
					try {
						code = compileModule(code, {
							runtimeImport: '@oarkflow/lithe/dom',
							typescript: /\.(?:ts|tsx)$/.test(ext),
							filename: path.relative(root, file),
							captureEvents: false
						}).code;
					} catch (error) {
						res.writeHead(200, {
							'content-type': 'text/javascript; charset=utf-8',
							'cache-control': 'no-store'
						});
						res.end(overlayErrorModule({
							type: 'Compile Error',
							file: path.relative(root, file),
							line: error.line ?? error.loc?.line,
							col: error.column ?? error.loc?.column,
							message: error.message || String(error),
							stack: error.stack
						}));
						return;
					}
				}
				code = rewriteLocalJSX(rewritePathAliases(rewriteBareImports(code, '/__lithe/'), projectAliases));
				const moduleURL = reqPath.replace(/\.(?:jsx|tsx|ts)$/i, '.js');
				if (options.hmr !== false && moduleURL.startsWith('/src/')) {
					code = `import.meta.hot = globalThis.__LITHE_HMR__?.createHotContext(${JSON.stringify(moduleURL)});\n` + code;
				}
				recordGraph(moduleURL, code);
				data = Buffer.from(code);
				ext = '.js';
			} else if (ext === '.html' && options.hmr !== false) {
				let html = data.toString('utf8');
				const tw = await compileTailwind('', { projectRoot: root });
				if (tw) html = litheTailwindPlugin().transformIndexHtml(html, tw);
				const client = '<script type="module" src="/__lithe_hmr_client.js"></script>';
				html = html.includes('</head>')
					? html.replace('</head>', `${client}</head>`)
					: html.replace('<body>', `${client}<body>`);
				data = Buffer.from(html);
			}

			res.writeHead(200, {
				'content-type': types[ext] || 'application/octet-stream',
				'cache-control': 'no-store'
			});
			res.end(data);
		} catch (error) {
			// A request for a JS-family URL still needs a valid, executable
			// module response (see overlayErrorModule above) even for an
			// unexpected server-side failure outside the dedicated compile
			// try/catch — otherwise the browser gets the same confusing
			// syntax error instead of the real one.
			if (/\.(?:js|jsx|ts|tsx|mjs)$/.test(url.pathname)) {
				res.writeHead(200, {
					'content-type': 'text/javascript; charset=utf-8',
					'cache-control': 'no-store'
				});
				res.end(overlayErrorModule({
					type: 'Dev Server Error',
					file: url.pathname,
					message: error.message || String(error),
					stack: error.stack
				}));
				return;
			}
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.end(error.stack);
		}
	});

	const stopWatch = await watchTree(root, file => {
		const rel = path.relative(root, file).replace(/\\/g, '/');
		const url = sourceURL(root, file) || '/' + rel;
		const payload = JSON.stringify({ path: url, invalidated: invalidated(url) });
		for (const client of clients) client.write(`event: change\ndata: ${payload}\n\n`);
	});
	server.on('close', stopWatch);

	let actualPort = port;
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			await new Promise((resolve, reject) => {
				const onError = error => {
					server.off('listening', resolve);
					reject(error);
				};
				server.once('error', onError);
				server.listen(actualPort, options.host || '127.0.0.1', () => {
					server.off('error', onError);
					resolve();
				});
			});
			break;
		} catch (error) {
			if (error?.code !== 'EADDRINUSE' || port === 0 || attempt === 19) {
				stopWatch();
				throw error;
			}
			actualPort++;
		}
	}

	const address = server.address();
	actualPort = typeof address === 'object' && address ? address.port : actualPort;
	return { server, url: `http://${options.host || '127.0.0.1'}:${actualPort}`, moduleGraph: graph };
}
