import h from 'solid-js/h';
import { render } from 'solid-js/web';
import { createSignal, createRoot, For } from 'solid-js';
import { buildRows, runScenarios, resetIds } from './shared.ts';

// No JSX here: Solid's actual compiler (babel-preset-solid) is a build-time
// dependency this benchmark harness doesn't wire up, so this uses Solid's
// own official JSX-free hyperscript (`solid-js/h`) instead. It still runs
// through the real `solid-js`/`solid-js/web` reactivity and DOM-insertion
// code paths a compiled app would use — only the authoring syntax differs.
function Row(row, selected) {
	return h('tr', { classList: () => ({ danger: row.id === selected() }) },
		h('td', { class: 'col-md-1' }, () => row.id),
		h('td', { class: 'col-md-4' }, h('a', {}, () => row.label)),
		h('td', { class: 'col-md-1' }, h('span', { class: 'glyphicon glyphicon-remove' }))
	)();
}

window.runBenchmark = async () => {
	resetIds();
	const container = document.getElementById('app');
	container.innerHTML = '';
	let rows, setRows, selected, setSelected, dispose;

	await new Promise(resolve => {
		dispose = createRoot(disposeFn => {
			[rows, setRows] = createSignal([]);
			[selected, setSelected] = createSignal(null);
			render(() => h(For, { each: rows }, row => Row(row, selected))(), container);
			resolve();
			return disposeFn;
		});
	});

	try {
		return await runScenarios({
			create1k() {
				setRows(buildRows(1000));
			},
			update10th() {
				setRows(rows().map((row, i) => i % 10 === 0 ? { ...row, label: row.label + ' !!!' } : row));
			},
			selectOne() {
				setSelected(rows()[500].id);
			},
			swapRows() {
				const copy = rows().slice();
				const tmp = copy[4]; copy[4] = copy[998]; copy[998] = tmp;
				setRows(copy);
			},
			removeOne() {
				setRows(rows().filter((_, i) => i !== 500));
			},
			clearAll() {
				setRows([]);
			}
		});
	} finally {
		dispose();
	}
};
