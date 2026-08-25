let counter = 0;
const sheets = new Map();
function kebab(key) {
    return key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
function unit(key, value) {
    if (typeof value !== 'number') return value;
    return /^(opacity|zIndex|flex|flexGrow|flexShrink|fontWeight|lineHeight|order|zoom)$/.test(key) ? String(value) : `${value}px`;
}
function declarations(object) {
    return Object.entries(object).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${kebab(k)}:${unit(k, v)}`).join(';');
}
export function css(rules, options = {}) {
    const name = options.name || `l${(++counter).toString(36)}`;
    const selector = `.${name}`;
    let text = `${selector}{${declarations(rules)}}`;
    for (const [key, value] of Object.entries(rules)) {
        if (!value || typeof value !== 'object') continue;
        if (key.startsWith('@media') || key.startsWith('@supports')) text += `${key}{${selector}{${declarations(value)}}}`; else if (key.startsWith('&')) text += `${key.replace('&', selector)}{${declarations(value)}}`; else text += `${selector} ${key}{${declarations(value)}}`;
    }
    sheets.set(name, text);
    if (typeof document !== 'undefined' && !document.querySelector(`style[data-lithe-style="${name}"]`)) {
        const el = document.createElement('style');
        el.dataset.litheStyle = name;
        el.textContent = text;
        document.head.appendChild(el);
    }
    return name;
}
export function defineTheme(tokens, options = {}) {
    const selector = options.selector || ':root';
    const lines = [];
    const walk = (obj, prefix = []) => {
        for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === 'object') walk(v, [...prefix, k]); else lines.push(`--${[...prefix, k].join('-')}:${v}`);
        }
    };
    walk(tokens);
    const text = `${selector}{${lines.join(';')}}`;
    const name = options.name || `theme-${(++counter).toString(36)}`;
    sheets.set(name, text);
    if (typeof document !== 'undefined' && !document.querySelector(`style[data-lithe-style="${name}"]`)) {
        const el = document.createElement('style');
        el.dataset.litheStyle = name;
        el.textContent = text;
        document.head.appendChild(el);
    }
    return {
        name,
        cssText: text,
        var: path => `var(--${String(path).replaceAll('.', '-')})`
    };
}
export function collectedCSS() {
    return [...sheets.values()].join('\n');
}
export function clearCollectedCSS() {
    sheets.clear();
}
