import { signal } from 'lithe/core';
import { Link } from 'lithe/router';
import { Panel } from '../components/Panel.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

export function TailwindShowcase() {
	const activeTab = signal<'badges' | 'cards' | 'buttons'>('badges');
	const clickCount = signal(0);
	const toggleState = signal(true);
	const selectedTag = signal<string>('all');

	const tags = [
		{ id: 'all', label: 'All Utilities' },
		{ id: 'layout', label: 'Flex & Grid' },
		{ id: 'colors', label: 'Palette & Themes' },
		{ id: 'effects', label: 'Shadows & Borders' },
		{ id: 'interactive', label: 'Transitions & Hover' }
	];

	return (
		<main class="page-container">
			<header class="app-header">
				<div class="header-branding">
					<h1>🎨 Tailwind CSS Showcase</h1>
					<small class="tagline">Zero-runtime utility classes generated via <code>@lithe/tailwind</code></small>
				</div>
				<div class="header-nav">
					<Link to="/" class="nav-link">🏠 Tasks</Link>
					<Link to="/projects" class="nav-link">📁 Projects</Link>
					<Link to="/remote" class="nav-link">☁️ Remote</Link>
					<ThemeToggle />
				</div>
			</header>

			<Panel className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700">
				<div class="flex flex-col gap-4">
					{/* Header banner */}
					<div class="flex items-center justify-between border-b border-slate-700 pb-4">
						<div>
							<h2 class="text-xl font-bold text-indigo-500">🎨 Utility Class Explorer</h2>
							<p class="text-sm text-slate-400">Reactive tabs and interactive components styled purely with Tailwind utilities</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500 text-white shadow-sm">
								● Plugin Active
							</span>
						</div>
					</div>

					{/* Interactive Tab Navigation */}
					<div class="flex gap-2">
						<button
							type="button"
							class={() => `px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
								activeTab.value === 'badges'
									? 'bg-indigo-600 text-white shadow-md'
									: 'bg-slate-800 text-slate-300 hover:bg-slate-700'
							}`}
							onClick={() => activeTab.value = 'badges'}
						>
							🏷️ Badges & Pills
						</button>
						<button
							type="button"
							class={() => `px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
								activeTab.value === 'cards'
									? 'bg-indigo-600 text-white shadow-md'
									: 'bg-slate-800 text-slate-300 hover:bg-slate-700'
							}`}
							onClick={() => activeTab.value = 'cards'}
						>
							🃏 Metric Cards
						</button>
						<button
							type="button"
							class={() => `px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
								activeTab.value === 'buttons'
									? 'bg-indigo-600 text-white shadow-md'
									: 'bg-slate-800 text-slate-300 hover:bg-slate-700'
							}`}
							onClick={() => activeTab.value = 'buttons'}
						>
							⚡ Interactive Buttons
						</button>
					</div>

					{/* Dynamic Tab Content */}
					{() => {
						if (activeTab.value === 'badges') {
							return (
								<div class="flex flex-col gap-4 mt-2">
									<div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Indicators</div>
									<div class="flex flex-wrap gap-2">
										<span class="px-3 py-1 text-xs font-medium rounded-full bg-emerald-500 text-white shadow-sm">
											✔ Completed
										</span>
										<span class="px-3 py-1 text-xs font-medium rounded-full bg-amber-500 text-white shadow-sm">
											⏳ In Progress
										</span>
										<span class="px-3 py-1 text-xs font-medium rounded-full bg-rose-500 text-white shadow-sm">
											✖ Blocked
										</span>
										<span class="px-3 py-1 text-xs font-medium rounded-full bg-sky-500 text-white shadow-sm">
											☁️ Cloud Sync
										</span>
										<span class="px-3 py-1 text-xs font-medium rounded-full bg-purple-500 text-white shadow-sm">
											🧬 Reactive Signal
										</span>
									</div>

									<div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">Filterable Category Tags (Click to Select)</div>
									<div class="flex flex-wrap gap-2">
										{tags.map(t => (
											<button
												type="button"
												key={t.id}
												onClick={() => selectedTag.value = t.id}
												class={() => `px-3 py-1 text-xs rounded-full border transition-all cursor-pointer font-medium ${
													selectedTag.value === t.id
														? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
														: 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
												}`}
											>
												{t.label}
											</button>
										))}
									</div>

									<div class="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
										Active Tag Filter: <strong class="text-indigo-400">{() => selectedTag.value}</strong>
									</div>
								</div>
							);
						}

						if (activeTab.value === 'cards') {
							return (
								<div class="grid gap-3 mt-2 grid-cols-1 md:grid-cols-3">
									<div class="p-4 rounded-lg bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-sm">
										<div class="flex items-center justify-between">
											<span class="text-xs text-slate-400 uppercase font-semibold">Signal Throughput</span>
											<span class="px-2 py-0.5 text-xs rounded-full bg-emerald-500 text-white font-medium">+36.8M/s</span>
										</div>
										<div class="text-2xl font-bold text-white mt-2">2.72 ms</div>
										<div class="text-xs text-slate-400 mt-1">100k updates across 1k signals</div>
									</div>

									<div class="p-4 rounded-lg bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-sm">
										<div class="flex items-center justify-between">
											<span class="text-xs text-slate-400 uppercase font-semibold">Bundle Footprint</span>
											<span class="px-2 py-0.5 text-xs rounded-full bg-indigo-500 text-white font-medium">Zero deps</span>
										</div>
										<div class="text-2xl font-bold text-white mt-2">12.4 KB</div>
										<div class="text-xs text-slate-400 mt-1">Gzipped core runtime</div>
									</div>

									<div class="p-4 rounded-lg bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-sm">
										<div class="flex items-center justify-between">
											<span class="text-xs text-slate-400 uppercase font-semibold">Compiler Passes</span>
											<span class="px-2 py-0.5 text-xs rounded-full bg-purple-500 text-white font-medium">7 Stages</span>
										</div>
										<div class="text-2xl font-bold text-white mt-2">100% TSX</div>
										<div class="text-xs text-slate-400 mt-1">Native type-stripping AST</div>
									</div>
								</div>
							);
						}

						// 'buttons' tab
						return (
							<div class="flex flex-col gap-4 mt-2">
								<div class="p-4 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-lg shadow-md">
											TL
										</div>
										<div>
											<div class="font-semibold text-white">Utility-First Speed</div>
											<div class="text-xs text-slate-400">Click to increment reactive signal state</div>
										</div>
									</div>
									<button
										type="button"
										class="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white transition-all shadow hover:bg-emerald-600 cursor-pointer"
										onClick={() => clickCount.value++}
									>
										Clicks: {() => clickCount.value}
									</button>
								</div>

								<div class="flex flex-wrap items-center gap-3 pt-2">
									<button
										type="button"
										class="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
										onClick={() => clickCount.value += 5}
									>
										+5 Fast Count
									</button>
									<button
										type="button"
										class="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-all cursor-pointer shadow-sm"
										onClick={() => clickCount.value = 0}
									>
										Reset Count
									</button>
									<button
										type="button"
										class={() => `px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer shadow-sm ${
											toggleState.value
												? 'bg-purple-600 text-white hover:bg-purple-700'
												: 'bg-slate-700 text-slate-300 hover:bg-slate-600'
										}`}
										onClick={() => toggleState.value = !toggleState.value}
									>
										{() => `Toggle: ${toggleState.value ? 'Active (ON)' : 'Disabled (OFF)'}`}
									</button>
								</div>
							</div>
						);
					}}
				</div>
			</Panel>
		</main>
	);
}

