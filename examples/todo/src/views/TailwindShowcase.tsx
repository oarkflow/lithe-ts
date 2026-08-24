import { signal } from 'lithe/core';
import { Link } from 'lithe/router';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

type TabType = 'overview' | 'buttons' | 'glass' | 'cards' | 'badges' | 'forms' | 'palette' | 'layout' | 'animations';

export function TailwindShowcase() {
	const activeTab = signal<TabType>('overview');
	const clickCount = signal(42);
	const toggleState = signal(true);
	const switchState = signal(false);
	const selectedCategory = signal('all');
	const searchQuery = signal('');
	const activeColor = signal('indigo');
	const animationType = signal<'spin' | 'ping' | 'pulse' | 'bounce'>('pulse');
	const glassBlur = signal<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('xl');

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
		<main class="relative min-h-screen bg-slate-950 text-slate-100 px-6 py-12 lg:px-12 font-sans overflow-hidden">
			{/* Ambient Glowing Background Orbs to Power Glassmorphism & Depth */}
			<div class="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
			<div class="absolute top-1/3 -right-40 w-[32rem] h-[32rem] bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
			<div class="absolute bottom-1/4 left-1/4 w-[28rem] h-[28rem] bg-pink-600/10 rounded-full blur-3xl pointer-events-none"></div>
			<div class="absolute -bottom-40 right-1/4 w-[32rem] h-[32rem] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

			<div class="relative z-10 max-w-6xl mx-auto flex flex-col gap-10">
				{/* Top Bar / Navigation with Generous Breathing Room */}
				<header class="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
							<span class="text-2xl font-black text-white">⚡</span>
						</div>
						<div>
							<div class="flex items-center gap-3">
								<h1 class="text-2xl font-extrabold text-white tracking-tight">Tailwind CSS Engine</h1>
								<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									v3 & v4 Native
								</span>
							</div>
							<p class="text-xs text-slate-400 mt-0.5">Zero-dependency compiler, arbitrary values, responsive layers & reactive state</p>
						</div>
					</div>

					<nav class="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 shadow-lg">
						<Link to="/" class="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
							🏠 Tasks
						</Link>
						<Link to="/projects" class="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
							📁 Projects
						</Link>
						<Link to="/remote" class="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
							☁️ Remote
						</Link>
						<div class="h-4 w-px bg-slate-700 mx-1"></div>
						<ThemeToggle />
					</nav>
				</header>

				{/* 9 Interactive Showcase Navigation Tabs */}
				<nav class="flex items-center gap-2 overflow-x-auto pb-3 border-b border-slate-800/80">
					{(
						[
							{ id: 'overview', label: '🚀 Overview & Hero', icon: '✨' },
							{ id: 'buttons', label: '⚡ Interactive Buttons', icon: '🔘' },
							{ id: 'glass', label: '💎 Glassmorphism Lab', icon: '🔮' },
							{ id: 'cards', label: '🃏 Metric Cards', icon: '📊' },
							{ id: 'badges', label: '🏷️ Badges & Pills', icon: '🏷️' },
							{ id: 'forms', label: '📝 Forms & Inputs', icon: '⌨️' },
							{ id: 'palette', label: '🎨 22 Color Palettes', icon: '🌈' },
							{ id: 'layout', label: '📐 Flex & Grid Layout', icon: '🧩' },
							{ id: 'animations', label: '💫 Micro-Animations', icon: '🌀' }
						] as const
					).map(tab => (
						<button
							type="button"
							key={tab.id}
							onClick={() => activeTab.value = tab.id}
							class={() => `px-4 py-2.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-2 border select-none outline-none ${
								activeTab.value === tab.id
									? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border-indigo-500'
									: 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
							}`}
						>
							<span>{tab.icon}</span>
							<span>{tab.label}</span>
						</button>
					))}
				</nav>

				{/* Dynamic View Tab Content with Clean Spacing */}
				<section class="flex flex-col gap-8">
					{() => {
						// 1. OVERVIEW HERO TAB
						if (activeTab.value === 'overview') {
							return (
								<div class="flex flex-col gap-8">
									{/* Hero Glass Card with Live Signal State */}
									<div class="relative overflow-hidden p-8 md:p-12 rounded-3xl bg-slate-900/60 border border-slate-800/90 shadow-2xl backdrop-blur-2xl">
										<div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
											<div class="max-w-2xl flex flex-col gap-4">
												<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-xs font-medium w-fit">
													<span class="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
													<span>Zero-Runtime Tailwind Compilation</span>
												</div>
												<h2 class="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
													Full Tailwind v3 & v4 Utilities Inside Lithe
												</h2>
												<p class="text-sm md:text-base text-slate-300 leading-relaxed">
													Experience 100% native Tailwind CSS utility classes, arbitrary values, gradient stops, glassmorphism, responsive grid breakpoints, pseudo-states, and micro-interactions with zero third-party dependencies.
												</p>
											</div>

											<div class="flex flex-col gap-3 shrink-0">
												<button
													type="button"
													onClick={() => clickCount.value++}
													class="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 cursor-pointer flex items-center gap-3 select-none outline-none"
												>
													<span>⚡ Click Counter:</span>
													<span class="px-2.5 py-0.5 rounded-lg bg-black/30 text-white font-mono font-bold">
														{() => clickCount.value}
													</span>
												</button>
												<button
													type="button"
													onClick={() => activeTab.value = 'glass'}
													class="px-6 py-3 rounded-2xl backdrop-blur-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/15 shadow-md hover:border-white/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 cursor-pointer text-center select-none outline-none"
												>
													Explore Glassmorphism Lab 🔮
												</button>
											</div>
										</div>
									</div>

									{/* 4 Feature Highlights */}
									<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
										{[
											{ icon: '🎨', title: '22 Color Palettes', desc: '50 through 950 shades + arbitrary opacity / hex values' },
											{ icon: '🔮', title: 'Glassmorphism', desc: 'Backdrop blur (sm to 3xl) with subtle frosted borders' },
											{ icon: '📐', title: 'Flex & Grid System', desc: 'Auto columns, arbitrary spans, gap scales & place alignment' },
											{ icon: '⚡', title: 'Signal Reactivity', desc: 'Fine-grained DOM updates without full page re-renders' }
										].map(item => (
											<div class="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-150">
												<div class="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-lg mb-3">
													{item.icon}
												</div>
												<h3 class="text-sm font-bold text-white mb-1">{item.title}</h3>
												<p class="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
											</div>
										))}
									</div>
								</div>
							);
						}

						// 2. INTERACTIVE BUTTONS TAB
						if (activeTab.value === 'buttons') {
							return (
								<div class="flex flex-col gap-8">
									{/* Button Styles Matrix */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col gap-6 shadow-xl">
										<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
											<div>
												<h3 class="text-base font-bold text-white">Button Variants & Micro-Interactions</h3>
												<p class="text-xs text-slate-400 mt-0.5">Smooth active press feedback, hover lifts, glow shadows, with clean zero-ring clicks.</p>
											</div>
											<span class="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 text-xs font-medium w-fit">
												Zero-Ring Pure Click
											</span>
										</div>

										<div class="flex flex-wrap items-center gap-4 pt-2">
											{/* Primary Solid Button */}
											<button
												type="button"
												onClick={() => clickCount.value++}
												class="px-5 py-2.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 select-none outline-none transition-all duration-150 cursor-pointer inline-flex items-center gap-2"
											>
												<span>🚀 Primary (+1)</span>
											</button>

											{/* Emerald Success Button */}
											<button
												type="button"
												onClick={() => clickCount.value += 10}
												class="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 select-none outline-none transition-all duration-150 cursor-pointer inline-flex items-center gap-2"
											>
												<span>✨ Emerald (+10)</span>
											</button>

											{/* Rose Danger Button */}
											<button
												type="button"
												onClick={() => clickCount.value = 0}
												class="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 hover:-translate-y-0.5 active:translate-y-0 select-none outline-none transition-all duration-150 cursor-pointer inline-flex items-center gap-2"
											>
												<span>🗑️ Danger Reset</span>
											</button>

											{/* Frosted Glass Button */}
											<button
												type="button"
												onClick={() => clickCount.value += 5}
												class="px-5 py-2.5 backdrop-blur-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-semibold text-sm rounded-xl border border-white/15 shadow-md hover:border-white/30 hover:-translate-y-0.5 active:translate-y-0 select-none outline-none transition-all duration-150 cursor-pointer inline-flex items-center gap-2"
											>
												<span>🔮 Frosted Glass (+5)</span>
											</button>

											{/* Neon Outline Glow Button */}
											<button
												type="button"
												class="px-5 py-2.5 bg-transparent hover:bg-indigo-500/10 active:scale-95 text-indigo-300 hover:text-indigo-200 font-semibold text-sm rounded-xl border border-indigo-500/40 hover:border-indigo-400 shadow-sm hover:-translate-y-0.5 active:translate-y-0 select-none outline-none transition-all duration-150 cursor-pointer inline-flex items-center gap-2"
											>
												<span>💫 Neon Outline</span>
											</button>

											{/* Disabled Button */}
											<button
												type="button"
												disabled
												class="px-5 py-2.5 bg-slate-900 text-slate-500 font-semibold text-sm rounded-xl border border-slate-800 opacity-50 cursor-not-allowed inline-flex items-center gap-2 select-none outline-none"
											>
												<span>🔒 Disabled</span>
											</button>
										</div>
									</div>

									{/* Reactive Live Signal Counter */}
									<div class="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between shadow-xl">
										<div class="flex items-center gap-4">
											<div class="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-black text-2xl border border-indigo-500/25">
												#
											</div>
											<div>
												<div class="text-base font-bold text-white">Live Reactive Signal Counter</div>
												<div class="text-xs text-slate-400 mt-0.5">Updates the DOM node immediately without re-rendering the whole page</div>
											</div>
										</div>
										<div class="text-4xl font-black text-indigo-400 font-mono tracking-tight">
											{() => clickCount.value}
										</div>
									</div>

									{/* Toggle Switch Controls */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col gap-4 shadow-xl">
										<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Toggle Switches & Binary Signals</h3>
										<div class="flex flex-col md:flex-row gap-6">
											{/* Toggle 1 */}
											<div
												onClick={() => toggleState.value = !toggleState.value}
												class="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-700 transition-all flex-1 select-none"
											>
												<div class="text-xs font-medium text-slate-300">
													Auto-Compile CSS: <span class={() => toggleState.value ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{() => toggleState.value ? 'ENABLED' : 'PAUSED'}</span>
												</div>
												<div class={() => `w-12 h-6 rounded-full p-1 transition-all ${toggleState.value ? 'bg-emerald-500' : 'bg-slate-700'}`}>
													<div class={() => `w-4 h-4 rounded-full bg-white transition-all transform ${toggleState.value ? 'translate-x-6' : 'translate-x-0'}`}></div>
												</div>
											</div>

											{/* Toggle 2 */}
											<div
												onClick={() => switchState.value = !switchState.value}
												class="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-slate-700 transition-all flex-1 select-none"
											>
												<div class="text-xs font-medium text-slate-300">
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

						// 3. GLASSMORPHISM LAB TAB
						if (activeTab.value === 'glass') {
							return (
								<div class="flex flex-col gap-8">
									{/* Interactive Glass Controls */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
										<div>
											<h3 class="text-base font-bold text-white">Interactive Glassmorphism Studio</h3>
											<p class="text-xs text-slate-400 mt-0.5">Change backdrop blur strength to observe real-time glass diffusion over vibrant background mesh</p>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											{(['sm', 'md', 'lg', 'xl', '2xl'] as const).map(b => (
												<button
													type="button"
													key={b}
													onClick={() => glassBlur.value = b}
													class={() => `px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer border select-none outline-none ${
														glassBlur.value === b
															? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
															: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
													}`}
												>
													blur-{b}
												</button>
											))}
										</div>
									</div>

									{/* 3 Glass Cards Over Colored Radial Gradient Backdrops with Generous Gaps */}
									<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
										{/* Glass Card 1: White Frost */}
										<div class="relative overflow-hidden p-8 rounded-3xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl flex flex-col justify-between gap-8">
											<div class="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-2xl shadow-lg">
												❄️
											</div>
											<div>
												<h4 class="text-lg font-bold text-white">White Frost Glass</h4>
												<p class="text-xs text-slate-200 mt-1">Rendered with <code>backdrop-blur-xl bg-white/10 border-white/20</code></p>
											</div>
											<div class="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-200">
												<span>Transmission:</span>
												<span class="font-mono font-bold">92%</span>
											</div>
										</div>

										{/* Glass Card 2: Indigo Prism */}
										<div class="relative overflow-hidden p-8 rounded-3xl backdrop-blur-xl bg-indigo-950/40 border border-indigo-500/30 shadow-2xl flex flex-col justify-between gap-8">
											<div class="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
												💎
											</div>
											<div>
												<h4 class="text-lg font-bold text-white">Indigo Prism Glass</h4>
												<p class="text-xs text-slate-300 mt-1">Rendered with <code>backdrop-blur-xl bg-indigo-950/40 border-indigo-500/30</code></p>
											</div>
											<div class="flex items-center justify-between pt-4 border-t border-indigo-500/20 text-xs text-indigo-300">
												<span>Refraction Index:</span>
												<span class="font-mono font-bold">1.52 (Crown Glass)</span>
											</div>
										</div>

										{/* Glass Card 3: Deep Dark Obsidian */}
										<div class="relative overflow-hidden p-8 rounded-3xl backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 shadow-2xl flex flex-col justify-between gap-8">
											<div class="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-600 flex items-center justify-center text-2xl shadow-lg">
												🌌
											</div>
											<div>
												<h4 class="text-lg font-bold text-white">Dark Obsidian Glass</h4>
												<p class="text-xs text-slate-400 mt-1">Rendered with <code>backdrop-blur-xl bg-slate-900/60 border-slate-700/50</code></p>
											</div>
											<div class="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
												<span>Contrast Ratio:</span>
												<span class="font-mono font-bold text-emerald-400">14.8:1 AAA</span>
											</div>
										</div>
									</div>
								</div>
							);
						}

						// 4. METRIC CARDS TAB
						if (activeTab.value === 'cards') {
							return (
								<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
									{/* Card 1 */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col justify-between gap-6 shadow-xl hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-150">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Signal Updates</span>
											<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
												+36.8M/s
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">2.72 ms</div>
											<div class="text-xs text-slate-400 mt-1.5">100k updates across 1k signals</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full w-full"></div>
										</div>
									</div>

									{/* Card 2 */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col justify-between gap-6 shadow-xl hover:border-purple-500/50 hover:shadow-purple-500/10 transition-all duration-150">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Bundle Footprint</span>
											<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
												Zero Deps
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">12.4 KB</div>
											<div class="text-xs text-slate-400 mt-1.5">Gzipped core runtime & router</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full w-full"></div>
										</div>
									</div>

									{/* Card 3 */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col justify-between gap-6 shadow-xl hover:border-sky-500/50 hover:shadow-sky-500/10 transition-all duration-150">
										<div class="flex items-center justify-between">
											<span class="text-xs font-bold uppercase tracking-wider text-slate-400">TypeScript Passes</span>
											<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25">
												7 Stages
											</span>
										</div>
										<div>
											<div class="text-4xl font-black text-white tracking-tight">100% TSX</div>
											<div class="text-xs text-slate-400 mt-1.5">Native AST & type stripping</div>
										</div>
										<div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
											<div class="bg-gradient-to-r from-sky-500 to-indigo-500 h-1.5 rounded-full w-full"></div>
										</div>
									</div>
								</div>
							);
						}

						// 5. BADGES & PILLS TAB
						if (activeTab.value === 'badges') {
							return (
								<div class="flex flex-col gap-8">
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col gap-6 shadow-xl">
										<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Status & Semantic Badges</h3>
										<div class="flex flex-wrap items-center gap-3">
											<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shadow-sm">
												<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
												Success Active
											</span>
											<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 shadow-sm">
												<span class="w-2 h-2 rounded-full bg-amber-400"></span>
												Warning Paused
											</span>
											<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25 shadow-sm">
												<span class="w-2 h-2 rounded-full bg-rose-400"></span>
												Error Failed
											</span>
											<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25 shadow-sm">
												<span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
												Syncing Live
											</span>
											<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25 shadow-sm">
												<span class="w-2 h-2 rounded-full bg-purple-400"></span>
												VIP Enterprise
											</span>
										</div>
									</div>

									{/* Interactive Category Badges */}
									<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col gap-6 shadow-xl">
										<h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Interactive Filter Badges</h3>
										<div class="flex flex-wrap items-center gap-3">
											{categories.map(c => (
												<button
													type="button"
													key={c.id}
													onClick={() => selectedCategory.value = c.id}
													class={() => `px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer border select-none outline-none ${
														selectedCategory.value === c.id
															? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
															: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
													}`}
												>
													{c.label}
												</button>
											))}
										</div>
									</div>
								</div>
							);
						}

						// 6. FORMS & INPUTS TAB
						if (activeTab.value === 'forms') {
							return (
								<div class="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col gap-6 shadow-xl max-w-2xl">
									<h3 class="text-base font-bold text-white">Form Inputs & Interactive Controls</h3>
									<div class="flex flex-col gap-5">
										<div>
											<label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
												Search Query Signal
											</label>
											<input
												type="text"
												value={() => searchQuery.value}
												onInput={(e: any) => searchQuery.value = e.target.value}
												placeholder="Type anything to test two-way signal binding..."
												class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
											/>
										</div>

										<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
											<span>Live Input Value:</span>
											<span class="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-400 font-bold font-mono">
												{() => searchQuery.value || '(Empty)'}
											</span>
										</div>
									</div>
								</div>
							);
						}

						// 7. 22 COLOR PALETTES TAB
						if (activeTab.value === 'palette') {
							return (
								<div class="flex flex-col gap-8">
									<div class="flex items-center gap-2 overflow-x-auto pb-3">
										{Object.keys(colorPalettes).map(color => (
											<button
												type="button"
												key={color}
												onClick={() => activeColor.value = color}
												class={() => `px-4 py-2 text-xs font-semibold rounded-xl capitalize transition-all duration-150 cursor-pointer border select-none outline-none ${
													activeColor.value === color
														? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/25'
														: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
												}`}
											>
												{color}
											</button>
										))}
									</div>

									<div class="grid grid-cols-2 md:grid-cols-6 gap-4">
										{colorPalettes[activeColor.value]?.map(item => (
											<div key={item.name} class={`p-4 rounded-2xl ${item.bg} ${item.text} flex flex-col justify-between h-24 shadow-md`}>
												<div class="text-xs font-bold">{item.name}</div>
												<div class="text-xs font-mono">{item.hex}</div>
											</div>
										))}
									</div>
								</div>
							);
						}

						// 8. FLEX & GRID LAYOUT TAB
						if (activeTab.value === 'layout') {
							return (
								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
									{[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
										<div class="p-8 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex items-center justify-center font-mono font-bold text-indigo-400 text-xl shadow-lg">
											Grid Item {i}
										</div>
									))}
								</div>
							);
						}

						// 9. ANIMATIONS TAB
						if (activeTab.value === 'animations') {
							return (
								<div class="p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 flex flex-col items-center justify-center gap-8 shadow-xl">
									<div class="flex items-center gap-3">
										{(['spin', 'ping', 'pulse', 'bounce'] as const).map(a => (
											<button
												type="button"
												key={a}
												onClick={() => animationType.value = a}
												class={() => `px-4 py-2 text-xs font-semibold rounded-xl capitalize transition-all duration-150 cursor-pointer border select-none outline-none ${
													animationType.value === a
														? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/25'
														: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
												}`}
											>
												animate-{a}
											</button>
										))}
									</div>

									<div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/25">
										<span class={() => `animate-${animationType.value}`}>⚡</span>
									</div>
								</div>
							);
						}

						return null;
					}}
				</section>
			</div>
		</main>
	);
}

export default TailwindShowcase;
