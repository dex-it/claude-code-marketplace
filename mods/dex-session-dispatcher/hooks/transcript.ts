// Статистика сессии из её транскрипта (jsonl, по строке на запись). Читается
// кусками: первый раз - хвост файла, дальше - только дописанное, поэтому
// суммы честны с момента `since`, а не за всю жизнь сессии, и это сказано в
// интерфейсе. Модуль чистый; формат записей внутренний и меняется между
// версиями, поэтому каждое поле читается защитно, а не найденное - пусто.

export type Todo = { text: string; status: 'pending' | 'in_progress' | 'completed' }

export type Note = { who: string; text: string }

export type Stats = {
  /** Байт транскрипта, до которого прочитано: следующее чтение начнётся отсюда. */
  offset: number
  /** С какого байта читалось в первый раз: 0 - с начала файла, суммы полные. */
  since: number
  model: string
  title: string
  lastPrompt: string
  lastAnswer: string
  lastAt: string
  /** Сообщений человека (без служебных и без ответов инструментов). */
  prompts: number
  /** Ответов модели, то есть запросов к API. */
  calls: number
  outputTokens: number
  /** Новые входные токены: обычные и ушедшие в кэш. */
  inputTokens: number
  cacheReadTokens: number
  /** Занято в окне контекста на последнем ответе. */
  contextTokens: number
  skills: Record<string, number>
  tools: Record<string, number>
  /** Запущено субагентов (вызовов инструмента Agent), последние описания. */
  subagents: number
  subagentNotes: string[]
  todos: Todo[]
  /** Заголовок принятого плана, если сессия выходила из режима плана. */
  plan: string
  sent: Note[]
  received: Note[]
  pullRequests: string[]
  /** Запрос последнего учтённого ответа: блоки одного ответа считаются раз. */
  lastMessageId: string
}

export const emptyStats = (): Stats => ({
  offset: 0,
  since: 0,
  model: '',
  title: '',
  lastPrompt: '',
  lastAnswer: '',
  lastAt: '',
  prompts: 0,
  calls: 0,
  outputTokens: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  contextTokens: 0,
  skills: {},
  tools: {},
  subagents: 0,
  subagentNotes: [],
  todos: [],
  plan: '',
  sent: [],
  received: [],
  pullRequests: [],
  lastMessageId: '',
})

const KEEP_NOTES = 20
const KEEP_SUBAGENT_NOTES = 6
const SNIPPET = 240

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

export const SECRET_MASK = '[секрет скрыт]'

/**
 * Токеноподобные строки известных видов. Чужой промпт попадает в контекст этой
 * сессии, а с ним и вставленный в него ключ: лишнее копирование секрета в другой
 * проект и его сжатие. Это маска от случайного, а не защита от намеренного.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gl(?:pat|dt|ptt|rt)-[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\bnpm_[A-Za-z0-9]{36}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  // Начало без знака токена перед `eyJ`: иначе кандидатом стала бы каждая позиция внутри длинного куска.
  /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /(?<=\bAuthorization["']?[ \t]{0,3}[:=][ \t]{0,3}["']?Basic[ \t]{1,3})[A-Za-z0-9+/]{8,}={0,2}/gi,
  /(?<=:\/\/[^\s:/@]*:)[^\s@/]+(?=@)/g,
]

/** Значение кончается на разделителе, а не на точке кода или скобке вызова (`config.token`, `getToken()`). */
const endsValue = (whole: string, end: number): boolean => {
  const next = whole[end]

  if (next === undefined || /[\s"',;]/.test(next)) return true

  return next === '.' && (whole[end + 1] === undefined || /\s/.test(whole[end + 1] ?? ''))
}

// Условие за повтором в шаблоне перебиралось бы квадратично, потолок повтора пропускал бы длинный ключ: судит код.
const CHECKED_PATTERNS: readonly (readonly [RegExp, (value: string) => boolean])[] = [
  // Вне заголовка Basic - ключ, только если в нём цифра или `=`: иначе это слово или путь («Basic auth/flow»).
  [/\b[Bb]asic\s+[A-Za-z0-9+/]+={0,2}/g, value => /[0-9=]/.test(value) && value.replace(/^[Bb]asic\s+|=+$/g, '').length >= 12],
  // Значение - без точки, скобки и ведущей `/` (код и пути) и хотя бы с одной буквой (не счётчик).
  [
    /(?<=(?<![A-Za-z0-9])(?:password|passwd|secret|token|api[_-]?key)(?:[_-][A-Za-z0-9]+){0,4}["']?[ \t]{0,3}[=:][ \t]{0,3}["']?)(?!\/)[A-Za-z0-9_+/=!@#$%^&*~-]+/gi,
    value => value.length >= 8 && /[A-Za-z]/.test(value),
  ],
]

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g

/** Цвет терминала снимается до маски: код вплотную перед ключом съедает границу слова (`\x1b[0msk-...`). */
export const maskSecrets = (value: string): string =>
  CHECKED_PATTERNS.reduce(
    (text, [pattern, isSecret]) =>
      text.replace(pattern, (found: string, at: number, whole: string) =>
        isSecret(found) && endsValue(whole, at + found.length) ? SECRET_MASK : found,
      ),
    SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, SECRET_MASK), value.replace(ANSI, '')),
  )

/** Чужой текст одной строкой: без цвета, управляющих символов и переводов строк. Маски и обрезки нет. */
export const oneLine = (value: string): string =>
  value
    .replace(ANSI, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Однострочный фрагмент чужого текста: без секретов и управляющих символов, с потолком длины. */
export function snippet(value: string, limit = SNIPPET): string {
  const flat = oneLine(maskSecrets(value))

  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}

/** Чужое поле в кавычках; собственные кавычки внутри заменены, чтобы рамку нельзя было закрыть изнутри. */
export const quote = (value: string): string => `«${value.replace(/[«»]/g, '"')}»`

const push = <T>(list: T[], item: T, limit: number): void => {
  list.push(item)

  if (list.length > limit) list.splice(0, list.length - limit)
}

const bump = (map: Record<string, number>, key: string): void => {
  if (key === '') return

  map[key] = (map[key] ?? 0) + 1
}

/** Текст блоков `text` сообщения; строка целиком, если содержимое - строка. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content

  if (!Array.isArray(content)) return ''

  return content
    .map(block => {
      const node = rec(block)

      return node.type === 'text' ? str(node.text) : ''
    })
    .filter(part => part !== '')
    .join('\n')
}

const hasToolResult = (content: unknown): boolean =>
  Array.isArray(content) && content.some(block => rec(block).type === 'tool_result')

function todosOf(input: unknown): Todo[] | null {
  const list = rec(input).todos

  if (!Array.isArray(list)) return null

  const todos: Todo[] = []

  for (const item of list) {
    const node = rec(item)
    const status = str(node.status)
    const label = str(node.content) !== '' ? str(node.content) : str(node.subject)

    if (label === '') continue

    todos.push({
      text: snippet(label, 120),
      status: status === 'completed' || status === 'in_progress' ? status : 'pending',
    })
  }

  return todos
}

/** Первая осмысленная строка плана: заголовок, без решёток. */
function planTitle(plan: string): string {
  for (const line of plan.split('\n')) {
    const cleaned = line.replace(/^#+\s*/, '').trim()

    if (cleaned !== '') return snippet(cleaned, 120)
  }

  return ''
}

function onAssistant(stats: Stats, row: Record<string, unknown>): void {
  const message = rec(row.message)
  const id = str(row.requestId) !== '' ? str(row.requestId) : str(message.id)
  const usage = rec(message.usage)
  const content = Array.isArray(message.content) ? message.content : []

  // Ответ модели пишется строкой на блок, и usage повторяется в каждой: считаем
  // его один раз на запрос.
  if (id === '' || id !== stats.lastMessageId) {
    stats.lastMessageId = id

    if (Object.keys(usage).length > 0) {
      const fresh = num(usage.input_tokens) + num(usage.cache_creation_input_tokens)

      stats.calls += 1
      stats.outputTokens += num(usage.output_tokens)
      stats.inputTokens += fresh
      stats.cacheReadTokens += num(usage.cache_read_input_tokens)
      stats.contextTokens = fresh + num(usage.cache_read_input_tokens)
    }
  }

  if (str(message.model) !== '' && str(message.model) !== '<synthetic>') {
    stats.model = str(message.model)
  }

  const answer = textOf(content)

  if (answer.trim() !== '') stats.lastAnswer = snippet(answer)

  for (const block of content) {
    const node = rec(block)

    if (node.type !== 'tool_use') continue

    const name = str(node.name)
    const input = rec(node.input)

    bump(stats.tools, name)

    if (name === 'Skill') bump(stats.skills, snippet(str(input.skill), 80))

    if (name === 'Agent' || name === 'Task') {
      stats.subagents += 1
      push(
        stats.subagentNotes,
        snippet(str(input.description) || str(input.prompt), 90),
        KEEP_SUBAGENT_NOTES,
      )
    }

    if (name === 'TodoWrite') {
      const todos = todosOf(input)

      if (todos) stats.todos = todos
    }

    if (name === 'ExitPlanMode') stats.plan = planTitle(str(input.plan))

    if (name === 'SendMessage') {
      const body =
        typeof input.message === 'string' ? input.message : JSON.stringify(input.message ?? '')

      push(stats.sent, { who: snippet(str(input.to), 60), text: snippet(body) }, KEEP_NOTES)
    }
  }
}

function onUser(stats: Stats, row: Record<string, unknown>): void {
  if (row.isMeta === true || row.isCompactSummary === true) return

  const message = rec(row.message)
  const origin = rec(row.origin)
  const kind = str(origin.kind)

  if (hasToolResult(message.content)) return

  const body = textOf(message.content)

  if (kind === 'peer') {
    push(
      stats.received,
      { who: snippet(str(origin.name) || str(origin.from), 60), text: snippet(body) },
      KEEP_NOTES,
    )

    return
  }

  // Уведомления задач и прочие машинные вставки - не слова человека.
  if (kind !== '' && kind !== 'human' && kind !== 'user') return

  if (body.trim() === '') return

  stats.prompts += 1
  stats.lastPrompt = snippet(body)
}

/** Одна запись транскрипта в статистику. Мусорная строка пропускается молча. */
export function absorbLine(stats: Stats, line: string): void {
  let row: Record<string, unknown>

  try {
    row = rec(JSON.parse(line))
  } catch {
    return
  }

  const type = str(row.type)

  if (str(row.timestamp) !== '') stats.lastAt = str(row.timestamp)

  if (type === 'assistant') onAssistant(stats, row)
  else if (type === 'user') onUser(stats, row)
  else if (type === 'ai-title' && str(row.aiTitle) !== '') stats.title = snippet(str(row.aiTitle), 100)
  else if (type === 'pr-link' && str(row.prUrl) !== '') {
    if (!stats.pullRequests.includes(str(row.prUrl))) stats.pullRequests.push(str(row.prUrl))
  }
}

const encoder = new TextEncoder()

export type Chunk = {
  /** Текст, считанный начиная с байта `from`. */
  text: string
  /** Байт файла, с которого считан `text`. */
  from: number
}

/**
 * Влить прочитанный кусок в статистику. Кусок, начатый не с нуля, начинается
 * посреди строки, а то и посреди многобайтного символа: всё до первого `\n`
 * отбрасывается, а `offset` ведётся по сырым байтам. Обрубок символа в строке
 * приходит как U+FFFD (три байта в перекодировании, а в файле - один), поэтому
 * длину отброшенной части считаем сами: ведущие U+FFFD - по байту. Кусок,
 * оборванный посреди записи, дочитывается следующим разом, потому что `offset`
 * встаёт до неё.
 */
export function absorbChunk(stats: Stats, chunk: Chunk): Stats {
  const isFirstRead = stats.offset === 0 && stats.since === 0
  let text = chunk.text
  let from = chunk.from

  if (isFirstRead && from > 0) {
    // Нет ни одной целой строки (запись длиннее куска): весь кусок - обрывок, берём с его конца.
    const cut = text.indexOf('\n') + 1 || text.length
    const dropped = text.slice(0, cut)
    const stray = /^\uFFFD{0,3}/.exec(dropped)?.[0].length ?? 0

    from += stray + encoder.encode(dropped.slice(stray)).length
    text = text.slice(cut)
    stats.since = chunk.from
  }

  const lines = text.split('\n')
  const lastLine = lines.pop() ?? ''

  for (const line of lines) {
    if (line !== '') absorbLine(stats, line)
  }

  stats.offset = from + encoder.encode(text).length - encoder.encode(lastLine).length

  return stats
}

/** Окно контекста: названное в настройке либо угаданное по тому, сколько уже занято. */
export function windowOf(stats: Stats, configured: number): number {
  if (configured > 0) return configured

  return stats.contextTokens > 200_000 ? 1_000_000 : 200_000
}

export const percentOf = (tokens: number, window: number): number =>
  window > 0 ? Math.min(100, Math.round((tokens / window) * 100)) : 0

export function todoProgress(todos: readonly Todo[]): {
  done: number
  total: number
  current: string
} {
  const done = todos.filter(todo => todo.status === 'completed').length
  const current = todos.find(todo => todo.status === 'in_progress')?.text ?? ''

  return { done, total: todos.length, current }
}

/** Топ-N по числу вызовов, больше - первыми. */
export function topOf(map: Record<string, number>, limit: number): [string, number][] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

export function tokensWord(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`

  return String(value)
}
