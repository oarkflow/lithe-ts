import fs from 'node:fs/promises';
import path from 'node:path';
import { walk, BUILTINS, exists } from './shared.ts';
import { compileModule } from '../src/compiler/jsx.ts';
import { stripTypeScript } from '../src/compiler/typescript.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';

const importRE = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"\n;]+?\s+from\s+)?['"]([^'"]+)['"]/gm;

function lineOf(code, index) {
	return code.slice(0, index).split('\n').length;
}

function resolveLocal(file, spec) {
	if (!spec.startsWith('.')) return null;
	let p = path.resolve(path.dirname(file), spec);
	const candidates = [
		p, p + '.js', p + '.jsx', p + '.ts', p + '.tsx',
		path.join(p, 'index.js'), path.join(p, 'index.jsx'),
		path.join(p, 'index.ts'), path.join(p, 'index.tsx')
	];
	return candidates;
}

function clientFile(file) {
	return /\.client\.(?:js|jsx|ts|tsx)$/.test(file) || /[\\/]client[\\/]/.test(file);
}

function colorValue(hex) {
	const m = String(hex).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m) return null;
	let h = m[1];
	if (h.length === 3) h = [...h].map(x => x + x).join('');
	return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminance(rgb) {
	if (!rgb) return null;
	const f = x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
	const [r, g, b] = rgb.map(f);
	return .2126 * r + .7152 * g + .0722 * b;
}

function contrast(a, b) {
	const x = luminance(colorValue(a)), y = luminance(colorValue(b));
	if (x == null || y == null) return null;
	return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function serverFile(file) {
	return /\.server\.(?:js|jsx|ts|tsx)$/.test(file) || /[\\/]server[\\/]/.test(file);
}

export async function checkProject(projectDir) {
	const root = path.resolve(projectDir);
	const files = (await walk(path.join(root, 'src'))).filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
	const issues = [];
	const graph = new Map();
	const codes = new Map();
	const secretFiles = new Set();

	for (const file of files) {
		const code = await fs.readFile(file, 'utf8');
		codes.set(file, code);
		const deps = [];
		importRE.lastIndex = 0;
		let match;

		while ((match = importRE.exec(code))) {
			const spec = match[1];
			if (!spec.startsWith('.') && !spec.startsWith('/') &&
				!spec.startsWith('@lithe/') && !spec.startsWith('lithe/') &&
				!BUILTINS.has(spec)) {
				issues.push({
					severity: 'error', code: 'DEP001',
					file: path.relative(root, file),
					line: lineOf(code, match.index),
					message: `Third-party import is forbidden: ${spec}`
				});
			}
			if (spec.startsWith('.')) {
				for (const c of resolveLocal(file, spec)) {
					if (await exists(c)) {
						deps.push(c);
						break;
					}
				}
			}
		}
		graph.set(file, deps);

		if (/innerHTML\s*=/.test(code) && !/trustedHTML/.test(code)) {
			issues.push({
				severity: 'warning', code: 'SEC001',
				file: path.relative(root, file),
				message: 'Direct innerHTML assignment found; prefer trustedHTML().'
			});
		}

		for (const m of code.matchAll(/<a\b([^>]*)>/g)) {
			const attrs = m[1];
			if (/\btarget\s*=\s*["']_blank["']/.test(attrs) && !/\brel\s*=\s*["'][^"']*(?:noopener|noreferrer)/.test(attrs)) {
				issues.push({
					severity: 'warning', code: 'SEC002',
					file: path.relative(root, file),
					line: lineOf(code, m.index),
					message: 'target="_blank" link should include rel="noopener" or rel="noreferrer".'
				});
			}
			if (/\bhref\s*=\s*["']\s*javascript:/i.test(attrs)) {
				issues.push({
					severity: 'error', code: 'SEC003',
					file: path.relative(root, file),
					line: lineOf(code, m.index),
					message: 'javascript: URLs are blocked in static anchors.'
				});
			}
		}

		for (const m of code.matchAll(/<img\b([^>]*)>/g)) {
			if (!/\balt\s*=/.test(m[1])) {
				issues.push({
					severity: 'warning', code: 'A11Y001',
					file: path.relative(root, file),
					line: lineOf(code, m.index),
					message: 'Image appears to be missing alt text.'
				});
			}
		}

		for (const m of code.matchAll(/<(div|span)\b([^>]*)\bonClick\s*=/g)) {
			if (!/\brole\s*=|\btabIndex\s*=|\bonKey(?:down|up)\s*=/.test(m[2])) {
				issues.push({
					severity: 'warning', code: 'A11Y002',
					file: path.relative(root, file),
					line: lineOf(code, m.index),
					message: `Clickable <${m[1]}> lacks keyboard semantics; prefer <button> or add role/tabIndex/key handling.`
				});
			}
		}

		const labels = [...code.matchAll(/<label\b([^>]*)>/g)];
		for (const m of labels) {
			if (!/\bhtmlFor\s*=|\bfor\s*=/.test(m[1]) &&
				!/<(?:input|select|textarea)\b/.test(code.slice(m.index, code.indexOf('</label>', m.index) + 8))) {
				issues.push({
					severity: 'warning', code: 'A11Y003',
					file: path.relative(root, file),
					line: lineOf(code, m.index),
					message: 'Label may not be associated with a form control.'
				});
			}
		}

		const headings = [...code.matchAll(/<h([1-6])\b/g)].map(m => ({
			level: Number(m[1]), index: m.index
		}));
		for (let i = 1; i < headings.length; i++) {
			if (headings[i].level > headings[i - 1].level + 1) {
				issues.push({
					severity: 'warning', code: 'A11Y004',
					file: path.relative(root, file),
					line: lineOf(code, headings[i].index),
					message: `Heading level jumps from h${headings[i - 1].level} to h${headings[i].level}.`
				});
			}
		}

		for (const m of code.matchAll(/style\s*=\s*\{\{([^}]*)\}\}/g)) {
			const body = m[1];
			const fg = body.match(/(?:^|,)\s*color\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/);
			const bg = body.match(/(?:^|,)\s*background(?:Color)?\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/);
			if (fg && bg) {
				const ratio = contrast(fg[1], bg[1]);
				if (ratio != null && ratio < 4.5) {
					issues.push({
						severity: 'warning', code: 'A11Y005',
						file: path.relative(root, file),
						line: lineOf(code, m.index),
						message: `Static text/background contrast is ${ratio.toFixed(2)}:1; target at least 4.5:1 for normal text.`
					});
				}
			}
		}

		if (/effect\s*\(\s*\(?.*?=>[\s\S]*?\.value\s*=/.test(code)) {
			issues.push({
				severity: 'warning', code: 'REACT001',
				file: path.relative(root, file),
				message: 'Effect assigns reactive state; if this is a derivation prefer computed().'
			});
		}

		const secretPattern = /(?:process\.env|Deno\.env|Bun\.env|\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\b)/;
		if (secretPattern.test(code)) secretFiles.add(file);
		if (clientFile(file) && secretPattern.test(code)) {
			issues.push({
				severity: 'error', code: 'SECRET001',
				file: path.relative(root, file),
				message: 'Potential secret/environment access in a client module.'
			});
		}

		const rel = path.relative(root, file);
		if (file.endsWith('.ts')) {
			try {
				const stripped = stripTypeScript(code, { filename: rel });
				const syntax = validateJavaScript(stripped, { filename: rel, maxErrors: 6 });
				for (const d of syntax.diagnostics) issues.push({ ...d, file: rel });
			} catch (error) {
				issues.push({ severity: 'error', code: 'TS_TRANSFORM', file: rel, message: error.message });
			}
		} else {
			const compiled = compileModule(code, {
				typescript: file.endsWith('.tsx'),
				filename: rel,
				sourceMap: false,
				captureEvents: false
			});
			for (const d of compiled.diagnostics) issues.push({ ...d, file: rel });
		}
	}

	for (const start of files.filter(clientFile)) {
		const seen = new Set();
		const visit = (file, trail) => {
			if (seen.has(file)) return;
			seen.add(file);
			if (file !== start && secretFiles.has(file)) {
				issues.push({
					severity: 'error', code: 'SECRET002',
					file: path.relative(root, start),
					message: `Client dependency reaches a secret/environment-bearing module: ${trail.join(' -> ')}`
				});
			}
			for (const dep of graph.get(file) || []) {
				if (serverFile(dep)) {
					issues.push({
						severity: 'error', code: 'ENV001',
						file: path.relative(root, start),
						message: `Client dependency reaches server-only module: ${[...trail, path.relative(root, dep)].join(' -> ')}`
					});
					continue;
				}
				visit(dep, [...trail, path.relative(root, dep)]);
			}
		};
		visit(start, [path.relative(root, start)]);
	}

	return {
		files: files.length,
		issues,
		ok: !issues.some(x => x.severity === 'error'),
		graph: Object.fromEntries([...graph].map(([k, v]) => [
			path.relative(root, k),
			v.map(x => path.relative(root, x))
		]))
	};
}
