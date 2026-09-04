import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from '../src/compiler/jsx.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { collectTypeEnvironment, semanticTypecheck } from '../src/compiler/typecheck.ts';
import { exists, walk, FRAMEWORK_ROOT } from './shared.ts';

const publicModules = {
	'@oarkflow/lithe/core': 'src/core/index.ts',
	'@oarkflow/lithe/signals': 'src/signals.ts',
	'@oarkflow/lithe/dom': 'src/dom/index.ts',
	'@oarkflow/lithe/router': 'src/router/index.ts',
	'@oarkflow/lithe/data': 'src/data/index.ts',
	'@oarkflow/lithe/forms': 'src/forms/index.ts',
	'@oarkflow/lithe/rpc': 'src/server/rpc.ts',
	'@oarkflow/lithe/server': 'src/server/index.ts',
	'@oarkflow/lithe/offline': 'src/offline/index.ts',
	'@oarkflow/lithe/sync': 'src/sync/index.ts',
	'@oarkflow/lithe/collection': 'src/collection/index.ts',
	'@oarkflow/lithe/virtual': 'src/virtual/index.ts',
	'@oarkflow/lithe/grid': 'src/grid/index.ts',
	'@oarkflow/lithe/style': 'src/style/index.ts',
	'@oarkflow/lithe/image': 'src/image/index.ts',
	'@oarkflow/lithe/animation': 'src/animation/index.ts',
	'@oarkflow/lithe/ui': 'src/ui/index.ts',
	'@oarkflow/lithe/worker': 'src/worker/index.ts',
	'@oarkflow/lithe/interop': 'src/interop/index.ts',
	'@oarkflow/lithe/devtools': 'src/devtools/index.ts',
	'@oarkflow/lithe/observability': 'src/observability/index.ts',
	'@oarkflow/lithe/i18n': 'src/i18n/index.ts',
	'@oarkflow/lithe/head': 'src/head/index.ts',
	'@oarkflow/lithe/permissions': 'src/permissions/index.ts',
	'@oarkflow/lithe/testing': 'src/testing/index.ts',
	'@oarkflow/lithe/app': 'src/app/index.ts',
	'@oarkflow/lithe/compiler': 'src/compiler/index.ts'
};

function moduleBlock(source, name) {
	const marker = `declare module '${name}'`;
	const start = source.indexOf(marker);
	if (start < 0) return '';
	const open = source.indexOf('{', start);
	let depth = 0, quote = null;
	for (let i = open; i < source.length; i++) {
		const c = source[i];
		if (quote) {
			if (c === '\\') i++;
			else if (c === quote) quote = null;
			continue;
		}
		if (c === '\'' || c === '"') {
			quote = c;
			continue;
		}
		if (c === '{') depth++;
		else if (c === '}' && --depth === 0) return source.slice(open + 1, i);
	}
	return source.slice(open + 1);
}

export async function declarationCoverage() {
	const declaration = await fs.readFile(path.join(FRAMEWORK_ROOT, 'types/lithe.d.ts'), 'utf8');
	const issues = [];

	for (const [specifier, file] of Object.entries(publicModules)) {
		const block = moduleBlock(declaration, specifier);
		if (!block) {
			issues.push({
				severity: 'error',
				code: 'TYPE_MODULE_MISSING',
				file: 'types/lithe.d.ts',
				message: `Missing declaration module ${specifier}`
			});
			continue;
		}
		const mod = await import(pathToFileURL(path.join(FRAMEWORK_ROOT, file)).href);
		for (const name of Object.keys(mod)) {
			if (!new RegExp(`\\b${name.replace(/[$]/g, '\\$&')}\\b`).test(block) &&
				!(/@oarkflow\/lithe\/server/.test(specifier) && moduleBlock(declaration, '@oarkflow/lithe/rpc').includes(name))) {
				issues.push({
					severity: 'error',
					code: 'TYPE_EXPORT_MISSING',
					file: 'types/lithe.d.ts',
					message: `${specifier} is missing declaration for export ${name}`
				});
			}
		}
	}

	return issues;
}

export async function typecheckProject(projectDir = '.') {
	const root = path.resolve(projectDir);
	const issues = await declarationCoverage();
	const src = path.join(root, 'src');
	let files = 0;

	if (await exists(src)) {
		const typed = (await walk(src)).filter(f => /\.(?:ts|tsx)$/.test(f));
		const sources = [];
		for (const file of typed) sources.push(await fs.readFile(file, 'utf8'));

		const env = collectTypeEnvironment(sources);

		for (let index = 0; index < typed.length; index++) {
			const file = typed[index];
			const code = sources[index];
			const rel = path.relative(root, file).replace(/\\/g, '/');
			files++;

			try {
				const semantics = semanticTypecheck(code, { filename: rel, env });
				issues.push(...semantics.issues);

				const compiled = compileModule(code, {
					typescript: true,
					filename: rel,
					injectRuntime: false,
					sourceMap: false,
					captureEvents: false
				});
				for (const d of compiled.diagnostics || []) {
					if (d.severity === 'error') issues.push({ ...d, file: rel });
				}

				const syntax = validateJavaScript(compiled.code, { filename: rel, maxErrors: 6 });
				for (const d of syntax.diagnostics) issues.push({ ...d, file: rel });
			} catch (error) {
				issues.push({ severity: 'error', code: 'TS_TRANSFORM', file: rel, message: error.message });
			}
		}
	}

	return { ok: !issues.some(x => x.severity === 'error'), files, issues };
}
