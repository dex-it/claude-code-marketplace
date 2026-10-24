const W = 10, H = 20
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
}
const rot = (m) => m.map((row, r) => row.map((_, c) => m[m.length - 1 - c][r]))

export function createGame({ sequence = [], seed = 1 } = {}) {
  const M = process.env.REF_MUTANT ?? ''
  const shape = (t) => SHAPES[M === 'shape' && t === 'S' ? 'Z' : t]
  const board = Array.from({ length: H }, () => Array(W).fill(0))
  const queue = [...sequence]
  let bag = [], rnd = seed
  const draw = () => {
    if (queue.length) return queue.shift()
    if (!bag.length) {
      bag = [...'IOTSZJL']
      for (let i = bag.length - 1; i > 0; i--) {
        rnd = (rnd * 1103515245 + 12345) % 2147483648
        const j = rnd % (i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]]
      }
    }
    return bag.pop()
  }
  let cur = null, next = draw(), score = 0, lines = 0, over = false
  const level = () => Math.floor(lines / 10) + 1
  const cells = (p) => p.m.flatMap((row, r) => row.flatMap((v, c) => (v ? [[p.x + c, p.y + r]] : [])))
  const fits = (p, lateral = false) => cells(p).every(([x, y]) =>
    x >= (M === 'wall' ? -1 : 0) && x < W && y < (M === 'floor' ? H - 1 : H) && (y < 0 || (M === 'lateral' && lateral) || !board[y][x]))

  const spawn = () => {
    const t = next
    next = draw()
    cur = { type: t, m: shape(t), x: t === 'O' ? 4 : 3, y: 0 }
    if (!fits(cur) && M !== 'no-over') { over = true; cur = null }
  }
  const clear = () => {
    let full = board.map((row, y) => (row.every(Boolean) ? y : -1)).filter((y) => y >= 0)
    if (M === 'multi-clear') full = full.slice(-1)
    for (const y of full) {
      if (M === 'no-shift') board[y].fill(0)
      else { board.splice(y, 1); board.unshift(Array(W).fill(0)) }
    }
    const n = full.length
    score += (M === 'score-flat' ? 100 * n : [0, 100, 300, 500, 800][n]) * level()
    lines += n
  }
  const lock = () => {
    for (const [x, y] of cells(cur)) if (y >= 0) board[y][x] = 1
    clear()
    spawn()
  }
  const move = (dx, dy) => {
    const p = { ...cur, x: cur.x + dx, y: cur.y + dy }
    if (!fits(p, dx !== 0)) return false
    cur = p
    return true
  }
  const live = (f) => () => { if (!over && cur) f() }

  spawn()
  return {
    left: live(() => move(-1, 0)),
    right: live(() => move(1, 0)),
    rotate: live(() => {
      const p = { ...cur, m: rot(cur.m) }
      if (M === 'rotate-wall' || fits(p)) cur = p
    }),
    tick: live(() => {
      if (!move(0, 1)) return lock()
      if (M === 'gravity') move(0, 1)
    }),
    softDrop: live(() => { if (!move(0, 1)) lock() }),
    hardDrop: live(() => { while (move(0, 1)); lock() }),
    snapshot: () => ({
      board: board.map((r) => r.map((v) => (v ? '#' : '.')).join('')),
      active: cur ? cells(cur) : null,
      next, score, lines, level: level(), over,
    }),
  }
}
