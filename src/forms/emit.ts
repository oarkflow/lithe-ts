function schemaDescription(meta = {}) {
    const out = {};
    if (meta.title) out.title = meta.title;
    if (meta.description) out.description = meta.description;
    if (meta.default !== undefined) out.default = typeof meta.default === 'function' ? undefined : meta.default;
    if (meta.nullable) out.nullable = true;
    return out;
}
export function toJSONSchema(schema, options = {}) {
    const meta = schema?.meta || {};
    let out = {
        ...schemaDescription(meta)
    };
    if (meta.type === 'string') {
        out.type = 'string';
        if (meta.min != null) out.minLength = meta.min;
        if (meta.max != null) out.maxLength = meta.max;
        if (meta.pattern) out.pattern = meta.pattern.source;
    } else if (meta.type === 'number') {
        out.type = meta.integer ? 'integer' : 'number';
        if (meta.min != null) out.minimum = meta.min;
        if (meta.max != null) out.maximum = meta.max;
    } else if (meta.type === 'boolean') out.type = 'boolean'; else if (meta.type === 'literal') out = {
        ...out,
        const: meta.expected
    }; else if (meta.type === 'enum') out = {
        ...out,
        enum: [...meta.values]
    }; else if (meta.type === 'date') out = {
        ...out,
        type: 'string',
        format: 'date-time'
    }; else if (meta.type === 'array') {
        out = {
            ...out,
            type: 'array',
            items: toJSONSchema(meta.item, options)
        };
        if (meta.min != null) out.minItems = meta.min;
        if (meta.max != null) out.maxItems = meta.max;
    } else if (meta.type === 'object') {
        const properties = {},
            required = [];
        for (const [key, child] of Object.entries(meta.shape || {})) {
            properties[key] = toJSONSchema(child, options);
            if (!child.meta?.optional && child.meta?.default === undefined) required.push(key);
        }
        out = {
            ...out,
            type: 'object',
            properties
        };
        if (required.length) out.required = required;
        if (!meta.passthrough) out.additionalProperties = false;
    } else if (meta.type === 'union') out = {
        ...out,
        anyOf: (meta.schemas || []).map(x => toJSONSchema(x, options))
    }; else out = {
        ...out
    };
    if (meta.nullable && out.type) out.type = Array.isArray(out.type) ? [...out.type, 'null'] : [out.type, 'null'];
    if (options.id) out.$id = options.id;
    if (options.schema) out.$schema = options.schema || 'https://json-schema.org/draft/2020-12/schema';
    return out;
}
export function toOpenAPI(schema, options = {}) {
    const json = toJSONSchema(schema);
    return {
        openapi: '3.1.0',
        info: {
            title: options.title || 'Lithe API',
            version: options.version || '1.0.0'
        },
        paths: options.paths || {},
        components: {
            schemas: {
                [options.name || 'Payload']: json
            }
        }
    };
}
