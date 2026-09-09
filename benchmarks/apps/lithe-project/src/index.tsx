import { state, signal, batch } from '@oarkflow/lithe/core';
import { mount, For } from '@oarkflow/lithe/dom';
import { buildRows, runScenarios, resetIds } from './shared.ts';

(globalThis as any).runBenchmark = async () => {
	resetIds();
	const container = document.getElementById('app')!;
	container.innerHTML = '';
	const rows = state<{ id: number; label: string }[]>([]);
	const selected = signal<number | null>(null);
	mount(container, <table class="table"><tbody>
		<For each={rows}>{(row: any) => <tr class={() => row.id === selected.value ? 'danger' : ''}>
			<td class="col-md-1">{row.id}</td>
			<td class="col-md-4"><a>{row.label}</a></td>
			<td class="col-md-1"><span class="glyphicon glyphicon-remove" /></td>
		</tr>}</For>
	</tbody></table>);

	return runScenarios({
		create1k() {
			rows.splice(0, rows.length, ...buildRows(1000));
		},
		update10th() {
			// Every other framework's app here replaces its whole row array
			// in one state transition for this scenario (React/Solid's
			// setRows(rows.map(...))), which is the idiomatic, fair
			// comparison — 100 separate unbatched index writes would trigger
			// 100 separate O(n) reconciliation passes instead of one, which
			// isn't how a real app would write this in a fine-grained
			// signals framework either.
			batch(() => {
				for (let i = 0; i < rows.length; i += 10) rows[i] = { ...rows[i], label: rows[i].label + ' !!!' };
			});
		},
		selectOne() {
			selected.value = rows[500].id;
		},
		swapRows() {
			batch(() => {
				const a = rows[4], b = rows[998];
				rows[4] = b; rows[998] = a;
			});
		},
		removeOne() {
			rows.splice(500, 1);
		},
		clearAll() {
			rows.splice(0, rows.length);
		}
	});
};
