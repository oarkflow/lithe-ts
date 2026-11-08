import test from 'node:test';
import assert from 'node:assert/strict';
import { createCSRF, safeJSON } from '../src/server/security.ts';

test('CSRF verification rejects malformed, noncanonical, and non-string tokens', () => {
	const csrf = createCSRF('test-secret');
	const token = csrf.issue('session-a');
	assert.equal(csrf.verify(token, 'session-a'), true);
	assert.equal(csrf.verify(token, 'session-b'), false);
	assert.equal(csrf.verify(null as any), false);
	assert.equal(csrf.verify({} as any), false);
	assert.equal(csrf.verify(`${token}.extra`, 'session-a'), false);
	assert.equal(csrf.verify(`.${token}`, 'session-a'), false);
	assert.equal(csrf.verify(`${token.slice(0, -1)}!`, 'session-a'), false);
});

test('CSRF construction rejects empty secrets and accepts binary secrets', () => {
	assert.throws(() => createCSRF(''), /must not be empty/);
	assert.throws(() => createCSRF(42 as any), /must be a string or Buffer/);
	const csrf = createCSRF(Buffer.from('binary-secret'));
	assert.equal(csrf.verify(csrf.issue('session'), 'session'), true);
});

test('safeJSON always returns valid JSON for top-level non-JSON values', () => {
	assert.equal(safeJSON(undefined), 'null');
	assert.equal(safeJSON(() => 'not JSON'), 'null');
	assert.equal(safeJSON(Symbol('not JSON')), 'null');
	assert.equal(safeJSON({ html: '</script>&' }), '{"html":"\\u003c/script\\u003e\\u0026"}');
});
