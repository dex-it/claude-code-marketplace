import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processJob } from '../worker/label.js';

const msg = { id: 'S000001', tracking: 'DE0000000001', postcode: '20095', zone: 'B', weightGrams: 2100, express: true };

test('этикетка: индекс, вес, экспресс', () => {
  const t = processJob(msg);
  assert.match(t, /Индекс 20095/);
  assert.match(t, /Вес: 2\.1 кг/);
  assert.match(t, /ЭКСПРЕСС/);
});
