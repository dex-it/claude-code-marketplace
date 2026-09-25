/* @jsx h */
// The mod itself: what it hooks and in which order things happen.
//
//   session.start   binds `$`, registers `/pr`, reads the repository off the
//                   git remote, picks a source and starts the poll.
//   ui.render       draws the rows above the prompt and the `/pr` pane.
//   command.run     `/pr` and its words; `clear` / `resume` forget the state.
//   prompt.submit   PR URLs in a prompt toggle watching; an armed PR's open
//                   threads ride the prompt as context, once.
//   tool.call Bash  the URL `gh pr create` prints is watched too, and a
//                   command that moves the PR (push, commit, gh pr) polls.
//   turn.complete   a PR URL in Claude's answer is watched too, and the end
//                   of a turn polls what the timer has not refreshed lately.
//
// Everything the mod knows lives in this module's own variables: a hot
// reload or a new session starts from the branch again, which is cheap.

import type { PluginOptions, Register, RenderElement, Timer } from 'claude-code'

import { ApiAuthError, backendOf } from './backend.ts'
import type { Api, Host } from './backend.ts'
import { HELP_TEXT, parseArgs } from './args.ts'
import type { Change, PrData, PrRef, Remote } from './github.ts'
import {
  IMPORTANT_KINDS,
  changesOf as changesOfData,
  isOnlyPrUrls,
  keyOf,
  labelOf,
  prDataOfRaw,
  prRefsOf,
  remoteOf,
  repoRefOf,
} from './github.ts'
import { overviewOf } from './overview.ts'
import { pollRaw, prOfBranch } from './poll.ts'
import { checksText, noPrText, overviewText, statusText, threadsText } from './text.ts'
import type { Actions, PaneModel, PaneView, Ui } from './views.tsx'
import { bandView, paneView } from './views.tsx'
import type { Watched } from './watched.ts'
import { openThreadsOf, watchedOf } from './watched.ts'

const COMMAND = 'pr'
const PANE_ID = 'github-pr'
const MIN_POLL_MS = 15_000
const PANE_COMMITS = 8
const PANE_CHECKS = 6
/**
 * Больше этого числа PR полоса над вводом рисует не строками, а итогом: десять
 * строк съедают экран, а «что ждёт меня» на них всё равно не читается - на это
 * отвечает общий список.
 */
const BAND_MAX_ROWS = 3
/** Строки списка над и под перечнем: шапка, итог, пустая, подсказка. */
const LIST_CHROME_ROWS = 5
/** Заголовок панели в виде списка: один на все PR, метки у него нет. */
const LIST_TITLE = 'Мониторинг PR'
/**
 * Хост по умолчанию, когда его не назвал ни remote, ни настройка: тот же, что
 * у `gh` (`--hostname` по умолчанию github.com, `gh api --help`, сверено
 * 25.09.2026).
 */
const DEFAULT_HOST = 'github.com'
/** Ширина панели до первой отрисовки: ею меряется адрес треда. */
const PANE_FALLBACK_COLUMNS = 60
/** Строки над и под списком тредов: шапка, факты, кнопки, подвал. */
const PANE_CHROME_ROWS = 9
/** Больше половины экрана панель над вводом не просит. */
const PANE_MAX_SCREEN_SHARE = 2
const TOAST_MS = 8000
/**
 * Опрос по поводу (конец хода, своя команда в Bash) не повторяет то, что
 * таймер уже принёс: PR, опрошенный свежее этого окна, пропускается.
 */
const REFRESH_MIN_AGE_MS = 20_000
/**
 * Через сколько перезапросить PR, у которого слияние ещё не вычислено. GitHub
 * считает мержабельность фоном и сам запрос её вычисление и запускает: «If the
 * value is null, then GitHub has started a background job to compute the
 * mergeability. After giving the job time to complete, resubmit the request»
 * (docs.github.com/rest/pulls/pulls, сверено 25.09.2026). Без этого после
 * каждого пуша строка минуту несла бы `unknown`.
 */
const MERGE_RECHECK_MS = 3000
const SOUND_BAD = '/System/Library/Sounds/Basso.aiff'
const SOUND_CHANGE = '/System/Library/Sounds/Glass.aiff'

type Settings = {
  remote: string
  host: string
  repository: string
  pollMs: number
  autoWatchBranch: boolean
  backend: string
  token: string
  notify: string
  sound: boolean
}

const optString = (options: PluginOptions, key: string, fallback: string) => {
  const value = options[key]

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

const optNumber = (options: PluginOptions, key: string, fallback: number) => {
  const value = options[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const optBool = (options: PluginOptions, key: string, fallback: boolean) => {
  const value = options[key]

  return typeof value === 'boolean' ? value : fallback
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

export const register: Register = (on, pluginOptions) => {
  const settings: Settings = {
    remote: optString(pluginOptions, 'remote', 'origin'),
    host: optString(pluginOptions, 'host', ''),
    repository: optString(pluginOptions, 'repository', ''),
    pollMs: Math.max(MIN_POLL_MS, optNumber(pluginOptions, 'pollSeconds', 60) * 1000),
    autoWatchBranch: optBool(pluginOptions, 'autoWatchBranch', true),
    backend: optString(pluginOptions, 'backend', 'auto'),
    token: optString(pluginOptions, 'token', ''),
    notify: optString(pluginOptions, 'notify', 'all'),
    sound: optBool(pluginOptions, 'sound', false),
  }

  const watched = new Map<string, Watched>()
  const inFlight = new Map<string, Promise<void>>()

  let api: Api | null = null
  let reason = ''
  let remote: Remote | null = null
  let branch = ''
  let autoKey: string | null = null
  let selectedKey: string | null = null
  let armedKey: string | null = null
  let showResolved = false
  let isPaneOpen = false
  let pollMs = settings.pollMs
  /** Какой вид панели показан: общий список или один PR подробно. */
  let paneMode: PaneView = 'details'
  /** Откуда взялся выбранный репозиторий - это и есть ответ `/pr repo`. */
  let repoFrom: 'remote' | 'настройки' | 'команды' | null = null
  /** Пересобрать источник данных под хост: его задаёт выбранный репозиторий. */
  let pickBackend: ((hostname: string) => Promise<string>) | null = null
  /** Ширина тела панели, как её отдала поверхность в последнюю отрисовку. */
  let paneColumns = PANE_FALLBACK_COLUMNS
  /** Высота экрана, как её отдала последняя отрисовка; 0 - ещё не мерили. */
  let screenRows = 0
  let pollTimer: Timer | undefined
  let startTimer: (() => void) | null = null

  // Bound at session.start, where `$` is in hand; every later hook calls them.
  let bound: {
    log: (text: string) => void
    toast: (text: string) => void
    status: (text: string | undefined) => void
    invalidate: () => void
    openPane: (title: string) => Promise<void>
    closePane: () => Promise<void>
    openUrl: (url: string) => void
    play: (sound: string) => void
    now: () => Promise<number>
    after: (ms: number, run: () => void) => void
  } | null = null

  const list = () => [...watched.values()]

  /**
   * Сколько строк панель просит, садясь над полем ввода: по содержимому
   * выбранного PR, но не больше половины экрана. Экран ещё не мерили - не
   * просим ничего, и поверхность берёт свою треть.
   */
  function wantedRows(): number | null {
    if (screenRows === 0) return null

    const half = Math.floor(screenRows / PANE_MAX_SCREEN_SHARE)

    // Список просит по строке на PR: он и есть перечень, и обрезать его до
    // трети экрана значит спрятать то, за чем его открыли.
    if (paneMode === 'list') {
      return Math.max(1, Math.min(LIST_CHROME_ROWS + watched.size, half))
    }

    const data = selected()?.data

    if (!data) return null

    const rows =
      PANE_CHROME_ROWS +
      openThreadsOf(data).length * 3 +
      Math.min(data.checks?.bad.length ?? 0, PANE_CHECKS) +
      Math.min(data.commits.length, PANE_COMMITS)

    return Math.max(1, Math.min(rows, half))
  }

  const selected = () =>
    (selectedKey === null ? undefined : watched.get(selectedKey)) ?? list()[0]

  const uiModel = (): PaneModel => ({
    columns: paneColumns,
    view: paneMode,
    list: list(),
    overview: overviewOf(list()),
    selectedKey: selected()?.key ?? null,
    showResolved,
    armedKey,
    commitLimit: PANE_COMMITS,
    checkLimit: PANE_CHECKS,
  })

  // --- Polling ----------------------------------------------------------

  /**
   * One poll per PR at a time: a caller that asks while a poll is in flight
   * waits for that one. `/pr status` right after the PR was found would
   * otherwise answer "no data yet" beside a poll that is already running.
   */
  function refresh(entry: Watched, isRecheck = false): Promise<void> {
    const running = inFlight.get(entry.key)

    if (running) return running

    const run = pollOnce(entry, isRecheck).finally(() => inFlight.delete(entry.key))

    inFlight.set(entry.key, run)

    return run
  }

  async function pollOnce(entry: Watched, isRecheck: boolean): Promise<void> {
    const source = api

    if (!source) return

    try {
      const raw = await pollRaw(source, entry.ref)

      if (raw === null) {
        throw new Error('pull request не найден либо токену не хватает прав')
      }

      if (!watched.has(entry.key)) return

      const next = prDataOfRaw(raw)

      announce(entry, next)
      entry.data = next
      entry.error = undefined

      // Слияние ещё считается. Перезапрос один и только с обычного опроса:
      // иначе PR, у которого мержабельность не вычисляется никогда, гонял бы
      // запросы по кругу каждые три секунды.
      if (!isRecheck && next.state === 'OPEN' && next.mergeable === 'UNKNOWN') {
        bound?.after(MERGE_RECHECK_MS, () => {
          if (watched.has(entry.key)) void refresh(entry, true)
        })
      }
    } catch (error) {
      entry.error = messageOf(error)

      // Токен не принят. Повторять это по таймеру нельзя: на череду неудачных
      // попыток GitHub начинает отвечать отказом на любую аутентификацию, и
      // мод сломал бы `gh` той же машины. Опрос встаёт до `/pr refresh`.
      if (error instanceof ApiAuthError) {
        pollTimer?.cancel()
        pollTimer = undefined
        entry.error = `${entry.error} - опрос остановлен, поправьте токен и вызовите /${COMMAND} refresh`
      }
    } finally {
      entry.updatedMs = await (bound?.now() ?? Promise.resolve(0))
      bound?.invalidate()
    }
  }

  const refreshAll = () => Promise.all(list().map(entry => refresh(entry)))

  /**
   * Опрос по поводу: ход закончился, или в Bash прошла команда, меняющая PR.
   * Между тиками таймера это и есть отлов события - ответ в треде виден,
   * как только вы возвращаетесь к промпту, а не через период опроса.
   */
  async function refreshStale(): Promise<void> {
    if (watched.size === 0 || !bound || pollTimer === undefined) return

    const nowMs = await bound.now()
    const stale = list().filter(entry => nowMs - entry.updatedMs > REFRESH_MIN_AGE_MS)

    await Promise.all(stale.map(entry => refresh(entry)))
  }

  function announce(entry: Watched, next: PrData): void {
    if (settings.notify === 'off' || !bound) return

    const changesOfPoll: Change[] = changesFor(entry.data, next)

    if (changesOfPoll.length === 0) return

    for (const change of changesOfPoll) {
      bound.log(`${entry.label}: ${change.text}`)
    }

    const head = changesOfPoll.slice(0, 2).map(change => change.text).join('; ')
    const rest = changesOfPoll.length > 2 ? ` (+${changesOfPoll.length - 2})` : ''

    bound.toast(`${entry.label} ${head}${rest}`)

    if (settings.sound) {
      bound.play(changesOfPoll.some(change => change.level === 'bad') ? SOUND_BAD : SOUND_CHANGE)
    }
  }

  function changesFor(previous: PrData | undefined, next: PrData): Change[] {
    // The import is named `changesOf` in github.ts; kept behind this wrapper so
    // the `important` filter lives in one place.
    const all = changesOfData(previous, next)

    return settings.notify === 'important'
      ? all.filter(change => IMPORTANT_KINDS.includes(change.kind))
      : all
  }

  // --- Watching ---------------------------------------------------------

  function watch(ref: PrRef, auto: boolean): Watched {
    const entry = watchedOf(ref, auto)
    const known = watched.get(entry.key)

    if (known) return known

    watched.set(entry.key, entry)
    selectedKey ??= entry.key
    void refresh(entry)
    bound?.invalidate()

    return entry
  }

  function stop(key: string): void {
    watched.delete(key)

    if (autoKey === key) autoKey = null
    if (armedKey === key) armedKey = null

    // Сняли тот, чьи детали открыты, а другие остались - показываем список:
    // подставлять вместо снятого соседа значит показать не то, что просили.
    if (selectedKey === key) {
      selectedKey = list()[0]?.key ?? null

      if (watched.size > 0 && paneMode === 'details') paneMode = 'list'
    }

    if (watched.size === 0 && isPaneOpen) void bound?.closePane()

    bound?.invalidate()
  }

  /**
   * The PR of the branch the working copy is on now. A branch switch drops
   * the previous automatic one and looks the new branch up; a PR the person
   * asked for by hand is never dropped by a branch switch.
   */
  async function syncBranch(head: string): Promise<void> {
    if (!settings.autoWatchBranch || !api || !remote || head === branch) return

    branch = head

    if (autoKey !== null) {
      const previous = watched.get(autoKey)

      // The pane stays open across a branch switch and shows the new branch's
      // PR, so the outgoing one is dropped without closing anything.
      if (previous && previous.auto) {
        watched.delete(previous.key)

        if (selectedKey === previous.key) selectedKey = null
      }

      autoKey = null
    }

    if (head === '' || head === 'HEAD') {
      bound?.invalidate()

      return
    }

    const number = await prOfBranch(api, {
      owner: remote.owner,
      repo: remote.repo,
      branch: head,
    }).catch(() => null)

    if (number === null) {
      bound?.invalidate()

      return
    }

    const entry = watch({ host: remote.host, owner: remote.owner, repo: remote.repo, number }, true)

    autoKey = entry.key
    selectedKey ??= entry.key
  }

  // --- Hooks ------------------------------------------------------------

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const cwd = e.cwd

    const host: Host = {
      run: (argv, init) => $.process.run(argv, init),
      fetch: (url, init) => $.http.fetch(url, init),
    }

    bound = {
      log: text => $.ui.log(`github-pr: ${text}`),
      toast: text => $.ui.toast(text, { timeoutMs: TOAST_MS }),
      status: text => $.ui.status(text),
      invalidate: () => $.ui.invalidate('ui.render'),
      openPane: async title => {
        // Доке аргумент безразличен - она всегда во весь экран; над вводом
        // панель открывается по содержимому, не на треть экрана по умолчанию.
        const rows = wantedRows()

        await $.ui.open({ id: PANE_ID, title, ...(rows === null ? {} : { rows }) })
        isPaneOpen = true
      },
      closePane: async () => {
        await $.ui.close({ id: PANE_ID })
        isPaneOpen = false
      },
      openUrl: url => {
        void $.process
          .run(['open', url])
          .then(res => (res.exitCode === 0 ? res : $.process.run(['xdg-open', url])))
          .catch((error: unknown) => $.ui.log(`github-pr: ${messageOf(error)}`))
      },
      play: sound => {
        void $.process.run(['afplay', sound]).catch(() => undefined)
      },
      now: () => $.clock.now(),
      after: (ms, run) => {
        $.clock.after(ms, run)
      },
    }

    await $.command
      .register({
        name: COMMAND,
        description: 'Pull request GitHub: панель, открытые треды, проверки, состояние.',
        argumentHint: '[123 | ссылка | threads | status | checks | refresh | drop]',
      })
      .catch((error: unknown) => {
        $.ui.log(`github-pr: команда /${COMMAND} не занята мной: ${messageOf(error)}`)
      })

    const remoteUrl = await $.process
      .run(['git', 'remote', 'get-url', settings.remote], { cwd })
      .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
      .catch(() => '')

    const fromRemote = remoteOf(remoteUrl)

    // Источник данных пересобирается под хост, а не выбирается раз:
    // репозиторий, названный командой `/pr repo`, может лежать на другом хосте.
    pickBackend = async hostname => {
      const token =
        settings.token !== ''
          ? settings.token
          : (await $.env.get('GH_TOKEN')) ??
            (await $.env.get('GITHUB_TOKEN')) ??
            (await $.env.get('GH_ENTERPRISE_TOKEN')) ??
            (await $.env.get('GITHUB_ENTERPRISE_TOKEN')) ??
            ''
      const choice = await backendOf(host, {
        backend: settings.backend,
        hostname,
        token,
        cwd,
      })

      if (choice.api === undefined) {
        api = null

        return choice.reason
      }

      api = choice.api

      return ''
    }

    const hostFallback =
      settings.host !== '' ? settings.host : (fromRemote?.host ?? DEFAULT_HOST)
    const fromSettings =
      settings.repository === '' ? null : repoRefOf(settings.repository, hostFallback)

    if (settings.repository !== '' && fromSettings === null) {
      reason = `настройка repository не в форме owner/repo: "${settings.repository}"`

      return result
    }

    const chosen =
      fromSettings ??
      (fromRemote === null
        ? null
        : { host: hostFallback, owner: fromRemote.owner, repo: fromRemote.repo })

    if (chosen === null) {
      reason =
        `не вижу репозиторий GitHub: remote "${settings.remote}" не назвал его. ` +
        `Назовите его руками: /${COMMAND} repo owner/repo`

      return result
    }

    remote = chosen
    repoFrom = fromSettings === null ? 'remote' : 'настройки'

    const failed = await pickBackend(remote.host)

    if (failed !== '') {
      reason = failed
      $.ui.log(`github-pr: ${failed}`)

      return result
    }

    const headOf = () =>
      $.process
        .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
        .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
        .catch(() => '')

    await syncBranch(await headOf())

    if (!e.isInteractive) return result

    startTimer = () => {
      pollTimer?.cancel()
      pollTimer = $.clock.every(pollMs, () => {
        void headOf().then(head => syncBranch(head))
        void refreshAll()
      })
    }

    startTimer()

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || watched.size === 0) return next(e)

    const { Box, Text, Button, Link } = await $.ui.resolve(e)
    const ui: Ui = { Box, Text, Button, Link }

    return bandView(
      ui,
      actionsOf(),
      { list: list(), overview: overviewOf(list()), maxRows: BAND_MAX_ROWS },
      (await next(e)) as RenderElement,
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)

    const { Box, Text, Button, Link } = await $.ui.resolve(e)
    const ui: Ui = { Box, Text, Button, Link }

    paneColumns = e.props.bodyColumns
    screenRows = e.viewport?.rows ?? screenRows

    return paneView(ui, actionsOf(), uiModel())
  })

  on('ui.close', { id: PANE_ID }, async ($, e, next) => {
    const result = await next(e)

    if (result.deny === undefined) isPaneOpen = false

    return result
  })

  on('command.run', { command: COMMAND }, async ($, e, next) => {
    if (!bound) return next(e)

    const action = parseArgs(e.args)

    /**
     * Дождаться первого опроса тех, у кого данных ещё нет. Список, напечатанный
     * до него, называл бы всё «данных нет»: `watch` опрашивает в фоне, а текст
     * собирается сразу. Опрос уже идущий не дублируется - `refresh` его ждёт.
     */
    const awaitFirstPoll = () =>
      Promise.all(list().filter(entry => entry.data === undefined).map(entry => refresh(entry)))

    const lookUpBranch = async () => {
      const head = await $.process
        .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd: await $.session.cwd() })
        .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
        .catch(() => '')

      branch = ''
      await syncBranch(head)
    }

    // `/pr repo` отвечает и тогда, когда репозитория нет вовсе: это и есть
    // способ его назвать, поэтому проверка источника данных стоит после него.
    if (action.kind === 'repo') {
      if (action.text === '') {
        return {
          text:
            remote === null
              ? `github-pr: ${reason === '' ? 'репозиторий не выбран' : reason}`
              : `Репозиторий: **${remote.host}/${remote.owner}/${remote.repo}**, взят из ${repoFrom ?? 'remote'}.`,
        }
      }

      const chosen = repoRefOf(action.text, remote?.host ?? settings.host ?? DEFAULT_HOST)

      if (!chosen) {
        return {
          text:
            'Не разобрал адрес репозитория. Форма: `owner/repo`, ' +
            '`gh.example.com/owner/repo` или ссылка на репозиторий либо PR.',
        }
      }

      if (chosen.host !== remote?.host) {
        const failed = await pickBackend?.(chosen.host)

        if (failed === undefined) return { text: 'github-pr: источник данных ещё не выбран' }

        if (failed !== '') {
          reason = failed

          return { text: `github-pr: ${failed}` }
        }
      }

      // PR, найденный по ветке, принадлежал прежнему репозиторию: он снимается,
      // а новый ищется в названном. Отмеченные руками остаются - у каждого свой
      // адрес, и смена репозитория по умолчанию их не касается.
      if (autoKey !== null) stop(autoKey)

      remote = chosen
      repoFrom = 'команды'
      reason = ''
      await lookUpBranch()
      bound.invalidate()

      const found = autoKey === null ? '' : ` PR текущей ветки: ${watched.get(autoKey)?.label ?? ''}.`

      return {
        text: `Репозиторий: **${chosen.host}/${chosen.owner}/${chosen.repo}**.${found}`,
      }
    }

    if (api === null) {
      return { text: reason === '' ? noPrText : `github-pr: ${reason}` }
    }

    switch (action.kind) {
      case 'help':
        return { text: HELP_TEXT }

      case 'list': {
        if (watched.size === 0) await lookUpBranch()
        if (watched.size === 0) return { text: noPrText }

        await awaitFirstPoll()

        paneMode = 'list'
        await bound.openPane(LIST_TITLE)

        return { text: overviewText(list()) }
      }

      case 'watch': {
        const ref =
          prRefsOf(action.text)[0] ??
          (remote && action.number !== null
            ? { host: remote.host, owner: remote.owner, repo: remote.repo, number: action.number }
            : null)

        if (!ref) return { text: noPrText }

        const entry = watch(ref, false)

        selectedKey = entry.key
        paneMode = 'details'
        await bound.openPane(labelOf(ref))

        return { text: `Отслеживаю ${entry.label}.` }
      }

      case 'drop': {
        if (action.target === 'all') {
          for (const entry of list()) stop(entry.key)

          return { text: 'Снял с отслеживания все pull request.' }
        }

        const target =
          action.target === 'selected'
            ? selected()
            : list().find(entry => entry.ref.number === action.target)

        if (!target) return { text: 'Нечего снимать.' }

        stop(target.key)

        return { text: `Снял с отслеживания ${target.label}.` }
      }

      case 'refresh': {
        // Опрос, остановленный отказом по токену, поднимается именно здесь:
        // человек поправил токен и сказал об этом командой.
        if (pollTimer === undefined) startTimer?.()

        await refreshAll()

        const entry = selected()

        return { text: entry ? statusText(entry) : noPrText }
      }

      case 'threads': {
        const entry = selected()

        if (!entry) return { text: noPrText }
        if (!entry.data) await refresh(entry)

        return { text: threadsText(entry) }
      }

      case 'checks': {
        const entry = selected()

        if (!entry) return { text: noPrText }
        if (!entry.data) await refresh(entry)

        return { text: checksText(entry) }
      }

      case 'status': {
        const entry = selected()

        if (!entry) return { text: noPrText }
        if (!entry.data) await refresh(entry)

        return { text: statusText(entry) }
      }

      default: {
        if (watched.size === 0) await lookUpBranch()

        const entry = selected()

        if (!entry) return { text: noPrText }

        if (isPaneOpen) {
          await bound.closePane()

          return { text: 'Панель закрыта.' }
        }

        // Один PR - сразу детали, несколько - общий список: перечень и есть
        // ответ на «что из этого ждёт меня», а детали берутся входом в строку.
        if (watched.size > 1) {
          await awaitFirstPoll()

          paneMode = 'list'
          await bound.openPane(LIST_TITLE)

          return { text: overviewText(list()) }
        }

        paneMode = 'details'
        await bound.openPane(entry.label)

        return {}
      }
    }
  })

  on('command.run', { command: ['clear', 'resume'] }, async ($, e, next) => {
    const result = await next(e)

    for (const entry of list()) watched.delete(entry.key)

    autoKey = null
    selectedKey = null
    armedKey = null
    branch = ''
    paneMode = 'details'

    if (isPaneOpen) await bound?.closePane().catch(() => undefined)

    bound?.status(undefined)
    bound?.invalidate()

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const refs = prRefsOf(e.text)

    // A prompt that is nothing but PR URLs toggles them and runs no turn.
    if (refs.length > 0 && isOnlyPrUrls(e.text)) {
      const done = refs.map(ref => {
        const key = keyOf(ref)
        const known = watched.get(key)

        if (known) {
          stop(key)

          return `снял ${known.label}`
        }

        return `отслеживаю ${watch(ref, false).label}`
      })

      return { drop: done.join(', ') }
    }

    for (const ref of refs) watch(ref, false)

    const armed = armedKey === null ? undefined : watched.get(armedKey)

    if (!armed?.data || openThreadsOf(armed.data).length === 0) return next(e)

    armedKey = null
    bound?.status(undefined)
    bound?.invalidate()

    return next({ ...e, context: [...(e.context ?? []), threadsText(armed)] })
  })

  // `gh pr create` prints the new PR's URL: the pull request Claude just
  // opened is watched without anyone naming it.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)

    if ('deny' in result) return result

    // Команда, которой PR меняется: пуш ветки, коммит, любое действие gh
    // над PR. После неё GitHub расходится с тем, что нарисовано.
    if (/\b(git\s+(push|commit)|gh\s+pr)\b/.test(e.command)) void refreshStale()

    if (!/\bgh\s+pr\s+create\b/.test(e.command)) return result

    const stdout = rec(result.result).stdout

    if (typeof stdout === 'string') for (const ref of prRefsOf(stdout)) watch(ref, true)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined && e.reason === 'answer') {
      for (const ref of prRefsOf(e.answer)) watch(ref, true)
    }

    // Ход закончился - человек снова смотрит на строку над вводом, и она
    // должна нести то, что в GitHub сейчас, а не то, что было на тике.
    if (e.agentId === undefined) void refreshStale()

    return result
  })

  // --- What the drawn elements do ---------------------------------------

  function actionsOf(): Actions {
    return {
      select: key => {
        selectedKey = key
        paneMode = 'details'

        const entry = watched.get(key)

        if (entry) void bound?.openPane(entry.label)

        bound?.invalidate()
      },
      openList: () => {
        paneMode = 'list'
        void bound?.openPane(LIST_TITLE)
        bound?.invalidate()
      },
      openUrl: url => bound?.openUrl(url),
      ask: key => {
        const entry = watched.get(key)

        if (!entry?.data) return

        if (armedKey === key) {
          armedKey = null
          bound?.status(undefined)
        } else {
          armedKey = key

          const open = openThreadsOf(entry.data).length

          bound?.status(
            `${entry.label}: ${open} открытых тредов уедут в следующий промпт (нажмите ещё раз, чтобы снять)`,
          )
        }

        bound?.invalidate()
      },
      stop,
      toggleResolved: () => {
        showResolved = !showResolved
        bound?.invalidate()
      },
    }
  }
}
