import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exists } from './shared.ts';

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.map': 'application/json; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf'
};

function safe(root: string, pathname: string): string | null {
	const p = path.resolve(root, '.' + pathname);
	return p.startsWith(path.resolve(root)) ? p : null;
}

export async function previewProject(projectDir: string, options: { port?: number | string; host?: string; outDir?: string } = {}) {
	const root = path.resolve(projectDir);
	const distDir = path.resolve(root, options.outDir || 'dist');
	if (!await exists(distDir)) {
		throw new Error(`Build output directory not found: ${distDir}. Run "lithe build" first.`);
	}
	const port = Number(options.port ?? 4173);

	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
			let file = safe(distDir, url.pathname === '/' ? '/index.html' : url.pathname);
			if (!file || !await exists(file) || (await fs.stat(file)).isDirectory()) {
				file = path.join(distDir, 'index.html');
				if (!await exists(file)) {
					res.writeHead(404, { 'content-type': 'text/plain' });
					res.end('Not Found');
					return;
				}
			}
			const data = await fs.readFile(file);
			const ext = path.extname(file);
			const isVersioned = url.searchParams.has('v');
			res.writeHead(200, {
				'content-type': types[ext] || 'application/octet-stream',
				'cache-control': isVersioned ? 'public, max-age=31536000, immutable' : 'no-cache'
			});
			res.end(data);
		} catch (error: any) {
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.end(error.stack || String(error));
		}
	});

	let actualPort = port;
	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const onError = (error: any) => { server.off('listening', resolve); reject(error); };
				server.once('error', onError);
				server.listen(actualPort, options.host || '127.0.0.1', () => { server.off('error', onError); resolve(); });
			});
			break;
		} catch (error: any) {
			if (error?.code !== 'EADDRINUSE' || port === 0 || attempt === 19) throw error;
			actualPort++;
		}
	}
	const address = server.address();
	actualPort = typeof address === 'object' && address ? address.port : actualPort;
	return { server, url: `http://${options.host || '127.0.0.1'}:${actualPort}`, distDir };
}
