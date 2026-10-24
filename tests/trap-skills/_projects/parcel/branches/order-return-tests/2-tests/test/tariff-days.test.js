import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDays } from '../src/tariff.js';

test('экспресс ускоряет доставку', () => {
  assert.equal(deliveryDays('A', { express: true }), 1);
});
