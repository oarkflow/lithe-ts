import { stripTypeScript } from './typescript.ts';
import { identitySourceMap } from './sourcemap.ts';
import { reactiveGraphIR, findReactiveCycles, reactiveDiagnostics } from './ir.ts';
import { detectIslands } from './islands.ts';
import { transformWorkerPlacement } from './workers.ts';
import { analyzeAccessibility } from './a11y.ts';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function isIdentStart(ch) { return /[A-Za-z_$]/.test(ch); } function isIdentPart(ch) { return /[\w$.:-]/.test(ch); }
function skipString(source, i) { const quote = source[i++]; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === quote) return i + 1; i++; } return i; }
function skipTemplate(source, i) { i++; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === '`') return i + 1; if (source[i] === '$' && source[i + 1] === '{') { const expr = readBalanced(source, i + 1, '{', '}'); i = expr.end; continue; } i++; } return i; }
function skipRegex(source, i) { i++; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === '[') { while (i < source.length && source[i] !== ']') { if (source[i] === '\\') i += 2; else i++; } } if (source[i] === '/') { i++; while (i < source.length && /[a-z]/i.test(source[i])) i++; return i; } i++; } return i; }
function readBalanced(source, start, open, close) {
	let depth = 0, i = start;
	for (; i < source.length; i++) {
		const ch = source[i];
		if (ch === '"' || ch === "'") { i = skipString(source, i) - 1; continue; }
		if (ch === '`') { i = skipTemplate(source, i) - 1; continue; }
		if (ch === '/' && source[i + 1] === '/') { i += 2; while (i < source.length && source[i] !== '\n') i++; continue; }
		if (ch === '/' && source[i + 1] === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++; i++; continue; }
		if (ch === '/' && (i === 0 || /[=(,:[!&|?+\-*~^;{]/.test(source.slice(0, i).trim().slice(-1)))) { i = skipRegex(source, i) - 1; continue; }
		if (ch === open) depth++;
		else if (ch === close) { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
	}
	throw new SyntaxError(`Unclosed ${open} expression`);
}
function parseName(source, state) { const start = state.i; while (state.i < source.length && isIdentPart(source[state.i])) state.i++; return source.slice(start, state.i); } function skipSpace(source, state) { while (/\s/.test(source[state.i])) state.i++; }
function isNativeName(name) { return /^[a-z][\w:-]*$/.test(name); }
function emitTag(name) { if (name === '') return 'Fragment'; if (isNativeName(name)) return JSON.stringify(name); return name; }
function isFunctionExpression(expression) { return /^(?:async\s+)?(?:function\b|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/.test(expression.trim()); }
function normalizeStaticHTML(raw) { let html = raw.replace(/\bclassName=/g, 'class=').replace(/\bhtmlFor=/g, 'for='); html = html.replace(/<([a-z][\w:-]*)([^>]*)\/>/g, (m, tag, attrs) => VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}></${tag}>`); return html.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim(); }
function isStaticNative(raw, name, fragment) { if (fragment || !name || !isNativeName(name)) return false; if (raw.includes('{') || /<\/?[A-Z]/.test(raw) || /\bon[A-Z][\w]*\s*=|\bref\s*=|\bbind:/.test(raw)) return false; return true; }

function directNativeTemplate(raw, name) {
	if (!name || !isNativeName(name) || /\bon[A-Z][\w]*\s*=|\bref\s*=|\bbind:|\{\.\.\./.test(raw)) return null;
	let quote = null, openEnd = -1; for (let i = 1; i < raw.length; i++) { const c = raw[i]; if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; } if (c === '"' || c === "'") { quote = c; continue; } if (c === '>') { openEnd = i; break; } }
	if (openEnd < 0 || raw.slice(0, openEnd + 1).includes('{')) return null; const closeStart = raw.lastIndexOf(`</${name}`); if (closeStart < openEnd || raw.slice(openEnd + 1, closeStart).includes('<')) return null; const body = raw.slice(openEnd + 1, closeStart); if (!body.includes('{')) return null;
	let html = normalizeStaticHTML(raw.slice(0, openEnd + 1)), bindings = [], out = '', i = 0, textStart = 0;
	while (i < body.length) { if (body[i] === '{') { out += body.slice(textStart, i).replace(/\s+/g, ' '); let expr; try { expr = readBalanced(body, i, '{', '}'); } catch { return null; } const content = expr.content.trim(); if (content && !content.startsWith('/*')) { const id = bindings.length, transformed = transformJSX(content); bindings.push(isFunctionExpression(content) ? `(${transformed})` : `()=>(${transformed})`); out += `<!--l:${id}-->`; } i = expr.end; textStart = i; continue; } i++; }
	out += body.slice(textStart).replace(/\s+/g, ' '); html += out + `</${name}>`; return bindings.length ? `compiledTemplate(${JSON.stringify(html)},[${bindings.join(',')}])` : null;
}
function parseElement(source, start) {
	const state = { i: start }; if (source[state.i] !== '<') throw new SyntaxError('Expected <'); state.i++; let fragment = false, name = ''; if (source[state.i] === '>') { fragment = true; state.i++; } else name = parseName(source, state); if (!fragment && !name) throw new SyntaxError('Expected JSX tag name');
	const props = []; let selfClosing = false;
	if (!fragment) { while (state.i < source.length) { skipSpace(source, state); if (source.startsWith('/>', state.i)) { selfClosing = true; state.i += 2; break; } if (source[state.i] === '>') { state.i++; break; } if (source.startsWith('{...', state.i)) { const expr = readBalanced(source, state.i, '{', '}'); props.push(`...(${expr.content.slice(3).trim()})`); state.i = expr.end; continue; } const key = parseName(source, state); if (!key) throw new SyntaxError(`Invalid JSX attribute near offset ${state.i}`); skipSpace(source, state); if (source[state.i] !== '=') { props.push(`${JSON.stringify(key)}: true`); continue; } state.i++; skipSpace(source, state); const ch = source[state.i]; if (ch === '"' || ch === "'") { const end = skipString(source, state.i); props.push(`${JSON.stringify(key)}: ${source.slice(state.i, end)}`); state.i = end; } else if (ch === '{') { const expr = readBalanced(source, state.i, '{', '}'); props.push(`${JSON.stringify(key)}: (${transformJSX(expr.content)})`); state.i = expr.end; } else throw new SyntaxError(`JSX attribute ${key} must use a string or expression.`); } }
	const children = [];
	if (!selfClosing) { let textStart = state.i; const flushText = end => { let raw = source.slice(textStart, end).replace(/\s+/g, ' '); if (raw.trim()) children.push(JSON.stringify(raw)); }; while (state.i < source.length) { if (fragment && source.startsWith('</>', state.i)) { flushText(state.i); state.i += 3; break; } if (!fragment && source.startsWith(`</${name}`, state.i)) { flushText(state.i); state.i += 2 + name.length; skipSpace(source, state); if (source[state.i] !== '>') throw new SyntaxError(`Invalid closing tag for ${name}`); state.i++; break; } if (source[state.i] === '<' && (source[state.i + 1] === '>' || isIdentStart(source[state.i + 1]))) { flushText(state.i); const nested = parseElement(source, state.i); children.push(nested.code); state.i = nested.end; textStart = state.i; continue; } if (source[state.i] === '{') { flushText(state.i); const expr = readBalanced(source, state.i, '{', '}'); const body = expr.content.trim(); if (body && !body.startsWith('/*')) children.push(`(${transformJSX(body)})`); state.i = expr.end; textStart = state.i; continue; } state.i++; } }
	const raw = source.slice(start, state.i); const direct = !fragment ? directNativeTemplate(raw, name) : null; if (direct) return { code: direct, end: state.i, direct: true }; if (isStaticNative(raw, name, fragment)) return { code: `staticTemplate(${JSON.stringify(normalizeStaticHTML(raw))})`, end: state.i, static: true };
	const propCode = props.length ? `{${props.join(',')}}` : 'null'; if (!fragment && isNativeName(name)) return { code: `compiledElement(${JSON.stringify(name)}, ${propCode}, [${children.join(', ')}])`, end: state.i, direct: true, static: false }; return { code: `h(${emitTag(name)}, ${propCode}${children.length ? `, ${children.join(', ')}` : ''})`, end: state.i, static: false };
}

function canStartJSX(source, i) { let j = i - 1; while (j >= 0 && /\s/.test(source[j])) j--; if (j < 0) return true; const prev = source[j]; if (/[A-Za-z0-9_$\]\)]/.test(prev)) { const before = source.slice(0, i).match(/(?:^|[^A-Za-z0-9_$])(return|yield)\s*$/); return Boolean(before); } return true; }

export function transformJSX(source) { let out = '', i = 0; while (i < source.length) { const ch = source[i]; if (ch === '"' || ch === "'") { const end = skipString(source, i); out += source.slice(i, end); i = end; continue; } if (ch === '`') { const end = skipTemplate(source, i); out += source.slice(i, end); i = end; continue; } if (ch === '/' && source[i + 1] === '/') { let end = i + 2; while (end < source.length && source[end] !== '\n') end++; out += source.slice(i, end); i = end; continue; } if (ch === '/' && source[i + 1] === '*') { let end = i + 2; while (end < source.length && !(source[end] === '*' && source[end + 1] === '/')) end++; end += 2; out += source.slice(i, end); i = end; continue; } if (ch === '<' && canStartJSX(source, i) && (source[i + 1] === '>' || isIdentStart(source[i + 1]))) { try { const parsed = parseElement(source, i); out += parsed.code; i = parsed.end; continue; } catch { } } out += ch; i++; } return out; }


const EVENT_GLOBALS = new Set('console Math JSON Date Array Object Number String Boolean BigInt Promise Map Set WeakMap WeakSet URL URLSearchParams Intl fetch crypto structuredClone document window navigator location history'.split(' '));
const EVENT_KEYWORDS = new Set('const let var if else return throw new typeof instanceof in of await async true false null undefined this function'.split(' '));
function eraseTypeScriptAssertions(text) { return text.replace(/\s+as\s+[A-Za-z_$][\w$]*(?:\s*<[^>]+>)?/g, ''); }
function moduleImportBindings(source) {
	const out = new Map();
	for (const m of source.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s*(['"])([^'"]+)\2/g)) out.set(m[1], { spec: m[3], exported: 'default', kind: 'default' });
	for (const m of source.matchAll(/\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*(['"])([^'"]+)\2/g)) out.set(m[1], { spec: m[3], exported: '*', kind: 'namespace' });
	for (const m of source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*(['"])([^'"]+)\2/g)) for (const part of m[1].split(',')) { const x = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?/); if (x) out.set(x[2] || x[1], { spec: m[3], exported: x[1], kind: 'named' }); }
	return out;
}
function moduleLocalDeclarations(source) { const out = new Set(); for (const m of source.matchAll(/^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]); return out; }
function arrowInfo(expr) { expr = expr.trim(); let m = expr.match(/^(?:async\s+)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>\s*([\s\S]+)$/); if (!m) return null; const params = (m[1] != null ? m[1] : m[2] || '').split(',').map(x => x.trim().replace(/\s*:\s*[\s\S]+$/, '').replace(/^\.\.\./, '')).filter(x => /^[A-Za-z_$][\w$]*$/.test(x)); return { params, body: m[3].trim(), async: /^async\b/.test(expr) }; }
function identifierRefs(text) { const out = []; for (const m of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) { const name = m[0], prev = text[m.index - 1], next = text[m.index + name.length]; if (prev === '.' || prev === '#' || EVENT_KEYWORDS.has(name)) continue; if (next === ':' && /^[,{]\s*$/.test(text.slice(Math.max(0, m.index - 8), m.index))) continue; out.push(name); } return [...new Set(out)]; }
function captureIsReadOnly(body, name) { const q = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (new RegExp(`\\b${q}\\b\\s*(?:\\+\\+|--|[+\\-*/%&|^]?=|\\?\\?=|&&=|\\|\\|=)`).test(body)) return false; if (new RegExp(`\\b${q}\\s*(?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]]+\\])\\s*(?:\\+\\+|--|[+\\-*/%&|^]?=|\\?\\?=|&&=|\\|\\|=)`).test(body)) return false; if (new RegExp(`\\b${q}\\s*\\.(?:push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill|set|add|delete|clear)\\s*\\(`).test(body)) return false; return true; }
function eventChunkName(filename, seq) { const raw = String(filename || 'module').replace(/\\/g, '/'), clean = raw.replace(/^\/+/, '').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/\.(?:jsx|tsx|ts|js)$/i, ''); let hash = 2166136261; for (let i = 0; i < raw.length; i++) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `${clean.replace(/\//g, '_')}.${(hash >>> 0).toString(36)}.${seq}.event.js`; }
function chunkImportLines(bindings) { const groups = new Map(); for (const [local, meta] of bindings) { const key = meta.spec; if (!groups.has(key)) groups.set(key, []); groups.get(key).push([local, meta]); } const lines = []; for (const [spec, items] of groups) { for (const [local, meta] of items.filter(x => x[1].kind === 'default')) lines.push(`import ${local} from ${JSON.stringify(spec)};`); for (const [local, meta] of items.filter(x => x[1].kind === 'namespace')) lines.push(`import * as ${local} from ${JSON.stringify(spec)};`); const named = items.filter(x => x[1].kind === 'named'); if (named.length) lines.push(`import { ${named.map(([local, meta]) => meta.exported === local ? local : `${meta.exported} as ${local}`).join(', ')} } from ${JSON.stringify(spec)};`); } return lines; }
function rewriteCapturedEvents(source, options = {}) {
	if (options.captureEvents === false || globalThis.__LITHE_SINGLE_BUNDLE__) return { code: source, changed: false, handlers: [] };
	const imports = moduleImportBindings(source), locals = moduleLocalDeclarations(source), re = /\bon[A-Z][\w]*\s*=\s*\{/g, replacements = [], handlers = []; let m, seq = 0;
	while ((m = re.exec(source))) {
		const open = source.indexOf('{', m.index); let expr; try { expr = readBalanced(source, open, '{', '}'); } catch { continue; } const info = arrowInfo(expr.content); if (!info) { re.lastIndex = expr.end; continue; }
		const refBody = eraseTypeScriptAssertions(info.body);
		const refs = identifierRefs(refBody), params = new Set(info.params); for (const d of refBody.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) params.add(d[1]); for (const a of refBody.matchAll(/(?:\(([^)]*)\)|\b([A-Za-z_$][\w$]*))\s*=>/g)) for (const p of (a[1] || a[2] || '').split(',').map(x => x.trim()).filter(Boolean)) if (/^[A-Za-z_$][\w$]*$/.test(p)) params.add(p);
		const topRefs = refs.filter(x => !params.has(x) && !EVENT_GLOBALS.has(x) && (imports.has(x) || locals.has(x))); if (topRefs.some(x => locals.has(x) && !imports.has(x))) { re.lastIndex = expr.end; continue; }
		const captures = refs.filter(x => !params.has(x) && !EVENT_GLOBALS.has(x) && !imports.has(x) && !locals.has(x)); if (captures.some(x => !captureIsReadOnly(info.body, x))) { re.lastIndex = expr.end; continue; }
		const usedImports = new Map(topRefs.filter(x => imports.has(x)).map(x => [x, imports.get(x)])); const name = `handler`; const captureInit = captures.length ? `const {${captures.join(',')}}=__captures||{};` : ''; const paramInit = info.params.length ? info.params.map((p, i) => `const ${p}=${i === 0 ? 'event' : 'undefined'};`).join('') : ''; let body = info.body; if (body.startsWith('{') && body.endsWith('}')) body = body.slice(1, -1); else body = `return (${body});`;
		const chunk = eventChunkName(options.filename, ++seq); let handlerCode = `${chunkImportLines(usedImports).join('\n')}\nexport ${info.async ? 'async ' : ''}function ${name}(event,__captures={}){${captureInit}${paramInit}${body}}\n`; if (options.typescript) handlerCode = stripTypeScript(handlerCode, { filename: chunk }); handlers.push({ chunk, name, code: handlerCode, captures, imports: [...usedImports.values()].map(x => x.spec) }); const publicPath = `/__lithe_events/${chunk}`; const replacement = `capturedEventSymbol(${JSON.stringify(publicPath)},${JSON.stringify(name)},${captures.length ? `{${captures.join(',')}}` : 'null'})`; replacements.push({ start: open + 1, end: expr.end - 1, replacement }); re.lastIndex = expr.end;
	}
	let code = source; for (const r of replacements.reverse()) code = code.slice(0, r.start) + r.replacement + code.slice(r.end); return { code, changed: handlers.length > 0, handlers };
}

function eventModulePath(spec, filename = '') { if (!spec.startsWith('.')) return spec; const parts = String(filename || '').replace(/\\/g, '/').split('/'); parts.pop(); for (const part of spec.split('/')) { if (!part || part === '.') continue; if (part === '..') parts.pop(); else parts.push(part); } let out = '/' + parts.join('/'); out = out.replace(/\.(?:jsx|tsx|ts)$/i, '.js'); return out; }
function rewriteLazyEvents(source, options = {}) {
	const imports = []; for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*(['"])(\.[^'"]+)\2\s*;?/g)) imports.push({ full: m[0], body: m[1], spec: m[3], index: m.index }); let code = source, changed = false;
	for (const imp of imports.reverse()) {
		const parts = imp.body.split(',').map(x => x.trim()).filter(Boolean), keep = []; let localSource = code.slice(0, imp.index) + code.slice(imp.index + imp.full.length);
		for (const part of parts) { const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/); if (!mm) { keep.push(part); continue; } const exported = mm[1], local = mm[2] || mm[1]; const words = [...localSource.matchAll(new RegExp(`\\b${local}\\b`, 'g'))]; const events = [...localSource.matchAll(new RegExp(`on[A-Z][\\w]*\\s*=\\s*\\{\\s*${local}\\s*\\}`, 'g'))]; if (events.length && words.length === events.length) { localSource = localSource.replace(new RegExp(`(on[A-Z][\\w]*\\s*=\\s*\\{)\\s*${local}\\s*(\\})`, 'g'), `$1eventSymbol(${JSON.stringify(eventModulePath(imp.spec, options.filename))}, ${JSON.stringify(exported)})$2`); changed = true; } else keep.push(part); }
		const replacement = keep.length ? `import { ${keep.join(', ')} } from ${JSON.stringify(imp.spec)};` : ''; code = localSource.slice(0, imp.index) + replacement + localSource.slice(imp.index); // source after import removal, insert retained import
	}
	return { code, changed };
}

export function compileModule(source, options = {}) {
	const original = source; let input = source; const lazy = options.lazyEvents === false ? { code: input, changed: false } : rewriteLazyEvents(input, options); input = lazy.code; const captured = rewriteCapturedEvents(input, options); input = captured.code; let code = transformJSX(input); const jsxChanged = code !== input; if (options.typescript) code = stripTypeScript(code, { filename: options.filename }); const placed = transformWorkerPlacement(code, { autoWorkers: options.autoWorkers, threshold: options.workerThreshold }); code = placed.code; const changed = code !== original;
	if ((jsxChanged || lazy.changed || captured.changed || placed.changed) && options.injectRuntime !== false) {
		const runtime = options.runtimeImport || '/@lithe/dom'; const imports = [];
		if (jsxChanged && !/\bimport\s*\{[^}]*\bh\b[^}]*\bFragment\b/.test(code)) imports.push(`import { h, Fragment } from ${JSON.stringify(runtime)};`);
		if (/\bcompiledTemplate\(/.test(code) && !/\bimport\s*\{[^}]*\bcompiledTemplate\b/.test(code)) imports.push(`import { compiledTemplate } from ${JSON.stringify(runtime)};`);
		if (/\bcompiledElement\(/.test(code) && !/\bimport\s*\{[^}]*\bcompiledElement\b/.test(code)) imports.push(`import { compiledElement } from ${JSON.stringify(runtime)};`);
		if (/\bstaticTemplate\(/.test(code) && !/\bimport\s*\{[^}]*\bstaticTemplate\b/.test(code)) imports.push(`import { staticTemplate } from ${JSON.stringify(runtime)};`);
		if (/\blazyEvent\(/.test(code) && !/\bimport\s*\{[^}]*\blazyEvent\b/.test(code)) imports.push(`import { lazyEvent } from ${JSON.stringify(runtime)};`);
		if (/\beventSymbol\(/.test(code) && !/\bimport\s*\{[^}]*\beventSymbol\b/.test(code)) imports.push(`import { eventSymbol } from ${JSON.stringify(runtime)};`);
		if (/\bcapturedEventSymbol\(/.test(code) && !/\bimport\s*\{[^}]*\bcapturedEventSymbol\b/.test(code)) imports.push(`import { capturedEventSymbol } from ${JSON.stringify(runtime)};`);
		if (/\b__litheWorker\(/.test(code) && !/\bimport\s*\{[^}]*\bworker\s+as\s+__litheWorker\b/.test(code)) imports.push(`import { worker as __litheWorker } from "@lithe/worker";`);
		if (imports.length) code = `${imports.join('\n')}\n${code}`;
	}
	const graph = reactiveGraphIR(code, options.filename || '<module>'), cycles = findReactiveCycles(graph); const diagnostics = [...cycles.map(c => { const n = graph.nodes.find(x => x.id === c[0]); return { severity: 'error', code: 'REACTIVE_CYCLE', message: `Reactive cycle: ${c.join(' -> ')}`, line: n?.line, column: n?.column }; }), ...reactiveDiagnostics(code, options.filename || '<module>'), ...analyzeAccessibility(original, options.filename || '<module>')];
	const map = options.sourceMap === false ? null : identitySourceMap(code, original, options.filename || 'source.jsx', options.generatedFile || 'output.js');
	return { code, changed, map, graph, diagnostics, islands: detectIslands(code, options.filename || '<module>'), workers: placed.candidates, eventHandlers: captured.handlers };
}
