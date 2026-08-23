#!/usr/bin/env -S node --experimental-strip-types
import path from 'node:path';
import { devServer } from '../tools/dev-server.ts';
import { buildProject } from '../tools/build.ts';
import { checkProject } from '../tools/check.ts';
import { analyzeProject } from '../tools/analyze.ts';
import { createProject } from '../tools/create.ts';
import { prerenderProject } from '../tools/prerender.ts';
import { generateTypes } from '../tools/types.ts';
import { inspectImage } from '../tools/image.ts';
import { typecheckProject } from '../tools/typecheck.ts';
import { sourcecheck } from '../tools/sourcecheck.ts';

const [command = 'help', arg = '.', ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter(x => x.startsWith('--')).map(x => { const [k, v = 'true'] = x.slice(2).split('='); return [k, v]; }));

try {
	if (command === 'dev') { const result = await devServer(arg, { port: flags.port, host: flags.host }); console.log(`Lithe dev server: ${result.url}`); }
	else if (command === 'build') { const result = await buildProject(arg, { outDir: flags.out, bundle: flags.bundle }); console.log(`Built ${result.manifest.files.length} files (${result.manifest.bytes} bytes) -> ${result.out}`); }
	else if (command === 'check') { const r = await checkProject(arg); for (const i of r.issues) console.log(`[${i.severity.toUpperCase()}] ${i.code} ${i.file}: ${i.message}`); console.log(`${r.files} files checked; ${r.issues.length} issue(s).`); if (!r.ok) process.exitCode = 1; }
	else if (command === 'analyze') { const r = await analyzeProject(arg); console.table(r.files.slice(0, 25)); console.log(`Total: ${r.total} bytes; gzip: ${r.gzip} bytes`); }
	else if (command === 'create') { console.log(`Created ${await createProject(arg)}`); }
	else if (command === 'prerender') { const r = await prerenderProject(arg, { outDir: flags.out, config: flags.config }); console.log(`Prerendered ${r.routes.length} route(s) -> ${r.out}`); }
	else if (command === 'types') { const r = await generateTypes(arg, { out: flags.out }); console.log(`Generated ${r.routes.length} route and ${r.actions.length} action declaration(s) -> ${r.out}`); }
	else if (command === 'typecheck') { const r = await typecheckProject(arg); for (const i of r.issues) console.log(`[${i.severity.toUpperCase()}] ${i.code} ${i.file}: ${i.message}`); console.log(`${r.files} TypeScript file(s) checked; ${r.issues.length} issue(s).`); if (!r.ok) process.exitCode = 1; }
	else if (command === 'sourcecheck') { const r = await sourcecheck(arg); for (const i of r.issues) console.log(`[ERROR] ${i.code} ${i.file}: ${i.message}`); console.log(`${r.files} TypeScript source file(s) checked; ${r.issues.length} issue(s).`); if (!r.ok) process.exitCode = 1; }
	else if (command === 'image') { const r = await inspectImage(path.resolve(arg)); console.log(JSON.stringify(r, null, 2)); }
	else {
		console.log(`Lithe zero-dependency CLI\n\nCommands:\n  lithe dev <project> [--port=3000]\n  lithe build <project>\n  lithe check <project>\n  lithe analyze <project>\n  lithe create <directory>
  lithe prerender <project> [--out=dist]
  lithe types <project> [--out=lithe.generated.d.ts]
  lithe typecheck <project>
  lithe sourcecheck <repository>
  lithe image <file>`);
	}
} catch (error) { console.error(error.stack || error); process.exitCode = 1; }
