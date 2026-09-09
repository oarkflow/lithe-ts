import test from 'node:test';
import assert from 'node:assert/strict';
import { object, string, array, email, url } from '../src/forms/schema.ts';
import { toJSONSchema } from '../src/forms/emit.ts';
import { createAdvancedForm } from '../src/forms/advanced.ts';

async function withDOM(t: any) {
	try {
		const { Window } = await import('../benchmarks/node_modules/happy-dom/lib/index.js');
		const window = new Window({ url: 'http://localhost/' });
		const previous = { window: globalThis.window, document: globalThis.document, Node: globalThis.Node, HTMLElement: (globalThis as any).HTMLElement, Text: globalThis.Text, Event: globalThis.Event };
		globalThis.window = window as any;
		globalThis.document = window.document as any;
		globalThis.Node = window.Node as any;
		(globalThis as any).HTMLElement = window.HTMLElement;
		globalThis.Text = window.Text as any;
		globalThis.Event = window.Event as any;
		t.after(() => Object.assign(globalThis, previous));
		return window;
	} catch {
		t.skip('happy-dom is not installed in this workspace');
		return null;
	}
}

test('email()/url() tag their format in meta and JSON Schema emission', () => {
	const schema = object({ contact: email(), site: url() });
	assert.equal(schema.meta.shape.contact.meta.format, 'email');
	assert.equal(schema.meta.shape.site.meta.format, 'url');
	const json = toJSONSchema(schema);
	assert.equal(json.properties.contact.format, 'email');
	assert.equal(json.properties.site.format, 'uri');
});

test('AutoForm renders the right input type, a unique id, and a matching <label for>', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { AutoForm }] = await Promise.all([import('../src/dom/dom.ts'), import('../src/forms/auto.ts')]);
	const schema = object({ name: string().min(2), contact: email() });
	const root = document.createElement('div');
	mount(root, AutoForm({ schema, initial: { name: '', contact: '' } }));
	const contactInput = root.querySelector('input[name="contact"]') as HTMLInputElement;
	assert.equal(contactInput.type, 'email');
	assert.ok(contactInput.id, 'input must have a generated id');
	const label = root.querySelector(`label[for="${contactInput.id}"]`);
	assert.ok(label, 'label must reference the input by id');
});

test('AutoForm wires aria-invalid/aria-describedby to the visible error once validation fails', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { AutoForm }] = await Promise.all([import('../src/dom/dom.ts'), import('../src/forms/auto.ts')]);
	const schema = object({ name: string().min(2) });
	const form = createAdvancedForm({ schema, initial: { name: '' } });
	const root = document.createElement('div');
	mount(root, AutoForm({ schema, form }));
	const input = root.querySelector('input[name="name"]') as HTMLInputElement;
	assert.equal(input.getAttribute('aria-invalid'), null, 'must not be marked invalid before any validation runs');
	await form.submit();
	assert.equal(input.getAttribute('aria-invalid'), 'true');
	const describedBy = input.getAttribute('aria-describedby');
	assert.ok(describedBy);
	const errorEl = root.querySelector(`#${describedBy}`);
	assert.ok(errorEl, 'aria-describedby must point at an element that actually exists');
	assert.equal(errorEl!.getAttribute('role'), 'alert');
});

test('AutoForm renders array-typed schema fields as an addable/removable field array', async t => {
	const window = await withDOM(t);
	if (!window) return;
	const [{ mount }, { AutoForm }] = await Promise.all([import('../src/dom/dom.ts'), import('../src/forms/auto.ts')]);
	const schema = object({ tags: array(string()) });
	const form = createAdvancedForm({ schema, initial: { tags: ['a'] } });
	const root = document.createElement('div');
	mount(root, AutoForm({ schema, form }));
	assert.equal(root.querySelectorAll('.lithe-field-array-item').length, 1);
	const addButton = [...root.querySelectorAll('button')].find(b => b.textContent === 'Add')!;
	addButton.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
	assert.equal(root.querySelectorAll('.lithe-field-array-item').length, 2);
	assert.deepEqual((form.values as any).tags, ['a', '']);
	const removeButton = [...root.querySelectorAll('button')].find(b => b.textContent === 'Remove')!;
	removeButton.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
	assert.deepEqual((form.values as any).tags, ['']);
});
