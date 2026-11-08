import { createSelector, signal } from '@oarkflow/lithe/core';
import { mount, For } from '@oarkflow/lithe/dom';
import { buildRows, runScenarios, resetIds } from './shared.ts';

globalThis.runBenchmark = async () => {
	resetIds();
	const container = document.getElementById('app');
	if (!container) throw new Error('Benchmark mount element #app was not found');
	container.innerHTML = '';
	const rows = signal([]);
	const selected = signal(null);
	const selectedClass = createSelector(selected, isSelected => isSelected ? 'danger' : '');
	mount(container, <table class="table"><tbody>
		<For each={rows}>{row => {
			return <tr class={selectedClass(row.id)}>
			<td class="col-md-1">{row.id}</td>
			<td class="col-md-4"><a>{row.label}</a></td>
			<td class="col-md-1"><span class="glyphicon glyphicon-remove" /></td>
		</tr>;
		}}</For>
	</tbody></table>);

	return runScenarios({
		create1k() {
			rows.value = buildRows(1000);
		},
		update10th() {
			// Every other framework's app here replaces its whole row array
			// in one state transition for this scenario (React/Solid's
			// setRows(rows.map(...))), which is the idiomatic, fair
			// comparison — 100 separate unbatched index writes would trigger
			// 100 separate O(n) reconciliation passes instead of one, which
			// isn't how a real app would write this in a fine-grained
			// signals framework either.
			rows.value = rows.value.map((row, i) => i % 10 === 0 ? { ...row, label: row.label + ' !!!' } : row);
		},
		selectOne() {
			selected.value = rows.value[500].id;
		},
		swapRows() {
			const next = rows.value.slice();
			const a = next[4]; next[4] = next[998]; next[998] = a;
			rows.value = next;
		},
		removeOne() {
			rows.value = rows.value.filter((_, i) => i !== 500);
		},
		clearAll() {
			rows.value = [];
		}
	});
};
