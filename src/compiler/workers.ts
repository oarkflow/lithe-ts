const KEYWORDS = new Set('await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch this throw try typeof var void while with yield async of get set true false null undefined'.split(' '));
const GLOBALS = new Set('Math JSON Array Object Number String Boolean BigInt Map Set WeakMap WeakSet Date RegExp Promise Error TypeError RangeError Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Float32Array Float64Array ArrayBuffer DataView TextEncoder TextDecoder URL URLSearchParams crypto structuredClone console'.split(' '));
function matchBrace(code, start) {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
        const c = code[i];
        if (c === '"' || c === "'" || c === '`') {
            const q = c;
            i++;
            for (; i < code.length; i++) {
                if (code[i] === '\\') {
                    i++;
                    continue;
                }
                if (code[i] === q) break;
            }
            continue;
        }
        if (c === '/' && code[i + 1] === '/') {
            i += 2;
            while (i < code.length && code[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i++;
            continue;
        }
        if (c === '{') depth++; else if (c === '}' && --depth === 0) return i;
    }
    return -1;
}
function namesIn(text) {
    const out = [];
    for (const m of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
        const prev = text[m.index - 1];
        if (prev === '.') continue;
        out.push(m[0]);
    }
    return out;
}
function safeBody(body, params, name) {
    if (/\b(?:this|arguments|super|yield|document|window|navigator|localStorage|sessionStorage|HTMLElement|customElements)\b/.test(body)) return false;
    const locals = new Set(params);
    locals.add(name);
    for (const m of body.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) locals.add(m[1]);
    for (const id of namesIn(body)) if (!locals.has(id) && !GLOBALS.has(id) && !KEYWORDS.has(id)) return false;
    return true;
}
function callsAwaited(code, name, start, end) {
    const rest = code.slice(0, start) + code.slice(end);
    const refs = [...rest.matchAll(new RegExp(`\\b${name}\\b`, 'g'))];
    if (!refs.length) return false;
    return refs.every(m => {
        const before = rest.slice(Math.max(0, m.index - 16), m.index),
            after = rest.slice(m.index + name.length, m.index + name.length + 8);
        return /await\s*$/.test(before) && /^\s*\(/.test(after);
    });
}
export function transformWorkerPlacement(code, options = {}) {
    const candidates = [],
        re = /(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
    let m;
    while (m = re.exec(code)) {
        const open = code.indexOf('{', m.index),
            close = matchBrace(code, open);
        if (close < 0) break;
        const body = code.slice(open + 1, close),
            params = m[4].split(',').map(x => x.trim().replace(/=.*$/, '')).filter(x => /^[A-Za-z_$][\w$]*$/.test(x)),
            explicit = /^\s*['"]use worker['"]\s*;/.test(body),
            auto = options.autoWorkers !== false && (/\b(?:for|while|reduce|map|sort)\b/.test(body) || body.length > (options.threshold ?? 400)) && safeBody(body, params, m[3]) && callsAwaited(code, m[3], m.index, close + 1);
        if (explicit || auto) candidates.push({
            start: m.index,
            end: close + 1,
            exported: Boolean(m[1]),
            async: Boolean(m[2]),
            name: m[3],
            params: m[4],
            body: body.replace(/^\s*['"]use worker['"]\s*;/, ''),
            mode: explicit ? 'directive' : 'auto'
        });
        re.lastIndex = close + 1;
    }
    let out = code;
    for (const c of candidates.reverse()) {
        const fn = `${c.async ? 'async ' : ''}function ${c.name}(${c.params}){${c.body}}`,
            replacement = `${c.exported ? 'export ' : ''}const ${c.name}=__litheWorker(${fn},{name:${JSON.stringify(c.name)}});`;
        out = out.slice(0, c.start) + replacement + out.slice(c.end);
    }
    return {
        code: out,
        changed: candidates.length > 0,
        candidates: candidates.reverse().map(({
            start,
            end,
            body,
            ...x
        }) => x)
    };
}
