import test from 'node:test';
import assert from 'node:assert/strict';
import { server, handleServerFunction } from '../src/server/rpc.ts';
import { object, number } from '../src/forms/schema.ts';

test('server functions execute locally and through Request/Response handler', async () => {
  const add=server(object({a:number(),b:number()}), async ({a,b})=>a+b);
  assert.equal(await add({a:2,b:3}),5);
  const req=new Request(`http://test/_lithe/action/${add.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{a:4,b:8}})});
  const res=await handleServerFunction(req,{}); assert.equal(res.status,200); assert.deepEqual(await res.json(),{ok:true,data:12});
});
