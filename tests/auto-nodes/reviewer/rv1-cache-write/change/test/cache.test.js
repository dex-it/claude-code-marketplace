import test from 'node:test';
import assert from 'node:assert/strict';
import { readSlugCache, writeSlugCache } from '../src/cache.js';

test('нет файла - null', () => {
  assert.equal(readSlugCache('ничего-нет'), null);
});

test('запись читается обратно (R1)', () => {
  writeSlugCache('k1', 'a-b');
  assert.ok(readSlugCache('k1') !== undefined);
});

test('запись перезаписывает прежнее значение (R3)', () => {
  writeSlugCache('k2', 'x');
  writeSlugCache('k2', 'y');
  assert.equal(readSlugCache('k2'), 'y');
});
