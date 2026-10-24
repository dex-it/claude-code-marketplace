// Что `/sessions` попросили сделать, по строке аргументов. Не зависит ни от
// чего, поэтому грамматика команды закрыта тестами, а не пробами в сессии;
// превратить имя сессии в саму сессию - дело `pickSession`.

export type Action =
  /** `/sessions` - открыть панель или закрыть, если она открыта. */
  | { kind: 'toggle' }
  /** `/sessions list` - показать список сессий. */
  | { kind: 'list' }
  /** `/sessions 3` или `/sessions имя` - показать одну сессию подробно. */
  | { kind: 'show'; query: string }
  /** `/sessions new [--name имя] [--dir путь] задача` - начать новую сессию. */
  | { kind: 'new'; task: string; name: string; dir: string }
  /** `/sessions say 2 текст` - отправить сообщение сессии. */
  | { kind: 'say'; query: string; text: string }
  /** `/sessions log 2` - вывести то, что сессия напечатала последним. */
  | { kind: 'log'; query: string }
  /** `/sessions open 2` - подсказать, как открыть сессию в этом терминале. */
  | { kind: 'open'; query: string }
  /** `/sessions stop 2` - остановить; разговор сохраняется. */
  | { kind: 'stop'; query: string }
  /** `/sessions remove 2` - удалить сессию и её рабочую копию. */
  | { kind: 'remove'; query: string }
  /** `/sessions next`, `/sessions prev` - соседняя сессия в порядке списка. */
  | { kind: 'step'; delta: 1 | -1 }
  /** `/sessions finished` - показывать или прятать законченные сессии. */
  | { kind: 'finished' }
  /** `/sessions here` - только сессии этого проекта либо все. */
  | { kind: 'here' }
  /** `/sessions status` - выписать состояние всех сессий текстом для модели. */
  | { kind: 'status' }
  | { kind: 'refresh' }
  | { kind: 'help' }

const WORDS: Record<string, Action> = {
  '': { kind: 'toggle' },
  list: { kind: 'list' },
  ls: { kind: 'list' },
  next: { kind: 'step', delta: 1 },
  prev: { kind: 'step', delta: -1 },
  finished: { kind: 'finished' },
  here: { kind: 'here' },
  status: { kind: 'status' },
  refresh: { kind: 'refresh' },
  help: { kind: 'help' },
  '?': { kind: 'help' },
}

const WITH_TARGET: Record<string, 'log' | 'open' | 'stop' | 'remove'> = {
  log: 'log',
  logs: 'log',
  open: 'open',
  attach: 'open',
  stop: 'stop',
  kill: 'stop',
  remove: 'remove',
  rm: 'remove',
  delete: 'remove',
}

/** Первое слово (в кавычках - с пробелами) и остаток строки. */
export function firstWord(text: string): { word: string; rest: string } {
  const source = text.trim()
  const quoted = /^(["«“'])(.+?)(["»”'])\s*(.*)$/s.exec(source)

  if (quoted) return { word: (quoted[2] ?? '').trim(), rest: (quoted[4] ?? '').trim() }

  const space = source.search(/\s/)

  return space === -1
    ? { word: source, rest: '' }
    : { word: source.slice(0, space), rest: source.slice(space).trim() }
}

/** Ключи `--name x` и `--dir y` в начале строки новой сессии; остаток - задача. */
export function newArgs(text: string): { task: string; name: string; dir: string } {
  let rest = text.trim()
  let name = ''
  let dir = ''

  for (;;) {
    const flag = /^--(name|dir)(?:=|\s+)/.exec(rest)

    if (!flag) break

    const after = firstWord(rest.slice(flag[0].length))

    if (flag[1] === 'name') name = after.word
    else dir = after.word

    rest = after.rest
  }

  return { task: rest, name, dir }
}

export function parseArgs(raw: string): Action {
  const text = raw.trim()
  const known = WORDS[text.toLowerCase()]

  if (known) return known

  const { word, rest } = firstWord(text)
  const lower = word.toLowerCase()

  if (lower === 'new' || lower === 'start' || lower === 'run') return { kind: 'new', ...newArgs(rest) }

  if (lower === 'say' || lower === 'send' || lower === 'tell') {
    const target = firstWord(rest)

    return { kind: 'say', query: target.word, text: target.rest }
  }

  const withTarget = WITH_TARGET[lower]

  if (withTarget) return { kind: withTarget, query: rest }

  if (text !== '') return { kind: 'show', query: text }

  return { kind: 'help' }
}
