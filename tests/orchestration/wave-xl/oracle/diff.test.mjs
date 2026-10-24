import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { diffLines, unifiedDiff } = await load('src/diff.js');

const fmt = (ops) => ops.map((o) => `${o.op[0]}:${o.line}`);
const lines = (s) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'));
const nums = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const text = (arr) => arr.map((l) => `${l}\n`).join('');

test('diffLines: примеры задания', () => {
  assert.deepEqual(diffLines('a\nb', 'a\nc'), [
    { op: 'equal', line: 'a' },
    { op: 'delete', line: 'b' },
    { op: 'insert', line: 'c' },
  ]);
  assert.deepEqual(fmt(diffLines('a\nb', 'b\na')), ['i:b', 'e:a', 'd:b']);
  assert.deepEqual(diffLines('', 'x\n'), [{ op: 'insert', line: 'x' }]);
  assert.deepEqual(diffLines('x\n', 'x'), [{ op: 'equal', line: 'x' }]);
});

test('diffLines: разбиение на строки', () => {
  assert.deepEqual(diffLines('', ''), []);
  assert.deepEqual(fmt(diffLines('\n', '')), ['d:']);
  assert.deepEqual(fmt(diffLines('', '\n')), ['i:']);
  assert.deepEqual(fmt(diffLines('a\n\n', 'a\n')), ['e:a', 'd:']);
  assert.deepEqual(fmt(diffLines('a\r\nb', 'a\nb')), ['d:a\r', 'i:a', 'e:b']);
  assert.deepEqual(fmt(diffLines('a\nb\n', 'a\nb')), ['e:a', 'e:b']);
});

test('diffLines: пустая сторона', () => {
  assert.deepEqual(fmt(diffLines('a\nb\n', '')), ['d:a', 'd:b']);
  assert.deepEqual(fmt(diffLines('', 'a\nb\n')), ['i:a', 'i:b']);
});

test('diffLines: равные тексты - только equal', () => {
  assert.deepEqual(fmt(diffLines('a\nb\nc', 'a\nb\nc\n')), ['e:a', 'e:b', 'e:c']);
});

test('diffLines: ничья - insert раньше delete, сохраняется ранняя строка a', () => {
  assert.deepEqual(fmt(diffLines('a\nb', 'b\na')), ['i:b', 'e:a', 'd:b']);
  assert.deepEqual(fmt(diffLines('a\nb\nc', 'c\nb\na')), ['i:c', 'i:b', 'e:a', 'd:b', 'd:c']);
  assert.deepEqual(fmt(diffLines('x\ny\nx', 'x')), ['e:x', 'd:y', 'd:x']);
  assert.deepEqual(fmt(diffLines('x', 'x\ny\nx')), ['e:x', 'i:y', 'i:x']);
});

test('diffLines: в блоке изменений все delete перед insert', () => {
  assert.deepEqual(fmt(diffLines('x\ny', 'p\nq')), ['d:x', 'd:y', 'i:p', 'i:q']);
  assert.deepEqual(fmt(diffLines('k\nx\ny\nz', 'k\np\nq\nz')), ['e:k', 'd:x', 'd:y', 'i:p', 'i:q', 'e:z']);
  assert.deepEqual(fmt(diffLines('a\nb\nc', 'c\nd\na')), ['i:c', 'i:d', 'e:a', 'd:b', 'd:c']);
});

test('diffLines: два блока изменений раздельно', () => {
  assert.deepEqual(
    fmt(diffLines('a\nb\nc\nd\ne', 'a\nB\nc\nD\ne')),
    ['e:a', 'd:b', 'i:B', 'e:c', 'd:d', 'i:D', 'e:e'],
  );
});

test('diffLines: свойства на случайных входах - восстановление, минимальность, правило ничьей', () => {
  let seed = 12345;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const lcsLen = (x, y) => {
    const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    return L;
  };
  const expected = (x, y) => {
    const L = lcsLen(x, y);
    const raw = [];
    let i = 0;
    let j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) { raw.push(['equal', x[i]]); i++; j++; }
      else if (j < y.length && (i === x.length || L[i][j + 1] >= L[i + 1][j])) raw.push(['insert', y[j++]]);
      else raw.push(['delete', x[i++]]);
    }
    const out = [];
    for (let k = 0; k < raw.length;) {
      if (raw[k][0] === 'equal') { out.push(raw[k++]); continue; }
      let e = k;
      while (e < raw.length && raw[e][0] !== 'equal') e++;
      const blk = raw.slice(k, e);
      out.push(...blk.filter((o) => o[0] === 'delete'), ...blk.filter((o) => o[0] === 'insert'));
      k = e;
    }
    return out;
  };
  for (let t = 0; t < 300; t++) {
    const x = Array.from({ length: rnd(9) }, () => 'abc'[rnd(3)]);
    const y = Array.from({ length: rnd(9) }, () => 'abc'[rnd(3)]);
    const ops = diffLines(text(x), text(y));
    assert.deepEqual(ops.filter((o) => o.op !== 'insert').map((o) => o.line), x);
    assert.deepEqual(ops.filter((o) => o.op !== 'delete').map((o) => o.line), y);
    assert.equal(ops.filter((o) => o.op === 'equal').length, lcsLen(x, y)[0][0]);
    assert.deepEqual(ops.map((o) => [o.op, o.line]), expected(x, y), `${x} | ${y}`);
  }
});

test('diffLines: не строка - TypeError', () => {
  for (const bad of [undefined, null, 1, ['a'], {}]) {
    assert.throws(() => diffLines(bad, 'a'), TypeError);
    assert.throws(() => diffLines('a', bad), TypeError);
  }
});

test('unifiedDiff: примеры задания', () => {
  assert.equal(unifiedDiff('a\nb\nc\n', 'a\nX\nc\n'), '--- a\n+++ b\n@@ -1,3 +1,3 @@\n a\n-b\n+X\n c\n');
  assert.equal(unifiedDiff('x', 'x\n'), '');
  assert.equal(unifiedDiff('', 'p\nq\n'), '--- a\n+++ b\n@@ -0,0 +1,2 @@\n+p\n+q\n');
  assert.equal(unifiedDiff('p\nq\n', ''), '--- a\n+++ b\n@@ -1,2 +0,0 @@\n-p\n-q\n');
});

test('unifiedDiff: равные тексты - пустая строка, метки не выводятся', () => {
  assert.equal(unifiedDiff('', ''), '');
  assert.equal(unifiedDiff('a\nb\n', 'a\nb\n', { fromFile: 'x', toFile: 'y', context: 0 }), '');
});

test('unifiedDiff: fromFile и toFile', () => {
  assert.equal(
    unifiedDiff('a\n', 'b\n', { fromFile: 'old.txt', toFile: 'new.txt' }),
    '--- old.txt\n+++ new.txt\n@@ -1 +1 @@\n-a\n+b\n',
  );
  assert.equal(unifiedDiff('a\n', 'b\n', { toFile: 'n' }), '--- a\n+++ n\n@@ -1 +1 @@\n-a\n+b\n');
});

test('unifiedDiff: context 0 и заголовок с единичной длиной', () => {
  assert.equal(unifiedDiff(text(nums(5)), '1\n2\nX\n4\n5\n', { context: 0 }), '--- a\n+++ b\n@@ -3 +3 @@\n-3\n+X\n');
  assert.equal(unifiedDiff('a\nb\nc\n', 'a\nc\n', { context: 0 }), '--- a\n+++ b\n@@ -2 +1,0 @@\n-b\n');
  assert.equal(unifiedDiff('a\nc\n', 'a\nb\nc\n', { context: 0 }), '--- a\n+++ b\n@@ -1,0 +2 @@\n+b\n');
  assert.equal(unifiedDiff('a\nb\nc\nd\n', 'a\nd\n', { context: 0 }), '--- a\n+++ b\n@@ -2,2 +1,0 @@\n-b\n-c\n');
});

test('unifiedDiff: контекст по умолчанию 3 и усечение по краям текста', () => {
  const a = text(nums(10));
  const b = text(nums(10).map((l) => (l === '5' ? 'X' : l)));
  const exp = '--- a\n+++ b\n@@ -2,7 +2,7 @@\n 2\n 3\n 4\n-5\n+X\n 6\n 7\n 8\n';
  assert.equal(unifiedDiff(a, b), exp);
  assert.equal(unifiedDiff(a, b, {}), exp);
  assert.equal(unifiedDiff(a, b, { context: undefined }), exp);
  assert.equal(unifiedDiff(a, b, { context: 1 }), '--- a\n+++ b\n@@ -4,3 +4,3 @@\n 4\n-5\n+X\n 6\n');
  assert.equal(unifiedDiff('a\nb\n', 'a\nc\n', { context: 50 }), '--- a\n+++ b\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n');
});

test('unifiedDiff: слияние и разделение ханков по порогу 2 * context', () => {
  const a = text(nums(9));
  const b = '1\nA\n3\n4\n5\n6\n7\nB\n9\n';
  const two = unifiedDiff(a, b, { context: 2, fromFile: 'o', toFile: 'n' });
  assert.equal(
    two,
    '--- o\n+++ n\n@@ -1,4 +1,4 @@\n 1\n-2\n+A\n 3\n 4\n@@ -6,4 +6,4 @@\n 6\n 7\n-8\n+B\n 9\n',
  );
  assert.equal(
    unifiedDiff(a, b, { context: 3 }),
    '--- a\n+++ b\n@@ -1,9 +1,9 @@\n 1\n-2\n+A\n 3\n 4\n 5\n 6\n 7\n-8\n+B\n 9\n',
  );
  assert.equal(unifiedDiff(a, b, { context: 1 }).split('\n').filter((l) => l.startsWith('@@')).length, 2);
  assert.equal(unifiedDiff(a, '1\nA\n3\n4\nB\n6\n7\n8\n9\n', { context: 1 }).split('\n').filter((l) => l.startsWith('@@')).length, 1);
});

test('unifiedDiff: номера строк второго ханка после вставок и удалений', () => {
  const a = text(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  const b = text(['a', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
  assert.equal(
    unifiedDiff(a, b, { context: 1 }),
    '--- a\n+++ b\n@@ -1,3 +1,2 @@\n a\n-b\n c\n@@ -10 +9,3 @@\n j\n+k\n+l\n',
  );
});

test('unifiedDiff: пустые строки и пробелы в строках', () => {
  assert.equal(
    unifiedDiff('x\n\ny\n', 'x\n  \ny\n', { context: 1 }),
    '--- a\n+++ b\n@@ -1,3 +1,3 @@\n x\n-\n+  \n y\n',
  );
  assert.equal(unifiedDiff('x\n\ny\n', 'x\ny\nz\n', { context: 0 }), '--- a\n+++ b\n@@ -2 +1,0 @@\n-\n@@ -3,0 +3 @@\n+z\n');
});

test('unifiedDiff: недопустимый context - RangeError, даже при равных текстах', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, '2', null, true]) {
    assert.throws(() => unifiedDiff('a\n', 'b\n', { context: bad }), RangeError, String(bad));
    assert.throws(() => unifiedDiff('a\n', 'a\n', { context: bad }), RangeError, String(bad));
  }
});

test('unifiedDiff: недопустимые аргументы - TypeError', () => {
  assert.throws(() => unifiedDiff(1, 'a'), TypeError);
  assert.throws(() => unifiedDiff('a', null), TypeError);
  assert.throws(() => unifiedDiff('a', 'b', null), TypeError);
  assert.throws(() => unifiedDiff('a', 'b', 5), TypeError);
  assert.throws(() => unifiedDiff('a', 'b', 'ctx'), TypeError);
});
