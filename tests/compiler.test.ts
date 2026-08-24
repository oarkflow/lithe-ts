import test from 'node:test';
import assert from 'node:assert/strict';
import { transformJSX, compileModule } from '../src/compiler/jsx.ts';
import { semanticTypecheck } from '../src/compiler/typecheck.ts';

test('JSX compiler transforms elements, components, fragments and expressions', () => {
	const source = `const x=<><div class="x">Hello {name}</div><Card value={count}/></>;`;
	const out = transformJSX(source);
	assert.match(out, /h\(Fragment/); assert.match(out, /(?:h\("div"|compiledTemplate\()/); assert.match(out, /h\(Card/); assert.match(out, /\(name\)/);
});

test('module compiler injects runtime when JSX exists', () => {
	const out = compileModule(`export default function A(){return <div/>}`, { runtimeImport: '@lithe/dom' }).code;
	assert.match(out, /import \{ h, Fragment \}/); assert.match(out, /staticTemplate\("<div><\/div>"\)/);
});


test('member components are never compiled as native elements', () => {
	const out = compileModule(`mount(root, <router.View/>);`, { runtimeImport: '@lithe/dom' }).code;
	assert.match(out, /h\(router\.View/);
	assert.doesNotMatch(out, /<router\.View|staticTemplate\([^)]*router\.View/);
});

test('compiled native templates preserve dynamic JSX child functions', () => {
	const out = transformJSX(`<h1>{() => i18n.t('title')}</h1>`);
	assert.match(out, /compiledTemplate\([^\n]+\[\(\(\) => i18n\.t\('title'\)\)\]\)/);
	assert.doesNotMatch(out, /\[\(\(\) => \(\(\) =>/);
});

test('semantic typecheck reports unsupported advanced TypeScript as warnings', () => {
	const result = semanticTypecheck('type Maybe<T> = T extends string ? T : never; type K = keyof Maybe<string>;', { filename: 'advanced.ts' });
	assert.equal(result.ok, true);
	assert.ok(result.issues.some(x => x.code === 'TS_UNSUPPORTED_CONDITIONAL' && x.severity === 'warning'));
	assert.ok(result.issues.some(x => x.code === 'TS_UNSUPPORTED_KEYOF' && x.severity === 'warning'));
});
