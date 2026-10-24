import test from 'node:test';
import assert from 'node:assert/strict';
import { load, read } from './_load.mjs';

const NAMES = {
  csv: ['parse', 'stringify'],
  jsonpatch: ['getPointer', 'applyPatch'],
  cron: ['parseCron', 'nextRun'],
  template: ['render'],
  glob: ['globToRegExp', 'isMatch'],
  diff: ['diffLines', 'unifiedDiff'],
  expr: ['evaluate'],
  toposort: ['toposort', 'layers'],
  router: ['Router'],
  strftime: ['strftime', 'isoWeek'],
  ini: ['parseIni', 'stringifyIni'],
  wrap: ['wrap', 'justify'],
};

const index = await load('src/index.js');

test('экспорты src/index.js', () => {
  for (const name of ['countWords', ...Object.values(NAMES).flat()]) {
    assert.equal(typeof index[name], 'function', name);
  }
});
test('таблица API в README', () => {
  const readme = read('README.md');
  for (const name of Object.values(NAMES).flat()) assert.ok(readme.includes(name), name);
});
test('CHANGELOG: Unreleased упоминает все модули', () => {
  const log = read('CHANGELOG.md');
  const unreleased = log.split(/^## /m).find((s) => s.startsWith('Unreleased')) || '';
  for (const m of Object.keys(NAMES)) assert.match(unreleased, new RegExp(m, 'i'), m);
});
