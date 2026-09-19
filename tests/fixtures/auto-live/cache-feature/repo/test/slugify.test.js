import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.js';

test('пробелы становятся дефисом', () => {
  assert.equal(slugify('hello world'), 'hello-world');
});

test('краевые разделители срезаются', () => {
  assert.equal(slugify(' hello world! '), 'hello-world');
});
