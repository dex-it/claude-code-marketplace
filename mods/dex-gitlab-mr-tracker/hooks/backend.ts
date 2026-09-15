// Where the data comes from. Two sources answer the same v4 paths: `glab`,
// which already holds the credentials of every host a developer logged into,
// and plain REST with a token, for a machine without the CLI. The mod picks
// one at session start and never asks again.

export type RunResult = { exitCode: number; stdout: string; stderr: string }

/** The slice of `$` this module needs, so its callers stay testable. */
export type Host = {
  run: (
    argv: readonly string[],
    init?: { cwd?: string; timeoutMs?: number },
  ) => Promise<RunResult>
  fetch: (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{ status: number; ok: boolean; text: string }>
}

export type Api = {
  kind: 'glab' | 'api'
  /**
   * GETs one v4 path and parses the answer; `null` where GitLab said the
   * path is not there or not yours (404, 403), which several endpoints do
   * by plan rather than by error.
   */
  get: (path: string, options?: { paginate?: boolean }) => Promise<unknown>
}

export type Choice = { api: Api; reason?: undefined } | { api?: undefined; reason: string }

const REQUEST_TIMEOUT_MS = 30_000

/** Pages a REST listing takes before the mod stops asking for more. */
const MAX_PAGES = 5

const PER_PAGE = 100

const isMissing = (text: string) => /\b(404|403)\b/.test(text)

const parse = (text: string): unknown => {
  const body = text.trim()

  if (body === '') return null

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`GitLab ответил не-JSON: ${body.slice(0, 200)}`)
  }
}

function glabApi(host: Host, hostname: string, cwd: string): Api {
  return {
    kind: 'glab',
    get: async (path, options) => {
      const argv = ['glab', 'api', '--hostname', hostname, path]

      if (options?.paginate === true) argv.push('--paginate')

      const { exitCode, stdout, stderr } = await host.run(argv, {
        cwd,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })

      if (exitCode !== 0) {
        const message = stderr.trim() || stdout.trim() || `glab завершился с кодом ${exitCode}`

        if (isMissing(message)) return null

        throw new Error(message.split('\n')[0] ?? message)
      }

      return parse(stdout)
    },
  }
}

const withQuery = (path: string, query: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${query}`

function restApi(host: Host, hostname: string, token: string): Api {
  const headers = { 'PRIVATE-TOKEN': token, Accept: 'application/json' }
  const base = `https://${hostname}/api/v4/`

  const once = async (path: string): Promise<unknown> => {
    const response = await host.fetch(base + path, { headers })

    if (response.status === 404 || response.status === 403) return null

    if (!response.ok) {
      throw new Error(`GitLab ответил ${response.status}: ${response.text.slice(0, 200)}`)
    }

    return parse(response.text)
  }

  return {
    kind: 'api',
    get: async (path, options) => {
      if (options?.paginate !== true) return once(path)

      const collected: unknown[] = []

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const payload = await once(withQuery(path, `per_page=${PER_PAGE}&page=${page}`))

        if (payload === null) return page === 1 ? null : collected
        if (!Array.isArray(payload)) return payload

        collected.push(...payload)

        if (payload.length < PER_PAGE) break
      }

      return collected
    },
  }
}

/**
 * The source for this session: `glab` where it is installed (its own auth
 * covers self-managed hosts), else REST with a token. `reason` is what the
 * line says when neither is reachable - a fact the person can act on.
 */
export async function backendOf(
  host: Host,
  input: { backend: string; hostname: string; token: string; cwd: string },
): Promise<Choice> {
  const wantsGlab = input.backend === 'glab' || input.backend === 'auto'
  const wantsRest = input.backend === 'api' || input.backend === 'auto'

  if (wantsGlab) {
    const installed = await host
      .run(['glab', 'version'], { cwd: input.cwd, timeoutMs: 10_000 })
      .then(result => result.exitCode === 0)
      .catch(() => false)

    if (installed) return { api: glabApi(host, input.hostname, input.cwd) }

    if (input.backend === 'glab') {
      return { reason: 'glab не установлен - поставьте его или переключите источник на api' }
    }
  }

  if (wantsRest && input.token !== '') {
    return { api: restApi(host, input.hostname, input.token) }
  }

  if (input.backend === 'api') {
    return { reason: 'нет токена: задайте его в настройках мода или в GITLAB_TOKEN' }
  }

  return {
    reason: 'нет источника данных: установите glab (glab auth login) либо задайте GITLAB_TOKEN',
  }
}
