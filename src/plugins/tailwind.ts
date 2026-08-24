import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

export interface TailwindPluginOptions {
	config?: any;
	content?: string[];
	inputCSS?: string;
	plugins?: any[];
	minify?: boolean;
	projectRoot?: string;
}

const COLORS: Record<string, Record<string | number, string> | string> = {
	slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
	gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' },
	zinc: { 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' },
	neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
	stone: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09' },
	red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' },
	orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' },
	rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
	amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
	yellow: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006' },
	lime: { 50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635', 500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05' },
	emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
	green: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' },
	teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
	cyan: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
	sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
	blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
	indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
	purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
	violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
	fuchsia: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e' },
	pink: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f472b6', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724' },
	white: '#ffffff',
	black: '#000000',
	transparent: 'transparent',
	current: 'currentColor',
	inherit: 'inherit'
};

const SPACING: Record<string, string> = {
	'0': '0px', '0.5': '0.125rem', '1': '0.25rem', '1.5': '0.375rem', '2': '0.5rem', '2.5': '0.625rem',
	'3': '0.75rem', '3.5': '0.875rem', '4': '1rem', '5': '1.25rem', '6': '1.5rem', '7': '1.75rem',
	'8': '2rem', '9': '2.25rem', '10': '2.5rem', '11': '2.75rem', '12': '3rem', '14': '3.5rem',
	'16': '4rem', '20': '5rem', '24': '6rem', '28': '7rem', '32': '8rem', '36': '9rem', '40': '10rem',
	'44': '11rem', '48': '12rem', '52': '13rem', '56': '14rem', '60': '15rem', '64': '16rem', '72': '18rem', '80': '20rem', '96': '24rem',
	'px': '1px', 'auto': 'auto', 'full': '100%', 'screen': '100vh', 'min': 'min-content', 'max': 'max-content', 'fit': 'fit-content',
	'1/2': '50%', '1/3': '33.333333%', '2/3': '66.666667%', '1/4': '25%', '2/4': '50%', '3/4': '75%',
	'1/5': '20%', '2/5': '40%', '3/5': '60%', '4/5': '80%', '1/6': '16.666667%', '5/6': '83.333333%',
	'1/12': '8.333333%', '2/12': '16.666667%', '3/12': '25%', '4/12': '33.333333%', '5/12': '41.666667%', '6/12': '50%', '7/12': '58.333333%', '8/12': '66.666667%', '9/12': '75%', '10/12': '83.333333%', '11/12': '91.666667%'
};

const BREAKPOINTS: Record<string, string> = {
	sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px'
};

function escapeSelector(raw: string): string {
	return raw.replace(/([:.\/\\\[\]#%])/g, '\\$1');
}

function resolveColor(name: string): string | null {
	if (COLORS[name] && typeof COLORS[name] === 'string') return COLORS[name] as string;
	if (name.startsWith('[#') && name.endsWith(']')) return '#' + name.slice(2, -1);
	if (name.startsWith('[') && name.endsWith(']')) return name.slice(1, -1);

	let opacity = '';
	if (name.includes('/')) {
		const [colorPart, opPart] = name.split('/');
		name = colorPart;
		opacity = opPart;
	}

	const parts = name.split('-');
	let hex: string | null = null;
	if (parts.length >= 2) {
		const palette = COLORS[parts[0]];
		if (palette && typeof palette === 'object') {
			const shade = parts[1];
			if (palette[shade]) hex = palette[shade];
		}
	} else if (COLORS[name] && typeof COLORS[name] === 'string') {
		hex = COLORS[name] as string;
	}

	if (hex && opacity) {
		const op = Number(opacity) / (Number(opacity) > 1 ? 100 : 1);
		if (hex.startsWith('#') && hex.length === 7) {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return `rgba(${r}, ${g}, ${b}, ${op})`;
		}
	}
	return hex;
}

function parseUtilityClass(className: string): { selector: string; media?: string; decls: string } | null {
	let raw = className;
	let media: string | undefined;
	let pseudo = '';
	let isDark = false;

	// Check breakpoint prefix e.g. md:
	for (const bp of Object.keys(BREAKPOINTS)) {
		if (raw.startsWith(`${bp}:`)) {
			media = `(min-width: ${BREAKPOINTS[bp]})`;
			raw = raw.slice(bp.length + 1);
			break;
		}
	}

	// Check dark mode
	if (raw.startsWith('dark:')) {
		isDark = true;
		raw = raw.slice(5);
	}

	// Check pseudo-class prefix e.g. hover:, focus:, active:
	for (const ps of ['hover', 'focus', 'active', 'disabled', 'focus-within', 'focus-visible']) {
		if (raw.startsWith(`${ps}:`)) {
			pseudo = `:${ps}`;
			raw = raw.slice(ps.length + 1);
			break;
		}
	}

	let selector = `.${escapeSelector(className)}${pseudo}`;
	if (isDark) {
		selector = `[data-theme="dark"] .${escapeSelector(className)}${pseudo}, .dark .${escapeSelector(className)}${pseudo}`;
	}

	let decls: string | null = null;

	// Spacing: p-*, px-*, py-*, pt-*, pb-*, pl-*, pr-*, m-*, mx-*, my-*, mt-*, mb-*, ml-*, mr-*
	const spaceMatch = raw.match(/^([mp][xytblr]?)-([\d./]+|px|auto|full)$/);
	if (spaceMatch) {
		const [, prop, val] = spaceMatch;
		const cssVal = SPACING[val] || `${Number(val) * 0.25}rem`;
		const map: Record<string, string[]> = {
			p: ['padding'], px: ['padding-left', 'padding-right'], py: ['padding-top', 'padding-bottom'],
			pt: ['padding-top'], pb: ['padding-bottom'], pl: ['padding-left'], pr: ['padding-right'],
			m: ['margin'], mx: ['margin-left', 'margin-right'], my: ['margin-top', 'margin-bottom'],
			mt: ['margin-top'], mb: ['margin-bottom'], ml: ['margin-left'], mr: ['margin-right']
		};
		if (map[prop]) decls = map[prop].map(p => `${p}: ${cssVal};`).join(' ');
	}

	// Sizing: w-*, h-*, min-w-*, max-w-*, min-h-*, max-h-*
	if (!decls) {
		const sizeMatch = raw.match(/^(min-w|max-w|min-h|max-h|[wh])-([\w./\[\]#-]+)$/);
		if (sizeMatch) {
			const [, prop, val] = sizeMatch;
			const maxWMap: Record<string, string> = {
				xs: '20rem', sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem', '3xl': '48rem',
				'4xl': '56rem', '5xl': '64rem', '6xl': '72rem', '7xl': '80rem', full: '100%', min: 'min-content',
				max: 'max-content', fit: 'fit-content', 'screen-sm': '640px', 'screen-md': '768px', 'screen-lg': '1024px', 'screen-xl': '1280px'
			};
			let cssVal = SPACING[val] || maxWMap[val];
			if (!cssVal) {
				if (val.startsWith('[') && val.endsWith(']')) cssVal = val.slice(1, -1);
				else if (!isNaN(Number(val))) cssVal = `${Number(val) * 0.25}rem`;
			}
			if (cssVal) {
				const propMap: Record<string, string> = {
					w: 'width', h: 'height', 'min-w': 'min-width', 'max-w': 'max-width', 'min-h': 'min-height', 'max-h': 'max-height'
				};
				if (propMap[prop]) decls = `${propMap[prop]}: ${cssVal};`;
			}
		}
	}

	// Gap: gap-*, gap-x-*, gap-y-*
	if (!decls) {
		const gapMatch = raw.match(/^gap(-[xy])?-([\d./]+|px)$/);
		if (gapMatch) {
			const [, dir, val] = gapMatch;
			const cssVal = SPACING[val] || `${Number(val) * 0.25}rem`;
			if (!dir) decls = `gap: ${cssVal};`;
			else if (dir === '-x') decls = `column-gap: ${cssVal};`;
			else if (dir === '-y') decls = `row-gap: ${cssVal};`;
		}
	}

	// Colors: bg-*, text-*, border-*
	if (!decls) {
		if (raw.startsWith('bg-')) {
			const col = resolveColor(raw.slice(3));
			if (col) decls = `background-color: ${col};`;
		} else if (raw.startsWith('text-')) {
			const col = resolveColor(raw.slice(5));
			if (col) decls = `color: ${col};`;
		} else if (raw.startsWith('border-') && !raw.startsWith('border-b') && !raw.startsWith('border-t') && !raw.startsWith('border-l') && !raw.startsWith('border-r') && !raw.startsWith('border-solid') && !raw.startsWith('border-dashed') && !raw.startsWith('border-dotted') && !raw.startsWith('border-none')) {
			const col = resolveColor(raw.slice(7));
			if (col) decls = `border-color: ${col};`;
		}
	}

	// Typography: text-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl}
	if (!decls && raw.startsWith('text-')) {
		const textSizes: Record<string, string> = {
			'text-xs': 'font-size: 0.75rem; line-height: 1rem;',
			'text-sm': 'font-size: 0.875rem; line-height: 1.25rem;',
			'text-base': 'font-size: 1rem; line-height: 1.5rem;',
			'text-lg': 'font-size: 1.125rem; line-height: 1.75rem;',
			'text-xl': 'font-size: 1.25rem; line-height: 1.75rem;',
			'text-2xl': 'font-size: 1.5rem; line-height: 2rem;',
			'text-3xl': 'font-size: 1.875rem; line-height: 2.25rem;',
			'text-4xl': 'font-size: 2.25rem; line-height: 2.5rem;',
			'text-5xl': 'font-size: 3rem; line-height: 1;',
			'text-6xl': 'font-size: 3.75rem; line-height: 1;'
		};
		if (textSizes[raw]) decls = textSizes[raw];
	}

	// Font weight & Family
	if (!decls && raw.startsWith('font-')) {
		const weights: Record<string, string> = {
			'font-thin': 'font-weight: 100;', 'font-extralight': 'font-weight: 200;', 'font-light': 'font-weight: 300;',
			'font-normal': 'font-weight: 400;', 'font-medium': 'font-weight: 500;', 'font-semibold': 'font-weight: 600;',
			'font-bold': 'font-weight: 700;', 'font-extrabold': 'font-weight: 800;', 'font-black': 'font-weight: 900;',
			'font-sans': 'font-family: ui-sans-serif, system-ui, sans-serif;',
			'font-serif': 'font-family: ui-serif, Georgia, serif;',
			'font-mono': 'font-family: ui-monospace, SFMono-Regular, Menlo, monospace;'
		};
		if (weights[raw]) decls = weights[raw];
	}

	// Radii: rounded-*
	if (!decls && raw.startsWith('rounded')) {
		const radii: Record<string, string> = {
			'rounded-none': 'border-radius: 0px;', 'rounded-sm': 'border-radius: 0.125rem;', rounded: 'border-radius: 0.25rem;',
			'rounded-md': 'border-radius: 0.375rem;', 'rounded-lg': 'border-radius: 0.5rem;', 'rounded-xl': 'border-radius: 0.75rem;',
			'rounded-2xl': 'border-radius: 1rem;', 'rounded-3xl': 'border-radius: 1.5rem;', 'rounded-full': 'border-radius: 9999px;',
			'rounded-t-lg': 'border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem;',
			'rounded-b-lg': 'border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem;',
			'rounded-t-xl': 'border-top-left-radius: 0.75rem; border-top-right-radius: 0.75rem;',
			'rounded-b-xl': 'border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem;'
		};
		if (radii[raw]) decls = radii[raw];
	}

	// Shadows: shadow-*
	if (!decls && raw.startsWith('shadow')) {
		const shadows: Record<string, string> = {
			'shadow-none': 'box-shadow: none;',
			'shadow-sm': 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);',
			shadow: 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);',
			'shadow-md': 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);',
			'shadow-lg': 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);',
			'shadow-xl': 'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);',
			'shadow-2xl': 'box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);',
			'shadow-inner': 'box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);'
		};
		if (shadows[raw]) decls = shadows[raw];
	}

	// Grid template columns: grid-cols-*
	if (!decls && raw.startsWith('grid-cols-')) {
		const n = raw.slice(10);
		if (n === 'none') decls = 'grid-template-columns: none;';
		else if (/^\d+$/.test(n)) decls = `grid-template-columns: repeat(${n}, minmax(0, 1fr));`;
	}

	// Grid column span: col-span-*
	if (!decls && raw.startsWith('col-span-')) {
		const n = raw.slice(9);
		if (n === 'full') decls = 'grid-column: 1 / -1;';
		else if (/^\d+$/.test(n)) decls = `grid-column: span ${n} / span ${n};`;
	}

	// Borders
	if (!decls) {
		const borders: Record<string, string> = {
			border: 'border-width: 1px; border-style: solid;',
			'border-0': 'border-width: 0px;',
			'border-2': 'border-width: 2px; border-style: solid;',
			'border-4': 'border-width: 4px; border-style: solid;',
			'border-8': 'border-width: 8px; border-style: solid;',
			'border-t': 'border-top-width: 1px; border-top-style: solid;',
			'border-b': 'border-bottom-width: 1px; border-bottom-style: solid;',
			'border-l': 'border-left-width: 1px; border-left-style: solid;',
			'border-r': 'border-right-width: 1px; border-right-style: solid;',
			'border-t-0': 'border-top-width: 0px;', 'border-b-0': 'border-bottom-width: 0px;',
			'border-solid': 'border-style: solid;', 'border-dashed': 'border-style: dashed;',
			'border-dotted': 'border-style: dotted;', 'border-none': 'border-style: none;'
		};
		if (borders[raw]) decls = borders[raw];
	}

	// Opacity
	if (!decls && raw.startsWith('opacity-')) {
		const n = Number(raw.slice(8));
		if (!isNaN(n)) decls = `opacity: ${n / 100};`;
	}

	// Backdrop Blur (Glassmorphism)
	if (!decls && raw.startsWith('backdrop-blur')) {
		const blurs: Record<string, string> = {
			'backdrop-blur-none': 'backdrop-filter: blur(0); -webkit-backdrop-filter: blur(0);',
			'backdrop-blur-sm': 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);',
			'backdrop-blur': 'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);',
			'backdrop-blur-md': 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
			'backdrop-blur-lg': 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);',
			'backdrop-blur-xl': 'backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);',
			'backdrop-blur-2xl': 'backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);'
		};
		if (blurs[raw]) decls = blurs[raw];
	}

	// Transitions & Transforms
	if (!decls) {
		const trans: Record<string, string> = {
			'transition-none': 'transition-property: none;',
			'transition-all': 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
			transition: 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
			'transition-colors': 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-duration: 150ms;',
			'transition-opacity': 'transition-property: opacity; transition-duration: 150ms;',
			'duration-75': 'transition-duration: 75ms;', 'duration-100': 'transition-duration: 100ms;',
			'duration-150': 'transition-duration: 150ms;', 'duration-200': 'transition-duration: 200ms;',
			'duration-300': 'transition-duration: 300ms;', 'duration-500': 'transition-duration: 500ms;',
			'duration-700': 'transition-duration: 700ms;', 'duration-1000': 'transition-duration: 1000ms;',
			'ease-linear': 'transition-timing-function: linear;', 'ease-in': 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1);',
			'ease-out': 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1);', 'ease-in-out': 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);',
			'scale-90': 'transform: scale(0.9);', 'scale-95': 'transform: scale(0.95);', 'scale-100': 'transform: scale(1);',
			'scale-105': 'transform: scale(1.05);', 'scale-110': 'transform: scale(1.1);', 'transform': 'transform: translateZ(0);'
		};
		if (trans[raw]) decls = trans[raw];
	}

	// Common utilities & Flex/Grid/Layout
	if (!decls) {
		const staticMap: Record<string, string> = {
			flex: 'display: flex;', 'inline-flex': 'display: inline-flex;', grid: 'display: grid;', 'inline-grid': 'display: inline-grid;',
			'flex-col': 'flex-direction: column;', 'flex-row': 'flex-direction: row;', 'flex-wrap': 'flex-wrap: wrap;', 'flex-nowrap': 'flex-wrap: nowrap;',
			'flex-1': 'flex: 1 1 0%;', 'flex-auto': 'flex: 1 1 auto;', 'flex-initial': 'flex: 0 1 auto;', 'flex-none': 'flex: none;',
			grow: 'flex-grow: 1;', 'grow-0': 'flex-grow: 0;', shrink: 'flex-shrink: 1;', 'shrink-0': 'flex-shrink: 0;',
			'items-center': 'align-items: center;', 'items-start': 'align-items: flex-start;', 'items-end': 'align-items: flex-end;', 'items-baseline': 'align-items: baseline;', 'items-stretch': 'align-items: stretch;',
			'justify-between': 'justify-content: space-between;', 'justify-center': 'justify-content: center;',
			'justify-start': 'justify-content: flex-start;', 'justify-end': 'justify-content: flex-end;', 'justify-around': 'justify-content: space-around;', 'justify-evenly': 'justify-content: space-evenly;',
			'cursor-pointer': 'cursor: pointer;', 'cursor-not-allowed': 'cursor: not-allowed;', 'cursor-default': 'cursor: default;',
			uppercase: 'text-transform: uppercase;', lowercase: 'text-transform: lowercase;', capitalize: 'text-transform: capitalize;', 'normal-case': 'text-transform: none;',
			'tracking-wider': 'letter-spacing: 0.05em;', 'tracking-widest': 'letter-spacing: 0.1em;', 'tracking-tight': 'letter-spacing: -0.025em;', 'tracking-tighter': 'letter-spacing: -0.05em;',
			'leading-none': 'line-height: 1;', 'leading-tight': 'line-height: 1.25;', 'leading-snug': 'line-height: 1.375;', 'leading-normal': 'line-height: 1.5;', 'leading-relaxed': 'line-height: 1.625;', 'leading-loose': 'line-height: 2;',
			'text-left': 'text-align: left;', 'text-center': 'text-align: center;', 'text-right': 'text-align: right;', 'text-justify': 'text-align: justify;',
			truncate: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
			'whitespace-nowrap': 'white-space: nowrap;', 'whitespace-normal': 'white-space: normal;',
			'select-none': 'user-select: none;', 'select-text': 'user-select: text;', 'select-all': 'user-select: all;',
			'pointer-events-none': 'pointer-events: none;', 'pointer-events-auto': 'pointer-events: auto;',
			relative: 'position: relative;', absolute: 'position: absolute;', fixed: 'position: fixed;', sticky: 'position: sticky;',
			'inset-0': 'inset: 0px;', 'top-0': 'top: 0px;', 'bottom-0': 'bottom: 0px;', 'left-0': 'left: 0px;', 'right-0': 'right: 0px;',
			'z-0': 'z-index: 0;', 'z-10': 'z-index: 10;', 'z-20': 'z-index: 20;', 'z-30': 'z-index: 30;', 'z-40': 'z-index: 40;', 'z-50': 'z-index: 50;', 'z-auto': 'z-index: auto;',
			'overflow-auto': 'overflow: auto;', 'overflow-hidden': 'overflow: hidden;', 'overflow-x-auto': 'overflow-x: auto;', 'overflow-y-auto': 'overflow-y: auto;',
			hidden: 'display: none;', block: 'display: block;', 'inline-block': 'display: inline-block;', inline: 'display: inline;'
		};
		if (staticMap[raw]) decls = staticMap[raw];
	}

	if (!decls) return null;
	return { selector, media, decls };
}

function generateTailwindCSS(classes: Iterable<string>): string {
	const rules: string[] = [];
	const mediaRules: Record<string, string[]> = {};

	for (const cls of classes) {
		const parsed = parseUtilityClass(cls);
		if (!parsed) continue;
		if (parsed.media) {
			if (!mediaRules[parsed.media]) mediaRules[parsed.media] = [];
			mediaRules[parsed.media].push(`${parsed.selector} { ${parsed.decls} }`);
		} else {
			rules.push(`${parsed.selector} { ${parsed.decls} }`);
		}
	}

	for (const [media, mRules] of Object.entries(mediaRules)) {
		rules.push(`@media ${media} {\n  ${mRules.join('\n  ')}\n}`);
	}

	return rules.join('\n');
}

async function scanClassesInFiles(files: string[]): Promise<Set<string>> {
	const classes = new Set<string>();
	for (const file of files) {
		try {
			const text = await fs.readFile(file, 'utf8');
			const re = /(?:class|className)\s*=\s*(?:["'`{]([^"'`{}]+)["'`}]|{[^}]*})/g;
			let m;
			while ((m = re.exec(text))) {
				const val = m[1] || m[0];
				const tokens = val.match(/[\w\-:.\/\[\]#%]+/g) || [];
				for (const t of tokens) {
					if (t && !t.includes('class') && !t.includes('return') && !t.includes('=')) {
						classes.add(t);
					}
				}
			}
			const strMatches = text.match(/['"`]([\w\-:.\/\[\]#%\s]+)['"`]/g) || [];
			for (const sm of strMatches) {
				const inner = sm.slice(1, -1).trim();
				if (inner.includes(' ') || inner.startsWith('bg-') || inner.startsWith('text-') || inner.startsWith('p-') || inner.startsWith('flex') || inner.startsWith('grid') || inner.startsWith('rounded') || inner.startsWith('hover:') || inner.startsWith('dark:')) {
					for (const part of inner.split(/\s+/)) {
						if (part) classes.add(part);
					}
				}
			}
		} catch { }
	}
	return classes;
}

export function litheTailwindPlugin(options: TailwindPluginOptions = {}) {
	return {
		name: 'lithe-tailwind-plugin',

		async compile(inputCSS?: string, contentFiles: string[] = []): Promise<string> {
			const baseCSS = inputCSS || options.inputCSS || '@tailwind base;\n@tailwind components;\n@tailwind utilities;';

			try {
				const twPostcss = await import('@tailwindcss/postcss').catch(() => null);
				const postcssModule = await import('postcss').catch(() => null);
				const postcss = (postcssModule as any)?.default || postcssModule;
				const plugin = (twPostcss as any)?.default || twPostcss;

				if (postcss && plugin) {
					const plugins = [plugin(options.config || {}), ...(options.plugins || [])];
					const result = await postcss(plugins).process(baseCSS, { from: undefined });
					return result.css;
				}
			} catch { }

			try {
				const tailwindModule = await import('tailwindcss').catch(() => null);
				const postcssModule = await import('postcss').catch(() => null);
				const tailwind = (tailwindModule as any)?.default || tailwindModule;
				const postcss = (postcssModule as any)?.default || postcssModule;

				if (postcss && tailwind) {
					let twConfig = options.config;
					if (typeof twConfig === 'string') {
						const configPath = path.resolve(twConfig);
						twConfig = (await import(configPath)).default || (await import(configPath));
					} else if (!twConfig) {
						twConfig = {
							content: contentFiles.length ? contentFiles : ['./src/**/*.{html,js,ts,jsx,tsx}', './index.html'],
							theme: { extend: {} },
							plugins: []
						};
					}

					const plugins = [tailwind(twConfig), ...(options.plugins || [])];
					const result = await postcss(plugins).process(baseCSS, { from: undefined });
					return result.css;
				}
			} catch { }

			const projectRoot = options.projectRoot || process.cwd();
			let filesToScan = contentFiles;
			if (!filesToScan.length) {
				const collect = (dir: string): string[] => {
					const out: string[] = [];
					try {
						for (const f of fsSync.readdirSync(dir)) {
							const full = path.join(dir, f);
							if (fsSync.statSync(full).isDirectory()) {
								if (!f.startsWith('.') && f !== 'node_modules' && f !== 'dist') out.push(...collect(full));
							} else if (/\.(tsx|ts|jsx|js|html)$/.test(f)) {
								out.push(full);
							}
						}
					} catch { }
					return out;
				};
				filesToScan = collect(projectRoot);
			}

			const extractedClasses = await scanClassesInFiles(filesToScan);
			const generatedUtilities = generateTailwindCSS(extractedClasses);

			let output = baseCSS;
			if (output.includes('@tailwind utilities;')) {
				output = output.replace('@tailwind utilities;', `/* [lithe-tailwind: utilities] */\n${generatedUtilities}`);
			} else if (!output.includes('/* [lithe-tailwind: utilities] */')) {
				output = `${output}\n/* [lithe-tailwind: utilities] */\n${generatedUtilities}`;
			}
			output = output.replace(/@tailwind\s+(base|components);\s*/g, '');
			return output.trim();
		},

		transformIndexHtml(html: string, generatedCSS: string) {
			if (!generatedCSS) return html;
			const styleTag = `<style data-lithe-tailwind>\n${generatedCSS}\n</style>`;
			return html.includes('</head>') ? html.replace('</head>', `${styleTag}\n</head>`) : `${styleTag}\n${html}`;
		}
	};
}

export async function compileTailwind(css: string, config?: any): Promise<string> {
	const plugin = litheTailwindPlugin({ config, ...(typeof config === 'object' ? config : {}) });
	return plugin.compile(css);
}

export default litheTailwindPlugin;


