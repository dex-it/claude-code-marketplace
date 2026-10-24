import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { parseCron, nextRun } = await load('src/cron.js');

const iso = (d) => d.toISOString();
const next = (expr, from) => iso(nextRun(expr, new Date(from)));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('parseCron: пример задания', () => {
  assert.deepEqual(parseCron('*/15 0 1,15 * mon-wed'), {
    minute: [0, 15, 30, 45],
    hour: [0],
    dayOfMonth: [1, 15],
    month: range(1, 12),
    dayOfWeek: [1, 2, 3],
  });
});
test('parseCron: звёздочка раскрывается во весь диапазон поля', () => {
  const c = parseCron('* * * * *');
  assert.deepEqual(c.minute, range(0, 59));
  assert.deepEqual(c.hour, range(0, 23));
  assert.deepEqual(c.dayOfMonth, range(1, 31));
  assert.deepEqual(c.month, range(1, 12));
  assert.deepEqual(c.dayOfWeek, range(0, 6));
});
test('parseCron: числа, диапазоны, списки, сортировка и уникальность', () => {
  const c = parseCron('30,5-7,6,0 23 31 12 3');
  assert.deepEqual(c.minute, [0, 5, 6, 7, 30]);
  assert.deepEqual(c.hour, [23]);
  assert.deepEqual(c.dayOfMonth, [31]);
  assert.deepEqual(c.month, [12]);
  assert.deepEqual(c.dayOfWeek, [3]);
});
test('parseCron: шаги отсчитываются от начала диапазона', () => {
  assert.deepEqual(parseCron('10-30/10 * * * *').minute, [10, 20, 30]);
  assert.deepEqual(parseCron('*/25 * * * *').minute, [0, 25, 50]);
  assert.deepEqual(parseCron('0 */7 * * *').hour, [0, 7, 14, 21]);
  assert.deepEqual(parseCron('0 0 */10 * *').dayOfMonth, [1, 11, 21, 31]);
  assert.deepEqual(parseCron('0 0 * */5 *').month, [1, 6, 11]);
  assert.deepEqual(parseCron('0 0 * * */3').dayOfWeek, [0, 3, 6]);
  assert.deepEqual(parseCron('*/100 * * * *').minute, [0]);
  assert.deepEqual(parseCron('1-2/5,40-41/1 * * * *').minute, [1, 40, 41]);
});
test('parseCron: имена месяцев и дней недели без учёта регистра', () => {
  assert.deepEqual(parseCron('0 0 1 JAN,jul,Dec *').month, [1, 7, 12]);
  assert.deepEqual(parseCron('0 0 * jan-mar *').month, [1, 2, 3]);
  assert.deepEqual(parseCron('0 0 * jan-dec/3 *').month, [1, 4, 7, 10]);
  assert.deepEqual(parseCron('0 0 * * Sun,SAT').dayOfWeek, [0, 6]);
  assert.deepEqual(parseCron('0 0 * * mon-fri').dayOfWeek, [1, 2, 3, 4, 5]);
  assert.deepEqual(parseCron('0 0 * * mon-fri/2').dayOfWeek, [1, 3, 5]);
  assert.deepEqual(parseCron('0 0 * * sun-sat').dayOfWeek, range(0, 6));
  assert.deepEqual(parseCron('0 0 * * 1-wed').dayOfWeek, [1, 2, 3]);
});
test('parseCron: воскресенье 0 и 7 - одно значение 0', () => {
  assert.deepEqual(parseCron('0 0 * * 7').dayOfWeek, [0]);
  assert.deepEqual(parseCron('0 0 * * 0,7').dayOfWeek, [0]);
  assert.deepEqual(parseCron('0 0 * * 5-7').dayOfWeek, [0, 5, 6]);
  assert.deepEqual(parseCron('0 0 * * 0-7').dayOfWeek, range(0, 6));
  assert.deepEqual(parseCron('0 0 * * 7,1').dayOfWeek, [0, 1]);
});
test('parseCron: пробельные разделители и края', () => {
  const c = parseCron('  5\t10   *  * \t* ');
  assert.deepEqual(c.minute, [5]);
  assert.deepEqual(c.hour, [10]);
});
test('parseCron: неверное число полей - SyntaxError', () => {
  for (const bad of ['', '   ', '* * * *', '* * * * * *', '*', '0 0 0 0']) {
    assert.throws(() => parseCron(bad), SyntaxError, JSON.stringify(bad));
  }
});
test('parseCron: значение вне диапазона - SyntaxError', () => {
  for (const bad of ['60 * * * *', '* 24 * * *', '* * 0 * *', '* * 32 * *', '* * * 0 *', '* * * 13 *',
    '* * * * 8', '0-60 * * * *', '* 0-24 * * *', '* * * * 0-8', '5,99 * * * *']) {
    assert.throws(() => parseCron(bad), SyntaxError, bad);
  }
});
test('parseCron: шаг 0, нецелый или без базы - SyntaxError', () => {
  for (const bad of ['*/0 * * * *', '1-5/0 * * * *', '*/1.5 * * * *', '*/-1 * * * *', '*/ * * * *',
    '*/x * * * *', '5/15 * * * *', '*/5/2 * * * *']) {
    assert.throws(() => parseCron(bad), SyntaxError, bad);
  }
});
test('parseCron: перевёрнутый диапазон - SyntaxError', () => {
  for (const bad of ['30-10 * * * *', '* 5-4 * * *', '* * * mar-jan *', '* * * * fri-sun', '* * * * 6-1', '* * * * 7-5']) {
    assert.throws(() => parseCron(bad), SyntaxError, bad);
  }
});
test('parseCron: неизвестное имя, имя не в своём поле, мусор - SyntaxError', () => {
  for (const bad of ['0 0 * foo *', '0 0 * * funday', '0 0 * * sunday', '0 0 * january *', '0 0 * * jan', '0 0 * mon *',
    'mon * * * *', '* * * * 1-foo', '1,,2 * * * *', '1, * * * *', ', * * * *', '-1 * * * *', '1.5 * * * *',
    '+1 * * * *', '1- * * * *', '-5 * * * *', '1-2-3 * * * *', '** * * * *', '*,* x * * *']) {
    assert.throws(() => parseCron(bad), SyntaxError, bad);
  }
});
test('nextRun: ошибки разбора - SyntaxError, недостижимое - RangeError', () => {
  const from = new Date('2025-01-01T00:00:00Z');
  assert.throws(() => nextRun('* * * *', from), SyntaxError);
  assert.throws(() => nextRun('61 * * * *', from), SyntaxError);
  assert.throws(() => nextRun('*/0 * * * *', from), SyntaxError);
  assert.throws(() => nextRun('0 0 31 2 *', from), RangeError);
  assert.throws(() => nextRun('0 0 30 2 *', from), RangeError);
  assert.throws(() => nextRun('0 0 31 4,6,9,11 *', from), RangeError);
});
test('nextRun: строго после from, секунды и мс обнуляются, from не меняется', () => {
  const from = new Date('2025-03-10T12:00:30.500Z');
  const r = nextRun('* * * * *', from);
  assert.ok(r instanceof Date);
  assert.notEqual(r, from);
  assert.equal(iso(from), '2025-03-10T12:00:30.500Z');
  assert.equal(next('* * * * *', '2025-03-10T12:00:30.500Z'), '2025-03-10T12:01:00.000Z');
  assert.equal(next('* * * * *', '2025-03-10T12:00:00.000Z'), '2025-03-10T12:01:00.000Z');
  assert.equal(next('* * * * *', '2025-03-10T12:00:00.001Z'), '2025-03-10T12:01:00.000Z');
  assert.equal(next('0 12 * * *', '2025-03-10T12:00:00.000Z'), '2025-03-11T12:00:00.000Z');
  assert.equal(next('0 12 * * *', '2025-03-10T11:59:59.999Z'), '2025-03-10T12:00:00.000Z');
  assert.equal(next('*/15 * * * *', '2025-03-10T12:15:00.000Z'), '2025-03-10T12:30:00.000Z');
});
test('nextRun: перенос минут, часов, дней, месяцев и года', () => {
  assert.equal(next('5 * * * *', '2025-03-10T12:06:00Z'), '2025-03-10T13:05:00.000Z');
  assert.equal(next('30 2 * * *', '2025-03-10T03:00:00Z'), '2025-03-11T02:30:00.000Z');
  assert.equal(next('0 0 1 * *', '2025-03-10T00:00:00Z'), '2025-04-01T00:00:00.000Z');
  assert.equal(next('0 0 1 1 *', '2025-12-31T23:59:30Z'), '2026-01-01T00:00:00.000Z');
  assert.equal(next('* * * * *', '2025-12-31T23:59:30Z'), '2026-01-01T00:00:00.000Z');
  assert.equal(next('15 10 * 3 *', '2025-03-31T10:15:00Z'), '2026-03-01T10:15:00.000Z');
  assert.equal(next('59 23 31 12 *', '2025-01-01T00:00:00Z'), '2025-12-31T23:59:00.000Z');
});
test('nextRun: дни недели, воскресенье как 0 и 7', () => {
  assert.equal(next('0 9 * * 1-5', '2025-01-03T10:00:00Z'), '2025-01-06T09:00:00.000Z');
  assert.equal(next('0 9 * * 1-5', '2025-01-03T08:00:00Z'), '2025-01-03T09:00:00.000Z');
  assert.equal(next('0 0 * * 0', '2025-01-01T00:00:00Z'), '2025-01-05T00:00:00.000Z');
  assert.equal(next('0 0 * * 7', '2025-01-01T00:00:00Z'), '2025-01-05T00:00:00.000Z');
  assert.equal(next('0 0 * * sun', '2025-01-05T00:00:00Z'), '2025-01-12T00:00:00.000Z');
  assert.equal(next('0 0 * * sat', '2025-01-01T00:00:00Z'), '2025-01-04T00:00:00.000Z');
});
test('nextRun: пропуск коротких месяцев и високосный 29 февраля', () => {
  assert.equal(next('0 0 31 * *', '2025-04-01T00:00:00Z'), '2025-05-31T00:00:00.000Z');
  assert.equal(next('0 0 31 * *', '2025-05-31T00:00:00Z'), '2025-07-31T00:00:00.000Z');
  assert.equal(next('0 0 30 * *', '2025-01-31T00:00:00Z'), '2025-03-30T00:00:00.000Z');
  assert.equal(next('0 0 29 2 *', '2025-01-01T00:00:00Z'), '2028-02-29T00:00:00.000Z');
  assert.equal(next('0 0 29 2 *', '2024-02-29T00:00:00Z'), '2028-02-29T00:00:00.000Z');
  assert.equal(next('0 0 29 2 *', '2024-02-28T12:00:00Z'), '2024-02-29T00:00:00.000Z');
  assert.equal(next('0 0 1 3 *', '2024-02-29T00:00:00Z'), '2024-03-01T00:00:00.000Z');
  assert.equal(next('0 0 29 * *', '2025-02-01T00:00:00Z'), '2025-03-29T00:00:00.000Z');
  assert.equal(next('0 0 29 * *', '2024-02-01T00:00:00Z'), '2024-02-29T00:00:00.000Z');
});
test('nextRun: правило Vixie - ИЛИ при двух ограниченных полях дня', () => {
  assert.equal(next('0 0 15 * 1', '2025-01-01T00:00:00Z'), '2025-01-06T00:00:00.000Z');
  assert.equal(next('0 0 15 * 1', '2025-01-13T00:00:00Z'), '2025-01-15T00:00:00.000Z');
  assert.equal(next('0 0 15 * 1', '2025-01-15T00:00:00Z'), '2025-01-20T00:00:00.000Z');
  assert.equal(next('0 0 31 2 1', '2025-01-01T00:00:00Z'), '2025-02-03T00:00:00.000Z');
  assert.equal(next('0 0 1,2 * 0', '2025-01-03T00:00:00Z'), '2025-01-05T00:00:00.000Z');
  assert.equal(next('0 0 1 jan mon', '2025-01-02T00:00:00Z'), '2025-01-06T00:00:00.000Z');
});
test('nextRun: при одном ограниченном поле дня второе не мешает', () => {
  assert.equal(next('0 0 15 * *', '2025-01-01T00:00:00Z'), '2025-01-15T00:00:00.000Z');
  assert.equal(next('0 0 * * 1', '2025-01-01T00:00:00Z'), '2025-01-06T00:00:00.000Z');
  assert.equal(next('0 0 13 * 5', '2025-01-01T00:00:00Z'), '2025-01-03T00:00:00.000Z');
});
test('nextRun: ограниченность определяется текстом поля, не набором значений', () => {
  assert.equal(next('0 0 1-31 * 1', '2025-01-01T00:00:00Z'), '2025-01-02T00:00:00.000Z');
  assert.equal(next('0 0 */2 * 3', '2025-01-02T00:00:00Z'), '2025-01-03T00:00:00.000Z');
  assert.equal(next('0 0 * * 0-6', '2025-01-01T00:00:00Z'), '2025-01-02T00:00:00.000Z');
  assert.equal(next('0 0 2 * */2', '2025-01-01T00:00:00Z'), '2025-01-02T00:00:00.000Z');
  assert.equal(next('0 0 2 * */2', '2025-01-02T00:00:00Z'), '2025-01-04T00:00:00.000Z');
});
