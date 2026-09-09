import test from 'node:test';
import assert from 'node:assert/strict';
import { server, handleServerFunction } from '../src/server/rpc.ts';
import { object, number } from '../src/forms/schema.ts';
import { createCSRF } from '../src/server/security.ts';

test('server functions execute locally and through Request/Response handler', async () => {
  const add=server(object({a:number(),b:number()}), async ({a,b})=>a+b);
  assert.equal(await add({a:2,b:3}),5);
  const req=new Request(`http://test/_lithe/action/${add.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{a:4,b:8}})});
  const res=await handleServerFunction(req,{}); assert.equal(res.status,200); assert.deepEqual(await res.json(),{ok:true,data:12});
});

test('a permission-protected action is denied by default when no context.can is wired in', async () => {
  const deleteUser = server({ permission: 'admin.deleteUser', handler: async () => 'deleted' });
  const req = new Request(`http://test/_lithe/action/${deleteUser.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: {} }) });
  const res = await handleServerFunction(req, {});
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'FORBIDDEN');
});

test('a permission-protected action runs once context.can grants it', async () => {
  const deleteUser = server({ permission: 'admin.deleteUser', handler: async () => 'deleted' });
  const req = new Request(`http://test/_lithe/action/${deleteUser.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: {} }) });
  const res = await handleServerFunction(req, { can: async () => true });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: 'deleted' });
});

test('a CSRF-protected action rejects a missing or invalid token and accepts a valid one', async () => {
  const csrf = createCSRF('test-secret');
  const action = server(async () => 'ok');
  const withoutToken = await handleServerFunction(new Request(`http://test/_lithe/action/${action.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: {} }) }), { csrf });
  assert.equal(withoutToken.status, 403);
  assert.equal((await withoutToken.json()).error.code, 'CSRF');

  const token = csrf.issue('session-1');
  const withValidToken = await handleServerFunction(new Request(`http://test/_lithe/action/${action.id}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ input: {} }) }), { csrf, sessionId: 'session-1' });
  assert.equal(withValidToken.status, 200);

  const withWrongSession = await handleServerFunction(new Request(`http://test/_lithe/action/${action.id}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ input: {} }) }), { csrf, sessionId: 'session-2' });
  assert.equal(withWrongSession.status, 403);
});
