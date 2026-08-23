import { useTodoStore, type TodoFilter } from '../store/todoStore.ts';

export function TodoToolbar({ activeCount, totalCount }: { activeCount: () => number; totalCount: () => number }) {
	const store = useTodoStore.state;
	const { setFilter, setSearch, clearCompleted, toggleAll, undo, redo, canUndo, canRedo } = useTodoStore.getState();

	const filters: Array<{ id: TodoFilter; label: string }> = [
		{ id: 'all', label: 'All' },
		{ id: 'active', label: 'Active' },
		{ id: 'completed', label: 'Completed' }
	];

	return <div class="todo-toolbar">
		<div class="search-row">
			<input
				type="search"
				placeholder="Filter tasks by keyword..."
				value={() => store.search}
				onInput={(e: InputEvent) => setSearch((e.currentTarget as HTMLInputElement).value)}
				class="search-input"
			/>
		</div>

		<div class="toolbar-actions">
			<div class="filter-group">
				{filters.map(f => (
					<button
						key={f.id}
						type="button"
						class={() => `filter-btn ${store.filter === f.id ? 'active' : ''}`}
						onClick={() => setFilter(f.id)}
					>
						{f.label}
					</button>
				))}
			</div>

			<div class="history-group">
				<button
					type="button"
					class="btn-icon"
					disabled={() => !canUndo()}
					onClick={undo}
					title="Undo (History Middleware)"
				>
					↩ Undo
				</button>
				<button
					type="button"
					class="btn-icon"
					disabled={() => !canRedo()}
					onClick={redo}
					title="Redo (History Middleware)"
				>
					↪ Redo
				</button>
			</div>
		</div>

		<div class="toolbar-footer">
			<span class="count-badge">{() => `${activeCount()} active / ${totalCount()} total`}</span>
			<div class="bulk-actions">
				<button type="button" class="link-btn" onClick={() => toggleAll(true)}>Mark all done</button>
				<button type="button" class="link-btn text-danger" onClick={clearCompleted}>Clear completed</button>
			</div>
		</div>
	</div>;
}
