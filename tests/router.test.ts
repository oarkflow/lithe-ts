import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/router/router.ts';

test('router matches static and parameter routes', () => {
  const A=()=>null,B=()=>null;
  const router=createRouter({initialURL:'http://test/users/42',routes:[{path:'/',component:A},{path:'/users/:id',component:B}]});
  assert.equal(router.matched.value.route.component,B); assert.equal(router.params.id,'42');
});
