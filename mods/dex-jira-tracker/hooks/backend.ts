// Where the data comes from: jira-cli (ankitpokhrel/jira-cli), and nothing
// else. The CLI already holds the server, the project and the credentials that
// `jira init` saved, for Jira Cloud and for Server / Data Center alike, so the
// mod reads no config and keeps no token. What it needs is the binary on PATH
// and a login that works; when either is missing the reason says which, and
// what to run.

import type { Detail, Issue } from './jira.ts'
import { clean, detailOfRaw, issuesOfStdout, keysOfPlain } from './jira.ts'

export type RunResult = { exitCode: number; stdout: string; stderr: string }

/** The slice of `$` this module needs, so its callers stay testable. */
export type Host = {
  run: (
    argv: readonly string[],
    init?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; stdin?: string },
  ) => Promise<RunResult>
}

/**
 * The login is not accepted. A class of its own: a poll on a timer must stop
 * after it instead of retrying every minute, because a server that keeps
 * seeing wrong credentials locks the account (Jira Server: CAPTCHA after a few
 * failures, then a block).
 */
export class JiraAuthError extends Error {}

export type Page = { issues: Issue[]; truncated: boolean }

export type Source = {
  /** `issue list --raw` for a JQL, newest update first. */
  list: (jql: string, limit: number) => Promise<Page>
  /** Keys only: the cheap way to ask which of the issues are in a group. */
  keys: (jql: string, limit: number) => Promise<Set<string>>
  /** One issue with its last `comments` comments; null where it does not exist. */
  view: (key: string, comments: number) => Promise<Detail | null>
  /** Address of the issue in the browser, as `jira open --no-browser` prints it. */
  url: (key: string) => Promise<string>
  assign: (key: string, who: string) => Promise<void>
  move: (key: string, status: string) => Promise<void>
}

export type Problem = 'missing' | 'setup' | 'auth' | 'error'

export type Choice =
  | { source: Source; login: string; version: string; kind?: undefined; reason?: undefined }
  | { source?: undefined; login?: undefined; version?: undefined; kind: Problem; reason: string }

const TIMEOUT_MS = 45_000

/** Colour and pager off: stderr is read as text, and the first line of it is shown to the person. */
const QUIET: Record<string, string> = { NO_COLOR: '1', CLICOLOR: '0', PAGER: 'cat' }

// jira-cli prints "The tool needs a Jira API token to function" when none is
// set, and the server's own words ("Unauthorized", HTTP 401/403) otherwise.
const AUTH = /api token|unauthori[sz]ed|\b40[13]\b|forbidden|authenticat|bad credentials/i
const SETUP = /no such file|config file|not initiali[sz]ed|jira init/i
const EMPTY = /no result found/i
const MISSING = /does not exist|not found|\b404\b/i

/** Text of a failed call: stderr first, without the "Error:" header the CLI puts above the reason. */
export function failureText(result: RunResult): string {
  const text = clean(result.stderr.trim() === '' ? result.stdout : result.stderr)
  const lines = text
    .split('\n')
    .map(line => line.replace(/^\s*[-✗x]\s+/, '').trim())
    .filter(line => line !== '' && !/^error:?$/i.test(line))

  return lines.slice(0, 2).join(' ') || `jira завершился с кодом ${result.exitCode}`
}

const raise = (result: RunResult): never => {
  const text = failureText(result)

  if (AUTH.test(text)) throw new JiraAuthError(text)

  throw new Error(text)
}

export async function backendOf(
  host: Host,
  input: { project: string; cwd: string },
): Promise<Choice> {
  const run = (argv: readonly string[], timeoutMs = TIMEOUT_MS) =>
    host.run(argv, { cwd: input.cwd, env: QUIET, timeoutMs })

  const version = await run(['jira', 'version'], 10_000).catch(() => null)

  if (version === null || version.exitCode !== 0) {
    return { kind: 'missing', reason: 'jira-cli не установлен' }
  }

  const me = await run(['jira', 'me'], 20_000).catch((error: unknown) => error)

  if (me instanceof Error) return { kind: 'error', reason: me.message }

  const done = me as RunResult

  if (done.exitCode !== 0) {
    const text = failureText(done)

    if (AUTH.test(text)) return { kind: 'auth', reason: text }

    return { kind: SETUP.test(text) ? 'setup' : 'error', reason: text }
  }

  const login = clean(done.stdout).split('\n')[0]?.trim() ?? ''

  // `-p` only when a project is named: without it the CLI uses the one saved by `jira init`.
  const scoped = (argv: readonly string[]) =>
    input.project === '' ? argv : [...argv, '-p', input.project]

  const call = async (argv: readonly string[]) => run(scoped(argv))

  const source: Source = {
    list: async (jql, limit) => {
      const result = await call([
        'jira', 'issue', 'list', '-q', jql, '--raw', '--order-by', 'updated', '--paginate', `0:${limit}`,
      ])

      if (result.exitCode !== 0) {
        if (EMPTY.test(failureText(result))) return { issues: [], truncated: false }

        return raise(result)
      }

      const issues = issuesOfStdout(result.stdout)

      return { issues, truncated: issues.length >= limit }
    },

    keys: async (jql, limit) => {
      const result = await call([
        'jira', 'issue', 'list', '-q', jql, '--plain', '--no-headers', '--columns', 'key',
        // Same order as the list: a subset's newest N then holds every member of the list's newest N.
        '--order-by', 'updated', '--paginate', `0:${limit}`,
      ])

      if (result.exitCode !== 0) {
        if (EMPTY.test(failureText(result))) return new Set<string>()

        return raise(result)
      }

      return new Set(keysOfPlain(result.stdout))
    },

    view: async (key, comments) => {
      const result = await call(['jira', 'issue', 'view', key, '--raw', '--comments', String(comments)])

      if (result.exitCode !== 0) {
        if (MISSING.test(failureText(result))) return null

        return raise(result)
      }

      try {
        return detailOfRaw(JSON.parse(result.stdout))
      } catch {
        throw new Error(`jira issue view ${key}: ответ не JSON`)
      }
    },

    url: async key => {
      const result = await call(['jira', 'open', key, '--no-browser'])

      if (result.exitCode !== 0) return raise(result)

      return /https?:\/\/\S+/.exec(clean(result.stdout))?.[0] ?? ''
    },

    assign: async (key, who) => {
      const result = await call(['jira', 'issue', 'assign', key, who])

      if (result.exitCode !== 0) raise(result)
    },

    move: async (key, status) => {
      const result = await call(['jira', 'issue', 'move', key, status])

      if (result.exitCode !== 0) raise(result)
    },
  }

  return { source, login, version: /Version="([^"]+)"/.exec(version.stdout)?.[1] ?? '' }
}

/**
 * What to tell the person for each reason the source is not there. A fact and
 * the command that fixes it, never just "unavailable".
 */
export function problemText(kind: Problem, reason: string): string {
  if (kind === 'missing') {
    return 'jira-cli не установлен. Поставьте: /jira install (brew) или /jira setup - все способы.'
  }

  if (kind === 'setup') {
    return `jira-cli не настроен (${reason}). Выполните в терминале: jira init - и /jira refresh.`
  }

  if (kind === 'auth') {
    return `jira-cli не вошёл в Jira (${reason}). Токен: JIRA_API_TOKEN (Cloud - JIRA_AUTH_TYPE=basic, Server/DC - bearer с PAT), затем jira init и /jira refresh.`
  }

  return `jira-cli отказал: ${reason}`
}
