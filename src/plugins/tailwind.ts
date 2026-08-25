/**
 * Complete Zero-Dependency Tailwind CSS v3 & v4 Compiler Engine for Lithe
 */
import fs from 'node:fs/promises';
import path from 'node:path';

// Standard 22 Color Palettes across Tailwind CSS v3 and v4
const COLORS: Record<string, Record<string, string>> = {
	slate: {
		50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
		500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617'
	},
	gray: {
		50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
		500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712'
	},
	zinc: {
		50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
		500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b'
	},
	neutral: {
		50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3',
		500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a'
	},
	stone: {
		50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e',
		500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09'
	},
	red: {
		50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
		500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a'
	},
	orange: {
		50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
		500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'
	},
	amber: {
		50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
		500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'
	},
	yellow: {
		50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15',
		500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006'
	},
	lime: {
		50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635',
		500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05'
	},
	green: {
		50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
		500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16'
	},
	emerald: {
		50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
		500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22'
	},
	teal: {
		50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
		500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e'
	},
	cyan: {
		50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
		500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344'
	},
	sky: {
		50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
		500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49'
	},
	blue: {
		50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
		500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554'
	},
	indigo: {
		50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
		500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b'
	},
	violet: {
		50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
		500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'
	},
	purple: {
		50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
		500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764'
	},
	fuchsia: {
		50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9',
		500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e'
	},
	pink: {
		50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f472b6', 400: '#f472b6',
		500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724'
	},
	rose: {
		50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
		500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519'
	}
};

const BASE_COLORS: Record<string, string> = {
	white: '#ffffff',
	black: '#000000',
	transparent: 'transparent',
	current: 'currentColor',
	inherit: 'inherit'
};

// Spacing scale mapping
const SPACING: Record<string, string> = {
	'0': '0px',
	'px': '1px',
	'0.5': '0.125rem',
	'1': '0.25rem',
	'1.5': '0.375rem',
	'2': '0.5rem',
	'2.5': '0.625rem',
	'3': '0.75rem',
	'3.5': '0.875rem',
	'4': '1rem',
	'5': '1.25rem',
	'6': '1.5rem',
	'7': '1.75rem',
	'8': '2rem',
	'9': '2.25rem',
	'10': '2.5rem',
	'11': '2.75rem',
	'12': '3rem',
	'14': '3.5rem',
	'16': '4rem',
	'20': '5rem',
	'24': '6rem',
	'28': '7rem',
	'32': '8rem',
	'36': '9rem',
	'40': '10rem',
	'44': '11rem',
	'48': '12rem',
	'52': '13rem',
	'56': '14rem',
	'60': '15rem',
	'64': '16rem',
	'72': '18rem',
	'80': '20rem',
	'96': '24rem',
	'auto': 'auto',
	'full': '100%',
	'screen': '100vw',
	'min': 'min-content',
	'max': 'max-content',
	'fit': 'fit-content',
	'svh': '100svh',
	'lvh': '100lvh',
	'dvh': '100dvh',
	'svw': '100svw',
	'lvw': '100lvw',
	'dvw': '100dvw'
};

const FRACTIONS: Record<string, string> = {
	'1/2': '50%',
	'1/3': '33.333333%', '2/3': '66.666667%',
	'1/4': '25%', '2/4': '50%', '3/4': '75%',
	'1/5': '20%', '2/5': '40%', '3/5': '60%', '4/5': '80%',
	'1/6': '16.666667%', '2/6': '33.333333%', '3/6': '50%', '4/6': '66.666667%', '5/6': '83.333333%',
	'1/12': '8.333333%', '2/12': '16.666667%', '3/12': '25%', '4/12': '33.333333%',
	'5/12': '41.666667%', '6/12': '50%', '7/12': '58.333333%', '8/12': '66.666667%',
	'9/12': '75%', '10/12': '83.333333%', '11/12': '91.666667%'
};

const BREAKPOINTS: Record<string, string> = {
	sm: '640px',
	md: '768px',
	lg: '1024px',
	xl: '1280px',
	'2xl': '1536px'
};

const PREFLIGHT_CSS = `/* Tailwind CSS Preflight Base */
*, ::before, ::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: #e5e7eb;
  --tw-border-spacing-x: 0;
  --tw-border-spacing-y: 0;
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-ring-inset: ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
}
html, :host {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  -moz-tab-size: 4;
  tab-size: 4;
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  font-feature-settings: normal;
  font-variation-settings: normal;
  -webkit-tap-highlight-color: transparent;
}
body {
  margin: 0;
  line-height: inherit;
}
hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}
abbr:where([title]) {
  text-decoration: underline dotted;
}
h1, h2, h3, h4, h5, h6 {
  font-size: inherit;
  font-weight: inherit;
}
a {
  color: inherit;
  text-decoration: inherit;
}
b, strong {
  font-weight: bolder;
}
code, kbd, samp, pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-feature-settings: normal;
  font-variation-settings: normal;
  font-size: 1em;
}
small {
  font-size: 80%;
}
sub, sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}
sub { bottom: -0.25em; }
sup { top: -0.5em; }
table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}
button, input, optgroup, select, textarea {
  font-family: inherit;
  font-feature-settings: inherit;
  font-variation-settings: inherit;
  font-size: 100%;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  color: inherit;
  margin: 0;
  padding: 0;
}
button, select {
  text-transform: none;
}
button, input:where([type='button']), input:where([type='reset']), input:where([type='submit']) {
  -webkit-appearance: button;
  background-color: transparent;
  background-image: none;
  outline: none;
}
button:focus, button:focus-visible, button:active {
  outline: none;
}
:-moz-focusring {
  outline: auto;
}
:-moz-ui-invalid {
  box-shadow: none;
}
progress {
  vertical-align: baseline;
}
::-webkit-inner-spin-button, ::-webkit-outer-spin-button {
  height: auto;
}
[type='search'] {
  -webkit-appearance: textfield;
  outline-offset: -2px;
}
::-webkit-search-decoration {
  -webkit-appearance: none;
}
::-webkit-file-upload-button {
  -webkit-appearance: button;
  font: inherit;
}
summary {
  display: list-item;
}
blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre {
  margin: 0;
}
fieldset {
  margin: 0;
  padding: 0;
}
legend {
  padding: 0;
}
ol, ul, menu {
  list-style: none;
  margin: 0;
  padding: 0;
}
dialog {
  padding: 0;
}
textarea {
  resize: vertical;
}
input::placeholder, textarea::placeholder {
  opacity: 1;
  color: #9ca3af;
}
button, [role="button"] {
  cursor: pointer;
}
:disabled {
  cursor: default;
}
img, svg, video, canvas, audio, iframe, embed, object {
  display: block;
  vertical-align: middle;
}
img, video {
  max-width: 100%;
  height: auto;
}
[hidden]:where(:not([hidden="until-found"])) {
  display: none;
}
`;

const KEYFRAMES_CSS = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
@keyframes pulse { 50% { opacity: .5; } }
@keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }
`;

function hexToRgb(hex: string): string | null {
	const clean = hex.replace('#', '');
	if (clean.length === 3) {
		const r = parseInt(clean[0] + clean[0], 16);
		const g = parseInt(clean[1] + clean[1], 16);
		const b = parseInt(clean[2] + clean[2], 16);
		return `${r} ${g} ${b}`;
	}
	if (clean.length === 6) {
		const r = parseInt(clean.slice(0, 2), 16);
		const g = parseInt(clean.slice(2, 4), 16);
		const b = parseInt(clean.slice(4, 6), 16);
		return `${r} ${g} ${b}`;
	}
	return null;
}

function parseOpacity(opacity?: string): number | null {
	if (!opacity) return null;
	if (opacity.startsWith('[') && opacity.endsWith(']')) {
		const inner = opacity.slice(1, -1).trim();
		if (inner.endsWith('%')) {
			return parseFloat(inner.slice(0, -1)) / 100;
		}
		const num = parseFloat(inner);
		return isNaN(num) ? null : num;
	}
	const num = Number(opacity);
	return isNaN(num) ? null : num / 100;
}

function resolveColor(name: string, opacity?: string): string | null {
	if (!name) return null;
	const alpha = parseOpacity(opacity);

	if (name.startsWith('[') && name.endsWith(']')) {
		const inner = name.slice(1, -1).replace(/_/g, ' ');
		if (alpha !== null) {
			return `color-mix(in srgb, ${inner} ${alpha * 100}%, transparent)`;
		}
		return inner;
	}
	if (BASE_COLORS[name]) {
		const val = BASE_COLORS[name];
		if (alpha !== null && val.startsWith('#')) {
			const rgb = hexToRgb(val);
			return `rgb(${rgb} / ${alpha})`;
		}
		return val;
	}
	const parts = name.split('-');
	if (parts.length >= 2) {
		const shade = parts[parts.length - 1];
		const colorFamily = parts.slice(0, -1).join('-');
		if (COLORS[colorFamily] && COLORS[colorFamily][shade]) {
			const hex = COLORS[colorFamily][shade];
			if (alpha !== null) {
				const rgb = hexToRgb(hex);
				return `rgb(${rgb} / ${alpha})`;
			}
			return hex;
		}
	}
	return null;
}

function resolveArbitrary(val: string): string | null {
	if (!val) return null;
	if (val.startsWith('[') && val.endsWith(']')) {
		return val.slice(1, -1).replace(/_/g, ' ');
	}
	return null;
}

function resolveSpacing(val: string, negative = false): string | null {
	if (!val) return null;
	const arb = resolveArbitrary(val);
	if (arb) return negative ? `calc(-1 * (${arb}))` : arb;
	if (SPACING[val]) {
		const v = SPACING[val];
		if (negative && v !== '0px' && v !== 'auto') return `-${v}`;
		return v;
	}
	if (FRACTIONS[val]) {
		return FRACTIONS[val];
	}
	const num = Number(val);
	if (!isNaN(num)) {
		const rem = num * 0.25;
		return negative ? `-${rem}rem` : `${rem}rem`;
	}
	return null;
}

function escapeClassName(cls: string): string {
	return cls
		.replace(/\\/g, '\\\\')
		.replace(/\//g, '\\/')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]')
		.replace(/#/g, '\\#')
		.replace(/%/g, '\\%')
		.replace(/\./g, '\\.')
		.replace(/:/g, '\\:')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)')
		.replace(/,/g, '\\,')
		.replace(/&/g, '\\&')
		.replace(/>/g, '\\>')
		.replace(/\+/g, '\\+')
		.replace(/~/g, '\\~')
		.replace(/\*/g, '\\*');
}

interface ParsedClassRule {
	selector: string;
	body: string;
	media?: string;
}

function parseTailwindUtility(rawClass: string): ParsedClassRule | null {
	if (!rawClass || typeof rawClass !== 'string') return null;
	const tokens = rawClass.split(':');
	const baseUtility = tokens[tokens.length - 1];
	const variants = tokens.slice(0, -1);

	let body = generateUtilityBody(baseUtility);
	if (!body) return null;

	let pseudo = '';
	let selectorPrefix = '';
	let mediaQuery: string | undefined;
	let isDark = false;

	for (const v of variants) {
		if (BREAKPOINTS[v]) {
			mediaQuery = `(min-width: ${BREAKPOINTS[v]})`;
		} else if (v.startsWith('max-') && BREAKPOINTS[v.slice(4)]) {
			const bpVal = parseInt(BREAKPOINTS[v.slice(4)], 10) - 0.1;
			mediaQuery = `(max-width: ${bpVal}px)`;
		} else if (v === 'dark') {
			isDark = true;
		} else if (v === 'hover' || v === 'focus' || v === 'active' || v === 'disabled' || v === 'visited' || v === 'focus-within' || v === 'focus-visible' || v === 'target') {
			pseudo += `:${v}`;
		} else if (v === 'first' || v === 'last' || v === 'only' || v === 'odd' || v === 'even') {
			pseudo += `:${v === 'odd' || v === 'even' ? `nth-child(${v})` : `${v}-child`}`;
		} else if (v === 'first-of-type' || v === 'last-of-type' || v === 'only-of-type' || v === 'empty' || v === 'open') {
			pseudo += `:${v}`;
		} else if (v === 'checked' || v === 'indeterminate' || v === 'default' || v === 'required' || v === 'valid' || v === 'invalid' || v === 'in-range' || v === 'out-of-range' || v === 'placeholder-shown' || v === 'autofill' || v === 'read-only') {
			pseudo += `:${v}`;
		} else if (v === 'before' || v === 'after' || v === 'placeholder' || v === 'file' || v === 'marker' || v === 'selection' || v === 'first-line' || v === 'first-letter' || v === 'backdrop') {
			pseudo += `::${v}`;
		} else if (v === 'motion-safe') {
			mediaQuery = '(prefers-reduced-motion: no-preference)';
		} else if (v === 'motion-reduce') {
			mediaQuery = '(prefers-reduced-motion: reduce)';
		} else if (v === 'contrast-more') {
			mediaQuery = '(prefers-contrast: more)';
		} else if (v === 'contrast-less') {
			mediaQuery = '(prefers-contrast: less)';
		} else if (v === 'print') {
			mediaQuery = 'print';
		} else if (v === 'landscape' || v === 'portrait') {
			mediaQuery = `(orientation: ${v})`;
		} else if (v.startsWith('group-')) {
			const groupState = v.slice(6);
			selectorPrefix = `.group:${groupState} `;
		} else if (v.startsWith('peer-')) {
			const peerState = v.slice(5);
			selectorPrefix = `.peer:${peerState} ~ `;
		}
	}

	const escaped = escapeClassName(rawClass);
	let finalSelector: string;

	if (isDark) {
		finalSelector = `[data-theme="dark"] ${selectorPrefix}.${escaped}${pseudo}, .dark ${selectorPrefix}.${escaped}${pseudo}`;
	} else {
		finalSelector = `${selectorPrefix}.${escaped}${pseudo}`;
	}

	return {
		selector: finalSelector,
		body,
		media: mediaQuery
	};
}

function generateUtilityBody(u: string): string | null {
	if (!u) return null;
	const isNegative = u.startsWith('-');
	const name = isNegative ? u.slice(1) : u;

	let m: RegExpMatchArray | null;

	// Container
	if (name === 'container') {
		return 'width: 100%; margin-left: auto; margin-right: auto;';
	}

	// Layout & Display
	if (name === 'block') return 'display: block;';
	if (name === 'inline-block') return 'display: inline-block;';
	if (name === 'inline') return 'display: inline;';
	if (name === 'flex') return 'display: flex;';
	if (name === 'inline-flex') return 'display: inline-flex;';
	if (name === 'table') return 'display: table;';
	if (name === 'inline-table') return 'display: inline-table;';
	if (name === 'table-caption') return 'display: table-caption;';
	if (name === 'table-cell') return 'display: table-cell;';
	if (name === 'table-column') return 'display: table-column;';
	if (name === 'table-column-group') return 'display: table-column-group;';
	if (name === 'table-footer-group') return 'display: table-footer-group;';
	if (name === 'table-header-group') return 'display: table-header-group;';
	if (name === 'table-row-group') return 'display: table-row-group;';
	if (name === 'table-row') return 'display: table-row;';
	if (name === 'flow-root') return 'display: flow-root;';
	if (name === 'grid') return 'display: grid;';
	if (name === 'inline-grid') return 'display: inline-grid;';
	if (name === 'contents') return 'display: contents;';
	if (name === 'list-item') return 'display: list-item;';
	if (name === 'hidden') return 'display: none;';
	if (name === 'sr-only') return 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;';
	if (name === 'not-sr-only') return 'position: static; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; clip: auto; white-space: normal;';

	// Aspect Ratio
	if (name === 'aspect-auto') return 'aspect-ratio: auto;';
	if (name === 'aspect-square') return 'aspect-ratio: 1 / 1;';
	if (name === 'aspect-video') return 'aspect-ratio: 16 / 9;';
	if ((m = name.match(/^aspect-\[(.+)\]$/))) return `aspect-ratio: ${m[1].replace(/_/g, ' ')};`;

	// Columns
	if ((m = name.match(/^columns-(\d+)$/))) return `columns: ${m[1]};`;
	if (name === 'columns-auto') return 'columns: auto;';
	if ((m = name.match(/^columns-\[(.+)\]$/))) return `columns: ${m[1].replace(/_/g, ' ')};`;

	// Box Sizing & Decoration
	if (name === 'box-border') return 'box-sizing: border-box;';
	if (name === 'box-content') return 'box-sizing: content-box;';
	if (name === 'box-decoration-clone') return 'box-decoration-break: clone; -webkit-box-decoration-break: clone;';
	if (name === 'box-decoration-slice') return 'box-decoration-break: slice; -webkit-box-decoration-break: slice;';

	// Floats & Clear
	if (name === 'float-start') return 'float: inline-start;';
	if (name === 'float-end') return 'float: inline-end;';
	if (name === 'float-right') return 'float: right;';
	if (name === 'float-left') return 'float: left;';
	if (name === 'float-none') return 'float: none;';
	if (name === 'clear-start') return 'clear: inline-start;';
	if (name === 'clear-end') return 'clear: inline-end;';
	if (name === 'clear-left') return 'clear: left;';
	if (name === 'clear-right') return 'clear: right;';
	if (name === 'clear-both') return 'clear: both;';
	if (name === 'clear-none') return 'clear: none;';

	// Isolation
	if (name === 'isolate') return 'isolation: isolate;';
	if (name === 'isolation-auto') return 'isolation: auto;';

	// Object Fit & Position
	if (name === 'object-contain') return 'object-fit: contain;';
	if (name === 'object-cover') return 'object-fit: cover;';
	if (name === 'object-fill') return 'object-fit: fill;';
	if (name === 'object-none') return 'object-fit: none;';
	if (name === 'object-scale-down') return 'object-fit: scale-down;';
	if (name === 'object-bottom') return 'object-position: bottom;';
	if (name === 'object-center') return 'object-position: center;';
	if (name === 'object-left') return 'object-position: left;';
	if (name === 'object-left-bottom') return 'object-position: left bottom;';
	if (name === 'object-left-top') return 'object-position: left top;';
	if (name === 'object-right') return 'object-position: right;';
	if (name === 'object-right-bottom') return 'object-position: right bottom;';
	if (name === 'object-right-top') return 'object-position: right top;';
	if (name === 'object-top') return 'object-position: top;';
	if ((m = name.match(/^object-\[(.+)\]$/))) return `object-position: ${m[1].replace(/_/g, ' ')};`;

	// Overflow & Overscroll
	if (name === 'overflow-auto') return 'overflow: auto;';
	if (name === 'overflow-hidden') return 'overflow: hidden;';
	if (name === 'overflow-clip') return 'overflow: clip;';
	if (name === 'overflow-visible') return 'overflow: visible;';
	if (name === 'overflow-scroll') return 'overflow: scroll;';
	if (name === 'overflow-x-auto') return 'overflow-x: auto;';
	if (name === 'overflow-y-auto') return 'overflow-y: auto;';
	if (name === 'overflow-x-hidden') return 'overflow-x: hidden;';
	if (name === 'overflow-y-hidden') return 'overflow-y: hidden;';
	if (name === 'overflow-x-clip') return 'overflow-x: clip;';
	if (name === 'overflow-y-clip') return 'overflow-y: clip;';
	if (name === 'overflow-x-visible') return 'overflow-x: visible;';
	if (name === 'overflow-y-visible') return 'overflow-y: visible;';
	if (name === 'overflow-x-scroll') return 'overflow-x: scroll;';
	if (name === 'overflow-y-scroll') return 'overflow-y: scroll;';
	if (name === 'overscroll-auto') return 'overscroll-behavior: auto;';
	if (name === 'overscroll-contain') return 'overscroll-behavior: contain;';
	if (name === 'overscroll-none') return 'overscroll-behavior: none;';
	if (name === 'overscroll-x-auto') return 'overscroll-behavior-x: auto;';
	if (name === 'overscroll-x-contain') return 'overscroll-behavior-x: contain;';
	if (name === 'overscroll-x-none') return 'overscroll-behavior-x: none;';
	if (name === 'overscroll-y-auto') return 'overscroll-behavior-y: auto;';
	if (name === 'overscroll-y-contain') return 'overscroll-behavior-y: contain;';
	if (name === 'overscroll-y-none') return 'overscroll-behavior-y: none;';

	// Positioning
	if (name === 'static') return 'position: static;';
	if (name === 'fixed') return 'position: fixed;';
	if (name === 'absolute') return 'position: absolute;';
	if (name === 'relative') return 'position: relative;';
	if (name === 'sticky') return 'position: sticky;';

	// Inset / Top / Right / Bottom / Left / Start / End
	if ((m = name.match(/^inset-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `inset: ${v};`;
	}
	if ((m = name.match(/^inset-x-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `left: ${v}; right: ${v};`;
	}
	if ((m = name.match(/^inset-y-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `top: ${v}; bottom: ${v};`;
	}
	if ((m = name.match(/^top-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `top: ${v};`;
	}
	if ((m = name.match(/^right-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `right: ${v};`;
	}
	if ((m = name.match(/^bottom-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `bottom: ${v};`;
	}
	if ((m = name.match(/^left-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `left: ${v};`;
	}
	if ((m = name.match(/^start-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `inset-inline-start: ${v};`;
	}
	if ((m = name.match(/^end-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `inset-inline-end: ${v};`;
	}

	// Visibility
	if (name === 'visible') return 'visibility: visible;';
	if (name === 'invisible') return 'visibility: hidden;';
	if (name === 'collapse') return 'visibility: collapse;';

	// Z-Index
	if (name === 'z-auto') return 'z-index: auto;';
	if ((m = name.match(/^z-(\d+)$/))) return `z-index: ${isNegative ? `-${m[1]}` : m[1]};`;
	if ((m = name.match(/^z-\[(.+)\]$/))) return `z-index: ${isNegative ? `calc(-1 * (${m[1]}))` : m[1]};`;

	// Flexbox & Grid
	if (name === 'flex-row') return 'flex-direction: row;';
	if (name === 'flex-row-reverse') return 'flex-direction: row-reverse;';
	if (name === 'flex-col') return 'flex-direction: column;';
	if (name === 'flex-col-reverse') return 'flex-direction: column-reverse;';
	if (name === 'flex-wrap') return 'flex-wrap: wrap;';
	if (name === 'flex-wrap-reverse') return 'flex-wrap: wrap-reverse;';
	if (name === 'flex-nowrap') return 'flex-wrap: nowrap;';
	if (name === 'flex-1') return 'flex: 1 1 0%;';
	if (name === 'flex-auto') return 'flex: 1 1 auto;';
	if (name === 'flex-initial') return 'flex: 0 1 auto;';
	if (name === 'flex-none') return 'flex: none;';
	if ((m = name.match(/^flex-\[(.+)\]$/))) return `flex: ${m[1].replace(/_/g, ' ')};`;
	if (name === 'grow' || name === 'flex-grow') return 'flex-grow: 1;';
	if (name === 'grow-0' || name === 'flex-grow-0') return 'flex-grow: 0;';
	if ((m = name.match(/^grow-\[(.+)\]$/))) return `flex-grow: ${m[1]};`;
	if (name === 'shrink' || name === 'flex-shrink') return 'flex-shrink: 1;';
	if (name === 'shrink-0' || name === 'flex-shrink-0') return 'flex-shrink: 0;';
	if ((m = name.match(/^shrink-\[(.+)\]$/))) return `flex-shrink: ${m[1]};`;
	if ((m = name.match(/^order-(\d+)$/))) return `order: ${isNegative ? `-${m[1]}` : m[1]};`;
	if (name === 'order-first') return 'order: -9999;';
	if (name === 'order-last') return 'order: 9999;';
	if (name === 'order-none') return 'order: 0;';
	if ((m = name.match(/^basis-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `flex-basis: ${v};`;
	}

	// Grid Template Columns & Rows
	if ((m = name.match(/^grid-cols-(\d+)$/))) return `grid-template-columns: repeat(${m[1]}, minmax(0, 1fr));`;
	if (name === 'grid-cols-none') return 'grid-template-columns: none;';
	if (name === 'grid-cols-subgrid') return 'grid-template-columns: subgrid;';
	if ((m = name.match(/^grid-cols-\[(.+)\]$/))) return `grid-template-columns: ${m[1].replace(/_/g, ' ')};`;

	if ((m = name.match(/^col-span-(\d+)$/))) return `grid-column: span ${m[1]} / span ${m[1]};`;
	if (name === 'col-span-full') return 'grid-column: 1 / -1;';
	if (name === 'col-auto') return 'grid-column: auto;';
	if ((m = name.match(/^col-start-(\d+|auto)$/))) return `grid-column-start: ${m[1]};`;
	if ((m = name.match(/^col-end-(\d+|auto)$/))) return `grid-column-end: ${m[1]};`;

	if ((m = name.match(/^grid-rows-(\d+)$/))) return `grid-template-rows: repeat(${m[1]}, minmax(0, 1fr));`;
	if (name === 'grid-rows-none') return 'grid-template-rows: none;';
	if (name === 'grid-rows-subgrid') return 'grid-template-rows: subgrid;';
	if ((m = name.match(/^grid-rows-\[(.+)\]$/))) return `grid-template-rows: ${m[1].replace(/_/g, ' ')};`;

	if ((m = name.match(/^row-span-(\d+)$/))) return `grid-row: span ${m[1]} / span ${m[1]};`;
	if (name === 'row-span-full') return 'grid-row: 1 / -1;';
	if (name === 'row-auto') return 'grid-row: auto;';
	if ((m = name.match(/^row-start-(\d+|auto)$/))) return `grid-row-start: ${m[1]};`;
	if ((m = name.match(/^row-end-(\d+|auto)$/))) return `grid-row-end: ${m[1]};`;

	if (name === 'grid-flow-row') return 'grid-auto-flow: row;';
	if (name === 'grid-flow-col') return 'grid-auto-flow: column;';
	if (name === 'grid-flow-dense') return 'grid-auto-flow: dense;';
	if (name === 'grid-flow-row-dense') return 'grid-auto-flow: row dense;';
	if (name === 'grid-flow-col-dense') return 'grid-auto-flow: column dense;';

	// Gap
	if ((m = name.match(/^gap-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `gap: ${v};`;
	}
	if ((m = name.match(/^gap-x-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `column-gap: ${v};`;
	}
	if ((m = name.match(/^gap-y-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `row-gap: ${v};`;
	}

	// Justify & Align & Place
	if (name === 'justify-normal') return 'justify-content: normal;';
	if (name === 'justify-start') return 'justify-content: flex-start;';
	if (name === 'justify-end') return 'justify-content: flex-end;';
	if (name === 'justify-center') return 'justify-content: center;';
	if (name === 'justify-between') return 'justify-content: space-between;';
	if (name === 'justify-around') return 'justify-content: space-around;';
	if (name === 'justify-evenly') return 'justify-content: space-evenly;';
	if (name === 'justify-stretch') return 'justify-content: stretch;';
	if (name === 'justify-items-start') return 'justify-items: start;';
	if (name === 'justify-items-end') return 'justify-items: end;';
	if (name === 'justify-items-center') return 'justify-items: center;';
	if (name === 'justify-items-stretch') return 'justify-items: stretch;';
	if (name === 'justify-self-auto') return 'justify-self: auto;';
	if (name === 'justify-self-start') return 'justify-self: start;';
	if (name === 'justify-self-end') return 'justify-self: end;';
	if (name === 'justify-self-center') return 'justify-self: center;';
	if (name === 'justify-self-stretch') return 'justify-self: stretch;';

	if (name === 'content-normal') return 'align-content: normal;';
	if (name === 'content-start') return 'align-content: flex-start;';
	if (name === 'content-end') return 'align-content: flex-end;';
	if (name === 'content-center') return 'align-content: center;';
	if (name === 'content-between') return 'align-content: space-between;';
	if (name === 'content-around') return 'align-content: space-around;';
	if (name === 'content-evenly') return 'align-content: space-evenly;';
	if (name === 'content-baseline') return 'align-content: baseline;';
	if (name === 'content-stretch') return 'align-content: stretch;';

	if (name === 'items-start') return 'align-items: flex-start;';
	if (name === 'items-end') return 'align-items: flex-end;';
	if (name === 'items-center') return 'align-items: center;';
	if (name === 'items-baseline') return 'align-items: baseline;';
	if (name === 'items-stretch') return 'align-items: stretch;';

	if (name === 'self-auto') return 'align-self: auto;';
	if (name === 'self-start') return 'align-self: flex-start;';
	if (name === 'self-end') return 'align-self: flex-end;';
	if (name === 'self-center') return 'align-self: center;';
	if (name === 'self-stretch') return 'align-self: stretch;';
	if (name === 'self-baseline') return 'align-self: baseline;';

	if (name === 'place-content-center') return 'place-content: center;';
	if (name === 'place-content-start') return 'place-content: start;';
	if (name === 'place-content-end') return 'place-content: end;';
	if (name === 'place-content-between') return 'place-content: space-between;';
	if (name === 'place-content-around') return 'place-content: space-around;';
	if (name === 'place-content-evenly') return 'place-content: space-evenly;';
	if (name === 'place-content-stretch') return 'place-content: stretch;';
	if (name === 'place-items-start') return 'place-items: start;';
	if (name === 'place-items-end') return 'place-items: end;';
	if (name === 'place-items-center') return 'place-items: center;';
	if (name === 'place-items-stretch') return 'place-items: stretch;';
	if (name === 'place-self-auto') return 'place-self: auto;';
	if (name === 'place-self-start') return 'place-self: start;';
	if (name === 'place-self-end') return 'place-self: end;';
	if (name === 'place-self-center') return 'place-self: center;';
	if (name === 'place-self-stretch') return 'place-self: stretch;';

	// Padding
	if ((m = name.match(/^p-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding: ${v};`;
	}
	if ((m = name.match(/^px-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-left: ${v}; padding-right: ${v};`;
	}
	if ((m = name.match(/^py-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-top: ${v}; padding-bottom: ${v};`;
	}
	if ((m = name.match(/^pt-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-top: ${v};`;
	}
	if ((m = name.match(/^pr-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-right: ${v};`;
	}
	if ((m = name.match(/^pb-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-bottom: ${v};`;
	}
	if ((m = name.match(/^pl-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-left: ${v};`;
	}
	if ((m = name.match(/^ps-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-inline-start: ${v};`;
	}
	if ((m = name.match(/^pe-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `padding-inline-end: ${v};`;
	}

	// Margin
	if ((m = name.match(/^m-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin: ${v};`;
	}
	if ((m = name.match(/^mx-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-left: ${v}; margin-right: ${v};`;
	}
	if ((m = name.match(/^my-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-top: ${v}; margin-bottom: ${v};`;
	}
	if ((m = name.match(/^mt-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-top: ${v};`;
	}
	if ((m = name.match(/^mr-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-right: ${v};`;
	}
	if ((m = name.match(/^mb-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-bottom: ${v};`;
	}
	if ((m = name.match(/^ml-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-left: ${v};`;
	}
	if ((m = name.match(/^ms-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-inline-start: ${v};`;
	}
	if ((m = name.match(/^me-([^\/]+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `margin-inline-end: ${v};`;
	}

	// Space Between
	if ((m = name.match(/^space-x-([^\/]+)$/))) {
		if (m[1] === 'reverse') return '--lithe-space-x-reverse: 1;';
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `& > :not([hidden]) ~ :not([hidden]) { --lithe-space-x-reverse: 0; margin-right: calc(${v} * var(--lithe-space-x-reverse)); margin-left: calc(${v} * calc(1 - var(--lithe-space-x-reverse))); }`;
	}
	if ((m = name.match(/^space-y-([^\/]+)$/))) {
		if (m[1] === 'reverse') return '--lithe-space-y-reverse: 1;';
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `& > :not([hidden]) ~ :not([hidden]) { --lithe-space-y-reverse: 0; margin-bottom: calc(${v} * var(--lithe-space-y-reverse)); margin-top: calc(${v} * calc(1 - var(--lithe-space-y-reverse))); }`;
	}

	// Sizing: Width, Min-Width, Max-Width
	if ((m = name.match(/^w-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `width: ${v};`;
	}
	if ((m = name.match(/^min-w-([^\/]+)$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `min-width: ${v};`;
	}
	if ((m = name.match(/^max-w-([^\/]+)$/))) {
		if (m[1] === 'none') return 'max-width: none;';
		if (m[1] === '0') return 'max-width: 0rem;';
		if (m[1] === 'xs') return 'max-width: 20rem;';
		if (m[1] === 'sm') return 'max-width: 24rem;';
		if (m[1] === 'md') return 'max-width: 28rem;';
		if (m[1] === 'lg') return 'max-width: 32rem;';
		if (m[1] === 'xl') return 'max-width: 36rem;';
		if (m[1] === '2xl') return 'max-width: 42rem;';
		if (m[1] === '3xl') return 'max-width: 48rem;';
		if (m[1] === '4xl') return 'max-width: 56rem;';
		if (m[1] === '5xl') return 'max-width: 64rem;';
		if (m[1] === '6xl') return 'max-width: 72rem;';
		if (m[1] === '7xl') return 'max-width: 80rem;';
		if (m[1] === 'prose') return 'max-width: 65ch;';
		if (m[1].startsWith('screen-')) {
			const bp = m[1].slice(7);
			if (BREAKPOINTS[bp]) return `max-width: ${BREAKPOINTS[bp]};`;
		}
		const v = resolveSpacing(m[1]);
		if (v) return `max-width: ${v};`;
	}

	// Sizing: Height, Min-Height, Max-Height
	if ((m = name.match(/^h-([^\/]+)$/))) {
		if (m[1] === 'screen') return 'height: 100vh;';
		const v = resolveSpacing(m[1]);
		if (v) return `height: ${v};`;
	}
	if ((m = name.match(/^min-h-([^\/]+)$/))) {
		if (m[1] === 'screen') return 'min-height: 100vh;';
		const v = resolveSpacing(m[1]);
		if (v) return `min-height: ${v};`;
	}
	if ((m = name.match(/^max-h-([^\/]+)$/))) {
		if (m[1] === 'screen') return 'max-height: 100vh;';
		const v = resolveSpacing(m[1]);
		if (v) return `max-height: ${v};`;
	}

	// Typography: Font Family & Size
	if (name === 'font-sans') return 'font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";';
	if (name === 'font-serif') return 'font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;';
	if (name === 'font-mono') return 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;';
	if ((m = name.match(/^font-\[(.+)\]$/))) return `font-family: ${m[1].replace(/_/g, ' ')};`;

	if (name === 'text-xs') return 'font-size: 0.75rem; line-height: 1rem;';
	if (name === 'text-sm') return 'font-size: 0.875rem; line-height: 1.25rem;';
	if (name === 'text-base') return 'font-size: 1rem; line-height: 1.5rem;';
	if (name === 'text-lg') return 'font-size: 1.125rem; line-height: 1.75rem;';
	if (name === 'text-xl') return 'font-size: 1.25rem; line-height: 1.75rem;';
	if (name === 'text-2xl') return 'font-size: 1.5rem; line-height: 2rem;';
	if (name === 'text-3xl') return 'font-size: 1.875rem; line-height: 2.25rem;';
	if (name === 'text-4xl') return 'font-size: 2.25rem; line-height: 2.5rem;';
	if (name === 'text-5xl') return 'font-size: 3rem; line-height: 1;';
	if (name === 'text-6xl') return 'font-size: 3.75rem; line-height: 1;';
	if (name === 'text-7xl') return 'font-size: 4.5rem; line-height: 1;';
	if (name === 'text-8xl') return 'font-size: 6rem; line-height: 1;';
	if (name === 'text-9xl') return 'font-size: 8rem; line-height: 1;';
	if ((m = name.match(/^text-\[(.+)\]$/))) {
		const val = m[1].replace(/_/g, ' ');
		if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl') || val.startsWith('var(')) {
			return `color: ${val};`;
		}
		return `font-size: ${val};`;
	}

	// Font Weight & Style
	if (name === 'antialiased') return '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;';
	if (name === 'subpixel-antialiased') return '-webkit-font-smoothing: auto; -moz-osx-font-smoothing: auto;';
	if (name === 'italic') return 'font-style: italic;';
	if (name === 'not-italic') return 'font-style: normal;';
	if (name === 'font-thin') return 'font-weight: 100;';
	if (name === 'font-extralight') return 'font-weight: 200;';
	if (name === 'font-light') return 'font-weight: 300;';
	if (name === 'font-normal') return 'font-weight: 400;';
	if (name === 'font-medium') return 'font-weight: 500;';
	if (name === 'font-semibold') return 'font-weight: 600;';
	if (name === 'font-bold') return 'font-weight: 700;';
	if (name === 'font-extrabold') return 'font-weight: 800;';
	if (name === 'font-black') return 'font-weight: 900;';
	if ((m = name.match(/^font-(\d{3})$/))) return `font-weight: ${m[1]};`;

	// Tracking & Leading
	if (name === 'tracking-tighter') return 'letter-spacing: -0.05em;';
	if (name === 'tracking-tight') return 'letter-spacing: -0.025em;';
	if (name === 'tracking-normal') return 'letter-spacing: 0em;';
	if (name === 'tracking-wide') return 'letter-spacing: 0.025em;';
	if (name === 'tracking-wider') return 'letter-spacing: 0.05em;';
	if (name === 'tracking-widest') return 'letter-spacing: 0.1em;';
	if ((m = name.match(/^tracking-\[(.+)\]$/))) return `letter-spacing: ${m[1].replace(/_/g, ' ')};`;

	if (name === 'leading-none') return 'line-height: 1;';
	if (name === 'leading-tight') return 'line-height: 1.25;';
	if (name === 'leading-snug') return 'line-height: 1.375;';
	if (name === 'leading-normal') return 'line-height: 1.5;';
	if (name === 'leading-relaxed') return 'line-height: 1.625;';
	if (name === 'leading-loose') return 'line-height: 2;';
	if ((m = name.match(/^leading-(\d+|\[.+\])$/))) {
		const v = resolveSpacing(m[1]);
		if (v) return `line-height: ${v};`;
	}

	// Lists
	if (name === 'list-none') return 'list-style-type: none;';
	if (name === 'list-disc') return 'list-style-type: disc;';
	if (name === 'list-decimal') return 'list-style-type: decimal;';
	if (name === 'list-inside') return 'list-style-position: inside;';
	if (name === 'list-outside') return 'list-style-position: outside;';

	// Text Alignment, Transform & Overflow
	if (name === 'text-left') return 'text-align: left;';
	if (name === 'text-center') return 'text-align: center;';
	if (name === 'text-right') return 'text-align: right;';
	if (name === 'text-justify') return 'text-align: justify;';
	if (name === 'text-start') return 'text-align: start;';
	if (name === 'text-end') return 'text-align: end;';
	if (name === 'uppercase') return 'text-transform: uppercase;';
	if (name === 'lowercase') return 'text-transform: lowercase;';
	if (name === 'capitalize') return 'text-transform: capitalize;';
	if (name === 'normal-case') return 'text-transform: none;';
	if (name === 'truncate') return 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
	if (name === 'text-ellipsis') return 'text-overflow: ellipsis;';
	if (name === 'text-clip') return 'text-overflow: clip;';
	if (name === 'text-wrap') return 'text-wrap: wrap;';
	if (name === 'text-nowrap') return 'text-wrap: nowrap;';
	if (name === 'text-balance') return 'text-wrap: balance;';
	if (name === 'text-pretty') return 'text-wrap: pretty;';
	if (name === 'whitespace-normal') return 'white-space: normal;';
	if (name === 'whitespace-nowrap') return 'white-space: nowrap;';
	if (name === 'whitespace-pre') return 'white-space: pre;';
	if (name === 'whitespace-pre-line') return 'white-space: pre-line;';
	if (name === 'whitespace-pre-wrap') return 'white-space: pre-wrap;';
	if (name === 'whitespace-break-spaces') return 'white-space: break-spaces;';
	if (name === 'break-normal') return 'overflow-wrap: normal; word-break: normal;';
	if (name === 'break-words') return 'overflow-wrap: break-word;';
	if (name === 'break-all') return 'word-break: break-all;';
	if (name === 'break-keep') return 'word-break: keep-all;';

	// Text Decoration
	if (name === 'underline') return 'text-decoration-line: underline;';
	if (name === 'overline') return 'text-decoration-line: overline;';
	if (name === 'line-through') return 'text-decoration-line: line-through;';
	if (name === 'no-underline') return 'text-decoration-line: none;';
	if (name === 'decoration-solid') return 'text-decoration-style: solid;';
	if (name === 'decoration-double') return 'text-decoration-style: double;';
	if (name === 'decoration-dotted') return 'text-decoration-style: dotted;';
	if (name === 'decoration-dashed') return 'text-decoration-style: dashed;';
	if (name === 'decoration-wavy') return 'text-decoration-style: wavy;';
	if (name === 'decoration-auto') return 'text-decoration-thickness: auto;';
	if (name === 'decoration-from-font') return 'text-decoration-thickness: from-font;';
	if ((m = name.match(/^decoration-(\d+)$/))) return `text-decoration-thickness: ${m[1]}px;`;
	if ((m = name.match(/^underline-offset-(.+)$/))) {
		if (m[1] === 'auto') return 'text-underline-offset: auto;';
		const num = Number(m[1]);
		if (!isNaN(num)) return `text-underline-offset: ${num}px;`;
		const arb = resolveArbitrary(m[1]);
		if (arb) return `text-underline-offset: ${arb};`;
	}

	// Text Color
	if ((m = name.match(/^text-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const color = resolveColor(m[1], m[2]);
		if (color) return `color: ${color};`;
	}

	// Background Color & Images & Gradients
	if (name === 'bg-fixed') return 'background-attachment: fixed;';
	if (name === 'bg-local') return 'background-attachment: local;';
	if (name === 'bg-scroll') return 'background-attachment: scroll;';
	if (name === 'bg-clip-border') return 'background-clip: border-box;';
	if (name === 'bg-clip-padding') return 'background-clip: padding-box;';
	if (name === 'bg-clip-content') return 'background-clip: content-box;';
	if (name === 'bg-clip-text') return 'background-clip: text; -webkit-background-clip: text;';
	if (name === 'bg-repeat') return 'background-repeat: repeat;';
	if (name === 'bg-no-repeat') return 'background-repeat: no-repeat;';
	if (name === 'bg-repeat-x') return 'background-repeat: repeat-x;';
	if (name === 'bg-repeat-y') return 'background-repeat: repeat-y;';
	if (name === 'bg-auto') return 'background-size: auto;';
	if (name === 'bg-cover') return 'background-size: cover;';
	if (name === 'bg-contain') return 'background-size: contain;';
	if (name === 'bg-bottom') return 'background-position: bottom;';
	if (name === 'bg-center') return 'background-position: center;';
	if (name === 'bg-left') return 'background-position: left;';
	if (name === 'bg-right') return 'background-position: right;';
	if (name === 'bg-top') return 'background-position: top;';
	if (name === 'bg-none') return 'background-image: none;';

	if (name === 'bg-gradient-to-t') return 'background-image: linear-gradient(to top, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-tr') return 'background-image: linear-gradient(to top right, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-r') return 'background-image: linear-gradient(to right, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-br') return 'background-image: linear-gradient(to bottom right, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-b') return 'background-image: linear-gradient(to bottom, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-bl') return 'background-image: linear-gradient(to bottom left, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-l') return 'background-image: linear-gradient(to left, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';
	if (name === 'bg-gradient-to-tl') return 'background-image: linear-gradient(to top left, var(--lithe-gradient-stops, var(--lithe-from, transparent), var(--lithe-to, transparent)));';

	if ((m = name.match(/^from-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `--lithe-from: ${c}; --lithe-gradient-stops: var(--lithe-from), var(--lithe-to, rgb(255 255 255 / 0));`;
	}
	if ((m = name.match(/^via-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `--lithe-via: ${c}; --lithe-gradient-stops: var(--lithe-from, rgb(255 255 255 / 0)), var(--lithe-via), var(--lithe-to, rgb(255 255 255 / 0));`;
	}
	if ((m = name.match(/^to-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `--lithe-to: ${c};`;
	}

	if ((m = name.match(/^bg-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const color = resolveColor(m[1], m[2]);
		if (color) return `background-color: ${color};`;
	}

	// Borders & Radii
	if (name === 'rounded-none') return 'border-radius: 0px;';
	if (name === 'rounded-sm') return 'border-radius: 0.125rem;';
	if (name === 'rounded') return 'border-radius: 0.25rem;';
	if (name === 'rounded-md') return 'border-radius: 0.375rem;';
	if (name === 'rounded-lg') return 'border-radius: 0.5rem;';
	if (name === 'rounded-xl') return 'border-radius: 0.75rem;';
	if (name === 'rounded-2xl') return 'border-radius: 1rem;';
	if (name === 'rounded-3xl') return 'border-radius: 1.5rem;';
	if (name === 'rounded-full') return 'border-radius: 9999px;';
	if ((m = name.match(/^rounded-\[(.+)\]$/))) return `border-radius: ${m[1].replace(/_/g, ' ')};`;

	if (name === 'rounded-t-none') return 'border-top-left-radius: 0px; border-top-right-radius: 0px;';
	if (name === 'rounded-t-sm') return 'border-top-left-radius: 0.125rem; border-top-right-radius: 0.125rem;';
	if (name === 'rounded-t') return 'border-top-left-radius: 0.25rem; border-top-right-radius: 0.25rem;';
	if (name === 'rounded-t-md') return 'border-top-left-radius: 0.375rem; border-top-right-radius: 0.375rem;';
	if (name === 'rounded-t-lg') return 'border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem;';
	if (name === 'rounded-t-xl') return 'border-top-left-radius: 0.75rem; border-top-right-radius: 0.75rem;';
	if (name === 'rounded-t-2xl') return 'border-top-left-radius: 1rem; border-top-right-radius: 1rem;';
	if (name === 'rounded-t-3xl') return 'border-top-left-radius: 1.5rem; border-top-right-radius: 1.5rem;';
	if (name === 'rounded-t-full') return 'border-top-left-radius: 9999px; border-top-right-radius: 9999px;';

	if (name === 'rounded-b-none') return 'border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;';
	if (name === 'rounded-b-sm') return 'border-bottom-left-radius: 0.125rem; border-bottom-right-radius: 0.125rem;';
	if (name === 'rounded-b') return 'border-bottom-left-radius: 0.25rem; border-bottom-right-radius: 0.25rem;';
	if (name === 'rounded-b-md') return 'border-bottom-left-radius: 0.375rem; border-bottom-right-radius: 0.375rem;';
	if (name === 'rounded-b-lg') return 'border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem;';
	if (name === 'rounded-b-xl') return 'border-bottom-left-radius: 0.75rem; border-bottom-right-radius: 0.75rem;';
	if (name === 'rounded-b-2xl') return 'border-bottom-left-radius: 1rem; border-bottom-right-radius: 1rem;';
	if (name === 'rounded-b-3xl') return 'border-bottom-left-radius: 1.5rem; border-bottom-right-radius: 1.5rem;';
	if (name === 'rounded-b-full') return 'border-bottom-left-radius: 9999px; border-bottom-right-radius: 9999px;';

	if (name === 'border') return 'border-width: 1px; border-style: solid;';
	if (name === 'border-0') return 'border-width: 0px;';
	if (name === 'border-2') return 'border-width: 2px; border-style: solid;';
	if (name === 'border-4') return 'border-width: 4px; border-style: solid;';
	if (name === 'border-8') return 'border-width: 8px; border-style: solid;';
	if (name === 'border-t') return 'border-top-width: 1px; border-top-style: solid;';
	if (name === 'border-t-0') return 'border-top-width: 0px;';
	if (name === 'border-t-2') return 'border-top-width: 2px; border-top-style: solid;';
	if (name === 'border-t-4') return 'border-top-width: 4px; border-top-style: solid;';
	if (name === 'border-r') return 'border-right-width: 1px; border-right-style: solid;';
	if (name === 'border-r-0') return 'border-right-width: 0px;';
	if (name === 'border-r-2') return 'border-right-width: 2px; border-right-style: solid;';
	if (name === 'border-r-4') return 'border-right-width: 4px; border-right-style: solid;';
	if (name === 'border-b') return 'border-bottom-width: 1px; border-bottom-style: solid;';
	if (name === 'border-b-0') return 'border-bottom-width: 0px;';
	if (name === 'border-b-2') return 'border-bottom-width: 2px; border-bottom-style: solid;';
	if (name === 'border-b-4') return 'border-bottom-width: 4px; border-bottom-style: solid;';
	if (name === 'border-l') return 'border-left-width: 1px; border-left-style: solid;';
	if (name === 'border-l-0') return 'border-left-width: 0px;';
	if (name === 'border-l-2') return 'border-left-width: 2px; border-left-style: solid;';
	if (name === 'border-l-4') return 'border-left-width: 4px; border-left-style: solid;';
	if (name === 'border-x') return 'border-left-width: 1px; border-right-width: 1px; border-style: solid;';
	if (name === 'border-y') return 'border-top-width: 1px; border-bottom-width: 1px; border-style: solid;';

	if (name === 'border-solid') return 'border-style: solid;';
	if (name === 'border-dashed') return 'border-style: dashed;';
	if (name === 'border-dotted') return 'border-style: dotted;';
	if (name === 'border-double') return 'border-style: double;';
	if (name === 'border-none') return 'border-style: none;';

	if ((m = name.match(/^border-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const color = resolveColor(m[1], m[2]);
		if (color) return `border-color: ${color};`;
	}

	// Divide
	if (name === 'divide-x') return '& > :not([hidden]) ~ :not([hidden]) { border-left-width: 1px; border-style: solid; }';
	if (name === 'divide-y') return '& > :not([hidden]) ~ :not([hidden]) { border-top-width: 1px; border-style: solid; }';
	if ((m = name.match(/^divide-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `& > :not([hidden]) ~ :not([hidden]) { border-color: ${c}; }`;
	}

	// Outline
	if (name === 'outline-none') return 'outline: 2px solid transparent; outline-offset: 2px;';
	if (name === 'outline') return 'outline-style: solid;';
	if (name === 'outline-dashed') return 'outline-style: dashed;';
	if (name === 'outline-dotted') return 'outline-style: dotted;';
	if (name === 'outline-double') return 'outline-style: double;';
	if ((m = name.match(/^outline-(\d+)$/))) return `outline-width: ${m[1]}px;`;
	if ((m = name.match(/^outline-offset-(\d+)$/))) return `outline-offset: ${m[1]}px;`;
	if ((m = name.match(/^outline-(.+)$/))) {
		const c = resolveColor(m[1]);
		if (c) return `outline-color: ${c};`;
	}

	// Ring System
	if (name === 'ring-0') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring-1') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring-2') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring' || name === 'ring-3') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring-4') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(4px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring-8') return '--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(8px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);';
	if (name === 'ring-inset') return '--tw-ring-inset: inset;';

	if (name === 'ring-offset-0') return '--tw-ring-offset-width: 0px; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);';
	if (name === 'ring-offset-1') return '--tw-ring-offset-width: 1px; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);';
	if (name === 'ring-offset-2') return '--tw-ring-offset-width: 2px; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);';
	if (name === 'ring-offset-4') return '--tw-ring-offset-width: 4px; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);';
	if (name === 'ring-offset-8') return '--tw-ring-offset-width: 8px; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);';

	if ((m = name.match(/^ring-offset-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `--tw-ring-offset-color: ${c};`;
	}

	if ((m = name.match(/^ring-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2]);
		if (c) return `--tw-ring-color: ${c};`;
	}

	// Box Shadows with CSS variables
	if (name === 'shadow-sm') return '--tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow') return '--tw-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); --tw-shadow-colored: 0 1px 3px 0 var(--tw-shadow-color), 0 1px 2px -1px var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-md') return '--tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); --tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-lg') return '--tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-xl') return '--tw-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); --tw-shadow-colored: 0 20px 25px -5px var(--tw-shadow-color), 0 8px 10px -6px var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-2xl') return '--tw-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); --tw-shadow-colored: 0 25px 50px -12px var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-inner') return '--tw-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05); --tw-shadow-colored: inset 0 2px 4px 0 var(--tw-shadow-color); box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';
	if (name === 'shadow-none') return '--tw-shadow: 0 0 #0000; --tw-shadow-colored: 0 0 #0000; box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);';

	if ((m = name.match(/^shadow-\[(.+)\]$/))) {
		const arb = m[1].replace(/_/g, ' ');
		return `--tw-shadow: ${arb}; box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);`;
	}

	// Colored Shadows: shadow-indigo-500/25, shadow-purple-500/30, shadow-indigo-600/30
	if ((m = name.match(/^shadow-([^\/]+)(?:\/(\d+|\[.+\]))?$/))) {
		const c = resolveColor(m[1], m[2] || '25');
		if (c) return `--tw-shadow-color: ${c}; --tw-shadow: 0 10px 15px -3px ${c}, 0 4px 6px -4px ${c}; box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);`;
	}

	// Opacity
	if ((m = name.match(/^opacity-(\d+)$/))) return `opacity: ${Number(m[1]) / 100};`;
	if ((m = name.match(/^opacity-\[(.+)\]$/))) return `opacity: ${m[1]};`;

	// Filters & Backdrop Filters
	if (name === 'blur-none') return 'filter: blur(0);';
	if (name === 'blur-sm') return 'filter: blur(4px);';
	if (name === 'blur') return 'filter: blur(8px);';
	if (name === 'blur-md') return 'filter: blur(12px);';
	if (name === 'blur-lg') return 'filter: blur(16px);';
	if (name === 'blur-xl') return 'filter: blur(24px);';
	if (name === 'blur-2xl') return 'filter: blur(40px);';
	if (name === 'blur-3xl') return 'filter: blur(64px);';
	if ((m = name.match(/^blur-\[(.+)\]$/))) return `filter: blur(${m[1].replace(/_/g, ' ')});`;

	if (name === 'backdrop-blur-none') return 'backdrop-filter: blur(0); -webkit-backdrop-filter: blur(0);';
	if (name === 'backdrop-blur-sm') return 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);';
	if (name === 'backdrop-blur') return 'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);';
	if (name === 'backdrop-blur-md') return 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);';
	if (name === 'backdrop-blur-lg') return 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);';
	if (name === 'backdrop-blur-xl') return 'backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);';
	if (name === 'backdrop-blur-2xl') return 'backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);';
	if (name === 'backdrop-blur-3xl') return 'backdrop-filter: blur(64px); -webkit-backdrop-filter: blur(64px);';
	if ((m = name.match(/^backdrop-blur-\[(.+)\]$/))) return `backdrop-filter: blur(${m[1].replace(/_/g, ' ')}); -webkit-backdrop-filter: blur(${m[1].replace(/_/g, ' ')});`;

	if ((m = name.match(/^backdrop-brightness-(\d+)$/))) return `backdrop-filter: brightness(${Number(m[1]) / 100}); -webkit-backdrop-filter: brightness(${Number(m[1]) / 100});`;
	if ((m = name.match(/^backdrop-contrast-(\d+)$/))) return `backdrop-filter: contrast(${Number(m[1]) / 100}); -webkit-backdrop-filter: contrast(${Number(m[1]) / 100});`;
	if (name === 'backdrop-grayscale') return 'backdrop-filter: grayscale(100%); -webkit-backdrop-filter: grayscale(100%);';
	if (name === 'backdrop-grayscale-0') return 'backdrop-filter: grayscale(0); -webkit-backdrop-filter: grayscale(0);';
	if (name === 'backdrop-invert') return 'backdrop-filter: invert(100%); -webkit-backdrop-filter: invert(100%);';
	if (name === 'backdrop-invert-0') return 'backdrop-filter: invert(0); -webkit-backdrop-filter: invert(0);';
	if ((m = name.match(/^backdrop-opacity-(\d+)$/))) return `backdrop-filter: opacity(${Number(m[1]) / 100}); -webkit-backdrop-filter: opacity(${Number(m[1]) / 100});`;
	if ((m = name.match(/^backdrop-saturate-(\d+)$/))) return `backdrop-filter: saturate(${Number(m[1]) / 100}); -webkit-backdrop-filter: saturate(${Number(m[1]) / 100});`;
	if (name === 'backdrop-sepia') return 'backdrop-filter: sepia(100%); -webkit-backdrop-filter: sepia(100%);';
	if (name === 'backdrop-sepia-0') return 'backdrop-filter: sepia(0); -webkit-backdrop-filter: sepia(0);';

	if ((m = name.match(/^brightness-(\d+)$/))) return `filter: brightness(${Number(m[1]) / 100});`;
	if ((m = name.match(/^contrast-(\d+)$/))) return `filter: contrast(${Number(m[1]) / 100});`;
	if (name === 'grayscale') return 'filter: grayscale(100%);';
	if (name === 'grayscale-0') return 'filter: grayscale(0);';
	if (name === 'invert') return 'filter: invert(100%);';
	if (name === 'invert-0') return 'filter: invert(0);';
	if ((m = name.match(/^saturate-(\d+)$/))) return `filter: saturate(${Number(m[1]) / 100});`;
	if (name === 'sepia') return 'filter: sepia(100%);';
	if (name === 'sepia-0') return 'filter: sepia(0);';

	if (name === 'drop-shadow-sm') return 'filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.05));';
	if (name === 'drop-shadow') return 'filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06));';
	if (name === 'drop-shadow-md') return 'filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06));';
	if (name === 'drop-shadow-lg') return 'filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04)) drop-shadow(0 4px 3px rgb(0 0 0 / 0.1));';
	if (name === 'drop-shadow-xl') return 'filter: drop-shadow(0 20px 13px rgb(0 0 0 / 0.03)) drop-shadow(0 8px 5px rgb(0 0 0 / 0.08));';
	if (name === 'drop-shadow-2xl') return 'filter: drop-shadow(0 25px 25px rgb(0 0 0 / 0.15));';
	if (name === 'drop-shadow-none') return 'filter: drop-shadow(0 0 #0000);';
	if ((m = name.match(/^drop-shadow-\[(.+)\]$/))) return `filter: drop-shadow(${m[1].replace(/_/g, ' ')});`;

	// Transitions & Animations
	if (name === 'transition-none') return 'transition-property: none;';
	if (name === 'transition-all') return 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;';
	if (name === 'transition' || name === 'transition-colors') return 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;';
	if (name === 'transition-opacity') return 'transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;';
	if (name === 'transition-shadow') return 'transition-property: box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;';
	if (name === 'transition-transform') return 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;';

	if ((m = name.match(/^duration-(\d+)$/))) return `transition-duration: ${m[1]}ms;`;
	if ((m = name.match(/^delay-(\d+)$/))) return `transition-delay: ${m[1]}ms;`;
	if (name === 'ease-linear') return 'transition-timing-function: linear;';
	if (name === 'ease-in') return 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1);';
	if (name === 'ease-out') return 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1);';
	if (name === 'ease-in-out') return 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);';

	if (name === 'animate-none') return 'animation: none;';
	if (name === 'animate-spin') return 'animation: spin 1s linear infinite;';
	if (name === 'animate-ping') return 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;';
	if (name === 'animate-pulse') return 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
	if (name === 'animate-bounce') return 'animation: bounce 1s infinite;';

	// Transforms: Scale, Rotate, Translate
	if ((m = name.match(/^scale-(\d+)$/))) return `transform: scale(${Number(m[1]) / 100});`;
	if ((m = name.match(/^scale-\[(.+)\]$/))) return `transform: scale(${m[1]});`;
	if ((m = name.match(/^scale-x-(\d+)$/))) return `transform: scaleX(${Number(m[1]) / 100});`;
	if ((m = name.match(/^scale-y-(\d+)$/))) return `transform: scaleY(${Number(m[1]) / 100});`;

	if ((m = name.match(/^rotate-(\d+)$/))) return `transform: rotate(${isNegative ? `-${m[1]}` : m[1]}deg);`;
	if ((m = name.match(/^translate-x-(.+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `transform: translateX(${v});`;
	}
	if ((m = name.match(/^translate-y-(.+)$/))) {
		const v = resolveSpacing(m[1], isNegative);
		if (v) return `transform: translateY(${v});`;
	}
	if (name === 'transform') return 'transform: translate(var(--lithe-translate-x, 0), var(--lithe-translate-y, 0)) rotate(var(--lithe-rotate, 0)) scaleX(var(--lithe-scale-x, 1)) scaleY(var(--lithe-scale-y, 1));';
	if (name === 'transform-none') return 'transform: none;';

	// Interactivity & Cursor & User Select
	if (name === 'cursor-auto') return 'cursor: auto;';
	if (name === 'cursor-default') return 'cursor: default;';
	if (name === 'cursor-pointer') return 'cursor: pointer;';
	if (name === 'cursor-wait') return 'cursor: wait;';
	if (name === 'cursor-text') return 'cursor: text;';
	if (name === 'cursor-move') return 'cursor: move;';
	if (name === 'cursor-help') return 'cursor: help;';
	if (name === 'cursor-not-allowed') return 'cursor: not-allowed;';

	if (name === 'select-none') return 'user-select: none; -webkit-user-select: none;';
	if (name === 'select-text') return 'user-select: text; -webkit-user-select: text;';
	if (name === 'select-all') return 'user-select: all; -webkit-user-select: all;';
	if (name === 'select-auto') return 'user-select: auto; -webkit-user-select: auto;';

	if (name === 'pointer-events-none') return 'pointer-events: none;';
	if (name === 'pointer-events-auto') return 'pointer-events: auto;';
	if (name === 'resize-none') return 'resize: none;';
	if (name === 'resize-y') return 'resize: vertical;';
	if (name === 'resize-x') return 'resize: horizontal;';
	if (name === 'resize') return 'resize: both;';

	if (name === 'scroll-auto') return 'scroll-behavior: auto;';
	if (name === 'scroll-smooth') return 'scroll-behavior: smooth;';

	// SVG
	if (name === 'fill-none') return 'fill: none;';
	if (name === 'fill-current') return 'fill: currentColor;';
	if ((m = name.match(/^fill-([^\/]+)$/))) {
		const c = resolveColor(m[1]);
		if (c) return `fill: ${c};`;
	}
	if (name === 'stroke-none') return 'stroke: none;';
	if (name === 'stroke-current') return 'stroke: currentColor;';
	if ((m = name.match(/^stroke-(\d+)$/))) return `stroke-width: ${m[1]}px;`;
	if ((m = name.match(/^stroke-([^\/]+)$/))) {
		const c = resolveColor(m[1]);
		if (c) return `stroke: ${c};`;
	}

	return null;
}

export function generateTailwindCSS(classes: Iterable<string>): string {
	const rulesByMedia: Record<string, string[]> = {
		base: [],
		dark: []
	};

	for (const cls of classes) {
		const parsed = parseTailwindUtility(cls);
		if (!parsed) continue;

		const formatted = `${parsed.selector} { ${parsed.body} }`;

		if (parsed.media) {
			rulesByMedia[parsed.media] = rulesByMedia[parsed.media] || [];
			rulesByMedia[parsed.media].push(formatted);
		} else {
			rulesByMedia.base.push(formatted);
		}
	}

	let generatedCSS = '';
	if (rulesByMedia.base.length > 0) {
		generatedCSS += rulesByMedia.base.join('\n') + '\n';
	}

	// Sort media queries (sm -> md -> lg -> xl -> 2xl)
	const mediaKeys = Object.keys(rulesByMedia).filter(k => k !== 'base' && k !== 'dark');
	mediaKeys.sort((a, b) => {
		const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
		const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
		return numA - numB;
	});

	for (const media of mediaKeys) {
		if (rulesByMedia[media]?.length > 0) {
			generatedCSS += `@media ${media} {\n  ${rulesByMedia[media].join('\n  ')}\n}\n`;
		}
	}

	return generatedCSS.trim();
}

/**
 * Scan source files to extract candidate utility classes from JSX / TS / JS / HTML strings.
 */
async function scanClassesInFiles(dir: string, scanned = new Set<string>()): Promise<Set<string>> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
					await scanClassesInFiles(full, scanned);
				}
			} else if (/\.(?:tsx|ts|jsx|js|html)$/.test(entry.name)) {
				const content = await fs.readFile(full, 'utf8');
				// Scan all words and quoted tokens in the file
				const tokens = content.split(/[\s"'{}`();<>]+|[^\w\-:.\/\[\]#%]+/);
				for (const token of tokens) {
					const t = token.trim().replace(/^['"`]|['"`]$/g, '');
					if (t && (t.includes('-') || t.includes(':') || t.includes('[') || SPACING[t] || ['flex', 'grid', 'block', 'hidden', 'relative', 'absolute', 'fixed', 'sticky', 'border', 'rounded', 'shadow', 'truncate', 'italic', 'uppercase', 'lowercase', 'capitalize', 'underline'].includes(t))) {
						if (!t.startsWith('http') && !t.startsWith('/') && !t.includes('node_modules') && !t.includes('(') && !t.includes(')')) {
							scanned.add(t);
						}
					}
				}
				// Safelist common blur variants when backdrop-blur is used
				if (content.includes('backdrop-blur') || content.includes('glassBlur')) {
					for (const b of ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']) {
						scanned.add(`backdrop-blur-${b}`);
						scanned.add(`blur-${b}`);
					}
				}
			}
		}
	} catch {}
	return scanned;
}

/**
 * Compile Tailwind CSS v3 / v4 with preflight reset, utility generator, and responsive layers.
 */
export async function compileTailwind(css: string = '', config: any = {}): Promise<string> {
	const projectRoot = config?.projectRoot || process.cwd();
	const scanned = await scanClassesInFiles(projectRoot);

	const generatedCSS = generateTailwindCSS(scanned);

	let output = css || '';
	const hasBaseDirective = output.includes('@tailwind base') || output.includes('@tailwind preflight') || output.includes('@import "tailwindcss"');
	const hasUtilitiesDirective = output.includes('@tailwind utilities');

	if (hasBaseDirective) {
		output = output.replace(/@tailwind\s+(?:base|preflight);?|@import\s+["']tailwindcss["'];?/g, PREFLIGHT_CSS);
	}
	if (hasUtilitiesDirective) {
		output = output.replace(/@tailwind\s+utilities;?/g, `/* [lithe-tailwind: utilities] */\n${KEYFRAMES_CSS}\n${generatedCSS}`);
	} else if (!hasBaseDirective) {
		// When no base directive is present, provide complete preflight + keyframes + utilities
		const fullTw = `${PREFLIGHT_CSS}\n/* [lithe-tailwind: utilities] */\n${KEYFRAMES_CSS}\n${generatedCSS}`;
		output = output ? `${output}\n${fullTw}` : fullTw;
	}

	return output.trim();
}

/**
 * Lithe Tailwind Plugin for Vite / Rollup / DevServer
 */
export function litheTailwindPlugin(options: any = {}) {
	return {
		name: 'lithe-tailwind-plugin',
		async compile(cssInput?: string) {
			return compileTailwind(cssInput || '', options);
		},
		async transform(code: string, id: string) {
			if (id.endsWith('.css') && (code.includes('@tailwind') || code.includes('@import "tailwindcss"'))) {
				return { code: await compileTailwind(code, options), map: null };
			}
			return null;
		},
		transformIndexHtml(html: string, compiledCSS: string) {
			if (!compiledCSS) return html;
			const styleTag = `<style data-lithe-tailwind>\n${compiledCSS}\n</style>`;
			return html.includes('</head>') ? html.replace('</head>', `${styleTag}</head>`) : `${html}\n${styleTag}`;
		}
	};
}

export default litheTailwindPlugin;
