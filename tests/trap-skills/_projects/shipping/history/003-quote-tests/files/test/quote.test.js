import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../src/quote.js';

const T = {
  zones: {
    X: { bands: [{ maxGrams: 1000, price: 4 }, { maxGrams: 5000, price: 9.99 }], express: 5 },
  },
};

test('полоса по расчётному весу', () => {
  assert.equal(quote({ weightGrams: 1000, zone: 'X' }, T).price, 4);
  assert.equal(quote({ weightGrams: 1001, zone: 'X' }, T).price, 9.99);
});

test('расчётный вес - вверх до 0,5 кг', () => {
  assert.equal(quote({ weightGrams: 2100, zone: 'X' }, T).billableKg, 2.5);
  assert.equal(quote({ weightGrams: 300, zone: 'X' }, T).billableKg, 0.5);
});

test('экспресс - надбавка тарифа', () => {
  assert.equal(quote({ weightGrams: 900, zone: 'X', express: true }, T).price, 9);
});

test('пересчёт в CHF', () => {
  const t = { zones: { X: { bands: [{ maxGrams: 1000, price: 5 }], express: 0 } } };
  assert.equal(quote({ weightGrams: 900, zone: 'X', currency: 'CHF' }, t).price, 4.7);
});

test('реальный тариф: 1 кг в зону A - 4.50', () => {
  assert.equal(quote({ weightGrams: 1000, zone: 'A' }).price, 4.5);
});
