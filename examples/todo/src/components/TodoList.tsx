import { state } from 'lithe/core';
import type { Todo } from '../store/todoStore.ts';

function TodoItem({
	todo,
	onToggle,
	onDelete,
	onUpdate
}: {
	key?: string;
	todo: Todo;
	onToggle: (id: string) => void;
	onDelete: (id: string) => void;
	onUpdate: (id: string, title: string) => void;
}) {
	const editing = state({ active: false, title: todo.title });

	function startEdit() {
		editing.active = true;
		editing.title = todo.title;
	}

	function commitEdit() {
		if (!editing.active) return;
		editing.active = false;
		if (editing.title.trim()) {
			onUpdate(todo.id, editing.title.trim());
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitEdit();
		if (e.key === 'Escape') editing.active = false;
	}

	function handleToggle() {
		onToggle(todo.id);
	}

	return <li class={() => `todo-item ${todo.done ? 'is-done' : ''}`}>
		<label class="checkbox-container">
			<input
				type="checkbox"
				checked={() => todo.done}
				onChange={handleToggle}
				aria-label={`Toggle ${todo.title}`}
			/>
			<span class="checkmark"></span>
		</label>

		{() => editing.active ? (
			<input
				type="text"
				class="edit-input"
				value={() => editing.title}
				onInput={(e: InputEvent) => editing.title = (e.currentTarget as HTMLInputElement).value}
				onBlur={commitEdit}
				onKeyDown={handleKeyDown}
				autoFocus
			/>
		) : (
			<span class="todo-title" onDblClick={startEdit} title="Double click to edit">
				{todo.title}
			</span>
		)}

		<div class="item-actions">
			{() => !editing.active ? (
				<button type="button" class="btn-action edit-btn" onClick={startEdit} title="Edit task">
					✏️
				</button>
			) : null}
			<button type="button" class="btn-action delete-btn" onClick={() => onDelete(todo.id)} title="Delete task">
				🗑️
			</button>
		</div>
	</li>;
}

export function TodoList({
	todos,
	empty,
	onToggle,
	onDelete,
	onUpdate
}: {
	todos: Todo[] | (() => Todo[]);
	empty: any;
	onToggle: (id: string) => void;
	onDelete: (id: string) => void;
	onUpdate: (id: string, title: string) => void;
}) {
	const getTodos = typeof todos === 'function' ? todos : () => todos;

	return <ul class="todo-list">
		{() => {
			const list = getTodos();
			return list.length > 0 ? (
				list.map(todo => (
					<TodoItem
						key={todo.id}
						todo={todo}
						onToggle={onToggle}
						onDelete={onDelete}
						onUpdate={onUpdate}
					/>
				))
			) : (
				<li class="empty-state">{empty}</li>
			);
		}}
	</ul>;
}
