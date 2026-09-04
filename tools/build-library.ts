import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { stripTypeScript } from '../src/compiler/typescript.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { minifyJS } from './minify.ts';
import { exists, FRAMEWORK_ROOT, walk, ensureDir, copyFile, formatBytes } from './shared.ts';

export interface LibraryBuildResult {
	outDir: string;
	files: string[];
	bytes: number;
	runtimeBytes: number;
	runtimeGzipBytes: number;
	declarationBytes: number;
	mode: LibraryBuildMode;
}

const ROOT_FILES = ['README.md', 'LICENSE', 'CHANGELOG.md'];
const CORE_EXPORTS = new Set([
	'.',
	'./runtime',
	'./core',
	'./signals',
	'./dom',
	'./jsx-runtime',
	'./dom/jsx-runtime',
	'./jsx-dev-runtime',
	'./dom/jsx-dev-runtime'
]);

const RUNTIME_EXPORTS = new Set([
	...CORE_EXPORTS,
	'./forms',
	'./router',
	'./i18n',
	'./style',
	'./server',
	'./data',
	'./collection',
	'./ui',
	'./virtual',
	'./grid',
	'./image',
	'./animation',
	'./worker',
	'./offline',
	'./sync',
	'./interop',
	'./observability',
	'./permissions',
	'./testing',
	'./head',
	'./app',
	'./rpc'
]);

export type LibraryBuildMode = 'core' | 'runtime' | 'full';

const CORE_MODULES = new Set([
	'core',
	'signals.ts',
	'dom',
	'index.ts',
	'jsx-dev-runtime.ts',
	'jsx-runtime.ts',
	'runtime'
]);

const CORE_DECLARATION_MODULES = new Set([
	'@oarkflow/lithe',
	'@oarkflow/lithe/core',
	'@oarkflow/lithe/signals',
	'@oarkflow/lithe/dom',
	'@oarkflow/lithe/dom/jsx-runtime',
	'@oarkflow/lithe/dom/jsx-dev-runtime',
	'@oarkflow/lithe/runtime',
	'@oarkflow/lithe/jsx-runtime',
	'@oarkflow/lithe/jsx-dev-runtime'
]);

const TOOLING_DECLARATION_MODULES = new Set([
	'@oarkflow/lithe/compiler',
	'@oarkflow/lithe/experimental',
	'@oarkflow/lithe/plugins',
	'@oarkflow/lithe/vite',
	'@oarkflow/lithe/rollup',
	'@oarkflow/lithe/babel',
	'@oarkflow/lithe/tailwind'
]);

const RUNTIME_MODULES = new Set([
	...CORE_MODULES,
	'animation',
	'app',
	'collection',
	'data',
	'devtools',
	'forms',
	'grid',
	'head',
	'i18n',
	'image',
	'interop',
	'observability',
	'offline',
	'permissions',
	'router',
	'server',
	'style',
	'sync',
	'testing',
	'ui',
	'virtual',
	'worker'
]);

function rewriteBuiltImports(code: string): string {
	return code.replace(/((?:from\s+|import\s*\()\s*['"][^'"]+)\.(?:ts|tsx)(['"])/g, '$1.js$2');
}

function declarationBlockEnd(source: string, open: number): number {
	let depth = 0;
	let quote = '';
	for (let i = open; i < source.length; i++) {
		const char = source[i];
		if (quote) {
			if (char === '\\') i++;
			else if (char === quote) quote = '';
			continue;
		}
		if (char === '\'' || char === '"' || char === '`') {
			quote = char;
			continue;
		}
		if (char === '{') depth++;
		else if (char === '}' && --depth === 0) return i + 1;
	}
	throw new Error('Unterminated declaration block');
}

function declarationSurface(source: string, mode: LibraryBuildMode): string {
	if (mode === 'full') return source;
	const blocks: string[] = [];
	const pattern = /declare\s+(?:module\s+(['"])([^'"]+)\1|global)\s*\{/g;
	for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
		const name = match[2];
		const include = !name || (mode === 'core' ? CORE_DECLARATION_MODULES.has(name) : !TOOLING_DECLARATION_MODULES.has(name));
		const open = source.indexOf('{', match.index);
		const end = declarationBlockEnd(source, open);
		if (include) blocks.push(source.slice(match.index, end));
		pattern.lastIndex = end;
	}
	return `/** Lithe ${mode} package declarations. Generated from types/lithe.d.ts. */\n${blocks.join('\n\n')}\n`;
}

function packageExports(exportsMap, mode: LibraryBuildMode) {
	const out = {};
	for (const [key, value] of Object.entries(exportsMap || {})) {
		if (mode === 'core' && !CORE_EXPORTS.has(key)) continue;
		if (mode === 'runtime' && !RUNTIME_EXPORTS.has(key)) continue;
		if (typeof value === 'string') {
			const name = key === '.' ? 'index' : key.slice(2).replace(/\//g, '__');
			out[key] = {
				types: `./types/exports/${name}.d.ts`,
				import: value.replace(/^\.\/src\//, './src/').replace(/\.ts$/, '.js').replace(/\.tsx$/, '.js')
			};
		}
	}
	return out;
}

async function writeCompiledTS(from: string, to: string, executable = false) {
	const source = await fs.readFile(from, 'utf8');
	const filename = path.relative(FRAMEWORK_ROOT, from);
	let code = rewriteBuiltImports(stripTypeScript(source, { filename }));
	const diagnostics = validateJavaScript(code, { filename, maxErrors: 5 }).diagnostics;
	if (diagnostics.some(x => x.severity === 'error')) {
		const first = diagnostics.find(x => x.severity === 'error');
		throw new Error(`Library build emitted invalid JavaScript for ${filename}: ${first?.message}`);
	}
	if (!executable && filename.startsWith(`src${path.sep}`)) code = minifyJS(code);
	const finalDiagnostics = validateJavaScript(code, { filename, maxErrors: 5 }).diagnostics;
	if (finalDiagnostics.some(x => x.severity === 'error')) {
		const first = finalDiagnostics.find(x => x.severity === 'error');
		throw new Error(`Library build finalized invalid JavaScript for ${filename}: ${first?.message}`);
	}
	if (executable && !code.startsWith('#!')) code = `#!/usr/bin/env node\n${code}`;
	await ensureDir(to);
	await fs.writeFile(to, code);
	if (executable) await fs.chmod(to, 0o755);
}

function includeSourceFile(rel: string, mode: LibraryBuildMode) {
	if (mode === 'full') return true;
	const rest = rel.slice('src/'.length);
	const top = rest.split('/')[0];
	return (mode === 'core' ? CORE_MODULES : RUNTIME_MODULES).has(top);
}

export async function buildLibraryPackage(options: { outDir?: string; mode?: LibraryBuildMode } = {}): Promise<LibraryBuildResult> {
	const mode = options.mode || 'core';
	const defaultDir = mode === 'full' ? 'lithe-package-full' : mode === 'runtime' ? 'lithe-package-runtime' : 'lithe-package';
	const outDir = path.resolve(options.outDir || path.join(FRAMEWORK_ROOT, 'dist', defaultDir));
	await fs.rm(outDir, { recursive: true, force: true });
	await fs.mkdir(outDir, { recursive: true });

	const emitted: string[] = [];
	for (const dir of mode === 'full' ? ['src', 'tools'] : ['src']) {
		for (const file of await walk(path.join(FRAMEWORK_ROOT, dir))) {
			const rel = path.relative(FRAMEWORK_ROOT, file);
			if (dir === 'src' && !includeSourceFile(rel, mode)) continue;
			if (file.endsWith('.d.ts')) {
				const target = path.join(outDir, rel);
				await copyFile(file, target);
				emitted.push(path.relative(outDir, target));
			} else if (/\.(ts|tsx)$/.test(file)) {
				const target = path.join(outDir, rel.replace(/\.(ts|tsx)$/, '.js'));
				await writeCompiledTS(file, target);
				if ((await fs.readFile(target, 'utf8')).trim()) emitted.push(path.relative(outDir, target));
				else await fs.rm(target);
			}
		}
	}

	if (mode === 'full') {
		await writeCompiledTS(path.join(FRAMEWORK_ROOT, 'cli', 'lithe.ts'), path.join(outDir, 'cli', 'lithe.js'), true);
		emitted.push('cli/lithe.js');
	}

	await fs.mkdir(path.join(outDir, 'types'), { recursive: true });
	if (mode === 'full') {
		for (const file of await walk(path.join(FRAMEWORK_ROOT, 'types'))) {
			const target = path.join(outDir, path.relative(FRAMEWORK_ROOT, file));
			await copyFile(file, target);
			emitted.push(path.relative(outDir, target));
		}
	} else {
		const declarations = await fs.readFile(path.join(FRAMEWORK_ROOT, 'types', 'lithe.d.ts'), 'utf8');
		await fs.writeFile(path.join(outDir, 'types', 'lithe.d.ts'), declarationSurface(declarations, mode));
		emitted.push('types/lithe.d.ts');
	}

	for (const file of ROOT_FILES) {
		const from = path.join(FRAMEWORK_ROOT, file);
		if (await exists(from)) {
			const target = path.join(outDir, file);
			await copyFile(from, target);
			emitted.push(file);
		}
	}

	const rootPkg = JSON.parse(await fs.readFile(path.join(FRAMEWORK_ROOT, 'package.json'), 'utf8'));
	const exports = packageExports(rootPkg.exports, mode);
	await fs.mkdir(path.join(outDir, 'types', 'exports'), { recursive: true });
	for (const [key, value] of Object.entries(exports)) {
		const specifier = key === '.' ? '@oarkflow/lithe/runtime' : `@oarkflow/lithe/${key.slice(2)}`;
		const target = value.types.slice(2);
		await fs.writeFile(path.join(outDir, target), `/// <reference path="../lithe.d.ts" />\nexport * from '${specifier}';\n`);
		emitted.push(target);
	}
	const pkg = {
		name: rootPkg.name,
		version: rootPkg.version,
		type: 'module',
		description: rootPkg.description,
		license: 'MIT',
		author: rootPkg.author || 'oarkflow',
		keywords: rootPkg.keywords || ['typescript', 'frontend', 'framework', 'reactive', 'signals', 'jsx', 'compiler', 'ssr'],
		repository: rootPkg.repository || { type: 'git', url: 'git+https://github.com/oarkflow/lithe-ts.git' },
		homepage: rootPkg.homepage || 'https://github.com/oarkflow/lithe-ts#readme',
		bugs: rootPkg.bugs || { url: 'https://github.com/oarkflow/lithe-ts/issues' },
		publishConfig: { access: 'public' },
		engines: rootPkg.engines,
		...(mode === 'full' ? { bin: { lithe: 'cli/lithe.js' } } : {}),
		files: mode === 'full'
			? ['src', 'cli', 'tools', 'types', 'README.md', 'LICENSE', 'CHANGELOG.md']
			: ['src', 'types', 'README.md', 'LICENSE', 'CHANGELOG.md'],
		types: './types/exports/index.d.ts',
		sideEffects: false,
		main: './src/runtime/index.js',
		module: './src/runtime/index.js',
		exports,
		dependencies: {},
		devDependencies: {}
	};
	await fs.writeFile(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
	emitted.push('package.json');

	let bytes = 0;
	let runtimeBytes = 0;
	let runtimeGzipBytes = 0;
	let declarationBytes = 0;
	for (const rel of emitted) {
		const file = path.join(outDir, rel);
		const size = (await fs.stat(file)).size;
		bytes += size;
		if (rel.endsWith('.js')) {
			runtimeBytes += size;
			runtimeGzipBytes += gzipSync(await fs.readFile(file)).length;
		} else if (rel.endsWith('.d.ts')) declarationBytes += size;
	}
	await fs.writeFile(path.join(outDir, 'lithe-package-manifest.json'), JSON.stringify({
		mode,
		files: emitted.sort(),
		packageBytes: bytes,
		runtimeBytes,
		runtimeGzipBytes,
		declarationBytes
	}, null, 2) + '\n');
	emitted.push('lithe-package-manifest.json');

	return { outDir, files: emitted.sort(), bytes, runtimeBytes, runtimeGzipBytes, declarationBytes, mode };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const outFlag = process.argv.find(x => x.startsWith('--out='));
	const modeFlag = process.argv.find(x => x.startsWith('--mode='));
	const requestedMode = modeFlag?.slice('--mode='.length);
	const mode = requestedMode === 'full' || requestedMode === 'runtime' ? requestedMode : 'core';
	const result = await buildLibraryPackage({ outDir: outFlag ? outFlag.slice('--out='.length) : undefined, mode });
	console.log(`Built Lithe ${result.mode}: ${formatBytes(result.runtimeBytes)} runtime (${formatBytes(result.runtimeGzipBytes)} gzip), ${formatBytes(result.declarationBytes)} types, ${formatBytes(result.bytes)} installed -> ${result.outDir}`);
}
