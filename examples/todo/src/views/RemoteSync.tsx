import { state } from '@oarkflow/lithe/core';
import { Link } from '@oarkflow/lithe/router';
import { query, mutation } from '@oarkflow/lithe/data';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

interface RemoteTodo {
	id: number;
	title: string;
	completed: boolean;
}

// In-memory mock server database
let serverDb: RemoteTodo[] = [
	{ id: 101, title: 'Fetch remote tasks via @oarkflow/lithe/data query()', completed: true },
	{ id: 102, title: 'Simulate network latency and optimistic mutations', completed: false },
	{ id: 103, title: 'Automatic tag-based cache invalidation', completed: false }
];

async function mockFetchTodos(): Promise<RemoteTodo[]> {
	await new Promise(r => setTimeout(r, 400));
	return JSON.parse(JSON.stringify(serverDb));
}

async function mockCreateTodo(title: string): Promise<RemoteTodo> {
	await new Promise(r => setTimeout(r, 300));
	const newItem = { id: Date.now(), title: String(title), completed: false };
	serverDb.unshift(newItem);
	return newItem;
}

async function mockToggleTodo(id: number): Promise<void> {
	await new Promise(r => setTimeout(r, 200));
	const item = serverDb.find(t => t.id === id);
	if (item) item.completed = !item.completed;
}

export function RemoteSync() {
	const draft = state({ input: '' });

	const todoQuery = query<RemoteTodo[]>({
		key: ['remote-todos'],
		queryFn: mockFetchTodos,
		tags: ['todos'],
		stale: '10s'
	});

	const addMutation = mutation({
		mutationFn: (title: string) => mockCreateTodo(title),
		invalidates: ['todos'],
		onSuccess() {
			draft.input = '';
		}
	});

	const toggleMutation = mutation({
		mutationFn: (id: number) => mockToggleTodo(id),
		invalidates: ['todos']
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (draft.input.trim()) {
			addMutation.mutate(draft.input.trim());
		}
	}

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>☁️ Remote Data & Async Queries</h1>
				<small class="tagline">Demonstrating <code>@oarkflow/lithe/data</code>: <code>query()</code> and <code>mutation()</code> with cache invalidation</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/projects" class="nav-link">📁 Projects</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="remote-panel">
			<div class="remote-toolbar">
				<button
					type="button"
					class="btn btn-sm btn-outline"
					onClick={() => todoQuery.refresh()}
					disabled={() => todoQuery.loading}
				>
					{() => todoQuery.loading ? '🔄 Fetching...' : '🔄 Refetch API'}
				</button>
				<span class="cache-indicator">
					{() => todoQuery.loading ? 'Fetching from mock server (400ms delay)...' : 'Data cached in @oarkflow/lithe/data QueryClient'}
				</span>
			</div>

			<form onSubmit={handleSubmit} class="row todo-form">
				<input
					type="text"
					placeholder="New remote task..."
					value={() => draft.input}
					onInput={(e: InputEvent) => draft.input = (e.currentTarget as HTMLInputElement).value}
					class="input-main"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={() => addMutation.loading || !draft.input.trim()}
				>
					{() => addMutation.loading ? 'Saving...' : 'Add to Server'}
				</button>
			</form>

			{() => {
				if (todoQuery.loading && !todoQuery.data) {
					return <div class="loading-box">⏳ Loading remote tasks...</div>;
				}
				if (todoQuery.error) {
					return <div class="error-box">❌ Error fetching tasks</div>;
				}
				const list = todoQuery.data || [];
				return <ul class="todo-list">
					{list.map(t => (
						<li key={String(t.id)} class={`todo-item ${t.completed ? 'is-done' : ''}`}>
							<input
								type="checkbox"
								checked={t.completed}
								onChange={() => toggleMutation.mutate(t.id)}
							/>
							<span class="todo-title">{t.title}</span>
							<span class="server-badge">ID: {t.id}</span>
						</li>
					))}
				</ul>;
			}}
		</Panel>
	</main>;
}
