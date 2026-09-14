export const Fragment = Symbol.for('lithe.fragment');
export const Text = Symbol.for('lithe.text');
export const Comment = Symbol.for('lithe.comment');
// Hoisted to module scope: h() runs once per vnode (i.e. once per component
// instance, once per <For> row) so a fresh closure here on every call was
// pure per-call allocation churn for no benefit — `flat` is passed in
// explicitly instead of being closed over.
function pushChild(value, flat) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) pushChild(value[i], flat);
    } else if (value !== null && value !== undefined && value !== false && value !== true) {
        flat.push(value);
    }
}
export function h(type, props, ...children) {
    props ||= {};
    const flat = [];
    if (children.length === 0 && Object.prototype.hasOwnProperty.call(props, 'children')) pushChild(props.children, flat); else for (let i = 0; i < children.length; i++) pushChild(children[i], flat);
    return {
        __vnode: true,
        type,
        props,
        children: flat,
        key: props.key ?? null
    };
}
export const jsx = h;
export const jsxs = h;
export const jsxDEV = h;
export function text(value) {
    return {
        __vnode: true,
        type: Text,
        props: {},
        children: [value],
        key: null
    };
}
export function comment(value = '') {
    return {
        __vnode: true,
        type: Comment,
        props: {},
        children: [value],
        key: null
    };
}
export function isVNode(value) {
    return Boolean(value && value.__vnode);
}
