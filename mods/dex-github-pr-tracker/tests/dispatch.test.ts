// Поручения, которые мод отдаёт по кнопке: какие треды берутся и что в тексте
// для агента. Агент стартует с пустым контекстом, поэтому в тексте должно быть
// всё, и это проверяется здесь, а не в сессии.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { fixPrompt, pickThreads, reviewPrompt } from '../hooks/dispatch.ts'
import { prDataOf, threadsOf } from '../hooks/github.ts'
import type { Watched } from '../hooks/watched.ts'
import { watchedOf } from '../hooks/watched.ts'

const URL_7 = 'https://github.com/dex-it/marketplace/pull/7'
const REF = { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 }

const threadNode = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  isResolved: false,
  isOutdated: false,
  path: `src/${id}.ts`,
  line: 10,
  originalLine: 10,
  comments: {
    totalCount: 1,
    nodes: [{ author: { login: 'reviewer' }, body: `замечание ${id}`, url: `${URL_7}#${id}`, createdAt: '2026-09-20T10:00:00Z' }],
  },
  tail: { nodes: [{ author: { login: 'reviewer' }, createdAt: '2026-09-20T10:00:00Z' }] },
  ...over,
})

const entryOf = (nodes: unknown[], state = 'OPEN'): Watched => {
  const pr = {
    number: 7,
    title: 'Фикс гонки',
    state,
    url: URL_7,
    headRefName: 'fix/queue',
    baseRefName: 'develop',
    reviewThreads: { totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes },
  }

  return { ...watchedOf(REF, false), data: prDataOf({ pr, threads: threadsOf(pr.reviewThreads) }) }
}

describe('pickThreads', () => {
  test('all takes every open thread and leaves the resolved ones', () => {
    const pick = pickThreads(entryOf([threadNode('a'), threadNode('b', { isResolved: true })]), 'all')

    assert.ok(pick.ok)
    assert.deepEqual(pick.threads.map(thread => thread.id), ['a'])
  })

  test('a number is the place among the open threads, as /pr threads counts them', () => {
    const entry = entryOf([threadNode('a'), threadNode('b', { isResolved: true }), threadNode('c')])
    const pick = pickThreads(entry, 2)

    assert.ok(pick.ok)
    assert.deepEqual(pick.threads.map(thread => thread.id), ['c'])
  })

  test('a number past the end says how many there are', () => {
    const pick = pickThreads(entryOf([threadNode('a')]), 5)

    assert.ok(!pick.ok)
    assert.ok(pick.reason.includes('тред 5 не найден, открытых 1'))
  })

  test('no open threads, a closed PR and no data are each said, not sent to an agent', () => {
    const none = pickThreads(entryOf([threadNode('a', { isResolved: true })]), 'all')
    const merged = pickThreads(entryOf([threadNode('a')], 'MERGED'), 'all')
    const empty = pickThreads(watchedOf(REF, false), 'all')

    assert.ok(!none.ok && none.reason.includes('открытых тредов нет'))
    assert.ok(!merged.ok && merged.reason.includes('PR не открыт'))
    assert.ok(!empty.ok && empty.reason.includes('данных ещё нет'))
  })
})

describe('reviewPrompt', () => {
  test('the command and the link, with one slash however the setting is written', () => {
    assert.equal(reviewPrompt('mr-review', entryOf([])), `/mr-review ${URL_7}`)
    assert.equal(reviewPrompt('/mr-review', entryOf([])), `/mr-review ${URL_7}`)
  })

  test('no data means no prompt', () => {
    assert.equal(reviewPrompt('mr-review', watchedOf(REF, false)), null)
  })
})

describe('fixPrompt', () => {
  const entry = entryOf([threadNode('a'), threadNode('b')])
  const pick = pickThreads(entry, 'all')

  test('carries the branch, every thread with its address and the link', () => {
    assert.ok(pick.ok)

    const text = fixPrompt(entry, pick.threads, { push: false })

    assert.ok(text.includes('fix/queue -> develop'))
    assert.ok(text.includes('src/a.ts:10'))
    assert.ok(text.includes('src/b.ts:10'))
    assert.ok(text.includes(`${URL_7}#a`))
    assert.ok(text.includes('worktree'))
  })

  test('never resolves threads or answers in them', () => {
    assert.ok(pick.ok)
    assert.ok(fixPrompt(entry, pick.threads, { push: true }).includes('Треды не резолви и в PR не отвечай'))
  })

  test('push is allowed into the PR branch only when the setting says so', () => {
    assert.ok(pick.ok)

    const local = fixPrompt(entry, pick.threads, { push: false })
    const pushed = fixPrompt(entry, pick.threads, { push: true })

    assert.ok(local.includes('Запушить нельзя'))
    assert.ok(!local.includes('Запушь коммиты'))
    assert.ok(pushed.includes('Запушь коммиты в ветку fix/queue этого же PR'))
  })
})
