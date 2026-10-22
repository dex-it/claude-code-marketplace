/* @jsx h */
// The mod itself: what it hooks and in which order things happen.
//
//   session.start   binds `$`, registers `/sessions`, learns this session's id
//                   and home, and starts the timer that reads the session list.
//   ui.render       draws the line above the prompt (only when another session
//                   waits for you) and the `/sessions` pane.
//   command.run     `/sessions` and its words; `clear` / `resume` close the pane.
//   session.receive a message another session sends is noted for the pane.
//
// Where the data comes from, because the mod API has no "list sessions" call:
//   `claude agents --json --all`   which sessions exist and what they do
//   the transcript of each session  tokens, context, plan, skills, subagents
//   `claude --bg`, `stop`, `rm`    starting, stopping and deleting
//   `$.session.send`               a message to another session
// Everything the mod knows lives in this module's own variables: a hot reload
// or a new session starts from a fresh read, which is cheap.

import type { Hook, PluginOptions, Register, RenderElement, Timer } from 'claude-code'

import { parseArgs } from './args.ts'
import { dangerEcho, delivery, dirChoices, failureOf, launchDir, mayMutate, recentDirs, messageFor, presetsOf, sayEcho, settled, startArgv, startedMessage, startedOf } from './dispatch.ts'
import type { DirChoice, Preset, RunResult, WithSend } from './dispatch.ts'
import { isInside, needsScan, projectsRoot, transcriptPath } from './paths.ts'
import type { Miss } from './paths.ts'
import { isFinished, ordered, parseAgents, pickForAction, pickSession } from './sessions.ts'
import type { SessionRow } from './sessions.ts'
import { HELP_TEXT as HELP, detailText, framedLog, listText, openText, quote } from './text.ts'
import type { Entry } from './text.ts'
import { absorbChunk, emptyStats } from './transcript.ts'
import type { Stats } from './transcript.ts'
import type { Actions, Confirm, PaneModel, Ui } from './views.tsx'
import { bandView, paneView } from './views.tsx'

const COMMAND = 'sessions'
const PANE_ID = 'session-dispatcher'
const MIN_REFRESH_MS = 5_000
/** Транскриптов за раз: сотня сессий не поднимает сотню процессов `tail`. */
const READ_CONCURRENCY = 3
/** Первое чтение берёт хвост такого размера: суммы считаются от него. */
const FIRST_READ_BYTES = 1_500_000
/** Дольше этого вопрос «точно?» на кнопке опасного действия не живёт. */
const CONFIRM_MS = 6_000
const LIST_TITLE = 'Сессии'

const optString = (options: PluginOptions, key: string, fallback: string): string => {
  const value = options[key]

  return typeof value === 'string' ? value : fallback
}

const optNumber = (options: PluginOptions, key: string, fallback: number): number => {
  const value = options[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

type Cached = { stats: Stats; path: string | null; size: number; miss?: Miss }

type Bound = {
  log: (text: string) => void
  toast: (text: string) => void
  invalidate: () => void
  openPane: (title: string) => Promise<void>
  closePane: () => Promise<void>
  run: (argv: string[], cwd?: string) => Promise<RunResult>
  send: (sessionId: string, text: string) => Promise<{ isDelivered: boolean; reason: string }>
  statSize: (path: string) => Promise<number | null>
  exists: (path: string) => Promise<boolean>
  listDir: (path: string) => Promise<string[]>
  commandNames: () => Promise<string[]>
  now: () => Promise<number>
  after: (ms: number, run: () => void) => void
}

export const register: Register = (on, pluginOptions) => {
  const settings = {
    refreshMs: Math.max(MIN_REFRESH_MS, optNumber(pluginOptions, 'refreshSeconds', 10) * 1000),
    contextWindow: Math.max(0, optNumber(pluginOptions, 'contextWindow', 0)),
    permissionMode: ((mode: string) => (mode === 'inherit' ? '' : mode))(
      optString(pluginOptions, 'permissionMode', ''),
    ),
    model: optString(pluginOptions, 'model', ''),
    binary: optString(pluginOptions, 'claudeBinary', 'claude'),
  }

  let bound: Bound | null = null
  let rows: SessionRow[] = []
  let loadError = ''
  let hasLoaded = false
  let selfId = ''
  let cwd = ''
  let home = ''
  let configDir = ''
  let isPaneOpen = false
  let view: 'list' | 'details' = 'list'
  let selectedId: string | null = null
  let showFinished = false
  let onlyHere = false
  let confirm: Confirm | null = null
  let note = ''
  let timer: Timer | null = null
  let clockNow = 0
  let reading: Promise<void> | null = null
  let presets: Preset[] = []
  /** Соседние с текущей папки: куда ещё можно отправить новую сессию, не набирая путь. */
  let neighbours: string[] = []
  /** Выбранная для новой сессии папка; пусто - папка этой сессии. */
  let newDir = ''
  /** Недавние папки из истории Claude Code, существующие; перечитываются при открытии панели. */
  let recents: string[] = []
  const cache = new Map<string, Cached>()

  // --- Reading ----------------------------------------------------------

  async function pathOf(row: SessionRow): Promise<string | null> {
    const known = cache.get(row.sessionId)

    if (known?.path) return known.path

    const direct = transcriptPath(configDir, row.cwd, row.sessionId)

    if (direct !== null && (await bound?.exists(direct))) return direct

    // Имя папки обрезано хешем или каталог сессии - не тот, что в списке: перебор
    // папок проектов. Неудача запоминается (сессия без первого сообщения не имеет
    // транскрипта), и перебор не повторяется чаще раза в минуту, пока каталог тот же.
    if (!needsScan(known?.miss, clockNow, row.cwd)) return null

    const root = projectsRoot(configDir)

    for (const dir of (await bound?.listDir(root)) ?? []) {
      const candidate = `${root}/${dir}/${row.sessionId}.jsonl`

      if (await bound?.exists(candidate)) return candidate
    }

    cache.set(row.sessionId, {
      stats: known?.stats ?? emptyStats(),
      path: null,
      size: known?.size ?? 0,
      miss: { at: clockNow, cwd: row.cwd },
    })

    return null
  }

  async function readStats(row: SessionRow): Promise<void> {
    if (!bound) return

    const path = await pathOf(row)
    const known = cache.get(row.sessionId)

    if (path === null) return

    const size = await bound.statSize(path)

    if (size === null) return

    let stats = known?.stats ?? emptyStats()

    // Файл стал короче прочитанного - его переписали: начинаем заново.
    if (size < stats.offset) stats = emptyStats()

    if (size === stats.offset && known) return

    const start = stats.offset > 0 ? stats.offset : Math.max(0, size - FIRST_READ_BYTES)
    const res = await bound.run(['tail', '-c', `+${start + 1}`, path])

    if (res.exitCode !== 0) return

    cache.set(row.sessionId, {
      stats: absorbChunk(stats, { text: res.stdout, from: start }),
      path,
      size,
    })
  }

  async function readRows(): Promise<void> {
    if (!bound) return

    const res = await bound.run([settings.binary, 'agents', '--json', '--all'])

    if (res.exitCode !== 0) {
      loadError = `не удалось получить список сессий: ${failureOf(res.stderr, res.stdout)}`

      return
    }

    loadError = ''
    rows = parseAgents(res.stdout)
    hasLoaded = true
  }

  async function refresh(): Promise<void> {
    if (reading) return reading

    reading = (async () => {
      await readRows()

      if (bound) clockNow = await bound.now()

      const wanted = entriesOf().map(entry => entry.row)
      let next = 0

      const worker = async (): Promise<void> => {
        while (next < wanted.length) {
          const row = wanted[next]

          next += 1

          if (row) await readStats(row).catch(() => undefined)
        }
      }

      await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, wanted.length) }, worker))
      bound?.invalidate()
    })().finally(() => {
      reading = null
    })

    return reading
  }

  // --- The shown set ----------------------------------------------------

  function shownRows(): SessionRow[] {
    return ordered(
      rows.filter(row => {
        if (!showFinished && isFinished(row.phase) && row.sessionId !== selectedId) return false
        if (onlyHere && cwd !== '' && !isInside(row.cwd, cwd)) return false

        return true
      }),
    )
  }

  function entriesOf(): Entry[] {
    return shownRows().map((row, position) => ({
      index: position + 1,
      row,
      stats: cache.get(row.sessionId)?.stats,
      isSelf: row.sessionId === selfId,
    }))
  }

  function dirsOf(): DirChoice[] {
    return dirChoices({
      current: cwd,
      recents,
      sessionDirs: [...new Set(ordered(rows).map(row => row.cwd))],
      neighbours,
      home,
    })
  }

  const hiddenCount = (): number => rows.length - shownRows().length

  function modelOf(canType: boolean, columns: number): PaneModel {
    return {
      columns,
      view,
      entries: entriesOf(),
      selectedId,
      showFinished,
      onlyHere,
      canType,
      windowSetting: settings.contextWindow,
      now: clockNow,
      home,
      confirm,
      hidden: hiddenCount(),
      presets,
      dirs: dirsOf(),
      newDir,
      note: note !== '' ? note : loadError,
    }
  }

  function say(text: string): string {
    note = text
    bound?.invalidate()

    return text
  }

  // --- Actions ----------------------------------------------------------

  /** Недавние папки: хвост истории ввода, лишь те, что ещё существуют. */
  async function loadRecents(): Promise<void> {
    if (!bound) return

    const res = await bound.run(['tail', '-c', '300000', `${configDir}/history.jsonl`]).catch(() => null)

    if (!res || res.exitCode !== 0) return

    const alive: string[] = []

    for (const dir of recentDirs(res.stdout)) {
      if (alive.length >= 12) break

      if (await bound.exists(dir)) alive.push(dir)
    }

    recents = alive
    bound.invalidate()
  }

  async function openPane(title: string): Promise<void> {
    void loadRecents()

    await bound?.openPane(title)
    isPaneOpen = true
  }

  async function showList(): Promise<void> {
    view = 'list'
    confirm = null

    // Выбранная сессия пропала из показанных (удалена, спрятана фильтром): выбор не держим.
    if (selectedId !== null && !entriesOf().some(entry => entry.row.sessionId === selectedId)) selectedId = null

    await openPane(LIST_TITLE)
    bound?.invalidate()
  }

  async function showOne(row: SessionRow): Promise<void> {
    view = 'details'
    selectedId = row.sessionId
    confirm = null
    await openPane(row.name)
    bound?.invalidate()
  }

  function step(delta: 1 | -1): string {
    const shown = shownRows()

    if (shown.length === 0) return say('Сессий нет.')

    const at = shown.findIndex(row => row.sessionId === selectedId)
    const next = shown[(at + delta + shown.length) % shown.length]

    if (!next) return ''

    void showOne(next)

    return ''
  }

  async function start(task: string, name: string, flagDir: string, fromPanel: boolean): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    const text = task.trim()
    const where = launchDir({ flag: flagDir, panel: newDir, cwd, fromPanel })

    if (text === '') {
      return say('Опишите задачу: что должна сделать новая сессия. Например: /sessions new разобрать падающие тесты.')
    }

    const argv = startArgv({
      task: text,
      name,
      dir: where,
      permissionMode: settings.permissionMode,
      model: settings.model,
    })

    argv[0] = settings.binary
    say('Запускаю новую сессию...')

    const res = await bound.run(argv, where !== '' ? where : undefined)

    if (res.exitCode !== 0) return say(`Не удалось запустить: ${failureOf(res.stderr, res.stdout)}`)

    const started = startedOf(res.stdout)

    await refresh()

    const message = startedMessage(started, where !== '' ? where : cwd, home)

    bound.toast(`Новая сессия: ${started?.name ?? 'запущена'}`)

    return say(message)
  }

  async function sendTo(row: SessionRow, text: string): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    if (row.sessionId === selfId) return say('Это текущая сессия: напишите сообщение прямо в поле ввода.')

    const body = text.trim()

    if (body === '') return say('Сообщение пустое.')

    const sent = await bound.send(row.sessionId, messageFor(selfId.slice(0, 8), body))

    if (sent.isDelivered) return say(`Отправлено ${quote(row.name)}. Её ответ придёт сюда сообщением или появится в её выводе.`)

    return say(`Не доставлено ${quote(row.name)}: ${sent.reason !== '' ? sent.reason : 'сессия не принимает сообщения'}.`)
  }

  async function logOf(row: SessionRow): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    if (row.kind !== 'background') {
      const stats = cache.get(row.sessionId)?.stats

      return say(
        stats?.lastAnswer
          ? framedLog(row.name, stats.lastAnswer, 'последний ответ')
          : `У ${quote(row.name)} нет сохранённого вывода: она открыта в другом окне терминала.`,
      )
    }

    const res = await bound.run([settings.binary, 'logs', row.shortId])
    const out = (res.exitCode === 0 ? res.stdout : failureOf(res.stderr, res.stdout)).trim()

    bound.log(framedLog(row.name, out === '' ? '(пусто)' : out))

    return say(`Вывод ${quote(row.name)} записан в историю сессии.`)
  }

  /** Почему сессию нельзя остановить или удалить отсюда; `null` - можно. */
  function dangerBlock(row: SessionRow): string | null {
    if (row.sessionId === selfId) return 'Текущую сессию отсюда остановить нельзя: закройте её как обычно.'

    // `stop` и `rm` в CLI - для фоновых сессий; окно терминала закрывается в самом окне.
    if (row.kind !== 'background') {
      return `${quote(row.name)} открыта в окне терминала${row.pid !== null ? ` (процесс ${row.pid})` : ''}: закройте её там (/exit). Отсюда останавливаются и удаляются только фоновые сессии.`
    }

    return null
  }

  /** Опасное действие: первое нажатие спрашивает, второе в течение шести секунд делает. */
  async function guarded(kind: 'stop' | 'remove', row: SessionRow): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    const blocked = dangerBlock(row)

    if (blocked !== null) return say(blocked)

    if (!(confirm && confirm.kind === kind && confirm.sessionId === row.sessionId)) {
      confirm = { kind, sessionId: row.sessionId }

      const asked = confirm

      bound.after(CONFIRM_MS, () => {
        if (confirm === asked) {
          confirm = null
          bound?.invalidate()
        }
      })

      bound.invalidate()

      return say(
        kind === 'stop'
          ? `Остановить ${quote(row.name)}? Разговор сохранится. Нажмите кнопку ещё раз.`
          : `Удалить ${quote(row.name)} без возврата? Нажмите кнопку ещё раз.`,
      )
    }

    confirm = null

    const word = kind === 'stop' ? 'stop' : 'rm'
    const res = await bound.run([settings.binary, word, row.shortId])

    await refresh()

    if (res.exitCode !== 0) return say(`Не получилось: ${failureOf(res.stderr, res.stdout)}`)

    if (kind === 'remove') cache.delete(row.sessionId)

    if (selectedId === row.sessionId) {
      selectedId = null
      view = 'list'
    }

    return say(kind === 'stop' ? `${quote(row.name)} остановлена.` : `${quote(row.name)} удалена.`)
  }

  function actionsOf(): Actions {
    const rowOf = (sessionId: string) => rows.find(row => row.sessionId === sessionId)

    return {
      select: sessionId => {
        const row = rowOf(sessionId)

        if (row) void showOne(row)
      },
      openList: () => {
        void showList()
      },
      step: delta => {
        step(delta)
      },
      start: task => {
        void start(task, '', '', true)
      },
      chooseDir: dir => {
        newDir = dir
        bound?.invalidate()
      },
      say: (sessionId, text) => {
        const row = rowOf(sessionId)

        if (row) void sendTo(row, text)
      },
      stop: sessionId => {
        const row = rowOf(sessionId)

        if (row) void guarded('stop', row)
      },
      remove: sessionId => {
        const row = rowOf(sessionId)

        if (row) void guarded('remove', row)
      },
      open: sessionId => {
        const row = rowOf(sessionId)

        if (row) say(openText(row, row.sessionId === selfId))
      },
      logs: sessionId => {
        const row = rowOf(sessionId)

        if (row) void logOf(row)
      },
      refreshNow: () => {
        void refresh()
      },
      toggleFinished: () => {
        showFinished = !showFinished
        bound?.invalidate()
        void refresh()
      },
      toggleHere: () => {
        onlyHere = !onlyHere
        bound?.invalidate()
        void refresh()
      },
    }
  }

  // --- Hooks ------------------------------------------------------------

  on('session.start', async ($: WithSend<Parameters<Hook<'session.start'>>[0]>, e, next) => {
    const result = await next(e)

    bound = {
      log: text => $.ui.log(text),
      toast: text => $.ui.toast(text),
      invalidate: () => $.ui.invalidate('ui.render'),
      openPane: async title => {
        await $.ui.open({ id: PANE_ID, title })
      },
      closePane: async () => {
        await $.ui.close({ id: PANE_ID })
      },
      run: (argv, dir) =>
        settled(Promise.resolve().then(() => $.process.run(argv, { ...(dir === undefined ? {} : { cwd: dir }), timeoutMs: 30_000 }))),
      // `claude plugin validate` пускает только вызов `$.session.send(...)` прямо: ни `typeof`,
      // ни `?.`, ни проверку до вызова. Тип члена необязательный (на сборке старше 2.1.303 его
      // нет), поэтому `!` здесь - единственное утверждение типа; отсутствие метода ловит
      // `delivery` по TypeError на вызове.
      send: (sessionId, text) => delivery(() => $.session.send!({ to: { sessionId }, text })),
      statSize: path =>
        $.fs
          .stat(path)
          .then(stat => stat.size)
          .catch(() => null),
      exists: path => $.fs.exists(path),
      listDir: path =>
        $.fs
          .list(path)
          .then(items => items.filter(item => item.kind === 'dir').map(item => item.name))
          .catch(() => []),
      commandNames: () =>
        $.command
          .list()
          .then(items => items.map(item => item.name))
          .catch(() => []),
      now: () => $.clock.now(),
      after: (ms, run) => {
        $.clock.after(ms, run)
      },
    }

    selfId = await $.session.id()
    cwd = await $.session.cwd()
    home = (await $.env.get('HOME')) ?? ''

    const fromEnv = await $.env.get('CLAUDE_CONFIG_DIR')

    configDir = fromEnv !== undefined && fromEnv !== '' ? fromEnv : `${home}/.claude`

    presets = presetsOf(await bound.commandNames())

    const parent = cwd.replace(/\/[^/]*\/?$/, '')

    neighbours =
      parent !== '' && parent !== cwd
        ? (await bound.listDir(parent))
            .filter(name => !name.startsWith('.') && `${parent}/${name}` !== cwd)
            .sort()
            .slice(0, 30)
            .map(name => `${parent}/${name}`)
        : []

    await $.command
      .register({
        name: COMMAND,
        description: 'Все сессии Claude Code: список, запуск новых, сообщения, остановка.',
        argumentHint: '[new задача | 2 | say 2 текст | log 2 | open 2 | stop имя | remove имя | help]',
      })
      .catch((error: unknown) => {
        $.ui.log(`sessions: команда /${COMMAND} не занята мной: ${messageOf(error)}`)
      })

    // В `-p` и SDK рисовать некому, а `claude agents` зря будил бы демон.
    if (!e.isInteractive) return result

    void refresh()

    timer?.cancel()
    timer = $.clock.every(settings.refreshMs, () => {
      void refresh()
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || rows.length === 0) return next(e)

    const { Box, Text, Button } = await $.ui.resolve(e)
    const ui: Ui = { Box, Text, Button }

    return bandView(ui, actionsOf(), rows, selfId, (await next(e)) as RenderElement)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)

    const table = await $.ui.resolve(e)
    // На телефоне поля ввода нет: там те же действия остаются командами.
    const ui: Ui = {
      Box: table.Box,
      Text: table.Text,
      Button: table.Button,
      ...('Input' in table ? { Input: table.Input } : {}),
      ...('Select' in table ? { Select: table.Select } : {}),
    }

    return paneView(ui, actionsOf(), modelOf(ui.Input !== undefined, e.props.bodyColumns))
  })

  on('ui.close', { id: PANE_ID }, async ($, e, next) => {
    const result = await next(e)

    if (result.deny === undefined) {
      isPaneOpen = false
      confirm = null
    }

    return result
  })

  on('command.run', { command: COMMAND }, async ($, e, next) => {
    if (!bound) return next(e)

    const action = parseArgs(e.args)

    if (action.kind === 'help') return { text: HELP }

    if (rows.length === 0 && !hasLoaded) await refresh()

    if (action.kind !== 'toggle' && action.kind !== 'refresh') note = ''

    // Менять сессии слеш-командой может человек и хост; сообщение другой сессии или
    // канала, дошедшее как команда, - нет.
    const changes = action.kind === 'new' || action.kind === 'say' || action.kind === 'stop' || action.kind === 'remove'

    if (changes && !mayMutate(e.origin.kind)) {
      return { text: `/sessions ${action.kind} выполняется только по команде человека (из терминала, моста или SDK), а не по сообщению другой сессии или канала.` }
    }

    // Номер читается по списку, который человек видит; имя и id - по всем сессиям,
    // чтобы законченную, спрятанную фильтром, можно было назвать.
    const pick = (query: string) => pickSession(query, shownRows(), ordered(rows))

    switch (action.kind) {
      case 'toggle': {
        if (isPaneOpen) {
          if (view === 'details') {
            await showList()

            return { text: '' }
          }

          await bound.closePane()
          isPaneOpen = false

          return { text: '' }
        }

        await showList()

        return { text: '' }
      }

      case 'list': {
        await showList()

        return { text: listText(entriesOf(), settings.contextWindow, clockNow, home) }
      }

      case 'refresh': {
        await refresh()

        return { text: listText(entriesOf(), settings.contextWindow, clockNow, home) }
      }

      case 'status': {
        await refresh()

        return { text: listText(entriesOf(), settings.contextWindow, clockNow, home) }
      }

      case 'show': {
        const found = pick(action.query)

        if ('error' in found) return { text: found.error }

        await showOne(found.row)
        await readStats(found.row).catch(() => undefined)

        return {
          text: detailText(
            { index: shownRows().indexOf(found.row) + 1, row: found.row, stats: cache.get(found.row.sessionId)?.stats, isSelf: found.row.sessionId === selfId },
            settings.contextWindow,
            clockNow,
          ),
        }
      }

      case 'new':
        return { text: await start(action.task, action.name, action.dir, false) }

      case 'say': {
        const found = pickForAction(action.query, shownRows(), ordered(rows))

        if ('error' in found) return { text: found.error }

        // Номер, имя и начало id лишь указывают сессию: поручение уходит только по id.
        if (!found.isConfirmed) return { text: say(sayEcho(found.row)) }

        return { text: await sendTo(found.row, action.text) }
      }

      case 'log': {
        const found = pick(action.query)

        if ('error' in found) return { text: found.error }

        return { text: await logOf(found.row) }
      }

      case 'open': {
        const found = pick(action.query)

        if ('error' in found) return { text: found.error }

        return { text: openText(found.row, found.row.sessionId === selfId) }
      }

      case 'stop':
      case 'remove': {
        const found = pickForAction(action.query, shownRows(), ordered(rows))

        if ('error' in found) return { text: found.error }

        const blocked = dangerBlock(found.row)

        if (blocked !== null) return { text: say(blocked) }

        // Номер и имя лишь указывают сессию: список переставляется каждые десять
        // секунд, а имена фоновых сессий повторяются. Исполняется только id (полный
        // или короткий); иначе - эхо с командой повтора.
        if (!found.isConfirmed) return { text: say(dangerEcho(action.kind, found.row)) }

        // Id набрал человек: сам набор команды и есть подтверждение.
        confirm = { kind: action.kind, sessionId: found.row.sessionId }

        return { text: await guarded(action.kind, found.row) }
      }

      case 'step':
        return { text: step(action.delta) }

      case 'finished':
        showFinished = !showFinished
        await refresh()

        return { text: showFinished ? 'Законченные сессии показаны.' : 'Законченные сессии спрятаны.' }

      case 'here':
        onlyHere = !onlyHere
        await refresh()

        return { text: onlyHere ? 'Показаны сессии этого проекта.' : 'Показаны сессии всех проектов.' }

      default:
        return { text: HELP }
    }
  })

  on('command.run', { command: ['clear', 'resume'] }, async ($, e, next) => {
    const result = await next(e)

    if (isPaneOpen) await bound?.closePane().catch(() => undefined)

    // `/clear` и `/resume` дают сессии новый id (имя файла транскрипта): прежний,
    // оставшийся в selfId, показал бы эту же сессию чужой и разрешил бы ей `say` самой себе.
    selfId = await $.session.id().catch(() => selfId)
    cwd = await $.session.cwd().catch(() => cwd)

    isPaneOpen = false
    view = 'list'
    selectedId = null
    confirm = null
    note = ''
    bound?.invalidate()

    return result
  })

  on('session.receive', { origin: { kind: ['peer', 'peer-send-message'] } }, async ($, e, next) => {
    note = `Сообщение от другой сессии: ${e.text.replace(/\s+/g, ' ').slice(0, 160)}`
    bound?.invalidate()
    void refresh()

    return next(e)
  })
}
