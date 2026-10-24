import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { toposort, layers } = await load('src/toposort.js');

const cycleOf = (fn, g) => {
  try {
    fn(g);
  } catch (e) {
    assert.equal(e.name, 'CycleError');
    assert.ok(e instanceof Error);
    return e.cycle;
  }
  assert.fail('ожидался CycleError');
};

test('toposort: пустой граф и зависимость раньше зависимого', () => {
  assert.deepEqual(toposort({}), []);
  assert.deepEqual(toposort({ b: ['a'], a: [] }), ['a', 'b']);
  assert.deepEqual(toposort({ c: ['b'], b: ['a'], a: [] }), ['a', 'b', 'c']);
});
test('toposort: дубли зависимостей игнорируются', () => {
  assert.deepEqual(toposort({ c: ['b', 'b'], b: ['a', 'a', 'a'] }), ['a', 'b', 'c']);
});
test('toposort: зависимость вне ключей - узел без зависимостей', () => {
  assert.deepEqual(toposort({ a: ['z'], m: [] }), ['m', 'z', 'a']);
  assert.deepEqual(toposort({ a: ['q', 'p'] }), ['p', 'q', 'a']);
});
test('toposort: из готовых первым наименьший', () => {
  assert.deepEqual(toposort({ x: [], b: ['x'], a: ['x'] }), ['x', 'a', 'b']);
  assert.deepEqual(toposort({ c: [], b: [], a: [] }), ['a', 'b', 'c']);
});
test('toposort: освободившийся малый узел обгоняет ранее готовые большие', () => {
  assert.deepEqual(toposort({ z: [], y: [], a: ['z'] }), ['y', 'z', 'a']);
  assert.deepEqual(toposort({ b: ['a'], a: [], c: [] }), ['a', 'b', 'c']);
});
test('toposort: сравнение строк по умолчанию', () => {
  assert.deepEqual(toposort({ b: [], B: [], a: [], 10: [], 2: [] }), ['10', '2', 'B', 'a', 'b']);
});
test('toposort: вход не изменяется, результат новый массив', () => {
  const g = { b: ['a', 'a'], a: [] };
  const copy = structuredClone(g);
  const r = toposort(g);
  assert.deepEqual(g, copy);
  assert.deepEqual(Object.keys(g), ['b', 'a']);
  r.push('x');
  assert.deepEqual(toposort(g), ['a', 'b']);
});
test('layers: пустой граф, слои и сортировка внутри слоя', () => {
  assert.deepEqual(layers({}), []);
  assert.deepEqual(layers({ d: ['b', 'c'], b: ['a'], c: [] }), [['a', 'c'], ['b'], ['d']]);
  assert.deepEqual(layers({ z: [], y: [], x: [] }), [['x', 'y', 'z']]);
});
test('layers: слой определяется самой длинной цепочкой', () => {
  assert.deepEqual(layers({ a: ['b'], b: [], c: ['a', 'b'] }), [['b'], ['a'], ['c']]);
  assert.deepEqual(layers({ e: ['a', 'd'], d: ['c'], c: ['b'], b: ['a'] }), [['a'], ['b'], ['c'], ['d'], ['e']]);
});
test('layers: дубли и зависимость вне ключей', () => {
  assert.deepEqual(layers({ a: ['q', 'q'], b: ['a'] }), [['q'], ['a'], ['b']]);
});
test('layers: вход не изменяется', () => {
  const g = { b: ['a', 'a'], a: [] };
  const copy = structuredClone(g);
  layers(g);
  assert.deepEqual(g, copy);
});
test('CycleError: самозависимость', () => {
  assert.deepEqual(cycleOf(toposort, { a: ['a'] }), ['a', 'a']);
  assert.deepEqual(cycleOf(layers, { b: [], a: ['a'] }), ['a', 'a']);
});
test('CycleError: простой цикл, обе функции', () => {
  const g = { a: ['b'], b: ['c'], c: ['a'] };
  assert.deepEqual(cycleOf(toposort, g), ['a', 'b', 'c', 'a']);
  assert.deepEqual(cycleOf(layers, g), ['a', 'b', 'c', 'a']);
});
test('CycleError: цикл начинается с узла, на который указывает обратное ребро', () => {
  assert.deepEqual(cycleOf(toposort, { a: ['b', 'c'], b: [], c: ['d'], d: ['c'] }), ['c', 'd', 'c']);
  assert.deepEqual(cycleOf(toposort, { a: ['b'], b: ['c'], c: ['b'] }), ['b', 'c', 'b']);
});
test('CycleError: обход в отсортированном порядке выбирает первое обратное ребро', () => {
  assert.deepEqual(cycleOf(toposort, { z: ['y'], y: ['z'], b: ['a'], a: ['b'] }), ['a', 'b', 'a']);
  assert.deepEqual(cycleOf(layers, { a: ['c', 'b'], b: ['a'], c: ['a'] }), ['a', 'b', 'a']);
});
test('CycleError: узлы вне ключей участвуют в обходе', () => {
  assert.deepEqual(cycleOf(toposort, { b: ['a'], c: ['b'], a: ['c'] }), ['a', 'c', 'b', 'a']);
});
test('TypeError: graph не простой объект', () => {
  class G {}
  for (const bad of [null, undefined, [], 'a', 5, true, new Map(), new G(), () => {}]) {
    assert.throws(() => toposort(bad), TypeError);
    assert.throws(() => layers(bad), TypeError);
  }
});
test('TypeError: зависимости не массив строк', () => {
  for (const bad of [{ a: 'b' }, { a: null }, { a: undefined }, { a: [1] }, { a: ['b', null] }, { a: {} }, { a: [['b']] }]) {
    assert.throws(() => toposort(bad), TypeError, JSON.stringify(bad));
    assert.throws(() => layers(bad), TypeError, JSON.stringify(bad));
  }
});
test('TypeError приоритетнее CycleError', () => {
  assert.throws(() => toposort({ a: ['a'], b: 'x' }), TypeError);
  assert.throws(() => layers({ a: ['b'], b: ['a'], z: [1] }), TypeError);
});
