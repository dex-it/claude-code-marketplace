// Охват наблюдения: какие MR проекта мод берёт под наблюдение сам. Ветка -
// MR текущей ветки (так было всегда), `open` - все открытые, `week` - всё, что
// двигалось за последние семь дней, включая смерженное и закрытое.
//
// Модуль чистый, в рантайме ничего не импортирует: прогон подменяет `Api`.

import type { Api } from './backend.ts'

export type Scope = 'branch' | 'open' | 'week'

export const SCOPES: readonly Scope[] = ['branch', 'open', 'week']

/** Как охват называется словами: в заголовке списка и в ответах команд. */
export const SCOPE_WORD: Record<Scope, string> = {
  branch: 'MR текущей ветки',
  open: 'все открытые MR',
  week: 'MR за неделю',
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * MR за страницу. Потолок `per_page` у GitLab - 100
 * (docs.gitlab.com/api/rest/#pagination); берётся половина: список нужен
 * только ради номеров.
 */
export const SCOPE_PAGE = 50

/** Страниц за один обход: проект с тысячей открытых MR не вешает опрос. */
export const MAX_SCOPE_PAGES = 4

/** Сколько MR охват держит под наблюдением, пока настройка не сказала иного. */
export const DEFAULT_SCOPE_LIMIT = 30

export const scopeOf = (value: string, fallback: Scope): Scope =>
  SCOPES.find(scope => scope === value) ?? fallback

export type ScopeInput = {
  /** Путь проекта `group/proj`; в адрес кодируется здесь. */
  project: string
  scope: 'open' | 'week'
  /** Для `week` - момент, с которого MR считается недавним; для `open` не читается. */
  sinceMs: number
  limit: number
}

export type ScopeFound = {
  iids: number[]
  /** MR подходили, но охват держит не больше `limit`: остальные не взяты. */
  truncated: boolean
}

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/**
 * Путь списка MR охвата, страница `page`. `open` - `state=opened`; `week` -
 * `state=all` плюс `updated_after` (docs.gitlab.com/api/merge_requests,
 * «List project merge requests»), порядок по обновлению от свежего к старому.
 */
export function scopePath(input: ScopeInput, page: number): string {
  const query = [
    input.scope === 'open' ? 'state=opened' : 'state=all',
    ...(input.scope === 'week' ? [`updated_after=${new Date(input.sinceMs).toISOString()}`] : []),
    'order_by=updated_at',
    'sort=desc',
    `per_page=${SCOPE_PAGE}`,
    `page=${page}`,
  ].join('&')

  return `projects/${encodeURIComponent(input.project)}/merge_requests?${query}`
}

/**
 * Номера MR охвата, свежие первыми. `null` от источника - проект не показан
 * (нет такого или не хватает прав): охват тогда пуст, а не ошибка.
 */
export async function scopeIids(api: Api, input: ScopeInput): Promise<ScopeFound> {
  const iids: number[] = []
  let truncated = false

  for (let page = 1; page <= MAX_SCOPE_PAGES; page += 1) {
    const data = await api.get(scopePath(input, page))

    if (!Array.isArray(data)) break

    for (const node of data) {
      const iid = rec(node).iid

      if (typeof iid !== 'number') continue

      if (iids.length >= input.limit) {
        truncated = true

        break
      }

      iids.push(iid)
    }

    if (truncated || data.length < SCOPE_PAGE) break
  }

  return { iids, truncated }
}

/**
 * Прогон по списку с потолком одновременных вызовов. Охват в тридцать MR при
 * общем `Promise.all` поднимал бы десятки процессов `glab` разом.
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
