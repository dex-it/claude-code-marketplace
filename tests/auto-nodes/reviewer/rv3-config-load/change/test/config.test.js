import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, DEFAULTS } from '../src/config.js';

const tmp = (body) => {
  const file = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'c.json');
  writeFileSync(file, body);
  return file;
};

test('нет файла - умолчания (R1)', () => {
  assert.deepEqual(loadConfig('/nonexistent/c.json'), DEFAULTS);
});

test('файл перекрывает умолчания (R3)', () => {
  assert.deepEqual(loadConfig(tmp('{"retries":5}')), { retries: 5, timeoutMs: 1000, tags: [] });
});
