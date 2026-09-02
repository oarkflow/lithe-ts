import { signal, computed, watch, state, batch, onCleanup } from '@oarkflow/lithe/core';
import { Link } from '@oarkflow/lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

interface UserProfile {
	name: string;
	age: number;
	preferences: {
		theme: 'light' | 'dark';
		notifications: boolean;
		language: string;
	};
	tags: string[];
}

export function ReactiveWatch() {
	const profile = signal<UserProfile>({
		name: 'Alice',
		age: 30,
		preferences: { theme: 'dark', notifications: true, language: 'en' },
		tags: ['admin', 'developer']
	});

	const deepChanges = signal<Array<{ time: string; value: string }>>([]);
	const shallowChanges = signal<Array<{ time: string; value: string }>>([]);

	// Deep watch - use untrack to avoid infinite loop when updating log
	const stopDeep = watch(profile, (value) => {
		const entry = {
			time: new Date().toLocaleTimeString(),
			value: JSON.stringify(value).slice(0, 60)
		};
		// Use peek() to avoid tracking the log signal
		const current = deepChanges.peek();
		deepChanges.value = [entry, ...current.slice(0, 4)];
	}, { deep: true, sync: true });

	// Shallow watch
	const stopShallow = watch(profile, (value) => {
		const entry = {
			time: new Date().toLocaleTimeString(),
			value: JSON.stringify(value).slice(0, 60)
		};
		const current = shallowChanges.peek();
		shallowChanges.value = [entry, ...current.slice(0, 4)];
	}, { sync: true });

	onCleanup(stopDeep);
	onCleanup(stopShallow);

	const profileSummary = computed(() => {
		const p = profile.value;
		return `${p.name} (${p.age}) - ${p.preferences.theme} mode, ${p.tags.length} tags`;
	});

	function updateName() {
		profile.value = { ...profile.value, name: profile.value.name === 'Alice' ? 'Bob' : 'Alice' };
	}

	function updateAge() {
		profile.value = { ...profile.value, age: profile.value.age + 1 };
	}

	function toggleTheme() {
		const current = profile.value;
		profile.value = {
			...current,
			preferences: { ...current.preferences, theme: current.preferences.theme === 'dark' ? 'light' : 'dark' }
		};
	}

	function toggleNotifications() {
		const current = profile.value;
		profile.value = {
			...current,
			preferences: { ...current.preferences, notifications: !current.preferences.notifications }
		};
	}

	function addTag() {
		const current = profile.value;
		profile.value = { ...current, tags: [...current.tags, `tag-${current.tags.length + 1}`] };
	}

	function removeLastTag() {
		const current = profile.value;
		if (current.tags.length > 0) {
			profile.value = { ...current, tags: current.tags.slice(0, -1) };
		}
	}

	// Batch update demo
	const batchCounter = signal(0);
	const batchLog = signal<string[]>([]);

	const stopBatch = watch(batchCounter, (value) => {
		const current = batchLog.peek();
		batchLog.value = [
			`${new Date().toLocaleTimeString()}: Counter = ${value}`,
			...current.slice(0, 4)
		];
	}, { sync: true });
	onCleanup(stopBatch);

	function batchUpdate() {
		batch(() => {
			batchCounter.value = 1;
			batchCounter.value = 2;
			batchCounter.value = 3;
		});
	}

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>🔍 Reactive Watch</h1>
				<small class="tagline">Deep structural comparison and batch updates</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<ThemeToggle />
			</div>
		</header>

		<div class="watch-grid">
			<Panel className="watch-card">
				<h2>👤 User Profile</h2>
				<div class="profile-display">
					<div class="profile-field">
						<span class="field-label">Name:</span>
						<strong>{() => profile.value.name}</strong>
						<button type="button" class="btn btn-sm btn-outline" onClick={updateName}>Toggle</button>
					</div>
					<div class="profile-field">
						<span class="field-label">Age:</span>
						<strong>{() => profile.value.age}</strong>
						<button type="button" class="btn btn-sm btn-outline" onClick={updateAge}>+1</button>
					</div>
					<div class="profile-field">
						<span class="field-label">Theme:</span>
						<strong>{() => profile.value.preferences.theme}</strong>
						<button type="button" class="btn btn-sm btn-outline" onClick={toggleTheme}>Toggle</button>
					</div>
					<div class="profile-field">
						<span class="field-label">Notifications:</span>
						<strong>{() => profile.value.preferences.notifications ? 'ON' : 'OFF'}</strong>
						<button type="button" class="btn btn-sm btn-outline" onClick={toggleNotifications}>Toggle</button>
					</div>
					<div class="profile-field">
						<span class="field-label">Tags:</span>
						<span>{() => profile.value.tags.map(t => `#${t}`).join(', ')}</span>
						<div class="btn-group">
							<button type="button" class="btn btn-sm btn-outline" onClick={addTag}>+Tag</button>
							<button type="button" class="btn btn-sm btn-outline" onClick={removeLastTag}>-Tag</button>
						</div>
					</div>
				</div>
				<div class="summary-box">
					<span class="summary-label">Computed:</span>
					<span class="summary-value">{() => profileSummary.value}</span>
				</div>
			</Panel>

			<Panel className="watch-card">
				<h2>🔬 Deep Watch Log</h2>
				<p class="card-hint">Triggers on nested property changes.</p>
				<div class="watch-log">
					{() => deepChanges.value.length > 0 ? (
						deepChanges.value.map((entry, i) => (
							<div key={i} class="log-entry">
								<span class="log-time">{entry.time}</span>
								<span class="log-value">{entry.value}</span>
							</div>
						))
					) : (
						<div class="empty-log">Modify the profile above.</div>
					)}
				</div>
			</Panel>

			<Panel className="watch-card">
				<h2>👁️ Shallow Watch Log</h2>
				<p class="card-hint">Only triggers on reference changes.</p>
				<div class="watch-log">
					{() => shallowChanges.value.length > 0 ? (
						shallowChanges.value.map((entry, i) => (
							<div key={i} class="log-entry">
								<span class="log-time">{entry.time}</span>
								<span class="log-value">{entry.value}</span>
							</div>
						))
					) : (
						<div class="empty-log">Modify the profile above.</div>
					)}
				</div>
			</Panel>

			<Panel className="watch-card">
				<h2>📦 Batch Updates</h2>
				<p class="card-hint">Multiple changes in <code>batch()</code> trigger watch once.</p>
				<div class="batch-display">
					<strong>{() => batchCounter.value}</strong>
					<button type="button" class="btn btn-primary" onClick={batchUpdate}>Batch (1→2→3)</button>
				</div>
				<div class="watch-log">
					{() => batchLog.value.length > 0 ? (
						batchLog.value.map((entry, i) => (
							<div key={i} class="log-entry">
								<span class="log-value">{entry}</span>
							</div>
						))
					) : (
						<div class="empty-log">Click Batch Update.</div>
					)}
				</div>
			</Panel>
		</div>
	</main>;
}
