import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { parseDuration, formatDuration } = await load('src/duration.js');

test('parseDuration: примеры задания', () => {
  assert.equal(parseDuration('1h30m'), 5400000);
  assert.equal(parseDuration('90s'), 90000);
  assert.equal(parseDuration('1d 2h'), 93600000);
  assert.equal(parseDuration('1.5h'), 5400000);
  assert.equal(parseDuration('250ms'), 250);
  assert.equal(parseDuration('0s'), 0);
});
test('parseDuration: единицы и составные', () => {
  assert.equal(parseDuration('2m'), 120000);
  assert.equal(parseDuration('1d'), 86400000);
  assert.equal(parseDuration('1m30s250ms'), 90250);
  assert.equal(parseDuration('1m 30s'), 90000);
  assert.equal(parseDuration('1.25s'), 1250);
});
test('parseDuration: округление Math.round', () => {
  assert.equal(parseDuration('0.5ms'), 1);
  assert.equal(parseDuration('1.5ms'), 2);
  assert.equal(parseDuration('1.4ms'), 1);
});
test('parseDuration: неверный ввод - RangeError', () => {
  for (const bad of ['', '5', '1.5', '5x', '-1h', '1H', 'abc', 'h', '1 h', '1h  30m', '1h-30m', '1h30', ' 1h']) {
    assert.throws(() => parseDuration(bad), RangeError, JSON.stringify(bad));
  }
});
test('formatDuration: примеры задания', () => {
  assert.equal(formatDuration(5400000), '1h 30m');
  assert.equal(formatDuration(93600000), '1d 2h');
  assert.equal(formatDuration(1500), '1s 500ms');
  assert.equal(formatDuration(61000), '1m 1s');
  assert.equal(formatDuration(0), '0s');
});
test('formatDuration: прочее', () => {
  assert.equal(formatDuration(1), '1ms');
  assert.equal(formatDuration(86400000), '1d');
  assert.equal(formatDuration(90061001), '1d 1h 1m 1s 1ms');
  assert.equal(formatDuration(3600000), '1h');
});
test('formatDuration: неверный ввод - RangeError', () => {
  for (const bad of [1.5, -1, NaN, Infinity]) {
    assert.throws(() => formatDuration(bad), RangeError, String(bad));
  }
});
test('круговой обход', () => {
  for (const ms of [0, 1, 999, 1000, 59999, 60000, 3599999, 3600000, 86399999, 86400000, 123456789, 90061001]) {
    assert.equal(parseDuration(formatDuration(ms)), ms);
  }
});
