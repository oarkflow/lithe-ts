import { spawnSync } from 'node:child_process';
const KEYWORDS = new Set('await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch this throw try typeof var void while with yield async of get set true false null undefined'.split(' '));
const PUNCT = ['>>>=', '===', '!==', '**=', '&&=', '||=', '??=', '>>>', '<<=', '>>=', '=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '?.', '**', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '...'];
function isStart(c) {
    return /[A-Za-z_$]/.test(c || '');
}
function isPart(c) {
    return /[\w$]/.test(c || '');
}
function loc(source, offset) {
    let line = 1,
        column = 0;
    for (let i = 0; i < offset; i++) {
        if (source.charCodeAt(i) === 10) {
            line++;
            column = 0;
        } else column++;
    }
    return {
        line,
        column
    };
}
function location(source, start, end) {
    return {
        start: {
            offset: start,
            ...loc(source, start)
        },
        end: {
            offset: end,
            ...loc(source, end)
        }
    };
}
function readString(source, i, quote) {
    let j = i + 1;
    for (; j < source.length; j++) {
        if (source[j] === '\\') {
            j++;
            continue;
        }
        if (source[j] === quote) {
            j++;
            break;
        }
    }
    return j;
}
function readTemplate(source, i) {
    let j = i + 1,
        depth = 0;
    for (; j < source.length; j++) {
        if (source[j] === '\\') {
            j++;
            continue;
        }
        if (source[j] === '`' && depth === 0) {
            j++;
            break;
        }
        if (source[j] === '$' && source[j + 1] === '{') {
            depth++;
            j++;
            continue;
        }
        if (source[j] === '}' && depth) depth--;
    }
    return j;
}
function readRegex(source, i) {
    let j = i + 1,
        cls = false;
    for (; j < source.length; j++) {
        if (source[j] === '\\') {
            j++;
            continue;
        }
        if (source[j] === '[') cls = true; else if (source[j] === ']') cls = false; else if (source[j] === '/' && !cls) {
            j++;
            while (/[A-Za-z]/.test(source[j] || '')) j++;
            break;
        }
    }
    return j;
}
function regexContext(tokens) {
    const t = tokens.at(-1);
    if (!t) return true;
    if (t.type === 'keyword') return new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of', 'await', 'yield', 'else', 'do']).has(t.value);
    if (t.type === 'punctuator') return !new Set([')', ']', '}', '++', '--']).has(t.value);
    return false;
}
export function tokenizeJavaScript(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
        const start = i,
            c = source[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (c === '/' && source[i + 1] === '/') {
            i += 2;
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && source[i + 1] === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
            i = Math.min(source.length, i + 2);
            continue;
        }
        if (c === '/' && regexContext(tokens) && source[i + 1] !== '=' && source[i + 1] !== '/' && source[i + 1] !== '*') {
            i = readRegex(source, i);
            tokens.push({
                type: 'regex',
                value: source.slice(start, i),
                start,
                end: i,
                ...loc(source, start)
            });
            continue;
        }
        if (c === '"' || c === "'") {
            i = readString(source, i, c);
            tokens.push({
                type: 'string',
                value: source.slice(start, i),
                start,
                end: i,
                ...loc(source, start)
            });
            continue;
        }
        if (c === '`') {
            i = readTemplate(source, i);
            tokens.push({
                type: 'template',
                value: source.slice(start, i),
                start,
                end: i,
                ...loc(source, start)
            });
            continue;
        }
        if (isStart(c)) {
            i++;
            while (isPart(source[i])) i++;
            const value = source.slice(start, i);
            tokens.push({
                type: KEYWORDS.has(value) ? 'keyword' : 'identifier',
                value,
                start,
                end: i,
                ...loc(source, start)
            });
            continue;
        }
        if (/[0-9]/.test(c) || c === '.' && /[0-9]/.test(source[i + 1])) {
            i++;
            while (/[0-9A-Fa-f_xXoObBeE.n]/.test(source[i] || '')) i++;
            tokens.push({
                type: 'number',
                value: source.slice(start, i),
                start,
                end: i,
                ...loc(source, start)
            });
            continue;
        }
        let punct = PUNCT.find(p => source.startsWith(p, i));
        if (!punct) punct = c;
        i += punct.length;
        tokens.push({
            type: 'punctuator',
            value: punct,
            start,
            end: i,
            ...loc(source, start)
        });
    }
    return tokens;
}
function diagnosticFrom(stderr, filename) {
    const text = String(stderr || '').trim();
    const lineMatch = text.match(/(?:\[stdin\]|[^\n:]+):(\d+)(?:\n|:)/);
    const caretLine = text.split('\n').findIndex(x => /^\s*\^+\s*$/.test(x));
    const lines = text.split('\n');
    let column = 0;
    if (caretLine > 0) column = Math.max(0, lines[caretLine].indexOf('^'));
    const message = (lines.find(x => /SyntaxError:/.test(x)) || lines.at(-1) || 'Syntax error').replace(/^.*SyntaxError:\s*/, '');
    return {
        severity: 'error',
        code: 'JS_SYNTAX',
        file: filename,
        line: Number(lineMatch?.[1] || 1),
        column,
        message,
        engine: 'v8'
    };
}
function checkOnce(source) {
    return spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: source,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
    });
}
export function validateJavaScript(source, options = {}) {
    const filename = options.filename || '<module>',
        maxErrors = options.maxErrors ?? 8,
        diagnostics = [];
    let working = String(source),
        attempts = 0;
    while (attempts++ < maxErrors) {
        const result = checkOnce(working);
        if (result.status === 0) return {
            valid: diagnostics.length === 0,
            diagnostics,
            recovered: diagnostics.length > 0,
            engine: 'v8'
        };
        const d = diagnosticFrom(result.stderr, filename);
        diagnostics.push(d);
        const lines = working.split('\n'),
            idx = Math.max(0, Math.min(lines.length - 1, (d.line || 1) - 1));
        if (!lines[idx] || /^\s*;*\s*$/.test(lines[idx])) break;
        lines[idx] = lines[idx].replace(/[^\t ]/g, ' ') + ';';
        working = lines.join('\n');
    }
    return {
        valid: false,
        diagnostics,
        recovered: diagnostics.length > 1,
        engine: 'v8'
    };
}
function matching(tokens, start, open = '{', close = '}') {
    let depth = 0;
    for (let i = start; i < tokens.length; i++) {
        if (tokens[i].value === open) depth++; else if (tokens[i].value === close && --depth === 0) return i;
    }
    return tokens.length - 1;
}
function statementEnd(tokens, start, limit = tokens.length) {
    let par = 0,
        bracket = 0,
        brace = 0;
    for (let i = start; i < limit; i++) {
        const v = tokens[i].value;
        if (v === '(') par++; else if (v === ')') par--; else if (v === '[') bracket++; else if (v === ']') bracket--; else if (v === '{') brace++; else if (v === '}') {
            if (brace === 0 && par === 0 && bracket === 0) return i - 1;
            brace--;
        } else if (v === ';' && par === 0 && bracket === 0 && brace === 0) return i;
    }
    return Math.max(start, limit - 1);
}
function node(source, type, startTok, endTok, extra = {}) {
    const start = startTok?.start ?? 0,
        end = endTok?.end ?? start;
    return {
        type,
        start,
        end,
        loc: location(source, start, end),
        raw: source.slice(start, end),
        ...extra
    };
}
function declarationNames(tokens, start, end) {
    const names = [];
    for (let i = start; i <= end; i++) {
        const t = tokens[i];
        if (t?.type === 'identifier' && (i === start || tokens[i - 1]?.value === ',' || ['const', 'let', 'var'].includes(tokens[i - 1]?.value))) names.push(t.value);
    }
    return names;
}
function parseBlock(source, tokens, openIndex, closeIndex, scopeType = 'block') {
    return node(source, 'BlockStatement', tokens[openIndex], tokens[closeIndex], {
        body: parseRange(source, tokens, openIndex + 1, closeIndex),
        scopeType
    });
}
function parseFunction(source, tokens, start, end, exported = false) {
    let i = start;
    if (tokens[i]?.value === 'export') i++;
    const async = tokens[i]?.value === 'async';
    if (async) i++;
    i++;
    const id = tokens[i]?.type === 'identifier' ? {
        type: 'Identifier',
        name: tokens[i++].value
    } : null;
    while (i <= end && tokens[i]?.value !== '(') i++;
    const po = i,
        pc = matching(tokens, po, '(', ')'),
        params = [];
    for (let j = po + 1; j < pc; j++) if (tokens[j]?.type === 'identifier' && (j === po + 1 || tokens[j - 1]?.value === ',' || tokens[j - 1]?.value === '...')) params.push({
        type: 'Identifier',
        name: tokens[j].value,
        start: tokens[j].start,
        end: tokens[j].end
    });
    let bo = pc + 1;
    while (bo <= end && tokens[bo]?.value !== '{') bo++;
    const bc = bo <= end ? matching(tokens, bo, '{', '}') : end;
    return node(source, 'FunctionDeclaration', tokens[start], tokens[Math.max(end, bc)], {
        id,
        params,
        async,
        exported,
        body: bo <= end ? parseBlock(source, tokens, bo, bc, 'function') : null
    });
}
function parseClass(source, tokens, start, end, exported = false) {
    let i = start;
    if (tokens[i]?.value === 'export') i++;
    i++;
    const id = tokens[i]?.type === 'identifier' ? {
        type: 'Identifier',
        name: tokens[i].value
    } : null;
    let bo = i;
    while (bo <= end && tokens[bo]?.value !== '{') bo++;
    const bc = bo <= end ? matching(tokens, bo, '{', '}') : end;
    return node(source, 'ClassDeclaration', tokens[start], tokens[Math.max(end, bc)], {
        id,
        exported,
        body: bo <= end ? parseBlock(source, tokens, bo, bc, 'class') : null
    });
}
function parseImport(source, tokens, start, end) {
    const specs = [];
    let from = null;
    for (let i = start + 1; i <= end; i++) {
        if (tokens[i]?.value === 'from' && tokens[i + 1]?.type === 'string') from = tokens[i + 1].value.slice(1, -1); else if (tokens[i]?.type === 'string' && !from) from = tokens[i].value.slice(1, -1);
        if (tokens[i]?.type === 'identifier' && tokens[i - 1]?.value !== 'from' && tokens[i - 1]?.value !== 'as') specs.push(tokens[i].value);
    }
    return node(source, 'ImportDeclaration', tokens[start], tokens[end], {
        source: from,
        specifiers: [...new Set(specs)]
    });
}
function parseExport(source, tokens, start, end) {
    if (tokens[start + 1]?.value === 'default') return node(source, 'ExportDefaultDeclaration', tokens[start], tokens[end], {});
    if (tokens[start + 1]?.value === 'function' || tokens[start + 1]?.value === 'async' && tokens[start + 2]?.value === 'function') return parseFunction(source, tokens, start, end, true);
    if (tokens[start + 1]?.value === 'class') return parseClass(source, tokens, start, end, true);
    const names = [];
    for (let i = start + 1; i <= end; i++) if (tokens[i]?.type === 'identifier' && !['from', 'as'].includes(tokens[i - 1]?.value)) names.push(tokens[i].value);
    return node(source, 'ExportNamedDeclaration', tokens[start], tokens[end], {
        exports: [...new Set(names)]
    });
}
function parseRange(source, tokens, start = 0, end = tokens.length) {
    const body = [];
    let i = start;
    while (i < end) {
        const t = tokens[i];
        if (!t) break;
        if (t.value === ';') {
            i++;
            continue;
        }
        let j = statementEnd(tokens, i, end);
        if (t.value === 'import') body.push(parseImport(source, tokens, i, j)); else if (t.value === 'export') body.push(parseExport(source, tokens, i, j)); else if (t.value === 'async' && tokens[i + 1]?.value === 'function' || t.value === 'function') body.push(parseFunction(source, tokens, i, j, false)); else if (t.value === 'class') body.push(parseClass(source, tokens, i, j, false)); else if (['const', 'let', 'var'].includes(t.value)) {
            body.push(node(source, 'VariableDeclaration', t, tokens[j], {
                kind: t.value,
                declarations: declarationNames(tokens, i + 1, j).map(name => ({
                    type: 'VariableDeclarator',
                    id: {
                        type: 'Identifier',
                        name
                    }
                }))
            }));
        } else if (t.value === '{') {
            const close = matching(tokens, i, '{', '}');
            body.push(parseBlock(source, tokens, i, close));
            j = close;
        } else {
            const map = {
                if: 'IfStatement',
                for: 'ForStatement',
                while: 'WhileStatement',
                do: 'DoWhileStatement',
                switch: 'SwitchStatement',
                try: 'TryStatement',
                return: 'ReturnStatement',
                throw: 'ThrowStatement',
                break: 'BreakStatement',
                continue: 'ContinueStatement',
                with: 'WithStatement',
                debugger: 'DebuggerStatement'
            };
            body.push(node(source, map[t.value] || 'ExpressionStatement', t, tokens[j], {}));
        }
        i = Math.max(i + 1, j + 1);
    }
    return body;
}
function collectScopes(program, tokens) {
    let seq = 0;
    const root = {
        id: ++seq,
        type: 'module',
        parent: null,
        start: 0,
        end: program.end,
        declarations: new Set(),
        references: new Set(),
        children: []
    };
    const stack = [root],
        byStart = new Map();
    function enter(type, start, end) {
        const parent = stack.at(-1),
            scope = {
                id: ++seq,
                type,
                parent: parent.id,
                start,
                end,
                declarations: new Set(),
                references: new Set(),
                children: []
            };
        parent.children.push(scope);
        stack.push(scope);
        return scope;
    }
    function leave() {
        stack.pop();
    }
    const declToken = new Set();
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i],
            prev = tokens[i - 1];
        if (['const', 'let', 'var', 'function', 'class', 'import'].includes(prev?.value) && t.type === 'identifier') {
            stack.at(-1).declarations.add(t.value);
            declToken.add(i);
        }
        if (t.value === '{') {
            const close = matching(tokens, i, '{', '}');
            byStart.set(i, {
                close
            });
            enter('block', t.start, tokens[close]?.end ?? t.end);
        }
        if (t.value === '}' && stack.length > 1) leave();
        if (t.type === 'identifier' && !declToken.has(i) && prev?.value !== '.' && prev?.value !== '?.' && !KEYWORDS.has(t.value)) stack.at(-1).references.add(t.value);
    }
    function clean(s) {
        return {
            id: s.id,
            type: s.type,
            parent: s.parent,
            start: s.start,
            end: s.end,
            declarations: [...s.declarations],
            references: [...s.references],
            children: s.children.map(clean)
        };
    }
    return clean(root);
}
export function parseJavaScript(source, options = {}) {
    source = String(source);
    const validation = validateJavaScript(source, options),
        tokens = tokenizeJavaScript(source),
        body = parseRange(source, tokens),
        program = {
            type: 'Program',
            sourceType: 'module',
            start: 0,
            end: source.length,
            loc: location(source, 0, source.length),
            body,
            tokens,
            diagnostics: validation.diagnostics,
            valid: validation.valid,
            recovered: validation.recovered,
            engine: 'lithe-structural+v8',
            source
        };
    program.scopes = collectScopes(program, tokens);
    if (validation.diagnostics.length) program.body.push(...validation.diagnostics.map(d => ({
        type: 'ErrorStatement',
        message: d.message,
        start: 0,
        end: 0,
        loc: {
            start: {
                line: d.line,
                column: d.column,
                offset: 0
            },
            end: {
                line: d.line,
                column: d.column,
                offset: 0
            }
        }
    })));
    return program;
}
