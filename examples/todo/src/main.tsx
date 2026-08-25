import { mount } from 'lithe/dom';
import { createRouter, group, lazyRoute, Link } from 'lithe/router';
import { createI18n } from 'lithe/i18n';
import { defineTheme } from 'lithe/style';
import { ThemeContext, useTheme } from '@/context/ThemeContext.tsx';
import { ThemeToggle } from '@/components/ThemeToggle.tsx';

const Home = lazyRoute(() => import('@/views/Home.tsx'), { exportName: 'Home' });
const ProjectWorkspaces = lazyRoute(() => import('@/views/ProjectWorkspaces.tsx'), { exportName: 'ProjectWorkspaces' });
const RemoteSync = lazyRoute(() => import('@/views/RemoteSync.tsx'), { exportName: 'RemoteSync' });
const Stats = lazyRoute(() => import('@/views/Stats.tsx'), { exportName: 'Stats' });
const DevTools = lazyRoute(() => import('@/views/DevTools.tsx'), { exportName: 'DevTools' });
const UniversalState = lazyRoute(() => import('@/views/UniversalState.tsx'), { exportName: 'UniversalState' });
const TailwindShowcase = lazyRoute(() => import('@/views/TailwindShowcase.tsx'), { exportName: 'TailwindShowcase' });
const About = lazyRoute(() => import('@/views/About.tsx'), { exportName: 'About' });

defineTheme({
	color: { accent: '#6f5cff', background: '#0f1117' },
	radius: { card: '14px', input: '8px' }
});

const i18n = createI18n({
	locale: 'en',
	messages: {
		en: {
			title: 'Lithe Studio',
			subtitle: 'Zero dependencies · Fine-grained signals · Context & Stores',
			add: 'Add Task',
			empty: 'No tasks found. Add a task above to get started!'
		}
	}
});

function NavigationBar() {
	return <nav class="top-nav">
		<div class="nav-container">
			<Link to="/" class="brand-logo">⚡ Lithe</Link>
			<div class="nav-links">
				<Link to="/" class="nav-tab">🏠 Tasks</Link>
				<Link to="/projects" class="nav-tab">📁 Projects</Link>
				<Link to="/remote" class="nav-tab">☁️ Remote</Link>
				<Link to="/types" class="nav-tab">🧬 Data Types</Link>
				<Link to="/tailwind" class="nav-tab">🎨 Tailwind</Link>
				<Link to="/stats" class="nav-tab">📊 Stats</Link>
				<Link to="/devtools" class="nav-tab">🛠️ DevTools</Link>
				<Link to="/about" class="nav-tab">ℹ️ About</Link>
			</div>
			<ThemeToggle />
		</div>
	</nav>;
}

function NotFound() {
	return <main class="page-container">
		<h1>404 Not Found</h1>
		<p>The requested route does not exist.</p>
		<Link to="/" class="nav-link">Back home</Link>
	</main>;
}

const router = createRouter({
	routes: [
		group([
			{ path: '/', component: () => <Home i18n={i18n} /> },
			{ path: '/projects', component: ProjectWorkspaces },
			{ path: '/remote', component: RemoteSync },
			{ path: '/types', component: UniversalState },
			{ path: '/tailwind', component: TailwindShowcase },
			{ path: '/stats', component: Stats },
			{ path: '/devtools', component: DevTools },
			{ path: '/about', component: About }
		]),
		{ path: '*', component: NotFound }
	]
});

function App() {
	const theme = useTheme();
	return <ThemeContext.Provider value={theme}>
		<div class="app-root">
			<NavigationBar />
			<router.View />
		</div>
	</ThemeContext.Provider>;
}

router.start();
mount(document.getElementById('app')!, <App />);
