import { tokenizeJavaScript } from '../src/compiler/parser.ts';

function skipQuoted(code, i) {
	const q = code[i++];
	while (i < code.length) {
		if (code[i] === '\\') {
			i += 2;
			continue;
		}
		if (code[i] === q) return i + 1;
		i++;
	}
	return i;
}

// Consumes a balanced `{ ... }` body whose opening brace has already been
// read (i points just past it); returns the index just after the matching
// closing brace, skipping over quoted/template literals so braces inside
// strings don't unbalance the count.
function skipBalanced(code, i) {
	let depth = 1;
	for (; i < code.length && depth; i++) {
		if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
			i = skipQuoted(code, i) - 1;
			continue;
		}
		if (code[i] === '{') depth++;
		else if (code[i] === '}') depth--;
	}
	return i;
}

// Matches an `if ( <condition> ) {` header starting at i (i must point at
// the 'i' of 'if'). Returns the index just past the opening '{', or null if
// this isn't a brace-bodied if-statement at this position (e.g. `if (x) y;`
// with no block, or not an if at all). Braces/parens inside the condition
// (arrow function bodies, object literals) are matched, not just scanned for
// the first `)`.
function matchIfBlockHeader(code, i) {
	if (!code.startsWith('if', i) || /[A-Za-z0-9_$]/.test(code[i + 2] || '')) return null;
	let p = i + 2;
	while (/\s/.test(code[p])) p++;
	if (code[p] !== '(') return null;
	p++;
	let depth = 1;
	for (; p < code.length && depth; p++) {
		if (code[p] === '"' || code[p] === "'" || code[p] === '`') {
			p = skipQuoted(code, p) - 1;
			continue;
		}
		if (code[p] === '(') depth++;
		else if (code[p] === ')') depth--;
	}
	while (/\s/.test(code[p])) p++;
	if (code[p] !== '{') return null;
	return p + 1;
}

export function eliminateDeadBranches(code) {
	let out = '', i = 0;
	while (i < code.length) {
		const m = code.slice(i).match(/\bif\s*\(\s*(false|true)\s*\)\s*\{/);
		if (!m) {
			out += code.slice(i);
			break;
		}
		const truth = m[1] === 'true', start = i + m.index;
		const consequentStart = start + m[0].length;
		const consequentEnd = skipBalanced(code, consequentStart);
		const consequent = code.slice(consequentStart, consequentEnd - 1);
		let q = consequentEnd;
		while (/\s/.test(code[q])) q++;
		if (code.startsWith('else', q) && !/[A-Za-z0-9_$]/.test(code[q + 4] || '')) {
			let r = q + 4;
			while (/\s/.test(code[r])) r++;
			if (code[r] === '{') {
				// if (true|false) { A } else { B } -> keep only the taken branch.
				const blockEnd = skipBalanced(code, r + 1);
				out += code.slice(i, start) + (truth ? consequent : code.slice(r + 1, blockEnd - 1));
				i = blockEnd;
				continue;
			}
			const chainHeaderEnd = matchIfBlockHeader(code, r);
			if (chainHeaderEnd !== null) {
				if (truth) {
					// The true branch is taken, so the entire trailing
					// else-if/.../else chain is dead code and must be
					// discarded in full, not just its first block, or the
					// leftover `else` is emitted with no matching `if`.
					let end = chainHeaderEnd;
					while (true) {
						end = skipBalanced(code, end);
						let e2 = end;
						while (/\s/.test(code[e2])) e2++;
						if (!(code.startsWith('else', e2) && !/[A-Za-z0-9_$]/.test(code[e2 + 4] || ''))) break;
						let e3 = e2 + 4;
						while (/\s/.test(code[e3])) e3++;
						if (code[e3] === '{') {
							end = skipBalanced(code, e3 + 1);
							break;
						}
						const nextHeaderEnd = matchIfBlockHeader(code, e3);
						if (nextHeaderEnd === null) break;
						end = nextHeaderEnd;
					}
					out += code.slice(i, start) + consequent;
					i = end;
					continue;
				}
				// The false branch is discarded; hand the "if (...) { ... }"
				// that followed "else" back to the main loop unconsumed
				// (stripping only the "else ") so a literal condition there
				// still gets simplified, and any further "else"/"else if"
				// after it is emitted normally instead of left dangling.
				out += code.slice(i, start);
				i = r;
				continue;
			}
			// A bare (non-block) `else statement;` — we can't safely find
			// where the statement ends without a full parser. Leave this
			// entire if/else construct untouched rather than risk emitting
			// a syntactically broken partial rewrite.
			out += code.slice(i, q);
			i = q;
			continue;
		}
		out += code.slice(i, start) + (truth ? consequent : '');
		i = consequentEnd;
	}
	return out;
}

const IDENT = /^[A-Za-z_$\w]+$/;
const PUNCT_MERGE = new Set([
	'++', '--', '&&', '||', '??', '?.', '**',
	'==', '===', '!=', '!==', '<=', '>=', '=>',
	'+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
	'<<', '>>', '>>>', '<<=', '>>=', '>>>=',
	'&&=', '||=', '??=', '//', '/*'
]);

function needsSpace(a, b) {
	if (!a || !b) return false;
	if (IDENT.test(a.at(-1)) && IDENT.test(b[0])) return true;
	if (/[0-9]/.test(a.at(-1)) && /[A-Za-z_$]/.test(b[0])) return true;
	if ((a.at(-1) === '+' && b[0] === '+') || (a.at(-1) === '-' && b[0] === '-')) return true;
	const combo = a + b;
	if (PUNCT_MERGE.has(combo) || combo.startsWith('//') || combo.startsWith('/*')) return true;
	return false;
}

export function minifyJS(code) {
	const tokens = tokenizeJavaScript(code);
	if (!tokens.length) return '';
	let out = '', prev = null;
	for (const token of tokens) {
		if (prev) {
			const gap = code.slice(prev.end, token.start);
			const lineBreak = /[\r\n]/.test(gap);
			// A source line break may be the only statement separator present
			// (JavaScript's ASI). Collapsing it away can silently join two
			// statements into one (e.g. `let a = 1\nlet b = 2` -> a syntax
			// error, or `a\n++b` -> a different program). Without a full ASI
			// implementation, always keep line breaks as real newlines; only
			// space-only gaps are collapsed/removed for token-adjacency safety.
			if (lineBreak) out += '\n';
			else if (needsSpace(prev.value, token.value)) out += ' ';
		}
		out += token.value;
		prev = token;
	}
	return out.trim() + '\n';
}
