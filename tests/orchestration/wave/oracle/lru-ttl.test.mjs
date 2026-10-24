import test from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './_load.mjs';

const { LruCache } = await load('src/lru.js');

test('ttl строкой и числом, ttlMs сохранён', () => {
  assert.equal(new LruCache(2, { ttl: '1h30m' }).ttl, 5400000);
  assert.equal(new LruCache(2, { ttl: 100 }).ttl, 100);
  assert.equal(new LruCache(2, { ttlMs: 100 }).ttl, 100);
  assert.equal(new LruCache(2).ttl, undefined);
});
test('оба параметра - TypeError; неразбираемая строка - RangeError', () => {
  assert.throws(() => new LruCache(2, { ttl: 100, ttlMs: 100 }), TypeError);
  assert.throws(() => new LruCache(2, { ttl: 'bogus' }), RangeError);
});
test('срок строкой работает', () => {
  let t = 0;
  const c = new LruCache(2, { ttl: '90s', now: () => t });
  c.set('a', 1);
  t = 89000;
  assert.equal(c.get('a'), 1);
  t = 91000;
  assert.equal(c.get('a'), undefined);
});
test('разбор длительности - из src/duration.js, не копией', () => {
  assert.match(read('src/lru.js'), /duration\.js/);
});
