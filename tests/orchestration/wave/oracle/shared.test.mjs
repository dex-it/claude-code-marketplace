import test from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './_load.mjs';

const index = await load('src/index.js');

test('экспорты src/index.js', () => {
  for (const name of ['countWords', 'parseDuration', 'formatDuration', 'LruCache', 'parse', 'compare', 'satisfies']) {
    assert.notEqual(index[name], undefined, name);
  }
});
test('таблица API в README', () => {
  const readme = read('README.md');
  for (const name of ['parseDuration', 'formatDuration', 'LruCache', 'satisfies', 'compare', 'parse(']) {
    assert.ok(readme.includes(name), name);
  }
});
test('CHANGELOG: Unreleased упоминает три модуля', () => {
  const log = read('CHANGELOG.md');
  const unreleased = log.split(/^## /m).find((s) => s.startsWith('Unreleased')) || '';
  for (const word of [/duration/i, /lru/i, /semver/i]) assert.match(unreleased, word);
});
