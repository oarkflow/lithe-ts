import path from 'node:path';

export interface TailwindPluginOptions {
	config?: any;
	content?: string[];
	inputCSS?: string;
	plugins?: any[];
	minify?: boolean;
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

			return baseCSS;
		},

		transformIndexHtml(html: string, generatedCSS: string) {
			if (!generatedCSS) return html;
			const styleTag = `<style data-lithe-tailwind>\n${generatedCSS}\n</style>`;
			return html.includes('</head>') ? html.replace('</head>', `${styleTag}\n</head>`) : `${styleTag}\n${html}`;
		}
	};
}

export async function compileTailwind(css: string, config?: any): Promise<string> {
	const plugin = litheTailwindPlugin({ config });
	return plugin.compile(css);
}

export default litheTailwindPlugin;
