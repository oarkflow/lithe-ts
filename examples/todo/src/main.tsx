import { state, computed } from 'lithe/core';
import { mount } from 'lithe/dom';
import { createForm, object, string } from 'lithe/forms';
import { createRouter, Link, group } from 'lithe/router';
import { createI18n } from 'lithe/i18n';
import { defineTheme } from 'lithe/style';
import { Panel } from './components/Panel.tsx';
import { TodoForm } from './components/TodoForm.tsx';
import { TodoList } from './components/TodoList.tsx';

type Todo = { id: string; title: string; done: boolean };
type TodoForm = { title: string };

defineTheme({ color: { accent: '#6f5cff' }, radius: { card: '14px' } });

const i18n = createI18n({
	locale: 'en',
	messages: { en: { title: 'Lithe Zero', add: 'Add task', empty: 'No tasks yet.' } }
});

const todos = state<Todo[]>([
	{ id: crypto.randomUUID(), title: 'Inspect the reactive graph', done: false },
	{ id: crypto.randomUUID(), title: 'Build without npm dependencies', done: true }
]);
const remaining = computed(() => todos.filter(x => !x.done).length);

const form = createForm<TodoForm>({
	initial: { title: '' },
	schema: object({ title: string().refine(value => value.length >= 2) }),
	action(values) {
		todos.push({ id: crypto.randomUUID(), title: values.title, done: false });
		form.reset();
	}
});

function Home() {
	return <main>
		<header>
			<div><h1>{() => i18n.t('title')}</h1><small>Zero dependencies · direct DOM · fine-grained reactivity</small></div>
			<Link to="/about">About</Link>
		</header>
		<Panel>
			<TodoForm form={form} submitLabel={() => i18n.t('add')} />
			<small>{() => form.errors.title || `${remaining.value} remaining`}</small>
			<TodoList todos={todos} empty={() => i18n.t('empty')} onToggle={(todo, done) => todo.done = done} onDelete={todo => { const i = todos.findIndex(x => x.id === todo.id); if (i >= 0) todos.splice(i, 1); }} />
		</Panel>
	</main>;
}

function About() {
	return <main><h1>About</h1><p>This page is rendered by Lithe's built-in router.</p><Link to="/">Back</Link></main>;
}

function NotFound() {
	return <main><h1>404</h1><p>This route does not exist.</p><Link to="/">Back home</Link></main>;
}

const appGroup = async (_context: any, next: () => Promise<unknown>) => next();
const router = createRouter({
	routes: [
		group([
			{ path: '/', component: Home },
			{ path: '/about', component: About }
		], { middleware: [appGroup] }),
		{ path: '*', component: NotFound }
	]
});
router.start();
mount(document.getElementById('app'), <router.View />);
