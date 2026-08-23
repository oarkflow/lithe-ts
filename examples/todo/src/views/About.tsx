import { Link } from 'lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

export function About() {
	return <main class="page-container">
		<header class="app-header">
			<div class="header-branding">
				<h1>ℹ️ Architecture & Features</h1>
				<small class="tagline">Zero npm dependencies · Signal-mesh reactivity</small>
			</div>
			<div class="header-nav">
				<Link to="/" class="nav-link">🏠 Home</Link>
				<Link to="/stats" class="nav-link">📊 Analytics</Link>
				<ThemeToggle />
			</div>
		</header>

		<Panel className="about-panel">
			<h2>⚡ Features Demonstrated in this Demo:</h2>
			<ul class="feature-list">
				<li>
					<strong>🧠 Signal-Mesh State Management (<code>createStore</code>)</strong>:
					Fine-grained selector subscriptions with zero-overhead dependency tracking.
				</li>
				<li>
					<strong>💾 LocalStorage Persistence (<code>persist</code> middleware)</strong>:
					Auto-saving & hydration without boilerplate.
				</li>
				<li>
					<strong>⏳ Time-Travel History (<code>history</code> middleware)</strong>:
					Complete Undo & Redo state snapshots.
				</li>
				<li>
					<strong>🎨 Theme Context (<code>createContext</code> / <code>useContext</code>)</strong>:
					Scoped context with <code>&lt;Context.Provider&gt;</code> and reactive CSS variables.
				</li>
				<li>
					<strong>📝 Forms & Schema Validation (<code>createForm</code> / <code>object</code> / <code>string</code>)</strong>:
					Runtime validation and field error bindings.
				</li>
				<li>
					<strong>🌐 Client-Side SPA Router (<code>createRouter</code> / <code>Link</code>)</strong>:
					Zero-dependency SPA navigation with fallback support.
				</li>
				<li>
					<strong>🌍 Internationalization (<code>createI18n</code>)</strong>:
					Fast string dictionary interpolation.
				</li>
			</ul>
		</Panel>
	</main>;
}
