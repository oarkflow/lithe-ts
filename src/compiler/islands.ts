// Conservative compiler analysis: components with browser events/reactive setup are island candidates.
export function detectIslands(code, file = '<module>') {
    const out = [];
    const patterns = [...code.matchAll(/(?:export\s+)?function\s+([A-Z][\w$]*)\s*\([^)]*\)\s*\{/g)];
    for (const m of patterns) {
        let i = code.indexOf('{', m.index),
            depth = 0,
            end = i;
        for (; end < code.length; end++) {
            if (code[end] === '{') depth++; else if (code[end] === '}' && --depth === 0) {
                end++;
                break;
            }
        }
        const body = code.slice(i, end),
            events = [...body.matchAll(/\bon([A-Z][\w]*)\s*:/g)].map(x => x[1].toLowerCase()),
            reactive = /\b(?:signal|state|effect|query|resource)\s*\(/.test(body);
        if (events.length || reactive) out.push({
            file,
            name: m[1],
            events: [...new Set(events)],
            reactive,
            mode: events.length ? 'interaction' : 'reactive'
        });
    }
    return out;
}
