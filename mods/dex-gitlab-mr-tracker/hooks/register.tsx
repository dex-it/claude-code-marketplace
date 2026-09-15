/* @jsx h */
// The mod itself: what it hooks and in which order things happen.
//
//   session.start   binds `$`, registers `/mr`, reads the project off the
//                   git remote, picks a source and starts the poll.
//   ui.render       draws the rows above the prompt and the `/mr` pane.
//   command.run     `/mr` and its words; `clear` / `resume` forget the state.
//   prompt.submit   MR URLs in a prompt toggle watching; an armed MR's open
//                   threads ride the prompt as context, once.
//   tool.call Bash  the URL `glab mr create` prints is watched too.
//   turn.complete   an MR URL in Claude's answer is watched too.
//
// Everything the mod knows lives in this module's own variables: a hot
// reload or a new session starts from the branch again, which is cheap.

import type { PluginOptions, Register, RenderElement, Timer } from 'claude-code'

import { backendOf } from './backend'
import type { Api, Host } from './backend'
import { HELP_TEXT, parseArgs } from './args'
import type { Change, MrData, MrRef, Remote } from './gitlab'
import {
  IMPORTANT_KINDS,
  changesOf as changesOfData,
  isOnlyMrUrls,
  keyOf,
  labelOf,
  mrPath,
  mrRefsOf,
  mrDataOf,
  projectId,
  remoteOf,
} from './gitlab'
import { noMrText, statusText, threadsText } from './text'
import type { Actions, PaneModel, Ui } from './views'
import { bandView, paneView } from './views'
import type { Watched } from './watched'
import { openThreadsOf, watchedOf } from './watched'

const COMMAND = 'mr'
const PANE_ID = 'gitlab-mr'
const MIN_POLL_MS = 15_000
const COMMITS_PAGE = 100
const PANE_COMMITS = 8
const TOAST_MS = 8000
const SOUND_BAD = '/System/Library/Sounds/Basso.aiff'
const SOUND_CHANGE = '/System/Library/Sounds/Glass.aiff'

type Settings = {
  remote: string
  host: string
  project: string
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
    project: optString(pluginOptions, 'project', ''),
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
  let hasApprovals = true
  let pollTimer: Timer | undefined

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
  } | null = null

  const list = () => [...watched.values()]

  const selected = () =>
    (selectedKey === null ? undefined : watched.get(selectedKey)) ?? list()[0]

  const uiModel = (): PaneModel => ({
    list: list(),
    selectedKey: selected()?.key ?? null,
    showResolved,
    armedKey,
    commitLimit: PANE_COMMITS,
  })

  // --- Polling ----------------------------------------------------------

  /**
   * One poll per MR at a time: a caller that asks while a poll is in flight
   * waits for that one. `/mr status` right after the MR was found would
   * otherwise answer "no data yet" beside a poll that is already running.
   */
  function refresh(entry: Watched): Promise<void> {
    const running = inFlight.get(entry.key)

    if (running) return running

    const run = pollOnce(entry).finally(() => inFlight.delete(entry.key))

    inFlight.set(entry.key, run)

    return run
  }

  async function pollOnce(entry: Watched): Promise<void> {
    const source = api

    if (!source) return

    entry.busy = true

    try {
      const mr = await source.get(mrPath(entry.ref))

      if (mr === null) throw new Error('merge request не найден или закрыт доступ')

      const [discussions, commits, approvals] = await Promise.all([
        source.get(`${mrPath(entry.ref)}/discussions?per_page=100`, { paginate: true }),
        source.get(`${mrPath(entry.ref)}/commits?per_page=${COMMITS_PAGE}`),
        hasApprovals
          ? source.get(`${mrPath(entry.ref)}/approvals`).catch(() => undefined)
          : Promise.resolve(undefined),
      ])

      // A plan without the approvals endpoint answers 404 once; asking again
      // every poll would spend a call on a feature the instance does not have.
      if (approvals === null) hasApprovals = false
      if (!watched.has(entry.key)) return

      const next = mrDataOf({
        mr,
        discussions,
        commits,
        approvals,
        commitsPageSize: COMMITS_PAGE,
      })

      announce(entry, next)
      entry.data = next
      entry.error = undefined
    } catch (error) {
      entry.error = messageOf(error)
    } finally {
      entry.busy = false
      entry.updatedMs = await (bound?.now() ?? Promise.resolve(0))
      bound?.invalidate()
    }
  }

  const refreshAll = () => Promise.all(list().map(entry => refresh(entry)))

  function announce(entry: Watched, next: MrData): void {
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

  function changesFor(previous: MrData | undefined, next: MrData): Change[] {
    // The import is named `changesOf` in gitlab.ts; kept behind this wrapper so
    // the `important` filter lives in one place.
    const all = changesOfData(previous, next)

    return settings.notify === 'important'
      ? all.filter(change => IMPORTANT_KINDS.includes(change.kind))
      : all
  }

  // --- Watching ---------------------------------------------------------

  function watch(ref: MrRef, auto: boolean): Watched {
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

    if (selectedKey === key) selectedKey = list()[0]?.key ?? null
    if (watched.size === 0 && isPaneOpen) void bound?.closePane()

    bound?.invalidate()
  }

  /**
   * The MR of the branch the working copy is on now. A branch switch drops
   * the previous automatic one and looks the new branch up; an MR the person
   * asked for by hand is never dropped by a branch switch.
   */
  async function syncBranch(head: string): Promise<void> {
    if (!settings.autoWatchBranch || !api || !remote || head === branch) return

    branch = head

    if (autoKey !== null) {
      const previous = watched.get(autoKey)

      // The pane stays open across a branch switch and shows the new branch's
      // MR, so the outgoing one is dropped without closing anything.
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

    const query = [
      `source_branch=${encodeURIComponent(head)}`,
      'state=opened',
      'order_by=updated_at',
      'per_page=1',
    ].join('&')

    const found = await api
      .get(`projects/${projectId(remote.project)}/merge_requests?${query}`)
      .catch(() => null)

    const first = Array.isArray(found) ? found[0] : null
    const iid = rec(first).iid

    if (typeof iid !== 'number') {
      bound?.invalidate()

      return
    }

    const entry = watch({ host: remote.host, project: remote.project, iid }, true)

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
      log: text => $.ui.log(`gitlab-mr: ${text}`),
      toast: text => $.ui.toast(text, { timeoutMs: TOAST_MS }),
      status: text => $.ui.status(text),
      invalidate: () => $.ui.invalidate('ui.render'),
      openPane: async title => {
        await $.ui.open({ id: PANE_ID, title })
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
          .catch((error: unknown) => $.ui.log(`gitlab-mr: ${messageOf(error)}`))
      },
      play: sound => {
        void $.process.run(['afplay', sound]).catch(() => undefined)
      },
      now: () => $.clock.now(),
    }

    await $.command
      .register({
        name: COMMAND,
        description: 'Merge request GitLab: панель, открытые треды, состояние.',
        argumentHint: '[123 | ссылка | threads | status | refresh | drop]',
      })
      .catch((error: unknown) => {
        $.ui.log(`gitlab-mr: команда /${COMMAND} не занята мной: ${messageOf(error)}`)
      })

    const remoteUrl = await $.process
      .run(['git', 'remote', 'get-url', settings.remote], { cwd })
      .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
      .catch(() => '')

    const fromRemote = remoteOf(remoteUrl)
    const host_ = settings.host === '' ? fromRemote?.host : settings.host
    const project = settings.project === '' ? fromRemote?.project : settings.project

    if (host_ === undefined || project === undefined) {
      reason = `не вижу проект GitLab: remote "${settings.remote}" не назвал его`

      return result
    }

    remote = { host: host_, project }

    const token =
      settings.token !== ''
        ? settings.token
        : (await $.env.get('GITLAB_TOKEN')) ?? (await $.env.get('GLAB_TOKEN')) ?? ''

    const choice = await backendOf(host, {
      backend: settings.backend,
      hostname: remote.host,
      token,
      cwd,
    })

    if (choice.api === undefined) {
      reason = choice.reason
      $.ui.log(`gitlab-mr: ${choice.reason}`)

      return result
    }

    api = choice.api

    const headOf = () =>
      $.process
        .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
        .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
        .catch(() => '')

    await syncBranch(await headOf())

    if (!e.isInteractive) return result

    pollTimer?.cancel()
    pollTimer = $.clock.every(settings.pollMs, () => {
      void headOf().then(head => syncBranch(head))
      void refreshAll()
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || watched.size === 0) return next(e)

    const { Box, Text, Button, Link } = await $.ui.resolve(e)
    const ui: Ui = { Box, Text, Button, Link }

    return bandView(ui, actionsOf(), list(), (await next(e)) as RenderElement)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)

    const { Box, Text, Button, Link } = await $.ui.resolve(e)
    const ui: Ui = { Box, Text, Button, Link }

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

    if (api === null) {
      return { text: reason === '' ? noMrText : `gitlab-mr: ${reason}` }
    }

    switch (action.kind) {
      case 'help':
        return { text: HELP_TEXT }

      case 'watch': {
        const ref =
          mrRefsOf(action.text)[0] ??
          (remote && action.iid !== null
            ? { host: remote.host, project: remote.project, iid: action.iid }
            : null)

        if (!ref) return { text: noMrText }

        const entry = watch(ref, false)

        selectedKey = entry.key
        await bound.openPane(labelOf(ref))

        return { text: `Отслеживаю ${entry.label}.` }
      }

      case 'drop': {
        if (action.target === 'all') {
          for (const entry of list()) stop(entry.key)

          return { text: 'Снял с отслеживания все merge request.' }
        }

        const target =
          action.target === 'selected'
            ? selected()
            : list().find(entry => entry.ref.iid === action.target)

        if (!target) return { text: 'Нечего снимать.' }

        stop(target.key)

        return { text: `Снял с отслеживания ${target.label}.` }
      }

      case 'refresh': {
        await refreshAll()

        const entry = selected()

        return { text: entry ? statusText(entry) : noMrText }
      }

      case 'threads': {
        const entry = selected()

        if (!entry) return { text: noMrText }
        if (!entry.data) await refresh(entry)

        return { text: threadsText(entry) }
      }

      case 'status': {
        const entry = selected()

        if (!entry) return { text: noMrText }
        if (!entry.data) await refresh(entry)

        return { text: statusText(entry) }
      }

      default: {
        if (watched.size === 0) {
          const head = await $.process
            .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd: await $.session.cwd() })
            .then(res => (res.exitCode === 0 ? res.stdout.trim() : ''))
            .catch(() => '')

          branch = ''
          await syncBranch(head)
        }

        const entry = selected()

        if (!entry) return { text: noMrText }

        if (isPaneOpen) {
          await bound.closePane()

          return { text: `Панель ${entry.label} закрыта.` }
        }

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

    if (isPaneOpen) await bound?.closePane().catch(() => undefined)

    bound?.status(undefined)
    bound?.invalidate()

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const refs = mrRefsOf(e.text)

    // A prompt that is nothing but MR URLs toggles them and runs no turn.
    if (refs.length > 0 && isOnlyMrUrls(e.text)) {
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

  // `glab mr create` prints the new MR's URL: the MR Claude just opened is
  // watched without anyone naming it.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)

    if ('deny' in result) return result
    if (!/\bglab\s+mr\s+(create|new)\b/.test(e.command)) return result

    const stdout = rec(result.result).stdout

    if (typeof stdout === 'string') for (const ref of mrRefsOf(stdout)) watch(ref, true)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined && e.reason === 'answer') {
      for (const ref of mrRefsOf(e.answer)) watch(ref, true)
    }

    return result
  })

  // --- What the drawn elements do ---------------------------------------

  function actionsOf(): Actions {
    return {
      select: key => {
        selectedKey = key

        const entry = watched.get(key)

        if (entry && !isPaneOpen) void bound?.openPane(entry.label)

        bound?.invalidate()
      },
      openUrl: url => bound?.openUrl(url),
      refresh: key => {
        const entry = watched.get(key)

        if (entry) void refresh(entry)
      },
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
