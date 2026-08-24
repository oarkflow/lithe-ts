import test from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, state, createScope, onCleanup, explainSignal } from '../src/core/index.ts';

test('signal and computed update fine-grained dependencies', () => {
  const a=signal(2), b=signal(3); const total=computed(()=>a.value*b.value);
  assert.equal(total.value,6); a.value=4; assert.equal(total.value,12);
});

test('effects track dependencies and batching coalesces final state', async () => {
  const value=signal(0); const seen=[]; const stop=effect(()=>seen.push(value.value),{sync:true});
  batch(()=>{value.value=1;value.value=2;value.value=3;});
  assert.deepEqual(seen,[0,3]); stop(); value.value=4; assert.deepEqual(seen,[0,3]);
});

test('proxy state tracks property changes', () => {
  const model=state({user:{name:'A'}}); let seen; const stop=effect(()=>{seen=model.user.name},{sync:true});
  model.user.name='B'; assert.equal(seen,'B'); stop();
});

test('scopes dispose cleanups', () => {
  let cleaned=0; const scope=createScope(()=>onCleanup(()=>cleaned++)); scope.dispose(); assert.equal(cleaned,1); scope.dispose(); assert.equal(cleaned,1);
});

test('repeated reads subscribe an observer only once', () => {
  const value=signal(1,{name:'dedupe-read'}); const stop=effect(()=>{ value.value; value.value; },{sync:true});
  assert.equal(explainSignal(value).subscribers.length,1);
  stop();
  assert.equal(explainSignal(value).subscribers.length,0);
});

test('signal and computed equality options control invalidation', () => {
  const point=signal({x:1},{equals:(a:any,b:any)=>a.x===b.x});
  let runs=0; const stop=effect(()=>{runs++; point.value;},{sync:true});
  point.value={x:1};
  assert.equal(runs,1);
  point.value={x:2};
  assert.equal(runs,2);
  stop();

  const raw=signal(1), rounded=computed(()=>Math.floor(raw.value),{equals:(a,b)=>a===b});
  assert.equal(rounded.value,1);
  raw.value=1.4;
  assert.equal(rounded.value,1);
});
