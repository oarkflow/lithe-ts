import crypto from 'node:crypto';
// Escaping is on the hottest SSR path (called for essentially every text node
// and attribute value). Five sequential replaceAll() passes each rescan the
// whole string; a single regex pass with a lookup table does the same work
// in one scan, and — since String.prototype.replace returns the original
// string unchanged when nothing matches — costs nothing extra for the common
// case of plain text with no special characters.
const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHTML(value) {
    return String(value).replace(HTML_ESCAPE_RE, ch => HTML_ESCAPE_MAP[ch]);
}
const JSON_ESCAPE_RE = /[<>&\u2028\u2029]/g;
const JSON_ESCAPE_MAP: Record<string, string> = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
export function safeJSON(value) {
    // JSON.stringify returns undefined for top-level values that JSON cannot
    // represent (undefined, functions, and symbols). Resume/inline JSON callers
    // need an actual JSON document, so normalize those values to JSON null.
    const serialized = JSON.stringify(value);
    return (serialized ?? 'null').replace(JSON_ESCAPE_RE, ch => JSON_ESCAPE_MAP[ch]);
}
export function createCSRF(secret = crypto.randomBytes(32).toString('hex')) {
    if (typeof secret !== 'string' && !Buffer.isBuffer(secret)) throw new TypeError('CSRF secret must be a string or Buffer.');
    if (secret.length === 0) throw new TypeError('CSRF secret must not be empty.');
    return {
        secret,
        issue(sessionId = '') {
            const nonce = crypto.randomBytes(16).toString('base64url');
            const sig = crypto.createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest('base64url');
            return `${nonce}.${sig}`;
        },
        verify(token, sessionId = '') {
            if (typeof token !== 'string') return false;
            const parts = token.split('.');
            if (parts.length !== 2) return false;
            const [nonce, sig] = parts;
            // A 16-byte nonce and SHA-256 HMAC have fixed unpadded base64url
            // lengths. Reject alternate encodings and malformed input before
            // decoding so Buffer's permissive base64 parser cannot normalize
            // attacker-controlled token spellings.
            if (!/^[A-Za-z0-9_-]{22}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false;
            const expected = crypto.createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest();
            let got;
            try {
                got = Buffer.from(sig, 'base64url');
            } catch {
                return false;
            }
            if (got.length !== expected.length || got.toString('base64url') !== sig) return false;
            return crypto.timingSafeEqual(got, expected);
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
