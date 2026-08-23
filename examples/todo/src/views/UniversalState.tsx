import { state, createStore } from 'lithe/core';
import { Link } from 'lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

// 1. Scalar Stores
const useCounter = createStore<number>(42);
const useFlag = createStore<boolean>(true);
const useLabel = createStore<string>('Lithe Core');

// 2. Collection Stores (Map & Set)
const tagStore = state(new Set<string>(['typescript', 'signals', 'reactive', 'fast']));
const metadataStore = state(new Map<string, string>([
	['version', '2.0.0'],
	['engine', 'V8 / JSC'],
	['mode', 'single-bundle']
]));

export function UniversalState() {
	const count = useCounter();
	const flag = useFlag();
	const label = useLabel();

	const newTagDraft = state({ input: '' });
	const newMetaKey = state({ input: '' });
	const newMetaVal = state({ input: '' });

	function addTag(e: Event) {
		e.preventDefault();
		if (newTagDraft.input.trim()) {
			tagStore.add(newTagDraft.input.trim().toLowerCase());
			newTagDraft.input = '';
		}
	}

	function addMeta(e: Event) {
		e.preventDefault();
		if (newMetaKey.input.trim() && newMetaVal.input.trim()) {
			metadataStore.set(newMetaKey.input.trim(), newMetaVal.input.trim());
			newMetaKey.input = '';
			newMetaVal.input = '';
		}
	}

	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>🧬 Universal State & Data Types</h1>
				<small class="tagline">Scalars, Collections (Map / Set), Built-ins & Deep Objects</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Tasks</Link>
				<Link to="/projects" class="nav-link">📁 Projects</Link>
				<ThemeToggle />
			</div>
		</header>

		<div class="universal-grid">
			{/* 1. Scalars */}
			<Panel className="type-card">
				<h2>1. Scalar Primitives (Number, Bool, String)</h2>
				<p class="card-hint">Stores wrap scalars directly without boilerplate objects.</p>

				<div class="scalar-row">
					<span class="label">Number (int/float):</span>
					<strong>{() => count}</strong>
					<div class="btn-group">
						<button type="button" class="btn btn-sm btn-outline" onClick={() => useCounter.setState(c => c - 1)}>-1</button>
						<button type="button" class="btn btn-sm btn-outline" onClick={() => useCounter.setState(c => c + 1)}>+1</button>
						<button type="button" class="btn btn-sm btn-outline" onClick={() => useCounter.setState(c => c + 0.5)}>+0.5</button>
					</div>
				</div>

				<div class="scalar-row">
					<span class="label">Boolean Flag:</span>
					<strong class={() => flag ? 'text-success' : 'text-danger'}>
						{() => flag ? 'ACTIVE (true)' : 'INACTIVE (false)'}
					</strong>
					<button type="button" class="btn btn-sm btn-outline" onClick={() => useFlag.setState(f => !f)}>Toggle</button>
				</div>

				<div class="scalar-row">
					<span class="label">String:</span>
					<input
						type="text"
						value={() => label}
						onInput={(e: InputEvent) => useLabel.setState((e.currentTarget as HTMLInputElement).value)}
						class="input-main input-sm"
					/>
				</div>
			</Panel>

			{/* 2. Reactive Set Collection */}
			<Panel className="type-card">
				<h2>2. Reactive Set (Unique Tags)</h2>
				<p class="card-hint">Fine-grained reactivity on <code>set.add()</code>, <code>set.delete()</code>, <code>set.size</code>.</p>

				<div class="tag-chips">
					{() => [...tagStore.values()].map(tag => (
						<span key={tag} class="tag-chip">
							#{tag}
							<button type="button" class="tag-del" onClick={() => tagStore.delete(tag)}>×</button>
						</span>
					))}
				</div>

				<form onSubmit={addTag} class="row mini-form">
					<input
						type="text"
						placeholder="Add tag..."
						value={() => newTagDraft.input}
						onInput={(e: InputEvent) => newTagDraft.input = (e.currentTarget as HTMLInputElement).value}
						class="input-main input-sm"
					/>
					<button type="submit" class="btn btn-sm btn-primary">Add Tag</button>
				</form>
				<small class="muted-note">{() => `Total unique tags: ${tagStore.size}`}</small>
			</Panel>

			{/* 3. Reactive Map Collection */}
			<Panel className="type-card">
				<h2>3. Reactive Map (Key-Value Dictionary)</h2>
				<p class="card-hint">Fine-grained subscriptions per key with <code>map.get(k)</code> and <code>map.set(k, v)</code>.</p>

				<ul class="meta-list">
					{() => [...metadataStore.entries()].map(([k, v]) => (
						<li key={k} class="meta-item">
							<span class="meta-key">{k}:</span>
							<span class="meta-val">{v}</span>
							<button type="button" class="btn-delete-sm" onClick={() => metadataStore.delete(k)}>×</button>
						</li>
					))}
				</ul>

				<form onSubmit={addMeta} class="row mini-form">
					<input
						type="text"
						placeholder="Key"
						value={() => newMetaKey.input}
						onInput={(e: InputEvent) => newMetaKey.input = (e.currentTarget as HTMLInputElement).value}
						class="input-main input-sm"
					/>
					<input
						type="text"
						placeholder="Value"
						value={() => newMetaVal.input}
						onInput={(e: InputEvent) => newMetaVal.input = (e.currentTarget as HTMLInputElement).value}
						class="input-main input-sm"
					/>
					<button type="submit" class="btn btn-sm btn-primary">Set Key</button>
				</form>
				<small class="muted-note">{() => `Map entries count: ${metadataStore.size}`}</small>
			</Panel>
		</div>
	</main>;
}
