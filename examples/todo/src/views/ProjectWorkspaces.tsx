import { createContextStore, createStore, state } from 'lithe/core';
import { Link } from 'lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

interface ProjectTask {
	id: string;
	title: string;
	done: boolean;
}

interface ProjectState {
	projectName: string;
	tasks: ProjectTask[];
}

interface ProjectActions {
	addTask(title: string): void;
	toggleTask(id: string): void;
	removeTask(id: string): void;
}

const [ProjectStoreProvider, useProjectStore] = createContextStore<ProjectState & ProjectActions, { name: string; initialTasks: string[] }>(
	(props) => createStore((set) => ({
		projectName: props.name,
		tasks: (props.initialTasks || []).map((title, i) => ({
			id: `${props.name}-${i}`,
			title,
			done: i === 0
		})),

		addTask(title: string) {
			const trimmed = title.trim();
			if (!trimmed) return;
			set(s => {
				s.tasks.push({ id: crypto.randomUUID(), title: trimmed, done: false });
			});
		},

		toggleTask(id: string) {
			set(s => {
				const item = s.tasks.find(t => t.id === id);
				if (item) item.done = !item.done;
			});
		},

		removeTask(id: string) {
			set(s => {
				s.tasks = s.tasks.filter(t => t.id !== id);
			});
		}
	})),
	{ name: 'ProjectStore' }
);

function ProjectBoard() {
	const name = useProjectStore(s => s.projectName);
	const tasks = useProjectStore(s => s.tasks);
	const { addTask, toggleTask, removeTask } = useProjectStore();

	const draft = state({ input: '' });

	function submit(e: Event) {
		e.preventDefault();
		if (draft.input.trim()) {
			addTask(draft.input);
			draft.input = '';
		}
	}

	return <div class="project-board">
		<div class="project-header">
			<h3>{name}</h3>
			<span class="badge">{() => `${tasks.filter(t => t.done).length}/${tasks.length} done`}</span>
		</div>

		<form onSubmit={submit} class="row mini-form">
			<input
				type="text"
				placeholder="Add project task..."
				value={() => draft.input}
				onInput={(e: InputEvent) => draft.input = (e.currentTarget as HTMLInputElement).value}
				class="input-main input-sm"
			/>
			<button type="submit" class="btn btn-sm btn-primary">Add</button>
		</form>

		<ul class="mini-task-list">
			{() => tasks.map(t => (
				<li key={t.id} class={() => `mini-task ${t.done ? 'is-done' : ''}`}>
					<input
						type="checkbox"
						checked={() => t.done}
						onChange={() => toggleTask(t.id)}
					/>
					<span class="task-title">{t.title}</span>
					<button type="button" class="btn-delete-sm" onClick={() => removeTask(t.id)}>×</button>
				</li>
			))}
		</ul>
	</div>;
}

export function ProjectWorkspaces() {
	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>📁 Context-Scoped Stores</h1>
				<small class="tagline">Demonstrating <code>createContextStore</code>: Multiple isolated store instances side-by-side</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/stats" class="nav-link">📊 Analytics</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="projects-panel">
			<p class="description">
				Each column below is wrapped in its own <code>&lt;ProjectStoreProvider&gt;</code>.
				Adding, removing, or toggling tasks in one project never mutates or triggers re-renders in other boards.
			</p>

			<div class="projects-grid">
				<ProjectStoreProvider initialProps={{ name: '🚀 Product Launch', initialTasks: ['Finalize RFC', 'Run test suite', 'Publish changelog'] }}>
					<ProjectBoard />
				</ProjectStoreProvider>

				<ProjectStoreProvider initialProps={{ name: '🎨 Design System', initialTasks: ['Accessible color palette', 'Token audit', 'Export SVG icons'] }}>
					<ProjectBoard />
				</ProjectStoreProvider>

				<ProjectStoreProvider initialProps={{ name: '📚 Learning & Research', initialTasks: ['Read Lithe signals spec', 'Compare bundle metrics'] }}>
					<ProjectBoard />
				</ProjectStoreProvider>
			</div>
		</Panel>
	</main>;
}
