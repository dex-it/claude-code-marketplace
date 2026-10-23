// Запуск новой сессии: имя, команда и поручение. Чистое, без `$`.

import type { ActionPick, SessionRow } from './sessions.ts'
import { quote, shortPath } from './text.ts'

export const NAME_LIMIT = 40

/**
 * Имя сессии из задачи, если человек имя не назвал: первые слова, без
 * знаков, через дефис. Имя видно в списке и служит адресом для `attach` и
 * `say`, поэтому оно короткое и без пробелов.
 */
export function nameFromTask(task: string): string {
  const words = task
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(word => word !== '')
    .slice(0, 4)

  const name = words.join('-').slice(0, NAME_LIMIT).replace(/-+$/, '')

  return name === '' ? 'sessiya' : name
}

/** Имя, пригодное в адресной строке команд: без пробелов и кавычек. */
export function cleanName(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_LIMIT)
}

export type NewSession = {
  task: string
  name: string
  /** Рабочий каталог; пусто - каталог этой сессии. */
  dir: string
  /** Режим разрешений для новой сессии; пусто - как настроено по умолчанию. */
  permissionMode: string
  /** Модель; пусто - как настроено по умолчанию. */
  model: string
}

/**
 * Команда запуска в фоне. Задача идёт отдельным аргументом без оболочки: ни
 * кавычки, ни переводы строк в ней ничего не ломают.
 */
export function startArgv(spec: NewSession): string[] {
  const name = cleanName(spec.name) !== '' ? cleanName(spec.name) : nameFromTask(spec.task)
  const argv = ['claude', '--bg', '--name', name]

  if (spec.permissionMode !== '') argv.push('--permission-mode', spec.permissionMode)
  if (spec.model !== '') argv.push('--model', spec.model)

  // Задача, начатая с «-», читалась бы как ключ `claude`: ей достаточно слова впереди.
  argv.push(spec.task.startsWith('-') ? `Задача: ${spec.task}` : spec.task)

  return argv
}

/** Что вывел `claude --bg`: `backgrounded · 0de41c8d · имя`. */
export function startedOf(stdout: string): { id: string; name: string } | null {
  const hit = /backgrounded\s*[·\-:]\s*([0-9a-f]{6,})\s*[·\-:]\s*(.+)/i.exec(stdout)

  return hit ? { id: hit[1] ?? '', name: (hit[2] ?? '').trim() } : null
}

/** Причина отказа CLI одной строкой, для человека. */
export function failureOf(stderr: string, stdout: string): string {
  const text = `${stderr}\n${stdout}`.trim()

  if (/not trusted/i.test(text)) {
    return 'Каталог не доверенный: откройте в нём `claude` один раз, подтвердите доверие и повторите.'
  }

  const line = text.split('\n').find(row => row.trim() !== '')

  return line ? line.trim().slice(0, 200) : 'команда завершилась без объяснения'
}

/**
 * Поручение для сообщения другой сессии: от кого оно, чтобы ответить адресно. Метка -
 * обычный текст: любая сессия, канал или человек может написать такую же с любым
 * отправителем, поэтому она сама называет себя непроверенной, и получатель не вправе
 * считать её доказательством происхождения.
 */
export function messageFor(from: string, text: string): string {
  return `[метка диспетчера сессий, не проверяется: отправитель ${from}] ${text.trim()}`
}

export type Preset = { label: string; task: string }

/**
 * Готовые задачи для новичка: кнопка вместо формулировки. Показываются только
 * те, чья команда в этой сессии есть: плагин не установлен - кнопки нет, а не
 * кнопка, которая запускает пустоту.
 */
export function presetsOf(commandNames: readonly string[]): Preset[] {
  const has = (name: string) => commandNames.includes(name)
  const presets: Preset[] = []

  if (has('dex-auto:onboard')) {
    presets.push({
      label: 'Подготовить проект к работе с агентами',
      task: '/dex-auto:onboard',
    })
  }

  return presets
}

export type DirChoice = { value: string; label: string }

export const DIR_CHOICES_MAX = 20

/**
 * Папки, в которых можно начать сессию, - выбором, а не набором руками:
 * текущая, недавние (где человек уже работал с Claude Code), те, где идут
 * сессии, и соседние с текущей (рядом лежат
 * проекты). Повторы схлопываются, порядок - по близости к тому, что человек
 * делает сейчас.
 */
export function dirChoices(input: {
  current: string
  recents: readonly string[]
  sessionDirs: readonly string[]
  neighbours: readonly string[]
  home: string
}): DirChoice[] {
  const seen = new Set<string>()
  const choices: DirChoice[] = []

  const add = (value: string, prefix: string) => {
    if (value === '' || seen.has(value) || choices.length >= DIR_CHOICES_MAX) return

    seen.add(value)
    choices.push({ value, label: `${prefix}${shortPath(value, input.home)}` })
  }

  add(input.current, 'эта папка: ')

  for (const dir of input.recents) add(dir, 'недавняя: ')
  for (const dir of input.sessionDirs) add(dir, 'где идут сессии: ')
  for (const dir of input.neighbours) add(dir, 'рядом: ')

  return choices
}

const TEMPORARY = /^\/(private\/)?(tmp|var\/folders)\/|\/\.cache\//

/**
 * Недавние папки из истории ввода Claude Code (`history.jsonl`, у записи есть
 * `project`): свежие первыми, без повторов, без временных. Читается хвост
 * файла, поэтому первая строка может быть оборвана и отбрасывается. Формат
 * внутренний: что не разобралось, молча пропускается.
 */
export function recentDirs(text: string, limit = 30): string[] {
  const lines = text.split('\n').slice(1).reverse()
  const found: string[] = []

  for (const line of lines) {
    if (found.length >= limit) break

    let project: unknown

    try {
      project = (JSON.parse(line) as { project?: unknown }).project
    } catch {
      continue
    }

    if (typeof project !== 'string' || !project.startsWith('/')) continue
    if (TEMPORARY.test(project) || found.includes(project)) continue

    found.push(project)
  }

  return found
}

/** Строка совпала не только с id цели, но и с именем другой сессии: об этом эхо говорит первым. */
const shadowNote = (shadowed: readonly SessionRow[]): string =>
  shadowed.length === 0
    ? ''
    : `Набранное - это id этой сессии и одновременно имя другой: ${shadowed.map(row => `${quote(row.name)} (${row.shortId})`).join(', ')}. Проверьте, о какой речь. `

/**
 * Эхо вместо исполнения: названа сессия и дана точная команда повтора с её id. `repeat` - id,
 * который подтверждает именно эту сессию (`pickForAction`); `shadowed` - чьим именем оказалась строка.
 */
export function dangerEcho(
  kind: 'stop' | 'remove',
  row: SessionRow,
  repeat: string = row.shortId,
  shadowed: readonly SessionRow[] = [],
): string {
  const label = `${quote(row.name)} (${row.shortId})`

  return `${shadowNote(shadowed)}${
    kind === 'stop'
      ? `Остановить ${label}? Разговор сохранится. Чтобы подтвердить, повторите: /sessions stop ${repeat}`
      : `Удалить ${label} вместе с рабочей копией, без возврата? Чтобы подтвердить, повторите: /sessions remove ${repeat}`
  }`
}

/** Самый длинный текст поручения, который эхо подставляет в подсказку целиком. */
export const ECHO_TEXT_MAX = 120

/**
 * Эхо для `say`, названной не по id: поручение уходит сессии, у которой может быть право
 * правки, и номер из пересчитанного списка мог указать на соседнюю. Однострочный текст не
 * длиннее `ECHO_TEXT_MAX` подставляется в подсказку: человеку остаётся скопировать команду.
 * Это ввод самого оператора, поэтому он не маскируется; многострочный и длинный текст в эхо
 * не попадает (вместо него «текст»).
 */
export function sayEcho(
  row: SessionRow,
  text = '',
  repeat: string = row.shortId,
  shadowed: readonly SessionRow[] = [],
): string {
  const body = text.trim()
  const inline = body !== '' && body.length <= ECHO_TEXT_MAX && !/[\r\n\u2028\u2029]/.test(body)

  return `${shadowNote(shadowed)}Отправить ${quote(row.name)} (${row.shortId})? Повторите: /sessions say ${repeat} ${inline ? body : 'текст'}`
}

export const SAY_SELF = 'Это текущая сессия: напишите сообщение прямо в поле ввода.'
export const SAY_EMPTY = 'Сообщение пустое.'

/** Что делать с `/sessions say`: отправить, показать эхо или отказать. */
export type SayOutcome =
  | { kind: 'send'; row: SessionRow; text: string }
  | { kind: 'echo' | 'refuse-self' | 'refuse-empty' | 'refuse-pick'; text: string }

/**
 * Решение по `say` одной чистой функцией: `register.tsx` его только исполняет. Порядок
 * проверок: сессия не найдена или неоднозначна; это текущая сессия; текст пуст; сессия названа
 * не по id - эхо; иначе отправка. Себя и пустой текст отказывают раньше эхо: подсказка, которую
 * потом отклонят, человека только запутала бы.
 */
export function sayOutcome(input: { pick: ActionPick; text: string; selfId: string }): SayOutcome {
  const { pick, text, selfId } = input

  if ('error' in pick) return { kind: 'refuse-pick', text: pick.error }

  if (pick.row.sessionId === selfId) return { kind: 'refuse-self', text: SAY_SELF }

  const body = text.trim()

  if (body === '') return { kind: 'refuse-empty', text: SAY_EMPTY }

  if (!pick.isConfirmed) return { kind: 'echo', text: sayEcho(pick.row, body, pick.repeatWith, pick.shadowed) }

  return { kind: 'send', row: pick.row, text: body }
}

/**
 * Каталог новой сессии (`''` - каталог этой). Команда берёт только `--dir`: выбор в
 * панели в ней не участвует, иначе фоновая сессия с правом правки ушла бы в папку,
 * выбранную когда-то давно и не названную в команде.
 */
export function launchDir(input: { flag: string; panel: string; cwd: string; fromPanel: boolean }): string {
  if (input.flag !== '') return input.flag

  return input.fromPanel && input.panel !== input.cwd ? input.panel : ''
}

/** Ответ о запуске называет и папку: сессия фоновая, и человек должен знать, где она правит файлы. */
export function startedMessage(
  started: { id: string; name: string } | null,
  dir: string,
  home: string,
): string {
  const where = shortPath(dir, home)

  return started
    ? `Запущена сессия «${started.name}» (${started.id}) в папке ${where}. Она работает в фоне; когда ей понадобится ваш ответ, она появится в списке как «ждёт вас».`
    : `Сессия запущена в папке ${where}. Она появится в списке через несколько секунд.`
}

export type RunResult = { exitCode: number; stdout: string; stderr: string }

/** Отказ запуска процесса (таймаут, нет файла) - обычный ответ с кодом -1, а не падение хука. */
export const settled = (run: Promise<RunResult>): Promise<RunResult> =>
  run.catch((error: unknown) => ({
    exitCode: -1,
    stdout: '',
    stderr: error instanceof Error ? error.message : String(error),
  }))

/**
 * Кто вправе менять: `new`, `say`, `stop`, `remove` исполняются только по слову
 * человека (терминал, мост, хост SDK). Сообщение другой сессии, канала или
 * триггера слеш-командой управлять сессиями не должно.
 */
export const mayMutate = (originKind: string): boolean =>
  originKind === 'composer' || originKind === 'bridge' || originKind === 'sdk'

/** Вход вызова `$.session.send`, как его даёт сборка 2.1.303 и новее. */
export type SendInput = { to: { sessionId: string }; text: string }

type SendOutcome = { isDelivered?: unknown; reason?: unknown }

/**
 * Объект `$` вместе с вызовом `$.session.send`. Контракт типов объявляет его
 * обязательным, но во время работы он есть только в сборке 2.1.303 и новее; на
 * старой члена нет, поэтому здесь он необязательный. Тип стоит на параметре
 * хука: приведения `as` нет, `$` из контракта ему удовлетворяет (объект с
 * обязательным членом подходит под необязательный).
 */
export type WithSend<Dollar extends { session: object }> = Dollar & {
  session: { send?: (input: SendInput) => Promise<SendOutcome> }
}

export const NO_SEND_REASON = 'эта сборка Claude Code не умеет отправлять сообщения другим сессиям (проверено на 2.1.303 и новее)'

/**
 * Ответ на отправку: вызов отдаёт промис или `undefined` (члена нет). Отсутствие
 * вызова и отказ хоста - ответ человеку, а не падение хука.
 */
export async function delivery(call: () => Promise<SendOutcome> | undefined): Promise<{ isDelivered: boolean; reason: string }> {
  try {
    const sent = await call()

    if (sent === undefined) return { isDelivered: false, reason: NO_SEND_REASON }

    return {
      isDelivered: sent.isDelivered === true,
      reason: typeof sent.reason === 'string' ? sent.reason : '',
    }
  } catch (error) {
    return {
      isDelivered: false,
      reason:
        error instanceof TypeError && /not a function/i.test(error.message)
          ? NO_SEND_REASON
          : error instanceof Error
            ? error.message
            : String(error),
    }
  }
}
