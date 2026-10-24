import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDelivery } from '../src/eta.js';

const moscowDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function expectedEta(moment, workingDays) {
  const date = new Date(`${moscowDay.format(moment)}T00:00:00Z`);
  let left = workingDays;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}

test('отгрузка сейчас: дата доставки по Москве', () => {
  const now = new Date();
  assert.equal(estimateDelivery(now.toISOString(), 'B'), expectedEta(now, 3));
});

test('зона C, стандарт: пять рабочих дней с пропуском выходных', () => {
  assert.equal(estimateDelivery('2026-09-25T09:00:00Z', 'C'), '2026-10-02');
});

test('зона A: отгрузка в пятницу - доставка в понедельник', () => {
  assert.equal(estimateDelivery('2026-10-02T14:00:00+03:00', 'A'), '2026-10-05');
});
