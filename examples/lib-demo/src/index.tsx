import { signal, computed, createRoot } from '@oarkflow/lithe';

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

createRoot(document.getElementById('app')!).render(<App />);
