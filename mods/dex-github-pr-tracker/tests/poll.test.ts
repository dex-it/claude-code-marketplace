// Состав одного опроса: сколько запросов уходит, как добираются страницы
// тредов и что происходит, когда GitHub ничего не показал. Источник подменён,
// поэтому сценарий «тредов больше страницы» проверяется без сети.
//
//   node --test mods/dex-github-pr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Api } from '../hooks/backend.ts'
import { prDataOfRaw, threadsOfPages } from '../hooks/github.ts'
import type { PrRef } from '../hooks/github.ts'
import { MAX_THREAD_PAGES, pollRaw, prOfBranch } from '../hooks/poll.ts'

const REF: PrRef = { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 }

type Call = { query: string; variables: Record<string, unknown> }

const threadNodeOf = (id: string) => ({
  id,
  isResolved: false,
  isOutdated: false,
  path: 'src/queue.ts',
  line: 1,
  originalLine: 1,
  comments: {
    totalCount: 1,
    nodes: [{ author: { login: 'reviewer' }, body: id, url: `u/${id}`, createdAt: '2026-09-20T10:00:00Z' }],
  },
  tail: { nodes: [{ author: { login: 'reviewer' }, createdAt: '2026-09-20T10:00:00Z' }] },
})

const threadsPage = (ids: readonly string[], cursor: string | null) => ({
  totalCount: 9,
  pageInfo: { hasNextPage: cursor !== null, endCursor: cursor },
  nodes: ids.map(threadNodeOf),
})

const prPayload = (threads: unknown) => ({
  repository: {
    pullRequest: {
      number: 7,
      state: 'OPEN',
      url: 'https://github.com/dex-it/marketplace/pull/7',
      reviewThreads: threads,
    },
  },
})

/** Источник, который отвечает по сценарию и записывает, о чём спросили. */
function apiOf(answers: readonly unknown[]): { api: Api; calls: Call[] } {
  const calls: Call[] = []
  let index = 0

  return {
    calls,
    api: {
      kind: 'api',
      graphql: async (query, variables) => {
        calls.push({ query, variables })

        const answer = answers[Math.min(index, answers.length - 1)]

        index += 1

        return answer
      },
    },
  }
}

describe('pollPr', () => {
  test('a pull request whose threads fit one page takes one request', async () => {
    const { api, calls } = apiOf([prPayload(threadsPage(['a', 'b'], null))])
    const raw = await pollRaw(api, REF)

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0]?.variables.owner, 'dex-it')
    assert.deepEqual(calls[0]?.variables.number, 7)
    assert.equal(raw?.threadPages.length, 1)

    const data = raw === null ? null : prDataOfRaw(raw)

    assert.equal(data?.threads.length, 2)
    assert.equal(data?.number, 7)
  })

  test('the next page is asked from the cursor the previous one gave', async () => {
    const { api, calls } = apiOf([
      prPayload(threadsPage(['a'], 'CURSOR_1')),
      prPayload(threadsPage(['b'], null)),
    ])
    const raw = await pollRaw(api, REF)

    assert.equal(calls.length, 2)
    assert.equal(calls[1]?.variables.after, 'CURSOR_1')
    assert.deepEqual(
      threadsOfPages(raw?.threadPages ?? []).map(thread => thread.id),
      ['a', 'b'],
    )
  })

  test('a discussion longer than the page cap stops at the cap', async () => {
    // Счётчик тредов приходит полем `totalCount` и остаётся верным, поэтому
    // обрыв виден, а не выглядит как «тредов меньше».
    const { api, calls } = apiOf([prPayload(threadsPage(['x'], 'MORE'))])
    const raw = await pollRaw(api, REF)

    assert.equal(calls.length, MAX_THREAD_PAGES)
    assert.equal(raw?.threadPages.length, MAX_THREAD_PAGES)
  })

  test('a page that came back empty does not stop the previous ones', async () => {
    const { api } = apiOf([prPayload(threadsPage(['a'], 'CURSOR_1')), null])
    const raw = await pollRaw(api, REF)

    assert.deepEqual(
      threadsOfPages(raw?.threadPages ?? []).map(thread => thread.id),
      ['a'],
    )
  })

  test('nothing shown reads as no pull request, not as an empty one', async () => {
    const hidden = apiOf([null])

    assert.equal(await pollRaw(hidden.api, REF), null)

    // `repository` есть, `pullRequest` пуст: номер не тот, и признака у
    // GraphQL на это нет - приходит null без `errors`.
    const wrongNumber = apiOf([{ repository: { pullRequest: null } }])

    assert.equal(await pollRaw(wrongNumber.api, REF), null)
  })
})

describe('prOfBranch', () => {
  test('the open pull request of the branch is named by its number', async () => {
    const { api, calls } = apiOf([
      { repository: { pullRequests: { nodes: [{ number: 244 }] } } },
    ])

    assert.equal(await prOfBranch(api, { owner: 'dex-it', repo: 'marketplace', branch: 'feat/x' }), 244)
    assert.equal(calls[0]?.variables.branch, 'feat/x')
  })

  test('a branch without a pull request is the usual state, not an error', async () => {
    const empty = apiOf([{ repository: { pullRequests: { nodes: [] } } }])

    assert.equal(
      await prOfBranch(empty.api, { owner: 'dex-it', repo: 'marketplace', branch: 'feat/x' }),
      null,
    )

    const hidden = apiOf([null])

    assert.equal(
      await prOfBranch(hidden.api, { owner: 'dex-it', repo: 'marketplace', branch: 'feat/x' }),
      null,
    )
  })
})
