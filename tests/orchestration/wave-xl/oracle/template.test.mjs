import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { render } = await load('src/template.js');

const syntax = (tpl, offset, data = {}) =>
  assert.throws(() => render(tpl, data), (e) => e instanceof SyntaxError && e.offset === offset, JSON.stringify(tpl));

test('render: примеры задания', () => {
  assert.equal(render('Hi {{ user.name }}!', { user: { name: '<Bo>' } }), 'Hi &lt;Bo&gt;!');
  assert.equal(render('{{{a}}}|{{b}}', { a: '<i>' }), '<i>|');
  assert.equal(render('{{#if xs}}y{{else}}n{{/if}}', { xs: [] }), 'n');
  assert.equal(render('{{#each xs}}{{@index}}={{this}};{{/each}}', { xs: ['a', 'b'] }), '0=a;1=b;');
  assert.equal(render('{{#each r}}{{n}}{{t}}{{/each}}', { t: 'T', r: [{ n: 1 }, { n: 2, t: 'x' }] }), '1T2x');
});
test('текст вне тегов не меняется', () => {
  assert.equal(render('', {}), '');
  assert.equal(render('  a\n{ b } } < &\t', {}), '  a\n{ b } } < &\t');
  assert.equal(render('{{a}}\n{{b}} ', { a: 1, b: 2 }), '1\n2 ');
});
test('экранирование: все пять символов за один проход', () => {
  assert.equal(render('{{x}}', { x: `&<>"'` }), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(render('{{x}}', { x: '&amp;' }), '&amp;amp;');
  assert.equal(render('{{{x}}}', { x: `&<>"'` }), `&<>"'`);
  assert.equal(render(`<a href="{{u}}">'</a>`, { u: 'x' }), `<a href="x">'</a>`);
});
test('пробелы внутри скобок', () => {
  assert.equal(render('{{   a  }}|{{{  a }}}|{{\ta\n}}', { a: '<' }), '&lt;|<|&lt;');
  assert.equal(render('{{ #if a }}y{{ else }}n{{ /if }}', { a: 1 }), 'y');
  assert.equal(render('{{  #each  xs  }}{{ this }}{{  /each  }}', { xs: [1, 2] }), '12');
});
test('точечные пути и собственные свойства', () => {
  const data = { a: { b: { c: 'deep' } }, list: [{ n: 'x' }, { n: 'y' }], z: null };
  assert.equal(render('{{a.b.c}}', data), 'deep');
  assert.equal(render('{{list.1.n}}', data), 'y');
  assert.equal(render('{{a.b.c.d}}', data), '');
  assert.equal(render('{{z.q}}|{{a.zz.c}}', data), '|');
  assert.equal(render('{{constructor}}|{{a.toString}}', data), '|');
  assert.equal(render('{{s.length}}', { s: 'abc' }), '');
});
test('пустые и примитивные значения', () => {
  assert.equal(render('[{{a}}][{{b}}][{{c}}][{{{a}}}][{{{d}}}]', { b: null, c: undefined }), '[][][][][]');
  assert.equal(render('{{n}}|{{f}}|{{t}}|{{e}}', { n: 0, f: false, t: true, e: '' }), '0|false|true|');
  assert.equal(render('{{{n}}}|{{{f}}}', { n: 42.5, f: false }), '42.5|false');
});
test('if: истинность', () => {
  const tpl = '{{#if v}}T{{else}}F{{/if}}';
  for (const v of [true, 1, 'a', {}, [0], -1, '0']) assert.equal(render(tpl, { v }), 'T', String(v));
  for (const v of [false, 0, '', null, undefined, [], NaN]) assert.equal(render(tpl, { v }), 'F', String(v));
  assert.equal(render(tpl, {}), 'F');
  assert.equal(render('{{#if a.b}}T{{else}}F{{/if}}', { a: { b: 1 } }), 'T');
});
test('if: без else и ветки с тегами', () => {
  assert.equal(render('<{{#if v}}x{{/if}}>', { v: 1 }), '<x>');
  assert.equal(render('<{{#if v}}x{{/if}}>', { v: 0 }), '<>');
  assert.equal(render('{{#if v}}{{a}}{{else}}{{{b}}}{{/if}}', { v: 0, a: '<', b: '<' }), '<');
  assert.equal(render('{{#if v}}\n a \n{{else}}\n b \n{{/if}}', { v: 1 }), '\n a \n');
});
test('each: this, @index и пустые случаи', () => {
  assert.equal(render('{{#each xs}}[{{@index}}:{{this}}]{{/each}}', { xs: [10, 'a<', 0, false] }), '[0:10][1:a&lt;][2:0][3:false]');
  assert.equal(render('{{#each xs}}{{{this}}}{{/each}}', { xs: ['<', '>'] }), '<>');
  assert.equal(render('a{{#each xs}}x{{/each}}b', { xs: [] }), 'ab');
  assert.equal(render('a{{#each xs}}x{{/each}}b', {}), 'ab');
  assert.equal(render('a{{#each xs}}x{{/each}}b', { xs: null }), 'ab');
  assert.equal(render('{{#each xs}}[{{this}}]{{/each}}', { xs: [null, 'a', undefined] }), '[][a][]');
  assert.equal(render('{{#each o.items}}{{this}},{{/each}}', { o: { items: [1, 2, 3] } }), '1,2,3,');
});
test('each: this.x и @index в if', () => {
  const data = { name: 'root', xs: [{ name: 'a' }, {}] };
  assert.equal(render('{{#each xs}}{{this.name}}|{{name}};{{/each}}', data), 'a|a;|root;');
  assert.equal(render('{{#each xs}}{{#if @index}}+{{else}}-{{/if}}{{/each}}', data), '-+');
});
test('each: поиск пути - элемент, внешние each, data', () => {
  const data = { g: 'G', s: 'S', rows: [{ s: 'r1', cols: [{ c: 1 }, { c: 2, s: 'own' }] }, { s: null, cols: [{ c: 3 }] }] };
  assert.equal(
    render('{{#each rows}}{{#each cols}}{{c}}{{s}}{{g}};{{/each}}|{{/each}}', data),
    '1r1G;2ownG;|3SG;|',
  );
  assert.equal(render('{{#each xs}}{{#if f}}T{{else}}F{{/if}}{{/each}}', { f: true, xs: [{ f: false }, {}, { f: null }] }), 'FTT');
  assert.equal(render('{{#each xs}}{{z}}{{/each}}', { z: 'q', xs: ['abc', 5] }), 'qq');
  assert.equal(render('{{#each xs}}{{length}}|{{/each}}', { xs: ['abc'] }), '|');
});
test('вложенные блоки и @index ближайшего each', () => {
  const data = { m: [['a', 'b'], ['c']] };
  assert.equal(
    render('{{#each m}}{{@index}}:{{#each this}}{{@index}}{{this}}{{/each}}/{{@index}};{{/each}}', data),
    '0:0a1b/0;1:0c/1;',
  );
  assert.equal(
    render('{{#if a}}{{#each xs}}{{#if this}}{{this}}{{else}}_{{/if}}{{/each}}{{else}}none{{/if}}', { a: 1, xs: [1, 0, 2] }),
    '1_2',
  );
  assert.equal(render('{{#if a}}{{#if b}}ab{{else}}a{{/if}}{{else}}{{#if b}}b{{else}}-{{/if}}{{/if}}', { a: 0, b: 1 }), 'b');
});
test('each над не-массивом - TypeError', () => {
  for (const v of [5, 'abc', {}, true, false, 0, '']) {
    assert.throws(() => render('{{#each x}}a{{/each}}', { x: v }), TypeError, JSON.stringify(v));
  }
  assert.throws(() => render('{{#each xs}}{{#each this}}a{{/each}}{{/each}}', { xs: [[1], 2] }), TypeError);
});
test('TypeError не бросается в невыбранной ветке', () => {
  assert.equal(render('{{#if f}}{{#each x}}a{{/each}}{{else}}ok{{/if}}', { f: 0, x: 5 }), 'ok');
});
test('SyntaxError: тег без закрытия, offset', () => {
  syntax('abc {{x', 4);
  syntax('{{x}} {{ y }', 6);
  syntax('{{{a}}', 0);
  syntax('{{a}} {{{b}} {{c}}', 6);
  syntax('{{#if a}}{{b', 9, { a: 1 });
});
test('SyntaxError: закрывающий тег без пары или не того блока', () => {
  syntax('ab{{/if}}', 2);
  syntax('{{/each}}', 0);
  syntax('x{{#if a}}{{/each}}', 10, { a: 1 });
  syntax('{{#each xs}}..{{/if}}', 14, { xs: [] });
  syntax('{{#if a}}{{/if}}  {{/if}}', 18, { a: 1 });
  syntax('{{#if a}}{{#each xs}}{{/if}}{{/each}}', 21, { a: 1, xs: [] });
});
test('SyntaxError: лишний else', () => {
  syntax('x{{else}}', 1);
  syntax('{{#if a}}1{{else}}2{{ else }}3{{/if}}', 19, { a: 1 });
  syntax('{{#each xs}}a{{else}}b{{/each}}', 13, { xs: [] });
  syntax('{{#if a}}{{#each xs}}{{else}}{{/each}}{{/if}}', 21, { a: 1, xs: [] });
  syntax('{{#if a}}{{/if}}{{else}}', 16, { a: 1 });
});
test('SyntaxError: незакрытый блок', () => {
  syntax('ab{{#if a}}x', 2, { a: 1 });
  syntax('{{#each xs}}{{this}}', 0, { xs: [] });
  syntax('{{#if a}}{{#each xs}}x{{/each}}', 0, { a: 1, xs: [] });
  syntax('{{#if a}}{{#each xs}}x', 9, { a: 1, xs: [] });
  syntax('{{#if a}}1{{else}}2', 0, { a: 1 });
});
test('SyntaxError бросается и в невыбранной ветке, до TypeError', () => {
  syntax('{{#if f}}{{/each}}{{/if}}', 9, { f: 0 });
  syntax('{{#each x}}a{{/each}}{{#if}}', 21, { x: 5 });
});
