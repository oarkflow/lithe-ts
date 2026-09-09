import { buildRows, runScenarios, resetIds } from './shared.ts';

function renderRow(row) {
	const tr = document.createElement('tr');
	tr.dataset.id = row.id;
	const tdId = document.createElement('td');
	tdId.className = 'col-md-1';
	tdId.textContent = String(row.id);
	const tdLabel = document.createElement('td');
	tdLabel.className = 'col-md-4';
	const a = document.createElement('a');
	a.textContent = row.label;
	tdLabel.appendChild(a);
	const tdRemove = document.createElement('td');
	tdRemove.className = 'col-md-1';
	const span = document.createElement('span');
	span.className = 'glyphicon glyphicon-remove';
	tdRemove.appendChild(span);
	tr.append(tdId, tdLabel, tdRemove);
	return tr;
}

window.runBenchmark = async () => {
	resetIds();
	const app = document.getElementById('app');
	app.innerHTML = '<table class="table"><tbody></tbody></table>';
	const tbody = app.querySelector('tbody');
	let rows = [];

	return runScenarios({
		create1k() {
			rows = buildRows(1000);
			const frag = document.createDocumentFragment();
			for (const row of rows) frag.appendChild(renderRow(row));
			tbody.textContent = '';
			tbody.appendChild(frag);
		},
		update10th() {
			const trs = tbody.children;
			for (let i = 0; i < rows.length; i += 10) {
				rows[i] = { ...rows[i], label: rows[i].label + ' !!!' };
				trs[i].children[1].firstChild.textContent = rows[i].label;
			}
		},
		selectOne() {
			tbody.children[500].classList.add('danger');
		},
		swapRows() {
			const a = tbody.children[4], b = tbody.children[998], after = b.nextSibling;
			tbody.insertBefore(b, a);
			tbody.insertBefore(a, after);
			const tmp = rows[4]; rows[4] = rows[998]; rows[998] = tmp;
		},
		removeOne() {
			tbody.children[500].remove();
			rows.splice(500, 1);
		},
		clearAll() {
			tbody.textContent = '';
			rows = [];
		}
	});
};
