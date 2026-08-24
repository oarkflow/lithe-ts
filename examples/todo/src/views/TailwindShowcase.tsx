import { signal } from 'lithe/core';
import { Panel } from '../components/Panel.tsx';

export function TailwindShowcase() {
	const activeTab = signal<'badges' | 'cards' | 'buttons'>('badges');
	const clickCount = signal(0);

	return (
		<Panel className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700">
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between border-b border-slate-700 pb-4">
					<div>
						<h2 class="text-xl font-bold text-indigo-500">🎨 Tailwind CSS Plugin Showcase</h2>
						<p class="text-sm text-slate-400">Zero-runtime utility classes generated via <code>lithe/tailwind</code></p>
					</div>
					<div class="flex items-center gap-2">
						<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500 text-white shadow-sm">
							Plugin Active
						</span>
					</div>
				</div>

				{/* Interactive tab navigation */}
				<div class="flex gap-2">
					<button
						type="button"
						class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
						onClick={() => activeTab.value = 'badges'}
					>
						🏷️ Badges & Pills
					</button>
					<button
						type="button"
						class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700"
						onClick={() => activeTab.value = 'cards'}
					>
						🃏 Metric Cards
					</button>
					<button
						type="button"
						class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700"
						onClick={() => activeTab.value = 'buttons'}
					>
						⚡ Interactive Buttons
					</button>
				</div>

				{/* Utility Cards Grid */}
				<div class="grid gap-4 mt-2">
					<div class="p-4 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-lg shadow-md">
								TL
							</div>
							<div>
								<div class="font-semibold text-white">Utility-First Speed</div>
								<div class="text-xs text-slate-400">Generated on-demand at compile time</div>
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

					<div class="flex flex-wrap gap-2 pt-2">
						<span class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
							flex-row
						</span>
						<span class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
							justify-between
						</span>
						<span class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
							rounded-xl
						</span>
						<span class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
							bg-indigo-600
						</span>
						<span class="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
							shadow-lg
						</span>
					</div>
				</div>
			</div>
		</Panel>
	);
}
