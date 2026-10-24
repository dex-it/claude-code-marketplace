import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeSlots } from '../src/booking/slots.js';

const window = { start: '2026-09-10T15:00:00Z', end: '2026-09-10T19:00:00Z' };

test('freeSlots - занятый час в середине окна - слот пропущен', () => {
  const slots = freeSlots(window, [{ start: '2026-09-10T16:00:00Z', end: '2026-09-10T17:00:00Z' }], 60, 60);
  const labels = slots.map((s) => s.label);
  assert.ok(labels.includes('15:00'));
  assert.ok(!labels.includes('16:00'));
});

test('freeSlots - окно с концом раньше начала - ошибка', () => {
  assert.throws(() => freeSlots({ start: window.end, end: window.start }, [], 60));
});
