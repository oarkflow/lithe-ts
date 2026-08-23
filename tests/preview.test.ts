import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildProject } from '../tools/build.ts';
import { previewProject } from '../tools/preview.ts';

test('preview server serves built dist with correct MIME types, versioned cache headers and SPA routing', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-preview-'));
	try {
		await fs.mkdir(path.join(root, 'src'), { recursive: true });
		await fs.mkdir(path.join(root, 'public'), { recursive: true });
		await fs.writeFile(path.join(root, 'public', 'index.html'), '<!doctype html><link rel="stylesheet" href="/app.css"><div id="app"></div><script type="module" src="/src/main.jsx"></script>');
		await fs.writeFile(path.join(root, 'public', 'app.css'), '.title{color:blue}');
		await fs.writeFile(path.join(root, 'src', 'main.jsx'), `import { mount } from '@lithe/dom'; mount(document.getElementById('app'), <h1 className="title">Preview</h1>);`);

		await buildProject(root, { bundle: 'single', assetVersion: true, sourceMaps: false, enforceBudgets: false });

		const { server, url } = await previewProject(root, { port: 0 });
		try {
			const htmlRes = await fetch(url + '/');
			assert.equal(htmlRes.status, 200);
			assert.equal(htmlRes.headers.get('content-type'), 'text/html; charset=utf-8');
			const html = await htmlRes.text();
			assert.match(html, /href="\/app\.css\?v=[0-9a-f]+"/);
			assert.match(html, /src="\/app\.js\?v=[0-9a-f]+"/);

			const cssMatch = html.match(/href="([^"]+)"/);
			assert.ok(cssMatch);
			const cssRes = await fetch(url + cssMatch[1]);
			assert.equal(cssRes.status, 200);
			assert.equal(cssRes.headers.get('content-type'), 'text/css; charset=utf-8');
			assert.match(cssRes.headers.get('cache-control') || '', /immutable/);
			assert.match(await cssRes.text(), /\.title\{color:blue\}/);

			const jsMatch = html.match(/src="([^"]+)"/);
			assert.ok(jsMatch);
			const jsRes = await fetch(url + jsMatch[1]);
			assert.equal(jsRes.status, 200);
			assert.equal(jsRes.headers.get('content-type'), 'text/javascript; charset=utf-8');
			assert.match(jsRes.headers.get('cache-control') || '', /immutable/);

			const spaRes = await fetch(url + '/unknown/route');
			assert.equal(spaRes.status, 200);
			assert.match(await spaRes.text(), /<div id="app"><\/div>/);
		} finally {
			server.close();
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
