import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneFor } from '../src/zones.js';

test('зона по индексу', () => {
  assert.equal(zoneFor('10115'), 'A');
  assert.equal(zoneFor('20095'), 'B');
  assert.equal(zoneFor('80331'), 'C');
});
