export function Panel({ children, className = '' }: { children?: any; className?: string }) {
	return <div class={`card ${className}`}>{children}</div>;
}
