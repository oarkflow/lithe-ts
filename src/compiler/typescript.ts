import { stripTypeScriptTypes } from 'node:module';
if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
    const origEmitWarning = process.emitWarning;
    process.emitWarning = function (warning, ...args) {
        if (typeof warning === 'string' && warning.includes('stripTypeScriptTypes')) return;
        if (warning && typeof warning === 'object' && typeof warning.message === 'string' && warning.message.includes('stripTypeScriptTypes')) return;
        return origEmitWarning.apply(process, [warning, ...args]);
    };
}

// Node >=22 ships a native TypeScript syntax transformer. Lithe uses it first and
// retains a conservative fallback for environments/builds where a particular
// syntax form is not accepted (notably raw TSX, which Lithe transforms before this stage).
function stripParamList(list) {
    return list.replace(/([A-Za-z_$][\w$]*)(\?)?\s*:\s*([^,=]+)(?=\s*(?:,|=|$))/g, '$1').replace(/\.\.\.([A-Za-z_$][\w$]*)\s*:\s*([^,=]+)(?=\s*(?:,|=|$))/g, '...$1');
}
function stripInterfaces(source) {
    let out = '',
        i = 0;
    const re = /\b(?:export\s+)?interface\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[^\{]+)?\s*\{/g;
    let m;
    while (m = re.exec(source)) {
        out += source.slice(i, m.index);
        let p = re.lastIndex,
            depth = 1;
        while (p < source.length && depth) {
            if (source[p] === '{') depth++; else if (source[p] === '}') depth--;
            p++;
        }
        i = p;
        re.lastIndex = p;
    }
    return out + source.slice(i);
}
function fallbackStrip(source) {
    let code = stripInterfaces(source);
    code = code.replace(/^\s*(?:export\s+)?type\s+[A-Za-z_$][\w$]*(?:\s*<[^;=]+>)?\s*=\s*[^;]+;?\s*$/gm, '');
    code = code.replace(/\bimport\s+type\s+/g, 'import ').replace(/^\s*export\s+type\s*\{[^}]*\}\s*;?\s*$/gm, '');
    code = code.replace(/\b(public|private|protected|readonly|abstract|declare|override)\s+/g, '');
    code = code.replace(/\s+implements\s+[^{]+(?=\s*\{)/g, '');
    code = code.replace(/\bas\s+const\b/g, '').replace(/\bas\s+[A-Za-z_$][\w$]*(?:\s*<[^;,)]+>)?(?:\[\])?(?:\s*\|\s*[A-Za-z_$][\w$]*)*/g, '');
    code = code.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([^=;\n]+)(?=\s*[=;])/g, '$1 $2');
    code = code.replace(/function(\s+[A-Za-z_$][\w$]*)?\s*(?:<[^>{}()]+>)?\s*\(([^()]*)\)/g, (m, name = '', params) => `function${name}(${stripParamList(params)})`);
    code = code.replace(/\(([^()]*)\)\s*:\s*[^=\{\n]+(?=\s*=>)/g, (m, params) => `(${stripParamList(params)})`);
    code = code.replace(/\(([^()]*)\)\s*:\s*[^\{\n]+(?=\s*\{)/g, (m, params) => `(${stripParamList(params)})`);
    code = code.replace(/\(([^()]*)\)\s*=>/g, (m, params) => `(${stripParamList(params)}) =>`);
    code = code.replace(/^([ \t]*)([A-Za-z_$][\w$]*)\??\s*:\s*([^=;\n]+)([;=])/gm, '$1$2$4');
    code = code.replace(/([A-Za-z_$][\w$]*)!\./g, '$1.').replace(/([A-Za-z_$][\w$]*)!([,;)])/g, '$1$2');
    return code;
}
export function stripTypeScript(source, options = {}) {
    if (options.native !== false && typeof stripTypeScriptTypes === 'function') {
        try {
            return stripTypeScriptTypes(source, {
                mode: 'transform',
                sourceMap: false,
                sourceUrl: options.filename
            });
        } catch (error) {
            if (options.fallback === false) throw error;
        }
    }
    return fallbackStrip(source);
}
export function hasNativeTypeScriptTransform() {
    return typeof stripTypeScriptTypes === 'function';
}
