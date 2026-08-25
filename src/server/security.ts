import crypto from 'node:crypto';
export function escapeHTML(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function safeJSON(value) {
    return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}
export function createCSRF(secret = crypto.randomBytes(32).toString('hex')) {
    return {
        secret,
        issue(sessionId = '') {
            const nonce = crypto.randomBytes(16).toString('base64url');
            const sig = crypto.createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest('base64url');
            return `${nonce}.${sig}`;
        },
        verify(token, sessionId = '') {
            if (!token || !token.includes('.')) return false;
            const [nonce, sig] = token.split('.');
            const expected = crypto.createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest();
            let got;
            try {
                got = Buffer.from(sig, 'base64url');
            } catch {
                return false;
            }
            return got.length === expected.length && crypto.timingSafeEqual(got, expected);
        }
    };
}
export function secureHeaders(options = {}) {
    const nonce = options.nonce || crypto.randomBytes(16).toString('base64');
    const csp = options.csp || `default-src 'self'; script-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`;
    return {
        nonce,
        headers: {
            'content-security-policy': csp,
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'strict-origin-when-cross-origin',
            'permissions-policy': options.permissionsPolicy || 'camera=(), microphone=(), geolocation=()',
            'cross-origin-opener-policy': 'same-origin'
        }
    };
}
