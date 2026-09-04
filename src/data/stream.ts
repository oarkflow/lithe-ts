import { signal } from '../core/reactive.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
function traceStream(type, attributes = {}) {
    try {
        globalThis.__LITHE_CORRELATION_EVENT__?.(type, attributes, globalThis.__LITHE_CORRELATION_ID__ || null);
    } catch { }
}
export function stream(url, options = {}) {
    const data = signal(options.initial),
        error = signal(null),
        connected = signal(false),
        state = signal('idle');
    let transport = null,
        retries = 0,
        closed = false,
        disposed = false,
        timer = null;
    const protocol = options.protocol || (String(url).startsWith('ws') ? 'websocket' : 'sse');
    const connect = () => {
        if (disposed) return;
        closed = false;
        state.value = 'connecting';
        error.value = null;
        traceStream('stream:connect', {
            url: String(url),
            protocol
        });
        if (protocol === 'websocket') {
            transport = new WebSocket(url, options.protocols);
            transport.onopen = () => {
                if (disposed) return;
                connected.value = true;
                state.value = 'open';
                retries = 0;
                traceStream('stream:open', {
                    url: String(url),
                    protocol
                });
                options.onOpen?.();
            };
            transport.onmessage = e => {
                if (disposed) return;
                try {
                    data.value = options.parse ? options.parse(e.data) : JSON.parse(e.data);
                } catch {
                    data.value = e.data;
                }
                traceStream('stream:message', {
                    url: String(url),
                    protocol
                });
                options.onMessage?.(data.peek());
            };
            transport.onerror = e => {
                if (disposed) return;
                error.value = e;
                traceStream('stream:error', {
                    url: String(url),
                    protocol
                });
                options.onError?.(e);
            };
            transport.onclose = () => {
                if (disposed) return;
                connected.value = false;
                state.value = 'closed';
                if (!closed && options.reconnect !== false) scheduleReconnect();
            };
        } else {
            transport = new EventSource(url, {
                withCredentials: Boolean(options.withCredentials)
            });
            transport.onopen = () => {
                if (disposed) return;
                connected.value = true;
                state.value = 'open';
                retries = 0;
                traceStream('stream:open', {
                    url: String(url),
                    protocol
                });
                options.onOpen?.();
            };
            transport.onmessage = e => {
                if (disposed) return;
                try {
                    data.value = options.parse ? options.parse(e.data) : JSON.parse(e.data);
                } catch {
                    data.value = e.data;
                }
                traceStream('stream:message', {
                    url: String(url),
                    protocol
                });
                options.onMessage?.(data.peek());
            };
            transport.onerror = e => {
                if (disposed) return;
                connected.value = false;
                error.value = e;
                options.onError?.(e);
                transport.close();
                if (!closed && options.reconnect !== false) scheduleReconnect();
            };
        }
    };
    const scheduleReconnect = () => {
        if (disposed) return;
        clearTimeout(timer);
        const delay = Math.min((options.retryDelay || 500) * 2 ** retries++, options.maxRetryDelay || 15000);
        state.value = 'reconnecting';
        timer = setTimeout(connect, delay);
    };
    const close = () => {
        closed = true;
        clearTimeout(timer);
        transport?.close();
        transport = null;
        connected.value = false;
        state.value = 'closed';
        traceStream('stream:close', {
            url: String(url),
            protocol
        });
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        close();
    };
    const send = value => {
        if (protocol !== 'websocket' || transport?.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open');
        transport.send(typeof value === 'string' ? value : JSON.stringify(value));
    };
    if (options.autoConnect !== false && typeof window !== 'undefined') connect();
    if (getOwner()) onCleanup(close);
    return {
        data,
        error,
        connected,
        state,
        connect,
        close,
        reconnect() {
            if (disposed) return;
            close();
            closed = false;
            connect();
        },
        send,
        dispose
    };
}
