import test from 'node:test';
import assert from 'node:assert/strict';
import { object, string, number, email, array } from '../src/forms/schema.ts';

test('schemas parse and validate nested input', () => {
  const schema=object({name:string().min(2),age:number({coerce:true,min:1}),emails:array(email())});
  const ok=schema.safeParse({name:'Ada',age:'33',emails:['a@example.com']});
  assert.equal(ok.success,true); assert.equal(ok.data.age,33);
  const bad=schema.safeParse({name:'A',age:0,emails:['bad']}); assert.equal(bad.success,false); assert.ok(bad.issues.length>=3);
});

test('refine({message, path}) attaches a cross-field issue to a specific child field', () => {
  const schema = object({ password: string().min(6), confirm: string() })
    .refine(v => v.password === v.confirm, { message: 'Passwords must match', path: ['confirm'] });
  const bad = schema.safeParse({ password: 'abcdef', confirm: 'xyz' });
  assert.equal(bad.success, false);
  assert.deepEqual(bad.issues[0].path, ['confirm']);
  assert.equal(bad.issues[0].message, 'Passwords must match');
  const ok = schema.safeParse({ password: 'abcdef', confirm: 'abcdef' });
  assert.equal(ok.success, true);
});
