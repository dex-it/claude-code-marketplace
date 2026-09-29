import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration } from '../src/duration.js';

test('часы и минуты', () => {
  assert.equal(parseDuration('1h30m'), 5400000);
});

test('только минуты', () => {
  assert.equal(parseDuration('45m'), 2700000);
});

test('только часы', () => {
  assert.equal(parseDuration('2h'), 7200000);
});

test('мусор - RangeError', () => {
  assert.throws(() => parseDuration('5x'), RangeError);
  assert.throws(() => parseDuration('h'), RangeError);
});
