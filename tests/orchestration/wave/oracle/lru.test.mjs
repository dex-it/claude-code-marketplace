import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { LruCache } = await load('src/lru.js');

test('вытесняется самый давний', () => {
  const c = new LruCache(2);
  c.set('a', 1).set('b', 2);
  assert.equal(c.get('a'), 1);
  c.set('c', 3);
  assert.equal(c.has('b'), false);
  assert.deepEqual(c.keys(), ['a', 'c']);
  assert.equal(c.size, 2);
});
test('set возвращает кэш, обновление делает ключ свежим', () => {
  const c = new LruCache(2);
  assert.equal(c.set('a', 1), c);
  c.set('b', 2);
  c.set('a', 10);
  c.set('c', 3);
  assert.deepEqual(c.keys(), ['a', 'c']);
  assert.equal(c.get('a'), 10);
});
test('has свежесть не меняет', () => {
  const c = new LruCache(2);
  c.set('a', 1); c.set('b', 2);
  assert.equal(c.has('a'), true);
  c.set('c', 3);
  assert.deepEqual(c.keys(), ['b', 'c']);
});
test('keys: от давнего к свежему', () => {
  const c = new LruCache(3);
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  c.get('a');
  assert.deepEqual(c.keys(), ['b', 'c', 'a']);
});
test('get промаха - undefined; delete и clear', () => {
  const c = new LruCache(3);
  assert.equal(c.get('x'), undefined);
  c.set('a', 1); c.set('b', 2);
  assert.equal(c.delete('a'), true);
  assert.equal(c.delete('a'), false);
  assert.equal(c.size, 1);
  c.clear();
  assert.equal(c.size, 0);
  assert.deepEqual(c.keys(), []);
});
test('max: целое > 0', () => {
  for (const bad of [0, -1, 1.5]) assert.throws(() => new LruCache(bad), RangeError, String(bad));
  assert.doesNotThrow(() => new LruCache(1));
});
test('ttlMs: срок с момента set, чтение не продлевает', () => {
  let t = 0;
  const c = new LruCache(3, { ttlMs: 100, now: () => t });
  c.set('a', 1);
  t = 50;
  assert.equal(c.get('a'), 1);
  t = 60;
  assert.equal(c.get('a'), 1);
  t = 120;
  assert.equal(c.get('a'), undefined);
  assert.equal(c.has('a'), false);
});
test('ttlMs: set обновляет срок', () => {
  let t = 0;
  const c = new LruCache(3, { ttlMs: 100, now: () => t });
  c.set('a', 1);
  t = 80;
  c.set('a', 2);
  t = 150;
  assert.equal(c.get('a'), 2);
  t = 190;
  assert.equal(c.get('a'), undefined);
});
test('size и keys не считают просроченные', () => {
  let t = 0;
  const c = new LruCache(5, { ttlMs: 100, now: () => t });
  c.set('a', 1);
  t = 80;
  c.set('b', 2);
  t = 120;
  assert.equal(c.size, 1);
  assert.deepEqual(c.keys(), ['b']);
});
