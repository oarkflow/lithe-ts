import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '../src/data/query.ts';

test('query client deduplicates concurrent fetches and caches result', async () => {
  const client=new QueryClient({stale:'1m'}); let calls=0;
  const opts={key:['x',1],fetch:async()=>{calls++; await new Promise(r=>setTimeout(r,10)); return {ok:true};}};
  const [a,b]=await Promise.all([client.fetchQuery(opts),client.fetchQuery(opts)]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.deepEqual(client.getQueryData(['x',1]),{ok:true});
});
