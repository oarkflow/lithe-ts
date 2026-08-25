import { currentCorrelation, correlationHeaders, correlationFromHeaders, withCorrelation, correlationEvent } from '../observability/carrier.ts';
const registry = new Map();
function idFor(name, fn) {
    const text = `${name}\n${fn.toString()}`;
    let h1 = 0x811c9dc5,
        h2 = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
    }
    return `${h1.toString(36)}${h2.toString(36)}`;
}
export function server(...args) {
    let schema,
        handler,
        options = {};
    if (args.length === 1 && typeof args[0] === 'function') handler = args[0]; else if (args.length === 2 && typeof args[1] === 'function') [schema, handler] = args; else if (args.length === 1 && typeof args[0] === 'object') ({
        schema,
        handler,
        ...options
    } = args[0]);
    if (typeof handler !== 'function') throw new TypeError('server() requires a handler function.');
    const id = options.id || idFor(handler.name || 'anonymous', handler);
    const meta = {
        id,
        schema,
        handler,
        options
    };
    registry.set(id, meta);
    const callable = async (input, callOptions = {}) => {
        if (typeof window === 'undefined' && callOptions.remote !== true) {
            const parsed = schema ? schema.parse(input) : input;
            return handler(parsed, callOptions.context || {});
        }
        const response = await fetch(`${callOptions.base || ''}/_lithe/action/${id}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'content-type': 'application/json',
                ...correlationHeaders(callOptions.traceId || currentCorrelation()),
                ...(callOptions.csrf ? {
                    'x-csrf-token': callOptions.csrf
                } : {})
            },
            body: JSON.stringify({
                input
            })
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
            const error = new Error(payload.error?.message || `Server function failed (${response.status})`);
            Object.assign(error, payload.error || {});
            throw error;
        }
        return payload.data;
    };
    callable.id = id;
    callable.__serverFunction = true;
    return callable;
}
export function defineAction(handlerOrOptions) {
    return server(handlerOrOptions);
}
export async function handleServerFunction(request, context = {}) {
    const traceId = correlationFromHeaders(request.headers) || context.traceId || null;
    context = {
        ...context,
        traceId
    };
    correlationEvent('rpc:server:start', {
        url: request.url
    }, traceId);
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const meta = registry.get(id);
    if (!meta) return Response.json({
        ok: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Unknown server function'
        }
    }, {
        status: 404
    });
    if (request.method !== 'POST') return new Response('Method Not Allowed', {
        status: 405,
        headers: {
            allow: 'POST'
        }
    });
    try {
        if (meta.options.permission && context.can && !(await context.can(meta.options.permission))) {
            return Response.json({
                ok: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Forbidden'
                }
            }, {
                status: 403
            });
        }
        const payload = await request.json();
        const input = meta.schema ? meta.schema.parse(payload.input) : payload.input;
        const data = await withCorrelation(traceId, () => meta.handler(input, context));
        correlationEvent('rpc:server:end', {
            id
        }, traceId);
        return Response.json({
            ok: true,
            data
        }, {
            headers: traceId ? {
                'x-lithe-trace-id': traceId
            } : {}
        });
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : error.status || 500;
        return Response.json({
            ok: false,
            error: {
                code: error.code || error.name || 'SERVER_ERROR',
                message: status >= 500 ? 'Server function failed' : error.message,
                issues: error.issues
            }
        }, {
            status
        });
    }
}
export function serverManifest() {
    return [...registry.values()].map(({
        id,
        handler,
        schema,
        options
    }) => ({
        id,
        name: handler.name || 'anonymous',
        schema: schema?.meta || null,
        permission: options.permission || null
    }));
}
export function serverReference(moduleId, exportName = 'default', options = {}) {
    const callable = async (input, callOptions = {}) => {
        const base = callOptions.base ?? options.base ?? '';
        const response = await fetch(`${base}/_lithe/module/${encodeURIComponent(moduleId)}/${encodeURIComponent(exportName)}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'content-type': 'application/json',
                ...correlationHeaders(callOptions.traceId || currentCorrelation()),
                ...(callOptions.csrf ? {
                    'x-csrf-token': callOptions.csrf
                } : {})
            },
            body: JSON.stringify({
                input
            })
        });
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
            const error = new Error(payload.error?.message || `Server module action failed (${response.status})`);
            Object.assign(error, payload.error || {});
            throw error;
        }
        return payload.data;
    };
    callable.__serverReference = true;
    callable.moduleId = moduleId;
    callable.exportName = exportName;
    return callable;
}
export async function createServerModuleHandler(manifest, options = {}) {
    const map = typeof manifest === 'string' ? JSON.parse(await (await import('node:fs/promises')).readFile(manifest, 'utf8')) : manifest;
    const baseURL = options.baseURL || (typeof manifest === 'string' ? new URL('./', new URL(`file://${manifest}`)) : new URL('./', import.meta.url));
    return async function handleServerModule(request, context = {}) {
        const traceId = correlationFromHeaders(request.headers) || context.traceId || null;
        context = {
            ...context,
            traceId
        };
        const url = new URL(request.url),
            m = url.pathname.match(/^\/_lithe\/module\/([^/]+)\/([^/]+)$/);
        if (!m) return null;
        const id = decodeURIComponent(m[1]),
            name = decodeURIComponent(m[2]),
            entry = map.modules?.[id];
        if (!entry) return Response.json({
            ok: false,
            error: {
                code: 'NOT_FOUND',
                message: 'Unknown server module'
            }
        }, {
            status: 404
        });
        if (request.method !== 'POST') return new Response('Method Not Allowed', {
            status: 405,
            headers: {
                allow: 'POST'
            }
        });
        try {
            const mod = await import(new URL(entry.file, baseURL));
            const fn = mod[name];
            if (typeof fn !== 'function') return Response.json({
                ok: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Unknown server export'
                }
            }, {
                status: 404
            });
            const payload = await request.json();
            const data = await withCorrelation(traceId, () => fn.__serverFunction ? fn(payload.input, {
                context
            }) : fn(payload.input, context));
            return Response.json({
                ok: true,
                data
            }, {
                headers: traceId ? {
                    'x-lithe-trace-id': traceId
                } : {}
            });
        } catch (error) {
            const status = error.status || 500;
            return Response.json({
                ok: false,
                error: {
                    code: error.code || error.name || 'SERVER_ERROR',
                    message: status >= 500 ? 'Server module action failed' : error.message,
                    issues: error.issues
                }
            }, {
                status
            });
        }
    };
}
