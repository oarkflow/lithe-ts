// Shared row-data generator and measurement harness for the real-browser
// framework comparison. Kept identical across every framework's app so the
// only variable between runs is the framework itself.
export const ADJECTIVES = ['pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome', 'plain', 'quaint', 'clean', 'elegant', 'easy', 'fast', 'light'];
export const COLOURS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'white', 'black', 'orange'];
export const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];

let uid = 1;
export function buildRow(startId, i) {
	return {
		id: startId + i,
		label: ADJECTIVES[i % ADJECTIVES.length] + ' ' + COLOURS[i % COLOURS.length] + ' ' + NOUNS[i % NOUNS.length]
	};
}
export function buildRows(count, startId) {
	const start = startId ?? uid;
	uid = start + count;
	const rows = new Array(count);
	for (let i = 0; i < count; i++) rows[i] = buildRow(start, i);
	return rows;
}
export function resetIds() {
	uid = 1;
}

// Runs `scenarios` (an object of name -> sync function) and returns
// { name: elapsedMs } using the High Resolution Time API. Each scenario is
// responsible for leaving the DOM in the state the NEXT scenario expects
// (this mirrors js-framework-benchmark's row-table lifecycle: create ->
// update -> select -> swap -> remove -> clear).
export async function runScenarios(scenarios) {
	const results = {};
	for (const [name, fn] of Object.entries(scenarios)) {
		// Yield to the browser between scenarios so layout/paint from the
		// previous step can't bleed into the next measurement.
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const start = performance.now();
		await fn();
		results[name] = Number((performance.now() - start).toFixed(3));
	}
	return results;
}
