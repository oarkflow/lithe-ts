import test from 'node:test';
import assert from 'node:assert/strict';
import { litheVitePlugin, litheRollupPlugin, litheBabelPlugin } from '../src/plugins/index.ts';

test('litheVitePlugin transforms JSX and TSX modules', async () => {
	const plugin = litheVitePlugin();
	assert.equal(plugin.name, 'lithe-vite-plugin');
	assert.equal(plugin.enforce, 'pre');

	const config = plugin.config();
	assert.ok(config.esbuild);

	const tsxSource = `
		import { signal } from 'lithe/core';
		export function Counter() {
			const count = signal(0);
			return <button onClick={() => count.value++}>Count: {count.value}</button>;
		}
	`;

	const result = plugin.transform(tsxSource, '/app/src/Counter.tsx');
	assert.ok(result);
	assert.ok(result.code.includes('compiledElement("button"'));
	assert.ok(result.code.includes('import { h, Fragment } from "lithe/dom"'));
});

test('litheRollupPlugin transforms JSX with sourcemaps', async () => {
	const plugin = litheRollupPlugin();
	assert.equal(plugin.name, 'lithe-rollup-plugin');

	const jsxSource = `
		export function Header({ title }) {
			return <header><h1>{title}</h1></header>;
		}
	`;

	const result = plugin.transform(jsxSource, '/app/src/Header.jsx');
	assert.ok(result);
	assert.ok(result.code.includes('compiledElement("header"'));
	assert.ok(result.map);
});

test('litheBabelPlugin supports standalone transform method', async () => {
	const plugin = litheBabelPlugin();
	assert.equal(plugin.name, 'babel-plugin-lithe');
	assert.ok(plugin.visitor.Program);

	const source = `
		import { state } from 'lithe/core';
		export const App = () => <div><span>Hello Lithe</span></div>;
	`;

	const res = plugin.transform(source, 'App.tsx');
	assert.ok(res.code.includes('staticTemplate("<div><span>Hello Lithe</span></div>")'));
});

test('litheTailwindPlugin compiles utility classes and injects style tags', async () => {
	const { litheTailwindPlugin, compileTailwind } = await import('../src/plugins/tailwind.ts');
	const plugin = litheTailwindPlugin();
	assert.equal(plugin.name, 'lithe-tailwind-plugin');

	const compiled = await compileTailwind('@tailwind utilities;', { projectRoot: process.cwd() });
	assert.ok(typeof compiled === 'string');
	assert.ok(compiled.includes('.p-6') || compiled.includes('display: flex'));

	const html = plugin.transformIndexHtml('<html><head><title>App</title></head><body></body></html>', '.test { color: red; }');
	assert.ok(html.includes('<style data-lithe-tailwind>'));
	assert.ok(html.includes('.test { color: red; }'));
});

