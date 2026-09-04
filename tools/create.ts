import fs from 'node:fs/promises';
import path from 'node:path';

export async function createProject(dir: string): Promise<string> {
	const root = path.resolve(dir);
	const frameworkPackage = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
	await fs.mkdir(path.join(root, 'src'), { recursive: true });

	await fs.writeFile(
		path.join(root, 'package.json'),
		JSON.stringify({
			name: path.basename(root),
			private: true,
			type: 'module',
			dependencies: {
				'@oarkflow/lithe': `^${frameworkPackage.version}`
			},
			scripts: {
				dev: 'lithe dev .',
				build: 'lithe build .',
				check: 'lithe check .',
				typecheck: 'lithe typecheck .'
			}
		}, null, 2)
	);

	await fs.writeFile(
		path.join(root, 'index.html'),
		'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lithe App</title></head><body><div id="app"></div><script type="module" src="/src/index.tsx"></script></body></html>'
	);

	await fs.writeFile(
		path.join(root, 'src/index.tsx'),
		`import { signal, mount } from '@oarkflow/lithe';\nconst count=signal<number>(0);\nfunction App(){ return <main><h1>Lithe</h1><button onClick={()=>count.value++}>Count: {count}</button></main>; }\nmount(document.getElementById('app')!, <App/>);\n`
	);

	return root;
}
