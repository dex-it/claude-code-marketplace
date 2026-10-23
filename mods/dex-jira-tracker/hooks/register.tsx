/* @jsx h */
// The mod itself: what it hooks and in which order things happen.
//
//   session.start   binds `$`, registers `/jira`, checks jira-cli, reads the
//                   snapshot the last session left, and starts the poll.
//   ui.render       draws the band above the prompt and the `/jira` pane.
//   command.run     `/jira` and its words.
//   tool.call Bash  a command of the model that writes to Jira (`jira issue
//                   move`, `create`, `comment`) polls at once.
//   turn.complete   the end of a turn polls what the timer has not refreshed
//                   lately, and the hint for the next step is shown once.
//
// Work is handed to the model, never done by the mod behind its back: the
// statement of a task, the implementation and the hand-over are briefs sent to
// the main loop (dispatch.ts), which has the channel to the person. The only
// writes the mod makes itself are the two a button names - assign and move on
// "take into work".
//
// Everything the mod knows lives in this module's variables and in the plugin
// store; a hot reload or a new session starts from the snapshot.

import type { PluginOptions, Register, RenderElement, Timer } from 'claude-code'

import { HELP_TEXT, parseArgs } from './args.ts'
import type { Host, Problem, Source } from './backend.ts'
import { JiraAuthError, backendOf, problemText } from './backend.ts'
import {
  DEFAULT_BRANCH_PATTERN,
  branchName,
  hostingOf,
  publishBrief,
  shipBrief,
  specBrief,
  workBrief,
} from './dispatch.ts'
import type { Brief } from './dispatch.ts'
import type { Change } from './jira.ts'
import { IMPORTANT_KINDS, KEY_RE, browseUrl, clean, firstLine } from './jira.ts'
import type { Filter } from './overview.ts'
import { overviewOf } from './overview.ts'
import { applyComments, applyPoll, pollSource } from './poll.ts'
import type { Scope } from './scope.ts'
import { PROJECT_RE, SCOPE_WORD, projectOfKeys, queriesOf, scopeOf } from './scope.ts'
import { fromSnapshot, snapshotKey, toSnapshot } from './snapshot.ts'
import type { Found, Hosts } from './tools.ts'
import { detectTools, installLine, installTargets, toolOf, toolsText } from './tools.ts'
import { SETUP_TEXT, commentsText, issueText, overviewText } from './text.ts'
import type { Actions, PaneModel, PaneView, Ui } from './views.tsx'
import { bandView, paneView } from './views.tsx'
import type { Tracked } from './watched.ts'
import { groupOfCategory } from './watched.ts'

const COMMAND = 'jira'
const PANE_ID = 'jira'
const MIN_POLL_MS = 30_000
/** Comments fetched per issue that moved; the last ones, which is where the new ones are. */
const COMMENTS_FETCHED = 10
/** Issues per poll that get a second call to find new comments: a flood of edits must not be a flood of calls. */
const LOOKUPS_PER_POLL = 6
const LOOKUP_CONCURRENCY = 3
/** A poll for a reason (end of turn, a write to Jira) skips an issue set polled this recently. */
const REFRESH_MIN_AGE_MS = 20_000
const DESCRIPTION_LINES = 10
const COMMENT_LIMIT = 3
const BAND_WAITING_ROWS = 2
const TOAST_MS = 8000
/** Lines of a digest or a poll's changes written into the transcript; the rest is counted. */
const LOG_LINES_MAX = 12
const PANE_CHROME_ROWS = 8
const PANE_MAX_SCREEN_SHARE = 2
const PANE_FALLBACK_COLUMNS = 60
const SOUND_BAD = '/System/Library/Sounds/Basso.aiff'
const SOUND_CHANGE = '/System/Library/Sounds/Glass.aiff'
const BREW_TAP = 'ankitpokhrel/jira-cli'

type Settings = {
  project: string
  scope: Scope
  jql: string
  pollMs: number
  limit: number
  doneDays: number
  notify: string
  notifyMineOnly: boolean
  sound: boolean
  band: boolean
  workStatus: string
  workAssign: boolean
  branchPattern: string
  baseBranch: string
  reviewStatus: string
  issueType: string
  hosting: string
  implementCommand: string
  reviewCommand: string
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

/** The elements this mod draws with, out of whatever the surface offers; `Input` only where there is one. */
const uiOf = (elements: {
  Box: Ui['Box']
  Text: Ui['Text']
  Button: Ui['Button']
  Link: Ui['Link']
  Input?: Ui['Input']
}): Ui => ({
  Box: elements.Box,
  Text: elements.Text,
  Button: elements.Button,
  Link: elements.Link,
  ...(elements.Input === undefined ? {} : { Input: elements.Input }),
})

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Run `size` jobs at a time: a flood of moved issues must not start a flood of `jira` processes. */
async function mapPool<T>(items: readonly T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next]

      next += 1

      if (item !== undefined) await run(item)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker))
}

export const register: Register = (on, pluginOptions) => {
  const settings: Settings = {
    project: optString(pluginOptions, 'project', ''),
    scope: scopeOf(optString(pluginOptions, 'scope', 'project'), 'project'),
    jql: optString(pluginOptions, 'jql', ''),
    pollMs: Math.max(MIN_POLL_MS, optNumber(pluginOptions, 'pollSeconds', 120) * 1000),
    limit: Math.min(100, Math.max(10, optNumber(pluginOptions, 'limit', 100))),
    doneDays: Math.max(0, optNumber(pluginOptions, 'doneDays', 1)),
    notify: optString(pluginOptions, 'notify', 'all'),
    notifyMineOnly: optBool(pluginOptions, 'notifyMineOnly', false),
    sound: optBool(pluginOptions, 'sound', false),
    band: optBool(pluginOptions, 'band', true),
    workStatus: optString(pluginOptions, 'workStatus', 'In Progress'),
    workAssign: optBool(pluginOptions, 'workAssign', true),
    branchPattern: optString(pluginOptions, 'branchPattern', DEFAULT_BRANCH_PATTERN),
    baseBranch: optString(pluginOptions, 'baseBranch', ''),
    reviewStatus: optString(pluginOptions, 'reviewStatus', ''),
    issueType: optString(pluginOptions, 'issueType', 'Task'),
    hosting: optString(pluginOptions, 'hosting', 'auto'),
    implementCommand: optString(pluginOptions, 'implementCommand', 'implement'),
    reviewCommand: optString(pluginOptions, 'reviewCommand', 'mr-review'),
  }

  let tracked = new Map<string, Tracked>()
  let source: Source | null = null
  let login = ''
  let problem: { kind: Problem; text: string } | null = null
  /** Set once the person has asked for Jira in this session: until then a missing jira-cli is one log line, not a band. */
  let isAsked = false
  /** A session with a screen: the only kind that polls on its own. */
  let isInteractive = false
  let project = settings.project
  let scopeMode: Scope = settings.scope
  let customJql = settings.jql
  let filter: Filter = 'all'
  let baseUrl = ''
  let selectedKey: string | null = null
  let paneMode: PaneView = 'list'
  let isPaneOpen = false
  let isFirstPoll = true
  /** The set came from the last session's snapshot: the first poll is a digest, not news. */
  let isDigest = false
  let truncated = false
  let updatedMs = 0
  let polling: Promise<void> | null = null
  let pollTimer: Timer | undefined
  let found: Found[] = detectTools([])
  let hosts: Hosts = { gh: false, glab: false }
  let cwd = ''
  let paneColumns = PANE_FALLBACK_COLUMNS
  let screenRows = 0
  const busy = new Set<string>()
  /** Keys the model created itself this session: the poll lists them but does not announce them as news. */
  const ownCreated = new Set<string>()
  /** The statement the last `spec` produced is for this issue (null - a new one): `publish` reads it. */
  let lastSpec: { key: string | null } | null = null
  /** What to say once at the end of the next turn: the next step after a brief. */
  let hint: string | null = null
  let pickSource: (() => Promise<string>) | null = null

  let bound: {
    log: (text: string) => void
    toast: (text: string) => void
    invalidate: () => void
    openPane: (title: string) => Promise<void>
    closePane: () => Promise<void>
    openUrl: (url: string) => void
    play: (sound: string) => void
    now: () => Promise<number>
    submit: (brief: Brief) => Promise<void>
    after: (ms: number, run: () => void) => void
    run: (argv: readonly string[], timeoutMs?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>
    commands: () => Promise<Found[]>
    runCommand: (command: string, args: string) => Promise<string>
    store: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> }
  } | null = null

  const list = () => [...tracked.values()]
  const urlOf = (key: string) => browseUrl(baseUrl, key)
  const projectLabel = () => project || projectOfKeys([...tracked.keys()])

  const selected = () => (selectedKey === null ? undefined : tracked.get(selectedKey)) ?? undefined

  const storeKey = () => snapshotKey({ project, scope: scopeMode, jql: customJql })

  // --- Persistence --------------------------------------------------------------

  async function persist(): Promise<void> {
    if (!bound || tracked.size === 0) return

    try {
      await bound.store.set(storeKey(), toSnapshot(tracked, await bound.now()))
    } catch (error) {
      bound.log(`jira: снимок не сохранён: ${messageOf(error)}`)
    }
  }

  // --- Announcing -----------------------------------------------------------------

  type Announcement = { key: string; changes: Change[] }

  /**
   * What reaches the person: the transcript line per change (it stays in the
   * history) and one toast over them. A digest from the last session's
   * snapshot is one summary line and a few examples, not a line per change.
   */
  function announce(items: readonly Announcement[], digest: boolean): void {
    if (settings.notify === 'off' || !bound || items.length === 0) return

    const wanted = items
      .map(item => {
        const entry = tracked.get(item.key)
        const changes = item.changes
          .filter(change => settings.notify !== 'important' || IMPORTANT_KINDS.includes(change.kind))
          .filter(change => !(change.kind === 'created' && ownCreated.has(item.key)))

        // Only the person's own and the watched ones, when the setting asks: a
        // reassignment to the person is theirs by definition and always passes.
        const isTheirs = entry?.mine === true || entry?.issue.watching === true

        return {
          key: item.key,
          changes: settings.notifyMineOnly && !isTheirs ? changes.filter(change => change.level === 'wait') : changes,
        }
      })
      .filter(item => item.changes.length > 0)

    if (wanted.length === 0) return

    const lines = wanted.flatMap(item => item.changes.map(change => `${item.key}: ${change.text}`))

    if (digest) {
      bound.log(`jira: с прошлой сессии изменились ${wanted.length} задач`)
    }

    for (const line of lines.slice(0, LOG_LINES_MAX)) bound.log(`jira: ${line}`)

    if (lines.length > LOG_LINES_MAX) bound.log(`jira: ... и ещё ${lines.length - LOG_LINES_MAX} изменений, подробно - /jira list`)

    const first = wanted[0]
    const head = first?.changes.slice(0, 2).map(change => change.text).join('; ') ?? ''

    bound.toast(
      digest
        ? `Jira: с прошлой сессии изменились ${wanted.length} задач (/jira new)`
        : wanted.length === 1 && first
          ? `${first.key} ${head}${first.changes.length > 2 ? ` (+${first.changes.length - 2})` : ''}`
          : `Jira: изменения в ${wanted.length} задачах (/jira new)`,
    )

    if (settings.sound) {
      const isUrgent = wanted.some(item => item.changes.some(change => change.level === 'wait' || change.level === 'bad'))

      bound.play(isUrgent ? SOUND_BAD : SOUND_CHANGE)
    }
  }

  // --- Polling --------------------------------------------------------------------

  /** Remember the server address once: links and "open" need it, and a view brings it for free. */
  async function ensureBaseUrl(): Promise<void> {
    if (baseUrl !== '' || !source) return

    const key = tracked.keys().next().value

    if (key === undefined) return

    const url = await source.url(key).catch(() => '')
    const cut = url.indexOf('/browse/')

    if (cut > 0) baseUrl = url.slice(0, cut)
  }

  function stopTimer(): void {
    pollTimer?.cancel()
    pollTimer = undefined
  }

  function poll(): Promise<void> {
    if (polling) return polling

    const run = pollOnce().finally(() => {
      polling = null
    })

    polling = run

    return run
  }

  async function pollOnce(): Promise<void> {
    const current = source
    const built = queriesOf({ scope: scopeMode, jql: customJql, doneDays: settings.doneDays })

    if (!current || !bound) return

    if (built.queries === undefined) {
      problem = { kind: 'error', text: built.reason }
      bound.invalidate()

      return
    }

    try {
      const { poll: answer, page } = await pollSource(current, built.queries, settings.limit)
      const outcome = applyPoll(tracked, answer, isFirstPoll)
      const lookups = outcome.look.slice(0, LOOKUPS_PER_POLL)

      truncated = page.truncated

      // `updated` moved: something happened that the list does not show - most
      // often a comment. One view per such issue, a few at a time.
      await mapPool(lookups, LOOKUP_CONCURRENCY, async ({ key, sinceMs }) => {
        const entry = outcome.next.get(key)

        if (!entry) return

        const detail = await current.view(key, COMMENTS_FETCHED).catch(() => null)

        if (detail === null) return

        if (baseUrl === '' && detail.baseUrl !== '') baseUrl = detail.baseUrl

        const added = applyComments(entry, detail, sinceMs, login === '' ? null : login)

        if (added.length > 0) outcome.announced.push({ key, changes: added })
      })

      const digest = isDigest

      tracked = outcome.next
      isFirstPoll = false
      isDigest = false
      problem = null
      updatedMs = await bound.now()

      // A set restored from the snapshot compares against the old state, so the
      // changes found are real - but they are a digest, not news of this minute.
      announce(outcome.announced, digest)

      await ensureBaseUrl()

      if (selectedKey !== null && !tracked.has(selectedKey)) selectedKey = null

      await persist()
    } catch (error) {
      // A rejected login must not be retried by the timer: Jira Server answers a
      // few wrong logins in a row with a CAPTCHA, then locks the account.
      if (error instanceof JiraAuthError) {
        stopTimer()
        problem = { kind: 'auth', text: error.message }
      } else if (tracked.size === 0) {
        problem = { kind: 'error', text: messageOf(error) }
      } else {
        bound.log(`jira: опрос не удался: ${messageOf(error)}`)
      }
    } finally {
      bound.invalidate()
    }
  }

  /** A poll for a reason: skipped where the timer polled a moment ago. */
  async function refreshStale(): Promise<void> {
    if (!source || !bound || pollTimer === undefined) return

    if ((await bound.now()) - updatedMs > REFRESH_MIN_AGE_MS) await poll()
  }

  /** Start from nothing: a new scope, project or query has no state to compare with. */
  async function resetAndPoll(): Promise<string> {
    tracked = new Map()
    selectedKey = null
    isFirstPoll = true
    isDigest = false
    truncated = false

    const built = queriesOf({ scope: scopeMode, jql: customJql, doneDays: settings.doneDays })

    if (built.queries === undefined) return built.reason

    // The project may have changed, and with it the source: `-p` is fixed when it is built.
    const failed = (await pickSource?.()) ?? 'мод ещё не готов'

    if (failed !== '') return failed

    await poll()

    return problem === null ? '' : problem.text
  }

  async function loadDetail(entry: Tracked): Promise<void> {
    if (!source) return

    const detail = await source.view(entry.key, COMMENTS_FETCHED).catch((error: unknown) => {
      bound?.log(`jira: ${entry.key}: ${messageOf(error)}`)

      return null
    })

    if (detail === null) return

    if (baseUrl === '' && detail.baseUrl !== '') baseUrl = detail.baseUrl

    entry.detail = detail
    bound?.invalidate()
  }

  // --- Selection and the pane -------------------------------------------------------

  const filteredKeys = () => overviewOf(list(), filter).rows.map(row => row.key)

  function wantedRows(): number | null {
    if (screenRows === 0) return null

    const half = Math.floor(screenRows / PANE_MAX_SCREEN_SHARE)

    if (paneMode === 'list') {
      return Math.max(1, Math.min(PANE_CHROME_ROWS + overviewOf(list(), filter).rows.length, half))
    }

    const entry = selected()

    if (!entry) return null

    return Math.max(
      1,
      Math.min(PANE_CHROME_ROWS + 12 + DESCRIPTION_LINES + COMMENT_LIMIT * 2 + entry.fresh.length, half),
    )
  }

  async function openDetails(key: string): Promise<void> {
    const entry = tracked.get(key)

    if (!entry) return

    selectedKey = key
    paneMode = 'details'
    await bound?.openPane(key)
    bound?.invalidate()

    // Opening the details is looking: what was fresh is seen now. Looked up again
    // afterwards, because a poll in between replaces the entries; what arrived
    // while the details loaded was not seen yet and stays.
    const seen = entry.fresh.length
    void loadDetail(entry).then(() => {
      const current = tracked.get(key)

      if (seen > 0 && current) {
        current.fresh = current.fresh.slice(seen)
        void persist()
        bound?.invalidate()
      }
    })
  }

  async function openList(): Promise<void> {
    paneMode = 'list'
    await bound?.openPane(`Jira${projectLabel() === '' ? '' : ` ${projectLabel()}`}`)
    bound?.invalidate()
  }

  function step(delta: 1 | -1): void {
    const keys = filteredKeys()

    if (keys.length === 0) return

    const place = Math.max(0, keys.indexOf(selectedKey ?? ''))
    const key = keys[(place + delta + keys.length) % keys.length]

    if (key !== undefined) void openDetails(key)
  }

  function uiModel(): PaneModel {
    return {
      columns: paneColumns,
      view: paneMode,
      filter,
      overview: overviewOf(list(), filter),
      list: list(),
      selectedKey: selected()?.key ?? null,
      scopeWord: SCOPE_WORD[scopeMode],
      project: projectLabel(),
      problem: problem === null ? '' : problemText(problem.kind, problem.text),
      truncated,
      busy,
      urlOf,
      hasHosting: found.some(item => (item.role === 'github' || item.role === 'gitlab') && item.installed),
      descriptionLines: DESCRIPTION_LINES,
      commentLimit: COMMENT_LIMIT,
      updatedMs,
    }
  }

  // --- Hand-overs ----------------------------------------------------------------------

  /** The catalog's commands change when a plugin is installed or reloaded: look at them each time work is handed over. */
  async function freshTools(): Promise<Found[]> {
    if (bound) found = await bound.commands()

    return found
  }

  async function currentBranch(): Promise<string> {
    if (!bound) return ''

    const res = await bound.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).catch(() => null)

    return res !== null && res.exitCode === 0 ? res.stdout.trim() : ''
  }

  async function hostingNow() {
    if (!bound) return hostingOf('', settings.hosting)

    const res = await bound.run(['git', 'remote', 'get-url', 'origin']).catch(() => null)

    return hostingOf(res !== null && res.exitCode === 0 ? res.stdout.trim() : '', settings.hosting)
  }

  async function send(brief: Brief, next: string | null): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    const sender = bound

    hint = next
    sender.log(`jira: ${brief.note}`)

    // Not from here: the caller may be the `command.run` hook of `/jira`, and the
    // engine refuses a submission made inside a hook the turn is waiting on (it
    // would wait on itself). A timer runs it once the hook has answered.
    sender.after(0, () => {
      void sender.submit(brief)
    })

    return brief.note
  }

  async function startSpec(key: string | null, idea: string): Promise<string> {
    const entry = key === null ? undefined : tracked.get(key)

    if (key !== null && !entry) return `${key}: нет в наблюдении, сначала /jira ${key}`
    if (key === null && idea.trim() === '') return 'Опишите идею: `/jira spec <идея>` либо `/jira spec SUP-12` для существующей задачи.'

    if (entry && !entry.detail) await loadDetail(entry)

    lastSpec = { key }

    const brief = specBrief({
      found: await freshTools(),
      issue: entry?.issue ?? null,
      ...(entry?.detail ? { detail: entry.detail } : {}),
      url: entry ? urlOf(entry.key) : '',
      idea,
    })

    return send(brief, `Постановка готова. Внести в Jira: /jira publish${key === null ? '' : ` ${key}`} (после вашего «оформляй»).`)
  }

  async function startPublish(key: string | null): Promise<string> {
    const target = key ?? lastSpec?.key ?? null
    const entry = target === null ? undefined : tracked.get(target)

    if (target !== null && !entry) return `${target}: нет в наблюдении, сначала /jira ${target}`

    const brief = publishBrief({ issue: entry?.issue ?? null, issueType: settings.issueType })

    lastSpec = null

    return send(brief, null)
  }

  async function takeIntoWork(key: string): Promise<string> {
    const entry = tracked.get(key)

    if (!entry) return `${key}: нет в наблюдении, сначала /jira ${key}`
    if (!source || !bound) return 'jira-cli не готов'
    if (busy.has(key)) return `${key}: уже беру в работу`
    if (entry.group === 'done') return `${key}: задача закрыта (${entry.issue.status}), в работу не беру. Переоткройте её в Jira.`

    busy.add(key)
    bound.invalidate()

    try {
      if (!entry.detail) await loadDetail(entry)

      // The two writes the mod makes itself, both named by the button. A failure
      // stops here: code written on an issue that is still somebody else's is
      // the one outcome that cannot be told apart from success afterwards.
      if (settings.workAssign && !entry.mine) {
        if (login === '') return `${key}: не знаю, кто вы (jira me пуст), назначить не могу`

        await source.assign(key, login).catch((error: unknown) => {
          throw new Error(`не назначил ${key} на вас: ${messageOf(error)}`)
        })
      }

      if (settings.workStatus !== '' && entry.group === 'open') {
        await source.move(key, settings.workStatus).catch((error: unknown) => {
          throw new Error(
            `не перевёл ${key} в "${settings.workStatus}": ${messageOf(error)}. Статус называется иначе? Настройка workStatus.`,
          )
        })
      }

      const branch = entry.branch ?? branchName(settings.branchPattern, entry.issue)

      entry.branch = branch

      void poll()

      const brief = workBrief({
        found: await freshTools(),
        issue: entry.issue,
        ...(entry.detail ? { detail: entry.detail } : {}),
        url: urlOf(key),
        branch,
        base: settings.baseBranch,
      })

      return await send(brief, `Реализация закончена. Сдать: /jira ship ${key} (push и PR/MR).`)
    } catch (error) {
      return messageOf(error)
    } finally {
      busy.delete(key)
      bound.invalidate()
    }
  }

  async function startShip(key: string | null): Promise<string> {
    const entry = key === null ? selected() : tracked.get(key)

    if (!entry) return 'Не знаю, какую задачу сдавать: `/jira ship SUP-12`.'

    const tools = await freshTools()
    const hosting = await hostingNow()
    const branch = entry.branch ?? (await currentBranch())
    const brief = shipBrief({
      issue: entry.issue,
      url: urlOf(entry.key),
      branch,
      base: settings.baseBranch,
      hosting,
      reviewStatus: settings.reviewStatus,
    })
    const tracker = hosting === 'github' ? toolOf(tools, 'github') : hosting === 'gitlab' ? toolOf(tools, 'gitlab') : null
    const tail =
      tracker === null || tracker.installed
        ? tracker === null ? '' : ` PR/MR уйдёт под наблюдение /${tracker.actual}.`
        : ` Для слежения за PR/MR: ${installLine(tracker.plugin)}.`

    if (branch !== '' && entry.branch === undefined) entry.branch = branch

    return `${await send(brief, `Сдано. Состояние PR/MR: /jira pr.`)}${tail}`
  }

  async function openHosting(): Promise<string> {
    const tools = await freshTools()
    const hosting = await hostingNow()

    if (hosting === 'unknown') {
      return 'Хостинг по remote origin не определён: задайте настройку hosting (github или gitlab).'
    }

    const tool = toolOf(tools, hosting)

    if (!tool.installed) {
      return `Трекер ${hosting === 'github' ? 'PR' : 'MR'} не установлен: ${installLine(tool.plugin)} (затем перечитайте плагины).`
    }

    return (await bound?.runCommand(tool.actual, '')) ?? 'мод ещё не готов'
  }

  async function installTools(what: string): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    const targets = installTargets(await freshTools(), what)

    if (targets === null) return `Не знаю роль "${what}". Роли: spec, implement, selfReview, review, github, gitlab, либо all.`
    if (targets.length === 0) return 'Это уже установлено.'

    const lines: string[] = []

    for (const target of targets) {
      const res = await bound
        .run(['claude', 'plugin', 'install', `${target.plugin}@dex-claude-marketplace`], 180_000)
        .catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: messageOf(error) }))

      lines.push(
        res.exitCode === 0
          ? `- ${target.plugin}: установлен`
          : `- ${target.plugin}: не установлен (${firstLine(res.stderr || res.stdout, 160)}). Руками: ${installLine(target.plugin)}`,
      )
    }

    return [...lines, '', 'Чтобы команды появились в этой сессии, перечитайте плагины (/reload-plugins) либо перезапустите её.'].join('\n')
  }

  async function installJira(): Promise<string> {
    if (!bound) return 'мод ещё не готов'

    const brew = await bound.run(['brew', '--version'], 15_000).catch(() => null)

    if (brew === null || brew.exitCode !== 0) {
      return `brew не найден. Поставьте jira-cli другим способом:\n\n${SETUP_TEXT}`
    }

    bound.log('jira: ставлю jira-cli через brew, это может занять минуту...')

    for (const argv of [['brew', 'tap', BREW_TAP], ['brew', 'install', 'jira-cli']] as const) {
      const res = await bound.run(argv, 600_000).catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: messageOf(error) }))

      if (res.exitCode !== 0) {
        return `${argv.join(' ')} не прошёл: ${firstLine(res.stderr || res.stdout, 200)}\n\n${SETUP_TEXT}`
      }
    }

    const failed = (await pickSource?.()) ?? ''

    if (failed !== '') return `jira-cli поставлен, но не готов: ${failed}\n\nДальше: \`jira init\` в терминале, затем /jira refresh.`

    await resetAndPoll()

    return 'jira-cli поставлен и отвечает. Наблюдение запущено: /jira.'
  }

  // --- Hooks ---------------------------------------------------------------------------------

  on('session.start', async ($, e, next) => {
    const result = await next(e)

    cwd = e.cwd
    // Before any early return: a jira-cli installed later in the session still needs its timer.
    isInteractive = e.isInteractive

    const host: Host = { run: (argv, init) => $.process.run(argv, init) }

    bound = {
      log: text => $.ui.log(text.startsWith('jira:') ? text : `jira: ${text}`),
      toast: text => $.ui.toast(text, { timeoutMs: TOAST_MS }),
      invalidate: () => $.ui.invalidate('ui.render'),
      openPane: async title => {
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
          .catch((error: unknown) => $.ui.log(`jira: ${messageOf(error)}`))
      },
      play: sound => {
        void $.process.run(['afplay', sound]).catch(() => undefined)
      },
      now: () => $.clock.now(),
      submit: async brief => {
        // A catalog command is run as a command, not typed as a prompt: the engine
        // refuses a prompt that starts with a slash.
        if (brief.command !== undefined) {
          const { name, args } = brief.command

          await $.command.run({ command: name, args }).catch((error: unknown) => {
            $.ui.log(`jira: /${name} не запустилась: ${messageOf(error)}`)
          })

          return
        }

        await $.prompt.submit({ text: brief.text }).catch((error: unknown) => {
          $.ui.log(`jira: поручение не отправлено: ${messageOf(error)}`)
        })
      },
      after: (ms, run) => {
        $.clock.after(ms, run)
      },
      run: (argv, timeoutMs) => $.process.run(argv, { cwd, ...(timeoutMs === undefined ? {} : { timeoutMs }) }),
      commands: async () =>
        detectTools((await $.command.list()).map(command => ({ name: command.name, ...(command.plugin === undefined ? {} : { plugin: command.plugin }) })), {
          implement: settings.implementCommand,
          review: settings.reviewCommand,
        }),
      runCommand: async (command, args) => {
        const out = await $.command.run({ command, args })

        return out.text ?? `/${command} выполнена.`
      },
      store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
    }

    await $.command
      .register({
        name: COMMAND,
        description: 'Jira: задачи проекта, новое, постановка, взять в работу, сдать PR/MR.',
        argumentHint:
          '[SUP-12 | list | mine | progress | new | spec | work | ship | publish | comments | tools | setup | refresh]',
      })
      .catch((error: unknown) => {
        $.ui.log(`jira: команда /${COMMAND} не занята мной: ${messageOf(error)}`)
      })

    // The source is rebuilt on request: the project is part of it (`-p`), and
    // `/jira install` or a fixed login makes a missing one appear.
    pickSource = async () => {
      const choice = await backendOf(host, { project, cwd })

      if (choice.source === undefined) {
        source = null
        problem = { kind: choice.kind, text: choice.reason }

        return problemText(choice.kind, choice.reason)
      }

      source = choice.source
      login = choice.login
      problem = null

      return ''
    }

    const failed = await pickSource()

    hosts = {
      gh: await $.process.run(['gh', '--version']).then(res => res.exitCode === 0).catch(() => false),
      glab: await $.process.run(['glab', '--version']).then(res => res.exitCode === 0).catch(() => false),
    }
    found = await bound.commands().catch(() => found)

    if (failed !== '') {
      // One line, no band: someone who installed the mod for another reason is not nagged every session.
      $.ui.log(`jira: ${failed}`)

      return result
    }

    // Headless runs draw nothing and must not poll the network on their own;
    // `/jira list` polls on demand.
    if (!isInteractive) return result

    const restored = fromSnapshot(await $.store.get(storeKey()).catch(() => undefined), await $.clock.now())

    if (restored !== null) {
      tracked = restored
      isFirstPoll = false
      isDigest = true
    }

    void poll()

    pollTimer = $.clock.every(settings.pollMs, () => {
      void poll()
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!settings.band || e.props.hasSurvey) return next(e)

    const isShown = tracked.size > 0 || (isAsked && problem !== null)

    if (!isShown) return next(e)

    const ui = uiOf(await $.ui.resolve(e))
    const overview = overviewOf(list())

    return bandView(
      ui,
      actionsOf(),
      {
        overview,
        project: projectLabel(),
        problem: problem === null ? '' : problemText(problem.kind, problem.text),
        waiting: overview.rows.filter(row => row.attention === 'act').slice(0, BAND_WAITING_ROWS),
      },
      (await next(e)) as RenderElement,
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)

    const ui = uiOf(await $.ui.resolve(e))

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

    // These work with no source at all: they are how one gets a source.
    if (action.kind === 'help') return { text: HELP_TEXT }
    if (action.kind === 'setup') return { text: SETUP_TEXT }
    if (action.kind === 'install') return { text: await installJira() }

    if (action.kind === 'tools') {
      const tools = await freshTools()

      return { text: action.install === null ? toolsText(tools, hosts) : await installTools(action.install) }
    }

    isAsked = true

    if (source === null || problem !== null) {
      // A retry before giving up: the person may have fixed the login since.
      const failed = (await pickSource?.()) ?? 'мод ещё не готов'

      if (failed !== '') {
        bound.invalidate()

        return { text: failed }
      }

      if (pollTimer === undefined && isInteractive) {
        pollTimer = $.clock.every(settings.pollMs, () => {
          void poll()
        })
      }
    }

    /** A first poll for the session that has none: headless runs, and the first command after a fixed login. */
    const ensurePolled = async () => {
      if (isFirstPoll && tracked.size === 0) await poll()
    }

    switch (action.kind) {
      case 'refresh': {
        await poll()

        return { text: problem === null ? overviewText(overviewOf(list(), filter), textInput()) : problemText(problem.kind, problem.text) }
      }

      case 'list': {
        await ensurePolled()
        paneMode = 'list'
        await openList()

        return { text: overviewText(overviewOf(list(), filter), textInput()) }
      }

      case 'filter': {
        await ensurePolled()
        filter = action.filter
        paneMode = 'list'
        await openList()

        return { text: overviewText(overviewOf(list(), filter), textInput()) }
      }

      case 'step': {
        if (tracked.size === 0) return { text: overviewText(overviewOf(list(), filter), textInput()) }

        step(action.delta)

        return {}
      }

      case 'show': {
        await ensurePolled()

        const key = action.key ?? numberKey(action.number)

        if (key === null) return { text: 'Не знаю проект для номера: `/jira SUP-12`.' }

        let entry = tracked.get(key)

        // A key outside the followed set - another project, an old one - is still
        // worth showing: fetch it and hold it until the next poll replaces the set.
        if (!entry && source) {
          const detail = await source.view(key, COMMENTS_FETCHED).catch(() => null)

          if (detail === null) return { text: `${key}: Jira такой задачи не показала.` }

          if (baseUrl === '' && detail.baseUrl !== '') baseUrl = detail.baseUrl

          entry = { key, issue: detail.issue, group: groupOfCategory(detail.issue), mine: false, fresh: [], detail }
          tracked.set(key, entry)
        }

        if (!entry) return { text: `${key}: нет в наблюдении.` }

        if (!entry.detail) await loadDetail(entry)

        await openDetails(key)

        return { text: issueText(entry, urlOf(key)) }
      }

      case 'comments': {
        const entry = action.key === null ? selected() : tracked.get(action.key)

        if (!entry) return { text: 'Не знаю, чьи комментарии: `/jira comments SUP-12`.' }

        await loadDetail(entry)

        return { text: commentsText(entry) }
      }

      case 'seen': {
        if (action.target === 'all') {
          for (const entry of list()) entry.fresh = []
        } else {
          const entry = action.target === 'selected' ? selected() : tracked.get(action.target)

          if (!entry) return { text: 'Нечего отмечать.' }

          entry.fresh = []
        }

        void persist()
        bound.invalidate()

        return { text: action.target === 'all' ? 'Всё отмечено просмотренным.' : 'Отмечено просмотренным.' }
      }

      case 'project': {
        if (action.text === '') return { text: `Проект: ${projectLabel() || 'из конфига jira-cli'}. Сменить: /jira project KEY.` }

        if (!PROJECT_RE.test(action.text)) return { text: `"${action.text}" - не ключ проекта (буквы, цифры, подчёркивание).` }

        project = action.text.toUpperCase()

        const failed = await resetAndPoll()

        return { text: failed !== '' ? failed : `Проект ${project}.\n\n${overviewText(overviewOf(list(), filter), textInput())}` }
      }

      case 'scope': {
        scopeMode = action.scope

        const failed = await resetAndPoll()

        return { text: failed !== '' ? failed : `Охват: ${SCOPE_WORD[scopeMode]}.\n\n${overviewText(overviewOf(list(), filter), textInput())}` }
      }

      case 'jql': {
        if (action.text === '') return { text: 'Укажите запрос: `/jira jql assignee = currentUser() AND labels = urgent` (без ORDER BY).' }

        customJql = action.text
        scopeMode = 'jql'

        const failed = await resetAndPoll()

        return { text: failed !== '' ? failed : `Охват: свой JQL.\n\n${overviewText(overviewOf(list(), filter), textInput())}` }
      }

      case 'spec':
        await ensurePolled()

        return { text: await startSpec(action.text !== '' && KEY_RE.test(action.text.toUpperCase()) ? action.text.toUpperCase() : null, action.text) }

      case 'publish':
        return { text: await startPublish(action.key) }

      case 'work': {
        await ensurePolled()

        const key = action.key ?? selected()?.key

        if (key === undefined) return { text: 'Не знаю, какую задачу брать: `/jira work SUP-12`.' }

        return { text: await takeIntoWork(key) }
      }

      case 'ship':
        return { text: await startShip(action.key) }

      case 'hosting':
        return { text: await openHosting() }

      default: {
        await ensurePolled()

        if (tracked.size === 0) return { text: problem === null ? overviewText(overviewOf(list(), filter), textInput()) : problemText(problem.kind, problem.text) }

        if (isPaneOpen) {
          if (paneMode === 'details') {
            await openList()

            return {}
          }

          await bound.closePane()

          return { text: 'Панель закрыта.' }
        }

        paneMode = 'list'
        await openList()

        return { text: overviewText(overviewOf(list(), filter), textInput()) }
      }
    }
  })

  /** A bare number is a key of the project that most followed issues belong to. */
  function numberKey(number: number | null): string | null {
    const prefix = projectLabel()

    return number === null || prefix === '' ? null : `${prefix}-${number}`
  }

  const textInput = () => ({
    filter,
    scopeWord: SCOPE_WORD[scopeMode],
    project: projectLabel(),
    truncated,
  })

  // A command of the model that writes to Jira moves the list: poll at once, not
  // at the next tick. A created issue's key is remembered so it is not news.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)

    if ('deny' in result) return result

    if (/\bjira\s+issue\s+(move|assign|edit|create|comment|delete|link)\b/.test(e.command)) {
      if (/\bjira\s+issue\s+create\b/.test(e.command)) {
        const out = (result.result as { stdout?: unknown } | undefined)?.stdout

        if (typeof out === 'string') {
          for (const token of clean(out).split(/\s+/)) {
            const key = token.replace(/^.*\/browse\//, '').replace(/[^A-Za-z0-9_-]/g, '')

            if (KEY_RE.test(key)) ownCreated.add(key)
          }
        }
      }

      void poll()
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      void refreshStale()

      if (hint !== null && e.reason === 'answer') {
        bound?.toast(hint)
        bound?.log(hint)
        hint = null
      }
    }

    return result
  })

  // --- What the drawn elements do ------------------------------------------------------------

  function actionsOf(): Actions {
    return {
      select: key => {
        void openDetails(key)
      },
      openList: () => {
        void openList()
      },
      step,
      setFilter: next => {
        filter = next
        bound?.invalidate()
      },
      refreshNow: () => {
        void (async () => {
          if (source === null || problem !== null) {
            const failed = (await pickSource?.()) ?? ''

            if (failed !== '') {
              bound?.log(failed)
              bound?.invalidate()

              return
            }
          }

          await poll()
        })()
      },
      openUrl: url => bound?.openUrl(url),
      spec: (key, idea) => {
        void startSpec(key, idea).then(text => bound?.log(text))
      },
      publish: key => {
        void startPublish(key).then(text => bound?.log(text))
      },
      work: key => {
        void takeIntoWork(key).then(text => bound?.log(text))
      },
      ship: key => {
        void startShip(key).then(text => bound?.log(text))
      },
      seen: key => {
        if (key === 'all') {
          for (const entry of list()) entry.fresh = []
        } else {
          const entry = tracked.get(key)

          if (entry) entry.fresh = []
        }

        void persist()
        bound?.invalidate()
      },
      comments: key => {
        const entry = tracked.get(key)

        if (!entry) return

        void loadDetail(entry).then(() => bound?.log(commentsText(entry)))
      },
      hosting: () => {
        void openHosting().then(text => bound?.log(text))
      },
      setup: () => {
        bound?.log(SETUP_TEXT)
      },
    }
  }

}
