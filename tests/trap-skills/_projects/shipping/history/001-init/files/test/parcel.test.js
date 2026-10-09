import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeight } from '../src/parcel.js';

test('вес числом - килограммы', () => {
  assert.equal(parseWeight(1.5), 1500);
  assert.equal(parseWeight(2), 2000);
});

test('вес строкой с единицей', () => {
  assert.equal(parseWeight('1500g'), 1500);
  assert.equal(parseWeight('1.5kg'), 1500);
  assert.equal(parseWeight('1,5kg'), 1500);
});

test('неизвестный формат - 400', () => {
  assert.throws(() => parseWeight('1.5lb'), { status: 400 });
});
