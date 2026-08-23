import test from 'node:test';
import assert from 'node:assert/strict';
import { h, Fragment } from '../src/dom/vnode.ts';
import { signal } from '../src/core/reactive.ts';
import { renderToString } from '../src/server/ssr.ts';

test('SSR renders components, signals and escaped HTML', async () => {
  const value=signal('<safe>');
  function App(){ return h('main',{class:'app'},h('h1',null,value),h('input',{disabled:true,value:'x'})); }
  const html=await renderToString(h(App,{}),{document:false});
  assert.equal(html,'<main class="app"><h1>&lt;safe&gt;</h1><input disabled value="x"></main>');
});
