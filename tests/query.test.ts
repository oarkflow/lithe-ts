import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, query, mutation } from '../src/data/query.ts';

test('query client deduplicates concurrent fetches and caches result', async () => {
  const client=new QueryClient({stale:'1m'}); let calls=0;
  const opts={key:['x',1],fetch:async()=>{calls++; await new Promise(r=>setTimeout(r,10)); return {ok:true};}};
  const [a,b]=await Promise.all([client.fetchQuery(opts),client.fetchQuery(opts)]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.deepEqual(client.getQueryData(['x',1]),{ok:true});
});

test('mutation invalidates query by tag and automatically refetches active query', async () => {
  const client = new QueryClient({ stale: '10s' });
  let serverItems = [{ id: 1, text: 'Alpha' }];
  const q = query({
    client,
    key: ['items-list'],
    tags: ['items'],
    queryFn: async () => [...serverItems]
  });

  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(q.data, [{ id: 1, text: 'Alpha' }]);

  const m = mutation({
    client,
    mutationFn: async (newItem: { id: number; text: string }) => {
      serverItems.push(newItem);
      return newItem;
    },
    invalidates: ['items']
  });

  assert.equal(m.loading, false);
  assert.equal(m.pending, false);

  const promise = m.mutate({ id: 2, text: 'Beta' });
  assert.equal(m.loading, true);
  await promise;
  assert.equal(m.loading, false);

  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(q.data, [
    { id: 1, text: 'Alpha' },
    { id: 2, text: 'Beta' }
  ]);
  q.dispose();
});
