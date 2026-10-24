import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedQuote } from '../src/cache.js';

test('флаг выключен - расчёт на каждый запрос', () => {
  let n = 0;
  const ctx = { flags: {} };
  cachedQuote({ weight: 1, postcode: '10115' }, ctx, () => ++n);
  cachedQuote({ weight: 1, postcode: '10115' }, ctx, () => ++n);
  assert.equal(n, 2);
});

test('флаг включён - повтор той же посылки из кэша', () => {
  let n = 0;
  const ctx = { flags: { quote_cache: true } };
  cachedQuote({ weight: 7, postcode: '10115' }, ctx, () => ++n);
  cachedQuote({ weight: 7, postcode: '10115' }, ctx, () => ++n);
  assert.equal(n, 1);
});
