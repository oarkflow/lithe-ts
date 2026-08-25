import { h } from '../dom/vnode.ts';
import { createForm } from './form.ts';
function controlFor(schema, field, path, options = {}) {
    const meta = schema.meta || {},
        label = options.label || meta.label || path.split('.').at(-1);
    let control;
    if (meta.type === 'boolean') control = h('input', {
        type: 'checkbox',
        name: path,
        checked: () => Boolean(field.value),
        onChange: e => field.value = e.target.checked,
        onBlur: () => field.touch()
    }); else if (meta.type === 'enum') control = h('select', {
        ...field.props
    }, ...meta.values.map(v => h('option', {
        value: v
    }, String(v)))); else if (meta.type === 'number') control = h('input', {
        ...field.props,
        type: 'number',
        min: meta.min,
        max: meta.max,
        step: meta.integer ? 1 : 'any'
    }); else if (meta.type === 'date') control = h('input', {
        ...field.props,
        type: 'datetime-local'
    }); else control = h('input', {
        ...field.props,
        type: meta.format === 'email' ? 'email' : 'text',
        minLength: meta.min,
        maxLength: meta.max,
        required: !meta.optional
    });
    return h('label', {
        class: 'lithe-field'
    }, h('span', null, label), control, () => field.error ? h('small', {
        role: 'alert'
    }, field.error) : null);
}
function fields(schema, form, prefix = '', components = {}) {
    const meta = schema.meta || {};
    if (meta.type !== 'object') return [];
    const out = [];
    for (const [key, child] of Object.entries(meta.shape || {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (components[path]) {
            out.push(components[path]({
                schema: child,
                field: form.field(path),
                form,
                path
            }));
            continue;
        }
        if (child.meta?.type === 'object') out.push(h('fieldset', null, h('legend', null, child.meta.label || key), ...fields(child, form, path, components))); else out.push(controlFor(child, form.field(path), path));
    }
    return out;
}
export function AutoForm(props) {
    const form = props.form || createForm({
        schema: props.schema,
        initial: props.initial || {},
        action: props.action,
        ...props.formOptions
    });
    return h('form', {
        ...form.props,
        class: props.class
    }, ...fields(props.schema, form, '', props.components || {}), h('button', {
        type: 'submit',
        disabled: () => form.submitting
    }, props.submitLabel || 'Submit'));
}
