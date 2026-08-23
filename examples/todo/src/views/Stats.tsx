import { computed } from 'lithe/core';
import { Link } from 'lithe/router';
import { useTodoStore, type Todo } from '../store/todoStore.ts';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

export function Stats() {
	const todos = useTodoStore(s => s.todos);

	const total = computed(() => todos.length);
	const completed = computed(() => todos.filter((t: Todo) => t.done).length);
	const active = computed(() => todos.filter((t: Todo) => !t.done).length);
	const percentage = computed(() => total.value > 0 ? Math.round((completed.value / total.value) * 100) : 0);

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>📊 Task Analytics</h1>
				<small class="tagline">Real-time stats derived from reactive signals</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Back to Tasks</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="stats-panel">
			<div class="stats-grid">
				<div class="stat-card">
					<span class="stat-num">{() => total.value}</span>
					<span class="stat-label">Total Tasks</span>
				</div>
				<div class="stat-card">
					<span class="stat-num text-success">{() => completed.value}</span>
					<span class="stat-label">Completed</span>
				</div>
				<div class="stat-card">
					<span class="stat-num text-warning">{() => active.value}</span>
					<span class="stat-label">Active / Remaining</span>
				</div>
				<div class="stat-card">
					<span class="stat-num text-accent">{() => `${percentage.value}%`}</span>
					<span class="stat-label">Completion Rate</span>
				</div>
			</div>

			<div class="progress-container">
				<div class="progress-bar" style={() => ({ width: `${percentage.value}%` })}></div>
			</div>

			<div class="stats-info">
				<p>💡 All counters and progress bars automatically update via Lithe fine-grained computed signals whenever the global store mutates.</p>
			</div>
		</Panel>
	</main>;
}
