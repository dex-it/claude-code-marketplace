import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { parse, compare, satisfies } = await load('src/semver.js');

test('parse', () => {
  assert.deepEqual(parse('1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] });
  assert.deepEqual(parse('v1.2.3-alpha.1+build.5'), { major: 1, minor: 2, patch: 3, prerelease: ['alpha', '1'] });
  assert.deepEqual(parse('0.0.10').patch, 10);
});
test('parse: неверное - TypeError', () => {
  for (const bad of ['', 'x', '1.2', '1.2.3.4', '1.2.x']) assert.throws(() => parse(bad), TypeError, JSON.stringify(bad));
});
test('compare: числа и равенство', () => {
  assert.equal(compare('1.2.3', '1.2.4'), -1);
  assert.equal(compare('2.0.0', '1.9.9'), 1);
  assert.equal(compare('1.10.0', '1.9.0'), 1);
  assert.equal(compare('1.0.0', 'v1.0.0'), 0);
  assert.equal(compare('1.0.0+a', '1.0.0+b'), 0);
});
test('compare: цепочка приоритета из semver 2.0.0', () => {
  const chain = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
  for (let i = 0; i + 1 < chain.length; i += 1) {
    assert.equal(compare(chain[i], chain[i + 1]), -1, `${chain[i]} < ${chain[i + 1]}`);
    assert.equal(compare(chain[i + 1], chain[i]), 1);
  }
});
test('satisfies: ^ и ~', () => {
  assert.equal(satisfies('1.2.3', '^1.0.0'), true);
  assert.equal(satisfies('2.0.0', '^1.0.0'), false);
  assert.equal(satisfies('0.2.5', '^0.2.3'), true);
  assert.equal(satisfies('0.3.0', '^0.2.3'), false);
  assert.equal(satisfies('0.0.3', '^0.0.3'), true);
  assert.equal(satisfies('0.0.4', '^0.0.3'), false);
  assert.equal(satisfies('1.2.9', '~1.2.3'), true);
  assert.equal(satisfies('1.3.0', '~1.2.3'), false);
  assert.equal(satisfies('1.2.2', '~1.2.3'), false);
});
test('satisfies: x, *, сравнения, наборы', () => {
  assert.equal(satisfies('1.5.0', '1.x'), true);
  assert.equal(satisfies('2.0.0', '1.x'), false);
  assert.equal(satisfies('1.2.7', '1.2.x'), true);
  assert.equal(satisfies('1.3.0', '1.2.x'), false);
  assert.equal(satisfies('9.9.9', '*'), true);
  assert.equal(satisfies('1.2.3', '>=1.0.0 <2.0.0'), true);
  assert.equal(satisfies('2.0.0', '>=1.0.0 <2.0.0'), false);
  assert.equal(satisfies('3.0.0', '<1.0.0 || >=2.0.0'), true);
  assert.equal(satisfies('1.5.0', '<1.0.0 || >=2.0.0'), false);
  assert.equal(satisfies('1.2.3', '1.2.3'), true);
  assert.equal(satisfies('1.2.3', '=1.2.3'), true);
  assert.equal(satisfies('1.2.4', '1.2.3'), false);
  assert.equal(satisfies('1.2.3', '>1.2.3'), false);
  assert.equal(satisfies('1.2.4', '>1.2.3'), true);
  assert.equal(satisfies('1.2.3', '<=1.2.3'), true);
});
test('satisfies: пререлиз', () => {
  assert.equal(satisfies('1.2.3-beta.1', '^1.0.0'), false);
  assert.equal(satisfies('1.2.3-beta.1', '>=1.2.3-beta.0'), true);
  assert.equal(satisfies('1.2.3-beta.1', '>=1.2.3-alpha'), true);
  assert.equal(satisfies('1.2.4-beta.1', '>=1.2.3-beta.0'), false);
  assert.equal(satisfies('1.2.3-rc.1', '>=1.2.3-beta.0 <1.2.3'), true);
});
