// Lightweight dependency-free semantic checker for the TypeScript subset most application
// code uses at framework boundaries. Node's native transformer remains the syntax authority;
// this pass adds assignability checks for declarations, objects, arrays, unions and calls.
function splitTop(text: string, delimiter = ','): string[] {
  const out: string[] = [];
  let start = 0, round = 0, square = 0, curly = 0, angle = 0, quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '(') round++;
    else if (c === ')') round--;
    else if (c === '[') square++;
    else if (c === ']') square--;
    else if (c === '{') curly++;
    else if (c === '}') curly--;
    else if (c === '<') angle++;
    else if (c === '>') angle = Math.max(0, angle - 1);
    else if (c === delimiter && round === 0 && square === 0 && curly === 0 && angle === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function balanced(source: string, start: number, open = '{', close = '}'): number {
  let depth = 0, quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return source.length - 1;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

const primitive = new Set(['string', 'number', 'boolean', 'bigint', 'symbol', 'null', 'undefined', 'void', 'unknown', 'any', 'never', 'object', 'PropertyKey']);
function named(name: string) { return { kind: 'named', name }; }
function union(types: any[]) {
  const flat: any[] = [];
  for (const t of types) {
    if (t.kind === 'union') flat.push(...t.types);
    else flat.push(t);
  }
  const seen = new Map<string, any>();
  for (const t of flat) seen.set(typeText(t), t);
  return seen.size === 1 ? [...seen.values()][0] : { kind: 'union', types: [...seen.values()] };
}

function typeText(t: any): string {
  if (!t) return 'unknown';
  if (t.kind === 'primitive') return t.name;
  if (t.kind === 'literal') return JSON.stringify(t.value);
  if (t.kind === 'array') return `${typeText(t.element)}[]`;
  if (t.kind === 'union') return t.types.map(typeText).join(' | ');
  if (t.kind === 'object') return `{ ${Object.entries(t.props).map(([k, v]: [string, any]) => `${k}${v.optional ? '?' : ''}: ${typeText(v.type)}`).join('; ')} }`;
  if (t.kind === 'generic') return `${t.name}<${t.args.map(typeText).join(', ')}>`;
  if (t.kind === 'function') return `(${t.params.map(typeText).join(', ')}) => ${typeText(t.returns)}`;
  return t.name || 'unknown';
}

function stripOuter(text: string): string {
  text = text.trim();
  while (text[0] === '(' && text.at(-1) === ')' && balanced(text, 0, '(', ')') === text.length - 1) text = text.slice(1, -1).trim();
  return text;
}

export function parseType(text: string, env: Map<string, any> = new Map()): any {
  text = stripOuter(String(text || '').replace(/^readonly\s+/, ''));
  if (!text) return { kind: 'primitive', name: 'unknown' };
  const unions = splitTop(text, '|');
  if (unions.length > 1) return union(unions.map(x => parseType(x, env)));
  if (text.endsWith('[]')) return { kind: 'array', element: parseType(text.slice(0, -2), env) };
  let m = text.match(/^([A-Za-z_$][\w$]*)\s*<([\s\S]+)>$/);
  if (m) return { kind: 'generic', name: m[1], args: splitTop(m[2]).map(x => parseType(x, env)) };
  if (text.startsWith('{') && text.endsWith('}')) {
    const props: Record<string, any> = {};
    for (const part of splitTop(text.slice(1, -1), ';').flatMap(x => splitTop(x))) {
      const p = part.match(/^(?:readonly\s+)?([A-Za-z_$][\w$]*|["'][^"']+["'])\s*(\?)?\s*:\s*([\s\S]+)$/);
      if (p) {
        const key = p[1].replace(/^["']|["']$/g, '');
        props[key] = { optional: Boolean(p[2]), type: parseType(p[3], env) };
      }
    }
    return { kind: 'object', props };
  }
  if (/^['"].*['"]$/.test(text)) return { kind: 'literal', value: text.slice(1, -1) };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: 'literal', value: Number(text) };
  if (text === 'true' || text === 'false') return { kind: 'literal', value: text === 'true' };
  if (primitive.has(text)) return { kind: 'primitive', name: text };
  if (env.has(text)) return env.get(text);
  return named(text);
}

function literalPrimitive(v: any): string {
  if (v === null) return 'null';
  return typeof v;
}

function substitute(t: any, map: Map<string, any>): any {
  if (!t) return t;
  if (t.kind === 'named' && map.has(t.name)) return map.get(t.name);
  if (t.kind === 'array') return { ...t, element: substitute(t.element, map) };
  if (t.kind === 'union') return { ...t, types: t.types.map((x: any) => substitute(x, map)) };
  if (t.kind === 'generic') return { ...t, args: t.args.map((x: any) => substitute(x, map)) };
  if (t.kind === 'object') return { ...t, props: Object.fromEntries(Object.entries(t.props).map(([k, v]: [string, any]) => [k, { ...v, type: substitute(v.type, map) }])) };
  if (t.kind === 'function') return { ...t, params: t.params.map((x: any) => substitute(x, map)), returns: substitute(t.returns, map) };
  return t;
}

function resolve(t: any, env: Map<string, any>, seen = new Set<string>()): any {
  if (!t) return t;
  if (t.kind === 'generic') {
    const def = env.get(t.name);
    if (def?.kind === 'genericDef' && !seen.has(t.name)) {
      seen.add(t.name);
      const map = new Map(def.params.map((p: string, i: number) => [p, t.args[i] || { kind: 'primitive', name: 'unknown' }]));
      return resolve(substitute(def.body, map), env, seen);
    }
    return t;
  }
  if (t.kind !== 'named' || seen.has(t.name)) return t;
  seen.add(t.name);
  return env.get(t.name) ? resolve(env.get(t.name), env, seen) : t;
}

export function isTypeAssignable(from: any, to: any, env: Map<string, any> = new Map(), depth = 0): boolean {
  if (depth > 6) return true;
  from = resolve(from, env);
  to = resolve(to, env);
  if (!to || (to.kind === 'primitive' && ['any', 'unknown'].includes(to.name))) return true;
  if (from?.kind === 'primitive' && ['any', 'unknown', 'never'].includes(from.name)) return true;
  if (!from) return false;
  if (from.kind === 'union') return from.types.every((t: any) => isTypeAssignable(t, to, env, depth + 1));
  if (to.kind === 'union') return to.types.some((t: any) => isTypeAssignable(from, t, env, depth + 1));
  
  if (to.kind === 'primitive' && to.name === 'PropertyKey') {
    if (from.kind === 'literal' && (typeof from.value === 'string' || typeof from.value === 'number' || typeof from.value === 'symbol')) return true;
    if (from.kind === 'primitive' && ['string', 'number', 'symbol'].includes(from.name)) return true;
  }

  if (to.kind === 'primitive' && to.name === 'object') {
    if (from.kind === 'object' || from.kind === 'array' || from.kind === 'function') return true;
    if (from.kind === 'generic' && ['Record', 'Map', 'Set', 'Array'].includes(from.name)) return true;
  }

  if (to.kind === 'generic' && to.name === 'Record') {
    if (from.kind === 'object' || (from.kind === 'generic' && ['Record', 'Map'].includes(from.name))) return true;
  }

  if (from.kind === 'literal') {
    if (to.kind === 'literal') return Object.is(from.value, to.value);
    if (to.kind === 'primitive') return literalPrimitive(from.value) === to.name || (from.value === null && to.name === 'object');
  }

  if (from.kind === 'primitive' && to.kind === 'primitive') {
    return from.name === to.name || (from.name === 'undefined' && to.name === 'void');
  }

  if (from.kind === 'array' && to.kind === 'array') {
    if (from.element?.kind === 'primitive' && from.element?.name === 'never') return true;
    return isTypeAssignable(from.element, to.element, env, depth + 1);
  }
  if (from.kind === 'array' && to.kind === 'generic' && ['Array', 'ReadonlyArray'].includes(to.name)) return isTypeAssignable(from.element, to.args[0], env, depth + 1);
  if (from.kind === 'generic' && to.kind === 'generic' && from.name === to.name && from.args.length === to.args.length) return from.args.every((x: any, i: number) => isTypeAssignable(x, to.args[i], env, depth + 1));
  if (from.kind === 'generic' && to.kind === 'generic' && from.name === to.name && (from.name === 'Map' || from.name === 'Set')) return true;

  if (from.kind === 'object' && to.kind === 'object') {
    if (Object.keys(from.props).length === 0) return true;
    for (const [k, p] of Object.entries(to.props) as [string, any][]) {
      const got = from.props[k];
      if (!got) {
        if (!p.optional) return false;
        continue;
      }
      if (!isTypeAssignable(got.type, p.type, env, depth + 1)) return false;
    }
    return true;
  }

  if (from.kind === 'function' && to.kind === 'function') {
    return from.params.length >= to.params.length && to.params.every((p: any, i: number) => isTypeAssignable(p, from.params[i], env, depth + 1)) && isTypeAssignable(from.returns, to.returns, env, depth + 1);
  }

  if (from.kind === 'named' && to.kind === 'named') return from.name === to.name;
  return false;
}

function inferObject(text: string, vars: Map<string, any>, env: Map<string, any>, functions: Map<string, any>) {
  const inner = text.slice(1, -1), props: Record<string, any> = {};
  for (const part of splitTop(inner)) {
    if (part.trim().startsWith('...')) {
      const spreadTarget = part.trim().slice(3).trim();
      const spreadType = resolve(inferExpression(spreadTarget, vars, env, functions), env);
      if (spreadType?.kind === 'object') {
        Object.assign(props, spreadType.props);
      }
      continue;
    }
    const colon = part.indexOf(':');
    if (colon < 0) {
      const key = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(key)) props[key] = { optional: false, type: vars.get(key) || { kind: 'primitive', name: 'unknown' } };
      continue;
    }
    const key = part.slice(0, colon).trim().replace(/^["']|["']$/g, ''), expr = part.slice(colon + 1);
    props[key] = { optional: false, type: inferExpression(expr, vars, env, functions) };
  }
  return { kind: 'object', props };
}

export function inferExpression(text: string, vars = new Map<string, any>(), env = new Map<string, any>(), functions = new Map<string, any>()): any {
  let expr = stripOuter(String(text || '').trim().replace(/;$/, ''));
  expr = expr.replace(/\s+as\s+const\s*$/, '');
  if (/\[[^\]]+\]$/.test(expr) || /\b(?:as\s+any)\b/.test(expr)) return { kind: 'primitive', name: 'any' };
  const assertion = expr.match(/^([\s\S]+?)\s+as\s+([A-Za-z_$][\w$]*(?:\s*<[\s\S]+>)?|\{[^}]*\}|[A-Za-z_$][\w$]*\[\])$/);
  if (assertion) return parseType(assertion[2], env);
  if (/^['"][\s\S]*['"]$/.test(expr)) return { kind: 'literal', value: expr.slice(1, -1) };
  if (/^`[\s\S]*`$/.test(expr)) return { kind: 'primitive', name: 'string' };
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(expr)) return { kind: 'literal', value: Number(expr) };
  if (expr === 'true' || expr === 'false') return { kind: 'literal', value: expr === 'true' };
  if (expr === 'null') return { kind: 'literal', value: null };
  if (expr === 'undefined' || expr === 'void 0') return { kind: 'primitive', name: 'undefined' };
  if (expr.startsWith('[') && expr.endsWith(']')) {
    const parts = splitTop(expr.slice(1, -1));
    return { kind: 'array', element: parts.length ? union(parts.map(x => inferExpression(x, vars, env, functions))) : { kind: 'primitive', name: 'never' } };
  }
  if (expr.startsWith('{') && expr.endsWith('}')) return inferObject(expr, vars, env, functions);
  if (/^new\s+Date\b/.test(expr)) return named('Date');
  if (/^new\s+Map\b/.test(expr)) return { kind: 'generic', name: 'Map', args: [{ kind: 'primitive', name: 'any' }, { kind: 'primitive', name: 'any' }] };
  if (/^new\s+Set\b/.test(expr)) return { kind: 'generic', name: 'Set', args: [{ kind: 'primitive', name: 'any' }] };
  if (/^(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(expr)) return { kind: 'function', params: [], returns: { kind: 'primitive', name: 'unknown' } };
  const call = expr.match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (call && functions.has(call[1])) return functions.get(call[1]).returns;
  const propAccess = expr.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
  if (propAccess) {
    const baseType = resolve(vars.get(propAccess[1]) || env.get(propAccess[1]), env);
    if (baseType?.kind === 'object' && baseType.props[propAccess[2]]) {
      return baseType.props[propAccess[2]].type;
    }
  }
  if (/^[A-Za-z_$][\w$]*$/.test(expr)) return vars.get(expr) || env.get(expr) || { kind: 'primitive', name: 'unknown' };
  if (/[+]/.test(expr) && /['"`]/.test(expr)) return { kind: 'primitive', name: 'string' };
  if (/^[\d\s+*/%().-]+$/.test(expr)) return { kind: 'primitive', name: 'number' };
  return { kind: 'primitive', name: 'unknown' };
}

function collectTypes(source: string, env: Map<string, any>) {
  for (const m of source.matchAll(/\binterface\s+([A-Za-z_$][\w$]*)(?:\s*<([^>{}]+)>)?(?:\s+extends\s+([^\{]+))?\s*\{/g)) {
    const open = source.indexOf('{', m.index), close = balanced(source, open), own = parseType(source.slice(open, close + 1), env);
    if (m[3]) {
      const bases = splitTop(m[3]).map(x => resolve(parseType(x.trim(), env), env)).filter(x => x?.kind === 'object');
      for (const b of bases) own.props = { ...b.props, ...own.props };
    }
    const params = m[2] ? splitTop(m[2]).map(x => x.trim().split(/\s+extends\s+/)[0].trim()) : [];
    env.set(m[1], params.length ? { kind: 'genericDef', params, body: own } : own);
  }
  for (const m of source.matchAll(/\btype\s+([A-Za-z_$][\w$]*)(?:\s*<([^;=]+)>)?\s*=\s*/g)) {
    let i = m.index + m[0].length, round = 0, square = 0, curly = 0, angle = 0, quote: string | null = null, end = i;
    for (; end < source.length; end++) {
      const c = source[end];
      if (quote) {
        if (c === '\\') end++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c;
        continue;
      }
      if (c === '(') round++;
      else if (c === ')') round--;
      else if (c === '[') square++;
      else if (c === ']') square--;
      else if (c === '{') curly++;
      else if (c === '}') curly--;
      else if (c === '<') angle++;
      else if (c === '>') angle = Math.max(0, angle - 1);
      else if (c === ';' && round === 0 && square === 0 && curly === 0 && angle === 0) break;
    }
    const body = parseType(source.slice(i, end), env), params = m[2] ? splitTop(m[2]).map(x => x.trim().split(/\s+extends\s+/)[0].trim()) : [];
    env.set(m[1], params.length ? { kind: 'genericDef', params, body } : body);
  }
  return env;
}

export function collectTypeEnvironment(sources: string[]) {
  const env = new Map<string, any>();
  for (const source of sources) collectTypes(source, env);
  return env;
}

function issue(source: string, index: number, code: string, message: string, file: string) {
  return { severity: 'error' as const, code, file, line: lineOf(source, index), column: index - (source.lastIndexOf('\n', index - 1) + 1), message };
}
function warning(source: string, index: number, code: string, message: string, file: string) {
  return { severity: 'warning' as const, code, file, line: lineOf(source, index), column: index - (source.lastIndexOf('\n', index - 1) + 1), message };
}
function unsupportedTypeDiagnostics(source: string, file: string) {
  const issues: any[] = [];
  const patterns = [
    { re: /\btype\s+[A-Za-z_$][\w$]*(?:\s*<[^>]+>)?\s*=\s*[^;\n]+\bextends\b[^;\n]+\?[^;\n]+:/g, code: 'TS_UNSUPPORTED_CONDITIONAL', message: 'Conditional types are syntax-valid, but Lithe semantic checking does not fully model them yet.' },
    { re: /\binfer\s+[A-Za-z_$][\w$]*/g, code: 'TS_UNSUPPORTED_INFER', message: 'infer types are syntax-valid, but Lithe semantic checking does not fully model them yet.' },
    { re: /\bkeyof\s+[A-Za-z_$][\w$]*/g, code: 'TS_UNSUPPORTED_KEYOF', message: 'keyof types are syntax-valid, but Lithe semantic checking treats them as named types.' }
  ];
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    const match = pattern.re.exec(source);
    if (match) issues.push(warning(source, match.index, pattern.code, pattern.message, file));
  }
  return issues;
}

function widenLiteralType(t: any): any {
  if (!t) return t;
  if (t.kind === 'literal') {
    if (typeof t.value === 'boolean') return { kind: 'primitive', name: 'boolean' };
    if (typeof t.value === 'string') return { kind: 'primitive', name: 'string' };
    if (typeof t.value === 'number') return { kind: 'primitive', name: 'number' };
    if (typeof t.value === 'bigint') return { kind: 'primitive', name: 'bigint' };
    if (typeof t.value === 'symbol') return { kind: 'primitive', name: 'symbol' };
  }
  return t;
}

export function semanticTypecheck(source: string, options: { filename?: string; env?: Map<string, any> } = {}) {
  const file = options.filename || '<module>', env = options.env || collectTypeEnvironment([source]), vars = new Map<string, any>(), functions = new Map<string, any>(), issues: any[] = [];
  issues.push(...unsupportedTypeDiagnostics(source, file));
  
  for (const m of source.matchAll(/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{}()]*>)?\s*\(([^)]*)\)\s*(?::\s*([^\{=>\n]+))?\s*\{/g)) {
    const params: any[] = [];
    for (const p of splitTop(m[2])) {
      const isRest = p.trim().startsWith('...');
      const pm = p.match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)\??\s*(?::\s*([^=]+))?/);
      if (pm) params.push({ name: pm[1], isRest, type: parseType(pm[2] || 'unknown', env) });
    }
    const hasRest = params.some(x => x.isRest);
    const restType = hasRest ? params.find(x => x.isRest)?.type : null;
    const positional = params.filter(x => !x.isRest).map(x => x.type);
    functions.set(m[1], { params: positional, paramInfo: params, hasRest, restType, returns: parseType((m[3] || 'unknown').replace(/^Promise\s*<([\s\S]+)>$/, '$1'), env) });
  }

  for (const m of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([^=;\n]+)\s*=\s*([^;\n]+)/g)) {
    const expected = parseType(m[2], env), actual = inferExpression(m[3], vars, env, functions);
    vars.set(m[1], expected);
    if (actual.kind !== 'primitive' || actual.name !== 'unknown') {
      if (!isTypeAssignable(actual, expected, env)) issues.push(issue(source, m.index, 'TS_ASSIGN', `Type ${typeText(actual)} is not assignable to ${typeText(expected)} for ${m[1]}.`, file));
    }
  }

  for (const m of source.matchAll(/(?:^|[^A-Za-z0-9_$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const linePrefix = source.slice(lineStart, m.index);
    if (/function\b|\([^)]*$/.test(linePrefix)) continue;
    if (!vars.has(m[1])) {
      const isConst = /\bconst\s+$/.test(source.slice(Math.max(0, m.index - 8), m.index));
      const inferred = inferExpression(m[2], vars, env, functions);
      vars.set(m[1], isConst ? inferred : widenLiteralType(inferred));
    }
  }

  for (const [name, fn] of functions) {
    const re = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`, 'g');
    for (const m of source.matchAll(re)) {
      const prefix = source.slice(Math.max(0, m.index - 12), m.index);
      if (/function\s*$/.test(prefix)) continue;
      const args = splitTop(m[1]);
      for (let i = 0; i < args.length; i++) {
        const actual = inferExpression(args[i], vars, env, functions);
        if (actual.kind === 'primitive' || actual.name === 'unknown') continue;
        let expected = fn.params[i];
        if (expected == null && fn.hasRest && fn.restType) {
          expected = fn.restType.kind === 'array' ? fn.restType.element : fn.restType;
        }
        if (expected == null) continue;
        if (!isTypeAssignable(actual, expected, env)) issues.push(issue(source, m.index, 'TS_ARGUMENT', `Argument ${i + 1} of ${name} has type ${typeText(actual)}; expected ${typeText(expected)}.`, file));
      }
    }
  }

  for (const m of source.matchAll(/(?:^|[^A-Za-z0-9_$.])([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    const name = m[1];
    const prevText = source.slice(Math.max(0, m.index - 12), m.index);
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const linePrefix = source.slice(lineStart, m.index);
    if (!vars.has(name) || /\b(?:const|let|var)\s+$/.test(prevText) || /\bfor\s*\(\s*$/.test(prevText) || /function\b|\([^)]*$/.test(linePrefix)) continue;
    const actual = inferExpression(m[2], vars, env, functions);
    let expected = vars.get(name);
    if (actual.kind === 'primitive' && actual.name === 'unknown') continue;
    if (expected?.kind === 'named' || (expected?.kind === 'object' && expected.props?.parent)) {
      expected = union([expected, { kind: 'primitive', name: 'null' }, { kind: 'primitive', name: 'undefined' }]);
    }
    if (expected?.kind === 'object' && actual.kind === 'object') continue;
    if (!isTypeAssignable(actual, expected, env)) issues.push(issue(source, m.index, 'TS_REASSIGN', `Cannot assign ${typeText(actual)} to ${name} (${typeText(expected)}).`, file));
  }

  return { ok: !issues.some(x => x.severity === 'error'), issues, environment: env, variables: vars, functions };
}

export { typeText as formatType };
