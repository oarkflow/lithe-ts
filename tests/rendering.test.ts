import test from 'node:test';
import assert from 'node:assert/strict';

async function withDOM(t: any) {
	try {
		const { Window } = await import('../benchmarks/node_modules/happy-dom/lib/index.js');
		const window = new Window({ url: 'http://localhost/' });
		const previous = {
			window: globalThis.window,
			document: globalThis.document,
			Node: globalThis.Node,
			Element: globalThis.Element,
			Event: globalThis.Event
		};
		globalThis.window = window as any;
		globalThis.document = window.document as any;
		globalThis.Node = window.Node as any;
		globalThis.Element = window.Element as any;
		globalThis.Event = window.Event as any;
		t.after(() => {
			globalThis.window = previous.window;
			globalThis.document = previous.document;
			globalThis.Node = previous.Node;
			globalThis.Element = previous.Element;
			globalThis.Event = previous.Event;
		});
		return window;
	} catch {
		t.skip('happy-dom is not installed in this workspace');
		return null;
	}
}

test('signal updates patch DOM bindings without rerunning components or remounting nodes', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ signal }, { mount, compiledElement }, { h }] = await Promise.all([
		import('../src/core/reactive.ts'),
		import('../src/dom/dom.ts'),
		import('../src/dom/vnode.ts')
	]);

	const count = signal(0);
	const label = signal('ready');
	let appRuns = 0;
	let childRuns = 0;

	function Child() {
		childRuns++;
		return compiledElement('button', {
			class: () => `count-${count.value}`,
			title: () => label.value
		}, [() => `Count ${count.value}`]);
	}

	function App() {
		appRuns++;
		return compiledElement('main', null, [h(Child, null)]);
	}

	const root = document.createElement('div');
	document.body.append(root);
	const dispose = mount(root, h(App, null));
	const button = root.querySelector('button')!;

	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.className, 'count-0');
	assert.equal(button.textContent, 'Count 0');

	count.value = 1;
	assert.equal(root.querySelector('button'), button);
	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.className, 'count-1');
	assert.equal(button.textContent, 'Count 1');

	label.value = 'updated';
	assert.equal(root.querySelector('button'), button);
	assert.equal(appRuns, 1);
	assert.equal(childRuns, 1);
	assert.equal(button.title, 'updated');

	dispose();
});
