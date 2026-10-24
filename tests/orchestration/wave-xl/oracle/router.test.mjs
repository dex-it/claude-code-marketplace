import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const { Router } = await load('src/router.js');

const h = (n) => ({ n });
const isPlainError = (e) => e instanceof Error && !(e instanceof TypeError);

test('add: возвращает роутер, цепочка', () => {
  const r = new Router();
  assert.equal(r.add('GET', '/a', h(1)), r);
  assert.equal(r.add('get', '/b', h(2)).add('POST', '/b', h(3)), r);
});
test('match: статический маршрут и корень', () => {
  const a = h('a'), root = h('root');
  const r = new Router().add('GET', '/a/b', a).add('GET', '/', root);
  assert.deepEqual(r.match('GET', '/a/b'), { handler: a, params: {} });
  assert.equal(r.match('GET', '/a/b').handler, a);
  assert.deepEqual(r.match('GET', '/'), { handler: root, params: {} });
  assert.deepEqual(r.match('GET', '/a'), { status: 404 });
});
test('match: :name берёт один непустой сегмент', () => {
  const u = h('u');
  const r = new Router().add('GET', '/u/:id', u).add('GET', '/p/:a/:b', u);
  assert.deepEqual(r.match('GET', '/u/42').params, { id: '42' });
  assert.deepEqual(r.match('GET', '/p/x/y').params, { a: 'x', b: 'y' });
  assert.deepEqual(r.match('GET', '/u'), { status: 404 });
  assert.deepEqual(r.match('GET', '/u/'), { status: 404 });
  assert.deepEqual(r.match('GET', '/u//'), { status: 404 });
  assert.deepEqual(r.match('GET', '/u/1/2'), { status: 404 });
});
test('match: *name берёт остаток, в том числе пустой', () => {
  const f = h('f');
  const r = new Router().add('GET', '/f/*p', f);
  assert.deepEqual(r.match('GET', '/f/x/y/z').params, { p: 'x/y/z' });
  assert.deepEqual(r.match('GET', '/f/x/y/').params, { p: 'x/y' });
  assert.deepEqual(r.match('GET', '/f').params, { p: '' });
  assert.deepEqual(r.match('GET', '/f/').params, { p: '' });
  const root = new Router().add('GET', '/*all', f);
  assert.deepEqual(root.match('GET', '/').params, { all: '' });
  assert.deepEqual(root.match('GET', '/q/w').params, { all: 'q/w' });
});
test('приоритет: статический > параметр > wildcard', () => {
  const s = h('s'), p = h('p'), w = h('w');
  const r = new Router().add('GET', '/a/*r', w).add('GET', '/a/:x', p).add('GET', '/a/b', s);
  assert.equal(r.match('GET', '/a/b').handler, s);
  assert.equal(r.match('GET', '/a/c').handler, p);
  assert.equal(r.match('GET', '/a/c/d').handler, w);
  assert.equal(r.match('GET', '/a').handler, w);
});
test('откат: ветка высокого приоритета не дошла до конца', () => {
  const s = h('s'), p = h('p'), w = h('w');
  const r = new Router().add('GET', '/a/b/c', s).add('GET', '/a/:x/d', p).add('GET', '/a/*r', w);
  assert.deepEqual(r.match('GET', '/a/b/c'), { handler: s, params: {} });
  assert.deepEqual(r.match('GET', '/a/b/d'), { handler: p, params: { x: 'b' } });
  assert.deepEqual(r.match('GET', '/a/b/e'), { handler: w, params: { r: 'b/e' } });
  assert.deepEqual(r.match('GET', '/a/q/d'), { handler: p, params: { x: 'q' } });
});
test('откат: у статической ветки нет обработчика этого метода', () => {
  const g = h('g'), po = h('po');
  const r = new Router().add('GET', '/a/b', g).add('POST', '/a/:x', po);
  assert.deepEqual(r.match('POST', '/a/b'), { handler: po, params: { x: 'b' } });
  assert.equal(r.match('GET', '/a/b').handler, g);
});
test('нормализация: завершающий слэш и query', () => {
  const a = h('a');
  const r = new Router().add('GET', '/a/', a).add('GET', '/b/:id/', a);
  assert.equal(r.match('GET', '/a').handler, a);
  assert.equal(r.match('GET', '/a/').handler, a);
  assert.equal(r.match('GET', '/a?x=1').handler, a);
  assert.equal(r.match('GET', '/a/?x=1/2').handler, a);
  assert.deepEqual(r.match('GET', '/b/7/?q=%E0').params, { id: '7' });
  assert.deepEqual(new Router().add('GET', '/', a).match('GET', '/?z=1').params, {});
});
test('параметры декодируются, некорректная escape-последовательность - не совпадение', () => {
  const a = h('a');
  const r = new Router().add('GET', '/u/:id', a).add('GET', '/f/*p', a);
  assert.deepEqual(r.match('GET', '/u/a%20b').params, { id: 'a b' });
  assert.deepEqual(r.match('GET', '/u/a%2Fb').params, { id: 'a/b' });
  assert.deepEqual(r.match('GET', '/u/%D0%B9').params, { id: 'й' });
  assert.deepEqual(r.match('GET', '/f/x%2Fy/z%20w').params, { p: 'x/y/z w' });
  assert.deepEqual(r.match('GET', '/u/%E0%A4%A'), { status: 404 });
  assert.deepEqual(r.match('GET', '/f/ok/%'), { status: 404 });
});
test('битая escape в ветке: откат к другой ветке', () => {
  const p = h('p'), s = h('s');
  const r = new Router().add('GET', '/a/:x/b', p).add('GET', '/a/%/b', s);
  assert.equal(r.match('GET', '/a/%/b').handler, s);
  assert.deepEqual(r.match('GET', '/a/%41/b').params, { x: 'A' });
});
test('статический сегмент сравнивается без декодирования', () => {
  const s = h('s'), p = h('p');
  const r = new Router().add('GET', '/a b', s).add('GET', '/:x', p);
  assert.equal(r.match('GET', '/a%20b').handler, p);
  assert.deepEqual(r.match('GET', '/a%20b').params, { x: 'a b' });
});
test('методы регистронезависимы', () => {
  const a = h('a');
  const r = new Router().add('pOsT', '/x', a);
  assert.equal(r.match('post', '/x').handler, a);
  assert.equal(r.match('POST', '/x').handler, a);
  assert.deepEqual(r.match('get', '/x'), { status: 405, allow: ['POST'] });
});
test('HEAD: запасной вариант GET, собственный HEAD приоритетнее', () => {
  const g = h('g'), hd = h('hd');
  const r = new Router().add('GET', '/a', g).add('GET', '/b', g).add('HEAD', '/b', hd);
  assert.equal(r.match('HEAD', '/a').handler, g);
  assert.equal(r.match('head', '/b').handler, hd);
  assert.equal(r.match('GET', '/b').handler, g);
});
test('HEAD: сначала весь поиск для HEAD, потом для GET', () => {
  const gs = h('gs'), hp = h('hp');
  const r = new Router().add('GET', '/a/b', gs).add('HEAD', '/a/:x', hp);
  assert.deepEqual(r.match('HEAD', '/a/b'), { handler: hp, params: { x: 'b' } });
  assert.equal(r.match('GET', '/a/b').handler, gs);
});
test('405: allow из всех подошедших шаблонов, отсортирован, без дублей', () => {
  const a = h('a');
  const r = new Router().add('post', '/p', a).add('DELETE', '/p', a).add('PUT', '/:x', a).add('GET', '/other', a);
  assert.deepEqual(r.match('GET', '/p'), { status: 405, allow: ['DELETE', 'POST', 'PUT'] });
  assert.deepEqual(r.match('HEAD', '/p'), { status: 405, allow: ['DELETE', 'POST', 'PUT'] });
  assert.deepEqual(r.match('PUT', '/p').params, { x: 'p' });
  assert.deepEqual(r.match('POST', '/zzz'), { status: 405, allow: ['PUT'] });
});
test('404: ни один шаблон не подходит ни с каким методом', () => {
  const r = new Router().add('GET', '/a/:x', h(1));
  assert.deepEqual(r.match('GET', '/b'), { status: 404 });
  assert.deepEqual(r.match('POST', '/a'), { status: 404 });
  assert.deepEqual(new Router().match('GET', '/'), { status: 404 });
});
test('add: TypeError на неверный шаблон и аргументы', () => {
  const r = new Router();
  for (const bad of ['a', 'a/b', '', '/a/:', '/:', '/a/*', '/*', '/a/*r/b', '/*r/:x']) {
    assert.throws(() => r.add('GET', bad, h(0)), TypeError, JSON.stringify(bad));
  }
  assert.throws(() => r.add(1, '/a', h(0)), TypeError);
  assert.throws(() => r.add('GET', null, h(0)), TypeError);
  assert.deepEqual(r.match('GET', '/a'), { status: 404 });
});
test('add: дубль - Error, не TypeError', () => {
  const r = new Router().add('GET', '/a', h(1)).add('GET', '/u/:id', h(2)).add('GET', '/f/*p', h(3)).add('GET', '/', h(4));
  for (const [m, p] of [['GET', '/a'], ['get', '/a/'], ['GET', '/u/:uid'], ['GET', '/u/:id/'], ['GET', '/f/*rest'], ['GET', '/']]) {
    assert.throws(() => r.add(m, p, h(9)), isPlainError, `${m} ${p}`);
  }
});
test('add: не дубль - другой метод, :name против *name, другая форма', () => {
  const r = new Router();
  r.add('GET', '/a/:x', h(1)).add('POST', '/a/:x', h(2)).add('GET', '/a/*x', h(3)).add('GET', '/a/:x/b', h(4)).add('GET', '/a/b', h(5));
  assert.deepEqual(r.match('GET', '/a/q/b').params, { x: 'q' });
  assert.deepEqual(r.match('GET', '/a/q/r/s').params, { x: 'q/r/s' });
});
