import { Link } from '@oarkflow/lithe/router';
import { useTodoStore } from '../store/todoStore.ts';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

export function DevTools() {
	const stateSnapshot = useTodoStore(s => s);
	const { undo, redo, canUndo, canRedo, reset } = useTodoStore.getState();

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>🛠️ Store DevTools & Time-Travel</h1>
				<small class="tagline">Live state inspector and undo/redo snapshot visualizer</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/stats" class="nav-link">📊 Analytics</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="devtools-panel">
			<div class="devtools-controls">
				<div class="btn-group">
					<button
						type="button"
						class="btn btn-sm btn-outline"
						disabled={() => !canUndo()}
						onClick={undo}
					>
						⏮️ Undo Snapshot
					</button>
					<button
						type="button"
						class="btn btn-sm btn-outline"
						disabled={() => !canRedo()}
						onClick={redo}
					>
						⏭️ Redo Snapshot
					</button>
					<button
						type="button"
						class="btn btn-sm text-danger btn-outline"
						onClick={reset}
					>
						🔄 Reset Store
					</button>
				</div>
				<span class="status-pill">
					{() => `canUndo: ${canUndo()} | canRedo: ${canRedo()}`}
				</span>
			</div>

			<h2>Current Reactive Store JSON:</h2>
			<pre class="json-viewer">
				{() => JSON.stringify(
					{
						filter: stateSnapshot.filter,
						search: stateSnapshot.search,
						todos: stateSnapshot.todos
					},
					null,
					2
				)}
			</pre>
		</Panel>
	</main>;
}
