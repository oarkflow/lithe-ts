import { signal, computed } from '@oarkflow/lithe/core';
import { mount } from '@oarkflow/lithe/dom';

const count = signal<number>(0, { name: 'count' });
const doubled = computed(() => count.value * 2);

function Counter() {
	return <button onClick={() => count.value++}>
		Count: {count} / doubled: {doubled}
	</button>;
}

function App() {
	return <main>
		<h1>Lithe Library Demo</h1>
		<p>Installed and imported from <code>@oarkflow/lithe</code>.</p>
		<Counter />
	</main>;
}

mount(document.getElementById('app')!, <App />);
