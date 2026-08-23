import test from 'node:test';
import assert from 'node:assert/strict';
import { object, string, number, email, array } from '../src/forms/schema.ts';

test('schemas parse and validate nested input', () => {
  const schema=object({name:string().min(2),age:number({coerce:true,min:1}),emails:array(email())});
  const ok=schema.safeParse({name:'Ada',age:'33',emails:['a@example.com']});
  assert.equal(ok.success,true); assert.equal(ok.data.age,33);
  const bad=schema.safeParse({name:'A',age:0,emails:['bad']}); assert.equal(bad.success,false); assert.ok(bad.issues.length>=3);
});
