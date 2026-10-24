// Охват наблюдения: какой путь уходит в GitLab, где обход останавливается и
// что видно, когда MR больше потолка. Источник подменён - сети нет.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Api } from '../hooks/backend.ts'
import {
  MAX_SCOPE_PAGES,
  SCOPE_PAGE,
  WEEK_MS,
  mapPool,
  scopeIids,
  scopeOf,
  scopePath,
} from '../hooks/scope.ts'

const NOW = Date.parse('2026-10-16T12:00:00Z')

const pageOf = (iids: readonly number[]) => iids.map(iid => ({ iid }))

function apiOf(pages: readonly unknown[]): { api: Api; paths: string[] } {
  const paths: string[] = []
  let index = 0

  return {
    paths,
    api: {
      kind: 'api',
      get: async path => {
        paths.push(path)

        const page = pages[Math.min(index, pages.length - 1)]

        index += 1

        return page
      },
    },
  }
}

const input = (over: Partial<Parameters<typeof scopeIids>[1]> = {}) => ({
  project: 'group/sub/proj',
  scope: 'open' as const,
  sinceMs: NOW - WEEK_MS,
  limit: 30,
  ...over,
})

describe('scopePath', () => {
  test('open asks for opened MRs, freshest first, with the project path encoded', () => {
    const path = scopePath(input(), 1)

    assert.ok(path.startsWith('projects/group%2Fsub%2Fproj/merge_requests?'))
    assert.ok(path.includes('state=opened'))
    assert.ok(path.includes('order_by=updated_at&sort=desc'))
    assert.ok(path.includes('page=1'))
    assert.ok(!path.includes('updated_after'))
  })

  test('week asks for every state, bounded by updated_after', () => {
    const path = scopePath(input({ scope: 'week' }), 2)

    assert.ok(path.includes('state=all'))
    assert.ok(path.includes(`updated_after=${new Date(NOW - WEEK_MS).toISOString()}`))
    assert.ok(path.includes('page=2'))
  })
})

describe('scopeIids', () => {
  test('a short page ends the walk', async () => {
    const { api, paths } = apiOf([pageOf([9, 4])])
    const found = await scopeIids(api, input())

    assert.deepEqual(found, { iids: [9, 4], truncated: false })
    assert.equal(paths.length, 1)
  })

  test('a full page is followed by the next one', async () => {
    const full = pageOf(Array.from({ length: SCOPE_PAGE }, (_, index) => 1000 - index))
    const { api, paths } = apiOf([full, pageOf([5])])
    const found = await scopeIids(api, input({ limit: 1000 }))

    assert.equal(found.iids.length, SCOPE_PAGE + 1)
    assert.ok(paths[1]?.includes('page=2'))
  })

  test('more MRs than the limit are cut, and the cut is named', async () => {
    const { api } = apiOf([pageOf([5, 4, 3, 2, 1])])
    const found = await scopeIids(api, input({ limit: 3 }))

    assert.deepEqual(found, { iids: [5, 4, 3], truncated: true })
  })

  test('a project that never ends is read for a bounded number of pages', async () => {
    const full = pageOf(Array.from({ length: SCOPE_PAGE }, (_, index) => index + 1))
    const { api, paths } = apiOf([full])

    await scopeIids(api, input({ limit: 100000 }))

    assert.equal(paths.length, MAX_SCOPE_PAGES)
  })

  test('a project the source did not show is an empty scope, not an error', async () => {
    const { api } = apiOf([null])

    assert.deepEqual(await scopeIids(api, input()), { iids: [], truncated: false })
  })

  test('entries without a number are skipped', async () => {
    const { api } = apiOf([[{ iid: 3 }, { title: 'x' }, { iid: '4' }]])

    assert.deepEqual((await scopeIids(api, input())).iids, [3])
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
