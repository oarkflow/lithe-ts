import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { buildRows, runScenarios, resetIds } from './shared.ts';

function Row({ row, selected }) {
	return (
		<tr className={selected ? 'danger' : ''}>
			<td className="col-md-1">{row.id}</td>
			<td className="col-md-4"><a>{row.label}</a></td>
			<td className="col-md-1"><span className="glyphicon glyphicon-remove" /></td>
		</tr>
	);
}

function Table({ rows, selected }) {
	return (
		<table className="table">
			<tbody>
				{rows.map(row => <Row key={row.id} row={row} selected={row.id === selected} />)}
			</tbody>
		</table>
	);
}

window.runBenchmark = async () => {
	resetIds();
	const container = document.getElementById('app');
	container.innerHTML = '';
	const root = createRoot(container);
	let rows = [];
	let selected = null;
	const render = () => flushSync(() => root.render(<Table rows={rows} selected={selected} />));

	return runScenarios({
		create1k() {
			rows = buildRows(1000);
			render();
		},
		update10th() {
			rows = rows.map((row, i) => i % 10 === 0 ? { ...row, label: row.label + ' !!!' } : row);
			render();
		},
		selectOne() {
			selected = rows[500].id;
			render();
		},
		swapRows() {
			const copy = rows.slice();
			const tmp = copy[4]; copy[4] = copy[998]; copy[998] = tmp;
			rows = copy;
			render();
		},
		removeOne() {
			rows = rows.filter((_, i) => i !== 500);
			render();
		},
		clearAll() {
			rows = [];
			render();
		}
	});
};
