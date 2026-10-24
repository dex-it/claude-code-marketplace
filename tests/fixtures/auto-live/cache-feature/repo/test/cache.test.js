import test from 'node:test';
import assert from 'node:assert/strict';
import { readSlugCache } from '../src/cache.js';

test('нет файла - null', () => {
  assert.equal(readSlugCache('ничего-нет'), null);
});
