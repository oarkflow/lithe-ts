import test from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, state, createScope, onCleanup, explainSignal, watch } from '../src/core/index.ts';

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

test('multiple sync observers of one state property all update across repeated writes', () => {
  const model=state({done:false});
  let classDone=false, checked=false;
  const stopClass=effect(()=>{classDone=model.done},{sync:true});
  const stopChecked=effect(()=>{checked=model.done},{sync:true});
  model.done=true;
  assert.equal(classDone,true);
  assert.equal(checked,true);
  model.done=false;
  assert.equal(classDone,false);
  assert.equal(checked,false);
  stopClass();
  stopChecked();
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

test('watch with deep:true performs structural comparison', () => {
  const obj = signal({ a: 1, b: { c: 2 } });
  const changes: Array<{ value: any; previous: any }> = [];
  const stop = watch(obj, (value, previous) => {
    changes.push({ value, previous });
  }, { deep: true, sync: true });

  // Same structure should not trigger
  obj.value = { a: 1, b: { c: 2 } };
  assert.equal(changes.length, 0);

  // Different nested value should trigger
  obj.value = { a: 1, b: { c: 3 } };
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].value, { a: 1, b: { c: 3 } });
  assert.deepEqual(changes[0].previous, { a: 1, b: { c: 2 } });

  // Same reference should not trigger
  const current = obj.value;
  obj.value = current;
  assert.equal(changes.length, 1);

  stop();
});

test('watch with deep:false uses reference equality', () => {
  const obj = signal({ a: 1 });
  let calls = 0;
  const stop = watch(obj, () => { calls++; }, { sync: true });

  // New reference triggers
  obj.value = { a: 1 };
  assert.equal(calls, 1);

  // Same reference does not trigger
  obj.value = obj.value;
  assert.equal(calls, 1);

  stop();
});
