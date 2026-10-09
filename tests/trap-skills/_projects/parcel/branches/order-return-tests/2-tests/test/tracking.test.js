import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTracking } from '../src/tracking.js';

test('трек-номера уникальны', () => {
  const numbers = Array.from({ length: 500 }, () => generateTracking());
  assert.equal(new Set(numbers).size, 500);
  for (const number of numbers) assert.match(number, /^PX[0-9A-Z]{8}$/);
});
