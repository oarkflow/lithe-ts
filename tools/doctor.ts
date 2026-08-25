import fs from 'node:fs/promises';
import path from 'node:path';
import { declarationCoverage, typecheckProject } from './typecheck.ts';
import { sourcecheck } from './sourcecheck.ts';
import { checkProject } from './check.ts';
import { buildProject } from './build.ts';
import { exists, formatBytes, FRAMEWORK_ROOT } from './shared.ts';

export interface DoctorCheck {
	name: string;
	status: 'pass' | 'warn' | 'fail';
	detail: string;
}

export async function doctorProject(projectDir = '.', options: { build?: boolean; sourceRoot?: string } = {}) {
	const root = path.resolve(projectDir);
	const checks: DoctorCheck[] = [];

	const pkgFile = path.join(root, 'package.json');
	if (await exists(pkgFile)) {
		const pkg = JSON.parse(await fs.readFile(pkgFile, 'utf8'));
		const deps = Object.keys(pkg.dependencies || {}).length;
		const devDeps = Object.keys(pkg.devDependencies || {}).length;
		checks.push({
			name: 'dependency policy',
			status: deps || devDeps ? 'warn' : 'pass',
			detail: `${deps} dependencies, ${devDeps} devDependencies`
		});
	} else {
		checks.push({ name: 'dependency policy', status: 'warn', detail: 'package.json not found' });
	}

	const declarations = await declarationCoverage();
	checks.push({
		name: 'public declarations',
		status: declarations.length ? 'fail' : 'pass',
		detail: declarations.length
			? `${declarations.length} missing export declaration(s)`
			: 'all official exports declared'
	});

	const sourceRoot = options.sourceRoot || root;
	const source = await sourcecheck(sourceRoot);
	checks.push({
		name: 'TypeScript source policy',
		status: source.ok ? 'pass' : 'fail',
		detail: `${source.files} source files, ${source.issues.length} issue(s)`
	});

	const typecheck = await typecheckProject(root);
	const typeErrors = typecheck.issues.filter(x => x.severity === 'error').length;
	const typeWarnings = typecheck.issues.filter(x => x.severity === 'warning').length;
	checks.push({
		name: 'semantic typecheck',
		status: typeErrors ? 'fail' : typeWarnings ? 'warn' : 'pass',
		detail: `${typecheck.files} files, ${typeErrors} error(s), ${typeWarnings} warning(s)`
	});

	const projectCheck = await checkProject(root);
	checks.push({
		name: 'framework checks',
		status: projectCheck.ok ? 'pass' : 'fail',
		detail: `${projectCheck.files} files, ${projectCheck.issues.length} issue(s)`
	});

	const benchmarkPkg = path.join(FRAMEWORK_ROOT, 'benchmarks', 'package.json');
	checks.push({
		name: 'benchmark reproducibility',
		status: await exists(benchmarkPkg) ? 'pass' : 'warn',
		detail: await exists(benchmarkPkg)
			? 'comparison benchmark package is isolated from the framework package'
			: 'no isolated benchmark package found'
	});

	if (options.build !== false && await exists(path.join(root, 'src'))) {
		try {
			const result = await buildProject(root, { enforceBudgets: true });
			checks.push({
				name: 'production build',
				status: 'pass',
				detail: `${formatBytes(result.manifest.bytes)} total, ${formatBytes(result.manifest.jsGzip)} JS gzip`
			});
		} catch (error) {
			checks.push({
				name: 'production build',
				status: 'fail',
				detail: error.message || String(error)
			});
		}
	}

	return { root, ok: !checks.some(x => x.status === 'fail'), checks };
}
