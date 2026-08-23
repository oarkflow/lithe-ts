export const Fragment = Symbol.for('lithe.fragment');
export const Text = Symbol.for('lithe.text');
export const Comment = Symbol.for('lithe.comment');

export function h(type, props, ...children) {
  props ||= {};
  const flat = [];
  const push = (value) => {
    if (Array.isArray(value)) for (const item of value) push(item);
    else if (value !== null && value !== undefined && value !== false && value !== true) flat.push(value);
  };
  if (children.length === 0 && Object.prototype.hasOwnProperty.call(props, 'children')) push(props.children);
  else for (const child of children) push(child);
  return { __vnode: true, type, props, children: flat, key: props.key ?? null };
}

export const jsx = h;
export const jsxs = h;
export const jsxDEV = h;

export function text(value) { return { __vnode: true, type: Text, props: {}, children: [value], key: null }; }
export function comment(value = '') { return { __vnode: true, type: Comment, props: {}, children: [value], key: null }; }
export function isVNode(value) { return Boolean(value && value.__vnode); }
