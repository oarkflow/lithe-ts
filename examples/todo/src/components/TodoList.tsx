type Todo = { id: string; title: string; done: boolean };

type TodoListProps = {
	todos: Todo[];
	empty: any;
	onToggle: (todo: Todo, done: boolean) => void;
	onDelete: (todo: Todo) => void;
};

function TodoItem({ todo, onToggle, onDelete }: { key?: string; todo: Todo; onToggle: TodoListProps['onToggle']; onDelete: TodoListProps['onDelete'] }) {
	const toggle = (event: Event) => onToggle(todo, (event.currentTarget as HTMLInputElement).checked);
	const remove = () => onDelete(todo);
	return <li>
		<input type="checkbox" checked={() => todo.done} onChange={toggle} aria-label={`Toggle ${todo.title}`} />
		<span class={() => ({ done: todo.done })}>{todo.title}</span>
		<button onClick={remove} aria-label={`Delete ${todo.title}`}>Delete</button>
	</li>;
}

export function TodoList({ todos, empty, onToggle, onDelete }: TodoListProps) {
	return <ul>{() => todos.length ? todos.map(todo => <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />) : <li>{empty}</li>}</ul>;
}
