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

export function eliminateDeadBranches(code) {
	let out = '', i = 0;
	while (i < code.length) {
		const m = code.slice(i).match(/\bif\s*\(\s*(false|true)\s*\)\s*\{/);
		if (!m) {
			out += code.slice(i);
			break;
		}
		const truth = m[1] === 'true', start = i + m.index;
		out += code.slice(i, start);
		let p = start + m[0].length, depth = 1;
		for (; p < code.length && depth; p++) {
			if (code[p] === '"' || code[p] === "'" || code[p] === '`') {
				p = skipQuoted(code, p) - 1;
				continue;
			}
			if (code[p] === '{') depth++;
			else if (code[p] === '}') depth--;
		}
		const consequent = code.slice(start + m[0].length, p - 1);
		let q = p;
		while (/\s/.test(code[q])) q++;
		let alternate = '', end = p;
		if (code.startsWith('else', q)) {
			q += 4;
			while (/\s/.test(code[q])) q++;
			if (code[q] === '{') {
				let e = q + 1, d = 1;
				for (; e < code.length && d; e++) {
					if (code[e] === '"' || code[e] === "'" || code[e] === '`') {
						e = skipQuoted(code, e) - 1;
						continue;
					}
					if (code[e] === '{') d++;
					else if (code[e] === '}') d--;
				}
				alternate = code.slice(q + 1, e - 1);
				end = e;
			}
		}
		out += truth ? consequent : alternate;
		i = end;
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
			const restricted = /^(?:return|throw|break|continue|yield|async)$/.test(prev.value) || /^(?:\+\+|--)$/.test(token.value);
			if (lineBreak && restricted) out += '\n';
			else if (needsSpace(prev.value, token.value)) out += ' ';
		}
		out += token.value;
		prev = token;
	}
	return out.trim() + '\n';
}
