import fs from 'node:fs/promises';
import path from 'node:path';
import { compileModule } from '../src/compiler/jsx.ts';
import { stripTypeScript } from '../src/compiler/typescript.ts';
import { validateJavaScript } from '../src/compiler/parser.ts';
import { exists, walk } from './shared.ts';

export interface SourceCheckIssue {
	file: string;
	code: string;
	message: string;
	line?: number;
	column?: number;
}

export interface SourceCheckResult {
	ok: boolean;
	files: number;
	issues: SourceCheckIssue[];
	javascriptFiles: string[];
}

const DEFAULT_ROOTS = ['src', 'tools', 'cli', 'tests', 'benchmarks', 'examples'];

export async function sourcecheck(rootDir = '.', options: { roots?: string[] } = {}): Promise<SourceCheckResult> {
	const root = path.resolve(rootDir);
	const issues: SourceCheckIssue[] = [];
	const javascriptFiles: string[] = [];
	let files = 0;

	for (const name of options.roots || DEFAULT_ROOTS) {
		const dir = path.join(root, name);
		if (!await exists(dir)) continue;

		for (const file of await walk(dir)) {
			const rel = path.relative(root, file).replace(/\\/g, '/');
			if (rel.includes('/dist/') || rel.includes('/.lithe/') || rel.includes('node_modules/')) continue;

			if (file.endsWith('.js')) {
				javascriptFiles.push(rel);
				continue;
			}
			if (file.endsWith('.d.ts')) continue;
			if (!/\.(?:ts|tsx)$/.test(file)) continue;

			files++;
			const source = await fs.readFile(file, 'utf8');

			try {
				if (file.endsWith('.tsx')) {
					const compiled = compileModule(source, {
						typescript: true,
						filename: rel,
						injectRuntime: false,
						captureEvents: false,
						lazyEvents: false,
						autoWorkers: false,
						sourceMap: false
					});
					for (const issue of compiled.diagnostics || []) {
						if (issue.severity === 'error') {
							issues.push({
								file: rel,
								code: issue.code || 'TSX_COMPILE',
								message: issue.message,
								line: issue.line,
								column: issue.column
							});
						}
					}
					const syntax = validateJavaScript(compiled.code, { filename: rel, maxErrors: 8 });
					for (const issue of syntax.diagnostics) {
						issues.push({
							file: rel,
							code: issue.code || 'JS_SYNTAX',
							message: issue.message,
							line: issue.line,
							column: issue.column
						});
					}
				} else {
					const stripped = stripTypeScript(source, { filename: rel, fallback: false });
					const syntax = validateJavaScript(stripped, { filename: rel, maxErrors: 8 });
					for (const issue of syntax.diagnostics) {
						issues.push({
							file: rel,
							code: issue.code || 'JS_SYNTAX',
							message: issue.message,
							line: issue.line,
							column: issue.column
						});
					}
				}
			} catch (error) {
				issues.push({
					file: rel,
					code: 'TS_TRANSFORM',
					message: error instanceof Error ? error.message : String(error)
				});
			}
		}
	}

	for (const file of javascriptFiles) {
		issues.push({
			file,
			code: 'TS_ONLY',
			message: 'Authored JavaScript implementation file found; use .ts/.tsx instead.'
		});
	}

	return { ok: issues.length === 0, files, issues, javascriptFiles };
}
