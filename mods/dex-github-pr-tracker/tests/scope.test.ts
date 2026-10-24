// Охват наблюдения: какие номера PR берутся, где обход останавливается и что
// видно, когда PR больше потолка. Источник подменён - сети нет.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Api } from '../hooks/backend.ts'
import { MAX_SCOPE_PAGES, WEEK_MS, mapPool, scopeNumbers, scopeOf } from '../hooks/scope.ts'

const NOW = Date.parse('2026-10-16T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const iso = (agoMs: number) => new Date(NOW - agoMs).toISOString()

type Node = { number: number; updatedAt: string }

const pageOf = (nodes: readonly Node[], cursor: string | null) => ({
  repository: {
    pullRequests: { pageInfo: { hasNextPage: cursor !== null, endCursor: cursor }, nodes },
  },
})

function apiOf(pages: readonly unknown[]): { api: Api; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = []
  let index = 0

  return {
    calls,
    api: {
      kind: 'api',
      graphql: async (_query, variables) => {
        calls.push(variables)

        const page = pages[Math.min(index, pages.length - 1)]

        index += 1

        return page
      },
    },
  }
}

const input = (over: Partial<Parameters<typeof scopeNumbers>[1]> = {}) => ({
  owner: 'dex-it',
  repo: 'marketplace',
  scope: 'open' as const,
  sinceMs: NOW - WEEK_MS,
  limit: 30,
  ...over,
})

describe('scopeNumbers', () => {
  test('open asks only for open PRs and takes every number', async () => {
    const { api, calls } = apiOf([
      pageOf(
        [
          { number: 9, updatedAt: iso(DAY) },
          { number: 4, updatedAt: iso(30 * DAY) },
        ],
        null,
      ),
    ])
    const found = await scopeNumbers(api, input())

    assert.deepEqual(found.numbers, [9, 4])
    assert.equal(found.truncated, false)
    assert.deepEqual(calls[0]?.states, ['OPEN'])
  })

  test('week asks for every state and stops at the first PR older than the border', async () => {
    const { api, calls } = apiOf([
      pageOf(
        [
          { number: 12, updatedAt: iso(DAY) },
          { number: 11, updatedAt: iso(6 * DAY) },
          { number: 10, updatedAt: iso(8 * DAY) },
          { number: 9, updatedAt: iso(9 * DAY) },
        ],
        'next',
      ),
    ])
    const found = await scopeNumbers(api, input({ scope: 'week' }))

    assert.deepEqual(found.numbers, [12, 11])
    assert.deepEqual(calls[0]?.states, ['OPEN', 'MERGED', 'CLOSED'])
    // Дальше только более старые: вторая страница не запрашивается.
    assert.equal(calls.length, 1)
  })

  test('a PR with no readable time is not taken as recent', async () => {
    const { api } = apiOf([pageOf([{ number: 3, updatedAt: 'вчера' }], null)])
    const found = await scopeNumbers(api, input({ scope: 'week' }))

    assert.deepEqual(found.numbers, [])
  })

  test('pages are followed until the list ends', async () => {
    const { api, calls } = apiOf([
      pageOf([{ number: 3, updatedAt: iso(DAY) }], 'c1'),
      pageOf([{ number: 2, updatedAt: iso(DAY) }], null),
    ])
    const found = await scopeNumbers(api, input())

    assert.deepEqual(found.numbers, [3, 2])
    assert.equal(calls[1]?.after, 'c1')
  })

  test('more PRs than the limit are cut, and the cut is named', async () => {
    const nodes = [5, 4, 3, 2, 1].map(number => ({ number, updatedAt: iso(DAY) }))
    const { api } = apiOf([pageOf(nodes, 'more')])
    const found = await scopeNumbers(api, input({ limit: 3 }))

    assert.deepEqual(found.numbers, [5, 4, 3])
    assert.equal(found.truncated, true)
  })

  test('a repository that never ends is read for a bounded number of pages', async () => {
    const { api, calls } = apiOf([pageOf([{ number: 1, updatedAt: iso(DAY) }], 'again')])

    await scopeNumbers(api, input({ limit: 1000 }))

    assert.equal(calls.length, MAX_SCOPE_PAGES)
  })

  test('a repository the source did not show is an empty scope, not an error', async () => {
    const { api } = apiOf([null])

    assert.deepEqual(await scopeNumbers(api, input()), { numbers: [], truncated: false })
  })
})

describe('scopeOf', () => {
  test('a known word is taken, anything else falls back', () => {
    assert.equal(scopeOf('week', 'branch'), 'week')
    assert.equal(scopeOf('yesterday', 'branch'), 'branch')
  })
})

describe('mapPool', () => {
  test('never runs more at once than the size, and runs everything', async () => {
    let running = 0
    let peak = 0
    const done: number[] = []

    await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async item => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 2))
      running -= 1
      done.push(item)
    })

    assert.equal(peak, 3)
    assert.deepEqual(done.sort(), [1, 2, 3, 4, 5, 6, 7])
  })

  test('an empty list is a no-op', async () => {
    await mapPool([], 4, async () => {
      throw new Error('не должно вызываться')
    })
  })
})
