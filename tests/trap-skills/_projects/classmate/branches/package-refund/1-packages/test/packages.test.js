import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyPackage, useLesson } from '../src/billing/packages.js';

const pkg = buyPackage('start', 's1', 't1', '2026-10-01T10:00:00Z').pkg;

test('buyPackage - пакет «Старт» - 5 уроков и срок 90 дней', () => {
  assert.equal(pkg.lessonsLeft, 5);
  assert.equal(pkg.expiresAt, '2026-12-30T10:00:00.000Z');
});

test('useLesson - пакет действует - урок списан', () => {
  assert.equal(useLesson(pkg, '2026-10-05T10:00:00Z').pkg.lessonsLeft, 4);
});

test('useLesson - срок вышел - package_expired', () => {
  assert.deepEqual(useLesson(pkg, '2026-12-31T10:00:00Z'), { ok: false, code: 'package_expired' });
});
