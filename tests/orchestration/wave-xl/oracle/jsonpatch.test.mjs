import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { getPointer, applyPatch } = await load('src/jsonpatch.js');

const patch = (doc, ...ops) => applyPatch(doc, ops);
const failsWith = (cls, fn, label) => assert.throws(fn, (e) => e instanceof cls, label);

test('getPointer: примеры задания', () => {
  assert.equal(getPointer({ 'a/b': { 'm~n': 5 } }, '/a~1b/m~0n'), 5);
  assert.equal(getPointer({ '': 1 }, '/'), 1);
  failsWith(SyntaxError, () => getPointer([7], '/01'));
});
test('getPointer: пустой указатель - весь документ', () => {
  const doc = { a: 1 };
  assert.equal(getPointer(doc, ''), doc);
  assert.equal(getPointer(null, ''), null);
  assert.equal(getPointer(0, ''), 0);
});
test('getPointer: пустые токены и вложенность', () => {
  assert.equal(getPointer({ '': { '': 'x' } }, '//'), 'x');
  assert.deepEqual(getPointer({ a: [{ b: [10, 20] }] }, '/a/0/b'), [10, 20]);
  assert.equal(getPointer({ a: [{ b: [10, 20] }] }, '/a/0/b/1'), 20);
  assert.equal(getPointer({ '0': 'k' }, '/0'), 'k');
  assert.equal(getPointer({ a: null }, '/a'), null);
});
test('getPointer: escape за один проход', () => {
  assert.equal(getPointer({ '~1': 1, '/': 2, '~': 3 }, '/~01'), 1);
  assert.equal(getPointer({ '~1': 1, '/': 2, '~': 3 }, '/~1'), 2);
  assert.equal(getPointer({ '~1': 1, '/': 2, '~': 3 }, '/~0'), 3);
  assert.equal(getPointer({ '~/': 4 }, '/~0~1'), 4);
});
test('getPointer: неверный синтаксис - SyntaxError', () => {
  for (const bad of ['a', 'a/b', '/a~', '/a~2', '/~x', '/~', '/a/~1~']) {
    failsWith(SyntaxError, () => getPointer({ a: 1 }, bad), JSON.stringify(bad));
  }
});
test('getPointer: нет пути - RangeError', () => {
  failsWith(RangeError, () => getPointer({ a: 1 }, '/b'));
  failsWith(RangeError, () => getPointer({ a: 1 }, '/a/b'));
  failsWith(RangeError, () => getPointer({ a: null }, '/a/b'));
  failsWith(RangeError, () => getPointer('str', '/0'));
  failsWith(RangeError, () => getPointer({}, '/toString'));
  failsWith(RangeError, () => getPointer({ a: [1] }, '/a/1'));
  failsWith(RangeError, () => getPointer([1], '/99999999999999999999'));
  failsWith(RangeError, () => getPointer({ a: { b: 1 } }, '/x/y/z'));
});
test('getPointer: индексы массива - форма и "-"', () => {
  assert.equal(getPointer([5, 6], '/0'), 5);
  assert.equal(getPointer([5, 6], '/1'), 6);
  for (const bad of ['/01', '/00', '/+1', '/1.5', '/a', '/1e0', '/ 1', '/-1']) {
    failsWith(SyntaxError, () => getPointer([5, 6, 7], bad), bad);
  }
  failsWith(RangeError, () => getPointer([5, 6], '/-'));
  assert.equal(getPointer({ '-': 'dash' }, '/-'), 'dash');
});
test('applyPatch: add - объект, массив, корень', () => {
  assert.deepEqual(patch({ a: 1 }, { op: 'add', path: '/b', value: 2 }), { a: 1, b: 2 });
  assert.deepEqual(patch({ a: 1 }, { op: 'add', path: '/a', value: 2 }), { a: 2 });
  assert.deepEqual(patch({ a: [1, 2] }, { op: 'add', path: '/a/-', value: 3 }), { a: [1, 2, 3] });
  assert.deepEqual(patch([1, 2], { op: 'add', path: '/0', value: 0 }), [0, 1, 2]);
  assert.deepEqual(patch([1, 2], { op: 'add', path: '/1', value: 9 }), [1, 9, 2]);
  assert.deepEqual(patch([1, 2], { op: 'add', path: '/2', value: 3 }), [1, 2, 3]);
  assert.deepEqual(patch({ a: 1 }, { op: 'add', path: '', value: [1] }), [1]);
  assert.deepEqual(patch({}, { op: 'add', path: '/a', value: null }), { a: null });
  assert.deepEqual(patch({}, { op: 'add', path: '/', value: 1 }), { '': 1 });
});
test('applyPatch: add - ошибки', () => {
  failsWith(RangeError, () => patch([1, 2], { op: 'add', path: '/3', value: 0 }));
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'add', path: '/x/y', value: 0 }));
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'add', path: '/a/y', value: 0 }));
  failsWith(RangeError, () => patch({ a: [] }, { op: 'add', path: '/a/-/b', value: 0 }));
  failsWith(SyntaxError, () => patch([1], { op: 'add', path: '/01', value: 0 }));
  failsWith(SyntaxError, () => patch({}, { op: 'add', path: 'a', value: 0 }));
  failsWith(SyntaxError, () => patch({}, { op: 'add', path: '/a~2', value: 0 }));
});
test('applyPatch: remove и replace', () => {
  assert.deepEqual(patch({ a: 1, b: 2 }, { op: 'remove', path: '/a' }), { b: 2 });
  assert.deepEqual(patch([1, 2, 3], { op: 'remove', path: '/0' }), [2, 3]);
  assert.deepEqual(patch({ a: 1 }, { op: 'replace', path: '/a', value: [2] }), { a: [2] });
  assert.deepEqual(patch([1, 2], { op: 'replace', path: '/1', value: 5 }), [1, 5]);
  assert.deepEqual(patch({ a: 1 }, { op: 'replace', path: '', value: 7 }), 7);
  for (const op of ['remove', 'replace']) {
    const o = { op, value: 0 };
    failsWith(RangeError, () => patch({ a: 1 }, { ...o, path: '/b' }), op);
    failsWith(RangeError, () => patch([1], { ...o, path: '/1' }), op);
    failsWith(RangeError, () => patch([1], { ...o, path: '/-' }), op);
    failsWith(RangeError, () => patch({ a: 1 }, { ...o, path: '/a/b' }), op);
    failsWith(SyntaxError, () => patch([1], { ...o, path: '/00' }), op);
  }
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'remove', path: '' }));
});
test('applyPatch: move', () => {
  assert.deepEqual(patch({ a: 1, b: {} }, { op: 'move', from: '/a', path: '/b/c' }), { b: { c: 1 } });
  assert.deepEqual(patch([1, 2, 3], { op: 'move', from: '/0', path: '/2' }), [2, 3, 1]);
  assert.deepEqual(patch([1, 2, 3], { op: 'move', from: '/2', path: '/0' }), [3, 1, 2]);
  assert.deepEqual(patch([1, 2, 3], { op: 'move', from: '/0', path: '/-' }), [2, 3, 1]);
  assert.deepEqual(patch({ a: 1 }, { op: 'move', from: '/a', path: '/a' }), { a: 1 });
  assert.deepEqual(patch({ a: 1 }, { op: 'move', from: '/a', path: '/ab' }), { ab: 1 });
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'move', from: '/x', path: '/x' }));
  failsWith(RangeError, () => patch([1, 2], { op: 'move', from: '/0', path: '/2' }));
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'move', from: '/x', path: '/y' }));
  failsWith(SyntaxError, () => patch({ a: 1 }, { op: 'move', from: 'a', path: '/y' }));
});
test('applyPatch: move в собственного потомка - RangeError', () => {
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'move', from: '/a', path: '/a/b' }));
  failsWith(RangeError, () => patch({ a: { b: {} } }, { op: 'move', from: '/a', path: '/a/b/c' }));
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'move', from: '', path: '/a' }));
});
test('applyPatch: copy - глубокая копия', () => {
  assert.deepEqual(patch({ a: { x: 1 } }, { op: 'copy', from: '/a', path: '/a/b' }), { a: { x: 1, b: { x: 1 } } });
  assert.deepEqual(patch([1, 2], { op: 'copy', from: '/0', path: '/-' }), [1, 2, 1]);
  const res = patch({ a: { x: [1] } }, { op: 'copy', from: '/a', path: '/b' });
  assert.notEqual(res.a, res.b);
  assert.notEqual(res.a.x, res.b.x);
  res.b.x.push(2);
  assert.deepEqual(res.a.x, [1]);
  failsWith(RangeError, () => patch({ a: 1 }, { op: 'copy', from: '/z', path: '/b' }));
});
test('applyPatch: test - глубокое равенство', () => {
  const doc = { a: { x: 1, y: [1, { z: null }] }, n: 0 };
  assert.deepEqual(patch(doc, { op: 'test', path: '/a', value: { y: [1, { z: null }], x: 1 } }), doc);
  assert.deepEqual(patch(doc, { op: 'test', path: '', value: { n: 0, a: { x: 1, y: [1, { z: null }] } } }), doc);
  assert.deepEqual(patch(doc, { op: 'test', path: '/a/y/1/z', value: null }), doc);
  for (const [path, value] of [['/n', '0'], ['/n', null], ['/a/y', [{ z: null }, 1]], ['/a', { x: 1 }],
    ['/a/x', true], ['/a/y', [1, { z: null }, 2]], ['/a', { x: 1, y: [1, { z: null }], w: 1 }]]) {
    assert.throws(() => patch(doc, { op: 'test', path, value }), (e) => e.name === 'TestFailed', path);
  }
  failsWith(RangeError, () => patch(doc, { op: 'test', path: '/nope', value: 1 }));
  assert.throws(() => patch(doc, { op: 'test', path: '/n', value: 1 }),
    (e) => e instanceof Error && !(e instanceof RangeError) && !(e instanceof TypeError));
});
test('applyPatch: форма операций - TypeError', () => {
  const bad = [
    {}, { op: 'add', path: '/a' }, { op: 'add', value: 1 }, { op: 'noop', path: '' }, { op: 'ADD', path: '/a', value: 1 },
    { op: 'remove' }, { op: 'replace', path: '/a' }, { op: 'test', path: '/a' }, { op: 'move', path: '/a' },
    { op: 'copy', path: '/a' }, { op: 'move', from: 1, path: '/a' }, { op: 'add', path: 5, value: 1 },
    null, 'add', [], 7,
  ];
  for (const op of bad) failsWith(TypeError, () => applyPatch({ a: 1 }, [op]), JSON.stringify(op));
  for (const ops of [null, undefined, {}, 'x', { op: 'remove', path: '/a' }]) {
    failsWith(TypeError, () => applyPatch({ a: 1 }, ops), String(ops));
  }
  assert.deepEqual(patch({ a: 1 }, { op: 'remove', path: '/a', value: 9, from: 'zz', extra: 1 }), {});
});
test('applyPatch: пустой патч, не мутирует вход, нет общих ссылок', () => {
  const doc = { a: [1, { b: 2 }], c: { d: 3 } };
  const snapshot = structuredClone(doc);
  const same = applyPatch(doc, []);
  assert.deepEqual(same, snapshot);
  assert.notEqual(same, doc);
  assert.notEqual(same.a, doc.a);
  assert.notEqual(same.a[1], doc.a[1]);
  const value = { v: [1] };
  const ops = [{ op: 'add', path: '/e', value }, { op: 'remove', path: '/a/0' }, { op: 'move', from: '/c', path: '/f' },
    { op: 'replace', path: '/f/d', value: 4 }];
  const opsSnap = structuredClone(ops);
  const res = applyPatch(doc, ops);
  assert.deepEqual(doc, snapshot);
  assert.deepEqual(ops, opsSnap);
  assert.deepEqual(res, { a: [{ b: 2 }], e: { v: [1] }, f: { d: 4 } });
  assert.notEqual(res.e, value);
  res.e.v.push(2);
  res.a[0].b = 9;
  assert.deepEqual(value, { v: [1] });
  assert.deepEqual(doc, snapshot);
});
test('applyPatch: атомарность и порядок операций', () => {
  const doc = { a: [1, 2], b: 1 };
  const snapshot = structuredClone(doc);
  const ops = [{ op: 'add', path: '/a/-', value: 3 }, { op: 'remove', path: '/b' }, { op: 'remove', path: '/b' }];
  failsWith(RangeError, () => applyPatch(doc, ops));
  assert.deepEqual(doc, snapshot);
  assert.throws(() => applyPatch(doc, [{ op: 'remove', path: '/b' }, { op: 'test', path: '/a/0', value: 5 },
    { op: 'bogus', path: '' }]), (e) => e.name === 'TestFailed');
  assert.throws(() => applyPatch(doc, [{ op: 'add', path: '/x/y', value: 1 }, { op: 'bogus', path: '' }]),
    (e) => e instanceof RangeError);
  assert.deepEqual(doc, snapshot);
  assert.deepEqual(patch({ a: 1 }, { op: 'add', path: '/l', value: [] }, { op: 'add', path: '/l/-', value: 'x' },
    { op: 'test', path: '/l/0', value: 'x' }, { op: 'replace', path: '/a', value: 2 }), { a: 2, l: ['x'] });
  assert.deepEqual(patch([1], { op: 'add', path: '/-', value: 2 }, { op: 'add', path: '/-', value: 3 }), [1, 2, 3]);
});
