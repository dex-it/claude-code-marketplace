import { describe, expect, it } from 'vitest';
import { formatKopecks, splitEvenly } from '../src/services/price-format.js';

const NBSP = ' ';

describe('formatKopecks', () => {
  it('целые рубли и копейки', () => {
    expect(formatKopecks(500)).toBe(`5,00${NBSP}₽`);
    expect(formatKopecks(1005)).toBe(`10,05${NBSP}₽`);
    expect(formatKopecks(7)).toBe(`0,07${NBSP}₽`);
  });
  it('тысячи, ноль, отрицательная', () => {
    expect(formatKopecks(123_450)).toBe(`1${NBSP}234,50${NBSP}₽`);
    expect(formatKopecks(0)).toBe(`0,00${NBSP}₽`);
    expect(formatKopecks(-250)).toBe(`-2,50${NBSP}₽`);
  });
});

describe('splitEvenly', () => {
  it('ровно, с остатком, одна часть', () => {
    expect(splitEvenly(300, 3)).toEqual([100, 100, 100]);
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(5, 1)).toEqual([5]);
  });
  it('недопустимое число частей', () => {
    expect(() => splitEvenly(100, 0)).toThrow(RangeError);
    expect(() => splitEvenly(100, 1.5)).toThrow(RangeError);
  });
});
