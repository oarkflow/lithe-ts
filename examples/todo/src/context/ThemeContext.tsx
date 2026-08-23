import { createContext, useContext, state } from 'lithe/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
	mode: ThemeMode;
	accent: string;
	setMode(mode: ThemeMode): void;
	setAccent(accent: string): void;
}

const defaultTheme = state<ThemeContextValue>({
	mode: 'system',
	accent: '#6f5cff',
	setMode(mode: ThemeMode) {
		defaultTheme.mode = mode;
		document.documentElement.setAttribute('data-theme', mode);
	},
	setAccent(accent: string) {
		defaultTheme.accent = accent;
		document.documentElement.style.setProperty('--accent', accent);
	}
});

export const ThemeContext = createContext<ThemeContextValue>(defaultTheme, { name: 'Theme' });

export function useTheme(): ThemeContextValue {
	return useContext(ThemeContext);
}
