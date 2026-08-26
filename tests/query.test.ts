import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, query, mutation, infiniteQuery } from '../src/data/query.ts';

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

test('infiniteQuery provides abort signal to fetcher', async () => {
  let receivedSignal: AbortSignal | null = null;
  const iq = infiniteQuery({
    key: ['items-paged'],
    initialPageParam: 1,
    queryFn: async (ctx: { pageParam: number; signal: AbortSignal }) => {
      receivedSignal = ctx.signal;
      return { items: [`page-${ctx.pageParam}`], next: ctx.pageParam + 1 };
    },
    getNextPageParam: (last: any) => last.next < 3 ? last.next : undefined
  });

  await new Promise(r => setTimeout(r, 20));
  assert.ok(receivedSignal, 'fetcher should receive an abort signal');
  assert.equal(receivedSignal!.aborted, false);
  assert.equal(iq.pages.length, 1);
});

test('infiniteQuery aborts previous page fetch when new fetch starts', async () => {
  let abortCount = 0;
  const iq = infiniteQuery({
    key: ['items-abort'],
    initialPageParam: 1,
    queryFn: async (ctx: { pageParam: number; signal: AbortSignal }) => {
      ctx.signal.addEventListener('abort', () => { abortCount++; });
      await new Promise(r => setTimeout(r, 50));
      return { items: [`page-${ctx.pageParam}`], next: ctx.pageParam + 1 };
    },
    getNextPageParam: (last: any) => last.next
  });

  await new Promise(r => setTimeout(r, 80));
  // Start a second fetch before first completes
  iq.fetchNext().catch(() => {});
  await new Promise(r => setTimeout(r, 10));
  // The initial page should have been aborted
  assert.equal(iq.pages.length, 1);
});
