import path from 'node:path';
import { tokenizeJavaScript } from '../src/compiler/parser.ts';

function matchBrace(code: string, start: number): number {
	let depth = 0, quote: string | null = null;
	for (let i = start; i < code.length; i++) {
		const c = code[i];
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
		if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
		if (c === '/' && code[i + 1] === '/') { i += 2; while (i < code.length && code[i] !== '\n') i++; continue; }
		if (c === '/' && code[i + 1] === '*') { i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++; i++; continue; }
		if (c === '{') depth++; else if (c === '}' && --depth === 0) return i;
	}
	return -1;
}

function findParamEnd(code: string, start: number): number {
	let depth = 0, quote: string | null = null;
	for (let i = start; i < code.length; i++) {
		const c = code[i];
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
		if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
		if (c === '/' && code[i + 1] === '/') { i += 2; while (i < code.length && code[i] !== '\n') i++; continue; }
		if (c === '/' && code[i + 1] === '*') { i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++; i++; continue; }
		if (c === '(') depth++; else if (c === ')' && --depth === 0) return i;
	}
	return -1;
}

function statementEnd(code: string, start: number): number {
	let round = 0, square = 0, curly = 0, quote: string | null = null;
	for (let i = start; i < code.length; i++) {
		const c = code[i];
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
		if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
		if (c === '(') round++; else if (c === ')') round--;
		else if (c === '[') square++; else if (c === ']') square--;
		else if (c === '{') curly++; else if (c === '}') curly--;
		else if (c === ';' && !round && !square && !curly) return i + 1;
	}
	return code.length;
}

function refs(code: string, name: string, start: number, end: number): number {
	const rest = code.slice(0, start) + '\n' + code.slice(end);
	if (!new RegExp(`\\b${name}\\b`).test(rest)) return 0;
	try {
		const tokens = tokenizeJavaScript(rest);
		let count = 0;
		for (const t of tokens) {
			if ((t.type === 'identifier' || t.type === 'ident') && t.value === name) count++;
		}
		return count;
	} catch {
		return [...rest.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length;
	}
}

function pureInitializer(expr: string): boolean {
	expr = expr.trim();
	return /^(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(expr) ||
		/^(?:null|undefined|true|false|-?\d+(?:\.\d+)?n?|['"`][\s\S]*['"`]|\[[\s\S]*\]|\{[\s\S]*\})$/.test(expr) &&
		!/\b(?:new|await|yield|throw|delete|import)\b|\w\s*\(/.test(expr);
}

function applyNonOverlappingEdits(code: string, rawEdits: Array<{ start: number; end: number; text: string }>): string {
	const sorted = rawEdits.sort((a, b) => a.start - b.start || b.end - a.end);
	const filtered: Array<{ start: number; end: number; text: string }> = [];
	let lastEnd = 0;
	for (const e of sorted) {
		if (e.start >= lastEnd) {
			filtered.push(e);
			lastEnd = e.end;
		}
	}
	for (const e of filtered.sort((a, b) => b.start - a.start)) {
		code = code.slice(0, e.start) + e.text + code.slice(e.end);
	}
	return code;
}

export function treeShakeModule(code: string, usedExports = new Set(['*']), options: { entry?: boolean } = {}): { code: string; removed: string[] } {
	const removed: string[] = [];
	const isAllUsed = usedExports.has('*');
	const used = (name: string) => isAllUsed || usedExports.has(name) || usedExports.has('default');

	let current = code;
	let changed = true;
	while (changed) {
		changed = false;
		const edits: Array<{ start: number; end: number; text: string }> = [];

		// 1. Exported functions (only if not an entry and not wildcard used)
		if (!isAllUsed) {
			for (const m of current.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g)) {
				const name = m[1];
				if (used(name)) continue;
				const parenStart = current.indexOf('(', m.index);
				const parenEnd = findParamEnd(current, parenStart);
				if (parenEnd < 0) continue;
				const open = current.indexOf('{', parenEnd);
				if (open < 0) continue;
				const close = matchBrace(current, open);
				if (close < 0) continue;
				if (refs(current, name, m.index, close + 1) === 0) {
					let end = close + 1;
					while (current[end] === ';' || current[end] === '\n' || current[end] === ' ') end++;
					edits.push({ start: m.index, end, text: ';' });
					if (!removed.includes(name)) removed.push(name);
				} else {
					const kwIdx = current.indexOf('function', m.index);
					const asyncIdx = current.indexOf('async', m.index);
					const stripEnd = (asyncIdx >= 0 && asyncIdx < kwIdx) ? asyncIdx : kwIdx;
					edits.push({ start: m.index, end: stripEnd, text: '' });
				}
			}

			// 2. Exported classes
			for (const m of current.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g)) {
				const name = m[1];
				if (used(name)) continue;
				const open = current.indexOf('{', m.index);
				if (open < 0) continue;
				const close = matchBrace(current, open);
				if (close < 0) continue;
				if (refs(current, name, m.index, close + 1) === 0) {
					let end = close + 1;
					while (current[end] === ';' || current[end] === '\n' || current[end] === ' ') end++;
					edits.push({ start: m.index, end, text: ';' });
					if (!removed.includes(name)) removed.push(name);
				} else {
					const kwIdx = current.indexOf('class', m.index);
					edits.push({ start: m.index, end: kwIdx, text: '' });
				}
			}

			// 3. Exported variables
			for (const m of current.matchAll(/\bexport\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
				const name = m[2];
				if (used(name)) continue;
				const end = statementEnd(current, m.index);
				const eq = current.indexOf('=', m.index);
				const expr = current.slice(eq + 1, end).replace(/;\s*$/, '');
				if (refs(current, name, m.index, end) === 0 && pureInitializer(expr)) {
					let cleanEnd = end;
					while (current[cleanEnd] === ';' || current[cleanEnd] === '\n' || current[cleanEnd] === ' ') cleanEnd++;
					edits.push({ start: m.index, end: cleanEnd, text: ';' });
					if (!removed.includes(name)) removed.push(name);
				} else {
					const kwIdx = current.indexOf(m[1], m.index);
					edits.push({ start: m.index, end: kwIdx, text: '' });
				}
			}

			// 4. Export specifiers list: `export { a, b as c };`
			for (const m of current.matchAll(/\bexport\s*\{([^}]+)\}\s*;?/g)) {
				const keep: string[] = [];
				for (const part of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
					const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
					if (!mm || used(mm[2] || mm[1])) keep.push(part);
					else if (!removed.includes(mm[2] || mm[1])) removed.push(mm[2] || mm[1]);
				}
				edits.push({ start: m.index, end: m.index + m[0].length, text: keep.length ? `export { ${keep.join(', ')} };` : '' });
			}
		}

		// 5. Unexported top-level functions with 0 references
		for (const m of current.matchAll(/(?:^|[;\n\r])\s*(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g)) {
			const matchStart = m.index;
			const fnIdx = current.indexOf('function', matchStart);
			const prefix = current.slice(Math.max(0, fnIdx - 10), fnIdx);
			if (/export\s+$/.test(prefix)) continue;
			const name = m[2];
			const parenStart = current.indexOf('(', fnIdx);
			const parenEnd = findParamEnd(current, parenStart);
			if (parenEnd < 0) continue;
			const open = current.indexOf('{', parenEnd);
			if (open < 0) continue;
			const close = matchBrace(current, open);
			if (close < 0) continue;
			if (refs(current, name, matchStart, close + 1) === 0) {
				let end = close + 1;
				while (current[end] === ';' || current[end] === '\n' || current[end] === ' ') end++;
				edits.push({ start: matchStart, end, text: ';' });
			}
		}

		// 6. Unexported top-level classes with 0 references
		for (const m of current.matchAll(/(?:^|[;\n\r])\s*class\s+([A-Za-z_$][\w$]*)/g)) {
			const matchStart = m.index;
			const kwIdx = current.indexOf('class', matchStart);
			const prefix = current.slice(Math.max(0, kwIdx - 10), kwIdx);
			if (/export\s+$/.test(prefix)) continue;
			const name = m[1];
			const open = current.indexOf('{', kwIdx);
			if (open < 0) continue;
			const close = matchBrace(current, open);
			if (close < 0) continue;
			if (refs(current, name, matchStart, close + 1) === 0) {
				let end = close + 1;
				while (current[end] === ';' || current[end] === '\n' || current[end] === ' ') end++;
				edits.push({ start: matchStart, end, text: ';' });
			}
		}

		// 7. Unexported top-level variables with pure initializers and 0 references
		for (const m of current.matchAll(/(?:^|[;\n\r])\s*(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
			const matchStart = m.index;
			const kwIdx = current.indexOf(m[1], matchStart);
			const prefix = current.slice(Math.max(0, kwIdx - 10), kwIdx);
			if (/export\s+$/.test(prefix)) continue;
			const name = m[2];
			const end = statementEnd(current, kwIdx);
			const eq = current.indexOf('=', kwIdx);
			const expr = current.slice(eq + 1, end).replace(/;\s*$/, '');
			if (refs(current, name, matchStart, end) === 0 && pureInitializer(expr)) {
				let cleanEnd = end;
				while (current[cleanEnd] === ';' || current[cleanEnd] === '\n' || current[cleanEnd] === ' ') cleanEnd++;
				edits.push({ start: matchStart, end: cleanEnd, text: ';' });
			}
		}

		// 8. Unused Destructuring Variables: `const { a, b } = expr;`
		for (const m of current.matchAll(/(?:^|[;\n\r])\s*(const|let|var)\s*\{([^}]+)\}\s*=\s*/g)) {
			const matchStart = m.index;
			const kwIdx = current.indexOf(m[1], matchStart);
			const prefix = current.slice(Math.max(0, kwIdx - 10), kwIdx);
			if (/export\s+$/.test(prefix)) continue;
			const end = statementEnd(current, kwIdx);
			const eq = current.indexOf('=', kwIdx);
			const expr = current.slice(eq + 1, end).replace(/;\s*$/, '');
			const parts = m[2].split(',').map(x => x.trim()).filter(Boolean);
			const keep: string[] = [];
			for (const part of parts) {
				const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
				if (!mm) { keep.push(part); continue; }
				const localName = mm[2] || mm[1];
				if (refs(current, localName, matchStart, end) > 0) {
					keep.push(part);
				}
			}
			if (keep.length === 0 && pureInitializer(expr)) {
				let cleanEnd = end;
				while (current[cleanEnd] === ';' || current[cleanEnd] === '\n' || current[cleanEnd] === ' ') cleanEnd++;
				edits.push({ start: matchStart, end: cleanEnd, text: ';' });
			} else if (keep.length < parts.length) {
				const open = current.indexOf('{', kwIdx);
				const close = current.indexOf('}', open);
				let newLHS = ` ${keep.join(', ')} `;
				let newRHS = expr;
				const trimmedRHS = expr.trim();
				if (trimmedRHS.startsWith('{') && trimmedRHS.endsWith('}')) {
					const rhsInner = trimmedRHS.slice(1, -1);
					const rhsEntries = rhsInner.split(',').map(x => x.trim()).filter(Boolean);
					const keepNames = new Set(keep.map(k => k.split(':')[0].trim()));
					const keptRHSEntries = rhsEntries.filter(entry => {
						const colon = entry.indexOf(':');
						const key = (colon >= 0 ? entry.slice(0, colon) : entry).trim();
						return keepNames.has(key);
					});
					newRHS = ` { ${keptRHSEntries.join(', ')} }`;
				}
				edits.push({ start: open + 1, end: close, text: newLHS });
				if (newRHS !== expr) {
					edits.push({ start: eq + 1, end, text: newRHS + (current[end - 1] === ';' ? ';' : '') });
				}
			}
		}

		// 9. Unused Named and Default Imports: `import { a, b } from '...'`
		for (const m of current.matchAll(/(?:^|[;\n\r])\s*import\s+(?:(type)\s+)?(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))\s+from\s*['"]([^'"]+)['"]\s*;?/g)) {
			const matchStart = m.index;
			const importIdx = current.indexOf('import', matchStart);
			const end = statementEnd(current, importIdx);
			const isTypeOnly = Boolean(m[1]);
			const defaultName = m[2] || m[5];
			const namedGroup = m[3];
			const namespaceName = m[4];
			const specifier = m[6];

			if (isTypeOnly) {
				// Pure type imports are removed in production build
				edits.push({ start: importIdx, end, text: '' });
				continue;
			}

			let hasActiveDefault = false;
			let keepNamed: string[] = [];
			let hasActiveNamespace = false;

			if (defaultName) {
				if (refs(current, defaultName, importIdx, end) > 0) {
					hasActiveDefault = true;
				}
			}

			if (namespaceName) {
				if (refs(current, namespaceName, importIdx, end) > 0) {
					hasActiveNamespace = true;
				}
			}

			if (namedGroup) {
				const parts = namedGroup.split(',').map(x => x.trim()).filter(Boolean);
				for (const part of parts) {
					const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
					if (!mm) { keepNamed.push(part); continue; }
					const localName = mm[2] || mm[1];
					if (refs(current, localName, importIdx, end) > 0) {
						keepNamed.push(part);
					}
				}
			}

			if (!hasActiveDefault && !hasActiveNamespace && keepNamed.length === 0) {
				// Entire import is unused
				let cleanEnd = end;
				while (current[cleanEnd] === ';' || current[cleanEnd] === '\n' || current[cleanEnd] === ' ') cleanEnd++;
				edits.push({ start: importIdx, end: cleanEnd, text: '' });
			} else if (namedGroup && keepNamed.length < namedGroup.split(',').map(x => x.trim()).filter(Boolean).length) {
				// Reconstruct stripped import
				const clauses: string[] = [];
				if (hasActiveDefault) clauses.push(defaultName);
				if (keepNamed.length) clauses.push(`{ ${keepNamed.join(', ')} }`);
				if (hasActiveNamespace) clauses.push(`* as ${namespaceName}`);
				edits.push({ start: importIdx, end, text: `import ${clauses.join(', ')} from '${specifier}';` });
			}
		}

		if (edits.length) {
			const next = applyNonOverlappingEdits(current, edits);
			if (next !== current) {
				current = next;
				changed = true;
			}
		}
	}

	return { code: current, removed: [...new Set(removed)] };
}

function resolve(from: string, spec: string): string {
	spec = spec.split(/[?#]/)[0];
	if (spec.startsWith('/')) return spec.slice(1);
	if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
	return spec;
}

export function collectUsedExports(modules: Map<string, string>, entries: string[] = []): Map<string, Set<string>> {
	const used = new Map<string, Set<string>>();
	for (const entry of entries) used.set(entry, new Set());

	const add = (target: string, name: string) => {
		if (!modules.has(target)) return;
		let set = used.get(target);
		if (!set) used.set(target, set = new Set());
		set.add(name);
	};

	for (const [from, code] of modules) {
		for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
			const target = resolve(from, m[2]);
			for (const part of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
				const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
				if (mm) add(target, mm[1]);
			}
		}
		for (const m of code.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/g)) add(resolve(from, m[2]), 'default');
		for (const m of code.matchAll(/import\s*\*\s*as\s+\w+\s+from\s*['"]([^'"]+)['"]/g)) add(resolve(from, m[1]), '*');
		for (const m of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) add(resolve(from, m[1]), '*');
		for (const m of code.matchAll(/(?:eventSymbol|capturedEventSymbol)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g)) add(resolve(from, m[1]), m[2]);

		// Named re-exports: `export { a, b } from './mod'`
		for (const m of code.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
			const target = resolve(from, m[2]);
			for (const part of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
				const mm = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
				if (mm) add(target, mm[1]);
			}
		}
	}

	// Transitive wildcard re-exports: `export * from './mod'`
	let changed = true;
	while (changed) {
		changed = false;
		for (const [from, code] of modules) {
			const fromUsed = used.get(from);
			if (!fromUsed || !fromUsed.size) continue;
			for (const m of code.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
				const target = resolve(from, m[1]);
				if (!modules.has(target)) continue;
				let targetSet = used.get(target);
				if (!targetSet) {
					targetSet = new Set();
					used.set(target, targetSet);
				}
				const beforeSize = targetSet.size;
				for (const item of fromUsed) targetSet.add(item);
				if (targetSet.size > beforeSize) changed = true;
			}
		}
	}

	return used;
}
