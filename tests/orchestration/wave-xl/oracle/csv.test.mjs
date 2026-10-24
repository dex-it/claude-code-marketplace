import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { parse, stringify } = await load('src/csv.js');

test('parse: примеры задания', () => {
  assert.deepEqual(parse('a,b\r\nc,d\n'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse('\n'), [['']]);
  assert.deepEqual(parse('"a ""q"", b",x'), [['a "q", b', 'x']]);
  assert.deepEqual(parse('a,\n\nb'), [['a', ''], [''], ['b']]);
});
test('parse: LF и CRLF, смешанные концы строк', () => {
  assert.deepEqual(parse('a\nb\r\nc'), [['a'], ['b'], ['c']]);
  assert.deepEqual(parse('a,b\r\n'), [['a', 'b']]);
  assert.deepEqual(parse('a,b\n'), [['a', 'b']]);
});
test('parse: один завершающий перевод строки не создаёт записи, второй создаёт', () => {
  assert.deepEqual(parse('a\n\n'), [['a'], ['']]);
  assert.deepEqual(parse('\r\n\r\n'), [[''], ['']]);
  assert.deepEqual(parse('"a"\n'), [['a']]);
});
test('parse: пустые поля и записи', () => {
  assert.deepEqual(parse(','), [['', '']]);
  assert.deepEqual(parse('a,'), [['a', '']]);
  assert.deepEqual(parse(',a\n,'), [['', 'a'], ['', '']]);
  assert.deepEqual(parse('""'), [['']]);
  assert.deepEqual(parse('a\n\n\nb'), [['a'], [''], [''], ['b']]);
});
test('parse: пробелы не обрезаются, записи разной длины', () => {
  assert.deepEqual(parse(' a , b \nc'), [[' a ', ' b '], ['c']]);
  assert.deepEqual(parse('"a",b'), [['a', 'b']]);
});
test('parse: кавычки, удвоение, разделитель и переводы строк внутри', () => {
  assert.deepEqual(parse('"a""b"'), [['a"b']]);
  assert.deepEqual(parse('""""'), [['"']]);
  assert.deepEqual(parse('"x\ny",z'), [['x\ny', 'z']]);
  assert.deepEqual(parse('"x\r\ny"\r\nq'), [['x\r\ny'], ['q']]);
  assert.deepEqual(parse('"a\rb"'), [['a\rb']]);
  assert.deepEqual(parse('"a,b",c'), [['a,b', 'c']]);
});
test('parse: delimiter', () => {
  assert.deepEqual(parse('a;b,c\n"d;e";f', { delimiter: ';' }), [['a', 'b,c'], ['d;e', 'f']]);
  assert.deepEqual(parse('a\tb', { delimiter: '\t' }), [['a', 'b']]);
  assert.deepEqual(parse('a,b', {}), [['a', 'b']]);
  assert.deepEqual(parse('a,b', { delimiter: undefined }), [['a', 'b']]);
});
test('parse/stringify: недопустимый delimiter - RangeError', () => {
  for (const delimiter of [',,', '', '"', '\n', '\r', 5, null, ['a']]) {
    assert.throws(() => parse('a,b', { delimiter }), RangeError, String(delimiter));
    assert.throws(() => parse('', { delimiter }), RangeError, String(delimiter));
    assert.throws(() => stringify([['a']], { delimiter }), RangeError, String(delimiter));
    assert.throws(() => stringify([], { delimiter }), RangeError, String(delimiter));
  }
});
test('parse: незакрытая кавычка - SyntaxError', () => {
  assert.throws(() => parse('"abc'), SyntaxError);
  assert.throws(() => parse('a,"b\nc'), SyntaxError);
  assert.throws(() => parse('"a"",b'), SyntaxError);
  assert.throws(() => parse('"'), SyntaxError);
});
test('parse: символы после закрывающей кавычки - SyntaxError', () => {
  for (const bad of ['"a"b', '"a" ,b', '"a"\r', '"a"\rb\n', '"a""b"c', 'x,"a"b,y']) {
    assert.throws(() => parse(bad), SyntaxError, JSON.stringify(bad));
  }
  assert.throws(() => parse('"a";b', { delimiter: ',' }), SyntaxError);
  assert.deepEqual(parse('"a";b', { delimiter: ';' }), [['a', 'b']]);
});
test('parse: кавычка внутри поля без кавычек и одиночный CR - SyntaxError', () => {
  for (const bad of ['a"b', ' "a"', 'a,b"c"', 'a\rb', 'a\r', 'a,b\rc\n']) {
    assert.throws(() => parse(bad), SyntaxError, JSON.stringify(bad));
  }
});
test('parse: номер строки в сообщении SyntaxError', () => {
  assert.throws(() => parse('x\n"a\nb"c'), (e) => e instanceof SyntaxError && e.message.includes('line 2'));
  assert.throws(() => parse('a\nb\n"c'), (e) => e instanceof SyntaxError && e.message.includes('line 3'));
  assert.throws(() => parse('"a"b'), (e) => e instanceof SyntaxError && e.message.includes('line 1'));
  assert.throws(() => parse('"x\ny",z"'), (e) => e instanceof SyntaxError && e.message.includes('line 2'));
  assert.throws(() => parse('"x\r\ny"\r\n\r\nq"r"'), (e) => e instanceof SyntaxError && e.message.includes('line 4'));
  assert.throws(() => parse('"a\n\n\nb"z'), (e) => e instanceof SyntaxError && e.message.includes('line 1'));
  assert.throws(() => parse('ok\r\nok\r\nb\rx'), (e) => e instanceof SyntaxError && e.message.includes('line 3'));
});
test('stringify: простые поля и соединение записей', () => {
  assert.equal(stringify([['a', 'b'], ['c', 'd']]), 'a,b\r\nc,d');
  assert.equal(stringify([['a']]), 'a');
  assert.equal(stringify([]), '');
  assert.equal(stringify([['', ''], ['']]), ',\r\n""');
  assert.equal(stringify([['a'], ['b', 'c', 'd']]), 'a\r\nb,c,d');
});
test('stringify: кавычки только при необходимости', () => {
  assert.equal(stringify([['a,b', 'c']]), '"a,b",c');
  assert.equal(stringify([['say "hi"']]), '"say ""hi"""');
  assert.equal(stringify([['x\ny', 'p\rq', 'r\r\ns']]), '"x\ny","p\rq","r\r\ns"');
  assert.equal(stringify([[' a ', 'b;c', 'it\'s', '\t']]), ' a ,b;c,it\'s,\t');
  assert.equal(stringify([['', 'x']]), ',x');
});
test('stringify: delimiter', () => {
  assert.equal(stringify([['a;b', 'c,d']], { delimiter: ';' }), '"a;b";c,d');
  assert.equal(stringify([['a\tb', 'c']], { delimiter: '\t' }), '"a\tb"\tc');
  assert.equal(stringify([['a,b']], {}), '"a,b"');
});
test('stringify: не строки через String()', () => {
  assert.equal(stringify([[1, 2.5, true, null, undefined]]), '1,2.5,true,null,undefined');
  assert.equal(stringify([[1, 'say "hi"', null]]), '1,"say ""hi""",null');
  assert.equal(stringify([[[1, 2]]]), '"1,2"');
});
test('stringify: пример задания', () => {
  assert.equal(
    stringify([['a b', 'c,d'], [1, 'say "hi"', null]]),
    'a b,"c,d"\r\n1,"say ""hi""",null',
  );
});
test('круговой обход: фиксированные трудные сетки', () => {
  const grids = [
    [['']],
    [[''], ['']],
    [['a'], ['']],
    [['', '']],
    [['"']],
    [['"', '""', '\r', '\n', '\r\n', ',']],
    [[' ', ' a'], ['', '']],
    [['x\ny', ''], ['\r', 'z']],
  ];
  for (const rows of grids) {
    assert.deepEqual(parse(stringify(rows)), rows, JSON.stringify(rows));
    assert.deepEqual(parse(stringify(rows, { delimiter: ';' }), { delimiter: ';' }), rows, JSON.stringify(rows));
    assert.deepEqual(parse(stringify(rows, { delimiter: '\t' }), { delimiter: '\t' }), rows, JSON.stringify(rows));
  }
});
test('круговой обход: случайные сетки', () => {
  let seed = 12345;
  const rnd = (n) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return (seed >>> 8) % n;
  };
  const alphabet = ['a', 'b', ' ', ',', ';', '"', '\r', '\n', '\t', 'é'];
  for (let t = 0; t < 300; t++) {
    const rows = Array.from({ length: rnd(5) }, () =>
      Array.from({ length: 1 + rnd(4) }, () => Array.from({ length: rnd(5) }, () => alphabet[rnd(alphabet.length)]).join('')),
    );
    for (const delimiter of [',', ';', '\t']) {
      const o = { delimiter };
      assert.deepEqual(parse(stringify(rows, o), o), rows, JSON.stringify([rows, delimiter]));
    }
  }
});
