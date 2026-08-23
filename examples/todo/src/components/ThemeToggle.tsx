import { useTheme } from '../context/ThemeContext.tsx';

export function ThemeToggle() {
	const theme = useTheme();

	return <div class="theme-toggle">
		<button
			type="button"
			class="btn-theme"
			onClick={() => theme.setMode(theme.mode === 'dark' ? 'light' : 'dark')}
			title="Toggle Light/Dark Theme (Context & Signals)"
		>
			{() => theme.mode === 'dark' ? '☀️ Light' : '🌙 Dark'}
		</button>
	</div>;
}
