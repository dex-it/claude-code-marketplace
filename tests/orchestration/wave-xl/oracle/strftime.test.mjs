import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { strftime, isoWeek } = await load('src/strftime.js');

const utc = (y, mo = 1, d = 1, h = 0, mi = 0, s = 0, ms = 0) => {
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(h, mi, s, ms);
  return t;
};
const D = utc(2025, 3, 5, 7, 8, 9, 45);

test('strftime: примеры задания', () => {
  assert.equal(strftime(D, '%Y-%m-%d %H:%M:%S.%L'), '2025-03-05 07:08:09.045');
  assert.equal(strftime(D, '%-d/%-m/%y [%e] [%_m]'), '5/3/25 [ 5] [ 3]');
  assert.equal(strftime(D, '%a %A %b %B %j %u %w'), 'Wed Wednesday Mar March 064 3 3');
  assert.equal(strftime(utc(42, 1, 2, 0, 30), '%Y|%I:%M %p'), '0042|12:30 AM');
  assert.equal(strftime(utc(2024, 12, 30, 12), '%G-W%V-%u'), '2025-W01-1');
  assert.throws(() => strftime(D, '%-A'), RangeError);
  assert.throws(() => strftime(D, '50%'), RangeError);
  assert.deepEqual(isoWeek(utc(2021, 1, 3)), { year: 2020, week: 53 });
});
test('strftime: числовые директивы и ширина по умолчанию', () => {
  const d = utc(2007, 1, 2, 3, 4, 5, 6);
  assert.equal(strftime(d, '%Y %y %m %d %e %H %I %M %S %L %j %u %w'), '2007 07 01 02  2 03 03 04 05 006 002 2 2');
  assert.equal(strftime(utc(2100, 12, 25, 23, 59, 59, 999), '%y %m %d %H %I %M %S %L %j'), '00 12 25 23 11 59 59 999 359');
});
test('strftime: 12-часовой формат и %p', () => {
  const at = (h) => strftime(utc(2025, 6, 15, h, 5), '%I %p %H');
  assert.equal(at(0), '12 AM 00');
  assert.equal(at(1), '01 AM 01');
  assert.equal(at(11), '11 AM 11');
  assert.equal(at(12), '12 PM 12');
  assert.equal(at(13), '01 PM 13');
  assert.equal(at(23), '11 PM 23');
});
test('strftime: имена дней и месяцев', () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < 7; i++) {
    const d = utc(2023, 1, 1 + i);
    assert.equal(strftime(d, '%A'), days[i]);
    assert.equal(strftime(d, '%a'), days[i].slice(0, 3));
    assert.equal(strftime(d, '%w'), String(i));
    assert.equal(strftime(d, '%u'), String(i || 7));
  }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  months.forEach((name, i) => {
    assert.equal(strftime(utc(2023, i + 1, 10), '%B'), name);
    assert.equal(strftime(utc(2023, i + 1, 10), '%b'), name.slice(0, 3));
  });
});
test('strftime: годы меньше 1000 и %y', () => {
  assert.equal(strftime(utc(5, 6, 7), '%Y'), '0005');
  assert.equal(strftime(utc(999, 12, 31), '%Y-%m-%d'), '0999-12-31');
  assert.equal(strftime(utc(1, 1, 1), '%Y|%y|%G'), '0001|01|0001');
  assert.equal(strftime(utc(9999, 12, 31), '%Y %y'), '9999 99');
  assert.equal(strftime(utc(2000, 1, 1), '%y'), '00');
});
test('strftime: флаг "-" снимает дополнение', () => {
  const d = utc(2009, 1, 2, 3, 4, 5, 7);
  assert.equal(strftime(d, '%-d|%-m|%-H|%-I|%-M|%-S|%-j|%-y|%-e|%-L'), '2|1|3|3|4|5|2|9|2|7');
  assert.equal(strftime(utc(42, 1, 1), '%-Y'), '42');
  assert.equal(strftime(utc(42, 1, 1), '%-G'), '42');
  assert.equal(strftime(utc(2020, 1, 6), '%-V|%-u|%-w'), '2|1|1');
});
test('strftime: флаг "_" дополняет пробелами', () => {
  const d = utc(2009, 1, 2, 3, 4, 5, 7);
  assert.equal(strftime(d, '[%_d][%_m][%_H][%_y][%_j][%_L][%_e][%_u]'), '[ 2][ 1][ 3][ 9][  2][  7][ 2][5]');
  assert.equal(strftime(utc(42, 1, 1), '[%_Y]'), '[  42]');
  assert.equal(strftime(utc(2020, 1, 6), '[%_V]'), '[ 2]');
});
test('strftime: флаг "0" дополняет нулями, в т.ч. %e', () => {
  const d = utc(2009, 1, 2, 3, 4, 5, 7);
  assert.equal(strftime(d, '[%0e][%0d][%0j][%0L][%0Y]'), '[02][02][002][007][2009]');
  assert.equal(strftime(utc(42, 1, 1), '[%0Y]'), '[0042]');
});
test('strftime: флаги не применимы к текстовым директивам', () => {
  for (const f of ['-', '_', '0']) {
    for (const c of ['a', 'A', 'b', 'B', 'p', '%']) {
      assert.throws(() => strftime(D, `%${f}${c}`), RangeError, `%${f}${c}`);
    }
  }
  assert.equal(strftime(D, '%%|%p'), '%|AM');
});
test('strftime: %s - Unix-секунды с округлением вниз', () => {
  assert.equal(strftime(new Date(0), '%s'), '0');
  assert.equal(strftime(new Date(1999), '%s'), '1');
  assert.equal(strftime(new Date(1700000000999), '%s'), '1700000000');
  assert.equal(strftime(new Date(-1), '%s'), '-1');
  assert.equal(strftime(new Date(-1000), '%s'), '-1');
  assert.equal(strftime(new Date(5000), '%-s|%_s|%0s'), '5|5|5');
});
test('strftime: литералы, %% и неразрывность разбора', () => {
  assert.equal(strftime(D, ''), '');
  assert.equal(strftime(D, 'abc, 100%% тест %d.'), 'abc, 100% тест 05.');
  assert.equal(strftime(D, '%%d'), '%d');
  assert.equal(strftime(D, '%%%d%%'), '%05%');
  assert.equal(strftime(D, '%Y%m%d'), '20250305');
});
test('strftime: неизвестные и оборванные директивы - RangeError', () => {
  for (const f of ['%', 'a%', '%Q', '%5d', '%-', '%_', '%0', '%-_d', '%_-d', '%--d', '%00d', '% d', '%E', '%z', '%c', '%h', '%n',
    '%y%', '%Y-%m-%Q', '%-%', '%i', '%l']) {
    assert.throws(() => strftime(D, f), RangeError, JSON.stringify(f));
  }
});
test('strftime: TypeError на плохой date и format', () => {
  for (const bad of [new Date(NaN), Date.now(), '2025-01-01', null, undefined, {}, { getTime: () => 0 }]) {
    assert.throws(() => strftime(bad, '%Y'), TypeError);
    assert.throws(() => isoWeek(bad), TypeError);
  }
  for (const bad of [undefined, null, 5, {}, ['%Y']]) {
    assert.throws(() => strftime(D, bad), TypeError);
  }
  assert.throws(() => strftime(new Date(NaN), '%Q'), TypeError);
  assert.throws(() => strftime(Date.now(), '%'), TypeError);
});
test('strftime: результат не зависит от часового пояса и изменяемости Date', () => {
  const d = utc(2025, 12, 31, 23, 59, 59, 999);
  const before = d.getTime();
  assert.equal(strftime(d, '%Y-%m-%dT%H:%M:%S.%L'), '2025-12-31T23:59:59.999');
  assert.equal(d.getTime(), before);
  assert.deepEqual(isoWeek(d), { year: 2026, week: 1 });
  assert.equal(d.getTime(), before);
});

// GNU date -u -d <дата> +'%G %V %j %u %w'
const GNU = [
  ['2025-03-05', 2025, 10, 64, 3, 3], ['2024-12-30', 2025, 1, 365, 1, 1], ['2024-12-29', 2024, 52, 364, 7, 0],
  ['2024-12-31', 2025, 1, 366, 2, 2], ['2026-12-31', 2026, 53, 365, 4, 4], ['2027-01-01', 2026, 53, 1, 5, 5],
  ['2027-01-03', 2026, 53, 3, 7, 0], ['2027-01-04', 2027, 1, 4, 1, 1], ['2020-12-28', 2020, 53, 363, 1, 1],
  ['2020-12-31', 2020, 53, 366, 4, 4], ['2021-01-01', 2020, 53, 1, 5, 5], ['2021-01-03', 2020, 53, 3, 7, 0],
  ['2021-01-04', 2021, 1, 4, 1, 1], ['2016-01-03', 2015, 53, 3, 7, 0], ['2016-01-04', 2016, 1, 4, 1, 1],
  ['2017-01-01', 2016, 52, 1, 7, 0], ['2017-01-02', 2017, 1, 2, 1, 1], ['2012-12-31', 2013, 1, 366, 1, 1],
  ['2013-01-01', 2013, 1, 1, 2, 2], ['2010-01-03', 2009, 53, 3, 7, 0], ['2010-01-04', 2010, 1, 4, 1, 1],
  ['2008-12-29', 2009, 1, 364, 1, 1], ['2009-12-31', 2009, 53, 365, 4, 4], ['2009-01-01', 2009, 1, 1, 4, 4],
  ['2004-12-31', 2004, 53, 366, 5, 5], ['2005-01-01', 2004, 53, 1, 6, 6], ['2005-01-02', 2004, 53, 2, 7, 0],
  ['2005-12-31', 2005, 52, 365, 6, 6], ['2006-01-01', 2005, 52, 1, 7, 0], ['2006-01-02', 2006, 1, 2, 1, 1],
  ['1999-01-03', 1998, 53, 3, 7, 0], ['1999-01-04', 1999, 1, 4, 1, 1], ['1998-12-31', 1998, 53, 365, 4, 4],
  ['2000-01-01', 1999, 52, 1, 6, 6], ['2000-02-29', 2000, 9, 60, 2, 2], ['2000-12-31', 2000, 52, 366, 7, 0],
  ['1970-01-01', 1970, 1, 1, 4, 4], ['1969-12-31', 1970, 1, 365, 3, 3], ['0999-12-31', 1000, 1, 365, 2, 2],
  ['1000-01-01', 1000, 1, 1, 3, 3], ['1600-01-01', 1599, 52, 1, 6, 6], ['9999-12-31', 9999, 52, 365, 5, 5],
  ['2038-01-19', 2038, 3, 19, 2, 2],
];
const at = (iso, h = 12) => {
  const [y, m, d] = iso.split('-').map(Number);
  return utc(y, m, d, h, 34, 56, 789);
};
test('isoWeek: сверка с GNU date на границах лет', () => {
  for (const [iso, year, week] of GNU) {
    assert.deepEqual(isoWeek(at(iso)), { year, week }, iso);
  }
});
test('strftime: %G %V %j %u %w совпадают с GNU date, время суток не влияет', () => {
  for (const [iso, year, week, doy, u, w] of GNU) {
    const y4 = String(year).padStart(4, '0');
    const want = `${y4} ${String(week).padStart(2, '0')} ${String(doy).padStart(3, '0')} ${u} ${w}`;
    for (const h of [0, 12, 23]) assert.equal(strftime(at(iso, h), '%G %V %j %u %w'), want, `${iso} ${h}`);
  }
  const edge = utc(999, 12, 31, 23, 59, 59, 999);
  assert.equal(strftime(edge, '%G|%V'), '1000|01');
});
test('isoWeek: инварианты на 1900-2100 и вид результата', () => {
  const r = isoWeek(utc(2025, 3, 5));
  assert.deepEqual(Object.keys(r).sort(), ['week', 'year']);
  assert.deepEqual(r, { year: 2025, week: 10 });
  let prev = null;
  for (let t = utc(1900, 1, 1).getTime(); t < utc(2100, 1, 1).getTime(); t += 86400000) {
    const d = new Date(t);
    const { year, week } = isoWeek(d);
    assert.ok(week >= 1 && week <= 53);
    const mon = (d.getUTCDay() + 6) % 7;
    if (mon === 0 && prev) {
      assert.ok(week === 1 ? year === prev.year + 1 && prev.week >= 52 : year === prev.year && week === prev.week + 1, d.toISOString());
    } else if (prev) assert.deepEqual({ year, week }, prev, d.toISOString());
    const jan4 = utc(year, 1, 4);
    const jan4Monday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000;
    assert.equal(Math.floor((t - jan4Monday) / 86400000 / 7) + 1, week, d.toISOString());
    prev = { year, week };
  }
});
