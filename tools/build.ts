import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { compileModule } from '../src/compiler/jsx.ts';
import { stripTypeScript } from '../src/compiler/typescript.ts';
import { tracedSourceMap } from '../src/compiler/sourcemap.ts';
import { mergeReactiveGraphs, findReactiveCycles, optimizeReactiveGraph } from '../src/compiler/ir.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { FRAMEWORK_ROOT, SRC_ROOT, walk, ensureDir, exists, rewriteBareImports, rewriteLocalJSX } from './shared.ts';
import { extractStaticCSS, extractStaticThemes, transformCSSModule, transformScopedCSS, removeUnusedNamedImports } from './css.ts';
import { eliminateDeadBranches, minifyJS } from './minify.ts';
import { splitServerImports, serverModuleId } from './server-split.ts';
import { splitInlineServerFunctions, removeUnusedServerReferences } from './server-placement.ts';
import { collectUsedExports, treeShakeModule } from './tree-shake.ts';

const importRE = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
const dynamicImportRE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
async function copyTree(from, to, transform) { if (!await exists(from)) return; for (const file of await walk(from)) { const rel = path.relative(from, file), dest = path.join(to, rel); await ensureDir(dest); if (transform && await transform(file, dest)) continue; await fs.copyFile(file, dest); } }

async function frameworkSourceFor(outputRel) {
	const base = outputRel.replace(/\.js$/i, '');
	for (const ext of ['.ts', '.tsx', '.js']) { const candidate = path.join(SRC_ROOT, base + ext); if (await exists(candidate)) return candidate; }
	return null;
}
async function compileFrameworkSource(file, generatedFile) {
	const raw = await fs.readFile(file, 'utf8'), ext = path.extname(file);
	if (ext === '.tsx') {
		const compiled = compileModule(raw, { typescript: true, filename: path.relative(FRAMEWORK_ROOT, file), generatedFile, sourceMap: false, injectRuntime: false, captureEvents: false, lazyEvents: false, autoWorkers: false });
		if (compiled.diagnostics.some(d => d.severity === 'error')) throw new Error(`${path.relative(FRAMEWORK_ROOT, file)}: ${compiled.diagnostics.map(d => d.message).join('; ')}`);
		return { raw, code: rewriteLocalJSX(compiled.code) };
	}
	const code = ext === '.ts' ? stripTypeScript(raw, { filename: path.relative(FRAMEWORK_ROOT, file) }) : raw;
	return { raw, code: rewriteLocalJSX(code) };
}
async function emitFrameworkTree(to) {
	if (!await exists(SRC_ROOT)) return;
	for (const file of await walk(SRC_ROOT)) {
		if (!/\.(?:ts|tsx|js)$/.test(file)) continue;
		const rel = path.relative(SRC_ROOT, file).replace(/\.(?:ts|tsx)$/i, '.js'), dest = path.join(to, rel); await ensureDir(dest);
		const { code } = await compileFrameworkSource(file, rel); await fs.writeFile(dest, code);
	}
}
function dependencySpecs(code) { const out = []; importRE.lastIndex = 0; let m; while ((m = importRE.exec(code))) out.push({ spec: m[1], dynamic: false }); dynamicImportRE.lastIndex = 0; while ((m = dynamicImportRE.exec(code))) out.push({ spec: m[1], dynamic: true }); for (const e of code.matchAll(/\b(?:eventSymbol|capturedEventSymbol)\(\s*['"]([^'"]+)['"]/g)) out.push({ spec: e[1], dynamic: true, event: true }); return out; }
function dataGraphFor(code, file) { const queries = [], mutations = []; for (const m of code.matchAll(/\bquery\s*\(\s*\{[\s\S]*?tags\s*:\s*\[([^\]]*)\]/g)) queries.push({ file, tags: [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]) }); for (const m of code.matchAll(/\bmutation\s*\(\s*\{[\s\S]*?(?:writes|invalidates)\s*:\s*\[([^\]]*)\]/g)) mutations.push({ file, writes: [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]) }); return { queries, mutations }; }
function appendSourceMap(code, mapName) { return `${code.trimEnd()}\n//# sourceMappingURL=${path.basename(mapName)}\n`; }
function bundleSpecifier(from, spec) { if (spec.startsWith('/')) return spec.slice(1); if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)); return spec; }
function bundleModule(code, key) {
	const imports = [];
	code = code.replace(/import\s*([^;]+?)\s*from\s*(['"])([^'"]+)\2\s*;?/g, (_, clause, quote, spec) => { imports.push({ clause: clause.trim(), spec }); return ''; });
	code = code.replace(/import\s*(['"])([^'"]+)\1\s*;?/g, (_, quote, spec) => { imports.push({ clause: '', spec }); return ''; });
	code = code.replace(/import\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (_, quote, spec) => `__litheImport(${JSON.stringify(bundleSpecifier(key, spec))})`);
	const bindings = imports.map(({ clause, spec }) => { const target = bundleSpecifier(key, spec); if (!clause) return `__litheRequire(${JSON.stringify(target)});`; if (clause.startsWith('{')) { const names = clause.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).map(x => { const [from, to] = x.split(/\s+as\s+/); return `${from}:${to || from}`; }).join(','); return `const {${names}}=__litheRequire(${JSON.stringify(target)});`; } if (clause.startsWith('* as ')) return `const ${clause.slice(5).trim()}=__litheRequire(${JSON.stringify(target)});`; const parts = clause.split(',').map(x => x.trim()); const first = `const ${parts[0]}=__litheRequire(${JSON.stringify(target)}).default;`; if (parts[1]?.startsWith('{')) { const names = parts[1].slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).map(x => { const [from, to] = x.split(/\s+as\s+/); return `${from}:${to || from}`; }).join(','); return `${first}const {${names}}=__litheRequire(${JSON.stringify(target)});`; } return first; }).join('');
	const exports = [];
	code = code.replace(/export\s+(default\s+)?(async\s+)?(function|class)\s+([A-Za-z_$][\w$]*)/g, (_, def, async, kind, name) => { exports.push(`${def ? 'default' : name}:${name}`); return `${async || ''}${kind} ${name}`; });
	code = code.replace(/export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_, kind, name) => { exports.push(`${name}:${name}`); return `${kind} ${name}`; });
	code = code.replace(/export\s*\{([^}]+)\}\s*;?/g, (_, list) => { for (const item of list.split(',')) { const [from, to] = item.trim().split(/\s+as\s+/); if (from) exports.push(`${to || from}:${from}`); } return ''; });
	code = code.replace(/export\s*\*\s*from\s*(['"])([^'"]+)\1\s*;?/g, (_, quote, spec) => `Object.assign(__litheExports,__litheRequire(${JSON.stringify(bundleSpecifier(key, spec))}));`);
	return `${bindings}${code}${exports.length ? `Object.assign(__litheExports, {${exports.join(',')}});` : ''}`;
}
async function emitSingleBundle(out, entry, keys, minify = true) {
	const modules = [];
	for (const key of keys) { const file = path.join(out, key); if (!await exists(file) || !file.endsWith('.js')) continue; modules.push(`__litheModules[${JSON.stringify(key)}]=function(__litheRequire,__litheExports,__litheImport){${bundleModule(await fs.readFile(file, 'utf8'), key)}};`); }
	const code = `const __litheModules={},__litheCache={};function __litheRequire(k){if(__litheCache[k])return __litheCache[k];const e=__litheCache[k]={};__litheModules[k]?.(__litheRequire,e,__litheImport);return e}function __litheImport(k){return Promise.resolve(__litheRequire(k))}${modules.join('')}__litheRequire(${JSON.stringify(entry)});\n`;
	const file = path.join(out, 'app.js'); await fs.writeFile(file, minify ? minifyJS(code) : code); return file;
}
async function replaceAsync(code, re, fn) {
	let out = '', last = 0; re.lastIndex = 0; let m;
	while ((m = re.exec(code))) { out += code.slice(last, m.index) + await fn(m); last = m.index + m[0].length; }
	return out + code.slice(last);
}
async function replaceCSSImports(code, sourceFile, root, css) {
	code = await replaceAsync(code, /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])(\.\/?[^'"]+\.module\.css)\2\s*;?/g, async m => {
		const abs = path.resolve(path.dirname(sourceFile), m[3]), raw = await fs.readFile(abs, 'utf8'), r = transformCSSModule(raw, path.relative(root, abs)); css.push(r.css); return `const ${m[1]} = ${JSON.stringify(r.mapping)};`;
	});
	code = await replaceAsync(code, /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])(\.\/?[^'"]+\.scoped\.css)\2\s*;?/g, async m => {
		const abs = path.resolve(path.dirname(sourceFile), m[3]), raw = await fs.readFile(abs, 'utf8'), r = transformScopedCSS(raw, path.relative(root, abs)); css.push(r.css); return `const ${m[1]} = ${JSON.stringify({ scope: r.scope, attr: { 'data-lithe-scope': r.scope } })};`;
	});
	code = await replaceAsync(code, /import\s+(['"])(\.\/?[^'"]+\.css)\1\s*;?/g, async m => {
		const abs = path.resolve(path.dirname(sourceFile), m[2]), raw = await fs.readFile(abs, 'utf8'); css.push(raw); return '';
	});
	return code;
}

function eventChunkImports(code, sourceFile, sourceDir) {
	return code.replace(/((?:from\s+|import\s*\())(['"])(\.\.?\/[^'"]+)\2/g, (m, lead, q, spec) => {
		let target = path.resolve(path.dirname(sourceFile), spec); if (/\.(?:jsx|tsx|ts)$/i.test(target)) target = target.replace(/\.(?:jsx|tsx|ts)$/i, '.js'); else if (!path.extname(target)) target += '.js';
		const rel = path.relative(sourceDir, target).replace(/\\/g, '/'); if (rel.startsWith('../')) throw new Error(`Event chunk import escapes src/: ${spec}`); return `${lead}${q}/src/${rel}${q}`;
	});
}

export async function buildProject(projectDir, options = {}) {
	const root = path.resolve(projectDir), out = path.resolve(root, options.outDir || 'dist'), configFile = path.join(root, 'lithe.config.json'); let config = {}; if (await exists(configFile)) config = JSON.parse(await fs.readFile(configFile, 'utf8'));
	const sourceMaps = options.sourceMaps ?? config.sourceMaps ?? false, minify = options.minify ?? config.minify ?? true, dce = options.dce ?? config.dce ?? true, bundle = options.bundle ?? config.bundle ?? 'chunks';
	if (bundle !== 'chunks' && bundle !== 'single') throw new TypeError(`Unsupported bundle mode: ${bundle}. Use "chunks" or "single".`);
	globalThis.__LITHE_SINGLE_BUNDLE__ = bundle === 'single';
	await fs.rm(out, { recursive: true, force: true }); await fs.mkdir(out, { recursive: true });
	await copyTree(path.join(root, 'public'), out, async (file, dest) => { if (path.extname(file) === '.html') { let code = await fs.readFile(file, 'utf8'); code = code.replace(/(src=["'][^"']+)\.(?:jsx|tsx|ts)(["'])/g, '$1.js$2'); await fs.writeFile(dest, code); return true; } return false; });
	const css = [], graphs = [], moduleGraph = {}, dataGraphs = [], islands = [], workers = [], serverRefs = [], serverPlacements = [], eventChunks = []; const sourceDir = path.join(root, 'src'); const allSourceFiles = (await walk(sourceDir)).filter(f => /\.(?:js|jsx|ts|tsx)$/.test(f)); const serverSourceFiles = allSourceFiles.filter(f => /\.server\.(?:js|jsx|ts|tsx)$/.test(f)); const sourceFiles = allSourceFiles.filter(f => !/\.server\.(?:js|jsx|ts|tsx)$/.test(f));
	for (const file of sourceFiles) { const rel = path.relative(sourceDir, file), ext = path.extname(file); let dest = path.join(out, 'src', rel.replace(/\.(?:jsx|tsx|ts)$/i, '.js')); await ensureDir(dest); const originalRaw = await fs.readFile(file, 'utf8'); const inline = splitInlineServerFunctions(originalRaw, file, sourceDir, { auto: config.autoServerPlacement ?? true }); serverRefs.push(...inline.refs); serverPlacements.push(...inline.candidates.map(x => ({ ...x, file: rel }))); const split = splitServerImports(inline.code, file, sourceDir); serverRefs.push(...split.refs); const raw = removeUnusedServerReferences(split.code); const compiled = compileModule(raw, { runtimeImport: '@lithe/dom', typescript: ext === '.ts' || ext === '.tsx', filename: path.relative(root, file), generatedFile: path.relative(out, dest), sourceMap: sourceMaps, autoWorkers: config.autoWorkers ?? true, workerThreshold: config.workerThreshold }); if (compiled.diagnostics.some(d => d.severity === 'error')) throw new Error(`${rel}: ${compiled.diagnostics.map(d => d.message).join('; ')}`); graphs.push(compiled.graph); islands.push(...(compiled.islands || [])); workers.push(...(compiled.workers || []).map(x => ({ ...x, file: rel }))); for (const handler of compiled.eventHandlers || []) eventChunks.push({ ...handler, sourceFile: file, typescript: ext === '.ts' || ext === '.tsx' }); let code = compiled.code; const staticCSS = extractStaticCSS(code, rel); code = staticCSS.code; if (staticCSS.css) css.push(staticCSS.css); const themes = extractStaticThemes(code); code = themes.code; if (themes.css) css.push(themes.css); code = await replaceCSSImports(code, file, root, css); code = removeUnusedNamedImports(code); code = rewriteLocalJSX(rewriteBareImports(code, '/__lithe/')); const depCode = code; moduleGraph[`src/${rel.replace(/\.(?:jsx|tsx|ts)$/i, '.js')}`] = dependencySpecs(depCode); dataGraphs.push(dataGraphFor(depCode, rel)); if (dce) code = eliminateDeadBranches(code); if (minify) code = minifyJS(code); if (config.syntaxCheck !== false) { const syntax = validateJavaScript(code, { filename: rel, maxErrors: 4 }); if (!syntax.valid) throw new Error(`${rel}: ${syntax.diagnostics.map(d => `${d.line}:${d.column} ${d.message}`).join('; ')}`); } if (sourceMaps) { const mapFile = `${dest}.map`, map = tracedSourceMap(code, originalRaw, path.relative(root, file).replace(/\\/g, '/'), path.relative(out, dest).replace(/\\/g, '/')); await fs.writeFile(mapFile, JSON.stringify(map)); code = appendSourceMap(code, mapFile); } await fs.writeFile(dest, code); }
	// Emit independently loadable resumable event chunks. These chunks may import only safe module imports and receive component-local data exclusively through the serialized capture argument.
	for (const event of eventChunks) { const rel = `__lithe_events/${event.chunk}`, dest = path.join(out, rel); await ensureDir(dest); const compiled = compileModule(event.code, { runtimeImport: '@lithe/dom', typescript: event.typescript, filename: `${path.relative(root, event.sourceFile)}#${event.chunk}`, generatedFile: rel, sourceMap: false, captureEvents: false, lazyEvents: false, autoWorkers: false }); if (compiled.diagnostics.some(d => d.severity === 'error')) throw new Error(`${event.chunk}: ${compiled.diagnostics.map(d => d.message).join('; ')}`); let code = eventChunkImports(compiled.code, event.sourceFile, sourceDir); code = rewriteLocalJSX(rewriteBareImports(code, '/__lithe/')); const depCode = code; moduleGraph[rel] = dependencySpecs(depCode); if (dce) code = eliminateDeadBranches(code); if (minify) code = minifyJS(code); const syntax = validateJavaScript(code, { filename: event.chunk, maxErrors: 4 }); if (!syntax.valid) throw new Error(`${event.chunk}: ${syntax.diagnostics.map(d => d.message).join('; ')}`); if (sourceMaps) { const mapFile = `${dest}.map`, map = tracedSourceMap(code, event.code, path.relative(root, event.sourceFile).replace(/\\/g, '/'), rel); await fs.writeFile(mapFile, JSON.stringify(map)); code = appendSourceMap(code, mapFile); } await fs.writeFile(dest, code); }

	let serverOut = null, serverManifest = null;
	if (serverSourceFiles.length || serverRefs.length) {
		serverOut = path.join(root, '.lithe', 'server'); await fs.rm(serverOut, { recursive: true, force: true }); await fs.mkdir(path.join(serverOut, 'src'), { recursive: true }); await emitFrameworkTree(path.join(serverOut, '__lithe'));
		const serverCSS = [];
		for (const file of allSourceFiles) { const rel = path.relative(sourceDir, file), ext = path.extname(file), dest = path.join(serverOut, 'src', rel.replace(/\.(?:jsx|tsx|ts)$/i, '.js')); await ensureDir(dest); const raw = await fs.readFile(file, 'utf8'); const compiled = compileModule(raw, { runtimeImport: '@lithe/dom', typescript: ext === '.ts' || ext === '.tsx', filename: path.relative(root, file), generatedFile: path.relative(serverOut, dest), sourceMap: sourceMaps, captureEvents: !/\.server\.(?:js|jsx|ts|tsx)$/.test(file), autoWorkers: config.autoWorkers ?? true, workerThreshold: config.workerThreshold }); if (compiled.diagnostics.some(d => d.severity === 'error')) throw new Error(`server ${rel}: ${compiled.diagnostics.map(d => d.message).join('; ')}`); let code = compiled.code; code = (await replaceCSSImports(code, file, root, serverCSS)); const prefix = path.relative(path.dirname(dest), path.join(serverOut, '__lithe')).replace(/\\/g, '/') + '/'; code = rewriteLocalJSX(rewriteBareImports(code, prefix)); if (dce) code = eliminateDeadBranches(code); if (minify) code = minifyJS(code); if (sourceMaps) { const mapFile = `${dest}.map`, map = tracedSourceMap(code, raw, path.relative(root, file).replace(/\\/g, '/'), path.relative(serverOut, dest).replace(/\\/g, '/')); await fs.writeFile(mapFile, JSON.stringify(map)); code = appendSourceMap(code, mapFile); } await fs.writeFile(dest, code); }
		const modules = {}; for (const file of serverSourceFiles) { const rel = path.relative(sourceDir, file).replace(/\\/g, '/').replace(/\.(?:jsx|tsx|ts)$/i, '.js'); modules[serverModuleId(rel)] = { file: `src/${rel}`, source: rel }; } for (const ref of serverRefs) if (!modules[ref.id]) modules[ref.id] = { file: `src/${ref.module}`, source: ref.module, inline: Boolean(ref.inline) };
		for (const ref of serverRefs) if (!modules[ref.id]) throw new Error(`Server import target was not emitted: ${ref.module}`);
		serverManifest = { version: 1, builtAt: new Date().toISOString(), modules, refs: serverRefs }; await fs.writeFile(path.join(serverOut, 'manifest.json'), JSON.stringify(serverManifest, null, 2));
	}

	if (css.length) { await fs.writeFile(path.join(out, 'lithe.css'), css.join('\n')); for (const htmlFile of (await walk(out)).filter(f => f.endsWith('.html'))) { let html = await fs.readFile(htmlFile, 'utf8'); if (!html.includes('/lithe.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/lithe.css"></head>'); await fs.writeFile(htmlFile, html); } }

	const copied = new Set();
	async function copyFramework(rel) {
		rel = rel.replace(/^\/+/, '').replace(/\.(?:ts|tsx)$/i, '.js'); if (copied.has(rel)) return; copied.add(rel);
		const src = await frameworkSourceFor(rel); if (!src) throw new Error(`Framework module not found: ${rel}`);
		const dest = path.join(out, '__lithe', rel); await ensureDir(dest); const built = await compileFrameworkSource(src, `__lithe/${rel}`); let code = built.code;
		const deps = dependencySpecs(code); moduleGraph[`__lithe/${rel}`] = deps;
		for (const { spec } of deps) { if (!spec.startsWith('.')) continue; let target = path.normalize(path.join(path.dirname(rel), spec)).replace(/\.(?:ts|tsx)$/i, '.js'); if (!path.extname(target)) target += '.js'; await copyFramework(target); }
		if (dce) code = eliminateDeadBranches(code); if (minify) code = minifyJS(code);
		if (sourceMaps) { const map = tracedSourceMap(code, built.raw, path.relative(FRAMEWORK_ROOT, src).replace(/\\/g, '/'), `__lithe/${rel}`), mapFile = `${dest}.map`; await fs.writeFile(mapFile, JSON.stringify(map)); code = appendSourceMap(code, mapFile); } await fs.writeFile(dest, code);
	}
	for (const file of (await walk(path.join(out, 'src'))).filter(f => f.endsWith('.js'))) { const code = await fs.readFile(file, 'utf8'); for (const m of code.matchAll(/['"]\/__lithe\/([^'"]+\.js)['"]/g)) await copyFramework(m[1]); }

	// Native-ESM chunk reachability: module scripts are roots; static, dynamic and event-symbol edges keep chunks alive.
	const htmlFiles = (await walk(out)).filter(f => f.endsWith('.html')), entryModules = new Set(); for (const htmlFile of htmlFiles) { const html = await fs.readFile(htmlFile, 'utf8'); for (const m of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/gi)) { let spec = m[1].split(/[?#]/)[0]; if (spec.startsWith('/')) spec = spec.slice(1); if (spec.startsWith('src/')) entryModules.add(spec); } }
	if (!entryModules.size && moduleGraph['src/main.js']) entryModules.add('src/main.js');
	const normalizeDep = (from, spec) => { if (spec.startsWith('/')) return spec.slice(1); if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)); return spec; }; const reachable = new Set(entryModules), queue = [...entryModules]; while (queue.length) { const mod = queue.shift(); for (const dep of moduleGraph[mod] || []) { const target = normalizeDep(mod, dep.spec); if (!(target.startsWith('src/') || target.startsWith('__lithe_events/')) || reachable.has(target)) continue; reachable.add(target); queue.push(target); } }
	if (entryModules.size) { for (const file of (await walk(path.join(out, 'src'))).filter(f => /\.js(?:\.map)?$/.test(f))) { const rel = 'src/' + path.relative(path.join(out, 'src'), file).replace(/\\/g, '/').replace(/\.map$/, ''); if (!reachable.has(rel)) await fs.rm(file, { force: true }); } for (const key of Object.keys(moduleGraph)) if (key.startsWith('src/') && !reachable.has(key)) delete moduleGraph[key]; const eventDir = path.join(out, '__lithe_events'); if (await exists(eventDir)) for (const file of (await walk(eventDir)).filter(f => /\.js(?:\.map)?$/.test(f))) { const rel = '__lithe_events/' + path.relative(eventDir, file).replace(/\\/g, '/').replace(/\.map$/, ''); if (!reachable.has(rel)) await fs.rm(file, { force: true }); } for (const key of Object.keys(moduleGraph)) if ((key.startsWith('src/') || key.startsWith('__lithe_events/')) && !reachable.has(key)) delete moduleGraph[key]; }
	const treeShaken = { removed: [], modules: 0 }; if (config.symbolTreeShaking !== false) { const jsFiles = (await walk(out)).filter(f => f.endsWith('.js')), moduleCode = new Map(); for (const f of jsFiles) moduleCode.set(path.relative(out, f).replace(/\\/g, '/'), await fs.readFile(f, 'utf8')); const used = collectUsedExports(moduleCode, [...entryModules]); for (const [rel, originalCode] of moduleCode) { const clean = originalCode.replace(/\n?\/\/# sourceMappingURL=.*?\n?$/, '\n'), shaken = treeShakeModule(clean, used.get(rel) || new Set()); if (shaken.code === clean) continue; const syntax = validateJavaScript(shaken.code, { filename: rel, maxErrors: 2 }); if (!syntax.valid) continue; const file = path.join(out, rel); let final = shaken.code; treeShaken.modules++; treeShaken.removed.push(...shaken.removed.map(name => `${rel}:${name}`)); if (sourceMaps) { let original = ''; if (rel.startsWith('__lithe/')) { const sourceFile = await frameworkSourceFor(rel.slice('__lithe/'.length)); if (sourceFile) original = await fs.readFile(sourceFile, 'utf8'); } else if (rel.startsWith('src/')) { const base = path.join(sourceDir, rel.slice(4).replace(/\.js$/, '')); for (const ext of ['.js', '.jsx', '.ts', '.tsx']) if (await exists(base + ext)) { original = await fs.readFile(base + ext, 'utf8'); break; } } if (original) { const mapFile = `${file}.map`; await fs.writeFile(mapFile, JSON.stringify(tracedSourceMap(final, original, rel, rel))); final = appendSourceMap(final, mapFile); } } await fs.writeFile(file, final); } }
	let outputEntryModules = [...entryModules]; if (bundle === 'single' && entryModules.size) { const bundleKeys = (await walk(out)).filter(file => file.endsWith('.js') && !file.includes(`${path.sep}__lithe_events${path.sep}`)).map(file => path.relative(out, file).replace(/\\/g, '/')); const entry = [...entryModules][0]; await emitSingleBundle(out, entry, bundleKeys, minify); for (const file of (await walk(out)).filter(file => (file.includes(`${path.sep}src${path.sep}`) || file.includes(`${path.sep}__lithe${path.sep}`)) && file.endsWith('.js'))) await fs.rm(file, { force: true }); for (const htmlFile of (await walk(out)).filter(file => file.endsWith('.html'))) { let html = await fs.readFile(htmlFile, 'utf8'); html = html.replace(/(<script\b[^>]*type=["']module["'][^>]*src=["'])[^"']+(["'])/gi, '$1/app.js$2'); await fs.writeFile(htmlFile, html); } await fs.rm(path.join(out, 'src'), { recursive: true, force: true }); await fs.rm(path.join(out, '__lithe'), { recursive: true, force: true }); await fs.rm(path.join(out, '__lithe_events'), { recursive: true, force: true }); outputEntryModules = ['app.js']; }
	const graph = mergeReactiveGraphs(graphs), cycles = findReactiveCycles(graph), reactiveOptimizations = optimizeReactiveGraph(graph); if (cycles.length) throw new Error(`Reactive graph cycle(s): ${cycles.map(c => c.join(' -> ')).join('; ')}`);
	const files = await walk(out); let bytes = 0, debugBytes = 0, jsBytes = 0, jsGzip = 0; for (const f of files) { const data = await fs.readFile(f); if (f.endsWith('.map')) { debugBytes += data.length; continue; } bytes += data.length; if (f.endsWith('.js')) { jsBytes += data.length; jsGzip += zlib.gzipSync(data).length; } }
	const budget = config.performance || {}, violations = []; if (budget.jsGzip && jsGzip > budget.jsGzip) violations.push(`JavaScript gzip ${jsGzip} exceeds budget ${budget.jsGzip}`); if (budget.totalBytes && bytes > budget.totalBytes) violations.push(`Production bytes ${bytes} exceeds budget ${budget.totalBytes}`); if (budget.debugBytes && debugBytes > budget.debugBytes) violations.push(`Debug bytes ${debugBytes} exceeds budget ${budget.debugBytes}`);
	const dataGraph = { queries: dataGraphs.flatMap(x => x.queries), mutations: dataGraphs.flatMap(x => x.mutations) }; dataGraph.edges = []; for (const m of dataGraph.mutations) for (const q of dataGraph.queries) if (m.writes.some(t => q.tags.includes(t))) dataGraph.edges.push({ from: m.file, to: q.file, tags: m.writes.filter(t => q.tags.includes(t)) });
	const manifest = { version: 2, builtAt: new Date().toISOString(), files: files.map(f => path.relative(out, f)), bytes, debugBytes, jsBytes, jsGzip, frameworkModules: copied.size, minified: minify, sourceMaps, bundle, moduleGraph, chunks: { entries: outputEntryModules, reachable: bundle === 'single' ? ['app.js'] : [...reachable] }, reactiveGraph: graph, reactiveOptimizations, dataGraph, islands, workers, treeShaken, serverModules: serverManifest ? Object.keys(serverManifest.modules).length : 0, serverPlacements, eventChunks: eventChunks.map(({ chunk, captures, imports }) => ({ chunk, captures, imports })), budgetViolations: violations }; await fs.writeFile(path.join(out, 'lithe-manifest.json'), JSON.stringify(manifest, null, 2));
	if (violations.length && options.enforceBudgets !== false) throw new Error(`Performance budget failed:\n- ${violations.join('\n- ')}`); return { out, manifest, serverOut };
}
