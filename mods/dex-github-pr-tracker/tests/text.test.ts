// Тексты, которые читает модель: состояние PR, открытые треды и проверки.
// Проверяются прогоном, потому что именно они - обещание мода отдать текстом
// всё, что он нарисовал человеку; в живой сессии их дефект выглядит как
// «модель не увидела замечания», а не как падение.
//
//   node --test mods/dex-github-pr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { prDataOf, threadsOf } from '../hooks/github.ts'
import type { PrData } from '../hooks/github.ts'
import { checksText, noPrText, statusText, threadsText } from '../hooks/text.ts'
import type { Watched } from '../hooks/watched.ts'
import { openThreadsOf, resolvedThreadsOf, watchedOf } from '../hooks/watched.ts'

const URL_7 = 'https://github.com/dex-it/marketplace/pull/7'
const REF = { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 }

const threadNodeOf = (over: Record<string, unknown> = {}) => ({
  id: 'PRRT_1',
  isResolved: false,
  isOutdated: false,
  path: 'src/queue.ts',
  line: 42,
  originalLine: 42,
  comments: {
    totalCount: 2,
    nodes: [
      {
        author: { login: 'reviewer' },
        body: 'Здесь гонка',
        url: `${URL_7}#discussion_r1`,
        createdAt: '2026-09-20T10:00:00Z',
      },
    ],
  },
  tail: { nodes: [{ author: { login: 'author' }, createdAt: '2026-09-20T11:00:00Z' }] },
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

const prNodeOf = (over: Record<string, unknown> = {}) => ({
  number: 7,
  title: 'Фикс гонки в очереди',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'BLOCKED',
  reviewDecision: 'REVIEW_REQUIRED',
  additions: 322,
  deletions: 109,
  changedFiles: 18,
  url: URL_7,
  updatedAt: '2026-09-20T12:00:00Z',
  headRefName: 'fix/queue',
  baseRefName: 'develop',
  author: { login: 'yaryrslv' },
  labels: { nodes: [{ name: 'bug' }] },
  assignees: { nodes: [] },
  reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'mmx003' } }] },
  latestReviews: { nodes: [{ state: 'APPROVED', author: { login: 'mmx003' } }] },
  comments: { totalCount: 3 },
  commits: { totalCount: 12, nodes: [] },
  head: {
    nodes: [
      {
        commit: {
          oid: 'abcdef12',
          statusCheckRollup: { state: 'SUCCESS', contexts: { nodes: [runOf()] } },
        },
      },
    ],
  },
  reviewThreads: {
    totalCount: 1,
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [threadNodeOf()],
  },
  ...over,
})

const dataOf = (over: Record<string, unknown> = {}): PrData => {
  const pr = prNodeOf(over)

  return prDataOf({ pr, threads: threadsOf(pr.reviewThreads) })
}

const entryOf = (over: Record<string, unknown> = {}, error?: string): Watched => ({
  ...watchedOf(REF, true),
  data: dataOf(over),
  ...(error === undefined ? {} : { error }),
})

describe('statusText', () => {
  test('one fact per line, and the label carries the title', () => {
    const lines = statusText(entryOf()).split('\n')

    assert.equal(lines[0], '**marketplace#7** - Фикс гонки в очереди')
    assert.equal(lines[1], '')
    assert.ok(lines.includes('- Состояние: open'))
    assert.ok(lines.includes('- Ветки: fix/queue -> develop'))
    assert.ok(lines.includes('- Merge: blocked'))
    assert.ok(lines.includes('- Проверки: success (обязательных 1 из 1)'))
    assert.ok(lines.includes('- Ревью: ждёт ревью; апрувы: mmx003'))
    assert.ok(lines.includes('- Треды: 1 открытых из 1'))
    assert.ok(lines.includes('- Комментарии в обсуждении: 3'))
    assert.ok(lines.includes('- Коммиты: 12'))
    assert.ok(lines.includes('- Объём: +322 -109 в 18 файлах'))
    assert.ok(lines.includes('- Ревьюеры: mmx003'))
    assert.ok(lines.includes('- Метки: bug'))
    assert.ok(lines.includes(`- Ссылка: ${URL_7}`))
  })

  test('a draft is named draft, not open', () => {
    assert.ok(statusText(entryOf({ isDraft: true })).includes('- Состояние: draft'))
  })

  test('conflicts and an uncomputed merge are named beside the status', () => {
    assert.ok(
      statusText(entryOf({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })).includes(
        '- Merge: dirty, есть конфликты',
      ),
    )
    assert.ok(
      statusText(entryOf({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' })).includes(
        '- Merge: unknown, слияние ещё считается',
      ),
    )
  })

  test('a fact nobody stated is left out instead of drawn as zero', () => {
    const text = statusText(
      entryOf({
        reviewDecision: null,
        latestReviews: { nodes: [] },
        labels: { nodes: [] },
        reviewRequests: { nodes: [] },
        head: { nodes: [{ commit: { oid: 'abcdef12' } }] },
      }),
    )

    assert.equal(text.includes('- Ревью'), false)
    assert.equal(text.includes('- Метки'), false)
    assert.equal(text.includes('- Ревьюеры'), false)
    assert.equal(text.includes('- Проверки'), false)
  })

  test('a failed poll is a line, and the previous facts stay beside it', () => {
    const text = statusText(entryOf({}, 'GitHub ответил 502'))

    assert.ok(text.includes('- Последний опрос: не удался: GitHub ответил 502'))
    assert.ok(text.includes('- Состояние: open'))
  })

  test('with no data at all the reason is the whole answer', () => {
    const empty: Watched = { ...watchedOf(REF, true), error: 'нет токена' }

    assert.equal(statusText(empty), '**marketplace#7** - нет токена')
    assert.equal(statusText(watchedOf(REF, true)), '**marketplace#7** - данных ещё нет')
  })
})

describe('threadsText', () => {
  test('every open thread is addressed by file, line, author and link', () => {
    const text = threadsText(entryOf())

    assert.ok(text.startsWith('**Открытые треды marketplace#7** - 1 из 1'))
    assert.ok(text.includes(URL_7))
    assert.ok(text.includes('- **src/queue.ts:42**'))
    assert.ok(text.includes('  reviewer, комментариев 2, последний от author'))
    assert.ok(text.includes('  Здесь гонка'))
    assert.ok(text.includes(`  ${URL_7}#discussion_r1`))
  })

  test('a thread whose line moved says so instead of pointing at the wrong line', () => {
    const text = threadsText(
      entryOf({
        reviewThreads: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [threadNodeOf({ isOutdated: true, line: null, originalLine: 40 })],
        },
      }),
    )

    assert.ok(text.includes('- **src/queue.ts:40** (строка уехала в новых коммитах)'))
  })

  test('a thread on the file as a whole is named as discussion of the code', () => {
    const text = threadsText(
      entryOf({
        reviewThreads: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [threadNodeOf({ path: null, line: null, originalLine: null })],
        },
      }),
    )

    assert.ok(text.includes('- **обсуждение кода**'))
  })

  test('no open threads is said, and the closed ones are counted', () => {
    const text = threadsText(
      entryOf({
        reviewThreads: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [threadNodeOf({ isResolved: true })],
        },
      }),
    )

    assert.equal(text, 'marketplace#7: открытых тредов нет (закрыто 1)')
  })

  test('a discussion longer than the prompt allows is cut, and the cut is named', () => {
    const nodes = Array.from({ length: 5 }, (_, index) =>
      threadNodeOf({ id: `PRRT_${index}`, line: index + 1 }),
    )
    const text = threadsText(
      entryOf({
        reviewThreads: { totalCount: 5, pageInfo: { hasNextPage: false, endCursor: null }, nodes },
      }),
      400,
    )

    assert.ok(/- \.\.\. ещё \d+ тредов, см\./.test(text))
  })

  test('with no data at all the label and the reason are the whole answer', () => {
    assert.equal(threadsText(watchedOf(REF, true)), 'marketplace#7: данных ещё нет')
  })
})

describe('checksText', () => {
  test('all green is said in one line, with the counts above it', () => {
    const text = checksText(entryOf())

    assert.ok(
      text.startsWith(
        '**Проверки marketplace#7** - success, всего 1, обязательных 1, роллап GitHub по всем: success',
      ),
    )
    assert.ok(text.endsWith('Все проверки зелёные.'))
  })

  test('a not green check names itself, whether it blocks the merge and its log', () => {
    const text = checksText(
      entryOf({
        head: {
          nodes: [
            {
              commit: {
                oid: 'abcdef12',
                statusCheckRollup: {
                  state: 'FAILURE',
                  contexts: {
                    nodes: [
                      runOf({ name: 'tests', conclusion: 'FAILURE' }),
                      runOf({ name: 'lint', isRequired: false, conclusion: 'FAILURE', detailsUrl: '' }),
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    )

    assert.ok(text.includes('- **tests** (обязательная): failure\n  https://ci/1'))
    assert.ok(text.includes('- **lint** (необязательная): failure'))
    // Слово вердикта - по обязательным, роллап назван отдельно и как есть.
    assert.ok(
      text.startsWith(
        '**Проверки marketplace#7** - failure, всего 2, обязательных 1, роллап GitHub по всем: failure',
      ),
    )
  })

  test('a head commit without checks says that, not that they passed', () => {
    const text = checksText(entryOf({ head: { nodes: [{ commit: { oid: 'abcdef12' } }] } }))

    assert.equal(text, 'marketplace#7: у головного коммита проверок нет')
  })
})

describe('openThreadsOf and resolvedThreadsOf', () => {
  test('open threads come oldest answer first: that is what to answer next', () => {
    const data = dataOf({
      reviewThreads: {
        totalCount: 3,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          threadNodeOf({
            id: 'new',
            tail: { nodes: [{ author: { login: 'a' }, createdAt: '2026-09-21T10:00:00Z' }] },
          }),
          threadNodeOf({ id: 'closed', isResolved: true }),
          threadNodeOf({
            id: 'old',
            tail: { nodes: [{ author: { login: 'a' }, createdAt: '2026-09-19T10:00:00Z' }] },
          }),
        ],
      },
    })

    assert.deepEqual(
      openThreadsOf(data).map(thread => thread.id),
      ['old', 'new'],
    )
    assert.deepEqual(
      resolvedThreadsOf(data).map(thread => thread.id),
      ['closed'],
    )
  })

  test('sorting does not move the list the poll handed over', () => {
    const data = dataOf({
      reviewThreads: {
        totalCount: 2,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          threadNodeOf({
            id: 'new',
            tail: { nodes: [{ author: { login: 'a' }, createdAt: '2026-09-21T10:00:00Z' }] },
          }),
          threadNodeOf({
            id: 'old',
            tail: { nodes: [{ author: { login: 'a' }, createdAt: '2026-09-19T10:00:00Z' }] },
          }),
        ],
      },
    })

    openThreadsOf(data)

    assert.deepEqual(
      data.threads.map(thread => thread.id),
      ['new', 'old'],
    )
  })
})

describe('noPrText', () => {
  test('the answer names both ways to get a pull request on screen', () => {
    assert.ok(noPrText.includes('/pr 123'))
    assert.ok(noPrText.includes('ссылк'))
  })
})
