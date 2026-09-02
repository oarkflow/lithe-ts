import path from 'node:path';
import { serverModuleId } from './server-split.ts';

function matchBrace(code, start) {
	let depth = 0, quote = null;
	for (let i = start; i < code.length; i++) {
		const c = code[i];
		if (quote) {
			if (c === '\\') i++;
			else if (c === quote) quote = null;
			continue;
		}
		if (c === '"' || c === "'" || c === '`') {
			quote = c;
			continue;
		}
		if (c === '/' && code[i + 1] === '/') {
			i += 2;
			while (i < code.length && code[i] !== '\n') i++;
			continue;
		}
		if (c === '/' && code[i + 1] === '*') {
			i += 2;
			while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
			i++;
			continue;
		}
		if (c === '{') depth++;
		else if (c === '}' && --depth === 0) return i;
	}
	return -1;
}

function serverOnly(body) {
	return /\b(?:process\.env|Deno\.env|Bun\.env|globalThis\.__LITHE_SERVER__|db\.|database\.|sql\.|fs\.|node:)/.test(body) &&
		!/\b(?:document|window|navigator|HTMLElement|localStorage|sessionStorage)\b/.test(body);
}

function awaitedCalls(code, name, start, end) {
	const rest = code.slice(0, start) + code.slice(end);
	const refs = [...rest.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))];
	return refs.length > 0 && refs.every(m => /await\s*$/.test(rest.slice(Math.max(0, m.index - 12), m.index)));
}

function relativeModule(file, sourceRoot) {
	return path.relative(sourceRoot, file).replace(/\\/g, '/').replace(/\.(?:jsx|tsx|ts)$/i, '.js');
}

export function splitInlineServerFunctions(code, file, sourceRoot, options = {}) {
	const refs = [];
	const candidates = [];
	const re = /\bexport\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
	let m;

	while ((m = re.exec(code))) {
		const open = code.indexOf('{', m.index);
		const close = matchBrace(code, open);
		if (close < 0) break;
		const body = code.slice(open + 1, close);
		const explicit = /^\s*['"]use server['"]\s*;/.test(body);
		const auto = options.auto !== false && serverOnly(body) && awaitedCalls(code, m[2], m.index, close + 1);
		if (explicit || auto) {
			candidates.push({ start: m.index, end: close + 1, name: m[2], mode: explicit ? 'directive' : 'auto' });
		}
		re.lastIndex = close + 1;
	}

	if (!candidates.length) return { code, refs, candidates: [] };

	const module = relativeModule(file, sourceRoot);
	const id = serverModuleId(module);
	let out = code;

	for (const c of candidates.reverse()) {
		out = out.slice(0, c.start) +
			`export const ${c.name} = __litheServerReference(${JSON.stringify(id)}, ${JSON.stringify(c.name)});` +
			out.slice(c.end);
		refs.push({ id, module, exportName: c.name, local: c.name, inline: true, mode: c.mode });
	}

	out = `import { serverReference as __litheServerReference } from '@oarkflow/lithe/rpc';\n${out}`;
	return { code: out, refs: refs.reverse(), candidates: candidates.map(({ start, end, ...x }) => x) };
}

export function removeUnusedServerReferences(code) {
	return code.replace(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*__litheServerReference\([^;]+\);\s*$/gm, (full, name, offset, src) => {
		const rest = src.slice(0, offset) + src.slice(offset + full.length);
		return new RegExp(`\\b${name}\\b`).test(rest) ? full : '';
	});
}
