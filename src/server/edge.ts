function ensureResponse(value) {
    if (value instanceof Response) return value;
    if (value == null) return new Response(null, {
        status: 204
    });
    if (typeof value === 'string' || value instanceof Uint8Array) return new Response(value);
    return Response.json(value);
}
export function createEdgeAdapter(handler, options = {}) {
    if (typeof handler !== 'function') throw new TypeError('createEdgeAdapter(handler) requires a function.');
    return {
        async fetch(request, env = {}, executionCtx = {}) {
            return ensureResponse(await handler(request, {
                env,
                executionCtx,
                runtime: options.runtime || 'edge'
            }));
        }
    };
}
export const cloudflareAdapter = handler => createEdgeAdapter(handler, {
    runtime: 'cloudflare'
});
export const denoAdapter = handler => createEdgeAdapter(handler, {
    runtime: 'deno'
});
export const bunAdapter = handler => createEdgeAdapter(handler, {
    runtime: 'bun'
});
function headerObject(headers) {
    const out = {};
    headers.forEach((v, k) => out[k] = v);
    return out;
}
export function createLambdaAdapter(handler, options = {}) {
    return async function lambda(event, context = {}) {
        const host = event.headers?.host || event.headers?.Host || options.host || 'lambda.local',
            scheme = event.headers?.['x-forwarded-proto'] || 'https',
            path = event.rawPath || event.path || '/',
            query = event.rawQueryString ? `?${event.rawQueryString}` : '';
        const body = event.body == null ? undefined : event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body,
            request = new Request(`${scheme}://${host}${path}${query}`, {
                method: event.requestContext?.http?.method || event.httpMethod || 'GET',
                headers: event.headers || {},
                body: ['GET', 'HEAD'].includes(event.requestContext?.http?.method || event.httpMethod || 'GET') ? undefined : body
            });
        const response = ensureResponse(await handler(request, {
            event,
            context,
            runtime: 'aws-lambda'
        })),
            bytes = Buffer.from(await response.arrayBuffer()),
            textual = /^(?:text\/|application\/(?:json|javascript|xml|x-www-form-urlencoded))/.test(response.headers.get('content-type') || '');
        return {
            statusCode: response.status,
            headers: headerObject(response.headers),
            body: textual ? bytes.toString('utf8') : bytes.toString('base64'),
            isBase64Encoded: !textual
        };
    };
}
export async function edgeAdapterMatrix(handler) {
    const request = new Request('https://example.test/ping');
    const results = {};
    for (const [name, factory] of Object.entries({
        cloudflare: cloudflareAdapter,
        deno: denoAdapter,
        bun: bunAdapter
    })) {
        const response = await factory(handler).fetch(request, {}, {
            waitUntil() { }
        });
        results[name] = {
            status: response.status,
            body: await response.text()
        };
    }
    const lambda = await createLambdaAdapter(handler)({
        rawPath: '/ping',
        rawQueryString: '',
        headers: {
            host: 'example.test'
        },
        requestContext: {
            http: {
                method: 'GET'
            }
        }
    }, {});
    results.lambda = {
        status: lambda.statusCode,
        body: lambda.isBase64Encoded ? Buffer.from(lambda.body, 'base64').toString('utf8') : lambda.body
    };
    return results;
}
