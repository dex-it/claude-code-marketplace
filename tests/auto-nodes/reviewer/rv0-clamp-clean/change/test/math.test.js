import test from 'node:test';
import assert from 'node:assert/strict';
import { sum, clamp } from '../src/math.js';

test('sum', () => {
  assert.equal(sum([1, 2, 3]), 6);
  assert.equal(sum([]), 0);
});

test('clamp внутри диапазона (R1)', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test('clamp ниже и выше (R1)', () => {
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
});

test('clamp при min == max (R1)', () => {
  assert.equal(clamp(7, 3, 3), 3);
});

test('clamp min > max - RangeError с обоими значениями (R2)', () => {
  assert.throws(() => clamp(1, 5, 2), { name: 'RangeError', message: /5.*2/ });
});
