import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { globToRegExp, isMatch } = await load('src/glob.js');

const yes = (p, g) => assert.equal(isMatch(p, g), true, `${JSON.stringify(p)} ~ ${JSON.stringify(g)}`);
const no = (p, g) => assert.equal(isMatch(p, g), false, `${JSON.stringify(p)} !~ ${JSON.stringify(g)}`);

test('примеры задания', () => {
  yes('a/x/y/b', 'a/**/b');
  no('src/.env', 'src/*');
  yes('b.ts', '*.{js,ts}');
  no('a/b', 'a?b');
  yes('a*b', String.raw`a\*b`);
  assert.throws(() => globToRegExp('{a'), SyntaxError);
});
test('globToRegExp: якорный RegExp без g и y', () => {
  const re = globToRegExp('a*.js');
  assert.ok(re instanceof RegExp);
  assert.equal(re.global, false);
  assert.equal(re.sticky, false);
  assert.equal(re.test('ab.js'), true);
  assert.equal(re.test('ab.js'), true);
  assert.equal(re.test('xab.js'), false);
  assert.equal(re.test('ab.jsx'), false);
  assert.equal(re.test('dir/ab.js'), false);
});
test('isMatch: литералы, весь путь, регистр', () => {
  yes('a/b/c.txt', 'a/b/c.txt');
  no('a/b/c.txt', 'a/b');
  no('a/b', 'a/b/c');
  no('xa/b', 'a/b');
  no('A/b', 'a/b');
  yes('a+b(1).txt', 'a+b(1).txt');
  no('axb', 'a.b');
});
test('? - один символ, кроме /', () => {
  yes('abc', 'a?c');
  yes('a.c', 'a?c');
  no('ac', 'a?c');
  no('abbc', 'a?c');
  no('a/c', 'a?c');
  yes('ab', '??');
  no('a', '??');
});
test('* - любая последовательность без /', () => {
  yes('abc.js', '*.js');
  no('.js', '*.js');
  yes('ab', 'a*');
  yes('a', 'a*');
  yes('a-mid-b', 'a*b');
  no('a/b', 'a*b');
  no('dir/x.js', '*.js');
  yes('dir/x.js', '*/*.js');
  yes('a/b/c', '*/b/*');
  no('a/b/c', '*/*');
});
test('** как целый сегмент: ноль и больше сегментов', () => {
  yes('a/b', 'a/**/b');
  yes('a/x/b', 'a/**/b');
  yes('a/x/y/b', 'a/**/b');
  no('a/x/y/c', 'a/**/b');
  no('ab', 'a/**/b');
  yes('b', '**/b');
  yes('x/b', '**/b');
  yes('x/y/z/b', '**/b');
  no('xb', '**/b');
  yes('a', 'a/**');
  yes('a/x', 'a/**');
  yes('a/x/y', 'a/**');
  no('ab/x', 'a/**');
  yes('a/b/c.js', '**/*.js');
  yes('c.js', '**/*.js');
  yes('anything/at/all', '**');
});
test('** внутри сегмента - обычная звезда', () => {
  yes('axb', 'a**b');
  yes('ab', 'a**b');
  no('a/b', 'a**b');
  no('a/x/b', 'a**b');
  no('x/y.js', '**.js');
  yes('y.js', '**.js');
});
test('классы и диапазоны', () => {
  yes('a', '[abc]');
  yes('c', '[abc]');
  no('d', '[abc]');
  no('ab', '[abc]');
  yes('m', '[a-z]');
  no('M', '[a-z]');
  yes('5', '[0-9]');
  yes('b-', '[a-c]-');
  yes('-', '[a-]');
  yes('-', '[-a]');
  no('b', '[a-]');
  yes('x1.txt', '[a-z][0-9].txt');
  yes('q', '[a-cx-z0q]');
  no('d', '[a-cx-z0q]');
});
test('отрицание классов', () => {
  yes('d', '[!abc]');
  no('a', '[!abc]');
  yes('5', '[!a-z]');
  no('m', '[!a-z]');
  no('/', '[!a]');
  no('a/b', 'a[!x]b');
  yes('!', '[a!]');
  yes('a', '[a!]');
  no('b', '[a!]');
});
test('класс никогда не совпадает с /', () => {
  no('a/b', 'a[/]b');
  no('a/b', 'a[!x]b');
  no('a/b', 'a[+-0]b');
  yes('a.b', 'a[+-0]b');
  yes('a,b', 'a[+-0]b');
});
test('внутри класса спецсимволы - литералы', () => {
  yes('{', '[{}]');
  yes('}', '[{}]');
  yes(',', '[{,]');
  yes('*', '[*?]');
  yes('?', '[*?]');
  no('a', '[*?]');
  yes('x,', 'x[,}]');
  yes('x}', 'x[,}]');
  yes('x,', 'x{[,},],}');
  yes('x', 'x{[,},],}');
  yes('x}', 'x{[,},],}');
  no('xa', 'x{[,},],}');
});
test('фигурные скобки и вложенность', () => {
  yes('a', '{a,b}');
  yes('b', '{a,b}');
  no('c', '{a,b}');
  no('ab', '{a,b}');
  yes('x.js', 'x.{js,ts}');
  yes('x.ts', 'x.{js,ts}');
  no('x.css', 'x.{js,ts}');
  for (const p of ['a', 'b', 'c']) yes(p, '{a,{b,c}}');
  no('d', '{a,{b,c}}');
  yes('a1', '{a,b}{1,2}');
  yes('b2', '{a,b}{1,2}');
  no('a3', '{a,b}{1,2}');
  yes('q-z', '{p,{q,{r,s}}}-z');
  yes('s-z', '{p,{q,{r,s}}}-z');
});
test('скобки: пустая ветка, одна ветка, запятая вне скобок, / и ** в ветках', () => {
  yes('a', 'a{,b}');
  yes('ab', 'a{,b}');
  no('abb', 'a{,b}');
  yes('a', 'a{b,}');
  yes('ab', 'a{b,}');
  yes('ab', 'a{b}');
  no('a{b}', 'a{b}');
  yes('a,b', 'a,b');
  no('a', 'a,b');
  yes('a/b', '{a/b,c}');
  yes('c', '{a/b,c}');
  no('a', '{a/b,c}');
  yes('x/y/z', '{x/**,w}');
  yes('x', '{x/**,w}');
  yes('w', '{x/**,w}');
  no('w/q', '{x/**,w}');
  yes('src/a/b/t.js', 'src/{**/t.js,x}');
  yes('src/t.js', 'src/{**/t.js,x}');
  yes('src/x', 'src/{**/t.js,x}');
  yes('m/q', '{m,n}/{p,q}');
  no('m/r', '{m,n}/{p,q}');
});
test('экранирование', () => {
  yes('a*b', String.raw`a\*b`);
  no('axb', String.raw`a\*b`);
  yes('a?b', String.raw`a\?b`);
  no('axb', String.raw`a\?b`);
  yes('[a]', String.raw`\[a]`);
  no('a', String.raw`\[a]`);
  yes('{a,b}', String.raw`\{a\,b}`);
  yes('a,b', String.raw`{a\,b}`);
  no('a', String.raw`{a\,b}`);
  yes('a\\b', String.raw`a\\b`);
  yes('a', String.raw`\a`);
  yes(']', String.raw`[\]]`);
  yes('-', String.raw`[a\-z]`);
  yes('z', String.raw`[a\-z]`);
  no('m', String.raw`[a\-z]`);
  yes('**', String.raw`\*\*`);
  no('x', String.raw`\*\*`);
  yes('.env', String.raw`\.env`);
  yes('.env', String.raw`\.*`);
});
test('точечные файлы: * ? [] не берут ведущую точку', () => {
  no('.env', '*');
  no('.env', '*env');
  no('.a', '?a');
  no('.a', '[.]a');
  no('.a', '[!x]a');
  no('src/.env', 'src/*');
  no('.git/config', '*/config');
  yes('.env', '.env');
  yes('.env', '.*');
  yes('.env.local', '.*');
  yes('.env', String.raw`\.*`);
  yes('src/.env', 'src/.*');
  yes('a.b', 'a?b');
  yes('a.b', 'a*');
  yes('x/a.b', '*/a?b');
  yes('.hidden', '.h*');
  yes('.a', '.?');
});
test('точечные файлы: ** не проходит через точечные сегменты', () => {
  no('.d/x', '**/x');
  no('a/.d/x', '**/x');
  no('a/.d/b', 'a/**/b');
  no('a/.x', 'a/**');
  no('a/.x/y', 'a/**');
  no('.x', '**');
  yes('a/b/x', '**/x');
  yes('a/.d/x', 'a/.d/**/x');
  yes('.d/x', '.d/**/x');
  yes('.d/e/x', '.d/**/x');
  yes('a/.d/x', '**/.d/x');
  yes('.cfg', '**/.cfg');
  yes('x/y/.cfg', '**/.cfg');
  no('x/y/.cfg', '**/*cfg');
  yes('x/y/.cfg', '**/.*');
});
test('точечные файлы и скобки: судится каждая ветка', () => {
  yes('a', '{*,.x}');
  yes('.x', '{*,.x}');
  no('.y', '{*,.x}');
  yes('.a', '{.a,b}');
  yes('.ab', '{.a,b}*');
  no('.bb', '{.a,b}*');
  yes('bb', '{.a,b}*');
  no('.git/x', '{*,x}/x');
  yes('.git/x', '{.git,x}/x');
});
test('SyntaxError: незакрытые [ и {', () => {
  for (const bad of ['[', 'a[b', '[abc', '[!abc', '{', '{a', '{a,b', 'x/{a,{b,c}', 'a{b,c', '[a-', String.raw`[\]`, String.raw`{a\}`]) {
    assert.throws(() => globToRegExp(bad), SyntaxError, bad);
    assert.throws(() => isMatch('a', bad), SyntaxError, bad);
  }
});
test('SyntaxError: одиночный \\ в конце, пустой класс, перевёрнутый диапазон', () => {
  for (const bad of ['\\', 'a\\', 'a/b\\', '[]', 'a[]b', '[!]', 'a[!]', '[z-a]', 'x[9-0]', '[b-a]y']) {
    assert.throws(() => globToRegExp(bad), SyntaxError, bad);
  }
  assert.doesNotThrow(() => globToRegExp(String.raw`a\\`));
  assert.doesNotThrow(() => globToRegExp('[a-a]'));
});
test('комбинации правил', () => {
  yes('src/lib/deep/util.test.ts', 'src/**/*.{test,spec}.{js,ts}');
  yes('src/a.spec.js', 'src/**/*.{test,spec}.{js,ts}');
  no('src/a.spec.css', 'src/**/*.{test,spec}.{js,ts}');
  no('src/.hid/a.spec.js', 'src/**/*.{test,spec}.{js,ts}');
  no('src/lib/.a.spec.js', 'src/**/*.{test,spec}.{js,ts}');
  yes('src/lib/.a.spec.js', 'src/**/.*.spec.js');
  yes('v1/a.js', 'v[0-9]/[!_]*.js');
  no('v1/_a.js', 'v[0-9]/[!_]*.js');
  no('vx/a.js', 'v[0-9]/[!_]*.js');
  yes('a/b/c/d', '**/b/**/d');
  yes('b/d', '**/b/**/d');
  no('a/c/d', '**/b/**/d');
  yes('x/y', '**/**/y');
});
