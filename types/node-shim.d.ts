/**
 * Minimal Node.js 22.6+ ambient declarations used by Lithe's zero-dependency
 * tooling/test sources. These are intentionally loose: they make the repository
 * self-contained for editors without taking a dependency on @types/node.
 * Applications may use @types/node externally for richer Node API types.
 */
declare var process: any;
declare var Buffer: any;
declare var __dirname: string;
declare var __filename: string;

declare module 'node:assert/strict' { const value: any; export default value; }
declare module 'node:child_process' { export const spawn:any; export const spawnSync:any; export const execFile:any; export const execFileSync:any; }
declare module 'node:crypto' { export const createHash:any; export const randomBytes:any; export const randomUUID:any; export const subtle:any; const value:any; export default value; }
declare module 'node:fs' { const value:any; export default value; export const existsSync:any; export const readFileSync:any; export const writeFileSync:any; export const statSync:any; export const readdirSync:any; export const mkdirSync:any; export const rmSync:any; export const createReadStream:any; export const createWriteStream:any; }
declare module 'node:fs/promises' { const value:any; export default value; export const readFile:any; export const writeFile:any; export const readdir:any; export const mkdir:any; export const rm:any; export const stat:any; export const access:any; export const copyFile:any; export const rename:any; }
declare module 'node:http' { const value:any; export default value; export const createServer:any; export const request:any; export const get:any; }
declare module 'node:module' { export const builtinModules:string[]; export const stripTypeScriptTypes:any; export const createRequire:any; }
declare module 'node:os' { const value:any; export default value; export const tmpdir:any; export const cpus:any; export const homedir:any; export const platform:any; }
declare module 'node:path' { const value:any; export default value; export const join:any; export const resolve:any; export const dirname:any; export const basename:any; export const extname:any; export const relative:any; export const normalize:any; export const sep:string; export const posix:any; }
declare module 'node:perf_hooks' { export const performance:any; export const PerformanceObserver:any; }
declare module 'node:stream' { export const Readable:any; export const Writable:any; export const Transform:any; export const PassThrough:any; }
declare module 'node:test' { export const test:any; export const describe:any; export const it:any; export const before:any; export const after:any; export const beforeEach:any; export const afterEach:any; const value:any; export default value; }
declare module 'node:url' { export const fileURLToPath:any; export const pathToFileURL:any; export const URL:any; export const URLSearchParams:any; }
declare module 'node:vm' { const value:any; export default value; export const Script:any; export const SourceTextModule:any; export const createContext:any; }
declare module 'node:zlib' { export const gzipSync:any; export const gunzipSync:any; export const brotliCompressSync:any; }
