import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneFor } from '../src/zones.js';

const cases = [
  ['10115', 'A'],
  ['17033', 'B'],
  ['20095', 'B'],
  ['80331', 'C'],
  ['99084', 'B'],
];

for (const [postcode, zone] of cases) {
  test(`индекс ${postcode} - зона ${zone}`, () => {
    assert.equal(zoneFor(postcode), zone);
  };
}
