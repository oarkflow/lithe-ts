import { h } from '../dom/vnode.ts';
import { signal } from '../core/reactive.ts';
import { Show, For } from '../dom/control.ts';

let uid = 0;
const id = (prefix) => `${prefix}-${++uid}`;

export function Dialog(props) {
  const open = props.open || signal(false);
  const titleId = id('dialog-title');
  const close = () => { if (open.__litheSignal) open.value = false; props.onClose?.(); };
  return h(Show, {
    when: open,
    children: () => h('div', {
      class: props.backdropClass || 'lithe-dialog-backdrop',
      onClick: (e) => { if (e.target === e.currentTarget && props.closeOnBackdrop !== false) close(); },
      onKeydown: (e) => { if (e.key === 'Escape' && props.closeOnEscape !== false) close(); }
    }, h('div', {
      role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': props.label ? undefined : titleId,
      'aria-label': props.label, tabIndex: -1, class: props.class
    }, props.title ? h('h2', { id: titleId }, props.title) : null, ...(props.children || [])))
  });
}

export function Tabs(props) {
  const items = props.items || [];
  const selected = props.selected || signal(props.defaultValue || items[0]?.value);
  const activate = (index) => { const item = items[index]; if (item) selected.value = item.value; };
  return h('div', { class: props.class },
    h('div', { role: 'tablist', onKeydown: (e) => {
      const i = items.findIndex(x => x.value === selected.value);
      if (e.key === 'ArrowRight') activate((i + 1) % items.length);
      if (e.key === 'ArrowLeft') activate((i - 1 + items.length) % items.length);
    } }, ...items.map(item => h('button', {
      role: 'tab', 'aria-selected': () => selected.value === item.value,
      tabIndex: () => selected.value === item.value ? 0 : -1,
      onClick: () => selected.value = item.value
    }, item.label))),
    h('div', { role: 'tabpanel' }, () => {
      const item = items.find(x => x.value === selected.value);
      return item?.content?.() ?? item?.content;
    })
  );
}

export function Disclosure(props) {
  const open = props.open || signal(Boolean(props.defaultOpen));
  return h('div', { class: props.class },
    h('button', { 'aria-expanded': open, onClick: () => open.value = !open.value }, props.label),
    h(Show, { when: open, children: props.children })
  );
}

export function Menu(props) {
  const open = props.open || signal(false);
  const active = signal(0);
  const menuId = id('menu');
  const items = props.items || [];
  const menu = () => h('div', {
    id: menuId, role: 'menu',
    onKeydown: (e) => {
      if (!items.length) return;
      if (e.key === 'ArrowDown') { active.value = (active.value + 1) % items.length; e.preventDefault(); }
      if (e.key === 'ArrowUp') { active.value = (active.value - 1 + items.length) % items.length; e.preventDefault(); }
      if (e.key === 'Escape') open.value = false;
    }
  }, ...items.map((item, i) => h('button', {
    role: 'menuitem', tabIndex: () => active.value === i ? 0 : -1,
    disabled: item.disabled,
    onClick: () => { item.onSelect?.(item); open.value = false; }
  }, item.label)));
  return h('div', { class: props.class },
    h('button', { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId, onClick: () => open.value = !open.value }, props.label || 'Menu'),
    h(Show, { when: open, children: menu })
  );
}

export function Listbox(props) {
  const value = props.value || signal(props.defaultValue);
  const open = signal(false);
  const listId = id('listbox');
  const items = props.items || [];
  return h('div', { class: props.class },
    h('button', { role: 'combobox', 'aria-expanded': open, 'aria-controls': listId, onClick: () => open.value = !open.value },
      () => items.find(x => x.value === value.value)?.label ?? props.placeholder ?? 'Select'),
    h(Show, { when: open, children: () => h('div', { role: 'listbox', id: listId }, ...items.map(item => h('div', {
      role: 'option', 'aria-selected': () => value.value === item.value, tabIndex: 0,
      onClick: () => { value.value = item.value; props.onChange?.(item.value); open.value = false; }
    }, item.label))) })
  );
}

export function Combobox(props) {
  const input = props.input || signal('');
  const open = signal(false);
  const filtered = () => {
    const q = input.value.toLowerCase();
    return (props.items || []).filter(x => String(props.getLabel?.(x) ?? x.label ?? x).toLowerCase().includes(q));
  };
  return h('div', { class: props.class },
    h('input', { role: 'combobox', 'aria-expanded': open, value: input, onFocus: () => open.value = true, onInput: e => { input.value = e.target.value; open.value = true; } }),
    h(Show, { when: open, children: () => h('div', { role: 'listbox' }, h(For, { each: filtered, children: item => h('div', {
      role: 'option', onClick: () => { props.onSelect?.(item); input.value = props.getLabel?.(item) ?? item.label ?? String(item); open.value = false; }
    }, props.getLabel?.(item) ?? item.label ?? String(item)) })) })
  );
}

export function Tooltip(props) {
  const open = signal(false), tipId = id('tooltip');
  return h('span', { class: props.class, onPointerenter: () => open.value = true, onPointerleave: () => open.value = false, onFocusin: () => open.value = true, onFocusout: () => open.value = false },
    h('span', { 'aria-describedby': tipId }, ...(props.children || [])),
    h(Show, { when: open, children: h('span', { id: tipId, role: 'tooltip' }, props.content) })
  );
}

export function createToasts() {
  const items = signal([]);
  return {
    items,
    push(message, options = {}) {
      const toast = { id: id('toast'), message, ...options };
      items.value = [...items.value, toast];
      if (options.duration !== 0) { const timer = setTimeout(() => this.remove(toast.id), options.duration || 4000); timer.unref?.(); }
      return toast.id;
    },
    remove(toastId) { items.value = items.value.filter(x => x.id !== toastId); },
    clear() { items.value = []; }
  };
}

export function ToastRegion(props) {
  return h('div', { role: 'region', 'aria-live': 'polite', class: props.class },
    h(For, { each: props.toasts.items, children: toast => h('div', { role: toast.role || 'status' }, toast.message,
      h('button', { 'aria-label': 'Dismiss', onClick: () => props.toasts.remove(toast.id) }, '×')) })
  );
}

export function Tree(props) {
  const expanded = props.expanded || signal(new Set());
  const childrenKey = props.childrenKey || 'children';
  const render = (nodes, level = 1) => h('ul', { role: level === 1 ? 'tree' : 'group' }, ...nodes.map(node => {
    const children = node[childrenKey] || [];
    const isOpen = () => expanded.value.has(node.id);
    return h('li', { role: 'treeitem', 'aria-level': level, 'aria-expanded': children.length ? isOpen : undefined },
      h('button', { onClick: () => { const next = new Set(expanded.value); next.has(node.id) ? next.delete(node.id) : next.add(node.id); expanded.value = next; } }, props.label?.(node) ?? node.label),
      children.length ? h(Show, { when: isOpen, children: () => render(children, level + 1) }) : null
    );
  }));
  return render(props.items || []);
}

export function CommandPalette(props) {
  const open = props.open || signal(false), query = signal('');
  const commands = () => { const q = query.value.toLowerCase(); return (props.commands || []).filter(c => `${c.label} ${c.keywords || ''}`.toLowerCase().includes(q)); };
  return h(Dialog, { open, label: props.label || 'Command palette', onClose: () => open.value = false, children: [
    h('input', { autofocus: true, placeholder: props.placeholder || 'Type a command…', value: query, onInput: e => query.value = e.target.value }),
    h('div', { role: 'listbox' }, h(For, { each: commands, children: cmd => h('button', { role: 'option', onClick: () => { cmd.run?.(); open.value = false; } }, cmd.label) }))
  ] });
}

export function VisuallyHidden(props) {
  return h('span', { ...props, style: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } }, ...(props.children || []));
}
