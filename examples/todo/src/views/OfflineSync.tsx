import { signal, state, computed, onCleanup } from '@oarkflow/lithe/core';
import { createNetworkState, createMutationQueue } from '@oarkflow/lithe/offline';
import { syncedCollection } from '@oarkflow/lithe/sync';
import { Link } from '@oarkflow/lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

// Create instances outside component to avoid re-creation on render
const network = createNetworkState();
const queue = createMutationQueue('lithe:demo:queue');

const todos = syncedCollection('demo-todos', {
	initial: [
		{ id: '1', text: 'Try offline-first architecture', done: true },
		{ id: '2', text: 'Test mutation queue persistence', done: false },
		{ id: '3', text: 'Simulate network disconnect', done: false }
	],
	autoSync: false,
	sync: async (pending) => {
		await new Promise(r => setTimeout(r, 500));
		return {};
	}
});

export function OfflineSync() {
	const draft = state({ input: '' });
	const queueLog = signal<Array<{ time: string; action: string; id: string }>>([]);

	// Start network listener once, cleanup on dispose
	const stopNetwork = network.start();
	onCleanup(stopNetwork);

	function addTodo(e: Event) {
		e.preventDefault();
		if (draft.input.trim()) {
			const item = todos.insert({ id: crypto.randomUUID(), text: draft.input.trim(), done: false });
			queueLog.value = [
				{ time: new Date().toLocaleTimeString(), action: 'insert', id: item?.id || 'unknown' },
				...queueLog.value.slice(0, 9)
			];
			draft.input = '';
		}
	}

	function toggleTodo(id: string) {
		const item = todos.get(id);
		if (item) {
			todos.update(id, { done: !item.done });
			queueLog.value = [
				{ time: new Date().toLocaleTimeString(), action: 'toggle', id },
				...queueLog.value.slice(0, 9)
			];
		}
	}

	function deleteTodo(id: string) {
		todos.delete(id);
		queueLog.value = [
			{ time: new Date().toLocaleTimeString(), action: 'delete', id },
			...queueLog.value.slice(0, 9)
		];
	}

	async function flushQueue() {
		await queue.flush(async (item) => {
			await new Promise(r => setTimeout(r, 200));
			queueLog.value = [
				{ time: new Date().toLocaleTimeString(), action: 'flushed', id: item.id },
				...queueLog.value.slice(0, 9)
			];
		});
	}

	const pendingCount = computed(() => todos.pending.length);
	const collectionStatus = computed(() => todos.status.value);

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>📴 Offline-First & Sync</h1>
				<small class="tagline">Demonstrating <code>createNetworkState</code>, <code>createMutationQueue</code>, and <code>syncedCollection</code></small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/remote" class="nav-link">☁️ Remote</Link>
				<ThemeToggle />
			</div>
		</header>

		<div class="offline-grid">
			<Panel className="status-card">
				<h2>🌐 Network Status</h2>
				<div class="network-status">
					<div class="status-row">
						<span class="status-label">Connection:</span>
						<span class={() => `status-value ${network.online.value ? 'text-success' : 'text-danger'}`}>
							{() => network.online.value ? '🟢 Online' : '🔴 Offline'}
						</span>
					</div>
					<div class="status-row">
						<span class="status-label">Effective Type:</span>
						<span class="status-value">{() => network.effectiveType.value}</span>
					</div>
					<div class="status-row">
						<span class="status-label">Save Data:</span>
						<span class={() => `status-value ${network.saveData.value ? 'text-warning' : ''}`}>
							{() => network.saveData.value ? '⚠️ Enabled' : '✅ Disabled'}
						</span>
					</div>
				</div>
			</Panel>

			<Panel className="status-card">
				<h2>🔄 Sync Status</h2>
				<div class="sync-status">
					<div class="status-row">
						<span class="status-label">Collection Status:</span>
						<span class={() => `status-value status-${collectionStatus.value}`}>
							{() => collectionStatus.value}
						</span>
					</div>
					<div class="status-row">
						<span class="status-label">Pending Operations:</span>
						<span class="status-value">{() => pendingCount.value}</span>
					</div>
				</div>
				<div class="action-row">
					<button type="button" class="btn btn-sm btn-outline" onClick={() => todos.sync()}>
						🔄 Force Sync
					</button>
					<button type="button" class="btn btn-sm btn-outline" onClick={flushQueue}>
						📤 Flush Queue
					</button>
				</div>
			</Panel>

			<Panel className="todo-card">
				<h2>📝 Synced Todo List</h2>
				<form onSubmit={addTodo} class="row todo-form">
					<input
						type="text"
						placeholder="Add a synced task..."
						value={() => draft.input}
						onInput={(e: InputEvent) => draft.input = (e.currentTarget as HTMLInputElement).value}
						class="input-main"
					/>
					<button type="submit" class="btn btn-primary">Add</button>
				</form>

				<ul class="todo-list">
					{() => todos.toJSON().map((item: any) => (
						<li key={item.id} class={`todo-item ${item.done ? 'is-done' : ''}`}>
							<input
								type="checkbox"
								checked={() => item.done}
								onChange={() => toggleTodo(item.id)}
							/>
							<span class="todo-title">{item.text}</span>
							<button type="button" class="btn-delete-sm" onClick={() => deleteTodo(item.id)}>×</button>
						</li>
					))}
				</ul>
			</Panel>

			<Panel className="log-card">
				<h2>📋 Operation Log</h2>
				<div class="operation-log">
					{() => queueLog.value.length > 0 ? (
						queueLog.value.map((entry, i) => (
							<div key={i} class="log-entry">
								<span class="log-time">{entry.time}</span>
								<span class={`log-action action-${entry.action}`}>{entry.action}</span>
								<span class="log-id">{entry.id.slice(0, 8)}...</span>
							</div>
						))
					) : (
						<div class="empty-log">No operations yet.</div>
					)}
				</div>
			</Panel>
		</div>
	</main>;
}
