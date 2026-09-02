import { createStore, persist, history } from '@oarkflow/lithe/core';

export type TodoFilter = 'all' | 'active' | 'completed';

export interface Todo {
	id: string;
	title: string;
	done: boolean;
	createdAt: number;
}

export interface TodoState {
	todos: Todo[];
	filter: TodoFilter;
	search: string;
}

export interface TodoActions {
	addTodo(title: string): void;
	toggleTodo(id: string): void;
	deleteTodo(id: string): void;
	updateTodoTitle(id: string, title: string): void;
	setFilter(filter: TodoFilter): void;
	setSearch(search: string): void;
	clearCompleted(): void;
	toggleAll(done: boolean): void;
}

export const useTodoStore = createStore(
	persist(
		history<TodoState, TodoActions>((set) => ({
			todos: [
				{ id: '1', title: 'Try Lithe fine-grained signal reactivity', done: true, createdAt: Date.now() - 100000 },
				{ id: '2', title: 'Test undo / redo with history middleware', done: false, createdAt: Date.now() - 50000 },
				{ id: '3', title: 'Inspect the zero-dependency bundle size', done: false, createdAt: Date.now() }
			],
			filter: 'all',
			search: '',

			addTodo(title: string) {
				const trimmed = title.trim();
				if (!trimmed) return;
				set(state => ({
					todos: [
						{ id: crypto.randomUUID(), title: trimmed, done: false, createdAt: Date.now() },
						...state.todos
					]
				}), 'todo/add');
			},

			toggleTodo(id: string) {
				set(state => {
					const todo = state.todos.find(t => t.id === id);
					if (todo) todo.done = !todo.done;
				}, 'todo/toggle');
			},

			deleteTodo(id: string) {
				set(state => ({
					todos: state.todos.filter(t => t.id !== id)
				}), 'todo/delete');
			},

			updateTodoTitle(id: string, title: string) {
				const trimmed = title.trim();
				if (!trimmed) return;
				set(state => ({
					todos: state.todos.map(t => t.id === id ? { ...t, title: trimmed } : t)
				}), 'todo/update');
			},

			setFilter(filter: TodoFilter) {
				set({ filter }, 'todo/setFilter');
			},

			setSearch(search: string) {
				set({ search }, 'todo/setSearch');
			},

			clearCompleted() {
				set(state => ({
					todos: state.todos.filter(t => !t.done)
				}), 'todo/clearCompleted');
			},

			toggleAll(done: boolean) {
				set(state => ({
					todos: state.todos.map(t => ({ ...t, done }))
				}), 'todo/toggleAll');
			}
		})),
		{
			name: 'lithe-todo-store',
			partialize: (state) => ({ todos: state.todos, filter: state.filter })
		}
	)
);
