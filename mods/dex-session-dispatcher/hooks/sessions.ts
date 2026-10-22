// Сессии Claude Code на этой машине, как их отдаёт `claude agents --json`:
// разбор ответа, слова для человека, порядок внимания и выбор сессии по тому,
// что человек набрал (номер, имя, начало id). Модуль чистый: `$` не знает.

import { oneLine, quote, snippet } from './transcript.ts'

export type Kind = 'interactive' | 'background'

/** Что с сессией, словами, которые понятны без знания внутренностей. */
export type Phase = 'waiting' | 'failed' | 'working' | 'idle' | 'done' | 'stopped' | 'unknown'

export type SessionRow = {
  /** Полный UUID сессии: ключ, по которому ей пишут и ищут транскрипт. */
  sessionId: string
  /** Короткий id фоновой сессии: его принимают `attach`, `logs`, `stop`, `rm`. */
  shortId: string
  name: string
  cwd: string
  kind: Kind
  phase: Phase
  /** Чего сессия ждёт, если ждёт. */
  waitingFor: string
  startedAt: number
  pid: number | null
}

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Фаза из двух полей, которые CLI отдаёт по-разному: у окон терминала есть
 * `status` (`busy` / `idle` / `waiting`), у фоновых - `state` (`working` /
 * `blocked` / `done` / `failed` / `stopped`). Нужны оба: ни одно не полное.
 */
export function phaseOf(status: string, state: string): Phase {
  if (state === 'failed') return 'failed'
  if (state === 'blocked' || status === 'waiting') return 'waiting'
  if (state === 'stopped') return 'stopped'
  if (state === 'done') return 'done'
  if (state === 'working' || status === 'busy') return 'working'
  if (status === 'idle') return 'idle'

  return 'unknown'
}

export const PHASE_WORD: Record<Phase, string> = {
  waiting: 'ждёт вас',
  failed: 'упала',
  working: 'работает',
  idle: 'свободна',
  done: 'готово',
  stopped: 'остановлена',
  unknown: 'неизвестно',
}

/** Подсказка новичку: что с сессией делать, когда она в этой фазе. */
export const PHASE_HINT: Record<Phase, string> = {
  waiting: 'Ей нужен ваш ответ или разрешение. Откройте её и ответьте.',
  failed: 'Закончилась ошибкой. Посмотрите вывод и при необходимости запустите заново.',
  working: 'Идёт работа, вмешиваться не нужно.',
  idle: 'Ждёт следующего задания. Можно отправить ей сообщение.',
  done: 'Работа закончена. Прочитайте итог и удалите сессию, если она не нужна.',
  stopped: 'Остановлена, разговор сохранён. Вернуться к ней можно через «открыть».',
  unknown: 'Состояние не определено.',
}

/** Чем выше, тем раньше в списке: сначала то, что требует человека. */
const PHASE_ORDER: Record<Phase, number> = {
  waiting: 0,
  failed: 1,
  working: 2,
  idle: 3,
  done: 4,
  stopped: 5,
  unknown: 6,
}

export const isFinished = (phase: Phase): boolean => phase === 'done' || phase === 'stopped'

/** Разбор вывода `claude agents --json`; не массив или мусор - пустой список. */
export function parseAgents(raw: string): SessionRow[] {
  let data: unknown

  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(data)) return []

  const rows: SessionRow[] = []

  for (const item of data) {
    const node = rec(item)
    const sessionId = text(node.sessionId)

    if (sessionId === '') continue

    const kind: Kind = node.kind === 'background' ? 'background' : 'interactive'
    const id = text(node.id)

    rows.push({
      sessionId,
      shortId: id !== '' ? id : sessionId.slice(0, 8),
      // Имя и ожидание пишет чужая сессия, а читает модель этой: одной строкой. Имя - адрес
      // в командах, поэтому без маски и обрезки: иначе по настоящему имени сессию не найти.
      name: oneLine(text(node.name)) !== '' ? oneLine(text(node.name)) : sessionId.slice(0, 8),
      cwd: text(node.cwd),
      kind,
      phase: phaseOf(text(node.status), text(node.state)),
      waitingFor: snippet(text(node.waitingFor), 160),
      startedAt: typeof node.startedAt === 'number' ? node.startedAt : 0,
      pid: typeof node.pid === 'number' ? node.pid : null,
    })
  }

  return rows
}

/** Порядок внимания; внутри фазы - свежие первыми. Исходный массив не меняется. */
export function ordered(rows: readonly SessionRow[]): SessionRow[] {
  return [...rows].sort(
    (a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || b.startedAt - a.startedAt,
  )
}

export type Tally = Record<Phase, number> & { total: number }

export function tallyOf(rows: readonly SessionRow[]): Tally {
  const tally: Tally = {
    waiting: 0,
    failed: 0,
    working: 0,
    idle: 0,
    done: 0,
    stopped: 0,
    unknown: 0,
    total: rows.length,
  }

  for (const row of rows) tally[row.phase] += 1

  return tally
}

/** Итог одной строкой: сначала то, что требует человека. */
export function tallyLine(tally: Tally): string {
  if (tally.total === 0) return 'Сессий нет.'

  const parts: string[] = []

  if (tally.waiting > 0) parts.push(`ждут вас: ${tally.waiting}`)
  if (tally.failed > 0) parts.push(`упали: ${tally.failed}`)
  if (tally.working > 0) parts.push(`работают: ${tally.working}`)
  if (tally.idle > 0) parts.push(`свободны: ${tally.idle}`)
  if (tally.done > 0) parts.push(`готовы: ${tally.done}`)
  if (tally.stopped > 0) parts.push(`остановлены: ${tally.stopped}`)

  return `Сессий ${tally.total}: ${parts.join(', ')}.`
}

export type Pick = { row: SessionRow } | { error: string }

/**
 * Сессия по тому, что набрал человек: номер в списке (`2`), имя целиком или
 * его начало (`dp-31`), начало id. Номер читается по показанному списку, имя и
 * id - по всем сессиям: законченную, которой в списке нет, можно назвать. Неоднозначное - ошибка с перечнем, а не
 * молчаливый выбор первой: по ошибке остановить чужую работу дороже вопроса.
 */
export function pickSession(
  query: string,
  shown: readonly SessionRow[],
  all: readonly SessionRow[] = shown,
): Pick {
  const q = query.trim().replace(/^#/, '')

  if (q === '') return { error: 'Укажите сессию: номер из списка, имя или начало id.' }

  const lower = q.toLowerCase()
  // Короткий id - 8 hex-знаков и бывает из одних цифр: точный id проверяется до номера,
  // номера такой длины в списке не бывает.
  const byId = all.filter(row => row.shortId.toLowerCase() === lower || row.sessionId.toLowerCase() === lower)

  if (byId.length === 1 && byId[0]) return { row: byId[0] }

  if (/^\d+$/.test(q)) {
    const row = shown[Number(q) - 1]

    return row ? { row } : { error: `В списке нет сессии №${q}. Сейчас их ${shown.length}.` }
  }

  const exact = all.filter(row => row.name.toLowerCase() === lower)

  if (exact.length === 1 && exact[0]) return { row: exact[0] }

  const found = all.filter(
    row =>
      row.name.toLowerCase().startsWith(lower) ||
      row.shortId.toLowerCase().startsWith(lower) ||
      row.sessionId.toLowerCase().startsWith(lower),
  )

  if (found.length === 1 && found[0]) return { row: found[0] }

  if (found.length === 0) return { error: `Не нашёл сессию «${q}». Список: /sessions list.` }

  const names = found.map(row => `${quote(row.name)} (${row.shortId})`).join(', ')

  return { error: `«${q}» подходит нескольким сессиям: ${names}. Назовите имя целиком, начало id или номер из списка.` }
}

export type ActionPick = { row: SessionRow; isConfirmed: boolean } | { error: string }

/**
 * Сессия для действия, которое нельзя отозвать: остановка, удаление, отправка
 * поручения. Список переставляется каждые десять секунд, поэтому номер, набранный
 * по увиденному раньше списку, может указывать на другую сессию; имя тоже не
 * опора: имя фоновой сессии выводится из первых слов задачи (`nameFromTask`) и
 * повторяется между днями, а старой одноимённой в списке уже нет. `isConfirmed` -
 * сессия названа своим id, коротким или полным: только это подтверждает действие.
 * Номер, имя (хоть целиком) и начало имени или id лишь указывают сессию, и действие
 * просит повторить с её id.
 */
export function pickForAction(
  query: string,
  shown: readonly SessionRow[],
  all: readonly SessionRow[] = shown,
): ActionPick {
  const q = query.trim().replace(/^#/, '').toLowerCase()

  // id из одних цифр читается как id, а не как номер: короткий id (8 знаков) в номера не попадает.
  const byId = all.filter(row => row.shortId.toLowerCase() === q || row.sessionId.toLowerCase() === q)

  if (q !== '' && byId.length === 1 && byId[0]) return { row: byId[0], isConfirmed: true }

  const picked = pickSession(query, shown, all)

  return 'error' in picked ? picked : { row: picked.row, isConfirmed: false }
}
