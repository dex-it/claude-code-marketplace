import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { evaluate } = await load('src/expr.js');

const syn = (text, pos, vars) => {
  assert.throws(
    () => evaluate(text, vars),
    (e) => e instanceof SyntaxError && e.pos === pos,
    `${JSON.stringify(text)} -> pos ${pos}`,
  );
};

test('примеры задания', () => {
  assert.equal(evaluate('2 + 3*4'), 14);
  assert.equal(evaluate('max(1, x*2) % 3', { x: 2 }), 1);
  syn('(1', 2);
  assert.throws(() => evaluate('1/(2-2)'), RangeError);
});
test('числа: форматы и экспонента', () => {
  assert.equal(evaluate('12'), 12);
  assert.equal(evaluate('1.5'), 1.5);
  assert.equal(evaluate('.5'), 0.5);
  assert.equal(evaluate('1e3'), 1000);
  assert.equal(evaluate('2.5E-1'), 0.25);
  assert.equal(evaluate('1E+2'), 100);
  assert.equal(evaluate('0.25'), 0.25);
});
test('числа: недопустимые формы - SyntaxError с pos', () => {
  syn('1.', 1);
  syn('1e', 1);
  syn('1e+', 1);
  syn('.', 0);
  syn('2x', 1, { x: 1 });
  syn('1e3x', 3, { x: 1 });
});
test('пробелы игнорируются и разделяют токены', () => {
  assert.equal(evaluate(' \t1 +\n 2\r* 3 '), 7);
  assert.equal(evaluate('- 2'), -2);
  assert.equal(evaluate('max (1, 5)'), 5);
  syn('1 2', 2);
  syn('1 .5', 2);
});
test('переменные: поиск, регистр, собственные свойства', () => {
  assert.equal(evaluate('x + y_1', { x: 1, y_1: 2 }), 3);
  assert.equal(evaluate('_a', { _a: 4 }), 4);
  assert.equal(evaluate('min', { min: 7 }), 7);
  assert.throws(() => evaluate('X', { x: 1 }), ReferenceError);
  assert.throws(() => evaluate('x'), ReferenceError);
  assert.throws(() => evaluate('toString'), ReferenceError);
  assert.throws(() => evaluate('constructor + 1', {}), ReferenceError);
});
test('приоритет и левая ассоциативность', () => {
  assert.equal(evaluate('2 + 3 * 4 - 1'), 13);
  assert.equal(evaluate('10 - 4 - 3'), 3);
  assert.equal(evaluate('64 / 4 / 2'), 8);
  assert.equal(evaluate('(2 + 3) * 4'), 20);
  assert.equal(evaluate('7 % 4 * 2'), 6);
  assert.equal(evaluate('2 * 3 % 4'), 2);
  assert.equal(evaluate('((((5))))'), 5);
});
test('степень: правая ассоциативность и связь с унарным знаком', () => {
  assert.equal(evaluate('2^3^2'), 512);
  assert.equal(evaluate('-2^2'), -4);
  assert.equal(evaluate('(-2)^2'), 4);
  assert.equal(evaluate('2^-1'), 0.5);
  assert.equal(evaluate('2^-3^2'), 2 ** -9);
  assert.equal(evaluate('2^+3'), 8);
  assert.equal(evaluate('-2^-2'), -0.25);
  assert.equal(evaluate('2*3^2'), 18);
  assert.equal(evaluate('0^0'), 1);
  assert.equal(evaluate('4^0.5'), 2);
});
test('унарные знаки цепочкой', () => {
  assert.equal(evaluate('--2'), 2);
  assert.equal(evaluate('+-+2'), -2);
  assert.equal(evaluate('2*-3'), -6);
  assert.equal(evaluate('2--3'), 5);
  assert.equal(evaluate('-2*3'), -6);
  assert.equal(evaluate('-(1+2)'), -3);
});
test('остаток: знак делимого, дробные', () => {
  assert.equal(evaluate('7 % 3'), 1);
  assert.equal(evaluate('-7 % 3'), -1);
  assert.equal(evaluate('7 % -3'), 1);
  assert.equal(evaluate('5.5 % 2'), 1.5);
});
test('-0 в итоге возвращается как 0', () => {
  assert.equal(evaluate('-0'), 0);
  assert.equal(evaluate('round(-0.4)'), 0);
  assert.equal(evaluate('0 * -1'), 0);
});
test('функции: min, max, abs, round', () => {
  assert.equal(evaluate('min(3)'), 3);
  assert.equal(evaluate('min(3, 1, 2)'), 1);
  assert.equal(evaluate('max(3, 1, 2)'), 3);
  assert.equal(evaluate('max(-1, -5)'), -1);
  assert.equal(evaluate('abs(-4.5)'), 4.5);
  assert.equal(evaluate('round(2.5)'), 3);
  assert.equal(evaluate('round(-2.5)'), -2);
  assert.equal(evaluate('round(2.4)'), 2);
  assert.equal(evaluate('max(min(1, 2), abs(-3)) + round(0.5)'), 4);
  assert.equal(evaluate('max((1), (2))'), 2);
});
test('ReferenceError: неизвестная функция, регистр, имя не вызов', () => {
  assert.throws(() => evaluate('foo(1)'), ReferenceError);
  assert.throws(() => evaluate('Max(1)'), ReferenceError);
  assert.throws(() => evaluate('x(1)', { x: 5 }), ReferenceError);
  assert.throws(() => evaluate('sqrt(4)'), ReferenceError);
  assert.throws(() => evaluate('foo()'), ReferenceError);
});
test('TypeError: число аргументов', () => {
  for (const bad of ['abs()', 'abs(1, 2)', 'round()', 'round(1, 2)', 'min()', 'max()']) {
    assert.throws(() => evaluate(bad), TypeError, bad);
  }
});
test('RangeError: деление и остаток на нуль', () => {
  for (const bad of ['1/0', '0/0', '5 % 0', '1/(3-3)', '1/-0', '1/round(0.2)', '2 % (1-1)']) {
    assert.throws(() => evaluate(bad), RangeError, bad);
  }
  assert.equal(evaluate('0/5'), 0);
});
test('RangeError: не конечные числа', () => {
  for (const bad of ['1e999', '10^400', '0^-1', '(-8)^0.5', '1e308*10', '-1e999', 'max(1e999, 1)']) {
    assert.throws(() => evaluate(bad), RangeError, bad);
  }
  assert.equal(evaluate('1e308'), 1e308);
});
test('приоритет ошибок: синтаксис главнее, затем порядок вычисления', () => {
  assert.throws(() => evaluate('1/0 + y'), RangeError);
  assert.throws(() => evaluate('y + 1/0'), ReferenceError);
  assert.throws(() => evaluate('0 * y'), ReferenceError);
  assert.throws(() => evaluate('1/0 + (1'), SyntaxError);
  assert.throws(() => evaluate('foo(1/0)'), ReferenceError);
  assert.throws(() => evaluate('abs(1/0, 2)'), RangeError);
  assert.throws(() => evaluate('abs(y, 2)'), ReferenceError);
  assert.throws(() => evaluate('abs(1, 2) + y'), TypeError);
  assert.throws(() => evaluate('min() + 1/0'), TypeError);
});
test('SyntaxError: пустой ввод и конец ввода', () => {
  syn('', 0);
  syn('   ', 3);
  syn('1 +', 3);
  syn('1 + ', 4);
  syn('-', 1);
  syn('2^', 2);
  syn('max(', 4);
  syn('(1', 2);
  syn('max(1, 2', 8);
  syn('((1)', 4);
});
test('SyntaxError: лишний и неожиданный токен', () => {
  syn('2 * * 3', 4);
  syn('()', 1);
  syn('(1,2)', 2);
  syn('1,2', 1);
  syn('* 1', 0);
  syn('1 + #', 4);
  syn('1 # 2', 2);
  syn('a$', 1, { a: 1 });
  syn('1 +* 2', 3);
  syn('2 ^ ^ 2', 4);
});
test('SyntaxError: скобки и вызовы', () => {
  syn('1)', 1);
  syn('(1))', 3);
  syn(')', 0);
  syn('max(1,)', 6);
  syn('max(,1)', 4);
  syn('max(1 2)', 6);
  syn('max(1,,2)', 6);
  syn('2(3)', 1);
  syn('(1)(2)', 3);
  syn('1 2 #', 2);
  syn('x y', 2, { x: 1, y: 2 });
});
test('SyntaxError: ошибка разбора раньше ошибки вычисления, pos с пробелами', () => {
  syn('  1 +  *', 7);
  syn('  (  1 ', 7);
  syn('foo(1,)', 6);
  syn('abs(1/0 2)', 8);
});
