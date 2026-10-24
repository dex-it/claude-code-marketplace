import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords } from '../src/index.js';

test('countWords считает слова', () => {
  assert.equal(countWords('a b  c'), 3);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(''), 0);
});
