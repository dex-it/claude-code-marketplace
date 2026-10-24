import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { render } = await load('src/template.js');

const syntax = (tpl, offset, data = {}) =>
  assert.throws(() => render(tpl, data), (e) => e instanceof SyntaxError && e.offset === offset, JSON.stringify(tpl));

test('фильтры: примеры задания', () => {
  assert.equal(render('{{ n | upper }}!', { n: '<b>' }), '&lt;B&gt;!');
  assert.equal(render('{{{ n | upper }}}', { n: '<b>' }), '<B>');
  assert.equal(render('{{ x | default "n/a" | upper }}', { x: '' }), 'N/A');
  assert.equal(render('{{ xs | join ", " }}', { xs: ['a', 1, null] }), 'a, 1, ');
  assert.equal(render('{{ t | date "%Y-%m-%d" }}', { t: 86400000 }), '1970-01-02');
  assert.equal(render('{{ s | wrap 5 }}', { s: 'aa bb cc' }), 'aa bb\ncc');
  syntax('a{{ x | foo }}', 1);
  syntax('{{#if a | upper}}{{/if}}', 0);
});
test('upper и lower: строка, число, вложенный путь', () => {
  assert.equal(render('{{ a.b | upper }}|{{ c | lower }}|{{ n | upper }}', { a: { b: 'xY' }, c: 'AbC', n: 12 }), 'XY|abc|12');
  assert.equal(render('{{c|lower|upper}}', { c: 'aB' }), 'AB');
});
test('цепочка слева направо, пробелы и переводы строк внутри тега', () => {
  assert.equal(render('{{a|default "x y"|upper}}', {}), 'X Y');
  assert.equal(render('{{ \n a \t|\n join "-"\n |  upper  }}', { a: ['p', 'q'] }), 'P-Q');
  assert.equal(render('{{ a | default "q" | wrap 3 | upper }}', { a: null }), 'Q');
});
test('экранирование после фильтров, тройные скобки без него', () => {
  assert.equal(render('{{ a | default "<&>" }}', {}), '&lt;&amp;&gt;');
  assert.equal(render('{{{ a | default "<&>" }}}', {}), '<&>');
  assert.equal(render('{{{ xs | join "<" | lower }}}', { xs: ['A', 'B'] }), 'a<b');
  assert.equal(render('{{ q | upper }}', { q: `'"` }), '&#39;&quot;');
});
test('default: пустая строка, null, undefined заменяются; 0, false, пробел остаются', () => {
  assert.equal(render('[{{ a | default "d" }}][{{ b | default "d" }}][{{ c | default "d" }}]', { a: '', b: null }), '[d][d][d]');
  assert.equal(render('[{{ a | default "d" }}][{{ b | default "d" }}][{{ c | default "d" }}]', { a: 0, b: false, c: ' ' }), '[0][false][ ]');
  assert.equal(render('{{ a.b.c | default "none" }}', { a: {} }), 'none');
});
test('null и undefined: upper, lower, wrap, date, join их пропускают', () => {
  const d = { n: null };
  assert.equal(render('[{{ n | upper }}][{{ m | lower }}][{{ n | wrap 5 }}][{{ m | date "%Y" }}][{{ n | join "," }}]', d), '[][][][][]');
  assert.equal(render('{{ m | upper | default "z" }}', d), 'z');
});
test('date: Date и число в мс, UTC, ошибки strftime не меняются', () => {
  const t = Date.UTC(2025, 2, 5, 7, 8, 9, 45);
  assert.equal(render('{{ d | date "%Y-%m-%d %H:%M:%S.%L" }}', { d: new Date(t) }), '2025-03-05 07:08:09.045');
  assert.equal(render('{{ d | date "%-d/%-m/%y %a" }}', { d: t }), '5/3/25 Wed');
  assert.equal(render('{{{ d | date "%s" | upper }}}', { d: 5000 }), '5');
  assert.throws(() => render('{{ d | date "%Q" }}', { d: t }), RangeError);
  assert.throws(() => render('{{ d | date "%Y" }}', { d: new Date(NaN) }), TypeError);
  assert.throws(() => render('{{ d | date "%Y" }}', { d: NaN }), TypeError);
});
test('wrap: String(value) и ширина, ошибки wrap не меняются', () => {
  assert.equal(render('{{ s | wrap 10 }}', { s: 'the quick brown fox' }), 'the quick\nbrown fox');
  assert.equal(render('{{{ s | wrap 4 }}}', { s: 12345 }), '12345');
  assert.equal(render('{{ s | wrap 3 }}', { s: 'ab  cd\n\n\nef' }), 'ab\ncd\n\nef');
  assert.throws(() => render('{{ s | wrap 0 }}', { s: 'a' }), RangeError);
  assert.throws(() => render('{{ s | wrap -4 }}', { s: '' }), RangeError);
});
test('join: массив, разделитель, элементы null и undefined; не массив - TypeError', () => {
  assert.equal(render('{{ xs | join "" }}|{{ xs | join " | " }}', { xs: [1, 'b', null, undefined, false] }), '1bfalse|1 | b |  |  | false');
  assert.equal(render('{{ xs | join "," }}', { xs: [] }), '');
  assert.equal(render('{{ xs | join "," }}', { xs: [[1, 2], 3] }), '1,2,3');
  assert.throws(() => render('{{ s | join "," }}', { s: 'abc' }), TypeError);
  assert.throws(() => render('{{ s | join "," }}', { s: { a: 1 } }), TypeError);
});
test('аргументы-строки: escape-последовательности и "|" внутри строки', () => {
  assert.equal(render('{{{ a | default "q\\"w" }}}', {}), 'q"w');
  assert.equal(render('{{{ a | default "b\\\\n" }}}', {}), 'b\\n');
  assert.equal(render('{{{ a | default "x|y" | upper }}}', {}), 'X|Y');
  assert.equal(render('{{{ xs | join "\\\\" }}}', { xs: ['a', 'b'] }), 'a\\b');
  syntax('{{ a | default "q\\n" }}', 0);
  syntax('x{{ a | default "q\\', 1);
});
test('SyntaxError: неизвестный фильтр и регистр имён', () => {
  syntax('{{ a | nope }}', 0);
  syntax('..{{ a | upper | trim }}', 2);
  syntax('{{{ a | Upper }}}', 0);
  syntax('{{ a | default"x" }}', 0);
});
test('SyntaxError: число и тип аргументов', () => {
  syntax('{{ a | upper 1 }}', 0);
  syntax('{{ a | lower "x" }}', 0);
  syntax('{{ a | default }}', 0);
  syntax('{{ a | default "x" "y" }}', 0);
  syntax('{{ a | join }}', 0);
  syntax('{{ a | join 5 }}', 0);
  syntax('{{ a | date 5 }}', 0);
  syntax('{{ a | wrap }}', 0);
  syntax('{{ a | wrap "5" }}', 0);
  syntax('{{ a | wrap 5 6 }}', 0);
  syntax('{{ a | wrap 1.5 }}', 0);
  syntax('{{ a | wrap x }}', 0);
  assert.equal(render('{{ s | wrap 5 }}', { s: 'a' }), 'a');
});
test('SyntaxError: пустой фильтр, пустой путь, незакрытая строка, мусор после строки', () => {
  syntax('{{ a | }}', 0);
  syntax('{{ a | | upper }}', 0);
  syntax('{{ a | upper | }}', 0);
  syntax('{{ | upper }}', 0);
  syntax('{{{ | upper }}}', 0);
  syntax('{{ a b | upper }}', 0);
  syntax('{{ a | default "x }}', 0);
  syntax('{{ a | default "x"y }}', 0);
  syntax('{{ a | default "x""y" }}', 0);
  syntax('{{ a | default "x}}y" }}', 0);
});
test('SyntaxError: offset - индекс {{ тега, бросается и в невыбранной ветке', () => {
  syntax('ab\n{{ a | nope }}', 3);
  syntax('{{ok}}{{{ a | nope }}}', 6);
  syntax('{{#if a}}y{{else}}{{ b | wrap }}{{/if}}', 18, { a: 1 });
  syntax('{{#each xs}}{{ this | bogus }}{{/each}}', 12, { xs: [] });
  syntax('{{ a | nope }}{{#if x}}', 0);
});
test('фильтры запрещены в #if и #each', () => {
  syntax('{{#if a | upper}}{{/if}}', 0);
  syntax('x{{#each xs | join ","}}{{/each}}', 1);
  syntax('{{#if a|upper}}{{/if}}', 0);
  syntax('{{#each xs|join ","}}{{/each}}', 0);
  syntax('{{#if a}}{{#if b | default "x"}}{{/if}}{{/if}}', 9);
});
test('прежнее поведение: теги без фильтров, each и @index с фильтрами', () => {
  assert.equal(render('{{ a }}|{{{ a }}}', { a: '<' }), '&lt;|<');
  assert.equal(render('{{#each xs}}{{@index}}{{ this | upper }}{{ t | default "-" }};{{/each}}', { t: 'T', xs: ['a', 'b'] }), '0AT;1BT;');
  assert.equal(render('{{#each r}}{{ n | default "?" }}{{ x.y | default "." }}{{/each}}', { r: [{ n: 1, x: { y: 2 } }, {}] }), '12?.');
  assert.equal(render('{{ constructor | default "c" }}', {}), 'c');
  assert.equal(render('{{ @index | default "no" }}', {}), 'no');
});
