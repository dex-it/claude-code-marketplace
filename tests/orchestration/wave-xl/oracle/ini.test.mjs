import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { parseIni, stringifyIni } = await load('src/ini.js');

const bad = (text, n) => assert.throws(
  () => parseIni(text),
  (e) => e instanceof SyntaxError && new RegExp(`line ${n}(?!\\d)`).test(e.message),
  JSON.stringify(text),
);
const rt = (x) => assert.deepEqual(parseIni(stringifyIni(x)), x, JSON.stringify(x));

test('parseIni: примеры задания', () => {
  assert.deepEqual(
    parseIni('a = 1\n[s.t]\nb = "x ; y" ; c\nl[] = 1\nl[] = two'),
    { a: 1, s: { t: { b: 'x ; y', l: [1, 'two'] } } },
  );
  assert.deepEqual(parseIni('k = v # c'), { k: 'v' });
  assert.deepEqual(parseIni('k=v#c'), { k: 'v#c' });
  assert.deepEqual(parseIni('k = "true"\nn = 1.5'), { k: 'true', n: 1.5 });
  bad('x = 1\n[x]', 2);
});
test('parseIni: пустой текст, пропуски и комментарии', () => {
  assert.deepEqual(parseIni(''), {});
  assert.deepEqual(parseIni('\n  \n; c\n   # c2\n\t;x = 1\n'), {});
  assert.deepEqual(parseIni('  a  =  b  \n'), { a: 'b' });
});
test('parseIni: LF и CRLF', () => {
  assert.deepEqual(parseIni('a = 1\r\n[s]\r\nb = "x"\r\nc = y ; z\r\n'), { a: 1, s: { b: 'x', c: 'y' } });
  bad('a = 1\r\nb\r\n', 2);
});
test('parseIni: ключи до секции идут в корень, секции вложены по точкам', () => {
  assert.deepEqual(parseIni('x = 1\n[a]\ny = 2\n[a.b.c]\nz = 3\n[d]\nw = 4'), {
    x: 1, a: { y: 2, b: { c: { z: 3 } } }, d: { w: 4 },
  });
  assert.deepEqual(parseIni('[ a . b ]\nk = 1'), { a: { b: { k: 1 } } });
});
test('parseIni: повторная секция дополняет, пустая секция создаёт {}', () => {
  assert.deepEqual(parseIni('[a]\nx = 1\n[b]\ny = 2\n[a]\nz = 3'), { a: { x: 1, z: 3 }, b: { y: 2 } });
  assert.deepEqual(parseIni('[a]\n[b.c]\n'), { a: {}, b: { c: {} } });
  assert.deepEqual(parseIni('[a.b]\nx = 1\n[a]\ny = 2'), { a: { b: { x: 1 }, y: 2 } });
});
test('parseIni: ключ делится по первому =, точка в ключе обычная', () => {
  assert.deepEqual(parseIni('url = http://h/?a=b&c=d'), { url: 'http://h/?a=b&c=d' });
  assert.deepEqual(parseIni('a.b = 1\n[s]\nx.y = 2'), { 'a.b': 1, s: { 'x.y': 2 } });
  assert.deepEqual(parseIni('e =\nf=   '), { e: '', f: '' });
});
test('parseIni: типы голых значений', () => {
  assert.deepEqual(parseIni('a = true\nb = false\nc = 42\nd = -7\ne = 3.14\nf = -0.5'), {
    a: true, b: false, c: 42, d: -7, e: 3.14, f: -0.5,
  });
  assert.deepEqual(parseIni('a = True\nb = 1.\nc = .5\nd = 1e3\ne = 0x10\nf = +1\ng = 1 2\nh = 1.2.3\ni = --1'), {
    a: 'True', b: '1.', c: '.5', d: '1e3', e: '0x10', f: '+1', g: '1 2', h: '1.2.3', i: '--1',
  });
});
test('parseIni: инлайн-комментарий только после пробельного символа', () => {
  assert.deepEqual(parseIni('a = x ;c\nb = x\t#c\nc = x;y\nd = x#y # z\ne = 1 ; c\nf = true # c'), {
    a: 'x', b: 'x', c: 'x;y', d: 'x#y', e: 1, f: true,
  });
  assert.deepEqual(parseIni('a = ; c\nb = # c\nc =;x\nd = a  ;  b ; c'), { a: '', b: '', c: ';x', d: 'a' });
});
test('parseIni: значение в кавычках - всегда строка, ; и # литералы', () => {
  assert.deepEqual(parseIni('a = "true"\nb = "1"\nc = "  pad  "\nd = ""\ne = "x;y#z"\nf = "a b" # c\ng = "a"; c'), {
    a: 'true', b: '1', c: '  pad  ', d: '', e: 'x;y#z', f: 'a b', g: 'a',
  });
});
test('parseIni: escape-последовательности', () => {
  assert.deepEqual(parseIni('a = "q\\"q"\nb = "x\\\\y"\nc = "l1\\nl2"\nd = "t\\tt"\ne = "\\\\n"'), {
    a: 'q"q', b: 'x\\y', c: 'l1\nl2', d: 't\tt', e: '\\n',
  });
});
test('parseIni: массивы key[], порядок и типы элементов', () => {
  assert.deepEqual(parseIni('l[] = 1\nl[] = "1"\nl[] = true ; c\nl[] =\nl[] = b'), { l: [1, '1', true, '', 'b'] });
  assert.deepEqual(parseIni('[s]\na[] = x\nb[] = y\na[] = z'), { s: { a: ['x', 'z'], b: ['y'] } });
});
test('parseIni: одинаковый простой ключ - побеждает последний', () => {
  assert.deepEqual(parseIni('a = 1\na = "b"\n[s]\nk = x\nk = true'), { a: 'b', s: { k: true } });
  assert.deepEqual(parseIni('a = 1\n[s]\na = 2\n[t]\na = 3'), { a: 1, s: { a: 2 }, t: { a: 3 } });
});
test('parseIni: SyntaxError - строка без =, секция без ], пустой ключ', () => {
  bad('a = 1\n\njust text', 3);
  bad('a = 1\n[sec', 2);
  bad('[s]\nb = 1\n= v', 3);
  bad('   = v', 1);
  bad('\n\n[s] x', 3);
});
test('parseIni: SyntaxError - пустое имя секции или сегмента', () => {
  bad('a = 1\n[]', 2);
  bad('[  ]', 1);
  bad('x = 1\ny = 2\n[a..b]', 3);
  bad('[a.]', 1);
  bad('[.a]', 1);
});
test('parseIni: SyntaxError - кавычки и escape', () => {
  bad('a = 1\nb = "abc', 2);
  bad('a = "abc\\"', 1);
  bad('a = "x\\q"', 1);
  bad('\n\nz = "\\x"', 3);
  bad('a = "x" y', 1);
  bad('a = 1\nb = "x"y', 2);
  bad('a = "abc\nb = 2', 1);
});
test('parseIni: SyntaxError - коллизия имён скаляра, массива и секции', () => {
  bad('a = 1\n[a]', 2);
  bad('a = 1\n[a.b]', 2);
  bad('[x]\ny = 1\n[x.y]', 3);
  bad('a[] = 1\n[a]', 2);
  bad('[a.b]\n[a]\nb = 1', 3);
  bad('[a.b]\n[a]\nb[] = 1', 3);
  bad('k[] = 1\nk = 2', 2);
  bad('k = 1\nk[] = 2', 2);
  bad('\n[s]\nk[] = 1\nk = "x"', 4);
});
test('stringifyIni: корневые значения раньше секций, результат читается', () => {
  const x = { s: { k: 1 }, top: 'v', arr: [1, 2], n: { m: { z: true } } };
  const text = stringifyIni(x);
  assert.equal(typeof text, 'string');
  assert.ok(text.search(/^\s*top\b/m) >= 0 && text.search(/^\s*top\b/m) < text.search(/^\s*\[/m));
  assert.ok(text.search(/^\s*arr\[\]/m) < text.search(/^\s*\[/m));
  assert.deepEqual(parseIni(text), x);
  assert.deepEqual(parseIni(stringifyIni({})), {});
});
test('stringifyIni: круговой обмен строк, требующих кавычек', () => {
  const strs = ['', ' ', ' pad ', 'true', 'false', '42', '-1.5', '007', 'a;b', 'a #b', '#', ';', 'say "hi"', '"q"',
    '\\', 'C:\\dir\\n', 'l1\nl2', '\t', 'x\ty', '[x]', 'a = b', 'a=b', 'a b', 'True', '1e3', '1.', 'ключ значение', '"', '\\"'];
  for (const s of strs) rt({ k: s });
  rt(Object.fromEntries(strs.map((s, i) => [`k${i}`, s])));
  rt({ s: { t: { u: strs } } });
});
test('stringifyIni: круговой обмен скаляров, массивов и вложенных объектов', () => {
  rt({});
  rt({ a: 1, b: -2.5, c: true, d: false, e: 0, f: 123456789 });
  rt({ a: [1, 'x', true, '1', ''], b: ['only'] });
  rt({ a: {}, b: { c: {} }, d: { e: { f: {} } } });
  rt({ top: 'v', s: { k: 1, arr: ['a', 2], t: { u: { v: 'deep', w: [false] } }, e: {} }, z: { y: 'last' } });
  rt({ a: { b: 1 }, 'x-y': 'dash', _u: 'under', 'a b': 'spaced key', s: { 'k 2': 3 } });
});
