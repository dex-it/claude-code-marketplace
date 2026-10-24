import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { wrap, justify } = await load('src/wrap.js');

test('wrap: примеры задания', () => {
  assert.equal(wrap('the quick brown fox', 10), 'the quick\nbrown fox');
  assert.equal(wrap('aa bb\n\n\n  cc   dd ', 5), 'aa bb\n\ncc dd');
  assert.equal(wrap('one two three four', 9, { indent: '  ', firstIndent: '' }), 'one two\n  three\n  four');
  assert.equal(wrap('abcdefg hi', 5, { hard: true }), 'abcde\nfg hi');
  assert.equal(wrap('a abcdefgh b', 4), 'a\nabcdefgh\nb');
  assert.equal(wrap('  \n ', 5), '');
});
test('wrap: жадное заполнение и точная граница ширины', () => {
  assert.equal(wrap('aa bb cc', 5), 'aa bb\ncc');
  assert.equal(wrap('aa bb cc', 8), 'aa bb cc');
  assert.equal(wrap('aa bb cc', 7), 'aa bb\ncc');
  assert.equal(wrap('abc', 3), 'abc');
});
test('wrap: пробельные серии схлопываются, края обрезаются', () => {
  assert.equal(wrap('  a \t b\t\tc  ', 20), 'a b c');
  assert.equal(wrap('a\nb\nc', 20), 'a b c');
  assert.equal(wrap('a\r\nb', 20), 'a b');
});
test('wrap: абзацы разделяются ровно одной пустой строкой', () => {
  assert.equal(wrap('a\n\nb', 10), 'a\n\nb');
  assert.equal(wrap('a\n \t \n\n\n   \nb', 10), 'a\n\nb');
  assert.equal(wrap('\n\n a b\n\n\n', 10), 'a b');
  assert.equal(wrap('a b\n\nc d\n\ne f', 3), 'a b\n\nc d\n\ne f');
});
test('wrap: пустой и пробельный текст -> пустая строка', () => {
  assert.equal(wrap('', 10), '');
  assert.equal(wrap(' \n\t\n ', 10), '');
  assert.equal(wrap('', 10, { indent: '> ' }), '');
});
test('wrap: indent входит в ширину и ставится на каждую строку', () => {
  assert.equal(wrap('aa bb cc dd', 8, { indent: '> ' }), '> aa bb\n> cc dd');
  assert.equal(wrap('aa bb cc dd', 7, { indent: '> ' }), '> aa bb\n> cc dd');
  assert.equal(wrap('aa bb cc dd', 6, { indent: '> ' }), '> aa\n> bb\n> cc\n> dd');
});
test('wrap: firstIndent только на первой строке каждого абзаца', () => {
  assert.equal(wrap('aa bb cc\n\ndd ee ff', 5, { indent: '  ', firstIndent: '* ' }), '* aa\n  bb\n  cc\n\n* dd\n  ee\n  ff');
  assert.equal(wrap('aa bb cc dd', 8, { indent: '', firstIndent: '    ' }), '    aa\nbb cc dd');
  assert.equal(wrap('a b', 10, { firstIndent: '- ' }), '- a b');
});
test('wrap: разные индентации задают разное место на первой и остальных строках', () => {
  assert.equal(wrap('aaa bbb ccc ddd', 10, { firstIndent: '', indent: '    ' }), 'aaa bbb\n    ccc\n    ddd');
  assert.equal(wrap('aaa bbb ccc ddd', 10, { firstIndent: '    ', indent: '' }), '    aaa\nbbb ccc\nddd');
});
test('wrap: длинное слово без hard стоит на своей строке', () => {
  assert.equal(wrap('ab abcdefghij cd', 5), 'ab\nabcdefghij\ncd');
  assert.equal(wrap('abcdefghij ab cd', 5), 'abcdefghij\nab cd');
  assert.equal(wrap('ab cd abcdefghij', 5), 'ab cd\nabcdefghij');
  assert.equal(wrap('abcdefgh', 5, { indent: '> ' }), '> abcdefgh');
});
test('wrap: hard режет на куски ровно по свободному месту', () => {
  assert.equal(wrap('abcdefghij', 5, { hard: true }), 'abcde\nfghij');
  assert.equal(wrap('abcdefghijkl', 5, { hard: true }), 'abcde\nfghij\nkl');
  assert.equal(wrap('abcdefghij kl', 5, { hard: true }), 'abcde\nfghij\nkl');
  assert.equal(wrap('abcdefghijkl mn op', 5, { hard: true }), 'abcde\nfghij\nkl mn\nop');
});
test('wrap: hard - длинное слово начинает новую строку, а не дописывается к текущей', () => {
  assert.equal(wrap('ab abcdefgh', 6, { hard: true }), 'ab\nabcdef\ngh');
  assert.equal(wrap('abcdefg hi jk', 5, { hard: true }), 'abcde\nfg hi\njk');
});
test('wrap: hard с отступами - куски по месту своей строки', () => {
  assert.equal(wrap('abcdefghijkl', 6, { hard: true, indent: '> ' }), '> abcd\n> efgh\n> ijkl');
  assert.equal(wrap('abcdefghijk', 6, { hard: true, firstIndent: '', indent: '--' }), 'abcdef\n--ghij\n--k');
  assert.equal(wrap('abcdefgh', 6, { hard: true, firstIndent: '+++', indent: '' }), '+++abc\ndefgh');
});
test('wrap: hard - слово, влезающее на следующую строку, не режется', () => {
  assert.equal(wrap('ab cdefg', 6, { hard: true }), 'ab\ncdefg');
  assert.equal(wrap('aaaa bbbbb', 6, { hard: true, firstIndent: '  ', indent: '' }), '  aaaa\nbbbbb');
});
test('wrap: длина считается в UTF-16 единицах', () => {
  assert.equal(wrap('\u{1F600} \u{1F600}', 5), '\u{1F600} \u{1F600}');
  assert.equal(wrap('\u{1F600} \u{1F600}', 4), '\u{1F600}\n\u{1F600}');
  assert.equal(wrap('\u{1F600}\u{1F600}', 3), '\u{1F600}\u{1F600}');
});
test('wrap: недопустимая ширина - RangeError', () => {
  for (const w of [0, -1, 2.5, NaN, Infinity, '10', undefined, null]) {
    assert.throws(() => wrap('a b', w), RangeError, String(w));
  }
});
test('wrap: ширина не больше индентации - RangeError, в том числе для пустого текста', () => {
  assert.throws(() => wrap('x', 2, { indent: '  ' }), RangeError);
  assert.throws(() => wrap('x', 3, { indent: '   ' }), RangeError);
  assert.throws(() => wrap('x', 3, { firstIndent: '    ' }), RangeError);
  assert.throws(() => wrap('x', 3, { indent: '', firstIndent: '   ' }), RangeError);
  assert.throws(() => wrap('', 2, { indent: '  ' }), RangeError);
  assert.throws(() => wrap('  ', 1.5), RangeError);
  assert.equal(wrap('x', 3, { indent: '  ' }), '  x');
});
test('justify: примеры задания и распределение остатка слева', () => {
  assert.equal(justify('a b c', 8), 'a   b  c');
  assert.equal(justify('a b c', 7), 'a  b  c');
  assert.equal(justify('a b c d', 11), 'a   b  c  d');
  assert.equal(justify('ab cd', 7), 'ab   cd');
  assert.equal(justify('ab cd', 5), 'ab cd');
});
test('justify: результат ровно width, края без пробелов', () => {
  for (const [line, w] of [['x y z w v', 23], ['foo bar baz', 30], ['aa b', 11]]) {
    const out = justify(line, w);
    assert.equal(out.length, w);
    assert.equal(out, out.trim());
    assert.equal(out.split(/ +/).join(' '), line);
  }
});
test('justify: одно слово и строка не короче width без изменений', () => {
  assert.equal(justify('word', 9), 'word');
  assert.equal(justify('', 5), '');
  assert.equal(justify('aa bb cc', 8), 'aa bb cc');
  assert.equal(justify('aa bb cc', 3), 'aa bb cc');
  assert.equal(justify('  aa  bb  ', 6), '  aa  bb  ');
  assert.equal(justify('  aa bb  ', 9), '  aa bb  ');
});
test('justify: width не целое - RangeError', () => {
  for (const w of [2.5, NaN, Infinity, '8', undefined]) {
    assert.throws(() => justify('a b', w), RangeError, String(w));
  }
  assert.throws(() => justify('word', 1.5), RangeError);
});
