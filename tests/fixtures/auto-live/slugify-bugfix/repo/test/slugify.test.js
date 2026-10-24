import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.js';

test('пробелы становятся дефисом', () => {
  assert.equal(slugify('hello world'), 'hello-world');
});

test('регистр сводится к нижнему', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('повтор разделителей схлопывается', () => {
  assert.equal(slugify('a  b'), 'a-b');
});
