// Охват наблюдения: какие PR репозитория мод берёт под наблюдение сам. Ветка -
// PR текущей ветки (так было всегда), `open` - все открытые, `week` - всё, что
// двигалось за последние семь дней, включая смерженное и закрытое.
//
// Модуль чистый, в рантайме ничего не импортирует: прогон подменяет `Api`.

import type { Api } from './backend.ts'

export type Scope = 'branch' | 'open' | 'week'

export const SCOPES: readonly Scope[] = ['branch', 'open', 'week']

/** Как охват называется словами: в заголовке списка и в ответах команд. */
export const SCOPE_WORD: Record<Scope, string> = {
  branch: 'PR текущей ветки',
  open: 'все открытые PR',
  week: 'PR за неделю',
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * PR за страницу. Потолок GraphQL на `first` - 100
 * (docs.github.com/graphql/overview/resource-limitations, сверено 25.09.2026);
 * запрос лёгкий - номер, состояние, время, - поэтому берётся с запасом.
 */
export const SCOPE_PAGE = 50

/** Страниц за один обход: репозиторий с тысячей открытых PR не вешает опрос. */
export const MAX_SCOPE_PAGES = 4

/** Сколько PR охват держит под наблюдением, пока настройка не сказала иного. */
export const DEFAULT_SCOPE_LIMIT = 30

export const scopeOf = (value: string, fallback: Scope): Scope =>
  SCOPES.find(scope => scope === value) ?? fallback

/**
 * Список PR репозитория от свежего обновления к старому. Порядок
 * `UPDATED_AT DESC` и есть условие недельного охвата: обход останавливается на
 * первом PR старше границы, дальше только более старые.
 */
export const SCOPE_QUERY = `
query scope($owner: String!, $name: String!, $states: [PullRequestState!], $page: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      states: $states
      first: $page
      after: $after
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { number updatedAt }
    }
  }
}`

export type ScopeInput = {
  owner: string
  repo: string
  scope: 'open' | 'week'
  /** Для `week` - момент, с которого PR считается недавним; для `open` не читается. */
  sinceMs: number
  limit: number
}

export type ScopeFound = {
  numbers: number[]
  /** PR подходили, но охват держит не больше `limit`: остальные не взяты. */
  truncated: boolean
}

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/**
 * Номера PR охвата, свежие первыми. `null` от источника - репозиторий не
 * показан (нет такого или не хватает прав): охват тогда пуст, а не ошибка, и
 * вызывающий решает, что с этим сказать.
 */
export async function scopeNumbers(api: Api, input: ScopeInput): Promise<ScopeFound> {
  const states = input.scope === 'open' ? ['OPEN'] : ['OPEN', 'MERGED', 'CLOSED']
  const numbers: number[] = []
  let after: string | null = null
  let truncated = false

  for (let page = 0; page < MAX_SCOPE_PAGES; page += 1) {
    const data = await api.graphql(SCOPE_QUERY, {
      owner: input.owner,
      name: input.repo,
      states,
      page: SCOPE_PAGE,
      after,
    })

    if (data === null) break

    const connection = rec(rec(rec(data).repository).pullRequests)
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : []
    let reachedOld = false

    for (const node of nodes) {
      const item = rec(node)
      const number = item.number
      const updated = typeof item.updatedAt === 'string' ? Date.parse(item.updatedAt) : Number.NaN

      if (typeof number !== 'number') continue

      if (input.scope === 'week' && !(updated >= input.sinceMs)) {
        reachedOld = true

        break
      }

      if (numbers.length >= input.limit) {
        truncated = true

        break
      }

      numbers.push(number)
    }

    const info = rec(connection.pageInfo)

    if (truncated || reachedOld) break
    if (info.hasNextPage !== true || typeof info.endCursor !== 'string') break

    after = info.endCursor
  }

  return { numbers, truncated }
}

/**
 * Прогон по списку с потолком одновременных вызовов. Охват в тридцать PR при
 * общем `Promise.all` поднимал бы тридцать процессов `gh` разом.
 */
export async function mapPool<T>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
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
