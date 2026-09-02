import { compileModule } from '../compiler/index.ts';
export interface LitheVitePluginOptions {
    include?: RegExp | string[];
    exclude?: RegExp | string[];
    typescript?: boolean;
    sourceMap?: boolean;
    runtimeImport?: string;
    autoWorkers?: boolean;
    lazyEvents?: boolean;
}
const DEFAULT_INCLUDE = /\.[jt]sx?$/;
const DEFAULT_EXCLUDE = /node_modules/;
export function litheVitePlugin(options: LitheVitePluginOptions = {}) {
    const include = options.include || DEFAULT_INCLUDE;
    const exclude = options.exclude || DEFAULT_EXCLUDE;
    const runtimeImport = options.runtimeImport || '@oarkflow/lithe/dom';
    function shouldTransform(id: string): boolean {
        const cleanId = id.split('?')[0].split('#')[0];
        if (exclude instanceof RegExp && exclude.test(cleanId)) return false;
        if (Array.isArray(exclude) && exclude.some(pattern => cleanId.includes(pattern))) return false;
        if (include instanceof RegExp) return include.test(cleanId);
        if (Array.isArray(include)) return include.some(pattern => cleanId.endsWith(pattern));
        return false;
    }
    return {
        name: 'lithe-vite-plugin',
        enforce: 'pre' as const,
        config() {
            return {
                esbuild: {
                    include: /\.(ts|js)$/,
                    exclude: /\.[jt]sx$/
                },
                optimizeDeps: {
                    include: ['@oarkflow/lithe', '@oarkflow/lithe/core', '@oarkflow/lithe/dom', '@oarkflow/lithe/router', '@oarkflow/lithe/server']
                }
            };
        },
        transform(source: string, id: string) {
            if (!shouldTransform(id)) return null;
            const isTsx = /\.tsx$/.test(id);
            const isJsx = /\.jsx$/.test(id);
            const isTs = /\.ts$/.test(id);
            const containsJSX = /<[A-Za-z0-9_$>]/.test(source);
            if (!containsJSX && !isTsx && !isTs) return null;
            const result = compileModule(source, {
                filename: id,
                typescript: options.typescript ?? (isTsx || isTs),
                injectRuntime: true,
                runtimeImport,
                sourceMap: options.sourceMap ?? true,
                autoWorkers: options.autoWorkers ?? false,
                lazyEvents: options.lazyEvents ?? false
            });
            if (!result.changed && !isTsx && !isTs) return null;
            return {
                code: result.code,
                map: result.map
            };
        }
    };
}
export default litheVitePlugin;
