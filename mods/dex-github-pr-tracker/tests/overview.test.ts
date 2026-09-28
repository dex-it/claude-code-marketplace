// Общий список наблюдения: правило внимания, порядок строк, итог и текстовый
// дубль списка. Предмет здесь - суждение «что из этого ждёт меня», и ошибка в
// нём выглядит в сессии как спокойный список над горящим PR, а не как падение.
//
//   node --test mods/dex-github-pr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { prDataOf, threadsOf } from '../hooks/github.ts'
import type { PrData, PrRef } from '../hooks/github.ts'
import { ATTENTION_MANY, ATTENTION_ONE, overviewOf } from '../hooks/overview.ts'
import type { Attention } from '../hooks/overview.ts'
import { overviewText } from '../hooks/text.ts'
import type { Watched } from '../hooks/watched.ts'
import { watchedOf } from '../hooks/watched.ts'

const refOf = (number: number, repo = 'marketplace', host = 'github.com'): PrRef => ({
  host,
  owner: 'dex-it',
  repo,
  number,
})

const threadNodeOf = (over: Record<string, unknown> = {}) => ({
  id: 'PRRT_1',
  isResolved: false,
  isOutdated: false,
  path: 'src/queue.ts',
  line: 42,
  originalLine: 42,
  comments: {
    totalCount: 1,
    nodes: [
      {
        author: { login: 'reviewer' },
        body: 'Здесь гонка',
        url: 'https://github.com/dex-it/marketplace/pull/7#discussion_r1',
        createdAt: '2026-09-20T10:00:00Z',
      },
    ],
  },
  tail: { nodes: [{ author: { login: 'reviewer' }, createdAt: '2026-09-20T10:00:00Z' }] },
  ...over,
})

const runOf = (over: Record<string, unknown> = {}) => ({
  __typename: 'CheckRun',
  name: 'build',
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: 'https://ci/1',
  isRequired: true,
  ...over,
})

const headOf = (contexts: unknown[], state = 'SUCCESS') => ({
  nodes: [
    {
      commit: {
        oid: 'abcdef12',
        statusCheckRollup: { state, contexts: { nodes: contexts } },
      },
    },
  ],
})

const prNodeOf = (over: Record<string, unknown> = {}) => ({
  number: 7,
  title: 'Фикс гонки в очереди',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'BLOCKED',
  reviewDecision: 'REVIEW_REQUIRED',
  additions: 10,
  deletions: 2,
  changedFiles: 3,
  url: 'https://github.com/dex-it/marketplace/pull/7',
  updatedAt: '2026-09-20T12:00:00Z',
  headRefName: 'fix/queue',
  baseRefName: 'develop',
  author: { login: 'yaryrslv' },
  labels: { nodes: [] },
  assignees: { nodes: [] },
  reviewRequests: { nodes: [] },
  latestReviews: { nodes: [] },
  comments: { totalCount: 0 },
  commits: { totalCount: 1, nodes: [] },
  head: headOf([runOf()]),
  reviewThreads: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
  ...over,
})

const dataOf = (over: Record<string, unknown> = {}): PrData => {
  const pr = prNodeOf(over)

  return prDataOf({ pr, threads: threadsOf(pr.reviewThreads) })
}

const threads = (count: number) => ({
  totalCount: count,
  pageInfo: { hasNextPage: false, endCursor: null },
  nodes: Array.from({ length: count }, (_, index) => threadNodeOf({ id: `PRRT_${index}` })),
})

/** Запись наблюдения с данными; `over` правит ответ GitHub, не запись. */
const entryOf = (number: number, over: Record<string, unknown> = {}, repo?: string): Watched => ({
  ...watchedOf(refOf(number, repo), true),
  data: dataOf(over),
})

const loadingOf = (number: number, error?: string): Watched => ({
  ...watchedOf(refOf(number), true),
  ...(error === undefined ? {} : { error }),
})

const attentionOf = (over: Record<string, unknown> = {}): Attention =>
  overviewOf([entryOf(7, over)]).rows[0]?.attention ?? 'unknown'

const whyOf = (over: Record<string, unknown> = {}): string | null =>
  overviewOf([entryOf(7, over)]).rows[0]?.why ?? null

describe('overviewOf: правило внимания', () => {
  test('a merged or closed pull request waits for nobody', () => {
    assert.equal(attentionOf({ state: 'MERGED' }), 'idle')
    assert.equal(attentionOf({ state: 'CLOSED', reviewThreads: threads(3) }), 'idle')
    assert.equal(whyOf({ state: 'MERGED' }), null)
  })

  test('a conflict and a stale head are the branch owner work', () => {
    assert.equal(attentionOf({ mergeStateStatus: 'DIRTY' }), 'act')
    assert.equal(whyOf({ mergeStateStatus: 'DIRTY' }), 'dirty')
    assert.equal(attentionOf({ mergeStateStatus: 'BEHIND' }), 'act')
    assert.equal(whyOf({ mergeStateStatus: 'BEHIND' }), 'behind')
  })

  test('a failed required check calls, an optional one does not', () => {
    const failed = { head: headOf([runOf({ conclusion: 'FAILURE' })], 'FAILURE') }

    assert.equal(attentionOf(failed), 'act')
    assert.equal(whyOf(failed), 'проверки: failure')

    // Роллап красный, но обязательная проверка зелёная: мержу это не мешает.
    const optional = {
      head: headOf(
        [runOf(), runOf({ name: 'lint', isRequired: false, conclusion: 'FAILURE' })],
        'FAILURE',
      ),
    }

    assert.equal(attentionOf(optional), 'wait')
  })

  test('a stated request for changes calls by its own name', () => {
    const asked = {
      reviewDecision: 'CHANGES_REQUESTED',
      latestReviews: { nodes: [{ state: 'CHANGES_REQUESTED', author: { login: 'mmx003' } }] },
    }

    assert.equal(attentionOf(asked), 'act')
    assert.equal(whyOf(asked), 'нужны правки')
  })

  test('open threads call and are counted', () => {
    assert.equal(attentionOf({ reviewThreads: threads(3) }), 'act')
    assert.equal(whyOf({ reviewThreads: threads(3) }), '3 открытых тредов')
  })

  test('a draft waits for nobody, unless something else calls', () => {
    assert.equal(attentionOf({ isDraft: true, mergeStateStatus: 'DRAFT' }), 'idle')
    assert.equal(
      attentionOf({ isDraft: true, mergeStateStatus: 'DIRTY', reviewThreads: threads(1) }),
      'act',
    )
    assert.equal(attentionOf({ isDraft: true, reviewThreads: threads(1) }), 'act')
  })

  test('a gate that has not passed is a wait, and it names itself', () => {
    assert.equal(attentionOf({ mergeStateStatus: 'BLOCKED' }), 'wait')
    assert.equal(whyOf({ mergeStateStatus: 'BLOCKED' }), 'blocked')
    assert.equal(attentionOf({ mergeStateStatus: 'UNSTABLE' }), 'wait')
    assert.equal(whyOf({ mergeStateStatus: 'UNSTABLE' }), 'unstable')
  })

  test('nothing in the way at all waits with no reason to name', () => {
    assert.equal(attentionOf({ mergeStateStatus: 'CLEAN' }), 'wait')
    assert.equal(whyOf({ mergeStateStatus: 'CLEAN' }), null)
  })

  test('no data at all is its own group, and the reason is never empty', () => {
    const rows = overviewOf([loadingOf(7), loadingOf(8, 'GitHub ответил 502')]).rows

    assert.deepEqual(
      rows.map(row => [row.attention, row.why]),
      [
        ['unknown', 'первый опрос идёт'],
        ['unknown', 'GitHub ответил 502'],
      ],
    )
  })
})

describe('overviewOf: порядок причин', () => {
  test('a conflict beats a red check, a request for changes and threads', () => {
    assert.equal(
      whyOf({
        mergeStateStatus: 'DIRTY',
        head: headOf([runOf({ conclusion: 'FAILURE' })], 'FAILURE'),
        reviewDecision: 'CHANGES_REQUESTED',
        reviewThreads: threads(4),
      }),
      'dirty',
    )
  })

  test('a red check beats a request for changes and threads', () => {
    assert.equal(
      whyOf({
        head: headOf([runOf({ conclusion: 'FAILURE' })], 'FAILURE'),
        reviewDecision: 'CHANGES_REQUESTED',
        reviewThreads: threads(4),
      }),
      'проверки: failure',
    )
  })

  test('a request for changes beats the threads it was written in', () => {
    assert.equal(
      whyOf({ reviewDecision: 'CHANGES_REQUESTED', reviewThreads: threads(4) }),
      'нужны правки',
    )
  })
})

describe('overviewOf: порядок строк и итог', () => {
  const mixed = () => [
    entryOf(1, { mergeStateStatus: 'CLEAN' }),
    entryOf(2, { state: 'MERGED' }),
    entryOf(3, { mergeStateStatus: 'DIRTY' }),
    loadingOf(4),
    entryOf(5, { reviewThreads: threads(2) }),
    entryOf(6, { mergeStateStatus: 'BLOCKED' }),
  ]

  test('what calls comes first, and the order of adding holds inside a group', () => {
    assert.deepEqual(
      overviewOf(mixed()).rows.map(row => row.label),
      // act: 3, 5; wait: 1, 6; unknown: 4; idle: 2
      ['marketplace#3', 'marketplace#5', 'marketplace#1', 'marketplace#6', 'marketplace#4', 'marketplace#2'],
    )
  })

  test('the totals count every group, the threads and the failed polls', () => {
    const overview = overviewOf([
      ...mixed(),
      { ...entryOf(7, { reviewThreads: threads(3) }), error: 'GitHub ответил 502' },
      entryOf(8, { mergeStateStatus: 'CLEAN' }, 'other'),
    ])

    assert.equal(overview.total, 8)
    assert.equal(overview.act, 3)
    assert.equal(overview.wait, 3)
    assert.equal(overview.unknown, 1)
    assert.equal(overview.idle, 1)
    assert.equal(overview.threadsOpen, 5)
    assert.equal(overview.failed, 1)
    assert.equal(overview.hosts, 1)
  })

  test('two hosts are counted, because the row then needs the host', () => {
    const overview = overviewOf([
      entryOf(1),
      { ...watchedOf(refOf(2, 'app', 'gh.corp'), false), data: dataOf() },
    ])

    assert.equal(overview.hosts, 2)
    assert.deepEqual(
      overview.rows.map(row => row.host),
      ['github.com', 'gh.corp'],
    )
  })

  test('an empty watch list is an empty overview, not a crash', () => {
    const overview = overviewOf([])

    assert.deepEqual(overview.rows, [])
    assert.equal(overview.total, 0)
    assert.equal(overview.hosts, 0)
    assert.equal(overview.threadsOpen, 0)
  })
})

describe('overviewOf: поля строки', () => {
  test('the row carries the address, the facts and the review verdict', () => {
    const [row] = overviewOf([
      entryOf(7, {
        reviewDecision: 'APPROVED',
        latestReviews: { nodes: [{ state: 'APPROVED', author: { login: 'mmx003' } }] },
        reviewThreads: threads(2),
      }),
    ]).rows

    assert.equal(row?.key, 'github.com/dex-it/marketplace#7')
    assert.equal(row?.label, 'marketplace#7')
    assert.equal(row?.host, 'github.com')
    assert.equal(row?.title, 'Фикс гонки в очереди')
    assert.equal(row?.webUrl, 'https://github.com/dex-it/marketplace/pull/7')
    assert.equal(row?.state, 'open')
    assert.equal(row?.merge, 'blocked')
    assert.equal(row?.ci, 'success')
    assert.equal(row?.ciLevel, 'ok')
    assert.equal(row?.threadsOpen, 2)
    assert.equal(row?.threadsTotal, 2)
    assert.equal(row?.review, 'одобрен, 1')
    assert.equal(row?.error, null)
  })

  test('a head commit without checks says nothing about them', () => {
    const [row] = overviewOf([entryOf(7, { head: { nodes: [{ commit: { oid: 'a' } }] } })]).rows

    assert.equal(row?.ci, null)
    assert.equal(row?.ciLevel, null)
  })

  test('a repository that requires no review and got none says nothing', () => {
    const [row] = overviewOf([entryOf(7, { reviewDecision: null })]).rows

    assert.equal(row?.review, null)
  })

  test('a draft is named draft, not open', () => {
    const [row] = overviewOf([entryOf(7, { isDraft: true })]).rows

    assert.equal(row?.state, 'draft')
  })

  test('a failed poll keeps the facts it had beside the error', () => {
    const [row] = overviewOf([
      { ...entryOf(7, { mergeStateStatus: 'DIRTY' }), error: 'GitHub ответил 502' },
    ]).rows

    assert.equal(row?.error, 'GitHub ответил 502')
    assert.equal(row?.attention, 'act')
    assert.equal(row?.merge, 'dirty')
  })
})

describe('слова групп', () => {
  test('every group has both forms, and none of them is empty', () => {
    for (const group of ['act', 'wait', 'unknown', 'idle'] as const) {
      assert.ok(ATTENTION_ONE[group].length > 0, group)
      assert.ok(ATTENTION_MANY[group].length > 0, group)
    }
  })
})

describe('overviewText', () => {
  test('the head counts only what is there, and the rows follow the list order', () => {
    const text = overviewText([
      entryOf(1, { mergeStateStatus: 'CLEAN' }),
      entryOf(2, { mergeStateStatus: 'DIRTY', reviewThreads: threads(2) }),
    ])
    const lines = text.split('\n')

    assert.equal(
      lines[0],
      `**Мониторинг pull request** - 2: 1 ${ATTENTION_MANY.act}, 1 ${ATTENTION_MANY.wait}, 2 открытых тредов`,
    )
    assert.equal(lines[1], '')
    assert.equal(
      lines[2],
      `- **marketplace#2** (${ATTENTION_ONE.act}): dirty - Фикс гонки в очереди`,
    )
    assert.equal(lines[3], '  https://github.com/dex-it/marketplace/pull/7')
    assert.equal(
      lines[4],
      `- **marketplace#1** (${ATTENTION_ONE.wait}): clean - Фикс гонки в очереди`,
    )
  })

  test('a group with nobody in it is not printed at all', () => {
    const text = overviewText([entryOf(1, { mergeStateStatus: 'CLEAN' })])

    assert.equal(text.split('\n')[0], `**Мониторинг pull request** - 1: 1 ${ATTENTION_MANY.wait}`)
    assert.equal(text.includes('открытых тредов'), false)
    assert.equal(text.includes('опрос не удался'), false)
  })

  test('a failed poll and a missing first poll are both counted', () => {
    const text = overviewText([
      loadingOf(1),
      { ...entryOf(2, { mergeStateStatus: 'CLEAN' }), error: 'GitHub ответил 502' },
    ])

    assert.ok(text.includes(`1 ${ATTENTION_MANY.unknown}`))
    assert.ok(text.includes('опрос не удался у 1'))
    assert.ok(text.includes(`(${ATTENTION_ONE.unknown}): первый опрос идёт`))
  })

  test('an empty watch list says so in one line', () => {
    assert.equal(overviewText([]), 'Ни один pull request не отслеживается.')
  })
})
