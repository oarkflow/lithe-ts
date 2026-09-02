import { computed } from '@oarkflow/lithe/core';
import { createForm, object, string } from '@oarkflow/lithe/forms';
import { Link } from '@oarkflow/lithe/router';
import { useTodoStore, type Todo } from '../store/todoStore.ts';
import { Panel } from '../components/Panel.tsx';
import { TodoForm } from '../components/TodoForm.tsx';
import { TodoList } from '../components/TodoList.tsx';
import { TodoToolbar } from '../components/TodoToolbar.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

interface TodoFormValues {
	title: string;
}

export function Home({ i18n }: { i18n: any }) {
	const store = useTodoStore.state;
	const { addTodo, toggleTodo, deleteTodo, updateTodoTitle } = useTodoStore.getState();

	// Reactive filtered view computed with fine-grained signals
	const filteredTodos = computed(() => {
		const list = store.todos;
		const f = store.filter;
		const s = store.search.toLowerCase().trim();

		return list.filter((t: Todo) => {
			if (f === 'active' && t.done) return false;
			if (f === 'completed' && !t.done) return false;
			if (s && !t.title.toLowerCase().includes(s)) return false;
			return true;
		});
	});

	const activeCount = computed(() => store.todos.filter((t: Todo) => !t.done).length);
	const totalCount = computed(() => store.todos.length);

	const form = createForm<TodoFormValues>({
		initial: { title: '' },
		schema: object({
			title: string().refine(val => val.trim().length >= 2)
		}),
		action(values) {
			addTodo(values.title);
			form.reset();
		}
	});

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>{() => i18n.t('title')}</h1>
				<small class="tagline">{() => i18n.t('subtitle')}</small>
			</div>
			<div class="header-nav">
				<Link to="/stats" class="nav-link">📊 Analytics</Link>
				<Link to="/about" class="nav-link">ℹ️ Architecture</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="main-panel">
			<TodoForm form={form} submitLabel={() => i18n.t('add')} />

			<TodoToolbar
				activeCount={() => activeCount.value}
				totalCount={() => totalCount.value}
			/>

			<TodoList
				todos={() => filteredTodos.value}
				empty={() => i18n.t('empty')}
				onToggle={toggleTodo}
				onDelete={deleteTodo}
				onUpdate={updateTodoTitle}
			/>
		</Panel>
	</main>;
}
