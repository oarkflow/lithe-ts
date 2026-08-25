function pos(code, index) {
    const before = code.slice(0, index),
        line = (before.match(/\n/g) || []).length + 1,
        last = before.lastIndexOf('\n');
    return {
        line,
        column: index - last - 1
    };
}
function color(hex) {
    const m = String(hex).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = [...h].map(x => x + x).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}
function lum(rgb) {
    if (!rgb) return null;
    const f = x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
    return .2126 * f(rgb[0]) + .7152 * f(rgb[1]) + .0722 * f(rgb[2]);
}
function ratio(a, b) {
    const x = lum(color(a)),
        y = lum(color(b));
    return x == null || y == null ? null : (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function issue(code, index, file, severity, kind, message) {
    return {
        severity,
        code: kind,
        file,
        ...pos(code, index),
        message
    };
}
export function analyzeAccessibility(code, file = '<module>') {
    const out = [],
        ids = new Map(),
        labelFor = new Set(),
        controls = new Map(),
        headings = [];
    for (const m of code.matchAll(/<([A-Za-z][\w:-]*)\b([^>]*)>/g)) {
        const tag = m[1].toLowerCase(),
            attrs = m[2],
            at = m.index;
        const id = attrs.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1];
        if (id) {
            if (ids.has(id)) out.push(issue(code, at, file, 'warning', 'A11Y_DUP_ID', `Duplicate static id "${id}".`)); else ids.set(id, at);
        }
        if (tag === 'img' && !/\balt\s*=/.test(attrs)) out.push(issue(code, at, file, 'warning', 'A11Y_IMG_ALT', 'Image is missing alt text.'));
        if ((tag === 'div' || tag === 'span') && /\bonClick\s*=/.test(attrs) && !/\b(?:role|tabIndex|onKeydown|onKeyup)\s*=/.test(attrs)) out.push(issue(code, at, file, 'warning', 'A11Y_CLICK_KEYBOARD', `Clickable <${tag}> lacks keyboard semantics; prefer <button>.`));
        const tab = attrs.match(/\btabIndex\s*=\s*(?:\{\s*)?([1-9]\d*)/);
        if (tab) out.push(issue(code, at, file, 'warning', 'A11Y_TABINDEX', 'Positive tabIndex creates fragile keyboard order.'));
        if (tag === 'a' && !/\bhref\s*=/.test(attrs) && /\bonClick\s*=/.test(attrs)) out.push(issue(code, at, file, 'warning', 'A11Y_ANCHOR', 'Interactive <a> without href should usually be a <button>.'));
        if (/\brole\s*=\s*["']button["']/.test(attrs) && !/\bonKey(?:down|up)\s*=/.test(attrs)) out.push(issue(code, at, file, 'warning', 'A11Y_ROLE_BUTTON', 'role="button" requires keyboard activation handling.'));
        if (tag === 'label') {
            const f = attrs.match(/\b(?:htmlFor|for)\s*=\s*["']([^"']+)["']/)?.[1];
            if (f) labelFor.add(f);
        }
        if (['input', 'select', 'textarea'].includes(tag) && id) controls.set(id, {
            tag,
            at
        });
        if (/^h[1-6]$/.test(tag)) headings.push({
            level: Number(tag[1]),
            at
        });
        const style = attrs.match(/\bstyle\s*=\s*\{\{([\s\S]*?)\}\}/)?.[1];
        if (style) {
            const fg = style.match(/(?:^|,)\s*color\s*:\s*["'](#[0-9a-f]{3,6})["']/i)?.[1],
                bg = style.match(/(?:^|,)\s*background(?:Color)?\s*:\s*["'](#[0-9a-f]{3,6})["']/i)?.[1];
            const r = fg && bg ? ratio(fg, bg) : null;
            if (r != null && r < 4.5) out.push(issue(code, at, file, 'warning', 'A11Y_CONTRAST', `Static contrast is ${r.toFixed(2)}:1; target at least 4.5:1 for normal text.`));
        }
    }
    for (let i = 1; i < headings.length; i++) if (headings[i].level > headings[i - 1].level + 1) out.push(issue(code, headings[i].at, file, 'warning', 'A11Y_HEADING', `Heading level jumps from h${headings[i - 1].level} to h${headings[i].level}.`));
    for (const [id, c] of controls) if (!labelFor.has(id)) {
        const around = code.slice(Math.max(0, c.at - 160), c.at + 300);
        if (!new RegExp(`<label\\b[^>]*>[\\s\\S]*?<${c.tag}\\b`).test(around) && !/\baria-label(?:ledby)?\s*=/.test(code.slice(c.at, c.at + 250))) out.push(issue(code, c.at, file, 'info', 'A11Y_CONTROL_LABEL', `Static ${c.tag}#${id} has no detectable label association.`));
    }
    return out;
}
