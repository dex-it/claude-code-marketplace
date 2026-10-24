// Where the data comes from. Two sources answer the same GraphQL endpoint:
// `gh`, which already holds the credentials of every host a developer logged
// into, and a plain POST with a token, for a machine without the CLI. The mod
// picks one at session start and never asks again.

export type RunResult = { exitCode: number; stdout: string; stderr: string }

/** The slice of `$` this module needs, so its callers stay testable. */
export type Host = {
  run: (
    argv: readonly string[],
    init?: {
      cwd?: string
      env?: Record<string, string>
      timeoutMs?: number
      stdin?: string
    },
  ) => Promise<RunResult>
  fetch: (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => Promise<{ status: number; ok: boolean; text: string }>
}

export type Api = {
  kind: 'gh' | 'api'
  /**
   * Asks one GraphQL query and returns its `data`; `null` where GitHub said
   * the thing is not there or not yours. Оба исхода приходят одним именем:
   * приватный репозиторий отвечает 404, а не 403, «to avoid confirming the
   * existence of private repositories» (docs.github.com/rest/using-the-rest-api/
   * troubleshooting-the-rest-api, сверено 25.09.2026) - поэтому различить
   * «нет PR» и «не хватает прав» нельзя, и текст на экране называет оба.
   */
  graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown>
}

export type Choice = { api: Api; reason?: undefined } | { api?: undefined; reason: string }

/**
 * Токен не принят. Отдельный класс, а не просто текст: на неверных кредах
 * GitHub начинает отвечать 403 на любую попытку аутентификации, если их много
 * подряд (docs.github.com/rest/authentication/authenticating-to-the-rest-api,
 * сверено 25.09.2026), поэтому опрос по таймеру после такого отказа
 * прекращается, а не повторяется каждую минуту.
 */
export class ApiAuthError extends Error {}

const REQUEST_TIMEOUT_MS = 30_000

/**
 * Чем `gh` заглушается на вызов из процесса. Всё это документировано
 * (`gh help environment`, сверено 25.09.2026) и нужно по одной причине: мод
 * читает stdout как JSON, а на stderr уходит и уведомление о новой версии
 * `gh`, и подсказка авторизации, и спиннер - и когда JSON не пришёл, первой
 * строкой stderr оказалось бы «доступна новая версия», а не причина отказа.
 */
const GH_QUIET: Record<string, string> = {
  GH_PAGER: 'cat',
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_SPINNER_DISABLED: '1',
  NO_COLOR: '1',
  CLICOLOR: '0',
}

/**
 * Код выхода `gh`, означающий «команде нужна аутентификация» (`gh help
 * exit-codes`, сверено 25.09.2026). Единственный код, по которому отказ по
 * кредам опознаётся точно: 1 у `gh` значит «любая ошибка».
 */
const GH_EXIT_AUTH = 4

/**
 * Что GitHub отвечает на «нет такого» и «не твоё». `FORBIDDEN` приходит на
 * ресурс организации, закрытый политикой; остальное - настоящие ошибки.
 */
const MISSING: ReadonlySet<string> = new Set(['NOT_FOUND', 'FORBIDDEN'])

/**
 * Признак отказа по кредам в тексте ответа. Форма задана документацией:
 * невалидный токен - HTTP 401 с телом `{"message": "Bad credentials"}`, и
 * `gh` выносит её в свою строку ошибки как есть.
 */
const BAD_CREDENTIALS = /\bbad credentials\b|\b401\b/i

/**
 * GraphQL-эндпоинт хоста. Формы три, и они не выводятся одна из другой
 * (docs.github.com/graphql/guides/forming-calls-with-graphql и его версия для
 * enterprise-server@3.17, сверено 25.09.2026): github.com отвечает на
 * `api.github.com/graphql`, Enterprise Server - на `{host}/api/graphql` (не
 * `/api/v3/graphql`), а Enterprise Cloud с резидентностью данных - на
 * `api.{поддомен}.ghe.com/graphql`.
 */
export function graphqlEndpoint(host: string): string {
  if (host === 'github.com' || host === 'www.github.com' || host === 'api.github.com') {
    return 'https://api.github.com/graphql'
  }

  if (host.endsWith('.ghe.com')) return `https://api.${host}/graphql`

  return `https://${host}/api/graphql`
}

/**
 * Переменные окружения с токеном, в том порядке, в каком их читает `gh`
 * (cli.github.com/manual/gh_help_environment, сверено 25.09.2026): для
 * github.com и поддоменов ghe.com - `GH_TOKEN`, затем `GITHUB_TOKEN`; для
 * Enterprise Server - `GH_ENTERPRISE_TOKEN`, затем `GITHUB_ENTERPRISE_TOKEN`.
 * Порядок повторён дословно, чтобы мод и `gh` в одной машине не брали разные
 * токены: расхождение выглядело бы как «gh видит, а мод нет».
 */
export function tokenNames(host: string): readonly string[] {
  if (host === 'github.com' || host === 'www.github.com' || host.endsWith('.ghe.com')) {
    return ['GH_TOKEN', 'GITHUB_TOKEN']
  }

  return ['GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN']
}

const parse = (text: string): unknown => {
  const body = text.trim()

  if (body === '') return null

  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/**
 * Читает конверт GraphQL. Ошибки приезжают полем `errors` рядом с `data`, а
 * не кодом ответа, поэтому статус запроса ничего о них не говорит.
 */
export function readEnvelope(payload: unknown): unknown {
  const envelope = rec(payload)
  const errors = Array.isArray(envelope.errors) ? envelope.errors : []

  if (errors.length > 0) {
    const kinds = errors.map(entry => {
      const error = rec(entry)

      return typeof error.type === 'string' ? error.type : ''
    })

    // Отказ «нет такого» или «не твоё» отдаётся как отсутствие, а не как
    // ошибка, но отдаётся целиком, даже если рядом приехали данные: часть
    // полей, оставшаяся пустой из-за нехватки прав, была бы неотличима от
    // «проверок нет» и «тредов нет». Текст на экране называет оба случая.
    if (kinds.every(kind => MISSING.has(kind))) return null

    const first = rec(errors[0])
    const message = typeof first.message === 'string' ? first.message : 'GitHub отказал без текста'

    if (BAD_CREDENTIALS.test(message)) throw new ApiAuthError(message)

    throw new Error(message)
  }

  // Конверт REST-формы (`{"message": ...}` без `data`) приходит на отказ
  // самого хоста - неверный токен, снятая версия API, заблокированный доступ.
  if (!('data' in envelope) && typeof envelope.message === 'string') {
    if (BAD_CREDENTIALS.test(envelope.message)) throw new ApiAuthError(envelope.message)

    throw new Error(envelope.message)
  }

  return envelope.data ?? null
}

const body = (query: string, variables: Record<string, unknown>) =>
  JSON.stringify({ query, variables })

function ghApi(host: Host, hostname: string, cwd: string): Api {
  return {
    kind: 'gh',
    graphql: async (query, variables) => {
      const { exitCode, stdout, stderr } = await host.run(
        ['gh', 'api', 'graphql', '--hostname', hostname, '--input', '-'],
        {
          cwd,
          env: GH_QUIET,
          timeoutMs: REQUEST_TIMEOUT_MS,
          stdin: body(query, variables),
        },
      )
      const payload = parse(stdout)

      // Код выхода здесь не решает: на ошибку GraphQL `gh` выходит с 1 и всё
      // равно печатает конверт, а конверт точнее его строки на stderr.
      if (payload !== undefined && payload !== null) return readEnvelope(payload)

      const message = stderr.trim() || stdout.trim() || `gh завершился с кодом ${exitCode}`
      const first = message.split('\n')[0] ?? message

      if (exitCode === GH_EXIT_AUTH || BAD_CREDENTIALS.test(first)) {
        throw new ApiAuthError(first)
      }

      throw new Error(first)
    },
  }
}

function restApi(host: Host, hostname: string, token: string): Api {
  const endpoint = graphqlEndpoint(hostname)
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    // `mergeStateStatus` объявлялся schema preview, и `gh` до сих пор посылает
    // этот Accept на каждом запросе (cli/cli, `api/client.go`, сверено
    // 25.09.2026). На github.com поле приходит и без него - проверено живым
    // запросом 25.09.2026, - но старый Enterprise Server без заголовка его не
    // отдаёт, а стоит он ничего.
    Accept: 'application/vnd.github.merge-info-preview+json',
  }

  return {
    kind: 'api',
    graphql: async (query, variables) => {
      const response = await host.fetch(endpoint, {
        method: 'POST',
        headers,
        body: body(query, variables),
      })

      if (response.status === 401) {
        throw new ApiAuthError('токен не принят GitHub (401): проверьте его и права')
      }

      const payload = parse(response.text)

      if (payload === undefined) {
        throw new Error(`GitHub ответил не-JSON (${response.status}): ${response.text.slice(0, 200)}`)
      }

      // Не-2xx - отказ самого хоста: не тот эндпоинт, сбой, лимит. Ошибка
      // запроса у GraphQL приезжает полем `errors` с кодом 200, поэтому код
      // ответа разбирается до конверта, а не после: иначе отказ хоста читался
      // бы как «PR не найден».
      if (!response.ok) {
        const message = rec(payload).message

        throw new Error(
          typeof message === 'string'
            ? `GitHub ответил ${response.status}: ${message}`
            : `GitHub ответил ${response.status}`,
        )
      }

      return readEnvelope(payload)
    },
  }
}

/**
 * The source for this session: `gh` where it is installed (its own auth covers
 * Enterprise hosts), else a POST with a token. `reason` is what the line says
 * when neither is reachable - a fact the person can act on.
 */
export async function backendOf(
  host: Host,
  input: { backend: string; hostname: string; token: string; cwd: string },
): Promise<Choice> {
  const wantsGh = input.backend === 'gh' || input.backend === 'auto'
  const wantsRest = input.backend === 'api' || input.backend === 'auto'

  if (wantsGh) {
    const installed = await host
      .run(['gh', '--version'], { cwd: input.cwd, timeoutMs: 10_000 })
      .then(result => result.exitCode === 0)
      .catch(() => false)

    if (installed) return { api: ghApi(host, input.hostname, input.cwd) }

    if (input.backend === 'gh') {
      return { reason: 'gh не установлен - поставьте его или переключите источник на api' }
    }
  }

  if (wantsRest && input.token !== '') {
    return { api: restApi(host, input.hostname, input.token) }
  }

  const names = tokenNames(input.hostname).join(' или ')

  if (input.backend === 'api') {
    return { reason: `нет токена: задайте его в настройках мода или в ${names}` }
  }

  return {
    reason: `нет источника данных: установите gh (gh auth login) либо задайте ${names}`,
  }
}
