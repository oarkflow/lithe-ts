import { computed, isSignal } from '../core/reactive.ts';
import { dynamic } from '../dom/dom.ts';
export function createPermissions(source) {
    const has = permission => {
        const value = isSignal(source) ? source.value : typeof source === 'function' ? source() : source;
        if (value instanceof Set) return value.has(permission) || value.has('*');
        if (Array.isArray(value)) return value.includes(permission) || value.includes('*');
        if (value && typeof value === 'object') return Boolean(value[permission] || value['*']);
        return false;
    };
    return {
        has,
        any: list => list.some(has),
        all: list => list.every(has)
    };
}
export function Can(props) {
    return dynamic(() => props.permissions.has(props.permission) ? props.children : props.fallback ?? null);
}
