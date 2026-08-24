import { signal } from 'lithe/core';
import { Link } from 'lithe/router';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

type TabType = 'overview' | 'badges' | 'cards' | 'buttons' | 'forms' | 'palette' | 'layout' | 'animations';

export function TailwindShowcase() {
	const activeTab = signal<TabType>('overview');
	const clickCount = signal(42);
	const toggleState = signal(true);
	const switchState = signal(false);
	const selectedCategory = signal('all');
	const searchQuery = signal('');
	const activeColor = signal('indigo');
	const animationType = signal<'spin' | 'ping' | 'pulse' | 'bounce'>('pulse');

	const categories = [
		{ id: 'all', label: 'All Components' },
		{ id: 'layout', label: 'Layout & Grid' },
		{ id: 'typography', label: 'Typography' },
		{ id: 'colors', label: 'Colors & Gradients' },
		{ id: 'effects', label: 'Effects & Shadows' },
		{ id: 'animations', label: 'Motion & Transform' }
	];

	const colorPalettes: Record<string, { name: string; hex: string; bg: string; text: string }[]> = {
		indigo: [
			{ name: '50', hex: '#eef2ff', bg: 'bg-indigo-50', text: 'text-indigo-900' },
			{ name: '200', hex: '#c7d2fe', bg: 'bg-indigo-200', text: 'text-indigo-900' },
			{ name: '400', hex: '#818cf8', bg: 'bg-indigo-400', text: 'text-white' },
			{ name: '600', hex: '#4f46e5', bg: 'bg-indigo-600', text: 'text-white' },
			{ name: '800', hex: '#3730a3', bg: 'bg-indigo-800', text: 'text-white' },
			{ name: '950', hex: '#1e1b4b', bg: 'bg-indigo-950', text: 'text-white' }
		],
		emerald: [
			{ name: '50', hex: '#ecfdf5', bg: 'bg-emerald-50', text: 'text-emerald-900' },
			{ name: '200', hex: '#a7f3d0', bg: 'bg-emerald-200', text: 'text-emerald-900' },
			{ name: '400', hex: '#34d399', bg: 'bg-emerald-400', text: 'text-white' },
			{ name: '600', hex: '#059669', bg: 'bg-emerald-600', text: 'text-white' },
			{ name: '800', hex: '#065f46', bg: 'bg-emerald-800', text: 'text-white' },
			{ name: '950', hex: '#022c22', bg: 'bg-emerald-950', text: 'text-white' }
		],
		rose: [
			{ name: '50', hex: '#fff1f2', bg: 'bg-rose-50', text: 'text-rose-900' },
			{ name: '200', hex: '#fecdd3', bg: 'bg-rose-200', text: 'text-rose-900' },
			{ name: '400', hex: '#fb7185', bg: 'bg-rose-400', text: 'text-white' },
			{ name: '600', hex: '#e11d48', bg: 'bg-rose-600', text: 'text-white' },
			{ name: '800', hex: '#9f1239', bg: 'bg-rose-800', text: 'text-white' },
			{ name: '950', hex: '#4c0519', bg: 'bg-rose-950', text: 'text-white' }
		],
		amber: [
			{ name: '50', hex: '#fffbeb', bg: 'bg-amber-50', text: 'text-amber-900' },
			{ name: '200', hex: '#fde68a', bg: 'bg-amber-200', text: 'text-amber-900' },
			{ name: '400', hex: '#fbbf24', bg: 'bg-amber-400', text: 'text-amber-950' },
			{ name: '600', hex: '#d97706', bg: 'bg-amber-600', text: 'text-white' },
			{ name: '800', hex: '#92400e', bg: 'bg-amber-800', text: 'text-white' },
			{ name: '950', hex: '#451a03', bg: 'bg-amber-950', text: 'text-white' }
		],
		sky: [
			{ name: '50', hex: '#f0f9ff', bg: 'bg-sky-50', text: 'text-sky-900' },
			{ name: '200', hex: '#bae6fd', bg: 'bg-sky-200', text: 'text-sky-900' },
			{ name: '400', hex: '#38bdf8', bg: 'bg-sky-400', text: 'text-sky-950' },
			{ name: '600', hex: '#0284c7', bg: 'bg-sky-600', text: 'text-white' },
			{ name: '800', hex: '#075985', bg: 'bg-sky-800', text: 'text-white' },
			{ name: '950', hex: '#082f49', bg: 'bg-sky-950', text: 'text-white' }
		]
	};

	return (
		<main class="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
			{/* Top Bar / Navigation */}
			<header class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-8 border-b border-slate-800">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
						<span class="text-2xl font-black text-white">⚡</span>
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-2xl font-black text-white tracking-tight">Tailwind CSS Engine</h1>
							<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
								v3 & v4 Native
							</span>
						</div>
						<p class="text-xs text-slate-400">Zero-dependency compiler, arbitrary values, responsive layers & reactive state</p>
					</div>
				</div>

				<nav class="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800">
					<Link to="/" class="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
						🏠 Tasks
					</Link>
					<Link to="/projects" class="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
						📁 Projects
					</Link>
					<Link to="/remote" class="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-all">
						☁️ Remote
					</Link>
					<div class="h-4 w-px bg-slate-700 mx-1"></div>
					<ThemeToggle />
				</nav>
			</header>

			{/* Main Showcase Body */}
			<section class="max-w-7xl mx-auto mt-8 flex flex-col gap-6">
				{/* Tab Selector Pill Bar */}
				<div class="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/80">
					{[
						{ id: 'overview', label: '🌟 Overview', icon: '🌟' },
						{ id: 'badges', label: '🏷️ Badges & Pills', icon: '🏷️' },
						{ id: 'cards', label: '🃏 Cards & Glass', icon: '🃏' },
						{ id: 'buttons', label: '⚡ Buttons & Clicks', icon: '⚡' },
						{ id: 'forms', label: '📝 Inputs & Controls', icon: '📝' },
						{ id: 'palette', label: '🎨 Color Palette', icon: '🎨' },
						{ id: 'layout', label: '📐 Grid & Flex', icon: '📐' },
						{ id: 'animations', label: '💫 Animations', icon: '💫' }
					].map(tab => (
						<button
							type="button"
							key={tab.id}
							onClick={() => activeTab.value = tab.id as TabType}
							class={() => `px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
								activeTab.value === tab.id
									? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/40'
									: 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Tab Content Display */}
				{() => {
					// 1. OVERVIEW TAB
					if (activeTab.value === 'overview') {
						return (
							<div class="flex flex-col gap-6">
								{/* Hero Card */}
								<div class="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
									<div class="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
									<div class="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

									<div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
										<div class="max-w-2xl flex flex-col gap-3">
											<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold w-fit">
												<span>🚀 Built-in Zero Runtime</span>
												<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
											</div>
											<h2 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
												Next-Gen Utility CSS with Lithe Reactivity
											</h2>
											<p class="text-sm md:text-base text-slate-300 leading-relaxed">
												Experience zero-bundle PostCSS transforms, lightning-fast compilation, arbitrary values (<code>w-[320px]</code>), full 22-palette color tables, and seamless integration with Lithe fine-grained signals.
											</p>
										</div>

										<div class="flex flex-col gap-3 shrink-0">
											<button
												type="button"
												onClick={() => clickCount.value++}
												class="px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-3 text-sm"
											>
												<span>⚡ Pulse Signal:</span>
												<span class="px-2.5 py-0.5 rounded-lg bg-black/30 font-mono text-xs">{() => clickCount.value}</span>
											</button>
											<div class="text-center text-xs text-slate-400 font-mono">
												Reactive without VDOM re-rendering
											</div>
										</div>
									</div>
								</div>

								{/* 4 Feature Highlights Grid */}
								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
									<div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition-all">
										<div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
											🎯
										</div>
										<div class="font-bold text-white text-base mt-1">Arbitrary Syntax</div>
										<p class="text-xs text-slate-400">Full support for custom brackets like <code>w-[280px]</code>, <code>bg-[#3b82f6]</code> and <code>grid-cols-[1fr_2fr]</code>.</p>
									</div>

									<div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition-all">
										<div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
											📱
										</div>
										<div class="font-bold text-white text-base mt-1">Multi-Tier Breakpoints</div>
										<p class="text-xs text-slate-400">Seamlessly responsive with <code>sm:</code>, <code>md:</code>, <code>lg:</code>, <code>xl:</code> and <code>2xl:</code> media queries.</p>
									</div>

									<div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition-all">
										<div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
											🌓
										</div>
										<div class="font-bold text-white text-base mt-1">Dark Mode Ready</div>
										<p class="text-xs text-slate-400">Class and attribute based dark mode modifiers (<code>dark:bg-slate-900</code>) that adapt instantly.</p>
									</div>

									<div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition-all">
										<div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg">
											✨
										</div>
										<div class="font-bold text-white text-base mt-1">Micro-Animations</div>
										<p class="text-xs text-slate-400">Keyframed transitions, smooth transforms, <code>animate-spin</code>, <code>animate-ping</code>, and <code>animate-pulse</code>.</p>
									</div>
								</div>
							</div>
						);
					}

					// 2. BADGES & PILLS TAB
					if (activeTab.value === 'badges') {
						return (
							<div class="flex flex-col gap-6">
								{/* Status Badges Section */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Status & State Badges</h3>
									<div class="flex flex-wrap items-center gap-3">
										<span class="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2 shadow-sm">
											<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
											Operational (99.99%)
										</span>
										<span class="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-2 shadow-sm">
											<span class="w-2 h-2 rounded-full bg-amber-400"></span>
											Syncing Database
										</span>
										<span class="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-2 shadow-sm">
											<span class="w-2 h-2 rounded-full bg-rose-400"></span>
											Rate Limited
										</span>
										<span class="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-2 shadow-sm">
											<span class="w-2 h-2 rounded-full bg-sky-400"></span>
											Cloud Deployed
										</span>
										<span class="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-2 shadow-sm">
											<span class="w-2 h-2 rounded-full bg-purple-400"></span>
											Signal Connected
										</span>
									</div>
								</div>

								{/* Category Tag Filtering */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<div class="flex items-center justify-between">
										<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Interactive Tag Selector</h3>
										<span class="text-xs text-indigo-400 font-mono">Selected: {() => selectedCategory.value}</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{categories.map(c => (
											<button
												type="button"
												key={c.id}
												onClick={() => selectedCategory.value = c.id}
												class={() => `px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
													selectedCategory.value === c.id
														? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 scale-105'
														: 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
												}`}
											>
												{c.label}
											</button>
										))}
									</div>
									<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
										<span>Filtered component list count:</span>
										<span class="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-400 font-bold font-mono">
											{() => selectedCategory.value === 'all' ? '48 Utilities' : '12 Utilities Active'}
										</span>
									</div>
								</div>

								{/* Pill Variations */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Pill Styles & Outlines</h3>
									<div class="flex flex-wrap items-center gap-3">
										<span class="px-3 py-1 text-xs font-bold rounded bg-indigo-600 text-white shadow">Square Pill</span>
										<span class="px-3 py-1 text-xs font-bold rounded-md bg-purple-600 text-white shadow">Rounded-md</span>
										<span class="px-3 py-1 text-xs font-bold rounded-xl bg-pink-600 text-white shadow">Rounded-xl</span>
										<span class="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow">Gradient Full</span>
										<span class="px-3 py-1 text-xs font-bold rounded-full border border-dashed border-slate-600 text-slate-300">Dashed Border</span>
									</div>
								</div>
							</div>
						);
					}

					// 3. CARDS & GLASSMORPHISM TAB
					if (activeTab.value === 'cards') {
						return (
							<div class="flex flex-col gap-6">
								{/* 3 Interactive Metric Cards */}
								<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
									{/* Card 1 */}
									<div class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Signal Updates</span>
											<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
												+36.8M/s
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">2.72 ms</div>
											<div class="text-xs text-slate-400 mt-1">100k updates across 1k signals</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full w-full"></div>
										</div>
									</div>

									{/* Card 2 */}
									<div class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl hover:border-purple-500/50 hover:shadow-purple-500/10 transition-all">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Bundle Footprint</span>
											<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
												Zero Deps
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">12.4 KB</div>
											<div class="text-xs text-slate-400 mt-1">Gzipped core runtime & router</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full w-full"></div>
										</div>
									</div>

									{/* Card 3 */}
									<div class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl hover:border-sky-500/50 hover:shadow-sky-500/10 transition-all">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">TypeScript Passes</span>
											<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
												7 Stages
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">100% TSX</div>
											<div class="text-xs text-slate-400 mt-1">Native AST & type stripping</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-sky-500 to-indigo-500 h-1.5 rounded-full w-full"></div>
										</div>
									</div>
								</div>

								{/* Glassmorphism Showcase Card */}
								<div class="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
									<div class="flex items-center gap-4">
										<div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30">
											💎
										</div>
										<div>
											<h4 class="text-lg font-bold text-white">Glassmorphism & Backdrop Filters</h4>
											<p class="text-xs text-slate-400">Rendered with <code>backdrop-blur-2xl</code> and <code>bg-slate-900/40</code></p>
										</div>
									</div>

									<div class="flex items-center gap-3">
										<button
											type="button"
											class="px-4 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer"
										>
											Preview Glass
										</button>
										<button
											type="button"
											class="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
										>
											Apply Effect
										</button>
									</div>
								</div>
							</div>
						);
					}

					// 4. BUTTONS & INTERACTIONS TAB
					if (activeTab.value === 'buttons') {
						return (
							<div class="flex flex-col gap-6">
								{/* Button Styles Matrix */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Button Variants & Micro-Interactions</h3>
									<div class="flex flex-wrap items-center gap-3">
										<button
											type="button"
											onClick={() => clickCount.value++}
											class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
										>
											Primary Solid (Click +1)
										</button>
										<button
											type="button"
											onClick={() => clickCount.value += 10}
											class="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
										>
											Gradient Boost (+10)
										</button>
										<button
											type="button"
											onClick={() => clickCount.value = 0}
											class="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
										>
											Danger Reset
										</button>
										<button
											type="button"
											class="px-5 py-2.5 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-all cursor-pointer"
										>
											Outline Button
										</button>
										<button
											type="button"
											disabled
											class="px-5 py-2.5 bg-slate-800 text-slate-500 border border-slate-800 font-bold text-sm rounded-xl opacity-50 cursor-not-allowed"
										>
											Disabled State
										</button>
									</div>
								</div>

								{/* Reactive Counter Display */}
								<div class="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 flex items-center justify-between">
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xl border border-indigo-500/30">
											#
										</div>
										<div>
											<div class="text-sm font-bold text-white">Total Click Counter Signal</div>
											<div class="text-xs text-slate-400">Updates live through fine-grained reactive closures</div>
										</div>
									</div>
									<div class="text-3xl font-black text-indigo-400 font-mono">
										{() => clickCount.value}
									</div>
								</div>

								{/* Toggle Switches */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Toggle Switches & Binary Signals</h3>
									<div class="flex flex-col md:flex-row gap-4">
										{/* Toggle 1 */}
										<div
											onClick={() => toggleState.value = !toggleState.value}
											class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-700 transition-all flex-1"
										>
											<div class="text-xs font-semibold text-slate-300">
												Auto-Compile CSS: <span class={() => toggleState.value ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{() => toggleState.value ? 'ENABLED' : 'PAUSED'}</span>
											</div>
											<div class={() => `w-12 h-6 rounded-full p-1 transition-all ${toggleState.value ? 'bg-emerald-500' : 'bg-slate-700'}`}>
												<div class={() => `w-4 h-4 rounded-full bg-white transition-all transform ${toggleState.value ? 'translate-x-6' : 'translate-x-0'}`}></div>
											</div>
										</div>

										{/* Toggle 2 */}
										<div
											onClick={() => switchState.value = !switchState.value}
											class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-700 transition-all flex-1"
										>
											<div class="text-xs font-semibold text-slate-300">
												Minification Engine: <span class={() => switchState.value ? 'text-indigo-400 font-bold' : 'text-slate-500'}>{() => switchState.value ? 'ACTIVE' : 'OFF'}</span>
											</div>
											<div class={() => `w-12 h-6 rounded-full p-1 transition-all ${switchState.value ? 'bg-indigo-600' : 'bg-slate-700'}`}>
												<div class={() => `w-4 h-4 rounded-full bg-white transition-all transform ${switchState.value ? 'translate-x-6' : 'translate-x-0'}`}></div>
											</div>
										</div>
									</div>
								</div>
							</div>
						);
					}

					// 5. FORMS & INPUTS TAB
					if (activeTab.value === 'forms') {
						return (
							<div class="flex flex-col gap-6">
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-5">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Form Controls with Focus Rings</h3>

									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="flex flex-col gap-1.5">
											<label class="text-xs font-bold text-slate-300">Search Utility Classes</label>
											<input
												type="text"
												placeholder="e.g. flex, p-4, bg-indigo-500..."
												value={() => searchQuery.value}
												onInput={(e: any) => searchQuery.value = e.target.value}
												class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
											/>
										</div>

										<div class="flex flex-col gap-1.5">
											<label class="text-xs font-bold text-slate-300">Select Compiler Target</label>
											<select class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer">
												<option>Tailwind CSS v4 (Standard)</option>
												<option>Tailwind CSS v3 (Legacy Preflight)</option>
												<option>Custom PostCSS Pipeline</option>
											</select>
										</div>
									</div>

									<div class="flex flex-col gap-1.5">
										<label class="text-xs font-bold text-slate-300">Custom CSS Code Block</label>
										<textarea
											rows={3}
											placeholder="@tailwind base;\n@tailwind utilities;"
											class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-indigo-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
										></textarea>
									</div>

									<div class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
										<span>Input Value Live Signal:</span>
										<span class="font-mono text-indigo-400">{() => searchQuery.value || '(empty search)'}</span>
									</div>
								</div>
							</div>
						);
					}

					// 6. COLOR PALETTE TAB
					if (activeTab.value === 'palette') {
						return (
							<div class="flex flex-col gap-6">
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<div class="flex items-center justify-between">
										<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">22 Complete Tailwind Palettes (50 - 950)</h3>
										<div class="flex gap-2">
											{Object.keys(colorPalettes).map(colorKey => (
												<button
													type="button"
													key={colorKey}
													onClick={() => activeColor.value = colorKey}
													class={() => `px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
														activeColor.value === colorKey
															? 'bg-slate-100 text-slate-900 shadow-md font-black'
															: 'bg-slate-800 text-slate-400 hover:text-white'
													}`}
												>
													{colorKey}
												</button>
											))}
										</div>
									</div>

									{/* Color Swatch Bars */}
									<div class="grid grid-cols-2 md:grid-cols-6 gap-3 mt-2">
										{() => {
											const currentList = colorPalettes[activeColor.value] || colorPalettes.indigo;
											return currentList.map(item => (
												<div key={item.name} class={`p-4 rounded-2xl ${item.bg} ${item.text} flex flex-col justify-between h-28 shadow-md`}>
													<div class="font-black text-sm">{item.name}</div>
													<div class="font-mono text-xs opacity-90">{item.hex}</div>
												</div>
											));
										}}
									</div>
								</div>

								{/* Opacity Slash Syntax */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Color Opacity Modifiers (Slash Syntax)</h3>
									<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
										<div class="p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono text-center">
											bg-indigo-600/10
										</div>
										<div class="p-4 rounded-xl bg-indigo-600/25 border border-indigo-500/30 text-indigo-200 text-xs font-mono text-center">
											bg-indigo-600/25
										</div>
										<div class="p-4 rounded-xl bg-indigo-600/50 border border-indigo-500/40 text-white text-xs font-mono text-center">
											bg-indigo-600/50
										</div>
										<div class="p-4 rounded-xl bg-indigo-600/75 text-white text-xs font-mono text-center">
											bg-indigo-600/75
										</div>
										<div class="p-4 rounded-xl bg-indigo-600 text-white text-xs font-mono text-center shadow-lg shadow-indigo-600/30">
											bg-indigo-600 (100%)
										</div>
									</div>
								</div>
							</div>
						);
					}

					// 7. GRID & FLEX TAB
					if (activeTab.value === 'layout') {
						return (
							<div class="flex flex-col gap-6">
								{/* Responsive Grid Demo */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Responsive Grid Layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)</h3>
									<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
										{[1, 2, 3, 4].map(n => (
											<div key={n} class="p-6 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-indigo-400 text-sm shadow-inner">
												Col Span {n}
											</div>
										))}
									</div>
								</div>

								{/* Flexbox Alignments Demo */}
								<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Flexbox Justify & Align</h3>
									<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
										<div class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">justify-between 1</div>
										<div class="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold">justify-between 2</div>
										<div class="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold">justify-between 3</div>
									</div>
								</div>
							</div>
						);
					}

					// 8. ANIMATIONS TAB
					return (
						<div class="flex flex-col gap-6">
							<div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-5">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Animation Keyframe Showcase</h3>
									<div class="flex gap-2">
										{(['spin', 'ping', 'pulse', 'bounce'] as const).map(anim => (
											<button
												type="button"
												key={anim}
												onClick={() => animationType.value = anim}
												class={() => `px-3 py-1 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
													animationType.value === anim
														? 'bg-indigo-600 text-white shadow-md'
														: 'bg-slate-800 text-slate-400 hover:text-white'
												}`}
											>
												{anim}
											</button>
										))}
									</div>
								</div>

								<div class="p-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-8">
									<div class={() => `w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-2xl shadow-xl shadow-indigo-500/30 ${
										animationType.value === 'spin' ? 'animate-spin' :
										animationType.value === 'ping' ? 'animate-ping' :
										animationType.value === 'pulse' ? 'animate-pulse' : 'animate-bounce'
									}`}>
										⚡
									</div>
								</div>

								<div class="text-center text-xs text-slate-400 font-mono">
									Active Class: <strong class="text-indigo-400">animate-{() => animationType.value}</strong>
								</div>
							</div>
						</div>
					);
				}}
			</section>
		</main>
	);
}
