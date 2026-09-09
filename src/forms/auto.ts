import { h } from '../dom/vnode.ts';
import { createAdvancedForm } from './advanced.ts';
let autoFormSeq = 0;
function defaultForSchema(schema) {
    const meta = schema?.meta || {};
    if (meta.type === 'object') {
        const out = {};
        for (const [key, child] of Object.entries(meta.shape || {})) out[key] = defaultForSchema(child);
        return out;
    }
    if (meta.type === 'array') return [];
    if (meta.type === 'string') return '';
    if (meta.type === 'number') return 0;
    if (meta.type === 'boolean') return false;
    return undefined;
}
function controlFor(schema, field, path, formId, options = {}) {
    const meta = schema.meta || {},
        label = options.label || meta.label || String(path).split('.').at(-1),
        inputId = `${formId}-${path}`,
        errorId = `${inputId}-error`,
        describedBy = () => field.error ? errorId : undefined,
        invalid = () => Boolean(field.error);
    let control;
    if (meta.type === 'boolean') control = h('input', {
        id: inputId,
        type: 'checkbox',
        name: path,
        checked: () => Boolean(field.value),
        onChange: e => field.value = e.target.checked,
        onBlur: () => field.touch(),
        'aria-invalid': invalid,
        'aria-describedby': describedBy
    }); else if (meta.type === 'enum') control = h('select', {
        ...field.props,
        id: inputId,
        'aria-invalid': invalid,
        'aria-describedby': describedBy
    }, ...meta.values.map(v => h('option', {
        value: v
    }, String(v)))); else if (meta.type === 'number') control = h('input', {
        ...field.props,
        id: inputId,
        type: 'number',
        min: meta.min,
        max: meta.max,
        step: meta.integer ? 1 : 'any',
        'aria-invalid': invalid,
        'aria-describedby': describedBy
    }); else if (meta.type === 'date') control = h('input', {
        ...field.props,
        id: inputId,
        type: 'datetime-local',
        'aria-invalid': invalid,
        'aria-describedby': describedBy
    }); else control = h('input', {
        ...field.props,
        id: inputId,
        type: meta.format === 'email' ? 'email' : meta.format === 'url' ? 'url' : 'text',
        minLength: meta.min,
        maxLength: meta.max,
        required: !meta.optional,
        'aria-invalid': invalid,
        'aria-describedby': describedBy
    });
    return h('label', {
        class: 'lithe-field',
        for: inputId
    }, h('span', null, label), control, () => field.error ? h('small', {
        id: errorId,
        role: 'alert'
    }, field.error) : null);
}
function fieldArrayControl(schema, form, path, formId, components) {
    const meta = schema.meta || {},
        itemSchema = meta.item,
        arr = form.fieldArray(path);
    return h('fieldset', {
        class: 'lithe-field-array'
    }, h('legend', null, meta.label || String(path).split('.').at(-1)), () => arr.fields.map(item => h('div', {
        key: item.id,
        class: 'lithe-field-array-item'
    }, itemSchema?.meta?.type === 'object' ? h('fieldset', null, ...fields(itemSchema, form, item.path, components, formId)) : itemSchema?.meta?.type === 'array' ? fieldArrayControl(itemSchema, form, item.path, formId, components) : controlFor(itemSchema, form.field(item.path), item.path, formId), h('button', {
        type: 'button',
        onClick: () => arr.remove(item.index)
    }, 'Remove'))), h('button', {
        type: 'button',
        onClick: () => arr.append(defaultForSchema(itemSchema))
    }, 'Add'));
}
function fields(schema, form, prefix = '', components = {}, formId) {
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
        const childMeta = child.meta || {};
        if (childMeta.type === 'object') out.push(h('fieldset', null, h('legend', null, childMeta.label || key), ...fields(child, form, path, components, formId)));
        else if (childMeta.type === 'array') out.push(fieldArrayControl(child, form, path, formId, components));
        else out.push(controlFor(child, form.field(path), path, formId));
    }
    return out;
}
export function AutoForm(props) {
    const form = props.form || createAdvancedForm({
        schema: props.schema,
        initial: props.initial || {},
        action: props.action,
        ...props.formOptions
    });
    const formId = props.id || `lithe-autoform-${++autoFormSeq}`;
    return h('form', {
        ...form.props,
        id: props.id,
        class: props.class
    }, ...fields(props.schema, form, '', props.components || {}, formId), h('button', {
        type: 'submit',
        disabled: () => form.submitting
    }, props.submitLabel || 'Submit'));
}
