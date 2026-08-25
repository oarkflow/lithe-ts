import fs from 'node:fs/promises';
import path from 'node:path';

export async function createProject(dir: string): Promise<string> {
	const root = path.resolve(dir);
	await fs.mkdir(path.join(root, 'src'), { recursive: true });
	await fs.mkdir(path.join(root, 'public'), { recursive: true });

	await fs.writeFile(
		path.join(root, 'package.json'),
		JSON.stringify({
			name: path.basename(root),
			private: true,
			type: 'module',
			scripts: {
				dev: 'lithe dev .',
				build: 'lithe build .',
				check: 'lithe check .',
				typecheck: 'lithe typecheck .'
			}
		}, null, 2)
	);

	await fs.writeFile(
		path.join(root, 'public/index.html'),
		'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lithe App</title></head><body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body></html>'
	);

	await fs.writeFile(
		path.join(root, 'src/main.tsx'),
		`import { signal, h, mount } from '@lithe/runtime';\nconst count=signal<number>(0);\nfunction App(){ return <main><h1>Lithe</h1><button onClick={()=>count.value++}>Count: {count}</button></main>; }\nmount(document.getElementById('app'), <App/>);\n`
	);

	return root;
}
