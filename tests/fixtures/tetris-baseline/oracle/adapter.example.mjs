import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Контракт адаптера: судья пишет такой файл на каждое плечо по README и коду игры плеча; логику игры адаптер не несёт.
export async function start(repo, sequence) {
  const { createGame } = await import(pathToFileURL(join(repo, 'game.mjs')).href)
  return { game: createGame({ sequence }) }
}

// name: left | right | rotate | softDrop | hardDrop | tick (один шаг гравитации).
export function act(ctx, name) {
  ctx.game[name]()
}

// board - 20 строк по 10 символов, `#` только лежащие блоки; active - клетки [x, y] падающей фигуры, y=0 сверху;
// next - буква следующей фигуры (IOTSZJL); score - число или строка числа; over - строго true после конца игры.
export function state(ctx) {
  const s = ctx.game.snapshot()
  return { board: s.board, active: s.active, next: s.next, score: s.score, over: s.over }
}
