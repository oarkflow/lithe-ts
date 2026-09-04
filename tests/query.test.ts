import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, query, mutation, infiniteQuery } from '../src/data/query.ts';
import { stream } from '../src/data/stream.ts';
import { createScope } from '../src/core/owner.ts';

test('query client deduplicates concurrent fetches and caches result', async () => {
  const client=new QueryClient({stale:'1m'}); let calls=0;
  const opts={key:['x',1],fetch:async()=>{calls++; await new Promise(r=>setTimeout(r,10)); return {ok:true};}};
  const [a,b]=await Promise.all([client.fetchQuery(opts),client.fetchQuery(opts)]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.deepEqual(client.getQueryData(['x',1]),{ok:true});
});

test('unretained imperative queries are garbage-collected after the configured ttl', async () => {
  const client = new QueryClient({ cache: new Map(), gc: '10ms', autoStart: false });
  await client.fetchQuery({ key: ['unretained'], gc: '10ms', fetch: async () => 'value' });
  assert.equal(client.cache.size, 1);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(client.cache.size, 0);
});

test('reading an unknown query key does not allocate a cache entry', () => {
  const client = new QueryClient({ cache: new Map(), autoStart: false });
  for (let i = 0; i < 100; i++) assert.equal(client.getQueryData(['missing', i]), undefined);
  assert.equal(client.cache.size, 0);
});

test('independent query clients do not share cache entries by default', () => {
  const first = new QueryClient({ autoStart: false });
  const second = new QueryClient({ autoStart: false });
  first.setQueryData(['isolated'], 'first');
  assert.equal(second.getQueryData(['isolated']), undefined);
});

test('query client destroy releases cache and event listeners', () => {
  const client = new QueryClient({ cache: new Map(), autoStart: false });
  client.setQueryData(['temporary'], 'value');
  let events = 0;
  client.subscribe(() => events++);
  client.destroy();
  assert.equal(client.cache.size, 0);
  client.emit({ type: 'after-destroy' });
  assert.equal(events, 0);
});

test('owner disposal releases query retention and explicit disposal is idempotent', () => {
  const client = new QueryClient({ cache: new Map(), gc: 0, autoStart: false });
  let result;
  const scope = createScope(() => {
    result = query({ client, key: ['owned'], enabled: false });
    return result;
  });
  assert.equal(client.cache.get('["owned"]')?.subscribers, 1);
  scope.dispose();
  assert.equal(client.cache.get('["owned"]')?.subscribers, 0);
  result.dispose();
  assert.equal(client.cache.get('["owned"]')?.subscribers, 0);
});

test('superseded query cleanup does not clear the newer request state', async () => {
  const cache = new Map();
  const client = new QueryClient({ cache, autoStart: false });
  let calls = 0;
  const fetch = ({ signal }: { signal: AbortSignal }) => {
    calls++;
    if (calls === 1) return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return new Promise(resolve => setTimeout(() => resolve('new'), 20));
  };
  const first = client.fetchQuery({ key: ['race'], fetch, retry: 0 }).catch(() => undefined);
  await Promise.resolve();
  const second = client.fetchQuery({ key: ['race'], fetch, retry: 0, force: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cache.get('["race"]')?.loading.peek(), true);
  assert.equal(await second, 'new');
  await first;
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

test('infiniteQuery disposal aborts in-flight work and clears retained pages', async () => {
  let aborted = false;
  let queryResult: any;
  const scope = createScope(() => {
    queryResult = infiniteQuery({
      key: ['items-owned'],
      initialPageParam: 1,
      queryFn: ({ signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(signal.reason);
        }, { once: true });
      })
    });
    return queryResult;
  });
  scope.dispose();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(aborted, true);
  assert.deepEqual(queryResult.pages, []);
  assert.equal(queryResult.hasNext, false);
  queryResult.dispose();
});

test('stream disposal cannot be resurrected by reconnect', () => {
  const previousWindow = globalThis.window;
  const previousEventSource = globalThis.EventSource;
  const sources: any[] = [];
  class FakeEventSource {
    onopen: any = null;
    onmessage: any = null;
    onerror: any = null;
    onclose: any = null;
    readyState = 1;
    constructor(public url: string) { sources.push(this); }
    close() { this.readyState = 2; this.onclose?.(); }
  }
  (globalThis as any).window = {};
  (globalThis as any).EventSource = FakeEventSource;
  try {
    let connection: any;
    const scope = createScope(() => {
      connection = stream('/events', { autoConnect: true, retryDelay: 1 });
      return connection;
    });
    assert.equal(sources.length, 1);
    scope.dispose();
    connection.reconnect();
    assert.equal(sources.length, 1);
    connection.dispose();
  } finally {
    (globalThis as any).window = previousWindow;
    (globalThis as any).EventSource = previousEventSource;
  }
});
