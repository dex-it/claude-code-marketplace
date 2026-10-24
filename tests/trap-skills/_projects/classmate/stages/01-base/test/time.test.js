import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursBetween, toUtcIso } from '../src/util/time.js';

test('hoursBetween - сутки - 24', () => {
  assert.equal(hoursBetween('2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z'), 24);
});

test('toUtcIso - время со смещением - строка в UTC', () => {
  assert.equal(toUtcIso('2026-09-01T13:00:00+03:00'), '2026-09-01T10:00:00.000Z');
});
