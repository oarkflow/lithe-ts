import { compileModule } from '../compiler/index.ts';
export interface LitheBabelPluginOptions {
    runtimeImport?: string;
    typescript?: boolean;
    autoWorkers?: boolean;
    lazyEvents?: boolean;
}

/**
 * Lithe Babel Plugin / Preset adapter
 * Compatible with Babel 7 / 8 AST/Program transforms or custom string transforms
 */
export function litheBabelPlugin(api?: any, options: LitheBabelPluginOptions = {}) {
    if (api && typeof api.assertVersion === 'function') {
        try {
            api.assertVersion(7);
        } catch { }
    }
    const runtimeImport = options.runtimeImport || '@oarkflow/lithe/dom';
    return {
        name: 'babel-plugin-lithe',
        visitor: {
            Program(path: any, state: any) {
                const filename = state.filename || state.file?.opts?.filename || 'module.jsx';
                const rawCode = state.file?.code;
                if (!rawCode) return;

                // Skip if not JSX / TSX
                if (!/<[A-Za-z0-9_$>]/.test(rawCode)) return;
                const result = compileModule(rawCode, {
                    filename,
                    typescript: options.typescript ?? /\.tsx?$/.test(filename),
                    injectRuntime: true,
                    runtimeImport,
                    sourceMap: false,
                    autoWorkers: options.autoWorkers ?? false,
                    lazyEvents: options.lazyEvents ?? false
                });
                if (result.changed) {
                    // If Babel is being used programmatically with parser/ast
                    if (path.hub?.file?.ast && api?.parseSync) {
                        try {
                            const newAst = api.parseSync(result.code, {
                                filename,
                                sourceType: 'module'
                            });
                            if (newAst && newAst.program) {
                                path.replaceWith(newAst.program);
                                return;
                            }
                        } catch { }
                    }
                }
            }
        },
        // Direct transform helper for custom babel execution chains
        transform(code: string, filename = 'module.jsx') {
            return compileModule(code, {
                filename,
                typescript: options.typescript ?? /\.tsx?$/.test(filename),
                injectRuntime: true,
                runtimeImport,
                sourceMap: true,
                autoWorkers: options.autoWorkers ?? false,
                lazyEvents: options.lazyEvents ?? false
            });
        }
    };
}
export default litheBabelPlugin;
