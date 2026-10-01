import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

for (const v of ['ORACLE_ADAPTER', 'ORACLE_REPO']) if (!process.env[v]) throw new Error(`не задан ${v}`)
const A = await import(pathToFileURL(resolve(process.env.ORACLE_ADAPTER)).href)
const REPO = resolve(process.env.ORACLE_REPO)

const game = (sequence) => A.start(REPO, sequence)
const st = async (g) => A.state(g)
const act = async (g, name, n = 1) => { for (let i = 0; i < n; i++) await A.act(g, name) }

const xs = (cs) => cs.map((c) => c[0])
const minX = (cs) => Math.min(...xs(cs))
const maxX = (cs) => Math.max(...xs(cs))
const maxY = (cs) => Math.max(...cs.map((c) => c[1]))
const flat = (cs) => new Set(cs.map((c) => c[1])).size === 1
const upright = (cs) => new Set(xs(cs)).size === 1
const filled = (s) => s.board.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '#' ? [[x, y]] : [])))
const empty = (s) => s.board.every((row) => !row.includes('#'))
const legal = (s) => {
  assert.ok(s.active.every(([x, y]) => x >= 0 && x < 10 && y < 20), `фигура вне поля: ${JSON.stringify(s.active)}`)
  assert.ok(s.active.every(([x, y]) => y < 0 || s.board[y][x] !== '#'), `фигура в лежащих блоках: ${JSON.stringify(s.active)}`)
}

const norm = (cs) => {
  const x0 = Math.min(...xs(cs)), y0 = Math.min(...cs.map((c) => c[1]))
  return cs.map(([x, y]) => `${x - x0},${y - y0}`).sort().join(' ')
}
const rotations = (cs) => {
  const out = new Set()
  for (let i = 0, c = cs; i < 4; i++, c = c.map(([x, y]) => [y, -x])) out.add(norm(c))
  return out
}
const CANON = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

// Фигура приземляется гравитацией, а не сбросом: очки за сброс не должны входить в сравнение очков за ряды.
const land = async (g) => {
  const before = (await st(g)).board.join('')
  for (let i = 0; i < 60; i++) {
    await act(g, 'tick')
    if ((await st(g)).board.join('') !== before) return
  }
  assert.fail('фигура не легла за 60 шагов гравитации')
}
const place = async (g, x, { shape = () => true, drop = 'hardDrop' } = {}) => {
  for (let i = 0; i < 4 && !shape((await st(g)).active); i++) await act(g, 'rotate')
  assert.ok(shape((await st(g)).active), 'нужная ориентация не достигнута поворотом')
  await act(g, 'left', 10)
  for (let i = 0; i < 10 && minX((await st(g)).active) < x; i++) await act(g, 'right')
  assert.equal(minX((await st(g)).active), x, 'фигура не встала в нужный столбец')
  if (drop === 'tick') await land(g)
  else await act(g, 'hardDrop')
}

test('T1 поле 10x20, пустое на старте, фигура из четырёх клеток', async () => {
  const s = await st(await game(['T', 'O']))
  assert.equal(s.board.length, 20)
  for (const row of s.board) assert.equal(row.length, 10)
  assert.ok(empty(s))
  assert.equal(s.active.length, 4)
})

test('T2 семь фигур правильной формы', async () => {
  for (const t of 'IOTSZJL') {
    const s = await st(await game([t, 'O']))
    assert.ok(rotations(CANON[t]).has(norm(s.active)), `${t}: ${norm(s.active)}`)
  }
})

test('T3 фигура не проходит сквозь боковые стены', async () => {
  for (const t of 'IOTSZJL') {
    const g = await game([t, 'O'])
    await act(g, 'left', 12)
    assert.equal(minX((await st(g)).active), 0, `${t} у левой стены`)
    await act(g, 'right', 12)
    assert.equal(maxX((await st(g)).active), 9, `${t} у правой стены`)
  }
})

test('T4 фигура ложится на пол и на лежащую фигуру', async () => {
  const g = await game(['O', 'O', 'T'])
  await act(g, 'hardDrop')
  const a = filled(await st(g))
  assert.equal(a.length, 4)
  assert.deepEqual([...new Set(a.map((c) => c[1]))].sort(), [18, 19])
  await act(g, 'hardDrop')
  const b = filled(await st(g))
  assert.equal(b.length, 8)
  assert.deepEqual([...new Set(b.map((c) => c[1]))].sort(), [16, 17, 18, 19])
})

test('T5 фигура не проходит сбоку сквозь лежащие блоки', async () => {
  const g = await game(['I', 'O', 'T'])
  await place(g, 5, { shape: upright })
  await act(g, 'left', 10)
  for (let i = 0; i < 25 && maxY((await st(g)).active) < 17; i++) await act(g, 'softDrop')
  assert.equal(maxY((await st(g)).active), 17)
  await act(g, 'right', 10)
  const s = await st(g)
  legal(s)
  assert.equal(maxX(s.active), 4)
})

test('T6 поворот не выводит фигуру за стену и в лежащие блоки', async () => {
  for (const t of 'IJLSTZ') {
    for (const side of ['left', 'right']) {
      const g = await game([t, 'O'])
      await act(g, side, 12)
      for (let i = 0; i < 4; i++) {
        await act(g, 'rotate')
        await act(g, side, 12)
        legal(await st(g))
      }
    }
  }
  const g = await game(['I', 'I', 'T'])
  await place(g, 3, { shape: upright })
  for (let i = 0; i < 4 && !upright((await st(g)).active); i++) await act(g, 'rotate')
  await act(g, 'left', 10)
  for (let i = 0; i < 10 && minX((await st(g)).active) < 4; i++) await act(g, 'right')
  for (let i = 0; i < 25 && maxY((await st(g)).active) < 18; i++) await act(g, 'softDrop')
  assert.deepEqual([minX((await st(g)).active), maxY((await st(g)).active)], [4, 18])
  for (let i = 0; i < 4; i++) {
    await act(g, 'rotate')
    legal(await st(g))
  }
})

test('T7 два ряда, собранные одной фигурой, убираются за один ход', async () => {
  const g = await game(['O', 'O', 'O', 'O', 'O', 'T'])
  for (const x of [0, 2, 4, 6, 8]) await place(g, x)
  assert.ok(empty(await st(g)), (await st(g)).board.join('\n'))
})

test('T8 ряды выше убранных опускаются', async () => {
  const g = await game(['O', 'O', 'O', 'O', 'O', 'O', 'T'])
  for (const x of [0, 0, 2, 4, 6, 8]) await place(g, x)
  assert.deepEqual(filled(await st(g)).map(String).sort(), ['0,18', '0,19', '1,18', '1,19'])
})

test('T9 два ряда одной фигурой дают больше очков, чем два ряда по одному', async () => {
  const a = await game(['O', 'O', 'O', 'O', 'O', 'T'])
  for (const x of [0, 2, 4, 6, 8]) await place(a, x, { drop: 'tick' })
  const sa = await st(a)
  assert.ok(empty(sa))
  const b = await game(['O', 'I', 'I', 'I', 'I', 'T'])
  await place(b, 8, { drop: 'tick' })
  for (const x of [0, 4, 0, 4]) await place(b, x, { shape: flat, drop: 'tick' })
  const sb = await st(b)
  assert.ok(empty(sb), sb.board.join('\n'))
  assert.ok(Number(sb.score) > 0, `очки за ряды: ${sb.score}`)
  assert.ok(Number(sa.score) > Number(sb.score), `двойной ${sa.score}, два одиночных ${sb.score}`)
})

test('T10 конец игры, когда новой фигуре нет места; после него поле не меняется', async () => {
  const g = await game(Array(40).fill('O'))
  for (let i = 0; i < 15 && !(await st(g)).over; i++) await act(g, 'hardDrop')
  const s = await st(g)
  assert.equal(s.over, true)
  for (const name of ['left', 'right', 'rotate', 'softDrop', 'hardDrop', 'tick']) await act(g, name)
  assert.deepEqual((await st(g)).board, s.board)
})

test('T11 шаг гравитации опускает фигуру на один ряд', async () => {
  const g = await game(['T', 'O'])
  const a = (await st(g)).active
  await act(g, 'tick')
  assert.equal(norm((await st(g)).active), norm(a))
  assert.deepEqual((await st(g)).active.map(String).sort(), a.map(([x, y]) => `${x},${y + 1}`).sort())
})

test('T12 следующая фигура показана и приходит следующей', async () => {
  const g = await game(['T', 'S', 'Z', 'O'])
  assert.equal((await st(g)).next, 'S')
  await act(g, 'hardDrop')
  const s = await st(g)
  assert.ok(rotations(CANON.S).has(norm(s.active)))
  assert.equal(s.next, 'Z')
})
